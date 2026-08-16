# FigmaGamedev export format

The MVP exports one JSON document for the currently selected, annotated root.

Top-level fields:

- `schema`: always `figma-gamedev-ui-package`;
- `schemaVersion`: version of the metadata contract;
- `figma`: source file, page and root node information;
- `entity`: annotation stored on the selected root;
- `catalogVersion`: Unity catalog version used by the designer;
- `annotations`: all annotated descendants;
- `document`: raw, recursively serialized Figma layout tree.

The `document` tree retains Auto Layout properties including direction, wrapping,
sizing modes, padding, spacing, alignment, constraints, min/max sizes and component
property values. A later normalizer can remove empty wrapper frames before the Unity
layout compiler selects a layout recipe.

## Stable IDs

IDs such as `lootbox-shop.main` and `unity.ui.product-card` are integration IDs.
They must not be derived from mutable layer names. Figma node IDs are included for
traceability and repeat imports but are not a replacement for integration IDs.

## Annotation ownership

Annotations are stored using Figma shared plugin data:

- namespace: `figmagamedev`;
- key: `annotation`;
- value: versioned JSON.

The plugin never changes the visual hierarchy when an annotation is saved.
