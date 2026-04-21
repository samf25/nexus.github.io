import { escapeHtml } from "../../templates/shared.js";

const NODE_ID = "CRD03";
const MAP_SRC = "src/nodes/cradle/Cradle%20Map.jpeg";

const LABEL_TARGETS = Object.freeze([
  { id: "sacred-valley", answer: "Sacred Valley", x: 24.8, y: 32.15, w: 8.4, h: 3.1 },
  {
    id: "transcendent-ruins",
    answer: "Transcendent Ruins",
    aliases: ["Transcendent Ruin"],
    x: 27.7,
    y: 35.0,
    w: 9.4,
    h: 3.6,
  },
  {
    id: "serpents-grave",
    answer: "Serpent's Grave",
    aliases: ["Serpents Grave"],
    x: 35.1,
    y: 38.6,
    w: 8.8,
    h: 3.4,
  },
  { id: "blackflame-city", answer: "Blackflame City", x: 38.5, y: 29.025, w: 8.2, h: 3.5 },
  { id: "frozen-blade-school", answer: "Frozen Blade School", x: 30.3, y: 22.625, w: 8.8, h: 3.5 },
  { id: "ghostwater", answer: "Ghostwater", x: 15.2, y: 18.5, w: 6.1, h: 3.1 },
  { id: "moongrave", answer: "Moongrave", x: 29.2, y: 69.2, w: 7.4, h: 3.4 },
  { id: "shatterspine-castle", answer: "Shatterspine Castle", x: 47.7, y: 38.65, w: 10.2, h: 3.8 },
  { id: "everwood", answer: "Everwood", x: 76.9, y: 84.7, w: 8.3, h: 4.2 },
  { id: "ninecloud", answer: "Ninecloud", x: 79.95, y: 80.3, w: 8.3, h: 4.2 },
  { id: "ashwind", answer: "Ashwind", x: 91.4, y: 75.65, w: 8.3, h: 4.2 },
  { id: "iceflower", answer: "Iceflower", x: 89.4, y: 87.5, w: 8.3, h: 4.2 },
  { id: "rosegold", answer: "Rosegold", x: 92.8, y: 83.4, w: 8.3, h: 4.2 },
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

export function initialCrd03Runtime() {
  return {
    solvedIds: [],
    activeTargetId: "",
    flashTargetId: "",
    flashUntil: 0,
    lastMessage: "",
    solved: false,
  };
}

export function validateCrd03Runtime(runtime) {
  return Boolean(normalizeRuntime(runtime).solved);
}

export function reduceCrd03Runtime(runtime, action) {
  const current = normalizeRuntime(runtime);
  if (!action || typeof action !== "object") {
    return current;
  }

  if (action.type === "crd03-open-target") {
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

  if (action.type === "crd03-close-target") {
    if (!current.activeTargetId) {
      return current;
    }
    return {
      ...current,
      activeTargetId: "",
    };
  }

  if (action.type === "crd03-submit-target") {
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

export function buildCrd03ActionFromElement(element) {
  const actionName = element.getAttribute("data-node-action");
  if (!actionName) {
    return null;
  }

  if (actionName === "crd03-open-target") {
    return {
      type: "crd03-open-target",
      targetId: element.getAttribute("data-target-id") || "",
      at: Date.now(),
    };
  }

  if (actionName === "crd03-close-target") {
    return {
      type: "crd03-close-target",
      at: Date.now(),
    };
  }

  if (actionName === "crd03-submit-target") {
    const modal = element.closest(".crd03-entry-modal");
    const input =
      modal && modal.querySelector && modal.querySelector("[data-crd03-input]")
        ? modal.querySelector("[data-crd03-input]")
        : null;
    return {
      type: "crd03-submit-target",
      targetId: element.getAttribute("data-target-id") || "",
      value: input && "value" in input ? input.value : "",
      at: Date.now(),
    };
  }

  return null;
}

export function buildCrd03KeyAction(event, runtime) {
  const current = normalizeRuntime(runtime);
  if (event.code === "Escape") {
    if (!current.activeTargetId) {
      return null;
    }
    return {
      type: "crd03-close-target",
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
  const isInput = target instanceof Element && target.matches("input[data-crd03-input]");
  if (!isInput) {
    return null;
  }

  const fallbackInput =
    typeof document !== "undefined" && document.querySelector
      ? document.querySelector(".crd03-entry-modal [data-crd03-input]")
      : null;
  const value =
    target && typeof target === "object" && "value" in target
      ? String(target.value || "")
      : fallbackInput && "value" in fallbackInput
        ? String(fallbackInput.value || "")
        : "";

  return {
    type: "crd03-submit-target",
    targetId: current.activeTargetId,
    value,
    at: Date.now(),
  };
}

function targetButtonMarkup(target) {
  return `
    <button
      type="button"
      class="crd03-label-cover"
      data-node-id="${NODE_ID}"
      data-node-action="crd03-open-target"
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
      class="crd03-solve-flash"
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
    <div class="crd03-entry-modal" role="dialog" aria-label="Map Label Entry">
      <section class="crd03-entry-surface">
        <h3>Map Label</h3>
        <p>Enter the hidden location name.</p>
        <input type="text" data-crd03-input autocomplete="off" spellcheck="false" />
        <div class="crd03-entry-actions">
          <button
            type="button"
            data-node-id="${NODE_ID}"
            data-node-action="crd03-submit-target"
            data-target-id="${escapeHtml(runtime.activeTargetId)}"
          >
            Confirm
          </button>
          <button type="button" class="ghost" data-node-id="${NODE_ID}" data-node-action="crd03-close-target">Cancel</button>
        </div>
      </section>
    </div>
  `;
}

export function renderCrd03Experience(context) {
  const runtime = normalizeRuntime(context.runtime);
  const solvedCount = runtime.solvedIds.length;
  const solvedSet = new Set(runtime.solvedIds);

  return `
    <article class="crd03-node" data-node-id="${NODE_ID}">
      <section class="crd03-header">
        <h3>Aura Atlas Of Cradle</h3>
        <p class="muted">Restore the obscured labels from memory.</p>
        <p><strong>${solvedCount}</strong> / ${LABEL_TARGETS.length} identified</p>
      </section>

      <section class="crd03-map-shell">
        <img class="crd03-map-image" src="${MAP_SRC}" alt="Cradle map with covered labels" />
        <div class="crd03-overlay" aria-hidden="true">
          ${LABEL_TARGETS.filter((target) => !solvedSet.has(target.id))
            .map((target) => targetButtonMarkup(target))
            .join("")}
          ${solveFlashMarkup(runtime)}
        </div>
      </section>

      ${runtime.lastMessage ? `<p class="key-hint">${escapeHtml(runtime.lastMessage)}</p>` : ""}
      ${runtime.solved ? `<p class="key-hint"><strong>Atlas restored.</strong></p>` : ""}
      ${entryModalMarkup(runtime)}
    </article>
  `;
}

export const CRD03_NODE_EXPERIENCE = {
  nodeId: NODE_ID,
  initialState: initialCrd03Runtime,
  render: renderCrd03Experience,
  reduceRuntime: reduceCrd03Runtime,
  validateRuntime: validateCrd03Runtime,
  buildActionFromElement: buildCrd03ActionFromElement,
  buildKeyAction: buildCrd03KeyAction,
};
