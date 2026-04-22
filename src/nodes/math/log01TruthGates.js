import { escapeHtml } from "../../templates/shared.js";

const NODE_ID = "LOG01";

const DOORS = Object.freeze([
  {
    id: "d1",
    number: 1,
    expression: "p → q",
    equivalentToImplication: true,
    evaluate: ({ p, q }) => (!p) || q,
  },
  {
    id: "d2",
    number: 2,
    expression: "¬p ∨ q",
    equivalentToImplication: true,
    evaluate: ({ p, q }) => (!p) || q,
  },
  {
    id: "d3",
    number: 3,
    expression: "¬q → ¬p",
    equivalentToImplication: true,
    evaluate: ({ p, q }) => q || (!p),
  },
  {
    id: "d4",
    number: 4,
    expression: "p ∧ q",
    equivalentToImplication: false,
    evaluate: ({ p, q }) => p && q,
  },
  {
    id: "d5",
    number: 5,
    expression: "p ∨ q",
    equivalentToImplication: false,
    evaluate: ({ p, q }) => p || q,
  },
  {
    id: "d6",
    number: 6,
    expression: "q → p",
    equivalentToImplication: false,
    evaluate: ({ p, q }) => (!q) || p,
  },
]);

const DOOR_BY_ID = Object.freeze(Object.fromEntries(DOORS.map((door) => [door.id, door])));

function normalizeTruthPair(value) {
  const source = value && typeof value === "object" ? value : {};
  return {
    p: Boolean(source.p),
    q: Boolean(source.q),
  };
}

function normalizeRuntime(candidate) {
  const source = candidate && typeof candidate === "object" ? candidate : {};
  const assignments = source.assignments && typeof source.assignments === "object" ? source.assignments : {};
  const normalizedAssignments = Object.fromEntries(
    DOORS.map((door) => [door.id, normalizeTruthPair(assignments[door.id])]),
  );

  const solved = DOORS.every((door) => {
    const value = Boolean(door.evaluate(normalizedAssignments[door.id]));
    return door.equivalentToImplication ? value : !value;
  });

  return {
    assignments: normalizedAssignments,
    solved: Boolean(source.solved) || solved,
    lastMessage: String(source.lastMessage || ""),
  };
}

export function initialLog01Runtime() {
  return normalizeRuntime({});
}

export function validateLog01Runtime(runtime) {
  return Boolean(normalizeRuntime(runtime).solved);
}

export function reduceLog01Runtime(runtime, action) {
  const current = normalizeRuntime(runtime);
  if (!action || typeof action !== "object") {
    return current;
  }

  if (action.type !== "log01-toggle") {
    return current;
  }

  const doorId = String(action.doorId || "");
  const variable = String(action.variable || "");
  if (!DOOR_BY_ID[doorId] || (variable !== "p" && variable !== "q")) {
    return current;
  }

  const assignment = current.assignments[doorId];
  const nextAssignments = {
    ...current.assignments,
    [doorId]: {
      ...assignment,
      [variable]: !assignment[variable],
    },
  };

  const solved = DOORS.every((door) => {
    const value = Boolean(door.evaluate(nextAssignments[door.id]));
    return door.equivalentToImplication ? value : !value;
  });

  return {
    ...current,
    assignments: nextAssignments,
    solved,
    lastMessage: solved ? "Gate logic aligned. Lemma of implication recovered." : "",
  };
}

export function buildLog01ActionFromElement(element) {
  const actionName = element.getAttribute("data-node-action");
  if (actionName !== "log01-toggle") {
    return null;
  }

  return {
    type: "log01-toggle",
    doorId: element.getAttribute("data-door-id") || "",
    variable: element.getAttribute("data-variable") || "",
    at: Date.now(),
  };
}

function truthChipMarkup(runtime, doorId, variable) {
  const value = runtime.assignments[doorId][variable];
  return `
    <button
      type="button"
      class="log01-truth-chip ${value ? "is-true" : "is-false"}"
      data-node-id="${NODE_ID}"
      data-node-action="log01-toggle"
      data-door-id="${escapeHtml(doorId)}"
      data-variable="${escapeHtml(variable)}"
    >
      ${escapeHtml(variable.toUpperCase())}: ${value ? "T" : "F"}
    </button>
  `;
}

export function renderLog01Experience(context) {
  const runtime = normalizeRuntime(context.runtime);

  return `
    <article class="log01-node" data-node-id="${NODE_ID}">
      <section class="card log01-head">
        <h3>Implication Hall</h3>
        <p>Toggle <code>p</code> and <code>q</code> for each door so implication-equivalent statements open while non-equivalent statements remain shut.</p>
      </section>
      <section class="log01-door-grid">
        ${DOORS.map((door) => {
          const value = Boolean(door.evaluate(runtime.assignments[door.id]));
          const open = value;
          const closed = !value;
          return `
            <article class="card log01-door ${open ? "is-open" : closed ? "is-closed" : ""}">
              <header>
                <h4>Door ${door.number}</h4>
                <p><code>${escapeHtml(door.expression)}</code></p>
              </header>
              <div class="log01-truth-row">
                ${truthChipMarkup(runtime, door.id, "p")}
                ${truthChipMarkup(runtime, door.id, "q")}
              </div>
              <p class="muted">State: ${open ? "Open" : "Shut"}</p>
            </article>
          `;
        }).join("")}
      </section>
      ${runtime.lastMessage ? `<p class="key-hint">${escapeHtml(runtime.lastMessage)}</p>` : ""}
    </article>
  `;
}

export const LOG01_NODE_EXPERIENCE = {
  nodeId: NODE_ID,
  initialState: initialLog01Runtime,
  render: renderLog01Experience,
  reduceRuntime: reduceLog01Runtime,
  validateRuntime: validateLog01Runtime,
  buildActionFromElement: buildLog01ActionFromElement,
};
