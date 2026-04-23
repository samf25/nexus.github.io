import {
  buildBlueprintIndex,
  canonicalTemplateName,
  loadBlueprint,
  sectionRouteSlug,
  sortByDependencyDepth,
  templateSpecByNode,
} from "./data/blueprint.js";
import { getCurrentRoute, navigate, subscribeToRouteChanges } from "./core/router.js";
import {
  getNodeRuntime,
  loadState,
  markNodeSeen,
  markNodeSolved,
  parseStateFromSaveText,
  resetState,
  saveState,
  serializeStateForSave,
  setHintLevel,
  updateNodeRuntime,
  updateSystemState,
} from "./core/state.js";
import { computeSectionProgress, computeUnlockedNodeIds, frontierNodes } from "./core/unlock.js";
import { getNodeExperience } from "./nodes/index.js";
import { getTemplateRenderer } from "./templates/index.js";
import { renderRegionHub } from "./templates/regionHub.js";
import { escapeHtml } from "./templates/shared.js";
import { renderShellLayout } from "./ui/shell.js";
import { renderDesk } from "./ui/desk.js";
import { renderNexusView } from "./ui/nexus.js";
import { consumeReward, hasWaveOnePasskey, keySlotsFromState, socketRewardKey } from "./core/artifacts.js";
import { convertMadraToCharge, setMadraPreset, tickMadraWell } from "./systems/madraWell.js";
import {
  buildDeliveryDay,
  defaultDeliveryPlan,
  dispatchDeliveryPlan,
} from "./systems/deliveryBoard.js";
import { moveRoom, runRoomAction } from "./systems/dungeonCrawl.js";
import { reduceWormSystemState } from "./systems/wormDeck.js";
import { applyPrestigeReset, applyPrestigeUpgradePurchase } from "./systems/prestige.js";
import {
  applyPracticalGuideRoleReset,
  grantPracticalGuideRoleArtifact,
} from "./systems/practicalGuide.js";
import {
  addTwiReputation,
  applyLootDrop,
  applyTwiUpgradePurchase,
  consumeLootItem,
  estimateLootShopPrice,
  equipLootItem,
  getArcaneLootModifiers,
  getWormCapeLootBonuses,
  isLootItemEquipped,
  lootInventoryFromState,
  removeLootItemInstance,
  rollRegionalLoot,
  spendTwiReputation,
  unequipLootItem,
} from "./systems/loot.js";
import {
  applyArcaneManaSpendProgress,
  arcaneSystemFromState,
  awardManaCrystals,
  consumeWorkshopMana,
  estimateAppraisal,
  grantStarterGlyphs,
  matchRuneAgainstGrimoire,
  pullGlyphFromTome,
  recordWorkshopCraftResult,
  resolveWorkshopCraftOutcome,
  setEnchanterAttunement,
  spendManaCrystals,
  tickArcaneMana,
} from "./systems/arcaneAscension.js";
import { wormCardById } from "./nodes/worm/wormData.js";

const root = document.getElementById("app");

let blueprintIndex = null;
let appState = loadState();
let deskFocusNodeId = null;
let bannerMessage = "";
let widgetState = {
  artifacts: false,
  loot: false,
  signals: false,
  save: false,
};
let selectedArtifactReward = "";
let selectedLootItemId = "";
let selectedLootRegion = "crd";
let nexusRingSelectionIndex = 0;
let nexusItemSelectionByRing = [];
let lastNexusRings = [];
let sectionNodeSelectionIndex = 0;
let lastSectionNodes = [];
let activeNodeContext = null;
let routeVisitNonce = 0;
let lastRouteForVisit = "";
const AUTO_RENDER_INTERVAL_MS = 2000;
const HUB08_ORB_HOLD_MS = 2000;
const NEXUS_MATH_SECTION_ORDER = Object.freeze([
  "Hall of Proofs",
  "Prime Vault",
  "Symmetry Forge",
  "Curved Atlas",
]);
const MATH_VAULT_PGE_ARTIFACT_PLACEMENTS = Object.freeze({
  LOG02: "Westwall Ram",
  NUM02: "Green Wax Seal",
  ALG02: "Sunless Lantern",
  GEO02: "Bone Key",
});
const PGE_STORY_NODE_IDS = Object.freeze(new Set(["PGE02", "PGE03", "PGE04", "PGE05", "PGE06"]));
const NODE_ARTIFACT_CONSUME_RULES = Object.freeze([
  Object.freeze({
    nodeId: "HUB04",
    actionType: "arm-bearings",
    artifact: "Nexus Bearings",
    usedBy: "HUB04",
    when: () => true,
  }),
  Object.freeze({
    nodeId: "CRD02",
    actionType: "crd02-origin-test",
    artifact: "Starter Core",
    usedBy: "CRD02",
    when: () => true,
  }),
  Object.freeze({
    nodeId: "CRD02",
    actionType: "crd02-breakthrough",
    artifact: "Cultivation Potion",
    usedBy: "CRD02",
    when: (action) => action.ready === true,
  }),
  Object.freeze({
    nodeId: "CRD04",
    actionType: "crd04-enter-tournament",
    artifact: "Seven-Year Festival Tournament Pass",
    usedBy: "CRD04",
    when: (action) => action.consumePass === true,
  }),
  Object.freeze({
    nodeId: "HUB05",
    actionType: "hub05-scan-archive",
    artifact: "Archive Address",
    usedBy: "HUB05",
    when: (action) => action.ready === true,
  }),
]);
const NODE_REWARD_OVERRIDES = Object.freeze({
  AA01: Object.freeze({
    suppressBlueprintReward: true,
    supplementalRewards: Object.freeze(["Enchanter Attunement"]),
  }),
  AA02: Object.freeze({
    suppressBlueprintReward: true,
    supplementalRewards: Object.freeze([]),
  }),
  AA03: Object.freeze({
    suppressBlueprintReward: true,
    supplementalRewards: Object.freeze([]),
  }),
  TWI04: Object.freeze({
    suppressBlueprintReward: true,
    supplementalRewards: Object.freeze([]),
  }),
});
let hub08OrbHoldSession = {
  pointerId: null,
  button: null,
  startAt: 0,
  rafId: 0,
  completed: false,
};
let aa03PointerSession = {
  pointerId: null,
  canvas: null,
  kind: "",
  points: [],
};

function parseAa03CanvasPath(value) {
  try {
    const parsed = JSON.parse(String(value || "[]"));
    return Array.isArray(parsed)
      ? parsed
        .map((entry) => ({
          x: Math.min(1, Math.max(0, Number(entry && entry.x))),
          y: Math.min(1, Math.max(0, Number(entry && entry.y))),
        }))
        .filter((entry) => Number.isFinite(entry.x) && Number.isFinite(entry.y))
      : [];
  } catch {
    return [];
  }
}

function clearAa03PointerSession() {
  const session = aa03PointerSession;
  if (session.canvas && session.pointerId !== null) {
    try {
      if (typeof session.canvas.hasPointerCapture === "function" && session.canvas.hasPointerCapture(session.pointerId)) {
        session.canvas.releasePointerCapture(session.pointerId);
      }
    } catch (_error) {
      // ignore pointer release errors
    }
  }
  aa03PointerSession = {
    pointerId: null,
    canvas: null,
    kind: "",
    points: [],
  };
}

function pointFromCanvasEvent(canvas, event) {
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(1, rect.width);
  const height = Math.max(1, rect.height);
  return {
    x: Math.min(1, Math.max(0, (event.clientX - rect.left) / width)),
    y: Math.min(1, Math.max(0, (event.clientY - rect.top) / height)),
  };
}

function drawAa03Segment(canvas, fromPoint, toPoint) {
  const context = canvas.getContext("2d");
  if (!context) {
    return;
  }
  context.lineWidth = 3;
  context.strokeStyle = "#f2f0dd";
  context.lineCap = "round";
  context.lineJoin = "round";
  const width = Number(canvas.width) || 1;
  const height = Number(canvas.height) || 1;
  context.beginPath();
  context.moveTo(fromPoint.x * width, fromPoint.y * height);
  context.lineTo(toPoint.x * width, toPoint.y * height);
  context.stroke();
}

function resetAa03Canvas(canvas) {
  const context = canvas.getContext("2d");
  if (!context) {
    return;
  }
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "rgba(9, 20, 28, 0.85)";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = "rgba(255,255,255,0.09)";
  context.lineWidth = 1;
  const steps = 6;
  for (let index = 1; index < steps; index += 1) {
    const x = (canvas.width / steps) * index;
    const y = (canvas.height / steps) * index;
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, canvas.height);
    context.stroke();
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(canvas.width, y);
    context.stroke();
  }
}

function setBanner(text) {
  bannerMessage = text;
}

function aaEnhancementPrefix(glyphId) {
  const map = {
    "force-lattice": "Braced",
    "precision-mark": "Keen",
    "resonance-loop": "Echoing",
    "vital-knot": "Vital",
    "swift-circuit": "Quickened",
    "merchant-sigil": "Brokered",
    "overflow-channel": "Flooded",
    "stability-anchor": "Anchored",
    "echo-ward": "Warded",
    "surge-glyph": "Surging",
  };
  const key = String(glyphId || "").trim().toLowerCase();
  return map[key] || "Runed";
}

function closeTopDialogIfAny() {
  const closeCandidates = Array.from(
    root.querySelectorAll(
      [
        ".crd02-tech-modal [data-node-action*='close']",
        ".crd02-tech-modal [data-node-action='twi03-select-quest'][data-quest-id='']",
        "[role='dialog'] [data-node-action*='close']",
        "[role='dialog'] [data-node-action='twi03-select-quest'][data-quest-id='']",
        "[data-node-action$='-close-target']",
        "[data-node-action='mol02-close-confirm']",
        "[data-node-action='twi03-select-quest'][data-quest-id='']",
      ].join(", "),
    ),
  ).filter((element) => {
    if (!(element instanceof HTMLElement)) {
      return false;
    }
    return element.offsetParent !== null && !element.hasAttribute("disabled");
  });
  const closeButton = closeCandidates[closeCandidates.length - 1];
  if (!(closeButton instanceof HTMLElement)) {
    return false;
  }
  closeButton.click();
  return true;
}

function grantSupplementalReward(state, rewardName, node) {
  const reward = String(rewardName || "");
  if (!reward) {
    return state;
  }

  const rewards = rewardsMap(state);

  if (rewards[reward]) {
    return state;
  }

  return {
    ...state,
    inventory: {
      ...(state.inventory || {}),
      rewards: {
        ...rewards,
        [reward]: {
          source: node && node.node_id ? node.node_id : "SYSTEM",
          section: node && node.section ? node.section : "Nexus Hub",
          awardedAt: Date.now(),
        },
      },
    },
  };
}

function rewardsMap(state) {
  return state && state.inventory && state.inventory.rewards && typeof state.inventory.rewards === "object"
    ? state.inventory.rewards
    : {};
}

