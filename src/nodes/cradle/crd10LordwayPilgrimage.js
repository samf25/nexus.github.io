import { escapeHtml } from "../../templates/shared.js";
import {
  cradleCombatAttackMultiplierFromState,
  madraPoolMultiplierForStage,
  normalizeCombatStage,
  randomUnit,
  rollDamage,
} from "./combatSystem.js";

const NODE_ID = "CRD10";

const SCENES = Object.freeze({
  s1: Object.freeze({
    id: "s1",
    title: "The Road Opens",
    text: "At Archlord, the world starts answering your intent. Nightwheel's sky bends with your choices.",
    choices: Object.freeze([
      Object.freeze({
        id: "s1-study",
        text: "Trace the pressure lines and study how fate knots around Iconic intent.",
        sage: 2,
        herald: 0,
        next: "s2",
      }),
      Object.freeze({
        id: "s1-charge",
        text: "Hunt the strongest pulse and break it by force before dawn.",
        sage: 0,
        herald: 2,
        next: "s2",
        battle: Object.freeze({
          name: "Rift-Horn Tyrant",
          style: "Brute Force",
          stage: "archlord",
          maxHp: 560,
          attack: 48,
          ability: "smash",
        }),
      }),
    ]),
  }),
  s2: Object.freeze({
    id: "s2",
    title: "Monarch Echoes",
    text: "Two echoes collide in your path: one a thinking remnant of script and law, one a body made to carry storms.",
    choices: Object.freeze([
      Object.freeze({
        id: "s2-script",
        text: "Debate the remnant-sage in battle and bind your will to meaning.",
        sage: 2,
        herald: 0,
        next: "s3",
        battle: Object.freeze({
          name: "Azure Script-Sage Echo",
          style: "Arcane Precision",
          stage: "archlord",
          maxHp: 600,
          attack: 50,
          ability: "script",
        }),
      }),
      Object.freeze({
        id: "s2-body",
        text: "Take the trial of flesh, pressure, and impact.",
        sage: 0,
        herald: 2,
        next: "s3",
        battle: Object.freeze({
          name: "Void-Bound Colossus",
          style: "Pressure and Mass",
          stage: "archlord",
          maxHp: 660,
          attack: 53,
          ability: "quake",
        }),
      }),
    ]),
  }),
  s3: Object.freeze({
    id: "s3",
    title: "The Last Declaration",
    text: "Your intent must crystallize. One declaration writes your future rank.",
    choices: Object.freeze([
      Object.freeze({
        id: "s3-icon",
        text: "Claim authority through understanding: become a Sage.",
        sage: 2,
        herald: 0,
        next: "resolve",
      }),
      Object.freeze({
        id: "s3-body",
        text: "Claim authority through embodiment: become a Herald.",
        sage: 0,
        herald: 2,
        next: "resolve",
      }),
    ]),
  }),
  recover: Object.freeze({
    id: "recover",
    title: "Regroup",
    text: "You survive, battered. The road does not close, but your resolve must harden.",
    choices: Object.freeze([
      Object.freeze({
        id: "recover-return",
        text: "Step back onto the road.",
        sage: 0,
        herald: 1,
        next: "s2",
      }),
    ]),
  }),
});

