import { escapeHtml } from "../../templates/shared.js";

const NODE_ID = "LOG02";
const DOMAIN_VALUES = Object.freeze([1, 2, 3, 4]);

const STATEMENTS = Object.freeze([
  {
    id: "s1",
    text: "∃x Even(x)",
    markerType: "witness",
    validValues: Object.freeze([2, 4]),
  },
  {
    id: "s2",
    text: "∀x Even(x)",
    markerType: "counterexample",
    validValues: Object.freeze([1, 3]),
  },
  {
    id: "s3",
    text: "∃x Prime(x)",
    markerType: "witness",
    validValues: Object.freeze([2, 3]),
  },
  {
    id: "s4",
    text: "∀x Prime(x)",
    markerType: "counterexample",
    validValues: Object.freeze([1, 4]),
  },
]);

const STATEMENT_BY_ID = Object.freeze(Object.fromEntries(STATEMENTS.map((entry) => [entry.id, entry])));

function normalizeRuntime(candidate) {
  const source = candidate && typeof candidate === "object" ? candidate : {};
  const placements = source.placements && typeof source.placements === "object" ? source.placements : {};

  const normalizedPlacements = Object.fromEntries(
    STATEMENTS.map((statement) => {
      const selected = Number(placements[statement.id]);
      return [statement.id, DOMAIN_VALUES.includes(selected) ? selected : 0];
    }),
  );

  const solved = STATEMENTS.every((statement) => statement.validValues.includes(normalizedPlacements[statement.id]));

  return {
    placements: normalizedPlacements,
    solved: Boolean(source.solved) || solved,
    lastMessage: String(source.lastMessage || ""),
  };
}

export function initialLog02Runtime() {
  return normalizeRuntime({});
}

export function validateLog02Runtime(runtime) {
  return Boolean(normalizeRuntime(runtime).solved);
}

export function reduceLog02Runtime(runtime, action) {
  const current = normalizeRuntime(runtime);
  if (!action || typeof action !== "object") {
    return current;
  }

  if (action.type !== "log02-select-cell") {
    return current;
  }

  const statementId = String(action.statementId || "");
  const value = Number(action.value);
  if (!STATEMENT_BY_ID[statementId] || !DOMAIN_VALUES.includes(value)) {
    return current;
  }

  const nextPlacements = {
    ...current.placements,
    [statementId]: value,
  };
  const solved = STATEMENTS.every((statement) => statement.validValues.includes(nextPlacements[statement.id]));

  return {
    ...current,
    placements: nextPlacements,
    solved,
    lastMessage: solved ? "All witnesses and counterexamples placed. Witness Token recovered." : "",
  };
}

export function buildLog02ActionFromElement(element) {
  const actionName = element.getAttribute("data-node-action");
  if (actionName !== "log02-select-cell") {
    return null;
  }

  return {
    type: "log02-select-cell",
    statementId: element.getAttribute("data-statement-id") || "",
    value: Number(element.getAttribute("data-domain-value")),
    at: Date.now(),
  };
}

export function renderLog02Experience(context) {
  const runtime = normalizeRuntime(context.runtime);

  return `
    <article class="log02-node" data-node-id="${NODE_ID}">
      <section class="card log02-head">
        <h3>Witnesses and Counterexamples</h3>
        <p>Each row needs exactly one marker. Place a <strong>Witness</strong> for existentially true statements and a <strong>Counterexample</strong> for universally false statements.</p>
      </section>
      <section class="log02-grid-wrap">
        <table class="log02-grid">
          <thead>
            <tr>
              <th>Statement</th>
              ${DOMAIN_VALUES.map((value) => `<th>x = ${value}</th>`).join("")}
            </tr>
          </thead>
          <tbody>
            ${STATEMENTS.map((statement) => {
              const selected = runtime.placements[statement.id];
              return `
                <tr>
                  <th>
                    <div>${escapeHtml(statement.text)}</div>
                    <small>${statement.markerType === "witness" ? "Place Witness" : "Place Counterexample"}</small>
                  </th>
                  ${DOMAIN_VALUES.map((value) => {
                    const isSelected = selected === value;
                    return `
                      <td>
                        <button
                          type="button"
                          class="log02-cell ${isSelected ? "is-selected" : ""}"
                          data-node-id="${NODE_ID}"
                          data-node-action="log02-select-cell"
                          data-statement-id="${escapeHtml(statement.id)}"
                          data-domain-value="${value}"
                        >
                          ${isSelected ? (statement.markerType === "witness" ? "W" : "C") : ""}
                        </button>
                      </td>
                    `;
                  }).join("")}
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>
      </section>
    </article>
  `;
}

export const LOG02_NODE_EXPERIENCE = {
  nodeId: NODE_ID,
  initialState: initialLog02Runtime,
  render: renderLog02Experience,
  reduceRuntime: reduceLog02Runtime,
  validateRuntime: validateLog02Runtime,
  buildActionFromElement: buildLog02ActionFromElement,
};
