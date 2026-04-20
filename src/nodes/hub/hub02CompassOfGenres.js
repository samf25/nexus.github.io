import { escapeHtml } from "../../templates/shared.js";

const NODE_ID = "HUB02";
const OUTER_RING_SIZE = 8;
const INNER_RING_SIZE = 4;
const OUTER_RADIUS = 40;
const INNER_RADIUS = 23;
const DROP_MAX_DISTANCE = 13;

const ICONS = Object.freeze([
  { iconId: "outer-cradle", label: "Cradle", short: "CR", ringType: "outer" },
  { iconId: "outer-wandering-inn", label: "Wandering Inn", short: "WI", ringType: "outer" },
  { iconId: "outer-worm", label: "Worm", short: "WO", ringType: "outer" },
  { iconId: "outer-mol", label: "Mother of Learning", short: "ML", ringType: "outer" },
  { iconId: "outer-arcane", label: "Arcane Ascension", short: "AA", ringType: "outer" },
  { iconId: "outer-cosmere", label: "Cosmere", short: "CO", ringType: "outer" },
  { iconId: "outer-dcc", label: "Dungeon Crawler Carl", short: "DC", ringType: "outer" },
  { iconId: "outer-guide", label: "Practical Guide", short: "PG", ringType: "outer" },
  { iconId: "inner-logic", label: "Logic", short: "LG", ringType: "inner" },
  { iconId: "inner-number-theory", label: "Number Theory", short: "NT", ringType: "inner" },
  { iconId: "inner-algebra", label: "Abstract Algebra", short: "AL", ringType: "inner" },
  { iconId: "inner-geometry", label: "Differential Geometry", short: "DG", ringType: "inner" },
]);

const SOLVED_MAPPING = Object.freeze({
  "outer-cradle": "outer-1",
  "outer-wandering-inn": "outer-2",
  "outer-worm": "outer-3",
  "outer-mol": "outer-4",
  "outer-arcane": "outer-5",
  "outer-cosmere": "outer-6",
  "outer-dcc": "outer-7",
  "outer-guide": "outer-8",
  "inner-logic": "inner-1",
  "inner-number-theory": "inner-2",
  "inner-algebra": "inner-3",
  "inner-geometry": "inner-4",
});

const SOLVED_ROTATION = Object.freeze({
  outer: 2,
  inner: 1,
});

const SOLVED_ICON_BY_SOCKET = Object.freeze(
  Object.entries(SOLVED_MAPPING).reduce((accumulator, [iconId, socketId]) => {
    accumulator[socketId] = iconId;
    return accumulator;
  }, {}),
);

