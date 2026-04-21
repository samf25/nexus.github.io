import { renderRegionSymbol } from "../core/symbology.js";

export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function renderList(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return `<div class="empty-state">None</div>`;
  }

  return `<ul class="route-list">${items
    .map((item) => `<li class="route-item">${escapeHtml(item)}</li>`)
    .join("")}</ul>`;
}

export function renderLoreRails(node) {
  const rails = [];
  if (node.lore_authenticity) {
    rails.push(`<span class="badge">Authenticity: ${escapeHtml(node.lore_authenticity)}</span>`);
  }
  if (node.spoiler_band) {
    rails.push(`<span class="badge warn">Spoilers: ${escapeHtml(node.spoiler_band)}</span>`);
  }
  if (node.node_type) {
    rails.push(`<span class="badge">Type: ${escapeHtml(node.node_type)}</span>`);
  }
  if (node.difficulty) {
    rails.push(`<span class="badge">Difficulty: ${escapeHtml(node.difficulty)}</span>`);
  }

  return `<div class="badge-row">${rails.join("")}</div>`;
}

export function renderNodeScaffold({ node, templateSpec, solved, bodyHtml }) {
  const dependencies = Array.isArray(node.dependencies) ? node.dependencies : [];
  const dependentCount = Array.isArray(node.dependents) ? node.dependents.length : 0;

  return `
    <article class="animated-fade">
      <h2 class="node-heading-with-symbol">
        ${renderRegionSymbol({
          section: node.section,
          className: "node-heading-symbol",
        })}
        <span>${escapeHtml(node.title)} <small>${escapeHtml(node.node_id)}</small></span>
      </h2>
      <p class="muted">Route: ${escapeHtml(node.route)} | Template alias: ${escapeHtml(node.template)} | Canonical: ${escapeHtml(templateSpec.canonical)}</p>
      ${renderLoreRails(node)}

      <div class="toolbar">
        <button data-action="solve-node" data-node-id="${escapeHtml(node.node_id)}" ${solved ? "disabled" : ""}>
          ${solved ? "Solved" : "Mark Solved (Scaffold)"}
        </button>
        <button class="ghost" data-action="open-desk" data-node-id="${escapeHtml(node.node_id)}">Request Hint via Desk</button>
      </div>

      <div class="card-grid">
        <section class="card">
          <h3>Contract</h3>
          <p>${escapeHtml(templateSpec.contract)}</p>
        </section>
        <section class="card">
          <h3>Usage</h3>
          <p>${escapeHtml(templateSpec.usedFor)}</p>
        </section>
      </div>

      <section class="template-shell">
        ${bodyHtml}
      </section>

      <div class="card-grid" style="margin-top: 12px;">
        <section class="card">
          <h3>Dependencies (${dependencies.length})</h3>
          ${renderList(dependencies)}
        </section>
        <section class="card">
          <h3>Dependents (${dependentCount})</h3>
          <p class="muted">Downstream routing is wired for scale; node-level mechanics are added in later phases.</p>
        </section>
        <section class="card">
          <h3>Reads State</h3>
          ${renderList(node.reads_state || [])}
        </section>
        <section class="card">
          <h3>Writes State</h3>
          ${renderList(node.writes_state || [])}
        </section>
      </div>

      <div class="footer-note">
        Build note: ${escapeHtml(node.build_notes || "No build notes provided.")}
      </div>
    </article>
  `;
}
