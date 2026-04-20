import { escapeHtml, renderNodeScaffold } from "./shared.js";
import { MADRA_PRESETS, madraMilestones } from "../systems/madraWell.js";

function presetOptions(activeId) {
  return Object.entries(MADRA_PRESETS)
    .map(([id, preset]) => {
      const selected = id === activeId ? "selected" : "";
      return `<option value="${escapeHtml(id)}" ${selected}>${escapeHtml(preset.label)}</option>`;
    })
    .join("");
}

export function renderIncrementalSystem(context) {
  const { node, templateSpec, solved, state } = context;
  const madra = state.systems.madraWell;
  const milestones = madraMilestones(madra);

  const bodyHtml = `
    <h3>Incremental System Scaffold</h3>
    <p>${escapeHtml(node.surface || "System surface pending.")}</p>

    <div class="card-grid">
      <article class="card system">
        <h3>Madra Pool</h3>
        <p><strong>${escapeHtml(madra.madraPool.toFixed(2))}</strong> madra</p>
        <p class="muted">Total generated: ${escapeHtml(madra.totalGenerated.toFixed(2))}</p>
        <p class="muted">Charges: ${escapeHtml(String(madra.chargeCount))}</p>
      </article>
      <article class="card">
        <h3>Cycling Preset</h3>
        <select class="select" data-madra-preset>
          ${presetOptions(madra.presetId)}
        </select>
        <button class="inline-action" data-action="madra-refine">Refine Charge</button>
      </article>
      <article class="card note">
        <h3>Milestones</h3>
        <p>${milestones.generated120 ? "[x]" : "[ ]"} 120 total generated</p>
        <p>${milestones.firstThreeCharges ? "[x]" : "[ ]"} first three charges</p>
      </article>
    </div>
  `;

  return renderNodeScaffold({ node, templateSpec, solved, bodyHtml });
}
