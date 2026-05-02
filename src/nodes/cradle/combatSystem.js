import { getCradleLootModifiers } from "../../systems/loot.js";
import { prestigeModifiersFromState } from "../../systems/prestige.js";

const COMBAT_STAGES = Object.freeze([
  "foundation",
  "copper",
  "iron",
  "jade",
  "gold",
  "lowgold",
  "highgold",
  "truegold",
  "underlord",
  "overlord",
  "archlord",
]);

const DEFENSE_MULTIPLIER = Object.freeze({
  foundation: 1,
  copper: 0.78,
  iron: 0.62,
  jade: 0.48,
  gold: 0.36,
  lowgold: 0.36,
  highgold: 0.3,
  truegold: 0.24,
  underlord: 0.19,
  overlord: 0.14,
  archlord: 0.1,
});

const ATTACK_MULTIPLIER = Object.freeze({
  foundation: 1,
  copper: 1.2,
  iron: 1.5,
  jade: 1.9,
  gold: 2.2,
  lowgold: 2.2,
  highgold: 2.55,
  truegold: 2.95,
  underlord: 3.55,
  overlord: 4.25,
  archlord: 5.1,
});

const MADRA_POOL_MULTIPLIER = Object.freeze({
  foundation: 1,
  copper: 1.35,
  iron: 1.85,
  jade: 2.4,
  gold: 3.05,
  lowgold: 3.05,
  highgold: 3.8,
  truegold: 4.6,
  underlord: 5.7,
  overlord: 7.1,
  archlord: 8.9,
});

export function normalizeCombatStage(stageId) {
  const candidate = String(stageId || "").trim().toLowerCase();
  return COMBAT_STAGES.includes(candidate) ? candidate : "foundation";
}

export function attackMultiplierForStage(stageId) {
  return ATTACK_MULTIPLIER[normalizeCombatStage(stageId)] || 1;
}

export function defenseMultiplierForStage(stageId) {
  return DEFENSE_MULTIPLIER[normalizeCombatStage(stageId)] || 1;
}

export function madraPoolMultiplierForStage(stageId) {
  return MADRA_POOL_MULTIPLIER[normalizeCombatStage(stageId)] || 1;
}

export function stageGap(defenderStageId, attackerStageId) {
  const defenderIndex = COMBAT_STAGES.indexOf(normalizeCombatStage(defenderStageId));
  const attackerIndex = COMBAT_STAGES.indexOf(normalizeCombatStage(attackerStageId));
  return Math.max(0, defenderIndex - attackerIndex);
}

export function emptyPalmSuccessRoll({
  seed,
  salt = 0,
  attackerStage = "foundation",
  defenderStage = "foundation",
  baseChance = 0.84,
  penaltyPerStage = 0.14,
  minChance = 0.01,
  severeGapThreshold = 2,
  severeGapChance = 0.01,
} = {}) {
  const gap = stageGap(defenderStage, attackerStage);
  let chance = Math.max(minChance, Math.min(0.95, Number(baseChance) - gap * Number(penaltyPerStage)));
  if (gap >= Math.max(1, Number(severeGapThreshold) || 2)) {
    chance = Math.max(0, Math.min(chance, Math.max(0, Number(severeGapChance) || 0.01)));
  }
  const rng = randomUnit(seed, salt);
  return {
    seed: rng.seed,
    success: rng.value <= chance,
    chance,
  };
}

export function cradleCombatAttackMultiplierFromState(state, now = Date.now()) {
  const prestige = prestigeModifiersFromState(state || {});
  const loot = getCradleLootModifiers(state || {}, now);
  return Math.max(
    1,
    Number(prestige.cradle && prestige.cradle.combatAttackMultiplier ? prestige.cradle.combatAttackMultiplier : 1)
      * Number(loot.combatAttackMultiplier || 1),
  );
}

function stageScaleForTechniques(stageId) {
  const index = COMBAT_STAGES.indexOf(normalizeCombatStage(stageId));
  return 1 + Math.max(0, index) * 0.12;
}

function upgradeLevelFromState(state, upgradeId) {
  const runtime = state && state.nodeRuntime && typeof state.nodeRuntime === "object"
    ? state.nodeRuntime.CRD02
    : null;
  const upgrades = runtime && runtime.upgrades && typeof runtime.upgrades === "object"
    ? runtime.upgrades
    : {};
  return Math.max(0, Number(upgrades[upgradeId] || 0));
}

