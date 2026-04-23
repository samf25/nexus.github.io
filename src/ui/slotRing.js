import { escapeHtml } from "../templates/shared.js";

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function safeCount(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 0;
  }
  return Math.max(0, Math.floor(numeric));
}

function pointAt(index, total, radiusPct = 42) {
  const count = Math.max(1, safeCount(total));
  const angle = ((index / count) * Math.PI * 2) - (Math.PI / 2);
  const x = 50 + (Math.cos(angle) * radiusPct);
  const y = 50 + (Math.sin(angle) * radiusPct);
  return { x, y };
}

function attrsToString(attrs = {}) {
  const entries = Object.entries(attrs || {});
  if (!entries.length) {
    return "";
  }
  return entries
    .map(([key, value]) => {
      if (value === null || value === undefined || value === false) {
        return "";
      }
      if (value === true) {
        return `${escapeHtml(key)}`;
      }
      return `${escapeHtml(key)}=\"${escapeHtml(String(value))}\"`;
    })
    .filter(Boolean)
    .join(" ");
}

function connectorMarkup(points) {
  const list = Array.isArray(points) ? points : [];
  if (list.length < 2) {
    return "";
  }

  const segments = [];
  if (list.length === 2) {
    segments.push(`
      <line x1=\"${list[0].x.toFixed(2)}\" y1=\"${list[0].y.toFixed(2)}\" x2=\"${list[1].x.toFixed(2)}\" y2=\"${list[1].y.toFixed(2)}\"></line>
    `);
  } else {
    for (let index = 0; index < list.length; index += 1) {
      const next = (index + 1) % list.length;
      segments.push(`
        <line x1=\"${list[index].x.toFixed(2)}\" y1=\"${list[index].y.toFixed(2)}\" x2=\"${list[next].x.toFixed(2)}\" y2=\"${list[next].y.toFixed(2)}\"></line>
      `);
    }
  }

  return `
    <svg class=\"slot-ring-connectors\" viewBox=\"0 0 100 100\" preserveAspectRatio=\"none\" aria-hidden=\"true\">
      ${segments.join("")}
    </svg>
  `;
}

export function renderSlotRing({
  slots = [],
  className = "",
  radiusPct = 42,
  centerHtml = "",
  ariaLabel = "Slot ring",
} = {}) {
  const list = Array.isArray(slots) ? slots : [];
  const count = list.length;
  const isSingle = count <= 1;
  const computedRadius = isSingle ? 0 : clamp(Number(radiusPct) || 42, 12, 46);
  const points = list.map((_, index) => pointAt(index, count, computedRadius));

  return `
    <div class=\"slot-ring ${isSingle ? "is-single" : ""} ${escapeHtml(className)}\" aria-label=\"${escapeHtml(ariaLabel)}\">
      ${connectorMarkup(points)}
      ${centerHtml ? `<div class=\"slot-ring-center\">${centerHtml}</div>` : ""}
      ${list
        .map((slot, index) => {
          const point = points[index] || { x: 50, y: 50 };
          const filled = Boolean(slot && slot.filled);
          const classes = ["slot-ring-slot"];
          if (filled) {
            classes.push("is-filled");
          }
          if (slot && slot.ready) {
            classes.push("is-ready");
          }
          if (slot && slot.locked) {
            classes.push("is-locked");
          }
          if (slot && slot.className) {
            classes.push(String(slot.className));
          }
          const attrs = {
            ...(slot && slot.attrs && typeof slot.attrs === "object" ? slot.attrs : {}),
            style: `left:${point.x.toFixed(2)}%; top:${point.y.toFixed(2)}%;`,
            class: classes.join(" "),
            title: slot && slot.title ? slot.title : undefined,
            "aria-label": slot && slot.ariaLabel ? slot.ariaLabel : `Slot ${index + 1}`,
          };

          const symbolHtml = filled && slot && slot.symbolHtml ? slot.symbolHtml : "";
          const emptyHtml = slot && slot.emptyHtml ? slot.emptyHtml : "";
          const content = `
            <span class=\"slot-ring-slot-core\">
              ${symbolHtml || emptyHtml}
            </span>
          `;

          if (slot && slot.clickable) {
            attrs.type = "button";
            if (slot.disabled) {
              attrs.disabled = true;
            }
            return `<button ${attrsToString(attrs)}>${content}</button>`;
          }

          return `<div ${attrsToString(attrs)}>${content}</div>`;
        })
        .join("")}
    </div>
  `;
}
