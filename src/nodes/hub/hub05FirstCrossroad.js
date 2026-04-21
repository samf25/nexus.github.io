import { escapeHtml } from "../../templates/shared.js";
import { renderArtifactSymbol } from "../../core/artifacts.js";
import { renderRegionSymbol } from "../../core/symbology.js";

const NODE_ID = "HUB05";
const ARCHIVE_ARTIFACT = "Archive Address";
const ORDER_ARTIFACT = "Constellation Order";

const TOKENS = Object.freeze([
  { id: "cradle", symbolKey: "cradle", label: "Cradle" },
  { id: "wandering-inn", symbolKey: "wandering-inn", label: "Wandering Inn" },
  { id: "worm", symbolKey: "worm", label: "Worm" },
  { id: "mother-of-learning", symbolKey: "mother-of-learning", label: "Mother of Learning" },
  { id: "hall-of-proofs", symbolKey: "hall-of-proofs", label: "Hall of Proofs" },
  { id: "prime-vault", symbolKey: "prime-vault", label: "Prime Vault" },
]);

const TOKEN_BY_ID = Object.freeze(Object.fromEntries(TOKENS.map((token) => [token.id, token])));

const SLOT_LAYOUT = Object.freeze([
  { id: "slot-1", x: 16, y: 24, targetTokenId: "worm" },
  { id: "slot-2", x: 52, y: 16, targetTokenId: "prime-vault" },
  { id: "slot-3", x: 82, y: 30, targetTokenId: "cradle" },
  { id: "slot-4", x: 76, y: 72, targetTokenId: "hall-of-proofs" },
  { id: "slot-5", x: 44, y: 84, targetTokenId: "wandering-inn" },
  { id: "slot-6", x: 14, y: 66, targetTokenId: "mother-of-learning" },
]);

const SLOT_BY_ID = Object.freeze(Object.fromEntries(SLOT_LAYOUT.map((slot) => [slot.id, slot])));

function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function rewardMatches(name, expected) {
  return normalizeText(name) === normalizeText(expected);
}

function cleanedPlacements(candidate) {
  const source = candidate && typeof candidate === "object" ? candidate : {};
  const next = {};
  for (const slot of SLOT_LAYOUT) {
    const tokenId = String(source[slot.id] || "");
    if (TOKEN_BY_ID[tokenId]) {
      next[slot.id] = tokenId;
    }
  }
  return next;
}

function solvedState(placements) {
  return SLOT_LAYOUT.every((slot) => placements[slot.id] === slot.targetTokenId);
}

function normalizeRuntime(runtime) {
  const source = runtime && typeof runtime === "object" ? runtime : {};
  const placements = cleanedPlacements(source.placements);
  const selectedTokenId = TOKEN_BY_ID[source.selectedTokenId] ? source.selectedTokenId : "";
  const archiveActivated = Boolean(source.archiveActivated);
  const solved = archiveActivated && solvedState(placements);
  return {
    archiveActivated,
    placements,
    selectedTokenId,
    solved,
    lastMessage: String(source.lastMessage || ""),
  };
}

function slotForToken(placements, tokenId) {
  for (const slot of SLOT_LAYOUT) {
    if (placements[slot.id] === tokenId) {
      return slot.id;
    }
  }
  return "";
}

function withSolved(runtime) {
  const solved = runtime.archiveActivated && solvedState(runtime.placements);
  if (!solved) {
    return {
      ...runtime,
      solved: false,
    };
  }

  return {
    ...runtime,
    solved: true,
    selectedTokenId: "",
    lastMessage: "Crossroad lattice complete.",
  };
}

export function initialHub05Runtime() {
  return {
    archiveActivated: false,
    placements: {},
    selectedTokenId: "",
    solved: false,
    lastMessage: "",
  };
}

export function validateHub05Runtime(runtime) {
  return normalizeRuntime(runtime).solved;
}

