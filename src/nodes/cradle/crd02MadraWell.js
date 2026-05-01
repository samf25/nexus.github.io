import { escapeHtml } from "../../templates/shared.js";
import { renderArtifactSymbol } from "../../core/artifacts.js";
import { renderRegionSymbol } from "../../core/symbology.js";
import {
  CRD02_MANUAL_RHYTHM_PATTERNS,
  cycleLength,
  nearestPulse,
  normalizePatternIndex,
  patternByIndex,
  patternCadence,
  pulsePhaseDelaySeconds,
} from "./rhythmCore.js";
import { prestigeModifiersFromState } from "../../systems/prestige.js";
import { getCradleLootModifiers, lootInventoryFromState } from "../../systems/loot.js";
import { renderSlotRing } from "../../ui/slotRing.js";

const NODE_ID = "CRD02";
const REQUIRED_ARTIFACT = "Starter Core";
const MANUAL_STREAK_TARGET = 5;
const MANUAL_HIT_TOLERANCE_MS = 180;
const OFFLINE_CAP_SECONDS = 60 * 60 * 12;
const DEBUG_MADRA_STEP = 2500;
const MANUAL_PATTERNS = CRD02_MANUAL_RHYTHM_PATTERNS;
const BREAKTHROUGH_COSTS = Object.freeze({
  foundation: 200,
  copper: 1000,
  iron: 4500,
  jade: 12000,
  lowgold: 36000,
  highgold: 90000,
  truegold: 220000,
  underlord: 380000,
  overlord: 900000,
});
const IRON_BREAKTHROUGH_ARTIFACT = "Cultivation Potion";
const JADE_BREAKTHROUGH_ARTIFACT = "Jade Condensation Elixir";
const CULTIVATION_STAGES = Object.freeze(["foundation", "copper", "iron", "jade", "lowgold", "highgold", "truegold", "underlord", "overlord", "archlord"]);
const STAGE_LABELS = Object.freeze({
  foundation: "Foundation",
  copper: "Copper",
  iron: "Iron",
  jade: "Jade",
  lowgold: "Low Gold",
  highgold: "High Gold",
  truegold: "True Gold",
  underlord: "Underlord",
  overlord: "Overlord",
  archlord: "Archlord",
});
const STAGE_PASSIVE_MULTIPLIER = Object.freeze({
  foundation: 1,
  copper: 2,
  iron: 3.8,
  jade: 5.5,
  lowgold: 8.8,
  highgold: 13.5,
  truegold: 20,
  underlord: 30,
  overlord: 44,
  archlord: 62,
});
const STAGE_MANUAL_MULTIPLIER = Object.freeze({
  foundation: 1,
  copper: 1.8,
  iron: 3,
  jade: 4.2,
  lowgold: 6,
  highgold: 8.4,
  truegold: 12,
  underlord: 16,
  overlord: 22,
  archlord: 30,
});

const COMBAT_UPGRADES = Object.freeze([
  {
    id: "empty-palm",
    label: "The Empty Palm",
    baseCost: 100,
    maxLevel: 1,
    requires: [{ id: "manual-refinement", minLevel: 1 }],
  },
  {
    id: "blood-forged-iron-body",
    label: "Blood Forged Iron Body",
    baseCost: 500,
    maxLevel: 1,
    minStage: "iron",
    requires: [{ id: "empty-palm", minLevel: 1 }],
  },
  {
    id: "soul-cloak",
    label: "Soul Cloak",
    baseCost: 1000,
    maxLevel: 1,
    minStage: "iron",
    requires: [{ id: "blood-forged-iron-body", minLevel: 1 }],
  },
  {
    id: "dragon-breath",
    label: "Dragon's Breath",
    baseCost: 3200,
    maxLevel: 1,
    minStage: "copper",
    requires: [{ id: "soul-cloak", minLevel: 1 }],
  },
  {
    id: "consume",
    label: "Consume",
    baseCost: 10000,
    maxLevel: 1,
    minStage: "jade",
    requires: [{ id: "soul-cloak", minLevel: 1 }],
  },
  {
    id: "burning-cloak",
    label: "Burning Cloak",
    baseCost: 18000,
    maxLevel: 1,
    minStage: "jade",
    requires: [
      { id: "dragon-breath", minLevel: 1 },
      { id: "consume", minLevel: 1 },
    ],
  },
  {
    id: "hollow-domain",
    label: "Hollow Domain",
    baseCost: 100000,
    maxLevel: 1,
    minStage: "lowgold",
    requires: [{ id: "consume", minLevel: 1 }],
  },
  {
    id: "void-dragons-dance",
    label: "Void Dragon's Dance",
    baseCost: 240000,
    maxLevel: 1,
    minStage: "lowgold",
    requires: [
      { id: "burning-cloak", minLevel: 1 },
      { id: "spiral-confluence", minLevel: 1 },
    ],
  },
  {
    id: "heart-of-twin-stars-combat",
    label: "Heart of Twin Stars",
    baseCost: 1000000,
    maxLevel: 1,
    minStage: "lowgold",
    requires: [
      { id: "hollow-domain", minLevel: 1 },
      { id: "skyline-annulus", minLevel: 1 },
    ],
  },
  {
    id: "dross-battle-planning",
    label: "Dross Battle Planning",
    baseCost: 2200000,
    maxLevel: 1,
    minStage: "highgold",
    requires: [
      { id: "heart-of-twin-stars-combat", minLevel: 1 },
      { id: "void-dragons-dance", minLevel: 1 },
    ],
  },
]);

const WELL_UPGRADES = Object.freeze([
  {
    id: "manual-refinement",
    label: "Cycling Resonance",
    baseCost: 25,
    growth: 2.2,
    maxLevel: 4,
    repeatable: true,
    effect: "x2 manual madra per level",
    requires: [],
  },
  {
    id: "cycle-refinement",
    label: "Twin-Star Compression",
    baseCost: 180,
    growth: 2.4,
    maxLevel: 4,
    repeatable: true,
    effect: "Heart of Twin Stars base: +0.005 per level",
    requires: [
      { id: "manual-refinement", minLevel: 1 },
      { id: "empty-palm", minLevel: 1 },
    ],
  },
  {
    id: "well-reservoir",
    label: "Deep-Well Lining",
    baseCost: 650,
    growth: 2.8,
    maxLevel: 3,
    repeatable: true,
    effect: "+35% passive gain per level",
    requires: [
      { id: "manual-refinement", minLevel: 1 },
      { id: "blood-forged-iron-body", minLevel: 1 },
    ],
  },
  {
    id: "core-harmonization",
    label: "Core Harmonization",
    baseCost: 2200,
    growth: 1,
    maxLevel: 1,
    repeatable: false,
    effect: "+1 manual madra and branch unlock",
    requires: [
      { id: "soul-cloak", minLevel: 1 },
      { id: "cycle-refinement", minLevel: 2 },
    ],
  },
  {
    id: "spiral-confluence",
    label: "Spiral Confluence",
    baseCost: 8200,
    growth: 3.1,
    maxLevel: 3,
    repeatable: true,
    effect: "+25% passive gain and Heaven/Earth scale",
    minStage: "copper",
    requires: [
      { id: "core-harmonization", minLevel: 1 },
      { id: "consume", minLevel: 1 },
    ],
  },
  {
    id: "skyline-annulus",
    label: "Skyline Annulus",
    baseCost: 25000,
    growth: 1,
    maxLevel: 1,
    repeatable: false,
    effect: "Unlocks deeper well optimization",
    minStage: "copper",
    requires: [
      { id: "hollow-domain", minLevel: 1 },
      { id: "well-reservoir", minLevel: 2 },
      { id: "spiral-confluence", minLevel: 1 },
    ],
  },
  {
    id: "cycling-furnace",
    label: "Cycling Furnace",
    baseCost: 52000,
    growth: 2.5,
    maxLevel: 3,
    repeatable: true,
    effect: "+20% passive gain per level",
    minStage: "jade",
    requires: [
      { id: "spiral-confluence", minLevel: 1 },
      { id: "dragon-breath", minLevel: 1 },
    ],
  },
]);

