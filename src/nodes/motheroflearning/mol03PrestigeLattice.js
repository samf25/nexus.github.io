import { escapeHtml } from "../../templates/shared.js";
import { renderRegionSymbol } from "../../core/symbology.js";
import {
  prestigeRegionDefinitions,
  prestigeRegionSnapshot,
  prestigeUpgradesForRegion,
} from "../../systems/prestige.js";

const NODE_ID = "MOL03";
const REGIONS = prestigeRegionDefinitions().filter(
  (region) => region.id === "cradle" || region.id === "worm" || region.id === "dcc",
);

function normalizeRuntime(candidate) {
  const source = candidate && typeof candidate === "object" ? candidate : {};
  return {
    selectedIndex: Math.max(0, Math.min(REGIONS.length - 1, Math.floor(Number(source.selectedIndex) || 0))),
    focusRegionId: REGIONS.some((region) => region.id === source.focusRegionId) ? source.focusRegionId : "",
    solved: Boolean(source.solved),
    lastMessage: String(source.lastMessage || ""),
  };
}

function selectedRegionId(runtime) {
  const selected = REGIONS[runtime.selectedIndex] || REGIONS[0];
  return selected ? selected.id : "cradle";
}

function solvedFromState(state) {
  return REGIONS.some((region) => {
    const snapshot = prestigeRegionSnapshot(state, region.id);
    return Object.values(snapshot.upgrades || {}).some((value) => Number(value) > 0);
  });
}

function wheelMarkup(runtime) {
  const selected = selectedRegionId(runtime);
  const radius = REGIONS.length === 2 ? 24 : 38;
  const points = REGIONS.map((_, index) => {
    const angle = REGIONS.length === 2
      ? -90 + index * 180
      : ((360 / Math.max(1, REGIONS.length)) * index) - 90;
    const radians = (angle * Math.PI) / 180;
    return {
      x: 50 + Math.cos(radians) * radius,
      y: 50 + Math.sin(radians) * radius,
    };
  });

  return `
    <section class="mol02-ring-stage">
      <div class="mol02-ring-guide" aria-hidden="true"></div>
      <div class="mol02-ring-core">
        ${renderRegionSymbol({
          section: "Mother of Learning",
          className: "mol-wheel-core-symbol",
        })}
      </div>
      ${REGIONS.map((region, index) => {
        const selectedClass = selected === region.id ? "is-selected" : "";
        const point = points[index];
        return `
          <button
            type="button"
            class="mol02-ring-node ${selectedClass}"
            style="left:${point.x}%; top:${point.y}%;"
            data-node-id="${NODE_ID}"
            data-node-action="mol03-focus-region"
            data-region-id="${escapeHtml(region.id)}"
            aria-label="${escapeHtml(region.label)} prestige upgrades"
          >
            ${renderRegionSymbol({
              section: region.label,
              className: "mol-wheel-node-symbol",
            })}
            <span>${escapeHtml(region.label)}</span>
          </button>
        `;
      }).join("")}
    </section>
  `;
}

export function initialMol03Runtime() {
  return normalizeRuntime({});
}

export function synchronizeMol03Runtime(runtime, { state = null } = {}) {
  const current = normalizeRuntime(runtime);
  return {
    ...current,
    solved: current.solved || solvedFromState(state),
  };
}

export function validateMol03Runtime(runtime) {
  return Boolean(runtime && runtime.solved);
}

export function reduceMol03Runtime(runtime, action) {
  const current = normalizeRuntime(runtime);
  if (!action || typeof action !== "object") {
    return current;
  }

  if (action.type === "mol03-cycle") {
    const step = Number(action.step) >= 0 ? 1 : -1;
    const size = Math.max(1, REGIONS.length);
    const selectedIndex = (current.selectedIndex + step + size) % size;
    return {
      ...current,
      selectedIndex,
      focusRegionId: "",
      lastMessage: "",
    };
  }

  if (action.type === "mol03-focus-region") {
    const regionId = REGIONS.some((region) => region.id === action.regionId)
      ? action.regionId
      : selectedRegionId(current);
    return {
      ...current,
      focusRegionId: regionId,
      lastMessage: "",
    };
  }

  if (action.type === "mol03-clear-focus") {
    return {
      ...current,
      focusRegionId: "",
    };
  }

  if (action.type === "mol03-buy-upgrade") {
    return {
      ...current,
      solved: current.solved || Boolean(action.applied),
      lastMessage: String(action.message || current.lastMessage),
    };
  }

  return current;
}

