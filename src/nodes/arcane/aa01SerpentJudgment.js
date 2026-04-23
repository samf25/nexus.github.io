import { escapeHtml } from "../../templates/shared.js";
import { arcaneSystemFromState } from "../../systems/arcaneAscension.js";

const NODE_ID = "AA01";
const ROOM_COUNT = 5;

const ROOM_SCENES = Object.freeze([
  Object.freeze({
    title: "Entry Prism Hall",
    text: "Your trial begins under a silent mirror vault. Colored door sigils flare as the Voice reminds you: no weapons, only judgment.",
    options: Object.freeze([
      Object.freeze({ route: "scarlet", label: "Scarlet Door", tone: "Combat pressure", score: 3 }),
      Object.freeze({ route: "azure", label: "Azure Door", tone: "Puzzle pressure", score: 4 }),
      Object.freeze({ route: "jade", label: "Jade Door", tone: "Skill pressure", score: 2 }),
    ]),
  }),
  Object.freeze({
    title: "Pendulum Lattice",
    text: "A corridor of pendulums sweeps over pressure tiles. One route asks precision, one asks speed, one asks brute timing.",
    options: Object.freeze([
      Object.freeze({ route: "scarlet", label: "Dash between pendulums", tone: "Risky speed line", score: 2 }),
      Object.freeze({ route: "azure", label: "Solve tile cadence first", tone: "Pattern solve", score: 5 }),
      Object.freeze({ route: "jade", label: "Anchor and advance stepwise", tone: "Steady control", score: 3 }),
    ]),
  }),
  Object.freeze({
    title: "Floodgate Chamber",
    text: "A split-level room starts filling from rune vents. A hidden gate exists, but only if you read the mana current correctly.",
    options: Object.freeze([
      Object.freeze({ route: "scarlet", label: "Force the upper lock", tone: "High stress execution", score: 3 }),
      Object.freeze({ route: "azure", label: "Drain through sequence runes", tone: "Logic-heavy path", score: 5 }),
      Object.freeze({ route: "jade", label: "Stabilize vents then cross", tone: "Control-first path", score: 4 }),
    ]),
  }),
  Object.freeze({
    title: "Guardian Divide",
    text: "A partitioned arena holds minor threats and one guardian behind a failing seal. You choose how to spend your momentum.",
    options: Object.freeze([
      Object.freeze({ route: "scarlet", label: "Break the line before release", tone: "Direct engagement", score: 4 }),
      Object.freeze({ route: "azure", label: "Redirect guardian trigger", tone: "Technical bypass", score: 5 }),
      Object.freeze({ route: "jade", label: "Contain, then isolate", tone: "Defensive method", score: 3 }),
    ]),
  }),
  Object.freeze({
    title: "Attunement Approach",
    text: "The final hall opens to a fountain chamber. The trial measures intent as much as survival.",
    options: Object.freeze([
      Object.freeze({ route: "scarlet", label: "Commit and advance", tone: "Resolve under pressure", score: 3 }),
      Object.freeze({ route: "azure", label: "Map sigils before stepping", tone: "Measured precision", score: 4 }),
      Object.freeze({ route: "jade", label: "Match cadence with the room", tone: "Adaptive control", score: 4 }),
    ]),
  }),
]);

function safeText(value) {
  return String(value || "").trim();
}

