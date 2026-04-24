import { escapeHtml } from "../../templates/shared.js";

const NODE_ID = "TWI02";
const MAP_SRC = "src/nodes/wanderinginn/map_of_izril.png";

const LABEL_TARGETS = Object.freeze([
  { id: "salazar", answer: "Salaszar", aliases: ["Salazar", "Salazsar"], x: 71.75, y: 66.2, w: 13.2, h: 4.3 },
  { id: "oteslia", answer: "Oteslia", x: 59.5, y: 71.55, w: 11.9, h: 4.3 },
  { id: "palass", answer: "Palass", aliases: ["Pallass"], x: 61.95, y: 58.2, w: 11.7, h: 4.3 },
  { id: "zeres", answer: "Zeres", x: 35.95, y: 90.6, w: 10.0, h: 4.3 },
  { id: "manus", answer: "Manus", x: 32.05, y: 68.2, w: 10.8, h: 4.4 },
  { id: "first-landing", answer: "First Landing", x: 33.25, y: 10.2, w: 14.8, h: 4.4 },
  { id: "liscor", answer: "Liscor", x: 59.8, y: 44.0, w: 8.8, h: 3.8 },
  { id: "celum", answer: "Celum", x: 61.5, y: 40.5, w: 8.8, h: 3.8 },
  { id: "invrisil", answer: "Invrisil", x: 61.0, y: 30.65, w: 11.4, h: 4.3 },
  { id: "tenbault", answer: "Tenbault", x: 73.8, y: 24.6, w: 10.8, h: 3.8 },
  { id: "unseen-empire", answer: "Unseen Empire", x: 53.2, y: 30.0, w: 12.0, h: 6.0 },
  { id: "antinium-hives", answer: "Antinium Hives", x: 37.0, y: 57.85, w: 16.8, h: 4.6 },
  { id: "gnoll-plains", answer: "The Gnoll Plains", aliases: ["Gnoll Plains"], x: 46.4, y: 73.8, w: 14.0, h: 5.4 },
  { id: "fissival", answer: "Fissival", x: 82.55, y: 53.0, w: 11.6, h: 4.5 },
]);

const TARGET_BY_ID = Object.freeze(
  Object.fromEntries(LABEL_TARGETS.map((target) => [target.id, target])),
);

