import { escapeHtml } from "../../templates/shared.js";
import {
  createWormBattleState,
  infoDebuffStatKeys,
  resolveWormRound,
  selectableWormActions,
} from "./wormCombatSystem.js";
import { renderWormCard } from "./wormCardRenderer.js";
import { loadWormCardCatalog, wormCardById } from "./wormData.js";
import { normalizeWormSystemState, wormOwnedCards, wormDrawWindowPack } from "../../systems/wormDeck.js";
import { getWormCapeLootBonuses } from "../../systems/loot.js";

const NODE_ID = "WORM04";
const S9_MEMBERS = Object.freeze([
  "Jack Slash",
  "Bonesaw",
  "Siberian",
  "Burnscar",
  "Mannequin",
  "Crawler",
  "Shatterbird",
  "Cherish",
  "Murder Rat",
  "Hack Job",
]);

const ACTION_LABELS = Object.freeze({
  attack: "Attack",
  defense: "Defense",
  info: "Info",
  manipulation: "Manipulation",
  speed: "Speed",
  stealth: "Stealth",
});

const DIFFICULTY_CONFIG = Object.freeze({
  easy: Object.freeze({ label: "Easy Cleanup", weightBase: 0.125, cloutMult: 2 }),
  medium: Object.freeze({ label: "Medium Cleanup", weightBase: 0.5, cloutMult: 5 }),
  hard: Object.freeze({ label: "Hard Cleanup", weightBase: 2, cloutMult: 14 }),
});

const STAT_KEYS = Object.freeze(["attack", "defense", "endurance", "info", "manipulation", "range", "speed", "stealth"]);

function safeText(value) {
  return String(value == null ? "" : value).trim();
}

function normalizeBattle(value) {
  return value && typeof value === "object" ? value : null;
}

function normalizeRuntime(runtime) {
  const source = runtime && typeof runtime === "object" ? runtime : {};
  const defeatedMembers = Array.isArray(source.defeatedMembers)
    ? source.defeatedMembers.map((name) => safeText(name)).filter((name) => name)
    : [];
  return {
    introSeen: Boolean(source.introSeen),
    battle: normalizeBattle(source.battle),
    orderPrefs: source.orderPrefs && typeof source.orderPrefs === "object" ? source.orderPrefs : {},
    defeatedMembers,
    activeEncounterMember: safeText(source.activeEncounterMember),
    activeDifficulty: safeText(source.activeDifficulty).toLowerCase(),
    pendingCloutReward: Math.max(0, Number(source.pendingCloutReward) || 0),
    pendingCloutAward: Math.max(0, Number(source.pendingCloutAward) || 0),
    solved: Boolean(source.solved),
    lootEvents: Array.isArray(source.lootEvents) ? source.lootEvents.filter((entry) => entry && typeof entry === "object") : [],
    outcomePopup: source.outcomePopup && typeof source.outcomePopup === "object" ? { ...source.outcomePopup } : null,
    lastMessage: safeText(source.lastMessage),
  };
}

function actionNeedsTarget(actionType) {
  const type = safeText(actionType).toLowerCase();
  return type === "attack" || type === "info" || type === "manipulation";
}

function applyCardBonus(card, bonus) {
  const source = bonus && typeof bonus === "object" ? bonus : {};
  const next = { ...card };
  for (const key of STAT_KEYS) {
    next[key] = Math.max(0, Number(card[key] || 0) + Math.max(0, Number(source[key] || 0)));
  }
  return next;
}

function randomEnhanceCard(card, seed = Date.now(), count = 1) {
  const next = { ...card };
  const iterations = Math.max(1, Math.floor(Number(count) || 1));
  for (let idx = 0; idx < iterations; idx += 1) {
    const key = STAT_KEYS[(seed + idx * 17) % STAT_KEYS.length];
    const delta = 1 + ((seed + idx * 11) % 2);
    next[key] = Math.max(0, Number(next[key] || 0) + delta);
  }
  return next;
}

