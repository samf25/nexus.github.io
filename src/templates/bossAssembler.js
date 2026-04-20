import { escapeHtml, renderNodeScaffold } from "./shared.js";

export function renderBossAssembler(context) {
  const { node, templateSpec, solved, state } = context;
  const rewardKeys = Object.keys(state.inventory.rewards || {});

  const bodyHtml = `
    <h3>Boss Assembler Scaffold</h3>
    <p>${escapeHtml(node.surface || "Boss synthesis payload pending.")}</p>

    <div class="card-grid">
      <article class="card note">
        <h3>Imported Artifacts</h3>
        <p>${rewardKeys.length > 0 ? escapeHtml(rewardKeys.join(", ")) : "No artifacts earned yet."}</p>
      </article>
      <article class="card">
        <h3>Assembler Contract</h3>
        <p>Boss pages will validate artifact placement, traversal logic, and system-state constraints together.</p>
      </article>
    </div>
  `;

  return renderNodeScaffold({ node, templateSpec, solved, bodyHtml });
}
