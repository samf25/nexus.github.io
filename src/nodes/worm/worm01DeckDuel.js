import { escapeHtml } from "../../templates/shared.js";
import { exportNormalizedWormCsv, loadWormCardCatalog, wormCardById } from "./wormData.js";
import {
  createWormBattleState,
  infoDebuffStatKeys,
  resolveWormRound,
  selectableWormActions,
} from "./wormCombatSystem.js";
import { renderWormCard } from "./wormCardRenderer.js";

const NODE_ID = "WORM01";

const PLAYER_LOADOUT_KEYS = Object.freeze(["player-1", "player-2"]);
const ENEMY_LOADOUT_KEYS = Object.freeze(["enemy-1", "enemy-2"]);
const ACTION_LABELS = Object.freeze({
  attack: "Attack",
  defense: "Defense",
  info: "Info",
  manipulation: "Manip",
  speed: "Speed",
  stealth: "Stealth",
});

function safeText(value) {
  return String(value == null ? "" : value).trim();
}

function defaultLoadout(cards) {
  const ranked = cards.slice().sort((left, right) => right.rarity - left.rarity);
  const fallback = cards[0] || null;
  const ids = ranked.map((card) => card.id);
  return {
    player: [ids[0] || (fallback && fallback.id) || "", ids[1] || (fallback && fallback.id) || ""],
    enemy: [ids[2] || (fallback && fallback.id) || "", ids[3] || (fallback && fallback.id) || ""],
  };
}

function normalizeBattle(value) {
  return value && typeof value === "object" ? value : null;
}

function normalizeRuntime(runtime, cards) {
  const source = runtime && typeof runtime === "object" ? runtime : {};
  const fallback = defaultLoadout(cards);
  const ids = new Set(cards.map((card) => card.id));

  const pick = (candidate, index, team) => {
    const value = safeText(candidate);
    if (value && ids.has(value)) {
      return value;
    }
    return fallback[team][index] || "";
  };

  const playerLoadout = Array.isArray(source.playerLoadout) ? source.playerLoadout : [];
  const enemyLoadout = Array.isArray(source.enemyLoadout) ? source.enemyLoadout : [];

  return {
    playerLoadout: [
      pick(playerLoadout[0], 0, "player"),
      pick(playerLoadout[1], 1, "player"),
    ],
    enemyLoadout: [
      pick(enemyLoadout[0], 0, "enemy"),
      pick(enemyLoadout[1], 1, "enemy"),
    ],
    battle: normalizeBattle(source.battle),
    solved: Boolean(source.solved),
    lastMessage: safeText(source.lastMessage),
  };
}

function loadoutCards(loadoutIds) {
  return loadoutIds
    .map((cardId) => wormCardById(cardId))
    .filter((card) => card && typeof card === "object");
}

function optionMarkup(card, selectedId) {
  return `
    <option value="${escapeHtml(card.id)}" ${card.id === selectedId ? "selected" : ""}>
      ${escapeHtml(card.heroName)} (R ${escapeHtml(card.rarity.toFixed(1))})
    </option>
  `;
}

function loadoutSelectMarkup(cards, key, selectedId) {
  return `
    <label>
      <span>${escapeHtml(key.toUpperCase())}</span>
      <select data-worm-loadout="${escapeHtml(key)}">
        ${cards.map((card) => optionMarkup(card, selectedId)).join("")}
      </select>
    </label>
  `;
}

function teamCardsMarkup(team, role) {
  return team
    .map((combatant) =>
      renderWormCard(
        {
          heroName: combatant.heroName,
          power: combatant.power,
          powerFull: combatant.powerFull || combatant.power,
          attack: combatant.stats.attack,
          defense: combatant.stats.defense,
          endurance: combatant.stats.endurance,
          info: combatant.stats.info,
          manipulation: combatant.stats.manipulation,
          range: combatant.stats.range,
          speed: combatant.stats.speed,
          stealth: combatant.stats.stealth,
          rarity: combatant.rarity,
          rarityTier: combatant.rarityTier,
        },
        {
          combatant,
          role,
        },
      ),
    )
    .join("");
}

function playerOrderMarkup(combatant, enemyTeam) {
  const aliveEnemies = enemyTeam.filter((enemy) => enemy.hp > 0);
  const actionOptions = selectableWormActions()
    .map(
      (action) =>
        `<option value="${escapeHtml(action)}">${escapeHtml(ACTION_LABELS[action] || action)}</option>`,
    )
    .join("");
  const targetOptions = aliveEnemies
    .map(
      (enemy) =>
        `<option value="${escapeHtml(enemy.combatantId)}">${escapeHtml(enemy.heroName)}</option>`,
    )
    .join("");
  const infoOptions = infoDebuffStatKeys()
    .map(
      (statKey) =>
        `<option value="${escapeHtml(statKey)}">${escapeHtml(statKey.toUpperCase())}</option>`,
    )
    .join("");

  return `
    <article class="worm01-order-row" data-worm-order-row data-actor-id="${escapeHtml(combatant.combatantId)}">
      <h4>${escapeHtml(combatant.heroName)}</h4>
      <label>
        <span>Action</span>
        <select data-worm-order-type>
          ${actionOptions}
        </select>
      </label>
      <label>
        <span>Target</span>
        <select data-worm-order-target>
          ${targetOptions}
        </select>
      </label>
      <label>
        <span>Info Debuff</span>
        <select data-worm-order-info>
          ${infoOptions}
        </select>
      </label>
    </article>
  `;
}

