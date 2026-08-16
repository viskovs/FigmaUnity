# Модель аннотаций

## Хранение

Аннотация сохраняется на Figma node через Shared Plugin Data:

```text
namespace: figmagamedev
key: annotation
value: JSON string
```

Shared data выбрана, чтобы данные можно было читать через Figma REST API с
параметром `plugin_data=shared` и из будущих интеграционных плагинов.

## Общие поля

```json
{
  "schemaVersion": 1,
  "kind": "screen",
  "id": "lootbox-shop.main",
  "featureId": "lootbox-shop",
  "unityName": "LootboxShopScreen",
  "figmaNodeId": "123:456",
  "figmaNodeName": "Main Shop",
  "updatedAt": "2026-08-16T10:00:00.000Z"
}
```

`figmaNodeId` используется для traceability и повторного импорта. Стабильным
интеграционным ключом остаётся `id`.

## Kind

### Feature

Обязательные поля: `kind`, `id`.

### Screen

Обязательные поля: `kind`, `id`, `featureId`, `unityName`.

Дополнительные: `templateId`, `rootKind`.

### Component

Обязательные поля: `kind`, `id`, `unityName`, `generationMode`.

Режимы:

- `reuse-prefab`;
- `prefab-variant`;
- `new-prefab`;
- `visual-only`.

Для `prefab-variant` обязателен `basePrefabId`.

### Layer

Должна присутствовать хотя бы одна запись в `roles`.

## Variant policies

`missingChildren`:

- `deactivate` — предпочитаемый обратимый вариант;
- `keep` — оставить базовый элемент;
- `remove` — удалить, только если это разрешено catalog.

`newChildren`:

- `slots-only` — добавлять только в зарегистрированные slots;
- `allow` — разрешить с предупреждением;
- `reject` — запретить.

## Roles

- `screen-root`;
- `safe-area`;
- `animation-group`;
- `content-slot`;
- `repeated-list`;
- `preserve-wrapper`;
- `ignore`.

## Обратная совместимость

Reader обязан проверять `schemaVersion`. Новые необязательные поля можно добавлять
без увеличения major schema. Переименование или изменение значения существующего
поля требует новой версии и миграции.