const ALL_UPGRADES = Object.freeze([...COMBAT_UPGRADES, ...WELL_UPGRADES]);
const UPGRADE_BY_ID = Object.freeze(
  Object.fromEntries(ALL_UPGRADES.map((upgrade) => [upgrade.id, upgrade])),
);
const TECH_TREE_LAYOUT = Object.freeze([
  { id: "manual-refinement", col: 1, row: 2, shape: "circle" },
  { id: "empty-palm", col: 2, row: 1, shape: "diamond" },
  { id: "cycle-refinement", col: 2, row: 3, shape: "hex" },
  { id: "blood-forged-iron-body", col: 3, row: 1, shape: "diamond" },
  { id: "well-reservoir", col: 3, row: 3, shape: "triangle" },
  { id: "soul-cloak", col: 4, row: 1, shape: "diamond" },
  { id: "dragon-breath", col: 4, row: 4, shape: "diamond" },
  { id: "core-harmonization", col: 4, row: 2, shape: "hex" },
  { id: "consume", col: 5, row: 1, shape: "diamond" },
  { id: "spiral-confluence", col: 5, row: 3, shape: "triangle" },
  { id: "burning-cloak", col: 5, row: 4, shape: "diamond" },
  { id: "hollow-domain", col: 6, row: 1, shape: "diamond" },
  { id: "skyline-annulus", col: 6, row: 3, shape: "triangle" },
  { id: "cycling-furnace", col: 6, row: 4, shape: "triangle" },
  { id: "heart-of-twin-stars-combat", col: 7, row: 2, shape: "circle" },
  { id: "void-dragons-dance", col: 7, row: 4, shape: "diamond" },
  { id: "dross-battle-planning", col: 8, row: 3, shape: "hex" },
]);
const TECH_LAYOUT_BY_ID = Object.freeze(
  Object.fromEntries(TECH_TREE_LAYOUT.map((node) => [node.id, node])),
);
const TECH_GRID_COLS = Math.max(...TECH_TREE_LAYOUT.map((node) => Number(node.col) || 1), 1);
const TECH_GRID_ROWS = Math.max(...TECH_TREE_LAYOUT.map((node) => Number(node.row) || 1), 1);

function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function rewardMatches(name, expected) {
  return normalizeText(name) === normalizeText(expected);
}

function stageIndex(stageId) {
  return CULTIVATION_STAGES.indexOf(stageId);
}

function normalizeStage(stageId) {
  const candidate = normalizeText(stageId);
  return CULTIVATION_STAGES.includes(candidate) ? candidate : "foundation";
}

function stageLabel(stageId) {
  return STAGE_LABELS[stageId] || STAGE_LABELS.foundation;
}

function nowMs() {
  return Date.now();
}

function roundMadra(value) {
  return Number(Number(value || 0).toFixed(3));
}

function manualPatternByIndex(patternIndex) {
  return patternByIndex(MANUAL_PATTERNS, patternIndex);
}

function manualNearestPulse(manualRuntime, atMs) {
  const pattern = manualPatternByIndex(manualRuntime.patternIndex);
  return nearestPulse(pattern, manualRuntime.startedAt, atMs, MANUAL_HIT_TOLERANCE_MS);
}

function manualPulsePhaseDelaySeconds(manualRuntime, atMs = nowMs()) {
  const pattern = manualPatternByIndex(manualRuntime.patternIndex);
  return pulsePhaseDelaySeconds(pattern, manualRuntime.startedAt, atMs);
}

function emptyManualRuntime() {
  return {
    open: false,
    patternIndex: 0,
    startedAt: nowMs(),
    streak: 0,
    lastBeatOrdinal: -1,
    flashUntil: 0,
  };
}

function defaultUpgradeLevels() {
  return Object.fromEntries(ALL_UPGRADES.map((upgrade) => [upgrade.id, 0]));
}

function normalizeUpgradeLevels(candidate) {
  const base = defaultUpgradeLevels();
  const incoming = candidate && typeof candidate === "object" ? candidate : {};
  for (const [upgradeId, level] of Object.entries(incoming)) {
    if (!Object.prototype.hasOwnProperty.call(base, upgradeId)) {
      continue;
    }
    const upgrade = UPGRADE_BY_ID[upgradeId];
    const numeric = Math.max(0, Math.floor(Number(level) || 0));
    base[upgradeId] = Math.min(numeric, upgrade.maxLevel || numeric);
  }
  return base;
}

function normalizeRuntime(runtime) {
  const source = runtime && typeof runtime === "object" ? runtime : {};
  const tabCandidate = normalizeText(source.activeTab);
  const activeTab = tabCandidate === "soul" || tabCandidate === "combat" || tabCandidate === "soulfire" ? tabCandidate : "well";
  const manualSource = source.manual && typeof source.manual === "object" ? source.manual : {};
  const introPhase = source.introPhase === "well" || source.introPhase === "rejected" ? source.introPhase : "origin";
  const upgrades = normalizeUpgradeLevels(source.upgrades);
  const manual = {
    ...emptyManualRuntime(),
    ...manualSource,
    patternIndex: normalizePatternIndex(manualSource.patternIndex, MANUAL_PATTERNS.length - 1),
    startedAt: Number.isFinite(manualSource.startedAt) ? Number(manualSource.startedAt) : nowMs(),
    streak: Math.max(0, Number(manualSource.streak) || 0),
    lastBeatOrdinal: Number.isFinite(manualSource.lastBeatOrdinal) ? Number(manualSource.lastBeatOrdinal) : -1,
    flashUntil: Number.isFinite(manualSource.flashUntil) ? Number(manualSource.flashUntil) : 0,
  };

  return {
    activeTab,
    introPhase,
    starterCoreUsed: Boolean(source.starterCoreUsed),
    starterSeedGranted: Boolean(source.starterSeedGranted),
    wellUnlocked: Boolean(source.wellUnlocked) || introPhase === "well",
    cultivationStage: normalizeStage(source.cultivationStage),
    madra: roundMadra(source.madra),
    totalMadraGenerated: roundMadra(source.totalMadraGenerated),
    manualCompletions: Math.max(0, Number(source.manualCompletions) || 0),
    lastTickAt: Number.isFinite(source.lastTickAt) ? Number(source.lastTickAt) : nowMs(),
    cycling: {
      twinStarsLevel: Math.max(0, Math.floor(Number(source.cycling && source.cycling.twinStarsLevel) || 0)),
      heavenEarthLevel: Math.max(0, Math.floor(Number(source.cycling && source.cycling.heavenEarthLevel) || 0)),
    },
    upgrades,
    manual,
    techniquesOpen: Boolean(source.techniquesOpen) && Math.max(0, Number(source.manualCompletions) || 0) > 0,
    prestige: {
      madraGainMultiplier: Math.max(1, Number(source.prestige && source.prestige.madraGainMultiplier) || 1),
      cyclingCostDivider: Math.max(1, Number(source.prestige && source.prestige.cyclingCostDivider) || 1),
      combatAttackMultiplier: Math.max(1, Number(source.prestige && source.prestige.combatAttackMultiplier) || 1),
      soulfireGainMultiplier: Math.max(1, Number(source.prestige && source.prestige.soulfireGainMultiplier) || 1),
      soulfireCostDivider: Math.max(1, Number(source.prestige && source.prestige.soulfireCostDivider) || 1),
    },
    soulfire: {
      unlocked: Boolean(source.soulfire && source.soulfire.unlocked),
      amount: roundMadra(source.soulfire && source.soulfire.amount),
      totalGenerated: roundMadra(source.soulfire && source.soulfire.totalGenerated),
      madraCyclerLevel: Math.max(0, Math.floor(Number(source.soulfire && source.soulfire.madraCyclerLevel) || 0)),
      soulfireCyclerLevel: Math.max(0, Math.floor(Number(source.soulfire && source.soulfire.soulfireCyclerLevel) || 0)),
    },
    lastMessage: String(source.lastMessage || ""),
    solved: Boolean(source.solved),
  };
}

function levelOf(runtime, upgradeId) {
  return Number(runtime.upgrades[upgradeId] || 0);
}

function requirementsMet(runtime, requirements) {
  return (requirements || []).every((requirement) => levelOf(runtime, requirement.id) >= (requirement.minLevel || 1));
}

function upgradeCost(runtime, upgrade) {
  const currentLevel = levelOf(runtime, upgrade.id);
  if (currentLevel >= upgrade.maxLevel) {
    return null;
  }

  const growth = Number(upgrade.growth || 1);
  const cost = Number(upgrade.baseCost || 0) * Math.pow(growth, currentLevel);
  return Math.round(cost);
}

function manualMadraGain(runtime) {
  const resonanceLevel = levelOf(runtime, "manual-refinement");
  const harmonized = levelOf(runtime, "core-harmonization") > 0 ? 1 : 0;
  const base = Math.max(2, Math.pow(2, resonanceLevel + 1) + harmonized);
  const stageMultiplier = STAGE_MANUAL_MULTIPLIER[runtime.cultivationStage] || 1;
  const prestigeMultiplier = Math.max(1, Number(runtime.prestige && runtime.prestige.madraGainMultiplier) || 1);
  return Math.max(1, Math.round(base * stageMultiplier * prestigeMultiplier));
}

