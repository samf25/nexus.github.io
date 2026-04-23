import { escapeHtml } from "../../templates/shared.js";

const NODE_ID = "TWI01";

const FIELD_DEFINITIONS = Object.freeze([
  { key: "name", label: "Name" },
  { key: "gender", label: "Gender" },
  { key: "species", label: "Species" },
  { key: "status", label: "Status" },
  { key: "continent", label: "Continent" },
  { key: "residence", label: "Residence" },
  { key: "occupation", label: "Occupation" },
  { key: "volume", label: "Volume Introduced" },
]);

const REVEAL_PATTERNS = Object.freeze([
  Object.freeze(["gender", "status", "residence", "volume"]),
  Object.freeze(["species", "continent", "occupation", "status"]),
  Object.freeze(["gender", "continent", "volume", "occupation"]),
  Object.freeze(["status", "residence", "species", "volume"]),
]);

const GUESTS = Object.freeze([
  {
    id: "apista",
    name: "Apista",
    gender: "Female",
    species: "Ashfire Bee",
    status: "Alive",
    continent: "Izril",
    residence: "The Wandering Inn",
    occupation: "Layabout",
    volume: "4",
  },
  {
    id: "rhata",
    name: "Rhata",
    gender: "Female",
    species: "Rodent",
    status: "Alive",
    continent: "Izril",
    residence: "Liscor",
    occupation: "Layabout",
    volume: "6",
  },
  {
    id: "czauthaqshe",
    name: "Czautha'qshe",
    gender: "Female",
    species: "Djinni",
    status: "Alive",
    continent: "Rhir",
    residence: "Demon Kingdom",
    occupation: "Death",
    volume: "8",
  },
  {
    id: "hethon",
    name: "Hethon",
    gender: "Male",
    species: "Human",
    status: "Alive",
    continent: "Izril",
    residence: "Veltras Lands",
    occupation: "Noble",
    volume: "4",
  },
  {
    id: "minizi",
    name: "Minizi",
    gender: "Female",
    species: "Golem",
    status: "Active",
    continent: "Chandrar",
    residence: "Reim",
    occupation: "Guard",
    volume: "7",
  },
  {
    id: "anazurhe",
    name: "Anazurhe",
    gender: "Female",
    species: "Goblin",
    status: "Alive",
    continent: "Izril",
    residence: "Deuse Valley",
    occupation: "Chieftain",
    volume: "7",
  },
  {
    id: "galuc",
    name: "Galuc",
    gender: "Male",
    species: "Antinium",
    status: "Deceased",
    continent: "Rhir",
    residence: "Demon Kingdom",
    occupation: "Centenium",
    volume: "3",
  },
  {
    id: "elia",
    name: "Elia",
    gender: "Female",
    species: "Half-Elf",
    status: "Alive",
    continent: "Izril",
    residence: "The Wandering Inn",
    occupation: "Adventurer",
    volume: "4",
  },
  {
    id: "zevara-sunderscale",
    name: "Zevara Sunderscale",
    gender: "Female",
    species: "Drake",
    status: "Alive",
    continent: "Izril",
    residence: "Liscor",
    occupation: "Guard",
    volume: "1",
  },
  {
    id: "elirr-fultpar",
    name: "Elirr Fultpar",
    gender: "Male",
    species: "Gnoll",
    status: "Alive",
    continent: "Izril",
    residence: "Liscor",
    occupation: "Mayor",
    volume: "5",
  },
  {
    id: "lupp",
    name: "Lupp",
    gender: "Male",
    species: "Human",
    status: "Alive",
    continent: "Izril",
    residence: "North Izril",
    occupation: "Farmer",
    volume: "6",
  },
  {
    id: "krsysl-wordsmith",
    name: "Krsysl Wordsmith",
    gender: "Male",
    species: "Drake",
    status: "Alive",
    continent: "Izril",
    residence: "Salazsar",
    occupation: "Intellect",
    volume: "2",
  },
  {
    id: "yerzhen",
    name: "Yerzhen",
    gender: "Male",
    species: "Human",
    status: "Alive",
    continent: "Terandria",
    residence: "Ailendamus",
    occupation: "General",
    volume: "7",
  },
  {
    id: "regis-reinhart",
    name: "Regis Reinhart",
    gender: "Male",
    species: "Human",
    status: "Active",
    continent: "Izril",
    residence: "First Landing",
    occupation: "Noble",
    volume: "4",
  },
]);

function cellIdFor(guestId, fieldKey) {
  return `${guestId}:${fieldKey}`;
}

