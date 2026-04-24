import { escapeHtml } from "../../templates/shared.js";

const NODE_ID = "HUB07";
const INDEX_ARTIFACT = "Index String";
const FOG_PHRASE = "THE FOG REMEMBERS";
const NORMALIZED_FOG_PHRASE = "THEFOGREMEMBERS";

const COLS = 5;
const ROWS = 3;
const PIECE_WIDTH = 13.6;
const PIECE_HEIGHT = 21;
const BOARD_ORIGIN_X = 16;
const BOARD_ORIGIN_Y = 16;
const SNAP_DISTANCE = 4.8;
const NUDGE_STEP = 1.4;
const ROTATION_STEP = 90;
const FLAT_CLIP_PATH = "polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)";

const LINE_SPECS = Object.freeze([
  { id: "line-1", phraseIndex: 1, text: "Through silent arches, the Nexus listens for returning footsteps." },
  { id: "line-2", phraseIndex: 2, text: "Hollow starlight pools where forgotten routes once crossed." },
  { id: "line-3", phraseIndex: 3, text: "Each drifting page remembers the weight of a vanished hand." },
  { id: "line-4", phraseIndex: 4, text: "From broken lanterns, pale directions still whisper." },
  { id: "line-5", phraseIndex: 5, text: "Over the void, old names linger like breath on glass." },
  { id: "line-6", phraseIndex: 6, text: "Grains of dusk turn slowly in the hourless air." },
  { id: "line-7", phraseIndex: 7, text: "Rust-red comets sketch warnings no one speaks aloud." },
  { id: "line-8", phraseIndex: 8, text: "Even the distant gates hum with patient ache." },
  { id: "line-9", phraseIndex: 9, text: "Midnight threads bind one horizon to the next." },
  { id: "line-10", phraseIndex: 10, text: "Every orbit bends toward a promise left unfinished." },
  { id: "line-11", phraseIndex: 11, text: "Motes of silver gather where choices split." },
  { id: "line-12", phraseIndex: 12, text: "Between the stars, a desk floats and waits." },
  { id: "line-13", phraseIndex: 13, text: "Echoes fold into themselves, then rise again." },
  { id: "line-14", phraseIndex: 14, text: "Routes reopen when memory is brave enough to look." },
  { id: "line-15", phraseIndex: 15, text: "Stillness breaks, and the dark begins to answer." },
]);

const LINE_BY_ID = Object.freeze(Object.fromEntries(LINE_SPECS.map((line) => [line.id, line])));

const POEM_ORDER = Object.freeze([
  "line-6",
  "line-9",
  "line-2",
  "line-4",
  "line-5",
  "line-14",
  "line-3",
  "line-12",
  "line-1",
  "line-8",
  "line-11",
  "line-10",
  "line-13",
  "line-7",
  "line-15",
]);

function seededValue(seed) {
  const value = Math.sin(seed * 97.173 + 29.61) * 43758.5453;
  return value - Math.floor(value);
}

function randomScatter(index) {
  const sideBand = index % 2 === 0;
  const x = sideBand
    ? 2 + seededValue(index + 11) * 14
    : 84 - seededValue(index + 17) * 14;
  const y = 3 + seededValue(index + 31) * (100 - PIECE_HEIGHT - 6);
  const rotations = [0, 90, 180, 270];
  const rotation = rotations[Math.floor(seededValue(index + 59) * rotations.length)] || 0;
  return { x, y, rotation };
}