function applyNodeRewardOverride(state, node) {
  const sourceState = state && typeof state === "object" ? state : {};
  const nodeId = node && node.node_id ? node.node_id : "";
  const policy = NODE_REWARD_OVERRIDES[nodeId];
  if (!policy) {
    return sourceState;
  }

  let next = sourceState;
  const rewards = rewardsMap(next);
  if (policy.suppressBlueprintReward && node && node.reward && rewards[node.reward]) {
    const trimmed = { ...rewards };
    delete trimmed[node.reward];
    next = {
      ...next,
      inventory: {
        ...(next.inventory || {}),
        rewards: trimmed,
      },
    };
  }

  const supplemental = Array.isArray(policy.supplementalRewards) ? policy.supplementalRewards : [];
  for (const reward of supplemental) {
    next = grantSupplementalReward(next, reward, node);
  }
  return next;
}

function markNodeSolvedWithOverrides(state, node) {
  const sourceState = state && typeof state === "object" ? state : {};
  const nodeId = node && node.node_id ? node.node_id : "";
  const policy = NODE_REWARD_OVERRIDES[nodeId];
  const nodeForSolve = policy && policy.suppressBlueprintReward
    ? { ...node, reward: "" }
    : node;
  const solved = markNodeSolved(sourceState, nodeForSolve);
  return applyNodeRewardOverride(solved, node);
}

function solveRewardLabel(node) {
  const nodeId = node && node.node_id ? node.node_id : "";
  const policy = NODE_REWARD_OVERRIDES[nodeId];
  if (!policy) {
    return node && node.reward ? node.reward : "(none)";
  }
  const supplemental = Array.isArray(policy.supplementalRewards) ? policy.supplementalRewards : [];
  if (supplemental.length) {
    return supplemental.join(", ");
  }
  if (policy.suppressBlueprintReward) {
    return "(none)";
  }
  return node && node.reward ? node.reward : "(none)";
}

function applyNodeSolveSystemOverrides(state, node) {
  const sourceState = state && typeof state === "object" ? state : {};
  const nodeId = node && node.node_id ? node.node_id : "";
  if (nodeId === "AA01") {
    return setEnchanterAttunement(sourceState, true);
  }
  return sourceState;
}

function withState(updater) {
  appState = typeof updater === "function" ? updater(appState) : updater;
  saveState(appState);
}

function isPgeStoryNode(nodeId) {
  return PGE_STORY_NODE_IDS.has(String(nodeId || ""));
}

function parseArtifactList(value) {
  return Array.isArray(value)
    ? value.map((entry) => String(entry || "").trim()).filter((entry) => entry)
    : [];
}

function normalizeLootEvent(entry) {
  const source = entry && typeof entry === "object" ? entry : {};
  return {
    sourceRegion: String(source.sourceRegion || "").trim().toLowerCase(),
    triggerType: String(source.triggerType || "").trim(),
    dropChance: Number(source.dropChance) || 0,
    outRegionChance: Number(source.outRegionChance) || 0,
    rarityBias: Number(source.rarityBias) || 0,
    forceOutRegion: Boolean(source.forceOutRegion),
  };
}

function applyRuntimeLootEvents(state, nodeId, runtime) {
  const events = runtime && Array.isArray(runtime.lootEvents) ? runtime.lootEvents.map(normalizeLootEvent) : [];
  if (!events.length) {
    return {
      state,
      dropped: [],
      consumed: false,
    };
  }

  let next = state;
  const dropped = [];
  for (const event of events) {
    const roll = rollRegionalLoot({
      sourceRegion: event.sourceRegion || nodeId,
      triggerType: event.triggerType || nodeId,
      rarityBias: event.rarityBias,
      dropChance: event.dropChance,
      outRegionChance: event.outRegionChance,
      forceOutRegion: event.forceOutRegion,
      now: Date.now(),
      seed: Date.now() + dropped.length,
    });
    if (!roll) {
      continue;
    }
    next = applyLootDrop(next, roll);
    dropped.push(roll.label);
  }

  return {
    state: next,
    dropped,
    consumed: true,
  };
}

function applyNodeRewardConsumption(state, node, action) {
  let next = state;
  const nodeId = node && node.node_id ? node.node_id : "";

  for (const rule of NODE_ARTIFACT_CONSUME_RULES) {
    if (nodeId !== rule.nodeId || action.type !== rule.actionType) {
      continue;
    }
    if (String(action.artifact || "") !== rule.artifact) {
      continue;
    }
    if (!rule.when(action)) {
      continue;
    }
    next = consumeReward(next, rule.artifact, rule.usedBy);
  }

  if (nodeId === "HUB08" && action.type === "hub08-socket-artifact") {
    const artifact = String(action.artifact || "");
    if (action.ready === true && artifact) {
      next = consumeReward(next, artifact, "HUB08");
    }
  }

  return next;
}

function isDeskUnlocked(state) {
  const solved = new Set(state && Array.isArray(state.solvedNodeIds) ? state.solvedNodeIds : []);
  return solved.has("HUB06");
}

function withMadraTick(route = getCurrentRoute()) {
  if (route !== "/cradle/madra-well") {
    return;
  }
  const ticked = tickMadraWell(appState.systems.madraWell, Date.now());
  appState = updateSystemState(appState, "madraWell", ticked);
}

function withArcaneTick() {
  const currentArcane = arcaneSystemFromState(appState, Date.now());
  const ticked = tickArcaneMana(currentArcane, Date.now());
  appState = updateSystemState(appState, "arcane", ticked);
}

function ensureDerivedRewards(state) {
  const solved = new Set(state.solvedNodeIds || []);
  if (!solved.has("HUB05")) {
    return state;
  }

  if (hasWaveOnePasskey(state)) {
    return state;
  }

  const rewards = rewardsMap(state);
  if (rewards["Wave-I Passkey"] || rewards["Wave 1 Passkey"]) {
    return state;
  }

  return grantSupplementalReward(state, "Wave-I Passkey", {
    node_id: "HUB05",
    section: "Nexus Hub",
  });
}

function ensureSelectedArtifactStillAvailable() {
  if (!selectedArtifactReward) {
    return;
  }

  const rewards = rewardsMap(appState);

  if (!rewards[selectedArtifactReward]) {
    selectedArtifactReward = "";
  }
}

function ensureSelectedLootStillAvailable() {
  const loot = lootInventoryFromState(appState, Date.now());
  if (selectedLootItemId && !loot.items[selectedLootItemId]) {
    selectedLootItemId = "";
  }
  if (!["crd", "worm", "dcc", "aa"].includes(String(selectedLootRegion || "").toLowerCase())) {
    selectedLootRegion = "crd";
  }
}

function backLinkForRoute(route) {
  if (!route || route === "/") {
    return null;
  }

  const node = blueprintIndex && blueprintIndex.nodesByRoute ? blueprintIndex.nodesByRoute.get(route) : null;
  if (node) {
    return {
      route: `/section/${sectionRouteSlug(node.section)}`,
      label: "Back to Region",
    };
  }

  const section = sectionFromRoute(route);
  if (section) {
    return {
      route: "/",
      label: "Back to Nexus",
    };
  }

  if (route === "/desk") {
    return {
      route: "/",
      label: "Back to Nexus",
    };
  }

  return null;
}

function isNexusMathSection(sectionName) {
  const name = String(sectionName || "");
  return NEXUS_MATH_SECTION_ORDER.includes(name);
}

function isNexusOuterSection(sectionName) {
  const name = String(sectionName || "");
  if (name === "Nexus Hub" || name === "Final Arc") {
    return true;
  }
  return name.startsWith("Convergence ");
}

function outerRingSort(a, b) {
  const rank = (sectionName) => {
    const name = String(sectionName || "");
    if (name === "Nexus Hub") {
      return 0;
    }
    if (name.startsWith("Convergence ")) {
      return 1;
    }
    if (name === "Final Arc") {
      return 2;
    }
    return 3;
  };
  const rankA = rank(a.section);
  const rankB = rank(b.section);
  if (rankA !== rankB) {
    return rankA - rankB;
  }
  return String(a.section).localeCompare(String(b.section));
}

function middleRingSort(a, b) {
  return String(a.section).localeCompare(String(b.section));
}

function innerRingSort(a, b) {
  const rank = (sectionName) => {
    const index = NEXUS_MATH_SECTION_ORDER.indexOf(String(sectionName || ""));
    return index >= 0 ? index : 999;
  };
  const rankA = rank(a.section);
  const rankB = rank(b.section);
  if (rankA !== rankB) {
    return rankA - rankB;
  }
  return String(a.section).localeCompare(String(b.section));
}

function buildNexusRings(sectionProgress) {
  const sections = Array.isArray(sectionProgress) ? sectionProgress : [];
  const outerSections = sections.filter((entry) => isNexusOuterSection(entry.section)).sort(outerRingSort);
  const innerSections = sections.filter((entry) => isNexusMathSection(entry.section)).sort(innerRingSort);
  const middleSections = sections
    .filter((entry) => !isNexusOuterSection(entry.section) && !isNexusMathSection(entry.section))
    .sort(middleRingSort);

  return [
    { ringKey: "outer", label: "Outer Ring", sections: outerSections },
    { ringKey: "middle", label: "Region Ring", sections: middleSections },
    { ringKey: "inner", label: "Vault Ring", sections: innerSections },
  ].filter((ring) => ring.sections.length > 0);
}

function normalizeNexusSelection() {
  if (!lastNexusRings.length) {
    nexusRingSelectionIndex = 0;
    nexusItemSelectionByRing = [];
    return;
  }

  if (nexusRingSelectionIndex < 0) {
    nexusRingSelectionIndex = lastNexusRings.length - 1;
  } else if (nexusRingSelectionIndex >= lastNexusRings.length) {
    nexusRingSelectionIndex = 0;
  }

  const nextSelections = Array.isArray(nexusItemSelectionByRing) ? nexusItemSelectionByRing.slice() : [];
  for (let ringIndex = 0; ringIndex < lastNexusRings.length; ringIndex += 1) {
    const ring = lastNexusRings[ringIndex];
    const ringSize = ring.sections.length;
    if (!ringSize) {
      nextSelections[ringIndex] = 0;
      continue;
    }

    let itemIndex = Number(nextSelections[ringIndex]);
    if (!Number.isFinite(itemIndex)) {
      itemIndex = 0;
    }

    if (itemIndex < 0) {
      itemIndex = ringSize - 1;
    } else if (itemIndex >= ringSize) {
      itemIndex = 0;
    }

    nextSelections[ringIndex] = itemIndex;
  }

  nexusItemSelectionByRing = nextSelections;
}