function safeInt(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.floor(numeric) : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function crystalRewardForScore(score) {
  const normalized = Math.max(0, safeInt(score, 0));
  if (normalized >= 21) {
    return 42;
  }
  if (normalized >= 17) {
    return 34;
  }
  if (normalized >= 13) {
    return 28;
  }
  return 22;
}

function normalizeRuntime(runtime) {
  const source = runtime && typeof runtime === "object" ? runtime : {};
  const pathSeed = Math.max(1, safeInt(source.pathSeed, Date.now()));
  const selectedDoors = Array.isArray(source.selectedDoors)
    ? source.selectedDoors.map((entry) => safeText(entry).toLowerCase()).filter((entry) => entry)
    : [];
  const challengeLog = Array.isArray(source.challengeLog)
    ? source.challengeLog
      .filter((entry) => entry && typeof entry === "object")
      .map((entry) => ({
        roomTitle: safeText(entry.roomTitle),
        route: safeText(entry.route).toLowerCase(),
        tone: safeText(entry.tone),
        scoreDelta: safeInt(entry.scoreDelta, 0),
      }))
    : [];
  const solved = Boolean(source.solved);
  const completed = Boolean(source.completed) || solved;
  return {
    phase: safeText(source.phase) || "briefing",
    roomIndex: clamp(safeInt(source.roomIndex, 0), 0, ROOM_COUNT),
    pathSeed,
    selectedDoors,
    challengeLog,
    trialScore: Math.max(0, safeInt(source.trialScore, 0)),
    manaCrystalReward: Math.max(0, safeInt(source.manaCrystalReward, 0)),
    completed,
    solved: solved || completed,
    lockedAfterComplete: Boolean(source.lockedAfterComplete) || completed,
    lastMessage: safeText(source.lastMessage),
  };
}

export function initialAa01Runtime() {
  return normalizeRuntime({
    phase: "briefing",
    roomIndex: 0,
    pathSeed: Date.now(),
    selectedDoors: [],
    challengeLog: [],
    trialScore: 0,
    completed: false,
    solved: false,
    lockedAfterComplete: false,
  });
}

export function synchronizeAa01Runtime(runtime) {
  return normalizeRuntime(runtime);
}

export function validateAa01Runtime(runtime) {
  return Boolean(normalizeRuntime(runtime).solved);
}

export function reduceAa01Runtime(runtime, action) {
  const current = normalizeRuntime(runtime);
  if (!action || typeof action !== "object") {
    return current;
  }
  if (current.lockedAfterComplete) {
    return {
      ...current,
      lastMessage: current.lastMessage || "Judgment archive locked. This trial cannot be repeated.",
    };
  }

  if (action.type === "aa01-start-judgment") {
    return {
      ...current,
      phase: "trial",
      lastMessage: "Trial initialized.",
    };
  }

  if (action.type === "aa01-choose-route") {
    const roomIndex = clamp(safeInt(action.roomIndex, current.roomIndex), 0, ROOM_COUNT - 1);
    if (roomIndex !== current.roomIndex) {
      return current;
    }
    const room = ROOM_SCENES[roomIndex] || ROOM_SCENES[0];
    const route = safeText(action.route).toLowerCase();
    const option = (room.options || []).find((entry) => entry.route === route);
    if (!option) {
      return {
        ...current,
        lastMessage: "Invalid route selection.",
      };
    }
    const nextScore = current.trialScore + safeInt(option.score, 0);
    const nextRoomIndex = current.roomIndex + 1;
    return {
      ...current,
      roomIndex: nextRoomIndex,
      phase: nextRoomIndex >= ROOM_COUNT ? "fountain" : "trial",
      selectedDoors: [...current.selectedDoors, option.route],
      challengeLog: [
        ...current.challengeLog,
        {
          roomTitle: room.title,
          route: option.route,
          tone: option.tone,
          scoreDelta: safeInt(option.score, 0),
        },
      ],
      trialScore: nextScore,
      manaCrystalReward: crystalRewardForScore(nextScore),
      lastMessage: `Route logged: ${option.label}.`,
    };
  }

  if (action.type === "aa01-claim-attunement") {
    if (!action.applied) {
      return {
        ...current,
        phase: "fountain",
        lastMessage: safeText(action.message) || "The attunement did not bind.",
      };
    }
    return {
      ...current,
      phase: "complete",
      completed: true,
      solved: true,
      lockedAfterComplete: true,
      manaCrystalReward: Math.max(current.manaCrystalReward, safeInt(action.manaCrystalReward, current.manaCrystalReward)),
      lastMessage: safeText(action.message) || "Attunement complete.",
    };
  }

  return current;
}

function roomMarkup(runtime) {
  const room = ROOM_SCENES[runtime.roomIndex] || ROOM_SCENES[ROOM_SCENES.length - 1];
  return `
    <section class="card">
      <h3>${escapeHtml(room.title)}</h3>
      <p>${escapeHtml(room.text)}</p>
      <div class="toolbar">
        ${room.options.map((option) => `
          <button
            type="button"
            data-node-id="${NODE_ID}"
            data-node-action="aa01-choose-route"
            data-room-index="${runtime.roomIndex}"
            data-route="${escapeHtml(option.route)}"
          >
            ${escapeHtml(option.label)}
          </button>
        `).join("")}
      </div>
      <p class="muted">Current score: ${escapeHtml(String(runtime.trialScore))}</p>
    </section>
  `;
}

function fountainMarkup(runtime) {
  return `
    <section class="card">
      <h3>Attunement Fountain</h3>
      <p>The chamber resolves into still water and layered runes.</p>
      <p><strong>Projected Mana Crystals:</strong> ${escapeHtml(String(runtime.manaCrystalReward))}</p>
      <button
        type="button"
        data-node-id="${NODE_ID}"
        data-node-action="aa01-claim-attunement"
        data-mana-crystal-reward="${escapeHtml(String(runtime.manaCrystalReward))}"
      >
        Drink from the Fountain
      </button>
    </section>
  `;
}

function completeMarkup(runtime, arcane) {
  return `
    <section class="card">
      <h3>Judgment Archived</h3>
      <p><strong>Attunement:</strong> Enchanter</p>
      <p><strong>Trial Score:</strong> ${escapeHtml(String(runtime.trialScore))}</p>
      <p><strong>Mana Crystals Earned:</strong> ${escapeHtml(String(runtime.manaCrystalReward))}</p>
      <p><strong>Current Mana Crystals:</strong> ${escapeHtml(String(arcane.manaCrystals))}</p>
    </section>
  `;
}

function logMarkup(runtime) {
  if (!runtime.challengeLog.length) {
    return "";
  }
  return `
    <section class="card">
      <h4>Route Record</h4>
      <ul>
        ${runtime.challengeLog.map((entry, index) => `
          <li>${escapeHtml(String(index + 1))}. ${escapeHtml(entry.roomTitle)}: ${escapeHtml(entry.route)} (${escapeHtml(entry.tone)}, +${escapeHtml(String(entry.scoreDelta))})</li>
        `).join("")}
      </ul>
    </section>
  `;
}

export function renderAa01Experience(context) {
  const runtime = synchronizeAa01Runtime(context.runtime);
  const arcane = arcaneSystemFromState(context.state || {}, Date.now());
  let body = "";

  if (runtime.lockedAfterComplete || runtime.phase === "complete") {
    body = completeMarkup(runtime, arcane);
  } else if (runtime.phase === "briefing") {
    body = `
      <section class="card">
        <h3>Serpent Spire Judgment</h3>
        <p>You enter through the Judgment gate. Weapons are barred. The tower evaluates route choices, execution, and composure under pressure.</p>
        <button type="button" data-node-id="${NODE_ID}" data-node-action="aa01-start-judgment">Begin Judgment</button>
      </section>
    `;
  } else if (runtime.phase === "fountain" || runtime.roomIndex >= ROOM_COUNT) {
    body = fountainMarkup(runtime);
  } else {
    body = roomMarkup(runtime);
  }

  return `
    <article class="aa01-node" data-node-id="${NODE_ID}">
      ${body}
      ${logMarkup(runtime)}
    </article>
  `;
}

export function buildAa01ActionFromElement(element) {
  const action = safeText(element.getAttribute("data-node-action"));
  if (!action) {
    return null;
  }
  if (action === "aa01-start-judgment") {
    return {
      type: action,
      at: Date.now(),
    };
  }
  if (action === "aa01-choose-route") {
    return {
      type: action,
      roomIndex: safeInt(element.getAttribute("data-room-index"), 0),
      route: safeText(element.getAttribute("data-route")).toLowerCase(),
      at: Date.now(),
    };
  }
  if (action === "aa01-claim-attunement") {
    return {
      type: action,
      manaCrystalReward: safeInt(element.getAttribute("data-mana-crystal-reward"), 0),
      at: Date.now(),
    };
  }
  return null;
}

export const AA01_NODE_EXPERIENCE = {
  nodeId: NODE_ID,
  initialState: initialAa01Runtime,
  synchronizeRuntime: synchronizeAa01Runtime,
  render: renderAa01Experience,
  reduceRuntime: reduceAa01Runtime,
  validateRuntime: validateAa01Runtime,
  buildActionFromElement: buildAa01ActionFromElement,
};