export function buildMol03ActionFromElement(element) {
  const actionName = element.getAttribute("data-node-action");
  if (!actionName) {
    return null;
  }

  if (actionName === "mol03-focus-region") {
    return {
      type: "mol03-focus-region",
      regionId: element.getAttribute("data-region-id") || "",
      at: Date.now(),
    };
  }

  if (actionName === "mol03-clear-focus") {
    return {
      type: "mol03-clear-focus",
      at: Date.now(),
    };
  }

  if (actionName === "mol03-buy-upgrade") {
    return {
      type: "mol03-buy-upgrade",
      regionId: element.getAttribute("data-region-id") || "",
      upgradeId: element.getAttribute("data-upgrade-id") || "",
      at: Date.now(),
    };
  }

  return null;
}

export function buildMol03KeyAction(event, runtime) {
  if (event.metaKey || event.ctrlKey || event.altKey) {
    return null;
  }

  const current = normalizeRuntime(runtime);
  if (event.code === "Escape") {
    if (!current.focusRegionId) {
      return null;
    }
    return {
      type: "mol03-clear-focus",
      at: Date.now(),
    };
  }

  if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
    return {
      type: "mol03-cycle",
      step: -1,
      at: Date.now(),
    };
  }

  if (event.key === "ArrowRight" || event.key === "ArrowDown") {
    return {
      type: "mol03-cycle",
      step: 1,
      at: Date.now(),
    };
  }

  if (event.key === "Enter") {
    return {
      type: "mol03-focus-region",
      regionId: selectedRegionId(current),
      at: Date.now(),
    };
  }

  return null;
}

function upgradesMarkup(regionSnapshot) {
  const region = regionSnapshot.regionDef;
  const upgrades = prestigeUpgradesForRegion(region.id);

  return `
    <section class="card mol-upgrade-panel">
      <h4>${escapeHtml(region.label)} Upgrades</h4>
      <p><strong>${escapeHtml(region.pointLabel)}:</strong> ${escapeHtml(String(regionSnapshot.points))}</p>
      <div class="mol-upgrade-grid">
        ${upgrades.map((upgrade) => {
          const purchased = Number(regionSnapshot.upgrades[upgrade.id] || 0) > 0;
          const affordable = regionSnapshot.points >= upgrade.cost;
          return `
            <article class="mol-upgrade-card ${purchased ? "is-owned" : ""}">
              <h5>${escapeHtml(upgrade.label)}</h5>
              <p>${escapeHtml(upgrade.effect)}</p>
              <p><strong>Cost:</strong> ${escapeHtml(String(upgrade.cost))} ${escapeHtml(region.pointLabel)}</p>
              ${
                purchased
                  ? `<span class="mol-upgrade-owned">Unlocked</span>`
                  : `
                    <button
                      type="button"
                      data-node-id="${NODE_ID}"
                      data-node-action="mol03-buy-upgrade"
                      data-region-id="${escapeHtml(region.id)}"
                      data-upgrade-id="${escapeHtml(upgrade.id)}"
                      ${affordable ? "" : "disabled"}
                    >
                      Purchase
                    </button>
                  `
              }
            </article>
          `;
        }).join("")}
      </div>
      <div class="toolbar">
        <button type="button" class="ghost" data-node-id="${NODE_ID}" data-node-action="mol03-clear-focus">
          Back To Wheel
        </button>
      </div>
    </section>
  `;
}

export function renderMol03Experience(context) {
  const runtime = synchronizeMol03Runtime(context.runtime, { state: context.state });
  const selected = selectedRegionId(runtime);
  const selectedSnapshot = prestigeRegionSnapshot(context.state, selected);
  const focusedSnapshot = runtime.focusRegionId
    ? prestigeRegionSnapshot(context.state, runtime.focusRegionId)
    : null;

  return `
    <article class="mol03-node" data-node-id="${NODE_ID}">
      <section class="card mol-reset-head">
        <h3>Prestige Lattice</h3>
        <p>Spend prestige currencies to permanently amplify each region.</p>
      </section>
      ${wheelMarkup(runtime)}
      <section class="card mol-reset-region">
        <h4>${escapeHtml(selectedSnapshot.regionDef.label)}</h4>
        <p><strong>${escapeHtml(selectedSnapshot.regionDef.pointLabel)}:</strong> ${escapeHtml(String(selectedSnapshot.points))}</p>
        <p class="muted">Use arrows to cycle regions, then Enter to open upgrade lattice.</p>
      </section>
      ${focusedSnapshot ? upgradesMarkup(focusedSnapshot) : ""}
      ${runtime.lastMessage ? `<p class="key-hint">${escapeHtml(runtime.lastMessage)}</p>` : ""}
    </article>
  `;
}

export const MOL03_NODE_EXPERIENCE = {
  nodeId: NODE_ID,
  initialState: initialMol03Runtime,
  synchronizeRuntime: synchronizeMol03Runtime,
  render: renderMol03Experience,
  reduceRuntime: reduceMol03Runtime,
  validateRuntime: validateMol03Runtime,
  buildActionFromElement: buildMol03ActionFromElement,
  buildKeyAction: buildMol03KeyAction,
};