function cycleNexus(step) {
  if (!lastNexusRings.length) {
    return;
  }

  const ring = lastNexusRings[nexusRingSelectionIndex];
  if (!ring || !ring.sections.length) {
    return;
  }

  const currentItem = Number(nexusItemSelectionByRing[nexusRingSelectionIndex] || 0);
  nexusItemSelectionByRing[nexusRingSelectionIndex] = currentItem + step;
  normalizeNexusSelection();
}

function switchNexusRing(step) {
  if (!lastNexusRings.length) {
    return;
  }
  nexusRingSelectionIndex += step;
  normalizeNexusSelection();
}

function normalizeSectionNodeSelection() {
  if (!lastSectionNodes.length) {
    sectionNodeSelectionIndex = 0;
    return;
  }

  if (sectionNodeSelectionIndex < 0) {
    sectionNodeSelectionIndex = lastSectionNodes.length - 1;
    return;
  }

  if (sectionNodeSelectionIndex >= lastSectionNodes.length) {
    sectionNodeSelectionIndex = 0;
  }
}

function cycleSectionNodes(step) {
  if (!lastSectionNodes.length) {
    return;
  }

  sectionNodeSelectionIndex += step;
  normalizeSectionNodeSelection();
}

function openSelectedSectionNode() {
  if (!lastSectionNodes.length) {
    return;
  }

  const node = lastSectionNodes[sectionNodeSelectionIndex];
  if (!node) {
    return;
  }

  navigate(node.route);
}

function openSelectedNexusSection() {
  if (!lastNexusRings.length) {
    return;
  }

  const ring = lastNexusRings[nexusRingSelectionIndex];
  if (!ring || !ring.sections.length) {
    return;
  }

  const itemIndex = Number(nexusItemSelectionByRing[nexusRingSelectionIndex] || 0);
  const selected = ring.sections[itemIndex];
  if (!selected) {
    return;
  }

  navigate(`/section/${sectionRouteSlug(selected.section)}`);
}

function renderNotFound(route) {
  return `
    <article class="animated-fade">
      <h2>Route Not Found</h2>
      <p class="muted">${escapeHtml(route)} is not currently mapped.</p>
      <a class="button" href="#/">Return to Nexus</a>
    </article>
  `;
}

function sectionFromRoute(route) {
  if (!route.startsWith("/section/")) {
    return null;
  }

  const slug = route.slice("/section/".length);
  for (const section of blueprintIndex.sections) {
    if (sectionRouteSlug(section) === slug) {
      return section;
    }
  }

  return null;
}

function buildDeskNodePool(unlockedNodeIds) {
  return sortByDependencyDepth(
    blueprintIndex.raw.nodes.filter((node) => unlockedNodeIds.has(node.node_id)),
  ).slice(0, 80);
}

function currentActiveNodeContext() {
  if (!activeNodeContext) {
    return null;
  }

  if (getCurrentRoute() !== activeNodeContext.node.route) {
    return null;
  }

  return activeNodeContext;
}

function ensureNodeRuntime(state, node, experience) {
  return updateNodeRuntime(
    state,
    node.node_id,
    (runtime) => runtime,
    () => experience.initialState({ node, state }),
  );
}

function readNodeRuntime(state, node, experience) {
  return getNodeRuntime(state, node.node_id, () => experience.initialState({ node, state }));
}

