import { escapeHtml } from "../../templates/shared.js";
import {
  createMemoryGameRuntime,
  reduceMemoryGameBegin,
  reduceMemoryGameEnterInput,
  reduceMemoryGamePick,
  renderMemoryDisplay,
  renderMemoryField,
  synchronizeMemoryGameRuntime,
} from "./memoryGameCore.js";

const NODE_ID = "MOL01";
const TARGET_SUCCESSES = 7;

function normalizeRuntime(candidate) {
  const source = candidate && typeof candidate === "object" ? candidate : {};
  return {
    game: source.game && typeof source.game === "object"
      ? source.game
      : createMemoryGameRuntime({ targetSuccesses: TARGET_SUCCESSES, roll: Math.random() }),
    visitNonce: Number.isFinite(source.visitNonce) ? Number(source.visitNonce) : -1,
    lastMessage: String(source.lastMessage || ""),
    solved: Boolean(source.solved),
  };
}

export function initialMol01Runtime() {
  return normalizeRuntime({});
}

export function synchronizeMol01Runtime(runtime, { now = Date.now(), routeVisitNonce = undefined } = {}) {
  const current = normalizeRuntime(runtime);
  const normalizedVisitNonce = Number(routeVisitNonce);
  const hasVisitNonce =
    routeVisitNonce !== null &&
    routeVisitNonce !== undefined &&
    Number.isFinite(normalizedVisitNonce) &&
    normalizedVisitNonce >= 0;
  if (hasVisitNonce && normalizedVisitNonce !== Number(current.visitNonce)) {
    return {
      ...current,
      visitNonce: normalizedVisitNonce,
      game: createMemoryGameRuntime({
        targetSuccesses: TARGET_SUCCESSES,
        roll: Math.random(),
      }),
      lastMessage: "",
    };
  }

  const game = synchronizeMemoryGameRuntime(current.game);
  const solved = Boolean(game.solved);

  return {
    ...current,
    game,
    solved,
  };
}

export function validateMol01Runtime(runtime) {
  return Boolean(runtime && runtime.solved);
}

export function reduceMol01Runtime(runtime, action) {
  const at = Number(action && action.at) || Date.now();
  const current = synchronizeMol01Runtime(runtime, { now: at });
  if (!action || typeof action !== "object") {
    return current;
  }

  if (action.type === "mol01-begin-sequence") {
    return {
      ...current,
      game: reduceMemoryGameBegin(current.game, { at }),
      lastMessage: "Sequence active. Observe, then repeat it.",
    };
  }

  if (action.type === "mol01-enter-input") {
    const nextGame = reduceMemoryGameEnterInput(current.game, { at });
    const unchanged = nextGame === current.game;
    return {
      ...current,
      game: nextGame,
      lastMessage: unchanged ? "Observe the full sequence before repeating it." : "",
    };
  }

  if (action.type !== "mol01-pick-symbol") {
    return current;
  }

  const nextGame = reduceMemoryGamePick(current.game, action);
  let lastMessage = "";
  if (nextGame.solved) {
    lastMessage = "Sequence locked. Restart Token recovered.";
  } else if (current.game.phase === "input" && nextGame.phase === "idle" && nextGame.successCount === 0) {
    lastMessage = "Pattern broken. Press Begin to restart from zero.";
  } else if (current.game.phase === "input" && nextGame.phase === "idle") {
    lastMessage = "Round complete. Press Begin for the next sequence.";
  }

  return {
    ...current,
    game: nextGame,
    solved: Boolean(nextGame.solved),
    lastMessage,
  };
}

export function buildMol01ActionFromElement(element) {
  const actionName = element.getAttribute("data-node-action");
  if (actionName === "mol01-begin-sequence") {
    return {
      type: "mol01-begin-sequence",
      at: Date.now(),
    };
  }

  if (actionName === "mol01-enter-input") {
    return {
      type: "mol01-enter-input",
      at: Date.now(),
    };
  }

  if (actionName === "mol01-pick-symbol") {
    return {
      type: "mol01-pick-symbol",
      symbolToken: element.getAttribute("data-symbol-token") || "",
      roll: Math.random(),
      at: Date.now(),
    };
  }

  return null;
}

export function renderMol01Experience(context) {
  const now = Date.now();
  const runtime = synchronizeMol01Runtime(context.runtime, { now });
  const game = runtime.game;

  return `
    <article class="mol01-node" data-node-id="${NODE_ID}">
      <section class="card mol-memory-head">
        <h3>Memory Spiral</h3>
        <p><strong>Rounds Cleared:</strong> ${game.successCount}/${game.targetSuccesses}</p>
      </section>
      ${renderMemoryDisplay(game)}
      ${
        !runtime.solved
          ? `
            <section class="toolbar">
              ${
                game.phase === "idle"
                  ? `
                    <button type="button" data-node-id="${NODE_ID}" data-node-action="mol01-begin-sequence">
                      Begin Sequence
                    </button>
                  `
                  : ""
              }
            </section>
          `
          : ""
      }
      ${
        !runtime.solved
          ? renderMemoryField({
            nodeId: NODE_ID,
            actionName: game.phase === "input" ? "mol01-pick-symbol" : "",
            game,
          })
          : ""
      }
      ${
        runtime.solved
          ? `
            <section class="completion-banner" aria-live="polite">
              <p><strong>RESTART TOKEN Recovered</strong></p>
            </section>
          `
          : ""
      }
    </article>
  `;
}

export const MOL01_NODE_EXPERIENCE = {
  nodeId: NODE_ID,
  initialState: initialMol01Runtime,
  synchronizeRuntime: synchronizeMol01Runtime,
  render: renderMol01Experience,
  reduceRuntime: reduceMol01Runtime,
  validateRuntime: validateMol01Runtime,
  buildActionFromElement: buildMol01ActionFromElement,
};
