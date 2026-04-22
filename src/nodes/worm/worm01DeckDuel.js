import { escapeHtml } from "../../templates/shared.js";
import { renderWormCard } from "./wormCardRenderer.js";
import { wormCardById } from "./wormData.js";
import {
  BASIC_HIRE_COST,
  SICKBAY_HEAL_FRACTION_PER_MINUTE,
  normalizeWormSystemState,
  wormDrawBasicWindowCard,
  wormOwnedCards,
  wormStarterDraftCards,
} from "../../systems/wormDeck.js";
import { prestigeModifiersFromState } from "../../systems/prestige.js";

const NODE_ID = "WORM01";
const PANELS = Object.freeze({
  deck: "deck",
  sickbay: "sickbay",
  jobs: "jobs",
});

function safeText(value) {
  return String(value == null ? "" : value).trim();
}

function normalizeRuntime(runtime) {
  const source = runtime && typeof runtime === "object" ? runtime : {};
  const panelCandidate = safeText(source.panel).toLowerCase();
  const panel = Object.values(PANELS).includes(panelCandidate) ? panelCandidate : PANELS.deck;

  const selectedStarterIds = Array.isArray(source.selectedStarterIds)
    ? source.selectedStarterIds.map((cardId) => safeText(cardId)).filter((cardId) => cardId).slice(0, 2)
    : [];

  return {
    panel,
    selectedStarterIds,
    lastPulledCardId: safeText(source.lastPulledCardId),
    solved: Boolean(source.solved),
    lastMessage: safeText(source.lastMessage),
  };
}

function hpSummary(currentHp, maxHp) {
  const percent = maxHp > 0 ? Math.round((Math.max(0, currentHp) / maxHp) * 100) : 0;
  return `${Math.max(0, Math.round(currentHp))}/${Math.max(1, Math.round(maxHp))} (${percent}%)`;
}

function minutesToFull(entry) {
  if (!entry) {
    return 0;
  }
  const remainingHp = Math.max(0, Number(entry.maxHp || 0) - Number(entry.currentHp || 0));
  if (!remainingHp) {
    return 0;
  }
  const healPerMinute = Math.max(1, Number(entry.maxHp || 0) * SICKBAY_HEAL_FRACTION_PER_MINUTE);
  return remainingHp / healPerMinute;
}

