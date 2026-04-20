import { escapeHtml, renderNodeScaffold } from "./shared.js";

export function renderResponsivePuzzle(context) {
  const { node, templateSpec, solved } = context;

  const bodyHtml = `
    <h3>Responsive Puzzle Scaffold</h3>
    <p>${escapeHtml(node.surface || "Responsive payload pending.")}</p>
    <div class="card-grid">
      <article class="card note">
        <h3>Accessibility Contract</h3>
        <p>Layout-reactive interactions must include keyboard parity and alternate control surfaces.</p>
      </article>
      <article class="card">
        <h3>Device Readiness</h3>
        <p>The shell and puzzle container are already responsive for desktop and mobile breakpoints.</p>
      </article>
    </div>
  `;

  return renderNodeScaffold({ node, templateSpec, solved, bodyHtml });
}
