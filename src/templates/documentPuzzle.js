import { escapeHtml, renderNodeScaffold } from "./shared.js";

export function renderDocumentPuzzle(context) {
  const { node, templateSpec, solved } = context;

  const bodyHtml = `
    <h3>Document Puzzle Scaffold</h3>
    <p>${escapeHtml(node.surface || "Document surface pending.")}</p>
    <div class="card-grid">
      <article class="card note">
        <h3>Mutation Layer</h3>
        <p>This template is wired for revisit mutations via page-version flags in state.</p>
      </article>
      <article class="card">
        <h3>Extraction Stub</h3>
        <p>${escapeHtml(node.step_detail || "Extraction detail pending.")}</p>
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
