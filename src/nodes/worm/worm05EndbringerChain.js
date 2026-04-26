import { escapeHtml } from "../../templates/shared.js";
import { renderArtifactSymbol } from "../../core/artifacts.js";
import { renderSlotRing } from "../../ui/slotRing.js";
import {
  createWormBattleState,
  infoDebuffStatKeys,
  resolveWormRound,
  selectableWormActions,
} from "./wormCombatSystem.js";
import { renderWormCard } from "./wormCardRenderer.js";
import { loadWormCardCatalog } from "./wormData.js";
import { normalizeWormSystemState, wormDrawWindowPack, wormOwnedCards } from "../../systems/wormDeck.js";
import { getWormCapeLootBonuses } from "../../systems/loot.js";

const ACTION_LABELS = Object.freeze({
  attack: "Attack",
  defense: "Defense",
  info: "Info",
  manipulation: "Manipulation",
  speed: "Speed",
  stealth: "Stealth",
});

const WORM05_NODE_ID = "WORM05";
const WORM06_NODE_ID = "WORM06";
const WORM07_NODE_ID = "WORM07";
const WORM08_NODE_ID = "WORM08";

const SIMURGH_BRACELET = "Simurgh Summoning Bracelet";
const BEHEMOTH_ANKLET = "Behemoth Summoning Anklet";
const LEVIATHAN_SIGIL = "Leviathan Core Sigil";
const SIMURGH_SIGIL = "Simurgh Feather Sigil";
const BEHEMOTH_SIGIL = "Behemoth Ember Sigil";

const SIMURGH_CARD = Object.freeze({
  id: "worm-boss-simurgh",
  heroName: "Simurgh",
  power: "Winged Endbringer that predicts and rewrites battle flow through precision aerial pressure.",
  powerFull: "The Simurgh is an aerial Endbringer with predictive control, sonic disruption, and relentless tactical pressure.",
  attack: 13,
  defense: 11,
  endurance: 14,
  info: 12,
  manipulation: 13,
  range: 14,
  speed: 12,
  stealth: 11,
  rarity: 7.6,
  rarityTier: "mythic",
});

const BEHEMOTH_CARD = Object.freeze({
  id: "worm-boss-behemoth",
  heroName: "Behemoth",
  power: "Cataclysmic Endbringer of seismic force, heat bloom, and molten devastation.",
  powerFull: "Behemoth crushes fronts with seismic force, thermal surges, and overwhelming brute pressure.",
  attack: 16,
  defense: 14,
  endurance: 18,
  info: 9,
  manipulation: 8,
  range: 12,
  speed: 9,
  stealth: 5,
  rarity: 8.5,
  rarityTier: "mythic",
});

const SCION_CARD = Object.freeze({
  id: "worm-final-scion",
  heroName: "Scion",
  power: "A being of light whose strikes erase certainty and overwhelm all conventional opposition.",
  powerFull: "Scion is a near-unkillable entity of light and force projection, capable of ending battlefields in moments.",
  attack: 22,
  defense: 18,
  endurance: 24,
  info: 17,
  manipulation: 17,
  range: 20,
  speed: 18,
  stealth: 12,
  rarity: 10,
  rarityTier: "mythic",
});

const WORM06_DIFFICULTY_CONFIG = Object.freeze({
  easy: Object.freeze({ label: "Easy Cleanup", weightBase: 0.125, cloutMult: 4 }),
  medium: Object.freeze({ label: "Medium Cleanup", weightBase: 0.5, cloutMult: 9 }),
  hard: Object.freeze({ label: "Hard Cleanup", weightBase: 2, cloutMult: 20 }),
});

function safeText(value) {
  return String(value == null ? "" : value).trim();
}

function normalizeBattle(value) {
  return value && typeof value === "object" ? value : null;
}

