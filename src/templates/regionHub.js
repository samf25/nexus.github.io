import { escapeHtml } from "./shared.js";
import { renderRegionSymbol } from "../core/symbology.js";
import {
  countPracticalGuideWinArtifacts,
  practicalGuideWinArtifacts,
} from "../systems/practicalGuide.js";

const REGION_NODE_RADIUS = 36;

const NODE_TITLE_OVERRIDES = Object.freeze({
  CRD01: "Copper Breathing",
  CRD02: "Madra Well",
  CRD03: "Aura Atlas Of Cradle",
  CRD04: "Seven-Year Festival Tournament",
  CRD05: "The Heaven's Glory School",
  CRD06: "Duel with Jai Long",
  CRD07: "Nightwheel Valley",
  CRD08: "Uncrowded King Tournament",
  CRD09: "Scaling The Lord Realm",
  CRD10: "Road Of The Lord",
  CRD11: "Dreadgod Hunt",
  AA01: "Serpent Spire Judgment",
  AA02: "Climber's Court",
  AA03: "The Workshop",
  WORM01: "The Undersiders' Loft",
  WORM02: "The Arena",
  WORM03: "Brockton Bay",
  WORM04: "Brockton Bay Cleanup",
  WORM05: "Simurgh Engagement",
  WORM06: "National Cleanup",
  WORM07: "Behemoth Engagement",
  WORM08: "Scion",
  TWI01: "The True Guest Ledger",
  TWI02: "Dispatch Atlas Of Izril",
  TWI03: "The Inn",
  TWI04: "The Construction Yard",
  PGE01: "Claimant's Knife",
  PGE02: "Siege of the Last Gate",
  PGE03: "Winter Court Knife-Game",
  PGE04: "Tomb of the Sunless King",
  PGE05: "March of Small Mercies",
  PGE06: "The Long Night Banquet",
});

function nodeDisplayTitle(node) {
  const nodeId = String(node && node.node_id ? node.node_id : "");
  if (NODE_TITLE_OVERRIDES[nodeId]) {
    return NODE_TITLE_OVERRIDES[nodeId];
  }
  return String(node && node.title ? node.title : nodeId || "Node");
}

function nodeClass(isSolved, isUnlocked) {
  if (isSolved) {
    return "sector-star solved";
  }
  if (isUnlocked) {
    return "sector-star unlocked";
  }
  return "sector-star locked";
}

function isSoftLockedNode(section, node, solvedSet, state) {
  const nodeId = String(node && node.node_id ? node.node_id : "");
  if (String(section || "") === "Nexus Hub" && (nodeId === "HUB07" || nodeId === "HUB08")) {
    return !solvedSet.has("HUB05");
  }
  if (nodeId === "CRD05") {
    return !solvedSet.has("CRD04");
  }
  if (nodeId === "CRD06") {
    return !solvedSet.has("CRD05");
  }
  if (nodeId === "CRD07") {
    return !solvedSet.has("CRD06");
  }
  if (nodeId === "CRD08") {
    const crd02 =
      state && state.nodeRuntime && state.nodeRuntime.CRD02 && typeof state.nodeRuntime.CRD02 === "object"
        ? state.nodeRuntime.CRD02
        : {};
    const stage = String(crd02.cultivationStage || "").trim().toLowerCase();
    return !["underlord", "overlord", "archlord"].includes(stage);
  }
  if (nodeId === "CRD09") {
    return !solvedSet.has("CRD08");
  }
  if (nodeId === "CRD10") {
    const crd02 =
      state && state.nodeRuntime && state.nodeRuntime.CRD02 && typeof state.nodeRuntime.CRD02 === "object"
        ? state.nodeRuntime.CRD02
        : {};
    const stage = String(crd02.cultivationStage || "").trim().toLowerCase();
    return stage !== "archlord";
  }
  if (nodeId === "CRD11") {
    return !solvedSet.has("CRD10");
  }
  if (nodeId === "WORM04") {
    return !solvedSet.has("WORM03");
  }
  if (nodeId === "WORM05") {
    return !solvedSet.has("WORM04");
  }
  if (nodeId === "WORM06") {
    return !solvedSet.has("WORM05");
  }
  if (nodeId === "WORM07") {
    return !solvedSet.has("WORM06");
  }
  if (nodeId === "WORM08") {
    return !solvedSet.has("WORM07");
  }
  return false;
}

function polarPosition(index, total, radiusPercent, angleOffsetDegrees = 0) {
  const angle =
    ((Math.PI * 2) / Math.max(total, 1)) * index -
    Math.PI / 2 +
    ((Number(angleOffsetDegrees) || 0) * Math.PI) / 180;
  const x = 50 + Math.cos(angle) * radiusPercent;
  const y = 50 + Math.sin(angle) * radiusPercent;
  return { x, y };
}

export function renderRegionHub(context) {
  const { section, nodes, solvedSet, unlockedNodeIds, selectedIndex, state } = context;
  const safeIndex = Math.min(Math.max(Number(selectedIndex) || 0, 0), Math.max(nodes.length - 1, 0));
  const selectedNode = nodes[safeIndex] || null;
  const solved = nodes.filter((node) => solvedSet.has(node.node_id)).length;
  const percent = nodes.length ? Math.round((solved / nodes.length) * 100) : 0;
  const isPracticalGuide = section === "A Practical Guide to Evil";
  const pgeWinFound = isPracticalGuide ? countPracticalGuideWinArtifacts(state) : 0;
  const pgeWinTotal = isPracticalGuide ? practicalGuideWinArtifacts().length : 0;

  const stars = nodes
    .map((node, index) => {
      const isSolved = solvedSet.has(node.node_id);
      const isUnlocked = unlockedNodeIds.has(node.node_id);
      const isSoftLocked = isSoftLockedNode(section, node, solvedSet, state);
      const position = polarPosition(index, Math.max(1, nodes.length), REGION_NODE_RADIUS, 0);
      const classes = [nodeClass(isSolved, isUnlocked && !isSoftLocked)];
      if (isSoftLocked) {
        classes.push("is-soft-locked");
      }
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
      : isSoftLockedNode(section, selectedNode, solvedSet, state)
        ? "Locked"
        : unlockedNodeIds.has(selectedNode.node_id)
        ? "Unlocked"
        : "Locked"
    : "No nodes";

  return `
    <article class="nexus-page">
      <section class="nexus-stage">
        <div class="region-ring-guide" style="--region-ring-size:${REGION_NODE_RADIUS * 2}%;" aria-hidden="true"></div>
        <div class="nexus-core nexus-core--region">
          ${renderRegionSymbol({
            section,
            className: "nexus-core-symbol",
          })}
          <p>${escapeHtml(String(solved))}/${escapeHtml(String(nodes.length))} solved</p>
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
          <span>${escapeHtml(selectedNode ? nodeDisplayTitle(selectedNode) : "No Node Selected")}</span>
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
