import { hasWaveOnePasskey } from "./artifacts.js";

const WAVE_ONE_SECTIONS = new Set([
  "Cradle",
  "The Wandering Inn",
  "Wandering Inn",
  "Worm",
  "Mother of Learning",
  "Hall of Proofs",
  "Prime Vault",
]);

export function computeUnlockedNodeIds(index, state) {
  const solved = new Set(state.solvedNodeIds || []);
  const unlocked = new Set();
  const waveOneUnlocked = hasWaveOnePasskey(state);

  for (const node of index.raw.nodes) {
    const deps = Array.isArray(node.dependencies) ? node.dependencies : [];
    const hasAllDeps = deps.every((dep) => solved.has(dep));
    const waveOneGateNode =
      WAVE_ONE_SECTIONS.has(node.section) &&
      Number(node.layer) <= 3 &&
      deps.includes("HUB05");
    const passesWaveOneGate = !waveOneGateNode || waveOneUnlocked;
    const waveOneBypass = waveOneUnlocked && waveOneGateNode;

    if ((hasAllDeps && passesWaveOneGate) || waveOneBypass) {
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
      unlocked.add(node.node_id);
    }
  }

  return unlocked;
}

export function computeSectionProgress(index, state, unlockedNodeIds) {
  const solvedSet = new Set(state.solvedNodeIds || []);
  const result = [];

  for (const [section, nodes] of index.sectionNodes.entries()) {
    const total = nodes.length;
    const solved = nodes.filter((node) => solvedSet.has(node.node_id)).length;
    const unlocked = nodes.filter((node) => unlockedNodeIds.has(node.node_id)).length;

    result.push({
      section,
      total,
      solved,
      unlocked,
      percent: total === 0 ? 0 : Math.round((solved / total) * 100),
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
