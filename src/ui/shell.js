import { escapeHtml } from "../templates/shared.js";
import { renderRegionSymbol } from "../core/symbology.js";
import { renderArtifactSymbol } from "../core/artifacts.js";
import { formatLootItemEffectSummary, isDirectUseLootItem, isLootItemEquipped, lootItemsByRegion } from "../systems/loot.js";

const ARTIFACT_SOURCE_LABEL_MAP = Object.freeze({
  "The Wandering Inn": "Wandering Inn",
  "A Practical Guide to Evil": "Practical Guide",
});

function compactArtifactSourceLabel(source) {
  const text = String(source || "").trim();
  return ARTIFACT_SOURCE_LABEL_MAP[text] || text || "Unknown source";
}

function renderInventory(state, selectedArtifactReward, selectedArtifactSource = "all") {
  const rewardEntries = Object.entries(state.inventory.rewards || {}).map(([reward, meta]) => ({
    reward,
    meta: meta && typeof meta === "object" ? meta : {},
  }));
  if (!rewardEntries.length) {
    return `<div class="widget-empty">No artifacts collected yet.</div>`;
  }

  const sources = Array.from(
    new Set(
      rewardEntries
        .map((entry) => String(entry.meta.section || "").trim())
        .filter(Boolean),
    ),
  ).sort((left, right) => left.localeCompare(right));
  const selectedSource = selectedArtifactSource === "all" || sources.includes(selectedArtifactSource)
    ? selectedArtifactSource
    : "all";
  const filtered = selectedSource === "all"
    ? rewardEntries.slice()
    : rewardEntries.filter((entry) => String(entry.meta.section || "").trim() === selectedSource);

  const tabs = `
    <div class="toolbar widget-artifact-tabs">
      <button
        type="button"
        data-action="artifact-select-source"
        data-source="all"
        ${selectedSource === "all" ? "disabled" : ""}
      >
        All
      </button>
      ${sources.map((source) => `
        <button
          type="button"
          data-action="artifact-select-source"
          data-source="${escapeHtml(source)}"
          ${selectedSource === source ? "disabled" : ""}
        >
          ${escapeHtml(compactArtifactSourceLabel(source))}
        </button>
      `).join("")}
    </div>
  `;

  if (!filtered.length) {
    return `${tabs}<div class="widget-empty">No artifacts in this source tab.</div>`;
  }

  return `
    ${tabs}
    <ul class="widget-list widget-artifact-list widget-scroll-list" data-widget-artifact-list="true">
      ${filtered
        .sort((a, b) => String(a.reward).localeCompare(String(b.reward)))
        .map(
          ({ reward, meta }) => `
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
                  <small>${escapeHtml(compactArtifactSourceLabel(meta.section || "Unknown source"))}</small>
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
    return "Shard enhancement selected. Open a cape shard popup in The Undersiders' Loft and click a socket.";
  }
  if (templateId === "worm_shard_slot_token") {
    return "Shard lattice selected. Open a cape shard popup in The Undersiders' Loft and click that cape's next locked socket.";
  }
  if (templateId === "worm_hiring_window_token") {
    return "Use this dossier to permanently improve Worm hiring quality.";
  }
  if (templateId === "crd_soul_crystal" || templateId === "crd_combat_relic") {
    return "Cradle gear selected. Open Madra Well soul/combat slots to place it.";
  }
  if (kind === "aa_focus") {
    return "Workshop focus selected. Open The Workshop slots and click a socket.";
  }
  if (kind === "dcc_armor") {
    return "Dungeon Crawler Carl armor selected. Place it from The Crawl slot controls before entering a run.";
  }
  if (kind === "dcc_enchant") {
    return "Legacy Dungeon Crawler Carl enchant selected. It can be sold, but new enchants come embedded on armor.";
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
      <button type="button" data-action="loot-select-region" data-region="crd" ${region === "crd" ? "disabled" : ""}>Cradle</button>
      <button type="button" data-action="loot-select-region" data-region="worm" ${region === "worm" ? "disabled" : ""}>Worm</button>
      <button type="button" data-action="loot-select-region" data-region="dcc" ${region === "dcc" ? "disabled" : ""}>Dungeon Crawler Carl</button>
      <button type="button" data-action="loot-select-region" data-region="aa" ${region === "aa" ? "disabled" : ""}>Arcane Ascension</button>
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
  selectedArtifactSource,
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
  const isDccNode = String(activeNodeId || "") === "DCC01";
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
          <button class="ghost" data-action="dev-unlock-final">Dev: Final Kit</button>
          <button class="ghost" data-action="dev-open-victory">Dev: Victory</button>
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

      <aside class="widget-stack ${isDccNode ? "is-dcc-node" : ""}" aria-label="Utility Widgets">
        <section class="${widgetClass(widgetState.artifacts)}">
          <header>
            <h3>Artifacts</h3>
            <button class="ghost" data-action="toggle-widget" data-widget="artifacts">Close</button>
          </header>
          ${renderInventory(state, selectedArtifactReward, selectedArtifactSource)}
        </section>

        <section class="${widgetClass(widgetState.loot)} widget-panel-loot">
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