function topPlayerCards(wormState, contextState) {
  const owned = wormOwnedCards(wormState, Date.now())
    .filter((entry) => Number(entry.currentHp || 0) > 0)
    .sort((a, b) => {
      if (Number(b.card.rarity || 0) !== Number(a.card.rarity || 0)) {
        return Number(b.card.rarity || 0) - Number(a.card.rarity || 0);
      }
      return String(a.card.heroName || "").localeCompare(String(b.card.heroName || ""));
    });
  return owned.slice(0, 2).map((entry) => {
    const bonus = getWormCapeLootBonuses(contextState || {}, entry.cardId, Date.now());
    return applyCardBonus(
      {
        ...entry.card,
        currentHp: Number(entry.currentHp || 0),
      },
      bonus,
    );
  });
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
    <article class="worm02-order-row" data-worm04-order-row data-actor-id="${escapeHtml(combatant.combatantId)}">
      <h4>${escapeHtml(combatant.heroName)}</h4>
      <label>
        <span>Action</span>
        <select class="worm02-select" data-worm04-order-type>
          ${actionOptions}
        </select>
      </label>
      <label data-worm04-target-wrap ${showTarget ? "" : "hidden"}>
        <span>Target</span>
        <select class="worm02-select" data-worm04-order-target>
          ${targetOptions}
        </select>
      </label>
      <label data-worm04-info-wrap ${normalized.type === "info" ? "" : "hidden"}>
        <span>Info Debuff</span>
        <select class="worm02-select" data-worm04-order-info>
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

function battleMarkup(runtime) {
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
              <button type="button" data-node-id="${NODE_ID}" data-node-action="worm04-resolve-round" ${canResolve ? "" : "disabled"}>Resolve Turn</button>
              <button type="button" class="ghost" data-node-id="${NODE_ID}" data-node-action="worm04-reset-battle">Retreat</button>
              ${
                battle.winner
                  ? `<button type="button" data-node-id="${NODE_ID}" data-node-action="worm04-claim-outcome">Claim Outcome</button>`
                  : ""
              }
            </div>
          </section>
        </section>
        <section class="worm02-team-column">
          <h3>Cleanup Targets</h3>
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
          <button type="button" data-node-id="${NODE_ID}" data-node-action="worm04-close-outcome-popup">Close</button>
        </div>
      </section>
    </section>
  `;
}

function catalogCardByName(name) {
  const target = safeText(name).toLowerCase();
  if (!target) {
    return null;
  }
  const catalog = loadWormCardCatalog();
  for (const card of catalog) {
    const heroName = safeText(card.heroName).toLowerCase();
    if (heroName === target) {
      return card;
    }
    const aliasHead = heroName.split("/")[0].trim();
    if (aliasHead === target) {
      return card;
    }
    if (heroName.startsWith(`${target} /`) || heroName.startsWith(`${target}/`)) {
      return card;
    }
  }
  return null;
}

function chooseCleanupEnemies(runtime, difficulty) {
  const config = DIFFICULTY_CONFIG[difficulty] || DIFFICULTY_CONFIG.easy;
  const draws = wormDrawWindowPack(2, {
    weightBase: config.weightBase,
    minRarity: 3.5,
    maxRarity: 6.5,
  }).map((card) => ({ ...card }));

  while (draws.length < 2) {
    const fallback = wormDrawWindowPack(1, {
      weightBase: config.weightBase,
      minRarity: 3.5,
      maxRarity: 6.5,
    })[0];
    if (!fallback) {
      break;
    }
    draws.push({ ...fallback });
  }

  const remaining = S9_MEMBERS.filter((name) => !runtime.defeatedMembers.includes(name));
  const encounterRoll = Math.random();
  let activeEncounterMember = "";
  if (remaining.length && encounterRoll < 0.28) {
    const pickedName = remaining[Math.floor(Math.random() * remaining.length)];
    const pickedCard = catalogCardByName(pickedName);
    if (pickedCard) {
      draws[0] = randomEnhanceCard({ ...pickedCard }, Date.now() + 911, 3);
      activeEncounterMember = pickedName;
    }
  }

  const enemies = draws.map((card, index) => (
    activeEncounterMember && index === 0
      ? card
      : randomEnhanceCard(card, Date.now() + index * 17, 1)
  ));
  return {
    enemies,
    activeEncounterMember,
  };
}

export function initialWorm04Runtime() {
  return normalizeRuntime({
    introSeen: false,
    battle: null,
    orderPrefs: {},
    defeatedMembers: [],
    activeEncounterMember: "",
    activeDifficulty: "",
    pendingCloutReward: 0,
    pendingCloutAward: 0,
    solved: false,
    lootEvents: [],
    outcomePopup: null,
    lastMessage: "",
  });
}

export function synchronizeWorm04Runtime(runtime) {
  return normalizeRuntime(runtime);
}

export function validateWorm04Runtime(runtime) {
  return Boolean(runtime && runtime.solved);
}

export function reduceWorm04Runtime(runtime, action, context = {}) {
  const current = normalizeRuntime(runtime);
  if (!action || typeof action !== "object") {
    return current;
  }

  if (action.type === "worm04-ack-intro") {
    return {
      ...current,
      introSeen: true,
    };
  }

  if (action.type === "worm04-start-job") {
    if (current.solved) {
      return current;
    }
    const difficulty = safeText(action.difficulty).toLowerCase();
    if (!DIFFICULTY_CONFIG[difficulty]) {
      return current;
    }
    const wormState = normalizeWormSystemState(
      context && context.state && context.state.systems ? context.state.systems.worm : {},
      Date.now(),
    );
    const playerCards = topPlayerCards(wormState, context.state || {});
    if (playerCards.length < 2) {
      return {
        ...current,
        lastMessage: "You need two healthy capes for cleanup jobs.",
      };
    }
    const selected = chooseCleanupEnemies(current, difficulty);
    const battle = createWormBattleState({
      playerCards,
      enemyCards: selected.enemies,
      seed: Date.now() >>> 0,
      enemyAiMode: selected.activeEncounterMember ? "boss" : "weighted",
    });
    const labels = selected.activeEncounterMember
      ? `Slaughterhouse encounter: ${selected.activeEncounterMember}.`
      : `${DIFFICULTY_CONFIG[difficulty].label} initiated.`;
    return {
      ...current,
      introSeen: true,
      battle,
      orderPrefs: {},
      activeEncounterMember: selected.activeEncounterMember,
      activeDifficulty: difficulty,
      pendingCloutReward: Math.max(1, Number(action.baseCloutReward || 0) * DIFFICULTY_CONFIG[difficulty].cloutMult),
      outcomePopup: null,
      lastMessage: labels,
    };
  }

  if (action.type === "worm04-resolve-round") {
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
          ? "Target neutralized. Claim outcome."
          : "Cleanup team wiped. Regroup."
        : current.lastMessage,
    };
  }

  if (action.type === "worm04-reset-battle") {
    return {
      ...current,
      battle: null,
      orderPrefs: {},
      activeEncounterMember: "",
      pendingCloutReward: 0,
      pendingCloutAward: 0,
      outcomePopup: null,
      lastMessage: "You break contact and fall back.",
    };
  }

  if (action.type === "worm04-close-outcome-popup") {
    return {
      ...current,
      outcomePopup: null,
    };
  }

  if (action.type === "worm04-claim-outcome") {
    if (!current.battle || !current.battle.winner) {
      return current;
    }
    const won = current.battle.winner === "player";
    const nextDefeated = won && current.activeEncounterMember && !current.defeatedMembers.includes(current.activeEncounterMember)
      ? [...current.defeatedMembers, current.activeEncounterMember]
      : current.defeatedMembers.slice();
    const fullClear = nextDefeated.length >= S9_MEMBERS.length;
    return {
      ...current,
      battle: null,
      orderPrefs: {},
      activeEncounterMember: "",
      defeatedMembers: nextDefeated,
      solved: current.solved || fullClear,
      pendingCloutAward: won ? current.pendingCloutReward : 0,
      pendingCloutReward: 0,
      lootEvents: won && fullClear
        ? [
          {
            sourceRegion: "worm",
            triggerType: "cleanup-s9-clear",
            dropChance: 1,
            outRegionChance: 0.7,
            rarityBias: 0.9,
          },
          {
            sourceRegion: "crd",
            triggerType: "cleanup-s9-clear",
            dropChance: 1,
            outRegionChance: 0,
            rarityBias: 0.8,
          },
          {
            sourceRegion: "dcc",
            triggerType: "cleanup-s9-clear",
            dropChance: 1,
            outRegionChance: 0,
            rarityBias: 0.8,
          },
        ]
        : won
          ? [
            {
              sourceRegion: "worm",
              triggerType: "cleanup-job",
              dropChance: 0.45,
              outRegionChance: 0.2,
              rarityBias: 0.45,
            },
          ]
          : [],
      outcomePopup: {
        title: won ? "Cleanup Complete" : "Cleanup Failed",
        lines: won
          ? [
            `Clout awarded: ${Math.max(0, Number(current.pendingCloutReward || 0))}`,
            current.activeEncounterMember
              ? `S9 neutralized: ${current.activeEncounterMember}`
              : "No S9 member encountered this run.",
            fullClear
              ? "Full-clear rewards queued: Cradle + Worm + Dungeon Crawler Carl + Mercy Bell Chime"
              : "Cleanup loot queued: Worm",
          ]
          : ["No clout awarded.", "No artifact rewards.", "Regroup and redeploy."],
      },
      lastMessage: won
        ? fullClear
          ? "All Slaughterhouse targets defeated. Territory secured."
          : "Cleanup successful."
        : "Cleanup failed.",
    };
  }

  return current;
}

export function buildWorm04ActionFromElement(element, runtime) {
  const actionName = element.getAttribute("data-node-action");
  if (!actionName) {
    return null;
  }
  const surface = element.closest(".worm04-node");
  if (!surface) {
    return null;
  }
  if (actionName === "worm04-ack-intro") {
    return { type: "worm04-ack-intro", at: Date.now() };
  }
  if (actionName === "worm04-start-job") {
    return {
      type: "worm04-start-job",
      difficulty: element.getAttribute("data-difficulty") || "easy",
      baseCloutReward: Number(element.getAttribute("data-base-clout-reward") || 0),
      at: Date.now(),
    };
  }
  if (actionName === "worm04-reset-battle") {
    return { type: "worm04-reset-battle", at: Date.now() };
  }
  if (actionName === "worm04-close-outcome-popup") {
    return { type: "worm04-close-outcome-popup", at: Date.now() };
  }
  if (actionName === "worm04-claim-outcome") {
    const current = normalizeRuntime(runtime);
    const playerResults =
      current && current.battle && Array.isArray(current.battle.playerTeam)
        ? current.battle.playerTeam.map((combatant) => ({
          cardId: combatant.cardId,
          hp: combatant.hp,
        }))
        : [];
    return {
      type: "worm04-claim-outcome",
      winner: current && current.battle ? current.battle.winner : "",
      playerResults,
      at: Date.now(),
    };
  }
  if (actionName === "worm04-resolve-round") {
    const rows = [...surface.querySelectorAll("[data-worm04-order-row]")];
    const orders = {};
    for (const row of rows) {
      const actorId = safeText(row.getAttribute("data-actor-id"));
      if (!actorId) {
        continue;
      }
      const typeInput = row.querySelector("[data-worm04-order-type]");
      const targetInput = row.querySelector("[data-worm04-order-target]");
      const infoInput = row.querySelector("[data-worm04-order-info]");
      orders[actorId] = {
        type: typeInput && "value" in typeInput ? safeText(typeInput.value) : "attack",
        targetId: targetInput && "value" in targetInput ? safeText(targetInput.value) : "",
        infoStat: infoInput && "value" in infoInput ? safeText(infoInput.value) : "attack",
      };
    }
    return {
      type: "worm04-resolve-round",
      orders,
      at: Date.now(),
    };
  }
  return null;
}

export function renderWorm04Experience(context) {
  const runtime = normalizeRuntime(context.runtime);
  const remainingCount = Math.max(0, S9_MEMBERS.length - runtime.defeatedMembers.length);
  const baseReward = 28;
  return `
    <article class="worm04-node" data-node-id="${NODE_ID}">
      <section class="card">
        <h3>Brockton Bay Cleanup</h3>
        ${
          !runtime.introSeen
            ? `
              <p>Brockton Bay is fractured after Leviathan. Capes are running wild and territory lines are collapsing.</p>
              <button type="button" data-node-id="${NODE_ID}" data-node-action="worm04-ack-intro">Begin Cleanup</button>
            `
            : `
              <p><strong>Slaughterhouse members defeated:</strong> ${escapeHtml(String(runtime.defeatedMembers.length))}/${escapeHtml(String(S9_MEMBERS.length))}</p>
              <p><strong>Remaining:</strong> ${escapeHtml(String(remainingCount))}</p>
              <div class="toolbar">
                <button type="button" data-node-id="${NODE_ID}" data-node-action="worm04-start-job" data-difficulty="easy" data-base-clout-reward="${escapeHtml(String(baseReward))}" ${runtime.battle || runtime.solved ? "disabled" : ""}>Easy Cleanup</button>
                <button type="button" data-node-id="${NODE_ID}" data-node-action="worm04-start-job" data-difficulty="medium" data-base-clout-reward="${escapeHtml(String(baseReward))}" ${runtime.battle || runtime.solved ? "disabled" : ""}>Medium Cleanup</button>
                <button type="button" data-node-id="${NODE_ID}" data-node-action="worm04-start-job" data-difficulty="hard" data-base-clout-reward="${escapeHtml(String(baseReward))}" ${runtime.battle || runtime.solved ? "disabled" : ""}>Hard Cleanup</button>
              </div>
            `
        }
        ${runtime.lastMessage ? `<p class="muted">${escapeHtml(runtime.lastMessage)}</p>` : ""}
      </section>
      ${battleMarkup(runtime)}
      ${outcomePopupMarkup(runtime)}
    </article>
  `;
}

export const WORM04_NODE_EXPERIENCE = {
  nodeId: NODE_ID,
  initialState: initialWorm04Runtime,
  synchronizeRuntime: synchronizeWorm04Runtime,
  render: renderWorm04Experience,
  reduceRuntime: reduceWorm04Runtime,
  validateRuntime: validateWorm04Runtime,
  buildActionFromElement: buildWorm04ActionFromElement,
};