function dispatchActiveNodeAction(action) {
  const context = currentActiveNodeContext();
  if (!context || !action) {
    return false;
  }

  const { node, experience } = context;

  withState((current) => {
    let next = current;
    let runtimeAction = action;
    if (node.node_id === "WORM02" && action.type === "worm02-start-normal") {
      const payload = Array.isArray(action.playerCards) ? action.playerCards : [];
      const bonuses = {};
      for (const entry of payload) {
        const cardId = String(entry && entry.cardId ? entry.cardId : "");
        if (!cardId) {
          continue;
        }
        bonuses[cardId] = getWormCapeLootBonuses(next, cardId, Date.now());
      }
      runtimeAction = {
        ...runtimeAction,
        capeBonusesByCardId: bonuses,
      };
    }
    const wormSystemResult = reduceWormSystemState(next.systems.worm, action, Date.now());
    if (wormSystemResult.changed) {
      next = updateSystemState(next, "worm", wormSystemResult.nextState);
      if (wormSystemResult.message) {
        setBanner(wormSystemResult.message);
      }
    }

    if (node.node_id === "CRD02" && runtimeAction.type === "crd02-equip-soul-slot") {
      const result = equipLootItem(next, {
        region: "crd",
        slotId: runtimeAction.slotId,
        itemInstanceId: runtimeAction.itemId,
      });
      if (result.changed) {
        next = result.nextState;
      }
      runtimeAction = {
        type: "crd02-loot-message",
        message: result.message,
        at: Date.now(),
      };
    }

    if (node.node_id === "CRD02" && runtimeAction.type === "crd02-unequip-soul-slot") {
      const result = unequipLootItem(next, {
        region: "crd",
        slotId: runtimeAction.slotId,
      });
      if (result.changed) {
        next = result.nextState;
      }
      runtimeAction = {
        type: "crd02-loot-message",
        message: result.message,
        at: Date.now(),
      };
    }

    if (node.node_id === "CRD02" && runtimeAction.type === "crd02-equip-combat-item") {
      const result = equipLootItem(next, {
        region: "crd",
        itemInstanceId: runtimeAction.itemId,
      });
      if (result.changed) {
        next = result.nextState;
      }
      runtimeAction = {
        type: "crd02-loot-message",
        message: result.message,
        at: Date.now(),
      };
    }

    if (node.node_id === "WORM01" && runtimeAction.type === "worm01-equip-shard") {
      const result = equipLootItem(next, {
        region: "worm",
        targetId: runtimeAction.cardId,
        slotId: runtimeAction.slotId,
        itemInstanceId: runtimeAction.itemId,
      });
      if (result.changed) {
        next = result.nextState;
      }
      runtimeAction = {
        ...runtimeAction,
        applied: result.changed,
        message: result.message,
      };
      setBanner(result.message);
    }

    if (node.node_id === "WORM01" && runtimeAction.type === "worm01-unequip-shard") {
      const result = unequipLootItem(next, {
        region: "worm",
        targetId: runtimeAction.cardId,
        slotId: runtimeAction.slotId,
      });
      if (result.changed) {
        next = result.nextState;
      }
      runtimeAction = {
        ...runtimeAction,
        applied: result.changed,
        message: result.message,
      };
      setBanner(result.message);
    }

    if (node.node_id === "TWI03" && runtimeAction.type === "twi03-fulfill-quest") {
      const requirementType = String(runtimeAction.requirementType || "");
      const amount = Math.max(0, Number(runtimeAction.amount) || 0);
      let applied = false;
      let message = "Quest requirements not met.";
      let working = next;

      if (requirementType === "madra") {
        const runtimeCrd02 = getNodeRuntime(working, "CRD02", () => ({}));
        const currentMadra = Number(runtimeCrd02 && runtimeCrd02.madra ? runtimeCrd02.madra : 0);
        if (currentMadra >= amount) {
          working = updateNodeRuntime(
            working,
            "CRD02",
            (rt) => ({
              ...(rt && typeof rt === "object" ? rt : {}),
              madra: Math.max(0, Number((currentMadra - amount).toFixed(2))),
            }),
            () => ({ madra: 0 }),
          );
          applied = true;
        }
      } else if (requirementType === "clout") {
        const clout = Number(working.systems && working.systems.worm ? working.systems.worm.clout : 0);
        if (clout >= amount) {
          working = updateSystemState(working, "worm", {
            ...(working.systems.worm || {}),
            clout: Number((clout - amount).toFixed(2)),
          });
          applied = true;
        }
      } else if (requirementType === "gold") {
        const dccRuntime = getNodeRuntime(working, "DCC01", () => ({}));
        const meta = dccRuntime && dccRuntime.meta && typeof dccRuntime.meta === "object" ? dccRuntime.meta : {};
        const gold = Number(meta.gold || 0);
        if (gold >= amount) {
          working = updateNodeRuntime(
            working,
            "DCC01",
            (rt) => ({
              ...(rt && typeof rt === "object" ? rt : {}),
              meta: {
                ...meta,
                gold: Math.max(0, Math.floor(gold - amount)),
              },
            }),
            () => ({ meta: { gold: 0 } }),
          );
          applied = true;
        }
      } else if (requirementType === "sacrifice_int") {
        const selectedCardId = String(runtimeAction.sacrificeCardId || "");
        const selectedCard = selectedCardId ? wormCardById(selectedCardId) : null;
        const validInt = selectedCard && Number(selectedCard.info || 0) > 5;
        if (!validInt) {
          applied = false;
        } else {
          const sacrifice = reduceWormSystemState(
            working.systems.worm,
            {
              type: "worm-sacrifice-cape",
              cardId: runtimeAction.sacrificeCardId,
            },
            Date.now(),
          );
          if (sacrifice.changed) {
            working = updateSystemState(working, "worm", sacrifice.nextState);
            applied = true;
          }
        }
      }

      if (applied) {
        const baseRepReward = Math.max(1, Number(runtimeAction.repReward) || 0);
        const finalRepReward = requirementType === "sacrifice_int" ? Math.max(baseRepReward * 3, baseRepReward + 10) : baseRepReward;
        working = addTwiReputation(working, finalRepReward);
        const lootState = lootInventoryFromState(working, Date.now());
        message = `Quest fulfilled. +${finalRepReward} Inn Reputation.`;
        runtimeAction = {
          ...runtimeAction,
          applied: true,
          innTier: Number(lootState.progression && lootState.progression.innTier ? lootState.progression.innTier : 0),
          lootEligible: true,
          message,
        };
        next = working;
      } else {
        runtimeAction = {
          ...runtimeAction,
          applied: false,
          message,
        };
      }
      setBanner(runtimeAction.message);
    }

    if (node.node_id === "TWI03" && runtimeAction.type === "twi03-cancel-quest") {
      const penalty = 2;
      const spend = spendTwiReputation(next, penalty);
      if (spend.changed) {
        next = spend.nextState;
      }
      const loot = lootInventoryFromState(next, Date.now());
      runtimeAction = {
        ...runtimeAction,
        innTier: Number(loot.progression && loot.progression.innTier ? loot.progression.innTier : 0),
        message: spend.changed
          ? `Quest canceled. -${penalty} Inn Reputation.`
          : "Quest canceled. No reputation lost.",
      };
      setBanner(runtimeAction.message);
    }

    if (node.node_id === "TWI04" && runtimeAction.type === "twi04-buy-upgrade") {
      const purchase = applyTwiUpgradePurchase(
        next,
        runtimeAction.upgradeId,
        runtimeAction.cost,
        runtimeAction.tierGain,
      );
      if (purchase.changed) {
        next = purchase.nextState;
      }
      runtimeAction = {
        ...runtimeAction,
        applied: purchase.changed,
        message: purchase.message,
      };
      setBanner(purchase.message);
    }

    if (node.node_id === "AA01" && runtimeAction.type === "aa01-claim-attunement") {
      const reward = Math.max(12, Number(runtimeAction.manaCrystalReward) || 0);
      let working = awardManaCrystals(next, reward);
      working = setEnchanterAttunement(working, true);
      next = working;
      runtimeAction = {
        ...runtimeAction,
        applied: true,
        manaCrystalReward: reward,
        message: `Judgment complete. Enchanter attunement bound. +${reward} mana crystals.`,
      };
      setBanner(runtimeAction.message);
    }

    if (node.node_id === "AA02" && runtimeAction.type === "aa02-buy-offer") {
      const cost = Math.max(1, Number(runtimeAction.cost) || 1);
      const spend = spendManaCrystals(next, cost);
      if (spend.changed && runtimeAction.lootDrop && typeof runtimeAction.lootDrop === "object") {
        next = applyLootDrop(spend.nextState, runtimeAction.lootDrop);
        runtimeAction = {
          ...runtimeAction,
          applied: true,
          message: `Purchased ${runtimeAction.lootDrop.label} for ${cost} mana crystals.`,
        };
      } else {
        runtimeAction = {
          ...runtimeAction,
          applied: false,
          message: spend.message || "Purchase failed.",
        };
      }
      setBanner(runtimeAction.message);
    }

    if (node.node_id === "AA02" && runtimeAction.type === "aa02-sell-selected") {
      const itemId = String(runtimeAction.itemId || "");
      if (!itemId) {
        runtimeAction = {
          ...runtimeAction,
          applied: false,
          message: "Select an item to sell.",
        };
      } else if (isLootItemEquipped(next, itemId)) {
        runtimeAction = {
          ...runtimeAction,
          applied: false,
          message: "Cannot sell an equipped loot item.",
        };
      } else {
        const loot = lootInventoryFromState(next, Date.now());
        const item = loot.items[itemId];
        if (!item) {
          runtimeAction = {
            ...runtimeAction,
            applied: false,
            message: "Loot item not found.",
          };
        } else {
          const arcane = arcaneSystemFromState(next, Date.now());
          const basePrice = estimateLootShopPrice(item, {
            totalSpentAtCourt: arcane.totalSpentAtCourt,
            buyDiscountPct: arcane.bonuses.buyDiscountPct,
            shopRegion: "aa",
          });
          const payout = Math.max(
            1,
            Math.floor(basePrice * 0.75 * (1 + Math.max(0, Number(arcane.bonuses.sellBonusPct) || 0))),
          );
          const removed = removeLootItemInstance(next, itemId, 1);
          if (removed.changed) {
            next = awardManaCrystals(removed.nextState, payout);
            runtimeAction = {
              ...runtimeAction,
              applied: true,
              message: `Sold ${item.label} for ${payout} mana crystals.`,
            };
          } else {
            runtimeAction = {
              ...runtimeAction,
              applied: false,
              message: removed.message || "Sale failed.",
            };
          }
        }
      }
      setBanner(runtimeAction.message);
    }

    if (node.node_id === "AA02" && runtimeAction.type === "aa02-tome-starter") {
      const grant = grantStarterGlyphs(next, Date.now());
      if (grant.changed) {
        next = grant.nextState;
      }
      runtimeAction = {
        ...runtimeAction,
        applied: grant.changed,
        message: grant.message,
        grants: Array.isArray(grant.grants) ? grant.grants : [],
        routeVisitNonce,
      };
      setBanner(runtimeAction.message);
    }

    if (node.node_id === "AA02" && runtimeAction.type === "aa02-tome-pull") {
      const pull = pullGlyphFromTome(next, Date.now());
      if (pull.changed) {
        next = pull.nextState;
      }
      runtimeAction = {
        ...runtimeAction,
        applied: pull.changed,
        message: pull.message,
        grant: pull.grant || "",
        grantType: pull.grantType || "",
        grants: pull.grant ? [pull.grant] : [],
        routeVisitNonce,
      };
      setBanner(runtimeAction.message);
    }

    if (node.node_id === "AA03" && runtimeAction.type === "aa03-submit-region-rune") {
      const strokePoints = Array.isArray(runtimeAction.strokePoints) ? runtimeAction.strokePoints : [];
      if (strokePoints.length < 3) {
        runtimeAction = {
          ...runtimeAction,
          applied: false,
          message: "Draw the region rune before submitting.",
        };
      } else {
        const arcane = arcaneSystemFromState(next, Date.now());
        const match = matchRuneAgainstGrimoire({
          strokePoints,
          glyphType: "region",
          ownedGlyphs: arcane.grimoire.regionGlyphs,
        });
        runtimeAction = {
          ...runtimeAction,
          applied: Boolean(match.bestMatch),
          strokePoints,
          regionMatch: match.bestMatch ? match : null,
          message: match.bestMatch
            ? `Region rune resolved as ${match.bestMatch}.`
            : match.insufficientStroke
              ? "Rune trace too sparse. Draw a fuller region rune."
              : "No learned region glyphs are available to match.",
        };
      }
      setBanner(runtimeAction.message);
    }

    if (node.node_id === "AA03" && runtimeAction.type === "aa03-submit-enhancement-rune") {
      const strokePoints = Array.isArray(runtimeAction.strokePoints) ? runtimeAction.strokePoints : [];
      if (strokePoints.length < 3) {
        runtimeAction = {
          ...runtimeAction,
          applied: false,
          message: "Draw the enhancement rune before submitting.",
        };
      } else {
        const currentRuntime = readNodeRuntime(next, node, experience);
        const hasRegionMatch = Boolean(
          currentRuntime &&
            currentRuntime.regionMatch &&
            typeof currentRuntime.regionMatch === "object" &&
            String(currentRuntime.regionMatch.bestMatch || ""),
        );
        const regionAccuracy = Number(
          currentRuntime &&
            currentRuntime.regionMatch &&
            currentRuntime.regionMatch.accuracyScore
            ? currentRuntime.regionMatch.accuracyScore
            : 0,
        );
        if (!hasRegionMatch) {
          runtimeAction = {
            ...runtimeAction,
            applied: false,
            message: "Submit a region rune first.",
          };
        } else {
          const arcane = arcaneSystemFromState(next, Date.now());
          const aaModifiers = getArcaneLootModifiers(next, Date.now());
          const match = matchRuneAgainstGrimoire({
            strokePoints,
            glyphType: "enhancement",
            ownedGlyphs: arcane.grimoire.enhancementGlyphs,
          });
          if (!match.bestMatch) {
            runtimeAction = {
              ...runtimeAction,
              applied: false,
              message: match.insufficientStroke
                ? "Rune trace too sparse. Draw a fuller enhancement rune."
                : "No learned enhancement glyphs are available to match.",
            };
          } else {
            const trueAccuracy = Math.min(1, Math.max(0, ((regionAccuracy + match.accuracyScore) / 2) + (aaModifiers.accuracyFlat * 0.01)));
            const estimate = estimateAppraisal({
              trueAccuracy,
              totalCrafts: Number(arcane.crafting && arcane.crafting.totalCrafts ? arcane.crafting.totalCrafts : 0),
              seed: Date.now(),
            });
            runtimeAction = {
              ...runtimeAction,
              applied: true,
              strokePoints,
              enhancementMatch: match,
              trueAccuracy,
              estimatedAccuracy: estimate.estimatedAccuracy,
              message: `Enhancement rune resolved as ${match.bestMatch}.`,
            };
          }
        }
      }
      setBanner(runtimeAction.message);
    }

    if (node.node_id === "AA03" && runtimeAction.type === "aa03-craft-item") {
      const manaInvest = Math.floor(Number(runtimeAction.mana) || 0);
      const currentRuntime = readNodeRuntime(next, node, experience);
      const regionGlyph = String(currentRuntime.regionMatch && currentRuntime.regionMatch.bestMatch ? currentRuntime.regionMatch.bestMatch : "");
      const enhancementGlyph = String(currentRuntime.enhancementMatch && currentRuntime.enhancementMatch.bestMatch ? currentRuntime.enhancementMatch.bestMatch : "");
      const trueAccuracy = Math.max(0, Math.min(1, Number(currentRuntime.trueAccuracy) || 0));
      if (!regionGlyph || !enhancementGlyph) {
        runtimeAction = {
          ...runtimeAction,
          applied: false,
          message: "Complete both rune submissions before crafting.",
        };
      } else if (manaInvest < 1) {
        runtimeAction = {
          ...runtimeAction,
          applied: false,
          message: "Enter a valid mana investment before crafting.",
        };
      } else {
        const spend = consumeWorkshopMana(next, manaInvest, Date.now());
        if (!spend.changed) {
          runtimeAction = {
            ...runtimeAction,
            applied: false,
            message: spend.message || "Not enough workshop mana.",
          };
        } else {
          let working = spend.nextState;
          const arcane = arcaneSystemFromState(working, Date.now());
          const aaModifiers = getArcaneLootModifiers(working, Date.now());
          const outcome = resolveWorkshopCraftOutcome({
            regionGlyph,
            enhancementGlyph,
            accuracy: Math.min(1, Math.max(0, trueAccuracy + (aaModifiers.accuracyFlat * 0.005))),
            manaInvested: manaInvest,
            manaMax: Number(arcane.workshop && arcane.workshop.manaMax ? arcane.workshop.manaMax : 100),
            totalCrafts: Number(arcane.crafting && arcane.crafting.totalCrafts ? arcane.crafting.totalCrafts : 0),
            seed: Date.now(),
          });
          let craftedDrop = null;
          if (outcome.isJunk) {
            craftedDrop = {
              templateId: "aa_junk_fragment",
              label: "Junk Enchantment Fragment (Common)",
              region: "aa",
              rarity: "common",
              kind: "aa_junk",
              stackable: true,
              effects: [],
              sourceRegion: "aa",
              triggerType: "aa03-craft-junk",
              outOfRegion: false,
              createdAt: Date.now(),
              durationMs: 0,
            };
          } else {
            const rolled = rollRegionalLoot({
              sourceRegion: outcome.regionGlyph || "aa",
              triggerType: "aa03-craft",
              dropChance: 1,
              outRegionChance: 0,
              forceOutRegion: false,
              rarityBias: outcome.rarityBias,
              now: Date.now(),
              seed: Date.now(),
            });
            craftedDrop = rolled || {
              templateId: "aa_focus_charm",
              label: "Glyphwork Focus Charm (Rare)",
              region: "aa",
              rarity: "rare",
              kind: "aa_focus",
              stackable: false,
              effects: [{ key: "aa_accuracy_flat", type: "flat", value: 3 }],
              sourceRegion: "aa",
              triggerType: "aa03-craft-fallback",
              outOfRegion: false,
              createdAt: Date.now(),
              durationMs: 0,
            };
            const descriptor = outcome.descriptor || null;
            if (descriptor && descriptor.key && craftedDrop.region === "aa") {
              const boost = Math.max(0.01, Number(descriptor.base || 0) * Number(outcome.powerScalar || 1));
              craftedDrop = {
                ...craftedDrop,
                label: `${aaEnhancementPrefix(enhancementGlyph)} ${craftedDrop.label}`,
                effects: [
                  ...(Array.isArray(craftedDrop.effects) ? craftedDrop.effects : []),
                  {
                    key: descriptor.key,
                    type: descriptor.type || "flat",
                    value: Number(boost.toFixed(4)),
                  },
                ],
              };
            } else if (craftedDrop && typeof craftedDrop === "object" && !outcome.isJunk) {
              craftedDrop = {
                ...craftedDrop,
                label: `${aaEnhancementPrefix(enhancementGlyph)} ${craftedDrop.label}`,
              };
            }
          }

          working = applyLootDrop(working, craftedDrop);
          working = recordWorkshopCraftResult(working, {
            success: true,
            junk: outcome.isJunk,
            resultSummary: {
              label: craftedDrop.label,
              junk: outcome.isJunk,
              region: craftedDrop.region,
              rarity: craftedDrop.rarity,
            },
          });
          next = working;
          runtimeAction = {
            ...runtimeAction,
            applied: true,
            nonJunk: !outcome.isJunk,
            outcome: {
              label: craftedDrop.label,
              junk: outcome.isJunk,
              region: craftedDrop.region,
              rarity: craftedDrop.rarity,
            },
            message: outcome.isJunk
              ? "Craft complete: unstable junk fragment produced."
              : `Craft complete: ${craftedDrop.label}.`,
          };
        }
      }
      setBanner(runtimeAction.message);
    }

    if (node.node_id === "AA03" && runtimeAction.type === "aa03-spend-mana") {
      next = applyArcaneManaSpendProgress(next, Math.max(0, Number(runtimeAction.amount) || 0));
    }
    next = applyNodeRewardConsumption(next, node, action);

    if (node.node_id === "HUB08" && action.type === "hub08-infuse-madra") {
      const cost = 3;
      const crd02Runtime = getNodeRuntime(next, "CRD02", () => ({}));
      const currentMadra = Math.max(
        0,
        Number(crd02Runtime && typeof crd02Runtime === "object" ? crd02Runtime.madra : 0) || 0,
      );

      if (currentMadra >= cost) {
        const remainingMadra = Number((currentMadra - cost).toFixed(2));
        next = updateNodeRuntime(
          next,
          "CRD02",
          (runtime) => ({
            ...(runtime && typeof runtime === "object" ? runtime : {}),
            madra: remainingMadra,
          }),
          () => ({ madra: 0 }),
        );
        runtimeAction = {
          ...action,
          applied: true,
          message: `${cost} Madra offered to the orb.`,
        };
      } else {
        runtimeAction = {
          ...action,
          applied: false,
          message: `Need ${cost} Madra.`,
        };
      }
    }

    if (node.node_id === "HUB08" && action.type === "hub08-sacrifice-cape") {
      const sacrificeResult = reduceWormSystemState(
        next.systems.worm,
        {
          type: "worm-sacrifice-cape",
          cardId: action.cardId,
        },
        Date.now(),
      );
      if (sacrificeResult.changed) {
        next = updateSystemState(next, "worm", sacrificeResult.nextState);
      }
      runtimeAction = {
        ...action,
        applied: sacrificeResult.changed,
        message: sacrificeResult.message,
      };
    }

    if (node.node_id === "PGE01" && action.type === "pge01-claim-role") {
      const roleArtifact = String(action.roleArtifact || "");
      if (roleArtifact) {
        next = grantPracticalGuideRoleArtifact(next, roleArtifact, "PGE01");
      }
    }

    if (isPgeStoryNode(node.node_id) && action.type === "pge-dev-grant-artifacts") {
      const artifacts = parseArtifactList(action.artifacts);
      for (const artifact of artifacts) {
        next = grantSupplementalReward(next, artifact, node);
      }
      if (artifacts.length) {
        setBanner(`Granted ${artifacts.length} test artifact${artifacts.length === 1 ? "" : "s"} for ${node.node_id}.`);
      }
    }

    if (node.node_id === "MOL02" && action.type === "mol02-finalize-reset") {
      const regionId = String(action.regionId || "").trim().toLowerCase();
      const resetResult = regionId === "practical-guide"
        ? applyPracticalGuideRoleReset(next)
        : applyPrestigeReset(next, action.regionId, Date.now());
      if (resetResult.applied) {
        next = resetResult.nextState;
      }
      runtimeAction = {
        ...action,
        applied: resetResult.applied,
        message: resetResult.message,
        chargedCost: resetResult.cost || 0,
        awardedPointLabel: resetResult.pointLabel || "",
      };
      setBanner(resetResult.message);
    }

    if (node.node_id === "MOL03" && action.type === "mol03-buy-upgrade") {
      const purchaseResult = applyPrestigeUpgradePurchase(next, action.regionId, action.upgradeId);
      if (purchaseResult.applied) {
        next = purchaseResult.nextState;
      }
      runtimeAction = {
        ...action,
        applied: purchaseResult.applied,
        message: purchaseResult.message,
      };
      setBanner(purchaseResult.message);
    }

    const runtimeState = next;
    next = updateNodeRuntime(
      runtimeState,
      node.node_id,
      (runtime) => experience.reduceRuntime(runtime, runtimeAction, {
        now: Date.now(),
        node,
        state: runtimeState,
        runtime,
        selectedArtifactReward,
        selectedLootItemId,
        routeVisitNonce,
      }),
      () => experience.initialState({ node, state: runtimeState }),
    );

    const runtime = readNodeRuntime(next, node, experience);

    const lootResolution = applyRuntimeLootEvents(next, node.node_id, runtime);
    if (lootResolution.consumed) {
      next = lootResolution.state;
      next = updateNodeRuntime(
        next,
        node.node_id,
        (currentRuntime) => ({
          ...(currentRuntime && typeof currentRuntime === "object" ? currentRuntime : {}),
          lootEvents: [],
        }),
        () => experience.initialState({ node, state: next }),
      );
      if (lootResolution.dropped.length) {
        setBanner(`Loot recovered: ${lootResolution.dropped.join(", ")}.`);
      }
    }

    if (isPgeStoryNode(node.node_id) && runtime && Array.isArray(runtime.pendingRewards) && runtime.pendingRewards.length) {
      const rewardsToGrant = parseArtifactList(runtime.pendingRewards);
      for (const reward of rewardsToGrant) {
        next = grantSupplementalReward(next, reward, node);
      }
      next = updateNodeRuntime(
        next,
        node.node_id,
        (currentRuntime) => ({
          ...(currentRuntime && typeof currentRuntime === "object" ? currentRuntime : {}),
          pendingRewards: [],
        }),
        () => experience.initialState({ node, state: next }),
      );
      if (rewardsToGrant.length) {
        setBanner(`Recovered ${rewardsToGrant.join(", ")}.`);
      }
    }

    const runtimeAfterRewards = readNodeRuntime(next, node, experience);
    const solvedNow =
      typeof experience.validateRuntime === "function"
        ? Boolean(experience.validateRuntime(runtimeAfterRewards))
        : Boolean(runtimeAfterRewards && runtimeAfterRewards.solved);
    const solvedBefore = (next.solvedNodeIds || []).includes(node.node_id);

    if (solvedNow && !solvedBefore) {
      next = applyNodeSolveSystemOverrides(markNodeSolvedWithOverrides(next, node), node);
      let bonusReward = "";
      if (node.node_id === "CRD04") {
        next = grantSupplementalReward(next, "Suriel's Marble", node);
        bonusReward = `${bonusReward} + Suriel's Marble`;
      }
      if (MATH_VAULT_PGE_ARTIFACT_PLACEMENTS[node.node_id]) {
        const artifact = MATH_VAULT_PGE_ARTIFACT_PLACEMENTS[node.node_id];
        next = grantSupplementalReward(next, artifact, node);
        bonusReward = `${bonusReward} + ${artifact}`;
      }

      setBanner(`${node.node_id} solved. Reward added: ${solveRewardLabel(node)}${bonusReward}.`);
    }

    return next;
  });

  renderApp();
  return true;
}

