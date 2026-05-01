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

const LOADOUT_SLOTS = Object.freeze([
  { slotId: "slot-1", label: "Slot I" },
  { slotId: "slot-2", label: "Slot II" },
]);
const ARENA_BOSS_CLOUT_REWARD = 260;
const ARENA_BOSS_CARDS = Object.freeze([
  Object.freeze({
    id: "worm-boss-surge-jack",
    heroName: "Jack Slash (Surge)",
    power: "Infinite blade edge amplified by shard-tuned trajectory control.",
    powerFull: "Arena variant of Jack Slash with shard-tuned edge extension and predictive pressure.",
    attack: 10,
    defense: 8,
    endurance: 9,
    info: 7,
    manipulation: 9,
    range: 10,
    speed: 8,
    stealth: 7,
    rarity: 5.4,
    rarityTier: "epic",
  }),
  Object.freeze({
    id: "worm-boss-shard-crawler",
    heroName: "Crawler (Shardbound)",
    power: "Adaptive regenerative brute with layered combat-shell runes.",
    powerFull: "Arena variant of Crawler with reinforced adaptation loops and shard-fed bulk.",
    attack: 9,
    defense: 10,
    endurance: 12,
    info: 5,
    manipulation: 6,
    range: 5,
    speed: 6,
    stealth: 3,
    rarity: 5.3,
    rarityTier: "epic",
  }),
]);

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

function normalizePickerSlot(value) {
  const slot = safeText(value);
  return LOADOUT_SLOTS.some((entry) => entry.slotId === slot) ? slot : "";
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
    pickerSlot: normalizePickerSlot(source.pickerSlot),
    lootEvents: Array.isArray(source.lootEvents) ? source.lootEvents.filter((entry) => entry && typeof entry === "object") : [],
    outcomePopup: source.outcomePopup && typeof source.outcomePopup === "object" ? { ...source.outcomePopup } : null,
    bossDefeated: Boolean(source.bossDefeated),
    solved: Boolean(source.bossDefeated),
    lastMessage: safeText(source.lastMessage),
  };
}

function actionNeedsTarget(actionType) {
  const type = safeText(actionType).toLowerCase();
  return type === "attack" || type === "info" || type === "manipulation";
}

function ensureLoadout(runtime, ownedCardIds) {
  const uniqueOwned = ownedCardIds.filter((cardId, index, list) => cardId && list.indexOf(cardId) === index);
  const selected = (runtime.playerLoadout || []).filter((cardId) => uniqueOwned.includes(cardId)).slice(0, 2);

  while (selected.length < 2) {
    selected.push("");
  }

  return selected.slice(0, 2);
}

