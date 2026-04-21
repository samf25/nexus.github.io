import { escapeHtml } from "../templates/shared.js";
import { sectionRouteSlug } from "../data/blueprint.js";
import { renderRegionSymbol } from "../core/symbology.js";
import {
  KEY_SLOT_DEFINITIONS,
  keySlotsFromState,
  renderArtifactSymbol,
  slotIdForReward,
} from "../core/artifacts.js";

function polarPosition(index, total, radiusPercent) {
  const angle = ((Math.PI * 2) / Math.max(total, 1)) * index - Math.PI / 2;
  const x = 50 + Math.cos(angle) * radiusPercent;
  const y = 50 + Math.sin(angle) * radiusPercent;
  return { x, y };
}

function keySlotMarkup(state, selectedArtifactReward) {
  const slots = keySlotsFromState(state);
  const selectedSlotId = slotIdForReward(selectedArtifactReward);

  return `
    <div class="nexus-key-slots">
      ${KEY_SLOT_DEFINITIONS.map((slot) => {
        const occupied = slots[slot.slotId];
        const canInsert = Boolean(!occupied && selectedSlotId === slot.slotId);
        const expectedReward = slot.rewardAliases[0] || slot.label;

        return `
          <button
            type="button"
            class="nexus-key-slot ${occupied ? "is-filled" : ""} ${canInsert ? "is-ready" : ""}"
            data-action="nexus-slot-key"
            data-slot-id="${escapeHtml(slot.slotId)}"
            ${occupied ? "disabled" : ""}
            aria-label="${escapeHtml(`${slot.label} key slot`)}"
          >
            <span class="nexus-key-slot-icon">
              ${
                occupied
                  ? renderArtifactSymbol({
                      artifactName: occupied.reward,
                      className: "nexus-key-slot-symbol artifact-symbol",
                    })
                  : renderArtifactSymbol({
                      artifactName: expectedReward,
                      className: "nexus-key-slot-symbol artifact-symbol is-slot-ghost",
                    })
              }
            </span>
            <span class="nexus-key-slot-label">${escapeHtml(slot.label)}</span>
          </button>
        `;
      }).join("")}
    </div>
  `;
}

function keyHintMarkup(selectedArtifactReward) {
  const selected = String(selectedArtifactReward || "");
  const slotId = slotIdForReward(selected);
  if (!selected) {
    return "Select a key artifact, then socket it in the Nexus core.";
  }

  if (slotId) {
    return `${selected} selected. Insert into its matching slot.`;
  }

  return `${selected} is not a Nexus key.`;
}

export function renderNexusView({ sectionProgress, selectedIndex, state, selectedArtifactReward }) {
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
        >
          ${renderRegionSymbol({
            section: sector.section,
            className: "sector-symbol",
          })}
        </div>
      `;
    })
    .join("");

  return `
    <article class="nexus-page">
      <div class="nexus-stage" aria-label="Nexus Sector Map">
        <div class="nexus-core">
          <h2>Nexus</h2>
          <p>${escapeHtml(String(sectors.length))} sectors indexed</p>
          <p class="key-hint">${escapeHtml(keyHintMarkup(selectedArtifactReward))}</p>
          ${keySlotMarkup(state, selectedArtifactReward)}
          <p class="key-hint">Arrows to roam. Enter to descend.</p>
        </div>
        <div class="nexus-orbit">${orbit}</div>
      </div>

      <section class="nexus-focus-card">
        <h3 class="nexus-focus-heading">
          ${renderRegionSymbol({
            section: selected.section,
            className: "nexus-focus-symbol",
          })}
          <span>${escapeHtml(selected.section)}</span>
        </h3>
        <p>${escapeHtml(String(selected.solved))}/${escapeHtml(String(selected.total))} solved</p>
        <div class="progress-bar"><span style="width:${selected.percent}%"></span></div>
        <p class="key-hint" style="margin-top: 8px;">Focused sector: ${escapeHtml(selectedSlug.toUpperCase())}</p>
      </section>
    </article>
  `;
}
