export const DUNGEON_GRAPH = {
  entry: {
    label: "Entry Hall",
    neighbors: ["antechamber"],
    action: "stabilize",
  },
  antechamber: {
    label: "Antichamber",
    neighbors: ["entry", "trap-corridor", "cache-room"],
    action: "scan",
  },
  "trap-corridor": {
    label: "Trap Corridor",
    neighbors: ["antechamber", "stairwell"],
    action: "disarm",
  },
  "cache-room": {
    label: "Cache Room",
    neighbors: ["antechamber"],
    action: "loot",
  },
  stairwell: {
    label: "Stairwell Exit",
    neighbors: ["trap-corridor"],
    action: "ascend",
  },
};

export function describeRoom(roomKey) {
  const room = DUNGEON_GRAPH[roomKey] || DUNGEON_GRAPH.entry;
  return {
    id: roomKey,
    label: room.label,
    neighbors: room.neighbors,
    action: room.action,
  };
}

export function moveRoom(dungeonState, targetRoom) {
  const current = DUNGEON_GRAPH[dungeonState.currentRoom] || DUNGEON_GRAPH.entry;
  if (!current.neighbors.includes(targetRoom)) {
    return {
      nextState: dungeonState,
      ok: false,
      message: "Route blocked. Choose an adjacent room.",
    };
  }

  const discovered = new Set(dungeonState.discoveredRooms || []);
  const cleared = new Set(dungeonState.clearedRooms || []);
  discovered.add(targetRoom);
  cleared.add(targetRoom);

  return {
    nextState: {
      ...dungeonState,
      currentRoom: targetRoom,
      discoveredRooms: [...discovered],
      clearedRooms: [...cleared],
    },
    ok: true,
    message: `Moved to ${DUNGEON_GRAPH[targetRoom].label}.`,
  };
}

export function runRoomAction(dungeonState) {
  const room = DUNGEON_GRAPH[dungeonState.currentRoom] || DUNGEON_GRAPH.entry;
  const inventory = new Set(dungeonState.inventory || []);
  let reward = null;

  if (room.action === "loot") {
    reward = "cache-fragment";
    inventory.add(reward);
  }
  if (room.action === "ascend") {
    reward = "tutorial-clear";
    inventory.add(reward);
  }

  return {
    nextState: {
      ...dungeonState,
      inventory: [...inventory],
    },
    reward,
    message: reward
      ? `Action ${room.action} complete. Acquired ${reward}.`
      : `Action ${room.action} complete.`,
  };
}