function heartOfTwinStarsBase(runtime) {
  return 1.01 + levelOf(runtime, "cycle-refinement") * 0.005;
}

function passiveMadraPerSecond(runtime) {
  const twinBase = heartOfTwinStarsBase(runtime);
  const twinRate = Math.pow(twinBase, runtime.cycling.twinStarsLevel) - 1;

  const confluence = levelOf(runtime, "spiral-confluence");
  const annulus = levelOf(runtime, "skyline-annulus");
  const heavenBase = 1.035 + confluence * 0.007 + annulus * 0.006;
  const heavenRate = (Math.pow(heavenBase, runtime.cycling.heavenEarthLevel) - 1) * 7;

  const reservoirMultiplier = 1 + levelOf(runtime, "well-reservoir") * 0.35;
  const confluenceMultiplier = 1 + confluence * 0.25;
  const annulusMultiplier = 1 + annulus * 0.15;
  const stageMultiplier = STAGE_PASSIVE_MULTIPLIER[runtime.cultivationStage] || 1;
  const prestigeMultiplier = Math.max(1, Number(runtime.prestige && runtime.prestige.madraGainMultiplier) || 1);

  return (
    (twinRate + heavenRate) *
    reservoirMultiplier *
    confluenceMultiplier *
    annulusMultiplier *
    stageMultiplier *
    prestigeMultiplier
  );
}

function twinStarsCost(level) {
  const baseCost = 10 + Math.max(0, Math.floor(Number(level) || 0)) * 10;
  return baseCost;
}

function heavenEarthCost(level) {
  const baseCost = 100 + Math.max(0, Math.floor(Number(level) || 0)) * 10;
  return baseCost;
}

function cyclingCostWithPrestige(baseCost, runtime) {
  const divider = Math.max(1, Number(runtime.prestige && runtime.prestige.cyclingCostDivider) || 1);
  return Math.max(1, Math.round(baseCost / divider));
}

function passiveSoulfirePerSecond(runtime) {
  if (stageIndex(runtime.cultivationStage) < stageIndex("underlord")) {
    return 0;
  }
  const madraCycler = Math.max(0, Number(runtime.soulfire && runtime.soulfire.madraCyclerLevel) || 0);
  const soulfireCycler = Math.max(0, Number(runtime.soulfire && runtime.soulfire.soulfireCyclerLevel) || 0);
  const base = 0.03;
  const madraRate = madraCycler * 0.015;
  const soulfireRate = soulfireCycler * 0.02;
  const underlordBoost = 1 + Math.max(0, stageIndex(runtime.cultivationStage) - stageIndex("underlord")) * 0.12;
  const prestigeMultiplier = Math.max(1, Number(runtime.prestige && runtime.prestige.soulfireGainMultiplier) || 1);
  return (base + madraRate + soulfireRate) * underlordBoost * prestigeMultiplier;
}

function applyPassiveTick(runtime, now) {
  if (!runtime.wellUnlocked) {
    return runtime;
  }

  const elapsedMs = Math.max(0, now - runtime.lastTickAt);
  if (elapsedMs < 1000) {
    if (runtime.lastTickAt === now) {
      return runtime;
    }
    return {
      ...runtime,
      lastTickAt: now,
    };
  }

  const elapsedSeconds = Math.min(OFFLINE_CAP_SECONDS, elapsedMs / 1000);
  const mps = passiveMadraPerSecond(runtime);
  const produced = mps * elapsedSeconds;
  const sps = passiveSoulfirePerSecond(runtime);
  const soulfireProduced = sps * elapsedSeconds;
  if (produced <= 0 && soulfireProduced <= 0) {
    return {
      ...runtime,
      lastTickAt: now,
    };
  }

  return {
    ...runtime,
    madra: roundMadra(runtime.madra + produced),
    totalMadraGenerated: roundMadra(runtime.totalMadraGenerated + produced),
    soulfire: {
      ...(runtime.soulfire || {}),
      unlocked: stageIndex(runtime.cultivationStage) >= stageIndex("underlord") || Boolean(runtime.soulfire && runtime.soulfire.unlocked),
      amount: roundMadra((runtime.soulfire && runtime.soulfire.amount) + soulfireProduced),
      totalGenerated: roundMadra((runtime.soulfire && runtime.soulfire.totalGenerated) + soulfireProduced),
      madraCyclerLevel: Math.max(0, Number(runtime.soulfire && runtime.soulfire.madraCyclerLevel) || 0),
      soulfireCyclerLevel: Math.max(0, Number(runtime.soulfire && runtime.soulfire.soulfireCyclerLevel) || 0),
    },
    lastTickAt: now,
  };
}

function randomPatternIndex(seed) {
  const numeric = Math.abs(Math.floor(Number(seed) || 0));
  return numeric % MANUAL_PATTERNS.length;
}

function patternName(index) {
  return manualPatternByIndex(index).label || "Unknown Rhythm";
}

function patternLabel(index) {
  return patternCadence(manualPatternByIndex(index));
}

function solveState(runtime) {
  return runtime.wellUnlocked;
}

function upgradeVisible(runtime, upgrade) {
  const minimumStage = normalizeStage(upgrade.minStage || "foundation");
  if (stageIndex(runtime.cultivationStage) < stageIndex(minimumStage)) {
    return false;
  }

  const level = levelOf(runtime, upgrade.id);
  if (level > 0) {
    return true;
  }

  const nextCost = upgradeCost(runtime, upgrade);
  if (nextCost == null) {
    return false;
  }

  const prereqsReady = requirementsMet(runtime, upgrade.requires);
  if (!prereqsReady && level === 0) {
    return false;
  }
  return level > 0 || runtime.madra >= nextCost / 100;
}

export function initialCrd02Runtime(context = {}) {
  const solvedIds = new Set(
    context && context.state && Array.isArray(context.state.solvedNodeIds)
      ? context.state.solvedNodeIds
      : [],
  );
  const seedFromCrd01 = solvedIds.has("CRD01");
  const startingMadra = seedFromCrd01 ? 5 : 0;
  const now = nowMs();
  return {
    introPhase: "origin",
    starterCoreUsed: false,
    starterSeedGranted: seedFromCrd01,
    wellUnlocked: false,
    cultivationStage: "foundation",
    madra: startingMadra,
    totalMadraGenerated: startingMadra,
    manualCompletions: seedFromCrd01 ? 1 : 0,
    lastTickAt: now,
    cycling: {
      twinStarsLevel: 0,
      heavenEarthLevel: 0,
    },
    upgrades: defaultUpgradeLevels(),
    manual: emptyManualRuntime(),
    techniquesOpen: false,
    activeTab: "well",
    soulfire: {
      unlocked: false,
      amount: 0,
      totalGenerated: 0,
      madraCyclerLevel: 0,
      soulfireCyclerLevel: 0,
    },
    lastMessage: "",
    solved: false,
  };
}

export function synchronizeCrd02Runtime(runtime, { now = nowMs(), state = null } = {}) {
  let current = normalizeRuntime(runtime);
  const modifiers = prestigeModifiersFromState(state || {});
  const lootModifiers = getCradleLootModifiers(state || {}, now);
  current = {
    ...current,
    prestige: {
      madraGainMultiplier: Math.max(
        1,
        Number(modifiers.cradle && modifiers.cradle.madraGainMultiplier ? modifiers.cradle.madraGainMultiplier : 1)
          * Number(lootModifiers.madraGainMultiplier || 1),
      ),
      cyclingCostDivider: Math.max(
        1,
        Number(modifiers.cradle && modifiers.cradle.cyclingCostDivider ? modifiers.cradle.cyclingCostDivider : 1)
          * Number(lootModifiers.cyclingCostDivider || 1),
      ),
      combatAttackMultiplier: Math.max(
        1,
        Number(modifiers.cradle && modifiers.cradle.combatAttackMultiplier ? modifiers.cradle.combatAttackMultiplier : 1)
          * Number(lootModifiers.combatAttackMultiplier || 1),
      ),
      soulfireGainMultiplier: Math.max(
        1,
        Number(modifiers.cradle && modifiers.cradle.soulfireGainMultiplier ? modifiers.cradle.soulfireGainMultiplier : 1),
      ),
      soulfireCostDivider: Math.max(
        1,
        Number(modifiers.cradle && modifiers.cradle.soulfireCostDivider ? modifiers.cradle.soulfireCostDivider : 1),
      ),
    },
  };
  const solvedIds = new Set(state && Array.isArray(state.solvedNodeIds) ? state.solvedNodeIds : []);

  if (!current.starterSeedGranted && solvedIds.has("CRD01")) {
    const seededMadra = Math.max(current.madra, 5);
    current = {
      ...current,
      starterSeedGranted: true,
      madra: seededMadra,
      totalMadraGenerated: Math.max(current.totalMadraGenerated, seededMadra),
      manualCompletions: Math.max(current.manualCompletions, 1),
      lastMessage: current.lastMessage || "Starter core residue grants +5 madra.",
    };
  }

  const ticked = applyPassiveTick(current, Number(now) || nowMs());
  const soulfireUnlocked = stageIndex(ticked.cultivationStage) >= stageIndex("underlord");
  const afterUnlock = soulfireUnlocked && !ticked.soulfire.unlocked
    ? {
      ...ticked,
      soulfire: {
        ...ticked.soulfire,
        unlocked: true,
      },
    }
    : ticked;
  const solved = solveState(afterUnlock);
  if (afterUnlock.solved === solved) {
    return afterUnlock;
  }
  return {
    ...afterUnlock,
    solved,
  };
}

