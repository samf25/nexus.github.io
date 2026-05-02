import { escapeHtml } from "../../templates/shared.js";
import {
  applyCradleTechniqueAttackDamage,
  applyCradleConsumeLeech,
  applyCradleTechniqueDamageReduction,
  cradleTechniqueAdjustedEmptyPalmBaseChance,
  cradleTechniqueAdjustedDodgeChance,
  cradleTechniqueAdjustedMadraCost,
  cradleTechniqueEffectsFromState,
  cradleCombatAttackMultiplierFromState,
  emptyPalmSuccessRoll,
  madraPoolMultiplierForStage,
  normalizeCombatStage,
  randomUnit,
  rollDamage,
  rollHollowDomainSuppression,
} from "./combatSystem.js";

const NODE_ID = "CRD08";

const OPPONENTS = Object.freeze([
  { name: "Sha Miara", style: "Cloud Magic", stage: "underlord", maxHp: 360, attack: 34, ability: "veil" },
  { name: "Ziel", style: "Binding Magic", stage: "underlord", maxHp: 390, attack: 36, ability: "bind" },
  { name: "Brothen Aekin", style: "Blood Magic", stage: "underlord", maxHp: 410, attack: 38, ability: "hemorrhage" },
  { name: "Akura Mercy", style: "Darkness Magic", stage: "underlord", maxHp: 440, attack: 40, ability: "shadow" },
  { name: "Sopharanatoth", style: "Fire Magic", stage: "underlord", maxHp: 480, attack: 44, ability: "dragonfire" },
]);

