# Решение проблем

## Figma не принимает manifest

Скорее всего, placeholder plugin ID не зарегистрирован. Создайте пустой development
plugin и перенесите выданный Figma числовой ID.

## Плагин не видит выделение

- убедитесь, что выбран ровно один объект;
- проверьте, что это Figma Design, а не FigJam;
- после смены страницы повторно выберите слой.

## Разметка исчезла

Shared Plugin Data хранится в документе. Она не переносится, если слой был создан
заново или скопирован способом, удаляющим plugin data. Проверьте исходный main
component и выполните scan текущей страницы.

## Unity Catalog не отображает значения

- проверьте валидность JSON;
- сравните структуру с example catalog;
- убедитесь, что коллекции называются `features`, `screenTemplates`, `prefabs`,
  `safeAreaProfiles`, `animationProfiles`;
- импортируйте каталог повторно на этом компьютере.

## Unity Bridge не найден

1. Убедитесь, что Unity открыт и package скомпилирован.
2. Проверьте Console на сообщение listener.
3. Выполните **Tools → FigmaGamedev → Start Local Bridge**.
4. Убедитесь, что порт `19783` не занят.
5. Перезапустите Figma-плагин после изменения manifest permissions.

## Пакет отправлен, но prefab не появился

Это ожидаемо для MVP. Bridge только сохраняет JSON в
`Library/FigmaGamedev/Inbox`. Unity compiler ещё не реализован.

## Изменения UI не появились

Закройте plugin window, выполните **Plugins → Development → Reload plugins** и
откройте FigmaGamedev снова.

## Где найти входящий файл

Используйте **Tools → FigmaGamedev → Open Inbox**.
