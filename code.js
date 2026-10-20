const NAMESPACE = "figmagamedev";
const ANNOTATION_KEY = "annotation";
const SCHEMA_VERSION = 2;
const INSPECTOR_SCHEMA_VERSION = 1;
const PLUGIN_VERSION = "0.3.0";
let selectionRevision = 0;

figma.showUI(__html__, {
  width: 420,
  height: 760,
  themeColors: true,
  visible: figma.editorType !== "dev"
});

function round(value, digits = 3) {
  if (typeof value !== "number" || !Number.isFinite(value)) return value;
  const factor = 10 ** digits;
  const result = Math.round(value * factor) / factor;
  return Object.is(result, -0) ? 0 : result;
}

function isMixed(value) {
  return typeof figma !== "undefined" && "mixed" in figma && value === figma.mixed;
}

function valueOrNull(value) {
  return value === undefined || isMixed(value) ? null : value;
}

function normalizeLookupName(value) {
  return String(value || "").toLocaleLowerCase("en-US").replace(/[^a-z0-9а-яё]+/giu, "");
}

function stableStringify(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  return `{${Object.keys(value).sort().map(key =>
    `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
}

function fnv1a32(value) {
  let hash = 0x811c9dc5;
  const text = String(value || "");
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

function colorToHex(color, alpha = 1) {
  if (!color) return null;
  const channel = value => Math.max(0, Math.min(255, Math.round(value * 255)))
    .toString(16).padStart(2, "0").toUpperCase();
  const rgb = `#${channel(color.r)}${channel(color.g)}${channel(color.b)}`;
  return alpha < 0.999 ? `${rgb}${channel(alpha)}` : rgb;
}

function srgbToLinear(value) {
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function unityColor(paint, nodeOpacity = 1) {
  const color = paint?.color;
  if (!color) return null;
  const alpha = (paint.opacity ?? 1) * nodeOpacity;
  return {
    hex: colorToHex(color, alpha),
    rgba: [round(color.r), round(color.g), round(color.b), round(alpha)],
    linearRgba: [
      round(srgbToLinear(color.r)),
      round(srgbToLinear(color.g)),
      round(srgbToLinear(color.b)),
      round(alpha)
    ]
  };
}

function parentRect(node) {
  const parent = node?.parent;
  if (!parent || !("width" in parent) || !("height" in parent)) return null;
  return { width: parent.width, height: parent.height };
}

function horizontalAnchor(constraint, x, width, parentWidth) {
  switch (constraint) {
    case "RIGHT": return [1, 1];
    case "CENTER": return [0.5, 0.5];
    case "LEFT_RIGHT": return [0, 1];
    case "SCALE": return [x / parentWidth, (x + width) / parentWidth];
    default: return [0, 0];
  }
}

function verticalAnchor(constraint, y, height, parentHeight) {
  switch (constraint) {
    case "BOTTOM": return [0, 0];
    case "CENTER": return [0.5, 0.5];
    case "TOP_BOTTOM": return [0, 1];
    case "SCALE": return [1 - (y + height) / parentHeight, 1 - y / parentHeight];
    default: return [1, 1];
  }
}

function rectTransformHints(node, warnings) {
  const width = "width" in node ? node.width : 0;
  const height = "height" in node ? node.height : 0;
  const x = "x" in node ? node.x : 0;
  const y = "y" in node ? node.y : 0;
  const parent = parentRect(node);
  const pivot = [0.5, 0.5];
  const constraints = "constraints" in node ? node.constraints : { horizontal: "LEFT", vertical: "TOP" };

  if (!parent || parent.width <= 0 || parent.height <= 0) {
    warnings.push("Root RectTransform requires a Canvas/template policy; centered fallback is shown.");
    return {
      anchorMin: [0.5, 0.5],
      anchorMax: [0.5, 0.5],
      pivot,
      anchoredPosition: [0, 0],
      sizeDelta: [round(width), round(height)],
      rotationZ: round(-("rotation" in node ? node.rotation : 0)),
      sourceConstraints: constraints
    };
  }

  const [minX, maxX] = horizontalAnchor(constraints.horizontal, x, width, parent.width);
  const [minY, maxY] = verticalAnchor(constraints.vertical, y, height, parent.height);
  const stretchX = Math.abs(maxX - minX) > 0.0001;
  const stretchY = Math.abs(maxY - minY) > 0.0001;
  const scaleX = constraints.horizontal === "SCALE";
  const scaleY = constraints.vertical === "SCALE";
  const pivotWorldX = x + width * pivot[0];
  const pivotWorldY = parent.height - y - height * (1 - pivot[1]);
  const anchorReferenceX = (minX + (maxX - minX) * pivot[0]) * parent.width;
  const anchorReferenceY = (minY + (maxY - minY) * pivot[1]) * parent.height;

  const result = {
    anchorMin: [round(minX), round(minY)],
    anchorMax: [round(maxX), round(maxY)],
    pivot,
    anchoredPosition: [
      round(pivotWorldX - anchorReferenceX),
      round(pivotWorldY - anchorReferenceY)
    ],
    sizeDelta: [round(width), round(height)],
    rotationZ: round(-("rotation" in node ? node.rotation : 0)),
    sourceConstraints: constraints
  };

  if (scaleX) {
    result.anchoredPosition[0] = 0;
    result.sizeDelta[0] = 0;
  } else if (stretchX) {
    result.offsetLeft = round(x);
    result.offsetRight = round(parent.width - x - width);
    result.sizeDelta[0] = round(-(result.offsetLeft + result.offsetRight));
  }
  if (scaleY) {
    result.anchoredPosition[1] = 0;
    result.sizeDelta[1] = 0;
  } else if (stretchY) {
    result.offsetTop = round(y);
    result.offsetBottom = round(parent.height - y - height);
    result.sizeDelta[1] = round(-(result.offsetTop + result.offsetBottom));
  }
  return result;
}

function layoutHints(node, components, warnings) {
  const layoutMode = "layoutMode" in node ? node.layoutMode : "NONE";
  const isHorizontal = layoutMode === "HORIZONTAL";
  const isVertical = layoutMode === "VERTICAL";
  const isGrid = layoutMode === "GRID";

  if (isHorizontal || isVertical) {
    components.push({
      type: isHorizontal ? "HorizontalLayoutGroup" : "VerticalLayoutGroup",
      fields: {
        padding: {
          left: round(node.paddingLeft ?? 0),
          right: round(node.paddingRight ?? 0),
          top: round(node.paddingTop ?? 0),
          bottom: round(node.paddingBottom ?? 0)
        },
        spacing: round(node.itemSpacing ?? 0),
        childAlignment: `${node.counterAxisAlignItems || "MIN"}-${node.primaryAxisAlignItems || "MIN"}`,
        controlChildWidth: true,
        controlChildHeight: true,
        useChildScaleWidth: false,
        useChildScaleHeight: false,
        childForceExpandWidth: false,
        childForceExpandHeight: false,
        reverseArrangement: false,
        sourceWrap: node.layoutWrap || "NO_WRAP"
      }
    });
    if (node.layoutWrap === "WRAP") {
      warnings.push("Figma Wrap has no exact Horizontal/VerticalLayoutGroup equivalent; use a project WrapLayout recipe.");
    }
  } else if (isGrid) {
    components.push({
      type: "GridLayoutGroup",
      fields: {
        padding: {
          left: round(node.paddingLeft ?? 0), right: round(node.paddingRight ?? 0),
          top: round(node.paddingTop ?? 0), bottom: round(node.paddingBottom ?? 0)
        },
        spacing: [round(node.itemSpacing ?? 0), round(node.counterAxisSpacing ?? 0)]
      }
    });
    warnings.push("Figma Grid requires cell-size and constraint inference in Unity.");
  }

  if (isHorizontal || isVertical || isGrid) {
    const horizontalFit = node.layoutSizingHorizontal === "HUG" ||
      (isHorizontal && node.primaryAxisSizingMode === "AUTO") ||
      ((isVertical || isGrid) && node.counterAxisSizingMode === "AUTO");
    const verticalFit = node.layoutSizingVertical === "HUG" ||
      (isVertical && node.primaryAxisSizingMode === "AUTO") ||
      ((isHorizontal || isGrid) && node.counterAxisSizingMode === "AUTO");
    if (horizontalFit || verticalFit) {
      components.push({
        type: "ContentSizeFitter",
        fields: {
          horizontalFit: horizontalFit ? "PreferredSize" : "Unconstrained",
          verticalFit: verticalFit ? "PreferredSize" : "Unconstrained"
        }
      });
    }
  }

  const sizingX = "layoutSizingHorizontal" in node ? node.layoutSizingHorizontal : null;
  const sizingY = "layoutSizingVertical" in node ? node.layoutSizingVertical : null;
  const parentLayoutMode = node.parent && "layoutMode" in node.parent ? node.parent.layoutMode : "NONE";
  const parentControlsLayout = ["HORIZONTAL", "VERTICAL", "GRID"].includes(parentLayoutMode);
  const hasMinMax = node.minWidth != null || node.maxWidth != null || node.minHeight != null || node.maxHeight != null;
  if (parentControlsLayout || hasMinMax) {
    const fields = {
      flexibleWidth: sizingX === "FILL" ? 1 : 0,
      flexibleHeight: sizingY === "FILL" ? 1 : 0,
      preferredWidth: sizingX === "FIXED" ? round(node.width) : -1,
      preferredHeight: sizingY === "FIXED" ? round(node.height) : -1,
      minWidth: node.minWidth == null ? -1 : round(node.minWidth),
      minHeight: node.minHeight == null ? -1 : round(node.minHeight),
      sourceMaxWidth: node.maxWidth == null ? null : round(node.maxWidth),
      sourceMaxHeight: node.maxHeight == null ? null : round(node.maxHeight)
    };
    components.push({ type: "LayoutElement", fields });
    if (node.maxWidth != null || node.maxHeight != null) {
      warnings.push("Unity LayoutElement has no max size; use a project MinMaxLayoutElement recipe.");
    }
  }
}

function visualHints(node, components, warnings) {
  const opacity = "opacity" in node && typeof node.opacity === "number" ? node.opacity : 1;
  const usesCanvasGroup = opacity < 0.999 && Array.isArray(node.children) && node.children.length > 0;
  if (usesCanvasGroup) {
    components.push({ type: "CanvasGroup", fields: { alpha: round(opacity), interactable: true, blocksRaycasts: true } });
  }
  const graphicOpacity = usesCanvasGroup ? 1 : opacity;

  const fills = "fills" in node && Array.isArray(node.fills) ? node.fills.filter(fill => fill.visible !== false) : [];
  const solidFills = fills.filter(fill => fill.type === "SOLID");
  const imageFills = fills.filter(fill => fill.type === "IMAGE");
  const complexFills = fills.filter(fill => !["SOLID", "IMAGE"].includes(fill.type));

  if (node.type !== "TEXT" && solidFills.length === 1 && imageFills.length === 0) {
    components.push({
      type: "Image",
      fields: {
        color: unityColor(solidFills[0], graphicOpacity),
        raycastTarget: false,
        sprite: null,
        type: "Simple"
      }
    });
  }
  if (node.type !== "TEXT" && imageFills.length > 0) {
    const fill = imageFills[0];
    components.push({
      type: "RawImage",
      fields: {
        textureRef: fill.imageHash || null,
        color: { hex: colorToHex({ r: 1, g: 1, b: 1 }, graphicOpacity) },
        scaleMode: fill.scaleMode || "FILL",
        rotation: round(fill.rotation || 0),
        scalingFactor: round(fill.scalingFactor || 1),
        filters: fill.filters || {},
        sourceImageTransform: fill.imageTransform || fill.cropTransform || null,
        uvRect: "Requires cropTransform conversion"
      }
    });
    warnings.push("RawImage cropTransform/scaleMode requires an explicit uvRect conversion.");
  }
  if (fills.length > 1) warnings.push("Multiple visible fills require compositing, multiple Graphics, or rasterization.");
  if (complexFills.length) warnings.push(`Unsupported/ambiguous fills: ${complexFills.map(fill => fill.type).join(", ")}.`);
  if ("clipsContent" in node && node.clipsContent) {
    components.push({ type: "RectMask2D", fields: { enabled: true } });
  }

  const effects = "effects" in node && Array.isArray(node.effects)
    ? node.effects.filter(effect => effect.visible !== false) : [];
  if (effects.length) warnings.push(`Figma effects require a project implementation: ${effects.map(effect => effect.type).join(", ")}.`);
}

function tmpAlignment(vertical, horizontal) {
  const verticalName = vertical === "BOTTOM" ? "Bottom" : vertical === "CENTER" ? "" : "Top";
  const horizontalName = horizontal === "RIGHT" ? "Right" :
    horizontal === "CENTER" ? "" : horizontal === "JUSTIFIED" ? "Justified" : "Left";
  return `${verticalName}${horizontalName}` || "Center";
}

function textSegmentSnapshot(segment) {
  const fontName = valueOrNull(segment.fontName);
  const fontSize = valueOrNull(segment.fontSize);
  const fills = valueOrNull(segment.fills);
  return {
    start: segment.start,
    end: segment.end,
    text: segment.characters,
    fontFamily: fontName?.family || null,
    fontStyle: fontName?.style || null,
    fontSize: typeof fontSize === "number" ? round(fontSize) : null,
    fills: Array.isArray(fills) ? fills : null,
    textDecoration: valueOrNull(segment.textDecoration),
    letterSpacing: valueOrNull(segment.letterSpacing),
    lineHeight: valueOrNull(segment.lineHeight)
  };
}

function styledTextHints(node, warnings) {
  if (typeof node.getStyledTextSegments !== "function") return null;
  let sourceSegments;
  try {
    sourceSegments = node.getStyledTextSegments([
      "fontName", "fontSize", "fills", "textDecoration", "letterSpacing", "lineHeight"
    ]);
  } catch (error) {
    warnings.push(`Could not read mixed text segments: ${String(error?.message || error)}.`);
    return null;
  }
  if (!Array.isArray(sourceSegments) || sourceSegments.length <= 1) return null;

  const segments = sourceSegments.map(textSegmentSnapshot);
  const families = new Set(segments.map(segment => segment.fontFamily).filter(Boolean));
  const hasUnsupportedFill = segments.some(segment =>
    !Array.isArray(segment.fills) || segment.fills.length !== 1 || segment.fills[0].type !== "SOLID");
  const hasTagCharacters = segments.some(segment => /[<>]/.test(segment.text || ""));
  const hasSpacingChanges = segments.some(segment => {
    const spacing = segment.letterSpacing;
    return spacing && Math.abs(spacing.value || 0) > 0.001;
  });

  if (families.size > 1) {
    warnings.push("Mixed font families require a Unity TMP font-asset mapping; raw styled segments are exported.");
  }
  if (hasUnsupportedFill) {
    warnings.push("Mixed text uses unsupported or multiple fills; raw styled segments are exported.");
  }
  if (hasTagCharacters) {
    warnings.push("Mixed text contains angle brackets; automatic TMP Rich Text is disabled to avoid tag injection.");
  }
  if (hasSpacingChanges) {
    warnings.push("Per-segment Figma letter spacing is not preserved by the generated TMP Rich Text.");
  }

  const compatible = families.size <= 1 && !hasUnsupportedFill && !hasTagCharacters;
  if (!compatible) return { segments, richText: null };

  const richText = segments.map(segment => {
    const style = segment.fontStyle || "";
    const color = unityColor(segment.fills[0], node.opacity ?? 1)?.hex || "#FFFFFFFF";
    const tags = [
      [`<size=${segment.fontSize || 16}>`, "</size>"],
      [`<color=${color}>`, "</color>"]
    ];
    if (/bold|black|semi[ -]?bold|demi/i.test(style)) tags.push(["<b>", "</b>"]);
    if (/italic|oblique/i.test(style)) tags.push(["<i>", "</i>"]);
    if (segment.textDecoration === "UNDERLINE") tags.push(["<u>", "</u>"]);
    if (segment.textDecoration === "STRIKETHROUGH") tags.push(["<s>", "</s>"]);
    return `${tags.map(tag => tag[0]).join("")}${segment.text || ""}${tags.reverse().map(tag => tag[1]).join("")}`;
  }).join("");
  return { segments, richText };
}

function textHints(node, components, warnings) {
  if (node.type !== "TEXT") return;
  const fills = Array.isArray(node.fills) ? node.fills.filter(fill => fill.visible !== false) : [];
  const solid = fills.find(fill => fill.type === "SOLID");
  const fontName = valueOrNull(node.fontName);
  const fontSize = valueOrNull(node.fontSize);
  const letterSpacing = valueOrNull(node.letterSpacing);
  const lineHeight = valueOrNull(node.lineHeight);
  const styledText = styledTextHints(node, warnings);
  components.push({
    type: "TextMeshProUGUI",
    fields: {
      text: styledText?.richText || node.characters || "",
      sourceText: styledText ? node.characters || "" : null,
      styledSegments: styledText?.segments || null,
      fontFamily: fontName?.family || null,
      fontStyle: fontName?.style || null,
      fontSize: typeof fontSize === "number" ? round(fontSize) : null,
      color: solid ? unityColor(solid, node.opacity ?? 1) : null,
      characterSpacing: letterSpacing?.unit === "PIXELS" ? round(letterSpacing.value) : letterSpacing,
      lineSpacingSource: lineHeight,
      alignment: tmpAlignment(node.textAlignVertical || "TOP", node.textAlignHorizontal || "LEFT"),
      sourceAlignment: `${node.textAlignVertical || "TOP"}-${node.textAlignHorizontal || "LEFT"}`,
      wrapping: node.textAutoResize !== "WIDTH_AND_HEIGHT",
      overflow: node.textAutoResize === "TRUNCATE" ? "Ellipsis" : "Overflow",
      richText: true,
      autoSize: false
    }
  });
  if (isMixed(node.fontName) || isMixed(node.fontSize) || isMixed(node.fills)) {
    warnings.push("Mixed text styles detected; generated TMP Rich Text and styled segments require verification.");
  }
  if (letterSpacing?.unit === "PIXELS" && Math.abs(letterSpacing.value || 0) > 0.001) {
    warnings.push("Figma letter spacing in pixels requires conversion using TMP font metrics.");
  }
  const strokes = Array.isArray(node.strokes) ? node.strokes.filter(stroke => stroke.visible !== false) : [];
  if (strokes.length) {
    const stroke = strokes.find(item => item.type === "SOLID");
    components.push({
      type: "TMP Text Outline",
      fields: {
        color: stroke ? unityColor(stroke, node.opacity ?? 1) : null,
        figmaStrokeWeight: round(node.strokeWeight || 0),
        estimatedOutlineWidth: round(Math.min(1,
          (node.strokeWeight || 0) / Math.max(1, typeof node.fontSize === "number" ? node.fontSize : 16)))
      }
    });
    warnings.push("TMP outline width is an SDF estimate and depends on the font atlas/material.");
  }
}

function serializeBoundVariables(node) {
  if (!("boundVariables" in node) || !node.boundVariables) return [];
  const result = [];
  for (const [field, binding] of Object.entries(node.boundVariables)) {
    const bindings = Array.isArray(binding) ? binding : [binding];
    for (const alias of bindings) {
      if (alias?.id) result.push({ field, id: alias.id });
    }
  }
  return result;
}

function analyzeUnityInspector(node) {
  const warnings = [];
  const components = [];
  components.push({ type: "RectTransform", fields: rectTransformHints(node, warnings) });
  layoutHints(node, components, warnings);
  visualHints(node, components, warnings);
  textHints(node, components, warnings);

  if ("rotation" in node && Math.abs(node.rotation || 0) > 0.001) {
    warnings.push("Figma rotation is clockwise/Y-down; Unity rotationZ is converted to the opposite sign.");
  }
  if ("layoutPositioning" in node && node.layoutPositioning === "ABSOLUTE") {
    warnings.push("Absolute child inside Auto Layout should be placed in a separate Unity overlay container.");
  }

  return {
    schemaVersion: INSPECTOR_SCHEMA_VERSION,
    node: { id: node.id, name: node.name, type: node.type },
    components,
    variables: serializeBoundVariables(node),
    warnings: [...new Set(warnings)],
    figmaSource: {
      constraints: "constraints" in node ? node.constraints : null,
      layoutMode: "layoutMode" in node ? node.layoutMode : null,
      layoutSizingHorizontal: "layoutSizingHorizontal" in node ? node.layoutSizingHorizontal : null,
      layoutSizingVertical: "layoutSizingVertical" in node ? node.layoutSizingVertical : null,
      opacity: "opacity" in node ? valueOrNull(node.opacity) : null,
      blendMode: "blendMode" in node ? valueOrNull(node.blendMode) : null,
      fills: "fills" in node ? valueOrNull(node.fills) : null,
      strokes: "strokes" in node ? valueOrNull(node.strokes) : null,
      effects: "effects" in node ? valueOrNull(node.effects) : null,
      clipsContent: "clipsContent" in node ? valueOrNull(node.clipsContent) : null
    }
  };
}

async function resolveVariables(node, inspector) {
  if (!figma.variables?.getVariableByIdAsync) return inspector;
  inspector.variables = await Promise.all(inspector.variables.map(async binding => {
    try {
      const variable = await figma.variables.getVariableByIdAsync(binding.id);
      if (!variable) return binding;
      const resolved = variable.resolveForConsumer(node);
      return { ...binding, name: variable.name, resolvedType: resolved.resolvedType, value: resolved.value };
    } catch (error) {
      return { ...binding, error: String(error?.message || error) };
    }
  }));
  return inspector;
}

function formatInspectorValue(value, indent = 0) {
  if (value === null || value === undefined) return "—";
  if (typeof value !== "object") return String(value);
  if (Array.isArray(value)) return `[${value.map(item => formatInspectorValue(item)).join(", ")}]`;
  return Object.entries(value).map(([key, child]) =>
    `${" ".repeat(indent)}${key}: ${formatInspectorValue(child, indent + 2)}`).join("\n");
}

function inspectorCodegenResults(inspector) {
  const results = inspector.components.map(component => ({
    title: component.type,
    language: "PLAINTEXT",
    code: Object.entries(component.fields).map(([key, value]) =>
      `${key}: ${formatInspectorValue(value, 2)}`).join("\n")
  }));
  if (inspector.variables.length) {
    results.push({ title: "Figma Variables", language: "JSON", code: JSON.stringify(inspector.variables, null, 2) });
  }
  results.push({ title: "Figma Source", language: "JSON", code: JSON.stringify(inspector.figmaSource, null, 2) });
  if (inspector.warnings.length) {
    results.push({ title: "Warnings", language: "PLAINTEXT", code: inspector.warnings.map(value => `⚠ ${value}`).join("\n") });
  }
  return results;
}

function selectedNode() {
  const selection = figma.currentPage.selection;
  return selection.length === 1 ? selection[0] : null;
}

async function componentIdentity(node) {
  if (!node) return null;
  let component = null;
  if (node.type === "COMPONENT" || node.type === "COMPONENT_SET") {
    component = node;
  } else if (node.type === "INSTANCE") {
    try {
      component = typeof node.getMainComponentAsync === "function"
        ? await node.getMainComponentAsync()
        : node.mainComponent;
    } catch (_error) {
      component = null;
    }
  }
  if (!component) return null;

  const componentSet = component.type === "COMPONENT_SET"
    ? component
    : component.parent?.type === "COMPONENT_SET" ? component.parent : null;
  return {
    componentKey: component.key || null,
    componentName: component.name || null,
    componentSetKey: componentSet?.key || null,
    componentSetName: componentSet?.name || null,
    source: node.type === "INSTANCE" ? "instance-main-component" : "component"
  };
}

function findCatalogMapping(nodeName, identity, catalog) {
  const mappings = catalog?.componentMappings || catalog?.mappings || [];
  if (!Array.isArray(mappings) || mappings.length === 0) return null;

  const keyCandidates = [identity?.componentKey, identity?.componentSetKey].filter(Boolean);
  for (const mapping of mappings) {
    const mappingKeys = [mapping.figmaComponentKey, mapping.figmaComponentSetKey].filter(Boolean);
    if (mappingKeys.some(key => keyCandidates.includes(key))) {
      return { mapping, matchedBy: "component-key" };
    }
  }

  const names = [nodeName, identity?.componentName, identity?.componentSetName]
    .map(normalizeLookupName).filter(Boolean);
  for (const mapping of mappings) {
    const mappingName = normalizeLookupName(mapping.figmaComponentName || mapping.figmaName);
    if (mappingName && names.includes(mappingName)) {
      return { mapping, matchedBy: "component-name" };
    }
  }
  return null;
}

function resolveUnityBinding(nodeName, annotation, identity, catalog) {
  if (annotation?.kind === "component" &&
      (annotation.basePrefabId || ["new-prefab", "visual-only"].includes(annotation.generationMode))) {
    return {
      source: "annotation",
      prefabId: annotation.basePrefabId,
      generationMode: annotation.generationMode || "reuse-prefab",
      variantName: annotation.variantName || null,
      propertyBindings: annotation.propertyBindings || []
    };
  }

  const match = findCatalogMapping(nodeName, identity, catalog);
  if (!match) return null;
  return {
    source: match.matchedBy,
    mappingId: match.mapping.id || null,
    prefabId: match.mapping.prefabId || match.mapping.basePrefabId || null,
    generationMode: match.mapping.generationMode || "reuse-prefab",
    variantName: match.mapping.variantName || null,
    propertyBindings: match.mapping.propertyBindings || []
  };
}

function readAnnotation(node) {
  if (!node || typeof node.getSharedPluginData !== "function") return null;
  const raw = node.getSharedPluginData(NAMESPACE, ANNOTATION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (error) {
    return { invalid: true, parseError: String(error), raw };
  }
}

function writeAnnotation(node, annotation) {
  node.setSharedPluginData(
    NAMESPACE,
    ANNOTATION_KEY,
    JSON.stringify({
      ...annotation,
      schemaVersion: SCHEMA_VERSION,
      figmaNodeId: node.id,
      figmaNodeName: node.name,
      updatedAt: new Date().toISOString()
    })
  );
}

async function selectionPayload() {
  const selection = figma.currentPage.selection;
  if (selection.length !== 1) {
    return {
      ok: false,
      count: selection.length,
      message: selection.length === 0
        ? "Выберите один слой, компонент, фрейм или секцию."
        : "Для разметки выберите только один объект."
    };
  }

  const node = selection[0];
  const annotation = readAnnotation(node);
  const catalog = await figma.clientStorage.getAsync("unityCatalog");
  const identity = await componentIdentity(node);
  return {
    ok: true,
    node: {
      id: node.id,
      name: node.name,
      type: node.type,
      width: "width" in node ? node.width : null,
      height: "height" in node ? node.height : null
    },
    annotation,
    componentIdentity: identity,
    resolvedBinding: resolveUnityBinding(node.name, annotation, identity, catalog),
    unityInspector: analyzeUnityInspector(node)
  };
}

async function postSelection() {
  const revision = ++selectionRevision;
  const payload = await selectionPayload();
  if (revision === selectionRevision) figma.ui.postMessage({ type: "selection", payload });
}

function validateAnnotation(node, annotation) {
  const errors = [];
  const warnings = [];

  if (!annotation.kind) errors.push("Не выбран тип сущности.");
  if (["feature", "screen", "component"].includes(annotation.kind) && !annotation.id) {
    errors.push("Для Feature, Screen и Component нужен стабильный ID.");
  }
  if (annotation.kind === "screen") {
    if (!annotation.featureId) errors.push("Экран должен принадлежать Feature.");
    if (!annotation.unityName) errors.push("Укажите Unity Name экрана.");
    if (!annotation.templateId) warnings.push("Не выбран screen template.");
  }
  if (annotation.kind === "component") {
    if (!annotation.featureId) warnings.push("Компонент не привязан к Feature.");
    if (!annotation.unityName) errors.push("Укажите Unity Name компонента.");
    if (["reuse-prefab", "prefab-variant"].includes(annotation.generationMode) && !annotation.basePrefabId) {
      errors.push("Для переиспользования или Prefab Variant нужен Prefab / Base Prefab ID.");
    }
  }
  if (annotation.kind === "layer" && (!annotation.roles || annotation.roles.length === 0)) {
    errors.push("Для слоя выберите хотя бы одну Unity-роль.");
  }
  if (annotation.roles?.includes("animation-group") && !annotation.animationProfileId) {
    errors.push("Для Animation Group выберите animation profile.");
  }
  if (annotation.roles?.includes("safe-area") && !annotation.safeAreaProfileId) {
    warnings.push("Safe Area будет использовать профиль проекта по умолчанию.");
  }
  if (node.type === "INSTANCE" && annotation.kind === "component") {
    warnings.push("Размечен instance. Обычно Unity Component размечают на main component/component set.");
  }

  return { errors, warnings, valid: errors.length === 0 };
}

function serializeConstraints(node) {
  if (!("constraints" in node)) return null;
  return {
    horizontal: node.constraints.horizontal,
    vertical: node.constraints.vertical
  };
}

function serializeComponentProperties(node) {
  if (!("componentProperties" in node) || !node.componentProperties) return null;
  const result = {};
  for (const [name, property] of Object.entries(node.componentProperties)) {
    result[name] = { type: property.type, value: property.value };
  }
  return result;
}

async function serializeNode(node, catalog) {
  const annotation = readAnnotation(node);
  const identity = await componentIdentity(node);
  const result = {
    id: node.id,
    name: node.name,
    type: node.type,
    visible: "visible" in node ? node.visible : true,
    annotation,
    componentIdentity: identity,
    resolvedBinding: resolveUnityBinding(node.name, annotation, identity, catalog),
    unityInspector: analyzeUnityInspector(node)
  };

  const scalarFields = [
    "x", "y", "width", "height", "rotation", "opacity", "clipsContent",
    "layoutMode", "layoutWrap", "primaryAxisSizingMode", "counterAxisSizingMode",
    "primaryAxisAlignItems", "counterAxisAlignItems", "counterAxisAlignContent",
    "itemSpacing", "counterAxisSpacing", "paddingLeft", "paddingRight",
    "paddingTop", "paddingBottom", "layoutSizingHorizontal", "layoutSizingVertical",
    "minWidth", "maxWidth", "minHeight", "maxHeight"
  ];

  for (const field of scalarFields) {
    if (field in node && node[field] !== undefined) result[field] = node[field];
  }

  const constraints = serializeConstraints(node);
  if (constraints) result.constraints = constraints;

  const componentProperties = serializeComponentProperties(node);
  if (componentProperties) result.componentProperties = componentProperties;

  if ("children" in node) {
    result.children = [];
    for (const child of node.children) result.children.push(await serializeNode(child, catalog));
  }
  return result;
}

function catalogHasId(collection, id) {
  if (!id) return true;
  return Array.isArray(collection) && collection.some(entry =>
    (typeof entry === "string" ? entry : entry?.id) === id);
}

function validateCatalog(catalog) {
  const errors = [];
  if (!catalog || typeof catalog !== "object") errors.push("Каталог должен быть JSON-объектом.");
  if (catalog?.schema !== "figma-gamedev-ui-catalog") {
    errors.push("Неверный schema каталога. Ожидается 'figma-gamedev-ui-catalog'.");
  }
  if (!catalog?.version) errors.push("В каталоге отсутствует version.");
  for (const field of ["screenTemplates", "prefabs", "safeAreaProfiles", "animationProfiles"]) {
    if (catalog?.[field] != null && !Array.isArray(catalog[field])) {
      errors.push(`Поле '${field}' должно быть массивом.`);
    }
  }
  if (catalog?.componentMappings != null && !Array.isArray(catalog.componentMappings)) {
    errors.push("Поле 'componentMappings' должно быть массивом.");
  }
  const mappingIds = new Set();
  const componentMappings = Array.isArray(catalog?.componentMappings) ? catalog.componentMappings : [];
  for (const [index, mapping] of componentMappings.entries()) {
    const label = mapping?.id || `componentMappings[${index}]`;
    if (mapping?.id && mappingIds.has(mapping.id)) errors.push(`Дублирован mapping ID '${mapping.id}'.`);
    if (mapping?.id) mappingIds.add(mapping.id);
    if (!mapping?.figmaComponentKey && !mapping?.figmaComponentSetKey &&
        !mapping?.figmaComponentName && !mapping?.figmaName) {
      errors.push(`${label}: нужен Figma component key или name.`);
    }
    const mode = mapping?.generationMode || "reuse-prefab";
    const prefabId = mapping?.prefabId || mapping?.basePrefabId;
    if (!["new-prefab", "visual-only"].includes(mode) && !prefabId) {
      errors.push(`${label}: для '${mode}' нужен prefabId.`);
    }
    if (prefabId && !catalogHasId(catalog?.prefabs || catalog?.components, prefabId)) {
      errors.push(`${label}: prefab '${prefabId}' отсутствует в каталоге.`);
    }
    if (mapping?.propertyBindings != null && !Array.isArray(mapping.propertyBindings)) {
      errors.push(`${label}: propertyBindings должен быть массивом.`);
    }
  }
  return { valid: errors.length === 0, errors };
}

function buildPackageReport(rootNode, annotation, document, catalog) {
  const entries = [];
  const add = (severity, code, node, message) => entries.push({
    severity,
    code,
    nodeId: node?.id || rootNode?.id || null,
    nodeName: node?.name || rootNode?.name || null,
    message
  });

  const rootValidation = validateAnnotation(rootNode, annotation);
  rootValidation.errors.forEach(message => add("error", "ROOT_ANNOTATION_INVALID", document, message));
  rootValidation.warnings.forEach(message => add("warning", "ROOT_ANNOTATION_WARNING", document, message));

  if (catalog && annotation.kind === "screen" && annotation.templateId &&
      !catalogHasId(catalog?.screenTemplates, annotation.templateId)) {
    add("error", "SCREEN_TEMPLATE_UNKNOWN", document,
      `Screen Template '${annotation.templateId}' отсутствует в текущем Unity Catalog.`);
  }
  if (catalog && annotation.kind === "component" && annotation.basePrefabId &&
      !catalogHasId(catalog?.prefabs || catalog?.components, annotation.basePrefabId)) {
    add("error", "PREFAB_UNKNOWN", document,
      `Prefab '${annotation.basePrefabId}' отсутствует в текущем Unity Catalog.`);
  }

  let nodeCount = 0;
  let maxDepth = 0;
  let maskCount = 0;
  const semanticIds = new Map();

  const visit = (node, depth) => {
    nodeCount += 1;
    maxDepth = Math.max(maxDepth, depth);
    const nodeAnnotation = node.annotation;

    for (const warning of node.unityInspector?.warnings || []) {
      add("warning", "UNITY_CONVERSION_LOSS", node, warning);
    }
    if ((node.unityInspector?.components || []).some(component => component.type === "RectMask2D")) {
      maskCount += 1;
    }
    const isIgnored = nodeAnnotation?.roles?.includes("ignore");
    if (node.type === "INSTANCE" && node.visible !== false && !isIgnored && !node.resolvedBinding) {
      add("warning", "COMPONENT_UNMAPPED", node,
        "Figma instance не связан с production-prefab. Добавьте явную разметку или componentMappings в каталог.");
    }
    if (node.resolvedBinding?.source === "component-name") {
      add("warning", "NAME_MAPPING_USED", node,
        "Prefab найден по имени компонента. Добавьте figmaComponentKey в каталог, чтобы переименование не сломало mapping.");
    }
    if (catalog && node.resolvedBinding?.prefabId &&
        !catalogHasId(catalog?.prefabs || catalog?.components, node.resolvedBinding.prefabId)) {
      add("error", "MAPPED_PREFAB_UNKNOWN", node,
        `Mapping ссылается на неизвестный prefab '${node.resolvedBinding.prefabId}'.`);
    }
    if (catalog && nodeAnnotation?.roles?.includes("safe-area") && nodeAnnotation.safeAreaProfileId &&
        !catalogHasId(catalog?.safeAreaProfiles, nodeAnnotation.safeAreaProfileId)) {
      add("error", "SAFE_AREA_PROFILE_UNKNOWN", node,
        `Safe Area Profile '${nodeAnnotation.safeAreaProfileId}' отсутствует в каталоге.`);
    }
    if (catalog && nodeAnnotation?.roles?.includes("animation-group") && nodeAnnotation.animationProfileId &&
        !catalogHasId(catalog?.animationProfiles, nodeAnnotation.animationProfileId)) {
      add("error", "ANIMATION_PROFILE_UNKNOWN", node,
        `Animation Profile '${nodeAnnotation.animationProfileId}' отсутствует в каталоге.`);
    }
    if (nodeAnnotation?.id) {
      const duplicate = semanticIds.get(nodeAnnotation.id);
      if (duplicate) {
        add("error", "DUPLICATE_SEMANTIC_ID", node,
          `Стабильный ID '${nodeAnnotation.id}' уже используется узлом '${duplicate.name}'.`);
      } else {
        semanticIds.set(nodeAnnotation.id, node);
      }
    }
    for (const child of node.children || []) visit(child, depth + 1);
  };
  visit(document, 1);

  if (!catalog) add("warning", "CATALOG_MISSING", document,
    "Unity Catalog не загружен: prefab, template и behavior bindings нельзя проверить.");
  if (nodeCount > 250) add("warning", "MOBILE_NODE_BUDGET", document,
    `Экран содержит ${nodeCount} узлов. Проверьте нормализацию и стоимость мобильной иерархии.`);
  if (maxDepth > 12) add("warning", "MOBILE_DEPTH_BUDGET", document,
    `Глубина иерархии ${maxDepth}. Рекомендуется упростить wrappers до компиляции.`);
  if (maskCount > 4) add("warning", "MOBILE_MASK_BUDGET", document,
    `Найдено ${maskCount} mask-областей. Проверьте overdraw и batching на мобильном устройстве.`);

  const errors = entries.filter(entry => entry.severity === "error").length;
  const warnings = entries.filter(entry => entry.severity === "warning").length;
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    summary: { errors, warnings, nodeCount, maxDepth, maskCount },
    canPublish: errors === 0,
    entries
  };
}

function collectAnnotations() {
  const nodes = figma.currentPage.findAllWithCriteria({
    sharedPluginData: { namespace: NAMESPACE, keys: [ANNOTATION_KEY] }
  });
  return nodes.map(node => ({
    nodeId: node.id,
    nodeName: node.name,
    nodeType: node.type,
    annotation: readAnnotation(node)
  }));
}

function collectSubtreeIds(node, result = new Set()) {
  if (!node) return result;
  result.add(node.id);
  if ("children" in node) node.children.forEach(child => collectSubtreeIds(child, result));
  return result;
}

figma.on("selectionchange", postSelection);
figma.on("currentpagechange", postSelection);

if (figma.editorType === "dev" && figma.mode === "codegen") {
  figma.codegen.on("generate", async event => {
    const inspector = await resolveVariables(event.node, analyzeUnityInspector(event.node));
    return inspectorCodegenResults(inspector);
  });
}

figma.ui.onmessage = async message => {
  try {
    if (message.type === "ready") {
      const catalog = await figma.clientStorage.getAsync("unityCatalog");
      const bridgeToken = await figma.clientStorage.getAsync("bridgeToken");
      const lastExport = await figma.clientStorage.getAsync("lastExportPackage");
      figma.ui.postMessage({ type: "catalog", payload: catalog || null });
      figma.ui.postMessage({ type: "bridge-settings", payload: { token: bridgeToken || "" } });
      figma.ui.postMessage({ type: "last-export-state", payload: { available: Boolean(lastExport) } });
      await postSelection();
      return;
    }

    if (message.type === "save-annotation") {
      const node = selectedNode();
      if (!node) throw new Error("Выберите ровно один объект.");
      const result = validateAnnotation(node, message.annotation);
      if (!result.valid) {
        figma.ui.postMessage({ type: "validation", payload: result });
        return;
      }
      writeAnnotation(node, message.annotation);
      figma.notify(`FigmaGamedev: ${node.name} размечен`);
      figma.ui.postMessage({ type: "validation", payload: result });
      postSelection();
      return;
    }

    if (message.type === "remove-annotation") {
      const node = selectedNode();
      if (!node) throw new Error("Выберите ровно один объект.");
      node.setSharedPluginData(NAMESPACE, ANNOTATION_KEY, "");
      figma.notify(`FigmaGamedev: разметка удалена с ${node.name}`);
      postSelection();
      return;
    }

    if (message.type === "validate-selection") {
      const node = selectedNode();
      if (!node) throw new Error("Выберите ровно один объект.");
      const annotation = readAnnotation(node) || message.annotation || {};
      figma.ui.postMessage({
        type: "validation",
        payload: validateAnnotation(node, annotation)
      });
      return;
    }

    if (message.type === "save-catalog") {
      const validation = validateCatalog(message.catalog);
      if (!validation.valid) {
        figma.ui.postMessage({ type: "validation", payload: { errors: validation.errors, warnings: [] } });
        return;
      }
      await figma.clientStorage.setAsync("unityCatalog", message.catalog);
      figma.ui.postMessage({ type: "catalog", payload: message.catalog });
      figma.notify("FigmaGamedev: Unity Catalog импортирован");
      await postSelection();
      return;
    }

    if (message.type === "save-bridge-token") {
      await figma.clientStorage.setAsync("bridgeToken", String(message.token || "").trim());
      figma.ui.postMessage({ type: "bridge-settings", payload: { token: String(message.token || "").trim() } });
      return;
    }

    if (message.type === "save-publish-receipt") {
      await figma.clientStorage.setAsync("lastPublishReceipt", message.receipt || null);
      return;
    }

    if (message.type === "repeat-last-export") {
      const payload = await figma.clientStorage.getAsync("lastExportPackage");
      if (!payload) throw new Error("Последний экспортированный пакет не найден.");
      figma.ui.postMessage({ type: "export-ready", payload });
      return;
    }

    if (message.type === "scan-page") {
      figma.ui.postMessage({ type: "scan-result", payload: collectAnnotations() });
      return;
    }

    if (message.type === "export-selection") {
      const node = selectedNode();
      if (!node) throw new Error("Выберите ровно один объект.");
      const annotation = readAnnotation(node);
      if (!annotation) throw new Error("Сначала разметьте выбранный объект.");
      const validation = validateAnnotation(node, annotation);
      if (!validation.valid) {
        figma.ui.postMessage({ type: "validation", payload: validation });
        return;
      }

      const catalog = await figma.clientStorage.getAsync("unityCatalog");
      const document = await serializeNode(node, catalog);
      const report = buildPackageReport(node, annotation, document, catalog);
      figma.ui.postMessage({ type: "package-report", payload: report });
      if (!report.canPublish) {
        figma.ui.postMessage({
          type: "validation",
          payload: {
            errors: report.entries.filter(entry => entry.severity === "error").map(entry => entry.message),
            warnings: report.entries.filter(entry => entry.severity === "warning").map(entry => entry.message)
          }
        });
        return;
      }

      const subtreeIds = collectSubtreeIds(node);
      const annotations = collectAnnotations().filter(entry => subtreeIds.has(entry.nodeId));
      const figmaSource = {
        fileName: figma.root.name,
        pageName: figma.currentPage.name,
        rootNodeId: node.id
      };
      const unityInspector = await resolveVariables(node, analyzeUnityInspector(node));
      const packageContent = {
        figma: figmaSource,
        entity: annotation,
        catalogVersion: catalog?.version || null,
        annotations,
        document,
        unityInspector
      };
      const fingerprint = fnv1a32(stableStringify(packageContent));
      const payload = {
        schema: "figma-gamedev-ui-package",
        schemaVersion: SCHEMA_VERSION,
        pluginVersion: PLUGIN_VERSION,
        packageId: `${annotation.id || node.id}-${fingerprint}`,
        contentHash: { algorithm: "fnv1a32", value: fingerprint },
        exportedAt: new Date().toISOString(),
        figma: figmaSource,
        entity: annotation,
        catalogVersion: catalog?.version || null,
        annotations,
        document,
        unityInspector,
        report
      };

      await figma.clientStorage.setAsync("lastExportPackage", payload);
      figma.ui.postMessage({ type: "last-export-state", payload: { available: true } });
      figma.ui.postMessage({ type: "export-ready", payload });
      figma.notify(`FigmaGamedev: ${node.name} готов к экспорту`);
      return;
    }

    if (message.type === "select-node") {
      const node = typeof figma.getNodeByIdAsync === "function"
        ? await figma.getNodeByIdAsync(message.nodeId)
        : figma.getNodeById(message.nodeId);
      if (node && "visible" in node) {
        figma.currentPage.selection = [node];
        figma.viewport.scrollAndZoomIntoView([node]);
      }
    }
  } catch (error) {
    figma.ui.postMessage({ type: "error", payload: String(error?.message || error) });
    figma.notify(`FigmaGamedev: ${String(error?.message || error)}`, { error: true });
  }
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    round,
    colorToHex,
    srgbToLinear,
    horizontalAnchor,
    verticalAnchor,
    rectTransformHints,
    analyzeUnityInspector,
    inspectorCodegenResults,
    normalizeLookupName,
    stableStringify,
    fnv1a32,
    findCatalogMapping,
    resolveUnityBinding,
    validateCatalog,
    buildPackageReport
  };
}
