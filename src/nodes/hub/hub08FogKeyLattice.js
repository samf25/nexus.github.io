import { escapeHtml } from "../../templates/shared.js";
import { renderArtifactSymbol } from "../../core/artifacts.js";
import { normalizeWormSystemState, wormOwnedCards } from "../../systems/wormDeck.js";

const NODE_ID = "HUB08";
const NORMALIZED_FOG_PHRASE = "THEFOGREMEMBERS";
const MADRA_SINK_COST = 3;

const REQUIRED_SOCKETS = Object.freeze([
  { slotId: "mol01", label: "MOL01", reward: "Restart Token", x: 50, y: 16 },
  { slotId: "twi01", label: "TWI01", reward: "Ledger Key", x: 84, y: 50 },
  { slotId: "log01", label: "LOG01", reward: "Lemma of implication", x: 50, y: 84 },
  { slotId: "num01", label: "NUM01", reward: "Mod Wheel", x: 16, y: 50 },
]);

const SOCKET_BY_ID = Object.freeze(
  Object.fromEntries(REQUIRED_SOCKETS.map((socket) => [socket.slotId, socket])),
);

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

function rewardMatches(left, right) {
  return normalizeText(left) === normalizeText(right);
}

function normalizedSockets(candidate) {
  const source = candidate && typeof candidate === "object" ? candidate : {};
  const sockets = {};
  for (const spec of REQUIRED_SOCKETS) {
    const stored = String(source[spec.slotId] || "");
    sockets[spec.slotId] = rewardMatches(stored, spec.reward) ? spec.reward : "";
  }
  return sockets;
}

function allSocketsFilled(sockets) {
  return REQUIRED_SOCKETS.every((socket) => Boolean(sockets[socket.slotId]));
}

function solvedState(runtime) {
  return Boolean(
    allSocketsFilled(runtime.sockets) &&
    runtime.madraInfused &&
    runtime.capeSacrificed &&
    runtime.phraseConfirmed,
  );
}

function normalizeRuntime(candidate) {
  const source = candidate && typeof candidate === "object" ? candidate : {};
  const sockets = normalizedSockets(source.sockets);
  const roomOpen = allSocketsFilled(sockets);

  const normalized = {
    sockets,
    roomOpen,
    madraInfused: Boolean(source.madraInfused),
    capeSacrificed: Boolean(source.capeSacrificed),
    sacrificedCapeId: String(source.sacrificedCapeId || ""),
    selectedCapeId: String(source.selectedCapeId || ""),
    phraseConfirmed: Boolean(source.phraseConfirmed),
    phraseInput: String(source.phraseInput || ""),
    solved: Boolean(source.solved),
    lastMessage: String(source.lastMessage || ""),
  };

  return {
    ...normalized,
    solved: normalized.solved || solvedState(normalized),
  };
}

export function initialHub08Runtime() {
  return {
    sockets: {},
    roomOpen: false,
    madraInfused: false,
    capeSacrificed: false,
    sacrificedCapeId: "",
    selectedCapeId: "",
    phraseConfirmed: false,
    phraseInput: "",
    solved: false,
    lastMessage: "",
  };
}

export function validateHub08Runtime(runtime) {
  return Boolean(normalizeRuntime(runtime).solved);
}

export function reduceHub08Runtime(runtime, action) {
  const current = normalizeRuntime(runtime);
  if (!action || typeof action !== "object") {
    return current;
  }

  if (current.solved) {
    return current;
  }

  if (action.type === "hub08-socket-artifact") {
    const slotId = String(action.slotId || "");
    const socket = SOCKET_BY_ID[slotId];
    if (!socket) {
      return current;
    }
    if (current.sockets[slotId]) {
      return current;
    }
    if (!rewardMatches(action.artifact, socket.reward)) {
      return {
        ...current,
        lastMessage: "That artifact does not resonate with this socket.",
      };
    }

    const nextSockets = {
      ...current.sockets,
      [slotId]: socket.reward,
    };
    const roomOpen = allSocketsFilled(nextSockets);
    const next = {
      ...current,
      sockets: nextSockets,
      roomOpen,
      lastMessage: roomOpen ? "The seal lifts. The chamber awakens." : "",
    };
    return {
      ...next,
      solved: solvedState(next),
    };
  }

  if (action.type === "hub08-infuse-madra") {
    if (!current.roomOpen) {
      return current;
    }
    if (!action.applied) {
      return {
        ...current,
        lastMessage: String(action.message || `Need ${MADRA_SINK_COST} Madra.`),
      };
    }
    const next = {
      ...current,
      madraInfused: true,
      lastMessage: "The orb drinks Madra and begins to glow.",
    };
    return {
      ...next,
      solved: solvedState(next),
    };
  }

  if (action.type === "hub08-sacrifice-cape") {
    if (!current.roomOpen) {
      return current;
    }
    if (!action.applied) {
      return {
        ...current,
        lastMessage: String(action.message || "The altar rejects the offering."),
      };
    }
    const next = {
      ...current,
      capeSacrificed: true,
      sacrificedCapeId: String(action.cardId || ""),
      selectedCapeId: String(action.cardId || ""),
      lastMessage: String(action.message || "The altar accepts the sacrifice."),
    };
    return {
      ...next,
      solved: solvedState(next),
    };
  }

  if (action.type === "hub08-set-phrase") {
    return {
      ...current,
      phraseInput: String(action.value || ""),
    };
  }

  if (action.type === "hub08-select-cape") {
    if (current.capeSacrificed) {
      return current;
    }
    return {
      ...current,
      selectedCapeId: String(action.cardId || ""),
      lastMessage: "",
    };
  }

  if (action.type === "hub08-submit-phrase") {
    const phrase = String(action.value || "");
    if (normalizePhrase(phrase) !== NORMALIZED_FOG_PHRASE) {
      return {
        ...current,
        phraseInput: phrase,
        lastMessage: "The inscription remains cold.",
      };
    }
    const next = {
      ...current,
      phraseInput: phrase,
      phraseConfirmed: true,
      lastMessage: "The inscription ignites with silver fire.",
    };
    return {
      ...next,
      solved: solvedState(next),
    };
  }

  return current;
}