function handleNodeActionClick(target) {
  const context = currentActiveNodeContext();
  if (!context) {
    return false;
  }

  if (target.getAttribute("data-node-id") !== context.node.node_id) {
    return false;
  }

  if (typeof context.experience.buildActionFromElement !== "function") {
    return false;
  }

  const runtime = readNodeRuntime(appState, context.node, context.experience);
  const action = context.experience.buildActionFromElement(target, runtime);
  if (!action) {
    return false;
  }

  return dispatchActiveNodeAction(action);
}

function clearHub08OrbHoldSession({ resetVisual = true } = {}) {
  const session = hub08OrbHoldSession;
  if (session.rafId) {
    window.cancelAnimationFrame(session.rafId);
  }

  const button = session.button;
  if (button && button.isConnected) {
    if (resetVisual) {
      button.classList.remove("is-charging");
      button.style.setProperty("--hub08-orb-charge", "0");
    }

    if (
      session.pointerId !== null &&
      typeof button.hasPointerCapture === "function" &&
      typeof button.releasePointerCapture === "function"
    ) {
      try {
        if (button.hasPointerCapture(session.pointerId)) {
          button.releasePointerCapture(session.pointerId);
        }
      } catch (_error) {
        // Ignore pointer capture release failures.
      }
    }
  }

  hub08OrbHoldSession = {
    pointerId: null,
    button: null,
    startAt: 0,
    rafId: 0,
    completed: false,
  };
}

function startHub08OrbHold(button, pointerId) {
  clearHub08OrbHoldSession();
  const startAt = typeof performance !== "undefined" ? performance.now() : Date.now();

  hub08OrbHoldSession = {
    pointerId,
    button,
    startAt,
    rafId: 0,
    completed: false,
  };

  button.classList.add("is-charging");
  button.style.setProperty("--hub08-orb-charge", "0");

  if (typeof button.setPointerCapture === "function") {
    try {
      button.setPointerCapture(pointerId);
    } catch (_error) {
      // Ignore pointer capture acquisition failures.
    }
  }

  const tick = (timestamp) => {
    const session = hub08OrbHoldSession;
    if (session.button !== button || session.completed) {
      return;
    }

    const now = Number.isFinite(timestamp)
      ? timestamp
      : typeof performance !== "undefined"
        ? performance.now()
        : Date.now();
    const progress = Math.min(1, Math.max(0, (now - session.startAt) / HUB08_ORB_HOLD_MS));
    button.style.setProperty("--hub08-orb-charge", progress.toFixed(3));

    if (progress >= 1) {
      session.completed = true;
      button.classList.remove("is-charging");
      button.style.setProperty("--hub08-orb-charge", "1");
      const action = {
        type: "hub08-infuse-madra",
        ready: button.getAttribute("data-ready") === "true",
        at: Date.now(),
      };
      dispatchActiveNodeAction(action);
      clearHub08OrbHoldSession({ resetVisual: false });
      return;
    }

    session.rafId = window.requestAnimationFrame(tick);
  };

  hub08OrbHoldSession.rafId = window.requestAnimationFrame(tick);
}

