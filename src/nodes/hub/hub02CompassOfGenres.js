import { escapeHtml } from "../../templates/shared.js";
import { renderRegionSymbol } from "../../core/symbology.js";

const NODE_ID = "HUB02";
const OUTER_RING_SIZE = 7;
const INNER_RING_SIZE = 4;
const OUTER_RADIUS = 40;
const INNER_RADIUS = 23;

const OUTER_ICONS = Object.freeze([
  { iconId: "outer-cradle", label: "Cradle", symbolKey: "cradle" },
  { iconId: "outer-wandering-inn", label: "Wandering Inn", symbolKey: "wandering-inn" },
  { iconId: "outer-worm", label: "Worm", symbolKey: "worm" },
  { iconId: "outer-mol", label: "Mother of Learning", symbolKey: "mother-of-learning" },
  { iconId: "outer-arcane", label: "Arcane Ascension", symbolKey: "arcane-ascension" },
  { iconId: "outer-dcc", label: "Dungeon Crawler Carl", symbolKey: "dungeon-crawler-carl" },
  { iconId: "outer-guide", label: "Practical Guide", symbolKey: "practical-guide" },
]);

const INNER_ICONS = Object.freeze([
  { iconId: "inner-logic", label: "Hall of Proofs", symbolKey: "hall-of-proofs" },
  { iconId: "inner-number-theory", label: "Prime Vault", symbolKey: "prime-vault" },
  { iconId: "inner-algebra", label: "Symmetry Forge", symbolKey: "symmetry-forge" },
  { iconId: "inner-geometry", label: "Curved Atlas", symbolKey: "curved-atlas" },
]);

const SOLVED_ROTATION = Object.freeze({
  outer: 2,
  inner: 1,
});

const LABELLED_SYMBOL_KEYS = new Set([
  "cradle",
  "wandering-inn",
  "worm",
  "mother-of-learning",
  "hall-of-proofs",
  "prime-vault",
]);

function polarPosition(index, total, radius) {
  const angle = ((Math.PI * 2) / Math.max(total, 1)) * index - Math.PI / 2;
  return {
    x: 50 + Math.cos(angle) * radius,
    y: 50 + Math.sin(angle) * radius,
  };
}

function normalizeStep(value, total) {
  const numeric = Number(value) || 0;
  return ((numeric % total) + total) % total;
}

function ringSize(ringType) {
  return ringType === "outer" ? OUTER_RING_SIZE : INNER_RING_SIZE;
}

function ringRadius(ringType) {
  return ringType === "outer" ? OUTER_RADIUS : INNER_RADIUS;
}

function ringIcons(ringType) {
  return ringType === "outer" ? OUTER_ICONS : INNER_ICONS;
}

function buildSockets(prefix, total, radius, ringType) {
  return Array.from({ length: total }, (_, index) => {
    const position = polarPosition(index, total, radius);
    return {
      socketId: `${prefix}-${index + 1}`,
      ringType,
      index,
      x: position.x,
      y: position.y,
    };
  });
}

const SOCKETS = Object.freeze([
  ...buildSockets("outer", OUTER_RING_SIZE, OUTER_RADIUS, "outer"),
  ...buildSockets("inner", INNER_RING_SIZE, INNER_RADIUS, "inner"),
]);

function buildLabelBySocket() {
  const labels = {};

  for (const ringType of ["outer", "inner"]) {
    const icons = ringIcons(ringType);
    const total = ringSize(ringType);
    const solvedStep = SOLVED_ROTATION[ringType];

    for (let baseIndex = 0; baseIndex < icons.length; baseIndex += 1) {
      const icon = icons[baseIndex];
      if (!LABELLED_SYMBOL_KEYS.has(icon.symbolKey)) {
        continue;
      }

      const solvedSocketIndex = normalizeStep(baseIndex + solvedStep, total);
      const socketId = `${ringType}-${solvedSocketIndex + 1}`;
      labels[socketId] = {
        symbolKey: icon.symbolKey,
        label: icon.label,
      };
    }
  }

  return labels;
}

const LABEL_BY_SOCKET = Object.freeze(buildLabelBySocket());

