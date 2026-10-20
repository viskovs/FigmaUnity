using System;
using System.IO;
using System.Net;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using UnityEditor;
using UnityEngine;

namespace HyperHug.FigmaGamedev.Editor
{
    [InitializeOnLoad]
    public static class FigmaGamedevServer
    {
        private const int Port = 19783;
        private const string BridgeVersion = "0.3.0";
        private const string TokenHeader = "X-FigmaGamedev-Token";
        private const string MenuRoot = "Tools/FigmaGamedev/";
        private static readonly object FileLock = new();
        private static HttpListener _listener;
        private static Thread _thread;
        private static volatile bool _running;
        private static string _projectName = "Unity";
        private static string _sessionToken;
        private static string _lastPackageId;
        private static string _lastReceiptId;

        public static bool IsRunning => _running;
        public static string InboxPath => Path.GetFullPath(Path.Combine("Library", "FigmaGamedev", "Inbox"));

        static FigmaGamedevServer()
        {
            EditorApplication.delayCall += Start;
            AssemblyReloadEvents.beforeAssemblyReload += Stop;
            EditorApplication.quitting += Stop;
        }

        [MenuItem(MenuRoot + "Start Local Bridge")]
        public static void Start()
        {
            if (_running)
                return;

            try
            {
                _projectName = Application.productName;
                Directory.CreateDirectory(InboxPath);
                Directory.CreateDirectory(ReceiptsPath);
                _sessionToken ??= CreateSessionToken();
                LoadLastReceipt();
                _listener = new HttpListener();
                _listener.Prefixes.Add($"http://localhost:{Port}/");
                _listener.Start();
                _running = true;
                _thread = new Thread(ListenLoop)
                {
                    IsBackground = true,
                    Name = "FigmaGamedev"
                };
                _thread.Start();
                Debug.Log($"[FigmaGamedev] Listening on http://localhost:{Port}/");
            }
            catch (Exception exception)
            {
                _running = false;
                Debug.LogWarning($"[FigmaGamedev] Could not start: {exception.Message}");
            }
        }

        [MenuItem(MenuRoot + "Stop Local Bridge")]
        public static void Stop()
        {
            _running = false;
            try { _listener?.Stop(); } catch { /* ignored during editor shutdown */ }
            try { _listener?.Close(); } catch { /* ignored during editor shutdown */ }
            _listener = null;
            _thread = null;
        }

        [MenuItem(MenuRoot + "Open Inbox")]
        public static void OpenInbox()
        {
            Directory.CreateDirectory(InboxPath);
            EditorUtility.RevealInFinder(InboxPath);
        }

        [MenuItem(MenuRoot + "Copy Bridge Token")]
        public static void CopyBridgeToken()
        {
            _sessionToken ??= CreateSessionToken();
            EditorGUIUtility.systemCopyBuffer = _sessionToken;
            Debug.Log("[FigmaGamedev] Session token copied. Paste it into the FigmaGamedev plugin. " +
                      "It changes after an Editor domain reload or restart.");
        }

        private static string ReceiptsPath =>
            Path.GetFullPath(Path.Combine("Library", "FigmaGamedev", "Receipts"));

        private static void ListenLoop()
        {
            while (_running && _listener != null)
            {
                try
                {
                    var context = _listener.GetContext();
                    Handle(context);
                }
                catch (HttpListenerException) when (!_running) { }
                catch (ObjectDisposedException) when (!_running) { }
                catch (Exception exception)
                {
                    Debug.LogException(exception);
                }
            }
        }

        private static void Handle(HttpListenerContext context)
        {
            AddCorsHeaders(context.Response);
            if (context.Request.HttpMethod == "OPTIONS")
            {
                Respond(context.Response, 204, string.Empty);
                return;
            }

            if (!IsLocalRequest(context.Request))
            {
                RespondJson(context.Response, 403, "{\"ok\":false,\"error\":\"Local requests only\"}");
                return;
            }

            var path = context.Request.Url?.AbsolutePath ?? "/";
            if (context.Request.HttpMethod == "GET" && path == "/health")
            {
                var project = EscapeJson(_projectName);
                RespondJson(context.Response, 200,
                    $"{{\"ok\":true,\"project\":\"{project}\",\"version\":\"{BridgeVersion}\",\"requiresToken\":true}}");
                return;
            }

            if (!IsAuthorized(context.Request))
            {
                RespondJson(context.Response, 401,
                    "{\"ok\":false,\"error\":\"Invalid or expired bridge token\"}");
                return;
            }

            if (context.Request.HttpMethod == "GET" && path == "/status")
            {
                RespondJson(context.Response, 200,
                    $"{{\"ok\":true,\"lastPackageId\":{JsonStringOrNull(_lastPackageId)}," +
                    $"\"lastReceiptId\":{JsonStringOrNull(_lastReceiptId)}}}");
                return;
            }

            if (context.Request.HttpMethod == "POST" && path == "/publish")
            {
                ReceivePackage(context);
                return;
            }

            RespondJson(context.Response, 404, "{\"ok\":false,\"error\":\"Not found\"}");
        }