function buildPieceDefinitions() {
  const definitions = [];
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      const index = row * COLS + col;
      definitions.push({
        id: `tile-${index + 1}`,
        row,
        col,
        targetX: BOARD_ORIGIN_X + col * PIECE_WIDTH,
        targetY: BOARD_ORIGIN_Y + row * PIECE_HEIGHT,
        targetRotation: 0,
        clipPath: FLAT_CLIP_PATH,
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

function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function normalizePhrase(value) {
  return String(value || "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "");
}

function normalizeRotation(value) {
  const numeric = Number(value) || 0;
  return ((numeric % 360) + 360) % 360;
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

  const nearTarget =
    pieceDistance(piece, {
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

function withPoemState(runtime) {
  return {
    ...runtime,
    poemAssembled: validatePieces(runtime.pieces),
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

  return withPoemState({
    pieces,
    selectedPieceId,
    poemAssembled: false,
    solved: Boolean(incoming.solved),
    lastMessage: String(incoming.lastMessage || ""),
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

function actionNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function selectedPieceIdFromRuntime(runtime, eventTarget) {
  const target = eventTarget instanceof Element ? eventTarget.closest("[data-node-piece]") : null;
  const pieceId = target && target.getAttribute("data-piece-id");
  if (pieceId && PIECE_IDS.includes(pieceId)) {
    return pieceId;
  }
  return runtime.selectedPieceId;
}

function poemSurfaceMarkup(showIndices) {
  return `
    <div class="hub07-poem-surface ${showIndices ? "show-indices" : ""}" aria-hidden="true">
      ${POEM_ORDER.map((lineId) => {
        const line = LINE_BY_ID[lineId];
        return `
          <p class="hub07-poem-line">
            <span class="hub07-line-index">${escapeHtml(String(line.phraseIndex))}</span>
            <span class="hub07-line-text">${escapeHtml(line.text)}</span>
          </p>
        `;
      }).join("")}
    </div>
  `;
}

function piecesMarkup(runtime, solved, showIndices) {
  return runtime.pieces
    .map((piece) => {
      const definition = PIECE_DEF_BY_ID[piece.id];
      if (!definition) {
        return "";
      }

      const selected = piece.id === runtime.selectedPieceId;
      const classes = ["hub07-piece"];
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
          style="left:${piece.x}%; top:${piece.y}%; transform: rotate(${piece.rotation}deg); --tile-x:${definition.col}; --tile-y:${definition.row}; --tile-cols:${COLS}; --tile-rows:${ROWS}; --piece-clip:${definition.clipPath};"
          data-node-action="hub07-select-piece"
          data-node-id="${NODE_ID}"
          data-node-piece="true"
          data-piece-id="${piece.id}"
          draggable="${solved ? "false" : "true"}"
          ${solved ? "disabled" : ""}
          aria-label="Poem tile ${escapeHtml(piece.id.toUpperCase())}, rotation ${piece.rotation} degrees"
        >
          <span class="hub07-piece-surface">
            ${poemSurfaceMarkup(showIndices)}
          </span>
        </button>
      `;
    })
    .join("");
}

export function initialHub07Runtime() {
  return {
    pieces: createInitialPieces(),
    selectedPieceId: PIECE_IDS[0],
    poemAssembled: false,
    solved: false,
    lastMessage: "",
  };
}

export function validateHub07Runtime(runtime) {
  return Boolean(normalizeRuntime(runtime).solved);
}

export function reduceHub07Runtime(runtime, action) {
  const current = normalizeRuntime(runtime);
  if (!action || typeof action !== "object") {
    return current;
  }

  if (current.solved) {
    return current;
  }

  if (action.type === "hub07-select-piece") {
    if (!PIECE_IDS.includes(action.pieceId)) {
      return current;
    }
    return {
      ...current,
      selectedPieceId: action.pieceId,
      lastMessage: "",
    };
  }

  if (action.type === "hub07-drop-piece") {
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

    return withPoemState({
      ...dropped,
      lastMessage: "",
    });
  }

  if (action.type === "hub07-rotate-selected") {
    const pieceId = PIECE_IDS.includes(action.pieceId) ? action.pieceId : current.selectedPieceId;
    const step = actionNumber(action.step, ROTATION_STEP);

    const rotated = replacePiece(current, pieceId, (piece) =>
      maybeSnapPiece({
        ...piece,
        rotation: normalizeRotation(piece.rotation + step),
      }),
    );

    return withPoemState({
      ...rotated,
      lastMessage: "",
    });
  }

  if (action.type === "hub07-nudge-selected") {
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

    return withPoemState({
      ...nudged,
      lastMessage: "",
    });
  }

  if (action.type === "hub07-reshuffle") {
    return initialHub07Runtime();
  }

  if (action.type === "hub07-submit-phrase") {
    if (!current.poemAssembled) {
      return {
        ...current,
        lastMessage: "Reassemble the torn poem first.",
      };
    }

    if (normalizePhrase(action.value) !== NORMALIZED_FOG_PHRASE) {
      return {
        ...current,
        lastMessage: "The fog does not answer that phrase.",
      };
    }

    return {
      ...current,
      solved: true,
      lastMessage: "The fog recites your words and parts.",
    };
  }

  return current;
}

export function buildHub07ActionFromElement(element) {
  const actionName = element.getAttribute("data-node-action");
  if (!actionName) {
    return null;
  }

  if (actionName === "hub07-select-piece") {
    return {
      type: "hub07-select-piece",
      pieceId: element.getAttribute("data-piece-id"),
    };
  }

  if (actionName === "hub07-submit-phrase") {
    const surface = element.closest(".hub07-answer");
    const input =
      surface && surface.querySelector
        ? surface.querySelector("[data-hub07-input]")
        : null;

    return {
      type: "hub07-submit-phrase",
      value: input && "value" in input ? input.value : "",
    };
  }

  return null;
}

export function buildHub07DropAction(payload) {
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
    type: "hub07-drop-piece",
    pieceId,
    x: xPercent - PIECE_WIDTH / 2,
    y: yPercent - PIECE_HEIGHT / 2,
  };
}

export function buildHub07KeyAction(event, runtime) {
  if (event.metaKey || event.ctrlKey || event.altKey) {
    return null;
  }

  const target = event.target;
  const isEditableTarget =
    target instanceof Element &&
    (target.matches("input, textarea, select, [contenteditable='true'], [contenteditable='']") ||
      target.closest("[contenteditable='true'], [contenteditable='']"));

  if (event.code === "Enter" || event.key === "Enter") {
    if (target instanceof Element && target.matches("input[data-hub07-input]")) {
      return {
        type: "hub07-submit-phrase",
        value: "value" in target ? target.value : "",
      };
    }
    return null;
  }

  if (isEditableTarget) {
    return null;
  }

  const current = normalizeRuntime(runtime);
  if (current.solved) {
    return null;
  }

  const activePieceId = selectedPieceIdFromRuntime(current, event.target);
  if (!PIECE_IDS.includes(activePieceId)) {
    return null;
  }

  if (event.key === "q" || event.key === "Q" || event.key === "[") {
    return {
      type: "hub07-rotate-selected",
      pieceId: activePieceId,
      step: -ROTATION_STEP,
    };
  }

  if (event.key === "e" || event.key === "E" || event.key === "]") {
    return {
      type: "hub07-rotate-selected",
      pieceId: activePieceId,
      step: ROTATION_STEP,
    };
  }

  if (event.key === "ArrowUp") {
    return {
      type: "hub07-nudge-selected",
      pieceId: activePieceId,
      dx: 0,
      dy: -NUDGE_STEP,
    };
  }

  if (event.key === "ArrowDown") {
    return {
      type: "hub07-nudge-selected",
      pieceId: activePieceId,
      dx: 0,
      dy: NUDGE_STEP,
    };
  }

  if (event.key === "ArrowLeft") {
    return {
      type: "hub07-nudge-selected",
      pieceId: activePieceId,
      dx: -NUDGE_STEP,
      dy: 0,
    };
  }

  if (event.key === "ArrowRight") {
    return {
      type: "hub07-nudge-selected",
      pieceId: activePieceId,
      dx: NUDGE_STEP,
      dy: 0,
    };
  }

  if (event.key === "r" || event.key === "R") {
    return {
      type: "hub07-reshuffle",
    };
  }

  return null;
}

export function renderHub07Experience(context) {
  const runtime = normalizeRuntime(context.runtime);
  const solvedNow = Boolean(context.solved || runtime.solved);
  const selectedArtifact = normalizeText(context.selectedArtifactReward || "");
  const showIndices = runtime.poemAssembled && selectedArtifact === normalizeText(INDEX_ARTIFACT);

  return `
    <article class="hub07-node hub07-immersive" data-node-id="${NODE_ID}">
      <section class="hub07-stage">
        <div class="hub07-workspace" data-node-dropzone="hub07" data-node-id="${NODE_ID}" aria-label="Torn poem jigsaw workspace">
          <div class="hub07-target-board" aria-hidden="true"></div>
          ${piecesMarkup(runtime, solvedNow, showIndices)}
        </div>
      </section>

      <section class="hub07-answer">
        <label for="hub07-answer-input"><strong>What is the Fog Phrase?</strong></label>
        <div class="hub07-answer-row">
          <input id="hub07-answer-input" type="text" data-hub07-input autocomplete="off" spellcheck="false" />
          <button type="button" data-node-id="${NODE_ID}" data-node-action="hub07-submit-phrase">Submit</button>
        </div>
      </section>

      <p class="sr-only" role="status" aria-live="polite">
        ${escapeHtml(
          solvedNow
            ? "Fog phrase recovered."
            : runtime.poemAssembled
              ? "Poem reconstructed."
              : "Poem still fragmented.",
        )}
      </p>

      ${
        solvedNow
          ? `
            <section class="completion-banner" aria-live="polite">
              <p><strong>FOG PHRASE Recovered: The Fog Remembers</strong></p>
            </section>
          `
          : ""
      }
    </article>
  `;
}

export const HUB07_NODE_EXPERIENCE = {
  nodeId: NODE_ID,
  initialState: initialHub07Runtime,
  render: renderHub07Experience,
  reduceRuntime: reduceHub07Runtime,
  validateRuntime: validateHub07Runtime,
  buildActionFromElement: buildHub07ActionFromElement,
  buildDropAction: buildHub07DropAction,
  buildKeyAction: buildHub07KeyAction,
};