export function cradleTechniqueEffectsFromState(state, stageId = "foundation") {
  const stage = normalizeCombatStage(stageId);
  const scale = stageScaleForTechniques(stage);
  const bloodForged = upgradeLevelFromState(state, "blood-forged-iron-body") > 0;
  const soulCloak = upgradeLevelFromState(state, "soul-cloak") > 0;
  const dragonBreath = upgradeLevelFromState(state, "dragon-breath") > 0;
  const consume = upgradeLevelFromState(state, "consume") > 0;
  const burningCloak = upgradeLevelFromState(state, "burning-cloak") > 0;
  const hollowDomain = upgradeLevelFromState(state, "hollow-domain") > 0;
  const voidDragonsDance = upgradeLevelFromState(state, "void-dragons-dance") > 0;
  const twinStarsCombat = upgradeLevelFromState(state, "heart-of-twin-stars-combat") > 0;
  const drossBattlePlanning = upgradeLevelFromState(state, "dross-battle-planning") > 0;

  return {
    bloodForged,
    soulCloak,
    dragonBreath,
    consume,
    burningCloak,
    hollowDomain,
    voidDragonsDance,
    twinStarsCombat,
    drossBattlePlanning,
    ironBodyDamageReduction: bloodForged ? Math.min(0.55, 0.08 * scale) : 0,
    soulCloakDodgeBonus: soulCloak ? Math.min(0.22, 0.03 * scale) : 0,
    soulCloakMadraDiscount: soulCloak ? Math.min(0.35, 0.06 * scale) : 0,
    dragonBreathFlatDamage: dragonBreath ? Math.max(4, Math.round(4 + scale * 2.2)) : 0,
    consumeLifeStealRatio: consume ? Math.min(0.35, 0.07 * scale) : 0,
    consumeMadraStealRatio: consume ? Math.min(0.32, 0.06 * scale) : 0,
    burningCloakDodgeBonus: burningCloak ? Math.min(0.2, 0.028 * scale) : 0,
    burningCloakMadraDiscount: burningCloak ? Math.min(0.3, 0.045 * scale) : 0,
    burningCloakDamageMultiplier: burningCloak ? Math.min(1.5, 1 + 0.1 * scale) : 1,
    hollowDomainDamageReduction: hollowDomain ? Math.min(0.42, 0.06 * scale) : 0,
    hollowDomainSuppressChance: hollowDomain ? Math.min(0.5, 0.12 * scale) : 0,
    voidDragonsDanceDamageMultiplier: voidDragonsDance ? Math.min(1.65, 1 + 0.13 * scale) : 1,
    twinStarsCombatDamageMultiplier: twinStarsCombat ? Math.min(1.5, 1 + 0.09 * scale) : 1,
    twinStarsCombatMadraOnHit: twinStarsCombat ? Math.max(1, Math.round(1 + 1.3 * scale)) : 0,
    drossAttackMultiplier: drossBattlePlanning ? Math.min(1.4, 1 + 0.085 * scale) : 1,
    drossDamageReduction: drossBattlePlanning ? Math.min(0.28, 0.05 * scale) : 0,
    drossMadraDiscount: drossBattlePlanning ? Math.min(0.22, 0.04 * scale) : 0,
    drossEmptyPalmBonus: drossBattlePlanning ? Math.min(0.16, 0.03 * scale) : 0,
    drossEnemyFumbleChance: drossBattlePlanning ? Math.min(0.22, 0.035 * scale) : 0,
  };
}

export function applyCradleTechniqueDamageReduction(damage, effects = {}) {
  const raw = Math.max(0, Number(damage) || 0);
  const reduction = Math.min(
    0.8,
    Math.max(0, Number(effects.ironBodyDamageReduction || 0))
      + Math.max(0, Number(effects.hollowDomainDamageReduction || 0))
      + Math.max(0, Number(effects.drossDamageReduction || 0)),
  );
  return Math.max(1, Math.round(raw * (1 - reduction)));
}

export function cradleTechniqueAdjustedDodgeChance(baseChance, effects = {}) {
  const chance =
    Math.max(0, Number(baseChance) || 0)
    + Math.max(0, Number(effects.soulCloakDodgeBonus || 0))
    + Math.max(0, Number(effects.burningCloakDodgeBonus || 0));
  return Math.min(0.95, chance);
}

export function cradleTechniqueAdjustedMadraCost(baseCost, effects = {}) {
  const cost = Math.max(1, Number(baseCost) || 1);
  const combinedDiscount =
    Number(effects.soulCloakMadraDiscount || 0)
    + Number(effects.burningCloakMadraDiscount || 0)
    + Number(effects.drossMadraDiscount || 0);
  const discount = Math.max(
    0,
    Math.min(
      0.8,
      combinedDiscount,
    ),
  );
  return Math.max(1, Math.ceil(cost * (1 - discount)));
}