export function buildHub08ActionFromElement(element) {
  const actionName = element.getAttribute("data-node-action");
  if (!actionName) {
    return null;
  }

  if (actionName === "hub08-socket-artifact") {
    return {
      type: "hub08-socket-artifact",
      slotId: element.getAttribute("data-slot-id") || "",
      artifact: element.getAttribute("data-selected-artifact") || "",
      ready: element.getAttribute("data-ready") === "true",
      at: Date.now(),
    };
  }

  if (actionName === "hub08-infuse-madra") {
    return {
      type: "hub08-infuse-madra",
      ready: element.getAttribute("data-ready") === "true",
      at: Date.now(),
    };
  }

  if (actionName === "hub08-sacrifice-cape") {
    return {
      type: "hub08-sacrifice-cape",
      cardId: element.getAttribute("data-selected-cape") || "",
      ready: element.getAttribute("data-ready") === "true",
      at: Date.now(),
    };
  }

  if (actionName === "hub08-select-cape") {
    return {
      type: "hub08-select-cape",
      cardId: element.getAttribute("data-card-id") || "",
      at: Date.now(),
    };
  }

  if (actionName === "hub08-submit-phrase") {
    const node = element.closest(`.hub08-node[data-node-id="${NODE_ID}"]`);
    const input = node ? node.querySelector("[data-hub08-phrase]") : null;
    const value = input && "value" in input ? String(input.value || "") : "";
    return {
      type: "hub08-submit-phrase",
      value,
      at: Date.now(),
    };
  }

  return null;
}

export function buildHub08KeyAction(event) {
  if (event.key !== "Enter") {
    return null;
  }

  const target = event.target;
  if (!(target instanceof Element) || !target.matches("input[data-hub08-phrase]")) {
    return null;
  }

  return {
    type: "hub08-submit-phrase",
    value: "value" in target ? String(target.value || "") : "",
    at: Date.now(),
  };
}

function readCurrentMadra(state) {
  const runtime =
    state && state.nodeRuntime && typeof state.nodeRuntime === "object"
      ? state.nodeRuntime.CRD02
      : null;
  return Math.max(0, Number(runtime && runtime.madra ? runtime.madra : 0));
}