function normalizeDifficulty(value) {
  const key = safeText(value).toLowerCase();
  return Object.prototype.hasOwnProperty.call(WORM06_DIFFICULTY_CONFIG, key) ? key : "easy";
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
    <article class="worm02-order-row" data-worm04-order-row data-actor-id="${escapeHtml(combatant.combatantId)}">
      <h4>${escapeHtml(combatant.heroName)}</h4>
      <label>
        <span>Action</span>
        <select class="worm02-select" data-worm04-order-type>
          ${actionOptions}
        </select>
      </label>
      <label>
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

function battleMarkup(nodeId, runtime, enemyHeading, resolveAction, resetAction, claimAction) {
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
  const turnNumber = Math.max(1, Number(battle.round || 1) - 1);
  const turnEvents = Array.isArray(battle.lastRoundEvents) && battle.lastRoundEvents.length
    ? battle.lastRoundEvents
    : ["No decisive actions."];

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
              <button type="button" data-node-id="${nodeId}" data-node-action="${resolveAction}" ${canResolve ? "" : "disabled"}>Resolve Turn</button>
              <button type="button" class="ghost" data-node-id="${nodeId}" data-node-action="${resetAction}">Retreat</button>
              ${battle.winner ? `<button type="button" data-node-id="${nodeId}" data-node-action="${claimAction}">Claim Outcome</button>` : ""}
            </div>
          </section>
        </section>
        <section class="worm02-team-column">
          <h3>${escapeHtml(enemyHeading)}</h3>
          <div class="worm02-card-grid">
            ${teamCardsMarkup(enemyTeam, "enemy")}
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

function gatherOrdersFromSurface(surface) {
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
  return orders;
}

function randomEnhanceCard(card, seed = Date.now(), count = 1) {
  const next = { ...card };
  const statKeys = ["attack", "defense", "endurance", "info", "manipulation", "range", "speed", "stealth"];
  const iterations = Math.max(1, Math.floor(Number(count) || 1));
  for (let index = 0; index < iterations; index += 1) {
    const key = statKeys[(seed + index * 19) % statKeys.length];
    const delta = 1 + ((seed + index * 13) % 2);
    next[key] = Math.max(0, Number(next[key] || 0) + delta);
  }
  return next;
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

function toBattleResults(runtime) {
  return runtime && runtime.battle && Array.isArray(runtime.battle.playerTeam)
    ? runtime.battle.playerTeam.map((combatant) => ({
      cardId: combatant.cardId,
      hp: combatant.hp,
    }))
    : [];
}

function normalizeBossRuntime(runtime) {
  const source = runtime && typeof runtime === "object" ? runtime : {};
  return {
    summoned: Boolean(source.summoned),
    battle: normalizeBattle(source.battle),
    orderPrefs: source.orderPrefs && typeof source.orderPrefs === "object" ? source.orderPrefs : {},
    solved: Boolean(source.solved),
    pendingCloutAward: Math.max(0, Number(source.pendingCloutAward) || 0),
    lootEvents: Array.isArray(source.lootEvents) ? source.lootEvents.filter((entry) => entry && typeof entry === "object") : [],
    lastMessage: safeText(source.lastMessage),
  };
}

function reduceBossRuntime(current, action, context, config) {
  if (action.type === config.summonAction) {
    if (current.solved) {
      return {
        ...current,
        lastMessage: `${config.bossName} is already defeated.`,
      };
    }
    if (!action.ready) {
      return {
        ...current,
        lastMessage: `${config.artifactName} does not respond.`,
      };
    }
    return {
      ...current,
      summoned: true,
      lastMessage: config.summonMessage,
    };
  }

  if (action.type === config.startAction) {
    if (!current.summoned || current.solved) {
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
        lastMessage: `You need two healthy capes to fight ${config.bossName}.`,
      };
    }

    return {
      ...current,
      battle: createWormBattleState({
        playerCards,
        enemyCards: [config.bossCard],
        seed: Date.now() >>> 0,
        enemyAiMode: "boss",
      }),
      orderPrefs: {},
      lastMessage: config.startMessage,
    };
  }

  if (action.type === config.resolveAction) {
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
          ? `${config.bossName} is collapsing. Claim your outcome.`
          : "Your team is forced out. Regroup and try again."
        : current.lastMessage,
    };
  }

  if (action.type === config.resetAction) {
    return {
      ...current,
      battle: null,
      orderPrefs: {},
      lastMessage: config.retreatMessage,
    };
  }

  if (action.type === config.claimAction) {
    if (!current.battle || !current.battle.winner) {
      return current;
    }
    const won = current.battle.winner === "player";
    return {
      ...current,
      battle: null,
      orderPrefs: {},
      solved: won || current.solved,
      pendingCloutAward: won ? config.cloutReward : 0,
      lootEvents: won ? config.lootEvents : [],
      lastMessage: won ? config.victoryMessage : "Defeat recorded.",
    };
  }

  return current;
}

function buildBossActionFromElement(element, runtime, config) {
  const actionName = element.getAttribute("data-node-action");
  if (!actionName) {
    return null;
  }
  const surface = element.closest(`.${config.rootClass}`);
  if (!surface) {
    return null;
  }

  if (actionName === config.summonAction) {
    return {
      type: config.summonAction,
      artifact: element.getAttribute("data-artifact") || "",
      ready: element.getAttribute("data-ready") === "true",
      at: Date.now(),
    };
  }
  if (actionName === config.startAction) {
    return {
      type: config.startAction,
      at: Date.now(),
    };
  }
  if (actionName === config.resetAction) {
    return {
      type: config.resetAction,
      at: Date.now(),
    };
  }
  if (actionName === config.claimAction) {
    const current = normalizeBossRuntime(runtime);
    return {
      type: config.claimAction,
      winner: current && current.battle ? current.battle.winner : "",
      playerResults: toBattleResults(current),
      at: Date.now(),
    };
  }
  if (actionName === config.resolveAction) {
    return {
      type: config.resolveAction,
      orders: gatherOrdersFromSurface(surface),
      at: Date.now(),
    };
  }

  return null;
}

function renderBossExperience(context, config) {
  const runtime = normalizeBossRuntime(context.runtime);
  const selectedArtifact = safeText(context.selectedArtifactReward);
  const hasArtifactSelected = selectedArtifact === config.artifactName;
  const wormState = normalizeWormSystemState(context.state.systems.worm, Date.now());
  const availableTeam = topPlayerCards(wormState, context.state || {});

  return `
    <article class="${config.rootClass}" data-node-id="${config.nodeId}">
      <section class="card worm03-intro">
        <h3>${escapeHtml(config.title)}</h3>
        <p>${escapeHtml(config.introText)}</p>
        ${
  runtime.solved
    ? `<p class="muted">${escapeHtml(config.solvedText)}</p>`
    : `
              ${renderSlotRing({
      slots: [
        {
          filled: runtime.summoned,
          clickable: !runtime.summoned,
          ready: hasArtifactSelected,
          title: runtime.summoned
            ? `${config.artifactName} consumed.`
            : hasArtifactSelected
              ? "Socket selected artifact."
              : `Select ${config.artifactName}.`,
          ariaLabel: `${config.bossName} summon socket`,
          symbolHtml: renderArtifactSymbol({
            artifactName: config.artifactName,
            className: "slot-ring-symbol artifact-symbol",
          }),
          attrs: {
            "data-node-id": config.nodeId,
            "data-node-action": config.summonAction,
            "data-artifact": selectedArtifact,
            "data-ready": hasArtifactSelected ? "true" : "false",
          },
        },
      ],
      className: "worm03-amulet-slot-ring",
      ariaLabel: `${config.bossName} summon socket`,
    })}
              ${runtime.summoned && !runtime.battle ? `
                <div class="toolbar">
                  <button type="button" data-node-id="${config.nodeId}" data-node-action="${config.startAction}" ${availableTeam.length < 2 ? "disabled" : ""}>
                    Engage ${escapeHtml(config.bossName)} (2v1)
                  </button>
                </div>
              ` : ""}
            `
}
        ${runtime.lastMessage ? `<p class="muted">${escapeHtml(runtime.lastMessage)}</p>` : ""}
      </section>
      ${battleMarkup(config.nodeId, runtime, config.bossName, config.resolveAction, config.resetAction, config.claimAction)}
    </article>
  `;
}

const WORM05_CONFIG = Object.freeze({
  nodeId: WORM05_NODE_ID,
  rootClass: "worm05-node",
  title: "WORM05: Simurgh Engagement",
  introText: "A pressure front builds over the coast. Feathers of static spiral in the air.",
  solvedText: "Simurgh is down. The forecast line has gone silent.",
  bossName: "Simurgh",
  artifactName: SIMURGH_BRACELET,
  bossCard: SIMURGH_CARD,
  summonAction: "worm05-summon-simurgh",
  startAction: "worm05-start-battle",
  resolveAction: "worm05-resolve-round",
  resetAction: "worm05-reset-battle",
  claimAction: "worm05-claim-outcome",
  summonMessage: "The Simurgh descends on a screaming wind.",
  startMessage: "Simurgh sweeps into combat range.",
  retreatMessage: "You break line-of-sight and retreat.",
  victoryMessage: "Simurgh breaks apart in a storm of shattered futures.",
  cloutReward: 420,
  lootEvents: Object.freeze([
    {
      sourceRegion: "worm",
      triggerType: "simurgh-victory",
      dropChance: 1,
      outRegionChance: 1,
      forceOutRegion: true,
      rarityBias: 1,
    },
    {
      sourceRegion: "crd",
      triggerType: "simurgh-victory",
      dropChance: 1,
      outRegionChance: 0,
      rarityBias: 0.95,
    },
    {
      sourceRegion: "dcc",
      triggerType: "simurgh-victory",
      dropChance: 1,
      outRegionChance: 0,
      rarityBias: 0.95,
    },
  ]),
});

const WORM07_CONFIG = Object.freeze({
  nodeId: WORM07_NODE_ID,
  rootClass: "worm07-node",
  title: "WORM07: Behemoth Engagement",
  introText: "The ground splits under red light. Heat distorts every edge of the horizon.",
  solvedText: "Behemoth is defeated. The seismic storm has ended.",
  bossName: "Behemoth",
  artifactName: BEHEMOTH_ANKLET,
  bossCard: BEHEMOTH_CARD,
  summonAction: "worm07-summon-behemoth",
  startAction: "worm07-start-battle",
  resolveAction: "worm07-resolve-round",
  resetAction: "worm07-reset-battle",
  claimAction: "worm07-claim-outcome",
  summonMessage: "Behemoth tears up through molten stone.",
  startMessage: "Behemoth begins the endgame clash.",
  retreatMessage: "You fall back from the lava line.",
  victoryMessage: "Behemoth falls, and the earth finally stills.",
  cloutReward: 640,
  lootEvents: Object.freeze([
    {
      sourceRegion: "worm",
      triggerType: "behemoth-victory",
      dropChance: 1,
      outRegionChance: 1,
      forceOutRegion: true,
      rarityBias: 1,
    },
    {
      sourceRegion: "crd",
      triggerType: "behemoth-victory",
      dropChance: 1,
      outRegionChance: 0,
      rarityBias: 1,
    },
    {
      sourceRegion: "dcc",
      triggerType: "behemoth-victory",
      dropChance: 1,
      outRegionChance: 0,
      rarityBias: 1,
    },
  ]),
});

export function initialWorm05Runtime() {
  return normalizeBossRuntime({
    summoned: false,
    battle: null,
    orderPrefs: {},
    solved: false,
    pendingCloutAward: 0,
    lootEvents: [],
    lastMessage: "",
  });
}

export function synchronizeWorm05Runtime(runtime) {
  return normalizeBossRuntime(runtime);
}

export function validateWorm05Runtime(runtime) {
  return Boolean(runtime && runtime.solved);
}

export function reduceWorm05Runtime(runtime, action, context = {}) {
  const current = normalizeBossRuntime(runtime);
  if (!action || typeof action !== "object") {
    return current;
  }
  return reduceBossRuntime(current, action, context, WORM05_CONFIG);
}

export function buildWorm05ActionFromElement(element, runtime) {
  return buildBossActionFromElement(element, runtime, WORM05_CONFIG);
}

export function renderWorm05Experience(context) {
  return renderBossExperience(context, WORM05_CONFIG);
}

export const WORM05_NODE_EXPERIENCE = {
  nodeId: WORM05_NODE_ID,
  initialState: initialWorm05Runtime,
  synchronizeRuntime: synchronizeWorm05Runtime,
  render: renderWorm05Experience,
  reduceRuntime: reduceWorm05Runtime,
  validateRuntime: validateWorm05Runtime,
  buildActionFromElement: buildWorm05ActionFromElement,
};

function normalizeWorm06Runtime(runtime) {
  const source = runtime && typeof runtime === "object" ? runtime : {};
  return {
    introSeen: Boolean(source.introSeen),
    battle: normalizeBattle(source.battle),
    battleMode: safeText(source.battleMode).toLowerCase() === "boss" ? "boss" : "cleanup",
    activeDifficulty: normalizeDifficulty(source.activeDifficulty),
    orderPrefs: source.orderPrefs && typeof source.orderPrefs === "object" ? source.orderPrefs : {},
    pendingCloutReward: Math.max(0, Number(source.pendingCloutReward) || 0),
    pendingCloutAward: Math.max(0, Number(source.pendingCloutAward) || 0),
    bossCleared: Boolean(source.bossCleared),
    solved: Boolean(source.solved),
    lootEvents: Array.isArray(source.lootEvents) ? source.lootEvents.filter((entry) => entry && typeof entry === "object") : [],
    lastMessage: safeText(source.lastMessage),
  };
}

function chooseNationalCleanupEnemies(difficulty) {
  const config = WORM06_DIFFICULTY_CONFIG[difficulty] || WORM06_DIFFICULTY_CONFIG.easy;
  const draws = wormDrawWindowPack(2, {
    weightBase: config.weightBase,
    minRarity: 6,
    maxRarity: 10,
  }).map((card) => ({ ...card }));

  while (draws.length < 2) {
    const fallback = wormDrawWindowPack(1, {
      weightBase: config.weightBase,
      minRarity: 6,
      maxRarity: 10,
    })[0];
    if (!fallback) {
      break;
    }
    draws.push({ ...fallback });
  }

  if (draws.length < 2) {
    const fallbackElites = [
      {
        id: "worm-cleanup-elite-1",
        heroName: "National Threat Vector",
        power: "High-output composite cape profile adapted for disaster zones.",
        powerFull: "A high-output cape profile assembled from elite regional threats.",
        attack: 12,
        defense: 11,
        endurance: 13,
        info: 9,
        manipulation: 9,
        range: 11,
        speed: 10,
        stealth: 8,
        rarity: 6.3,
        rarityTier: "legendary",
      },
      {
        id: "worm-cleanup-elite-2",
        heroName: "Continental Breaker",
        power: "Escalation-class combatant built for prolonged front-line destruction.",
        powerFull: "An escalation-class combatant profile with sustained offense and endurance.",
        attack: 13,
        defense: 12,
        endurance: 14,
        info: 8,
        manipulation: 8,
        range: 10,
        speed: 9,
        stealth: 7,
        rarity: 6.6,
        rarityTier: "legendary",
      },
    ];
    for (const card of fallbackElites) {
      if (draws.length >= 2) {
        break;
      }
      draws.push({ ...card });
    }
  }

  return draws.map((card, index) => randomEnhanceCard(card, Date.now() + index * 37, 3));
}

function triumvirateCards() {
  const names = ["Eidolon", "Alexandria", "Legend"];
  const fallback = {
    Eidolon: {
      id: "worm-boss-eidolon",
      heroName: "Eidolon",
      power: "Adaptive power suite that shifts to meet threats.",
      powerFull: "Eidolon deploys shifting power sets with massive versatility and pressure.",
      attack: 15,
      defense: 14,
      endurance: 16,
      info: 12,
      manipulation: 12,
      range: 14,
      speed: 11,
      stealth: 8,
      rarity: 9.2,
      rarityTier: "mythic",
    },
    Alexandria: {
      id: "worm-boss-alexandria",
      heroName: "Alexandria",
      power: "Invulnerable brute with overwhelming speed and force.",
      powerFull: "Alexandria combines near-invulnerability, flight, and crushing physical dominance.",
      attack: 14,
      defense: 17,
      endurance: 18,
      info: 9,
      manipulation: 8,
      range: 9,
      speed: 14,
      stealth: 6,
      rarity: 9,
      rarityTier: "mythic",
    },
    Legend: {
      id: "worm-boss-legend",
      heroName: "Legend",
      power: "High-velocity flight and precision energy projection.",
      powerFull: "Legend controls the battlefield with speed, angles, and continuous energy-fire pressure.",
      attack: 16,
      defense: 12,
      endurance: 14,
      info: 11,
      manipulation: 9,
      range: 18,
      speed: 16,
      stealth: 9,
      rarity: 9.1,
      rarityTier: "mythic",
    },
  };

  return names.map((name, index) => {
    const catalog = catalogCardByName(name);
    const base = catalog ? { ...catalog } : { ...fallback[name] };
    return randomEnhanceCard(base, Date.now() + index * 53, 5);
  });
}

export function initialWorm06Runtime() {
  return normalizeWorm06Runtime({
    introSeen: false,
    battle: null,
    battleMode: "cleanup",
    activeDifficulty: "easy",
    orderPrefs: {},
    pendingCloutReward: 0,
    pendingCloutAward: 0,
    bossCleared: false,
    solved: false,
    lootEvents: [],
    lastMessage: "",
  });
}

export function synchronizeWorm06Runtime(runtime) {
  return normalizeWorm06Runtime(runtime);
}

export function validateWorm06Runtime(runtime) {
  return Boolean(runtime && runtime.solved);
}

export function reduceWorm06Runtime(runtime, action, context = {}) {
  const current = normalizeWorm06Runtime(runtime);
  if (!action || typeof action !== "object") {
    return current;
  }

  if (action.type === "worm06-ack-intro") {
    return {
      ...current,
      introSeen: true,
    };
  }

  if (action.type === "worm06-start-job") {
    if (current.solved) {
      return current;
    }
    const difficulty = normalizeDifficulty(action.difficulty);
    const wormState = normalizeWormSystemState(
      context && context.state && context.state.systems ? context.state.systems.worm : {},
      Date.now(),
    );
    const playerCards = topPlayerCards(wormState, context.state || {});
    if (playerCards.length < 2) {
      return {
        ...current,
        lastMessage: "You need two healthy capes for national cleanup jobs.",
      };
    }

    const enemies = chooseNationalCleanupEnemies(difficulty);
    const battle = createWormBattleState({
      playerCards,
      enemyCards: enemies,
      seed: Date.now() >>> 0,
      enemyAiMode: "boss",
    });

    const baseClout = Math.max(1, Number(action.baseCloutReward) || 60);
    const mult = WORM06_DIFFICULTY_CONFIG[difficulty].cloutMult;

    return {
      ...current,
      introSeen: true,
      battle,
      battleMode: "cleanup",
      activeDifficulty: difficulty,
      orderPrefs: {},
      pendingCloutReward: Math.round(baseClout * mult),
      lastMessage: `${WORM06_DIFFICULTY_CONFIG[difficulty].label} initiated.`,
    };
  }

  if (action.type === "worm06-start-bosses") {
    if (current.solved || current.bossCleared || current.battle) {
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
        lastMessage: "You need two healthy capes to challenge the Triumvirate.",
      };
    }

    return {
      ...current,
      introSeen: true,
      battle: createWormBattleState({
        playerCards,
        enemyCards: triumvirateCards(),
        maxEnemyCards: 3,
        seed: Date.now() >>> 0,
        enemyAiMode: "boss",
      }),
      battleMode: "boss",
      orderPrefs: {},
      pendingCloutReward: 0,
      lastMessage: "Triumvirate confrontation begins.",
    };
  }

  if (action.type === "worm06-resolve-round") {
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
          ? "National objective complete. Claim outcome."
          : "Your team is overrun."
        : current.lastMessage,
    };
  }

  if (action.type === "worm06-reset-battle") {
    return {
      ...current,
      battle: null,
      battleMode: "cleanup",
      orderPrefs: {},
      pendingCloutReward: 0,
      lastMessage: "You disengage from the current operation.",
    };
  }

  if (action.type === "worm06-claim-outcome") {
    if (!current.battle || !current.battle.winner) {
      return current;
    }
    const won = current.battle.winner === "player";
    const isBoss = current.battleMode === "boss";
    return {
      ...current,
      battle: null,
      orderPrefs: {},
      battleMode: "cleanup",
      bossCleared: current.bossCleared || (won && isBoss),
      solved: current.solved || (won && isBoss),
      pendingCloutAward: won ? (isBoss ? 950 : current.pendingCloutReward) : 0,
      pendingCloutReward: 0,
      lootEvents: won
        ? isBoss
          ? [
            {
              sourceRegion: "worm",
              triggerType: "national-cleanup-boss",
              dropChance: 1,
              outRegionChance: 1,
              forceOutRegion: true,
              rarityBias: 1,
            },
            {
              sourceRegion: "crd",
              triggerType: "national-cleanup-boss",
              dropChance: 1,
              outRegionChance: 0,
              rarityBias: 1,
            },
            {
              sourceRegion: "dcc",
              triggerType: "national-cleanup-boss",
              dropChance: 1,
              outRegionChance: 0,
              rarityBias: 1,
            },
          ]
          : [
            {
              sourceRegion: "worm",
              triggerType: "national-cleanup-job",
              dropChance: 0.65,
              outRegionChance: 0.45,
              rarityBias: 0.9,
            },
          ]
        : [],
      lastMessage: won
        ? isBoss
          ? "Triumvirate defeated. National cleanup secured."
          : "Cleanup mission successful."
        : "Mission failed.",
    };
  }

  return current;
}

