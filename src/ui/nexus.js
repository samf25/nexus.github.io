import { escapeHtml } from "../templates/shared.js";
import { sectionRouteSlug } from "../data/blueprint.js";
import { renderRegionSymbol } from "../core/symbology.js";
import { renderSlotRing } from "./slotRing.js";
import {
  KEY_SLOT_DEFINITIONS,
  keySlotsFromState,
  renderArtifactSymbol,
  slotIdForReward,
} from "../core/artifacts.js";

const RING_LAYOUT = Object.freeze({
  outer: Object.freeze({ radiusPercent: 35, label: "Outer Ring" }),
  middle: Object.freeze({ radiusPercent: 26, label: "Region Ring" }),
  inner: Object.freeze({ radiusPercent: 19, label: "Vault Ring" }),
});

function polarPositionFromTopDegrees(angleFromTop, radiusPercent) {
  const radians = ((Number(angleFromTop) - 90) * Math.PI) / 180;
  const x = 50 + Math.cos(radians) * radiusPercent;
  const y = 50 + Math.sin(radians) * radiusPercent;
  return { x, y };
}

function ringAngleForNode(ring, nodeIndex, total) {
  const ringKey = String(ring && ring.ringKey ? ring.ringKey : "middle");
  const layout = RING_LAYOUT[ringKey] || RING_LAYOUT.middle;

  if (ringKey === "outer" && total > 0) {
    const hubIndex = (ring.sections || []).findIndex((entry) => String(entry.section) === "Nexus Hub");
    if (hubIndex >= 0 && nodeIndex === hubIndex) {
      return polarPositionFromTopDegrees(0, layout.radiusPercent);
    }

    const otherIndices = [];
    for (let index = 0; index < total; index += 1) {
      if (index !== hubIndex) {
        otherIndices.push(index);
      }
    }

    const otherCount = otherIndices.length;
    if (!otherCount) {
      return polarPositionFromTopDegrees(180, layout.radiusPercent);
    }

    const localIndex = Math.max(0, otherIndices.indexOf(nodeIndex));
    const start = 125;
    const end = 235;
    const span = end - start;
    const step = otherCount <= 1 ? 0 : span / (otherCount - 1);
    return polarPositionFromTopDegrees(start + localIndex * step, layout.radiusPercent);
  }

  const angle = ((360 / Math.max(total, 1)) * nodeIndex);
  return polarPositionFromTopDegrees(angle, layout.radiusPercent);
}

function keySlotMarkup(state, selectedArtifactReward) {
  const slots = keySlotsFromState(state);
  const selectedSlotId = slotIdForReward(selectedArtifactReward);
  const slotNodes = KEY_SLOT_DEFINITIONS.map((slot) => {
    const occupied = slots[slot.slotId];
    const canInsert = Boolean(!occupied && selectedSlotId === slot.slotId);
    const symbolHtml = occupied
      ? renderArtifactSymbol({
          artifactName: occupied.reward,
          className: "nexus-key-slot-symbol artifact-symbol",
        })
      : "";

    return {
      filled: Boolean(occupied),
      ready: canInsert,
      clickable: !occupied,
      disabled: Boolean(occupied),
      title: occupied
        ? `${slot.label}: ${occupied.reward}`
        : `${slot.label}: empty`,
      ariaLabel: `${slot.label} key slot`,
      symbolHtml,
      attrs: {
        "data-action": "nexus-slot-key",
        "data-slot-id": slot.slotId,
      },
    };
  });

  return renderSlotRing({
    slots: slotNodes,
    className: "nexus-key-slot-ring",
    radiusPct: 36,
    ariaLabel: "Nexus key sockets",
  });
}

function starClassNames(entry, isActive) {
  const classes = ["sector-star"];
  if (isActive) {
    classes.push("active");
  }
  if (entry.solved > 0) {
    classes.push("solved");
  } else if (entry.unlocked > 0) {
    classes.push("unlocked");
  } else {
    classes.push("locked");
  }
  return classes.join(" ");
}

function sectionColorProgress(entry) {
  const solved = Math.max(0, Number(entry && entry.solved ? entry.solved : 0));
  return Math.min(1, solved / 8);
}

