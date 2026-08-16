using System;
using System.IO;
using System.Net;
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
        private const string MenuRoot = "Tools/FigmaGamedev/";
        private static readonly object FileLock = new();
        private static HttpListener _listener;
        private static Thread _thread;
        private static volatile bool _running;
        private static string _projectName = "Unity";

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
                    $"{{\"ok\":true,\"project\":\"{project}\",\"version\":\"0.1.0\"}}");
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

            var id = ExtractEntityId(json);
            var timestamp = DateTime.UtcNow.ToString("yyyyMMdd-HHmmssfff");
            var fileName = $"{id}-{timestamp}.figma-gamedev.json";
            var path = Path.Combine(InboxPath, fileName);
            lock (FileLock)
                File.WriteAllText(path, json, new UTF8Encoding(false));

            Debug.Log($"[FigmaGamedev] Received {fileName}");
            RespondJson(context.Response, 200,
                $"{{\"ok\":true,\"file\":\"{EscapeJson(path)}\"}}");
        }

        private static string ExtractEntityId(string json)
        {
            var match = Regex.Match(json, "\\\"id\\\"\\s*:\\s*\\\"([^\\\"]+)\\\"");
            var id = match.Success ? match.Groups[1].Value : "screen";
            id = Regex.Replace(id, "[^a-zA-Z0-9._-]+", "-").Trim('-');
            return string.IsNullOrEmpty(id) ? "screen" : id.Substring(0, Math.Min(id.Length, 80));
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
            response.Headers["Access-Control-Allow-Headers"] = "Content-Type";
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
    }
}