        private static void ReceivePackage(HttpListenerContext context)
        {
            const int maxBytes = 20 * 1024 * 1024;
            if (context.Request.ContentLength64 > maxBytes)
            {
                RespondJson(context.Response, 413, "{\"ok\":false,\"error\":\"Package too large\"}");
                return;
            }

            string json;
            using (var reader = new StreamReader(context.Request.InputStream, context.Request.ContentEncoding))
                json = reader.ReadToEnd();

            if (string.IsNullOrWhiteSpace(json) || json.Length > maxBytes)
            {
                RespondJson(context.Response, 400, "{\"ok\":false,\"error\":\"Invalid package\"}");
                return;
            }

            var schema = ExtractJsonString(json, "schema");
            var schemaVersion = ExtractJsonInt(json, "schemaVersion");
            var packageId = ExtractJsonString(json, "packageId");
            var contentHash = ExtractContentHash(json);
            if (!string.Equals(schema, "figma-gamedev-ui-package", StringComparison.Ordinal) ||
                schemaVersion != 2 || string.IsNullOrWhiteSpace(packageId) || string.IsNullOrWhiteSpace(contentHash))
            {
                RespondJson(context.Response, 422,
                    "{\"ok\":false,\"error\":\"Unsupported or incomplete package schema\"}");
                return;
            }

            var id = ExtractEntityId(json);
            var safeHash = SanitizeFilePart(contentHash, 32, "content");
            var fileName = $"{id}-{safeHash}.figma-gamedev.json";
            var path = Path.Combine(InboxPath, fileName);
            bool duplicate;
            lock (FileLock)
            {
                duplicate = File.Exists(path);
                if (!duplicate) WriteAtomically(path, json);
            }

            var receivedAt = DateTime.UtcNow.ToString("O");
            var receiptId = $"receipt-{DateTime.UtcNow:yyyyMMdd-HHmmssfff}-{safeHash}";
            var receipt =
                $"{{\"ok\":true,\"receiptId\":\"{EscapeJson(receiptId)}\"," +
                $"\"packageId\":\"{EscapeJson(packageId)}\",\"receivedAt\":\"{receivedAt}\"," +
                $"\"duplicate\":{duplicate.ToString().ToLowerInvariant()},\"file\":\"{EscapeJson(path)}\"}}";
            var receiptPath = Path.Combine(ReceiptsPath, $"{SanitizeFilePart(receiptId, 120, "receipt")}.json");
            lock (FileLock) WriteAtomically(receiptPath, receipt);

            _lastPackageId = packageId;
            _lastReceiptId = receiptId;

            Debug.Log($"[FigmaGamedev] {(duplicate ? "Acknowledged existing" : "Received")} {fileName}");
            RespondJson(context.Response, 200, receipt);
        }

        private static string ExtractEntityId(string json)
        {
            var match = Regex.Match(json, "\\\"id\\\"\\s*:\\s*\\\"([^\\\"]+)\\\"");
            var id = match.Success ? match.Groups[1].Value : "screen";
            id = Regex.Replace(id, "[^a-zA-Z0-9._-]+", "-").Trim('-');
            return string.IsNullOrEmpty(id) ? "screen" : id.Substring(0, Math.Min(id.Length, 80));
        }

        private static string ExtractJsonString(string json, string property)
        {
            var pattern = $"\\\"{Regex.Escape(property)}\\\"\\s*:\\s*\\\"([^\\\"]*)\\\"";
            var match = Regex.Match(json, pattern);
            return match.Success ? match.Groups[1].Value : null;
        }