export function validateCrd02Runtime(runtime) {
  return solveState(normalizeRuntime(runtime));
}

export function reduceCrd02Runtime(runtime, action) {
  const now = Number(action && action.at) || nowMs();
  let current = synchronizeCrd02Runtime(runtime, { now });

  if (!action || typeof action !== "object") {
    return current;
  }

  if (action.type === "crd02-open-tab") {
    const nextTab = normalizeText(action.tab);
    return {
      ...current,
      activeTab: nextTab === "soul" || nextTab === "combat" || nextTab === "soulfire" ? nextTab : "well",
    };
  }

  if (action.type === "crd02-origin-test") {
    if (!rewardMatches(action.artifact, REQUIRED_ARTIFACT)) {
      return {
        ...current,
        lastMessage: "The bowl remains still. You need the Starter Core artifact selected.",
      };
    }

    return {
      ...current,
      starterCoreUsed: true,
      introPhase: "rejected",
      lastMessage: "No reaction. The elders declare you Unsouled.",
    };
  }

  if (action.type === "crd02-enter-well") {
    return {
      ...current,
      introPhase: "well",
      wellUnlocked: true,
      lastTickAt: now,
      lastMessage: "You find a hidden well exuding aura. Cultivation begins.",
      solved: solveState({
        ...current,
        introPhase: "well",
        wellUnlocked: true,
      }),
    };
  }

  if (!current.wellUnlocked) {
    return current;
  }

  if (action.type === "crd02-open-manual") {
    const patternIndex = randomPatternIndex(action.seed || now);
    return {
      ...current,
      manual: {
        open: true,
        patternIndex,
        startedAt: now,
        streak: 0,
        lastBeatOrdinal: -1,
        flashUntil: 0,
      },
      techniquesOpen: false,
      lastMessage: "",
    };
  }

  if (action.type === "crd02-open-techniques") {
    if (current.manualCompletions <= 0) {
      return current;
    }
    return {
      ...current,
      techniquesOpen: true,
    };
  }

  if (action.type === "crd02-close-manual") {
    return {
      ...current,
      manual: {
        ...current.manual,
        open: false,
      },
    };
  }

  if (action.type === "crd02-close-techniques") {
    if (!current.techniquesOpen) {
      return current;
    }
    return {
      ...current,
      techniquesOpen: false,
    };
  }

  if (action.type === "crd02-debug-madra") {
    const gain = Math.max(1, Number(action.amount) || DEBUG_MADRA_STEP);
    return {
      ...current,
      madra: roundMadra(current.madra + gain),
      lastMessage: `Debug gain: +${Math.round(gain)} madra.`,
    };
  }

  if (action.type === "crd02-breakthrough") {
    const stage = normalizeStage(current.cultivationStage);
    if (stage === "foundation") {
      if (current.madra < BREAKTHROUGH_COSTS.foundation) {
        return {
          ...current,
          lastMessage: `You need ${BREAKTHROUGH_COSTS.foundation} madra to break through to Copper.`,
        };
      }
      return {
        ...current,
        cultivationStage: "copper",
        madra: 0,
        lastMessage: "Breakthrough complete. You are now Copper.",
      };
    }

    if (stage === "copper") {
      if (current.madra < BREAKTHROUGH_COSTS.copper) {
        return {
          ...current,
          lastMessage: `You need ${BREAKTHROUGH_COSTS.copper} madra to break through to Iron.`,
        };
      }

      if (!rewardMatches(action.artifact, IRON_BREAKTHROUGH_ARTIFACT)) {
        return {
          ...current,
          lastMessage: "Iron breakthrough requires the Cultivation Potion artifact.",
        };
      }

      const next = {
        ...current,
        cultivationStage: "iron",
        madra: 0,
        lastMessage: "Your core condenses into Iron.",
      };
      return {
        ...next,
        solved: solveState(next),
      };
    }

    if (stage === "iron") {
      if (current.madra < BREAKTHROUGH_COSTS.iron) {
        return {
          ...current,
          lastMessage: `You need ${BREAKTHROUGH_COSTS.iron} madra to break through to Jade.`,
        };
      }
      if (!rewardMatches(action.artifact, JADE_BREAKTHROUGH_ARTIFACT)) {
        return {
          ...current,
          lastMessage: "Jade breakthrough requires the Jade Condensation Elixir artifact.",
        };
      }
      return {
        ...current,
        cultivationStage: "jade",
        madra: 0,
        lastMessage: "Jade stage achieved. Your channels harden with living aura.",
      };
    }

    if (stage === "jade") {
      if (current.madra < BREAKTHROUGH_COSTS.jade) {
        return {
          ...current,
          lastMessage: `You need ${BREAKTHROUGH_COSTS.jade} madra to advance to Low Gold.`,
        };
      }
      return {
        ...current,
        cultivationStage: "lowgold",
        madra: 0,
        lastMessage: "Low Gold reached.",
      };
    }

    if (stage === "lowgold") {
      if (current.madra < BREAKTHROUGH_COSTS.lowgold) {
        return {
          ...current,
          lastMessage: `You need ${BREAKTHROUGH_COSTS.lowgold} madra to advance to High Gold.`,
        };
      }
      return {
        ...current,
        cultivationStage: "highgold",
        madra: 0,
        lastMessage: "High Gold reached.",
      };
    }

    if (stage === "highgold") {
      if (current.madra < BREAKTHROUGH_COSTS.highgold) {
        return {
          ...current,
          lastMessage: `You need ${BREAKTHROUGH_COSTS.highgold} madra to advance to True Gold.`,
        };
      }
      return {
        ...current,
        cultivationStage: "truegold",
        madra: 0,
        lastMessage: "True Gold reached.",
      };
    }

    return {
      ...current,
      lastMessage: "You have reached the current stage cap.",
    };
  }

  if (action.type === "crd02-manual-tap") {
    if (!current.manual.open) {
      return current;
    }

    const nearest = manualNearestPulse(current.manual, now);
    if (nearest.beatOrdinal === current.manual.lastBeatOrdinal) {
      return current;
    }

    if (!nearest.onBeat) {
      if (current.manual.streak === 0) {
        return current;
      }
      return {
        ...current,
        manual: {
          ...current.manual,
          streak: 0,
        },
      };
    }

    const streak = current.manual.streak + 1;
    if (streak >= MANUAL_STREAK_TARGET) {
      const gain = manualMadraGain(current);
      const nextManualCompletions = current.manualCompletions + 1;
      const next = {
        ...current,
        madra: roundMadra(current.madra + gain),
        totalMadraGenerated: roundMadra(current.totalMadraGenerated + gain),
        manualCompletions: nextManualCompletions,
        manual: {
          ...current.manual,
          open: false,
          streak: 0,
          lastBeatOrdinal: -1,
          flashUntil: now + 260,
        },
        lastMessage: `Manual cycle complete. +${gain} madra.`,
      };
      return {
        ...next,
        solved: solveState(next),
      };
    }

    return {
      ...current,
      manual: {
        ...current.manual,
        streak,
        lastBeatOrdinal: nearest.beatOrdinal,
        flashUntil: now + 240,
      },
    };
  }

  if (action.type === "crd02-buy-cycling") {
    const techniqueId = String(action.techniqueId || "");
    if (techniqueId !== "twin-stars" && techniqueId !== "heaven-earth-wheel") {
      return current;
    }

    const crd06Solved = Boolean(action.crd06Solved);
    if (techniqueId === "heaven-earth-wheel" && !crd06Solved) {
      return {
        ...current,
        lastMessage: "The Heaven and Earth Purification Wheel is locked until CRD06.",
      };
    }

    const level =
      techniqueId === "twin-stars" ? current.cycling.twinStarsLevel : current.cycling.heavenEarthLevel;
    const baseCost = techniqueId === "twin-stars" ? twinStarsCost(level) : heavenEarthCost(level);
    const cost = cyclingCostWithPrestige(baseCost, current);
    if (current.madra < cost) {
      return current;
    }

    const next = {
      ...current,
      madra: roundMadra(current.madra - cost),
      cycling: {
        ...current.cycling,
        twinStarsLevel:
          techniqueId === "twin-stars" ? current.cycling.twinStarsLevel + 1 : current.cycling.twinStarsLevel,
        heavenEarthLevel:
          techniqueId === "heaven-earth-wheel"
            ? current.cycling.heavenEarthLevel + 1
            : current.cycling.heavenEarthLevel,
      },
      lastMessage:
        techniqueId === "twin-stars"
          ? "Heart of Twin Stars deepens."
          : "Heaven and Earth Purification Wheel begins to turn.",
    };
    return {
      ...next,
      solved: solveState(next),
    };
  }

  if (action.type === "crd02-buy-upgrade") {
    const upgradeId = String(action.upgradeId || "");
    const upgrade = UPGRADE_BY_ID[upgradeId];
    if (!upgrade) {
      return current;
    }

    const minimumStage = normalizeStage(upgrade.minStage || "foundation");
    if (stageIndex(current.cultivationStage) < stageIndex(minimumStage)) {
      return current;
    }

    if (!requirementsMet(current, upgrade.requires)) {
      return current;
    }

    const cost = upgradeCost(current, upgrade);
    if (cost == null || current.madra < cost) {
      return current;
    }

    const currentLevel = levelOf(current, upgrade.id);
    const nextLevel = Math.min(currentLevel + 1, upgrade.maxLevel);
    const next = {
      ...current,
      madra: roundMadra(current.madra - cost),
      upgrades: {
        ...current.upgrades,
        [upgrade.id]: nextLevel,
      },
      lastMessage: `${upgrade.label} advanced.`,
    };
    return {
      ...next,
      solved: solveState(next),
    };
  }

  if (action.type === "crd02-buy-soulfire-upgrade") {
    if (stageIndex(current.cultivationStage) < stageIndex("underlord")) {
      return current;
    }
    const upgradeId = String(action.upgradeId || "");
    if (upgradeId === "madra-cycler") {
      const level = Math.max(0, Number(current.soulfire && current.soulfire.madraCyclerLevel) || 0);
      const divider = Math.max(1, Number(current.prestige && current.prestige.soulfireCostDivider) || 1);
      const cost = Math.max(1, Math.round((9000 * Math.pow(2.1, level)) / divider));
      if (current.madra < cost) {
        return current;
      }
      return {
        ...current,
        madra: roundMadra(current.madra - cost),
        soulfire: {
          ...current.soulfire,
          unlocked: true,
          madraCyclerLevel: level + 1,
        },
      };
    }
    if (upgradeId === "soulfire-cycler") {
      const level = Math.max(0, Number(current.soulfire && current.soulfire.soulfireCyclerLevel) || 0);
      const divider = Math.max(1, Number(current.prestige && current.prestige.soulfireCostDivider) || 1);
      const cost = roundMadra((6 * Math.pow(2.5, level)) / divider);
      const currentSoulfire = Math.max(0, Number(current.soulfire && current.soulfire.amount) || 0);
      if (currentSoulfire < cost) {
        return current;
      }
      return {
        ...current,
        soulfire: {
          ...current.soulfire,
          unlocked: true,
          amount: roundMadra(currentSoulfire - cost),
          soulfireCyclerLevel: level + 1,
        },
      };
    }
    return current;
  }

  if (action.type === "crd02-set-underlord") {
    if (stageIndex(current.cultivationStage) >= stageIndex("underlord")) {
      return current;
    }
    return {
      ...current,
      cultivationStage: "underlord",
      soulfire: {
        ...current.soulfire,
        unlocked: true,
      },
      lastMessage: "Underlord stage achieved.",
    };
  }

  if (action.type === "crd02-loot-message") {
    return {
      ...current,
      lastMessage: String(action.message || "Loot loadout updated."),
    };
  }

  return current;
}

