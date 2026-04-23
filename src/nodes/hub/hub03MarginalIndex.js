import { escapeHtml } from "../../templates/shared.js";
import { renderRegionSymbol } from "../../core/symbology.js";
import { renderArtifactSymbol } from "../../core/artifacts.js";

const NODE_ID = "HUB03";
const FIELD_COLUMNS = 16;
const FIELD_ROWS = 12;
const FIELD_SIZE = FIELD_COLUMNS * FIELD_ROWS;

const TARGET_SYMBOL_KEYS = Object.freeze([
  "nexus",
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

const CHAFF_SYMBOL_COUNT = 72;

const CHAFF_SYMBOL_NAMES = Object.freeze(
  Array.from({ length: CHAFF_SYMBOL_COUNT }, (_, index) => `Archive Relic ${index + 1}`),
);

function seededValue(seed) {
  const value = Math.sin(seed * 91.417 + 17.23) * 43758.5453;
  return value - Math.floor(value);
}

function buildTargetSlotMap() {
  const shuffled = Array.from({ length: FIELD_SIZE }, (_, index) => index).sort(
    (left, right) => seededValue(left + 1) - seededValue(right + 1),
  );

  const slots = shuffled.slice(0, TARGET_SYMBOL_KEYS.length);
  return Object.fromEntries(
    slots.map((slotIndex, keyIndex) => [slotIndex, TARGET_SYMBOL_KEYS[keyIndex]]),
  );
}

const TARGET_SLOT_MAP = Object.freeze(buildTargetSlotMap());

function normalizeRuntime(runtime) {
  const source = runtime && typeof runtime === "object" ? runtime : {};
  const discovered = Array.isArray(source.discovered)
    ? source.discovered.filter((key) => TARGET_SYMBOL_KEYS.includes(key))
    : [];
  const unique = [...new Set(discovered)];
  const activeFlashKey = TARGET_SYMBOL_KEYS.includes(source.activeFlashKey)
    ? source.activeFlashKey
    : "";
  const solved = unique.length === TARGET_SYMBOL_KEYS.length;

  return {
    discovered: unique,
    activeFlashKey,
    solved,
  };
}

function withSolvedState(runtime) {
  return {
    ...runtime,
    solved: runtime.discovered.length === TARGET_SYMBOL_KEYS.length,
  };
}

function chaffSymbolName(index) {
  return CHAFF_SYMBOL_NAMES[(index * 7 + 3) % CHAFF_SYMBOL_NAMES.length];
}

function runeGridMarkup(runtime, solvedNow) {
  const discoveredSet = new Set(runtime.discovered);

  return Array.from({ length: FIELD_SIZE }, (_, cellIndex) => {
    const targetKey = TARGET_SLOT_MAP[cellIndex];
    const jitterX = Math.round((seededValue(cellIndex + 11) - 0.5) * 8);
    const jitterY = Math.round((seededValue(cellIndex + 31) - 0.5) * 8);
    const twist = Math.round((seededValue(cellIndex + 47) - 0.5) * 18);

    if (targetKey) {
      const found = discoveredSet.has(targetKey);
      const flashing = runtime.activeFlashKey === targetKey;
      return `
        <button
          type="button"
          class="hub03-rune hub03-rune-target ${found ? "is-found" : ""} ${flashing ? "is-flash" : ""}"
          data-node-id="${NODE_ID}"
          data-node-action="tap-rune"
          data-symbol-key="${escapeHtml(targetKey)}"
          style="--jx:${jitterX}px; --jy:${jitterY}px; --twist:${twist}deg;"
          ${solvedNow ? "disabled" : ""}
          aria-label="Rune"
        >
          ${renderRegionSymbol({
            symbolKey: targetKey,
            className: "hub03-rune-symbol",
          })}
        </button>
      `;
    }

    return `
      <button
        type="button"
        class="hub03-rune hub03-rune-chaff"
        style="--jx:${jitterX}px; --jy:${jitterY}px; --twist:${twist}deg;"
        tabindex="-1"
        aria-hidden="true"
      >
        ${renderArtifactSymbol({
          artifactName: chaffSymbolName(cellIndex),
          className: "hub03-rune-symbol artifact-symbol",
        })}
      </button>
    `;
  }).join("");
}

export function initialHub03Runtime() {
  return {
    discovered: [],
    activeFlashKey: "",
    solved: false,
  };
}

export function validateHub03Runtime(runtime) {
  return normalizeRuntime(runtime).solved;
}

export function reduceHub03Runtime(runtime, action) {
  const current = normalizeRuntime(runtime);
  if (!action || typeof action !== "object") {
    return current;
  }

  if (current.solved) {
    return current;
  }

  if (action.type === "tap-rune") {
    const symbolKey = action.symbolKey;
    if (!TARGET_SYMBOL_KEYS.includes(symbolKey)) {
      return current;
    }

    const discovered = current.discovered.includes(symbolKey)
      ? current.discovered
      : [...current.discovered, symbolKey];

    return withSolvedState({
      ...current,
      discovered,
      activeFlashKey: symbolKey,
    });
  }

  return current;
}

export function buildHub03ActionFromElement(element) {
  const actionName = element.getAttribute("data-node-action");
  if (actionName !== "tap-rune") {
    return null;
  }

  return {
    type: "tap-rune",
    symbolKey: element.getAttribute("data-symbol-key"),
  };
}

export function renderHub03Experience(context) {
  const normalized = normalizeRuntime(context.runtime);
  const solvedNow = Boolean(context.solved || normalized.solved);

  return `
    <article class="hub03-node" data-node-id="${NODE_ID}">
      <section class="hub03-field" aria-label="Rune field">
        ${runeGridMarkup(normalized, solvedNow)}
      </section>

      <p class="sr-only" role="status" aria-live="polite">
        ${escapeHtml(
          solvedNow
            ? "All runes found."
            : `${normalized.discovered.length} of ${TARGET_SYMBOL_KEYS.length} key runes found.`,
        )}
      </p>

      ${
        solvedNow
          ? `
            <section class="hub03-status" aria-live="polite">
              <p><strong>Index String recovered.</strong></p>
            </section>
          `
          : ""
      }
    </article>
  `;
}

export const HUB03_NODE_EXPERIENCE = {
  nodeId: NODE_ID,
  initialState: initialHub03Runtime,
  render: renderHub03Experience,
  reduceRuntime: reduceHub03Runtime,
  validateRuntime: validateHub03Runtime,
  buildActionFromElement: buildHub03ActionFromElement,
};
