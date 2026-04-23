import { escapeHtml } from "../../templates/shared.js";

const NODE_ID = "NUM02";

const LOCKS = Object.freeze([
  { id: "l1", label: "2 × 3²", correct: 18 },
  { id: "l2", label: "2² × 5", correct: 20 },
  { id: "l3", label: "3³", correct: 27 },
  { id: "l4", label: "2² × 7", correct: 28 },
  { id: "l5", label: "3² × 5", correct: 45 },
]);

const CANDIDATE_VALUES = Object.freeze([18, 20, 27, 28, 45]);

function normalizeRuntime(candidate) {
  const source = candidate && typeof candidate === "object" ? candidate : {};
  const assignments = source.assignments && typeof source.assignments === "object" ? source.assignments : {};

  const normalized = Object.fromEntries(
    LOCKS.map((lock) => {
      const value = Number(assignments[lock.id]);
      return [lock.id, CANDIDATE_VALUES.includes(value) ? value : 0];
    }),
  );

  const solved = LOCKS.every((lock) => normalized[lock.id] === lock.correct);

  return {
    assignments: normalized,
    solved: Boolean(source.solved) || solved,
    lastMessage: String(source.lastMessage || ""),
  };
}

export function initialNum02Runtime() {
  return normalizeRuntime({});
}

export function validateNum02Runtime(runtime) {
  return Boolean(normalizeRuntime(runtime).solved);
}

export function reduceNum02Runtime(runtime, action) {
  const current = normalizeRuntime(runtime);
  if (!action || typeof action !== "object") {
    return current;
  }

  if (action.type !== "num02-assign-lock") {
    return current;
  }

  const lockId = String(action.lockId || "");
  const value = Number(action.value);
  if (!LOCKS.some((lock) => lock.id === lockId) || !CANDIDATE_VALUES.includes(value)) {
    return current;
  }

  const nextAssignments = {
    ...current.assignments,
    [lockId]: value,
  };
  const solved = LOCKS.every((lock) => nextAssignments[lock.id] === lock.correct);

  return {
    ...current,
    assignments: nextAssignments,
    solved,
    lastMessage: solved ? "All lock teeth align. Prime Teeth recovered." : "",
  };
}

export function buildNum02ActionFromElement(element) {
  const actionName = element.getAttribute("data-node-action");
  if (actionName !== "num02-assign-lock") {
    return null;
  }

  return {
    type: "num02-assign-lock",
    lockId: element.getAttribute("data-lock-id") || "",
    value: Number(element.getAttribute("data-value")),
    at: Date.now(),
  };
}

export function renderNum02Experience(context) {
  const runtime = normalizeRuntime(context.runtime);

  return `
    <article class="num02-node" data-node-id="${NODE_ID}">
      <section class="card num02-head">
        <h3>Prime Factor Locksmith</h3>
        <p>Match each candidate number to the lock with the same prime-factor profile.</p>
      </section>
      <section class="num02-lock-grid">
        ${LOCKS.map((lock) => {
          const assigned = runtime.assignments[lock.id];
          return `
            <article class="card num02-lock-card ${assigned === lock.correct ? "is-correct" : ""}">
              <h4>${escapeHtml(lock.label)}</h4>
              <div class="num02-choice-row">
                ${CANDIDATE_VALUES.map((value) => `
                  <button
                    type="button"
                    class="num02-choice ${assigned === value ? "is-selected" : ""}"
                    data-node-id="${NODE_ID}"
                    data-node-action="num02-assign-lock"
                    data-lock-id="${escapeHtml(lock.id)}"
                    data-value="${value}"
                  >
                    ${value}
                  </button>
                `).join("")}
              </div>
            </article>
          `;
        }).join("")}
      </section>
    </article>
  `;
}

export const NUM02_NODE_EXPERIENCE = {
  nodeId: NODE_ID,
  initialState: initialNum02Runtime,
  render: renderNum02Experience,
  reduceRuntime: reduceNum02Runtime,
  validateRuntime: validateNum02Runtime,
  buildActionFromElement: buildNum02ActionFromElement,
};
