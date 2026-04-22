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

const root = document.getElementById("app");

let blueprintIndex = null;
let appState = loadState();
let deskFocusNodeId = null;
let bannerMessage = "";
let widgetState = {
  artifacts: false,
  signals: false,
  save: false,
};
let selectedArtifactReward = "";
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
const PGE_STORY_NODE_IDS = Object.freeze(new Set(["PGE02", "PGE03", "PGE04"]));
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
let hub08OrbHoldSession = {
  pointerId: null,
  button: null,
  startAt: 0,
  rafId: 0,
  completed: false,
};

function setBanner(text) {
  bannerMessage = text;
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
    const wormSystemResult = reduceWormSystemState(next.systems.worm, action, Date.now());
    if (wormSystemResult.changed) {
      next = updateSystemState(next, "worm", wormSystemResult.nextState);
      if (wormSystemResult.message) {
        setBanner(wormSystemResult.message);
      }
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
        routeVisitNonce,
      }),
      () => experience.initialState({ node, state: runtimeState }),
    );

    const runtime = readNodeRuntime(next, node, experience);

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
      next = markNodeSolved(next, node);
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

      setBanner(`${node.node_id} solved. Reward added: ${node.reward || "(none)"}${bonusReward}.`);
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
  if (!context || context.node.node_id !== "HUB08") {
    return;
  }

  const target = event.target instanceof Element ? event.target.closest("[data-hub08-orb]") : null;
  if (!target) {
    return;
  }

  if (target instanceof HTMLButtonElement && target.disabled) {
    return;
  }

  event.preventDefault();
  startHub08OrbHold(target, event.pointerId);
}

function handlePointerEnd(event) {
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

  withMadraTick(route);
  appState = ensureDerivedRewards(appState);
  ensureSelectedArtifactStillAvailable();

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
  const banner = bannerMessage
    ? `<section class="card note" style="margin-bottom: 12px;"><strong>Update:</strong> ${escapeHtml(bannerMessage)}</section>`
    : "";
  const backLink = backLinkForRoute(route);

  root.innerHTML = renderShellLayout({
    summary: blueprintIndex.summary,
    state: appState,
    selectedArtifactReward,
    deskUnlocked: isDeskUnlocked(appState),
    backRoute: backLink ? backLink.route : "",
    backLabel: backLink ? backLink.label : "",
    frontierNodes: frontier,
    contentHtml: `${banner}${content.html}`,
    widgetState,
    currentRoute: route,
    activeNodeId: activeRouteNodeId,
    activeNodeSolved: activeRouteNodeSolved,
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

    withState((current) => markNodeSolved(current, node));
    setBanner(`${node.node_id} solved. Reward added: ${node.reward || "(none)"}.`);
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
      let next = markNodeSolved(current, node);
      if (node.node_id === "CRD04") {
        next = grantSupplementalReward(next, "Suriel's Marble", node);
      }
      return next;
    });
    const bonus = node.node_id === "CRD04" ? " + Suriel's Marble" : "";
    setBanner(`${node.node_id} autocompleted. Reward added: ${node.reward || "(none)"}${bonus}.`);
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
  if (handleNodeKeyDown(event)) {
    return;
  }

  const target = event.target;
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
    root.addEventListener("dragstart", handleDragStart);
    root.addEventListener("dragover", handleDragOver);
    root.addEventListener("drop", handleDrop);
    root.addEventListener("dragend", handleDragEnd);
    root.addEventListener("wheel", handleWheel, { passive: false });
    root.addEventListener("pointerdown", handlePointerDown);
    root.addEventListener("pointerup", handlePointerEnd);
    root.addEventListener("pointercancel", handlePointerEnd);
    window.addEventListener("blur", () => {
      if (hub08OrbHoldSession.pointerId !== null) {
        clearHub08OrbHoldSession();
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