export function cradleTechniqueAdjustedEmptyPalmBaseChance(baseChance, effects = {}) {
  const chance = Math.max(0, Number(baseChance) || 0) + Math.max(0, Number(effects.drossEmptyPalmBonus || 0));
  return Math.min(0.95, chance);
}

export function applyCradleTechniqueAttackDamage(damage, effects = {}) {
  const raw = Math.max(1, Math.round(Number(damage) || 1));
  const flat = Math.max(0, Number(effects.dragonBreathFlatDamage || 0));
  const multiplier =
    Math.max(1, Number(effects.burningCloakDamageMultiplier || 1))
    * Math.max(1, Number(effects.voidDragonsDanceDamageMultiplier || 1))
    * Math.max(1, Number(effects.twinStarsCombatDamageMultiplier || 1))
    * Math.max(1, Number(effects.drossAttackMultiplier || 1));
  return Math.max(1, Math.round((raw + flat) * multiplier));
}

export function rollDrossEnemyFumble({ seed, salt = 0, effects = {} }) {
  const chance = Math.max(0, Math.min(0.95, Number(effects.drossEnemyFumbleChance || 0)));
  if (chance <= 0) {
    return {
      seed: Number(seed) >>> 0,
      success: false,
      chance: 0,
    };
  }
  const rng = randomUnit(seed, salt);
  return {
    seed: rng.seed,
    success: rng.value <= chance,
    chance,
  };
}

export function applyCradleConsumeLeech({
  hp,
  maxHp,
  madra,
  maxMadra,
  damageDealt,
  effects = {},
}) {
  const dealt = Math.max(0, Number(damageDealt) || 0);
  if (dealt <= 0) {
    return {
      hp: Math.max(0, Number(hp) || 0),
      madra: Math.max(0, Number(madra) || 0),
      gainedHp: 0,
      gainedMadra: 0,
    };
  }

  const lifeSteal = Math.max(0, Number(effects.consumeLifeStealRatio || 0));
  const madraSteal = Math.max(0, Number(effects.consumeMadraStealRatio || 0));
  const hpGain = lifeSteal > 0 ? Math.max(1, Math.round(dealt * lifeSteal)) : 0;
  const madraGainFromConsume = madraSteal > 0 ? Math.max(1, Math.round(dealt * madraSteal)) : 0;
  const madraGainFromTwinStars = Math.max(0, Number(effects.twinStarsCombatMadraOnHit || 0));
  const madraGain = madraGainFromConsume + madraGainFromTwinStars;
  const nextHp = Math.min(Math.max(1, Number(maxHp) || 1), Math.max(0, Number(hp) || 0) + hpGain);
  const nextMadra = Math.min(Math.max(1, Number(maxMadra) || 1), Math.max(0, Number(madra) || 0) + madraGain);
  return {
    hp: nextHp,
    madra: nextMadra,
    gainedHp: Math.max(0, nextHp - Math.max(0, Number(hp) || 0)),
    gainedMadra: Math.max(0, nextMadra - Math.max(0, Number(madra) || 0)),
  };
}

export function rollHollowDomainSuppression({
  seed,
  salt = 0,
  effects = {},
}) {
  const chance = Math.max(0, Math.min(0.95, Number(effects.hollowDomainSuppressChance || 0)));
  if (chance <= 0) {
    return {
      seed: Number(seed) >>> 0,
      success: false,
      chance: 0,
    };
  }
  const rng = randomUnit(seed, salt);
  return {
    seed: rng.seed,
    success: rng.value <= chance,
    chance,
  };
}

export function nextSeed(seed, salt = 0) {
  const base = Number.isFinite(seed) ? Number(seed) >>> 0 : 1;
  return (Math.imul(base, 1664525) + 1013904223 + (salt >>> 0)) >>> 0;
}

export function randomUnit(seed, salt = 0) {
  const next = nextSeed(seed, salt);
  return {
    seed: next,
    value: next / 4294967296,
  };
}

export function rollDamage({
  seed,
  salt = 0,
  base = 10,
  spread = 4,
  attackerStage = "foundation",
  defenderStage = "foundation",
}) {
  const rng = randomUnit(seed, salt);
  const variation = (rng.value * 2 - 1) * Math.abs(Number(spread) || 0);
  const raw = (Number(base) || 0) + variation;
  const scaled =
    raw *
    attackMultiplierForStage(attackerStage) *
    defenseMultiplierForStage(defenderStage);
  const damage = Math.max(1, Math.round(scaled));
  return {
    seed: rng.seed,
    damage,
  };
}
