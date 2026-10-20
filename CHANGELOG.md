# Changelog

## [Unreleased]

### Planned

- Unity Catalog exporter;
- semantic tree normalizer;
- Unity prefab compiler;
- asset export;
- AI skill и mobile render validation.

## [0.3.0] — 2026-10-21

### Added

- стабильная идентификация Figma Component/Instance через component key;
- `componentMappings` с приоритетом key над нормализованным именем;
- preview разрешённого Unity prefab прямо в Figma-плагине;
- package preflight report с conversion, mapping и mobile-budget warnings;
- package schema v2, стабильный content fingerprint и package ID;
- session token для локального Unity Bridge;
- idempotent publish, receipt и endpoint статуса;
- повторная отправка последнего сгенерированного пакета;
- Unity Inspector Preview в основном интерфейсе;
- Dev Mode codegen `Unity uGUI Inspector`;
- RectTransform, Layout, Image/RawImage, TMP и CanvasGroup hints;
- resolved Figma Variables, Figma Source и Warnings в AI export;
- автоматические тесты layout analyzer.

## [0.1.0] — 2026-08-16

### Added

- первый MVP FigmaGamedev;
- Feature, Screen, Component и Layer/Behavior annotations;
- Safe Area, Animation Group, Slot и Repeated List roles;
- Unity Catalog import и JSON export;
- localhost Unity Bridge и локальный Unity Editor package;
- начальная документация.