function battleMarkup(runtime) {
  const battle = runtime.battle;
  if (!battle) {
    return "";
  }

  const playerTeam = Array.isArray(battle.playerTeam) ? battle.playerTeam : [];
  const enemyTeam = Array.isArray(battle.enemyTeam) ? battle.enemyTeam : [];
  const playerAlive = playerTeam.filter((combatant) => combatant.hp > 0);
  const canResolve = !battle.winner && playerAlive.length > 0;

  return `
    <section class="worm01-battle">
      <header class="worm01-battle-header">
        <p><strong>Round:</strong> ${escapeHtml(String(battle.round || 1))}</p>
        <p><strong>Status:</strong> ${
          battle.winner
            ? escapeHtml(`${battle.winner === "player" ? "Player" : battle.winner === "enemy" ? "Enemy" : "Draw"} victory`)
            : "In progress"
        }</p>
      </header>

      <section class="worm01-board worm01-board-lanes">
        <section class="worm01-team-column worm01-team-column-player">
          <h3>Player Team</h3>
          <div class="worm01-card-grid">
            ${teamCardsMarkup(playerTeam, "player")}
          </div>
        </section>
        <section class="worm01-center-column">
          <section class="worm01-controls">
            <h3>Turn Orders</h3>
            <div class="worm01-order-grid">
              ${playerAlive.map((combatant) => playerOrderMarkup(combatant, enemyTeam)).join("")}
            </div>
            <div class="toolbar">
              <button type="button" data-node-id="${NODE_ID}" data-node-action="worm-resolve-round" ${canResolve ? "" : "disabled"}>Resolve Turn</button>
              <button type="button" class="ghost" data-node-id="${NODE_ID}" data-node-action="worm-reset-battle">Reset Battle</button>
            </div>
          </section>
          <section class="card worm01-feed">
            <h3>Combat Feed</h3>
            <div class="worm01-feed-scroll">
              <ul class="worm01-feed-list">
                ${(battle.log || []).slice().reverse().map((line) => `<li>${escapeHtml(line)}</li>`).join("")}
              </ul>
            </div>
          </section>
        </section>
        <section class="worm01-team-column worm01-team-column-enemy">
          <h3>Enemy Team</h3>
          <div class="worm01-card-grid">
            ${teamCardsMarkup(enemyTeam, "enemy")}
          </div>
        </section>
      </section>
    </section>
  `;
}

function downloadNormalizedCsv() {
  if (typeof document === "undefined" || typeof window === "undefined") {
    return;
  }

  const csvText = exportNormalizedWormCsv(loadWormCardCatalog());
  const blob = new Blob([csvText], { type: "text/csv" });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "WormCards.csv";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
}

export function initialWorm01Runtime() {
  const cards = loadWormCardCatalog();
  const defaults = defaultLoadout(cards);
  return {
    playerLoadout: defaults.player,
    enemyLoadout: defaults.enemy,
    battle: null,
    solved: false,
    lastMessage: "",
  };
}

export function validateWorm01Runtime(runtime) {
  return Boolean(runtime && runtime.solved);
}

export function reduceWorm01Runtime(runtime, action) {
  const cards = loadWormCardCatalog();
  const current = normalizeRuntime(runtime, cards);
  if (!action || typeof action !== "object") {
    return current;
  }

  if (action.type === "worm-start-battle") {
    const playerIds = Array.isArray(action.playerIds) ? action.playerIds.map((id) => safeText(id)) : [];
    const enemyIds = Array.isArray(action.enemyIds) ? action.enemyIds.map((id) => safeText(id)) : [];
    const nextRuntime = normalizeRuntime(
      {
        ...current,
        playerLoadout: [playerIds[0] || current.playerLoadout[0], playerIds[1] || current.playerLoadout[1]],
        enemyLoadout: [enemyIds[0] || current.enemyLoadout[0], enemyIds[1] || current.enemyLoadout[1]],
      },
      cards,
    );

    const battle = createWormBattleState({
      playerCards: loadoutCards(nextRuntime.playerLoadout),
      enemyCards: loadoutCards(nextRuntime.enemyLoadout),
      seed: Date.now() >>> 0,
    });

    return {
      ...nextRuntime,
      battle,
      solved: false,
      lastMessage: "Battle initialized.",
    };
  }

  if (action.type === "worm-resolve-round") {
    if (!current.battle || current.battle.winner) {
      return current;
    }

    const orders = action.orders && typeof action.orders === "object" ? action.orders : {};
    const nextBattle = resolveWormRound(current.battle, {
      playerOrders: orders,
    });
    const solved = nextBattle.winner === "player";

    return {
      ...current,
      battle: nextBattle,
      solved,
      lastMessage: nextBattle.winner
        ? nextBattle.winner === "player"
          ? "Player team won the simulation."
          : nextBattle.winner === "enemy"
            ? "Enemy team won the simulation."
            : "The simulation ended in a draw."
        : current.lastMessage,
    };
  }

  if (action.type === "worm-reset-battle") {
    return {
      ...current,
      battle: null,
      solved: false,
      lastMessage: "",
    };
  }

  return current;
}