export function buildWorm06ActionFromElement(element, runtime) {
  const actionName = element.getAttribute("data-node-action");
  if (!actionName) {
    return null;
  }
  const surface = element.closest(".worm06-node");
  if (!surface) {
    return null;
  }
  if (actionName === "worm06-ack-intro") {
    return { type: "worm06-ack-intro", at: Date.now() };
  }
  if (actionName === "worm06-start-job") {
    return {
      type: "worm06-start-job",
      difficulty: element.getAttribute("data-difficulty") || "easy",
      baseCloutReward: Number(element.getAttribute("data-base-clout-reward") || 60),
      at: Date.now(),
    };
  }
  if (actionName === "worm06-start-bosses") {
    return {
      type: "worm06-start-bosses",
      at: Date.now(),
    };
  }
  if (actionName === "worm06-reset-battle") {
    return {
      type: "worm06-reset-battle",
      at: Date.now(),
    };
  }
  if (actionName === "worm06-claim-outcome") {
    const current = normalizeWorm06Runtime(runtime);
    return {
      type: "worm06-claim-outcome",
      winner: current && current.battle ? current.battle.winner : "",
      playerResults: toBattleResults(current),
      at: Date.now(),
    };
  }
  if (actionName === "worm06-resolve-round") {
    return {
      type: "worm06-resolve-round",
      orders: gatherOrdersFromSurface(surface),
      at: Date.now(),
    };
  }
  return null;
}

