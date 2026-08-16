# Рабочий процесс дизайнера

## Основной принцип

Дизайнер определяет намерение, а не Unity-реализацию. Не нужно вводить C#-классы,
GUID или пути внутри `Assets`. Для этого используется Unity Catalog.

## Рекомендуемая последовательность

### 1. Создать Feature

Выделите Section или Frame, объединяющий связанную функциональность:

```text
Type: Feature
ID: lootbox-shop
```

Feature ID должен быть стабильным и не зависеть от отображаемого названия слоя.

### 2. Разметить Component

Выделите main component или component set:

```text
Type: Component
ID: lootbox-shop.lootbox-card
Feature ID: lootbox-shop
Unity Name: LootboxCard
Generation Mode: Prefab Variant
Base Prefab ID: unity.ui.product-card
```

Для Prefab Variant укажите поведение отсутствующих и новых дочерних элементов.

### 3. Разметить Screen

Выделите ровно один корневой Frame:

```text
Type: Screen
ID: lootbox-shop.main
Feature ID: lootbox-shop
Unity Name: LootboxShopScreen
Template: unity.screen.lobby
Root Kind: Lobby
```

Экспортировать нужно этот узел, а не всю страницу Figma.

### 4. Добавить роли слоям

Для технически значимых вложенных фреймов используйте `Layer / Behavior`.

#### Safe Area

```text
Role: Safe Area
Profile: unity.safe-area.default
Horizontal: true
Vertical: true
```

Figma задаёт намерение. Финальные anchors рассчитывает Unity-компонент.

#### Animation Group

```text
Role: Animation Group
Profile: unity.animation.staggered-appear
Target Mode: Direct Children
Order: Hierarchy
Delay: 0.08
```

Для динамически создаваемых карточек используйте `Runtime Items`, а не список
статических ссылок.

#### Content Slot

Отмечает разрешённую точку вставки вложенных prefab. Будущий compiler сможет
добавлять в неё элементы, не распаковывая базовый prefab.

#### Repeated List

Означает, что дети представляют повторяемые элементы. В будущем эта роль будет
связана с pooling/virtualization и фабрикой элементов.

#### Preserve Wrapper

Запрещает нормализатору удалять визуально пустой Figma-frame. Используйте только
если frame нужен для layout, анимации или ссылок.

#### Ignore

Узел и его визуальное представление не должны попадать в Unity package. Подходит
для комментариев, дизайнерских подсказок и альтернативных состояний.

## Auto Layout

Настраивайте Auto Layout обычными средствами Figma:

- Horizontal/Vertical;
- Fixed/Hug/Fill;
- padding и spacing;
- alignment;
- wrap;
- min/max size;
- constraints.

Плагин экспортирует эти значения. Будущий Unity compiler преобразует их в
проверенные layout recipes, а не копирует Figma-иерархию буквально.

## Имена и ID

Имена слоёв можно менять. Интеграционные ID менять после публикации нельзя без
миграции.

Рекомендуемый формат:

```text
feature:   lootbox-shop
screen:    lootbox-shop.main
component: lootbox-shop.lootbox-card
global:    unity.ui.button.primary
```

## Перед экспортом

1. Выберите root сущности.
2. Нажмите **Проверить**.
3. Исправьте ошибки.
4. Выполните **Сканировать страницу** и убедитесь, что все важные роли видны.
5. Используйте **Скачать JSON** или отправку в Unity.

## Чего избегать

- detached instances для переиспользуемых компонентов;
- произвольного изменения внутренних слоёв prefab-bound component;
- десятков декоративных wrapper-frames;
- сложных вложенных blur/mask;
- ручных Unity-путей в именах слоёв;
- изменения стабильного ID при обычном переименовании.
