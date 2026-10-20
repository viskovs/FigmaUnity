# Unity Bridge

## Назначение

Локальный bridge принимает JSON-пакет из Figma Desktop и сохраняет его в Unity
project `Library`. Он отделяет доставку макета от будущей генерации prefab.

## Endpoint

По умолчанию сервер слушает:

```text
http://localhost:19783/
```

### Проверка состояния

```http
GET /health
```

Пример ответа:

```json
{
  "ok": true,
  "project": "ExampleGame",
  "version": "0.3.0",
  "requiresToken": true
}
```

### Session token

В Unity выполните **Tools → FigmaGamedev → Copy Bridge Token**, затем вставьте
значение в секцию **Публикация → Подключение к Unity** в Figma. Token живёт одну
Editor-сессию и меняется после domain reload или перезапуска Unity.

Все endpoint, кроме `/health` и `OPTIONS`, требуют заголовок:

```http
X-FigmaGamedev-Token: <session-token>
```

### Статус

```http
GET /status
X-FigmaGamedev-Token: <session-token>
```

Возвращает `lastPackageId` и `lastReceiptId`.

### Публикация

```http
POST /publish
Content-Type: application/json
X-FigmaGamedev-Token: <session-token>
```

Тело — полный `figma-gamedev-ui-package`.

Ответ:

```json
{
  "ok": true,
  "receiptId": "receipt-20261021-...",
  "packageId": "shop.main-12ab34cd",
  "duplicate": false,
  "file": "/project/Library/FigmaGamedev/Inbox/shop.main-12ab34cd.figma-gamedev.json"
}
```

## Inbox

```text
Library/FigmaGamedev/Inbox/
```

Имена включают entity ID и content fingerprint. Повторная публикация идентичного
пакета подтверждается с `duplicate: true` и не создаёт второй inbox-файл.
Каждый приём также создаёт receipt в `Library/FigmaGamedev/Receipts/`.

## Почему используется Library

- не запускается AssetDatabase import;
- не создаётся мусорный Git diff;
- входящий файл не считается доверенным Unity asset;
- AI или compiler может проверить package до записи в `Assets`.

## Ограничения MVP

- один фиксированный порт;
- только JSON, без PNG/SVG;
- нет списка проектов при нескольких Unity Editor;
- receipt подтверждает доставку, но не компиляцию prefab;
- нет подтверждения, что prefab собран;
- inbox не очищается автоматически.

## Будущее расширение

Планируется протокол discovery на диапазоне портов, project ID, progress status
compiler и безопасная передача asset blobs.