function normalizeGuess(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function normalizeRuntime(runtime) {
  const source = runtime && typeof runtime === "object" ? runtime : {};
  const solvedIds = Array.isArray(source.solvedIds)
    ? source.solvedIds.filter((id) => TARGET_BY_ID[id])
    : [];
  const solvedSet = new Set(solvedIds);

  const activeTargetId = TARGET_BY_ID[source.activeTargetId] ? source.activeTargetId : "";
  const flashTargetId = TARGET_BY_ID[source.flashTargetId] ? source.flashTargetId : "";
  const flashUntil = Number.isFinite(source.flashUntil) ? Number(source.flashUntil) : 0;

  return {
    solvedIds: [...solvedSet],
    activeTargetId,
    flashTargetId,
    flashUntil,
    lastMessage: String(source.lastMessage || ""),
    solved: Boolean(source.solved) || solvedSet.size >= LABEL_TARGETS.length,
  };
}

export function initialTwi02Runtime() {
  return {
    solvedIds: [],
    activeTargetId: "",
    flashTargetId: "",
    flashUntil: 0,
    lastMessage: "",
    solved: false,
  };
}

export function validateTwi02Runtime(runtime) {
  return Boolean(normalizeRuntime(runtime).solved);
}

export function reduceTwi02Runtime(runtime, action) {
  const current = normalizeRuntime(runtime);
  if (!action || typeof action !== "object") {
    return current;
  }

  if (action.type === "twi02-open-target") {
    const targetId = String(action.targetId || "");
    if (!TARGET_BY_ID[targetId] || current.solvedIds.includes(targetId)) {
      return current;
    }
    return {
      ...current,
      activeTargetId: targetId,
      lastMessage: "",
    };
  }

  if (action.type === "twi02-close-target") {
    if (!current.activeTargetId) {
      return current;
    }
    return {
      ...current,
      activeTargetId: "",
    };
  }

  if (action.type === "twi02-submit-target") {
    const targetId = String(action.targetId || current.activeTargetId || "");
    const target = TARGET_BY_ID[targetId];
    if (!target) {
      return current;
    }

    const guess = normalizeGuess(action.value);
    const accepted = [
      target.answer,
      ...(Array.isArray(target.aliases) ? target.aliases : []),
    ].map((value) => normalizeGuess(value));

    if (!accepted.includes(guess)) {
      return {
        ...current,
        lastMessage: "That does not match this location.",
      };
    }

    const solvedSet = new Set(current.solvedIds);
    solvedSet.add(targetId);
    const solved = solvedSet.size >= LABEL_TARGETS.length;

    return {
      ...current,
      solvedIds: [...solvedSet],
      activeTargetId: "",
      flashTargetId: targetId,
      flashUntil: Number(action.at) + 420,
      lastMessage: solved ? "All map labels restored." : "",
      solved,
    };
  }

  return current;
}

export function buildTwi02ActionFromElement(element) {
  const actionName = element.getAttribute("data-node-action");
  if (!actionName) {
    return null;
  }

  if (actionName === "twi02-open-target") {
    return {
      type: "twi02-open-target",
      targetId: element.getAttribute("data-target-id") || "",
      at: Date.now(),
    };
  }

  if (actionName === "twi02-close-target") {
    return {
      type: "twi02-close-target",
      at: Date.now(),
    };
  }

  if (actionName === "twi02-submit-target") {
    const modal = element.closest(".twi02-entry-modal");
    const input =
      modal && modal.querySelector && modal.querySelector("[data-twi02-input]")
        ? modal.querySelector("[data-twi02-input]")
        : null;
    return {
      type: "twi02-submit-target",
      targetId: element.getAttribute("data-target-id") || "",
      value: input && "value" in input ? input.value : "",
      at: Date.now(),
    };
  }

  return null;
}

export function buildTwi02KeyAction(event, runtime) {
  const current = normalizeRuntime(runtime);
  if (event.code === "Escape") {
    if (!current.activeTargetId) {
      return null;
    }
    return {
      type: "twi02-close-target",
      at: Date.now(),
    };
  }

  if (event.code !== "Enter" && event.key !== "Enter") {
    return null;
  }

  if (!current.activeTargetId) {
    return null;
  }

  const target = event.target;
  const isInput = target instanceof Element && target.matches("input[data-twi02-input]");
  if (!isInput) {
    return null;
  }

  return {
    type: "twi02-submit-target",
    targetId: current.activeTargetId,
    value: "value" in target ? String(target.value || "") : "",
    at: Date.now(),
  };
}

function targetButtonMarkup(target) {
  return `
    <button
      type="button"
      class="twi02-label-cover"
      data-node-id="${NODE_ID}"
      data-node-action="twi02-open-target"
      data-target-id="${escapeHtml(target.id)}"
      style="left:${target.x}%;top:${target.y}%;width:${target.w}%;height:${target.h}%;"
      aria-label="Identify hidden map label"
    ></button>
  `;
}

function solveFlashMarkup(runtime) {
  if (!runtime.flashTargetId || Date.now() >= runtime.flashUntil) {
    return "";
  }
  const target = TARGET_BY_ID[runtime.flashTargetId];
  if (!target) {
    return "";
  }
  return `
    <span
      class="twi02-solve-flash"
      style="left:${target.x}%;top:${target.y}%;width:${target.w}%;height:${target.h}%;"
      aria-hidden="true"
    ></span>
  `;
}

function entryModalMarkup(runtime) {
  if (!runtime.activeTargetId) {
    return "";
  }

  return `
    <div class="twi02-entry-modal" role="dialog" aria-label="Map Label Entry">
      <section class="twi02-entry-surface">
        <h3>Map Label</h3>
        <p>Enter the hidden location name.</p>
        <input type="text" data-twi02-input autocomplete="off" spellcheck="false" />
        <div class="twi02-entry-actions">
          <button
            type="button"
            data-node-id="${NODE_ID}"
            data-node-action="twi02-submit-target"
            data-target-id="${escapeHtml(runtime.activeTargetId)}"
          >
            Confirm
          </button>
          <button type="button" class="ghost" data-node-id="${NODE_ID}" data-node-action="twi02-close-target">Cancel</button>
        </div>
      </section>
    </div>
  `;
}

export function renderTwi02Experience(context) {
  const runtime = normalizeRuntime(context.runtime);
  const solvedCount = runtime.solvedIds.length;
  const solvedSet = new Set(runtime.solvedIds);

  return `
    <article class="twi02-node" data-node-id="${NODE_ID}">
      <section class="twi02-header">
        <h3>Dispatch Atlas Of Izril</h3>
        <p class="muted">Restore the obscured map labels from memory.</p>
        <p><strong>${solvedCount}</strong> / ${LABEL_TARGETS.length} identified</p>
      </section>

      <section class="twi02-map-shell">
        <img class="twi02-map-image" src="${MAP_SRC}" alt="Map of Izril with covered labels" />
        <div class="twi02-overlay" aria-hidden="true">
          ${LABEL_TARGETS.filter((target) => !solvedSet.has(target.id))
            .map((target) => targetButtonMarkup(target))
            .join("")}
          ${solveFlashMarkup(runtime)}
        </div>
      </section>
      ${runtime.solved ? `<section class="completion-banner" aria-live="polite"><p><strong>Atlas Restored</strong></p></section>` : ""}
      ${entryModalMarkup(runtime)}
    </article>
  `;
}

export const TWI02_NODE_EXPERIENCE = {
  nodeId: NODE_ID,
  initialState: initialTwi02Runtime,
  render: renderTwi02Experience,
  reduceRuntime: reduceTwi02Runtime,
  validateRuntime: validateTwi02Runtime,
  buildActionFromElement: buildTwi02ActionFromElement,
  buildKeyAction: buildTwi02KeyAction,
};
