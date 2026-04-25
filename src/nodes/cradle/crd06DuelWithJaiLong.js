import { escapeHtml } from "../../templates/shared.js";
import {
  madraPoolMultiplierForStage,
  normalizeCombatStage,
  randomUnit,
  rollDamage,
} from "./combatSystem.js";

const NODE_ID = "CRD06";

function nowMs() {
  return Date.now();
}

function normalizeRuntime(runtime) {
  const source = runtime && typeof runtime === "object" ? runtime : {};
  const phase = ["intro", "battle", "victory"].includes(source.phase) ? source.phase : "intro";
  return {
    phase,
    solved: Boolean(source.solved),
    seed: Number.isFinite(source.seed) ? Number(source.seed) >>> 0 : (Date.now() >>> 0),
    playerStage: normalizeCombatStage(source.playerStage || "foundation"),
    playerHp: Math.max(0, Number(source.playerHp) || 0),
    playerMaxHp: Math.max(1, Number(source.playerMaxHp) || 120),
    playerMadra: Math.max(0, Number(source.playerMadra) || 0),
    playerMaxMadra: Math.max(1, Number(source.playerMaxMadra) || 100),
    dodgeReady: Boolean(source.dodgeReady),
    dodgeBonus: Math.max(0, Number(source.dodgeBonus) || 0),
    meleeBonus: Math.max(0, Number(source.meleeBonus) || 0),
    emptyPalmUnlocked: Boolean(source.emptyPalmUnlocked),
    enemy: source.enemy && typeof source.enemy === "object"
      ? {
        hp: Math.max(0, Number(source.enemy.hp) || 0),
        maxHp: Math.max(1, Number(source.enemy.maxHp) || 220),
        stage: normalizeCombatStage(source.enemy.stage || "gold"),
        stunnedTurns: Math.max(0, Math.floor(Number(source.enemy.stunnedTurns) || 0)),
        coilStacks: Math.max(0, Math.floor(Number(source.enemy.coilStacks) || 0)),
      }
      : { hp: 220, maxHp: 220, stage: "gold", stunnedTurns: 0, coilStacks: 0 },
    turn: Math.max(1, Math.floor(Number(source.turn) || 1)),
    log: Array.isArray(source.log) ? source.log.slice(-10).map((line) => String(line)) : [],
    lastMessage: String(source.lastMessage || ""),
  };
}

function readCrd02Runtime(state) {
  if (!state || !state.nodeRuntime || typeof state.nodeRuntime !== "object") {
    return {};
  }
  const runtime = state.nodeRuntime.CRD02;
  return runtime && typeof runtime === "object" ? runtime : {};
}

function combatProfileFromState(state) {
  const crd02 = readCrd02Runtime(state);
  const upgrades = crd02.upgrades && typeof crd02.upgrades === "object" ? crd02.upgrades : {};
  const stage = normalizeCombatStage(crd02.cultivationStage || "foundation");
  const ironBody = Number(upgrades["blood-forged-iron-body"] || 0);
  const soulCloak = Number(upgrades["soul-cloak"] || 0);
  const emptyPalm = Number(upgrades["empty-palm"] || 0);
  const consume = Number(upgrades.consume || 0);
  const hollowDomain = Number(upgrades["hollow-domain"] || 0);

  return {
    stage,
    hasEmptyPalm: emptyPalm > 0,
    meleeBonus: soulCloak + consume + hollowDomain,
    dodgeBonus: soulCloak + hollowDomain,
    maxHp: 128 + ironBody * 26 + (stage === "jade" ? 26 : stage === "gold" ? 44 : 0),
    maxMadra: Math.round((112 + soulCloak * 4 + consume * 6 + hollowDomain * 7) * madraPoolMultiplierForStage(stage)),
  };
}

function appendLog(runtime, line) {
  return {
    ...runtime,
    log: [...runtime.log.slice(-9), line],
  };
}

