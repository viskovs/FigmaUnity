# Unity Inspector Hints

## Назначение

Inspector analyzer преобразует свойства выбранного Figma node в предлагаемую
конфигурацию Unity uGUI. Это не готовый prefab и не безусловная команда compiler:
каждое поле является объяснимой подсказкой для AI, Unity layout recipe или ручной
проверки.

## Где увидеть результат

### Обычный плагин

Выделите один слой и раскройте `Unity Inspector Preview`.

### Dev Mode

1. Откройте Dev Mode.
2. Выберите Code panel.
3. Выберите язык `Unity uGUI Inspector`.
4. Выделяйте слои — секции обновляются автоматически.

### AI export

Hints добавляются:

- в каждый узел `document.*.unityInspector`;
- в корневое поле `unityInspector` с resolved Figma Variables.

## Поддерживаемые секции

### RectTransform

- anchorMin/anchorMax;
- pivot;
- anchoredPosition;
- sizeDelta;
- stretch offsets;
- rotationZ с преобразованием направления вращения;
- исходные Figma constraints.

Figma использует Y-down, а Unity RectTransform — Y-up относительно anchor. Analyzer
явно выполняет преобразование.

### Image

- solid fill color;
- opacity;
- Unity Linear RGBA;
- базовые Graphic defaults.

### RawImage

- image reference hash;
- scale mode;
- rotation и scaling factor;
- filters;
- предупреждение о необходимости преобразования cropTransform в uvRect.

### TextMeshProUGUI

- текст;
- font family/style/size;
- цвет;
- character/line spacing source;
- alignment;
- wrapping/overflow;
- auto-size intent.

Для совместимых mixed styles analyzer генерирует TMP Rich Text. Одновременно он
сохраняет исходные styled segments, чтобы AI не терял информацию при разных font
families, сложных fills или несовместимых настройках spacing.

Для Figma stroke добавляется секция `TMP Text Outline`. Outline width — оценка,
поскольку финальное значение зависит от SDF atlas и material.

### Layout

- HorizontalLayoutGroup;
- VerticalLayoutGroup;
- совместимый GridLayoutGroup hint;
- ContentSizeFitter для Hug/Auto;
- LayoutElement для дочерних элементов Auto Layout и для явно заданного min size.

Figma max size, Wrap и некоторые Grid-настройки не имеют точного стандартного
аналога uGUI и всегда сопровождаются warning.

### CanvasGroup и RectMask2D

Container opacity преобразуется в CanvasGroup, чтобы не умножать alpha отдельно на
каждом дочернем Graphic. `Clip content` создаёт RectMask2D hint.

## Warnings

Analyzer не скрывает неоднозначности:

- multiple/gradient fills;
- effects и blur;
- Wrap/Grid inference;
- max size;
- absolute child в Auto Layout;
- mixed text styles;
- TMP SDF outline approximation;
- root frame без Canvas/template policy.

AI обязан учитывать warning до создания Unity assets.

## Figma Variables

Экспорт содержит binding field, variable ID, имя и resolved value текущего режима,
если Figma API позволяет разрешить variable для выбранного node.

## Ограничения

- pivot пока фиксирован на `(0.5, 0.5)`;
- root RectTransform требует screen template;
- cropTransform → RawImage uvRect не реализован;
- TMP Rich Text не создаётся для разных font families, сложных fills и текста с
  потенциальными tag-символами; styled segments при этом сохраняются;
- Unity layout recipes и conflict resolver ещё не реализованы;
- hints не заменяют mobile validation.
