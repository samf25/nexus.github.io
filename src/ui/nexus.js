import { escapeHtml } from "../templates/shared.js";
import { sectionRouteSlug } from "../data/blueprint.js";

function polarPosition(index, total, radiusPercent) {
  const angle = ((Math.PI * 2) / Math.max(total, 1)) * index - Math.PI / 2;
  const x = 50 + Math.cos(angle) * radiusPercent;
  const y = 50 + Math.sin(angle) * radiusPercent;
  return { x, y };
}

export function renderNexusView({ sectionProgress, selectedIndex }) {
  const sectors = Array.isArray(sectionProgress) ? sectionProgress : [];

  if (!sectors.length) {
    return `
      <article class="nexus-page animated-fade">
        <div class="nexus-empty">No sectors discovered yet.</div>
      </article>
    `;
  }

  const safeIndex = Math.min(Math.max(Number(selectedIndex) || 0, 0), sectors.length - 1);
  const selected = sectors[safeIndex];
  const selectedSlug = sectionRouteSlug(selected.section);

  const orbit = sectors
    .map((sector, index) => {
      const position = polarPosition(index, sectors.length, 40);
      const classes = ["sector-star"];
      if (index === safeIndex) {
        classes.push("active");
      }
      if (sector.solved > 0) {
        classes.push("solved");
      } else if (sector.unlocked > 0) {
        classes.push("unlocked");
      } else {
        classes.push("locked");
      }

      return `
        <div
          class="${classes.join(" ")}"
          style="left:${position.x}%; top:${position.y}%;"
          aria-hidden="true"
        ></div>
      `;
    })
    .join("");

  return `
    <article class="nexus-page">
      <div class="nexus-stage" aria-label="Nexus Sector Map">
        <div class="nexus-core">
          <h2>Nexus</h2>
          <p>${escapeHtml(String(sectors.length))} sectors indexed</p>
          <p class="key-hint">Arrows to roam. Enter to descend.</p>
        </div>
        <div class="nexus-orbit">${orbit}</div>
      </div>

      <section class="nexus-focus-card">
        <h3>${escapeHtml(selected.section)}</h3>
        <p>${escapeHtml(String(selected.solved))}/${escapeHtml(String(selected.total))} solved</p>
        <div class="progress-bar"><span style="width:${selected.percent}%"></span></div>
        <p class="key-hint" style="margin-top: 8px;">Focused sector: ${escapeHtml(selectedSlug.toUpperCase())}</p>
      </section>
    </article>
  `;
}
