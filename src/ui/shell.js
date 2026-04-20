import { escapeHtml } from "../templates/shared.js";

function renderInventory(state) {
  const rewards = Object.entries(state.inventory.rewards || {});
  if (!rewards.length) {
    return `<div class="widget-empty">No artifacts collected yet.</div>`;
  }

  return `
    <ul class="widget-list">
      ${rewards
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(
          ([reward, data]) => `
            <li class="widget-item">
              <strong>${escapeHtml(reward)}</strong>
              <small>${escapeHtml(data.source || "unknown")}</small>
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
              <a class="widget-link" href="#${escapeHtml(node.route)}">${escapeHtml(node.title)}</a>
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
  frontierNodes,
  contentHtml,
  widgetState,
  currentRoute,
}) {
  return `
    <div class="space-app-shell">
      <header class="space-header">
        <div class="space-brand">
          <h1>Nexus</h1>
          <p>${escapeHtml(String(summary.nodeCount || 0))} nodes | ${escapeHtml(String(summary.sections?.length || 0))} arcs</p>
        </div>
        <nav class="space-controls">
          <button class="ghost" data-action="go-home" ${currentRoute === "/" ? "disabled" : ""}>Nexus</button>
          <button class="ghost" data-action="go-desk" ${currentRoute === "/desk" ? "disabled" : ""}>Desk</button>
          <button data-action="toggle-widget" data-widget="artifacts">Artifacts</button>
          <button data-action="toggle-widget" data-widget="signals">Signals</button>
          <button data-action="toggle-widget" data-widget="save">Save</button>
          <button class="warn" data-action="reset-progress">Reset</button>
        </nav>
      </header>

      <main class="space-main">
        <section class="focus-surface">${contentHtml}</section>
      </main>

      <aside class="widget-stack" aria-label="Utility Widgets">
        <section class="${widgetClass(widgetState.artifacts)}">
          <header>
            <h3>Artifacts</h3>
            <button class="ghost" data-action="toggle-widget" data-widget="artifacts">Close</button>
          </header>
          ${renderInventory(state)}
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
