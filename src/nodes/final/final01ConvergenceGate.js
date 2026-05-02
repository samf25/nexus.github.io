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
  "Mercy Charter Seal": Object.freeze({ group: "doctrine", memory: true, synthesisOrder: 0, synthesisFamily: "doctrine", synthesisStageRole: "memory", synthesisMechanicUnlock: "rotate" }),
  "Conqueror's Due Process": Object.freeze({ group: "doctrine", crd: true, synthesisOrder: 1, synthesisFamily: "doctrine", synthesisStageRole: "combat", synthesisMechanicUnlock: "reflect" }),
  "Measured Iron Mandate": Object.freeze({ group: "doctrine", rhythm: true, synthesisOrder: 2, synthesisFamily: "doctrine", synthesisStageRole: "rhythm", synthesisMechanicUnlock: "swap" }),
  "Table of Last Reconciliation": Object.freeze({ group: "doctrine", worm: true, synthesisOrder: 3, synthesisFamily: "doctrine", synthesisStageRole: "combat", synthesisMechanicUnlock: "link-bridge" }),
  "Midnight Carving Accord": Object.freeze({ group: "doctrine", worm: true, synthesisOrder: 4, synthesisFamily: "doctrine", synthesisStageRole: "combat", synthesisMechanicUnlock: "link-bridge" }),
  "Bell of Unbroken Guest-Right": Object.freeze({ group: "doctrine", worm: true, synthesisOrder: 5, synthesisFamily: "doctrine", synthesisStageRole: "combat", synthesisMechanicUnlock: "link-bridge" }),
  "Consistency Key": Object.freeze({ group: "cipher", memory: true, synthesisOrder: 0, synthesisFamily: "cipher", synthesisStageRole: "memory", synthesisMechanicUnlock: "rotate" }),
  "Public-Private Key": Object.freeze({ group: "cipher", rhythm: true, synthesisOrder: 1, synthesisFamily: "cipher", synthesisStageRole: "rhythm", synthesisMechanicUnlock: "swap" }),
  "Homomorphism Key": Object.freeze({ group: "cipher", rhythm: true, synthesisOrder: 2, synthesisFamily: "cipher", synthesisStageRole: "rhythm", synthesisMechanicUnlock: "swap" }),
  "Field Marker": Object.freeze({ group: "cipher", crd: true, synthesisOrder: 3, synthesisFamily: "cipher", synthesisStageRole: "combat", synthesisMechanicUnlock: "reflect" }),
  "Proof Stamp": Object.freeze({ group: "proof", memory: true, synthesisOrder: 0, synthesisFamily: "proof", synthesisStageRole: "memory", synthesisMechanicUnlock: "rotate" }),
  "Congruence Lens": Object.freeze({ group: "proof", memory: true, synthesisOrder: 1, synthesisFamily: "proof", synthesisStageRole: "memory", synthesisMechanicUnlock: "rotate" }),
  "Symmetry Mirror": Object.freeze({ group: "proof", rhythm: true, synthesisOrder: 2, synthesisFamily: "proof", synthesisStageRole: "rhythm", synthesisMechanicUnlock: "swap" }),
  "Curvature Compass": Object.freeze({ group: "proof", crd: true, synthesisOrder: 3, synthesisFamily: "proof", synthesisStageRole: "combat", synthesisMechanicUnlock: "reflect" }),
});
const LATE_ARTIFACTS = Object.freeze(Object.keys(LATE_ARTIFACT_METADATA));
export const FIN01_ARTIFACT_PHASE_METADATA = LATE_ARTIFACT_METADATA;
const SYNTH_STAGE_1 = "stage1_locking";
const SYNTH_STAGE_2 = "stage2_rotation";
const SYNTH_STAGE_3 = "stage3_wiring";
const SYNTH_STAGE_4 = "stage4_seal";
const SYNTH_STAGE_SOLVED = "solved";
const SYNTH_MECHANIC_ORDER = Object.freeze(["rotate", "swap", "reflect", "link-bridge"]);
const SYNTH_MECHANIC_LABELS = Object.freeze({
  rotate: "Rotate",
  swap: "Swap",
  reflect: "Reflect",
  "link-bridge": "Link-Bridge",
});
const SYNTH_STAGE_LABELS = Object.freeze({
  [SYNTH_STAGE_1]: "Stage 1: Locking Ring",
  [SYNTH_STAGE_2]: "Stage 2: Rotation Board",
  [SYNTH_STAGE_3]: "Stage 3: Wiring Overlay",
  [SYNTH_STAGE_4]: "Stage 4: Seal Assembly",
  [SYNTH_STAGE_SOLVED]: "Synthesis Solved",
});
const SYNTH_FAMILY_RANK = Object.freeze({
  doctrine: 0,
  cipher: 1,
  proof: 2,
  resonance: 3,
});
const SYNTH_LOCK_SLOT_DEFS = Object.freeze([
  Object.freeze({ slotId: "slot-1", unlock: "rotate" }),
  Object.freeze({ slotId: "slot-2", unlock: "swap" }),
  Object.freeze({ slotId: "slot-3", unlock: "reflect" }),
  Object.freeze({ slotId: "slot-4", unlock: "link-bridge" }),
]);
const SYNTH_ROTATION_TARGETS = Object.freeze([
  Object.freeze({ pieceId: "p1", requiredPosition: 0, requiredRotation: 0, requiredMirror: false }),
  Object.freeze({ pieceId: "p2", requiredPosition: 1, requiredRotation: 1, requiredMirror: true }),
  Object.freeze({ pieceId: "p3", requiredPosition: 2, requiredRotation: 2, requiredMirror: false }),
  Object.freeze({ pieceId: "p4", requiredPosition: 3, requiredRotation: 3, requiredMirror: false }),
  Object.freeze({ pieceId: "p5", requiredPosition: 4, requiredRotation: 1, requiredMirror: true }),
  Object.freeze({ pieceId: "p6", requiredPosition: 5, requiredRotation: 2, requiredMirror: false }),
]);
const SYNTH_BASE_EDGES = Object.freeze([
  Object.freeze({ edgeId: "a-b", a: "A", b: "B" }),
  Object.freeze({ edgeId: "b-c", a: "B", b: "C" }),
  Object.freeze({ edgeId: "c-d", a: "C", b: "D" }),
  Object.freeze({ edgeId: "d-e", a: "D", b: "E" }),
  Object.freeze({ edgeId: "e-f", a: "E", b: "F" }),
  Object.freeze({ edgeId: "f-a", a: "F", b: "A" }),
]);
const SYNTH_BRIDGE_EDGES = Object.freeze([
  Object.freeze({ edgeId: "a-d", a: "A", b: "D" }),
  Object.freeze({ edgeId: "b-e", a: "B", b: "E" }),
  Object.freeze({ edgeId: "c-f", a: "C", b: "F" }),
]);
const SYNTH_REQUIRED_BRIDGE_EDGES = Object.freeze(new Set(["a-d", "c-f"]));
const SYNTH_SEAL_GROUP_IDS = Object.freeze(["circle-1", "circle-2", "circle-3", "circle-4"]);
const SYNTH_WIRING_CANONICAL_MODES = Object.freeze({
  "a-b": 1,
  "b-c": 2,
  "c-d": 1,
  "d-e": 2,
  "e-f": 1,
  "f-a": 2,
  "a-d": 1,
  "b-e": 2,
  "c-f": 1,
});
const SYNTH_WIRING_NODE_TARGETS = Object.freeze((() => {
  const charges = {};
  for (const node of ["A", "B", "C", "D", "E", "F"]) {
    charges[node] = 0;
  }
  for (const edge of [...SYNTH_BASE_EDGES, ...SYNTH_BRIDGE_EDGES]) {
    const mode = Math.max(0, Math.min(2, Number(SYNTH_WIRING_CANONICAL_MODES[edge.edgeId] || 0)));
    charges[edge.a] += mode;
    charges[edge.b] += mode;
  }
  return charges;
})());
const SYNTH_ECHO_ARTIFACTS = Object.freeze([
  Object.freeze({ name: "Convergence Echo Alpha", source: "Convergence", section: "Final Arc" }),
  Object.freeze({ name: "Convergence Echo Beta", source: "Convergence", section: "Final Arc" }),
  Object.freeze({ name: "Convergence Echo Gamma", source: "Convergence", section: "Final Arc" }),
  Object.freeze({ name: "Convergence Echo Delta", source: "Convergence", section: "Final Arc" }),
]);
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

