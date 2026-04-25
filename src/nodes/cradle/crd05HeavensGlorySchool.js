import { escapeHtml } from "../../templates/shared.js";
import {
  madraPoolMultiplierForStage,
  normalizeCombatStage,
  randomUnit,
  rollDamage,
} from "./combatSystem.js";

const NODE_ID = "CRD05";

function nowMs() {
  return Date.now();
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
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
        maxHp: Math.max(1, Number(source.enemy.maxHp) || 150),
        stage: normalizeCombatStage(source.enemy.stage || "jade"),
        stunnedTurns: Math.max(0, Math.floor(Number(source.enemy.stunnedTurns) || 0)),
      }
      : { hp: 150, maxHp: 150, stage: "jade", stunnedTurns: 0 },
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
    maxHp: 118 + ironBody * 24 + (stage === "copper" ? 16 : stage === "iron" ? 34 : 0),
    maxMadra: Math.round((100 + soulCloak * 4 + consume * 5 + hollowDomain * 6) * madraPoolMultiplierForStage(stage)),
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
  const maxHp = Math.max(90, Number(action.playerMaxHp) || 110);
  const maxMadra = Math.max(80, Number(action.playerMaxMadra) || 100);
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
      hp: 160,
      maxHp: 160,
      stage: "jade",
      stunnedTurns: 0,
    },
    turn: 1,
    log: ["Elder Rahm descends from the Heaven's Glory dais."],
    lastMessage: "",
  };
}

function resolveEnemyTurn(runtime) {
  let next = runtime;
  let seed = runtime.seed;
  const enemy = runtime.enemy;

  if (enemy.stunnedTurns > 0) {
    return appendLog(
      {
        ...next,
        enemy: {
          ...enemy,
          stunnedTurns: enemy.stunnedTurns - 1,
        },
      },
      "Elder Rahm staggers under disrupted madra.",
    );
  }

  const pattern = runtime.turn % 3;
  if (pattern === 0) {
    const roll = rollDamage({
      seed,
      salt: 41,
      base: 24,
      spread: 4,
      attackerStage: "jade",
      defenderStage: runtime.playerStage,
    });
    seed = roll.seed;
    return appendLog(
      {
        ...next,
        seed,
        playerHp: Math.max(0, runtime.playerHp - roll.damage),
        dodgeReady: false,
      },
      `Jade Script lashes through your channels for ${roll.damage}.`,
    );
  }

  const dodgeChance = runtime.dodgeReady ? Math.min(0.86, 0.48 + runtime.dodgeBonus * 0.05) : 0;
  if (dodgeChance > 0) {
    const dodgeRoll = randomUnit(seed, 27);
    seed = dodgeRoll.seed;
    if (dodgeRoll.value < dodgeChance) {
      return appendLog(
        {
          ...next,
          seed,
          dodgeReady: false,
        },
        "You slip past Elder Rahm's jade-whip strike.",
      );
    }
  }

  const roll = rollDamage({
    seed,
    salt: 31,
    base: 19,
    spread: 5,
    attackerStage: "jade",
    defenderStage: runtime.playerStage,
  });
  seed = roll.seed;
  return appendLog(
    {
      ...next,
      seed,
      playerHp: Math.max(0, runtime.playerHp - roll.damage),
      dodgeReady: false,
    },
    `Elder Rahm's jade whip tears across you for ${roll.damage}.`,
  );
}

function resolvePlayerAction(runtime, actionId) {
  const enemy = runtime.enemy;
  let next = runtime;
  let seed = runtime.seed;

  if (actionId === "dodge") {
    return appendLog(
      {
        ...next,
        dodgeReady: true,
      },
      "You settle your stance and bend your breath to motion.",
    );
  }

  if (actionId === "empty-palm") {
    if (!runtime.emptyPalmUnlocked) {
      return appendLog(runtime, "You do not know the Empty Palm.");
    }
    if (runtime.playerMadra < 14) {
      return appendLog(runtime, "Not enough madra for the Empty Palm.");
    }
    const roll = rollDamage({
      seed,
      salt: 19,
      base: 17 + runtime.meleeBonus,
      spread: 3,
      attackerStage: runtime.playerStage,
      defenderStage: enemy.stage,
    });
    seed = roll.seed;
    return appendLog(
      {
        ...next,
        seed,
        playerMadra: Math.max(0, runtime.playerMadra - 14),
        enemy: {
          ...enemy,
          hp: Math.max(0, enemy.hp - roll.damage),
          stunnedTurns: Math.max(enemy.stunnedTurns, 2),
        },
      },
      `Empty Palm strikes for ${roll.damage}. Elder Rahm's channels sputter.`,
    );
  }

  const roll = rollDamage({
    seed,
    salt: 11,
    base: 13 + runtime.meleeBonus * 2,
    spread: 5,
    attackerStage: runtime.playerStage,
    defenderStage: enemy.stage,
  });
  seed = roll.seed;
  return appendLog(
    {
      ...next,
      seed,
      enemy: {
        ...enemy,
        hp: Math.max(0, enemy.hp - roll.damage),
      },
    },
    `You carve through Elder Rahm's guard for ${roll.damage}.`,
  );
}

