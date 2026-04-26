import { escapeHtml } from "../../templates/shared.js";
import {
  madraPoolMultiplierForStage,
  normalizeCombatStage,
  randomUnit,
  rollDamage,
} from "./combatSystem.js";

const NODE_ID = "CRD11";

const DREADGODS = Object.freeze([
  Object.freeze({
    id: "phoenix",
    name: "The Bleeding Phoenix",
    style: "Blood and Fire",
    stage: "archlord",
    maxHp: 760,
    attack: 62,
    ability: "bloodfire",
    reward: "Bleeding Phoenix Heart-Sigil",
    madra: 42000,
    soulfire: 28,
  }),
  Object.freeze({
    id: "dragon",
    name: "The Weeping Dragon",
    style: "Lightning and Storm",
    stage: "archlord",
    maxHp: 820,
    attack: 66,
    ability: "storm",
    reward: "Weeping Dragon Storm-Sigil",
    madra: 46000,
    soulfire: 31,
  }),
  Object.freeze({
    id: "silentking",
    name: "The Silent King",
    style: "Darkness and Finesse",
    stage: "archlord",
    maxHp: 700,
    attack: 64,
    ability: "shade",
    reward: "Silent King Night-Sigil",
    madra: 50000,
    soulfire: 33,
  }),
  Object.freeze({
    id: "titan",
    name: "The Wandering Titan",
    style: "Earth and Defense",
    stage: "archlord",
    maxHp: 940,
    attack: 60,
    ability: "fortress",
    reward: "Wandering Titan Stone-Sigil",
    madra: 56000,
    soulfire: 37,
  }),
]);

const DREADGOD_BY_ID = Object.freeze(Object.fromEntries(DREADGODS.map((entry) => [entry.id, entry])));

function nowMs() {
  return Date.now();
}

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function readCrd02Runtime(state) {
  if (!state || !state.nodeRuntime || typeof state.nodeRuntime !== "object") {
    return {};
  }
  const runtime = state.nodeRuntime.CRD02;
  return runtime && typeof runtime === "object" ? runtime : {};
}

function normalizeDefeated(value) {
  const source = value && typeof value === "object" ? value : {};
  const result = {};
  for (const entry of DREADGODS) {
    result[entry.id] = Boolean(source[entry.id]);
  }
  return result;
}

function countDefeated(defeated) {
  let total = 0;
  for (const entry of DREADGODS) {
    if (defeated[entry.id]) {
      total += 1;
    }
  }
  return total;
}

function combatProfileFromState(state) {
  const crd02 = readCrd02Runtime(state);
  const upgrades = crd02.upgrades && typeof crd02.upgrades === "object" ? crd02.upgrades : {};
  const lordPathUpgrades = crd02.lordPathUpgrades && typeof crd02.lordPathUpgrades === "object"
    ? crd02.lordPathUpgrades
    : {};
  const stage = normalizeCombatStage(crd02.cultivationStage || "foundation");
  const lordPath = normalizeText(crd02.lordPath || "");
  const pathReady = lordPath === "sage" || lordPath === "herald";
  const ironBody = Number(upgrades["blood-forged-iron-body"] || 0);
  const soulCloak = Number(upgrades["soul-cloak"] || 0);
  const consume = Number(upgrades.consume || 0);
  const emptyPalm = Number(upgrades["empty-palm"] || 0);
  const pathSpell = Math.max(0, Number(lordPathUpgrades.sageScript || 0));
  const pathMight = Math.max(0, Number(lordPathUpgrades.heraldMight || 0));
  return {
    stage,
    lordPath,
    ready: stage === "archlord" && pathReady,
    hasEmptyPalm: emptyPalm > 0,
    maxHp: 340 + ironBody * 38 + pathMight * 42 + (lordPath === "herald" ? 120 : 0),
    maxMadra: Math.round((280 + soulCloak * 8 + consume * 10 + pathSpell * 14) * madraPoolMultiplierForStage(stage)) + (lordPath === "sage" ? 90 : 0),
    meleeBonus: soulCloak + consume + pathMight * 3,
    dodgeBonus: soulCloak + pathSpell,
    spellBonus: pathSpell * 4 + (lordPath === "sage" ? 6 : 0),
  };
}