export function buildWorm01ActionFromElement(element) {
  const actionName = element.getAttribute("data-node-action");
  if (!actionName) {
    return null;
  }

  const surface = element.closest(".worm01-node");
  if (!surface) {
    return null;
  }

  if (actionName === "worm-download-csv") {
    downloadNormalizedCsv();
    return null;
  }

  if (actionName === "worm-start-battle") {
    const pick = (key) => {
      const input = surface.querySelector(`select[data-worm-loadout="${key}"]`);
      return input && "value" in input ? safeText(input.value) : "";
    };

    return {
      type: "worm-start-battle",
      playerIds: PLAYER_LOADOUT_KEYS.map((key) => pick(key)),
      enemyIds: ENEMY_LOADOUT_KEYS.map((key) => pick(key)),
    };
  }

  if (actionName === "worm-resolve-round") {
    const rows = [...surface.querySelectorAll("[data-worm-order-row]")];
    const orders = {};
    for (const row of rows) {
      const actorId = safeText(row.getAttribute("data-actor-id"));
      if (!actorId) {
        continue;
      }

      const typeInput = row.querySelector("[data-worm-order-type]");
      const targetInput = row.querySelector("[data-worm-order-target]");
      const infoInput = row.querySelector("[data-worm-order-info]");
      orders[actorId] = {
        type: typeInput && "value" in typeInput ? safeText(typeInput.value) : "attack",
        targetId: targetInput && "value" in targetInput ? safeText(targetInput.value) : "",
        infoStat: infoInput && "value" in infoInput ? safeText(infoInput.value) : "attack",
      };
    }

    return {
      type: "worm-resolve-round",
      orders,
    };
  }

  if (actionName === "worm-reset-battle") {
    return {
      type: "worm-reset-battle",
    };
  }

  return null;
}

export function renderWorm01Experience(context) {
  const cards = loadWormCardCatalog();
  const runtime = normalizeRuntime(context.runtime, cards);
  const sortedCards = cards.slice().sort((left, right) => right.rarity - left.rarity);

  if (!cards.length) {
    return `
      <article class="worm01-node" data-node-id="${NODE_ID}">
        <section class="card note">
          <p>WORM card data is unavailable.</p>
        </section>
      </article>
    `;
  }

  return `
    <article class="worm01-node" data-node-id="${NODE_ID}">
      <section class="card worm01-setup">
        <h3>WORM Combat Sandbox</h3>
        <p>2v2 card simulation using Attack, Defense, Endurance, Information Gathering, Manipulation, Range, Speed, and Stealth.</p>
        <div class="worm01-loadout-grid">
          ${loadoutSelectMarkup(sortedCards, PLAYER_LOADOUT_KEYS[0], runtime.playerLoadout[0])}
          ${loadoutSelectMarkup(sortedCards, PLAYER_LOADOUT_KEYS[1], runtime.playerLoadout[1])}
          ${loadoutSelectMarkup(sortedCards, ENEMY_LOADOUT_KEYS[0], runtime.enemyLoadout[0])}
          ${loadoutSelectMarkup(sortedCards, ENEMY_LOADOUT_KEYS[1], runtime.enemyLoadout[1])}
        </div>
        <div class="toolbar">
          <button type="button" data-node-id="${NODE_ID}" data-node-action="worm-start-battle">Start 2v2 Simulation</button>
          <button type="button" class="ghost" data-node-id="${NODE_ID}" data-node-action="worm-download-csv">Download Normalized CSV</button>
        </div>
      </section>

      ${battleMarkup(runtime)}

      ${runtime.lastMessage ? `<p class="key-hint">${escapeHtml(runtime.lastMessage)}</p>` : ""}
    </article>
  `;
}

export const WORM01_NODE_EXPERIENCE = {
  nodeId: NODE_ID,
  initialState: initialWorm01Runtime,
  render: renderWorm01Experience,
  reduceRuntime: reduceWorm01Runtime,
  validateRuntime: validateWorm01Runtime,
  buildActionFromElement: buildWorm01ActionFromElement,
};