export function buildCrd02ActionFromElement(element) {
  const actionName = element.getAttribute("data-node-action");
  if (!actionName) {
    return null;
  }

  if (actionName === "crd02-origin-test") {
    return {
      type: "crd02-origin-test",
      artifact: element.getAttribute("data-selected-artifact") || "",
      at: nowMs(),
    };
  }

  if (actionName === "crd02-open-tab") {
    return {
      type: "crd02-open-tab",
      tab: element.getAttribute("data-tab") || "well",
      at: nowMs(),
    };
  }

  if (actionName === "crd02-enter-well") {
    return {
      type: "crd02-enter-well",
      at: nowMs(),
    };
  }

  if (actionName === "crd02-open-manual") {
    return {
      type: "crd02-open-manual",
      seed: nowMs(),
      at: nowMs(),
    };
  }

  if (actionName === "crd02-open-techniques") {
    return {
      type: "crd02-open-techniques",
      at: nowMs(),
    };
  }

  if (actionName === "crd02-close-manual") {
    return {
      type: "crd02-close-manual",
      at: nowMs(),
    };
  }

  if (actionName === "crd02-close-techniques") {
    return {
      type: "crd02-close-techniques",
      at: nowMs(),
    };
  }

  if (actionName === "crd02-debug-madra") {
    return {
      type: "crd02-debug-madra",
      amount: Number(element.getAttribute("data-debug-amount")) || DEBUG_MADRA_STEP,
      at: nowMs(),
    };
  }

  if (actionName === "crd02-breakthrough") {
    return {
      type: "crd02-breakthrough",
      artifact: element.getAttribute("data-selected-artifact") || "",
      ready: element.getAttribute("data-breakthrough-ready") === "true",
      at: nowMs(),
    };
  }

  if (actionName === "crd02-buy-cycling") {
    return {
      type: "crd02-buy-cycling",
      techniqueId: element.getAttribute("data-technique-id"),
      crd06Solved: element.getAttribute("data-crd06-solved") === "true",
      at: nowMs(),
    };
  }

  if (actionName === "crd02-buy-upgrade") {
    return {
      type: "crd02-buy-upgrade",
      upgradeId: element.getAttribute("data-upgrade-id"),
      at: nowMs(),
    };
  }

  if (actionName === "crd02-buy-soulfire-upgrade") {
    return {
      type: "crd02-buy-soulfire-upgrade",
      upgradeId: element.getAttribute("data-upgrade-id"),
      at: nowMs(),
    };
  }

  if (actionName === "crd02-equip-soul-slot") {
    return {
      type: "crd02-equip-soul-slot",
      itemId: element.getAttribute("data-item-id") || "",
      slotId: Number(element.getAttribute("data-slot-id") || 0),
      at: nowMs(),
    };
  }

  if (actionName === "crd02-unequip-soul-slot") {
    return {
      type: "crd02-unequip-soul-slot",
      slotId: Number(element.getAttribute("data-slot-id") || 0),
      at: nowMs(),
    };
  }

  if (actionName === "crd02-equip-combat-item") {
    return {
      type: "crd02-equip-combat-item",
      itemId: element.getAttribute("data-item-id") || "",
      at: nowMs(),
    };
  }

  if (actionName === "crd02-unequip-combat-item") {
    return {
      type: "crd02-unequip-combat-item",
      at: nowMs(),
    };
  }

  return null;
}

export function buildCrd02KeyAction(event, runtime) {
  if (event.metaKey || event.ctrlKey || event.altKey) {
    return null;
  }

  const current = normalizeRuntime(runtime);
  if (!current.manual.open && !current.techniquesOpen) {
    return null;
  }

  if (event.code === "Escape") {
    if (current.manual.open) {
      return {
        type: "crd02-close-manual",
        at: nowMs(),
      };
    }

    return {
      type: "crd02-close-techniques",
      at: nowMs(),
    };
  }

  if (!current.manual.open) {
    return null;
  }

  if (event.repeat) {
    return null;
  }

  if (event.code === "Space" || event.key === " ") {
    return {
      type: "crd02-manual-tap",
      at: nowMs(),
    };
  }

  return null;
}

