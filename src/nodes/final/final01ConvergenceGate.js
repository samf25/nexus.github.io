import { escapeHtml } from "../../templates/shared.js";
import { renderArtifactSymbol } from "../../core/artifacts.js";
import { renderRegionSymbol } from "../../core/symbology.js";
import { renderSlotRing } from "../../ui/slotRing.js";
import {
  CRD02_MANUAL_RHYTHM_PATTERNS,
  nearestPulse,
  patternByIndex,
  patternCadence,
  pulsePhaseDelaySeconds,
} from "../cradle/rhythmCore.js";
import {
  createWormBattleState,
  infoDebuffStatKeys,
  resolveWormRound,
  selectableWormActions,
} from "../worm/wormCombatSystem.js";
import { normalizeWormSystemState, wormOwnedCards } from "../../systems/wormDeck.js";
import { renderWormCard } from "../worm/wormCardRenderer.js";
import {
  createMemoryGameRuntime,
  reduceMemoryGameBegin,
  reduceMemoryGamePick,
  renderMemoryDisplay,
  renderMemoryField,
  synchronizeMemoryGameRuntime,
} from "../motheroflearning/memoryGameCore.js";

const NODE_ID = "FIN01";
const FINAL_SYMBOL_KEY = "final-arc";
const PHASE_ENTRY = "entry";
const PHASE_MEMORY = "memory";
const PHASE_RHYTHM = "rhythm";
const PHASE_DUAL = "dual";
const PHASE_SYNTHESIS = "synthesis";
const PHASE_COMPLETE = "complete";
const RESOURCE_REQUIREMENTS = Object.freeze({
  madra: 50000,
  soulfire: 35,
  clout: 600,
  gold: 900,
});
const RESOURCE_PENDING_FIELD_BY_NAME = Object.freeze({
  madra: "pendingMadraSpend",
  soulfire: "pendingSoulfireSpend",
  clout: "pendingCloutSpend",
  gold: "pendingGoldSpend",
});
const FINAL_MEMORY_TARGET_SUCCESSES = 10;
const FINAL_RHYTHM_STREAK_TARGET = 5;
const FINAL_RHYTHM_HIT_TOLERANCE_MS = 180;
const FINAL_RHYTHM_PATTERN_INDICES = Object.freeze([7, 9, 11, 8, 10]);

const HARD_LOCK_ARTIFACTS = Object.freeze({
  box: "The Transient, Ephemeral, Fleeting Vault of the Mortal World. The Evanescent Safe of Passing Moments, the Faded Chest of Then and Them. The Box of Incontinuity",
  cookbook: "The Dungeon Anarchist's Cookbook",
});

const LATE_ARTIFACT_METADATA = Object.freeze({
  "Mercy Charter Seal": Object.freeze({ group: "doctrine", memory: true, synthesisOrder: 0 }),
  "Conqueror's Due Process": Object.freeze({ group: "doctrine", crd: true, synthesisOrder: 1 }),
  "Measured Iron Mandate": Object.freeze({ group: "doctrine", rhythm: true, synthesisOrder: 2 }),
  "Table of Last Reconciliation": Object.freeze({ group: "doctrine", worm: true, synthesisOrder: 3 }),
  "Midnight Carving Accord": Object.freeze({ group: "doctrine", worm: true, synthesisOrder: 4 }),
  "Bell of Unbroken Guest-Right": Object.freeze({ group: "doctrine", worm: true, synthesisOrder: 5 }),
  "Consistency Key": Object.freeze({ group: "cipher", memory: true, synthesisOrder: 0 }),
  "Public-Private Key": Object.freeze({ group: "cipher", rhythm: true, synthesisOrder: 1 }),
  "Homomorphism Key": Object.freeze({ group: "cipher", rhythm: true, synthesisOrder: 2 }),
  "Field Marker": Object.freeze({ group: "cipher", crd: true, synthesisOrder: 3 }),
  "Proof Stamp": Object.freeze({ group: "proof", memory: true, synthesisOrder: 0 }),
  "Congruence Lens": Object.freeze({ group: "proof", memory: true, synthesisOrder: 1 }),
  "Symmetry Mirror": Object.freeze({ group: "proof", rhythm: true, synthesisOrder: 2 }),
  "Curvature Compass": Object.freeze({ group: "proof", crd: true, synthesisOrder: 3 }),
});
const LATE_ARTIFACTS = Object.freeze(Object.keys(LATE_ARTIFACT_METADATA));
export const FIN01_ARTIFACT_PHASE_METADATA = LATE_ARTIFACT_METADATA;
const GROUP_IDS = Object.freeze(["memory", "rhythm", "battle"]);
const GROUP_LABELS = Object.freeze({
  memory: "Memory",
  rhythm: "Rhythm",
  battle: "Battle",
});
const ACTION_LABELS = Object.freeze({
  attack: "Attack",
  defense: "Defense",
  info: "Info",
  manipulation: "Manipulation",
  speed: "Speed",
  stealth: "Stealth",
});

