import { escapeHtml } from "../templates/shared.js";
import { renderRegionSymbol } from "../core/symbology.js";

function bestDeskNode(unlockedNodes, preferredNodeId) {
  if (preferredNodeId) {
    const found = unlockedNodes.find((node) => node.node_id === preferredNodeId);
    if (found) {
      return found;
    }
  }

  return unlockedNodes[0] || null;
}

function nodeOptionMarkup(nodes, selectedNodeId) {
  return nodes
    .map((node) => {
      const selected = node.node_id === selectedNodeId ? "selected" : "";
      return `<option value="${escapeHtml(node.node_id)}" ${selected}>${escapeHtml(node.node_id)} | ${escapeHtml(node.title)}</option>`;
    })
    .join("");
}

function hintRailForNode(node) {
  return [node.hint_1, node.hint_2, node.hint_3].filter(Boolean);
}

export function renderDesk({ unlockedNodes, selectedNodeId, hintLevels }) {
  const selectedNode = bestDeskNode(unlockedNodes, selectedNodeId);

  if (!selectedNode) {
    return `
      <article class="animated-fade">
        <h2>Correspondence Desk</h2>
        <div class="empty-state">No visible nodes available for desk requests yet.</div>
      </article>
    `;
  }

  const level = Number(hintLevels[selectedNode.node_id] || 0);
  const hints = hintRailForNode(selectedNode);

  return `
    <article class="animated-fade">
      <h2>Correspondence Desk</h2>
      <p class="muted">Menu-driven hint ladder with persistent thread history.</p>

      <div class="card-grid">
        <section class="card system">
          <h3>Active Thread</h3>
          <select class="select" data-desk-node>
            ${nodeOptionMarkup(unlockedNodes, selectedNode.node_id)}
          </select>
          <p class="desk-thread-node">
            ${renderRegionSymbol({
              section: selectedNode.section,
              className: "desk-thread-symbol",
            })}
            <span>${escapeHtml(selectedNode.node_id)} | ${escapeHtml(selectedNode.title)}</span>
          </p>
          <p class="muted">Current hint level: ${escapeHtml(String(level))}</p>

          <div class="toolbar">
            <button data-action="desk-hint" data-level="1">Nudge</button>
            <button data-action="desk-hint" data-level="2">Stronger Nudge</button>
            <button data-action="desk-hint" data-level="3">Extraction Check</button>
          </div>
        </section>

        <section class="card">
          <h3>Thread Output</h3>
          ${
            level === 0
              ? `<div class="empty-state">No hint requested yet for this node.</div>`
              : `<ul class="hint-list">${hints
                  .slice(0, level)
                  .map((hint, i) => `<li class="hint-item"><strong>Hint ${i + 1}:</strong> ${escapeHtml(hint)}</li>`)
                  .join("")}</ul>`
          }
        </section>
      </div>

      <div class="footer-note">
        Desk protocol scaffold is live. Node-authored hints are pulled directly from the blueprint fields and escalated by request level.
      </div>
    </article>
  `;
}
