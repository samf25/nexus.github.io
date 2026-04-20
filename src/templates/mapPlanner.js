import { escapeHtml, renderNodeScaffold } from "./shared.js";

export function renderMapPlanner(context) {
  const { node, templateSpec, solved } = context;

  const bodyHtml = `
    <h3>Map Planner Scaffold</h3>
    <p>${escapeHtml(node.surface || "Map route payload pending.")}</p>
    <div class="card-grid">
      <article class="card note">
        <h3>Routing Rules</h3>
        <p>${escapeHtml(node.mechanics || "Route legality and scoring rules to be authored.")}</p>
      </article>
      <article class="card">
        <h3>Candidate Set</h3>
        ${Array.isArray(node.candidate_set) && node.candidate_set.length > 0
          ? `<p>${escapeHtml(node.candidate_set.join(", "))}</p>`
          : `<p class="muted">No candidate payload attached.</p>`}
      </article>
    </div>
  `;

  return renderNodeScaffold({
    node,
    templateSpec,
    solved,
    bodyHtml,
  });
}