export function renderWorm06Experience(context) {
  const runtime = normalizeWorm06Runtime(context.runtime);
  const baseReward = 60;
  const enemyHeading = runtime.battleMode === "boss" ? "Triumvirate" : "National Targets";
  return `
    <article class="worm06-node" data-node-id="${WORM06_NODE_ID}">
      <section class="card">
        <h3>WORM06: National Cleanup</h3>
        ${
  !runtime.introSeen
    ? `
              <p>Brockton Bay was only the beginning. You now stabilize crisis zones nationwide.</p>
              <button type="button" data-node-id="${WORM06_NODE_ID}" data-node-action="worm06-ack-intro">Begin National Cleanup</button>
            `
    : `
              <p><strong>Status:</strong> ${runtime.bossCleared ? "Triumvirate defeated" : "Operations ongoing"}</p>
              <div class="toolbar">
                <button type="button" data-node-id="${WORM06_NODE_ID}" data-node-action="worm06-start-job" data-difficulty="easy" data-base-clout-reward="${escapeHtml(String(baseReward))}" ${runtime.battle || runtime.solved ? "disabled" : ""}>Easy Cleanup</button>
                <button type="button" data-node-id="${WORM06_NODE_ID}" data-node-action="worm06-start-job" data-difficulty="medium" data-base-clout-reward="${escapeHtml(String(baseReward))}" ${runtime.battle || runtime.solved ? "disabled" : ""}>Medium Cleanup</button>
                <button type="button" data-node-id="${WORM06_NODE_ID}" data-node-action="worm06-start-job" data-difficulty="hard" data-base-clout-reward="${escapeHtml(String(baseReward))}" ${runtime.battle || runtime.solved ? "disabled" : ""}>Hard Cleanup</button>
                <button type="button" data-node-id="${WORM06_NODE_ID}" data-node-action="worm06-start-bosses" ${runtime.battle || runtime.bossCleared ? "disabled" : ""}>Fight The Bosses</button>
              </div>
            `
}
        ${runtime.lastMessage ? `<p class="muted">${escapeHtml(runtime.lastMessage)}</p>` : ""}
      </section>
      ${battleMarkup(WORM06_NODE_ID, runtime, enemyHeading, "worm06-resolve-round", "worm06-reset-battle", "worm06-claim-outcome")}
    </article>
  `;
}

