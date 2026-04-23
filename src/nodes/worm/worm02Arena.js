import { escapeHtml } from "../../templates/shared.js";
import { createWormBattleState, infoDebuffStatKeys, resolveWormRound, selectableWormActions } from "./wormCombatSystem.js";
import { renderWormCard } from "./wormCardRenderer.js";
import { wormCardById } from "./wormData.js";
import { normalizeWormSystemState, wormDrawWindowPack, wormOwnedCards } from "../../systems/wormDeck.js";
import { prestigeModifiersFromState } from "../../systems/prestige.js";

const NODE_ID = "WORM02";
const ACTION_LABELS = Object.freeze({
  attack: "Attack",
  defense: "Defense",
  info: "Info",
  manipulation: "Manipulation",
  speed: "Speed",
  stealth: "Stealth",
});

const BATTLE_DIFFICULTY_CONFIG = Object.freeze({
  easy: Object.freeze({
    label: "Easy",
    drawWeightBase: 0.125,
  }),
  medium: Object.freeze({
    label: "Medium",
    drawWeightBase: 0.5,
  }),
  hard: Object.freeze({
    label: "Hard",
    drawWeightBase: 2,
  }),
});

function safeText(value) {
  return String(value == null ? "" : value).trim();
}

function normalizeDifficulty(value) {
  const difficulty = safeText(value).toLowerCase();
  return Object.prototype.hasOwnProperty.call(BATTLE_DIFFICULTY_CONFIG, difficulty) ? difficulty : "easy";
}

function normalizeBattle(value) {
  return value && typeof value === "object" ? value : null;
}

function normalizeRuntime(runtime) {
  const source = runtime && typeof runtime === "object" ? runtime : {};
  return {
    playerLoadout: Array.isArray(source.playerLoadout)
      ? source.playerLoadout.map((cardId) => safeText(cardId)).slice(0, 2)
      : [],
    battle: normalizeBattle(source.battle),
    battleMode: safeText(source.battleMode || "normal").toLowerCase() === "boss" ? "boss" : "normal",
    battleDifficulty: normalizeDifficulty(source.battleDifficulty),
    enemyRarities: Array.isArray(source.enemyRarities)
      ? source.enemyRarities.slice(0, 2).map((rarity) => Number(rarity) || 0)
      : [],
    orderPrefs:
      source.orderPrefs && typeof source.orderPrefs === "object"
        ? source.orderPrefs
        : {},
    helpOpen: Boolean(source.helpOpen),
    lootEvents: Array.isArray(source.lootEvents) ? source.lootEvents.filter((entry) => entry && typeof entry === "object") : [],
    bossDefeated: Boolean(source.bossDefeated),
    solved: Boolean(source.bossDefeated),
    lastMessage: safeText(source.lastMessage),
  };
}

function ensureLoadout(runtime, ownedCardIds) {
  const uniqueOwned = ownedCardIds.filter((cardId, index, list) => cardId && list.indexOf(cardId) === index);
  const fallback = uniqueOwned.slice(0, 2);
  const selected = (runtime.playerLoadout || []).filter((cardId) => uniqueOwned.includes(cardId)).slice(0, 2);

  while (selected.length < 2 && fallback[selected.length]) {
    selected.push(fallback[selected.length]);
  }

  if (selected.length < 2 && uniqueOwned.length >= 2) {
    return uniqueOwned.slice(0, 2);
  }
  return selected;
}

function optionMarkup(entry, selectedId) {
  return `
    <option
      value="${escapeHtml(entry.cardId)}"
      data-current-hp="${escapeHtml(String(Math.max(0, Math.round(Number(entry.currentHp || 0)))))}"
      ${entry.cardId === selectedId ? "selected" : ""}
    >
      ${escapeHtml(entry.card.heroName)} (R ${escapeHtml(entry.card.rarity.toFixed(1))})
    </option>
  `;
}

