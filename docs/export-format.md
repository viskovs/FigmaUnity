# Формат экспортируемого пакета

## Корень

```json
{
  "schema": "figma-gamedev-ui-package",
  "schemaVersion": 2,
  "pluginVersion": "0.3.0",
  "packageId": "lootbox-shop.main-12ab34cd",
  "contentHash": {
    "algorithm": "fnv1a32",
    "value": "12ab34cd"
  },
  "exportedAt": "2026-08-16T10:00:00.000Z",
  "figma": {},
  "entity": {},
  "catalogVersion": "1.0.0",
  "annotations": [],
  "document": {},
  "unityInspector": {},
  "report": {}
}
```

## figma

```json
{
  "fileName": "Game UI",
  "pageName": "Shop",
  "rootNodeId": "123:456"
}
```

## entity

Аннотация выбранного корневого узла. Экспорт разрешён только для размеченного и
валидного объекта.

## annotations

Все размеченные потомки выбранного root. Аннотации вне экспортируемого поддерева не
включаются.

## document

Рекурсивное исходное дерево. Для каждого узла по возможности экспортируются:

- ID, name, type и visibility;
- position, size, rotation и opacity;
- `layoutMode` и `layoutWrap`;
- primary/counter sizing modes;
- alignment;
- item/counter-axis spacing;
- padding;
- horizontal/vertical sizing;
- min/max width/height;
- constraints;
- Figma component properties;
- semantic annotation;
- stable Figma component identity;
- resolved Unity binding и источник его разрешения;
- children.

Это сырой источник для normalizer. Он не является готовой Unity-иерархией.

Каждый сериализованный узел содержит `unityInspector` с предлагаемыми Unity-
компонентами и warnings. Корневое поле `unityInspector` дополнительно содержит
resolved values привязанных Figma Variables.

## Preflight report

`report` содержит `errors`, `warnings`, количество узлов, максимальную глубину,
mask budget и адресные записи с `nodeId`. Ошибки неизвестного prefab/profile,
дублированного semantic ID или screen template блокируют публикацию. Потери
визуальной конвертации и unmapped instances остаются предупреждениями.

`packageId` воспроизводим для одинакового содержимого. `exportedAt` в fingerprint
не входит, поэтому повторная отправка одного пакета распознаётся Unity Bridge как
duplicate и не создаёт второй inbox-файл. FNV-1a используется как fingerprint
для идемпотентности, а не как криптографическая подпись.

## Имена файлов

При скачивании:

```text
<entity-id>.figma-gamedev.json
```

В Unity Inbox к entity ID добавляется content fingerprint. История подтверждений
хранится отдельно в `Library/FigmaGamedev/Receipts`.

## Текущие ограничения

- binary assets не включены;
- fills, strokes и effects представлены не полностью;
- fingerprint не является криптографической подписью;
- нет migration section.