function mixHexColor(fromHex, toHex, ratio) {
  const clamp = Math.max(0, Math.min(1, Number(ratio) || 0));
  const normalize = (hex) => {
    const value = String(hex || "").replace("#", "");
    if (value.length === 3) {
      return value.split("").map((char) => `${char}${char}`).join("");
    }
    return value.length === 6 ? value : "000000";
  };
  const from = normalize(fromHex);
  const to = normalize(toHex);
  const fromRgb = {
    r: parseInt(from.slice(0, 2), 16),
    g: parseInt(from.slice(2, 4), 16),
    b: parseInt(from.slice(4, 6), 16),
  };
  const toRgb = {
    r: parseInt(to.slice(0, 2), 16),
    g: parseInt(to.slice(2, 4), 16),
    b: parseInt(to.slice(4, 6), 16),
  };
  const r = Math.round(fromRgb.r + (toRgb.r - fromRgb.r) * clamp);
  const g = Math.round(fromRgb.g + (toRgb.g - fromRgb.g) * clamp);
  const b = Math.round(fromRgb.b + (toRgb.b - fromRgb.b) * clamp);
  return `#${[r, g, b].map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

function sectionCircleStyle(entry, position) {
  const progress = sectionColorProgress(entry);
  const fill = mixHexColor("#2f5f8f", "#2a7a65", progress);
  const border = mixHexColor("#9ae3f2", "#97ffcf", progress);
  const ring = mixHexColor("#0d1c38", "#163a31", progress);
  return [
    `left:${position.x}%`,
    `top:${position.y}%`,
    `--sector-fill:${fill}`,
    `--sector-border:${border}`,
    `--sector-ring:${ring}`,
  ].join("; ");
}

export function renderNexusView({ rings, selectedRingIndex, selectedItemIndices, state, selectedArtifactReward }) {
  const nexusRings = Array.isArray(rings) ? rings : [];

  if (!nexusRings.length) {
    return `
      <article class="nexus-page animated-fade">
        <div class="nexus-empty">No sectors discovered yet.</div>
      </article>
    `;
  }

  const safeRingIndex = Math.min(Math.max(Number(selectedRingIndex) || 0, 0), nexusRings.length - 1);
  const selectedRing = nexusRings[safeRingIndex];
  const ringItemIndex = Math.min(
    Math.max(Number(selectedItemIndices && selectedItemIndices[safeRingIndex]) || 0, 0),
    Math.max((selectedRing.sections || []).length - 1, 0),
  );
  const selected = selectedRing.sections[ringItemIndex];
  const selectedSlug = selected ? sectionRouteSlug(selected.section) : "";

  const orbit = `
    ${nexusRings
      .map((ring, ringIndex) => {
        const ringKey = String(ring.ringKey || "middle");
        const layout = RING_LAYOUT[ringKey] || RING_LAYOUT.middle;
        const isRingActive = ringIndex === safeRingIndex;
        const guideClass = `nexus-ring-guide nexus-ring-guide-${escapeHtml(ringKey)} ${isRingActive ? "is-active" : ""}`;

        const stars = (ring.sections || [])
          .map((entry, itemIndex) => {
            const position = ringAngleForNode(ring, itemIndex, ring.sections.length);
            const isActive = ringIndex === safeRingIndex && itemIndex === ringItemIndex;
            return `
              <button
                type="button"
                class="${starClassNames(entry, isActive)}"
                style="${sectionCircleStyle(entry, position)}"
                data-action="nexus-focus"
                data-ring-index="${ringIndex}"
                data-item-index="${itemIndex}"
                aria-label="${escapeHtml(`Focus ${entry.section}`)}"
              >
                ${renderRegionSymbol({
                  section: entry.section,
                  className: "sector-symbol",
                })}
              </button>
            `;
          })
          .join("");

        return `
          <div class="${guideClass}" style="--ring-size:${layout.radiusPercent * 2}%;" aria-hidden="true"></div>
          ${stars}
        `;
      })
      .join("")}
  `;

  return `
    <article class="nexus-page">
      <div class="nexus-stage" aria-label="Nexus Sector Map">
        <div class="nexus-core">
          <h2>Nexus</h2>
          ${keySlotMarkup(state, selectedArtifactReward)}
        </div>
        <div class="nexus-orbit">${orbit}</div>
      </div>

      <section class="nexus-focus-card">
        <h3 class="nexus-focus-heading">
          ${
            selected
              ? renderRegionSymbol({
                  section: selected.section,
                  className: "nexus-focus-symbol",
                })
              : ""
          }
          <span>${escapeHtml(selected ? selected.section : "No Sector")}</span>
        </h3>
        <p>${escapeHtml(selected ? String(selected.solved) : "0")}/${escapeHtml(selected ? String(selected.total) : "0")} solved</p>
        <div class="progress-bar"><span style="width:${selected ? selected.percent : 0}%"></span></div>
        ${selected && selected.progressLabel ? `<p class="key-hint" style="margin-top:8px;">${escapeHtml(selected.progressLabel)}</p>` : ""}
        <p class="key-hint" style="margin-top: 8px;">Focused ring: ${escapeHtml(selectedRing.label || RING_LAYOUT[selectedRing.ringKey]?.label || "Ring")}</p>
        <p class="key-hint">Focused sector: ${escapeHtml(selectedSlug ? selectedSlug.toUpperCase() : "N/A")}</p>
      </section>
    </article>
  `;
}
