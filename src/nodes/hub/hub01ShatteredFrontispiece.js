import { escapeHtml } from "../../templates/shared.js";
import { renderRegionSymbol, symbolLabelForKey } from "../../core/symbology.js";

const NODE_ID = "HUB01";
const SOLVED_PHRASE = "ARCHIVE OF WAYS";

const COLS = 4;
const ROWS = 3;
const PIECE_WIDTH = 15.5;
const PIECE_HEIGHT = 22;
const BOARD_ORIGIN_X = 19;
const BOARD_ORIGIN_Y = 16;
const SNAP_DISTANCE = 5.2;
const NUDGE_STEP = 1.6;
const ROTATION_STEP = 90;

const SHARD_SYMBOL_KEYS = Object.freeze([
  "cradle",
  "wandering-inn",
  "worm",
  "mother-of-learning",
  "hall-of-proofs",
  "prime-vault",
  "arcane-ascension",
  "symmetry-forge",
  "dungeon-crawler-carl",
  "curved-atlas",
  "practical-guide",
]);

const FLAT_SHARD_CLIP_PATH = "polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)";

function seededValue(seed) {
  const value = Math.sin(seed * 91.731 + 13.17) * 43758.5453;
  return value - Math.floor(value);
}

function randomScatter(index) {
  const sideBand = index % 2 === 0;
  const x = sideBand
    ? 2 + seededValue(index + 11) * 15
    : 82 - seededValue(index + 17) * 15;
  const y = 3 + seededValue(index + 31) * (100 - PIECE_HEIGHT - 6);
  const rotations = [0, 90, 180, 270];
  const rotation = rotations[Math.floor(seededValue(index + 53) * rotations.length)] || 0;
  return { x, y, rotation };
}

function buildPieceDefinitions() {
  const definitions = [];

  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      const index = row * COLS + col;
      const id = `shard-${index + 1}`;

      definitions.push({
        id,
        row,
        col,
        symbolKey: SHARD_SYMBOL_KEYS[index],
        targetX: BOARD_ORIGIN_X + col * PIECE_WIDTH,
        targetY: BOARD_ORIGIN_Y + row * PIECE_HEIGHT,
        targetRotation: 0,
        clipPath: FLAT_SHARD_CLIP_PATH,
      });
    }
  }

  return definitions;
}

const PIECE_DEFS = Object.freeze(buildPieceDefinitions());
const PIECE_DEF_BY_ID = Object.freeze(
  PIECE_DEFS.reduce((accumulator, definition) => {
    accumulator[definition.id] = definition;
    return accumulator;
  }, {}),
);

const PIECE_IDS = Object.freeze(PIECE_DEFS.map((definition) => definition.id));

function createInitialPieces() {
  return PIECE_DEFS.map((definition, index) => {
    const scatter = randomScatter(index);
    return {
      id: definition.id,
      x: scatter.x,
      y: scatter.y,
      rotation: scatter.rotation,
      placed: false,
    };
  });
}

function normalizeRotation(value) {
  const numeric = Number(value) || 0;
  const wrapped = ((numeric % 360) + 360) % 360;
  return wrapped;
}

function clampPercent(value, max) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 0;
  }
  return Math.max(0, Math.min(max, numeric));
}

function pieceDistance(left, right) {
  const dx = Number(left.x) - Number(right.x);
  const dy = Number(left.y) - Number(right.y);
  return Math.hypot(dx, dy);
}

function maybeSnapPiece(piece) {
  const definition = PIECE_DEF_BY_ID[piece.id];
  if (!definition) {
    return piece;
  }

  const nearTarget = pieceDistance(piece, {
    x: definition.targetX,
    y: definition.targetY,
  }) <= SNAP_DISTANCE;
  const alignedRotation = normalizeRotation(piece.rotation) === definition.targetRotation;

  if (nearTarget && alignedRotation) {
    return {
      ...piece,
      x: definition.targetX,
      y: definition.targetY,
      placed: true,
    };
  }

  return {
    ...piece,
    placed: false,
  };
}

function normalizePiece(piece, fallback) {
  const source = piece && typeof piece === "object" ? piece : {};
  return {
    id: fallback.id,
    x: clampPercent(source.x ?? fallback.x, 100 - PIECE_WIDTH),
    y: clampPercent(source.y ?? fallback.y, 100 - PIECE_HEIGHT),
    rotation: normalizeRotation(source.rotation ?? fallback.rotation),
    placed: Boolean(source.placed),
  };
}

function validatePieces(pieces) {
  const byId = new Map((pieces || []).map((piece) => [piece.id, piece]));

  return PIECE_DEFS.every((definition) => {
    const piece = byId.get(definition.id);
    if (!piece) {
      return false;
    }

    return (
      piece.placed &&
      Math.abs(piece.x - definition.targetX) < 0.0001 &&
      Math.abs(piece.y - definition.targetY) < 0.0001 &&
      normalizeRotation(piece.rotation) === definition.targetRotation
    );
  });
}