export function renderHub08Experience(context) {
  const runtime = normalizeRuntime(context.runtime);
  const selectedArtifact = String(context.selectedArtifactReward || "");
  const wormState = normalizeWormSystemState(context.state.systems.worm, Date.now());
  const ownedCapes = wormOwnedCards(wormState, Date.now());
  const totalCapeCopies = ownedCapes.reduce(
    (sum, entry) => sum + Math.max(1, Math.floor(Number(entry && entry.copies ? entry.copies : 1))),
    0,
  );
  const canSacrifice = totalCapeCopies >= 3 && !runtime.capeSacrificed;
  const canInfuse = readCurrentMadra(context.state) >= MADRA_SINK_COST && !runtime.madraInfused;
  const solvedNow = Boolean(context.solved || runtime.solved);
  const selectedCapeId = runtime.selectedCapeId && ownedCapes.some((entry) => entry.cardId === runtime.selectedCapeId)
    ? runtime.selectedCapeId
    : (ownedCapes[0] ? ownedCapes[0].cardId : "");

  return `
    <article class="hub08-node" data-node-id="${NODE_ID}">
      ${
        !runtime.roomOpen
          ? `
            <section class="hub08-seal-stage">
              <div class="hub08-seal-core">
                <span class="hub08-seal-pulse" aria-hidden="true"></span>
              </div>
              ${REQUIRED_SOCKETS.map((socket) => {
                const filled = Boolean(runtime.sockets[socket.slotId]);
                const ready = !filled && rewardMatches(selectedArtifact, socket.reward);
                return `
                  <button
                    type="button"
                    class="hub08-socket ${filled ? "is-filled" : ""} ${ready ? "is-ready" : ""}"
                    style="left:${socket.x}%; top:${socket.y}%;"
                    data-node-id="${NODE_ID}"
                    data-node-action="hub08-socket-artifact"
                    data-slot-id="${escapeHtml(socket.slotId)}"
                    data-selected-artifact="${escapeHtml(selectedArtifact)}"
                    data-ready="${ready ? "true" : "false"}"
                    aria-disabled="${filled ? "true" : "false"}"
                    aria-label="${escapeHtml(`${socket.label} socket`)}"
                  >
                    ${
                      filled
                        ? renderArtifactSymbol({
                            artifactName: socket.reward,
                            className: "hub08-socket-symbol artifact-symbol",
                          })
                        : renderArtifactSymbol({
                            artifactName: socket.reward,
                            className: "hub08-socket-symbol artifact-symbol is-ghost",
                          })
                    }
                  </button>
                `;
              }).join("")}
            </section>
          `
          : ""
      }

      ${
        runtime.roomOpen
          ? `
            <section class="hub08-ritual-stage">
              <section class="hub08-ritual-node hub08-ritual-orb">
                <h4>Dull Glass Orb</h4>
                <button
                  type="button"
                  class="hub08-orb-button ${runtime.madraInfused ? "is-lit" : ""}"
                  data-node-id="${NODE_ID}"
                  data-hub08-orb="true"
                  data-ready="${canInfuse ? "true" : "false"}"
                  ${runtime.madraInfused ? "disabled" : ""}
                  aria-label="${runtime.madraInfused ? "Orb charged" : `Infuse ${MADRA_SINK_COST} Madra`}"
                ></button>
                <p class="muted">${runtime.madraInfused ? "Charged" : `${MADRA_SINK_COST} Madra required`}</p>
              </section>

              <section class="hub08-ritual-node hub08-ritual-inscription">
                <h4>Inscription</h4>
                <div class="hub08-phrase-wrap">
                  <input
                    type="text"
                    class="hub08-phrase-input"
                    data-hub08-phrase
                    value="${escapeHtml(runtime.phraseInput)}"
                    placeholder="Speak into the fog..."
                    ${runtime.phraseConfirmed ? "disabled" : ""}
                    autocomplete="off"
                    spellcheck="false"
                  />
                  <button
                    type="button"
                    class="hub08-phrase-button"
                    data-node-id="${NODE_ID}"
                    data-node-action="hub08-submit-phrase"
                    ${runtime.phraseConfirmed ? "disabled" : ""}
                  >
                    ${runtime.phraseConfirmed ? "Resonant" : "Intone"}
                  </button>
                </div>
              </section>

              <section class="hub08-ritual-node hub08-ritual-altar">
                <h4>Sacrificial Altar</h4>
                <div class="hub08-cape-grid">
                  ${
                    ownedCapes.map((entry) => `
                      <button
                        type="button"
                        class="hub08-cape-chip ${selectedCapeId === entry.cardId ? "is-selected" : ""}"
                        data-node-id="${NODE_ID}"
                        data-node-action="hub08-select-cape"
                        data-card-id="${escapeHtml(entry.cardId)}"
                        ${runtime.capeSacrificed ? "disabled" : ""}
                      >
                        ${escapeHtml(entry.card.heroName)} x${escapeHtml(String(entry.copies))}
                      </button>
                    `).join("")
                  }
                </div>
                <button
                  type="button"
                  class="hub08-altar-button"
                  data-node-id="${NODE_ID}"
                  data-node-action="hub08-sacrifice-cape"
                  data-selected-cape="${escapeHtml(selectedCapeId)}"
                  data-ready="${canSacrifice ? "true" : "false"}"
                  ${runtime.capeSacrificed ? "disabled" : ""}
                >
                  ${runtime.capeSacrificed ? "Offering Accepted" : "Offer Selected Cape"}
                </button>
              </section>
            </section>
          `
          : ""
      }

      ${runtime.lastMessage ? `<p class="key-hint">${escapeHtml(runtime.lastMessage)}</p>` : ""}

      ${
        solvedNow
          ? `
            <section class="hub08-status" aria-live="polite">
              <p><strong>Wave-II passkey forged.</strong></p>
            </section>
          `
          : ""
      }
    </article>
  `;
}

export const HUB08_NODE_EXPERIENCE = {
  nodeId: NODE_ID,
  initialState: initialHub08Runtime,
  render: renderHub08Experience,
  reduceRuntime: reduceHub08Runtime,
  validateRuntime: validateHub08Runtime,
  buildActionFromElement: buildHub08ActionFromElement,
  buildKeyAction: buildHub08KeyAction,
};