function barMarkup(label, current, max, className = "") {
  const safeMax = Math.max(1, Number(max) || 1);
  const value = Math.max(0, Number(current) || 0);
  const percent = Math.min(100, Math.max(0, (value / safeMax) * 100));
  return `
    <div class="crd04-bar ${className}">
      <div class="crd04-bar-label">${escapeHtml(label)}</div>
      <div class="crd04-bar-track"><span style="width:${percent.toFixed(2)}%"></span></div>
      <div class="crd04-bar-value">${escapeHtml(String(Math.round(value)))}/${escapeHtml(String(Math.round(safeMax)))}</div>
    </div>
  `;
}

function startBattle(runtime, action) {
  const stage = normalizeCombatStage(action.playerStage || "foundation");
  const maxHp = Math.max(100, Number(action.playerMaxHp) || 120);
  const maxMadra = Math.max(90, Number(action.playerMaxMadra) || 110);
  return {
    ...runtime,
    phase: "battle",
    seed: (Number(action.seed) || Date.now()) >>> 0,
    playerStage: stage,
    playerHp: maxHp,
    playerMaxHp: maxHp,
    playerMadra: maxMadra,
    playerMaxMadra: maxMadra,
    dodgeReady: false,
    dodgeBonus: Math.max(0, Number(action.dodgeBonus) || 0),
    meleeBonus: Math.max(0, Number(action.meleeBonus) || 0),
    emptyPalmUnlocked: Boolean(action.emptyPalmUnlocked),
    enemy: {
      hp: 230,
      maxHp: 230,
      stage: "gold",
      stunnedTurns: 0,
      coilStacks: 0,
    },
    turn: 1,
    log: ["Jai Long spins his spear and smiles without warmth."],
    lastMessage: "",
  };
}

function resolveEnemyTurn(runtime) {
  let seed = runtime.seed;
  const enemy = runtime.enemy;

  if (enemy.stunnedTurns > 0) {
    return appendLog(
      {
        ...runtime,
        enemy: {
          ...enemy,
          stunnedTurns: enemy.stunnedTurns - 1,
        },
      },
      "Jai Long shakes off disrupted madra and resets his stance.",
    );
  }

  const rand = randomUnit(seed, 71);
  seed = rand.seed;
  const useSerpentBind = rand.value < 0.33;
  if (useSerpentBind) {
    return appendLog(
      {
        ...runtime,
        seed,
        enemy: {
          ...enemy,
          coilStacks: enemy.coilStacks + 1,
        },
      },
      "Serpent coils tighten around your channels. The next strike will bite deeper.",
    );
  }

  const dodgeChance = runtime.dodgeReady ? Math.min(0.88, 0.45 + runtime.dodgeBonus * 0.05) : 0;
  if (dodgeChance > 0) {
    const dodgeRoll = randomUnit(seed, 73);
    seed = dodgeRoll.seed;
    if (dodgeRoll.value < dodgeChance) {
      return appendLog(
        {
          ...runtime,
          seed,
          dodgeReady: false,
        },
        "You twist around Jai Long's spear arc.",
      );
    }
  }

  const biteBonus = Math.min(28, enemy.coilStacks * 7);
  const roll = rollDamage({
    seed,
    salt: 79,
    base: 20 + biteBonus,
    spread: 6,
    attackerStage: "gold",
    defenderStage: runtime.playerStage,
  });
  seed = roll.seed;
  return appendLog(
    {
      ...runtime,
      seed,
      dodgeReady: false,
      playerHp: Math.max(0, runtime.playerHp - roll.damage),
      enemy: {
        ...enemy,
        coilStacks: Math.max(0, enemy.coilStacks - 1),
      },
    },
    `Jai Long's spear-line tears through you for ${roll.damage}.`,
  );
}

