import { escapeHtml } from "../templates/shared.js";
import { renderRegionSymbol } from "../core/symbology.js";
import { renderArtifactSymbol } from "../core/artifacts.js";

function renderInventory(state, selectedArtifactReward) {
  const rewards = Object.entries(state.inventory.rewards || {});
  if (!rewards.length) {
    return `<div class="widget-empty">No artifacts collected yet.</div>`;
  }

  return `
    <ul class="widget-list widget-artifact-list">
      ${rewards
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(
          ([reward]) => `
            <li class="widget-item">
              <button
                type="button"
                class="widget-artifact-chip ${selectedArtifactReward === reward ? "is-selected" : ""}"
                data-action="artifact-select"
                data-reward="${escapeHtml(reward)}"
                aria-label="${escapeHtml(`Select artifact ${reward}`)}"
              >
                ${renderArtifactSymbol({
                  artifactName: reward,
                  className: "widget-artifact-symbol artifact-symbol",
                })}
                <span class="widget-artifact-labels">
                  <strong>${escapeHtml(reward)}</strong>
                </span>
              </button>
            </li>
          `,
        )
        .join("")}
    </ul>
  `;
}

function renderSignals(frontierNodes, requestHistory) {
  const frontierMarkup = frontierNodes.length
    ? `<ul class="widget-list">${frontierNodes
        .slice(0, 8)
        .map(
          (node) => `
            <li class="widget-item">
              <div class="widget-node-line">
                ${renderRegionSymbol({
                  section: node.section,
                  className: "widget-node-symbol",
                })}
                <a class="widget-link" href="#${escapeHtml(node.route)}">${escapeHtml(node.title)}</a>
              </div>
              <small>${escapeHtml(node.section)}</small>
            </li>
          `,
        )
        .join("")}</ul>`
    : `<div class="widget-empty">No frontier signals right now.</div>`;

  const history = Array.isArray(requestHistory) ? requestHistory.slice(0, 6) : [];
  const historyMarkup = history.length
    ? `<ul class="widget-list">${history
        .map(
          (entry) => `
            <li class="widget-item">
              <strong>${escapeHtml(entry.nodeId || "node")}</strong>
              <small>Hint L${escapeHtml(String(entry.level || 0))}</small>
            </li>
          `,
        )
        .join("")}</ul>`
    : `<div class="widget-empty">No desk history yet.</div>`;

  return `
    <div class="widget-block">
      <h4>Open Frontiers</h4>
      ${frontierMarkup}
    </div>
    <div class="widget-block">
      <h4>Desk Log</h4>
      ${historyMarkup}
    </div>
  `;
}

function widgetClass(isOpen) {
  return isOpen ? "widget-panel open" : "widget-panel";
}

export function renderShellLayout({
  summary,
  state,
  selectedArtifactReward,
  deskUnlocked,
  backRoute,
  backLabel,
  frontierNodes,
  contentHtml,
  widgetState,
  currentRoute,
  activeNodeId,
  activeNodeSolved,
}) {
  return `
    <div class="space-app-shell">
      <header class="space-header">
        <div class="space-brand">
          <h1>Nexus</h1>
          <p>${escapeHtml(String(summary.nodeCount || 0))} nodes | ${escapeHtml(String(summary.sections?.length || 0))} arcs</p>
        </div>
        <nav class="space-controls">
          ${
            backRoute
              ? `<button class="ghost" data-action="go-back" data-route="${escapeHtml(backRoute)}">${escapeHtml(backLabel || "Back")}</button>`
              : ""
          }
          <button class="ghost" data-action="go-home" ${currentRoute === "/" ? "disabled" : ""}>Nexus</button>
          ${
            deskUnlocked
              ? `<button class="ghost" data-action="go-desk" ${currentRoute === "/desk" ? "disabled" : ""}>Desk</button>`
              : ""
          }
          <button data-action="toggle-widget" data-widget="artifacts">Artifacts</button>
          <button data-action="toggle-widget" data-widget="signals">Signals</button>
          <button data-action="toggle-widget" data-widget="save">Save</button>
          <button class="warn" data-action="reset-progress">Reset</button>
        </nav>
      </header>

      <main class="space-main">
        <section class="focus-surface">
          ${
            activeNodeId
              ? `
                <button
                  type="button"
                  class="dev-autocomplete-node"
                  data-action="dev-autocomplete-node"
                  data-node-id="${escapeHtml(activeNodeId)}"
                  ${activeNodeSolved ? "disabled" : ""}
                  title="Temporary developer shortcut"
                >
                  ${activeNodeSolved ? "Autocompleted" : "Autocomplete Node"}
                </button>
              `
              : ""
          }
          ${contentHtml}
        </section>
      </main>

      <aside class="widget-stack" aria-label="Utility Widgets">
        <section class="${widgetClass(widgetState.artifacts)}">
          <header>
            <h3>Artifacts</h3>
            <button class="ghost" data-action="toggle-widget" data-widget="artifacts">Close</button>
          </header>
          ${renderInventory(state, selectedArtifactReward)}
        </section>

        <section class="${widgetClass(widgetState.signals)}">
          <header>
            <h3>Signals</h3>
            <button class="ghost" data-action="toggle-widget" data-widget="signals">Close</button>
          </header>
          ${renderSignals(frontierNodes, state.requestHistory)}
        </section>

        <section class="${widgetClass(widgetState.save)}">
          <header>
            <h3>Save Transfer</h3>
            <button class="ghost" data-action="toggle-widget" data-widget="save">Close</button>
          </header>
          <div class="widget-block">
            <p class="muted">Export your progress, then import that file in another browser or device.</p>
            <div class="nexus-focus-actions">
              <button data-action="save-export">Export Save</button>
              <button class="ghost" data-action="save-import-prompt">Import Save</button>
            </div>
            <input class="save-input" type="file" accept=".json,application/json" data-save-file />
          </div>
        </section>
      </aside>
    </div>
  `;
}