function handlePointerDown(event) {
  const context = currentActiveNodeContext();
  if (!context) {
    return;
  }

  if (context.node.node_id === "HUB08") {
    const target = event.target instanceof Element ? event.target.closest("[data-hub08-orb]") : null;
    if (!target) {
      return;
    }

    if (target instanceof HTMLButtonElement && target.disabled) {
      return;
    }

    event.preventDefault();
    startHub08OrbHold(target, event.pointerId);
    return;
  }

  if (context.node.node_id !== "AA03") {
    return;
  }

  const canvas = event.target instanceof Element ? event.target.closest("[data-aa03-canvas='true']") : null;
  if (!(canvas instanceof HTMLCanvasElement)) {
    return;
  }
  clearAa03PointerSession();
  const existing = parseAa03CanvasPath(canvas.getAttribute("data-aa03-path"));
  const point = pointFromCanvasEvent(canvas, event);
  const points = [...existing, point];
  canvas.setAttribute("data-aa03-path", JSON.stringify(points));
  aa03PointerSession = {
    pointerId: event.pointerId,
    canvas,
    kind: String(canvas.getAttribute("data-aa03-canvas-kind") || ""),
    points,
  };
  if (typeof canvas.setPointerCapture === "function") {
    try {
      canvas.setPointerCapture(event.pointerId);
    } catch (_error) {
      // ignore pointer capture acquisition failures
    }
  }
  event.preventDefault();
}

function handlePointerMove(event) {
  if (aa03PointerSession.pointerId === null) {
    return;
  }
  if (event.pointerId !== aa03PointerSession.pointerId) {
    return;
  }
  const canvas = aa03PointerSession.canvas;
  if (!(canvas instanceof HTMLCanvasElement) || !canvas.isConnected) {
    clearAa03PointerSession();
    return;
  }
  const nextPoint = pointFromCanvasEvent(canvas, event);
  const points = aa03PointerSession.points;
  const previous = points.length ? points[points.length - 1] : nextPoint;
  drawAa03Segment(canvas, previous, nextPoint);
  points.push(nextPoint);
  aa03PointerSession.points = points;
  canvas.setAttribute("data-aa03-path", JSON.stringify(points));
  event.preventDefault();
}

function handlePointerEnd(event) {
  if (aa03PointerSession.pointerId !== null && event.pointerId === aa03PointerSession.pointerId) {
    clearAa03PointerSession();
  }

  if (hub08OrbHoldSession.pointerId === null) {
    return;
  }

  if (typeof event.pointerId === "number" && event.pointerId !== hub08OrbHoldSession.pointerId) {
    return;
  }

  if (!hub08OrbHoldSession.completed) {
    clearHub08OrbHoldSession();
  }
}

function handleNodeKeyDown(event) {
  const context = currentActiveNodeContext();
  if (!context || typeof context.experience.buildKeyAction !== "function") {
    return false;
  }

  const isRhythmNode = context.node.node_id === "CRD01" || context.node.node_id === "CRD02";
  const isSpace = event.code === "Space" || event.key === " ";
  if (isRhythmNode && isSpace) {
    event.preventDefault();
  }

  const runtime = readNodeRuntime(appState, context.node, context.experience);
  const action = context.experience.buildKeyAction(event, runtime);
  if (!action) {
    return false;
  }

  event.preventDefault();
  return dispatchActiveNodeAction(action);
}

function handleNodeWheel(event) {
  const context = currentActiveNodeContext();
  if (!context || typeof context.experience.buildWheelAction !== "function") {
    return false;
  }

  const runtime = readNodeRuntime(appState, context.node, context.experience);
  const action = context.experience.buildWheelAction(event, runtime);
  if (!action) {
    return false;
  }

  event.preventDefault();
  return dispatchActiveNodeAction(action);
}

function handleDragStart(event) {
  const context = currentActiveNodeContext();
  if (!context) {
    return;
  }

  const source = event.target instanceof Element ? event.target.closest("[data-node-piece]") : null;
  if (!source) {
    return;
  }

  if (source.getAttribute("data-node-id") !== context.node.node_id) {
    return;
  }

  const pieceId = source.getAttribute("data-piece-id");
  if (!pieceId || !event.dataTransfer) {
    return;
  }

  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", pieceId);
  event.dataTransfer.setData("application/x-nexus-piece-id", pieceId);
  source.classList.add("is-dragging");
}

function handleDragOver(event) {
  const context = currentActiveNodeContext();
  if (!context || typeof context.experience.buildDropAction !== "function") {
    return;
  }

  const dropZone = event.target instanceof Element ? event.target.closest("[data-node-dropzone]") : null;
  if (!dropZone) {
    return;
  }

  if (dropZone.getAttribute("data-node-id") !== context.node.node_id) {
    return;
  }

  event.preventDefault();
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = "move";
  }
}

function clearDraggingStyles() {
  root.querySelectorAll(".is-dragging").forEach((element) => {
    element.classList.remove("is-dragging");
  });
}

function handleDrop(event) {
  const context = currentActiveNodeContext();
  if (!context || typeof context.experience.buildDropAction !== "function") {
    return;
  }

  const dropZone = event.target instanceof Element ? event.target.closest("[data-node-dropzone]") : null;
  if (!dropZone) {
    clearDraggingStyles();
    return;
  }

  if (dropZone.getAttribute("data-node-id") !== context.node.node_id) {
    clearDraggingStyles();
    return;
  }

  const transfer = event.dataTransfer;
  if (!transfer) {
    clearDraggingStyles();
    return;
  }

  const pieceId =
    transfer.getData("application/x-nexus-piece-id") || transfer.getData("text/plain");
  if (!pieceId) {
    clearDraggingStyles();
    return;
  }

  const rect = dropZone.getBoundingClientRect();
  if (!rect.width || !rect.height) {
    clearDraggingStyles();
    return;
  }

  const xPercent = ((event.clientX - rect.left) / rect.width) * 100;
  const yPercent = ((event.clientY - rect.top) / rect.height) * 100;
  const runtime = readNodeRuntime(appState, context.node, context.experience);
  const action = context.experience.buildDropAction({
    pieceId,
    xPercent,
    yPercent,
  }, runtime);

  event.preventDefault();
  clearDraggingStyles();

  if (action) {
    dispatchActiveNodeAction(action);
  }
}

function handleDragEnd() {
  clearDraggingStyles();
}

function contentForRoute(route, unlockedNodeIds, solvedSet, sectionProgress) {
  activeNodeContext = null;
  const deskUnlocked = isDeskUnlocked(appState);

  if (route === "/") {
    lastSectionNodes = [];
    sectionNodeSelectionIndex = 0;
    return {
      html: renderNexusView({
        rings: lastNexusRings,
        selectedRingIndex: nexusRingSelectionIndex,
        selectedItemIndices: nexusItemSelectionByRing,
        state: appState,
        selectedArtifactReward,
      }),
    };
  }

  if (route === "/desk") {
    if (!deskUnlocked) {
      return {
        html: `
          <article class="animated-fade">
            <h2>Desk Unanchored</h2>
            <p class="muted">Anchor the Correspondence Desk in HUB06 before this route becomes available.</p>
          </article>
        `,
      };
    }

    const pool = buildDeskNodePool(unlockedNodeIds);
    if (!deskFocusNodeId && pool[0]) {
      deskFocusNodeId = pool[0].node_id;
    }

    return {
      html: renderDesk({
        unlockedNodes: pool,
        selectedNodeId: deskFocusNodeId,
        hintLevels: appState.hintLevels,
      }),
    };
  }

  const section = sectionFromRoute(route);
  if (section) {
    const nodes = blueprintIndex.sectionNodes.get(section) || [];
    lastSectionNodes = nodes;
    normalizeSectionNodeSelection();

    return {
      html: renderRegionHub({
        section,
        nodes,
        solvedSet,
        unlockedNodeIds,
        selectedIndex: sectionNodeSelectionIndex,
        state: appState,
      }),
    };
  }

  lastSectionNodes = [];
  sectionNodeSelectionIndex = 0;

  const node = blueprintIndex.nodesByRoute.get(route);
  if (node) {
    appState = markNodeSeen(appState, node.node_id);

    const customExperience = getNodeExperience(node.node_id);
    if (customExperience) {
      appState = ensureNodeRuntime(appState, node, customExperience);
      if (typeof customExperience.synchronizeRuntime === "function") {
        appState = updateNodeRuntime(
          appState,
          node.node_id,
          (runtime) =>
            customExperience.synchronizeRuntime(runtime, {
              now: Date.now(),
              node,
              state: appState,
              selectedArtifactReward,
              selectedLootItemId,
              routeVisitNonce,
            }),
          () => customExperience.initialState({ node, state: appState }),
        );
      }
      const runtime = readNodeRuntime(appState, node, customExperience);
      const templateSpec = templateSpecByNode(node);

      activeNodeContext = {
        node,
        experience: customExperience,
      };

      return {
        html: customExperience.render({
          node,
          state: appState,
          selectedArtifactReward,
          selectedLootItemId,
          artifactPanelOpen: Boolean(widgetState.artifacts),
          runtime,
          templateSpec,
          solved: solvedSet.has(node.node_id),
        }),
      };
    }

    const canonical = canonicalTemplateName(node);
    const renderer = getTemplateRenderer(canonical);
    const templateSpec = templateSpecByNode(node);
    return {
      html: renderer({
        node,
        state: appState,
        templateSpec,
        solved: solvedSet.has(node.node_id),
      }),
    };
  }

  return {
    html: renderNotFound(route),
  };
}

