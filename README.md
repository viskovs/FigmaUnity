# FigmaGamedev

FigmaGamedev — прототип пайплайна семантической передачи игровых интерфейсов из
Figma в Unity. Дизайнер размечает фичи, экраны, компоненты и поведение прямо в
Figma, а Unity и AI-инструменты получают не только изображение макета, но и
формальный контракт для сборки оптимизированного UI.

> Статус: ранний MVP для проверки процесса разметки. Автоматическая генерация
> Unity-prefab, импорт графики и AI-skill ещё не реализованы.

## Что уже работает

- сущности `Feature`, `Screen`, `Component` и `Layer / Behavior`;
- связь экрана с feature, Unity-именем и screen template;
- намерение переиспользовать prefab, создать новый prefab или Prefab Variant;
- политики `Keep`, `Deactivate`, `Remove` и ограничения новых дочерних элементов;
- роли `Screen Root`, `Safe Area`, `Animation Group`, `Content Slot`,
  `Repeated List`, `Preserve Wrapper` и `Ignore`;
- параметры Animation Group: профиль, выбор целей, порядок и задержка;
- импорт Unity Catalog из JSON;
- валидация выбранного узла;
- сканирование размеченных узлов текущей страницы;
- экспорт выбранной сущности и Auto Layout-дерева в JSON;
- Unity Inspector Preview для выбранного слоя;
- Dev Mode codegen `Unity uGUI Inspector`;
- hints для RectTransform, Image/RawImage, TMP, CanvasGroup, LayoutGroup,
  ContentSizeFitter и LayoutElement;
- совместимый TMP Rich Text и исходные mixed-style segments;
- Figma Source, resolved variables и явные warnings для неоднозначных свойств;
- отправка пакета в Unity через локальный bridge на `localhost:19783`.

## Общая схема

```text
Unity Catalog
      ↓
FigmaGamedev plugin
      ↓ дизайнер размечает Screen / Component / Behavior
Semantic UI package
      ↓ JSON-файл или localhost bridge
Unity inbox
      ↓ будущий compiler / AI skill
Prefab Variant + проектные компоненты + проверка
```

## Быстрый старт

### 1. Подключить Figma-плагин

1. Склонируйте репозиторий.
2. Откройте Figma Desktop и любой Figma Design-файл.
3. Выберите **Plugins → Development → Import plugin from manifest…**.
4. Укажите корневой `manifest.json`.
5. Запустите **Plugins → Development → FigmaGamedev**.

Для послойной проверки Unity-полей откройте **Dev Mode → Code** и выберите
`Unity uGUI Inspector`.

Если Figma отклоняет development ID, создайте пустой development plugin,
скопируйте числовой `id` из созданного manifest в этот `manifest.json` и снова
импортируйте его.

### 2. Импортировать пример каталога

В секции **Unity Catalog** загрузите
`examples/figma-gamedev-catalog.example.json`.

### 3. Разметить экран

Выделите один верхнеуровневый Frame:

```text
Type: Screen
ID: lootbox-shop.main
Feature ID: lootbox-shop
Unity Name: LootboxShopScreen
Template: unity.screen.lobby
```

Нажмите **Сохранить разметку**.

### 4. Экспортировать

Снова выделите корень экрана и нажмите **Скачать JSON**. Плагин создаст файл
`lootbox-shop.main.figma-gamedev.json`.

## Подключение к Unity

1. В Unity откройте **Window → Package Manager**.
2. Выберите **+ → Add package from disk…**.
3. Укажите `UnityPackage/package.json`.
4. После компиляции bridge запустится автоматически.
5. Перезапустите Figma-плагин.
6. Нажмите **Отправить выбранный экран в Unity**.

Входящие пакеты сохраняются в
`<Unity project>/Library/FigmaGamedev/Inbox/`. Bridge не изменяет `Assets` и не
создаёт prefab автоматически.

## Документация

- [Установка](docs/installation.md)
- [Рабочий процесс дизайнера](docs/designer-workflow.md)
- [Unity Bridge](docs/unity-bridge.md)
- [Модель аннотаций](docs/annotation-model.md)
- [Формат Unity Catalog](docs/catalog-format.md)
- [Формат экспорта](docs/export-format.md)
- [Unity Inspector Hints](docs/unity-inspector-hints.md)
- [Архитектура](docs/architecture.md)
- [Разработка плагина](docs/development.md)
- [Безопасность](docs/security.md)
- [Решение проблем](docs/troubleshooting.md)
- [Roadmap](docs/roadmap.md)
- [Исследование решений](research/existing-solutions.md)
- [Как внести изменения](CONTRIBUTING.md)
- [История изменений](CHANGELOG.md)

## Структура репозитория

```text
.
├── manifest.json
├── code.js
├── ui.html
├── UnityPackage/
├── examples/
├── docs/
└── research/
```

## Быстрое обновление development plugin

Сборщик и внешние зависимости отсутствуют:

1. Измените `code.js` или `ui.html`.
2. Сохраните файл.
3. Закройте окно плагина.
4. Запустите FigmaGamedev снова.

Если Figma показывает старую версию, выполните **Plugins → Development → Reload
plugins**.

## Ограничения MVP

- экспортируется JSON, но не ZIP с PNG/SVG;
- Unity Catalog пока создаётся вручную;
- нет нормализатора сложной Figma-иерархии и Unity layout compiler;
- нет генерации/обновления prefab и Prefab Variant;
- нет автоматического заполнения project-specific компонентов;
- нет AI-skill, визуального сравнения и mobile performance validator;
- каталог хранится локально у каждого дизайнера.

## Лицензия

Лицензия проекта пока не выбрана владельцем репозитория. До добавления файла
`LICENSE` стандартное авторское право сохраняется за владельцем кода.