        private static int ExtractJsonInt(string json, string property)
        {
            var pattern = $"\\\"{Regex.Escape(property)}\\\"\\s*:\\s*(\\d+)";
            var match = Regex.Match(json, pattern);
            return match.Success && int.TryParse(match.Groups[1].Value, out var value) ? value : -1;
        }

        private static string ExtractContentHash(string json)
        {
            var match = Regex.Match(json,
                "\\\"contentHash\\\"\\s*:\\s*\\{[^{}]*\\\"value\\\"\\s*:\\s*\\\"([^\\\"]+)\\\"");
            return match.Success ? match.Groups[1].Value : null;
        }

        private static string SanitizeFilePart(string value, int maxLength, string fallback)
        {
            var result = Regex.Replace(value ?? string.Empty, "[^a-zA-Z0-9._-]+", "-").Trim('-');
            if (string.IsNullOrEmpty(result)) result = fallback;
            return result.Substring(0, Math.Min(result.Length, maxLength));
        }

        private static void WriteAtomically(string path, string contents)
        {
            var temporaryPath = $"{path}.{Guid.NewGuid():N}.tmp";
            try
            {
                File.WriteAllText(temporaryPath, contents, new UTF8Encoding(false));
                if (File.Exists(path)) File.Delete(path);
                File.Move(temporaryPath, path);
            }
            finally
            {
                if (File.Exists(temporaryPath)) File.Delete(temporaryPath);
            }
        }

        private static string CreateSessionToken()
        {
            var bytes = new byte[32];
            using (var generator = RandomNumberGenerator.Create()) generator.GetBytes(bytes);
            return Convert.ToBase64String(bytes);
        }

        private static bool IsAuthorized(HttpListenerRequest request)
        {
            var provided = request.Headers[TokenHeader];
            if (string.IsNullOrEmpty(provided) || string.IsNullOrEmpty(_sessionToken)) return false;
            var expectedBytes = Encoding.UTF8.GetBytes(_sessionToken);
            var providedBytes = Encoding.UTF8.GetBytes(provided);
            if (expectedBytes.Length != providedBytes.Length) return false;
            var difference = 0;
            for (var index = 0; index < expectedBytes.Length; index++)
                difference |= expectedBytes[index] ^ providedBytes[index];
            return difference == 0;
        }

        private static void LoadLastReceipt()
        {
            try
            {
                var directory = new DirectoryInfo(ReceiptsPath);
                var files = directory.GetFiles("*.json");
                if (files.Length == 0) return;
                Array.Sort(files, (left, right) => right.LastWriteTimeUtc.CompareTo(left.LastWriteTimeUtc));
                var json = File.ReadAllText(files[0].FullName);
                _lastPackageId = ExtractJsonString(json, "packageId");
                _lastReceiptId = ExtractJsonString(json, "receiptId");
            }
            catch (Exception exception)
            {
                Debug.LogWarning($"[FigmaGamedev] Could not read last receipt: {exception.Message}");
            }
        }

        private static bool IsLocalRequest(HttpListenerRequest request)
        {
            var address = request.RemoteEndPoint?.Address;
            return address != null && IPAddress.IsLoopback(address);
        }

        private static void AddCorsHeaders(HttpListenerResponse response)
        {
            response.Headers["Access-Control-Allow-Origin"] = "*";
            response.Headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS";
            response.Headers["Access-Control-Allow-Headers"] = $"Content-Type, {TokenHeader}";
            response.Headers["Access-Control-Allow-Private-Network"] = "true";
        }

        private static void RespondJson(HttpListenerResponse response, int status, string json)
        {
            response.ContentType = "application/json; charset=utf-8";
            Respond(response, status, json);
        }

        private static void Respond(HttpListenerResponse response, int status, string body)
        {
            response.StatusCode = status;
            var bytes = Encoding.UTF8.GetBytes(body);
            response.ContentLength64 = bytes.Length;
            if (bytes.Length > 0)
                response.OutputStream.Write(bytes, 0, bytes.Length);
            response.OutputStream.Close();
        }

        private static string EscapeJson(string value) =>
            (value ?? string.Empty).Replace("\\", "\\\\").Replace("\"", "\\\"");

        private static string JsonStringOrNull(string value) =>
            string.IsNullOrEmpty(value) ? "null" : $"\"{EscapeJson(value)}\"";
    }
}