function nowMs() {
  return Date.now();
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
  const soulfireCycler = Number(crd02.soulfire && crd02.soulfire.soulfireCyclerLevel ? crd02.soulfire.soulfireCyclerLevel : 0);
  const attackMultiplier = cradleCombatAttackMultiplierFromState(state || {});

  return {
    stage,
    hasEmptyPalm: emptyPalm > 0,
    meleeBonus: (soulCloak + consume + hollowDomain + soulfireCycler) * attackMultiplier,
    dodgeBonus: soulCloak + hollowDomain,
    techEffects: cradleTechniqueEffectsFromState(state || {}, stage),
    maxHp: 190 + ironBody * 34 + (["underlord", "overlord", "archlord"].includes(stage) ? 120 : 0),
    maxMadra: Math.round((180 + soulCloak * 5 + consume * 8 + hollowDomain * 10) * madraPoolMultiplierForStage(stage)),
  };
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function normalizeRuntime(candidate) {
  const source = candidate && typeof candidate === "object" ? candidate : {};
  const phase = ["intro", "battle", "victory"].includes(source.phase) ? source.phase : "intro";
  return {
    phase,
    solved: Boolean(source.solved),
    index: clamp(Math.floor(Number(source.index) || 0), 0, OPPONENTS.length - 1),
    seed: Number.isFinite(source.seed) ? Number(source.seed) >>> 0 : (Date.now() >>> 0),
    playerStage: normalizeCombatStage(source.playerStage || "foundation"),
    playerHp: Math.max(0, Number(source.playerHp) || 0),
    playerMaxHp: Math.max(1, Number(source.playerMaxHp) || 1),
    playerMadra: Math.max(0, Number(source.playerMadra) || 0),
    playerMaxMadra: Math.max(1, Number(source.playerMaxMadra) || 1),
    dodgeReady: Boolean(source.dodgeReady),
    dodgeBonus: Math.max(0, Number(source.dodgeBonus) || 0),
    meleeBonus: Math.max(0, Number(source.meleeBonus) || 0),
    techEffects: source.techEffects && typeof source.techEffects === "object" ? { ...source.techEffects } : {},
    emptyPalmUnlocked: Boolean(source.emptyPalmUnlocked),
    enemy: source.enemy && typeof source.enemy === "object"
      ? {
        ...source.enemy,
        hp: Math.max(0, Number(source.enemy.hp) || 0),
        maxHp: Math.max(1, Number(source.enemy.maxHp) || 1),
        stage: normalizeCombatStage(source.enemy.stage || "underlord"),
        attack: Math.max(1, Number(source.enemy.attack) || 1),
        stunnedTurns: Math.max(0, Math.floor(Number(source.enemy.stunnedTurns) || 0)),
      }
      : null,
    turn: Math.max(1, Math.floor(Number(source.turn) || 1)),
    log: Array.isArray(source.log) ? source.log.slice(-10).map((line) => String(line)) : [],
    pendingMadraAward: Math.max(0, Number(source.pendingMadraAward) || 0),
    pendingSoulfireAward: Math.max(0, Number(source.pendingSoulfireAward) || 0),
    lootEvents: Array.isArray(source.lootEvents) ? source.lootEvents.filter((entry) => entry && typeof entry === "object") : [],
    lastMessage: String(source.lastMessage || ""),
  };
}

function initialRuntime() {
  return normalizeRuntime({
    phase: "intro",
    solved: false,
    index: 0,
    seed: Date.now() >>> 0,
    playerStage: "foundation",
    playerHp: 0,
    playerMaxHp: 1,
    playerMadra: 0,
    playerMaxMadra: 1,
    dodgeReady: false,
    dodgeBonus: 0,
    meleeBonus: 0,
    techEffects: {},
    emptyPalmUnlocked: false,
    enemy: null,
    turn: 1,
    log: [],
    pendingMadraAward: 0,
    pendingSoulfireAward: 0,
    lootEvents: [],
    lastMessage: "",
  });
}

function opponentAt(index) {
  const source = OPPONENTS[index] || OPPONENTS[0];
  return {
    ...source,
    hp: source.maxHp,
    stunnedTurns: 0,
  };
}

function uncrownedTechnique(enemy) {
  const ability = String(enemy && enemy.ability ? enemy.ability : "").toLowerCase();
  if (ability === "veil") {
    return "cloud-veil lance";
  }
  if (ability === "bind") {
    return "binding chain weave";
  }
  if (ability === "hemorrhage") {
    return "bloodline rupture";
  }
  if (ability === "shadow") {
    return "night-bloom volley";
  }
  if (ability === "dragonfire") {
    return "dragonfire torrent";
  }
  return "uncrowned strike";
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

function startGauntlet(current, action) {
  const enemy = opponentAt(0);
  return {
    ...current,
    phase: "battle",
    index: 0,
    seed: (Number(action.seed) || Date.now()) >>> 0,
    playerStage: normalizeCombatStage(action.playerStage || "foundation"),
    playerHp: Math.max(1, Number(action.playerMaxHp) || 1),
    playerMaxHp: Math.max(1, Number(action.playerMaxHp) || 1),
    playerMadra: Math.max(1, Number(action.playerMaxMadra) || 1),
    playerMaxMadra: Math.max(1, Number(action.playerMaxMadra) || 1),
    dodgeReady: false,
    dodgeBonus: Math.max(0, Number(action.dodgeBonus) || 0),
    meleeBonus: Math.max(0, Number(action.meleeBonus) || 0),
    techEffects: action.techEffects && typeof action.techEffects === "object" ? { ...action.techEffects } : {},
    emptyPalmUnlocked: Boolean(action.emptyPalmUnlocked),
    enemy,
    turn: 1,
    log: [`Round 1 begins: ${enemy.name}.`],
    lastMessage: "",
  };
}

function resolvePlayerMove(current, move) {
  if (!current.enemy) {
    return current;
  }
  const next = {
    ...current,
    enemy: { ...current.enemy },
  };

  if (move === "dodge") {
    next.dodgeReady = true;
    next.log = [...next.log, "You slide into a flowing evasive stance."].slice(-10);
    return next;
  }

  if (move === "empty-palm") {
    if (!next.emptyPalmUnlocked) {
      next.log = [...next.log, "You have not learned the Empty Palm."].slice(-10);
      return next;
    }
    const cost = cradleTechniqueAdjustedMadraCost(20, next.techEffects);
    if (next.playerMadra < cost) {
      next.log = [...next.log, "Not enough madra for Empty Palm."].slice(-10);
      return next;
    }
    const roll = rollDamage({
      seed: next.seed,
      salt: 51,
      base: 22 + next.meleeBonus,
      spread: 5,
      attackerStage: next.playerStage,
      defenderStage: next.enemy.stage,
    });
    const palmRoll = emptyPalmSuccessRoll({
      seed: roll.seed,
      salt: 151,
      attackerStage: next.playerStage,
      defenderStage: next.enemy.stage,
      baseChance: cradleTechniqueAdjustedEmptyPalmBaseChance(0.66, next.techEffects),
      penaltyPerStage: 0.24,
      minChance: 0.02,
      severeGapThreshold: 2,
      severeGapChance: 0.01,
    });
    next.seed = palmRoll.seed;
    next.playerMadra = Math.max(0, next.playerMadra - cost);
    if (!palmRoll.success) {
      next.log = [...next.log, `Empty Palm slips past ${next.enemy.name} without taking hold.`].slice(-10);
      return next;
    }
    const leech = applyCradleConsumeLeech({
      hp: next.playerHp,
      maxHp: next.playerMaxHp,
      madra: next.playerMadra,
      maxMadra: next.playerMaxMadra,
      damageDealt: applyCradleTechniqueAttackDamage(roll.damage, next.techEffects),
      effects: next.techEffects,
    });
    const inflicted = applyCradleTechniqueAttackDamage(roll.damage, next.techEffects);
    next.playerHp = leech.hp;
    next.playerMadra = leech.madra;
    next.enemy.hp = Math.max(0, next.enemy.hp - inflicted);
    next.enemy.stunnedTurns = Math.max(1, next.enemy.stunnedTurns);
    next.log = [...next.log, `Empty Palm fractures channels for ${inflicted}.${leech.gainedHp || leech.gainedMadra ? ` Consume restores ${leech.gainedHp} HP / ${leech.gainedMadra} Madra.` : ""}`].slice(-10);
    return next;
  }

  const roll = rollDamage({
    seed: next.seed,
    salt: 47,
    base: 18 + next.meleeBonus * 2,
    spread: 7,
    attackerStage: next.playerStage,
    defenderStage: next.enemy.stage,
  });
  next.seed = roll.seed;
  const inflicted = applyCradleTechniqueAttackDamage(roll.damage, next.techEffects);
  next.enemy.hp = Math.max(0, next.enemy.hp - inflicted);
  const leech = applyCradleConsumeLeech({
    hp: next.playerHp,
    maxHp: next.playerMaxHp,
    madra: next.playerMadra,
    maxMadra: next.playerMaxMadra,
    damageDealt: inflicted,
    effects: next.techEffects,
  });
  next.playerHp = leech.hp;
  next.playerMadra = leech.madra;
  next.log = [...next.log, `You strike for ${inflicted}.${leech.gainedHp || leech.gainedMadra ? ` Consume restores ${leech.gainedHp} HP / ${leech.gainedMadra} Madra.` : ""}`].slice(-10);
  return next;
}

function resolveEnemyTurn(current) {
  if (!current.enemy) {
    return current;
  }

  const next = {
    ...current,
    enemy: { ...current.enemy },
  };

  if (next.enemy.stunnedTurns > 0) {
    next.enemy.stunnedTurns -= 1;
    next.log = [...next.log, `${next.enemy.name} is staggered and cannot act.`].slice(-10);
    return next;
  }

  const dodgeChance = next.dodgeReady
    ? cradleTechniqueAdjustedDodgeChance(Math.min(0.88, 0.5 + next.dodgeBonus * 0.05), next.techEffects)
    : 0;
  if (dodgeChance > 0) {
    const dodgeRoll = randomUnit(next.seed, 31);
    next.seed = dodgeRoll.seed;
    if (dodgeRoll.value < dodgeChance) {
      next.dodgeReady = false;
      next.log = [...next.log, `You evade ${next.enemy.name}'s ${uncrownedTechnique(next.enemy)}.`].slice(-10);
      return next;
    }
  }

  const style = String(next.enemy.ability || "");
  const bonus =
    style === "dragonfire" ? 12
      : style === "shadow" ? 8
        : style === "hemorrhage" ? 7
          : style === "bind" ? 6
            : style === "veil" ? 5
              : 0;

  const suppressRoll = rollHollowDomainSuppression({
    seed: next.seed,
    salt: 131,
    effects: next.techEffects,
  });
  next.seed = suppressRoll.seed;
  const roll = rollDamage({
    seed: suppressRoll.seed,
    salt: 29,
    base: next.enemy.attack + (suppressRoll.success ? Math.round(bonus * 0.35) : bonus),
    spread: 7,
    attackerStage: next.enemy.stage,
    defenderStage: next.playerStage,
  });
  next.seed = roll.seed;
  const mitigated = applyCradleTechniqueDamageReduction(roll.damage, next.techEffects);
  next.playerHp = Math.max(0, next.playerHp - mitigated);
  next.dodgeReady = false;
  next.log = [...next.log, `${suppressRoll.success ? "Hollow Domain blunts the strike. " : ""}${next.enemy.name}'s ${uncrownedTechnique(next.enemy)} hits for ${mitigated}.`].slice(-10);
  return next;
}

function advanceRoundOrWin(current) {
  if (!current.enemy) {
    return current;
  }

  if (current.enemy.hp > 0) {
    return current;
  }

  const nextIndex = current.index + 1;
  if (nextIndex >= OPPONENTS.length) {
    return {
      ...current,
      phase: "victory",
      solved: true,
      enemy: null,
      pendingMadraAward: 35000,
      pendingSoulfireAward: 22,
      lootEvents: [
        { sourceRegion: "crd", triggerType: "crd08-victory", dropChance: 1, outRegionChance: 0, rarityBias: 1 },
        { sourceRegion: "worm", triggerType: "crd08-victory", dropChance: 1, outRegionChance: 0, rarityBias: 1 },
        { sourceRegion: "dcc", triggerType: "crd08-victory", dropChance: 1, outRegionChance: 0, rarityBias: 1 },
      ],
      lastMessage: "Tournament won. Claiming your rewards.",
    };
  }

  const nextEnemy = opponentAt(nextIndex);
  return {
    ...current,
    index: nextIndex,
    enemy: nextEnemy,
    playerHp: current.playerMaxHp,
    playerMadra: current.playerMaxMadra,
    dodgeReady: false,
    turn: current.turn + 1,
    log: [...current.log, `Round ${nextIndex + 1} begins: ${nextEnemy.name}.`].slice(-10),
  };
}

export function initialCrd08Runtime() {
  return initialRuntime();
}

export function synchronizeCrd08Runtime(runtime) {
  return normalizeRuntime(runtime);
}

export function validateCrd08Runtime(runtime) {
  return Boolean(runtime && runtime.solved);
}

export function reduceCrd08Runtime(runtime, action) {
  const current = normalizeRuntime(runtime);
  if (!action || typeof action !== "object") {
    return current;
  }

  if (action.type === "crd08-start") {
    if (!action.ready) {
      return {
        ...current,
        lastMessage: "Only Underlords may enter this tournament.",
      };
    }
    return startGauntlet(current, action);
  }

  if (action.type === "crd08-player-action") {
    if (current.phase !== "battle") {
      return current;
    }
    let next = resolvePlayerMove(current, String(action.move || "melee"));
    next = advanceRoundOrWin(next);
    if (next.phase === "victory") {
      return next;
    }
    if (next.enemy && next.enemy.hp > 0) {
      next = resolveEnemyTurn(next);
    }
    if (next.playerHp <= 0) {
      return {
        ...next,
        phase: "intro",
        enemy: null,
        lastMessage: "Defeated. The Uncrowned gate closes for now.",
      };
    }
    return {
      ...next,
      turn: next.turn + 1,
    };
  }

  if (action.type === "crd08-clear-awards") {
    return {
      ...current,
      pendingMadraAward: 0,
      pendingSoulfireAward: 0,
    };
  }

  return current;
}

export function buildCrd08ActionFromElement(element) {
  const actionName = element.getAttribute("data-node-action");
  if (!actionName) {
    return null;
  }
  if (actionName === "crd08-start") {
    return {
      type: "crd08-start",
      ready: element.getAttribute("data-ready") === "true",
      seed: Date.now(),
      playerStage: element.getAttribute("data-player-stage") || "foundation",
      playerMaxHp: Number(element.getAttribute("data-player-max-hp") || 120),
      playerMaxMadra: Number(element.getAttribute("data-player-max-madra") || 100),
      dodgeBonus: Number(element.getAttribute("data-player-dodge-bonus") || 0),
      meleeBonus: Number(element.getAttribute("data-player-melee-bonus") || 0),
      techEffects: {
        ironBodyDamageReduction: Number(element.getAttribute("data-tech-iron-body") || 0),
        soulCloakDodgeBonus: Number(element.getAttribute("data-tech-soul-cloak-dodge") || 0),
        soulCloakMadraDiscount: Number(element.getAttribute("data-tech-soul-cloak-cost") || 0),
        consumeLifeStealRatio: Number(element.getAttribute("data-tech-consume-life") || 0),
        consumeMadraStealRatio: Number(element.getAttribute("data-tech-consume-madra") || 0),
        hollowDomainDamageReduction: Number(element.getAttribute("data-tech-domain-damage") || 0),
        hollowDomainSuppressChance: Number(element.getAttribute("data-tech-domain-suppress") || 0),
        dragonBreathFlatDamage: Number(element.getAttribute("data-tech-dragon-flat") || 0),
        burningCloakDodgeBonus: Number(element.getAttribute("data-tech-burning-dodge") || 0),
        burningCloakMadraDiscount: Number(element.getAttribute("data-tech-burning-discount") || 0),
        burningCloakDamageMultiplier: Number(element.getAttribute("data-tech-burning-mult") || 1),
        voidDragonsDanceDamageMultiplier: Number(element.getAttribute("data-tech-void-mult") || 1),
        twinStarsCombatDamageMultiplier: Number(element.getAttribute("data-tech-twinstars-mult") || 1),
        twinStarsCombatMadraOnHit: Number(element.getAttribute("data-tech-twinstars-madra") || 0),
        drossAttackMultiplier: Number(element.getAttribute("data-tech-dross-atk") || 1),
        drossDamageReduction: Number(element.getAttribute("data-tech-dross-dr") || 0),
        drossMadraDiscount: Number(element.getAttribute("data-tech-dross-discount") || 0),
        drossEmptyPalmBonus: Number(element.getAttribute("data-tech-dross-palm") || 0),
      },
      emptyPalmUnlocked: element.getAttribute("data-player-empty-palm") === "true",
      at: nowMs(),
    };
  }
  if (actionName === "crd08-player-action") {
    return {
      type: "crd08-player-action",
      move: element.getAttribute("data-move") || "melee",
      at: nowMs(),
    };
  }
  return null;
}

export function renderCrd08Experience(context) {
  const runtime = normalizeRuntime(context.runtime);
  const profile = combatProfileFromState(context.state || {});
  const isUnderlord = ["underlord", "overlord", "archlord"].includes(normalizeCombatStage(profile.stage));

  if (runtime.phase === "intro") {
    return `
      <article class="crd04-node" data-node-id="${NODE_ID}">
        <section class="crd04-dialog">
          <h3>Uncrowded King Tournament</h3>
          <p>A gauntlet of elite Underlords stands between you and the Uncrowded crown.</p>
          <div class="crd04-actions">
            <button
              type="button"
              data-node-id="${NODE_ID}"
              data-node-action="crd08-start"
              data-ready="${isUnderlord ? "true" : "false"}"
              data-player-stage="${escapeHtml(profile.stage)}"
              data-player-max-hp="${escapeHtml(String(profile.maxHp))}"
              data-player-max-madra="${escapeHtml(String(profile.maxMadra))}"
              data-player-dodge-bonus="${escapeHtml(String(profile.dodgeBonus))}"
              data-player-melee-bonus="${escapeHtml(String(profile.meleeBonus))}"
              data-tech-iron-body="${escapeHtml(String(profile.techEffects.ironBodyDamageReduction || 0))}"
              data-tech-soul-cloak-dodge="${escapeHtml(String(profile.techEffects.soulCloakDodgeBonus || 0))}"
              data-tech-soul-cloak-cost="${escapeHtml(String(profile.techEffects.soulCloakMadraDiscount || 0))}"
              data-tech-consume-life="${escapeHtml(String(profile.techEffects.consumeLifeStealRatio || 0))}"
              data-tech-consume-madra="${escapeHtml(String(profile.techEffects.consumeMadraStealRatio || 0))}"
              data-tech-domain-damage="${escapeHtml(String(profile.techEffects.hollowDomainDamageReduction || 0))}"
              data-tech-domain-suppress="${escapeHtml(String(profile.techEffects.hollowDomainSuppressChance || 0))}"
              data-tech-dragon-flat="${escapeHtml(String(profile.techEffects.dragonBreathFlatDamage || 0))}"
              data-tech-burning-dodge="${escapeHtml(String(profile.techEffects.burningCloakDodgeBonus || 0))}"
              data-tech-burning-discount="${escapeHtml(String(profile.techEffects.burningCloakMadraDiscount || 0))}"
              data-tech-burning-mult="${escapeHtml(String(profile.techEffects.burningCloakDamageMultiplier || 1))}"
              data-tech-void-mult="${escapeHtml(String(profile.techEffects.voidDragonsDanceDamageMultiplier || 1))}"
              data-tech-twinstars-mult="${escapeHtml(String(profile.techEffects.twinStarsCombatDamageMultiplier || 1))}"
              data-tech-twinstars-madra="${escapeHtml(String(profile.techEffects.twinStarsCombatMadraOnHit || 0))}"
              data-tech-dross-atk="${escapeHtml(String(profile.techEffects.drossAttackMultiplier || 1))}"
              data-tech-dross-dr="${escapeHtml(String(profile.techEffects.drossDamageReduction || 0))}"
              data-tech-dross-discount="${escapeHtml(String(profile.techEffects.drossMadraDiscount || 0))}"
              data-tech-dross-palm="${escapeHtml(String(profile.techEffects.drossEmptyPalmBonus || 0))}"
              data-player-empty-palm="${profile.hasEmptyPalm ? "true" : "false"}"
              ${isUnderlord ? "" : "disabled"}
            >
              Enter Tournament
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
          <h3>Tournament Conquered</h3>
          <p>You seize the Uncrowded Sigil and emerge marked by Soulfire and fame.</p>
        </section>
      </article>
    `;
  }

  const enemy = runtime.enemy || opponentAt(runtime.index);
  return `
    <article class="crd04-node" data-node-id="${NODE_ID}">
      <section class="crd04-combat-head">
        <h3>Tournament Battle ${runtime.index + 1} / ${OPPONENTS.length}</h3>
        <p class="muted">Opponent: ${escapeHtml(enemy.name)}</p>
      </section>

      <section class="crd04-bars">
        ${barMarkup("Health", runtime.playerHp, runtime.playerMaxHp, "is-health")}
        ${barMarkup("Madra", runtime.playerMadra, runtime.playerMaxMadra, "is-madra")}
      </section>

      <section class="crd04-bars enemy">
        ${barMarkup(`${enemy.name} HP`, enemy.hp, enemy.maxHp, "is-enemy")}
      </section>

      <section class="crd04-actions">
        <button type="button" data-node-id="${NODE_ID}" data-node-action="crd08-player-action" data-move="melee">Melee</button>
        <button type="button" data-node-id="${NODE_ID}" data-node-action="crd08-player-action" data-move="dodge">Dodge</button>
        <button type="button" data-node-id="${NODE_ID}" data-node-action="crd08-player-action" data-move="empty-palm" ${runtime.emptyPalmUnlocked ? "" : "disabled"}>Empty Palm</button>
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

export const CRD08_NODE_EXPERIENCE = {
  nodeId: NODE_ID,
  initialState: initialCrd08Runtime,
  synchronizeRuntime: synchronizeCrd08Runtime,
  render: renderCrd08Experience,
  reduceRuntime: reduceCrd08Runtime,
  validateRuntime: validateCrd08Runtime,
  buildActionFromElement: buildCrd08ActionFromElement,
};