export function reduceHub05Runtime(runtime, action) {
  const current = normalizeRuntime(runtime);
  if (!action || typeof action !== "object") {
    return current;
  }

  if (current.solved) {
    return current;
  }

  if (action.type === "hub05-scan-archive") {
    if (current.archiveActivated) {
      return current;
    }
    if (!rewardMatches(action.artifact, ARCHIVE_ARTIFACT)) {
      return {
        ...current,
        lastMessage: "The first sigil stays dark.",
      };
    }
    return {
      ...current,
      archiveActivated: true,
      lastMessage: "Six stellar shards drift free.",
    };
  }

  if (action.type === "hub05-select-token") {
    if (!current.archiveActivated) {
      return current;
    }
    const tokenId = String(action.tokenId || "");
    if (!TOKEN_BY_ID[tokenId]) {
      return current;
    }
    return {
      ...current,
      selectedTokenId: tokenId,
      lastMessage: "",
    };
  }

  if (action.type === "hub05-place-token") {
    if (!current.archiveActivated) {
      return current;
    }
    const slotId = String(action.slotId || "");
    if (!SLOT_BY_ID[slotId]) {
      return current;
    }

    let nextPlacements = { ...current.placements };
    let selectedTokenId = TOKEN_BY_ID[action.tokenId] ? String(action.tokenId) : current.selectedTokenId;

    if (!selectedTokenId) {
      const occupant = nextPlacements[slotId];
      if (!occupant) {
        return current;
      }
      delete nextPlacements[slotId];
      return {
        ...current,
        placements: nextPlacements,
        selectedTokenId: occupant,
        lastMessage: "",
      };
    }

    const previousSlot = slotForToken(nextPlacements, selectedTokenId);
    if (previousSlot) {
      delete nextPlacements[previousSlot];
    }

    const displacedToken = nextPlacements[slotId];
    nextPlacements[slotId] = selectedTokenId;
    selectedTokenId = displacedToken && displacedToken !== selectedTokenId ? displacedToken : "";

    return withSolved({
      ...current,
      placements: nextPlacements,
      selectedTokenId,
      lastMessage: "",
    });
  }

  return current;
}

export function buildHub05ActionFromElement(element) {
  const actionName = element.getAttribute("data-node-action");
  if (!actionName) {
    return null;
  }

  if (actionName === "hub05-scan-archive") {
    return {
      type: "hub05-scan-archive",
      artifact: element.getAttribute("data-selected-artifact") || "",
      ready: element.getAttribute("data-ready") === "true",
    };
  }

  if (actionName === "hub05-select-token") {
    return {
      type: "hub05-select-token",
      tokenId: element.getAttribute("data-token-id") || "",
    };
  }

  if (actionName === "hub05-place-token") {
    return {
      type: "hub05-place-token",
      slotId: element.getAttribute("data-slot-id") || "",
      tokenId: element.getAttribute("data-selected-token") || "",
    };
  }

  return null;
}

function tokenButtonMarkup(token, runtime) {
  const placedAt = slotForToken(runtime.placements, token.id);
  const selected = runtime.selectedTokenId === token.id;
  return `
    <button
      type="button"
      class="hub05-token ${selected ? "is-selected" : ""} ${placedAt ? "is-placed" : ""}"
      data-node-id="${NODE_ID}"
      data-node-action="hub05-select-token"
      data-token-id="${escapeHtml(token.id)}"
      aria-label="Select ${escapeHtml(token.label)} shard"
    >
      ${renderRegionSymbol({
        symbolKey: token.symbolKey,
        className: "hub05-token-symbol",
      })}
    </button>
  `;
}

