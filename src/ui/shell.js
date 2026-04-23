import { escapeHtml } from "../templates/shared.js";
import { renderRegionSymbol } from "../core/symbology.js";
import { renderArtifactSymbol } from "../core/artifacts.js";
import { formatLootItemEffectSummary, isDirectUseLootItem, isLootItemEquipped, lootItemsByRegion } from "../systems/loot.js";

function renderInventory(state, selectedArtifactReward) {
  const rewards = Object.entries(state.inventory.rewards || {});
  if (!rewards.length) {
    return `<div class="widget-empty">No artifacts collected yet.</div>`;
  }

  return `
    <ul class="widget-list widget-artifact-list">
      ${rewards
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(
          ([reward]) => `
            <li class="widget-item">
              <button
                type="button"
                class="widget-artifact-chip ${selectedArtifactReward === reward ? "is-selected" : ""}"
                data-action="artifact-select"
                data-reward="${escapeHtml(reward)}"
                aria-label="${escapeHtml(`Select artifact ${reward}`)}"
              >
                ${renderArtifactSymbol({
                  artifactName: reward,
                  className: "widget-artifact-symbol artifact-symbol",
                })}
                <span class="widget-artifact-labels">
                  <strong>${escapeHtml(reward)}</strong>
                </span>
              </button>
            </li>
          `,
        )
        .join("")}
    </ul>
  `;
}

function effectSummary(item) {
  return formatLootItemEffectSummary(item, { maxEffects: 3 });
}

function displayItemLabel(item) {
  const label = String(item && item.label ? item.label : "");
  return label.replace(/\s+\[[^\]]+\]$/u, "").trim();
}

function placementHintForItem(item, activeNodeId) {
  if (!item || !activeNodeId) {
    return "";
  }
  const templateId = String(item.templateId || "").toLowerCase();
  const kind = String(item.kind || "").toLowerCase();
  if (templateId === "worm_shard_enhancement") {
    return "Shard enhancement selected. Open a cape shard popup in WORM01 and click a socket.";
  }
  if (templateId === "worm_hiring_window_token") {
    return "Use this dossier to permanently improve WORM hiring quality.";
  }
  if (templateId === "crd_soul_crystal" || templateId === "crd_combat_relic") {
    return "Cradle gear selected. Open CRD02 soul/combat slots to place it.";
  }
  if (kind === "aa_focus") {
    return "Workshop focus selected. Open AA03 Slots and click a socket.";
  }
  if (kind === "dcc_armor" || kind === "dcc_enchant") {
    return "DCC gear selected. Start a run and place it from DCC slot controls.";
  }
  return "Selected item can be used or placed in its matching region slots.";
}

function renderUniversalTargetActions(state, item, activeNodeId) {
  if (!item || !activeNodeId) {
    return "";
  }

  return `
    <p class="muted" style="padding: 0 10px 8px; margin: 0;">
      ${escapeHtml(placementHintForItem(item, activeNodeId))}
    </p>
  `;
}

function renderLootInventory(state, selectedLootItemId, selectedLootRegion, activeNodeId) {
  const groups = lootItemsByRegion(state, Date.now());
  const region = ["crd", "worm", "dcc", "aa"].includes(String(selectedLootRegion || "").toLowerCase())
    ? String(selectedLootRegion || "").toLowerCase()
    : "crd";
  const list = (groups[region] || []).filter((item) => !isLootItemEquipped(state, item.id));

  const regionTabs = `
    <div class="toolbar">
      <button type="button" data-action="loot-select-region" data-region="crd" ${region === "crd" ? "disabled" : ""}>CRD</button>
      <button type="button" data-action="loot-select-region" data-region="worm" ${region === "worm" ? "disabled" : ""}>WORM</button>
      <button type="button" data-action="loot-select-region" data-region="dcc" ${region === "dcc" ? "disabled" : ""}>DCC</button>
      <button type="button" data-action="loot-select-region" data-region="aa" ${region === "aa" ? "disabled" : ""}>AA</button>
    </div>
  `;

  if (!list.length) {
    return `${regionTabs}<div class="widget-empty">No loot in this region tab.</div>`;
  }

  return `
    ${regionTabs}
    <ul class="widget-list widget-artifact-list">
      ${list.map((item) => `
        <li class="widget-item">
          <button
            type="button"
              class="widget-artifact-chip ${selectedLootItemId === item.id ? "is-selected" : ""}"
              data-action="loot-select-item"
              data-item-id="${escapeHtml(item.id)}"
            >
            ${renderRegionSymbol({
              section:
                item.region === "crd"
                  ? "Cradle"
                  : item.region === "worm"
                    ? "Worm"
                    : item.region === "aa"
                      ? "Arcane Ascension"
                      : "Dungeon Crawler Carl",
              className: "widget-artifact-symbol",
            })}
            <span class="widget-artifact-labels">
              <strong>${escapeHtml(displayItemLabel(item))}</strong>
              <small>${escapeHtml(String(item.quantity || 1))}x | ${escapeHtml(String(item.rarity || "common"))}</small>
            </span>
          </button>
          <p class="muted" style="padding:0 10px; margin:4px 0;">${effectSummary(item)}</p>
          ${isDirectUseLootItem(item)
            ? `<div class="toolbar" style="margin-top:6px;"><button type="button" class="ghost" data-action="loot-use-item" data-item-id="${escapeHtml(item.id)}">Use</button></div>`
            : ""}
          ${selectedLootItemId === item.id ? renderUniversalTargetActions(state, item, activeNodeId) : ""}
        </li>
      `).join("")}
    </ul>
  `;
}

