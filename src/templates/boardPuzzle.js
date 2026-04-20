import { escapeHtml, renderNodeScaffold } from "./shared.js";

export function renderBoardPuzzle(context) {
  const { node, templateSpec, solved } = context;

  const bodyHtml = `
    <h3>Board State Scaffold</h3>
    <p>${escapeHtml(node.surface || "Board surface pending.")}</p>
    <div class="card-grid">
      <article class="card note">
        <h3>Validation Contract</h3>
        <p>${escapeHtml(node.validation || "Exact-state validation to be authored.")}</p>
      </article>
      <article class="card">
        <h3>Fairness Rail</h3>
        <p>${escapeHtml(node.fairness_scaffold || "Candidate rails and glossary toggles will be added with payload details.")}</p>
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