function formatCountdownFromMinutes(minutes) {
  const totalSeconds = Math.max(0, Math.ceil(Number(minutes || 0) * 60));
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

function starterDraftCardMarkup(card, selected) {
  return `
    <button
      type="button"
      class="worm01-starter-pick ${selected ? "is-selected" : ""}"
      data-node-id="${NODE_ID}"
      data-node-action="worm01-toggle-starter"
      data-card-id="${escapeHtml(card.id)}"
    >
      ${renderWormCard(card, { role: "player" })}
    </button>
  `;
}

function renderStarterDraft(runtime, wormState) {
  const starters = wormStarterDraftCards();
  const selectedSet = new Set(runtime.selectedStarterIds);
  const picked = runtime.selectedStarterIds.length;
  const canConfirm = picked === 2;

  return `
    <section class="card worm01-onboarding">
      <h3>The Undersiders' Loft</h3>
      <p>You are now managing a team of capes. Choose two starters to establish your first roster.</p>
      <p class="muted">Pick exactly two: Chubster, Chuckles, Cinderhands, Glace.</p>
      <div class="worm01-starter-grid">
        ${starters.map((card) => starterDraftCardMarkup(card, selectedSet.has(card.id))).join("")}
      </div>
      <div class="worm01-starter-footer">
        <p><strong>Selected:</strong> ${picked}/2</p>
        <button
          type="button"
          data-node-id="${NODE_ID}"
          data-node-action="worm01-confirm-starters"
          ${canConfirm ? "" : "disabled"}
        >
          Confirm Starters
        </button>
      </div>
      ${wormState.startersConfirmed ? `<p class="key-hint">Starters already locked in.</p>` : ""}
    </section>
  `;
}

function panelButton(panelId, active) {
  const label = panelId === PANELS.deck ? "Deck" : panelId === PANELS.sickbay ? "Sickbay" : "Job Board";
  return `
    <button
      type="button"
      class="${active ? "" : "ghost"}"
      data-node-id="${NODE_ID}"
      data-node-action="worm01-open-panel"
      data-panel="${escapeHtml(panelId)}"
    >
      ${escapeHtml(label)}
    </button>
  `;
}

function renderDeckPanel(ownedCards, wormState) {
  if (!ownedCards.length) {
    return `<section class="card"><p>No capes in deck.</p></section>`;
  }

  return `
    <section class="worm01-card-grid">
      ${ownedCards
    .map((entry) => {
      const canSickbay = entry.currentHp < entry.maxHp;
      const inSickbay = wormState.sickbayCardId === entry.cardId;
      const sickbayButton = inSickbay
        ? `
            <button
              type="button"
              class="ghost"
              data-node-id="${NODE_ID}"
              data-node-action="worm01-sickbay-remove"
            >
              Remove From Sickbay
            </button>
          `
        : `
            <button
              type="button"
              data-node-id="${NODE_ID}"
              data-node-action="worm01-sickbay-assign"
              data-card-id="${escapeHtml(entry.cardId)}"
              ${canSickbay ? "" : "disabled"}
            >
              Send To Sickbay
            </button>
          `;

      return `
          <article class="card worm01-deck-card">
            ${renderWormCard(
        {
          ...entry.card,
          heroName: `${entry.card.heroName} x${entry.copies}`,
        },
        {
          role: "player",
          combatant: {
            hp: entry.currentHp,
            maxHp: entry.maxHp,
            stats: {
              attack: entry.card.attack,
              defense: entry.card.defense,
              endurance: entry.card.endurance,
              info: entry.card.info,
              manipulation: entry.card.manipulation,
              range: entry.card.range,
              speed: entry.card.speed,
              stealth: entry.card.stealth,
            },
            modifiers: {},
            debuffs: {},
            guardCharges: 0,
            speedReady: false,
            stealthReady: false,
          },
        },
      )}
            <p class="muted">Health: ${escapeHtml(hpSummary(entry.currentHp, entry.maxHp))}</p>
            <div class="toolbar">${sickbayButton}</div>
          </article>
        `;
    })
    .join("")}
    </section>
  `;
}

function renderSickbayPanel(ownedCards, wormState) {
  const entry = ownedCards.find((item) => item.cardId === wormState.sickbayCardId) || null;
  if (!entry) {
    return `
      <section class="card">
        <h3>Sickbay</h3>
        <p>No cape currently assigned.</p>
        <p class="muted">Capes heal for 25% of max health every minute while in Sickbay.</p>
      </section>
    `;
  }

  const countdown = formatCountdownFromMinutes(minutesToFull(entry));
  const full = entry.currentHp >= entry.maxHp;
  return `
    <section class="card worm01-sickbay-panel">
      <h3>Sickbay</h3>
      ${renderWormCard(
    entry.card,
    {
      role: "player",
      combatant: {
        hp: entry.currentHp,
        maxHp: entry.maxHp,
        stats: {
          attack: entry.card.attack,
          defense: entry.card.defense,
          endurance: entry.card.endurance,
          info: entry.card.info,
          manipulation: entry.card.manipulation,
          range: entry.card.range,
          speed: entry.card.speed,
          stealth: entry.card.stealth,
        },
        modifiers: {},
        debuffs: {},
        guardCharges: 0,
        speedReady: false,
        stealthReady: false,
      },
    },
  )}
      <p><strong>Recovery:</strong> ${escapeHtml(hpSummary(entry.currentHp, entry.maxHp))}</p>
      <p><strong>Time To Full:</strong> ${full ? "Ready now" : escapeHtml(countdown)}</p>
      <div class="toolbar">
        <button type="button" class="ghost" data-node-id="${NODE_ID}" data-node-action="worm01-sickbay-remove">
          Remove From Sickbay
        </button>
      </div>
    </section>
  `;
}

function renderJobsPanel(runtime, wormState, weightBase) {
  const pulledCard = runtime.lastPulledCardId ? wormCardById(runtime.lastPulledCardId) : null;
  const canHire = Number(wormState.clout || 0) >= BASIC_HIRE_COST;
  return `
    <section class="card worm01-job-board">
      <h3>Job Board</h3>
      <p>Basic Hiring Window. Cost: <strong>${BASIC_HIRE_COST} Clout</strong>.</p>
      <p class="muted">Pulls capes of rarity 5 or lower, weighted toward more common underlings.</p>
      <div class="toolbar">
        <button type="button" data-node-id="${NODE_ID}" data-node-action="worm01-hire-basic" data-weight-base="${escapeHtml(String(weightBase))}" ${canHire ? "" : "disabled"}>
          Hire Underling
        </button>
      </div>
      ${pulledCard ? `<h4>Latest Pull</h4>${renderWormCard(pulledCard, { role: "player" })}` : ""}
    </section>
  `;
}

export function initialWorm01Runtime() {
  return normalizeRuntime({});
}

export function synchronizeWorm01Runtime(runtime, context) {
  const current = normalizeRuntime(runtime);
  const wormState = normalizeWormSystemState(context && context.state && context.state.systems ? context.state.systems.worm : {});
  if (!wormState.startersConfirmed) {
    return current;
  }

  return {
    ...current,
    solved: true,
  };
}

export function validateWorm01Runtime(runtime) {
  return Boolean(runtime && runtime.solved);
}

export function reduceWorm01Runtime(runtime, action) {
  const current = normalizeRuntime(runtime);
  if (!action || typeof action !== "object") {
    return current;
  }

  if (action.type === "worm01-toggle-starter") {
    const cardId = safeText(action.cardId);
    if (!cardId) {
      return current;
    }

    const selected = current.selectedStarterIds.slice();
    const existingIndex = selected.indexOf(cardId);
    if (existingIndex >= 0) {
      selected.splice(existingIndex, 1);
    } else if (selected.length < 2) {
      selected.push(cardId);
    }

    return {
      ...current,
      selectedStarterIds: selected,
    };
  }

  if (action.type === "worm01-confirm-starters") {
    const picked = Array.isArray(action.cardIds)
      ? action.cardIds.map((cardId) => safeText(cardId)).filter((cardId) => cardId)
      : [];
    const uniquePicked = picked.filter((cardId, index) => picked.indexOf(cardId) === index);
    if (uniquePicked.length !== 2) {
      return {
        ...current,
        lastMessage: "Choose exactly two starter capes.",
      };
    }
    return {
      ...current,
      solved: true,
      panel: PANELS.deck,
      selectedStarterIds: uniquePicked.slice(0, 2),
      lastMessage: "Starter roster confirmed.",
    };
  }

  if (action.type === "worm01-open-panel") {
    const panel = safeText(action.panel).toLowerCase();
    if (!Object.values(PANELS).includes(panel)) {
      return current;
    }
    return {
      ...current,
      panel,
    };
  }

  if (action.type === "worm01-hire-basic") {
    return {
      ...current,
      panel: PANELS.jobs,
      lastPulledCardId: safeText(action.pulledCardId),
    };
  }

  if (action.type === "worm01-sickbay-assign" || action.type === "worm01-sickbay-remove") {
    return {
      ...current,
      panel: PANELS.sickbay,
    };
  }

  return current;
}

export function buildWorm01ActionFromElement(element, runtime) {
  const actionName = element.getAttribute("data-node-action");
  if (!actionName) {
    return null;
  }

  if (actionName === "worm01-toggle-starter") {
    return {
      type: "worm01-toggle-starter",
      cardId: element.getAttribute("data-card-id") || "",
    };
  }

  if (actionName === "worm01-confirm-starters") {
    return {
      type: "worm01-confirm-starters",
      cardIds: normalizeRuntime(runtime).selectedStarterIds.slice(),
    };
  }

  if (actionName === "worm01-open-panel") {
    return {
      type: "worm01-open-panel",
      panel: element.getAttribute("data-panel") || "",
    };
  }

  if (actionName === "worm01-hire-basic") {
    const weightBase = Number(element.getAttribute("data-weight-base"));
    const pull = wormDrawBasicWindowCard({
      weightBase,
    });
    return {
      type: "worm01-hire-basic",
      pulledCardId: pull ? pull.id : "",
      weightBase,
    };
  }

  if (actionName === "worm01-sickbay-assign") {
    return {
      type: "worm01-sickbay-assign",
      cardId: element.getAttribute("data-card-id") || "",
    };
  }

  if (actionName === "worm01-sickbay-remove") {
    return {
      type: "worm01-sickbay-remove",
    };
  }

  return null;
}

export function renderWorm01Experience(context) {
  const runtime = normalizeRuntime(context.runtime);
  const wormState = normalizeWormSystemState(context.state.systems.worm, Date.now());
  const modifiers = prestigeModifiersFromState(context.state);
  const jobWeightBase = Number((0.125 * Math.max(1, Number(modifiers.worm.jobWeightBaseMultiplier || 1))).toFixed(4));
  const ownedCards = wormOwnedCards(wormState, Date.now());

  if (!wormState.startersConfirmed) {
    return `<article class="worm01-node" data-node-id="${NODE_ID}">${renderStarterDraft(runtime, wormState)}</article>`;
  }

  const panel = runtime.panel;
  const panelMarkup = panel === PANELS.sickbay
    ? renderSickbayPanel(ownedCards, wormState)
    : panel === PANELS.jobs
      ? renderJobsPanel(runtime, wormState, jobWeightBase)
      : renderDeckPanel(ownedCards, wormState);

  return `
    <article class="worm01-node" data-node-id="${NODE_ID}">
      <section class="card worm01-loft-header">
        <h3>The Undersiders' Loft</h3>
        <p><strong>Clout:</strong> ${escapeHtml(String(Number(wormState.clout || 0).toFixed(2)))}</p>
        <div class="toolbar">
          ${panelButton(PANELS.deck, panel === PANELS.deck)}
          ${panelButton(PANELS.sickbay, panel === PANELS.sickbay)}
          ${panelButton(PANELS.jobs, panel === PANELS.jobs)}
        </div>
      </section>
      ${panelMarkup}
      ${runtime.lastMessage ? `<p class="key-hint">${escapeHtml(runtime.lastMessage)}</p>` : ""}
    </article>
  `;
}

export const WORM01_NODE_EXPERIENCE = {
  nodeId: NODE_ID,
  initialState: initialWorm01Runtime,
  synchronizeRuntime: synchronizeWorm01Runtime,
  render: renderWorm01Experience,
  reduceRuntime: reduceWorm01Runtime,
  validateRuntime: validateWorm01Runtime,
  buildActionFromElement: buildWorm01ActionFromElement,
};