export const WORM06_NODE_EXPERIENCE = {
  nodeId: WORM06_NODE_ID,
  initialState: initialWorm06Runtime,
  synchronizeRuntime: synchronizeWorm06Runtime,
  render: renderWorm06Experience,
  reduceRuntime: reduceWorm06Runtime,
  validateRuntime: validateWorm06Runtime,
  buildActionFromElement: buildWorm06ActionFromElement,
};

export function initialWorm07Runtime() {
  return normalizeBossRuntime({
    summoned: false,
    battle: null,
    orderPrefs: {},
    solved: false,
    pendingCloutAward: 0,
    lootEvents: [],
    lastMessage: "",
  });
}

export function synchronizeWorm07Runtime(runtime) {
  return normalizeBossRuntime(runtime);
}

export function validateWorm07Runtime(runtime) {
  return Boolean(runtime && runtime.solved);
}

export function reduceWorm07Runtime(runtime, action, context = {}) {
  const current = normalizeBossRuntime(runtime);
  if (!action || typeof action !== "object") {
    return current;
  }
  return reduceBossRuntime(current, action, context, WORM07_CONFIG);
}

export function buildWorm07ActionFromElement(element, runtime) {
  return buildBossActionFromElement(element, runtime, WORM07_CONFIG);
}

export function renderWorm07Experience(context) {
  return renderBossExperience(context, WORM07_CONFIG);
}