function renderApp(route = getCurrentRoute()) {
  if (!blueprintIndex) {
    return;
  }
  if (hub08OrbHoldSession.pointerId !== null) {
    clearHub08OrbHoldSession();
  }
  if (aa03PointerSession.pointerId !== null) {
    clearAa03PointerSession();
  }

  withMadraTick(route);
  withArcaneTick();
  appState = ensureDerivedRewards(appState);
  ensureSelectedArtifactStillAvailable();
  ensureSelectedLootStillAvailable();

  const unlockedNodeIds = computeUnlockedNodeIds(blueprintIndex, appState);
  const solvedSet = new Set(appState.solvedNodeIds || []);
  const sectionProgress = computeSectionProgress(blueprintIndex, appState, unlockedNodeIds);
  const visibleNexusSections = sectionProgress.filter((section) => section.unlocked > 0);
  const nexusRings = buildNexusRings(visibleNexusSections);
  const frontier = frontierNodes(blueprintIndex, appState, unlockedNodeIds, 12);

  lastNexusRings = nexusRings;
  normalizeNexusSelection();

  const content = contentForRoute(route, unlockedNodeIds, solvedSet, visibleNexusSections);
  const activeRouteNode = blueprintIndex.nodesByRoute.get(route) || null;
  const activeRouteNodeId = activeRouteNode ? activeRouteNode.node_id : "";
  const activeRouteNodeSolved = activeRouteNode ? solvedSet.has(activeRouteNode.node_id) : false;
  const backLink = backLinkForRoute(route);

  root.innerHTML = renderShellLayout({
    summary: blueprintIndex.summary,
    state: appState,
    selectedArtifactReward,
    selectedLootItemId,
    selectedLootRegion,
    deskUnlocked: isDeskUnlocked(appState),
    backRoute: backLink ? backLink.route : "",
    backLabel: backLink ? backLink.label : "",
    frontierNodes: frontier,
    contentHtml: content.html,
    widgetState,
    currentRoute: route,
    activeNodeId: activeRouteNodeId,
    activeNodeSolved: activeRouteNodeSolved,
  });

  root.querySelectorAll("[data-aa03-canvas='true']").forEach((element) => {
    if (!(element instanceof HTMLCanvasElement)) {
      return;
    }
    resetAa03Canvas(element);
  });

  bannerMessage = "";
  saveState(appState);
}

