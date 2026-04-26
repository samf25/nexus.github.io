import { CANONICAL_TEMPLATE_SPECS, TEMPLATE_ALIASES } from "./templateCatalog.js";

const DEFAULT_BLUEPRINT_PATH = "./arg_node_specs_loreauth.json";
const RETIRED_SECTION_NAMES = new Set(["The Cosmere", "Cosmere"]);
const RETIRED_NODE_IDS = new Set([
  "AA04",
  "AA05",
  "AA06",
  "AA07",
  "AA08",
  "AA09",
  "AA10",
  "AA11",
  "MOL04",
  "MOL05",
  "MOL06",
  "MOL07",
  "MOL08",
  "MOL09",
  "MOL10",
  "MOL11",
  "TWI05",
  "TWI06",
  "TWI07",
  "TWI08",
  "TWI09",
  "TWI10",
  "TWI11",
  "PGE07",
  "PGE08",
  "PGE09",
  "PGE10",
  "PGE11",
  "WORM09",
  "WORM10",
  "WORM11",
]);

function numericNodeSuffix(nodeId) {
  const match = String(nodeId || "").match(/(\d+)$/);
  if (!match) {
    return null;
  }
  return Number.parseInt(match[1], 10);
}

function nodeOrderIndex(node) {
  const explicit = Number(node && node.orderIndex);
  if (Number.isFinite(explicit)) {
    return explicit;
  }
  const suffix = numericNodeSuffix(node && node.node_id);
  if (suffix != null) {
    return suffix;
  }
  const source = Number(node && node._sourceIndex);
  if (Number.isFinite(source)) {
    return source;
  }
  return Number.MAX_SAFE_INTEGER;
}

function compareSectionNodes(section, a, b) {
  const orderA = nodeOrderIndex(a);
  const orderB = nodeOrderIndex(b);
  if (orderA !== orderB) {
    return orderA - orderB;
  }

  const suffixA = numericNodeSuffix(a && a.node_id);
  const suffixB = numericNodeSuffix(b && b.node_id);
  if (suffixA != null && suffixB != null && suffixA !== suffixB) {
    return suffixA - suffixB;
  }
  return String(a.node_id).localeCompare(String(b.node_id));
}

export async function loadBlueprint(path = DEFAULT_BLUEPRINT_PATH) {
  const response = await fetch(path, { cache: "no-cache" });
  if (!response.ok) {
    throw new Error(`Unable to load blueprint JSON: ${response.status}`);
  }

  const blueprint = await response.json();
  if (!blueprint || !Array.isArray(blueprint.nodes)) {
    throw new Error("Blueprint JSON is missing a nodes array.");
  }

  const removedIds = new Set(
    blueprint.nodes
      .filter(
        (node) =>
          RETIRED_SECTION_NAMES.has(String(node.section || "")) ||
          String(node.route || "").startsWith("/cosmere/") ||
          RETIRED_NODE_IDS.has(String(node.node_id || "")),
      )
      .map((node) => node.node_id),
  );
  const cleanedNodes = blueprint.nodes
    .filter((node) => !removedIds.has(node.node_id))
    .map((node, index) => ({
      ...node,
      _sourceIndex: index,
      dependencies: Array.isArray(node.dependencies)
        ? node.dependencies.filter((dep) => !removedIds.has(dep))
        : [],
    }));

  return {
    ...blueprint,
    nodes: cleanedNodes,
  };
}

export function buildBlueprintIndex(blueprint) {
  const nodesById = new Map();
  const nodesByRoute = new Map();
  const sectionNodes = new Map();

  for (const node of blueprint.nodes) {
    nodesById.set(node.node_id, node);
    nodesByRoute.set(node.route, node);

    const section = node.section || "Unknown";
    if (!sectionNodes.has(section)) {
      sectionNodes.set(section, []);
    }

    sectionNodes.get(section).push(node);
  }

  for (const [section, nodeList] of sectionNodes.entries()) {
    nodeList.sort((a, b) => compareSectionNodes(section, a, b));
  }

  return {
    raw: blueprint,
    nodesById,
    nodesByRoute,
    sectionNodes,
    sections: Array.from(sectionNodes.keys()),
    summary: blueprint.summary || {},
  };
}

export function canonicalTemplateName(node) {
  if (TEMPLATE_ALIASES[node.template]) {
    return TEMPLATE_ALIASES[node.template];
  }

  const t = String(node.template || "").toLowerCase();
  const r = String(node.runtime || "").toLowerCase();

  if (r.includes("document")) {
    return "DocumentPuzzle";
  }
  if (r.includes("map")) {
    return "MapPlanner";
  }
  if (r.includes("boss") || r.includes("meta")) {
    return "BossAssembler";
  }
  if (r.includes("persistent")) {
    if (t.includes("dungeon") || t.includes("crawl")) {
      return "DungeonSystem";
    }
    if (t.includes("scheduling") || t.includes("delivery")) {
      return "SchedulingSystem";
    }
    if (t.includes("incremental") || t.includes("well")) {
      return "IncrementalSystem";
    }
    if (t.includes("craft") || t.includes("bench")) {
      return "CraftingPage";
    }
    return "BoardPuzzle";
  }
  if (r.includes("logic") || r.includes("math") || t.includes("grid") || t.includes("board")) {
    return "BoardPuzzle";
  }
  if (r.includes("client")) {
    return "CanvasPuzzle";
  }

  return "BoardPuzzle";
}

export function templateSpecByNode(node) {
  const canonical = canonicalTemplateName(node);
  return {
    canonical,
    ...(CANONICAL_TEMPLATE_SPECS[canonical] || {
      contract: "No template contract found.",
      usedFor: "Unknown",
    }),
  };
}

export function sectionRouteSlug(sectionName) {
  return String(sectionName || "section")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function sortByDependencyDepth(nodes) {
  return [...nodes].sort((a, b) => {
    const depthA = Array.isArray(a.dependencies) ? a.dependencies.length : 0;
    const depthB = Array.isArray(b.dependencies) ? b.dependencies.length : 0;
    if (depthA !== depthB) {
      return depthA - depthB;
    }
    return String(a.node_id).localeCompare(String(b.node_id));
  });
}
