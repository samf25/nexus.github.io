import { escapeHtml, renderNodeScaffold } from "./shared.js";

export function renderCanvasPuzzle(context) {
  const { node, templateSpec, solved } = context;

  const bodyHtml = `
    <h3>Canvas Interaction Scaffold</h3>
    <p>${escapeHtml(node.surface || "Surface payload pending.")}</p>
    <div class="card-grid">
      <article class="card note">
        <h3>Primary Mode</h3>
        <p>${escapeHtml(node.primary_mode || "N/A")}</p>
      </article>
      <article class="card">
        <h3>Mechanic Hook</h3>
        <p>${escapeHtml(node.mechanics || "Mechanics to be implemented in phase 2.")}</p>
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
