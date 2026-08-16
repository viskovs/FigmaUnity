# FigmaGamedev — Figma plugin MVP

FigmaGamedev lets designers mark Figma nodes as Unity features, screens,
components and behavioral layers. The exported JSON is intended for a future
Codex/Claude skill and Unity Editor importer.

## Included in this MVP

- Feature, Screen, Component and Layer/Behavior annotations;
- screen template and window-root selection;
- existing prefab, new prefab and Prefab Variant intent;
- missing/new child policies for variants;
- Screen Root, Safe Area, Animation Group, Content Slot, Repeated List,
  Preserve Wrapper and Ignore roles;
- animation target mode, target binding, delay and ordering;
- local import of an `figma-gamedev-catalog.json` file;
- validation of the most important fields;
- scanning all annotated nodes on the current Figma page;
- JSON export of the selected entity, its annotations and Auto Layout tree.
- direct publishing to a local Unity Editor bridge on `localhost:19783`.

The plugin has no server and no external dependencies. This is intentional for a
fast first iteration.

## Install as a development plugin

1. Install and open the **Figma desktop app**.
2. Open any Figma Design file.
3. Open **Plugins → Development → Import plugin from manifest…**.
4. Select this project's `manifest.json`.
5. Run it through **Plugins → Development → FigmaGamedev**.

The `id` in the supplied manifest is a development placeholder. If your Figma
version rejects an unregistered ID, first use **Plugins → Development → New
plugin…** to create an empty plugin, copy the numeric ID from its generated
manifest into this project's `manifest.json`, and import this manifest again.
Keep that assigned ID for subsequent local updates and publication.

## Fast update loop

There is no build step:

1. Edit `code.js` or `ui.html`.
2. Save the file.
3. Close the running plugin window in Figma.
4. Run **Plugins → Development → FigmaGamedev** again.

If Figma appears to retain an old version, use **Plugins → Development → Reload
plugins**, then reopen the plugin. Keeping the plugin folder at the same absolute
path avoids re-importing the manifest after every change.

## First test

1. Run the plugin.
2. In **Unity Catalog**, import
   `examples/figma-gamedev-catalog.example.json`.
3. Select a top-level screen frame.
4. Choose `Screen`, enter:
   - ID: `lootbox-shop.main`;
   - Feature ID: `lootbox-shop`;
   - Unity Name: `LootboxShopScreen`;
   - Template: `unity.screen.lobby`.
5. Save the annotation.
6. Select a content frame, choose `Layer / Behavior`, enable `Safe Area`, and save.
7. Select a cards container, enable `Animation Group`, choose
   `unity.animation.staggered-appear`, and save.
8. Select the screen root again and press **Export JSON**.

The browser-style plugin UI downloads a file named similar to
`lootbox-shop.main.figma-gamedev.json`.

## Connect the local Unity bridge

The `UnityPackage` directory is a local Unity package included in this project.

1. In a test Unity project, open **Window → Package Manager**.
2. Press **+ → Add package from disk…**.
3. Select `UnityPackage/package.json`.
4. Wait for script compilation.
5. The bridge starts automatically; it can also be controlled through
   **Tools → FigmaGamedev**.
6. Reopen the Figma plugin. Its status should change to `Unity Bridge подключён`.
7. Select an annotated screen and press **Отправить выбранный экран в Unity**.

Received packages are stored under:

```text
<Unity project>/Library/FigmaGamedev/Inbox/
```

This location intentionally avoids modifying `Assets`. A later reviewed import
step or AI skill will consume the inbox package and create project assets.

## Publishing privately to a Figma organization

For initial testing, keep the plugin in Development mode. It updates immediately
from this local folder and is the quickest workflow.

When the MVP is ready for designers:

1. In Figma, open **Plugins → Development → Manage plugins in development**.
2. Choose the plugin and start the publish flow.
3. Select private organization/team distribution if your Figma plan and role allow
   it; otherwise invite the designers to import the development manifest locally.
4. Complete the name, icon, description and permission review.
5. Replace the development placeholder in `manifest.json` only with the ID Figma
   assigns during its publication flow.

Public Community publication is not recommended during prototyping because review
and release management slow down the feedback loop.

## Updating a published plugin

Continue editing the same project and publish an update through Figma's plugin
management screen. Keep the Figma-assigned plugin ID unchanged. Increase the
human-facing version in release notes and keep annotation `schemaVersion`
backward-compatible.

For daily development, test locally first; publish a private update only after the
current annotation schema has been verified on a copy of a real production design file.

## Current limitations

- Export is a single JSON file, not a ZIP with rendered assets yet.
- There is no Unity catalog exporter yet; the included catalog is an example.
- There is no normalization or Unity prefab generation yet.
- The MVP stores the catalog in Figma's local client storage, so each designer must
  import it on their own machine.
- Screen/version publishing and server delivery are not implemented yet.

The local bridge currently transfers JSON only; rendered PNG/SVG assets and ZIP
packages are a later transport extension. These are the next layers after validating
that the annotation UX is comfortable for designers.
