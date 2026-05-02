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
  madra: 350000,
  soulfire: 140,
  clout: 5000,
  gold: 7000,
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
  "Edict of the Turning Knife": Object.freeze({ group: "doctrine", memory: true, synthesisOrder: 0, synthesisFamily: "doctrine", synthesisStageRole: "memory", synthesisMechanicUnlock: "rotate" }),
  "Accord of Borrowed Crowns": Object.freeze({ group: "doctrine", rhythm: true, synthesisOrder: 1, synthesisFamily: "doctrine", synthesisStageRole: "rhythm", synthesisMechanicUnlock: "swap" }),
  "Writ of the Glass Tribunal": Object.freeze({ group: "doctrine", crd: true, synthesisOrder: 2, synthesisFamily: "doctrine", synthesisStageRole: "combat", synthesisMechanicUnlock: "reflect" }),
  "Bridge-Supper Compact": Object.freeze({ group: "doctrine", worm: true, synthesisOrder: 3, synthesisFamily: "doctrine", synthesisStageRole: "combat", synthesisMechanicUnlock: "link-bridge" }),
  "Paradox Ferryman Token": Object.freeze({ group: "cipher", memory: true, synthesisOrder: 0, synthesisFamily: "cipher", synthesisStageRole: "memory", synthesisMechanicUnlock: "rotate" }),
  "Remainder Rattlekey": Object.freeze({ group: "cipher", rhythm: true, synthesisOrder: 1, synthesisFamily: "cipher", synthesisStageRole: "rhythm", synthesisMechanicUnlock: "swap" }),
  "Ringbreaker Lookingglass": Object.freeze({ group: "cipher", crd: true, synthesisOrder: 2, synthesisFamily: "cipher", synthesisStageRole: "combat", synthesisMechanicUnlock: "reflect" }),
  "Atlas Causeway Spike": Object.freeze({ group: "cipher", worm: true, synthesisOrder: 3, synthesisFamily: "cipher", synthesisStageRole: "combat", synthesisMechanicUnlock: "link-bridge" }),
  "Gyre of Modus Tollens": Object.freeze({ group: "proof", memory: true, synthesisOrder: 0, synthesisFamily: "proof", synthesisStageRole: "memory", synthesisMechanicUnlock: "rotate" }),
  "Clock of Chinese Lanterns": Object.freeze({ group: "proof", rhythm: true, synthesisOrder: 1, synthesisFamily: "proof", synthesisStageRole: "rhythm", synthesisMechanicUnlock: "swap" }),
  "Dihedral Oathmirror": Object.freeze({ group: "proof", crd: true, synthesisOrder: 2, synthesisFamily: "proof", synthesisStageRole: "combat", synthesisMechanicUnlock: "reflect" }),
  "Compass of Bent Roads": Object.freeze({ group: "proof", worm: true, synthesisOrder: 3, synthesisFamily: "proof", synthesisStageRole: "combat", synthesisMechanicUnlock: "link-bridge" }),
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
  [SYNTH_STAGE_1]: "Locking Ring",
  [SYNTH_STAGE_2]: "Rotation Board",
  [SYNTH_STAGE_3]: "Wiring Overlay",
  [SYNTH_STAGE_4]: "Seal Assembly",
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
const SYNTH_UNLOCK_TARGET_ORDER = Object.freeze([SYNTH_STAGE_2, SYNTH_STAGE_3, SYNTH_STAGE_4]);
const SYNTH_ROTATION_TARGETS = Object.freeze([
  Object.freeze({ pieceId: "p1", requiredPosition: 0, requiredRotation: 0, requiredMirror: false }),
  Object.freeze({ pieceId: "p2", requiredPosition: 1, requiredRotation: 1, requiredMirror: true }),
  Object.freeze({ pieceId: "p3", requiredPosition: 2, requiredRotation: 2, requiredMirror: false }),
  Object.freeze({ pieceId: "p4", requiredPosition: 3, requiredRotation: 3, requiredMirror: false }),
  Object.freeze({ pieceId: "p5", requiredPosition: 4, requiredRotation: 1, requiredMirror: true }),
  Object.freeze({ pieceId: "p6", requiredPosition: 5, requiredRotation: 2, requiredMirror: false }),
]);
const SYNTH_ROTATION_LINKS_BY_POSITION = Object.freeze({
  0: Object.freeze([2, 4]),
  1: Object.freeze([3, 5]),
  2: Object.freeze([1, 3]),
  3: Object.freeze([0, 2]),
  4: Object.freeze([1, 5]),
  5: Object.freeze([0, 4]),
});
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
const SYNTH_WIRE_MODE_MAX = 3;
const SYNTH_SEAL_GROUP_LAYOUT = Object.freeze({
  "circle-1": Object.freeze({ x: 24, y: 28 }),
  "circle-2": Object.freeze({ x: 76, y: 28 }),
  "circle-3": Object.freeze({ x: 24, y: 72 }),
  "circle-4": Object.freeze({ x: 76, y: 72 }),
});
const SYNTH_SEAL_GROUP_DROP_RADIUS = 17;
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
  if (
    !name ||
    name === HARD_LOCK_ARTIFACTS.box ||
    name === HARD_LOCK_ARTIFACTS.cookbook ||
    name === "Wave-III Passkey" ||
    name === "Wave 3 Passkey"
  ) {
    return false;
  }
  return Boolean(LATE_ARTIFACT_METADATA[name]);
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
      const echoSeed = SYNTH_ECHO_ARTIFACTS.find((entry) => !source.some((existing) => safeText(existing.name) === safeText(entry.name)));
      if (!echoSeed) {
        continue;
      }
      const meta = {
        ...synthMetaForArtifact(echoSeed.name, echoSeed),
        synthesisMechanicUnlock: mechanic,
        synthesisStageRole: mechanic === "rotate" ? "memory" : mechanic === "swap" ? "rhythm" : "combat",
      };
      source.push({
        name: echoSeed.name,
        source: echoSeed.source,
        section: echoSeed.section,
        meta,
      });
      counts[mechanic] = 1;
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