export const WORM07_NODE_EXPERIENCE = {
  nodeId: WORM07_NODE_ID,
  initialState: initialWorm07Runtime,
  synchronizeRuntime: synchronizeWorm07Runtime,
  render: renderWorm07Experience,
  reduceRuntime: reduceWorm07Runtime,
  validateRuntime: validateWorm07Runtime,
  buildActionFromElement: buildWorm07ActionFromElement,
};

function normalizeWorm08Runtime(runtime) {
  const source = runtime && typeof runtime === "object" ? runtime : {};
  const sockets = source.sockets && typeof source.sockets === "object" ? source.sockets : {};
  return {
    sockets: {
      leviathan: Boolean(sockets.leviathan),
      simurgh: Boolean(sockets.simurgh),
      behemoth: Boolean(sockets.behemoth),
    },
    battle: normalizeBattle(source.battle),
    orderPrefs: source.orderPrefs && typeof source.orderPrefs === "object" ? source.orderPrefs : {},
    solved: Boolean(source.solved),
    pendingCloutAward: Math.max(0, Number(source.pendingCloutAward) || 0),
    lootEvents: Array.isArray(source.lootEvents) ? source.lootEvents.filter((entry) => entry && typeof entry === "object") : [],
    lastMessage: safeText(source.lastMessage),
  };
}

