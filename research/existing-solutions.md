# Existing Figma → Unity solutions: technical audit

Audit updated: 2026-10-21.

Repositories inspected locally:

- `cdmvision/unity-figma-importer`;
- `zasuozz-oss/figma-to-unity`;
- `simonoliver/UnityFigmaBridge`.

Additional Figma Community benchmark:

- `UnityUI / Unity uGUI Inspector` — Dev Mode codegen для ручного переноса
  RectTransform, Image/RawImage, TMP и layout fields. Он не создаёт hierarchy или
  prefab, но его Inspector-style output и явные Warnings полезны как quality
  benchmark. FigmaGamedev реализует аналогичную идею независимо и включает hints в
  semantic package для AI.

Official Unity benchmark:

- [UI Toolkit Connector for Figma design](https://docs.unity3d.com/Packages/com.unity.ui.figma@0.1/manual/index.html)
  `0.1.0-exp.1` — официальный экспериментальный путь Figma → UXML/USS для Unity
  6000.3+. Он не создаёт uGUI prefab и не решает project-owned prefab overrides,
  но задаёт хороший UX-эталон: явный node tag, project mapping asset, design
  tokens, Last import report, re-import, acknowledgement и защищённый transport.

## Decision

Keep FigmaGamedev as the semantic annotation layer. Reuse established ideas for
transport, manifest generation, layout conversion and asset handling, but implement
the project-specific Unity compiler around project-owned templates, prefab bindings and mobile
validation.

FigmaGamedev 0.3 перенимает концепции, а не код официального connector:

- первый явный match побеждает;
- stable component key предпочтительнее имени;
- project catalog хранит mappings;
- preflight показывает потери, а не скрывает их;
- package имеет version, fingerprint и delivery receipt;
- локальная публикация требует session token.

Официальный connector остаётся возможным отдельным backend для UI Toolkit. Он не
является зависимостью uGUI compiler.

## cdmvision/unity-figma-importer

- MIT licensed, including Unity packages.
- Supports uGUI and UI Toolkit packages.
- Mature repository structure and broad Figma-node support.
- Best candidate for studying reusable Figma parsing and general conversion models.
- Does not provide the project-specific semantic contract or prefab-variant policies.

## zasuozz-oss/figma-to-unity

- Figma plugin, documentation and root scripts are MIT licensed.
- `UnityFigImporter/` is under a separate proprietary license.
- Strongest transport and workflow reference: ZIP export, localhost bridge,
  preview-first import, quick import, sync records, headless mode and tests.
- Auto Layout, anchors, TMP, texture deduplication, 9-slice and sprite atlas support
  already exist in its importer.
- We must not copy proprietary Unity importer code without accepting its license.
- FigmaGamedev now uses an independently implemented localhost protocol on a
  separate port and with a different semantic package schema.

## simonoliver/UnityFigmaBridge

- MIT licensed.
- Particularly relevant implementations:
  - component/prefab replacement;
  - responsive layout and experimental Auto Layout;
  - Safe Area attachment;
  - MonoBehaviour and serialized-field binding;
  - transition hooks.
- Existing behavior binding relies heavily on layer/class names. FigmaGamedev annotations
  should use stable IDs and catalog entries instead.

## What can be reused safely

- Concepts and, after attribution/licence review, MIT code for Figma parsing.
- Manifest/asset separation.
- Localhost-only bridge architecture.
- Auto Layout mapping and anchor conversion tests.
- Prefab replacement patterns from UnityFigmaBridge.
- Texture hashing, 9-slice detection and sprite-atlas workflows where licensing
  permits.

## What remains project-specific

- Feature/Screen/Component publication units.
- Shared-plugin-data semantic annotations.
- Existing prefab and Prefab Variant bindings.
- Keep/Disable/Remove and slot policies.
- Canonical hierarchy normalization.
- Screen templates, `BaseWindowView`, `WindowRootKind` and project Safe Area.
- Animation groups and serialized target lists.
- Mobile hierarchy/layout/rendering budgets.
- Codex/Claude skill and deterministic Unity compiler.
