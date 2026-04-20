import { escapeHtml, renderNodeScaffold } from "./shared.js";
import { describeRoom } from "../systems/dungeonCrawl.js";

export function renderDungeonSystem(context) {
  const { node, templateSpec, solved, state } = context;
  const dungeon = state.systems.dungeonCrawl;
  const room = describeRoom(dungeon.currentRoom);

  const bodyHtml = `
    <h3>Dungeon System Scaffold</h3>
    <p>${escapeHtml(node.surface || "Dungeon surface pending.")}</p>

    <div class="card-grid">
      <article class="card system">
        <h3>Current Room</h3>
        <p><strong>${escapeHtml(room.label)}</strong></p>
        <p class="muted">Scripted action: ${escapeHtml(room.action)}</p>
        <button class="inline-action" data-action="dungeon-act">Run Room Action</button>
      </article>
      <article class="card">
        <h3>Adjacent Rooms</h3>
        <div class="toolbar">
          ${room.neighbors
            .map(
              (neighbor) =>
                `<button class="ghost" data-action="dungeon-move" data-room="${escapeHtml(neighbor)}">Move: ${escapeHtml(neighbor)}</button>`,
            )
            .join("")}
        </div>
        <p class="muted">Discovered rooms: ${escapeHtml((dungeon.discoveredRooms || []).join(", "))}</p>
      </article>
    </div>
  `;

  return renderNodeScaffold({ node, templateSpec, solved, bodyHtml });
}