function loadoutSelectMarkup(ownedCards, slot, selectedId) {
  return `
    <label>
      <span>${escapeHtml(slot)}</span>
      <select data-worm02-loadout="${escapeHtml(slot)}">
        ${ownedCards.map((entry) => optionMarkup(entry, selectedId)).join("")}
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

function normalizePreferenceForActor(combatant, enemyTeam, preference) {
  const preferredType = safeText(preference && preference.type).toLowerCase();
  const actionType = selectableWormActions().includes(preferredType) ? preferredType : "attack";
  const preferredTarget = safeText(preference && preference.targetId);
  const targetId = enemyTeam.some((enemy) => enemy.combatantId === preferredTarget)
    ? preferredTarget
    : enemyTeam[0]
      ? enemyTeam[0].combatantId
      : "";
  const preferredInfo = safeText(preference && preference.infoStat).toLowerCase();
  const infoStat = infoDebuffStatKeys().includes(preferredInfo) ? preferredInfo : "attack";

  return {
    actorId: combatant.combatantId,
    type: actionType,
    targetId,
    infoStat,
  };
}

function playerOrderMarkup(combatant, enemyTeam, preference) {
  const aliveEnemies = enemyTeam.filter((enemy) => enemy.hp > 0);
  const normalized = normalizePreferenceForActor(combatant, aliveEnemies, preference);
  const actionOptions = selectableWormActions()
    .map(
      (action) =>
        `<option value="${escapeHtml(action)}" ${action === normalized.type ? "selected" : ""}>${escapeHtml(ACTION_LABELS[action] || action)}</option>`,
    )
    .join("");
  const targetOptions = aliveEnemies
    .map(
      (enemy) =>
        `<option value="${escapeHtml(enemy.combatantId)}" ${enemy.combatantId === normalized.targetId ? "selected" : ""}>${escapeHtml(enemy.heroName)}</option>`,
    )
    .join("");
  const infoOptions = infoDebuffStatKeys()
    .map(
      (statKey) =>
        `<option value="${escapeHtml(statKey)}" ${statKey === normalized.infoStat ? "selected" : ""}>${escapeHtml(statKey.toUpperCase())}</option>`,
    )
    .join("");

  return `
    <article class="worm02-order-row" data-worm02-order-row data-actor-id="${escapeHtml(combatant.combatantId)}">
      <h4>${escapeHtml(combatant.heroName)}</h4>
      <label>
        <span>Action</span>
        <select data-worm02-order-type>
          ${actionOptions}
        </select>
      </label>
      <label>
        <span>Target</span>
        <select data-worm02-order-target>
          ${targetOptions}
        </select>
      </label>
      <label data-worm02-info-wrap ${normalized.type === "info" ? "" : "hidden"}>
        <span>Info Debuff</span>
        <select data-worm02-order-info>
          ${infoOptions}
        </select>
      </label>
    </article>
  `;
}

function battleMarkup(runtime, cloutMultiplier) {
  const battle = runtime.battle;
  if (!battle) {
    return "";
  }

  const playerTeam = Array.isArray(battle.playerTeam) ? battle.playerTeam : [];
  const enemyTeam = Array.isArray(battle.enemyTeam) ? battle.enemyTeam : [];
  const playerAlive = playerTeam.filter((combatant) => combatant.hp > 0);
  const canResolve = !battle.winner && playerAlive.length > 0;
  const winnerLabel = battle.winner
    ? battle.winner === "player"
      ? "Player victory"
      : battle.winner === "enemy"
        ? "Enemy victory"
        : "Draw"
    : "In progress";

  return `
    <section class="worm02-battle">
      <header class="worm02-battle-header">
        <p><strong>Round:</strong> ${escapeHtml(String(battle.round || 1))}</p>
        <p><strong>Status:</strong> ${escapeHtml(winnerLabel)}</p>
      </header>

      <section class="worm02-board worm02-board-lanes">
        <section class="worm02-team-column">
          <h3>Player Team</h3>
          <div class="worm02-card-grid">
            ${teamCardsMarkup(playerTeam, "player")}
          </div>
        </section>

        <section class="worm02-center-column">
          <section class="worm02-controls">
            <h3>Turn Orders</h3>
            <div class="worm02-order-grid">
              ${playerAlive
    .map((combatant) => playerOrderMarkup(combatant, enemyTeam, runtime.orderPrefs[combatant.combatantId] || null))
    .join("")}
            </div>
            <div class="toolbar">
              <button type="button" data-node-id="${NODE_ID}" data-node-action="worm02-resolve-round" ${canResolve ? "" : "disabled"}>
                Resolve Turn
              </button>
              <button type="button" class="ghost" data-node-id="${NODE_ID}" data-node-action="worm02-reset-battle">
                Abandon Battle
              </button>
              <button type="button" data-node-id="${NODE_ID}" data-node-action="worm02-claim-outcome" data-clout-multiplier="${escapeHtml(String(cloutMultiplier))}" ${battle.winner ? "" : "disabled"}>
                Claim Outcome
              </button>
            </div>
          </section>
          <section class="card worm02-feed">
            <h3>Combat Feed</h3>
            <div class="worm02-feed-scroll">
              <ul class="worm02-feed-list">
                ${(battle.log || []).slice().reverse().map((line) => `<li>${escapeHtml(line)}</li>`).join("")}
              </ul>
            </div>
          </section>
        </section>

        <section class="worm02-team-column">
          <h3>Enemy Team</h3>
          <div class="worm02-card-grid">
            ${teamCardsMarkup(enemyTeam, "enemy")}
          </div>
        </section>
      </section>
    </section>
  `;
}

function normalizeOrderPrefs(orders, battle) {
  const next = {};
  const source = orders && typeof orders === "object" ? orders : {};
  const validTypes = selectableWormActions();
  const validInfo = infoDebuffStatKeys();
  const playerTeam = battle && Array.isArray(battle.playerTeam) ? battle.playerTeam : [];
  const enemyTeam = battle && Array.isArray(battle.enemyTeam) ? battle.enemyTeam.filter((c) => c.hp > 0) : [];
  const defaultTarget = enemyTeam[0] ? enemyTeam[0].combatantId : "";

  for (const combatant of playerTeam) {
    const actorId = safeText(combatant.combatantId);
    if (!actorId) {
      continue;
    }
    const pref = source[actorId] && typeof source[actorId] === "object" ? source[actorId] : {};
    const type = validTypes.includes(safeText(pref.type).toLowerCase()) ? safeText(pref.type).toLowerCase() : "attack";
    const targetId = enemyTeam.some((enemy) => enemy.combatantId === safeText(pref.targetId))
      ? safeText(pref.targetId)
      : defaultTarget;
    const infoStat = validInfo.includes(safeText(pref.infoStat).toLowerCase()) ? safeText(pref.infoStat).toLowerCase() : "attack";

    next[actorId] = {
      type,
      targetId,
      infoStat,
    };
  }

  return next;
}

export function initialWorm02Runtime() {
  return normalizeRuntime({});
}

export function synchronizeWorm02Runtime(runtime, context) {
  const current = normalizeRuntime(runtime);
  const wormState = normalizeWormSystemState(
    context && context.state && context.state.systems ? context.state.systems.worm : {},
    Date.now(),
  );
  const owned = wormOwnedCards(wormState, Date.now());
  const ownedIds = owned.map((entry) => entry.cardId);
  return {
    ...current,
    playerLoadout: ensureLoadout(current, ownedIds),
    battleDifficulty: normalizeDifficulty(current.battleDifficulty),
  };
}

export function validateWorm02Runtime(runtime) {
  return Boolean(runtime && runtime.bossDefeated);
}

function applyCardBonus(card, bonus) {
  const source = bonus && typeof bonus === "object" ? bonus : {};
  const keys = ["attack", "defense", "endurance", "info", "manipulation", "range", "speed", "stealth"];
  const next = { ...card };
  for (const key of keys) {
    next[key] = Math.max(0, Number(card[key] || 0) + Math.max(0, Number(source[key] || 0)));
  }
  return next;
}

function loadoutCards(cardPayload, bonusesByCardId = {}) {
  return (cardPayload || [])
    .map((entry) => {
      const cardId = safeText(entry && entry.cardId);
      if (!cardId) {
        return null;
      }
      const card = wormCardById(cardId);
      if (!card) {
        return null;
      }
      const currentHp = Number(entry && entry.currentHp);
      const resolved = {
        ...card,
        currentHp: Number.isFinite(currentHp) ? Math.max(0, Math.round(currentHp)) : undefined,
      };
      return applyCardBonus(resolved, bonusesByCardId[cardId] || null);
    })
    .filter((card) => card && typeof card === "object")
    .slice(0, 2);
}

export function reduceWorm02Runtime(runtime, action) {
  const current = normalizeRuntime(runtime);
  if (!action || typeof action !== "object") {
    return current;
  }

  if (action.type === "worm02-toggle-help") {
    return {
      ...current,
      helpOpen: !current.helpOpen,
    };
  }

  if (action.type === "worm02-start-normal") {
    const requestedPlayerCards = Array.isArray(action.playerCards)
      ? action.playerCards
      : [];
    const requestedLoadout = requestedPlayerCards.length
      ? requestedPlayerCards.map((entry) => safeText(entry.cardId)).slice(0, 2)
      : current.playerLoadout;
    const bonusesByCardId = action.capeBonusesByCardId && typeof action.capeBonusesByCardId === "object"
      ? action.capeBonusesByCardId
      : {};
    const playerCards = requestedPlayerCards.length
      ? loadoutCards(requestedPlayerCards, bonusesByCardId)
      : loadoutCards(requestedLoadout.map((cardId) => ({ cardId })), bonusesByCardId);
    const enemyCards = (Array.isArray(action.enemyCardIds) ? action.enemyCardIds : [])
      .map((cardId) => wormCardById(cardId))
      .filter((card) => card)
      .slice(0, 2);

    if (playerCards.length < 2 || enemyCards.length < 2) {
      return {
        ...current,
        lastMessage: "A full two-cape matchup is required.",
      };
    }

    const difficulty = normalizeDifficulty(action.difficulty);
    return {
      ...current,
      playerLoadout: requestedLoadout,
      battle: createWormBattleState({
        playerCards,
        enemyCards,
        seed: Date.now() >>> 0,
        enemyAiMode: safeText(action.enemyAiMode) || "weighted",
      }),
      battleMode: "normal",
      battleDifficulty: difficulty,
      enemyRarities: enemyCards.map((card) => Number(card.rarity || 0)).slice(0, 2),
      lastMessage: `${BATTLE_DIFFICULTY_CONFIG[difficulty].label} arena battle initialized.`,
    };
  }

  if (action.type === "worm02-start-boss") {
    return {
      ...current,
      lastMessage: "Arena Boss is not implemented yet.",
    };
  }

  if (action.type === "worm02-resolve-round") {
    if (!current.battle || current.battle.winner) {
      return current;
    }

    const orders = action.orders && typeof action.orders === "object" ? action.orders : {};
    const nextBattle = resolveWormRound(current.battle, {
      playerOrders: orders,
    });

    return {
      ...current,
      battle: nextBattle,
      orderPrefs: normalizeOrderPrefs(orders, nextBattle),
      lastMessage: nextBattle.winner
        ? nextBattle.winner === "player"
          ? "Battle won. Claim your outcome."
          : nextBattle.winner === "enemy"
            ? "Battle lost. Claim your outcome."
            : "Battle ended in a draw."
        : current.lastMessage,
    };
  }

  if (action.type === "worm02-claim-outcome") {
    const winner = safeText(action.winner).toLowerCase();
    const mode = safeText(action.mode).toLowerCase();
    const solvedNow = mode === "boss" && winner === "player";
    const lootEvents =
      mode === "normal" && winner === "player"
        ? [
            {
              sourceRegion: "worm",
              triggerType: "arena-victory",
              dropChance: 0.25,
              outRegionChance: 0.5,
              rarityBias: 0.2,
            },
          ]
        : [];
    return {
      ...current,
      bossDefeated: current.bossDefeated || solvedNow,
      solved: current.bossDefeated || solvedNow,
      battle: null,
      lootEvents,
      lastMessage: winner === "player" ? "Outcome claimed. Clout awarded." : "Outcome claimed.",
    };
  }

  if (action.type === "worm02-reset-battle") {
    return {
      ...current,
      battle: null,
      lastMessage: "Battle abandoned.",
    };
  }

  return current;
}

export function buildWorm02ActionFromElement(element, runtime) {
  const actionName = element.getAttribute("data-node-action");
  if (!actionName) {
    return null;
  }

  const surface = element.closest(".worm02-node");
  if (!surface) {
    return null;
  }

  if (actionName === "worm02-toggle-help") {
    return {
      type: "worm02-toggle-help",
    };
  }

  if (actionName === "worm02-start-normal") {
    const difficulty = normalizeDifficulty(element.getAttribute("data-difficulty"));
    const config = BATTLE_DIFFICULTY_CONFIG[difficulty];
    const enemyCards = wormDrawWindowPack(2, {
      weightBase: config.drawWeightBase,
      maxRarity: 5,
    });

    const pick = (slot) => {
      const select = surface.querySelector(`select[data-worm02-loadout="${slot}"]`);
      if (!select || !("value" in select)) {
        return { cardId: "", currentHp: 0 };
      }
      const cardId = safeText(select.value);
      const option = select.selectedOptions && select.selectedOptions[0] ? select.selectedOptions[0] : null;
      const currentHp = option ? Number(option.getAttribute("data-current-hp")) : 0;
      return {
        cardId,
        currentHp: Number.isFinite(currentHp) ? currentHp : 0,
      };
    };

    return {
      type: "worm02-start-normal",
      enemyCardIds: enemyCards.map((card) => card.id),
      playerCards: [pick("slot-1"), pick("slot-2")],
      difficulty,
      enemyAiMode: "weighted",
    };
  }

  if (actionName === "worm02-start-boss") {
    return {
      type: "worm02-start-boss",
    };
  }

  if (actionName === "worm02-resolve-round") {
    const rows = [...surface.querySelectorAll("[data-worm02-order-row]")];
    const orders = {};
    for (const row of rows) {
      const actorId = safeText(row.getAttribute("data-actor-id"));
      if (!actorId) {
        continue;
      }

      const typeInput = row.querySelector("[data-worm02-order-type]");
      const targetInput = row.querySelector("[data-worm02-order-target]");
      const infoInput = row.querySelector("[data-worm02-order-info]");
      orders[actorId] = {
        type: typeInput && "value" in typeInput ? safeText(typeInput.value) : "attack",
        targetId: targetInput && "value" in targetInput ? safeText(targetInput.value) : "",
        infoStat: infoInput && "value" in infoInput ? safeText(infoInput.value) : "attack",
      };
    }

    return {
      type: "worm02-resolve-round",
      orders,
    };
  }

  if (actionName === "worm02-reset-battle") {
    return {
      type: "worm02-reset-battle",
    };
  }

  if (actionName === "worm02-claim-outcome") {
    const current = normalizeRuntime(runtime);
    if (!current.battle || !current.battle.winner) {
      return null;
    }

    const playerResults = (current.battle.playerTeam || []).map((combatant) => ({
      cardId: combatant.cardId,
      hp: combatant.hp,
    }));
    return {
      type: "worm02-claim-outcome",
      mode: current.battleMode,
      difficulty: current.battleDifficulty,
      winner: current.battle.winner,
      cloutMultiplier: Number(element.getAttribute("data-clout-multiplier")) || 1,
      enemyRarities: current.enemyRarities.slice(0, 2),
      playerResults,
    };
  }

  return null;
}

export function renderWorm02Experience(context) {
  const runtime = normalizeRuntime(context.runtime);
  const wormState = normalizeWormSystemState(context.state.systems.worm, Date.now());
  const modifiers = prestigeModifiersFromState(context.state);
  const cloutMultiplier = Math.max(1, Number(modifiers.worm.cloutGainMultiplier || 1));
  const owned = wormOwnedCards(wormState, Date.now());
  const loadout = ensureLoadout(runtime, owned.map((entry) => entry.cardId));
  const canBattle = owned.length >= 2;
  const battleLocked = Boolean(runtime.battle && !runtime.battle.winner);
  const difficulty = normalizeDifficulty(runtime.battleDifficulty);

  const setupMarkup = `
    <section class="card worm02-setup">
      <h3>The Arena</h3>
      <p><strong>Clout:</strong> ${escapeHtml(String(Number(wormState.clout || 0).toFixed(2)))}</p>
      ${canBattle
    ? `
            <div class="worm02-loadout-grid">
              ${loadoutSelectMarkup(owned, "slot-1", loadout[0] || "")}
              ${loadoutSelectMarkup(owned, "slot-2", loadout[1] || "")}
            </div>
            <div class="toolbar">
              <button type="button" data-node-id="${NODE_ID}" data-node-action="worm02-start-normal" data-difficulty="easy" ${battleLocked ? "disabled" : ""}>
                Easy Battle
              </button>
              <button type="button" data-node-id="${NODE_ID}" data-node-action="worm02-start-normal" data-difficulty="medium" ${battleLocked ? "disabled" : ""}>
                Medium Battle
              </button>
              <button type="button" data-node-id="${NODE_ID}" data-node-action="worm02-start-normal" data-difficulty="hard" ${battleLocked ? "disabled" : ""}>
                Hard Battle
              </button>
              <button type="button" class="ghost" data-node-id="${NODE_ID}" data-node-action="worm02-start-boss" ${battleLocked ? "disabled" : ""}>
                Fight Arena Boss
              </button>
            </div>
          `
    : `<p>You need at least 2 capes in your deck to enter the Arena.</p>`}
      <p class="muted">Current mode: ${escapeHtml(BATTLE_DIFFICULTY_CONFIG[difficulty].label)}.</p>
    </section>
  `;

  const helpMarkup = runtime.helpOpen
    ? `
        <section class="card worm02-help">
          <h4>Combat Actions</h4>
          <ul>
            <li><strong>Attack:</strong> Standard strike focused on direct damage.</li>
            <li><strong>Defense:</strong> Takes aggro and protects your teammate from the next incoming hit.</li>
            <li><strong>Info:</strong> Reads the opponent and reduces one of their stats for this battle.</li>
            <li><strong>Manipulation:</strong> Twists the opponent's next attack back onto their own team.</li>
            <li><strong>Speed:</strong> Prepares a dodge against the next action targeting this cape.</li>
            <li><strong>Stealth:</strong> Sets up a stronger next attack from concealment.</li>
          </ul>
        </section>
      `
    : "";

  return `
    <article class="worm02-node" data-node-id="${NODE_ID}">
      <button type="button" class="worm02-help-toggle" data-node-id="${NODE_ID}" data-node-action="worm02-toggle-help" aria-label="Combat help">
        ?
      </button>
      ${setupMarkup}
      ${helpMarkup}
      ${battleMarkup({ ...runtime, playerLoadout: loadout }, cloutMultiplier)}
    </article>
  `;
}

export const WORM02_NODE_EXPERIENCE = {
  nodeId: NODE_ID,
  initialState: initialWorm02Runtime,
  synchronizeRuntime: synchronizeWorm02Runtime,
  render: renderWorm02Experience,
  reduceRuntime: reduceWorm02Runtime,
  validateRuntime: validateWorm02Runtime,
  buildActionFromElement: buildWorm02ActionFromElement,
};
