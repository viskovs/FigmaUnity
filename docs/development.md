# Разработка

## Figma runtime

`code.js` выполняется в sandbox Figma Plugin API. Он:

- следит за selection;
- читает/пишет Shared Plugin Data;
- выполняет validation;
- сериализует выбранное дерево;
- взаимодействует с UI через `figma.ui.postMessage`.

`ui.html` работает в iframe. Он:

- отображает форму;
- загружает catalog через browser File API;
- скачивает JSON через Blob;
- связывается с Unity через `fetch(localhost)`.

## Почему нет сборщика

MVP специально состоит из `code.js` и одного `ui.html`, чтобы дизайнеры могли
быстро тестировать изменения. После стабилизации интерфейса рекомендуется перейти
на TypeScript, schema validation и reproducible build.

## Проверка синтаксиса

```bash
node --check code.js
```

```bash
node -e 'const fs=require("fs");const h=fs.readFileSync("ui.html","utf8");const m=h.match(/<script>([\s\S]*?)<\\/script>/);new Function(m[1]);console.log("ui ok")'
```

## Изменение schema

1. Измените producer в `code.js`.
2. Обновите `docs/annotation-model.md` и `docs/export-format.md`.
3. При breaking change увеличьте `schemaVersion`.
4. Добавьте migration или понятную ошибку reader.
5. Обновите `CHANGELOG.md`.

## Unity Package

Unity-код находится в Editor-only assembly. Listener запускается через
`InitializeOnLoad`, останавливается перед assembly reload и при закрытии Editor.

Нельзя добавлять runtime dependency в игровую сборку.

## Публикация Figma-плагина

Во время разработки используйте Development Plugin. Для командной публикации:

1. получите настоящий plugin ID от Figma;
2. сохраните его в manifest;
3. подготовьте icon, description и permission explanation;
4. сначала опубликуйте private organization version;
5. проверяйте schema на копии production-документа;
6. публикуйте update с тем же ID.
