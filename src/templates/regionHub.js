import { escapeHtml } from "./shared.js";

function nodeClass(isSolved, isUnlocked) {
  if (isSolved) {
    return "sector-star solved";
  }
  if (isUnlocked) {
    return "sector-star unlocked";
  }
  return "sector-star locked";
}

function polarPosition(index, total, radiusPercent) {
  const angle = ((Math.PI * 2) / Math.max(total, 1)) * index - Math.PI / 2;
  const x = 50 + Math.cos(angle) * radiusPercent;
  const y = 50 + Math.sin(angle) * radiusPercent;
  return { x, y };
}

export function renderRegionHub(context) {
  const { section, nodes, solvedSet, unlockedNodeIds } = context;
  const solved = nodes.filter((node) => solvedSet.has(node.node_id)).length;
  const percent = nodes.length ? Math.round((solved / nodes.length) * 100) : 0;

  const stars = nodes
    .map((node, index) => {
      const isSolved = solvedSet.has(node.node_id);
      const isUnlocked = unlockedNodeIds.has(node.node_id);
      const position = polarPosition(index, nodes.length, 38);

      return `
        <a
          class="${nodeClass(isSolved, isUnlocked)}"
          style="left:${position.x}%; top:${position.y}%;"
          href="#${escapeHtml(node.route)}"
          title="${escapeHtml(node.node_id)} | ${escapeHtml(node.title)}"
          aria-label="${escapeHtml(node.title)}"
        ></a>
      `;
    })
    .join("");

  return `
    <article class="nexus-page animated-fade">
      <section class="nexus-stage">
        <div class="nexus-core">
          <h2>${escapeHtml(section)}</h2>
          <p>${escapeHtml(String(solved))}/${escapeHtml(String(nodes.length))} solved</p>
          <p class="key-hint">Select a star to enter a node.</p>
        </div>
        <div class="nexus-orbit">${stars}</div>
      </section>

      <section class="nexus-focus-card">
        <h3>Section Progress</h3>
        <div class="progress-bar"><span style="width:${percent}%"></span></div>
        <p class="muted" style="margin-top: 8px;">Green: solved, blue: unlocked, dark: locked.</p>
      </section>
    </article>
  `;
}
