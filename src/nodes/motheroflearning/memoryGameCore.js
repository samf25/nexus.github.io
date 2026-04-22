import { escapeHtml } from "../../templates/shared.js";
import { renderArtifactSymbol } from "../../core/artifacts.js";
import { renderRegionSymbol } from "../../core/symbology.js";

export const MEMORY_SYMBOL_KEYS = Object.freeze([
  "nexus",
  "cradle",
  "wandering-inn",
  "worm",
  "mother-of-learning",
  "hall-of-proofs",
  "prime-vault",
  "arcane-ascension",
  "symmetry-forge",
  "cosmere",
  "dungeon-crawler-carl",
  "curved-atlas",
  "practical-guide",
]);

const FIELD_COLUMNS = 16;
const FIELD_ROWS = 12;
const FIELD_SIZE = FIELD_COLUMNS * FIELD_ROWS;
const SHOW_MS = 750;
const PAUSE_MS = 300;
const CHAFF_SYMBOL_COUNT = 96;
const CHAFF_SYMBOL_NAMES = Object.freeze(
  Array.from({ length: CHAFF_SYMBOL_COUNT }, (_, index) => `Field Sigil ${index + 1}`),
);

function seededValue(seed) {
  const value = Math.sin(seed * 91.417 + 17.23) * 43758.5453;
  return value - Math.floor(value);
}

function normalizedRoll(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return Math.random();
  }
  return Math.max(0, Math.min(0.999999, numeric));
}

const PATTERN_ARTIFACT_COUNT = 24;
const PATTERN_TOKEN_SPECS = Object.freeze([
  ...MEMORY_SYMBOL_KEYS.map((symbolKey) => ({
    tokenId: `region:${symbolKey}`,
    kind: "region",
    symbolKey,
  })),
  ...Array.from({ length: PATTERN_ARTIFACT_COUNT }, (_, index) => ({
    tokenId: `artifact:${index + 1}`,
    kind: "artifact",
    artifactName: `Archive Relic ${index + 1}`,
  })),
]);
const PATTERN_TOKEN_IDS = Object.freeze(PATTERN_TOKEN_SPECS.map((spec) => spec.tokenId));
const PATTERN_TOKEN_BY_ID = Object.freeze(
  Object.fromEntries(PATTERN_TOKEN_SPECS.map((spec) => [spec.tokenId, spec])),
);
const REGION_TOKEN_IDS = Object.freeze(
  PATTERN_TOKEN_SPECS.filter((spec) => spec.kind === "region").map((spec) => spec.tokenId),
);
const NON_REGION_TOKEN_IDS = Object.freeze(
  PATTERN_TOKEN_SPECS.filter((spec) => spec.kind !== "region").map((spec) => spec.tokenId),
);

function pickFromTokenSet(tokenIds, roll) {
  if (!Array.isArray(tokenIds) || tokenIds.length === 0) {
    return PATTERN_TOKEN_IDS[0];
  }
  const index = Math.floor(normalizedRoll(roll) * tokenIds.length);
  return tokenIds[index] || tokenIds[0];
}

function pickSymbolByRoll(roll) {
  const normalized = normalizedRoll(roll);
  const chooseRegion = normalized < 0.5;
  const localRoll = chooseRegion ? normalized * 2 : (normalized - 0.5) * 2;
  const tokenIds = chooseRegion ? REGION_TOKEN_IDS : NON_REGION_TOKEN_IDS;
  return pickFromTokenSet(tokenIds, localRoll);
}

function buildBoardTokenMap() {
  const shuffled = Array.from({ length: FIELD_SIZE }, (_, index) => index).sort(
    (left, right) => seededValue(left + 1) - seededValue(right + 1),
  );
  const slots = shuffled.slice(0, PATTERN_TOKEN_IDS.length);
  return Object.freeze(
    Object.fromEntries(
      slots.map((slotIndex, keyIndex) => [slotIndex, PATTERN_TOKEN_IDS[keyIndex]]),
    ),
  );
}

const BOARD_TOKEN_MAP = buildBoardTokenMap();