function withSolvedState(runtime) {
  const solved = validatePieces(runtime.pieces);
  return {
    ...runtime,
    solved,
    revealedPhrase: solved ? SOLVED_PHRASE : "",
  };
}

function normalizeRuntime(runtime) {
  const basePieces = createInitialPieces();
  const incoming = runtime && typeof runtime === "object" ? runtime : {};
  const incomingPieces = Array.isArray(incoming.pieces) ? incoming.pieces : [];
  const pieceMap = new Map(incomingPieces.map((piece) => [piece.id, piece]));

  const pieces = basePieces.map((fallback) => normalizePiece(pieceMap.get(fallback.id), fallback));
  const selectedPieceId = PIECE_IDS.includes(incoming.selectedPieceId)
    ? incoming.selectedPieceId
    : PIECE_IDS[0];

  return withSolvedState({
    pieces,
    selectedPieceId,
    solved: false,
    revealedPhrase: "",
  });
}

function replacePiece(runtime, pieceId, updater) {
  let changed = false;
  const pieces = runtime.pieces.map((piece) => {
    if (piece.id !== pieceId) {
      return piece;
    }

    const updated = updater(piece);
    if (updated !== piece) {
      changed = true;
    }

    return updated;
  });

  if (!changed) {
    return runtime;
  }

  return {
    ...runtime,
    pieces,
    selectedPieceId: pieceId,
  };
}

function selectedPieceIdFromRuntime(runtime, eventTarget) {
  const target = eventTarget instanceof Element ? eventTarget.closest("[data-node-piece]") : null;
  const pieceId = target && target.getAttribute("data-piece-id");
  if (pieceId && PIECE_IDS.includes(pieceId)) {
    return pieceId;
  }

  return runtime.selectedPieceId;
}

function piecesMarkup(runtime, solved) {
  return runtime.pieces
    .map((piece) => {
      const definition = PIECE_DEF_BY_ID[piece.id];
      if (!definition) {
        return "";
      }

      const selected = piece.id === runtime.selectedPieceId;
      const classes = ["hub01-piece"];
      if (selected) {
        classes.push("is-selected");
      }
      if (piece.placed) {
        classes.push("is-placed");
      }

      return `
        <button
          type="button"
          class="${classes.join(" ")}"
          style="left:${piece.x}%; top:${piece.y}%; transform: rotate(${piece.rotation}deg); --tile-x:${definition.col}; --tile-y:${definition.row}; --piece-clip:${definition.clipPath};"
          data-node-action="select-piece"
          data-node-id="${NODE_ID}"
          data-node-piece="true"
          data-piece-id="${piece.id}"
          draggable="${solved ? "false" : "true"}"
          ${solved ? "disabled" : ""}
          aria-label="${escapeHtml(
            `${piece.id.toUpperCase()}, ${symbolLabelForKey(definition.symbolKey)} symbol, rotation ${piece.rotation} degrees`,
          )}"
        >
          <span class="hub01-piece-symbol" aria-hidden="true">
            ${renderRegionSymbol({
              symbolKey: definition.symbolKey,
              className: "hub01-symbol",
            })}
          </span>
        </button>
      `;
    })
    .join("");
}

function actionNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

export function initialHub01Runtime() {
  return {
    pieces: createInitialPieces(),
    selectedPieceId: PIECE_IDS[0],
    solved: false,
    revealedPhrase: "",
  };
}

export function validateHub01Runtime(runtime) {
  return validatePieces(normalizeRuntime(runtime).pieces);
}

export function reduceHub01Runtime(runtime, action) {
  const current = normalizeRuntime(runtime);
  if (!action || typeof action !== "object") {
    return current;
  }

  if (current.solved) {
    return current;
  }

  if (action.type === "select-piece") {
    if (!PIECE_IDS.includes(action.pieceId)) {
      return current;
    }

    return {
      ...current,
      selectedPieceId: action.pieceId,
    };
  }

  if (action.type === "drop-piece") {
    if (!PIECE_IDS.includes(action.pieceId)) {
      return current;
    }

    const nextX = clampPercent(action.x, 100 - PIECE_WIDTH);
    const nextY = clampPercent(action.y, 100 - PIECE_HEIGHT);

    const dropped = replacePiece(current, action.pieceId, (piece) =>
      maybeSnapPiece({
        ...piece,
        x: nextX,
        y: nextY,
      }),
    );

    return withSolvedState(dropped);
  }

  if (action.type === "rotate-selected") {
    const pieceId = PIECE_IDS.includes(action.pieceId) ? action.pieceId : current.selectedPieceId;
    const step = actionNumber(action.step, ROTATION_STEP);

    const rotated = replacePiece(current, pieceId, (piece) =>
      maybeSnapPiece({
        ...piece,
        rotation: normalizeRotation(piece.rotation + step),
      }),
    );

    return withSolvedState(rotated);
  }

  if (action.type === "nudge-selected") {
    const pieceId = PIECE_IDS.includes(action.pieceId) ? action.pieceId : current.selectedPieceId;
    const dx = actionNumber(action.dx, 0);
    const dy = actionNumber(action.dy, 0);

    const nudged = replacePiece(current, pieceId, (piece) =>
      maybeSnapPiece({
        ...piece,
        x: clampPercent(piece.x + dx, 100 - PIECE_WIDTH),
        y: clampPercent(piece.y + dy, 100 - PIECE_HEIGHT),
      }),
    );

    return withSolvedState(nudged);
  }

  if (action.type === "reshuffle") {
    return initialHub01Runtime();
  }

  return current;
}

