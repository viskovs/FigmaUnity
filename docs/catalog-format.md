# Формат Unity Catalog

Unity Catalog сообщает Figma-плагину, какие сущности разрешены конкретным Unity-
проектом. Плагин не должен хранить project-specific пути и C#-классы внутри себя.

## Минимальная структура

```json
{
  "schema": "figma-gamedev-ui-catalog",
  "version": "1.0.0",
  "features": [],
  "screenTemplates": [],
  "prefabs": [],
  "componentMappings": [],
  "safeAreaProfiles": [],
  "animationProfiles": []
}
```

## Features

```json
{
  "id": "lootbox-shop",
  "displayName": "Lootbox Shop",
  "unityNamespace": "Example.Game.UI.LootboxShop"
}
```

Будущий exporter может добавлять output paths и Addressables metadata. Дизайнеру
эти пути показывать не требуется.

## Screen templates

```json
{
  "id": "unity.screen.lobby",
  "displayName": "Lobby Screen"
}
```

В Unity этот ID должен разрешаться в prefab GUID или template descriptor.

## Prefabs

```json
{
  "id": "unity.ui.product-card",
  "displayName": "Product Card",
  "variants": ["Default", "Compact", "Featured"],
  "slots": ["BadgeSlot", "ActionSlot"]
}
```

Планируемые дополнительные поля:

- GUID и package-relative path;
- removable children;
- serialized property mappings;
- allowed nested prefabs;
- preview image;
- mobile cost metadata.

## Component mappings

Mapping позволяет всем instances одного Figma-компонента автоматически
переиспользовать production-prefab, даже если на каждом instance нет аннотации:

```json
{
  "id": "mapping.product-card",
  "figmaComponentKey": "abcdef123456",
  "figmaComponentName": "Product Card",
  "prefabId": "unity.ui.product-card",
  "generationMode": "reuse-prefab",
  "propertyBindings": [
    {
      "figmaProperty": "Title",
      "unityProperty": "titleText"
    }
  ]
}
```

Порядок разрешения:

1. явная Component-аннотация с `basePrefabId` на узле;
2. `figmaComponentKey` или `figmaComponentSetKey`;
3. `figmaComponentName` с игнорированием регистра, пробелов и пунктуации;
4. узел остаётся visual/unmapped и попадает в preflight report.

Key — основной production-вариант. Имя оставлено как удобный fallback и для
первичной настройки, но переименование компонента в Figma может его сломать.

## Safe Area profiles

```json
{
  "id": "unity.safe-area.default",
  "displayName": "Default Mobile Safe Area"
}
```

## Animation profiles

```json
{
  "id": "unity.animation.staggered-appear",
  "displayName": "Staggered Item Appear",
  "targetType": "RectTransform[]"
}
```

Будущий compiler должен получать из профиля component type, target property и
допустимые параметры. Figma-плагин не должен принимать произвольный C# type.

## Версионирование

Версия catalog попадает в экспортируемый package. Это позволяет определить, что
дизайнер публиковал экран со старым набором prefab или profiles.

## Текущий способ доставки

Каталог импортируется через file input и хранится в `figma.clientStorage`. Это
локальное хранилище: каждый дизайнер импортирует каталог отдельно.
