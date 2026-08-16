const NAMESPACE = "figmagamedev";
const ANNOTATION_KEY = "annotation";
const SCHEMA_VERSION = 1;
const INSPECTOR_SCHEMA_VERSION = 1;

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

function selectionPayload() {
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
  return {
    ok: true,
    node: {
      id: node.id,
      name: node.name,
      type: node.type,
      width: "width" in node ? node.width : null,
      height: "height" in node ? node.height : null
    },
    annotation: readAnnotation(node),
    unityInspector: analyzeUnityInspector(node)
  };
}

function postSelection() {
  figma.ui.postMessage({ type: "selection", payload: selectionPayload() });
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
    if (annotation.generationMode === "prefab-variant" && !annotation.basePrefabId) {
      errors.push("Для Prefab Variant нужен Base Prefab ID.");
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

function serializeNode(node) {
  const result = {
    id: node.id,
    name: node.name,
    type: node.type,
    visible: "visible" in node ? node.visible : true,
    annotation: readAnnotation(node),
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

  if ((node.type === "COMPONENT" || node.type === "COMPONENT_SET") && "key" in node) {
    result.componentKey = node.key || null;
  }

  if ("children" in node) result.children = node.children.map(serializeNode);
  return result;
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
      figma.ui.postMessage({ type: "catalog", payload: catalog || null });
      postSelection();
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
      await figma.clientStorage.setAsync("unityCatalog", message.catalog);
      figma.ui.postMessage({ type: "catalog", payload: message.catalog });
      figma.notify("FigmaGamedev: Unity Catalog импортирован");
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
      const payload = {
        schema: "figma-gamedev-ui-package",
        schemaVersion: SCHEMA_VERSION,
        exportedAt: new Date().toISOString(),
        figma: {
          fileName: figma.root.name,
          pageName: figma.currentPage.name,
          rootNodeId: node.id
        },
        entity: annotation,
        catalogVersion: catalog?.version || null,
        annotations: collectAnnotations().filter(entry => {
          let current = figma.getNodeById(entry.nodeId);
          while (current) {
            if (current.id === node.id) return true;
            current = current.parent;
          }
          return false;
        }),
        document: serializeNode(node),
        unityInspector: await resolveVariables(node, analyzeUnityInspector(node))
      };

      figma.ui.postMessage({ type: "export-ready", payload });
      figma.notify(`FigmaGamedev: ${node.name} готов к экспорту`);
      return;
    }

    if (message.type === "select-node") {
      const node = figma.getNodeById(message.nodeId);
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
    inspectorCodegenResults
  };
}