export function buildHub01ActionFromElement(element) {
  const actionName = element.getAttribute("data-node-action");
  if (actionName !== "select-piece") {
    return null;
  }

  return {
    type: "select-piece",
    pieceId: element.getAttribute("data-piece-id"),
  };
}

export function buildHub01DropAction(payload) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const pieceId = payload.pieceId;
  const xPercent = Number(payload.xPercent);
  const yPercent = Number(payload.yPercent);

  if (!PIECE_IDS.includes(pieceId) || !Number.isFinite(xPercent) || !Number.isFinite(yPercent)) {
    return null;
  }

  return {
    type: "drop-piece",
    pieceId,
    x: xPercent - PIECE_WIDTH / 2,
    y: yPercent - PIECE_HEIGHT / 2,
  };
}

export function buildHub01KeyAction(event, runtime) {
  if (event.metaKey || event.ctrlKey || event.altKey) {
    return null;
  }

  const current = normalizeRuntime(runtime);
  const activePieceId = selectedPieceIdFromRuntime(current, event.target);
  if (!PIECE_IDS.includes(activePieceId)) {
    return null;
  }

  if (event.key === "q" || event.key === "Q" || event.key === "[") {
    return {
      type: "rotate-selected",
      pieceId: activePieceId,
      step: -ROTATION_STEP,
    };
  }

  if (event.key === "e" || event.key === "E" || event.key === "]") {
    return {
      type: "rotate-selected",
      pieceId: activePieceId,
      step: ROTATION_STEP,
    };
  }

  if (event.key === "ArrowUp") {
    return {
      type: "nudge-selected",
      pieceId: activePieceId,
      dx: 0,
      dy: -NUDGE_STEP,
    };
  }

  if (event.key === "ArrowDown") {
    return {
      type: "nudge-selected",
      pieceId: activePieceId,
      dx: 0,
      dy: NUDGE_STEP,
    };
  }

  if (event.key === "ArrowLeft") {
    return {
      type: "nudge-selected",
      pieceId: activePieceId,
      dx: -NUDGE_STEP,
      dy: 0,
    };
  }

  if (event.key === "ArrowRight") {
    return {
      type: "nudge-selected",
      pieceId: activePieceId,
      dx: NUDGE_STEP,
      dy: 0,
    };
  }

  if (event.key === "r" || event.key === "R") {
    return {
      type: "reshuffle",
    };
  }

  return null;
}

export function renderHub01Experience(context) {
  const { runtime, solved } = context;
  const normalized = normalizeRuntime(runtime);
  const solvedNow = Boolean(solved || normalized.solved);
  const viewRuntime = solvedNow
    ? {
        ...normalized,
        solved: true,
        revealedPhrase: SOLVED_PHRASE,
      }
    : normalized;

  const placedCount = viewRuntime.pieces.filter((piece) => piece.placed).length;

  return `
    <article class="hub01-node hub01-immersive" data-node-id="${NODE_ID}">
      <section class="hub01-stage-immersive">
        <div class="hub01-workspace" data-node-dropzone="hub01" data-node-id="${NODE_ID}" aria-label="Shattered frontispiece workspace">
          <div class="hub01-assembly-halo" aria-hidden="true"></div>
          ${piecesMarkup(viewRuntime, solvedNow)}
        </div>
      </section>

      <p class="sr-only" role="status" aria-live="polite">${escapeHtml(String(placedCount))} of 12 shards aligned.</p>

      ${
        solvedNow
          ? `
            <section class="hub01-reveal hub01-reveal-immersive is-open" aria-live="polite">
              <p><strong>ARCHIVE OF WAYS Added to Artifacts</strong></p>
            </section>
          `
          : ""
      }
    </article>
  `;
}

export const HUB01_NODE_EXPERIENCE = {
  nodeId: NODE_ID,
  initialState: initialHub01Runtime,
  render: renderHub01Experience,
  reduceRuntime: reduceHub01Runtime,
  validateRuntime: validateHub01Runtime,
  buildActionFromElement: buildHub01ActionFromElement,
  buildDropAction: buildHub01DropAction,
  buildKeyAction: buildHub01KeyAction,
};
