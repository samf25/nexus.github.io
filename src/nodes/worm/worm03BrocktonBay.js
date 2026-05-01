import { escapeHtml } from "../../templates/shared.js";
import { renderArtifactSymbol } from "../../core/artifacts.js";
import {
  createWormBattleState,
  infoDebuffStatKeys,
  resolveWormRound,
  selectableWormActions,
} from "./wormCombatSystem.js";
import { renderWormCard } from "./wormCardRenderer.js";
import { wormCardById } from "./wormData.js";
import { normalizeWormSystemState, wormOwnedCards } from "../../systems/wormDeck.js";
import { getWormCapeLootBonuses } from "../../systems/loot.js";
import { renderSlotRing } from "../../ui/slotRing.js";

const NODE_ID = "WORM03";
const LEVIATHAN_AMULET = "Leviathan Summoning Amulet";

const ACTION_LABELS = Object.freeze({
  attack: "Attack",
  defense: "Defense",
  info: "Info",
  manipulation: "Manipulation",
  speed: "Speed",
  stealth: "Stealth",
});

const LEVIATHAN_CARD = Object.freeze({
  id: "worm-boss-leviathan",
  heroName: "Leviathan",
  power: "Hydrokinetic Endbringer with impossible velocity and layered pressure waves.",
  powerFull: "Leviathan moves with impossible velocity, manipulates water and pressure, and adapts to concentrated fire.",
  attack: 11,
  defense: 10,
  endurance: 13,
  info: 8,
  manipulation: 7,
  range: 12,
  speed: 11,
  stealth: 6,
  rarity: 6.8,
  rarityTier: "legendary",
});

function safeText(value) {
  return String(value == null ? "" : value).trim();
}

function normalizeBattle(value) {
  return value && typeof value === "object" ? value : null;
}

function normalizeRuntime(runtime) {
  const source = runtime && typeof runtime === "object" ? runtime : {};
  return {
    summoned: Boolean(source.summoned),
    battle: normalizeBattle(source.battle),
    orderPrefs: source.orderPrefs && typeof source.orderPrefs === "object" ? source.orderPrefs : {},
    solved: Boolean(source.solved),
    pendingCloutAward: Math.max(0, Number(source.pendingCloutAward) || 0),
    lootEvents: Array.isArray(source.lootEvents) ? source.lootEvents.filter((entry) => entry && typeof entry === "object") : [],
    outcomePopup: source.outcomePopup && typeof source.outcomePopup === "object" ? { ...source.outcomePopup } : null,
    lastMessage: safeText(source.lastMessage),
  };
}