export function initialCrd05Runtime() {
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
    enemy: { hp: 160, maxHp: 160, stage: "jade", stunnedTurns: 0 },
    turn: 1,
    log: [],
    lastMessage: "",
  });
}

export function synchronizeCrd05Runtime(runtime) {
  return normalizeRuntime(runtime);
}

export function reduceCrd05Runtime(runtime, action) {
  let current = normalizeRuntime(runtime);
  if (!action || typeof action !== "object") {
    return current;
  }

  if (action.type === "crd05-start") {
    return startBattle(current, action);
  }

  if (action.type !== "crd05-combat" || current.phase !== "battle") {
    return current;
  }

  let next = resolvePlayerAction(current, String(action.move || "melee"));
  if (next.enemy.hp <= 0) {
    return {
      ...next,
      phase: "victory",
      solved: true,
      lastMessage: "Elder Rahm falls. The Heaven's Glory vault is yours.",
    };
  }

  next = resolveEnemyTurn(next);
  if (next.playerHp <= 0) {
    return {
      ...next,
      phase: "intro",
      lastMessage: "Defeated. Return once your core is steadier.",
      log: [...next.log, "The elder dismisses you with cold contempt."].slice(-10),
    };
  }

  return {
    ...next,
    turn: next.turn + 1,
    lastMessage: "",
  };
}

export function validateCrd05Runtime(runtime) {
  return Boolean(normalizeRuntime(runtime).solved);
}

export function buildCrd05ActionFromElement(element) {
  const actionName = element.getAttribute("data-node-action");
  if (!actionName) {
    return null;
  }
  if (actionName === "crd05-start") {
    return {
      type: "crd05-start",
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
  if (actionName === "crd05-combat") {
    return {
      type: "crd05-combat",
      move: element.getAttribute("data-move") || "melee",
      at: nowMs(),
    };
  }
  return null;
}

function combatProfileFromContext(state) {
  return combatProfileFromState(state);
}

export function renderCrd05Experience(context) {
  const runtime = normalizeRuntime(context.runtime);
  const profile = combatProfileFromContext(context.state);
  const logLines = runtime.log.length ? runtime.log : ["The school gates await your challenge."];

  if (runtime.phase === "intro") {
    return `
      <article class="crd04-node" data-node-id="${NODE_ID}">
        <section class="crd04-dialog">
          <h3>CRD05: The Heaven's Glory School</h3>
          <p>You stand before Elder Rahm, Jade elder of Heaven's Glory. Survive his techniques and claim the vault.</p>
          <div class="crd04-actions">
            <button
              type="button"
              data-node-id="${NODE_ID}"
              data-node-action="crd05-start"
              data-player-stage="${escapeHtml(profile.stage)}"
              data-player-max-hp="${escapeHtml(String(profile.maxHp))}"
              data-player-max-madra="${escapeHtml(String(profile.maxMadra))}"
              data-player-dodge-bonus="${escapeHtml(String(profile.dodgeBonus))}"
              data-player-melee-bonus="${escapeHtml(String(profile.meleeBonus))}"
              data-player-empty-palm="${profile.hasEmptyPalm ? "true" : "false"}"
            >
              Challenge Elder Rahm
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
          <h3>CRD05: The Heaven's Glory School</h3>
          <p>Elder Rahm collapses. The Heaven's Glory vault opens and ancient relics spill into your hands.</p>
        </section>
      </article>
    `;
  }

  return `
    <article class="crd04-node" data-node-id="${NODE_ID}">
      <section class="crd04-combat-head">
        <h3>Duel in Heaven's Glory</h3>
        <p class="muted">Your stage: ${escapeHtml(runtime.playerStage)} | Opponent: Elder Rahm (Jade)</p>
      </section>

      <section class="crd04-bars">
        ${barMarkup("Health", runtime.playerHp, runtime.playerMaxHp, "is-health")}
        ${barMarkup("Madra", runtime.playerMadra, runtime.playerMaxMadra, "is-madra")}
      </section>

      <section class="crd04-bars enemy">
        ${barMarkup("Elder Rahm HP", runtime.enemy.hp, runtime.enemy.maxHp, "is-enemy")}
      </section>

      <section class="crd04-actions">
          <button type="button" data-node-id="${NODE_ID}" data-node-action="crd05-combat" data-move="melee">Melee</button>
          <button type="button" data-node-id="${NODE_ID}" data-node-action="crd05-combat" data-move="dodge">Dodge</button>
          <button type="button" data-node-id="${NODE_ID}" data-node-action="crd05-combat" data-move="empty-palm">Empty Palm</button>
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

export const CRD05_NODE_EXPERIENCE = {
  nodeId: NODE_ID,
  initialState: initialCrd05Runtime,
  synchronizeRuntime: synchronizeCrd05Runtime,
  render: renderCrd05Experience,
  reduceRuntime: reduceCrd05Runtime,
  validateRuntime: validateCrd05Runtime,
  buildActionFromElement: buildCrd05ActionFromElement,
};
