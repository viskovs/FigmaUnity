const test = require("node:test");
const assert = require("node:assert/strict");

global.__html__ = "";
global.figma = {
  editorType: "figma",
  mixed: Symbol("mixed"),
  showUI() {},
  on() {},
  ui: { postMessage() {}, onmessage: null },
  codegen: { on() {} },
  variables: { async getVariableByIdAsync() { return null; } },
  currentPage: { selection: [], findAllWithCriteria() { return []; }, name: "Test" },
  clientStorage: { async getAsync() { return null; }, async setAsync() {} },
  root: { name: "Test File" },
  notify() {},
  getNodeById() { return null; },
  viewport: { scrollAndZoomIntoView() {} }
};

const {
  analyzeUnityInspector,
  inspectorCodegenResults,
  horizontalAnchor,
  verticalAnchor,
  srgbToLinear,
  normalizeLookupName,
  stableStringify,
  fnv1a32,
  findCatalogMapping,
  resolveUnityBinding,
  validateCatalog,
  buildPackageReport
} = require("../code.js");

function node(overrides = {}) {
  return {
    id: "1:2",
    name: "Card",
    type: "FRAME",
    x: 100,
    y: 50,
    width: 200,
    height: 100,
    rotation: 0,
    opacity: 1,
    constraints: { horizontal: "LEFT", vertical: "TOP" },
    fills: [],
    effects: [],
    children: [],
    layoutMode: "NONE",
    parent: { type: "FRAME", width: 1000, height: 500 },
    ...overrides
  };
}

test("maps fixed left/top constraints and flips the Y axis", () => {
  const inspector = analyzeUnityInspector(node());
  const rect = inspector.components[0].fields;
  assert.deepEqual(rect.anchorMin, [0, 1]);
  assert.deepEqual(rect.anchorMax, [0, 1]);
  assert.deepEqual(rect.anchoredPosition, [200, -100]);
  assert.deepEqual(rect.sizeDelta, [200, 100]);
});

test("maps stretch constraints to anchors and offsets", () => {
  const inspector = analyzeUnityInspector(node({
    constraints: { horizontal: "LEFT_RIGHT", vertical: "TOP_BOTTOM" }
  }));
  const rect = inspector.components[0].fields;
  assert.deepEqual(rect.anchorMin, [0, 0]);
  assert.deepEqual(rect.anchorMax, [1, 1]);
  assert.deepEqual(rect.anchoredPosition, [-300, 150]);
  assert.equal(rect.offsetLeft, 100);
  assert.equal(rect.offsetRight, 700);
  assert.equal(rect.offsetTop, 50);
  assert.equal(rect.offsetBottom, 350);
  assert.deepEqual(rect.sizeDelta, [-800, -400]);
});

test("maps scale constraints proportionally", () => {
  assert.deepEqual(horizontalAnchor("SCALE", 100, 200, 1000), [0.1, 0.3]);
  assert.deepEqual(verticalAnchor("SCALE", 50, 100, 500), [0.7, 0.9]);

  const inspector = analyzeUnityInspector(node({
    constraints: { horizontal: "SCALE", vertical: "SCALE" }
  }));
  const rect = inspector.components[0].fields;
  assert.deepEqual(rect.anchorMin, [0.1, 0.7]);
  assert.deepEqual(rect.anchorMax, [0.3, 0.9]);
  assert.deepEqual(rect.anchoredPosition, [0, 0]);
  assert.deepEqual(rect.sizeDelta, [0, 0]);
  assert.equal("offsetLeft" in rect, false);
  assert.equal("offsetTop" in rect, false);
});

test("creates layout group, fitter and layout element hints", () => {
  const inspector = analyzeUnityInspector(node({
    layoutMode: "HORIZONTAL",
    layoutWrap: "NO_WRAP",
    primaryAxisSizingMode: "AUTO",
    counterAxisSizingMode: "FIXED",
    layoutSizingHorizontal: "HUG",
    layoutSizingVertical: "FILL",
    paddingLeft: 24,
    paddingRight: 24,
    paddingTop: 16,
    paddingBottom: 16,
    itemSpacing: 12,
    primaryAxisAlignItems: "MIN",
    counterAxisAlignItems: "CENTER",
    parent: { type: "FRAME", width: 1000, height: 500, layoutMode: "VERTICAL" }
  }));
  assert.ok(inspector.components.some(value => value.type === "HorizontalLayoutGroup"));
  assert.ok(inspector.components.some(value => value.type === "ContentSizeFitter"));
  const element = inspector.components.find(value => value.type === "LayoutElement");
  assert.equal(element.fields.flexibleHeight, 1);
});