function widgetClass(isOpen) {
  return isOpen ? "widget-panel open" : "widget-panel";
}

export function renderShellLayout({
  summary,
  state,
  selectedArtifactReward,
  selectedLootItemId,
  selectedLootRegion,
  deskUnlocked,
  backRoute,
  backLabel,
  frontierNodes,
  contentHtml,
  widgetState,
  currentRoute,
  activeNodeId,
  activeNodeSolved,
}) {
  return `
    <div class="space-app-shell">
      <header class="space-header">
        <div class="space-brand">
          <h1>Nexus</h1>
          <p>${escapeHtml(String(summary.nodeCount || 0))} nodes | ${escapeHtml(String(summary.sections?.length || 0))} arcs</p>
        </div>
        <nav class="space-controls">
          ${
            backRoute
              ? `<button class="ghost" data-action="go-back" data-route="${escapeHtml(backRoute)}">${escapeHtml(backLabel || "Back")}</button>`
              : ""
          }
          <button class="ghost" data-action="go-home" ${currentRoute === "/" ? "disabled" : ""}>Nexus</button>
          ${
            deskUnlocked
              ? `<button class="ghost" data-action="go-desk" ${currentRoute === "/desk" ? "disabled" : ""}>Desk</button>`
              : ""
          }
          <button data-action="toggle-widget" data-widget="artifacts">Artifacts</button>
          <button data-action="toggle-widget" data-widget="loot">Loot</button>
          <button data-action="toggle-widget" data-widget="save">Save</button>
          <button class="warn" data-action="reset-progress">Reset</button>
        </nav>
      </header>

      <main class="space-main">
        <section class="focus-surface">
          ${
            activeNodeId
              ? `
                <button
                  type="button"
                  class="dev-autocomplete-node"
                  data-action="dev-autocomplete-node"
                  data-node-id="${escapeHtml(activeNodeId)}"
                  ${activeNodeSolved ? "disabled" : ""}
                  title="Temporary developer shortcut"
                >
                  ${activeNodeSolved ? "Autocompleted" : "Autocomplete Node"}
                </button>
              `
              : ""
          }
          ${contentHtml}
        </section>
      </main>

      <aside class="widget-stack" aria-label="Utility Widgets">
        <section class="${widgetClass(widgetState.artifacts)}">
          <header>
            <h3>Artifacts</h3>
            <button class="ghost" data-action="toggle-widget" data-widget="artifacts">Close</button>
          </header>
          ${renderInventory(state, selectedArtifactReward)}
        </section>

        <section class="${widgetClass(widgetState.loot)}">
          <header>
            <h3>Loot</h3>
            <button class="ghost" data-action="toggle-widget" data-widget="loot">Close</button>
          </header>
          ${renderLootInventory(state, selectedLootItemId, selectedLootRegion, activeNodeId)}
        </section>

        <section class="${widgetClass(widgetState.save)}">
          <header>
            <h3>Save Transfer</h3>
            <button class="ghost" data-action="toggle-widget" data-widget="save">Close</button>
          </header>
          <div class="widget-block">
            <p class="muted">Export your progress, then import that file in another browser or device.</p>
            <div class="nexus-focus-actions">
              <button data-action="save-export">Export Save</button>
              <button class="ghost" data-action="save-import-prompt">Import Save</button>
            </div>
            <input class="save-input" type="file" accept=".json,application/json" data-save-file />
          </div>
        </section>
      </aside>
    </div>
  `;
}
