# Установка

## Требования

- Figma Desktop;
- доступ к Development Plugins;
- Unity 2021.3 или новее для тестового Unity package;
- открытый локальный порт `19783` для прямой передачи.

## Figma-плагин

1. Клонируйте репозиторий:

   ```bash
   git clone https://github.com/viskovs/FigmaUnity.git
   cd FigmaUnity
   ```

2. Откройте Figma Desktop.
3. Откройте Figma Design-файл.
4. Выберите **Plugins → Development → Import plugin from manifest…**.
5. Выберите `manifest.json` в корне репозитория.
6. Запустите **Plugins → Development → FigmaGamedev**.

### Unity Inspector в Dev Mode

После импорта manifest:

1. включите **Dev Mode** в Figma;
2. откройте вкладку **Code**;
3. выберите язык `Unity uGUI Inspector`;
4. выделите слой, frame или text node.

Figma покажет секции RectTransform, Graphic/TMP, Layout, Variables, Source и
Warnings. Эти же hints попадут в JSON, когда дизайнер экспортирует размеченный
экран.

### Development ID

В репозитории находится placeholder ID. Если Figma не принимает manifest:

1. Создайте новый пустой development plugin.
2. Откройте сгенерированный Figma `manifest.json`.
3. Скопируйте его числовой `id` в manifest FigmaGamedev.
4. Повторно импортируйте FigmaGamedev.

Не публикуйте одинаковый ID из разных независимых копий проекта.

## Unity Package

1. В Unity откройте **Window → Package Manager**.
2. Нажмите **+ → Add package from disk…**.
3. Выберите `UnityPackage/package.json`.
4. Дождитесь компиляции.
5. Проверьте Console:

   ```text
   [FigmaGamedev] Listening on http://localhost:19783/
   ```

Управление доступно через **Tools → FigmaGamedev**:

- `Start Local Bridge`;
- `Stop Local Bridge`;
- `Open Inbox`.

## Обновление development-версии

Плагин не требует сборки. После изменения `code.js` или `ui.html`:

1. сохраните файл;
2. закройте окно плагина;
3. выполните **Plugins → Development → Reload plugins**;
4. откройте FigmaGamedev снова.

После изменения `manifest.json` безопаснее удалить development plugin и снова
выполнить **Import plugin from manifest…**: Figma должна перечитать Dev Mode
capabilities и список codegen languages.

После изменения Unity Package дождитесь domain reload и повторной компиляции.

## Удаление

- В Figma удалите development plugin через управление development plugins.
- В Unity удалите package через Package Manager.
- При необходимости удалите `Library/FigmaGamedev`; там находятся только входящие
  пакеты, а не Unity assets.
