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
let nexusSelectionIndex = 0;
let lastNexusSections = [];
let sectionNodeSelectionIndex = 0;
let lastSectionNodes = [];
let activeNodeContext = null;
const AUTO_RENDER_INTERVAL_MS = 2000;

function setBanner(text) {
  bannerMessage = text;
}

function grantSupplementalReward(state, rewardName, node) {
  const reward = String(rewardName || "");
  if (!reward) {
    return state;
  }

  const rewards =
    state && state.inventory && state.inventory.rewards && typeof state.inventory.rewards === "object"
      ? state.inventory.rewards
      : {};

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

function withState(updater) {
  appState = typeof updater === "function" ? updater(appState) : updater;
  saveState(appState);
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

  const rewards =
    state && state.inventory && state.inventory.rewards && typeof state.inventory.rewards === "object"
      ? state.inventory.rewards
      : {};
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

  const rewards =
    appState && appState.inventory && appState.inventory.rewards && typeof appState.inventory.rewards === "object"
      ? appState.inventory.rewards
      : {};

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

function normalizeNexusSelection() {
  if (!lastNexusSections.length) {
    nexusSelectionIndex = 0;
    return;
  }

  if (nexusSelectionIndex < 0) {
    nexusSelectionIndex = lastNexusSections.length - 1;
    return;
  }

  if (nexusSelectionIndex >= lastNexusSections.length) {
    nexusSelectionIndex = 0;
  }
}

function cycleNexus(step) {
  if (!lastNexusSections.length) {
    return;
  }
  nexusSelectionIndex += step;
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
  if (!lastNexusSections.length) {
    return;
  }

  const selected = lastNexusSections[nexusSelectionIndex];
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

    if (
      node.node_id === "HUB04" &&
      action.type === "arm-bearings" &&
      String(action.artifact || "") === "Nexus Bearings"
    ) {
      next = consumeReward(next, "Nexus Bearings", "HUB04");
    }

    if (
      node.node_id === "CRD02" &&
      action.type === "crd02-origin-test" &&
      String(action.artifact || "") === "Starter Core"
    ) {
      next = consumeReward(next, "Starter Core", "CRD02");
    }

    if (
      node.node_id === "CRD02" &&
      action.type === "crd02-breakthrough" &&
      action.ready === true &&
      String(action.artifact || "") === "Cultivation Potion"
    ) {
      next = consumeReward(next, "Cultivation Potion", "CRD02");
    }

    if (
      node.node_id === "CRD04" &&
      action.type === "crd04-enter-tournament" &&
      action.consumePass === true &&
      String(action.artifact || "") === "Seven-Year Festival Tournament Pass"
    ) {
      next = consumeReward(next, "Seven-Year Festival Tournament Pass", "CRD04");
    }

    if (
      node.node_id === "HUB05" &&
      action.type === "hub05-scan-archive" &&
      action.ready === true &&
      String(action.artifact || "") === "Archive Address"
    ) {
      next = consumeReward(next, "Archive Address", "HUB05");
    }

    const runtimeState = next;
    next = updateNodeRuntime(
      runtimeState,
      node.node_id,
      (runtime) => experience.reduceRuntime(runtime, action),
      () => experience.initialState({ node, state: runtimeState }),
    );

    const runtime = readNodeRuntime(next, node, experience);
    const solvedNow =
      typeof experience.validateRuntime === "function"
        ? Boolean(experience.validateRuntime(runtime))
        : Boolean(runtime && runtime.solved);
    const solvedBefore = (next.solvedNodeIds || []).includes(node.node_id);

    if (solvedNow && !solvedBefore) {
      next = markNodeSolved(next, node);
      let bonusReward = "";
      if (node.node_id === "CRD04") {
        next = grantSupplementalReward(next, "Suriel's Marble", node);
        bonusReward = `${bonusReward} + Suriel's Marble`;
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
        sectionProgress,
        selectedIndex: nexusSelectionIndex,
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

  withMadraTick(route);
  appState = ensureDerivedRewards(appState);
  ensureSelectedArtifactStillAvailable();

  const unlockedNodeIds = computeUnlockedNodeIds(blueprintIndex, appState);
  const solvedSet = new Set(appState.solvedNodeIds || []);
  const sectionProgress = computeSectionProgress(blueprintIndex, appState, unlockedNodeIds);
  const visibleNexusSections = sectionProgress.filter((section) => section.unlocked > 0);
  const frontier = frontierNodes(blueprintIndex, appState, unlockedNodeIds, 12);

  lastNexusSections = visibleNexusSections;
  normalizeNexusSelection();

  const content = contentForRoute(route, unlockedNodeIds, solvedSet, visibleNexusSections);
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
    const index = Number(button.getAttribute("data-index") || 0);
    if (Number.isInteger(index)) {
      nexusSelectionIndex = index;
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
    if (!lastNexusSections.length) {
      return;
    }

    if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      cycleNexus(-1);
      renderApp();
      return;
    }

    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      cycleNexus(1);
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
    window.addEventListener("keydown", handleKeyDown);

    subscribeToRouteChanges((route) => renderApp(route));
    renderApp();
    window.setInterval(() => {
      if (document.visibilityState === "hidden") {
        return;
      }
      const route = getCurrentRoute();
      if (route !== "/cradle/madra-well" && route !== "/cradle/sacred-valley-tournament") {
        return;
      }
      renderApp();
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
