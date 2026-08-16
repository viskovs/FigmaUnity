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
  "version": "0.1.0"
}
```

### Публикация

```http
POST /publish
Content-Type: application/json
```

Тело — полный `figma-gamedev-ui-package`.

Ответ:

```json
{
  "ok": true,
  "file": "/project/Library/FigmaGamedev/Inbox/screen-....json"
}
```

## Inbox

```text
Library/FigmaGamedev/Inbox/
```

Имена включают entity ID и UTC timestamp. Повторная публикация не перезаписывает
предыдущий файл.

## Почему используется Library

- не запускается AssetDatabase import;
- не создаётся мусорный Git diff;
- входящий файл не считается доверенным Unity asset;
- AI или compiler может проверить package до записи в `Assets`.

## Ограничения MVP

- один фиксированный порт;
- только JSON, без PNG/SVG;
- нет списка проектов при нескольких Unity Editor;
- нет очереди и статуса обработки;
- нет подтверждения, что prefab собран;
- inbox не очищается автоматически.

## Будущее расширение

Планируется протокол discovery на диапазоне портов, project ID, package hash,
version acknowledgement, progress status и безопасная передача asset blobs.