function resolvePlayerAction(runtime, actionId) {
  const enemy = runtime.enemy;
  let seed = runtime.seed;
  if (actionId === "dodge") {
    return appendLog(
      {
        ...runtime,
        dodgeReady: true,
      },
      "You step into light-footwork and watch the spearpoint.",
    );
  }

  if (actionId === "empty-palm") {
    if (!runtime.emptyPalmUnlocked) {
      return appendLog(runtime, "You do not know the Empty Palm.");
    }
    if (runtime.playerMadra < 16) {
      return appendLog(runtime, "Not enough madra for the Empty Palm.");
    }
    const roll = rollDamage({
      seed,
      salt: 61,
      base: 18 + runtime.meleeBonus,
      spread: 4,
      attackerStage: runtime.playerStage,
      defenderStage: enemy.stage,
    });
    seed = roll.seed;
    return appendLog(
      {
        ...runtime,
        seed,
        playerMadra: Math.max(0, runtime.playerMadra - 16),
        enemy: {
          ...enemy,
          hp: Math.max(0, enemy.hp - roll.damage),
          stunnedTurns: Math.max(enemy.stunnedTurns, 1),
          coilStacks: Math.max(0, enemy.coilStacks - 1),
        },
      },
      `Empty Palm catches Jai Long for ${roll.damage} and disrupts his flow.`,
    );
  }

  const roll = rollDamage({
    seed,
    salt: 59,
    base: 14 + runtime.meleeBonus * 2,
    spread: 6,
    attackerStage: runtime.playerStage,
    defenderStage: enemy.stage,
  });
  seed = roll.seed;
  return appendLog(
    {
      ...runtime,
      seed,
      enemy: {
        ...enemy,
        hp: Math.max(0, enemy.hp - roll.damage),
      },
    },
    `You force Jai Long back with a strike for ${roll.damage}.`,
  );
}

export function initialCrd06Runtime() {
  return normalizeRuntime({
    phase: "intro",
    solved: false,
    seed: Date.now() >>> 0,
    playerStage: "foundation",
    playerHp: 0,
    playerMaxHp: 120,
    playerMadra: 0,
    playerMaxMadra: 100,
    dodgeReady: false,
    dodgeBonus: 0,
    meleeBonus: 0,
    emptyPalmUnlocked: false,
    enemy: { hp: 230, maxHp: 230, stage: "gold", stunnedTurns: 0, coilStacks: 0 },
    turn: 1,
    log: [],
    lastMessage: "",
  });
}

export function synchronizeCrd06Runtime(runtime) {
  return normalizeRuntime(runtime);
}

export function reduceCrd06Runtime(runtime, action) {
  const current = normalizeRuntime(runtime);
  if (!action || typeof action !== "object") {
    return current;
  }

  if (action.type === "crd06-start") {
    return startBattle(current, action);
  }

  if (action.type !== "crd06-combat" || current.phase !== "battle") {
    return current;
  }

  let next = resolvePlayerAction(current, String(action.move || "melee"));
  if (next.enemy.hp <= 0) {
    return {
      ...next,
      phase: "victory",
      solved: true,
      lastMessage: "Eithan appears, laughs, and names himself your mentor.",
      log: [
        ...next.log,
        "Eithan tosses you a technique and two strange artifacts, then vanishes.",
      ].slice(-10),
    };
  }

  next = resolveEnemyTurn(next);
  if (next.playerHp <= 0) {
    return {
      ...next,
      phase: "intro",
      lastMessage: "Defeated. Jai Long spares you with a warning.",
      log: [...next.log, "The duel ends. You will need greater control."].slice(-10),
    };
  }

  return {
    ...next,
    turn: next.turn + 1,
    lastMessage: "",
  };
}

export function validateCrd06Runtime(runtime) {
  return Boolean(normalizeRuntime(runtime).solved);
}

export function buildCrd06ActionFromElement(element) {
  const actionName = element.getAttribute("data-node-action");
  if (!actionName) {
    return null;
  }
  if (actionName === "crd06-start") {
    return {
      type: "crd06-start",
      seed: Date.now() >>> 0,
      playerStage: element.getAttribute("data-player-stage") || "foundation",
      playerMaxHp: Number(element.getAttribute("data-player-max-hp") || 120),
      playerMaxMadra: Number(element.getAttribute("data-player-max-madra") || 100),
      dodgeBonus: Number(element.getAttribute("data-player-dodge-bonus") || 0),
      meleeBonus: Number(element.getAttribute("data-player-melee-bonus") || 0),
      emptyPalmUnlocked: element.getAttribute("data-player-empty-palm") === "true",
      at: nowMs(),
    };
  }
  if (actionName === "crd06-combat") {
    return {
      type: "crd06-combat",
      move: element.getAttribute("data-move") || "melee",
      at: nowMs(),
    };
  }
  return null;
}