function chaffSymbolName(index) {
  return CHAFF_SYMBOL_NAMES[(index * 7 + 3) % CHAFF_SYMBOL_NAMES.length];
}

function safePhase(value) {
  return value === "idle" || value === "show" || value === "input" ? value : "idle";
}

export function memoryRevealDurationMs(sequenceLength) {
  return Math.max(1, Math.floor(Number(sequenceLength) || 1)) * (SHOW_MS + PAUSE_MS);
}

export function normalizeMemoryGameRuntime(candidate, targetSuccesses) {
  const source = candidate && typeof candidate === "object" ? candidate : {};
  const validTarget = Math.max(1, Math.floor(Number(targetSuccesses) || 1));

  const sequence = Array.isArray(source.sequence)
    ? source.sequence.filter((tokenId) => PATTERN_TOKEN_IDS.includes(String(tokenId))).slice(0, validTarget)
    : [];
  const fallbackSequence = sequence.length ? sequence : [pickSymbolByRoll(0.5)];

  return {
    targetSuccesses: validTarget,
    sequence: fallbackSequence,
    successCount: Math.max(0, Math.min(validTarget, Math.floor(Number(source.successCount) || 0))),
    phase: safePhase(source.phase),
    revealStartedAt: Number.isFinite(source.revealStartedAt) ? Number(source.revealStartedAt) : 0,
    inputIndex: Math.max(0, Math.floor(Number(source.inputIndex) || 0)),
    feedbackSymbol: String(source.feedbackSymbol || ""),
    feedbackPositive: Boolean(source.feedbackPositive),
    solved: Boolean(source.solved),
  };
}

export function createMemoryGameRuntime({ targetSuccesses, roll = Math.random() } = {}) {
  return normalizeMemoryGameRuntime({
    targetSuccesses,
    sequence: [pickSymbolByRoll(roll)],
    successCount: 0,
    phase: "idle",
    revealStartedAt: 0,
    inputIndex: 0,
    feedbackSymbol: "",
    feedbackPositive: false,
    solved: false,
  }, targetSuccesses);
}

export function synchronizeMemoryGameRuntime(candidate) {
  return normalizeMemoryGameRuntime(candidate, candidate && candidate.targetSuccesses);
}

export function reduceMemoryGameBegin(candidate, action = {}) {
  const at = Number(action.at) || Date.now();
  const game = synchronizeMemoryGameRuntime(candidate);
  if (game.solved || game.phase === "show") {
    return game;
  }

  return {
    ...game,
    phase: "show",
    revealStartedAt: at,
    inputIndex: 0,
    feedbackSymbol: "",
    feedbackPositive: false,
  };
}

export function reduceMemoryGameEnterInput(candidate, action = {}) {
  const at = Number(action.at) || Date.now();
  const game = synchronizeMemoryGameRuntime(candidate);
  if (game.solved || game.phase !== "show") {
    return game;
  }

  const revealReadyAt = Number(game.revealStartedAt || 0) + memoryRevealDurationMs(game.sequence.length);
  if (at < revealReadyAt) {
    return game;
  }

  return {
    ...game,
    phase: "input",
    inputIndex: 0,
    feedbackSymbol: "",
    feedbackPositive: false,
  };
}

export function reduceMemoryGamePick(candidate, action) {
  const symbolToken = String(action && action.symbolToken ? action.symbolToken : "");
  const roll = normalizedRoll(action && action.roll);
  const game = synchronizeMemoryGameRuntime(candidate);

  if (game.solved || game.phase !== "input") {
    return game;
  }

  const expected = game.sequence[game.inputIndex];
  const isCorrectPick = PATTERN_TOKEN_IDS.includes(symbolToken) && symbolToken === expected;

  if (!isCorrectPick) {
    const nextFirst = pickSymbolByRoll(roll);
    return {
      ...game,
      sequence: [nextFirst],
      successCount: 0,
      phase: "idle",
      revealStartedAt: 0,
      inputIndex: 0,
      feedbackSymbol: symbolToken || "chaff:miss",
      feedbackPositive: false,
    };
  }

  if (game.inputIndex < game.sequence.length - 1) {
    return {
      ...game,
      inputIndex: game.inputIndex + 1,
      feedbackSymbol: symbolToken,
      feedbackPositive: true,
    };
  }

  const nextSuccessCount = game.successCount + 1;
  if (nextSuccessCount >= game.targetSuccesses) {
    return {
      ...game,
      successCount: nextSuccessCount,
      solved: true,
      phase: "input",
      inputIndex: game.sequence.length,
      feedbackSymbol: symbolToken,
      feedbackPositive: true,
    };
  }

  return {
    ...game,
    sequence: [...game.sequence, pickSymbolByRoll(roll)],
    successCount: nextSuccessCount,
    phase: "idle",
    revealStartedAt: 0,
    inputIndex: 0,
    feedbackSymbol: symbolToken,
    feedbackPositive: true,
  };
}