function readCrd02Runtime(state) {
  if (!state || !state.nodeRuntime || typeof state.nodeRuntime !== "object") {
    return {};
  }
  const runtime = state.nodeRuntime.CRD02;
  return runtime && typeof runtime === "object" ? runtime : {};
}

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function nowMs() {
  return Date.now();
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function combatProfileFromState(state) {
  const crd02 = readCrd02Runtime(state);
  const upgrades = crd02.upgrades && typeof crd02.upgrades === "object" ? crd02.upgrades : {};
  const lordPathUpgrades = crd02.lordPathUpgrades && typeof crd02.lordPathUpgrades === "object"
    ? crd02.lordPathUpgrades
    : {};
  const stage = normalizeCombatStage(crd02.cultivationStage || "foundation");
  const lordPath = normalizeText(crd02.lordPath || "");
  const ironBody = Number(upgrades["blood-forged-iron-body"] || 0);
  const soulCloak = Number(upgrades["soul-cloak"] || 0);
  const consume = Number(upgrades.consume || 0);
  const emptyPalm = Number(upgrades["empty-palm"] || 0);
  const pathSpell = Math.max(0, Number(lordPathUpgrades.sageScript || 0));
  const pathMight = Math.max(0, Number(lordPathUpgrades.heraldMight || 0));
  const attackMultiplier = cradleCombatAttackMultiplierFromState(state || {});
  const baseMadra = Math.round((240 + soulCloak * 8 + consume * 10 + pathSpell * 12) * madraPoolMultiplierForStage(stage));
  return {
    stage,
    lordPath,
    archlordReady: stage === "archlord",
    hasEmptyPalm: emptyPalm > 0,
    maxHp: 280 + ironBody * 32 + pathMight * 34 + (lordPath === "herald" ? 90 : 0),
    maxMadra: baseMadra + (lordPath === "sage" ? 70 : 0),
    meleeBonus: (soulCloak + consume + pathMight * 2) * attackMultiplier,
    dodgeBonus: soulCloak + pathSpell,
    spellBonus: (pathSpell * 3 + (lordPath === "sage" ? 4 : 0)) * attackMultiplier,
  };
}

function normalizeRuntime(candidate) {
  const source = candidate && typeof candidate === "object" ? candidate : {};
  const phaseCandidate = String(source.phase || "").toLowerCase();
  const phase = ["intro", "story", "battle", "complete"].includes(phaseCandidate) ? phaseCandidate : "intro";
  return {
    phase,
    solved: Boolean(source.solved),
    sceneId: SCENES[String(source.sceneId || "")] ? String(source.sceneId) : "s1",
    sagePoints: Math.max(0, Math.floor(Number(source.sagePoints) || 0)),
    heraldPoints: Math.max(0, Math.floor(Number(source.heraldPoints) || 0)),
    tieBias: ["sage", "herald"].includes(String(source.tieBias || "")) ? String(source.tieBias) : "",
    pendingLordPath: ["sage", "herald"].includes(String(source.pendingLordPath || "")) ? String(source.pendingLordPath) : "",
    player: source.player && typeof source.player === "object"
      ? {
        hp: Math.max(0, Number(source.player.hp) || 0),
        maxHp: Math.max(1, Number(source.player.maxHp) || 1),
        madra: Math.max(0, Number(source.player.madra) || 0),
        maxMadra: Math.max(1, Number(source.player.maxMadra) || 1),
        stage: normalizeCombatStage(source.player.stage || "foundation"),
        dodgeReady: Boolean(source.player.dodgeReady),
        dodgeBonus: Math.max(0, Number(source.player.dodgeBonus) || 0),
        meleeBonus: Math.max(0, Number(source.player.meleeBonus) || 0),
        spellBonus: Math.max(0, Number(source.player.spellBonus) || 0),
        emptyPalm: Boolean(source.player.emptyPalm),
      }
      : null,
    enemy: source.enemy && typeof source.enemy === "object"
      ? {
        name: String(source.enemy.name || "Enemy"),
        style: String(source.enemy.style || "Unknown"),
        stage: normalizeCombatStage(source.enemy.stage || "archlord"),
        hp: Math.max(0, Number(source.enemy.hp) || 0),
        maxHp: Math.max(1, Number(source.enemy.maxHp) || 1),
        attack: Math.max(1, Number(source.enemy.attack) || 1),
        ability: String(source.enemy.ability || ""),
        stunnedTurns: Math.max(0, Math.floor(Number(source.enemy.stunnedTurns) || 0)),
      }
      : null,
    battleNextScene: SCENES[String(source.battleNextScene || "")] ? String(source.battleNextScene) : "",
    battleSageGain: Math.max(0, Math.floor(Number(source.battleSageGain) || 0)),
    battleHeraldGain: Math.max(0, Math.floor(Number(source.battleHeraldGain) || 0)),
    seed: Number.isFinite(Number(source.seed)) ? Number(source.seed) >>> 0 : (Date.now() >>> 0),
    log: Array.isArray(source.log) ? source.log.slice(-10).map((line) => String(line)) : [],
    lastMessage: String(source.lastMessage || ""),
  };
}

function initialRuntime() {
  return normalizeRuntime({
    phase: "intro",
    solved: false,
    sceneId: "s1",
    sagePoints: 0,
    heraldPoints: 0,
    tieBias: "",
    pendingLordPath: "",
    player: null,
    enemy: null,
    battleNextScene: "",
    battleSageGain: 0,
    battleHeraldGain: 0,
    seed: Date.now() >>> 0,
    log: [],
    lastMessage: "",
  });
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

function finalizePath(current) {
  const sage = Math.max(0, Number(current.sagePoints) || 0);
  const herald = Math.max(0, Number(current.heraldPoints) || 0);
  const winner = sage > herald
    ? "sage"
    : herald > sage
      ? "herald"
      : (current.tieBias === "herald" ? "herald" : "sage");
  const label = winner === "sage" ? "Sage" : "Herald";
  return {
    ...current,
    phase: "complete",
    solved: true,
    pendingLordPath: winner,
    player: null,
    enemy: null,
    battleNextScene: "",
    battleSageGain: 0,
    battleHeraldGain: 0,
    lastMessage: `Your path crystallizes. You ascend as a ${label}.`,
  };
}

function applyChoice(current, choice) {
  const next = {
    ...current,
    tieBias: choice.sage > choice.herald ? "sage" : choice.herald > choice.sage ? "herald" : current.tieBias,
  };
  if (choice.battle) {
    return {
      ...next,
      phase: "battle",
      player: next.player,
      enemy: {
        name: choice.battle.name,
        style: choice.battle.style,
        stage: normalizeCombatStage(choice.battle.stage || "archlord"),
        hp: Number(choice.battle.maxHp || 500),
        maxHp: Number(choice.battle.maxHp || 500),
        attack: Number(choice.battle.attack || 40),
        ability: String(choice.battle.ability || ""),
        stunnedTurns: 0,
      },
      battleNextScene: choice.next,
      battleSageGain: Number(choice.sage || 0),
      battleHeraldGain: Number(choice.herald || 0),
      log: [`Battle begins: ${choice.battle.name}.`],
      lastMessage: "",
    };
  }

  const progressed = {
    ...next,
    sagePoints: next.sagePoints + Number(choice.sage || 0),
    heraldPoints: next.heraldPoints + Number(choice.herald || 0),
    sceneId: choice.next || next.sceneId,
  };
  if (choice.next === "resolve") {
    return finalizePath(progressed);
  }
  return progressed;
}

function resolvePlayerMove(current, move) {
  if (!current.player || !current.enemy) {
    return current;
  }
  const next = {
    ...current,
    player: { ...current.player },
    enemy: { ...current.enemy },
  };

  if (move === "dodge") {
    next.player.dodgeReady = true;
    next.log = [...next.log, "You bend your flow and prepare to evade."].slice(-10);
    return next;
  }

  if (move === "empty-palm") {
    if (!next.player.emptyPalm) {
      next.log = [...next.log, "You have not learned Empty Palm."].slice(-10);
      return next;
    }
    if (next.player.madra < 20) {
      next.log = [...next.log, "Not enough madra for Empty Palm."].slice(-10);
      return next;
    }
    const roll = rollDamage({
      seed: next.seed,
      salt: 91,
      base: 36 + next.player.meleeBonus,
      spread: 8,
      attackerStage: next.player.stage,
      defenderStage: next.enemy.stage,
    });
    next.seed = roll.seed;
    next.player.madra = Math.max(0, next.player.madra - 20);
    next.enemy.hp = Math.max(0, next.enemy.hp - roll.damage);
    next.enemy.stunnedTurns = Math.max(1, next.enemy.stunnedTurns);
    next.log = [...next.log, `Empty Palm ruptures channels for ${roll.damage}.`].slice(-10);
    return next;
  }

  if (move === "spell") {
    const cost = 14;
    if (next.player.madra < cost) {
      next.log = [...next.log, "Not enough madra to cast."].slice(-10);
      return next;
    }
    const roll = rollDamage({
      seed: next.seed,
      salt: 97,
      base: 30 + next.player.spellBonus * 2,
      spread: 10,
      attackerStage: next.player.stage,
      defenderStage: next.enemy.stage,
    });
    next.seed = roll.seed;
    next.player.madra = Math.max(0, next.player.madra - cost);
    next.enemy.hp = Math.max(0, next.enemy.hp - roll.damage);
    next.log = [...next.log, `You script a focused technique for ${roll.damage}.`].slice(-10);
    return next;
  }

  const roll = rollDamage({
    seed: next.seed,
    salt: 83,
    base: 34 + next.player.meleeBonus * 2,
    spread: 9,
    attackerStage: next.player.stage,
    defenderStage: next.enemy.stage,
  });
  next.seed = roll.seed;
  next.enemy.hp = Math.max(0, next.enemy.hp - roll.damage);
  next.log = [...next.log, `You strike for ${roll.damage}.`].slice(-10);
  return next;
}

function resolveEnemyTurn(current) {
  if (!current.player || !current.enemy) {
    return current;
  }
  const next = {
    ...current,
    player: { ...current.player },
    enemy: { ...current.enemy },
  };
  if (next.enemy.stunnedTurns > 0) {
    next.enemy.stunnedTurns -= 1;
    next.log = [...next.log, `${next.enemy.name} staggers and misses a beat.`].slice(-10);
    return next;
  }

  const dodgeChance = next.player.dodgeReady ? Math.min(0.9, 0.45 + next.player.dodgeBonus * 0.05) : 0;
  if (dodgeChance > 0) {
    const dodgeRoll = randomUnit(next.seed, 41);
    next.seed = dodgeRoll.seed;
    if (dodgeRoll.value < dodgeChance) {
      next.player.dodgeReady = false;
      next.log = [...next.log, "You evade the incoming assault."].slice(-10);
      return next;
    }
  }

  const bonus =
    next.enemy.ability === "script" ? 10
      : next.enemy.ability === "quake" ? 13
        : next.enemy.ability === "smash" ? 12
          : 8;
  const roll = rollDamage({
    seed: next.seed,
    salt: 53,
    base: next.enemy.attack + bonus,
    spread: 10,
    attackerStage: next.enemy.stage,
    defenderStage: next.player.stage,
  });
  next.seed = roll.seed;
  next.player.hp = Math.max(0, next.player.hp - roll.damage);
  next.player.dodgeReady = false;
  next.log = [...next.log, `${next.enemy.name} (${next.enemy.style}) hits for ${roll.damage}.`].slice(-10);
  return next;
}

export function initialCrd10Runtime() {
  return initialRuntime();
}

export function synchronizeCrd10Runtime(runtime) {
  return normalizeRuntime(runtime);
}

export function validateCrd10Runtime(runtime) {
  return Boolean(runtime && runtime.solved);
}

export function reduceCrd10Runtime(runtime, action) {
  const current = normalizeRuntime(runtime);
  if (!action || typeof action !== "object") {
    return current;
  }

  if (action.type === "crd10-begin") {
    if (!action.ready) {
      return {
        ...current,
        lastMessage: "Only Archlords can walk this road.",
      };
    }
    return {
      ...current,
      phase: "story",
      sceneId: "s1",
      player: {
        hp: Math.max(1, Number(action.playerMaxHp) || 1),
        maxHp: Math.max(1, Number(action.playerMaxHp) || 1),
        madra: Math.max(1, Number(action.playerMaxMadra) || 1),
        maxMadra: Math.max(1, Number(action.playerMaxMadra) || 1),
        stage: normalizeCombatStage(action.playerStage || "archlord"),
        dodgeReady: false,
        dodgeBonus: Math.max(0, Number(action.playerDodgeBonus) || 0),
        meleeBonus: Math.max(0, Number(action.playerMeleeBonus) || 0),
        spellBonus: Math.max(0, Number(action.playerSpellBonus) || 0),
        emptyPalm: action.playerEmptyPalm === true,
      },
      enemy: null,
      battleNextScene: "",
      battleSageGain: 0,
      battleHeraldGain: 0,
      seed: (Number(action.seed) || Date.now()) >>> 0,
      sagePoints: 0,
      heraldPoints: 0,
      tieBias: "",
      pendingLordPath: "",
      log: [],
      lastMessage: "",
    };
  }

  if (action.type === "crd10-choose") {
    if (current.phase !== "story") {
      return current;
    }
    const scene = SCENES[current.sceneId] || SCENES.s1;
    const choice = (scene.choices || []).find((entry) => entry.id === String(action.choiceId || ""));
    if (!choice) {
      return current;
    }
    return applyChoice(current, choice);
  }

  if (action.type === "crd10-fight-action") {
    if (current.phase !== "battle") {
      return current;
    }
    let next = resolvePlayerMove(current, String(action.move || "melee"));
    if (next.enemy && next.enemy.hp <= 0) {
      const progressed = {
        ...next,
        phase: "story",
        enemy: null,
        sagePoints: next.sagePoints + next.battleSageGain,
        heraldPoints: next.heraldPoints + next.battleHeraldGain,
        sceneId: next.battleNextScene || next.sceneId,
        battleNextScene: "",
        battleSageGain: 0,
        battleHeraldGain: 0,
        log: [...next.log, "You seize control of the road."].slice(-10),
      };
      if (progressed.sceneId === "resolve") {
        return finalizePath(progressed);
      }
      return progressed;
    }

    next = resolveEnemyTurn(next);
    if (next.player && next.player.hp <= 0) {
      return {
        ...next,
        phase: "story",
        sceneId: "recover",
        enemy: null,
        battleNextScene: "",
        battleSageGain: 0,
        battleHeraldGain: 0,
        player: {
          ...next.player,
          hp: Math.max(1, Math.round(next.player.maxHp * 0.55)),
          madra: Math.max(1, Math.round(next.player.maxMadra * 0.6)),
          dodgeReady: false,
        },
        lastMessage: "Defeated, but alive. The road forces you to adapt.",
      };
    }
    return next;
  }

  return current;
}

export function buildCrd10ActionFromElement(element) {
  const actionName = element.getAttribute("data-node-action");
  if (!actionName) {
    return null;
  }
  if (actionName === "crd10-begin") {
    return {
      type: "crd10-begin",
      ready: element.getAttribute("data-ready") === "true",
      seed: Date.now(),
      playerStage: element.getAttribute("data-player-stage") || "archlord",
      playerMaxHp: Number(element.getAttribute("data-player-max-hp") || 300),
      playerMaxMadra: Number(element.getAttribute("data-player-max-madra") || 280),
      playerDodgeBonus: Number(element.getAttribute("data-player-dodge-bonus") || 0),
      playerMeleeBonus: Number(element.getAttribute("data-player-melee-bonus") || 0),
      playerSpellBonus: Number(element.getAttribute("data-player-spell-bonus") || 0),
      playerEmptyPalm: element.getAttribute("data-player-empty-palm") === "true",
      at: nowMs(),
    };
  }
  if (actionName === "crd10-choose") {
    return {
      type: "crd10-choose",
      choiceId: element.getAttribute("data-choice-id") || "",
      at: nowMs(),
    };
  }
  if (actionName === "crd10-fight-action") {
    return {
      type: "crd10-fight-action",
      move: element.getAttribute("data-move") || "melee",
      at: nowMs(),
    };
  }
  return null;
}

export function renderCrd10Experience(context) {
  const runtime = normalizeRuntime(context.runtime);
  const profile = combatProfileFromState(context.state || {});
  const lordPathAlready = normalizeText(profile.lordPath);

  if (runtime.phase === "complete" || lordPathAlready === "sage" || lordPathAlready === "herald") {
    const label = lordPathAlready === "herald" ? "Herald" : lordPathAlready === "sage" ? "Sage" : "Ascended";
    return `
      <article class="crd04-node" data-node-id="${NODE_ID}">
        <section class="crd04-dialog">
          <h3>CRD10: Road Of The Lord</h3>
          <p>You have completed the road and stand as a ${escapeHtml(label)}.</p>
        </section>
      </article>
    `;
  }

  if (runtime.phase === "intro") {
    return `
      <article class="crd04-node" data-node-id="${NODE_ID}">
        <section class="crd04-dialog">
          <h3>CRD10: Road Of The Lord</h3>
          <p>A choicebound ascent where your declarations decide whether you become Sage or Herald.</p>
          <div class="crd04-actions">
            <button
              type="button"
              data-node-id="${NODE_ID}"
              data-node-action="crd10-begin"
              data-ready="${profile.archlordReady ? "true" : "false"}"
              data-player-stage="${escapeHtml(profile.stage)}"
              data-player-max-hp="${escapeHtml(String(profile.maxHp))}"
              data-player-max-madra="${escapeHtml(String(profile.maxMadra))}"
              data-player-dodge-bonus="${escapeHtml(String(profile.dodgeBonus))}"
              data-player-melee-bonus="${escapeHtml(String(profile.meleeBonus))}"
              data-player-spell-bonus="${escapeHtml(String(profile.spellBonus))}"
              data-player-empty-palm="${profile.hasEmptyPalm ? "true" : "false"}"
              ${profile.archlordReady ? "" : "disabled"}
            >
              Begin Pilgrimage
            </button>
          </div>
          ${runtime.lastMessage ? `<p>${escapeHtml(runtime.lastMessage)}</p>` : ""}
        </section>
      </article>
    `;
  }

  if (runtime.phase === "story") {
    const scene = SCENES[runtime.sceneId] || SCENES.s1;
    return `
      <article class="crd04-node" data-node-id="${NODE_ID}">
        <section class="crd04-dialog">
          <h3>${escapeHtml(scene.title)}</h3>
          <p>${escapeHtml(scene.text)}</p>
          <p class="muted">Sage pressure: ${runtime.sagePoints} | Herald pressure: ${runtime.heraldPoints}</p>
          <div class="crd04-actions">
            ${(scene.choices || []).map((choice) => `
              <button
                type="button"
                data-node-id="${NODE_ID}"
                data-node-action="crd10-choose"
                data-choice-id="${escapeHtml(choice.id)}"
              >
                ${escapeHtml(choice.text)}
              </button>
            `).join("")}
          </div>
          ${runtime.lastMessage ? `<p>${escapeHtml(runtime.lastMessage)}</p>` : ""}
        </section>
      </article>
    `;
  }

  const enemy = runtime.enemy || {
    name: "Unknown",
    style: "Unknown",
    hp: 1,
    maxHp: 1,
  };
  const player = runtime.player || {
    hp: 1,
    maxHp: 1,
    madra: 1,
    maxMadra: 1,
  };
  return `
    <article class="crd04-node" data-node-id="${NODE_ID}">
      <section class="crd04-combat-head">
        <h3>Lordway Clash</h3>
        <p class="muted">Opponent: ${escapeHtml(enemy.name)} (${escapeHtml(enemy.style)})</p>
      </section>

      <section class="crd04-bars">
        ${barMarkup("Health", player.hp, player.maxHp, "is-health")}
        ${barMarkup("Madra", player.madra, player.maxMadra, "is-madra")}
      </section>

      <section class="crd04-bars enemy">
        ${barMarkup(`${enemy.name} HP`, enemy.hp, enemy.maxHp, "is-enemy")}
      </section>

      <section class="crd04-actions">
        <button type="button" data-node-id="${NODE_ID}" data-node-action="crd10-fight-action" data-move="melee">Melee</button>
        <button type="button" data-node-id="${NODE_ID}" data-node-action="crd10-fight-action" data-move="spell">Spell</button>
        <button type="button" data-node-id="${NODE_ID}" data-node-action="crd10-fight-action" data-move="dodge">Dodge</button>
        <button type="button" data-node-id="${NODE_ID}" data-node-action="crd10-fight-action" data-move="empty-palm" ${player.emptyPalm ? "" : "disabled"}>Empty Palm</button>
      </section>

      <section class="crd04-log">
        <h4>Combat Log</h4>
        <ul>
          ${(runtime.log || []).map((line) => `<li>${escapeHtml(line)}</li>`).join("")}
        </ul>
      </section>
    </article>
  `;
}

export const CRD10_NODE_EXPERIENCE = {
  nodeId: NODE_ID,
  initialState: initialCrd10Runtime,
  synchronizeRuntime: synchronizeCrd10Runtime,
  render: renderCrd10Experience,
  reduceRuntime: reduceCrd10Runtime,
  validateRuntime: validateCrd10Runtime,
  buildActionFromElement: buildCrd10ActionFromElement,
};