function sigilMeta() {
  return [
    { key: "leviathan", artifact: LEVIATHAN_SIGIL },
    { key: "simurgh", artifact: SIMURGH_SIGIL },
    { key: "behemoth", artifact: BEHEMOTH_SIGIL },
  ];
}

function canStartScion(runtime) {
  return runtime.sockets.leviathan && runtime.sockets.simurgh && runtime.sockets.behemoth;
}

export function initialWorm08Runtime() {
  return normalizeWorm08Runtime({
    sockets: { leviathan: false, simurgh: false, behemoth: false },
    battle: null,
    orderPrefs: {},
    solved: false,
    pendingCloutAward: 0,
    lootEvents: [],
    lastMessage: "",
  });
}

export function synchronizeWorm08Runtime(runtime) {
  return normalizeWorm08Runtime(runtime);
}

export function validateWorm08Runtime(runtime) {
  return Boolean(runtime && runtime.solved);
}

export function reduceWorm08Runtime(runtime, action, context = {}) {
  const current = normalizeWorm08Runtime(runtime);
  if (!action || typeof action !== "object") {
    return current;
  }

  if (action.type === "worm08-socket-sigil") {
    const key = safeText(action.sigilType).toLowerCase();
    if (!["leviathan", "simurgh", "behemoth"].includes(key)) {
      return current;
    }
    if (!action.ready) {
      return {
        ...current,
        lastMessage: "The socket rejects the selected artifact.",
      };
    }
    return {
      ...current,
      sockets: {
        ...current.sockets,
        [key]: true,
      },
      lastMessage: "Sigil socketed.",
    };
  }

  if (action.type === "worm08-start-battle") {
    if (current.solved || current.battle || !canStartScion(current)) {
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
        lastMessage: "You need two healthy capes to face Scion.",
      };
    }
    return {
      ...current,
      battle: createWormBattleState({
        playerCards,
        enemyCards: [SCION_CARD],
        seed: Date.now() >>> 0,
        enemyAiMode: "boss",
      }),
      orderPrefs: {},
      lastMessage: "Scion enters the field.",
    };
  }

  if (action.type === "worm08-resolve-round") {
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
          ? "Impossible. Scion falls. Claim outcome."
          : "Scion erases the line."
        : current.lastMessage,
    };
  }

  if (action.type === "worm08-reset-battle") {
    return {
      ...current,
      battle: null,
      orderPrefs: {},
      lastMessage: "You retreat before total collapse.",
    };
  }

  if (action.type === "worm08-claim-outcome") {
    if (!current.battle || !current.battle.winner) {
      return current;
    }
    const won = current.battle.winner === "player";
    return {
      ...current,
      battle: null,
      orderPrefs: {},
      solved: won || current.solved,
      pendingCloutAward: won ? 1600 : 0,
      lootEvents: won
        ? [
          {
            sourceRegion: "worm",
            triggerType: "scion-victory",
            dropChance: 1,
            outRegionChance: 1,
            forceOutRegion: true,
            rarityBias: 1,
          },
          {
            sourceRegion: "crd",
            triggerType: "scion-victory",
            dropChance: 1,
            outRegionChance: 0,
            rarityBias: 1,
          },
          {
            sourceRegion: "dcc",
            triggerType: "scion-victory",
            dropChance: 1,
            outRegionChance: 0,
            rarityBias: 1,
          },
        ]
        : [],
      lastMessage: won ? "Scion is defeated. Against all expectation." : "Defeat recorded.",
    };
  }

  return current;
}