function renderTokenSymbol(spec, className) {
  if (!spec) {
    return "";
  }
  if (spec.kind === "region") {
    return renderRegionSymbol({
      symbolKey: spec.symbolKey,
      className,
    });
  }

  return renderArtifactSymbol({
    artifactName: spec.artifactName,
    className: `${className} artifact-symbol`,
  });
}

function renderShowSequence(game) {
  const cycleMs = SHOW_MS + PAUSE_MS;
  return `
    <div class="mol-memory-sequence">
      ${game.sequence.map((tokenId, index) => {
        const tokenSpec = PATTERN_TOKEN_BY_ID[tokenId];
        if (!tokenSpec) {
          return "";
        }
        const delaySeconds = ((index * cycleMs) / 1000).toFixed(2);
        return `
          <span class="mol-memory-sequence-frame" style="animation-delay:${delaySeconds}s;">
            ${renderTokenSymbol(tokenSpec, "mol-memory-display-symbol")}
          </span>
        `;
      }).join("")}
    </div>
  `;
}

export function renderMemoryDisplay(game) {
  const feedbackClass = game.feedbackSymbol
    ? game.feedbackPositive
      ? "is-good"
      : "is-bad"
    : "";

  const phaseText = game.phase === "show"
    ? "Observe"
    : game.phase === "input"
      ? "Repeat"
      : "Press Begin";

  return `
    <section class="mol-memory-display ${escapeHtml(feedbackClass)}">
      <div class="mol-memory-display-inner">
        ${
          game.phase === "show"
            ? renderShowSequence(game)
            : `<span class="mol-memory-display-placeholder">${escapeHtml(phaseText)}</span>`
        }
      </div>
    </section>
  `;
}

export function renderMemoryField({ nodeId, actionName, game }) {
  const feedbackToken = String(game.feedbackSymbol || "");
  const interactive = Boolean(actionName);
  const nodeActionAttr = interactive
    ? `data-node-action="${escapeHtml(actionName)}"`
    : "";

  return `
    <section class="mol-memory-field" aria-label="Memory rune field">
      ${Array.from({ length: FIELD_SIZE }, (_, cellIndex) => {
        const targetTokenId = BOARD_TOKEN_MAP[cellIndex];
        const tokenId = targetTokenId || `chaff:${cellIndex}`;
        const tokenSpec = targetTokenId
          ? PATTERN_TOKEN_BY_ID[targetTokenId]
          : {
            kind: "artifact",
            artifactName: chaffSymbolName(cellIndex),
          };
        const hasFeedback = feedbackToken === tokenId;
        const feedbackClass = hasFeedback
          ? game.feedbackPositive
            ? "is-feedback-good"
            : "is-feedback-bad"
          : "";

        return `
          <button
            type="button"
            class="mol-memory-rune mol-memory-rune-target ${feedbackClass} ${targetTokenId ? "" : "is-secondary"} ${interactive ? "" : "is-inactive"}"
            data-node-id="${escapeHtml(nodeId)}"
            ${nodeActionAttr}
            data-symbol-token="${escapeHtml(tokenId)}"
            aria-label="Memory rune"
          >
            ${renderTokenSymbol(tokenSpec, "mol-memory-rune-symbol")}
          </button>
        `;
      }).join("")}
    </section>
  `;
}
