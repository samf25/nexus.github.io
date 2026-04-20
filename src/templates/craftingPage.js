import { escapeHtml, renderNodeScaffold } from "./shared.js";

export function renderCraftingPage(context) {
  const { node, templateSpec, solved } = context;

  const bodyHtml = `
    <h3>Crafting System Scaffold</h3>
    <p>${escapeHtml(node.surface || "Crafting surface pending.")}</p>
    <div class="card-grid">
      <article class="card note">
        <h3>Recipe Contract</h3>
        <p>Crafting pages are wired for deterministic recipe resolution using authored content payloads.</p>
      </article>
      <article class="card">
        <h3>Output Artifact</h3>
        <p>${escapeHtml(node.reward || "No reward configured.")}</p>
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