function normalizeRuntime(candidate) {
  const source = candidate && typeof candidate === "object" ? candidate : {};
  const phaseCandidate = String(source.phase || "").toLowerCase();
  const phase = ["select", "battle", "complete"].includes(phaseCandidate) ? phaseCandidate : "select";
  return {
    phase,
    solved: Boolean(source.solved),
    defeated: normalizeDefeated(source.defeated),
    selectedBossId: DREADGOD_BY_ID[String(source.selectedBossId || "")] ? String(source.selectedBossId) : "",
    player: source.player && typeof source.player === "object"
      ? {
        hp: Math.max(0, Number(source.player.hp) || 0),
        maxHp: Math.max(1, Number(source.player.maxHp) || 1),
        madra: Math.max(0, Number(source.player.madra) || 0),
        maxMadra: Math.max(1, Number(source.player.maxMadra) || 1),
        stage: normalizeCombatStage(source.player.stage || "archlord"),
        dodgeReady: Boolean(source.player.dodgeReady),
        dodgeBonus: Math.max(0, Number(source.player.dodgeBonus) || 0),
        meleeBonus: Math.max(0, Number(source.player.meleeBonus) || 0),
        spellBonus: Math.max(0, Number(source.player.spellBonus) || 0),
        emptyPalm: Boolean(source.player.emptyPalm),
      }
      : null,
    enemy: source.enemy && typeof source.enemy === "object"
      ? {
        id: String(source.enemy.id || ""),
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
    seed: Number.isFinite(Number(source.seed)) ? Number(source.seed) >>> 0 : (Date.now() >>> 0),
    log: Array.isArray(source.log) ? source.log.slice(-10).map((line) => String(line)) : [],
    pendingRewards: Array.isArray(source.pendingRewards) ? source.pendingRewards.filter((entry) => entry) : [],
    pendingMadraAward: Math.max(0, Number(source.pendingMadraAward) || 0),
    pendingSoulfireAward: Math.max(0, Number(source.pendingSoulfireAward) || 0),
    lootEvents: Array.isArray(source.lootEvents) ? source.lootEvents.filter((entry) => entry && typeof entry === "object") : [],
    lastMessage: String(source.lastMessage || ""),
  };
}

function initialRuntime() {
  return normalizeRuntime({
    phase: "select",
    solved: false,
    defeated: {},
    selectedBossId: "",
    player: null,
    enemy: null,
    seed: Date.now() >>> 0,
    log: [],
    pendingRewards: [],
    pendingMadraAward: 0,
    pendingSoulfireAward: 0,
    lootEvents: [],
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
    next.log = [...next.log, "You set a defensive cadence."].slice(-10);
    return next;
  }

  if (move === "empty-palm") {
    if (!next.player.emptyPalm) {
      next.log = [...next.log, "You have not learned Empty Palm."].slice(-10);
      return next;
    }
    if (next.player.madra < 24) {
      next.log = [...next.log, "Not enough madra for Empty Palm."].slice(-10);
      return next;
    }
    const roll = rollDamage({
      seed: next.seed,
      salt: 71,
      base: 44 + next.player.meleeBonus,
      spread: 11,
      attackerStage: next.player.stage,
      defenderStage: next.enemy.stage,
    });
    next.seed = roll.seed;
    next.player.madra = Math.max(0, next.player.madra - 24);
    next.enemy.hp = Math.max(0, next.enemy.hp - roll.damage);
    next.enemy.stunnedTurns = Math.max(1, next.enemy.stunnedTurns);
    next.log = [...next.log, `Empty Palm detonates aura channels for ${roll.damage}.`].slice(-10);
    return next;
  }

  if (move === "spell") {
    const cost = 18;
    if (next.player.madra < cost) {
      next.log = [...next.log, "Not enough madra to cast."].slice(-10);
      return next;
    }
    const roll = rollDamage({
      seed: next.seed,
      salt: 79,
      base: 40 + next.player.spellBonus * 2,
      spread: 13,
      attackerStage: next.player.stage,
      defenderStage: next.enemy.stage,
    });
    next.seed = roll.seed;
    next.player.madra = Math.max(0, next.player.madra - cost);
    next.enemy.hp = Math.max(0, next.enemy.hp - roll.damage);
    next.log = [...next.log, `You cast through ${next.enemy.style} for ${roll.damage}.`].slice(-10);
    return next;
  }

  const roll = rollDamage({
    seed: next.seed,
    salt: 61,
    base: 42 + next.player.meleeBonus * 2,
    spread: 12,
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
    next.log = [...next.log, `${next.enemy.name} is staggered.`].slice(-10);
    return next;
  }

  const dodgeChance = next.player.dodgeReady ? Math.min(0.9, 0.45 + next.player.dodgeBonus * 0.05) : 0;
  if (dodgeChance > 0) {
    const dodgeRoll = randomUnit(next.seed, 37);
    next.seed = dodgeRoll.seed;
    if (dodgeRoll.value < dodgeChance) {
      next.player.dodgeReady = false;
      next.log = [...next.log, "You slip past the Dreadgod strike."].slice(-10);
      return next;
    }
  }

  const bonus =
    next.enemy.ability === "bloodfire" ? 16
      : next.enemy.ability === "storm" ? 18
        : next.enemy.ability === "shade" ? 17
          : next.enemy.ability === "fortress" ? 15
            : 12;
  const roll = rollDamage({
    seed: next.seed,
    salt: 47,
    base: next.enemy.attack + bonus,
    spread: 12,
    attackerStage: next.enemy.stage,
    defenderStage: next.player.stage,
  });
  next.seed = roll.seed;
  next.player.hp = Math.max(0, next.player.hp - roll.damage);
  next.player.dodgeReady = false;
  next.log = [...next.log, `${next.enemy.name} (${next.enemy.style}) hits for ${roll.damage}.`].slice(-10);
  return next;
}

function startBattle(current, action) {
  const boss = DREADGOD_BY_ID[String(action.bossId || "")];
  if (!boss) {
    return current;
  }
  return {
    ...current,
    phase: "battle",
    selectedBossId: boss.id,
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
    enemy: {
      id: boss.id,
      name: boss.name,
      style: boss.style,
      stage: normalizeCombatStage(boss.stage || "archlord"),
      hp: boss.maxHp,
      maxHp: boss.maxHp,
      attack: boss.attack,
      ability: boss.ability,
      stunnedTurns: 0,
    },
    log: [`${boss.name} enters the field.`],
    seed: (Number(action.seed) || Date.now()) >>> 0,
    lastMessage: "",
  };
}

function onBossDefeated(current, boss) {
  const defeated = {
    ...current.defeated,
    [boss.id]: true,
  };
  const allDown = countDefeated(defeated) >= DREADGODS.length;
  return {
    ...current,
    phase: allDown ? "complete" : "select",
    solved: allDown || current.solved,
    defeated,
    selectedBossId: "",
    player: null,
    enemy: null,
    pendingRewards: [...current.pendingRewards, boss.reward],
    pendingMadraAward: Number(current.pendingMadraAward || 0) + boss.madra,
    pendingSoulfireAward: Number(current.pendingSoulfireAward || 0) + boss.soulfire,
    lootEvents: [
      { sourceRegion: "crd", triggerType: `crd11-${boss.id}`, dropChance: 1, outRegionChance: 0, rarityBias: 1 },
      { sourceRegion: "worm", triggerType: `crd11-${boss.id}`, dropChance: 0.85, outRegionChance: 0.4, rarityBias: 1 },
      { sourceRegion: "dcc", triggerType: `crd11-${boss.id}`, dropChance: 0.85, outRegionChance: 0.4, rarityBias: 1 },
    ],
    log: [...current.log, `${boss.name} falls.`].slice(-10),
    lastMessage: allDown ? "All four Dreadgods are defeated." : `${boss.name} defeated. Choose your next hunt.`,
  };
}

export function initialCrd11Runtime() {
  return initialRuntime();
}

export function synchronizeCrd11Runtime(runtime) {
  return normalizeRuntime(runtime);
}

export function validateCrd11Runtime(runtime) {
  return Boolean(runtime && runtime.solved);
}

export function reduceCrd11Runtime(runtime, action) {
  const current = normalizeRuntime(runtime);
  if (!action || typeof action !== "object") {
    return current;
  }

  if (action.type === "crd11-start-hunt") {
    if (!action.ready) {
      return {
        ...current,
        lastMessage: "Only completed Archlord paths can challenge the Dreadgods.",
      };
    }
    const boss = DREADGOD_BY_ID[String(action.bossId || "")];
    if (!boss || current.defeated[boss.id]) {
      return current;
    }
    return startBattle(current, action);
  }

  if (action.type === "crd11-fight-action") {
    if (current.phase !== "battle") {
      return current;
    }
    const boss = current.enemy && DREADGOD_BY_ID[current.enemy.id] ? DREADGOD_BY_ID[current.enemy.id] : null;
    if (!boss) {
      return current;
    }

    let next = resolvePlayerMove(current, String(action.move || "melee"));
    if (next.enemy && next.enemy.hp <= 0) {
      return onBossDefeated(next, boss);
    }
    next = resolveEnemyTurn(next);
    if (next.player && next.player.hp <= 0) {
      return {
        ...next,
        phase: "select",
        player: null,
        enemy: null,
        selectedBossId: "",
        lastMessage: "Defeated. The Dreadgod escapes for now.",
      };
    }
    return next;
  }

  if (action.type === "crd11-clear-awards") {
    return {
      ...current,
      pendingRewards: [],
      pendingMadraAward: 0,
      pendingSoulfireAward: 0,
      lootEvents: [],
    };
  }

  return current;
}

export function buildCrd11ActionFromElement(element) {
  const actionName = element.getAttribute("data-node-action");
  if (!actionName) {
    return null;
  }
  if (actionName === "crd11-start-hunt") {
    return {
      type: "crd11-start-hunt",
      ready: element.getAttribute("data-ready") === "true",
      bossId: element.getAttribute("data-boss-id") || "",
      seed: Date.now(),
      playerStage: element.getAttribute("data-player-stage") || "archlord",
      playerMaxHp: Number(element.getAttribute("data-player-max-hp") || 340),
      playerMaxMadra: Number(element.getAttribute("data-player-max-madra") || 300),
      playerDodgeBonus: Number(element.getAttribute("data-player-dodge-bonus") || 0),
      playerMeleeBonus: Number(element.getAttribute("data-player-melee-bonus") || 0),
      playerSpellBonus: Number(element.getAttribute("data-player-spell-bonus") || 0),
      playerEmptyPalm: element.getAttribute("data-player-empty-palm") === "true",
      at: nowMs(),
    };
  }
  if (actionName === "crd11-fight-action") {
    return {
      type: "crd11-fight-action",
      move: element.getAttribute("data-move") || "melee",
      at: nowMs(),
    };
  }
  return null;
}

export function renderCrd11Experience(context) {
  const runtime = normalizeRuntime(context.runtime);
  const profile = combatProfileFromState(context.state || {});
  const defeatedTotal = countDefeated(runtime.defeated);

  if (runtime.phase === "battle" && runtime.enemy && runtime.player) {
    return `
      <article class="crd04-node" data-node-id="${NODE_ID}">
        <section class="crd04-combat-head">
          <h3>CRD11: Dreadgod Hunt</h3>
          <p class="muted">Target: ${escapeHtml(runtime.enemy.name)} (${escapeHtml(runtime.enemy.style)})</p>
        </section>
        <section class="crd04-bars">
          ${barMarkup("Health", runtime.player.hp, runtime.player.maxHp, "is-health")}
          ${barMarkup("Madra", runtime.player.madra, runtime.player.maxMadra, "is-madra")}
        </section>
        <section class="crd04-bars enemy">
          ${barMarkup(`${runtime.enemy.name} HP`, runtime.enemy.hp, runtime.enemy.maxHp, "is-enemy")}
        </section>
        <section class="crd04-actions">
          <button type="button" data-node-id="${NODE_ID}" data-node-action="crd11-fight-action" data-move="melee">Melee</button>
          <button type="button" data-node-id="${NODE_ID}" data-node-action="crd11-fight-action" data-move="spell">Spell</button>
          <button type="button" data-node-id="${NODE_ID}" data-node-action="crd11-fight-action" data-move="dodge">Dodge</button>
          <button type="button" data-node-id="${NODE_ID}" data-node-action="crd11-fight-action" data-move="empty-palm" ${runtime.player.emptyPalm ? "" : "disabled"}>Empty Palm</button>
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

  return `
    <article class="crd04-node" data-node-id="${NODE_ID}">
      <section class="crd04-dialog">
        <h3>CRD11: Dreadgod Hunt</h3>
        <p>Track and slay each Dreadgod. Defeated targets remain sealed.</p>
        <p class="muted">Defeated: ${defeatedTotal}/${DREADGODS.length}</p>
        <div class="crd04-actions">
          ${DREADGODS.map((boss) => {
    const down = Boolean(runtime.defeated[boss.id]);
    return `
              <button
                type="button"
                data-node-id="${NODE_ID}"
                data-node-action="crd11-start-hunt"
                data-ready="${profile.ready ? "true" : "false"}"
                data-boss-id="${escapeHtml(boss.id)}"
                data-player-stage="${escapeHtml(profile.stage)}"
                data-player-max-hp="${escapeHtml(String(profile.maxHp))}"
                data-player-max-madra="${escapeHtml(String(profile.maxMadra))}"
                data-player-dodge-bonus="${escapeHtml(String(profile.dodgeBonus))}"
                data-player-melee-bonus="${escapeHtml(String(profile.meleeBonus))}"
                data-player-spell-bonus="${escapeHtml(String(profile.spellBonus))}"
                data-player-empty-palm="${profile.hasEmptyPalm ? "true" : "false"}"
                class="${down ? "ghost" : ""}"
                ${down ? "disabled" : ""}
              >
                ${escapeHtml(boss.name)}
              </button>
            `;
  }).join("")}
        </div>
        ${runtime.lastMessage ? `<p>${escapeHtml(runtime.lastMessage)}</p>` : ""}
      </section>
    </article>
  `;
}

export const CRD11_NODE_EXPERIENCE = {
  nodeId: NODE_ID,
  initialState: initialCrd11Runtime,
  synchronizeRuntime: synchronizeCrd11Runtime,
  render: renderCrd11Experience,
  reduceRuntime: reduceCrd11Runtime,
  validateRuntime: validateCrd11Runtime,
  buildActionFromElement: buildCrd11ActionFromElement,
};