function upgradeViewState(runtime, upgrade) {
  const level = levelOf(runtime, upgrade.id);
  const cost = upgradeCost(runtime, upgrade);
  const maxed = cost == null;
  const prereqsMet = requirementsMet(runtime, upgrade.requires);
  const acquired = level > 0;
  const canBuy = !maxed && prereqsMet && runtime.madra >= cost;
  const visible = upgradeVisible(runtime, upgrade);

  if (!visible) {
    return {
      level,
      cost,
      maxed,
      acquired,
      prereqsMet,
      canBuy,
      visible: false,
    };
  }

  return {
    level,
    cost,
    maxed,
    acquired,
    prereqsMet,
    canBuy,
    visible: true,
  };
}

function upgradeRequirementText(runtime, upgrade) {
  const requirements = upgrade.requires || [];
  if (!requirements.length) {
    return "Prereq: None";
  }

  return `Prereq: ${requirements
    .map((requirement) => {
      const reqUpgrade = UPGRADE_BY_ID[requirement.id];
      const label = reqUpgrade ? reqUpgrade.label : requirement.id;
      const needed = requirement.minLevel || 1;
      const met = levelOf(runtime, requirement.id) >= needed;
      return `${met ? "[x]" : "[ ]"} ${label} L${needed}`;
    })
    .join(" | ")}`;
}

function layoutCenter(layoutNode) {
  return {
    x: ((layoutNode.col - 0.5) / TECH_GRID_COLS) * 100,
    y: ((layoutNode.row - 0.5) / TECH_GRID_ROWS) * 100,
  };
}

function techLinksMarkup(viewById) {
  const lines = [];
  for (const node of TECH_TREE_LAYOUT) {
    const targetView = viewById[node.id];
    if (!targetView || !targetView.visible) {
      continue;
    }
    const targetUpgrade = UPGRADE_BY_ID[node.id];
    const requirements = targetUpgrade && Array.isArray(targetUpgrade.requires) ? targetUpgrade.requires : [];
    for (const requirement of requirements) {
      const sourceLayout = TECH_LAYOUT_BY_ID[requirement.id];
      const sourceView = viewById[requirement.id];
      if (!sourceLayout || !sourceView || !sourceView.visible) {
        continue;
      }

      const from = layoutCenter(sourceLayout);
      const to = layoutCenter(node);
      lines.push(
        `<line x1="${from.x.toFixed(2)}%" y1="${from.y.toFixed(2)}%" x2="${to.x.toFixed(2)}%" y2="${to.y.toFixed(2)}%"></line>`,
      );
    }
  }
  return lines.join("");
}

function upgradeNodeMarkup(runtime, layoutNode, view) {
  const upgrade = UPGRADE_BY_ID[layoutNode.id];
  if (!upgrade) {
    return "";
  }

  if (!view.visible) {
    return `<span class="crd02-tech-node is-hidden" style="grid-column:${layoutNode.col};grid-row:${layoutNode.row};" aria-hidden="true"></span>`;
  }

  const levelLabel = upgrade.maxLevel ? `${view.level}/${upgrade.maxLevel}` : String(view.level);
  const minimumStage = normalizeStage(upgrade.minStage || "foundation");
  const detailLines = [
    upgrade.label,
    `Cost: ${view.maxed ? "MAX" : view.cost}`,
    `Level: ${levelLabel}`,
    `Stage: ${stageLabel(minimumStage)}+`,
    upgrade.effect || "",
    upgradeRequirementText(runtime, upgrade),
  ]
    .filter(Boolean)
    .join("\n");

  return `
    <button
      type="button"
      class="crd02-tech-node is-shape-${escapeHtml(layoutNode.shape || "hex")} ${view.canBuy ? "is-buyable" : "is-locked"} ${view.maxed ? "is-maxed" : ""} ${view.acquired ? "is-acquired" : ""}"
      data-node-id="${NODE_ID}"
      data-node-action="crd02-buy-upgrade"
      data-upgrade-id="${escapeHtml(upgrade.id)}"
      data-tooltip="${escapeHtml(detailLines)}"
      style="grid-column:${layoutNode.col};grid-row:${layoutNode.row};"
    >
      <span class="sr-only">${escapeHtml(upgrade.label)} level ${escapeHtml(levelLabel)}</span>
      <span class="crd02-tech-core" aria-hidden="true"></span>
    </button>
  `;
}

function techniquesModalMarkup(runtime) {
  if (!runtime.techniquesOpen) {
    return "";
  }

  const viewById = Object.fromEntries(
    TECH_TREE_LAYOUT.map((node) => [node.id, upgradeViewState(runtime, UPGRADE_BY_ID[node.id])]),
  );

  return `
    <div class="crd02-tech-modal" role="dialog" aria-label="Techniques">
      <section class="crd02-tech-surface">
        <header>
          <h3>Techniques</h3>
          <button type="button" class="ghost" data-node-id="${NODE_ID}" data-node-action="crd02-close-techniques">Close</button>
        </header>
        <div class="crd02-tech-tree">
          <svg class="crd02-tech-links" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            ${techLinksMarkup(viewById)}
          </svg>
          <div
            class="crd02-tech-constellation"
            style="--tech-cols:${TECH_GRID_COLS}; --tech-rows:${TECH_GRID_ROWS}; --tech-grid-width:${Math.max(
              720,
              TECH_GRID_COLS * 116,
            )}px;"
          >
            ${TECH_TREE_LAYOUT.map((layoutNode) => upgradeNodeMarkup(runtime, layoutNode, viewById[layoutNode.id])).join("")}
          </div>
        </div>
      </section>
    </div>
  `;
}

function manualModalMarkup(runtime, manualReward) {
  if (!runtime.manual.open) {
    return "";
  }

  const pattern = manualPatternByIndex(runtime.manual.patternIndex);
  const cycleSeconds = cycleLength(pattern);
  const flash = nowMs() < runtime.manual.flashUntil;
  const pulseClass = `is-pattern-${Math.max(0, Number(pattern.visualId) || 0)}`;
  const phaseDelay = manualPulsePhaseDelaySeconds(runtime.manual);
  return `
    <div class="crd02-manual-modal" role="dialog" aria-label="Manual Cultivation">
      <section class="crd02-manual-surface">
        <header>
          <h3>Manual Cultivation (${escapeHtml(String(manualReward))} Madra)</h3>
          <button type="button" class="ghost" data-node-id="${NODE_ID}" data-node-action="crd02-close-manual">Close</button>
        </header>
        <div
          class="crd02-manual-core ${escapeHtml(pulseClass)}"
          style="--manual-cycle-seconds: ${escapeHtml(cycleSeconds.toFixed(3))}s; animation-delay: ${escapeHtml(phaseDelay.toFixed(3))}s;"
          aria-hidden="true"
        >
          <span class="crd01-stream stream-a"></span>
          <span class="crd01-stream stream-b"></span>
          <span class="crd01-stream stream-c"></span>
          ${flash ? `<span class="crd01-hit-flash"></span>` : ""}
          <span class="crd01-core-shell"></span>
        </div>
        <p><strong>Pattern:</strong> ${escapeHtml(patternName(runtime.manual.patternIndex))}</p>
        <p><strong>Cadence:</strong> ${escapeHtml(patternLabel(runtime.manual.patternIndex))}</p>
        <p><strong>Streak:</strong> ${escapeHtml(String(runtime.manual.streak))}/${MANUAL_STREAK_TARGET}</p>
      </section>
    </div>
  `;
}

function visibleRuntimeMessage(message) {
  const text = String(message || "").trim();
  if (!text) {
    return "";
  }
  if (text === "You find a hidden well exuding aura. Cultivation begins.") {
    return "";
  }
  return text;
}

