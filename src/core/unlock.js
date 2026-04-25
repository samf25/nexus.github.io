import { hasWaveOnePasskey, hasWaveTwoPasskey } from "./artifacts.js";
import {
  countPracticalGuideWinArtifacts,
  practicalGuideWinArtifacts,
} from "../systems/practicalGuide.js";

const WAVE_ONE_SECTIONS = new Set([
  "Cradle",
  "The Wandering Inn",
  "Wandering Inn",
  "Worm",
  "Mother of Learning",
  "Hall of Proofs",
  "Prime Vault",
]);

const WAVE_TWO_SECTIONS = new Set([
  "Arcane Ascension",
  "Symmetry Forge",
  "Dungeon Crawler Carl",
  "Curved Atlas",
  "A Practical Guide to Evil",
  "Practical Guide",
]);
const ALWAYS_UNLOCKED_NODE_IDS = new Set(["WORM03"]);

export function computeUnlockedNodeIds(index, state) {
  const solved = new Set(state.solvedNodeIds || []);
  const unlocked = new Set();
  const waveOneUnlocked = hasWaveOnePasskey(state);
  const waveTwoUnlocked = hasWaveTwoPasskey(state);

  for (const node of index.raw.nodes) {
    if (ALWAYS_UNLOCKED_NODE_IDS.has(node.node_id)) {
      unlocked.add(node.node_id);
      continue;
    }

    if (node.section === "Nexus Hub" && (node.node_id === "HUB04" || node.node_id === "HUB05" || node.node_id === "HUB06")) {
      unlocked.add(node.node_id);
      continue;
    }

    const deps = Array.isArray(node.dependencies) ? node.dependencies : [];
    const hasAllDeps = deps.every((dep) => solved.has(dep));
    const waveOneGateNode =
      WAVE_ONE_SECTIONS.has(node.section) &&
      Number(node.layer) <= 3 &&
      deps.includes("HUB05");
    const passesWaveOneGate = !waveOneGateNode || waveOneUnlocked;
    const waveOneBypass = waveOneUnlocked && waveOneGateNode;
    const waveTwoGateNode = WAVE_TWO_SECTIONS.has(node.section);
    const passesWaveTwoGate = !waveTwoGateNode || waveTwoUnlocked;
    const waveTwoBypass = waveTwoUnlocked && waveTwoGateNode;

    if ((hasAllDeps && passesWaveOneGate && passesWaveTwoGate) || waveOneBypass || waveTwoBypass) {
      unlocked.add(node.node_id);
    }
  }

  const unlockedSections = new Set(
    index.raw.nodes
      .filter((node) => unlocked.has(node.node_id) && node.section !== "Nexus Hub")
      .map((node) => node.section),
  );

  for (const node of index.raw.nodes) {
    if (unlockedSections.has(node.section)) {
      if (WAVE_TWO_SECTIONS.has(node.section) && !waveTwoUnlocked) {
        continue;
      }
      unlocked.add(node.node_id);
    }
  }

  return unlocked;
}

export function computeSectionProgress(index, state, unlockedNodeIds) {
  const solvedSet = new Set(state.solvedNodeIds || []);
  const result = [];
  const pgeWinTotal = practicalGuideWinArtifacts().length;
  const pgeWinFound = countPracticalGuideWinArtifacts(state);
  const dccRuntime =
    state && state.nodeRuntime && state.nodeRuntime.DCC01 && typeof state.nodeRuntime.DCC01 === "object"
      ? state.nodeRuntime.DCC01
      : {};
  const dccMeta = dccRuntime.meta && typeof dccRuntime.meta === "object" ? dccRuntime.meta : {};
  const dccBestFloor = Math.max(1, Number(dccMeta.bestFloor) || 1);

  for (const [section, nodes] of index.sectionNodes.entries()) {
    const standardTotal = nodes.length;
    const standardSolved = nodes.filter((node) => solvedSet.has(node.node_id)).length;
    const unlocked = nodes.filter((node) => unlockedNodeIds.has(node.node_id)).length;
    const isPracticalGuide = section === "A Practical Guide to Evil";
    const total = isPracticalGuide ? pgeWinTotal : standardTotal;
    const solved = isPracticalGuide ? pgeWinFound : standardSolved;
    const percent = total === 0 ? 0 : Math.round((solved / total) * 100);

    const isDcc = section === "Dungeon Crawler Carl";
    result.push({
      section,
      total,
      solved,
      unlocked,
      percent,
      progressLabel: isPracticalGuide
        ? `${pgeWinFound}/${pgeWinTotal} win paths found`
        : isDcc
          ? `Max floor reached: ${dccBestFloor}`
          : "",
    });
  }

  result.sort((a, b) => a.section.localeCompare(b.section));
  return result;
}

export function frontierNodes(index, state, unlockedNodeIds, limit = 10) {
  const solvedSet = new Set(state.solvedNodeIds || []);

  return index.raw.nodes
    .filter((node) => unlockedNodeIds.has(node.node_id) && !solvedSet.has(node.node_id))
    .sort((a, b) => {
      if (a.layer !== b.layer) {
        return a.layer - b.layer;
      }
      return String(a.node_id).localeCompare(String(b.node_id));
    })
    .slice(0, limit);
}