function safeText(value) {
  return String(value || "").trim();
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function rewardsMap(state) {
  return state && state.inventory && state.inventory.rewards && typeof state.inventory.rewards === "object"
    ? state.inventory.rewards
    : {};
}

function hasReward(state, artifactName) {
  const rewards = rewardsMap(state);
  return Boolean(rewards[artifactName]);
}

function readResources(state) {
  const crd02 =
    state && state.nodeRuntime && state.nodeRuntime.CRD02 && typeof state.nodeRuntime.CRD02 === "object"
      ? state.nodeRuntime.CRD02
      : {};
  const soulfire = crd02.soulfire && typeof crd02.soulfire === "object" ? crd02.soulfire : {};
  const worm = state && state.systems && state.systems.worm && typeof state.systems.worm === "object"
    ? state.systems.worm
    : {};
  const dcc = state && state.nodeRuntime && state.nodeRuntime.DCC01 && typeof state.nodeRuntime.DCC01 === "object"
    ? state.nodeRuntime.DCC01
    : {};
  const dccMeta = dcc.meta && typeof dcc.meta === "object" ? dcc.meta : {};
  return {
    madra: Math.max(0, Number(crd02.madra || 0)),
    soulfire: Math.max(0, Number(soulfire.amount || 0)),
    clout: Math.max(0, Number(worm.clout || 0)),
    gold: Math.max(0, Number(dccMeta.gold || 0)),
  };
}

function activeLateArtifacts(state) {
  return LATE_ARTIFACTS.filter((artifact) => hasReward(state, artifact));
}

function artifactRoleSummary(activeArtifacts) {
  const source = Array.isArray(activeArtifacts) ? activeArtifacts : [];
  const summary = {
    memory: 0,
    rhythm: 0,
    crd: 0,
    worm: 0,
  };
  for (const artifact of source) {
    const meta = LATE_ARTIFACT_METADATA[artifact];
    if (!meta) {
      continue;
    }
    if (meta.memory) {
      summary.memory += 1;
    }
    if (meta.rhythm) {
      summary.rhythm += 1;
    }
    if (meta.crd) {
      summary.crd += 1;
    }
    if (meta.worm) {
      summary.worm += 1;
    }
  }
  return summary;
}

function memoryTargetForRoleSummary(summary) {
  void summary;
  return FINAL_MEMORY_TARGET_SUCCESSES;
}

function normalizeAssignments(candidate, activeArtifacts) {
  const source = candidate && typeof candidate === "object" ? candidate : {};
  const allowed = new Set(Array.isArray(activeArtifacts) ? activeArtifacts : []);
  const next = {};
  for (const artifact of allowed) {
    const group = safeText(source[artifact]).toLowerCase();
    next[artifact] = GROUP_IDS.includes(group) ? group : "";
  }
  return next;
}

function expectedSynthesisGroup(artifact) {
  const meta = LATE_ARTIFACT_METADATA[String(artifact || "")];
  if (!meta) {
    return "";
  }
  if (meta.memory) {
    return "memory";
  }
  if (meta.rhythm) {
    return "rhythm";
  }
  return "battle";
}

function normalizeMemory(candidate) {
  const source = candidate && typeof candidate === "object" ? candidate : {};
  const phase = ["idle", "show", "input"].includes(String(source.phase || "").toLowerCase())
    ? String(source.phase || "").toLowerCase()
    : "idle";
  const sequence = Array.isArray(source.sequence) ? source.sequence.map((value) => String(value || "")).filter((value) => value) : [];
  return {
    phase,
    sequence,
    inputIndex: Math.max(0, Math.floor(Number(source.inputIndex) || 0)),
    anchors: Array.isArray(source.anchors) ? source.anchors.map((value) => String(value || "")).filter((value) => value) : [],
    attempts: Math.max(0, Math.floor(Number(source.attempts) || 0)),
  };
}

function normalizeRhythm(candidate) {
  const source = candidate && typeof candidate === "object" ? candidate : {};
  const maxStep = Math.max(0, FINAL_RHYTHM_PATTERN_INDICES.length - 1);
  const patternStep = clamp(Math.floor(Number(source.patternStep) || 0), 0, maxStep);
  const fallbackPatternIndex = FINAL_RHYTHM_PATTERN_INDICES[patternStep] || FINAL_RHYTHM_PATTERN_INDICES[0] || 0;
  const rawPatternIndex = Math.floor(Number(source.patternIndex));
  const patternIndex = Number.isFinite(rawPatternIndex) ? rawPatternIndex : fallbackPatternIndex;
  return {
    active: Boolean(source.active),
    startedAt: Number.isFinite(Number(source.startedAt)) ? Number(source.startedAt) : 0,
    patternStep,
    patternIndex: clamp(patternIndex, 0, CRD02_MANUAL_RHYTHM_PATTERNS.length - 1),
    streak: Math.max(0, Math.floor(Number(source.streak) || 0)),
    target: FINAL_RHYTHM_STREAK_TARGET,
    toleranceMs: FINAL_RHYTHM_HIT_TOLERANCE_MS,
    lastBeatOrdinal: Number.isFinite(Number(source.lastBeatOrdinal)) ? Number(source.lastBeatOrdinal) : -1,
    attempts: Math.max(0, Math.floor(Number(source.attempts) || 0)),
    feedback: String(source.feedback || ""),
    feedbackUntil: Number.isFinite(Number(source.feedbackUntil)) ? Number(source.feedbackUntil) : 0,
  };
}

function fallbackWormCard(id, heroName, power, baseStats) {
  const stats = baseStats && typeof baseStats === "object" ? baseStats : {};
  return {
    id,
    heroName,
    power,
    powerFull: power,
    attack: Math.max(1, Number(stats.attack || 5)),
    defense: Math.max(1, Number(stats.defense || 5)),
    endurance: Math.max(1, Number(stats.endurance || 5)),
    info: Math.max(1, Number(stats.info || 5)),
    manipulation: Math.max(1, Number(stats.manipulation || 5)),
    range: Math.max(1, Number(stats.range || 5)),
    speed: Math.max(1, Number(stats.speed || 5)),
    stealth: Math.max(1, Number(stats.stealth || 5)),
    rarity: Number(stats.rarity || 7),
    rarityTier: "epic",
  };
}

function readPlayerWormCards(state) {
  const wormState = normalizeWormSystemState(
    state && state.systems && state.systems.worm && typeof state.systems.worm === "object"
      ? state.systems.worm
      : {},
    Date.now(),
  );
  const ownedEntries = wormOwnedCards(wormState, Date.now());
  const byId = Object.fromEntries(ownedEntries.map((entry) => [String(entry.cardId || ""), entry]));
  const worm02Runtime =
    state && state.nodeRuntime && state.nodeRuntime.WORM02 && typeof state.nodeRuntime.WORM02 === "object"
      ? state.nodeRuntime.WORM02
      : {};
  const loadout = Array.isArray(worm02Runtime.playerLoadout)
    ? worm02Runtime.playerLoadout.map((cardId) => String(cardId || "").trim()).filter(Boolean).slice(0, 2)
    : [];
  const selectedEntries = [];
  for (const cardId of loadout) {
    if (byId[cardId]) {
      selectedEntries.push(byId[cardId]);
    }
  }
  const fallbackEntries = ownedEntries.filter((entry) => !loadout.includes(String(entry.cardId || "")));
  const pickedEntries = [...selectedEntries, ...fallbackEntries].slice(0, 2);
  const owned = pickedEntries
    .map((entry) => ({
      ...entry.card,
      currentHp: entry.currentHp,
    }));
  if (owned.length >= 2) {
    return owned;
  }
  const fallback = [
    fallbackWormCard("final-fallback-1", "Composite Strider", "Hard-won instincts and stitched shard reflexes.", {
      attack: 8, defense: 8, endurance: 8, info: 7, manipulation: 7, range: 7, speed: 7, stealth: 6, rarity: 6.2,
    }),
    fallbackWormCard("final-fallback-2", "Archive Warden", "A reconstructed cape profile tuned for survivability.", {
      attack: 7, defense: 9, endurance: 9, info: 6, manipulation: 6, range: 6, speed: 6, stealth: 5, rarity: 6.1,
    }),
  ];
  return [...owned, ...fallback].slice(0, 2);
}

function createFinalWormEnemyTeam() {
  return [
    fallbackWormCard("final-leviathan", "Leviathan", "Hydrokinetic pressure and relentless motion.", {
      attack: 12,
      defense: 10,
      endurance: 12,
      info: 9,
      manipulation: 8,
      range: 11,
      speed: 12,
      stealth: 7,
      rarity: 9.8,
    }),
    fallbackWormCard("final-simurgh", "Simurgh", "Forecast loops and surgical disruption.", {
      attack: 10,
      defense: 9,
      endurance: 11,
      info: 13,
      manipulation: 13,
      range: 12,
      speed: 11,
      stealth: 12,
      rarity: 10,
    }),
    fallbackWormCard("final-behemoth", "Behemoth", "Seismic force and catastrophic attrition.", {
      attack: 14,
      defense: 13,
      endurance: 15,
      info: 7,
      manipulation: 8,
      range: 9,
      speed: 8,
      stealth: 5,
      rarity: 10,
    }),
  ];
}

function normalizeDualOrderPrefs(orders, battle) {
  const next = {};
  const source = orders && typeof orders === "object" ? orders : {};
  const validTypes = selectableWormActions();
  const validInfo = infoDebuffStatKeys();
  const playerTeam = battle && Array.isArray(battle.playerTeam) ? battle.playerTeam : [];
  const enemyTeam = battle && Array.isArray(battle.enemyTeam) ? battle.enemyTeam.filter((c) => Number(c.hp || 0) > 0) : [];
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

function normalizeDual(candidate, state, roleSummary) {
  void state;
  const source = candidate && typeof candidate === "object" ? candidate : {};
  const subphase = ["idle", "worm", "won"].includes(String(source.subphase || "").toLowerCase())
    ? String(source.subphase || "").toLowerCase()
    : "idle";
  const worm = source.worm && typeof source.worm === "object" ? source.worm : null;
  return {
    subphase,
    worm,
    orderPrefs: normalizeDualOrderPrefs(source.orderPrefs, worm),
    roleSummary: {
      memory: Math.max(0, Number(roleSummary.memory || 0)),
      rhythm: Math.max(0, Number(roleSummary.rhythm || 0)),
      worm: Math.max(0, Number(roleSummary.worm || 0)),
    },
  };
}

function normalizeRuntime(runtime, context = {}) {
  const source = runtime && typeof runtime === "object" ? runtime : {};
  const state = context.state || {};
  const activeArtifacts = activeLateArtifacts(state);
  const roles = artifactRoleSummary(activeArtifacts);
  const memoryTarget = memoryTargetForRoleSummary(roles);
  const assignments = normalizeAssignments(
    source.artifactPuzzleState && source.artifactPuzzleState.assignments,
    activeArtifacts,
  );
  const phase = [PHASE_ENTRY, PHASE_MEMORY, PHASE_RHYTHM, PHASE_DUAL, PHASE_SYNTHESIS, PHASE_COMPLETE].includes(String(source.phase || ""))
    ? String(source.phase)
    : PHASE_ENTRY;
  const sourceMemoryGame =
    source.memoryGame && typeof source.memoryGame === "object"
      ? source.memoryGame
      : createMemoryGameRuntime({ targetSuccesses: memoryTarget, roll: Math.random() });
  const memoryGame = synchronizeMemoryGameRuntime({
    ...sourceMemoryGame,
    targetSuccesses: memoryTarget,
  });
  return {
    phase,
    solved: Boolean(source.solved),
    seed: Number.isFinite(Number(source.seed)) ? (Number(source.seed) >>> 0) : (Date.now() >>> 0),
    entrySockets: {
      box: Boolean(source.entrySockets && source.entrySockets.box),
      cookbook: Boolean(source.entrySockets && source.entrySockets.cookbook),
    },
    lockInvestments: {
      madra: Boolean(source.lockInvestments && source.lockInvestments.madra),
      soulfire: Boolean(source.lockInvestments && source.lockInvestments.soulfire),
      clout: Boolean(source.lockInvestments && source.lockInvestments.clout),
      gold: Boolean(source.lockInvestments && source.lockInvestments.gold),
    },
    checkpoints: {
      lockin: Boolean(source.checkpoints && source.checkpoints.lockin),
      memory: Boolean(source.checkpoints && source.checkpoints.memory),
      rhythm: Boolean(source.checkpoints && source.checkpoints.rhythm),
      dual: Boolean(source.checkpoints && source.checkpoints.dual),
      synthesis: Boolean(source.checkpoints && source.checkpoints.synthesis),
    },
    pendingMadraSpend: Math.max(0, Number(source.pendingMadraSpend || 0)),
    pendingSoulfireSpend: Math.max(0, Number(source.pendingSoulfireSpend || 0)),
    pendingCloutSpend: Math.max(0, Number(source.pendingCloutSpend || 0)),
    pendingGoldSpend: Math.max(0, Number(source.pendingGoldSpend || 0)),
    memoryGame,
    rhythm: normalizeRhythm(source.rhythm),
    dual: normalizeDual(source.dual, state, roles),
    artifactPuzzleState: {
      activeArtifacts,
      roleSummary: roles,
      assignments,
      synthesisSolved: Boolean(source.artifactPuzzleState && source.artifactPuzzleState.synthesisSolved),
    },
    pendingRewards: Array.isArray(source.pendingRewards) ? source.pendingRewards.map((entry) => String(entry || "")).filter((entry) => entry) : [],
    lastMessage: String(source.lastMessage || ""),
  };
}

function canStartMemory(runtime) {
  return Boolean(
    runtime.entrySockets.box &&
      runtime.entrySockets.cookbook &&
      runtime.lockInvestments.madra &&
      runtime.lockInvestments.soulfire &&
      runtime.lockInvestments.clout &&
      runtime.lockInvestments.gold,
  );
}

function resourceRequirementMet(resourceName, resources) {
  const required = Number(RESOURCE_REQUIREMENTS[resourceName] || 0);
  return Number(resources && resources[resourceName] ? resources[resourceName] : 0) >= required;
}

function pendingFieldForResource(resourceName) {
  const key = safeText(resourceName).toLowerCase();
  return RESOURCE_PENDING_FIELD_BY_NAME[key] || "";
}


function startDualBattle(runtime, state) {
  const playerCards = readPlayerWormCards(state);
  const enemyCards = createFinalWormEnemyTeam();
  if (playerCards.length < 2) {
    return {
      ...runtime,
      lastMessage: "You need two healthy capes for the Endbringer trial.",
    };
  }
  const battle = createWormBattleState({
    playerCards,
    enemyCards,
    maxPlayerCards: 2,
    maxEnemyCards: 3,
    enemyAiMode: "boss",
    seed: (Date.now() >>> 0) ^ runtime.seed,
  });
  return {
    ...runtime,
    dual: {
      ...runtime.dual,
      subphase: "worm",
      worm: battle,
      orderPrefs: normalizeDualOrderPrefs(runtime.dual && runtime.dual.orderPrefs, battle),
    },
    lastMessage: "",
  };
}

function ensureWormBattle(runtime, state) {
  if (runtime.dual && runtime.dual.worm && typeof runtime.dual.worm === "object") {
    return runtime;
  }
  return startDualBattle(runtime, state);
}

function synthesisSolved(runtime) {
  const active = runtime.artifactPuzzleState.activeArtifacts || [];
  if (!active.length) {
    return true;
  }
  const assignments = runtime.artifactPuzzleState.assignments || {};
  for (const artifact of active) {
    const expected = expectedSynthesisGroup(artifact);
    if (!expected || assignments[artifact] !== expected) {
      return false;
    }
  }
  return true;
}

export function initialFinal01Runtime() {
  return normalizeRuntime(
    {
      phase: PHASE_ENTRY,
      solved: false,
      entrySockets: { box: false, cookbook: false },
      lockInvestments: { madra: false, soulfire: false, clout: false, gold: false },
      checkpoints: { lockin: false, memory: false, rhythm: false, dual: false, synthesis: false },
      memoryGame: createMemoryGameRuntime({ targetSuccesses: FINAL_MEMORY_TARGET_SUCCESSES, roll: Math.random() }),
      rhythm: {
        active: false,
        startedAt: 0,
        patternStep: 0,
        patternIndex: FINAL_RHYTHM_PATTERN_INDICES[0] || 0,
        streak: 0,
        target: FINAL_RHYTHM_STREAK_TARGET,
        toleranceMs: FINAL_RHYTHM_HIT_TOLERANCE_MS,
        lastBeatOrdinal: -1,
        attempts: 0,
        feedback: "",
        feedbackUntil: 0,
      },
      dual: {
        subphase: "idle",
        orderPrefs: {},
      },
      artifactPuzzleState: {
        assignments: {},
      },
      pendingRewards: [],
      lastMessage: "",
    },
    { state: {} },
  );
}

export function synchronizeFinal01Runtime(runtime, context = {}) {
  const normalized = normalizeRuntime(runtime, context);
  if (normalized.phase === PHASE_COMPLETE || normalized.solved) {
    return {
      ...normalized,
      solved: true,
    };
  }
  return normalized;
}

export function reduceFinal01Runtime(runtime, action, context = {}) {
  const current = synchronizeFinal01Runtime(runtime, context);
  if (!action || typeof action !== "object") {
    return current;
  }
  const state = context.state || {};
  const resources = readResources(state);

  if (action.type === "fin01-dev-skip-phase") {
    const target = safeText(action.targetPhase).toLowerCase();
    const checkpointsBase = {
      lockin: false,
      memory: false,
      rhythm: false,
      dual: false,
      synthesis: false,
    };
    const memoryTarget = memoryTargetForRoleSummary(current.artifactPuzzleState.roleSummary);
    const forcedEntry = {
      ...current,
      solved: false,
      phase: PHASE_ENTRY,
      entrySockets: {
        box: true,
        cookbook: true,
      },
      lockInvestments: {
        madra: true,
        soulfire: true,
        clout: true,
        gold: true,
      },
      checkpoints: checkpointsBase,
      pendingMadraSpend: 0,
      pendingSoulfireSpend: 0,
      pendingCloutSpend: 0,
      pendingGoldSpend: 0,
      memoryGame: createMemoryGameRuntime({
        targetSuccesses: memoryTarget,
        roll: Math.random(),
      }),
      rhythm: {
        ...current.rhythm,
        active: false,
        patternStep: 0,
        patternIndex: FINAL_RHYTHM_PATTERN_INDICES[0] || 0,
        streak: 0,
        lastBeatOrdinal: -1,
        target: FINAL_RHYTHM_STREAK_TARGET,
        toleranceMs: FINAL_RHYTHM_HIT_TOLERANCE_MS,
      },
      artifactPuzzleState: {
        ...current.artifactPuzzleState,
        synthesisSolved: false,
      },
    };

    if (target === PHASE_ENTRY) {
      return {
        ...forcedEntry,
        phase: PHASE_ENTRY,
        lastMessage: "Dev skip: Entry restored.",
      };
    }
    if (target === PHASE_MEMORY) {
      return {
        ...forcedEntry,
        phase: PHASE_MEMORY,
        checkpoints: {
          ...checkpointsBase,
          lockin: true,
        },
        lastMessage: "Dev skip: Memory trial ready.",
      };
    }
    if (target === PHASE_RHYTHM) {
      return {
        ...forcedEntry,
        phase: PHASE_RHYTHM,
        checkpoints: {
          ...checkpointsBase,
          lockin: true,
          memory: true,
        },
        memoryGame: {
          ...forcedEntry.memoryGame,
          phase: "input",
          solved: true,
          successCount: forcedEntry.memoryGame.targetSuccesses,
          inputIndex: forcedEntry.memoryGame.sequence.length,
        },
        lastMessage: "Dev skip: Rhythm trial ready.",
      };
    }
    if (target === PHASE_DUAL) {
      return startDualBattle({
        ...forcedEntry,
        phase: PHASE_DUAL,
        checkpoints: {
          ...checkpointsBase,
          lockin: true,
          memory: true,
          rhythm: true,
        },
        memoryGame: {
          ...forcedEntry.memoryGame,
          phase: "input",
          solved: true,
          successCount: forcedEntry.memoryGame.targetSuccesses,
          inputIndex: forcedEntry.memoryGame.sequence.length,
        },
        lastMessage: "Dev skip: Dual trial ready.",
      }, state);
    }
    if (target === PHASE_SYNTHESIS) {
      return {
        ...forcedEntry,
        phase: PHASE_SYNTHESIS,
        checkpoints: {
          ...checkpointsBase,
          lockin: true,
          memory: true,
          rhythm: true,
          dual: true,
        },
        memoryGame: {
          ...forcedEntry.memoryGame,
          phase: "input",
          solved: true,
          successCount: forcedEntry.memoryGame.targetSuccesses,
          inputIndex: forcedEntry.memoryGame.sequence.length,
        },
        dual: {
          ...forcedEntry.dual,
          subphase: "won",
        },
        lastMessage: "Dev skip: Synthesis board ready.",
      };
    }
    if (target === PHASE_COMPLETE) {
      return {
        ...forcedEntry,
        phase: PHASE_COMPLETE,
        solved: true,
        checkpoints: {
          lockin: true,
          memory: true,
          rhythm: true,
          dual: true,
          synthesis: true,
        },
        artifactPuzzleState: {
          ...forcedEntry.artifactPuzzleState,
          synthesisSolved: true,
        },
        lastMessage: "Convergence complete. The final proof route opens.",
      };
    }
    return current;
  }

  if (current.phase === PHASE_COMPLETE || current.solved) {
    return {
      ...current,
      solved: true,
    };
  }

  if (action.type === "fin01-socket-lock" && current.phase === PHASE_ENTRY) {
    const slotId = safeText(action.slotId).toLowerCase();
    const artifact = safeText(action.artifact);
    if (slotId === "box" && artifact === HARD_LOCK_ARTIFACTS.box) {
      return {
        ...current,
        entrySockets: {
          ...current.entrySockets,
          box: true,
        },
        lastMessage: "The Box lock settles into place.",
      };
    }
    if (slotId === "cookbook" && artifact === HARD_LOCK_ARTIFACTS.cookbook) {
      return {
        ...current,
        entrySockets: {
          ...current.entrySockets,
          cookbook: true,
        },
        lastMessage: "The Cookbook lock clicks and warms.",
      };
    }
    return {
      ...current,
      lastMessage: "That artifact does not answer this lock.",
    };
  }

  if (action.type === "fin01-invest-resource" && current.phase === PHASE_ENTRY) {
    const resource = safeText(action.resource).toLowerCase();
    if (!Object.prototype.hasOwnProperty.call(RESOURCE_REQUIREMENTS, resource)) {
      return current;
    }
    if (current.lockInvestments[resource]) {
      return current;
    }
    if (!resourceRequirementMet(resource, resources)) {
      return {
        ...current,
        lastMessage: `Insufficient ${resource}.`,
      };
    }
    const pendingField = pendingFieldForResource(resource);
    return {
      ...current,
      lockInvestments: {
        ...current.lockInvestments,
        [resource]: true,
      },
      ...(pendingField ? { [pendingField]: RESOURCE_REQUIREMENTS[resource] } : {}),
      lastMessage: `${resource[0].toUpperCase()}${resource.slice(1)} investment stabilized.`,
    };
  }

  if (action.type === "fin01-begin-memory" && current.phase === PHASE_ENTRY) {
    if (!canStartMemory(current)) {
      return {
        ...current,
        lastMessage: "Two hard locks and all four investments are required first.",
      };
    }
    return {
      ...current,
      phase: PHASE_MEMORY,
      checkpoints: {
        ...current.checkpoints,
        lockin: true,
      },
      pendingMadraSpend: 0,
      pendingSoulfireSpend: 0,
      pendingCloutSpend: 0,
      pendingGoldSpend: 0,
      memoryGame: createMemoryGameRuntime({
        targetSuccesses: memoryTargetForRoleSummary(current.artifactPuzzleState.roleSummary),
        roll: Math.random(),
      }),
      lastMessage: "Lock-in complete. Memory trial opens.",
    };
  }

  if (action.type === "fin01-memory-begin" && current.phase === PHASE_MEMORY) {
    const memoryGame = reduceMemoryGameBegin(current.memoryGame, { at: Number(action.at || Date.now()) });
    return {
      ...current,
      memoryGame,
      lastMessage: "Observe the sequence. Then begin recall.",
    };
  }

  if (action.type === "fin01-memory-enter-input" && current.phase === PHASE_MEMORY) {
    return current;
  }

  if (action.type === "fin01-memory-pick" && current.phase === PHASE_MEMORY) {
    const nextGame = reduceMemoryGamePick(current.memoryGame, {
      symbolToken: safeText(action.token),
      roll: Number(action.roll || Math.random()),
      at: Number(action.at || Date.now()),
    });
    if (!nextGame.solved) {
      return {
        ...current,
        memoryGame: nextGame,
        lastMessage:
          current.memoryGame.phase === "input" && nextGame.phase === "idle" && nextGame.successCount === 0
            ? "Pattern broke. Begin again."
            : "",
      };
    }

    return {
      ...current,
      phase: PHASE_RHYTHM,
      checkpoints: {
        ...current.checkpoints,
        memory: true,
      },
      memoryGame: nextGame,
      rhythm: {
        ...current.rhythm,
        active: false,
        patternStep: 0,
        patternIndex: FINAL_RHYTHM_PATTERN_INDICES[0] || 0,
        streak: 0,
        lastBeatOrdinal: -1,
        target: FINAL_RHYTHM_STREAK_TARGET,
        toleranceMs: FINAL_RHYTHM_HIT_TOLERANCE_MS,
      },
      lastMessage: "",
    };
  }

  if (action.type === "fin01-rhythm-start" && current.phase === PHASE_RHYTHM) {
    return {
      ...current,
      rhythm: {
        ...current.rhythm,
        active: true,
        startedAt: Number(action.at || Date.now()),
        streak: 0,
        lastBeatOrdinal: -1,
        feedback: "",
      },
      lastMessage: "",
    };
  }

  if (action.type === "fin01-rhythm-tap" && current.phase === PHASE_RHYTHM) {
    if (!current.rhythm.active) {
      return current;
    }
    const pattern = patternByIndex(CRD02_MANUAL_RHYTHM_PATTERNS, current.rhythm.patternIndex);
    const at = Number(action.at || Date.now());
    const match = nearestPulse(pattern, current.rhythm.startedAt, at, current.rhythm.toleranceMs);
    if (match.beatOrdinal === current.rhythm.lastBeatOrdinal) {
      return current;
    }
    if (!match.onBeat) {
      return {
        ...current,
        rhythm: {
          ...current.rhythm,
          active: false,
          streak: 0,
          lastBeatOrdinal: match.beatOrdinal,
          attempts: current.rhythm.attempts + 1,
          feedback: "miss",
          feedbackUntil: at + 350,
        },
        lastMessage: "Rhythm broken. Restart the cadence.",
      };
    }
    const nextStreak = current.rhythm.streak + 1;
    if (nextStreak >= current.rhythm.target) {
      const nextPatternStep = current.rhythm.patternStep + 1;
      if (nextPatternStep < FINAL_RHYTHM_PATTERN_INDICES.length) {
        return {
          ...current,
          rhythm: {
            ...current.rhythm,
            active: true,
            patternStep: nextPatternStep,
            patternIndex: FINAL_RHYTHM_PATTERN_INDICES[nextPatternStep] || current.rhythm.patternIndex,
            startedAt: at,
            streak: 0,
            lastBeatOrdinal: -1,
            feedback: "hit",
            feedbackUntil: at + 300,
          },
          lastMessage: "",
        };
      }
      return startDualBattle({
        ...current,
        phase: PHASE_DUAL,
        checkpoints: {
          ...current.checkpoints,
          rhythm: true,
        },
        rhythm: {
          ...current.rhythm,
          active: false,
          streak: nextStreak,
          lastBeatOrdinal: match.beatOrdinal,
          feedback: "hit",
          feedbackUntil: at + 300,
        },
      }, state);
    }
    return {
      ...current,
      rhythm: {
        ...current.rhythm,
        streak: nextStreak,
        lastBeatOrdinal: match.beatOrdinal,
        feedback: "hit",
        feedbackUntil: at + 300,
      },
      lastMessage: "",
    };
  }

  if (action.type === "fin01-dual-start" && current.phase === PHASE_DUAL) {
    return startDualBattle(current, state);
  }

  if (action.type === "fin01-dual-worm-round" && current.phase === PHASE_DUAL && current.dual.subphase === "worm") {
    const prepared = ensureWormBattle(current, state);
    const battle = prepared.dual.worm;
    if (!battle || battle.winner) {
      return prepared;
    }
    const orders = action.orders && typeof action.orders === "object" ? action.orders : {};
    const playerOrders = normalizeDualOrderPrefs(orders, battle);
    const nextBattle = resolveWormRound(battle, { playerOrders });
    if (nextBattle.winner === "player") {
      return {
        ...prepared,
        phase: PHASE_SYNTHESIS,
        checkpoints: {
          ...prepared.checkpoints,
          dual: true,
        },
        dual: {
          ...prepared.dual,
          worm: nextBattle,
          orderPrefs: normalizeDualOrderPrefs(playerOrders, nextBattle),
          subphase: "won",
        },
        lastMessage: "",
      };
    }
    if (nextBattle.winner === "enemy") {
      return {
        ...prepared,
        dual: {
          ...prepared.dual,
          worm: null,
          orderPrefs: {},
          subphase: "idle",
        },
        lastMessage: "",
      };
    }
    return {
      ...prepared,
      dual: {
        ...prepared.dual,
        worm: nextBattle,
        orderPrefs: normalizeDualOrderPrefs(playerOrders, nextBattle),
      },
      lastMessage: "",
    };
  }

  if (action.type === "fin01-synthesis-assign" && current.phase === PHASE_SYNTHESIS) {
    const artifact = safeText(action.artifact);
    const groupId = safeText(action.groupId).toLowerCase();
    if (!current.artifactPuzzleState.activeArtifacts.includes(artifact) || !GROUP_IDS.includes(groupId)) {
      return current;
    }
    const nextAssignments = {
      ...current.artifactPuzzleState.assignments,
      [artifact]: groupId,
    };
    return {
      ...current,
      artifactPuzzleState: {
        ...current.artifactPuzzleState,
        assignments: nextAssignments,
      },
      lastMessage: "",
    };
  }

  if (action.type === "fin01-synthesis-clear" && current.phase === PHASE_SYNTHESIS) {
    const artifact = safeText(action.artifact);
    if (!current.artifactPuzzleState.activeArtifacts.includes(artifact)) {
      return current;
    }
    const nextAssignments = {
      ...current.artifactPuzzleState.assignments,
      [artifact]: "",
    };
    return {
      ...current,
      artifactPuzzleState: {
        ...current.artifactPuzzleState,
        assignments: nextAssignments,
      },
      lastMessage: "",
    };
  }

  if (action.type === "fin01-synthesis-validate" && current.phase === PHASE_SYNTHESIS) {
    const solved = synthesisSolved(current);
    if (!solved) {
      return {
        ...current,
        lastMessage: "The lattice rejects this ordering.",
      };
    }
    return {
      ...current,
      phase: PHASE_COMPLETE,
      solved: true,
      checkpoints: {
        ...current.checkpoints,
        synthesis: true,
      },
      artifactPuzzleState: {
        ...current.artifactPuzzleState,
        synthesisSolved: true,
      },
      lastMessage: "Convergence complete. The final proof route opens.",
    };
  }

  return current;
}

export function validateFinal01Runtime(runtime) {
  const normalized = normalizeRuntime(runtime, { state: {} });
  return Boolean(normalized.solved || normalized.phase === PHASE_COMPLETE);
}

function entryMarkup(runtime, context) {
  const selectedArtifact = safeText(context.selectedArtifactReward);
  const resources = readResources(context.state || {});
  const lockSlots = [
    {
      slotId: "box",
      reward: HARD_LOCK_ARTIFACTS.box,
      filled: runtime.entrySockets.box,
      label: "Incontinuity Lock",
    },
    {
      slotId: "cookbook",
      reward: HARD_LOCK_ARTIFACTS.cookbook,
      filled: runtime.entrySockets.cookbook,
      label: "Anarchist Lock",
    },
  ];
  const slots = lockSlots.map((entry) => ({
    filled: entry.filled,
    ready: !entry.filled && selectedArtifact === entry.reward,
    clickable: !entry.filled,
    title: entry.filled ? `${entry.label}: aligned` : `${entry.label}: requires ${entry.reward}`,
    ariaLabel: entry.label,
    symbolHtml: entry.filled
      ? renderArtifactSymbol({
        artifactName: entry.reward,
        className: "slot-ring-symbol artifact-symbol",
      })
      : "",
    attrs: {
      "data-node-id": NODE_ID,
      "data-node-action": "fin01-socket-lock",
      "data-slot-id": entry.slotId,
      "data-selected-artifact": selectedArtifact,
    },
  }));

  const positions = {
    madra: "top",
    soulfire: "right",
    clout: "bottom",
    gold: "left",
  };
  const resourceSpheres = Object.keys(RESOURCE_REQUIREMENTS).map((resource) => {
    const required = RESOURCE_REQUIREMENTS[resource];
    const currentValue = Number(resources[resource] || 0);
    const invested = Boolean(runtime.lockInvestments[resource]);
    const met = currentValue >= required;
    const ready = !invested && met;
    const placement = positions[resource] || "top";
    return `
      <article class="final01-invest final01-invest-${escapeHtml(placement)}">
        <button
          type="button"
          class="hub08-orb-button final01-invest-orb ${invested ? "is-lit" : ""}"
          data-fin01-sphere="true"
          data-fin01-resource="${escapeHtml(resource)}"
          data-node-id="${NODE_ID}"
          data-node-action="fin01-invest-resource"
          data-resource="${escapeHtml(resource)}"
          data-ready="${ready ? "true" : "false"}"
          ${ready ? "" : "disabled"}
        ></button>
        <p class="final01-invest-label">${escapeHtml(resource.toUpperCase())}: ${escapeHtml(String(Math.floor(currentValue)))} / ${escapeHtml(String(required))}</p>
      </article>
    `;
  }).join("");

  return `
    <section class="card final01-card">
      <h3>Final Gateway</h3>
      <section class="final01-entry-stage">
        ${renderSlotRing({
          slots,
          className: "final01-lock-ring",
          radiusPct: 43,
          centerHtml: renderRegionSymbol({
            symbolKey: FINAL_SYMBOL_KEY,
            className: "slot-ring-center-symbol final01-center-symbol",
          }),
          ariaLabel: "Final hard-lock ring",
        })}
        ${resourceSpheres}
      </section>
      <div class="toolbar">
        <button
          type="button"
          data-node-id="${NODE_ID}"
          data-node-action="fin01-begin-memory"
          ${canStartMemory(runtime) ? "" : "disabled"}
        >
          Begin Convergence
        </button>
      </div>
    </section>
  `;
}

function memoryMarkup(runtime) {
  const game = runtime.memoryGame;
  return `
    <section class="card mol-memory-head">
      <h3>Phase B: Memory Trial</h3>
      <p><strong>Rounds Cleared:</strong> ${game.successCount}/${game.targetSuccesses}</p>
    </section>
    ${renderMemoryDisplay(game)}
    <section class="toolbar">
      ${
        game.phase === "idle"
          ? `
            <button type="button" data-node-id="${NODE_ID}" data-node-action="fin01-memory-begin">
              Begin Sequence
            </button>
          `
          : ""
      }
    </section>
    ${renderMemoryField({
      nodeId: NODE_ID,
      actionName: "fin01-memory-pick",
      game,
    })}
  `;
}

function devSkipMarkup() {
  return `
    <section class="card final01-card">
      <h3>Dev Phase Skip</h3>
      <div class="toolbar">
        <button type="button" class="ghost" data-node-id="${NODE_ID}" data-node-action="fin01-dev-skip-phase" data-target-phase="${PHASE_MEMORY}">Memory</button>
        <button type="button" class="ghost" data-node-id="${NODE_ID}" data-node-action="fin01-dev-skip-phase" data-target-phase="${PHASE_RHYTHM}">Rhythm</button>
        <button type="button" class="ghost" data-node-id="${NODE_ID}" data-node-action="fin01-dev-skip-phase" data-target-phase="${PHASE_DUAL}">Dual</button>
        <button type="button" class="ghost" data-node-id="${NODE_ID}" data-node-action="fin01-dev-skip-phase" data-target-phase="${PHASE_SYNTHESIS}">Synthesis</button>
        <button type="button" class="ghost" data-node-id="${NODE_ID}" data-node-action="fin01-dev-skip-phase" data-target-phase="${PHASE_COMPLETE}">Complete</button>
      </div>
    </section>
  `;
}

function rhythmMarkup(runtime) {
  const pattern = patternByIndex(CRD02_MANUAL_RHYTHM_PATTERNS, runtime.rhythm.patternIndex);
  const phaseDelay = pulsePhaseDelaySeconds(pattern, runtime.rhythm.startedAt);
  const showHitFlash = runtime.rhythm.feedback === "hit" && Date.now() < runtime.rhythm.feedbackUntil;
  const progressPercent = Math.round(
    Math.min(
      1,
      (
        runtime.rhythm.patternStep +
        Math.min(runtime.rhythm.streak, FINAL_RHYTHM_STREAK_TARGET) / FINAL_RHYTHM_STREAK_TARGET
      ) / Math.max(1, FINAL_RHYTHM_PATTERN_INDICES.length),
    ) * 100,
  );
  return `
    <section class="card final01-card">
      <h3>Phase C: Rhythm Trial</h3>
      <p><strong>Pattern:</strong> ${escapeHtml(pattern.label)} (${runtime.rhythm.patternStep + 1}/${FINAL_RHYTHM_PATTERN_INDICES.length})</p>
      <p><strong>Cadence:</strong> ${escapeHtml(patternCadence(pattern))}</p>
      <section class="crd01-stage">
        <div
          class="crd01-core is-pattern-${escapeHtml(String(pattern.visualId || 0))}"
          style="${runtime.rhythm.active ? `animation-delay: -${escapeHtml(phaseDelay.toFixed(3))}s;` : "animation-play-state: paused;"}"
          aria-hidden="true"
        >
          <span class="crd01-stream stream-a"></span>
          <span class="crd01-stream stream-b"></span>
          <span class="crd01-stream stream-c"></span>
          ${showHitFlash ? `<span class="crd01-hit-flash"></span>` : ""}
          <span class="crd01-core-shell"></span>
        </div>
      </section>
      <div class="toolbar">
        <button type="button" data-node-id="${NODE_ID}" data-node-action="fin01-rhythm-start">Begin Cycling</button>
      </div>
      <p><strong>Current Streak:</strong> ${runtime.rhythm.streak}/${FINAL_RHYTHM_STREAK_TARGET}</p>
      <div class="progress-bar"><span style="width:${progressPercent}%"></span></div>
    </section>
  `;
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
  const aliveEnemies = enemyTeam.filter((enemy) => Number(enemy.hp || 0) > 0);
  const normalized = normalizePreferenceForActor(combatant, aliveEnemies, preference);
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
    <article class="worm02-order-row" data-worm04-order-row data-actor-id="${escapeHtml(combatant.combatantId)}">
      <h4>${escapeHtml(combatant.heroName)}</h4>
      <label>
        <span>Action</span>
        <select class="worm02-select" data-worm04-order-type>
          ${actionOptions}
        </select>
      </label>
      <label>
        <span>Target</span>
        <select class="worm02-select" data-worm04-order-target>
          ${targetOptions}
        </select>
      </label>
      <label data-worm04-info-wrap ${normalized.type === "info" ? "" : "hidden"}>
        <span>Info Debuff</span>
        <select class="worm02-select" data-worm04-order-info>
          ${infoOptions}
        </select>
      </label>
    </article>
  `;
}

function teamCardsMarkup(team, role) {
  return team
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

function dualMarkup(runtime) {
  const worm = runtime.dual.worm;
  if (!worm || runtime.dual.subphase === "idle") {
    return `
      <section class="card final01-card">
        <h3>Phase D: Endbringer Combat Trial</h3>
        <p class="muted">Leviathan, Simurgh, and Behemoth converge as a 3-cape enemy line.</p>
        <div class="toolbar">
          <button type="button" data-node-id="${NODE_ID}" data-node-action="fin01-dual-start">Start Endbringer Trial</button>
        </div>
      </section>
    `;
  }

  const playerTeam = Array.isArray(worm.playerTeam) ? worm.playerTeam : [];
  const enemyTeam = Array.isArray(worm.enemyTeam) ? worm.enemyTeam : [];
  const playerAlive = playerTeam.filter((combatant) => Number(combatant.hp || 0) > 0);
  const canResolve = !worm.winner && playerAlive.length > 0;
  const winnerLabel = worm.winner
    ? worm.winner === "player"
      ? "Player victory"
      : worm.winner === "enemy"
        ? "Enemy victory"
        : "Draw"
    : "In progress";
  const turnNumber = Math.max(1, Number(worm.round || 1) - 1);
  const turnEvents = Array.isArray(worm.lastRoundEvents) && worm.lastRoundEvents.length
    ? worm.lastRoundEvents
    : ["No decisive actions."];

  return `
    <section class="card final01-card">
      <h3>Phase D: Endbringer Combat Trial</h3>
      <section class="worm02-battle">
        <header class="worm02-battle-header">
          <p><strong>Combat Turn:</strong> ${escapeHtml(String(turnNumber))}</p>
          <p><strong>Status:</strong> ${escapeHtml(winnerLabel)}</p>
        </header>
        <section class="worm02-board worm02-board-lanes">
          <section class="worm02-team-column">
            <h3>Your Team</h3>
            <div class="worm02-card-grid">
              ${teamCardsMarkup(playerTeam, "player")}
            </div>
          </section>
          <section class="worm02-center-column">
            <section class="worm02-controls">
              <h3>Turn Orders</h3>
              <div class="worm02-order-grid">
                ${playerAlive
    .map((combatant) => playerOrderMarkup(combatant, enemyTeam, runtime.dual.orderPrefs[combatant.combatantId] || null))
    .join("")}
              </div>
              <div class="toolbar">
                <button type="button" data-node-id="${NODE_ID}" data-node-action="fin01-dual-worm-round" ${canResolve ? "" : "disabled"}>Resolve Turn</button>
                <button type="button" class="ghost" data-node-id="${NODE_ID}" data-node-action="fin01-dual-start">Restart Trial</button>
              </div>
            </section>
          </section>
          <section class="worm02-team-column">
            <h3>Endbringers</h3>
            <div class="worm02-card-grid">
              ${teamCardsMarkup(enemyTeam, "enemy")}
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
    </section>
  `;
}

function synthesisMarkup(runtime) {
  const active = runtime.artifactPuzzleState.activeArtifacts;
  const assignments = runtime.artifactPuzzleState.assignments;
  const grouped = Object.fromEntries(GROUP_IDS.map((groupId) => [groupId, []]));
  for (const artifact of active) {
    const groupId = assignments[artifact];
    if (GROUP_IDS.includes(groupId)) {
      grouped[groupId].push(artifact);
    }
  }

  const artifactRows = active.map((artifact) => {
    const assigned = assignments[artifact] || "";
    const expected = expectedSynthesisGroup(artifact);
    const rowClass = assigned ? (assigned === expected ? "is-good" : "is-bad") : "";
    return `
      <article class="final01-artifact-row ${rowClass}">
        <span class="final01-artifact-chip">${renderArtifactSymbol({ artifactName: artifact, className: "final01-chip-symbol artifact-symbol" })}<span>${escapeHtml(artifact)}</span></span>
        <div class="toolbar">
          ${GROUP_IDS.map((groupId) => `
            <button
              type="button"
              class="${assigned === groupId ? "" : "ghost"}"
              data-node-id="${NODE_ID}"
              data-node-action="fin01-synthesis-assign"
              data-artifact="${escapeHtml(artifact)}"
              data-group-id="${escapeHtml(groupId)}"
            >
              ${escapeHtml(GROUP_LABELS[groupId])}
            </button>
          `).join("")}
          <button
            type="button"
            class="ghost"
            data-node-id="${NODE_ID}"
            data-node-action="fin01-synthesis-clear"
            data-artifact="${escapeHtml(artifact)}"
            ${assigned ? "" : "disabled"}
          >
            Clear
          </button>
        </div>
      </article>
    `;
  }).join("");

  const groups = GROUP_IDS.map((groupId) => `
    <article class="final01-synthesis-group">
      <h4>${escapeHtml(GROUP_LABELS[groupId])} (${grouped[groupId].length})</h4>
      <div class="worm03-slot-chip-row">
        ${grouped[groupId].length
    ? grouped[groupId]
      .map((artifact) => `<span class="worm03-slot-chip">${renderArtifactSymbol({ artifactName: artifact, className: "slot-ring-symbol artifact-symbol" })}</span>`)
      .join("")
    : `<span class="muted">No artifacts assigned.</span>`}
      </div>
    </article>
  `).join("");

  return `
    <section class="card final01-card">
      <h3>Phase E: Synthesis Board</h3>
      <p class="muted">Sort each artifact by the trial it empowered: Memory, Rhythm, or Battle.</p>
      <section class="final01-synthesis-layout">
        <div class="final01-synthesis-groups">${groups}</div>
      </section>
      <section class="final01-artifact-list">
        ${artifactRows}
      </section>
      <div class="toolbar">
        <button type="button" data-node-id="${NODE_ID}" data-node-action="fin01-synthesis-validate">Resolve Synthesis</button>
      </div>
    </section>
  `;
}

export function renderFinal01Experience(context) {
  const runtime = synchronizeFinal01Runtime(context.runtime, context);
  const phase = runtime.phase;

  const body = phase === PHASE_ENTRY
    ? entryMarkup(runtime, context)
    : phase === PHASE_MEMORY
      ? memoryMarkup(runtime)
      : phase === PHASE_RHYTHM
        ? rhythmMarkup(runtime)
        : phase === PHASE_DUAL
          ? dualMarkup(runtime)
          : phase === PHASE_SYNTHESIS
            ? synthesisMarkup(runtime)
            : `
              <section class="completion-banner">
                <p><strong>CONVERGENCE SEALED</strong></p>
                <p>${escapeHtml(runtime.lastMessage || "The final route accepts your proof.")}</p>
              </section>
            `;

  return `
    <article class="final01-node" data-node-id="${NODE_ID}">
      ${devSkipMarkup()}
      ${body}
    </article>
  `;
}

function gatherOrdersFromSurface(surface) {
  const rows = [...surface.querySelectorAll("[data-worm04-order-row]")];
  const orders = {};
  for (const row of rows) {
    const actorId = safeText(row.getAttribute("data-actor-id"));
    if (!actorId) {
      continue;
    }
    const typeInput = row.querySelector("[data-worm04-order-type]");
    const targetInput = row.querySelector("[data-worm04-order-target]");
    const infoInput = row.querySelector("[data-worm04-order-info]");
    orders[actorId] = {
      type: typeInput && "value" in typeInput ? safeText(typeInput.value) : "attack",
      targetId: targetInput && "value" in targetInput ? safeText(targetInput.value) : "",
      infoStat: infoInput && "value" in infoInput ? safeText(infoInput.value) : "attack",
    };
  }
  return orders;
}

export function buildFinal01ActionFromElement(element) {
  const actionName = element.getAttribute("data-node-action");
  if (!actionName) {
    return null;
  }
  const surface = element.closest(".final01-node");
  if (!surface) {
    return null;
  }

  if (actionName === "fin01-socket-lock") {
    return {
      type: "fin01-socket-lock",
      slotId: element.getAttribute("data-slot-id") || "",
      artifact: element.getAttribute("data-selected-artifact") || "",
      at: Date.now(),
    };
  }
  if (actionName === "fin01-invest-resource") {
    return null;
  }
  if (actionName === "fin01-begin-memory") {
    return { type: "fin01-begin-memory", at: Date.now() };
  }
  if (actionName === "fin01-dev-skip-phase") {
    return {
      type: "fin01-dev-skip-phase",
      targetPhase: element.getAttribute("data-target-phase") || "",
      at: Date.now(),
    };
  }
  if (actionName === "fin01-memory-begin") {
    return { type: "fin01-memory-begin", at: Date.now() };
  }
  if (actionName === "fin01-memory-enter-input") {
    return { type: "fin01-memory-enter-input", at: Date.now() };
  }
  if (actionName === "fin01-memory-pick") {
    return {
      type: "fin01-memory-pick",
      token: element.getAttribute("data-symbol-token") || "",
      roll: Math.random(),
      at: Date.now(),
    };
  }
  if (actionName === "fin01-rhythm-start") {
    return { type: "fin01-rhythm-start", at: Date.now() };
  }
  if (actionName === "fin01-rhythm-tap") {
    return { type: "fin01-rhythm-tap", at: Date.now() };
  }
  if (actionName === "fin01-dual-start") {
    return { type: "fin01-dual-start", at: Date.now() };
  }
  if (actionName === "fin01-dual-worm-round") {
    return {
      type: "fin01-dual-worm-round",
      orders: gatherOrdersFromSurface(surface),
      at: Date.now(),
    };
  }
  if (actionName === "fin01-synthesis-assign") {
    return {
      type: "fin01-synthesis-assign",
      artifact: element.getAttribute("data-artifact") || "",
      groupId: element.getAttribute("data-group-id") || "",
      at: Date.now(),
    };
  }
  if (actionName === "fin01-synthesis-clear") {
    return {
      type: "fin01-synthesis-clear",
      artifact: element.getAttribute("data-artifact") || "",
      at: Date.now(),
    };
  }
  if (actionName === "fin01-synthesis-validate") {
    return { type: "fin01-synthesis-validate", at: Date.now() };
  }

  return null;
}

export function buildFinal01KeyAction(event, runtime) {
  const current = synchronizeFinal01Runtime(runtime, { state: {} });
  if (current.phase !== PHASE_RHYTHM || !current.rhythm.active) {
    return null;
  }
  if (event.metaKey || event.ctrlKey || event.altKey || event.repeat) {
    return null;
  }
  if (event.code !== "Space" && event.key !== " ") {
    return null;
  }
  return {
    type: "fin01-rhythm-tap",
    at: Date.now(),
  };
}

export const FIN01_NODE_EXPERIENCE = {
  nodeId: NODE_ID,
  initialState: initialFinal01Runtime,
  synchronizeRuntime: synchronizeFinal01Runtime,
  render: renderFinal01Experience,
  reduceRuntime: reduceFinal01Runtime,
  validateRuntime: validateFinal01Runtime,
  buildActionFromElement: buildFinal01ActionFromElement,
  buildKeyAction: buildFinal01KeyAction,
};