function normalizeRuntime(runtime) {
  const source = runtime && typeof runtime === "object" ? runtime : {};
  const outerRotationStep = normalizeStep(source.outerRotationStep, OUTER_RING_SIZE);
  const innerRotationStep = normalizeStep(source.innerRotationStep, INNER_RING_SIZE);
  const activeRing = source.activeRing === "inner" ? "inner" : "outer";
  const solved =
    outerRotationStep === SOLVED_ROTATION.outer &&
    innerRotationStep === SOLVED_ROTATION.inner;

  return {
    outerRotationStep,
    innerRotationStep,
    activeRing,
    solved,
  };
}

function withSolvedState(runtime) {
  return {
    ...runtime,
    solved:
      runtime.outerRotationStep === SOLVED_ROTATION.outer &&
      runtime.innerRotationStep === SOLVED_ROTATION.inner,
  };
}

function nextRotation(runtime, ringType, step) {
  if (ringType !== "outer" && ringType !== "inner") {
    return runtime;
  }

  const total = ringSize(ringType);
  const amount = Number(step) || 1;
  return withSolvedState({
    ...runtime,
    [ringType === "outer" ? "outerRotationStep" : "innerRotationStep"]: normalizeStep(
      (ringType === "outer" ? runtime.outerRotationStep : runtime.innerRotationStep) + amount,
      total,
    ),
  });
}

function iconPositionForRuntime(ringType, baseIndex, runtime) {
  const step = ringType === "outer" ? runtime.outerRotationStep : runtime.innerRotationStep;
  const total = ringSize(ringType);
  const radius = ringRadius(ringType);
  return polarPosition(normalizeStep(baseIndex + step, total), total, radius);
}

function wheelSocketMarkup(ringType) {
  return SOCKETS.filter((socket) => socket.ringType === ringType)
    .map((socket) => {
      const clue = LABEL_BY_SOCKET[socket.socketId];
      const content = clue
        ? `
            <span class="hub02-wheel-label-symbol" title="${escapeHtml(clue.label)}">
              ${renderRegionSymbol({
                symbolKey: clue.symbolKey,
                className: "hub02-wheel-symbol",
              })}
            </span>
          `
        : `<span class="hub02-wheel-mystery">?</span>`;

      return `
        <div class="hub02-wheel-socket ${clue ? "is-known" : "is-mystery"}" style="left:${socket.x}%; top:${socket.y}%;">
          ${content}
        </div>
      `;
    })
    .join("");
}

function socketNameMarkup() {
  return SOCKETS.map((socket) => {
    const clue = LABEL_BY_SOCKET[socket.socketId];
    if (!clue) {
      return "";
    }

    const offset = socket.ringType === "outer" ? 22 : 18;
    return `
      <div
        class="hub02-wheel-name hub02-wheel-name-${socket.ringType}"
        style="left:${socket.x}%; top:calc(${socket.y}% + ${offset}px);"
      >
        ${escapeHtml(clue.label)}
      </div>
    `;
  })
    .join("");
}

function wheelIconsMarkup(runtime, ringType) {
  const icons = ringIcons(ringType);
  return icons
    .map((icon, baseIndex) => {
      const position = iconPositionForRuntime(ringType, baseIndex, runtime);
      return `
        <div class="hub02-wheel-icon ${ringType === "inner" ? "is-math" : "is-fiction"}" style="left:${position.x}%; top:${position.y}%;" aria-hidden="true">
          ${renderRegionSymbol({
            symbolKey: icon.symbolKey,
            className: "hub02-chip-symbol",
          })}
        </div>
      `;
    })
    .join("");
}

export function initialHub02Runtime() {
  return {
    outerRotationStep: 0,
    innerRotationStep: 0,
    activeRing: "outer",
    solved: false,
  };
}

export function validateHub02Runtime(runtime) {
  const normalized = normalizeRuntime(runtime);
  return (
    normalized.outerRotationStep === SOLVED_ROTATION.outer &&
    normalized.innerRotationStep === SOLVED_ROTATION.inner
  );
}

export function reduceHub02Runtime(runtime, action) {
  const current = normalizeRuntime(runtime);
  if (!action || typeof action !== "object") {
    return current;
  }

  if (current.solved) {
    return current;
  }

  if (action.type === "focus-ring") {
    if (action.ringType !== "outer" && action.ringType !== "inner") {
      return current;
    }
    return {
      ...current,
      activeRing: action.ringType,
    };
  }

  if (action.type === "rotate-active") {
    return nextRotation(current, current.activeRing, action.step);
  }

  if (action.type === "rotate-ring") {
    return nextRotation(current, action.ringType, action.step);
  }

  return current;
}