function soulCircuitMarkup({
  unlockedSoulSlots,
  soulSlotIds,
  lootState,
  selectedLootItemId,
  soulCrystals,
} = {}) {
  const slotCount = Math.min(6, Math.max(0, Number(unlockedSoulSlots) || 0));
  const slots = Array.from({ length: slotCount }, (_, index) => {
    const equippedId = soulSlotIds[index];
    const equippedItem = equippedId ? lootState.items[equippedId] : null;
    const selectedLoot = selectedLootItemId ? lootState.items[selectedLootItemId] : null;
    const clickToEquip = Boolean(selectedLoot);
    const clickToUnequip = Boolean(equippedItem) && !clickToEquip;

    return {
      filled: Boolean(equippedItem),
      clickable: clickToEquip || clickToUnequip,
      title: equippedItem
        ? `${equippedItem.label} (${equippedItem.rarity || "common"})`
        : "Empty soul crystal socket",
      ariaLabel: `Soul slot ${index + 1}`,
      symbolHtml: equippedItem
        ? renderArtifactSymbol({
            artifactName: equippedItem.label,
            className: "slot-ring-symbol artifact-symbol",
          })
        : "",
      attrs: clickToEquip
        ? {
            "data-action": "loot-equip-target",
            "data-region": "crd",
            "data-slot-id": index,
          }
        : clickToUnequip
          ? {
              "data-node-id": NODE_ID,
              "data-node-action": "crd02-unequip-soul-slot",
              "data-slot-id": index,
            }
          : {},
    };
  });

  return `
    <section class="crd02-panel">
      <h4>Soul Crystal Circuit (${slotCount}/6)</h4>
      ${renderSlotRing({
        slots,
        className: "crd02-soul-slot-ring",
        radiusPct: 42,
        centerHtml: renderRegionSymbol({
          section: "Cradle",
          className: "slot-ring-center-symbol",
        }),
        ariaLabel: "Cradle soul crystal circuit",
      })}
      <p><strong>Available Soul Crystals:</strong> ${soulCrystals.length}</p>
      <div class="toolbar">
        <button type="button" data-action="toggle-widget" data-widget="loot">Open Loot Panel</button>
      </div>
    </section>
  `;
}

function combatLoadoutMarkup({ lootState, selectedLootItemId, equippedCombatId, combatRelics }) {
  const selectedLoot = selectedLootItemId ? lootState.items[selectedLootItemId] : null;
  const equippedItem = equippedCombatId ? lootState.items[equippedCombatId] : null;
  const clickToEquip = Boolean(selectedLoot);
  const clickToUnequip = Boolean(equippedItem) && !clickToEquip;
  const slots = [
    {
      filled: Boolean(equippedItem),
      clickable: clickToEquip || clickToUnequip,
      title: equippedItem ? `${equippedItem.label} (${equippedItem.rarity || "common"})` : "Empty combat gear slot",
      ariaLabel: "Combat gear slot",
      symbolHtml: equippedItem
        ? renderArtifactSymbol({
            artifactName: equippedItem.label,
            className: "slot-ring-symbol artifact-symbol",
          })
        : "",
      attrs: clickToEquip
        ? {
            "data-action": "loot-equip-target",
            "data-region": "crd",
            "data-slot-id": "-1",
          }
        : clickToUnequip
          ? {
              "data-node-id": NODE_ID,
              "data-node-action": "crd02-unequip-combat-item",
            }
          : {},
    },
  ];

  return `
    <section class="crd02-panel">
      <h4>Combat Gear</h4>
      ${renderSlotRing({
        slots,
        className: "crd02-combat-slot-ring",
        radiusPct: 41,
        ariaLabel: "Cradle combat gear slot",
      })}
      <p><strong>Available Combat Relics:</strong> ${combatRelics.length}</p>
      <div class="toolbar">
        <button type="button" data-action="toggle-widget" data-widget="loot">Open Loot Panel</button>
      </div>
    </section>
  `;
}

