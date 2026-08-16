# Архитектура

## Цель

Система должна переносить дизайн-намерение, переиспользовать production-prefab и
создавать оптимизированную мобильную иерархию. Копирование Figma tree один к одному
не является целевой архитектурой.

## Слои

### Figma semantic layer

Отвечает за:

- UI разметки;
- Shared Plugin Data;
- чтение Auto Layout;
- validation;
- экспорт package;
- доставку в Unity.

### Unity Catalog

Определяет доступные templates, prefabs, variants, slots и behavior profiles.

### Transport

MVP поддерживает JSON download и localhost HTTP bridge.

### Normalizer — planned

Преобразует произвольную визуальную иерархию в логическое дерево:

- удаляет пустые wrappers;
- сохраняет semantic boundaries;
- объединяет избыточные layout-контейнеры;
- выделяет visual, layout и behavior nodes.

### Unity compiler — planned

- создаёт screen template instance или Prefab Variant;
- разрешает prefab bindings;
- выбирает layout recipes;
- добавляет project-specific components;
- заполняет serialized references;
- импортирует ассеты;
- сохраняет ownership metadata.

### AI skill — planned

AI решает неоднозначные задачи, но детерминированные операции выполняет Unity Editor
tool. Skill будет задавать порядок: parse → normalize → compile → validate → render.

## Ownership

Figma владеет:

- layout intent;
- выбором компонента/варианта;
- текстом preview;
- semantic roles.

Unity владеет:

- gameplay scripts;
- event bindings;
- prefab internals;
- Addressables;
- localization keys;
- production animation implementation.

Повторный импорт не должен удалять Unity-owned данные.

## Mobile constraints

Compiler должен контролировать глубину иерархии, LayoutGroup/ContentSizeFitter
конфликты, Canvas boundaries, masks, materials, overdraw, количество анимируемых
элементов и virtualization больших списков.