function deterministicShuffle(source, seedText) {
  const list = Array.isArray(source) ? [...source] : [];
  let seed = seededHash(seedText);
  for (let index = list.length - 1; index > 0; index -= 1) {
    seed = Math.imul(seed ^ (index + 31), 1664525) + 1013904223;
    const swapIndex = Math.abs(seed >>> 0) % (index + 1);
    const temp = list[index];
    list[index] = list[swapIndex];
    list[swapIndex] = temp;
  }
  return list;
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
  const scrambled = SYNTH_ROTATION_TARGETS.map((target) => ({
    pieceId: target.pieceId,
    position: target.requiredPosition,
    rotation: target.requiredRotation,
    mirrored: target.requiredMirror,
  }));
  const operations = 72;
  for (let step = 0; step < operations; step += 1) {
    const roll = Math.random();
    if (roll < 0.38) {
      const anchor = Math.floor(Math.random() * SYNTH_ROTATION_TARGETS.length);
      const rotated = rotateCoupledPieces(scrambled, anchor);
      for (let i = 0; i < scrambled.length; i += 1) {
        scrambled[i] = rotated[i];
      }
      continue;
    }
    if (roll < 0.66) {
      const anchor = Math.floor(Math.random() * SYNTH_ROTATION_TARGETS.length);
      const reflected = reflectCoupledPieces(scrambled, anchor);
      for (let i = 0; i < scrambled.length; i += 1) {
        scrambled[i] = reflected[i];
      }
      continue;
    }
    const first = Math.floor(Math.random() * SYNTH_ROTATION_TARGETS.length);
    let second = Math.floor(Math.random() * SYNTH_ROTATION_TARGETS.length);
    if (second === first) {
      second = (second + 1) % SYNTH_ROTATION_TARGETS.length;
    }
    const firstPiece = scrambled.find((piece) => piece.position === first);
    const secondPiece = scrambled.find((piece) => piece.position === second);
    if (!firstPiece || !secondPiece) {
      continue;
    }
    const temp = firstPiece.position;
    firstPiece.position = secondPiece.position;
    secondPiece.position = temp;
  }
  if (rotationSolved({ pieces: scrambled }, { rotate: true, reflect: true, swap: true, "link-bridge": true })) {
    const fallback = rotateCoupledPieces(scrambled, 0);
    for (let i = 0; i < scrambled.length; i += 1) {
      scrambled[i] = fallback[i];
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
    selectedPieceId: safeText(source.selectedPieceId) || (pieces[0] ? pieces[0].pieceId : ""),
    swapArmed: Boolean(source.swapArmed),
    status: safeText(source.status),
  };
}

function defaultWiringState() {
  return {
    edgeModes: Object.fromEntries([...SYNTH_BASE_EDGES, ...SYNTH_BRIDGE_EDGES].map((edge) => [edge.edgeId, 0])),
    solutionModes: {},
    nodeTargets: {},
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
  const solutionModes = source.solutionModes && typeof source.solutionModes === "object"
    ? source.solutionModes
    : {};
  const nodeTargets = source.nodeTargets && typeof source.nodeTargets === "object"
    ? source.nodeTargets
    : {};
  const normalizedModes = {};
  const normalizedSolution = {};
  for (const entry of [...SYNTH_BASE_EDGES, ...SYNTH_BRIDGE_EDGES]) {
    if (Number.isFinite(Number(edgeModes[entry.edgeId]))) {
      normalizedModes[entry.edgeId] = clamp(Math.floor(Number(edgeModes[entry.edgeId])), 0, SYNTH_WIRE_MODE_MAX);
    } else if (legacyActiveEdges[entry.edgeId]) {
      normalizedModes[entry.edgeId] = 1;
    } else {
      normalizedModes[entry.edgeId] = fallback.edgeModes[entry.edgeId];
    }
    if (Number.isFinite(Number(solutionModes[entry.edgeId]))) {
      normalizedSolution[entry.edgeId] = clamp(Math.floor(Number(solutionModes[entry.edgeId])), 0, SYNTH_WIRE_MODE_MAX);
    } else {
      normalizedSolution[entry.edgeId] = 0;
    }
  }
  const normalizedTargets = {};
  for (const node of ["A", "B", "C", "D", "E", "F"]) {
    if (Number.isFinite(Number(nodeTargets[node]))) {
      normalizedTargets[node] = Math.max(0, Math.floor(Number(nodeTargets[node])));
    } else {
      normalizedTargets[node] = 0;
    }
  }
  return {
    edgeModes: normalizedModes,
    solutionModes: normalizedSolution,
    nodeTargets: normalizedTargets,
    status: safeText(source.status),
  };
}

function buildWiringSolution(seed, catalog) {
  const key = `${Number(seed) || 0}:${(Array.isArray(catalog) ? catalog : []).map((entry) => safeText(entry.name)).join("|")}`;
  const edges = deterministicShuffle([...SYNTH_BASE_EDGES, ...SYNTH_BRIDGE_EDGES], key);
  const modes = {};
  let cursor = seededHash(key);
  for (const edge of edges) {
    cursor = Math.imul(cursor ^ seededHash(edge.edgeId), 1103515245) + 12345;
    modes[edge.edgeId] = 1 + ((cursor >>> 0) % SYNTH_WIRE_MODE_MAX);
  }
  for (const edgeId of SYNTH_REQUIRED_BRIDGE_EDGES) {
    if (modes[edgeId] === 0) {
      modes[edgeId] = 1;
    }
  }
  const nodeTargets = Object.fromEntries(["A", "B", "C", "D", "E", "F"].map((node) => [node, 0]));
  for (const edge of [...SYNTH_BASE_EDGES, ...SYNTH_BRIDGE_EDGES]) {
    const mode = clamp(Math.floor(Number(modes[edge.edgeId]) || 0), 0, SYNTH_WIRE_MODE_MAX);
    nodeTargets[edge.a] += mode;
    nodeTargets[edge.b] += mode;
  }
  return {
    modes,
    nodeTargets,
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
  const positions = {};
  for (const [index, entry] of sealTarget.entries()) {
    const seeded = seededHash(entry.name);
    const raw = (seeded % 4 + 1) % 4;
    rotations[entry.name] = raw;
    const scatterSeed = seededHash(`${entry.name}:${index}:scatter`);
    const x = 12 + ((scatterSeed % 760) / 10);
    const y = 10 + ((Math.floor(scatterSeed / 13) % 760) / 10);
    positions[entry.name] = {
      x: clamp(x, 6, 94),
      y: clamp(y, 8, 92),
    };
  }
  return {
    selectedArtifact: sealTarget[0] ? sealTarget[0].name : "",
    positions,
    rotations,
    status: "",
  };
}

function normalizeSealAssemblyState(candidate, catalog) {
  const source = candidate && typeof candidate === "object" ? candidate : {};
  const fallback = defaultSealAssemblyState(catalog);
  const rotations = source.rotations && typeof source.rotations === "object" ? source.rotations : {};
  const positions = source.positions && typeof source.positions === "object" ? source.positions : {};
  const validNames = new Set((Array.isArray(catalog) ? catalog : []).map((entry) => entry.name));
  const normalizedRotations = {};
  const normalizedPositions = {};
  for (const entry of Array.isArray(catalog) ? catalog : []) {
    if (Number.isFinite(Number(rotations[entry.name]))) {
      normalizedRotations[entry.name] = ((Math.floor(Number(rotations[entry.name])) % 4) + 4) % 4;
    } else {
      normalizedRotations[entry.name] = fallback.rotations[entry.name] || 0;
    }
    const pos = positions[entry.name] && typeof positions[entry.name] === "object" ? positions[entry.name] : {};
    const rawX = Number(pos.x);
    const rawY = Number(pos.y);
    const fallbackPos = fallback.positions[entry.name] && typeof fallback.positions[entry.name] === "object"
      ? fallback.positions[entry.name]
      : { x: 50, y: 50 };
    normalizedPositions[entry.name] = {
      x: Number.isFinite(rawX) ? clamp(rawX, 6, 94) : clamp(Number(fallbackPos.x) || 50, 6, 94),
      y: Number.isFinite(rawY) ? clamp(rawY, 8, 92) : clamp(Number(fallbackPos.y) || 50, 8, 92),
    };
  }
  return {
    selectedArtifact: (() => {
      const selected = safeText(source.selectedArtifact);
      if (validNames.has(selected)) {
        return selected;
      }
      const first = Array.isArray(catalog) && catalog[0] ? safeText(catalog[0].name) : "";
      return validNames.has(first) ? first : "";
    })(),
    positions: normalizedPositions,
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
    stageUnlocks: {
      [SYNTH_STAGE_2]: false,
      [SYNTH_STAGE_3]: false,
      [SYNTH_STAGE_4]: false,
    },
    lockUsedArtifacts: [],
    lockSpinUntil: 0,
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
  const stageUnlocks = source.stageUnlocks && typeof source.stageUnlocks === "object"
    ? source.stageUnlocks
    : {};
  const used = Array.isArray(source.lockUsedArtifacts)
    ? source.lockUsedArtifacts.map((value) => safeText(value)).filter(Boolean)
    : [];
  return {
    currentStage,
    placedArtifacts: {
      locking,
    },
    unlockedMechanics: normalizeUnlockedMechanics(source.unlockedMechanics),
    stageUnlocks: {
      [SYNTH_STAGE_2]: Boolean(stageUnlocks[SYNTH_STAGE_2]),
      [SYNTH_STAGE_3]: Boolean(stageUnlocks[SYNTH_STAGE_3]),
      [SYNTH_STAGE_4]: Boolean(stageUnlocks[SYNTH_STAGE_4]),
    },
    lockUsedArtifacts: [...new Set(used.filter((name) => validNames.has(name)))],
    lockSpinUntil: Number.isFinite(Number(source.lockSpinUntil)) ? Number(source.lockSpinUntil) : 0,
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
  const normalizedSeed = Number.isFinite(Number(source.seed)) ? (Number(source.seed) >>> 0) : (Date.now() >>> 0);
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
    seed: normalizedSeed,
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
      const unlockState = {
        [SYNTH_STAGE_2]: Boolean(normalized.stageUnlocks[SYNTH_STAGE_2]),
        [SYNTH_STAGE_3]: Boolean(normalized.stageUnlocks[SYNTH_STAGE_3]),
        [SYNTH_STAGE_4]: Boolean(normalized.stageUnlocks[SYNTH_STAGE_4]),
      };
      const unlocksFromLocking = {};
      for (const slot of SYNTH_LOCK_SLOT_DEFS) {
        unlocksFromLocking[slot.unlock] = Boolean(normalized.unlockedMechanics[slot.unlock]);
      }
      if (unlockState[SYNTH_STAGE_2]) {
        unlocksFromLocking.rotate = true;
        unlocksFromLocking.swap = true;
        unlocksFromLocking.reflect = true;
      }
      if (unlockState[SYNTH_STAGE_3]) {
        unlocksFromLocking["link-bridge"] = true;
      }
      const wiringSolution = buildWiringSolution(normalizedSeed, synthesisCatalog);
      return {
        currentStage: normalized.currentStage,
        placedArtifacts: normalized.placedArtifacts,
        unlockedMechanics: unlocksFromLocking,
        stageUnlocks: unlockState,
        lockUsedArtifacts: Array.isArray(normalized.lockUsedArtifacts)
          ? [...normalized.lockUsedArtifacts]
          : [],
        lockSpinUntil: normalized.lockSpinUntil,
        rotationBoardState: normalized.rotationBoardState,
        wiringState: {
          ...normalized.wiringState,
          solutionModes: wiringSolution.modes,
          nodeTargets: wiringSolution.nodeTargets,
        },
        sealAssemblyState: normalized.sealAssemblyState,
        stageSolvedFlags: {
          ...normalized.stageSolvedFlags,
        },
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

function lockingRequiredArtifactsForStage(runtime, unlockTargetStage) {
  const stage = safeText(unlockTargetStage);
  if (!stage) {
    return {};
  }
  const synthesis = runtime && runtime.synthesis && typeof runtime.synthesis === "object"
    ? runtime.synthesis
    : {};
  const usedSet = new Set(
    Array.isArray(synthesis.lockUsedArtifacts)
      ? synthesis.lockUsedArtifacts.map((value) => safeText(value)).filter(Boolean)
      : [],
  );
  const catalog = Array.isArray(runtime && runtime.artifactPuzzleState && runtime.artifactPuzzleState.synthesisCatalog)
    ? [...runtime.artifactPuzzleState.synthesisCatalog]
    : [];
  catalog.sort((a, b) => {
    const score = synthSortScore(a) - synthSortScore(b);
    if (score !== 0) {
      return score;
    }
    return safeText(a.name).localeCompare(safeText(b.name));
  });
  const picked = new Set();
  const requiredBySlot = {};
  for (const slot of SYNTH_LOCK_SLOT_DEFS) {
    const match = catalog.find((entry) => {
      const name = safeText(entry && entry.name);
      if (!name || usedSet.has(name) || picked.has(name)) {
        return false;
      }
      return synthUnlockFromMeta(entry.meta) === slot.unlock;
    });
    if (!match) {
      requiredBySlot[slot.slotId] = "";
      continue;
    }
    const name = safeText(match.name);
    requiredBySlot[slot.slotId] = name;
    picked.add(name);
  }
  return requiredBySlot;
}

function nextSynthesisUnlockStage(stageUnlocks) {
  const source = stageUnlocks && typeof stageUnlocks === "object" ? stageUnlocks : {};
  for (const stageId of SYNTH_UNLOCK_TARGET_ORDER) {
    if (!source[stageId]) {
      return stageId;
    }
  }
  return "";
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
  return SYNTH_ROTATION_LINKS_BY_POSITION[base]
    ? [...SYNTH_ROTATION_LINKS_BY_POSITION[base]]
    : [];
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
    const mode = clamp(Math.floor(Number(modes[edge.edgeId]) || 0), 0, SYNTH_WIRE_MODE_MAX);
    nodes[edge.a] += mode;
    nodes[edge.b] += mode;
  }
  return nodes;
}

function wiringSolved(wiringState, unlockedMechanics) {
  void unlockedMechanics;
  const targets = wiringState && wiringState.nodeTargets && typeof wiringState.nodeTargets === "object"
    ? wiringState.nodeTargets
    : {};
  const charges = wiringNodeCharges(wiringState);
  for (const node of Object.keys(charges)) {
    if (charges[node] !== Number(targets[node] || 0)) {
      return false;
    }
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

function sealArtifactGroupIdByPosition(position) {
  const source = position && typeof position === "object" ? position : {};
  const x = Number(source.x);
  const y = Number(source.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return "";
  }
  let bestGroup = "";
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const groupId of SYNTH_SEAL_GROUP_IDS) {
    const center = SYNTH_SEAL_GROUP_LAYOUT[groupId];
    if (!center) {
      continue;
    }
    const distance = Math.hypot(x - center.x, y - center.y);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestGroup = groupId;
    }
  }
  if (!bestGroup || bestDistance > SYNTH_SEAL_GROUP_DROP_RADIUS) {
    return "";
  }
  return bestGroup;
}

function sealGroupingSolved(runtime) {
  const synthesis = runtime.synthesis;
  const catalog = runtime.artifactPuzzleState.synthesisCatalog || [];
  const target = sealTargetFromCatalog(catalog);
  const seal = synthesis.sealAssemblyState;
  if (!target.length) {
    return true;
  }
  const tuneToGroup = {};
  const groupMembers = Object.fromEntries(SYNTH_SEAL_GROUP_IDS.map((groupId) => [groupId, []]));
  for (const entry of target) {
    const groupId = sealArtifactGroupIdByPosition(seal.positions[entry.name]);
    if (!groupId) {
      return false;
    }
    groupMembers[groupId].push(entry.name);
  }
  for (const groupId of SYNTH_SEAL_GROUP_IDS) {
    const names = groupMembers[groupId];
    if (!Array.isArray(names) || !names.length) {
      return false;
    }
    const tuneSet = new Set();
    for (const name of names) {
      const entry = synthCatalogEntry(runtime, name);
      if (!entry) {
        return false;
      }
      tuneSet.add(synthUnlockFromMeta(entry.meta));
    }
    if (tuneSet.size !== 1) {
      return false;
    }
    const [groupTune] = [...tuneSet];
    if (tuneToGroup[groupTune]) {
      return false;
    }
    tuneToGroup[groupTune] = groupId;
  }
  return true;
}

function sealGroupMembers(runtime) {
  const groups = Object.fromEntries(SYNTH_SEAL_GROUP_IDS.map((groupId) => [groupId, []]));
  const catalog = sealTargetFromCatalog(runtime.artifactPuzzleState.synthesisCatalog || []);
  const seal = runtime.synthesis.sealAssemblyState;
  for (const entry of catalog) {
    const groupId = sealArtifactGroupIdByPosition(seal.positions[entry.name]);
    if (groupId && groups[groupId]) {
      groups[groupId].push(entry.name);
    }
  }
  return groups;
}

function sealGroupTuneForDisplay(runtime, groupId) {
  const groups = sealGroupMembers(runtime);
  const members = groups[groupId] || [];
  if (!members.length) {
    return "";
  }
  const target = sealTargetFromCatalog(runtime.artifactPuzzleState.synthesisCatalog || []);
  const tuneCounts = {};
  for (const entry of target) {
    const tune = synthUnlockFromMeta(entry.meta);
    tuneCounts[tune] = (tuneCounts[tune] || 0) + 1;
  }
  const tunes = new Set();
  for (const name of members) {
    const entry = synthCatalogEntry(runtime, name);
    if (!entry) {
      return "";
    }
    tunes.add(synthUnlockFromMeta(entry.meta));
  }
  if (tunes.size !== 1) {
    return "";
  }
  const [groupTune] = [...tunes];
  const totalForTune = Number(tuneCounts[groupTune] || 0);
  if (!totalForTune || members.length !== totalForTune) {
    return "";
  }
  return groupTune || "";
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
  let normalized = normalizeRuntime(runtime, context);
  if (normalized.phase === PHASE_SYNTHESIS) {
    const synth = normalized.synthesis;
    const nextFlags = { ...synth.stageSolvedFlags };
    const rotationSolvedNow =
      Boolean(synth.stageUnlocks[SYNTH_STAGE_2]) &&
      rotationSolved(synth.rotationBoardState, synth.unlockedMechanics);
    if (rotationSolvedNow) {
      nextFlags[SYNTH_STAGE_2] = true;
    }
    const wiringSolvedNow =
      Boolean(synth.stageUnlocks[SYNTH_STAGE_3]) &&
      wiringSolved(synth.wiringState, synth.unlockedMechanics);
    if (wiringSolvedNow) {
      nextFlags[SYNTH_STAGE_3] = true;
    }
    const sealSolvedNow =
      Boolean(synth.stageUnlocks[SYNTH_STAGE_4]) &&
      sealOrientationSolved(normalized) &&
      sealGroupingSolved(normalized);
    if (sealSolvedNow) {
      nextFlags[SYNTH_STAGE_4] = true;
    }
    const allSolved = [SYNTH_STAGE_1, SYNTH_STAGE_2, SYNTH_STAGE_3, SYNTH_STAGE_4].every((id) => Boolean(nextFlags[id]));
    normalized = {
      ...normalized,
      synthesis: {
        ...synth,
        stageSolvedFlags: nextFlags,
      },
    };
    if (allSolved) {
      normalized = {
        ...normalized,
        phase: PHASE_COMPLETE,
        solved: true,
        checkpoints: {
          ...normalized.checkpoints,
          synthesis: true,
        },
        synthesis: {
          ...normalized.synthesis,
          currentStage: SYNTH_STAGE_SOLVED,
          statusMessage: "Synthesis complete. Convergence sealed.",
        },
        artifactPuzzleState: {
          ...normalized.artifactPuzzleState,
          synthesisSolved: true,
        },
        lastMessage: "Convergence complete. The final proof route opens.",
      };
    }
  }
  if (normalized.phase !== PHASE_COMPLETE && normalized.solved) {
    normalized = {
      ...normalized,
      solved: false,
    };
  }
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
    if (current.synthesis.currentStage !== SYNTH_STAGE_1) {
      return current;
    }
    const slotId = safeText(action.slotId);
    const artifact = safeText(action.artifact);
    const slot = SYNTH_LOCK_SLOT_DEFS.find((entry) => entry.slotId === slotId);
    if (!slot) {
      return current;
    }
    const unlockTargetStage = nextSynthesisUnlockStage(current.synthesis.stageUnlocks);
    if (!unlockTargetStage) {
      return {
        ...current,
        synthesis: {
          ...current.synthesis,
          statusMessage: "All synthesis stages are already unlocked.",
        },
      };
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
    const requiredBySlot = lockingRequiredArtifactsForStage(current, unlockTargetStage);
    const requiredArtifact = safeText(requiredBySlot[slot.slotId]);
    if (!requiredArtifact) {
      return {
        ...current,
        synthesis: {
          ...current.synthesis,
          statusMessage: "No viable resonance set remains for this unlock target.",
        },
      };
    }
    if (artifact !== requiredArtifact) {
      return {
        ...current,
        synthesis: {
          ...current.synthesis,
          statusMessage: "That artifact does not match this socket's current resonance target.",
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
      [slot.unlock]: true,
    };
    const solvedStage = SYNTH_LOCK_SLOT_DEFS.every((entry) => {
      const name = safeText(nextLocking[entry.slotId]);
      if (!name) {
        return false;
      }
      const hit = synthCatalogEntry(current, name);
      return hit ? synthUnlockFromMeta(hit.meta) === entry.unlock : false;
    });
    const nextStageUnlocks = {
      ...current.synthesis.stageUnlocks,
      ...(solvedStage ? { [unlockTargetStage]: true } : {}),
    };
    const nextUsedArtifacts = solvedStage
      ? [...new Set([...(current.synthesis.lockUsedArtifacts || []), ...Object.values(nextLocking).map((value) => safeText(value)).filter(Boolean)])]
      : current.synthesis.lockUsedArtifacts;
    const clearLocking = solvedStage
      ? Object.fromEntries(SYNTH_LOCK_SLOT_DEFS.map((entry) => [entry.slotId, null]))
      : nextLocking;
    return {
      ...current,
      synthesis: {
        ...current.synthesis,
        placedArtifacts: {
          ...current.synthesis.placedArtifacts,
          locking: clearLocking,
        },
        stageUnlocks: nextStageUnlocks,
        lockUsedArtifacts: nextUsedArtifacts,
        unlockedMechanics: nextUnlocked,
        lockSpinUntil: solvedStage ? Date.now() + 650 : current.synthesis.lockSpinUntil,
        statusMessage: solvedStage
          ? `${SYNTH_STAGE_LABELS[unlockTargetStage] || "Next board"} unlocked.`
          : `Mechanic unlocked: ${SYNTH_MECHANIC_LABELS[slot.unlock] || slot.unlock}.`,
        stageSolvedFlags: {
          ...current.synthesis.stageSolvedFlags,
          [SYNTH_STAGE_1]: SYNTH_UNLOCK_TARGET_ORDER.every((stageId) => Boolean(nextStageUnlocks[stageId])),
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
    const lockingSolvedNow = SYNTH_UNLOCK_TARGET_ORDER.every((stageId) => Boolean(current.synthesis.stageUnlocks[stageId]));
    if (from === SYNTH_STAGE_1 && !lockingSolvedNow) {
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
        stageSolvedFlags: {
          ...current.synthesis.stageSolvedFlags,
          ...(from === SYNTH_STAGE_1 ? { [SYNTH_STAGE_1]: true } : {}),
        },
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
    if (current.synthesis.currentStage !== SYNTH_STAGE_2) {
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
    if (current.synthesis.currentStage !== SYNTH_STAGE_2) {
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
    if (current.synthesis.currentStage !== SYNTH_STAGE_2) {
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

  if (action.type === "fin01-synth-wire-toggle" && current.phase === PHASE_SYNTHESIS) {
    if (current.synthesis.currentStage !== SYNTH_STAGE_3) {
      return current;
    }
    const edgeId = safeText(action.edgeId);
    const edge = [...SYNTH_BASE_EDGES, ...SYNTH_BRIDGE_EDGES].find((entry) => entry.edgeId === edgeId);
    if (!edge) {
      return current;
    }
    const currentMode = clamp(Math.floor(Number(current.synthesis.wiringState.edgeModes[edgeId]) || 0), 0, SYNTH_WIRE_MODE_MAX);
    const nextModes = {
      ...current.synthesis.wiringState.edgeModes,
      [edgeId]: (currentMode + 1) % (SYNTH_WIRE_MODE_MAX + 1),
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

  if (action.type === "fin01-synth-seal-rotate" && current.phase === PHASE_SYNTHESIS) {
    if (current.synthesis.currentStage !== SYNTH_STAGE_4) {
      return current;
    }
    const artifact = safeText(action.artifact || current.synthesis.sealAssemblyState.selectedArtifact);
    if (!artifact || !Object.prototype.hasOwnProperty.call(current.synthesis.sealAssemblyState.rotations, artifact)) {
      return current;
    }
    const currentRotation = ((Math.floor(Number(current.synthesis.sealAssemblyState.rotations[artifact]) || 0) % 4) + 4) % 4;
    const step = Number(action.step || 1) < 0 ? -1 : 1;
    const nextRotation = ((currentRotation + step) % 4 + 4) % 4;
    return {
      ...current,
      synthesis: {
        ...current.synthesis,
        sealAssemblyState: {
          ...current.synthesis.sealAssemblyState,
          rotations: {
            ...current.synthesis.sealAssemblyState.rotations,
            [artifact]: nextRotation,
          },
          status: "",
        },
      },
    };
  }

  if (action.type === "fin01-synth-seal-drop" && current.phase === PHASE_SYNTHESIS) {
    if (current.synthesis.currentStage !== SYNTH_STAGE_4) {
      return current;
    }
    const artifact = safeText(action.artifact);
    if (!artifact || !Object.prototype.hasOwnProperty.call(current.synthesis.sealAssemblyState.positions, artifact)) {
      return current;
    }
    const x = clamp(Number(action.xPercent), 6, 94);
    const y = clamp(Number(action.yPercent), 8, 92);
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return current;
    }
    return {
      ...current,
      synthesis: {
        ...current.synthesis,
        sealAssemblyState: {
          ...current.synthesis.sealAssemblyState,
          selectedArtifact: artifact,
          positions: {
            ...current.synthesis.sealAssemblyState.positions,
            [artifact]: { x, y },
          },
          status: "",
        },
      },
    };
  }

  if (action.type === "fin01-synth-seal-nudge" && current.phase === PHASE_SYNTHESIS) {
    if (current.synthesis.currentStage !== SYNTH_STAGE_4) {
      return current;
    }
    const artifact = safeText(action.artifact || current.synthesis.sealAssemblyState.selectedArtifact);
    if (!artifact || !Object.prototype.hasOwnProperty.call(current.synthesis.sealAssemblyState.positions, artifact)) {
      return current;
    }
    const dx = Number(action.dx || 0);
    const dy = Number(action.dy || 0);
    const currentPos = current.synthesis.sealAssemblyState.positions[artifact] || { x: 50, y: 50 };
    const x = clamp(Number(currentPos.x) + dx, 6, 94);
    const y = clamp(Number(currentPos.y) + dy, 8, 92);
    return {
      ...current,
      synthesis: {
        ...current.synthesis,
        sealAssemblyState: {
          ...current.synthesis.sealAssemblyState,
          positions: {
            ...current.synthesis.sealAssemblyState.positions,
            [artifact]: { x, y },
          },
          status: "",
        },
      },
    };
  }

  if (action.type === "fin01-synth-jump-stage" && current.phase === PHASE_SYNTHESIS) {
    const targetStage = safeText(action.targetStage);
    if (![SYNTH_STAGE_1, SYNTH_STAGE_2, SYNTH_STAGE_3, SYNTH_STAGE_4].includes(targetStage)) {
      return current;
    }
    if (targetStage === SYNTH_STAGE_2 && !current.synthesis.stageUnlocks[SYNTH_STAGE_2]) {
      return current;
    }
    if (targetStage === SYNTH_STAGE_3 && !current.synthesis.stageUnlocks[SYNTH_STAGE_3]) {
      return current;
    }
    if (targetStage === SYNTH_STAGE_4 && !current.synthesis.stageUnlocks[SYNTH_STAGE_4]) {
      return current;
    }
    return {
      ...current,
      synthesis: {
        ...current.synthesis,
        currentStage: targetStage,
        statusMessage: "",
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
        const canJump =
          stage === SYNTH_STAGE_1 ||
          (stage === SYNTH_STAGE_2 && synthesis.stageUnlocks[SYNTH_STAGE_2]) ||
          (stage === SYNTH_STAGE_3 && synthesis.stageUnlocks[SYNTH_STAGE_3]) ||
          (stage === SYNTH_STAGE_4 && synthesis.stageUnlocks[SYNTH_STAGE_4]);
        const classes = ["final01-synth-rail-step"];
        if (solved) {
          classes.push("is-solved");
        }
        if (active) {
          classes.push("is-active");
        }
        return `
          <button
            type="button"
            class="${classes.join(" ")}"
            data-node-id="${NODE_ID}"
            data-node-action="fin01-synth-jump-stage"
            data-target-stage="${escapeHtml(stage)}"
            ${canJump ? "" : "disabled"}
          >
            <span>${index + 1}</span>
            <p>${escapeHtml(SYNTH_STAGE_LABELS[stage])}</p>
          </button>
        `;
      }).join("")}
    </section>
  `;
}

function synthesisLockingStageMarkup(runtime, selectedArtifact) {
  const synthesis = runtime.synthesis;
  const stageSolved = SYNTH_UNLOCK_TARGET_ORDER.every((stageId) => Boolean(synthesis.stageUnlocks[stageId]));
  const unlockTargetStage = nextSynthesisUnlockStage(synthesis.stageUnlocks);
  const requiredBySlot = lockingRequiredArtifactsForStage(runtime, unlockTargetStage);
  const selectedEntry = selectedArtifact ? synthCatalogEntry(runtime, selectedArtifact) : null;
  const selectedUnlock = selectedEntry ? synthUnlockFromMeta(selectedEntry.meta) : "";
  const slots = SYNTH_LOCK_SLOT_DEFS.map((slot, index) => {
    const locked = false;
    const filledArtifact = synthesis.placedArtifacts.locking[slot.slotId];
    const requiredArtifact = safeText(requiredBySlot[slot.slotId]);
    const ready = !filledArtifact && !locked && selectedArtifact && selectedArtifact === requiredArtifact;
    return {
      filled: Boolean(filledArtifact),
      ready: Boolean(ready),
      clickable: !locked && Boolean(requiredArtifact),
      title: filledArtifact
        ? `${SYNTH_MECHANIC_LABELS[slot.unlock]} unlocked by ${filledArtifact}`
        : locked
          ? "Requires prior socket alignment."
          : requiredArtifact
            ? `${SYNTH_MECHANIC_LABELS[slot.unlock]} socket`
            : `${SYNTH_MECHANIC_LABELS[slot.unlock]} socket (no available artifact)`,
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

  return `
    <section class="final01-synth-stage">
      ${renderSlotRing({
        slots,
        className: `final01-synth-lock-ring ${synthesis.lockSpinUntil > Date.now() ? "is-spinning" : ""}`,
        radiusPct: 42,
        centerHtml: `<div class="final01-synth-core">${renderRegionSymbol({ symbolKey: FINAL_SYMBOL_KEY, className: "slot-ring-center-symbol final01-center-symbol" })}</div>`,
        ariaLabel: "Synthesis locking ring",
      })}
      <p class="muted">Each socket accepts a matching resonance artifact. Fill all four sockets to unlock another board.</p>
      <p class="muted">Artifact tune: ${selectedArtifact ? escapeHtml(SYNTH_MECHANIC_LABELS[selectedUnlock] || "Unknown") : "None selected"}</p>
      ${
        unlockTargetStage
          ? `<p class="muted">Current unlock target: ${escapeHtml(SYNTH_STAGE_LABELS[unlockTargetStage] || unlockTargetStage)}</p>`
          : ""
      }
      ${stageSolved ? `<section class="final01-stage-complete"><p>Board complete.</p></section>` : ""}
    </section>
  `;
}

function synthesisRotationStageMarkup(runtime) {
  const synthesis = runtime.synthesis;
  const board = synthesis.rotationBoardState;
  const stageSolved = Boolean(synthesis.stageSolvedFlags[SYNTH_STAGE_2]);
  const sorted = [...board.pieces].sort((a, b) => a.position - b.position);
  const selected = safeText(board.selectedPieceId);
  const targetByPosition = Object.fromEntries(SYNTH_ROTATION_TARGETS.map((entry) => [entry.requiredPosition, entry]));
  const catalog = sealTargetFromCatalog(runtime.artifactPuzzleState.synthesisCatalog || []);
  const pieceSymbolMap = Object.fromEntries(
    SYNTH_ROTATION_TARGETS.map((target, index) => [target.pieceId, catalog[index % Math.max(1, catalog.length)] ? catalog[index % Math.max(1, catalog.length)].name : "Convergence Echo Alpha"]),
  );
  const selectedPiece = selected ? synthesisPieceById(runtime, selected) : null;
  const linked = selectedPiece ? rotationLinkedPositions(selectedPiece.position) : [];
  return `
    <section class="final01-synth-stage">
      <section class="final01-rotation-board">
        <section class="final01-rotation-goal-ring">
          ${Array.from({ length: SYNTH_ROTATION_TARGETS.length }, (_, position) => {
            const target = targetByPosition[position];
            const rotDeg = (((Number(target.requiredRotation) || 0) % 4) + 4) % 4 * 90;
            const mirrorScale = target.requiredMirror ? -1 : 1;
            const artifact = pieceSymbolMap[target.pieceId] || "Convergence Echo Alpha";
            return `
              <span class="final01-rotation-goal-slot" style="--idx:${position};">
                <span class="final01-rotation-sigil final01-rotation-glyph-goal" style="transform: rotate(${rotDeg}deg) scaleX(${mirrorScale});">
                  ${renderArtifactSymbol({ artifactName: artifact, className: "artifact-symbol" })}
                </span>
              </span>
            `;
          }).join("")}
        </section>
        <section class="final01-rotation-live-ring">
          ${sorted.map((piece, index) => {
            const classes = ["final01-rotation-piece"];
            if (piece.pieceId === selected) {
              classes.push("is-selected");
              if (board.swapArmed) {
                classes.push("is-swap-armed");
              }
            }
            if (piece.mirrored) {
              classes.push("is-mirrored");
            }
            if (board.swapArmed && selected && selected !== piece.pieceId) {
              classes.push("is-swap-target");
            }
            if (linked.includes(piece.position)) {
              classes.push("is-linked");
            }
            const rotDeg = (((Number(piece.rotation) || 0) % 4) + 4) % 4 * 90;
            const mirrorScale = piece.mirrored ? -1 : 1;
            const artifact = pieceSymbolMap[piece.pieceId] || "Convergence Echo Alpha";
            return `
              <button
                type="button"
                class="${classes.join(" ")}"
                style="--idx:${index};"
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
      </section>
      <div class="toolbar">
        <button type="button" data-node-id="${NODE_ID}" data-node-action="fin01-synth-rotation-rotate" data-piece-id="${escapeHtml(selected)}" ${selected ? "" : "disabled"}>Rotate</button>
        <button type="button" data-node-id="${NODE_ID}" data-node-action="fin01-synth-rotation-reflect" data-piece-id="${escapeHtml(selected)}" ${selected ? "" : "disabled"}>Reflect</button>
        <button type="button" data-node-id="${NODE_ID}" data-node-action="fin01-synth-rotation-toggle-swap" ${selected ? "" : "disabled"}>${board.swapArmed ? "Cancel Swap" : "Arm Swap"}</button>
      </div>
      ${stageSolved ? `<section class="final01-stage-complete"><p>Board complete.</p></section>` : ""}
    </section>
  `;
}

function synthesisWiringStageMarkup(runtime) {
  const synthesis = runtime.synthesis;
  const stageSolved = Boolean(synthesis.stageSolvedFlags[SYNTH_STAGE_3]);
  const edges = [...SYNTH_BASE_EDGES, ...SYNTH_BRIDGE_EDGES];
  const charges = wiringNodeCharges(synthesis.wiringState);
  const modeLabel = (mode) => (mode === 3 ? "III" : mode === 2 ? "II" : mode === 1 ? "I" : "0");
  return `
    <section class="final01-synth-stage">
      <section class="final01-wire-grid">
        ${edges.map((edge) => {
          const mode = clamp(Math.floor(Number(synthesis.wiringState.edgeModes[edge.edgeId]) || 0), 0, SYNTH_WIRE_MODE_MAX);
          const active = mode > 0;
          return `
            <button
              type="button"
              class="final01-wire-edge ${active ? "is-active" : ""} ${mode >= 2 ? "is-boosted" : ""}"
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
        ${Object.keys(synthesis.wiringState.nodeTargets || {}).map((node) => `
          <article class="final01-wire-node ${charges[node] === Number(synthesis.wiringState.nodeTargets[node] || 0) ? "is-hit" : ""}">
            <span>${escapeHtml(node)}</span>
            <small>${escapeHtml(String(charges[node]))} / ${escapeHtml(String(Math.floor(Number(synthesis.wiringState.nodeTargets[node] || 0))))}</small>
          </article>
        `).join("")}
      </section>
      ${stageSolved ? `<section class="final01-stage-complete"><p>Board complete.</p></section>` : ""}
    </section>
  `;
}

function synthesisSealStageMarkup(runtime) {
  const synthesis = runtime.synthesis;
  const seal = synthesis.sealAssemblyState;
  const target = sealTargetFromCatalog(runtime.artifactPuzzleState.synthesisCatalog || []);
  const selected = safeText(seal.selectedArtifact);
  const orientationSolved = sealOrientationSolved(runtime);
  const groupingSolved = sealGroupingSolved(runtime);
  return `
    <section class="final01-synth-stage">
      <section class="final01-seal-table" data-node-dropzone="fin01-seal" data-node-id="${NODE_ID}">
        ${SYNTH_SEAL_GROUP_IDS.map((groupId) => {
          const pos = SYNTH_SEAL_GROUP_LAYOUT[groupId];
          const lockedTune = sealGroupTuneForDisplay(runtime, groupId);
          return `
            <article class="final01-seal-group-circle is-active ${lockedTune ? "is-locked" : ""}" data-tune="${escapeHtml(lockedTune)}" style="left:${pos.x}%;top:${pos.y}%;"></article>
          `;
        }).join("")}
        ${target.map((entry) => {
          const rot = ((Math.floor(Number(seal.rotations[entry.name]) || 0) % 4) + 4) % 4;
          const isSelected = selected === entry.name;
          const pos = seal.positions[entry.name] && typeof seal.positions[entry.name] === "object"
            ? seal.positions[entry.name]
            : { x: 50, y: 50 };
          return `
            <button
              type="button"
              class="final01-seal-piece final01-seal-floating-piece ${isSelected ? "is-selected" : ""}"
              style="left:${escapeHtml(String(clamp(Number(pos.x), 6, 94)))}%;top:${escapeHtml(String(clamp(Number(pos.y), 8, 92)))}%;"
              data-node-id="${NODE_ID}"
              data-node-action="fin01-synth-seal-select"
              data-artifact="${escapeHtml(entry.name)}"
              data-node-piece="true"
              data-piece-id="${escapeHtml(entry.name)}"
              draggable="true"
              aria-label="${escapeHtml(`Seal sigil ${entry.name}`)}"
            >
              <span class="final01-seal-symbol-wrap" style="transform: rotate(${rot * 90}deg);">
                ${renderArtifactSymbol({ artifactName: entry.name, className: "slot-ring-symbol artifact-symbol" })}
              </span>
            </button>
          `;
        }).join("")}
      </section>
      <section class="final01-seal-progress">
        <span class="${orientationSolved ? "is-hit" : ""}"></span>
        <span class="${groupingSolved ? "is-hit" : ""}"></span>
      </section>
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
  if (actionName === "fin01-synth-wire-toggle") {
    return {
      type: "fin01-synth-wire-toggle",
      edgeId: element.getAttribute("data-edge-id") || "",
      at: Date.now(),
    };
  }
  if (actionName === "fin01-synth-seal-select") {
    return {
      type: "fin01-synth-seal-select",
      artifact: element.getAttribute("data-artifact") || "",
      at: Date.now(),
    };
  }
  if (actionName === "fin01-synth-seal-rotate") {
    return {
      type: "fin01-synth-seal-rotate",
      artifact: element.getAttribute("data-artifact") || "",
      step: 1,
      at: Date.now(),
    };
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

export function buildFinal01DropAction(payload, runtime) {
  if (!payload || typeof payload !== "object") {
    return null;
  }
  const pieceId = safeText(payload.pieceId);
  const xPercent = Number(payload.xPercent);
  const yPercent = Number(payload.yPercent);
  if (!pieceId || !Number.isFinite(xPercent) || !Number.isFinite(yPercent)) {
    return null;
  }
  const current = synchronizeFinal01Runtime(runtime, { state: {} });
  if (current.phase !== PHASE_SYNTHESIS || current.synthesis.currentStage !== SYNTH_STAGE_4) {
    return null;
  }
  if (!Object.prototype.hasOwnProperty.call(current.synthesis.sealAssemblyState.positions || {}, pieceId)) {
    return null;
  }
  return {
    type: "fin01-synth-seal-drop",
    artifact: pieceId,
    xPercent,
    yPercent,
    at: Date.now(),
  };
}

export function buildFinal01KeyAction(event, runtime) {
  const current = runtime && typeof runtime === "object" ? runtime : initialFinal01Runtime();
  const isEditableTarget =
    event.target instanceof Element &&
    (event.target.matches("input, textarea, select, [contenteditable='true'], [contenteditable='']") ||
      event.target.closest("[contenteditable='true'], [contenteditable='']"));
  if (isEditableTarget) {
    return null;
  }
  if (
    current.phase === PHASE_SYNTHESIS &&
    current.synthesis.currentStage === SYNTH_STAGE_4
  ) {
    const selected = safeText(current.synthesis.sealAssemblyState.selectedArtifact);
    const fallbackSelected = selected || safeText(Object.keys(current.synthesis.sealAssemblyState.positions || {})[0]);
    if (!fallbackSelected) {
      return null;
    }
    if (event.key === "q" || event.key === "Q" || event.key === "[") {
      return {
        type: "fin01-synth-seal-rotate",
        artifact: fallbackSelected,
        step: -1,
        at: Date.now(),
      };
    }
    if (event.key === "e" || event.key === "E" || event.key === "]") {
      return {
        type: "fin01-synth-seal-rotate",
        artifact: fallbackSelected,
        step: 1,
        at: Date.now(),
      };
    }
    if (event.key === "w" || event.key === "W" || event.key === "ArrowUp") {
      return {
        type: "fin01-synth-seal-nudge",
        artifact: fallbackSelected,
        dx: 0,
        dy: -1.8,
        at: Date.now(),
      };
    }
    if (event.key === "s" || event.key === "S" || event.key === "ArrowDown") {
      return {
        type: "fin01-synth-seal-nudge",
        artifact: fallbackSelected,
        dx: 0,
        dy: 1.8,
        at: Date.now(),
      };
    }
    if (event.key === "a" || event.key === "A" || event.key === "ArrowLeft") {
      return {
        type: "fin01-synth-seal-nudge",
        artifact: fallbackSelected,
        dx: -1.8,
        dy: 0,
        at: Date.now(),
      };
    }
    if (event.key === "d" || event.key === "D" || event.key === "ArrowRight") {
      return {
        type: "fin01-synth-seal-nudge",
        artifact: fallbackSelected,
        dx: 1.8,
        dy: 0,
        at: Date.now(),
      };
    }
  }
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
  buildDropAction: buildFinal01DropAction,
  buildKeyAction: buildFinal01KeyAction,
};