function polarPosition(index, total, radius) {
  const angle = ((Math.PI * 2) / Math.max(total, 1)) * index - Math.PI / 2;
  return {
    x: 50 + Math.cos(angle) * radius,
    y: 50 + Math.sin(angle) * radius,
  };
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

const ICON_BY_ID = Object.freeze(
  ICONS.reduce((accumulator, icon) => {
    accumulator[icon.iconId] = icon;
    return accumulator;
  }, {}),
);

const SOCKET_BY_ID = Object.freeze(
  SOCKETS.reduce((accumulator, socket) => {
    accumulator[socket.socketId] = socket;
    return accumulator;
  }, {}),
);

function normalizeStep(value, total) {
  const numeric = Number(value) || 0;
  const wrapped = ((numeric % total) + total) % total;
  return wrapped;
}

function allPlacementKeys() {
  return Object.keys(SOLVED_MAPPING);
}

function createEmptyPlacements() {
  return Object.fromEntries(allPlacementKeys().map((iconId) => [iconId, null]));
}

function normalizePlacements(candidate) {
  const base = createEmptyPlacements();
  const input = candidate && typeof candidate === "object" ? candidate : {};

  for (const iconId of allPlacementKeys()) {
    const socketId = input[iconId];
    base[iconId] = SOCKET_BY_ID[socketId] ? socketId : null;
  }

  return base;
}

function normalizeRuntime(runtime) {
  const source = runtime && typeof runtime === "object" ? runtime : {};
  const placements = normalizePlacements(source.placements);
  const selectedIconId = ICON_BY_ID[source.selectedIconId] ? source.selectedIconId : ICONS[0].iconId;
  const outerRotationStep = normalizeStep(source.outerRotationStep, OUTER_RING_SIZE);
  const innerRotationStep = normalizeStep(source.innerRotationStep, INNER_RING_SIZE);
  const solved =
    placementsAreSolved(placements) &&
    rotationsAreSolved({
      outerRotationStep,
      innerRotationStep,
    });
  const extracted = solved
    ? extractionCode({
        placements,
        outerRotationStep,
        innerRotationStep,
      })
    : "";

  return {
    placements,
    selectedIconId,
    outerRotationStep,
    innerRotationStep,
    solved,
    extracted,
  };
}

function findIconAssignedToSocket(placements, socketId) {
  return allPlacementKeys().find((iconId) => placements[iconId] === socketId) || null;
}

function placeIcon(placements, iconId, socketId) {
  const next = { ...placements };

  for (const candidateIconId of allPlacementKeys()) {
    if (candidateIconId === iconId) {
      continue;
    }
    if (next[candidateIconId] === socketId) {
      next[candidateIconId] = null;
    }
  }

  next[iconId] = socketId;
  return next;
}

function placementsAreSolved(placements) {
  return allPlacementKeys().every((iconId) => placements[iconId] === SOLVED_MAPPING[iconId]);
}

function rotationsAreSolved(runtime) {
  return (
    runtime.outerRotationStep === SOLVED_ROTATION.outer &&
    runtime.innerRotationStep === SOLVED_ROTATION.inner
  );
}

function rotatedSocketForView(ringType, visualIndex, step) {
  const total = ringType === "outer" ? OUTER_RING_SIZE : INNER_RING_SIZE;
  const resolvedIndex = normalizeStep(visualIndex - step, total);
  return `${ringType}-${resolvedIndex + 1}`;
}

function iconCodeAtVisualTick(runtime, ringType, visualIndex) {
  const step = ringType === "outer" ? runtime.outerRotationStep : runtime.innerRotationStep;
  const socketId = rotatedSocketForView(ringType, visualIndex, step);
  const iconId = findIconAssignedToSocket(runtime.placements, socketId);
  const icon = iconId ? ICON_BY_ID[iconId] : null;
  return icon ? icon.short : "??";
}

function extractionCode(runtime) {
  const outerTicks = Array.from({ length: OUTER_RING_SIZE }, (_, tick) =>
    iconCodeAtVisualTick(runtime, "outer", tick),
  );
  const innerTicks = Array.from({ length: INNER_RING_SIZE }, (_, tick) =>
    iconCodeAtVisualTick(runtime, "inner", tick),
  );
  return `${outerTicks.join("")}-${innerTicks.join("")}`;
}

const TARGET_CODE = extractionCode({
  placements: SOLVED_MAPPING,
  outerRotationStep: SOLVED_ROTATION.outer,
  innerRotationStep: SOLVED_ROTATION.inner,
});

function formatCode(code) {
  const [outer = "", inner = ""] = String(code || "").split("-");
  const pairGroup = (value) => {
    const matches = String(value).match(/.{1,2}/g);
    return matches ? matches.join(" ") : "";
  };

  return `${pairGroup(outer)} | ${pairGroup(inner)}`.trim();
}

function withSolvedState(runtime) {
  const solved = placementsAreSolved(runtime.placements) && rotationsAreSolved(runtime);
  return {
    ...runtime,
    solved,
    extracted: solved ? extractionCode(runtime) : "",
  };
}

function nearestSocket(xPercent, yPercent) {
  let best = null;
  for (const socket of SOCKETS) {
    const dx = xPercent - socket.x;
    const dy = yPercent - socket.y;
    const distance = Math.hypot(dx, dy);
    if (!best || distance < best.distance) {
      best = {
        socket,
        distance,
      };
    }
  }

  if (!best || best.distance > DROP_MAX_DISTANCE) {
    return null;
  }

  return best.socket;
}

function runtimeWithAction(runtime, action) {
  const current = normalizeRuntime(runtime);
  if (!action || typeof action !== "object") {
    return current;
  }

  if (current.solved) {
    return current;
  }

  if (action.type === "select-icon") {
    if (!ICON_BY_ID[action.iconId]) {
      return current;
    }
    return {
      ...current,
      selectedIconId: action.iconId,
    };
  }

  if (action.type === "place-icon") {
    if (!ICON_BY_ID[action.iconId] || !SOCKET_BY_ID[action.socketId]) {
      return current;
    }

    const next = {
      ...current,
      selectedIconId: action.iconId,
      placements: placeIcon(current.placements, action.iconId, action.socketId),
    };

    return withSolvedState(next);
  }

  if (action.type === "place-selected") {
    if (!SOCKET_BY_ID[action.socketId]) {
      return current;
    }

    const next = {
      ...current,
      placements: placeIcon(current.placements, current.selectedIconId, action.socketId),
    };

    return withSolvedState(next);
  }

  if (action.type === "remove-icon") {
    if (!ICON_BY_ID[action.iconId]) {
      return current;
    }

    const next = {
      ...current,
      placements: {
        ...current.placements,
        [action.iconId]: null,
      },
    };

    return withSolvedState(next);
  }

  if (action.type === "rotate-outer") {
    const next = {
      ...current,
      outerRotationStep: normalizeStep(
        current.outerRotationStep + (Number(action.step) || 1),
        OUTER_RING_SIZE,
      ),
    };

    return withSolvedState(next);
  }

  if (action.type === "rotate-inner") {
    const next = {
      ...current,
      innerRotationStep: normalizeStep(
        current.innerRotationStep + (Number(action.step) || 1),
        INNER_RING_SIZE,
      ),
    };

    return withSolvedState(next);
  }

  if (action.type === "reset-placements") {
    const next = {
      ...current,
      placements: createEmptyPlacements(),
    };

    return withSolvedState(next);
  }

  if (action.type === "reset-rotations") {
    const next = {
      ...current,
      outerRotationStep: 0,
      innerRotationStep: 0,
    };

    return withSolvedState(next);
  }

  return current;
}

function ringSocketMarkup(runtime, ringType, locked) {
  const sockets = SOCKETS.filter((socket) => socket.ringType === ringType);
  return sockets
    .map((socket) => {
      const iconId = findIconAssignedToSocket(runtime.placements, socket.socketId);
      const icon = iconId ? ICON_BY_ID[iconId] : null;
      const selected = runtime.selectedIconId === iconId;
      const socketSolutionIcon = ICON_BY_ID[SOLVED_ICON_BY_SOCKET[socket.socketId]] || null;
      const socketClue = socketSolutionIcon ? socketSolutionIcon.short : "..";

      return `
        <div class="hub02-socket ${icon ? "is-filled" : ""}" style="left:${socket.x}%; top:${socket.y}%;" aria-label="${escapeHtml(socket.socketId)}">
          ${
            icon
              ? `
                <button
                  type="button"
                  class="hub02-chip ${selected ? "is-selected" : ""} ${icon.ringType === "inner" ? "is-math" : "is-fiction"}"
                  draggable="true"
                  data-node-piece="true"
                  data-piece-id="${escapeHtml(icon.iconId)}"
                  data-node-id="${NODE_ID}"
                  data-node-action="select-icon"
                  data-icon-id="${escapeHtml(icon.iconId)}"
                  aria-label="${escapeHtml(icon.label)} placed in ${escapeHtml(socket.socketId)}"
                  ${locked ? "disabled" : ""}
                >
                  ${escapeHtml(icon.short)}
                </button>
              `
              : `
                <button
                  type="button"
                  class="hub02-socket-core"
                  data-node-action="place-selected"
                  data-node-id="${NODE_ID}"
                  data-socket-id="${escapeHtml(socket.socketId)}"
                  aria-label="Place selected icon into ${escapeHtml(socket.socketId)}"
                  ${locked ? "disabled" : ""}
                >
                  ${escapeHtml(socketClue)}
                </button>
              `
          }
        </div>
      `;
    })
    .join("");
}

function trayMarkup(runtime, locked) {
  const trayIcons = ICONS.filter((icon) => !runtime.placements[icon.iconId]);
  if (!trayIcons.length) {
    return `<div class="hub02-empty">All icons placed.</div>`;
  }

  return trayIcons
    .map((icon) => {
      const selected = runtime.selectedIconId === icon.iconId;
      return `
        <button
          type="button"
          class="hub02-chip ${selected ? "is-selected" : ""} ${icon.ringType === "inner" ? "is-math" : "is-fiction"}"
          draggable="true"
          data-node-piece="true"
          data-piece-id="${escapeHtml(icon.iconId)}"
          data-node-id="${NODE_ID}"
          data-node-action="select-icon"
          data-icon-id="${escapeHtml(icon.iconId)}"
          aria-label="${escapeHtml(icon.label)}"
          ${locked ? "disabled" : ""}
        >
          ${escapeHtml(icon.short)}
        </button>
      `;
    })
    .join("");
}

export function initialHub02Runtime() {
  return {
    placements: createEmptyPlacements(),
    selectedIconId: ICONS[0].iconId,
    outerRotationStep: 0,
    innerRotationStep: 0,
    solved: false,
    extracted: "",
  };
}

export function validateHub02Runtime(runtime) {
  const normalized = normalizeRuntime(runtime);
  return placementsAreSolved(normalized.placements) && rotationsAreSolved(normalized);
}

export function reduceHub02Runtime(runtime, action) {
  return runtimeWithAction(runtime, action);
}

export function buildHub02ActionFromElement(element) {
  const actionName = element.getAttribute("data-node-action");
  if (!actionName) {
    return null;
  }

  if (actionName === "select-icon") {
    return {
      type: "select-icon",
      iconId: element.getAttribute("data-icon-id"),
    };
  }

  if (actionName === "place-selected") {
    return {
      type: "place-selected",
      socketId: element.getAttribute("data-socket-id"),
    };
  }

  if (actionName === "remove-icon") {
    return {
      type: "remove-icon",
      iconId: element.getAttribute("data-icon-id"),
    };
  }

  if (actionName === "rotate-outer") {
    return {
      type: "rotate-outer",
      step: Number(element.getAttribute("data-step")) || 1,
    };
  }

  if (actionName === "rotate-inner") {
    return {
      type: "rotate-inner",
      step: Number(element.getAttribute("data-step")) || 1,
    };
  }

  if (actionName === "reset-placements") {
    return {
      type: "reset-placements",
    };
  }

  if (actionName === "reset-rotations") {
    return {
      type: "reset-rotations",
    };
  }

  return null;
}

export function buildHub02WheelAction(event) {
  if (event.metaKey || event.ctrlKey || event.altKey) {
    return null;
  }

  const target = event.target instanceof HTMLElement ? event.target : null;
  if (!target) {
    return null;
  }

  const onBoard = target.closest(".hub02-board");
  if (!onBoard) {
    return null;
  }

  const deltaY = Number(event.deltaY);
  if (!Number.isFinite(deltaY) || deltaY === 0) {
    return null;
  }

  const step = deltaY > 0 ? 1 : -1;
  if (target.closest(".hub02-ring-inner")) {
    return {
      type: "rotate-inner",
      step,
    };
  }

  return {
    type: "rotate-outer",
    step,
  };
}

export function buildHub02DropAction(payload) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const iconId = payload.pieceId;
  const xPercent = Number(payload.xPercent);
  const yPercent = Number(payload.yPercent);

  if (!ICON_BY_ID[iconId] || !Number.isFinite(xPercent) || !Number.isFinite(yPercent)) {
    return null;
  }

  const socket = nearestSocket(xPercent, yPercent);
  if (!socket) {
    return null;
  }

  const icon = ICON_BY_ID[iconId];
  if (socket.ringType !== icon.ringType) {
    return null;
  }

  return {
    type: "place-icon",
    iconId,
    socketId: socket.socketId,
  };
}

