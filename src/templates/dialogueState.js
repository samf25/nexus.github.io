import { escapeHtml, renderNodeScaffold } from "./shared.js";

export function renderDialogueState(context) {
  const { node, templateSpec, solved } = context;

  const bodyHtml = `
    <h3>Dialogue-State Scaffold</h3>
    <p>${escapeHtml(node.surface || "Dialogue state payload pending.")}</p>
    <div class="card-grid">
      <article class="card note">
        <h3>State Machine Contract</h3>
        <p>Phase 2 will attach explicit branch flags and truth-state transitions per authored dialogue payload.</p>
      </article>
      <article class="card">
        <h3>Immediate Action</h3>
        <p>Use the Correspondence Desk route to test hint ladder and escalation storage today.</p>
      </article>
    </div>
  `;

  return renderNodeScaffold({ node, templateSpec, solved, bodyHtml });
}