export function buildWorm08ActionFromElement(element, runtime) {
  const actionName = element.getAttribute("data-node-action");
  if (!actionName) {
    return null;
  }
  const surface = element.closest(".worm08-node");
  if (!surface) {
    return null;
  }

  if (actionName === "worm08-socket-sigil") {
    return {
      type: "worm08-socket-sigil",
      sigilType: element.getAttribute("data-sigil-type") || "",
      artifact: element.getAttribute("data-artifact") || "",
      ready: element.getAttribute("data-ready") === "true",
      at: Date.now(),
    };
  }
  if (actionName === "worm08-start-battle") {
    return {
      type: "worm08-start-battle",
      at: Date.now(),
    };
  }
  if (actionName === "worm08-reset-battle") {
    return {
      type: "worm08-reset-battle",
      at: Date.now(),
    };
  }
  if (actionName === "worm08-claim-outcome") {
    const current = normalizeWorm08Runtime(runtime);
    return {
      type: "worm08-claim-outcome",
      winner: current && current.battle ? current.battle.winner : "",
      playerResults: toBattleResults(current),
      at: Date.now(),
    };
  }
  if (actionName === "worm08-resolve-round") {
    return {
      type: "worm08-resolve-round",
      orders: gatherOrdersFromSurface(surface),
      at: Date.now(),
    };
  }

  return null;
}

export function renderWorm08Experience(context) {
  const runtime = normalizeWorm08Runtime(context.runtime);
  const selectedArtifact = safeText(context.selectedArtifactReward);
  const sockets = sigilMeta();
  const allSocketed = canStartScion(runtime);

  const ringSlots = sockets.map((entry) => {
    const filled = Boolean(runtime.sockets[entry.key]);
    const ready = !filled && selectedArtifact === entry.artifact;
    return {
      filled,
      clickable: !filled,
      ready,
      title: filled ? `${entry.artifact} socketed.` : entry.artifact,
      ariaLabel: `${entry.artifact} socket`,
      symbolHtml: filled
        ? renderArtifactSymbol({ artifactName: entry.artifact, className: "slot-ring-symbol artifact-symbol" })
        : "",
      attrs: {
        "data-node-id": WORM08_NODE_ID,
        "data-node-action": "worm08-socket-sigil",
        "data-sigil-type": entry.key,
        "data-artifact": selectedArtifact,
        "data-ready": ready ? "true" : "false",
      },
    };
  });

  return `
    <article class="worm08-node" data-node-id="${WORM08_NODE_ID}">
      <section class="card">
        <h3>WORM08: Scion</h3>
        <p>The final light waits above a ruined sky. Three Endbringer sigils must lock before it descends.</p>
        ${renderSlotRing({
    slots: ringSlots,
    className: "worm08-sigil-ring",
    ariaLabel: "Scion gate sigils",
    radiusPct: 42,
  })}
        ${
  allSocketed && !runtime.solved && !runtime.battle
    ? `<div class="toolbar"><button type="button" data-node-id="${WORM08_NODE_ID}" data-node-action="worm08-start-battle">Challenge Scion (2v1)</button></div>`
    : ""
}
        ${runtime.lastMessage ? `<p class="muted">${escapeHtml(runtime.lastMessage)}</p>` : ""}
      </section>
      ${battleMarkup(WORM08_NODE_ID, runtime, "Scion", "worm08-resolve-round", "worm08-reset-battle", "worm08-claim-outcome")}
    </article>
  `;
}

export const WORM08_NODE_EXPERIENCE = {
  nodeId: WORM08_NODE_ID,
  initialState: initialWorm08Runtime,
  synchronizeRuntime: synchronizeWorm08Runtime,
  render: renderWorm08Experience,
  reduceRuntime: reduceWorm08Runtime,
  validateRuntime: validateWorm08Runtime,
  buildActionFromElement: buildWorm08ActionFromElement,
};
