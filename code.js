const NAMESPACE = "figmagamedev";
const ANNOTATION_KEY = "annotation";
const SCHEMA_VERSION = 1;

figma.showUI(__html__, { width: 420, height: 760, themeColors: true });

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
    annotation: readAnnotation(node)
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
    annotation: readAnnotation(node)
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
        document: serializeNode(node)
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