function actionNeedsTarget(actionType) {
  const type = safeText(actionType).toLowerCase();
  return type === "attack" || type === "info" || type === "manipulation";
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
    <article class="worm02-order-row" data-worm03-order-row data-actor-id="${escapeHtml(combatant.combatantId)}">
      <h4>${escapeHtml(combatant.heroName)}</h4>
      <label>
        <span>Action</span>
        <select class="worm02-select" data-worm03-order-type>
          ${actionOptions}
        </select>
      </label>
      <label data-worm03-target-wrap ${showTarget ? "" : "hidden"}>
        <span>Target</span>
        <select class="worm02-select" data-worm03-order-target>
          ${targetOptions}
        </select>
      </label>
      <label data-worm03-info-wrap ${normalized.type === "info" ? "" : "hidden"}>
        <span>Info Debuff</span>
        <select class="worm02-select" data-worm03-order-info>
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
    const card = applyCardBonus(
      {
        ...entry.card,
        currentHp: Number(entry.currentHp || 0),
      },
      bonus,
    );
    return card;
  });
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
              <button type="button" data-node-id="${NODE_ID}" data-node-action="worm03-resolve-round" ${canResolve ? "" : "disabled"}>Resolve Turn</button>
              <button type="button" class="ghost" data-node-id="${NODE_ID}" data-node-action="worm03-reset-battle">Retreat</button>
              ${
                battle.winner
                  ? `<button type="button" data-node-id="${NODE_ID}" data-node-action="worm03-claim-outcome">Claim Outcome</button>`
                  : ""
              }
            </div>
          </section>
        </section>
        <section class="worm02-team-column">
          <h3>Leviathan</h3>
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
          <button type="button" data-node-id="${NODE_ID}" data-node-action="worm03-close-outcome-popup">Close</button>
        </div>
      </section>
    </section>
  `;
}

export function initialWorm03Runtime() {
  return normalizeRuntime({
    summoned: false,
    battle: null,
    orderPrefs: {},
    solved: false,
    pendingCloutAward: 0,
    lootEvents: [],
    outcomePopup: null,
    lastMessage: "",
  });
}

export function synchronizeWorm03Runtime(runtime) {
  return normalizeRuntime(runtime);
}

export function validateWorm03Runtime(runtime) {
  return Boolean(runtime && runtime.solved);
}

export function reduceWorm03Runtime(runtime, action, context = {}) {
  const current = normalizeRuntime(runtime);
  if (!action || typeof action !== "object") {
    return current;
  }

  if (action.type === "worm03-summon-leviathan") {
    if (current.solved) {
      return {
        ...current,
        lastMessage: "Leviathan is already defeated.",
      };
    }
    if (!action.ready) {
      return {
        ...current,
        lastMessage: "The amulet remains inert.",
      };
    }
    return {
      ...current,
      summoned: true,
      lastMessage: "Leviathan rises from the bay.",
    };
  }

  if (action.type === "worm03-start-battle") {
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
        lastMessage: "You need two healthy capes to fight Leviathan.",
      };
    }
    return {
      ...current,
      battle: createWormBattleState({
        playerCards,
        enemyCards: [LEVIATHAN_CARD],
        seed: Date.now() >>> 0,
        enemyAiMode: "boss",
      }),
      orderPrefs: {},
      outcomePopup: null,
      lastMessage: "Leviathan crashes into range.",
    };
  }

  if (action.type === "worm03-resolve-round") {
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
          ? "Leviathan falters. Claim your outcome."
          : "You are swept aside. Regroup and try again."
        : current.lastMessage,
    };
  }

  if (action.type === "worm03-reset-battle") {
    return {
      ...current,
      battle: null,
      orderPrefs: {},
      outcomePopup: null,
      lastMessage: "You retreat from the flooded district.",
    };
  }

  if (action.type === "worm03-close-outcome-popup") {
    return {
      ...current,
      outcomePopup: null,
    };
  }

  if (action.type === "worm03-claim-outcome") {
    if (!current.battle || !current.battle.winner) {
      return current;
    }
    const won = current.battle.winner === "player";
    return {
      ...current,
      battle: null,
      orderPrefs: {},
      solved: won || current.solved,
      pendingCloutAward: won ? 220 : 0,
      lootEvents: won
        ? [
          {
            sourceRegion: "worm",
            triggerType: "leviathan-victory",
            dropChance: 1,
            forceOutRegion: true,
            outRegionChance: 1,
            rarityBias: 0.9,
          },
          {
            sourceRegion: "crd",
            triggerType: "leviathan-victory",
            dropChance: 1,
            outRegionChance: 0,
            rarityBias: 0.8,
          },
          {
            sourceRegion: "dcc",
            triggerType: "leviathan-victory",
            dropChance: 1,
            outRegionChance: 0,
            rarityBias: 0.8,
          },
        ]
        : [],
      outcomePopup: {
        title: won ? "Leviathan Defeated" : "Leviathan Repelled You",
        lines: won
          ? [
            "Clout awarded: 220",
            "Artifacts awarded: Nightwine Ledger, Leviathan Core Sigil",
            "Loot queued: CRD + WORM + DCC drops",
          ]
          : ["No clout awarded.", "No artifact rewards.", "Regroup and try again."],
      },
      lastMessage: won ? "Leviathan falls. Brockton Bay survives." : "Defeat recorded.",
    };
  }

  return current;
}

export function buildWorm03ActionFromElement(element, runtime) {
  const actionName = element.getAttribute("data-node-action");
  if (!actionName) {
    return null;
  }
  const surface = element.closest(".worm03-node");
  if (!surface) {
    return null;
  }

  if (actionName === "worm03-summon-leviathan") {
    return {
      type: "worm03-summon-leviathan",
      artifact: element.getAttribute("data-artifact") || "",
      ready: element.getAttribute("data-ready") === "true",
      at: Date.now(),
    };
  }
  if (actionName === "worm03-start-battle") {
    return {
      type: "worm03-start-battle",
      at: Date.now(),
    };
  }
  if (actionName === "worm03-reset-battle") {
    return {
      type: "worm03-reset-battle",
      at: Date.now(),
    };
  }
  if (actionName === "worm03-close-outcome-popup") {
    return {
      type: "worm03-close-outcome-popup",
      at: Date.now(),
    };
  }
  if (actionName === "worm03-claim-outcome") {
    const current = normalizeRuntime(runtime);
    const playerResults =
      current && current.battle && Array.isArray(current.battle.playerTeam)
        ? current.battle.playerTeam.map((combatant) => ({
          cardId: combatant.cardId,
          hp: combatant.hp,
        }))
        : [];
    return {
      type: "worm03-claim-outcome",
      winner: current && current.battle ? current.battle.winner : "",
      playerResults,
      at: Date.now(),
    };
  }
  if (actionName === "worm03-resolve-round") {
    const rows = [...surface.querySelectorAll("[data-worm03-order-row]")];
    const orders = {};
    for (const row of rows) {
      const actorId = safeText(row.getAttribute("data-actor-id"));
      if (!actorId) {
        continue;
      }
      const typeInput = row.querySelector("[data-worm03-order-type]");
      const targetInput = row.querySelector("[data-worm03-order-target]");
      const infoInput = row.querySelector("[data-worm03-order-info]");
      orders[actorId] = {
        type: typeInput && "value" in typeInput ? safeText(typeInput.value) : "attack",
        targetId: targetInput && "value" in targetInput ? safeText(targetInput.value) : "",
        infoStat: infoInput && "value" in infoInput ? safeText(infoInput.value) : "attack",
      };
    }
    return {
      type: "worm03-resolve-round",
      orders,
      at: Date.now(),
    };
  }
  return null;
}

export function renderWorm03Experience(context) {
  const runtime = normalizeRuntime(context.runtime);
  const selectedArtifact = safeText(context.selectedArtifactReward);
  const hasAmulet = selectedArtifact === LEVIATHAN_AMULET;
  const wormState = normalizeWormSystemState(context.state.systems.worm, Date.now());
  const availableTeam = topPlayerCards(wormState, context.state || {});

  return `
    <article class="worm03-node" data-node-id="${NODE_ID}">
      <section class="card worm03-intro">
        <h3>WORM03: Brockton Bay</h3>
        <p>You walk the shattered docks while rain hammers the empty warehouses.</p>
        ${
          runtime.solved
            ? `<p class="muted">Leviathan has been defeated. The bay is yours for now.</p>`
            : `
              ${renderSlotRing({
    slots: [
      {
        filled: runtime.summoned,
        clickable: !runtime.summoned,
        ready: hasAmulet,
        title: runtime.summoned
          ? "Leviathan Summoning Amulet consumed."
          : hasAmulet
            ? "Socket selected artifact."
            : "Select the Leviathan Summoning Amulet, then click.",
        ariaLabel: "Leviathan amulet socket",
        symbolHtml: renderArtifactSymbol({
          artifactName: LEVIATHAN_AMULET,
          className: "slot-ring-symbol artifact-symbol",
        }),
        attrs: {
          "data-node-id": NODE_ID,
          "data-node-action": "worm03-summon-leviathan",
          "data-artifact": selectedArtifact,
          "data-ready": hasAmulet ? "true" : "false",
        },
      },
    ],
    className: "worm03-amulet-slot-ring",
    ariaLabel: "Leviathan summoning socket",
  })}
              ${runtime.summoned && !runtime.battle ? `
                <div class="toolbar">
                  <button type="button" data-node-id="${NODE_ID}" data-node-action="worm03-start-battle" ${availableTeam.length < 2 ? "disabled" : ""}>
                    Engage Leviathan (2v1)
                  </button>
                </div>
              ` : ""}
            `
        }
        ${runtime.lastMessage ? `<p class="muted">${escapeHtml(runtime.lastMessage)}</p>` : ""}
      </section>
      ${battleMarkup(runtime)}
      ${outcomePopupMarkup(runtime)}
    </article>
  `;
}

export const WORM03_NODE_EXPERIENCE = {
  nodeId: NODE_ID,
  initialState: initialWorm03Runtime,
  synchronizeRuntime: synchronizeWorm03Runtime,
  render: renderWorm03Experience,
  reduceRuntime: reduceWorm03Runtime,
  validateRuntime: validateWorm03Runtime,
  buildActionFromElement: buildWorm03ActionFromElement,
};
