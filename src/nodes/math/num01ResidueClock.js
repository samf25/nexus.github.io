import { escapeHtml } from "../../templates/shared.js";

const NODE_ID = "NUM01";

const MODULI = Object.freeze([
  { id: "m3", mod: 3, target: 2 },
  { id: "m4", mod: 4, target: 1 },
  { id: "m5", mod: 5, target: 3 },
  { id: "m7", mod: 7, target: 4 },
]);

function normalizeRuntime(candidate) {
  const source = candidate && typeof candidate === "object" ? candidate : {};
  const residues = source.residues && typeof source.residues === "object" ? source.residues : {};
  const normalized = Object.fromEntries(
    MODULI.map((entry) => {
      const value = Number(residues[entry.id]);
      const safe = Number.isFinite(value) ? Math.floor(value) : 0;
      return [entry.id, ((safe % entry.mod) + entry.mod) % entry.mod];
    }),
  );

  const solved = MODULI.every((entry) => normalized[entry.id] === entry.target);
  return {
    residues: normalized,
    solved: Boolean(source.solved) || solved,
    lastMessage: String(source.lastMessage || ""),
  };
}

function smallestSolution(residues) {
  for (let value = 0; value < 420; value += 1) {
    if (MODULI.every((entry) => value % entry.mod === residues[entry.id])) {
      return value;
    }
  }
  return null;
}

export function initialNum01Runtime() {
  return normalizeRuntime({});
}

export function validateNum01Runtime(runtime) {
  return Boolean(normalizeRuntime(runtime).solved);
}

export function reduceNum01Runtime(runtime, action) {
  const current = normalizeRuntime(runtime);
  if (!action || typeof action !== "object") {
    return current;
  }

  if (action.type !== "num01-cycle-residue") {
    return current;
  }

  const dialId = String(action.dialId || "");
  const entry = MODULI.find((item) => item.id === dialId);
  if (!entry) {
    return current;
  }

  const step = Number(action.step) >= 0 ? 1 : -1;
  const currentValue = current.residues[dialId];
  const nextValue = ((currentValue + step) % entry.mod + entry.mod) % entry.mod;
  const nextResidues = {
    ...current.residues,
    [dialId]: nextValue,
  };
  const solved = MODULI.every((item) => nextResidues[item.id] === item.target);

  return {
    ...current,
    residues: nextResidues,
    solved,
    lastMessage: solved ? "Residue hands aligned. Mod Wheel recovered." : "",
  };
}

export function buildNum01ActionFromElement(element) {
  const actionName = element.getAttribute("data-node-action");
  if (actionName !== "num01-cycle-residue") {
    return null;
  }

  return {
    type: "num01-cycle-residue",
    dialId: element.getAttribute("data-dial-id") || "",
    step: Number(element.getAttribute("data-step")) || 1,
    at: Date.now(),
  };
}

export function renderNum01Experience(context) {
  const runtime = normalizeRuntime(context.runtime);
  const n = smallestSolution(runtime.residues);

  return `
    <article class="num01-node" data-node-id="${NODE_ID}">
      <section class="card num01-head">
        <h3>Residue Clock</h3>
        <p>Set each dial to satisfy the modular clues and align the shared hidden integer.</p>
      </section>
      <section class="num01-dial-grid">
        ${MODULI.map((entry) => `
          <article class="card num01-dial">
            <h4>mod ${entry.mod}</h4>
            <p class="num01-dial-value">${runtime.residues[entry.id]}</p>
            <div class="toolbar">
              <button
                type="button"
                data-node-id="${NODE_ID}"
                data-node-action="num01-cycle-residue"
                data-dial-id="${escapeHtml(entry.id)}"
                data-step="-1"
              >
                -1
              </button>
              <button
                type="button"
                data-node-id="${NODE_ID}"
                data-node-action="num01-cycle-residue"
                data-dial-id="${escapeHtml(entry.id)}"
                data-step="1"
              >
                +1
              </button>
            </div>
            <p class="muted">Target clue: n ≡ ${entry.target} (mod ${entry.mod})</p>
          </article>
        `).join("")}
      </section>
      <section class="card">
        <p><strong>Current smallest n:</strong> ${n == null ? "None" : escapeHtml(String(n))}</p>
      </section>
      ${runtime.lastMessage ? `<p class="key-hint">${escapeHtml(runtime.lastMessage)}</p>` : ""}
    </article>
  `;
}

export const NUM01_NODE_EXPERIENCE = {
  nodeId: NODE_ID,
  initialState: initialNum01Runtime,
  render: renderNum01Experience,
  reduceRuntime: reduceNum01Runtime,
  validateRuntime: validateNum01Runtime,
  buildActionFromElement: buildNum01ActionFromElement,
};
