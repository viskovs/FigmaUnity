# Формат экспортируемого пакета

## Корень

```json
{
  "schema": "figma-gamedev-ui-package",
  "schemaVersion": 1,
  "exportedAt": "2026-08-16T10:00:00.000Z",
  "figma": {},
  "entity": {},
  "catalogVersion": "1.0.0",
  "annotations": [],
  "document": {},
  "unityInspector": {}
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
- children.

Это сырой источник для normalizer. Он не является готовой Unity-иерархией.

Каждый сериализованный узел содержит `unityInspector` с предлагаемыми Unity-
компонентами и warnings. Корневое поле `unityInspector` дополнительно содержит
resolved values привязанных Figma Variables.

## Имена файлов

При скачивании:

```text
<entity-id>.figma-gamedev.json
```

В Unity Inbox добавляется timestamp для сохранения истории публикаций.

## Текущие ограничения

- binary assets не включены;
- fills, strokes и effects представлены не полностью;
- instance main component key для dynamic-page режима пока не разрешается;
- нет content hash и подписи;
- нет migration section.