export function renderCrd02Experience(context) {
  const runtime = synchronizeCrd02Runtime(context.runtime, {
    now: nowMs(),
    state: context && context.state ? context.state : null,
  });
  const solvedIds = new Set(context.state && context.state.solvedNodeIds ? context.state.solvedNodeIds : []);
  const crd06Solved = solvedIds.has("CRD06");
  const mps = passiveMadraPerSecond(runtime);
  const canSeeMenus = runtime.manualCompletions > 0;

  if (!runtime.wellUnlocked) {
    if (runtime.introPhase !== "rejected") {
      const selectedArtifact = String(context.selectedArtifactReward || "");
      const hasStarterSelected = rewardMatches(selectedArtifact, REQUIRED_ARTIFACT);
      return `
        <article class="crd02-node" data-node-id="${NODE_ID}">
          <section class="crd02-origin-card">
            <h3>Spiritual Origin Test</h3>
            <p>The elders place your hand above a bowl of pure madra to read your spirit.</p>
            ${renderSlotRing({
    slots: [
      {
        filled: hasStarterSelected,
        clickable: false,
        title: hasStarterSelected
          ? "Starter Core aligned."
          : "Select Starter Core in Artifacts to attempt the test.",
        ariaLabel: "Starter Core requirement",
        symbolHtml: renderArtifactSymbol({
          artifactName: REQUIRED_ARTIFACT,
          className: "slot-ring-symbol artifact-symbol",
        }),
        attrs: {},
      },
    ],
    className: "crd02-origin-slot-ring",
    radiusPct: 42,
    ariaLabel: "Starter Core requirement socket",
  })}
            <button
              type="button"
              data-node-id="${NODE_ID}"
              data-node-action="crd02-origin-test"
              data-selected-artifact="${escapeHtml(selectedArtifact)}"
              ${hasStarterSelected ? "" : "disabled"}
            >
              Place Hand In Pure Madra
            </button>
          </section>
        </article>
      `;
    }

    return `
      <article class="crd02-node" data-node-id="${NODE_ID}">
        <section class="crd02-origin-card">
          <h3>Unsouled</h3>
          <p>The madra does not react. You are judged Unsouled and denied training.</p>
          <p>You run to the woods and discover a hidden well exuding ambient aura.</p>
          <button type="button" data-node-id="${NODE_ID}" data-node-action="crd02-enter-well">Approach The Well</button>
        </section>
      </article>
    `;
  }

  const twinCost = cyclingCostWithPrestige(twinStarsCost(runtime.cycling.twinStarsLevel), runtime);
  const heavenCost = cyclingCostWithPrestige(heavenEarthCost(runtime.cycling.heavenEarthLevel), runtime);
  const canBuyTwin = runtime.madra >= twinCost;
  const canBuyHeaven = crd06Solved && runtime.madra >= heavenCost;
  const manualReward = manualMadraGain(runtime);
  const currentStage = normalizeStage(runtime.cultivationStage);
  const lootState = lootInventoryFromState(context.state || {}, nowMs());
  const unlockedSoulSlots = Math.max(3, Number(lootState.progression && lootState.progression.crdSoulCrystalSlots) || 3);
  const soulSlotIds =
    lootState.loadouts && lootState.loadouts.cradle && Array.isArray(lootState.loadouts.cradle.soulCrystalSlots)
      ? lootState.loadouts.cradle.soulCrystalSlots
      : [];
  const crdLootItems = Object.values(lootState.items || {}).filter((item) => item.region === "crd");
  const soulCrystals = crdLootItems.filter((item) => item.kind === "soul_crystal");
  const combatRelics = crdLootItems.filter((item) => item.kind === "combat_item" || item.templateId === "crd_combat_relic");
  const equippedCombatId =
    lootState.loadouts && lootState.loadouts.cradle ? lootState.loadouts.cradle.combatItemId : null;
  const selectedLootItemId = String(context.selectedLootItemId || "");
  const selectedArtifact = String(context.selectedArtifactReward || "");
  const hasIronPotionSelected = rewardMatches(selectedArtifact, IRON_BREAKTHROUGH_ARTIFACT);
  const hasJadePotionSelected = rewardMatches(selectedArtifact, JADE_BREAKTHROUGH_ARTIFACT);
  const breakthroughReady =
    currentStage === "foundation"
      ? runtime.madra >= BREAKTHROUGH_COSTS.foundation
      : currentStage === "copper"
        ? runtime.madra >= BREAKTHROUGH_COSTS.copper && hasIronPotionSelected
        : currentStage === "iron"
          ? runtime.madra >= BREAKTHROUGH_COSTS.iron && hasJadePotionSelected
          : currentStage === "jade"
            ? runtime.madra >= BREAKTHROUGH_COSTS.jade
            : currentStage === "lowgold"
              ? runtime.madra >= BREAKTHROUGH_COSTS.lowgold
              : currentStage === "highgold"
                ? runtime.madra >= BREAKTHROUGH_COSTS.highgold
                : false;
  const breakthroughLabel =
    currentStage === "foundation"
      ? `Breakthrough: Copper (${BREAKTHROUGH_COSTS.foundation} Madra)`
      : currentStage === "copper"
        ? `Breakthrough: Iron (${BREAKTHROUGH_COSTS.copper} Madra + Cultivation Potion)`
        : currentStage === "iron"
          ? `Breakthrough: Jade (${BREAKTHROUGH_COSTS.iron} Madra + Jade Condensation Elixir)`
          : currentStage === "jade"
            ? `Breakthrough: Low Gold (${BREAKTHROUGH_COSTS.jade} Madra)`
            : currentStage === "lowgold"
              ? `Breakthrough: High Gold (${BREAKTHROUGH_COSTS.lowgold} Madra)`
              : currentStage === "highgold"
                ? `Breakthrough: True Gold (${BREAKTHROUGH_COSTS.highgold} Madra)`
                : currentStage === "truegold"
                  ? "Underlord advancement is forged in Nightwheel Valley."
                  : currentStage === "underlord"
                    ? "Overlord advancement is forged in Scaling the Lord Realm."
                    : currentStage === "overlord"
                      ? "Archlord advancement is forged in Scaling the Lord Realm."
                  : "Stage cap reached";

  const activeTab = runtime.activeTab === "soul" || runtime.activeTab === "combat" || runtime.activeTab === "soulfire"
    ? runtime.activeTab
    : "well";
  const wellPanel = canSeeMenus
    ? `
      <section class="crd02-panel">
        <h4>Cycling Techniques</h4>
        <div class="crd02-tech-row">
          <div>
            <p><strong>The Heart of Twin Stars</strong></p>
            <p class="muted">Level ${escapeHtml(String(runtime.cycling.twinStarsLevel))} | ${(Math.pow(heartOfTwinStarsBase(runtime), runtime.cycling.twinStarsLevel) - 1).toFixed(3)} madra/sec</p>
          </div>
          <button
            type="button"
            data-node-id="${NODE_ID}"
            data-node-action="crd02-buy-cycling"
            data-technique-id="twin-stars"
            data-crd06-solved="${crd06Solved ? "true" : "false"}"
            ${canBuyTwin ? "" : "disabled"}
          >
            Upgrade (${escapeHtml(String(twinCost))})
          </button>
        </div>
        <div class="crd02-tech-row">
          <div>
            <p><strong>The Heaven and Earth Purification Wheel</strong></p>
            <p class="muted">Level ${escapeHtml(String(runtime.cycling.heavenEarthLevel))} | ${crd06Solved ? "Unlocked by CRD06" : "Locked until CRD06"}</p>
          </div>
          <button
            type="button"
            data-node-id="${NODE_ID}"
            data-node-action="crd02-buy-cycling"
            data-technique-id="heaven-earth-wheel"
            data-crd06-solved="${crd06Solved ? "true" : "false"}"
            ${canBuyHeaven ? "" : "disabled"}
          >
            Upgrade (${escapeHtml(String(heavenCost))})
          </button>
        </div>
      </section>
    `
    : `
      <section class="crd02-panel">
        <p>Manual cultivation unlocked. Gain your first madra to reveal cycling techniques and your techniques tree.</p>
      </section>
    `;
  const soulPanel = soulCircuitMarkup({
    unlockedSoulSlots,
    soulSlotIds,
    lootState,
    selectedLootItemId,
    soulCrystals,
  });
  const combatPanel = combatLoadoutMarkup({
    lootState,
    selectedLootItemId,
    equippedCombatId,
    combatRelics,
  });
  const currentSoulfire = Math.max(0, Number(runtime.soulfire && runtime.soulfire.amount) || 0);
  const soulfirePerSecond = passiveSoulfirePerSecond(runtime);
  const madraCyclerLevel = Math.max(0, Number(runtime.soulfire && runtime.soulfire.madraCyclerLevel) || 0);
  const soulfireCyclerLevel = Math.max(0, Number(runtime.soulfire && runtime.soulfire.soulfireCyclerLevel) || 0);
  const soulfireCostDivider = Math.max(1, Number(runtime.prestige && runtime.prestige.soulfireCostDivider) || 1);
  const madraCyclerCost = Math.max(1, Math.round((9000 * Math.pow(2.1, madraCyclerLevel)) / soulfireCostDivider));
  const soulfireCyclerCost = roundMadra((6 * Math.pow(2.5, soulfireCyclerLevel)) / soulfireCostDivider);
  const soulfirePanel = `
    <section class="crd02-panel">
      <h4>Soulfire</h4>
      <p><strong>Soulfire:</strong> ${escapeHtml(currentSoulfire.toFixed(2))}</p>
      <p class="muted">${escapeHtml(soulfirePerSecond.toFixed(3))}/sec passive</p>
      <div class="crd02-tech-row">
        <div>
          <p><strong>Soulfire Furnace</strong></p>
          <p class="muted">Level ${escapeHtml(String(madraCyclerLevel))} | Costs Madra</p>
        </div>
        <button
          type="button"
          data-node-id="${NODE_ID}"
          data-node-action="crd02-buy-soulfire-upgrade"
          data-upgrade-id="madra-cycler"
          ${runtime.madra >= madraCyclerCost ? "" : "disabled"}
        >
          Upgrade (${escapeHtml(String(madraCyclerCost))} Madra)
        </button>
      </div>
      <div class="crd02-tech-row">
        <div>
          <p><strong>Soulfire Condensation Wheel</strong></p>
          <p class="muted">Level ${escapeHtml(String(soulfireCyclerLevel))} | Costs Soulfire</p>
        </div>
        <button
          type="button"
          data-node-id="${NODE_ID}"
          data-node-action="crd02-buy-soulfire-upgrade"
          data-upgrade-id="soulfire-cycler"
          ${currentSoulfire >= soulfireCyclerCost ? "" : "disabled"}
        >
          Upgrade (${escapeHtml(soulfireCyclerCost.toFixed(2))} Soulfire)
        </button>
      </div>
    </section>
  `;

  return `
    <article class="crd02-node" data-node-id="${NODE_ID}">
      <section class="crd02-header">
        <div>
          <h3>Madra Well</h3>
          <p class="muted">Cultivate aura into madra. Stage: ${escapeHtml(stageLabel(currentStage))}</p>
        </div>
        <div class="crd02-counter">
          <p><strong>Madra</strong></p>
          <p class="crd02-counter-value">${escapeHtml(runtime.madra.toFixed(2))}</p>
          <p class="muted">${escapeHtml(mps.toFixed(3))}/sec passive</p>
        </div>
      </section>

      <section class="crd02-controls">
        <button type="button" data-node-id="${NODE_ID}" data-node-action="crd02-open-manual">Manual Cultivation</button>
        <button
          type="button"
          data-node-id="${NODE_ID}"
          data-node-action="crd02-open-techniques"
          ${canSeeMenus ? "" : "disabled"}
        >
          Open Techniques
        </button>
        <button
          type="button"
          class="ghost"
          data-node-id="${NODE_ID}"
          data-node-action="crd02-debug-madra"
          data-debug-amount="${DEBUG_MADRA_STEP}"
        >
          +${DEBUG_MADRA_STEP} Madra (Test)
        </button>
        <button
          type="button"
          data-node-id="${NODE_ID}"
          data-node-action="crd02-breakthrough"
          data-selected-artifact="${escapeHtml(selectedArtifact)}"
          data-breakthrough-ready="${breakthroughReady ? "true" : "false"}"
          ${breakthroughReady ? "" : "disabled"}
        >
          ${escapeHtml(breakthroughLabel)}
        </button>
      </section>
      <section class="crd02-panel">
        <div class="toolbar">
          <button type="button" data-node-id="${NODE_ID}" data-node-action="crd02-open-tab" data-tab="well" ${activeTab === "well" ? "disabled" : ""}>Madra Well</button>
          <button type="button" data-node-id="${NODE_ID}" data-node-action="crd02-open-tab" data-tab="soul" ${activeTab === "soul" ? "disabled" : ""}>Soul Crystals</button>
          <button type="button" data-node-id="${NODE_ID}" data-node-action="crd02-open-tab" data-tab="combat" ${activeTab === "combat" ? "disabled" : ""}>Combat Gear</button>
          ${
            stageIndex(currentStage) >= stageIndex("underlord") || runtime.soulfire.unlocked
              ? `<button type="button" data-node-id="${NODE_ID}" data-node-action="crd02-open-tab" data-tab="soulfire" ${activeTab === "soulfire" ? "disabled" : ""}>Soulfire</button>`
              : ""
          }
        </div>
      </section>

      ${
        activeTab === "soul"
          ? soulPanel
          : activeTab === "combat"
            ? combatPanel
            : activeTab === "soulfire"
              ? soulfirePanel
              : wellPanel
      }
      ${techniquesModalMarkup(runtime)}
      ${manualModalMarkup(runtime, manualReward)}
    </article>
  `;
}

export const CRD02_NODE_EXPERIENCE = {
  nodeId: NODE_ID,
  initialState: initialCrd02Runtime,
  synchronizeRuntime: synchronizeCrd02Runtime,
  render: renderCrd02Experience,
  reduceRuntime: reduceCrd02Runtime,
  validateRuntime: validateCrd02Runtime,
  buildActionFromElement: buildCrd02ActionFromElement,
  buildKeyAction: buildCrd02KeyAction,
};