test("does not add LayoutElement outside a parent Auto Layout", () => {
  const inspector = analyzeUnityInspector(node({
    layoutSizingHorizontal: "FIXED",
    layoutSizingVertical: "FIXED"
  }));
  assert.equal(inspector.components.some(value => value.type === "LayoutElement"), false);
});

test("reports wrap and max-size ambiguity instead of hiding it", () => {
  const inspector = analyzeUnityInspector(node({
    layoutMode: "HORIZONTAL",
    layoutWrap: "WRAP",
    maxWidth: 600
  }));
  assert.ok(inspector.warnings.some(value => value.includes("Wrap")));
  assert.ok(inspector.warnings.some(value => value.includes("max size")));
});

test("converts sRGB channels to Unity linear values", () => {
  assert.equal(srgbToLinear(0), 0);
  assert.ok(Math.abs(srgbToLinear(0.5) - 0.214041) < 0.000001);
  assert.equal(srgbToLinear(1), 1);
});

test("maps a solid visual to Image and keeps container opacity in CanvasGroup", () => {
  const inspector = analyzeUnityInspector(node({
    opacity: 0.5,
    fills: [{ type: "SOLID", color: { r: 1, g: 0.5, b: 0 }, opacity: 1 }],
    children: [{ id: "child" }]
  }));
  const group = inspector.components.find(value => value.type === "CanvasGroup");
  const image = inspector.components.find(value => value.type === "Image");
  assert.equal(group.fields.alpha, 0.5);
  assert.equal(image.fields.color.hex, "#FF8000");
});

test("maps text properties and reports the SDF outline approximation", () => {
  const inspector = analyzeUnityInspector(node({
    type: "TEXT",
    characters: "Buy",
    fontName: { family: "Inter", style: "Bold" },
    fontSize: 24,
    letterSpacing: { unit: "PIXELS", value: 1.5 },
    lineHeight: { unit: "PIXELS", value: 28 },
    textAlignHorizontal: "CENTER",
    textAlignVertical: "CENTER",
    textAutoResize: "NONE",
    fills: [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }],
    strokes: [{ type: "SOLID", color: { r: 0, g: 0, b: 0 } }],
    strokeWeight: 2
  }));
  const text = inspector.components.find(value => value.type === "TextMeshProUGUI");
  const outline = inspector.components.find(value => value.type === "TMP Text Outline");
  assert.equal(text.fields.text, "Buy");
  assert.equal(text.fields.fontFamily, "Inter");
  assert.equal(text.fields.alignment, "Center");
  assert.equal(text.fields.sourceAlignment, "CENTER-CENTER");
  assert.equal(outline.fields.estimatedOutlineWidth, 0.083);
  assert.ok(inspector.warnings.some(value => value.includes("SDF")));
  assert.ok(inspector.warnings.some(value => value.includes("letter spacing")));
});

test("keeps RawImage crop ambiguity visible for AI", () => {
  const inspector = analyzeUnityInspector(node({
    fills: [{
      type: "IMAGE",
      imageHash: "texture-hash",
      scaleMode: "CROP",
      cropTransform: [[1, 0, 0], [0, 1, 0]]
    }]
  }));
  const rawImage = inspector.components.find(value => value.type === "RawImage");
  assert.equal(rawImage.fields.textureRef, "texture-hash");
  assert.match(rawImage.fields.uvRect, /cropTransform/);
  assert.ok(inspector.warnings.some(value => value.includes("uvRect")));
});

test("generates compatible TMP Rich Text and preserves styled segment source", () => {
  const inspector = analyzeUnityInspector(node({
    type: "TEXT",
    characters: "Buy now",
    fontName: global.figma.mixed,
    fontSize: global.figma.mixed,
    fills: global.figma.mixed,
    textAlignHorizontal: "LEFT",
    textAlignVertical: "TOP",
    textAutoResize: "NONE",
    getStyledTextSegments() {
      return [
        {
          start: 0,
          end: 3,
          characters: "Buy",
          fontName: { family: "Inter", style: "Bold" },
          fontSize: 24,
          fills: [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }],
          textDecoration: "NONE",
          letterSpacing: { unit: "PIXELS", value: 0 },
          lineHeight: { unit: "AUTO" }
        },
        {
          start: 3,
          end: 7,
          characters: " now",
          fontName: { family: "Inter", style: "Regular" },
          fontSize: 18,
          fills: [{ type: "SOLID", color: { r: 1, g: 0.5, b: 0 } }],
          textDecoration: "NONE",
          letterSpacing: { unit: "PIXELS", value: 0 },
          lineHeight: { unit: "AUTO" }
        }
      ];
    }
  }));
  const text = inspector.components.find(value => value.type === "TextMeshProUGUI");
  assert.match(text.fields.text, /<b>Buy<\/b>/);
  assert.match(text.fields.text, /#FF8000/);
  assert.equal(text.fields.sourceText, "Buy now");
  assert.equal(text.fields.styledSegments.length, 2);
});

