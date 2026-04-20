export function computeUnlockedNodeIds(index, state) {
  const solved = new Set(state.solvedNodeIds || []);
  const unlocked = new Set();

  for (const node of index.raw.nodes) {
    const deps = Array.isArray(node.dependencies) ? node.dependencies : [];
    const hasAllDeps = deps.every((dep) => solved.has(dep));
    if (hasAllDeps) {
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
