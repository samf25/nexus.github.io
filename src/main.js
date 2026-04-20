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
let nexusSelectionIndex = 0;
let lastNexusSections = [];
let sectionNodeSelectionIndex = 0;
let lastSectionNodes = [];
let activeNodeContext = null;

function setBanner(text) {
  bannerMessage = text;
}

function withState(updater) {
  appState = typeof updater === "function" ? updater(appState) : updater;
  saveState(appState);
}

function withMadraTick() {
  const ticked = tickMadraWell(appState.systems.madraWell, Date.now());
  appState = updateSystemState(appState, "madraWell", ticked);
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
    let next = updateNodeRuntime(
      current,
      node.node_id,
      (runtime) => experience.reduceRuntime(runtime, action),
      () => experience.initialState({ node, state: current }),
    );

    const runtime = readNodeRuntime(next, node, experience);
    const solvedNow =
      typeof experience.validateRuntime === "function"
        ? Boolean(experience.validateRuntime(runtime))
        : Boolean(runtime && runtime.solved);
    const solvedBefore = (next.solvedNodeIds || []).includes(node.node_id);

    if (solvedNow && !solvedBefore) {
      next = markNodeSolved(next, node);
      setBanner(`${node.node_id} solved. Reward added: ${node.reward || "(none)"}.`);
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

  const source = event.target instanceof HTMLElement ? event.target.closest("[data-node-piece]") : null;
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

  const dropZone =
    event.target instanceof HTMLElement ? event.target.closest("[data-node-dropzone]") : null;
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

  const dropZone =
    event.target instanceof HTMLElement ? event.target.closest("[data-node-dropzone]") : null;
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
  const action = context.experience.buildDropAction({
    pieceId,
    xPercent,
    yPercent,
  });

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

  if (route === "/") {
    lastSectionNodes = [];
    sectionNodeSelectionIndex = 0;
    return {
      html: renderNexusView({
        sectionProgress,
        selectedIndex: nexusSelectionIndex,
      }),
    };
  }

  if (route === "/desk") {
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

    if (node.node_id === "HUB06" || node.template === "correspondence_desk") {
      deskFocusNodeId = node.node_id;
      const pool = buildDeskNodePool(unlockedNodeIds);
      return {
        html: renderDesk({
          unlockedNodes: pool,
          selectedNodeId: deskFocusNodeId,
          hintLevels: appState.hintLevels,
        }),
      };
    }

    const customExperience = getNodeExperience(node.node_id);
    if (customExperience) {
      appState = ensureNodeRuntime(appState, node, customExperience);
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

  withMadraTick();

  const unlockedNodeIds = computeUnlockedNodeIds(blueprintIndex, appState);
  const solvedSet = new Set(appState.solvedNodeIds || []);
  const sectionProgress = computeSectionProgress(blueprintIndex, appState, unlockedNodeIds);
  const frontier = frontierNodes(blueprintIndex, appState, unlockedNodeIds, 12);

  lastNexusSections = sectionProgress;
  normalizeNexusSelection();

  const content = contentForRoute(route, unlockedNodeIds, solvedSet, sectionProgress);
  const banner = bannerMessage
    ? `<section class="card note" style="margin-bottom: 12px;"><strong>Update:</strong> ${escapeHtml(bannerMessage)}</section>`
    : "";

  root.innerHTML = renderShellLayout({
    summary: blueprintIndex.summary,
    state: appState,
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
  const nodeActionTarget =
    event.target instanceof HTMLElement ? event.target.closest("[data-node-action]") : null;
  if (nodeActionTarget && handleNodeActionClick(nodeActionTarget)) {
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

  if (action === "go-desk") {
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
    setBanner("Progress reset.");
    renderApp();
    return;
  }

  if (action === "open-desk") {
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
    target instanceof HTMLElement &&
    (target.isContentEditable || target.closest("input, textarea, select"))
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