function teamCardsMarkup(team, role) {
  const living = (Array.isArray(team) ? team : []).filter((combatant) => Number(combatant && combatant.hp) > 0);
  return living
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
  const showTarget = actionNeedsTarget(normalized.type);
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
        <select class="worm02-select" data-worm02-order-type>
          ${actionOptions}
        </select>
      </label>
      <label data-worm02-target-wrap ${showTarget ? "" : "hidden"}>
        <span>Target</span>
        <select class="worm02-select" data-worm02-order-target>
          ${targetOptions}
        </select>
      </label>
      <label data-worm02-info-wrap ${normalized.type === "info" ? "" : "hidden"}>
        <span>Info Debuff</span>
        <select class="worm02-select" data-worm02-order-info>
          ${infoOptions}
        </select>
      </label>
    </article>
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

function loadoutEntryById(owned) {
  const byId = {};
  for (const entry of owned) {
    if (!entry || !entry.cardId) {
      continue;
    }
    byId[entry.cardId] = entry;
  }
  return byId;
}

function loadoutSlotMarkup(slot, selectedEntry, pickerOpen, locked) {
  const hasCard = Boolean(selectedEntry && selectedEntry.card);
  return `
    <button
      type="button"
      class="worm02-loadout-slot ${hasCard ? "is-filled" : "is-empty"} ${pickerOpen ? "is-active" : ""}"
      data-node-id="${NODE_ID}"
      data-node-action="worm02-open-picker"
      data-slot-id="${escapeHtml(slot.slotId)}"
      data-worm02-loadout-slot="${escapeHtml(slot.slotId)}"
      data-card-id="${escapeHtml(hasCard ? selectedEntry.cardId : "")}" 
      data-current-hp="${escapeHtml(hasCard ? String(Math.max(0, Math.round(Number(selectedEntry.currentHp || 0)))) : "0")}" 
      ${locked ? "disabled" : ""}
      aria-label="${escapeHtml(`Select cape for ${slot.label}`)}"
    >
      <span class="worm02-loadout-slot-title">${escapeHtml(slot.label)}</span>
      ${
        hasCard
          ? `
              <span class="worm02-loadout-slot-name">${escapeHtml(selectedEntry.card.heroName)}</span>
              <span class="worm02-loadout-slot-meta">R ${escapeHtml(selectedEntry.card.rarity.toFixed(1))} | HP ${escapeHtml(String(Math.max(0, Math.round(Number(selectedEntry.currentHp || 0)))))}</span>
            `
          : `<span class="worm02-loadout-slot-empty">Select Cape</span>`
      }
    </button>
  `;
}

function pickerCardMarkup(entry, slotId, activeLoadout) {
  const otherSlotCardId = (activeLoadout || []).find((cardId, index) => {
    const lookupSlot = LOADOUT_SLOTS[index] ? LOADOUT_SLOTS[index].slotId : "";
    return lookupSlot !== slotId && cardId;
  }) || "";
  const sameCardInOtherSlot = otherSlotCardId && otherSlotCardId === entry.cardId;
  const disabled = Boolean(sameCardInOtherSlot);

  return `
    <button
      type="button"
      class="worm02-picker-card ${disabled ? "is-disabled" : ""}"
      data-node-id="${NODE_ID}"
      data-node-action="worm02-pick-loadout"
      data-slot-id="${escapeHtml(slotId)}"
      data-card-id="${escapeHtml(entry.cardId)}"
      ${disabled ? "disabled" : ""}
      aria-label="${escapeHtml(`Choose ${entry.card.heroName}`)}"
    >
      <strong>${escapeHtml(entry.card.heroName)}</strong>
      <span>R ${escapeHtml(entry.card.rarity.toFixed(1))} | HP ${escapeHtml(String(Math.max(0, Math.round(Number(entry.currentHp || 0)))))}</span>
      <span>x${escapeHtml(String(Math.max(1, Math.floor(Number(entry.copies || 1)))))}</span>
    </button>
  `;
}

function pickerMarkup(runtime, owned, activeLoadout) {
  if (!runtime.pickerSlot) {
    return "";
  }
  const slot = LOADOUT_SLOTS.find((entry) => entry.slotId === runtime.pickerSlot);
  if (!slot) {
    return "";
  }

  return `
    <section class="worm02-picker-overlay" aria-modal="true" role="dialog">
      <section class="card worm02-picker-panel">
        <header class="worm02-picker-header">
          <h4>Select Cape for ${escapeHtml(slot.label)}</h4>
          <button type="button" class="ghost" data-node-id="${NODE_ID}" data-node-action="worm02-close-picker">Close</button>
        </header>
        <div class="worm02-picker-grid">
          ${owned.map((entry) => pickerCardMarkup(entry, slot.slotId, activeLoadout)).join("")}
        </div>
      </section>
    </section>
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
  const enemyAlive = enemyTeam.filter((combatant) => combatant.hp > 0);
  const visiblePlayers = playerAlive.length ? playerAlive : playerTeam;
  const visibleEnemies = enemyAlive.length ? enemyAlive : enemyTeam;
  const canResolve = !battle.winner && playerAlive.length > 0;
  const winnerLabel = battle.winner
    ? battle.winner === "player"
      ? "Player victory"
      : battle.winner === "enemy"
        ? "Enemy victory"
        : "Draw"
    : "In progress";
  const turnNumber = Math.max(1, Number(battle.round || 1) - 1);
  const turnEvents = Array.isArray(battle.lastRoundEvents) && battle.lastRoundEvents.length
    ? battle.lastRoundEvents
    : ["Turn resolves without momentum shift."];

  return `
    <section class="worm02-battle">
      <header class="worm02-battle-header">
        <p><strong>Combat Turn:</strong> ${escapeHtml(String(turnNumber))}</p>
        <p><strong>Status:</strong> ${escapeHtml(winnerLabel)}</p>
      </header>

      <section class="worm02-board worm02-board-lanes">
        <section class="worm02-team-column">
          <h3>Your Team</h3>
          <div class="worm02-card-grid">
            ${teamCardsMarkup(visiblePlayers, "player")}
          </div>
        </section>

        <section class="worm02-center-column">
          <section class="worm02-controls">
            <h3>Turn Orders</h3>
            <div class="worm02-order-grid">
              ${playerAlive
    .map((combatant) => playerOrderMarkup(combatant, enemyAlive, runtime.orderPrefs[combatant.combatantId] || null))
    .join("")}
            </div>
            <div class="toolbar">
              <button type="button" data-node-id="${NODE_ID}" data-node-action="worm02-resolve-round" ${canResolve ? "" : "disabled"}>
                Resolve Turn
              </button>
              <button type="button" class="ghost" data-node-id="${NODE_ID}" data-node-action="worm02-reset-battle">
                Abandon Battle
              </button>
              ${
                battle.winner
                  ? `
                      <button type="button" data-node-id="${NODE_ID}" data-node-action="worm02-claim-outcome" data-clout-multiplier="${escapeHtml(String(cloutMultiplier))}">
                        Claim Outcome
                      </button>
                    `
                  : ""
              }
            </div>
          </section>
        </section>

        <section class="worm02-team-column">
          <h3>Enemy Team</h3>
          <div class="worm02-card-grid">
            ${teamCardsMarkup(visibleEnemies, "enemy")}
          </div>
        </section>
      </section>

      <section class="card worm02-turn-panel">
        <h3>Combat Turn ${escapeHtml(String(turnNumber))}</h3>
        <div class="worm02-turn-grid">
          ${turnEvents.map((line, index) => `
            <article class="worm02-turn-event">
              <span>${escapeHtml(String(index + 1))}</span>
              <p>${escapeHtml(line)}</p>
            </article>
          `).join("")}
        </div>
      </section>
    </section>
  `;
}

function outcomePopupMarkup(runtime) {
  const popup = runtime && runtime.outcomePopup && typeof runtime.outcomePopup === "object"
    ? runtime.outcomePopup
    : null;
  if (!popup) {
    return "";
  }
  const lines = Array.isArray(popup.lines) ? popup.lines : [];
  return `
    <section class="worm02-picker-overlay" aria-modal="true" role="dialog">
      <section class="card worm02-picker-panel">
        <header class="worm02-picker-header">
          <h4>${escapeHtml(String(popup.title || "Outcome"))}</h4>
        </header>
        <div class="worm02-help">
          ${lines.map((line) => `<p>${escapeHtml(String(line || ""))}</p>`).join("")}
        </div>
        <div class="toolbar">
          <button type="button" data-node-id="${NODE_ID}" data-node-action="worm02-close-outcome-popup">Close</button>
        </div>
      </section>
    </section>
  `;
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
    pickerSlot: owned.length ? current.pickerSlot : "",
    bossDefeated: current.bossDefeated || Boolean(wormState.arenaBossCleared),
    solved: current.solved || Boolean(wormState.arenaBossCleared),
  };
}

export function validateWorm02Runtime(runtime) {
  return Boolean(runtime && runtime.bossDefeated);
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

  if (action.type === "worm02-open-picker") {
    return {
      ...current,
      pickerSlot: normalizePickerSlot(action.slotId),
    };
  }

  if (action.type === "worm02-close-picker") {
    return {
      ...current,
      pickerSlot: "",
    };
  }

  if (action.type === "worm02-close-outcome-popup") {
    return {
      ...current,
      outcomePopup: null,
    };
  }

  if (action.type === "worm02-pick-loadout") {
    const slot = normalizePickerSlot(action.slotId);
    const cardId = safeText(action.cardId);
    if (!slot || !cardId) {
      return current;
    }

    const nextLoadout = Array.isArray(current.playerLoadout)
      ? current.playerLoadout.slice(0, 2)
      : [];
    while (nextLoadout.length < 2) {
      nextLoadout.push("");
    }
    const slotIndex = LOADOUT_SLOTS.findIndex((entry) => entry.slotId === slot);
    if (slotIndex < 0) {
      return current;
    }

    const otherIndex = slotIndex === 0 ? 1 : 0;
    if (nextLoadout[otherIndex] === cardId) {
      nextLoadout[otherIndex] = "";
    }
    nextLoadout[slotIndex] = cardId;

    return {
      ...current,
      playerLoadout: nextLoadout,
      pickerSlot: "",
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
      pickerSlot: "",
      battle: createWormBattleState({
        playerCards,
        enemyCards,
        seed: Date.now() >>> 0,
        enemyAiMode: safeText(action.enemyAiMode) || "weighted",
      }),
      battleMode: "normal",
      battleDifficulty: difficulty,
      enemyRarities: enemyCards.map((card) => Number(card.rarity || 0)).slice(0, 2),
      outcomePopup: null,
      lastMessage: `${BATTLE_DIFFICULTY_CONFIG[difficulty].label} arena battle initialized.`,
    };
  }

  if (action.type === "worm02-start-boss") {
    if (current.bossDefeated) {
      return {
        ...current,
        lastMessage: "Arena Boss already defeated.",
      };
    }
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
    if (playerCards.length < 2) {
      return {
        ...current,
        lastMessage: "A full two-cape matchup is required.",
      };
    }
    const enemyCards = ARENA_BOSS_CARDS.map((card) => ({ ...card }));
    return {
      ...current,
      playerLoadout: requestedLoadout,
      pickerSlot: "",
      battle: createWormBattleState({
        playerCards,
        enemyCards,
        seed: Date.now() >>> 0,
        enemyAiMode: "boss",
      }),
      battleMode: "boss",
      battleDifficulty: "hard",
      enemyRarities: enemyCards.map((card) => Number(card.rarity || 0)).slice(0, 2),
      outcomePopup: null,
      lastMessage: "Arena Boss challenge initialized.",
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
    const lootEvents = [];
    if (mode === "normal" && winner === "player") {
      lootEvents.push({
        sourceRegion: "worm",
        triggerType: "arena-victory",
        dropChance: 0.25,
        outRegionChance: 0.5,
        rarityBias: 0.2,
      });
    }
    if (mode === "boss" && winner === "player" && !current.bossDefeated) {
      lootEvents.push(
        {
          sourceRegion: "worm",
          triggerType: "arena-boss-victory",
          dropChance: 1,
          outRegionChance: 0.5,
          rarityBias: 0.75,
        },
        {
          sourceRegion: "crd",
          triggerType: "arena-boss-victory",
          dropChance: 1,
          outRegionChance: 0,
          rarityBias: 0.65,
        },
        {
          sourceRegion: "dcc",
          triggerType: "arena-boss-victory",
          dropChance: 1,
          outRegionChance: 0,
          rarityBias: 0.65,
        },
      );
    }
    return {
      ...current,
      bossDefeated: current.bossDefeated || solvedNow,
      solved: current.bossDefeated || solvedNow,
      battle: null,
      lootEvents,
      outcomePopup: {
        title: winner === "player" ? "Arena Victory" : "Arena Defeat",
        lines: winner === "player"
          ? [
            mode === "boss" ? "Boss clear registered." : `Difficulty: ${String(current.battleDifficulty || "easy").toUpperCase()}.`,
            "Clout has been awarded.",
            lootEvents.length
              ? `Reward bundle generated: ${lootEvents.length} loot drop${lootEvents.length === 1 ? "" : "s"}.`
              : "No bonus loot this round.",
          ]
          : ["No clout gained.", "Your capes return with their current injuries."],
      },
      lastMessage: winner === "player" ? "Outcome claimed. Clout awarded." : "Outcome claimed.",
    };
  }

  if (action.type === "worm02-reset-battle") {
    return {
      ...current,
      battle: null,
      pickerSlot: "",
      outcomePopup: null,
      lastMessage: "Battle abandoned.",
    };
  }

  return current;
}

function buildSelectedLoadoutPayload(surface, slotId) {
  const slot = surface.querySelector(`[data-worm02-loadout-slot="${slotId}"]`);
  if (!slot) {
    return { cardId: "", currentHp: 0 };
  }
  const cardId = safeText(slot.getAttribute("data-card-id"));
  const currentHp = Number(slot.getAttribute("data-current-hp"));
  return {
    cardId,
    currentHp: Number.isFinite(currentHp) ? Math.max(0, Math.round(currentHp)) : 0,
  };
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

  if (actionName === "worm02-open-picker") {
    return {
      type: "worm02-open-picker",
      slotId: element.getAttribute("data-slot-id") || "",
    };
  }

  if (actionName === "worm02-close-picker") {
    return {
      type: "worm02-close-picker",
    };
  }

  if (actionName === "worm02-close-outcome-popup") {
    return {
      type: "worm02-close-outcome-popup",
    };
  }

  if (actionName === "worm02-pick-loadout") {
    return {
      type: "worm02-pick-loadout",
      slotId: element.getAttribute("data-slot-id") || "",
      cardId: element.getAttribute("data-card-id") || "",
    };
  }

  if (actionName === "worm02-start-normal") {
    const difficulty = normalizeDifficulty(element.getAttribute("data-difficulty"));
    const config = BATTLE_DIFFICULTY_CONFIG[difficulty];
    const enemyCards = wormDrawWindowPack(2, {
      weightBase: config.drawWeightBase,
      maxRarity: 5,
    });

    return {
      type: "worm02-start-normal",
      enemyCardIds: enemyCards.map((card) => card.id),
      playerCards: LOADOUT_SLOTS.map((slot) => buildSelectedLoadoutPayload(surface, slot.slotId)),
      difficulty,
      enemyAiMode: "weighted",
    };
  }

  if (actionName === "worm02-start-boss") {
    const payload = LOADOUT_SLOTS.map((slot) => buildSelectedLoadoutPayload(surface, slot.slotId));
    return {
      type: "worm02-start-boss",
      playerCards: payload,
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
      bossCloutReward: current.battleMode === "boss" ? ARENA_BOSS_CLOUT_REWARD : 0,
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
  const selectedById = loadoutEntryById(owned);
  const canBattle = owned.length >= 2;
  const battleLocked = Boolean(runtime.battle && !runtime.battle.winner);
  const loadoutComplete = loadout.every((cardId) => Boolean(cardId));

  const setupMarkup = `
    <section class="card worm02-setup">
      <h3>The Arena</h3>
      <p><strong>Clout:</strong> ${escapeHtml(String(Number(wormState.clout || 0).toFixed(2)))}</p>
      ${canBattle
    ? `
            <div class="worm02-loadout-slot-grid">
              ${LOADOUT_SLOTS.map((slot, index) => loadoutSlotMarkup(slot, selectedById[loadout[index]], runtime.pickerSlot === slot.slotId, battleLocked)).join("")}
            </div>
            <div class="toolbar">
              <button type="button" data-node-id="${NODE_ID}" data-node-action="worm02-start-normal" data-difficulty="easy" ${battleLocked || !loadoutComplete ? "disabled" : ""}>
                Easy Battle
              </button>
              <button type="button" data-node-id="${NODE_ID}" data-node-action="worm02-start-normal" data-difficulty="medium" ${battleLocked || !loadoutComplete ? "disabled" : ""}>
                Medium Battle
              </button>
              <button type="button" data-node-id="${NODE_ID}" data-node-action="worm02-start-normal" data-difficulty="hard" ${battleLocked || !loadoutComplete ? "disabled" : ""}>
                Hard Battle
              </button>
              <button type="button" class="ghost" data-node-id="${NODE_ID}" data-node-action="worm02-start-boss" ${battleLocked || !loadoutComplete || runtime.bossDefeated ? "disabled" : ""}>
                ${runtime.bossDefeated ? "Arena Boss Defeated" : "Fight Arena Boss"}
              </button>
            </div>
          `
    : `<p>You need at least 2 capes in your deck to enter the Arena.</p>`}
      ${pickerMarkup(runtime, owned, loadout)}
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
      ${runtime.battle ? "" : setupMarkup}
      ${helpMarkup}
      ${battleMarkup({ ...runtime, playerLoadout: loadout }, cloutMultiplier)}
      ${outcomePopupMarkup(runtime)}
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
