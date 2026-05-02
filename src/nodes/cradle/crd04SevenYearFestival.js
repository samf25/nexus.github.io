import { escapeHtml } from "../../templates/shared.js";
import { renderArtifactSymbol } from "../../core/artifacts.js";
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

const NODE_ID = "CRD04";
const COOLDOWN_MS = 60 * 60 * 1000;
const TOURNAMENT_PASS = "Seven-Year Festival Tournament Pass";

const OPPONENTS = Object.freeze([
  { name: "Kazan Niro", clan: "Kazan", stage: "copper", maxHp: 74, attack: 12 },
  { name: "Wei Saren", clan: "Wei", stage: "copper", maxHp: 78, attack: 13 },
  { name: "Li Tovan", clan: "Li", stage: "copper", maxHp: 82, attack: 14 },
  { name: "Kazan Rellis", clan: "Kazan", stage: "copper", maxHp: 88, attack: 15 },
  { name: "Li Gerran", clan: "Li", stage: "iron", maxHp: 106, attack: 18 },
]);

const ENDING_BEATS = Object.freeze([
  "You stand in the ruined arena as Li Markouth descends like a falling star and slaughters the crowd.",
  "You survive by chance and terror. Then Suriel appears, ending Li Markouth with impossible ease.",
  "She rewinds the dead to life, then shows you powers that dwarf everything in Sacred Valley.",
  "Last, she reveals the dreadbeast shadow moving toward Sacred Valley and tells you to grow stronger.",
]);

function nowMs() {
  return Date.now();
}

function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function rewardMatches(name, expected) {
  return normalizeText(name) === normalizeText(expected);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
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
  const attackMultiplier = cradleCombatAttackMultiplierFromState(state || {});

  return {
    stage,
    hasEmptyPalm: emptyPalm > 0,
    meleeBonus: (soulCloak + consume + hollowDomain) * attackMultiplier,
    dodgeBonus: soulCloak + hollowDomain,
    techEffects: cradleTechniqueEffectsFromState(state || {}, stage),
    maxHp: 110 + ironBody * 22 + (stage === "copper" ? 18 : stage === "iron" ? 34 : 0),
    maxMadra: Math.round((95 + soulCloak * 4 + consume * 5 + hollowDomain * 6) * madraPoolMultiplierForStage(stage)),
  };
}

function buildOpponent(index, festivalPalmActive) {
  const source = OPPONENTS[index] || OPPONENTS[0];
  return {
    ...source,
    hp: source.maxHp,
    stunnedTurns: festivalPalmActive ? 1 : 0,
  };
}