function seededHash(text) {
  let hash = 2166136261 >>> 0;
  const value = safeText(text) || "seed";
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
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

function finalizeRelevantArtifact(rewardName, rewardData) {
  void rewardData;
  const name = safeText(rewardName);
  if (!name || name === HARD_LOCK_ARTIFACTS.box || name === HARD_LOCK_ARTIFACTS.cookbook) {
    return false;
  }
  return true;
}

function fallbackMetaForArtifact(artifactName, rewardData) {
  const name = safeText(artifactName);
  const source = safeText(rewardData && rewardData.source);
  const section = safeText(rewardData && rewardData.section);
  const seed = Math.abs(
    [...`${name}:${source}:${section}`].reduce((sum, char, index) => sum + char.charCodeAt(0) * (index + 3), 0),
  );
  const groupList = ["doctrine", "cipher", "proof", "resonance"];
  const unlock = SYNTH_MECHANIC_ORDER[seed % SYNTH_MECHANIC_ORDER.length] || "rotate";
  const stageRole = unlock === "rotate" ? "memory" : unlock === "swap" ? "rhythm" : "combat";
  return {
    group: groupList[seed % groupList.length] || "resonance",
    synthesisFamily: groupList[seed % groupList.length] || "resonance",
    synthesisStageRole: stageRole,
    synthesisOrder: seed % 10,
    synthesisMechanicUnlock: unlock,
    memory: stageRole === "memory",
    rhythm: stageRole === "rhythm",
    crd: unlock === "reflect",
    worm: unlock === "link-bridge",
  };
}

function synthMetaForArtifact(artifactName, rewardData) {
  const known = LATE_ARTIFACT_METADATA[safeText(artifactName)];
  if (known) {
    return { ...known };
  }
  return fallbackMetaForArtifact(artifactName, rewardData);
}

function ensureUnlockCoverage(catalog) {
  const source = Array.isArray(catalog) ? catalog : [];
  const counts = Object.fromEntries(SYNTH_MECHANIC_ORDER.map((mechanic) => [mechanic, 0]));
  for (const entry of source) {
    const unlock = synthUnlockFromMeta(entry.meta);
    counts[unlock] = (counts[unlock] || 0) + 1;
  }
  const adjustable = source.filter((entry) => !LATE_ARTIFACT_METADATA[entry.name]);
  let adjustCursor = 0;
  for (const mechanic of SYNTH_MECHANIC_ORDER) {
    if ((counts[mechanic] || 0) > 0) {
      continue;
    }
    const target = adjustable[adjustCursor] || source[adjustCursor];
    adjustCursor += 1;
    if (!target || !target.meta) {
      continue;
    }
    target.meta = {
      ...target.meta,
      synthesisMechanicUnlock: mechanic,
      synthesisStageRole: mechanic === "rotate" ? "memory" : mechanic === "swap" ? "rhythm" : "combat",
    };
    counts[mechanic] = 1;
  }
  return source;
}

function synthesisArtifactCatalog(state) {
  const rewards = rewardsMap(state);
  const names = Object.keys(rewards).filter((artifact) => finalizeRelevantArtifact(artifact, rewards[artifact]));
  if (!names.length) {
    return ensureUnlockCoverage(SYNTH_ECHO_ARTIFACTS.map((entry) => {
      const meta = synthMetaForArtifact(entry.name, entry);
      return {
        name: entry.name,
        source: entry.source,
        section: entry.section,
        meta,
      };
    }));
  }
  return ensureUnlockCoverage(names.map((artifactName) => {
    const rewardData = rewards[artifactName] && typeof rewards[artifactName] === "object" ? rewards[artifactName] : {};
    return {
      name: artifactName,
      source: safeText(rewardData.source),
      section: safeText(rewardData.section),
      meta: synthMetaForArtifact(artifactName, rewardData),
    };
  }));
}

function normalizeUnlockedMechanics(candidate) {
  const source = candidate && typeof candidate === "object" ? candidate : {};
  const unlocked = {};
  for (const mechanic of SYNTH_MECHANIC_ORDER) {
    unlocked[mechanic] = Boolean(source[mechanic]);
  }
  return unlocked;
}

function defaultRotationBoardState() {
  const scrambled = SYNTH_ROTATION_TARGETS.map((target, index) => ({
    pieceId: target.pieceId,
    position: index,
    rotation: target.requiredRotation,
    mirrored: target.requiredMirror,
  }));
  const swapPairs = [[0, 3], [1, 4], [2, 5]];
  for (const [left, right] of swapPairs) {
    const leftId = SYNTH_ROTATION_TARGETS[left].pieceId;
    const rightId = SYNTH_ROTATION_TARGETS[right].pieceId;
    for (const piece of scrambled) {
      if (piece.pieceId === leftId) {
        piece.position = right;
      } else if (piece.pieceId === rightId) {
        piece.position = left;
      }
    }
  }
  return {
    pieces: scrambled,
    selectedPieceId: "",
    swapArmed: false,
    status: "",
  };
}

function normalizeRotationBoardState(candidate) {
  const fallback = defaultRotationBoardState();
  const source = candidate && typeof candidate === "object" ? candidate : {};
  const rawPieces = Array.isArray(source.pieces) ? source.pieces : [];
  const pieces = fallback.pieces.map((piece) => {
    const hit = rawPieces.find((entry) => safeText(entry && entry.pieceId) === piece.pieceId);
    if (!hit || typeof hit !== "object") {
      return piece;
    }
    return {
      pieceId: piece.pieceId,
      position: clamp(Math.floor(Number(hit.position) || 0), 0, SYNTH_ROTATION_TARGETS.length - 1),
      rotation: ((Math.floor(Number(hit.rotation) || 0) % 4) + 4) % 4,
      mirrored: Boolean(hit.mirrored),
    };
  });
  return {
    pieces,
    selectedPieceId: safeText(source.selectedPieceId),
    swapArmed: Boolean(source.swapArmed),
    status: safeText(source.status),
  };
}

function defaultWiringState() {
  return {
    edgeModes: Object.fromEntries([...SYNTH_BASE_EDGES, ...SYNTH_BRIDGE_EDGES].map((edge) => [edge.edgeId, 0])),
    status: "",
  };
}

function normalizeWiringState(candidate) {
  const fallback = defaultWiringState();
  const source = candidate && typeof candidate === "object" ? candidate : {};
  const edgeModes = source.edgeModes && typeof source.edgeModes === "object"
    ? source.edgeModes
    : {};
  const legacyActiveEdges = source.activeEdges && typeof source.activeEdges === "object"
    ? source.activeEdges
    : {};
  const normalizedModes = {};
  for (const entry of [...SYNTH_BASE_EDGES, ...SYNTH_BRIDGE_EDGES]) {
    if (Number.isFinite(Number(edgeModes[entry.edgeId]))) {
      normalizedModes[entry.edgeId] = clamp(Math.floor(Number(edgeModes[entry.edgeId])), 0, 2);
    } else if (legacyActiveEdges[entry.edgeId]) {
      normalizedModes[entry.edgeId] = 1;
    } else {
      normalizedModes[entry.edgeId] = fallback.edgeModes[entry.edgeId];
    }
  }
  return {
    edgeModes: normalizedModes,
    status: safeText(source.status),
  };
}

function synthSortScore(entry) {
  const family = safeText(entry && entry.meta && entry.meta.synthesisFamily).toLowerCase();
  const familyRank = Number.isFinite(Number(SYNTH_FAMILY_RANK[family])) ? Number(SYNTH_FAMILY_RANK[family]) : 99;
  const order = Math.max(0, Math.floor(Number(entry && entry.meta && entry.meta.synthesisOrder) || 0));
  return familyRank * 100 + order;
}

function sealTargetFromCatalog(catalog) {
  const source = Array.isArray(catalog) ? [...catalog] : [];
  source.sort((a, b) => {
    const score = synthSortScore(a) - synthSortScore(b);
    if (score !== 0) {
      return score;
    }
    return safeText(a.name).localeCompare(safeText(b.name));
  });
  return source;
}

function defaultSealAssemblyState(catalog) {
  const sealTarget = sealTargetFromCatalog(catalog);
  const rotations = {};
  for (const entry of sealTarget) {
    const seeded = seededHash(entry.name);
    const raw = (seeded % 4 + 1) % 4;
    rotations[entry.name] = raw;
  }
  return {
    phase: "orient",
    selectedArtifact: "",
    groupSelected: "",
    groups: Object.fromEntries(SYNTH_SEAL_GROUP_IDS.map((groupId) => [groupId, []])),
    rotations,
    status: "",
  };
}

function normalizeSealAssemblyState(candidate, catalog) {
  const source = candidate && typeof candidate === "object" ? candidate : {};
  const fallback = defaultSealAssemblyState(catalog);
  const phase = safeText(source.phase) === "group" ? "group" : "orient";
  const groups = source.groups && typeof source.groups === "object" ? source.groups : {};
  const rotations = source.rotations && typeof source.rotations === "object" ? source.rotations : {};
  const validNames = new Set((Array.isArray(catalog) ? catalog : []).map((entry) => entry.name));
  const normalizedGroups = {};
  for (const groupId of SYNTH_SEAL_GROUP_IDS) {
    const entries = Array.isArray(groups[groupId]) ? groups[groupId] : [];
    const deduped = [];
    for (const artifactName of entries) {
      const name = safeText(artifactName);
      if (!name || !validNames.has(name) || deduped.includes(name)) {
        continue;
      }
      deduped.push(name);
    }
    normalizedGroups[groupId] = deduped;
  }
  const normalizedRotations = {};
  for (const entry of Array.isArray(catalog) ? catalog : []) {
    if (Number.isFinite(Number(rotations[entry.name]))) {
      normalizedRotations[entry.name] = ((Math.floor(Number(rotations[entry.name])) % 4) + 4) % 4;
    } else {
      normalizedRotations[entry.name] = fallback.rotations[entry.name] || 0;
    }
  }
  return {
    phase,
    selectedArtifact: validNames.has(safeText(source.selectedArtifact)) ? safeText(source.selectedArtifact) : "",
    groupSelected: SYNTH_SEAL_GROUP_IDS.includes(safeText(source.groupSelected)) ? safeText(source.groupSelected) : "",
    groups: normalizedGroups,
    rotations: normalizedRotations,
    status: safeText(source.status),
  };
}

function defaultSynthesisState(catalog) {
  return {
    currentStage: SYNTH_STAGE_1,
    placedArtifacts: {
      locking: {},
    },
    unlockedMechanics: {},
    rotationBoardState: defaultRotationBoardState(),
    wiringState: defaultWiringState(),
    sealAssemblyState: defaultSealAssemblyState(catalog),
    stageSolvedFlags: {
      [SYNTH_STAGE_1]: false,
      [SYNTH_STAGE_2]: false,
      [SYNTH_STAGE_3]: false,
      [SYNTH_STAGE_4]: false,
    },
    statusMessage: "",
  };
}

function normalizeSynthesisState(candidate, catalog) {
  const source = candidate && typeof candidate === "object" ? candidate : {};
  const currentStage = [SYNTH_STAGE_1, SYNTH_STAGE_2, SYNTH_STAGE_3, SYNTH_STAGE_4, SYNTH_STAGE_SOLVED].includes(safeText(source.currentStage))
    ? safeText(source.currentStage)
    : SYNTH_STAGE_1;
  const placed = source.placedArtifacts && typeof source.placedArtifacts === "object" ? source.placedArtifacts : {};
  const placedLocking = placed.locking && typeof placed.locking === "object" ? placed.locking : {};
  const validNames = new Set((Array.isArray(catalog) ? catalog : []).map((entry) => entry.name));
  const locking = {};
  for (const slot of SYNTH_LOCK_SLOT_DEFS) {
    const name = safeText(placedLocking[slot.slotId]);
    locking[slot.slotId] = name && validNames.has(name) ? name : null;
  }
  const stageSolvedFlags = source.stageSolvedFlags && typeof source.stageSolvedFlags === "object"
    ? source.stageSolvedFlags
    : {};
  return {
    currentStage,
    placedArtifacts: {
      locking,
    },
    unlockedMechanics: normalizeUnlockedMechanics(source.unlockedMechanics),
    rotationBoardState: normalizeRotationBoardState(source.rotationBoardState),
    wiringState: normalizeWiringState(source.wiringState),
    sealAssemblyState: normalizeSealAssemblyState(source.sealAssemblyState, catalog),
    stageSolvedFlags: {
      [SYNTH_STAGE_1]: Boolean(stageSolvedFlags[SYNTH_STAGE_1]),
      [SYNTH_STAGE_2]: Boolean(stageSolvedFlags[SYNTH_STAGE_2]),
      [SYNTH_STAGE_3]: Boolean(stageSolvedFlags[SYNTH_STAGE_3]),
      [SYNTH_STAGE_4]: Boolean(stageSolvedFlags[SYNTH_STAGE_4]),
    },
    statusMessage: safeText(source.statusMessage),
  };
}

function synthUnlockFromMeta(meta) {
  const direct = safeText(meta && meta.synthesisMechanicUnlock).toLowerCase();
  if (SYNTH_MECHANIC_ORDER.includes(direct)) {
    return direct;
  }
  if (meta && meta.memory) {
    return "rotate";
  }
  if (meta && meta.rhythm) {
    return "swap";
  }
  if (meta && meta.crd) {
    return "reflect";
  }
  return "link-bridge";
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
  const synthesisCatalog = synthesisArtifactCatalog(state);
  const activeArtifacts = synthesisCatalog.map((entry) => entry.name);
  const roles = artifactRoleSummary(activeArtifacts);
  const memoryTarget = memoryTargetForRoleSummary(roles);
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
    synthesis: (() => {
      const normalized = normalizeSynthesisState(source.synthesis, synthesisCatalog);
      return {
        currentStage: normalized.currentStage,
        placedArtifacts: normalized.placedArtifacts,
        unlockedMechanics: normalized.unlockedMechanics,
        rotationBoardState: normalized.rotationBoardState,
        wiringState: normalized.wiringState,
        sealAssemblyState: normalized.sealAssemblyState,
        stageSolvedFlags: normalized.stageSolvedFlags,
        statusMessage: normalized.statusMessage,
      };
    })(),
    artifactPuzzleState: {
      activeArtifacts,
      synthesisCatalog,
      roleSummary: roles,
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

function synthesisPieceById(runtime, pieceId) {
  const pieces = runtime && runtime.synthesis && runtime.synthesis.rotationBoardState
    ? runtime.synthesis.rotationBoardState.pieces
    : [];
  return pieces.find((piece) => piece.pieceId === safeText(pieceId)) || null;
}

function synthCatalogEntry(runtime, artifactName) {
  const source = runtime && runtime.artifactPuzzleState && Array.isArray(runtime.artifactPuzzleState.synthesisCatalog)
    ? runtime.artifactPuzzleState.synthesisCatalog
    : [];
  return source.find((entry) => safeText(entry.name) === safeText(artifactName)) || null;
}

function synthEffectiveUnlocks(synthesis) {
  const base = synthesis && synthesis.unlockedMechanics && typeof synthesis.unlockedMechanics === "object"
    ? synthesis.unlockedMechanics
    : {};
  const next = {
    rotate: true,
    swap: Boolean(base.swap),
    reflect: Boolean(base.reflect),
    "link-bridge": Boolean(base["link-bridge"]),
  };
  return next;
}

function rotationLinkedPositions(position) {
  const base = clamp(Math.floor(Number(position) || 0), 0, SYNTH_ROTATION_TARGETS.length - 1);
  return [
    (base + 2) % SYNTH_ROTATION_TARGETS.length,
    (base + 4) % SYNTH_ROTATION_TARGETS.length,
  ];
}

function rotateCoupledPieces(pieces, anchorPosition) {
  const linked = rotationLinkedPositions(anchorPosition);
  const affected = new Set([anchorPosition, ...linked]);
  return (Array.isArray(pieces) ? pieces : []).map((piece) =>
    affected.has(piece.position)
      ? { ...piece, rotation: (piece.rotation + 1) % 4 }
      : piece
  );
}

function reflectCoupledPieces(pieces, anchorPosition) {
  const linked = rotationLinkedPositions(anchorPosition);
  const affected = new Set([anchorPosition, ...linked]);
  return (Array.isArray(pieces) ? pieces : []).map((piece) =>
    affected.has(piece.position)
      ? { ...piece, mirrored: !piece.mirrored }
      : piece
  );
}

function rotationSolved(rotationState, unlockedMechanics) {
  const pieces = rotationState && Array.isArray(rotationState.pieces) ? rotationState.pieces : [];
  const byId = Object.fromEntries(pieces.map((piece) => [piece.pieceId, piece]));
  for (const target of SYNTH_ROTATION_TARGETS) {
    const piece = byId[target.pieceId];
    if (!piece) {
      return false;
    }
    if (piece.position !== target.requiredPosition) {
      return false;
    }
    if ((piece.rotation % 4) !== (target.requiredRotation % 4)) {
      return false;
    }
    if (synthEffectiveUnlocks({ unlockedMechanics }).reflect && Boolean(piece.mirrored) !== Boolean(target.requiredMirror)) {
      return false;
    }
  }
  return true;
}

function wiringNodeCharges(wiringState) {
  const nodes = Object.fromEntries(["A", "B", "C", "D", "E", "F"].map((node) => [node, 0]));
  const modes = wiringState && wiringState.edgeModes && typeof wiringState.edgeModes === "object"
    ? wiringState.edgeModes
    : {};
  for (const edge of [...SYNTH_BASE_EDGES, ...SYNTH_BRIDGE_EDGES]) {
    const mode = clamp(Math.floor(Number(modes[edge.edgeId]) || 0), 0, 2);
    nodes[edge.a] += mode;
    nodes[edge.b] += mode;
  }
  return nodes;
}

function wiringSolved(wiringState, unlockedMechanics) {
  const modes = wiringState && wiringState.edgeModes && typeof wiringState.edgeModes === "object"
    ? wiringState.edgeModes
    : {};
  const charges = wiringNodeCharges(wiringState);
  for (const node of Object.keys(SYNTH_WIRING_NODE_TARGETS)) {
    if (charges[node] !== SYNTH_WIRING_NODE_TARGETS[node]) {
      return false;
    }
  }
  const hasBridge = synthEffectiveUnlocks({ unlockedMechanics })["link-bridge"];
  if (hasBridge) {
    for (const edgeId of SYNTH_REQUIRED_BRIDGE_EDGES) {
      if (clamp(Math.floor(Number(modes[edgeId]) || 0), 0, 2) === 0) {
        return false;
      }
    }
  }
  const highStateCount = [...SYNTH_BASE_EDGES, ...SYNTH_BRIDGE_EDGES].reduce((count, edge) => {
    const mode = clamp(Math.floor(Number(modes[edge.edgeId]) || 0), 0, 2);
    return count + (mode === 2 ? 1 : 0);
  }, 0);
  if (highStateCount < 2) {
    return false;
  }
  return true;
}

function expectedSealRotation(entry, unlockedMechanics) {
  void unlockedMechanics;
  if (!entry) {
    return 0;
  }
  return 0;
}

function sealOrientationSolved(runtime) {
  const synthesis = runtime.synthesis;
  const catalog = runtime.artifactPuzzleState.synthesisCatalog || [];
  const target = sealTargetFromCatalog(catalog);
  const seal = synthesis.sealAssemblyState;
  for (const expected of target) {
    const rotation = ((Math.floor(Number(seal.rotations && seal.rotations[expected.name]) || 0) % 4) + 4) % 4;
    if (rotation !== expectedSealRotation(expected, synthesis.unlockedMechanics)) {
      return false;
    }
  }
  return true;
}

function sealGroupingSolved(runtime) {
  const synthesis = runtime.synthesis;
  const catalog = runtime.artifactPuzzleState.synthesisCatalog || [];
  const target = sealTargetFromCatalog(catalog);
  const seal = synthesis.sealAssemblyState;
  if (!target.length) {
    return true;
  }
  const allPlaced = new Set();
  const tuneToGroup = {};
  for (const groupId of SYNTH_SEAL_GROUP_IDS) {
    const names = Array.isArray(seal.groups[groupId]) ? seal.groups[groupId] : [];
    if (!names.length) {
      return false;
    }
    let groupTune = "";
    for (const name of names) {
      if (allPlaced.has(name)) {
        return false;
      }
      allPlaced.add(name);
      const entry = synthCatalogEntry(runtime, name);
      if (!entry) {
        return false;
      }
      const tune = synthUnlockFromMeta(entry.meta);
      if (!groupTune) {
        groupTune = tune;
      } else if (groupTune !== tune) {
        return false;
      }
    }
    if (!groupTune) {
      return false;
    }
    if (tuneToGroup[groupTune]) {
      return false;
    }
    tuneToGroup[groupTune] = groupId;
  }
  if (allPlaced.size !== target.length) {
    return false;
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
      synthesis: defaultSynthesisState([]),
      artifactPuzzleState: {
        synthesisCatalog: [],
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
    const rawTarget = safeText(action.targetPhase).toLowerCase();
    const [target, synthStepRaw] = rawTarget.split(":");
    const synthStep = clamp(Math.floor(Number(synthStepRaw) || 1), 1, 4);
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
      synthesis: defaultSynthesisState(current.artifactPuzzleState.synthesisCatalog || []),
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
      const stageByStep = [SYNTH_STAGE_1, SYNTH_STAGE_2, SYNTH_STAGE_3, SYNTH_STAGE_4];
      const unlockedMechanics = {
        rotate: true,
        swap: synthStep >= 2,
        reflect: synthStep >= 3,
        "link-bridge": synthStep >= 4,
      };
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
        synthesis: {
          ...forcedEntry.synthesis,
          currentStage: stageByStep[synthStep - 1],
          stageSolvedFlags: {
            ...forcedEntry.synthesis.stageSolvedFlags,
            [SYNTH_STAGE_1]: synthStep > 1,
            [SYNTH_STAGE_2]: synthStep > 2,
            [SYNTH_STAGE_3]: synthStep > 3,
          },
          unlockedMechanics,
          statusMessage: `Dev skip active: ${SYNTH_STAGE_LABELS[stageByStep[synthStep - 1]] || "Synthesis"} ready.`,
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
        synthesis: {
          ...forcedEntry.synthesis,
          currentStage: SYNTH_STAGE_SOLVED,
          stageSolvedFlags: {
            [SYNTH_STAGE_1]: true,
            [SYNTH_STAGE_2]: true,
            [SYNTH_STAGE_3]: true,
            [SYNTH_STAGE_4]: true,
          },
          statusMessage: "Synthesis complete.",
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

  if (action.type === "fin01-synth-lock-place" && current.phase === PHASE_SYNTHESIS) {
    const slotId = safeText(action.slotId);
    const artifact = safeText(action.artifact);
    const slot = SYNTH_LOCK_SLOT_DEFS.find((entry) => entry.slotId === slotId);
    if (!slot) {
      return current;
    }
    if (!current.artifactPuzzleState.activeArtifacts.includes(artifact)) {
      return {
        ...current,
        synthesis: {
          ...current.synthesis,
          statusMessage: "Select an eligible artifact first.",
        },
      };
    }
    if (Object.values(current.synthesis.placedArtifacts.locking).includes(artifact)) {
      return {
        ...current,
        synthesis: {
          ...current.synthesis,
          statusMessage: "That artifact is already bound to another socket.",
        },
      };
    }
    const slotIndex = SYNTH_LOCK_SLOT_DEFS.findIndex((entry) => entry.slotId === slotId);
    const requiredPrevious = SYNTH_LOCK_SLOT_DEFS.slice(0, slotIndex).every(
      (entry) => Boolean(current.synthesis.unlockedMechanics[entry.unlock]),
    );
    if (!requiredPrevious) {
      return {
        ...current,
        synthesis: {
          ...current.synthesis,
          statusMessage: "That socket remains dormant until prior channels are aligned.",
        },
      };
    }
    const catalogEntry = synthCatalogEntry(current, artifact);
    if (!catalogEntry) {
      return current;
    }
    const unlock = synthUnlockFromMeta(catalogEntry.meta);
    if (unlock !== slot.unlock) {
      return {
        ...current,
        synthesis: {
          ...current.synthesis,
          statusMessage: "The socket rejects that resonance.",
        },
      };
    }
    const nextLocking = {
      ...current.synthesis.placedArtifacts.locking,
      [slotId]: artifact,
    };
    const nextUnlocked = {
      ...current.synthesis.unlockedMechanics,
      [unlock]: true,
    };
    const solvedStage = SYNTH_LOCK_SLOT_DEFS.every((entry) => Boolean(nextUnlocked[entry.unlock]));
    return {
      ...current,
      synthesis: {
        ...current.synthesis,
        placedArtifacts: {
          ...current.synthesis.placedArtifacts,
          locking: nextLocking,
        },
        unlockedMechanics: nextUnlocked,
        statusMessage: `Mechanic unlocked: ${SYNTH_MECHANIC_LABELS[unlock] || unlock}.`,
        stageSolvedFlags: {
          ...current.synthesis.stageSolvedFlags,
          [SYNTH_STAGE_1]: solvedStage,
        },
      },
      lastMessage: "",
    };
  }

  if (action.type === "fin01-synth-stage-next" && current.phase === PHASE_SYNTHESIS) {
    const from = safeText(action.fromStage);
    const currentStage = safeText(current.synthesis.currentStage);
    if (from !== currentStage) {
      return current;
    }
    if (from === SYNTH_STAGE_1 && !current.synthesis.stageSolvedFlags[SYNTH_STAGE_1]) {
      return {
        ...current,
        synthesis: {
          ...current.synthesis,
          statusMessage: "All four sockets must be aligned before the board will open.",
        },
      };
    }
    const order = [SYNTH_STAGE_1, SYNTH_STAGE_2, SYNTH_STAGE_3, SYNTH_STAGE_4];
    const idx = order.indexOf(currentStage);
    if (idx < 0 || idx >= order.length - 1) {
      return current;
    }
    return {
      ...current,
      synthesis: {
        ...current.synthesis,
        currentStage: order[idx + 1],
        statusMessage: "",
      },
      lastMessage: "",
    };
  }

  if (action.type === "fin01-synth-rotation-select" && current.phase === PHASE_SYNTHESIS) {
    if (current.synthesis.currentStage !== SYNTH_STAGE_2) {
      return current;
    }
    const clickedPieceId = safeText(action.pieceId);
    const clicked = synthesisPieceById(current, clickedPieceId);
    if (!clicked) {
      return current;
    }
    const selected = safeText(current.synthesis.rotationBoardState.selectedPieceId);
    if (current.synthesis.rotationBoardState.swapArmed && selected && selected !== clickedPieceId && synthEffectiveUnlocks(current.synthesis).swap) {
      const pieceA = synthesisPieceById(current, selected);
      const pieceB = clicked;
      if (!pieceA || !pieceB) {
        return current;
      }
      const pieces = current.synthesis.rotationBoardState.pieces.map((piece) => {
        if (piece.pieceId === selected) {
          return { ...piece, position: pieceB.position };
        }
        if (piece.pieceId === clickedPieceId) {
          return { ...piece, position: pieceA.position };
        }
        return piece;
      });
      return {
        ...current,
        synthesis: {
          ...current.synthesis,
          rotationBoardState: {
            ...current.synthesis.rotationBoardState,
            pieces,
            selectedPieceId: clickedPieceId,
            swapArmed: false,
            status: "Swap complete.",
          },
        },
      };
    }
    return {
      ...current,
      synthesis: {
        ...current.synthesis,
        rotationBoardState: {
          ...current.synthesis.rotationBoardState,
          selectedPieceId: clickedPieceId,
          status: "",
        },
      },
    };
  }

  if (action.type === "fin01-synth-rotation-toggle-swap" && current.phase === PHASE_SYNTHESIS) {
    if (current.synthesis.currentStage !== SYNTH_STAGE_2 || !synthEffectiveUnlocks(current.synthesis).swap) {
      return current;
    }
    const selected = safeText(current.synthesis.rotationBoardState.selectedPieceId);
    if (!selected) {
      return {
        ...current,
        synthesis: {
          ...current.synthesis,
          rotationBoardState: {
            ...current.synthesis.rotationBoardState,
            status: "Select a piece first, then arm swap.",
          },
        },
      };
    }
    const nextArmed = !current.synthesis.rotationBoardState.swapArmed;
    return {
      ...current,
      synthesis: {
        ...current.synthesis,
        rotationBoardState: {
          ...current.synthesis.rotationBoardState,
          swapArmed: nextArmed,
          status: nextArmed ? "Swap armed: click another piece." : "",
        },
      },
    };
  }

  if (action.type === "fin01-synth-rotation-rotate" && current.phase === PHASE_SYNTHESIS) {
    if (current.synthesis.currentStage !== SYNTH_STAGE_2 || !synthEffectiveUnlocks(current.synthesis).rotate) {
      return current;
    }
    const pieceId = safeText(action.pieceId || current.synthesis.rotationBoardState.selectedPieceId);
    const target = synthesisPieceById(current, pieceId);
    if (!target) {
      return current;
    }
    const pieces = rotateCoupledPieces(current.synthesis.rotationBoardState.pieces, target.position);
    return {
      ...current,
      synthesis: {
        ...current.synthesis,
        rotationBoardState: {
          ...current.synthesis.rotationBoardState,
          pieces,
          status: "",
        },
      },
    };
  }

  if (action.type === "fin01-synth-rotation-reflect" && current.phase === PHASE_SYNTHESIS) {
    if (current.synthesis.currentStage !== SYNTH_STAGE_2 || !synthEffectiveUnlocks(current.synthesis).reflect) {
      return current;
    }
    const pieceId = safeText(action.pieceId || current.synthesis.rotationBoardState.selectedPieceId);
    const target = synthesisPieceById(current, pieceId);
    if (!target) {
      return current;
    }
    const pieces = reflectCoupledPieces(current.synthesis.rotationBoardState.pieces, target.position);
    return {
      ...current,
      synthesis: {
        ...current.synthesis,
        rotationBoardState: {
          ...current.synthesis.rotationBoardState,
          pieces,
          status: "",
        },
      },
    };
  }

  if (action.type === "fin01-synth-rotation-commit" && current.phase === PHASE_SYNTHESIS) {
    if (current.synthesis.currentStage !== SYNTH_STAGE_2) {
      return current;
    }
    const solved = rotationSolved(current.synthesis.rotationBoardState, current.synthesis.unlockedMechanics);
    if (!solved) {
      return {
        ...current,
        synthesis: {
          ...current.synthesis,
          rotationBoardState: {
            ...current.synthesis.rotationBoardState,
            status: "Pattern mismatch detected. Reorient the lattice.",
          },
        },
      };
    }
    return {
      ...current,
      synthesis: {
        ...current.synthesis,
        currentStage: SYNTH_STAGE_3,
        stageSolvedFlags: {
          ...current.synthesis.stageSolvedFlags,
          [SYNTH_STAGE_2]: true,
        },
        statusMessage: "Rotation board locked. Wiring overlay engaged.",
      },
      lastMessage: "",
    };
  }

  if (action.type === "fin01-synth-wire-toggle" && current.phase === PHASE_SYNTHESIS) {
    if (current.synthesis.currentStage !== SYNTH_STAGE_3) {
      return current;
    }
    const edgeId = safeText(action.edgeId);
    const edge = [...SYNTH_BASE_EDGES, ...SYNTH_BRIDGE_EDGES].find((entry) => entry.edgeId === edgeId);
    if (!edge) {
      return current;
    }
    if (!synthEffectiveUnlocks(current.synthesis)["link-bridge"] && SYNTH_REQUIRED_BRIDGE_EDGES.has(edgeId)) {
      return {
        ...current,
        synthesis: {
          ...current.synthesis,
          wiringState: {
            ...current.synthesis.wiringState,
            status: "Bridge channel still dormant.",
          },
        },
      };
    }
    const currentMode = clamp(Math.floor(Number(current.synthesis.wiringState.edgeModes[edgeId]) || 0), 0, 2);
    const nextModes = {
      ...current.synthesis.wiringState.edgeModes,
      [edgeId]: (currentMode + 1) % 3,
    };
    return {
      ...current,
      synthesis: {
        ...current.synthesis,
        wiringState: {
          ...current.synthesis.wiringState,
          edgeModes: nextModes,
          status: "",
        },
      },
      lastMessage: "",
    };
  }

  if (action.type === "fin01-synth-wire-commit" && current.phase === PHASE_SYNTHESIS) {
    if (current.synthesis.currentStage !== SYNTH_STAGE_3) {
      return current;
    }
    const solved = wiringSolved(current.synthesis.wiringState, current.synthesis.unlockedMechanics);
    if (!solved) {
      return {
        ...current,
        synthesis: {
          ...current.synthesis,
          wiringState: {
            ...current.synthesis.wiringState,
            status: "Circuit incomplete. Critical nodes remain dark.",
          },
        },
      };
    }
    return {
      ...current,
      synthesis: {
        ...current.synthesis,
        currentStage: SYNTH_STAGE_4,
        stageSolvedFlags: {
          ...current.synthesis.stageSolvedFlags,
          [SYNTH_STAGE_3]: true,
        },
        statusMessage: "Circuit complete. Final seal assembly unlocked.",
      },
      lastMessage: "",
    };
  }

  if (action.type === "fin01-synth-seal-select" && current.phase === PHASE_SYNTHESIS) {
    if (current.synthesis.currentStage !== SYNTH_STAGE_4) {
      return current;
    }
    const artifact = safeText(action.artifact);
    if (!current.artifactPuzzleState.activeArtifacts.includes(artifact)) {
      return current;
    }
    return {
      ...current,
      synthesis: {
        ...current.synthesis,
        sealAssemblyState: {
          ...current.synthesis.sealAssemblyState,
          selectedArtifact: artifact,
          status: "",
        },
      },
    };
  }

  if (action.type === "fin01-synth-seal-place" && current.phase === PHASE_SYNTHESIS) {
    if (current.synthesis.currentStage !== SYNTH_STAGE_4) {
      return current;
    }
    if (current.synthesis.sealAssemblyState.phase !== "group") {
      return current;
    }
    const groupId = safeText(action.groupId);
    const selectedArtifact = safeText(current.synthesis.sealAssemblyState.selectedArtifact);
    if (!selectedArtifact || !SYNTH_SEAL_GROUP_IDS.includes(groupId)) {
      return current;
    }
    const groups = {};
    for (const id of SYNTH_SEAL_GROUP_IDS) {
      const items = Array.isArray(current.synthesis.sealAssemblyState.groups[id])
        ? [...current.synthesis.sealAssemblyState.groups[id]]
        : [];
      groups[id] = items.filter((name) => name !== selectedArtifact);
    }
    if (!groups[groupId].includes(selectedArtifact)) {
      groups[groupId].push(selectedArtifact);
    }
    return {
      ...current,
      synthesis: {
        ...current.synthesis,
        sealAssemblyState: {
          ...current.synthesis.sealAssemblyState,
          groups,
          groupSelected: groupId,
          status: "",
        },
      },
    };
  }

  if (action.type === "fin01-synth-seal-remove" && current.phase === PHASE_SYNTHESIS) {
    if (current.synthesis.currentStage !== SYNTH_STAGE_4 || current.synthesis.sealAssemblyState.phase !== "group") {
      return current;
    }
    const groupId = safeText(action.groupId);
    const artifact = safeText(action.artifact);
    if (!SYNTH_SEAL_GROUP_IDS.includes(groupId) || !artifact) {
      return current;
    }
    const groups = {};
    for (const id of SYNTH_SEAL_GROUP_IDS) {
      const items = Array.isArray(current.synthesis.sealAssemblyState.groups[id])
        ? [...current.synthesis.sealAssemblyState.groups[id]]
        : [];
      if (id === groupId) {
        groups[id] = items.filter((name) => name !== artifact);
      } else {
        groups[id] = items;
      }
    }
    return {
      ...current,
      synthesis: {
        ...current.synthesis,
        sealAssemblyState: {
          ...current.synthesis.sealAssemblyState,
          groups,
          status: "",
        },
      },
    };
  }

  if (action.type === "fin01-synth-seal-rotate" && current.phase === PHASE_SYNTHESIS) {
    if (current.synthesis.currentStage !== SYNTH_STAGE_4 || !synthEffectiveUnlocks(current.synthesis).rotate) {
      return current;
    }
    const artifact = safeText(action.artifact || current.synthesis.sealAssemblyState.selectedArtifact);
    if (!artifact || !Object.prototype.hasOwnProperty.call(current.synthesis.sealAssemblyState.rotations, artifact)) {
      return current;
    }
    const currentRotation = ((Math.floor(Number(current.synthesis.sealAssemblyState.rotations[artifact]) || 0) % 4) + 4) % 4;
    return {
      ...current,
      synthesis: {
        ...current.synthesis,
        sealAssemblyState: {
          ...current.synthesis.sealAssemblyState,
          rotations: {
            ...current.synthesis.sealAssemblyState.rotations,
            [artifact]: (currentRotation + 1) % 4,
          },
          status: "",
        },
      },
    };
  }

  if (action.type === "fin01-synth-seal-commit" && current.phase === PHASE_SYNTHESIS) {
    if (current.synthesis.currentStage !== SYNTH_STAGE_4) {
      return current;
    }
    if (current.synthesis.sealAssemblyState.phase === "orient") {
      const solvedOrient = sealOrientationSolved(current);
      if (!solvedOrient) {
        return {
          ...current,
          synthesis: {
            ...current.synthesis,
            sealAssemblyState: {
              ...current.synthesis.sealAssemblyState,
              status: "Some sigils are still misaligned.",
            },
            statusMessage: "Seal orientation is incomplete.",
          },
        };
      }
      return {
        ...current,
        synthesis: {
          ...current.synthesis,
          sealAssemblyState: {
            ...current.synthesis.sealAssemblyState,
            phase: "group",
            status: "",
          },
          statusMessage: "Orientation complete. Group sigils by matching tune.",
        },
      };
    }
    const solved = sealGroupingSolved(current);
    if (!solved) {
      return {
        ...current,
        synthesis: {
          ...current.synthesis,
          sealAssemblyState: {
            ...current.synthesis.sealAssemblyState,
            status: "Grouping mismatch. Each circle must contain one tune only.",
          },
          statusMessage: "Final seal did not converge.",
        },
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
      synthesis: {
        ...current.synthesis,
        currentStage: SYNTH_STAGE_SOLVED,
        stageSolvedFlags: {
          ...current.synthesis.stageSolvedFlags,
          [SYNTH_STAGE_4]: true,
        },
        statusMessage: "Synthesis complete. Convergence sealed.",
      },
      artifactPuzzleState: {
        ...current.artifactPuzzleState,
        synthesisSolved: true,
      },
      lastMessage: "Convergence complete. The final proof route opens.",
    };
  }

  if (action.type === "fin01-synth-jump-stage" && current.phase === PHASE_SYNTHESIS) {
    const targetStage = safeText(action.targetStage);
    if (![SYNTH_STAGE_1, SYNTH_STAGE_4].includes(targetStage)) {
      return current;
    }
    if (targetStage === SYNTH_STAGE_4 && (!current.synthesis.stageSolvedFlags[SYNTH_STAGE_2] || !current.synthesis.stageSolvedFlags[SYNTH_STAGE_3])) {
      return current;
    }
    return {
      ...current,
      synthesis: {
        ...current.synthesis,
        currentStage: targetStage,
        statusMessage: targetStage === SYNTH_STAGE_1
          ? "Reviewing lock tunes."
          : "Returned to seal assembly.",
      },
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
        <button type="button" class="ghost" data-node-id="${NODE_ID}" data-node-action="fin01-dev-skip-phase" data-target-phase="${PHASE_SYNTHESIS}:2">Synth-2</button>
        <button type="button" class="ghost" data-node-id="${NODE_ID}" data-node-action="fin01-dev-skip-phase" data-target-phase="${PHASE_SYNTHESIS}:3">Synth-3</button>
        <button type="button" class="ghost" data-node-id="${NODE_ID}" data-node-action="fin01-dev-skip-phase" data-target-phase="${PHASE_SYNTHESIS}:4">Synth-4</button>
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

function synthesisStageRailMarkup(synthesis) {
  const order = [SYNTH_STAGE_1, SYNTH_STAGE_2, SYNTH_STAGE_3, SYNTH_STAGE_4];
  const current = safeText(synthesis.currentStage);
  return `
    <section class="final01-synth-rail">
      ${order.map((stage, index) => {
        const solved = Boolean(synthesis.stageSolvedFlags[stage]);
        const active = current === stage;
        const classes = ["final01-synth-rail-step"];
        if (solved) {
          classes.push("is-solved");
        }
        if (active) {
          classes.push("is-active");
        }
        return `<article class="${classes.join(" ")}"><span>${index + 1}</span><p>${escapeHtml(SYNTH_STAGE_LABELS[stage])}</p></article>`;
      }).join("")}
    </section>
  `;
}

function synthesisLockingStageMarkup(runtime, selectedArtifact) {
  const synthesis = runtime.synthesis;
  const catalog = runtime.artifactPuzzleState.synthesisCatalog || [];
  const stageSolved = Boolean(synthesis.stageSolvedFlags[SYNTH_STAGE_1]);
  const canReturnToSeal = Boolean(synthesis.stageSolvedFlags[SYNTH_STAGE_2] && synthesis.stageSolvedFlags[SYNTH_STAGE_3]);
  const selectedEntry = selectedArtifact ? synthCatalogEntry(runtime, selectedArtifact) : null;
  const selectedUnlock = selectedEntry ? synthUnlockFromMeta(selectedEntry.meta) : "";
  const slots = SYNTH_LOCK_SLOT_DEFS.map((slot, index) => {
    const locked = index > 0 && !synthesis.unlockedMechanics[SYNTH_LOCK_SLOT_DEFS[index - 1].unlock];
    const filledArtifact = synthesis.placedArtifacts.locking[slot.slotId];
    const ready = !filledArtifact && !locked && selectedArtifact && selectedUnlock === slot.unlock;
    return {
      filled: Boolean(filledArtifact),
      ready: Boolean(ready),
      clickable: !locked,
      title: filledArtifact
        ? `${SYNTH_MECHANIC_LABELS[slot.unlock]} unlocked by ${filledArtifact}`
        : locked
          ? "Requires prior socket alignment."
          : `${SYNTH_MECHANIC_LABELS[slot.unlock]} socket`,
      symbolHtml: filledArtifact
        ? renderArtifactSymbol({ artifactName: filledArtifact, className: "slot-ring-symbol artifact-symbol" })
        : "",
      attrs: {
        "data-node-id": NODE_ID,
        "data-node-action": "fin01-synth-lock-place",
        "data-slot-id": slot.slotId,
        "data-selected-artifact": selectedArtifact,
      },
    };
  });

  const available = catalog.filter((entry) => !Object.values(synthesis.placedArtifacts.locking).includes(entry.name));
  return `
    <section class="final01-synth-stage">
      ${renderSlotRing({
        slots,
        className: "final01-synth-lock-ring",
        radiusPct: 42,
        centerHtml: `<div class="final01-synth-core">${renderRegionSymbol({ symbolKey: FINAL_SYMBOL_KEY, className: "slot-ring-center-symbol final01-center-symbol" })}</div>`,
        ariaLabel: "Synthesis locking ring",
      })}
      <p class="muted">Each socket accepts a matching resonance artifact. Fill all four sockets to open the rotation board.</p>
      ${
        selectedArtifact
          ? `<p class="muted">Selected artifact tunes: ${escapeHtml(SYNTH_MECHANIC_LABELS[selectedUnlock] || "No resonance")}</p>`
          : ""
      }
      <div class="final01-synth-chip-row">
        ${available.length
          ? available.map((entry) => `<span class="final01-synth-chip">${renderArtifactSymbol({ artifactName: entry.name, className: "slot-ring-symbol artifact-symbol" })}<span>${escapeHtml(entry.name)}</span></span>`).join("")
          : `<span class="muted">No additional finale artifacts detected. Echo fragments are active.</span>`}
      </div>
      <div class="toolbar">
        <button type="button" data-node-id="${NODE_ID}" data-node-action="fin01-synth-stage-next" data-from-stage="${SYNTH_STAGE_1}" ${stageSolved ? "" : "disabled"}>Proceed to Rotation Board</button>
        ${
          canReturnToSeal
            ? `<button type="button" class="ghost" data-node-id="${NODE_ID}" data-node-action="fin01-synth-jump-stage" data-target-stage="${SYNTH_STAGE_4}">Return to Seal Assembly</button>`
            : ""
        }
      </div>
    </section>
  `;
}

function synthesisRotationStageMarkup(runtime) {
  const synthesis = runtime.synthesis;
  const board = synthesis.rotationBoardState;
  const sorted = [...board.pieces].sort((a, b) => a.position - b.position);
  const selected = safeText(board.selectedPieceId);
  const unlocks = synthEffectiveUnlocks(synthesis);
  const targetByPosition = Object.fromEntries(SYNTH_ROTATION_TARGETS.map((entry) => [entry.requiredPosition, entry]));
  const catalog = sealTargetFromCatalog(runtime.artifactPuzzleState.synthesisCatalog || []);
  const pieceSymbolMap = Object.fromEntries(
    SYNTH_ROTATION_TARGETS.map((target, index) => [target.pieceId, catalog[index % Math.max(1, catalog.length)] ? catalog[index % Math.max(1, catalog.length)].name : "Convergence Echo Alpha"]),
  );
  return `
    <section class="final01-synth-stage">
      <section class="final01-rotation-visual">
        <section class="final01-rotation-goal-ring">
          ${Array.from({ length: SYNTH_ROTATION_TARGETS.length }, (_, position) => {
            const target = targetByPosition[position];
            const rotDeg = (((Number(target.requiredRotation) || 0) % 4) + 4) % 4 * 90;
            const mirrorScale = target.requiredMirror ? -1 : 1;
            const artifact = pieceSymbolMap[target.pieceId] || "Convergence Echo Alpha";
            return `<span class="final01-rotation-goal-slot" style="--idx:${position};"><span class="final01-rotation-sigil final01-rotation-glyph-goal" style="transform: rotate(${rotDeg}deg) scaleX(${mirrorScale});">${renderArtifactSymbol({ artifactName: artifact, className: "artifact-symbol" })}</span></span>`;
          }).join("")}
          <div class="final01-rotation-goal-core">Goal</div>
        </section>
      </section>
      <section class="final01-rotation-grid">
        ${sorted.map((piece) => {
          const classes = ["final01-rotation-piece"];
          if (piece.pieceId === selected) {
            classes.push("is-selected");
          }
          if (piece.mirrored) {
            classes.push("is-mirrored");
          }
          if (board.swapArmed && selected && selected !== piece.pieceId) {
            classes.push("is-swap-target");
          }
          const rotDeg = (((Number(piece.rotation) || 0) % 4) + 4) % 4 * 90;
          const mirrorScale = piece.mirrored ? -1 : 1;
          const artifact = pieceSymbolMap[piece.pieceId] || "Convergence Echo Alpha";
          return `
            <button
              type="button"
              class="${classes.join(" ")}"
              data-node-id="${NODE_ID}"
              data-node-action="fin01-synth-rotation-select"
              data-piece-id="${escapeHtml(piece.pieceId)}"
              aria-label="${escapeHtml(`Rotation piece ${piece.pieceId}`)}"
            >
              <span class="final01-rotation-sigil-wrap">
                <span class="final01-rotation-sigil" style="transform: rotate(${rotDeg}deg) scaleX(${mirrorScale});">
                  ${renderArtifactSymbol({ artifactName: artifact, className: "artifact-symbol" })}
                </span>
              </span>
            </button>
          `;
        }).join("")}
      </section>
      <p class="muted">Match each outer piece to the goal ring. Rotate/Reflect apply to linked slots as well.</p>
      <div class="toolbar">
        <button type="button" data-node-id="${NODE_ID}" data-node-action="fin01-synth-rotation-rotate" data-piece-id="${escapeHtml(selected)}" ${selected && unlocks.rotate ? "" : "disabled"}>Rotate</button>
        <button type="button" data-node-id="${NODE_ID}" data-node-action="fin01-synth-rotation-reflect" data-piece-id="${escapeHtml(selected)}" ${selected && unlocks.reflect ? "" : "disabled"}>Reflect</button>
        <button type="button" data-node-id="${NODE_ID}" data-node-action="fin01-synth-rotation-toggle-swap" ${unlocks.swap ? "" : "disabled"}>${board.swapArmed ? "Cancel Swap" : "Arm Swap"}</button>
        <button type="button" data-node-id="${NODE_ID}" data-node-action="fin01-synth-rotation-commit">Commit Rotation Board</button>
      </div>
      ${board.status ? `<p class="muted">${escapeHtml(board.status)}</p>` : ""}
    </section>
  `;
}

function synthesisWiringStageMarkup(runtime) {
  const synthesis = runtime.synthesis;
  const unlocks = synthEffectiveUnlocks(synthesis);
  const edges = unlocks["link-bridge"] ? [...SYNTH_BASE_EDGES, ...SYNTH_BRIDGE_EDGES] : SYNTH_BASE_EDGES;
  const charges = wiringNodeCharges(synthesis.wiringState);
  const modeLabel = (mode) => mode === 2 ? "II" : mode === 1 ? "I" : "0";
  return `
    <section class="final01-synth-stage">
      <section class="final01-wire-grid">
        ${edges.map((edge) => {
          const mode = clamp(Math.floor(Number(synthesis.wiringState.edgeModes[edge.edgeId]) || 0), 0, 2);
          const active = mode > 0;
          return `
            <button
              type="button"
              class="final01-wire-edge ${active ? "is-active" : ""} ${mode === 2 ? "is-boosted" : ""}"
              data-node-id="${NODE_ID}"
              data-node-action="fin01-synth-wire-toggle"
              data-edge-id="${escapeHtml(edge.edgeId)}"
            >
              <span>${escapeHtml(edge.a)} - ${escapeHtml(edge.b)}</span>
              <small>State ${modeLabel(mode)}</small>
            </button>
          `;
        }).join("")}
      </section>
      <section class="final01-wire-targets">
        ${Object.keys(SYNTH_WIRING_NODE_TARGETS).map((node) => `
          <article class="final01-wire-node ${charges[node] === SYNTH_WIRING_NODE_TARGETS[node] ? "is-hit" : ""}">
            <span>${escapeHtml(node)}</span>
            <small>${escapeHtml(String(charges[node]))} / ${escapeHtml(String(SYNTH_WIRING_NODE_TARGETS[node]))}</small>
          </article>
        `).join("")}
      </section>
      <div class="toolbar">
        <button type="button" data-node-id="${NODE_ID}" data-node-action="fin01-synth-wire-commit">Commit Wiring Overlay</button>
        <button type="button" class="ghost" data-node-id="${NODE_ID}" data-node-action="fin01-synth-jump-stage" data-target-stage="${SYNTH_STAGE_1}">Review Locking Ring</button>
      </div>
      ${synthesis.wiringState.status ? `<p class="muted">${escapeHtml(synthesis.wiringState.status)}</p>` : ""}
    </section>
  `;
}

function synthesisSealStageMarkup(runtime) {
  const synthesis = runtime.synthesis;
  const seal = synthesis.sealAssemblyState;
  const target = sealTargetFromCatalog(runtime.artifactPuzzleState.synthesisCatalog || []);
  const selected = safeText(seal.selectedArtifact);
  const groupedSet = new Set(SYNTH_SEAL_GROUP_IDS.flatMap((groupId) => seal.groups[groupId] || []));
  const phase = seal.phase === "group" ? "group" : "orient";
  const ungrouped = target.filter((entry) => !groupedSet.has(entry.name));
  return `
    <section class="final01-synth-stage">
      ${
        phase === "orient"
          ? `
            <section class="final01-synth-chip-row final01-seal-orient-row">
              ${target.map((entry) => {
                const rot = ((Math.floor(Number(seal.rotations[entry.name]) || 0) % 4) + 4) % 4;
                const isSelected = selected === entry.name;
                return `
                  <button
                    type="button"
                    class="final01-seal-piece ${isSelected ? "is-selected" : ""}"
                    data-node-id="${NODE_ID}"
                    data-node-action="fin01-synth-seal-select"
                    data-artifact="${escapeHtml(entry.name)}"
                    aria-label="${escapeHtml(`Seal sigil ${entry.name}`)}"
                  >
                    <span class="final01-seal-symbol-wrap" style="transform: rotate(${rot * 90}deg);">
                      ${renderArtifactSymbol({ artifactName: entry.name, className: "slot-ring-symbol artifact-symbol" })}
                    </span>
                  </button>
                `;
              }).join("")}
            </section>
            <div class="toolbar">
              <button type="button" data-node-id="${NODE_ID}" data-node-action="fin01-synth-seal-rotate" data-artifact="${escapeHtml(selected)}" ${selected ? "" : "disabled"}>Rotate Selected Sigil</button>
              <button type="button" data-node-id="${NODE_ID}" data-node-action="fin01-synth-seal-commit">Lock Orientation</button>
              <button type="button" class="ghost" data-node-id="${NODE_ID}" data-node-action="fin01-synth-jump-stage" data-target-stage="${SYNTH_STAGE_1}">Review Locking Ring</button>
            </div>
          `
          : `
            <section class="final01-seal-groups">
              ${SYNTH_SEAL_GROUP_IDS.map((groupId) => `
                <article class="final01-seal-group-circle">
                  <button
                    type="button"
                    class="final01-seal-group-drop"
                    data-node-id="${NODE_ID}"
                    data-node-action="fin01-synth-seal-place"
                    data-group-id="${escapeHtml(groupId)}"
                    ${selected ? "" : "disabled"}
                  >
                    <span>${escapeHtml(groupId.replace("circle-", "Circle "))}</span>
                  </button>
                  <div class="final01-seal-group-items">
                    ${(seal.groups[groupId] || []).map((artifact) => `
                      <button
                        type="button"
                        class="final01-seal-group-item"
                        data-node-id="${NODE_ID}"
                        data-node-action="fin01-synth-seal-remove"
                        data-group-id="${escapeHtml(groupId)}"
                        data-artifact="${escapeHtml(artifact)}"
                      >
                        ${renderArtifactSymbol({ artifactName: artifact, className: "slot-ring-symbol artifact-symbol" })}
                      </button>
                    `).join("")}
                  </div>
                </article>
              `).join("")}
            </section>
            <section class="final01-synth-chip-row final01-seal-orient-row">
              ${ungrouped.map((entry) => `
                <button
                  type="button"
                  class="final01-seal-piece ${selected === entry.name ? "is-selected" : ""}"
                  data-node-id="${NODE_ID}"
                  data-node-action="fin01-synth-seal-select"
                  data-artifact="${escapeHtml(entry.name)}"
                >
                  ${renderArtifactSymbol({ artifactName: entry.name, className: "slot-ring-symbol artifact-symbol" })}
                </button>
              `).join("")}
            </section>
            <div class="toolbar">
              <button type="button" data-node-id="${NODE_ID}" data-node-action="fin01-synth-seal-commit">Resolve Synthesis</button>
              <button type="button" class="ghost" data-node-id="${NODE_ID}" data-node-action="fin01-synth-jump-stage" data-target-stage="${SYNTH_STAGE_1}">Review Locking Ring</button>
            </div>
          `
      }
      ${seal.status ? `<p class="muted">${escapeHtml(seal.status)}</p>` : ""}
    </section>
  `;
}

function synthesisMarkup(runtime, context) {
  const synthesis = runtime.synthesis;
  const selectedArtifact = safeText(context.selectedArtifactReward);
  let stageBody = "";
  if (synthesis.currentStage === SYNTH_STAGE_1) {
    stageBody = synthesisLockingStageMarkup(runtime, selectedArtifact);
  } else if (synthesis.currentStage === SYNTH_STAGE_2) {
    stageBody = synthesisRotationStageMarkup(runtime);
  } else if (synthesis.currentStage === SYNTH_STAGE_3) {
    stageBody = synthesisWiringStageMarkup(runtime);
  } else {
    stageBody = synthesisSealStageMarkup(runtime);
  }
  return `
    <section class="card final01-card">
      <h3>Phase E: Synthesis</h3>
      ${synthesisStageRailMarkup(synthesis)}
      <section class="final01-synth-status"><p>${escapeHtml(synthesis.statusMessage || " ")}</p></section>
      ${stageBody}
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
            ? synthesisMarkup(runtime, context)
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
  if (actionName === "fin01-synth-lock-place") {
    return {
      type: "fin01-synth-lock-place",
      slotId: element.getAttribute("data-slot-id") || "",
      artifact: element.getAttribute("data-selected-artifact") || "",
      at: Date.now(),
    };
  }
  if (actionName === "fin01-synth-stage-next") {
    return {
      type: "fin01-synth-stage-next",
      fromStage: element.getAttribute("data-from-stage") || "",
      at: Date.now(),
    };
  }
  if (actionName === "fin01-synth-rotation-select") {
    return {
      type: "fin01-synth-rotation-select",
      pieceId: element.getAttribute("data-piece-id") || "",
      at: Date.now(),
    };
  }
  if (actionName === "fin01-synth-rotation-rotate") {
    return {
      type: "fin01-synth-rotation-rotate",
      pieceId: element.getAttribute("data-piece-id") || "",
      at: Date.now(),
    };
  }
  if (actionName === "fin01-synth-rotation-reflect") {
    return {
      type: "fin01-synth-rotation-reflect",
      pieceId: element.getAttribute("data-piece-id") || "",
      at: Date.now(),
    };
  }
  if (actionName === "fin01-synth-rotation-toggle-swap") {
    return { type: "fin01-synth-rotation-toggle-swap", at: Date.now() };
  }
  if (actionName === "fin01-synth-rotation-commit") {
    return { type: "fin01-synth-rotation-commit", at: Date.now() };
  }
  if (actionName === "fin01-synth-wire-toggle") {
    return {
      type: "fin01-synth-wire-toggle",
      edgeId: element.getAttribute("data-edge-id") || "",
      at: Date.now(),
    };
  }
  if (actionName === "fin01-synth-wire-commit") {
    return { type: "fin01-synth-wire-commit", at: Date.now() };
  }
  if (actionName === "fin01-synth-seal-select") {
    return {
      type: "fin01-synth-seal-select",
      artifact: element.getAttribute("data-artifact") || "",
      at: Date.now(),
    };
  }
  if (actionName === "fin01-synth-seal-place") {
    return {
      type: "fin01-synth-seal-place",
      groupId: element.getAttribute("data-group-id") || "",
      at: Date.now(),
    };
  }
  if (actionName === "fin01-synth-seal-remove") {
    return {
      type: "fin01-synth-seal-remove",
      groupId: element.getAttribute("data-group-id") || "",
      artifact: element.getAttribute("data-artifact") || "",
      at: Date.now(),
    };
  }
  if (actionName === "fin01-synth-seal-rotate") {
    return {
      type: "fin01-synth-seal-rotate",
      artifact: element.getAttribute("data-artifact") || "",
      at: Date.now(),
    };
  }
  if (actionName === "fin01-synth-seal-commit") {
    return { type: "fin01-synth-seal-commit", at: Date.now() };
  }
  if (actionName === "fin01-synth-jump-stage") {
    return {
      type: "fin01-synth-jump-stage",
      targetStage: element.getAttribute("data-target-stage") || "",
      at: Date.now(),
    };
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