export function buildHub02ActionFromElement(element) {
  const actionName = element.getAttribute("data-node-action");
  if (!actionName) {
    return null;
  }

  if (actionName === "focus-ring") {
    return {
      type: "focus-ring",
      ringType: element.getAttribute("data-ring"),
    };
  }

  return null;
}

export function buildHub02WheelAction(event, runtime) {
  if (event.metaKey || event.ctrlKey || event.altKey) {
    return null;
  }

  const target = event.target instanceof Element ? event.target : null;
  if (!target || !target.closest(".hub02-board")) {
    return null;
  }

  const normalized = normalizeRuntime(runtime);
  const deltaY = Number(event.deltaY);
  if (!Number.isFinite(deltaY) || deltaY === 0) {
    return null;
  }

  return {
    type: "rotate-ring",
    ringType: normalized.activeRing,
    step: deltaY > 0 ? 1 : -1,
  };
}

export function buildHub02KeyAction(event, runtime) {
  if (event.metaKey || event.ctrlKey || event.altKey) {
    return null;
  }

  const normalized = normalizeRuntime(runtime);
  if (
    event.key === "ArrowLeft" ||
    event.key === "ArrowUp"
  ) {
    return {
      type: "rotate-ring",
      ringType: normalized.activeRing,
      step: -1,
    };
  }

  if (
    event.key === "ArrowRight" ||
    event.key === "ArrowDown"
  ) {
    return {
      type: "rotate-ring",
      ringType: normalized.activeRing,
      step: 1,
    };
  }

  return null;
}

export function renderHub02Experience(context) {
  const { runtime, solved } = context;
  const normalized = normalizeRuntime(runtime);
  const solvedNow = Boolean(solved || normalized.solved);

  return `
    <article class="hub02-node hub02-immersive hub02-minimal" data-node-id="${NODE_ID}">
      <div class="hub02-shell">
        <section class="hub02-stage-immersive">
          <div class="hub02-board" data-node-id="${NODE_ID}" aria-label="Compass ring alignment board">
            <div
              class="hub02-ring-hotspot hub02-ring-hotspot-outer ${normalized.activeRing === "outer" ? "is-active" : ""}"
              data-node-id="${NODE_ID}"
              data-node-action="focus-ring"
              data-ring="outer"
              aria-label="Select outer ring"
              role="button"
              tabindex="0"
            ></div>
            <div
              class="hub02-ring-hotspot hub02-ring-hotspot-inner ${normalized.activeRing === "inner" ? "is-active" : ""}"
              data-node-id="${NODE_ID}"
              data-node-action="focus-ring"
              data-ring="inner"
              aria-label="Select inner ring"
              role="button"
              tabindex="0"
            ></div>

            <div class="hub02-wheel-labels hub02-wheel-labels-outer">${wheelSocketMarkup("outer")}</div>
            <div class="hub02-wheel-labels hub02-wheel-labels-inner">${wheelSocketMarkup("inner")}</div>
            <div class="hub02-wheel-names">${socketNameMarkup()}</div>

            <div class="hub02-wheel-icons hub02-wheel-icons-outer">${wheelIconsMarkup(normalized, "outer")}</div>
            <div class="hub02-wheel-icons hub02-wheel-icons-inner">${wheelIconsMarkup(normalized, "inner")}</div>
          </div>
        </section>
      </div>

      <p class="sr-only" role="status" aria-live="polite">
        ${escapeHtml(
          solvedNow
            ? "Compass solved."
            : `Active ring: ${normalized.activeRing}. Use arrow keys to cycle symbols.`,
        )}
      </p>

      ${
        solvedNow
          ? `
            <section class="hub02-status hub02-status-immersive" aria-live="polite">
              <p><strong>Nexus Bearings aligned.</strong></p>
            </section>
          `
          : ""
      }
    </article>
  `;
}

export const HUB02_NODE_EXPERIENCE = {
  nodeId: NODE_ID,
  initialState: initialHub02Runtime,
  render: renderHub02Experience,
  reduceRuntime: reduceHub02Runtime,
  validateRuntime: validateHub02Runtime,
  buildActionFromElement: buildHub02ActionFromElement,
  buildKeyAction: buildHub02KeyAction,
  buildWheelAction: buildHub02WheelAction,
};