export function renderCrd06Experience(context) {
  const runtime = normalizeRuntime(context.runtime);
  const profile = combatProfileFromState(context.state);
  const logLines = runtime.log.length ? runtime.log : ["A cold wind cuts across the dueling ground."];

  if (runtime.phase === "intro") {
    return `
      <article class="crd04-node" data-node-id="${NODE_ID}">
        <section class="crd04-dialog">
          <h3>CRD06: Duel with Jai Long</h3>
          <p>Jai Long arrives with spear and serpents. Defeat him to force your way into the wider world.</p>
          <div class="crd04-actions">
            <button
              type="button"
              data-node-id="${NODE_ID}"
              data-node-action="crd06-start"
              data-player-stage="${escapeHtml(profile.stage)}"
              data-player-max-hp="${escapeHtml(String(profile.maxHp))}"
              data-player-max-madra="${escapeHtml(String(profile.maxMadra))}"
              data-player-dodge-bonus="${escapeHtml(String(profile.dodgeBonus))}"
              data-player-melee-bonus="${escapeHtml(String(profile.meleeBonus))}"
              data-player-empty-palm="${profile.hasEmptyPalm ? "true" : "false"}"
            >
              Begin Duel
            </button>
          </div>
          ${runtime.lastMessage ? `<p>${escapeHtml(runtime.lastMessage)}</p>` : ""}
        </section>
      </article>
    `;
  }

  if (runtime.phase === "victory") {
    return `
      <article class="crd04-node" data-node-id="${NODE_ID}">
        <section class="crd04-dialog">
          <h3>CRD06: Duel with Jai Long</h3>
          <p>Eithan Arelius strolls in, claps once, and declares he is your mentor now. He teaches the Heaven and Earth Purification Wheel, then tosses you two cryptic artifacts.</p>
        </section>
      </article>
    `;
  }

  return `
    <article class="crd04-node" data-node-id="${NODE_ID}">
      <section class="crd04-combat-head">
        <h3>Duel with Jai Long</h3>
        <p class="muted">Your stage: ${escapeHtml(runtime.playerStage)} | Opponent: Jai Long (Gold)</p>
      </section>

      <section class="crd04-bars">
        ${barMarkup("Health", runtime.playerHp, runtime.playerMaxHp, "is-health")}
        ${barMarkup("Madra", runtime.playerMadra, runtime.playerMaxMadra, "is-madra")}
      </section>

      <section class="crd04-bars enemy">
        ${barMarkup("Jai Long HP", runtime.enemy.hp, runtime.enemy.maxHp, "is-enemy")}
      </section>

      <section class="crd04-actions">
          <button type="button" data-node-id="${NODE_ID}" data-node-action="crd06-combat" data-move="melee">Melee</button>
          <button type="button" data-node-id="${NODE_ID}" data-node-action="crd06-combat" data-move="dodge">Dodge</button>
          <button type="button" data-node-id="${NODE_ID}" data-node-action="crd06-combat" data-move="empty-palm">Empty Palm</button>
      </section>

      <section class="crd04-log">
        <h4>Combat Log</h4>
        <ul>
          ${logLines.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}
        </ul>
      </section>
    </article>
  `;
}

export const CRD06_NODE_EXPERIENCE = {
  nodeId: NODE_ID,
  initialState: initialCrd06Runtime,
  synchronizeRuntime: synchronizeCrd06Runtime,
  render: renderCrd06Experience,
  reduceRuntime: reduceCrd06Runtime,
  validateRuntime: validateCrd06Runtime,
  buildActionFromElement: buildCrd06ActionFromElement,
};