function slotMarkup(slot, runtime, revealTargets) {
  const placedTokenId = runtime.placements[slot.id];
  const placedToken = TOKEN_BY_ID[placedTokenId] || null;
  const targetToken = TOKEN_BY_ID[slot.targetTokenId] || null;
  const correct = Boolean(placedTokenId && placedTokenId === slot.targetTokenId);

  return `
    <button
      type="button"
      class="hub05-slot ${correct ? "is-correct" : ""} ${placedToken ? "is-filled" : ""}"
      style="left:${slot.x}%; top:${slot.y}%;"
      data-node-id="${NODE_ID}"
      data-node-action="hub05-place-token"
      data-slot-id="${escapeHtml(slot.id)}"
      data-selected-token="${escapeHtml(runtime.selectedTokenId)}"
      aria-label="Crossroad slot"
    >
      ${
        revealTargets && targetToken
          ? renderRegionSymbol({
              symbolKey: targetToken.symbolKey,
              className: "hub05-slot-target",
            })
          : "<span class=\"hub05-slot-core\" aria-hidden=\"true\"></span>"
      }
      ${
        placedToken
          ? renderRegionSymbol({
              symbolKey: placedToken.symbolKey,
              className: "hub05-slot-token",
            })
          : ""
      }
    </button>
  `;
}

export function renderHub05Experience(context) {
  const runtime = normalizeRuntime(context.runtime);
  const solvedNow = Boolean(context.solved || runtime.solved);
  const selectedArtifact = String(context.selectedArtifactReward || "");
  const artifactPanelOpen = Boolean(context.artifactPanelOpen);
  const archiveReady = !runtime.archiveActivated && rewardMatches(selectedArtifact, ARCHIVE_ARTIFACT);
  const revealTargets =
    runtime.archiveActivated &&
    artifactPanelOpen &&
    rewardMatches(selectedArtifact, ORDER_ARTIFACT);

  return `
    <article class="hub05-node" data-node-id="${NODE_ID}">
      <section class="hub05-controls">
        <button
          type="button"
          class="hub05-artifact-trigger ${runtime.archiveActivated ? "is-used" : ""}"
          data-node-id="${NODE_ID}"
          data-node-action="hub05-scan-archive"
          data-selected-artifact="${escapeHtml(selectedArtifact)}"
          data-ready="${archiveReady ? "true" : "false"}"
          ${runtime.archiveActivated ? "disabled" : ""}
          aria-label="Activate archive signal"
          title="Activate archive signal"
        >
          ${renderArtifactSymbol({
            artifactName: ARCHIVE_ARTIFACT,
            className: "hub05-artifact-symbol artifact-symbol",
          })}
        </button>
      </section>

      <section class="hub05-field">
        <div class="hub05-starback" aria-hidden="true"></div>
        <div class="hub05-slots">
          ${SLOT_LAYOUT.map((slot) => slotMarkup(slot, runtime, revealTargets)).join("")}
        </div>
      </section>

      ${
        runtime.archiveActivated
          ? `
            <section class="hub05-token-row">
              ${TOKENS.map((token) => tokenButtonMarkup(token, runtime)).join("")}
            </section>
          `
          : ""
      }

      ${runtime.lastMessage ? `<p class="key-hint">${escapeHtml(runtime.lastMessage)}</p>` : ""}

      <p class="sr-only" role="status" aria-live="polite">
        ${escapeHtml(
          solvedNow
            ? "Crossroad constellation solved."
            : runtime.selectedTokenId
              ? `${runtime.selectedTokenId} selected.`
              : "No shard selected.",
        )}
      </p>

      ${
        solvedNow
          ? `
            <section class="hub04-status" aria-live="polite">
              <p><strong>Wave-I passkey forged.</strong></p>
            </section>
          `
          : ""
      }
    </article>
  `;
}

export const HUB05_NODE_EXPERIENCE = {
  nodeId: NODE_ID,
  initialState: initialHub05Runtime,
  render: renderHub05Experience,
  reduceRuntime: reduceHub05Runtime,
  validateRuntime: validateHub05Runtime,
  buildActionFromElement: buildHub05ActionFromElement,
};