function normalizeGuess(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function isFieldHiddenForRow(rowIndex, fieldKey) {
  if (fieldKey === "name") {
    return true;
  }
  const pattern = REVEAL_PATTERNS[rowIndex % REVEAL_PATTERNS.length];
  return !pattern.includes(fieldKey);
}

const CELL_LOOKUP = Object.freeze(
  Object.fromEntries(
    GUESTS.flatMap((guest, rowIndex) =>
      FIELD_DEFINITIONS.filter((field) => isFieldHiddenForRow(rowIndex, field.key)).map((field) => [
        cellIdFor(guest.id, field.key),
        {
          guestId: guest.id,
          fieldKey: field.key,
          answer: String(guest[field.key] || ""),
        },
      ]),
    ),
  ),
);

const ALL_MISSING_CELL_IDS = Object.freeze(Object.keys(CELL_LOOKUP));

function normalizeRuntime(runtime) {
  const source = runtime && typeof runtime === "object" ? runtime : {};
  const solvedCells = Array.isArray(source.solvedCells)
    ? source.solvedCells.filter((cellId) => Object.prototype.hasOwnProperty.call(CELL_LOOKUP, cellId))
    : [];
  const solvedSet = new Set(solvedCells);
  const flashCellId = Object.prototype.hasOwnProperty.call(CELL_LOOKUP, source.flashCellId) ? source.flashCellId : "";
  const flashUntil = Number.isFinite(source.flashUntil) ? Number(source.flashUntil) : 0;

  return {
    solvedCells: [...solvedSet],
    flashCellId,
    flashUntil,
    lastMessage: String(source.lastMessage || ""),
    solved: Boolean(source.solved) || solvedSet.size >= ALL_MISSING_CELL_IDS.length,
  };
}

export function initialTwi01Runtime() {
  return {
    solvedCells: [],
    flashCellId: "",
    flashUntil: 0,
    lastMessage: "",
    solved: false,
  };
}

export function validateTwi01Runtime(runtime) {
  return Boolean(normalizeRuntime(runtime).solved);
}

export function reduceTwi01Runtime(runtime, action) {
  const current = normalizeRuntime(runtime);
  if (!action || typeof action !== "object") {
    return current;
  }

  if (action.type !== "twi01-submit-cell") {
    return current;
  }

  const cellId = String(action.cellId || "");
  const cell = CELL_LOOKUP[cellId];
  if (!cell) {
    return current;
  }

  if (current.solvedCells.includes(cellId)) {
    return current;
  }

  const guess = normalizeGuess(action.value);
  const target = normalizeGuess(cell.answer);
  if (!guess || guess !== target) {
    return {
      ...current,
      lastMessage: "That entry does not match the ledger.",
    };
  }

  const solvedSet = new Set(current.solvedCells);
  solvedSet.add(cellId);
  const solved = solvedSet.size >= ALL_MISSING_CELL_IDS.length;

  return {
    ...current,
    solvedCells: [...solvedSet],
    flashCellId: cellId,
    flashUntil: Number(action.at || Date.now()) + 420,
    lastMessage: solved ? "Guest ledger fully reconstructed." : "",
    solved,
  };
}

export function buildTwi01ActionFromElement() {
  return null;
}

export function buildTwi01KeyAction(event) {
  if (event.code !== "Enter" && event.key !== "Enter") {
    return null;
  }

  const target = event.target;
  if (!(target instanceof Element) || !target.matches("input[data-twi01-input]")) {
    return null;
  }

  return {
    type: "twi01-submit-cell",
    cellId: target.getAttribute("data-cell-id") || "",
    value: "value" in target ? target.value : "",
    at: Date.now(),
  };
}

function cellMarkup(runtime, rowIndex, guest, field) {
  const value = String(guest[field.key] || "");
  const hidden = isFieldHiddenForRow(rowIndex, field.key);
  if (!hidden) {
    return `<span class="twi01-cell-fixed">${escapeHtml(value)}</span>`;
  }

  const cellId = cellIdFor(guest.id, field.key);
  const solved = runtime.solvedCells.includes(cellId);
  const flash = solved && runtime.flashCellId === cellId && Date.now() < runtime.flashUntil;
  if (solved) {
    return `<span class="twi01-cell-solved ${flash ? "is-flash" : ""}">${escapeHtml(value)}</span>`;
  }

  return `
    <input
      type="text"
      class="twi01-cell-input"
      data-twi01-input
      data-cell-id="${escapeHtml(cellId)}"
      placeholder="?"
      autocomplete="off"
      spellcheck="false"
    />
  `;
}

export function renderTwi01Experience(context) {
  const runtime = normalizeRuntime(context.runtime);
  const solvedCount = runtime.solvedCells.length;
  const totalMissing = ALL_MISSING_CELL_IDS.length;

  return `
    <article class="twi01-node" data-node-id="${NODE_ID}">
      <section class="twi01-header">
        <h3>The True Guest Ledger</h3>
        <p class="muted">Restore the missing entries. Press Enter inside a cell to submit.</p>
        <p><strong>${solvedCount}</strong> / ${totalMissing} missing entries restored</p>
      </section>

      <section class="twi01-table-wrap">
        <table class="twi01-ledger">
          <thead>
            <tr>
              ${FIELD_DEFINITIONS.map((field) => `<th>${escapeHtml(field.label)}</th>`).join("")}
            </tr>
          </thead>
          <tbody>
            ${GUESTS
              .map(
                (guest, rowIndex) => `
                  <tr>
                    ${FIELD_DEFINITIONS.map((field) => `<td>${cellMarkup(runtime, rowIndex, guest, field)}</td>`).join("")}
                  </tr>
                `,
              )
              .join("")}
          </tbody>
        </table>
      </section>
      ${runtime.solved ? `<p class="key-hint"><strong>Ledger fully restored.</strong></p>` : ""}
    </article>
  `;
}

export const TWI01_NODE_EXPERIENCE = {
  nodeId: NODE_ID,
  initialState: initialTwi01Runtime,
  render: renderTwi01Experience,
  reduceRuntime: reduceTwi01Runtime,
  validateRuntime: validateTwi01Runtime,
  buildActionFromElement: buildTwi01ActionFromElement,
  buildKeyAction: buildTwi01KeyAction,
};
