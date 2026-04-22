import { defaultPrestigeSystemState } from "../systems/prestige.js";

const STORAGE_KEY = "nexus.arg.state.v1";
const SAVE_MAGIC = "nexus.arg.save";
const SAVE_VERSION = 1;

function defaultSystemState() {
  return {
    madraWell: {
      madraPool: 0,
      totalGenerated: 0,
      chargeCount: 0,
      presetId: "balanced",
      lastTickAt: Date.now(),
    },
    deliveryBoard: {
      perfectDays: 0,
      totalDispatches: 0,
      deliveryRuns: [],
      staffTraits: ["swift", "steady", "careful"],
    },
    dungeonCrawl: {
      currentRoom: "entry",
      clearedRooms: ["entry"],
      keyring: [],
      discoveredRooms: ["entry"],
      inventory: [],
    },
    worm: {
      clout: 20,
      startersConfirmed: false,
      starterCardIds: [],
      deck: {},
      sickbayCardId: "",
    },
    prestige: defaultPrestigeSystemState(),
  };
}

export function createDefaultState() {
  return {
    solvedNodeIds: [],
    seenNodeIds: [],
    hintLevels: {},
    nodeRuntime: {},
    inventory: {
      rewards: {},
      keySlots: {
        wave1: null,
        wave2: null,
        wave3: null,
      },
      usedRewards: {},
    },
    systems: defaultSystemState(),
    requestHistory: [],
  };
}

export function loadState() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return createDefaultState();
    }

    const parsed = JSON.parse(raw);
    return mergeWithDefaults(parsed);
  } catch {
    return createDefaultState();
  }
}

export function saveState(state) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function mergeWithDefaults(candidate) {
  const base = createDefaultState();
  const incoming = candidate || {};

  return {
    ...base,
    ...incoming,
    solvedNodeIds: Array.isArray(incoming.solvedNodeIds) ? incoming.solvedNodeIds : [],
    seenNodeIds: Array.isArray(incoming.seenNodeIds) ? incoming.seenNodeIds : [],
    hintLevels:
      incoming.hintLevels && typeof incoming.hintLevels === "object"
        ? incoming.hintLevels
        : {},
    nodeRuntime:
      incoming.nodeRuntime && typeof incoming.nodeRuntime === "object" ? incoming.nodeRuntime : {},
    inventory: {
      ...base.inventory,
      ...(incoming.inventory || {}),
      rewards:
        incoming.inventory && incoming.inventory.rewards && typeof incoming.inventory.rewards === "object"
          ? incoming.inventory.rewards
          : {},
      keySlots: {
        ...base.inventory.keySlots,
        ...(incoming.inventory && incoming.inventory.keySlots && typeof incoming.inventory.keySlots === "object"
          ? incoming.inventory.keySlots
          : {}),
      },
      usedRewards:
        incoming.inventory && incoming.inventory.usedRewards && typeof incoming.inventory.usedRewards === "object"
          ? incoming.inventory.usedRewards
          : {},
    },
    systems: {
      ...base.systems,
      ...(incoming.systems || {}),
      madraWell: {
        ...base.systems.madraWell,
        ...((incoming.systems && incoming.systems.madraWell) || {}),
      },
      deliveryBoard: {
        ...base.systems.deliveryBoard,
        ...((incoming.systems && incoming.systems.deliveryBoard) || {}),
      },
      dungeonCrawl: {
        ...base.systems.dungeonCrawl,
        ...((incoming.systems && incoming.systems.dungeonCrawl) || {}),
      },
      worm: {
        ...base.systems.worm,
        ...((incoming.systems && incoming.systems.worm) || {}),
      },
      prestige: {
        ...defaultPrestigeSystemState(),
        ...((incoming.systems && incoming.systems.prestige) || {}),
        regions: {
          ...defaultPrestigeSystemState().regions,
          ...(
            incoming.systems &&
            incoming.systems.prestige &&
            incoming.systems.prestige.regions &&
            typeof incoming.systems.prestige.regions === "object"
              ? incoming.systems.prestige.regions
              : {}
          ),
        },
      },
    },
    requestHistory: Array.isArray(incoming.requestHistory) ? incoming.requestHistory : [],
  };
}