export function buildHub02KeyAction(event) {
  if (event.metaKey || event.ctrlKey || event.altKey) {
    return null;
  }

  if (event.key === "ArrowLeft") {
    return {
      type: "rotate-outer",
      step: -1,
    };
  }

  if (event.key === "ArrowRight") {
    return {
      type: "rotate-outer",
      step: 1,
    };
  }

  if (event.key === "ArrowUp") {
    return {
      type: "rotate-inner",
      step: 1,
    };
  }

  if (event.key === "ArrowDown") {
    return {
      type: "rotate-inner",
      step: -1,
    };
  }

  return null;
}

export function renderHub02Experience(context) {
  const { runtime, solved } = context;
  const normalized = normalizeRuntime(runtime);
  const solvedNow = Boolean(solved || normalized.solved);
  const viewRuntime = solvedNow
    ? {
        ...normalized,
        solved: true,
        extracted: normalized.extracted || "NEXUS-BEARINGS",
      }
    : normalized;

  const currentCode = formatCode(extractionCode(viewRuntime));
  const targetCode = formatCode(TARGET_CODE);

  return `
    <article class="hub02-node hub02-immersive" data-node-id="${NODE_ID}">
      <div class="hub02-shell">
        <section class="hub02-stage-immersive">
          <div class="hub02-board" data-node-dropzone="hub02" data-node-id="${NODE_ID}" aria-label="Dual ring compass board">
            <div class="hub02-ring hub02-ring-outer">
              ${ringSocketMarkup(viewRuntime, "outer", solvedNow)}
            </div>
            <div class="hub02-ring hub02-ring-inner">
              ${ringSocketMarkup(viewRuntime, "inner", solvedNow)}
            </div>
          </div>

          <div class="hub02-tray" aria-label="Unplaced icons">
            ${trayMarkup(viewRuntime, solvedNow)}
          </div>

          <div class="hub02-code-plate ${solvedNow ? "is-solved" : ""}" aria-live="polite">
            <div class="hub02-code-target">${escapeHtml(targetCode)}</div>
            <div class="hub02-code-current">${escapeHtml(currentCode)}</div>
          </div>
        </section>
      </div>

      ${
        solvedNow
          ? `
            <section class="hub02-status hub02-status-immersive" aria-live="polite">
              <p><strong>${escapeHtml(formatCode(viewRuntime.extracted))}</strong></p>
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
  buildDropAction: buildHub02DropAction,
  buildKeyAction: buildHub02KeyAction,
  buildWheelAction: buildHub02WheelAction,
};
