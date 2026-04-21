const COMBAT_STAGES = Object.freeze(["foundation", "copper", "iron", "jade"]);

const DEFENSE_MULTIPLIER = Object.freeze({
  foundation: 1,
  copper: 0.78,
  iron: 0.62,
  jade: 0.48,
});

const ATTACK_MULTIPLIER = Object.freeze({
  foundation: 1,
  copper: 1.2,
  iron: 1.5,
  jade: 1.9,
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