test("emits grouped Dev Mode codegen with source, variables and warnings", () => {
  const inspector = analyzeUnityInspector(node({
    fills: [{
      type: "GRADIENT_LINEAR",
      gradientStops: [
        { position: 0, color: { r: 1, g: 0, b: 0, a: 1 } },
        { position: 1, color: { r: 0, g: 0, b: 1, a: 1 } }
      ]
    }],
    boundVariables: { opacity: { type: "VARIABLE_ALIAS", id: "VariableID:42" } }
  }));
  const results = inspectorCodegenResults(inspector);
  assert.ok(results.some(value => value.title === "RectTransform"));
  assert.ok(results.some(value => value.title === "Figma Variables" && value.language === "JSON"));
  const source = results.find(value => value.title === "Figma Source");
  assert.match(source.code, /GRADIENT_LINEAR/);
  assert.ok(results.some(value => value.title === "Warnings"));
});

test("resolves catalog mappings by stable component key before normalized name", () => {
  const catalog = {
    componentMappings: [
      { id: "name", figmaComponentName: "Product Card", prefabId: "unity.by-name" },
      { id: "key", figmaComponentKey: "figma-key-42", prefabId: "unity.by-key" }
    ]
  };
  const match = findCatalogMapping("Product Card", { componentKey: "figma-key-42" }, catalog);
  assert.equal(match.matchedBy, "component-key");
  assert.equal(match.mapping.prefabId, "unity.by-key");
  assert.equal(normalizeLookupName("Product-card / Featured"), "productcardfeatured");
});

test("explicit annotation wins over a catalog mapping", () => {
  const binding = resolveUnityBinding(
    "Product Card",
    { kind: "component", basePrefabId: "unity.explicit", generationMode: "prefab-variant" },
    { componentKey: "figma-key-42" },
    { componentMappings: [{ figmaComponentKey: "figma-key-42", prefabId: "unity.mapped" }] }
  );
  assert.equal(binding.source, "annotation");
  assert.equal(binding.prefabId, "unity.explicit");
  assert.equal(binding.generationMode, "prefab-variant");
});

test("stable package fingerprint ignores object key insertion order", () => {
  const left = stableStringify({ screen: { id: "shop", nodes: [1, 2] }, version: 2 });
  const right = stableStringify({ version: 2, screen: { nodes: [1, 2], id: "shop" } });
  assert.equal(left, right);
  assert.equal(fnv1a32(left), fnv1a32(right));
});

test("catalog validation rejects the wrong schema and malformed mappings", () => {
  const validation = validateCatalog({ version: "1", componentMappings: {} });
  assert.equal(validation.valid, false);
  assert.ok(validation.errors.some(value => value.includes("schema")));
  assert.ok(validation.errors.some(value => value.includes("componentMappings")));
});

test("package report blocks unknown mapped prefabs and reports unmapped instances", () => {
  const root = node({ type: "FRAME", name: "Shop" });
  const annotation = { kind: "screen", id: "shop.main", featureId: "shop", unityName: "ShopScreen" };
  const document = {
    id: root.id,
    name: root.name,
    type: root.type,
    annotation,
    unityInspector: { components: [], warnings: [] },
    children: [
      { id: "2:1", name: "Known", type: "INSTANCE", resolvedBinding: { prefabId: "unity.unknown" }, unityInspector: { components: [], warnings: [] }, children: [] },
      { id: "2:2", name: "Loose", type: "INSTANCE", resolvedBinding: null, unityInspector: { components: [], warnings: [] }, children: [] }
    ]
  };
  const catalog = { screenTemplates: [], prefabs: [], safeAreaProfiles: [], animationProfiles: [] };
  const report = buildPackageReport(root, annotation, document, catalog);
  assert.equal(report.canPublish, false);
  assert.ok(report.entries.some(entry => entry.code === "MAPPED_PREFAB_UNKNOWN"));
  assert.ok(report.entries.some(entry => entry.code === "COMPONENT_UNMAPPED"));
});