function downloadSaveFile() {
  const text = serializeStateForSave(appState);
  const blob = new Blob([text], { type: "application/json" });
  const url = window.URL.createObjectURL(blob);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `nexus-save-${stamp}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
}

function handleClick(event) {
  const nodeActionTarget = event.target instanceof Element ? event.target.closest("[data-node-action]") : null;
  if (nodeActionTarget && handleNodeActionClick(nodeActionTarget)) {
    return;
  }

  if (!(event.target instanceof Element)) {
    return;
  }

  const button = event.target.closest("[data-action]");
  if (!button) {
    return;
  }

  const action = button.getAttribute("data-action");

  if (action === "go-home") {
    navigate("/");
    return;
  }

  if (action === "go-back") {
    const route = button.getAttribute("data-route");
    if (route) {
      navigate(route);
    }
    return;
  }

  if (action === "go-desk") {
    if (!isDeskUnlocked(appState)) {
      setBanner("Correspondence Desk is not yet anchored.");
      renderApp();
      return;
    }
    navigate("/desk");
    return;
  }

  if (action === "toggle-widget") {
    const widget = button.getAttribute("data-widget");
    if (widget && Object.prototype.hasOwnProperty.call(widgetState, widget)) {
      widgetState = {
        ...widgetState,
        [widget]: !widgetState[widget],
      };
      renderApp();
    }
    return;
  }

  if (action === "artifact-select") {
    const reward = button.getAttribute("data-reward") || "";
    selectedArtifactReward = selectedArtifactReward === reward ? "" : reward;
    renderApp();
    return;
  }

  if (action === "loot-select-region") {
    const region = String(button.getAttribute("data-region") || "").toLowerCase();
    if (["crd", "worm", "dcc", "aa"].includes(region)) {
      selectedLootRegion = region;
      selectedLootItemId = "";
      renderApp();
    }
    return;
  }

  if (action === "loot-select-item") {
    const itemId = button.getAttribute("data-item-id") || "";
    selectedLootItemId = selectedLootItemId === itemId ? "" : itemId;
    renderApp();
    return;
  }

  if (action === "loot-use-item") {
    const itemId = selectedLootItemId || button.getAttribute("data-item-id") || "";
    if (!itemId) {
      setBanner("Select a loot item first.");
      renderApp();
      return;
    }
    const consumed = consumeLootItem(appState, itemId, Date.now());
    if (consumed.changed) {
      withState(consumed.nextState);
      selectedLootItemId = "";
    }
    setBanner(consumed.message);
    renderApp();
    return;
  }

  if (action === "loot-equip-target") {
    const itemId = button.getAttribute("data-item-id") || selectedLootItemId || "";
    const region = String(button.getAttribute("data-region") || "").toLowerCase();
    const targetId = String(button.getAttribute("data-target-id") || "");
    const rawSlot = String(button.getAttribute("data-slot-id") || "");
    if (!itemId || !region) {
      setBanner("Select a loot item and target slot first.");
      renderApp();
      return;
    }

    if (region === "dcc") {
      const loot = lootInventoryFromState(appState, Date.now());
      const item = loot.items[itemId];
      if (!item) {
        setBanner("Loot item not found.");
        renderApp();
        return;
      }
      withState((current) => {
        const runtime = getNodeRuntime(current, "DCC01", () => ({}));
        const run = runtime && runtime.run && typeof runtime.run === "object" ? runtime.run : null;
        if (!run) {
          setBanner("Start a DCC run before equipping DCC loot.");
          return current;
        }
        const equipment = run.equipment && typeof run.equipment === "object" ? { ...run.equipment } : {};
        const slot = rawSlot || "trinket";
        if (item.kind === "dcc_armor") {
          if (!["head", "chest", "legs", "trinket"].includes(slot)) {
            setBanner("Choose a valid DCC armor slot.");
            return current;
          }
          equipment[slot] = {
            ...(equipment[slot] && typeof equipment[slot] === "object" ? equipment[slot] : {}),
            itemId,
            label: item.label,
            rarity: item.rarity,
            enchantItemId: equipment[slot] && equipment[slot].enchantItemId ? equipment[slot].enchantItemId : "",
            hpBonus: Number((Array.isArray(item.effects) ? item.effects.find((effect) => effect.key === "dcc_run_hp_bonus") : null)?.value || 0),
            baseAttackBonus: Number((Array.isArray(item.effects) ? item.effects.find((effect) => effect.key === "dcc_run_attack_bonus") : null)?.value || 0),
            baseStaminaBonus: Number((Array.isArray(item.effects) ? item.effects.find((effect) => effect.key === "dcc_run_stamina_bonus") : null)?.value || 0),
            attackBonus: Number((Array.isArray(item.effects) ? item.effects.find((effect) => effect.key === "dcc_run_attack_bonus") : null)?.value || 0),
            staminaBonus: Number((Array.isArray(item.effects) ? item.effects.find((effect) => effect.key === "dcc_run_stamina_bonus") : null)?.value || 0),
          };
          setBanner(`Equipped ${item.label} to ${slot}.`);
        } else if (item.kind === "dcc_enchant") {
          const armorSlot = targetId || "chest";
          if (!["head", "chest", "legs", "trinket"].includes(armorSlot)) {
            setBanner("Choose an armor piece for this enchant.");
            return current;
          }
          const base = equipment[armorSlot] && typeof equipment[armorSlot] === "object" ? equipment[armorSlot] : null;
          if (!base || !base.itemId) {
            setBanner("Equip an armor piece first, then attach an enchant.");
            return current;
          }
          const addAttack = Number((Array.isArray(item.effects) ? item.effects.find((effect) => effect.key === "dcc_run_attack_bonus") : null)?.value || 0);
          const addStamina = Number((Array.isArray(item.effects) ? item.effects.find((effect) => effect.key === "dcc_run_stamina_bonus") : null)?.value || 0);
          equipment[armorSlot] = {
            ...base,
            enchantItemId: itemId,
            enchantLabel: item.label,
            rarity: base.rarity || item.rarity,
            attackBonus: Number(base.baseAttackBonus || base.attackBonus || 0) + addAttack,
            staminaBonus: Number(base.baseStaminaBonus || base.staminaBonus || 0) + addStamina,
          };
          setBanner(`Attached ${item.label} to ${armorSlot} armor.`);
        } else {
          setBanner("That item cannot be slotted in DCC.");
          return current;
        }

        const nextRun = {
          ...run,
          equipment,
        };
        const equipmentBonuses = Object.values(equipment).reduce((acc, entry) => {
          if (!entry || typeof entry !== "object") {
            return acc;
          }
          return {
            hp: acc.hp + Math.max(0, Number(entry.hpBonus || 0)),
            attack: acc.attack + Math.max(0, Number(entry.attackBonus || 0)),
            stamina: acc.stamina + Math.max(0, Number(entry.staminaBonus || 0)),
          };
        }, { hp: 0, attack: 0, stamina: 0 });
        const baseMaxHp = Math.max(1, Number(nextRun.baseMaxHp || nextRun.maxHp || 1));
        const baseAttack = Math.max(1, Number(nextRun.baseAttack || nextRun.attack || 1));
        const baseMaxStamina = Math.max(1, Number(nextRun.baseMaxStamina || nextRun.maxStamina || 1));
        nextRun.maxHp = baseMaxHp + equipmentBonuses.hp;
        nextRun.attack = baseAttack + equipmentBonuses.attack;
        nextRun.maxStamina = baseMaxStamina + equipmentBonuses.stamina;
        nextRun.hp = Math.min(nextRun.maxHp, Math.max(0, Number(nextRun.hp || 0)));
        nextRun.stamina = Math.min(nextRun.maxStamina, Math.max(0, Number(nextRun.stamina || 0)));
        return updateNodeRuntime(
          current,
          "DCC01",
          (rt) => ({
            ...(rt && typeof rt === "object" ? rt : {}),
            run: nextRun,
          }),
          () => ({ run: nextRun }),
        );
      });
      renderApp();
      return;
    }

    const numericSlot = rawSlot === "" ? undefined : Number(rawSlot);
    const result = equipLootItem(appState, {
      region,
      targetId,
      slotId: Number.isFinite(numericSlot) ? numericSlot : undefined,
      itemInstanceId: itemId,
    });
    if (result.changed) {
      withState(result.nextState);
    }
    setBanner(result.message);
    renderApp();
    return;
  }

  if (action === "nexus-slot-key") {
    const slotId = button.getAttribute("data-slot-id") || "";
    const selectedReward = String(selectedArtifactReward || "");
    if (!selectedReward) {
      setBanner("Select a key artifact before socketing.");
      renderApp();
      return;
    }

    const beforeSlots = keySlotsFromState(appState);
    const beforeRewards =
      appState && appState.inventory && appState.inventory.rewards && typeof appState.inventory.rewards === "object"
        ? appState.inventory.rewards
        : {};

    withState((current) => socketRewardKey(current, selectedReward, slotId));

    const afterSlots = keySlotsFromState(appState);
    const afterRewards =
      appState && appState.inventory && appState.inventory.rewards && typeof appState.inventory.rewards === "object"
        ? appState.inventory.rewards
        : {};
    const socketed =
      !beforeSlots[slotId] &&
      Boolean(afterSlots[slotId]) &&
      Object.keys(afterRewards).length < Object.keys(beforeRewards).length;

    if (socketed) {
      selectedArtifactReward = "";
      setBanner(`${selectedReward} socketed into ${slotId.toUpperCase()}.`);
    } else {
      setBanner("Selected artifact does not fit this slot.");
    }
    renderApp();
    return;
  }

  if (action === "nexus-focus") {
    const ringIndex = Number(button.getAttribute("data-ring-index") || 0);
    const itemIndex = Number(button.getAttribute("data-item-index") || 0);
    if (Number.isInteger(ringIndex) && Number.isInteger(itemIndex)) {
      nexusRingSelectionIndex = ringIndex;
      nexusItemSelectionByRing[ringIndex] = itemIndex;
      normalizeNexusSelection();
      renderApp();
    }
    return;
  }

  if (action === "nexus-prev") {
    cycleNexus(-1);
    renderApp();
    return;
  }

  if (action === "nexus-next") {
    cycleNexus(1);
    renderApp();
    return;
  }

  if (action === "nexus-open") {
    const slug = button.getAttribute("data-section-slug");
    if (slug) {
      navigate(`/section/${slug}`);
    }
    return;
  }

  if (action === "save-export") {
    downloadSaveFile();
    setBanner("Save exported.");
    renderApp();
    return;
  }

  if (action === "save-import-prompt") {
    const input = root.querySelector("[data-save-file]");
    if (input) {
      input.value = "";
      input.click();
    }
    return;
  }

  if (action === "reset-progress") {
    if (!window.confirm("Reset all local ARG scaffold progress?")) {
      return;
    }
    appState = resetState();
    deskFocusNodeId = null;
    selectedArtifactReward = "";
    selectedLootItemId = "";
    selectedLootRegion = "crd";
    setBanner("Progress reset.");
    renderApp();
    return;
  }

  if (action === "open-desk") {
    if (!isDeskUnlocked(appState)) {
      setBanner("Correspondence Desk is not yet anchored.");
      renderApp();
      return;
    }
    deskFocusNodeId = button.getAttribute("data-node-id");
    navigate("/desk");
    return;
  }

  if (action === "solve-node") {
    const nodeId = button.getAttribute("data-node-id");
    const node = blueprintIndex.nodesById.get(nodeId);
    if (!node) {
      return;
    }

    withState((current) => applyNodeSolveSystemOverrides(markNodeSolvedWithOverrides(current, node), node));
    setBanner(`${node.node_id} solved. Reward added: ${solveRewardLabel(node)}.`);
    renderApp();
    return;
  }

  if (action === "dev-autocomplete-node") {
    const nodeId = button.getAttribute("data-node-id");
    const node = blueprintIndex.nodesById.get(nodeId);
    if (!node) {
      return;
    }
    if ((appState.solvedNodeIds || []).includes(node.node_id)) {
      setBanner(`${node.node_id} already solved.`);
      renderApp();
      return;
    }

    withState((current) => {
      let next = applyNodeSolveSystemOverrides(markNodeSolvedWithOverrides(current, node), node);
      if (node.node_id === "CRD04") {
        next = grantSupplementalReward(next, "Suriel's Marble", node);
      }
      return next;
    });
    const bonus = node.node_id === "CRD04" ? " + Suriel's Marble" : "";
    setBanner(`${node.node_id} autocompleted. Reward added: ${solveRewardLabel(node)}${bonus}.`);
    renderApp();
    return;
  }

  if (action === "madra-refine") {
    const conversion = convertMadraToCharge(appState.systems.madraWell);
    withState((current) => updateSystemState(current, "madraWell", conversion.nextState));
    setBanner(conversion.reason);
    renderApp();
    return;
  }

  if (action === "delivery-dispatch") {
    const dayBoard = buildDeliveryDay(appState.systems.deliveryBoard);
    const plan = defaultDeliveryPlan(dayBoard);
    const result = dispatchDeliveryPlan(appState.systems.deliveryBoard, plan);
    withState((current) => updateSystemState(current, "deliveryBoard", result.nextState));
    setBanner(`Dispatch day ${result.run.day} resolved with score ${result.run.score}.`);
    renderApp();
    return;
  }

  if (action === "dungeon-move") {
    const room = button.getAttribute("data-room");
    const move = moveRoom(appState.systems.dungeonCrawl, room);
    withState((current) => updateSystemState(current, "dungeonCrawl", move.nextState));
    setBanner(move.message);
    renderApp();
    return;
  }

  if (action === "dungeon-act") {
    const run = runRoomAction(appState.systems.dungeonCrawl);
    withState((current) => updateSystemState(current, "dungeonCrawl", run.nextState));
    setBanner(run.message);
    renderApp();
    return;
  }

  if (action === "desk-hint") {
    const level = Number(button.getAttribute("data-level") || 1);
    if (!deskFocusNodeId) {
      return;
    }

    withState((current) => setHintLevel(current, deskFocusNodeId, level));
    setBanner(`Desk response escalated to hint level ${level} for ${deskFocusNodeId}.`);
    renderApp();
  }
}

function handleChange(event) {
  if (!(event.target instanceof Element)) {
    return;
  }

  const aa03ManaInput = event.target.closest("[data-aa03-mana-invest]");
  if (aa03ManaInput) {
    const value = Number("value" in aa03ManaInput ? aa03ManaInput.value : 0);
    const handled = dispatchActiveNodeAction({
      type: "aa03-set-mana-invest",
      amount: Number.isFinite(value) ? Math.floor(value) : 0,
      at: Date.now(),
    });
    if (!handled) {
      renderApp();
    }
    return;
  }

  const wormOrderType = event.target.closest("[data-worm02-order-type]");
  if (wormOrderType) {
    const row = wormOrderType.closest("[data-worm02-order-row]");
    if (row) {
      const infoWrap = row.querySelector("[data-worm02-info-wrap]");
      if (infoWrap) {
        const type = String("value" in wormOrderType ? wormOrderType.value : "").trim().toLowerCase();
        infoWrap.hidden = type !== "info";
      }
    }
    return;
  }

  const presetSelector = event.target.closest("[data-madra-preset]");
  if (presetSelector) {
    withState((current) =>
      updateSystemState(
        current,
        "madraWell",
        setMadraPreset(current.systems.madraWell, presetSelector.value),
      ),
    );
    setBanner("Madra cycling preset updated.");
    renderApp();
    return;
  }

  const deskNode = event.target.closest("[data-desk-node]");
  if (deskNode) {
    deskFocusNodeId = deskNode.value;
    renderApp();
    return;
  }

  const saveFileInput = event.target.closest("[data-save-file]");
  if (saveFileInput) {
    const file = saveFileInput.files && saveFileInput.files[0];
    if (!file) {
      return;
    }

    file
      .text()
      .then((text) => {
        appState = parseStateFromSaveText(text);
        saveState(appState);
        deskFocusNodeId = null;
        selectedArtifactReward = "";
        setBanner(`Save imported from ${file.name}.`);
        renderApp();
      })
      .catch((error) => {
        const detail = error && error.message ? error.message : "Unable to read save file.";
        setBanner(`Import failed: ${detail}`);
        renderApp();
      });
  }
}

function handleKeyDown(event) {
  const target = event.target;
  if (event.key === "Escape") {
    const isTypingTarget =
      target instanceof Element &&
      ((target instanceof HTMLElement && target.isContentEditable) ||
        target.closest("input, textarea"));
    if (isTypingTarget && document.activeElement instanceof HTMLElement) {
      event.preventDefault();
      document.activeElement.blur();
      return;
    }

    if (closeTopDialogIfAny()) {
      event.preventDefault();
      return;
    }

    const escapeBack = backLinkForRoute(getCurrentRoute());
    if (escapeBack && escapeBack.route) {
      event.preventDefault();
      navigate(escapeBack.route);
      return;
    }
  }

  if (handleNodeKeyDown(event)) {
    return;
  }

  if (
    target instanceof Element &&
    ((target instanceof HTMLElement && target.isContentEditable) ||
      target.closest("input, textarea, select"))
  ) {
    return;
  }

  const route = getCurrentRoute();

  if (route === "/") {
    if (!lastNexusRings.length) {
      return;
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      cycleNexus(-1);
      renderApp();
      return;
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
      cycleNexus(1);
      renderApp();
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      switchNexusRing(-1);
      renderApp();
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      switchNexusRing(1);
      renderApp();
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      openSelectedNexusSection();
    }

    return;
  }

  if (sectionFromRoute(route)) {
    if (!lastSectionNodes.length) {
      return;
    }

    if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      cycleSectionNodes(-1);
      renderApp();
      return;
    }

    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      cycleSectionNodes(1);
      renderApp();
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      openSelectedSectionNode();
    }

    return;
  }
}

function handleWheel(event) {
  handleNodeWheel(event);
}

async function bootstrap() {
  if (!window.location.hash) {
    navigate("/");
  }

  try {
    const blueprint = await loadBlueprint();
    blueprintIndex = buildBlueprintIndex(blueprint);

    root.addEventListener("click", handleClick);
    root.addEventListener("change", handleChange);
    root.addEventListener("input", handleChange);
    root.addEventListener("dragstart", handleDragStart);
    root.addEventListener("dragover", handleDragOver);
    root.addEventListener("drop", handleDrop);
    root.addEventListener("dragend", handleDragEnd);
    root.addEventListener("wheel", handleWheel, { passive: false });
    root.addEventListener("pointerdown", handlePointerDown);
    root.addEventListener("pointermove", handlePointerMove);
    root.addEventListener("pointerup", handlePointerEnd);
    root.addEventListener("pointercancel", handlePointerEnd);
    window.addEventListener("blur", () => {
      if (hub08OrbHoldSession.pointerId !== null) {
        clearHub08OrbHoldSession();
      }
      if (aa03PointerSession.pointerId !== null) {
        clearAa03PointerSession();
      }
    });
    window.addEventListener("keydown", handleKeyDown);

    subscribeToRouteChanges((route) => {
      if (route !== lastRouteForVisit) {
        routeVisitNonce += 1;
        lastRouteForVisit = route;
      }
      renderApp(route);
    });
    renderApp();
    let lastSlowAutoRenderAt = 0;
    window.setInterval(() => {
      if (document.visibilityState === "hidden") {
        return;
      }
      if (widgetState.artifacts || widgetState.signals || widgetState.save) {
        return;
      }
      const route = getCurrentRoute();
      const now = Date.now();
      const isSlowNode = route === "/cradle/madra-well" || route === "/cradle/sacred-valley-tournament";

      if (!isSlowNode) {
        return;
      }

      if (now - lastSlowAutoRenderAt < AUTO_RENDER_INTERVAL_MS) {
        return;
      }
      lastSlowAutoRenderAt = now;
      renderApp(route);
    }, AUTO_RENDER_INTERVAL_MS);
  } catch (error) {
    root.innerHTML = `
      <div class="focus-surface">
        <h2>Bootstrap Failed</h2>
        <p class="muted">${escapeHtml(error.message)}</p>
        <p>Verify that the blueprint JSON exists and this app is served over HTTP(S).</p>
      </div>
    `;
  }
}

bootstrap();