function formatMs(remainingMs) {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function normalizeRuntime(runtime) {
  const source = runtime && typeof runtime === "object" ? runtime : {};
  const phase = ["gate", "battle", "cooldown", "ending", "victory"].includes(source.phase)
    ? source.phase
    : "gate";
  const playerStage = normalizeCombatStage(source.playerStage || "foundation");

  return {
    phase,
    cooldownUntil: Number.isFinite(source.cooldownUntil) ? Number(source.cooldownUntil) : 0,
    passAccepted: Boolean(source.passAccepted),
    seed: Number.isFinite(source.seed) ? Number(source.seed) >>> 0 : (Date.now() >>> 0),
    battleIndex: clamp(Math.floor(Number(source.battleIndex) || 0), 0, OPPONENTS.length - 1),
    playerStage,
    playerHp: Math.max(0, Number(source.playerHp) || 0),
    playerMaxHp: Math.max(1, Number(source.playerMaxHp) || 120),
    playerMadra: Math.max(0, Number(source.playerMadra) || 0),
    playerMaxMadra: Math.max(1, Number(source.playerMaxMadra) || 100),
    dodgeReady: Boolean(source.dodgeReady),
    dodgeBonus: Math.max(0, Number(source.dodgeBonus) || 0),
    meleeBonus: Math.max(0, Number(source.meleeBonus) || 0),
    techEffects: source.techEffects && typeof source.techEffects === "object"
      ? { ...source.techEffects }
      : {},
    emptyPalmUnlocked: Boolean(source.emptyPalmUnlocked),
    festivalPalmActive: Boolean(source.festivalPalmActive),
    enemy: source.enemy && typeof source.enemy === "object" ? {
      ...source.enemy,
      hp: Math.max(0, Number(source.enemy.hp) || 0),
      maxHp: Math.max(1, Number(source.enemy.maxHp) || 1),
      attack: Math.max(1, Number(source.enemy.attack) || 1),
      stage: normalizeCombatStage(source.enemy.stage || "foundation"),
      stunnedTurns: Math.max(0, Math.floor(Number(source.enemy.stunnedTurns) || 0)),
    } : buildOpponent(0, false),
    endingIndex: clamp(Math.floor(Number(source.endingIndex) || 0), 0, ENDING_BEATS.length - 1),
    log: Array.isArray(source.log) ? source.log.slice(-8).map((line) => String(line)) : [],
    lastMessage: String(source.lastMessage || ""),
    solved: Boolean(source.solved),
  };
}

function logLine(runtime, text) {
  return {
    ...runtime,
    log: [...runtime.log.slice(-7), text],
  };
}

function startTournament(runtime, action) {
  const stage = normalizeCombatStage(action.playerStage || "foundation");
  const maxHp = Math.max(90, Number(action.playerMaxHp) || 110);
  const maxMadra = Math.max(80, Number(action.playerMaxMadra) || 100);
  const next = {
    ...runtime,
    phase: "battle",
    passAccepted: runtime.passAccepted || Boolean(action.passAccepted),
    seed: (Number(action.seed) || nowMs()) >>> 0,
    battleIndex: 0,
    playerStage: stage,
    playerHp: maxHp,
    playerMaxHp: maxHp,
    playerMadra: maxMadra,
    playerMaxMadra: maxMadra,
    dodgeReady: false,
    dodgeBonus: Math.max(0, Number(action.dodgeBonus) || 0),
    meleeBonus: Math.max(0, Number(action.meleeBonus) || 0),
    techEffects: action.techEffects && typeof action.techEffects === "object"
      ? { ...action.techEffects }
      : {},
    emptyPalmUnlocked: Boolean(action.emptyPalmUnlocked),
    festivalPalmActive: false,
    enemy: buildOpponent(0, false),
    endingIndex: 0,
    log: ["The Seven-Year Festival Tournament begins."],
    lastMessage: "",
    solved: false,
  };
  return next;
}

function advanceOpponent(runtime) {
  const nextIndex = runtime.battleIndex + 1;
  if (nextIndex >= OPPONENTS.length) {
    return {
      ...runtime,
      phase: "ending",
      endingIndex: 0,
      lastMessage: "Victory in the tournament.",
    };
  }

  const healedHp = Math.min(runtime.playerMaxHp, runtime.playerHp + 14);
  const restoredMadra = Math.min(runtime.playerMaxMadra, runtime.playerMadra + 12);
  const nextEnemy = buildOpponent(nextIndex, runtime.festivalPalmActive);
  return {
    ...runtime,
    battleIndex: nextIndex,
    playerHp: healedHp,
    playerMadra: restoredMadra,
    dodgeReady: false,
    enemy: nextEnemy,
    lastMessage: `Next opponent: ${nextEnemy.name} of clan ${nextEnemy.clan}.`,
  };
}

function festivalStrikeLabel(enemy) {
  const clan = String(enemy && enemy.clan ? enemy.clan : "").toLowerCase();
  if (clan === "kazan") {
    return "earth-rooted hammer line";
  }
  if (clan === "wei") {
    return "split-step knife line";
  }
  if (clan === "li") {
    return "razor palm sequence";
  }
  return "festival strike";
}

function resolveEnemyTurn(runtime) {
  let next = runtime;
  let seed = next.seed;
  const enemy = next.enemy;

  if (enemy.stunnedTurns > 0) {
    next = logLine(
      {
        ...next,
        enemy: {
          ...enemy,
          stunnedTurns: enemy.stunnedTurns - 1,
        },
      },
      `${enemy.name} is stunned and cannot act.`,
    );
    return next;
  }

  let dodged = false;
  const dodgeChance = next.dodgeReady
    ? cradleTechniqueAdjustedDodgeChance(Math.min(0.88, 0.55 + next.dodgeBonus * 0.06), next.techEffects)
    : 0;
  if (dodgeChance > 0) {
    const dodgeRoll = randomUnit(seed, 37);
    seed = dodgeRoll.seed;
    dodged = dodgeRoll.value <= dodgeChance;
  }

  if (dodged) {
    const strike = festivalStrikeLabel(enemy);
    next = logLine(
      {
        ...next,
        seed,
        dodgeReady: false,
      },
      `You slip outside ${enemy.name}'s ${strike}.`,
    );
    return next;
  }

  let enemyBonus = 0;
  if (enemy.stage === "iron" && Number(enemy.attack || 0) >= 18) {
    const suppressRoll = rollHollowDomainSuppression({
      seed,
      salt: 143,
      effects: next.techEffects,
    });
    seed = suppressRoll.seed;
    if (suppressRoll.success) {
      next = logLine(next, "Hollow Domain blunts the incoming technique.");
    } else {
      enemyBonus = 3;
    }
  }

  const roll = rollDamage({
    seed,
    salt: 71,
    base: enemy.attack + enemyBonus,
    spread: 4,
    attackerStage: enemy.stage,
    defenderStage: next.playerStage,
  });
  seed = roll.seed;
  const mitigatedDamage = applyCradleTechniqueDamageReduction(roll.damage, next.techEffects);
  const strike = festivalStrikeLabel(enemy);
  const playerHp = Math.max(0, next.playerHp - mitigatedDamage);
  next = logLine(
    {
      ...next,
      seed,
      playerHp,
      dodgeReady: false,
    },
    `${enemy.name}'s ${strike} lands for ${mitigatedDamage}.`,
  );
  return next;
}

function resolvePlayerAction(runtime, actionId, atMs) {
  let next = runtime;
  let seed = next.seed;
  const enemy = next.enemy;

  if (actionId === "dodge") {
    next = logLine(
      {
        ...next,
        dodgeReady: true,
      },
      "You shift your footing and prepare to dodge.",
    );
    return next;
  }

  if (actionId === "empty-palm") {
    if (!next.emptyPalmUnlocked) {
      return logLine(next, "You do not know the Empty Palm.");
    }
    const cost = cradleTechniqueAdjustedMadraCost(12, next.techEffects);
    if (next.playerMadra < cost) {
      return logLine(next, "Not enough madra to shape the Empty Palm.");
    }

    const roll = rollDamage({
      seed,
      salt: 17,
      base: 18 + next.meleeBonus,
      spread: 3,
      attackerStage: next.playerStage,
      defenderStage: enemy.stage,
    });
    const successRoll = emptyPalmSuccessRoll({
      seed: roll.seed,
      salt: 149,
      attackerStage: next.playerStage,
      defenderStage: enemy.stage,
      baseChance: cradleTechniqueAdjustedEmptyPalmBaseChance(0.82, next.techEffects),
      penaltyPerStage: 0.22,
      minChance: 0.04,
      severeGapThreshold: 2,
      severeGapChance: 0.01,
    });
    seed = successRoll.seed;
    if (!successRoll.success) {
      return logLine(
        {
          ...next,
          seed,
          playerMadra: Math.max(0, next.playerMadra - cost),
        },
        `Empty Palm fails to disrupt ${enemy.name}'s channels.`,
      );
    }
    const leech = applyCradleConsumeLeech({
      hp: next.playerHp,
      maxHp: next.playerMaxHp,
      madra: Math.max(0, next.playerMadra - cost),
      maxMadra: next.playerMaxMadra,
      damageDealt: applyCradleTechniqueAttackDamage(roll.damage, next.techEffects),
      effects: next.techEffects,
    });
    const inflicted = applyCradleTechniqueAttackDamage(roll.damage, next.techEffects);
    const enemyHp = Math.max(0, enemy.hp - inflicted);
    next = logLine(
      {
        ...next,
        seed,
        playerHp: leech.hp,
        playerMadra: leech.madra,
        festivalPalmActive: true,
        enemy: {
          ...enemy,
          hp: enemyHp,
          stunnedTurns: Math.max(enemy.stunnedTurns, 2),
        },
      },
      `Empty Palm lands for ${inflicted}. ${enemy.name} is stunned.${leech.gainedHp || leech.gainedMadra ? ` Consume restores ${leech.gainedHp} HP / ${leech.gainedMadra} Madra.` : ""}`,
    );
    return next;
  }

  const roll = rollDamage({
    seed,
    salt: 9,
    base: 12 + next.meleeBonus * 2,
    spread: 5,
    attackerStage: next.playerStage,
    defenderStage: enemy.stage,
  });
  seed = roll.seed;
  const inflicted = applyCradleTechniqueAttackDamage(roll.damage, next.techEffects);
  const leech = applyCradleConsumeLeech({
    hp: next.playerHp,
    maxHp: next.playerMaxHp,
    madra: next.playerMadra,
    maxMadra: next.playerMaxMadra,
    damageDealt: inflicted,
    effects: next.techEffects,
  });
  const enemyHp = Math.max(0, enemy.hp - inflicted);
  next = logLine(
    {
      ...next,
      seed,
      playerHp: leech.hp,
      playerMadra: leech.madra,
      enemy: {
        ...enemy,
        hp: enemyHp,
      },
    },
    `You strike for ${inflicted} damage.${leech.gainedHp || leech.gainedMadra ? ` Consume restores ${leech.gainedHp} HP / ${leech.gainedMadra} Madra.` : ""}`,
  );
  return next;
}

export function initialCrd04Runtime() {
  return {
    phase: "gate",
    cooldownUntil: 0,
    passAccepted: false,
    seed: Date.now() >>> 0,
    battleIndex: 0,
    playerStage: "foundation",
    playerHp: 0,
    playerMaxHp: 110,
    playerMadra: 0,
    playerMaxMadra: 100,
    dodgeReady: false,
    dodgeBonus: 0,
    meleeBonus: 0,
    techEffects: {},
    emptyPalmUnlocked: false,
    festivalPalmActive: false,
    enemy: buildOpponent(0, false),
    endingIndex: 0,
    log: [],
    lastMessage: "",
    solved: false,
  };
}

export function synchronizeCrd04Runtime(runtime, { now = nowMs() } = {}) {
  const current = normalizeRuntime(runtime);
  if (current.phase === "cooldown" && now >= current.cooldownUntil) {
      return {
        ...current,
        phase: "gate",
        cooldownUntil: 0,
        lastMessage: "The gates reopen. You may enter the tournament again.",
      };
  }
  return current;
}

export function validateCrd04Runtime(runtime) {
  return Boolean(normalizeRuntime(runtime).solved);
}

export function reduceCrd04Runtime(runtime, action) {
  const now = Number(action && action.at) || nowMs();
  let current = synchronizeCrd04Runtime(runtime, { now });
  if (!action || typeof action !== "object") {
    return current;
  }

  if (action.type === "crd04-enter-tournament") {
    if (current.phase === "cooldown" && now < current.cooldownUntil) {
      return current;
    }

    if (!current.passAccepted && !rewardMatches(action.artifact, TOURNAMENT_PASS)) {
      return {
        ...current,
        lastMessage: "The gatekeeper bars your way. A valid tournament pass is required.",
      };
    }
    return startTournament(current, {
      ...action,
      passAccepted: current.passAccepted || rewardMatches(action.artifact, TOURNAMENT_PASS),
    });
  }

  if (action.type === "crd04-player-action") {
    if (current.phase !== "battle") {
      return current;
    }

    let next = resolvePlayerAction(current, String(action.actionId || "melee"), now);
    if (next.enemy.hp <= 0) {
      next = logLine(next, `${next.enemy.name} is defeated.`);
      return advanceOpponent(next);
    }

    next = resolveEnemyTurn(next);
    if (next.playerHp <= 0) {
      return {
        ...next,
        phase: "cooldown",
        cooldownUntil: now + COOLDOWN_MS,
        lastMessage: "You are removed from the tournament grounds. Return in one hour.",
      };
    }
    return next;
  }

  if (action.type === "crd04-advance-ending") {
    if (current.phase !== "ending") {
      return current;
    }

    if (current.endingIndex >= ENDING_BEATS.length - 1) {
      return {
        ...current,
        phase: "victory",
        solved: true,
        lastMessage: "You keep Suriel's warning close. Rewards secured.",
      };
    }

    return {
      ...current,
      endingIndex: current.endingIndex + 1,
    };
  }

  return current;
}

export function buildCrd04ActionFromElement(element) {
  const actionName = element.getAttribute("data-node-action");
  if (!actionName) {
    return null;
  }

  if (actionName === "crd04-enter-tournament") {
    return {
      type: "crd04-enter-tournament",
      artifact: element.getAttribute("data-selected-artifact") || "",
      consumePass: element.getAttribute("data-consume-pass") === "true",
      playerStage: element.getAttribute("data-player-stage") || "foundation",
      playerMaxHp: Number(element.getAttribute("data-player-max-hp")) || 110,
      playerMaxMadra: Number(element.getAttribute("data-player-max-madra")) || 100,
      emptyPalmUnlocked: element.getAttribute("data-empty-palm") === "true",
      meleeBonus: Number(element.getAttribute("data-melee-bonus")) || 0,
      dodgeBonus: Number(element.getAttribute("data-dodge-bonus")) || 0,
      techEffects: {
        ironBodyDamageReduction: Number(element.getAttribute("data-tech-iron-dr") || 0),
        soulCloakDodgeBonus: Number(element.getAttribute("data-tech-dodge") || 0),
        soulCloakMadraDiscount: Number(element.getAttribute("data-tech-madra-discount") || 0),
        consumeLifeStealRatio: Number(element.getAttribute("data-tech-consume-life") || 0),
        consumeMadraStealRatio: Number(element.getAttribute("data-tech-consume-madra") || 0),
        hollowDomainDamageReduction: Number(element.getAttribute("data-tech-hollow-dr") || 0),
        hollowDomainSuppressChance: Number(element.getAttribute("data-tech-hollow-suppress") || 0),
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
      seed: Date.now(),
      at: Date.now(),
    };
  }

  if (actionName === "crd04-player-action") {
    return {
      type: "crd04-player-action",
      actionId: element.getAttribute("data-action-id") || "melee",
      at: Date.now(),
    };
  }

  if (actionName === "crd04-advance-ending") {
    return {
      type: "crd04-advance-ending",
      at: Date.now(),
    };
  }

  return null;
}

function barMarkup(label, current, max, className = "") {
  const safeMax = Math.max(1, Number(max) || 1);
  const value = Math.max(0, Math.min(safeMax, Number(current) || 0));
  const pct = Math.round((value / safeMax) * 100);
  return `
    <div class="crd04-bar ${escapeHtml(className)}">
      <div class="crd04-bar-label">${escapeHtml(label)} ${escapeHtml(String(Math.round(value)))}/${escapeHtml(String(Math.round(safeMax)))}</div>
      <div class="progress-bar"><span style="width:${pct}%"></span></div>
    </div>
  `;
}

export function renderCrd04Experience(context) {
  const runtime = synchronizeCrd04Runtime(context.runtime, { now: nowMs() });
  const selectedArtifact = String(context.selectedArtifactReward || "");
  const hasPassSelected = rewardMatches(selectedArtifact, TOURNAMENT_PASS);
  const canEnter = runtime.passAccepted || hasPassSelected;
  const profile = combatProfileFromState(context.state);

  if (runtime.phase === "cooldown" && nowMs() < runtime.cooldownUntil) {
    const remaining = runtime.cooldownUntil - nowMs();
    return `
      <article class="crd04-node" data-node-id="${NODE_ID}">
        <section class="crd04-dialog">
          <h3>Seven-Year Festival Tournament</h3>
          <p>You were cast out after defeat. You can attempt to win next year.</p>
          <p><strong>Next entry window:</strong> ${escapeHtml(formatMs(remaining))}</p>
        </section>
      </article>
    `;
  }

  if (runtime.phase === "gate") {
    return `
      <article class="crd04-node" data-node-id="${NODE_ID}">
        <section class="crd04-dialog">
          <h3>Seven-Year Festival Tournament</h3>
          <p>A steward blocks the gate. "Pass for entry?"</p>
          <button
            type="button"
            class="crd04-pass-button"
            data-node-id="${NODE_ID}"
            data-node-action="crd04-enter-tournament"
            data-selected-artifact="${escapeHtml(selectedArtifact)}"
            data-consume-pass="${!runtime.passAccepted && hasPassSelected ? "true" : "false"}"
            data-player-stage="${escapeHtml(profile.stage)}"
            data-player-max-hp="${escapeHtml(String(profile.maxHp))}"
            data-player-max-madra="${escapeHtml(String(profile.maxMadra))}"
            data-empty-palm="${profile.hasEmptyPalm ? "true" : "false"}"
            data-melee-bonus="${escapeHtml(String(profile.meleeBonus))}"
            data-dodge-bonus="${escapeHtml(String(profile.dodgeBonus))}"
            data-tech-iron-dr="${escapeHtml(String(profile.techEffects.ironBodyDamageReduction || 0))}"
            data-tech-dodge="${escapeHtml(String(profile.techEffects.soulCloakDodgeBonus || 0))}"
            data-tech-madra-discount="${escapeHtml(String(profile.techEffects.soulCloakMadraDiscount || 0))}"
            data-tech-consume-life="${escapeHtml(String(profile.techEffects.consumeLifeStealRatio || 0))}"
            data-tech-consume-madra="${escapeHtml(String(profile.techEffects.consumeMadraStealRatio || 0))}"
            data-tech-hollow-dr="${escapeHtml(String(profile.techEffects.hollowDomainDamageReduction || 0))}"
            data-tech-hollow-suppress="${escapeHtml(String(profile.techEffects.hollowDomainSuppressChance || 0))}"
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
            ${canEnter ? "" : "disabled"}
            aria-label="Present tournament pass"
            title="Present pass"
          >
            ${renderArtifactSymbol({
              artifactName: TOURNAMENT_PASS,
              className: "crd04-pass-symbol artifact-symbol",
            })}
          </button>
        </section>
      </article>
    `;
  }

  if (runtime.phase === "ending") {
    const text = ENDING_BEATS[runtime.endingIndex] || ENDING_BEATS[ENDING_BEATS.length - 1];
    const finalBeat = runtime.endingIndex >= ENDING_BEATS.length - 1;
    return `
      <article class="crd04-node" data-node-id="${NODE_ID}">
        <section class="crd04-dialog">
          <h3>After The Tournament</h3>
          <p>${escapeHtml(text)}</p>
          <button type="button" data-node-id="${NODE_ID}" data-node-action="crd04-advance-ending">
            ${finalBeat ? "Take Suriel's Charge" : "Continue"}
          </button>
        </section>
      </article>
    `;
  }

  if (runtime.phase === "victory") {
    return `
      <article class="crd04-node" data-node-id="${NODE_ID}">
        <section class="crd04-dialog">
          <h3>Survivor Of The Festival</h3>
          <p>You carry Suriel's marble and a Cultivation Potion for the road ahead.</p>
          <p class="key-hint">Return to the Madra Well to break through into Iron.</p>
        </section>
      </article>
    `;
  }

  const enemy = runtime.enemy;
  return `
    <article class="crd04-node" data-node-id="${NODE_ID}">
      <section class="crd04-combat-head">
        <h3>Tournament Battle ${runtime.battleIndex + 1} / ${OPPONENTS.length}</h3>
        <p class="muted">Your stage: ${escapeHtml(runtime.playerStage)} | Opponent: ${escapeHtml(enemy.name)} (${escapeHtml(enemy.clan)} clan, ${escapeHtml(enemy.stage)})</p>
      </section>

      <section class="crd04-bars">
        ${barMarkup("Health", runtime.playerHp, runtime.playerMaxHp, "is-health")}
        ${barMarkup("Madra", runtime.playerMadra, runtime.playerMaxMadra, "is-madra")}
      </section>

      <section class="crd04-bars enemy">
        ${barMarkup(`${enemy.name} HP`, enemy.hp, enemy.maxHp, "is-enemy")}
      </section>

      <section class="crd04-actions">
        <button type="button" data-node-id="${NODE_ID}" data-node-action="crd04-player-action" data-action-id="melee">Melee</button>
        <button type="button" data-node-id="${NODE_ID}" data-node-action="crd04-player-action" data-action-id="dodge">Dodge</button>
        <button
          type="button"
          data-node-id="${NODE_ID}"
          data-node-action="crd04-player-action"
          data-action-id="empty-palm"
          ${runtime.emptyPalmUnlocked ? "" : "disabled"}
        >
          Empty Palm
        </button>
      </section>

      <section class="crd04-log">
        <h4>Combat Log</h4>
        <ul>
          ${runtime.log.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}
        </ul>
      </section>
    </article>
  `;
}

export const CRD04_NODE_EXPERIENCE = {
  nodeId: NODE_ID,
  initialState: initialCrd04Runtime,
  synchronizeRuntime: synchronizeCrd04Runtime,
  render: renderCrd04Experience,
  reduceRuntime: reduceCrd04Runtime,
  validateRuntime: validateCrd04Runtime,
  buildActionFromElement: buildCrd04ActionFromElement,
};
