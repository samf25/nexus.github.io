import { escapeHtml } from "./shared.js";
import { renderRegionSymbol } from "../core/symbology.js";

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
  const { section, nodes, solvedSet, unlockedNodeIds, selectedIndex } = context;
  const safeIndex = Math.min(Math.max(Number(selectedIndex) || 0, 0), Math.max(nodes.length - 1, 0));
  const selectedNode = nodes[safeIndex] || null;
  const solved = nodes.filter((node) => solvedSet.has(node.node_id)).length;
  const percent = nodes.length ? Math.round((solved / nodes.length) * 100) : 0;

  const stars = nodes
    .map((node, index) => {
      const isSolved = solvedSet.has(node.node_id);
      const isUnlocked = unlockedNodeIds.has(node.node_id);
      const position = polarPosition(index, nodes.length, 38);
      const classes = [nodeClass(isSolved, isUnlocked)];
      if (index === safeIndex) {
        classes.push("active");
      }

      return `
        <div
          class="${classes.join(" ")}"
          style="left:${position.x}%; top:${position.y}%;"
          aria-hidden="true"
        >
          ${renderRegionSymbol({
            section: node.section,
            className: "sector-symbol",
          })}
        </div>
      `;
    })
    .join("");

  const selectedStatus = selectedNode
    ? solvedSet.has(selectedNode.node_id)
      ? "Solved"
      : unlockedNodeIds.has(selectedNode.node_id)
        ? "Unlocked"
        : "Locked"
    : "No nodes";

  return `
    <article class="nexus-page">
      <section class="nexus-stage">
        <div class="nexus-core">
          ${renderRegionSymbol({
            section,
            className: "nexus-core-symbol",
          })}
          <h2>${escapeHtml(section)}</h2>
          <p>${escapeHtml(String(solved))}/${escapeHtml(String(nodes.length))} solved</p>
          <p class="key-hint">Arrows to choose a node. Enter to enter.</p>
        </div>
        <div class="nexus-orbit">${stars}</div>
      </section>

      <section class="nexus-focus-card">
        <h3 class="nexus-focus-heading">
          ${
            selectedNode
              ? renderRegionSymbol({
                  section: selectedNode.section,
                  className: "nexus-focus-symbol",
                })
              : ""
          }
          <span>${escapeHtml(selectedNode ? selectedNode.title : "No Node Selected")}</span>
        </h3>
        <p class="muted" style="margin-bottom: 8px;">${escapeHtml(selectedNode ? selectedNode.node_id : "")}
          ${selectedNode ? ` | ${escapeHtml(selectedStatus)}` : ""}
        </p>
        <div class="progress-bar"><span style="width:${percent}%"></span></div>
        <p class="muted" style="margin-top: 8px;">Green: solved, blue: unlocked, dark: locked.</p>
      </section>
    </article>
  `;
}