export function serializeStateForSave(state) {
  const envelope = {
    magic: SAVE_MAGIC,
    version: SAVE_VERSION,
    exportedAt: new Date().toISOString(),
    state: mergeWithDefaults(state),
  };

  return JSON.stringify(envelope, null, 2);
}

export function parseStateFromSaveText(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Save file is not valid JSON.");
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("Save file has invalid structure.");
  }

  if (parsed.magic === SAVE_MAGIC && parsed.version === SAVE_VERSION) {
    if (!parsed.state || typeof parsed.state !== "object") {
      throw new Error("Save file is missing state payload.");
    }
    return mergeWithDefaults(parsed.state);
  }

  // Support direct state JSON for backward-compatible imports.
  if (Array.isArray(parsed.solvedNodeIds) || Array.isArray(parsed.seenNodeIds) || parsed.systems) {
    return mergeWithDefaults(parsed);
  }

  throw new Error("Save file format is not recognized.");
}

export function markNodeSolved(state, node) {
  const solved = new Set(state.solvedNodeIds);
  solved.add(node.node_id);

  const seen = new Set(state.seenNodeIds || []);
  seen.add(node.node_id);

  const rewards = { ...(state.inventory.rewards || {}) };
  if (node.reward) {
    rewards[node.reward] = {
      source: node.node_id,
      section: node.section,
      awardedAt: Date.now(),
    };
  }

  return {
    ...state,
    solvedNodeIds: [...solved],
    seenNodeIds: [...seen],
    inventory: {
      ...state.inventory,
      rewards,
    },
  };
}

export function markNodeSeen(state, nodeId) {
  const seen = new Set(state.seenNodeIds || []);
  seen.add(nodeId);
  return {
    ...state,
    seenNodeIds: [...seen],
  };
}

export function setHintLevel(state, nodeId, level) {
  const hintLevels = { ...state.hintLevels, [nodeId]: level };

  return {
    ...state,
    hintLevels,
    requestHistory: [
      {
        nodeId,
        level,
        at: Date.now(),
      },
      ...(state.requestHistory || []),
    ].slice(0, 120),
  };
}

export function getNodeRuntime(state, nodeId, initialStateFactory = () => ({})) {
  const runtimeRoot = state && state.nodeRuntime && typeof state.nodeRuntime === "object"
    ? state.nodeRuntime
    : {};
  const existing = runtimeRoot[nodeId];
  if (existing && typeof existing === "object") {
    return existing;
  }
  return initialStateFactory();
}

export function setNodeRuntime(state, nodeId, nextRuntime) {
  if (!nodeId || !nextRuntime || typeof nextRuntime !== "object") {
    return state;
  }

  return {
    ...state,
    nodeRuntime: {
      ...(state.nodeRuntime || {}),
      [nodeId]: nextRuntime,
    },
  };
}

export function updateNodeRuntime(state, nodeId, updater, initialStateFactory = () => ({})) {
  if (!nodeId || typeof updater !== "function") {
    return state;
  }

  const currentRuntime = getNodeRuntime(state, nodeId, initialStateFactory);
  const nextRuntime = updater(currentRuntime);

  if (!nextRuntime || typeof nextRuntime !== "object") {
    return state;
  }

  const existingRuntime =
    state.nodeRuntime && typeof state.nodeRuntime === "object" ? state.nodeRuntime[nodeId] : undefined;
  if (existingRuntime === nextRuntime) {
    return state;
  }

  return setNodeRuntime(state, nodeId, nextRuntime);
}

export function updateSystemState(state, systemKey, nextSystemState) {
  return {
    ...state,
    systems: {
      ...state.systems,
      [systemKey]: nextSystemState,
    },
  };
}

export function resetState() {
  const next = createDefaultState();
  saveState(next);
  return next;
}
