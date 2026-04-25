import { escapeHtml } from "../../templates/shared.js";
import { renderArtifactSymbol } from "../../core/artifacts.js";
import { renderRegionSymbol } from "../../core/symbology.js";
import { prestigeModifiersFromState } from "../../systems/prestige.js";
import { renderSlotRing } from "../../ui/slotRing.js";

const NODE_ID = "DCC01";
const MAP_SIZE = 7;
const FLOOR_ROOMS = 18;
const ROOM_WIDTH = 13;
const ROOM_HEIGHT = 9;
const ENEMY_ACTION_INTERVAL_MS = 1000;

function safeText(value) {
  return String(value || "").trim();
}

const DIRECTIONS = Object.freeze({
  up: Object.freeze({ dx: 0, dy: -1, label: "North (W)", key: "w" }),
  down: Object.freeze({ dx: 0, dy: 1, label: "South (S)", key: "s" }),
  left: Object.freeze({ dx: -1, dy: 0, label: "West (A)", key: "a" }),
  right: Object.freeze({ dx: 1, dy: 0, label: "East (D)", key: "d" }),
});

const DIRECTION_BY_KEY = Object.freeze({
  w: "up",
  a: "left",
  s: "down",
  d: "right",
});

const OPPOSITE_DIRECTION = Object.freeze({
  up: "down",
  down: "up",
  left: "right",
  right: "left",
});

const ABILITIES = Object.freeze({
  basic: Object.freeze({
    id: "basic",
    label: "Basic Attack",
    staminaCost: 0,
    range: 1,
    multiplier: 1,
    bonusDamage: 2,
    detail: "Reliable melee strike.",
  }),
  pocket_sand: Object.freeze({
    id: "pocket_sand",
    label: "Pocket Sand",
    staminaCost: 2,
    range: 2,
    multiplier: 0.7,
    bonusDamage: 1,
    inflictBlind: true,
    detail: "Lower damage, blinds next enemy attack.",
  }),
  door_kick: Object.freeze({
    id: "door_kick",
    label: "Door Kicking",
    staminaCost: 3,
    range: 1,
    multiplier: 1.1,
    bonusDamage: 4,
    inflictStun: true,
    detail: "Heavy impact, stuns the enemy's next turn.",
  }),
  footwork: Object.freeze({
    id: "footwork",
    label: "Unreasonable Footwork",
    staminaCost: 2,
    range: 1,
    multiplier: 1.25,
    bonusDamage: 3,
    gainBlock: 3,
    detail: "Strong strike and brief guard.",
  }),
  threat_call: Object.freeze({
    id: "threat_call",
    label: "Threat Management",
    staminaCost: 2,
    range: 2,
    multiplier: 0.9,
    bonusDamage: 2,
    gainBlock: 5,
    detail: "Steady hit, raises temporary block.",
  }),
  sponsor_blast: Object.freeze({
    id: "sponsor_blast",
    label: "Sponsor Blast",
    staminaCost: 3,
    range: 3,
    multiplier: 1.45,
    bonusDamage: 5,
    detail: "Prestige technique with high burst.",
  }),
});

const ABILITY_BOOKS = Object.freeze([
  Object.freeze({
    itemId: "book_footwork",
    label: "Book of Unreasonable Footwork",
    abilityId: "footwork",
    rarity: "rare",
  }),
  Object.freeze({
    itemId: "book_pocket_sand",
    label: "Manual of Pocket Sand",
    abilityId: "pocket_sand",
    rarity: "common",
  }),
  Object.freeze({
    itemId: "book_door_kick",
    label: "Treatise on Door Kicking",
    abilityId: "door_kick",
    rarity: "rare",
  }),
  Object.freeze({
    itemId: "book_threat",
    label: "Pocket Guide to Threat Management",
    abilityId: "threat_call",
    rarity: "common",
  }),
]);

const KEY_DEFINITIONS = Object.freeze([
  Object.freeze({ itemId: "bronze_key", label: "Bronze Key" }),
  Object.freeze({ itemId: "silver_key", label: "Silver Key" }),
  Object.freeze({ itemId: "obsidian_key", label: "Obsidian Key" }),
]);

const KEY_LABEL_BY_ID = Object.freeze(
  Object.fromEntries(KEY_DEFINITIONS.map((entry) => [entry.itemId, entry.label])),
);

const LOOT_TABLE = Object.freeze([
  Object.freeze({ type: "consumable", itemId: "health_potion", label: "Health Potion", weight: 32, rarity: "common" }),
  Object.freeze({ type: "consumable", itemId: "stamina_potion", label: "Stamina Potion", weight: 28, rarity: "common" }),
  Object.freeze({ type: "key", itemId: "bronze_key", label: "Bronze Key", weight: 11, rarity: "uncommon" }),
  Object.freeze({ type: "key", itemId: "silver_key", label: "Silver Key", weight: 7, rarity: "uncommon" }),
  Object.freeze({ type: "key", itemId: "obsidian_key", label: "Obsidian Key", weight: 4, rarity: "rare" }),
  Object.freeze({ type: "utility", itemId: "floor_map", label: "Floor Map", weight: 7, rarity: "uncommon" }),
  ...ABILITY_BOOKS.map((book) => Object.freeze({
    type: "book",
    itemId: book.itemId,
    label: book.label,
    weight: book.rarity === "rare" ? 5 : 10,
    rarity: book.rarity,
    abilityId: book.abilityId,
  })),
]);

const MINOR_ENEMIES = Object.freeze([
  Object.freeze({ name: "Babababoon", hp: 24, attack: 6, range: 1, trait: "dodge_after_move", goldMin: 8, goldMax: 14 }),
  Object.freeze({ name: "Bad Llama", hp: 28, attack: 5, range: 1, trait: "slow_strike", goldMin: 8, goldMax: 12 }),
  Object.freeze({ name: "Blender Fiend", hp: 22, attack: 7, range: 1, trait: "thief_lunge", goldMin: 10, goldMax: 15 }),
  Object.freeze({ name: "Blister Ghoul", hp: 26, attack: 6, range: 1, trait: "armor_bite", goldMin: 9, goldMax: 14 }),
  Object.freeze({ name: "Blood and Ink Elemental", hp: 30, attack: 6, range: 2, trait: "self_patch", goldMin: 10, goldMax: 16 }),
  Object.freeze({ name: "Brain Boiler", hp: 24, attack: 7, range: 2, trait: "opening_strike", goldMin: 10, goldMax: 16 }),
  Object.freeze({ name: "Razor Fox", hp: 34, attack: 7, range: 1, trait: "corridor_power", goldMin: 12, goldMax: 18 }),
  Object.freeze({ name: "Reaper Spider Minion", hp: 27, attack: 7, range: 1, trait: "bleed_bite", goldMin: 10, goldMax: 16 }),
  Object.freeze({ name: "Shock Chomper", hp: 23, attack: 8, range: 1, trait: "ambush", goldMin: 11, goldMax: 17 }),
  Object.freeze({ name: "Sluggalo", hp: 31, attack: 6, range: 3, trait: "leech_hit", goldMin: 11, goldMax: 17 }),
]);

const BOSS_ENEMIES = Object.freeze([
  Object.freeze({ name: "Krakaren Clone", hp: 92, attack: 12, range: 2, trait: "swarm_summoner", goldMin: 72, goldMax: 98 }),
  Object.freeze({ name: "Rage Elemental", hp: 84, attack: 10, range: 3, trait: "silence_pulse", goldMin: 70, goldMax: 94 }),
  Object.freeze({ name: "Mongoliensis", hp: 108, attack: 11, range: 1, trait: "door_lockdown", goldMin: 78, goldMax: 102 }),
]);

const ENCOUNTERS = Object.freeze([
  Object.freeze({
    id: "mimic_crate",
    title: "Mimic Crate",
    text: "A crate rattles in a quiet corner and smells like a trap.",
    options: Object.freeze([
      Object.freeze({ id: "careful", label: "Open carefully", effect: "loot" }),
      Object.freeze({ id: "smash", label: "Smash it", effect: "fight_mimic" }),
      Object.freeze({ id: "ignore", label: "Ignore it", effect: "leave" }),
    ]),
  }),
  Object.freeze({
    id: "sponsor_kiosk",
    title: "Sponsor Kiosk",
    text: "A cracked kiosk offers supplies for cash and insults for free.",
    options: Object.freeze([
      Object.freeze({ id: "buy", label: "Pay 12 gold for supplies", effect: "buy_supply" }),
      Object.freeze({ id: "taunt", label: "Taunt the kiosk", effect: "ambush" }),
      Object.freeze({ id: "move", label: "Move on", effect: "leave" }),
    ]),
  }),
  Object.freeze({
    id: "warden_post",
    title: "Warden Post",
    text: "A stair warden patrols a locked rack of keys.",
    options: Object.freeze([
      Object.freeze({ id: "sneak", label: "Sneak a key", effect: "steal_key" }),
      Object.freeze({ id: "duel", label: "Challenge the warden", effect: "fight_warden" }),
      Object.freeze({ id: "retreat", label: "Retreat quietly", effect: "leave" }),
    ]),
  }),
]);

const ENCOUNTER_BY_ID = Object.freeze(Object.fromEntries(ENCOUNTERS.map((entry) => [entry.id, entry])));

function roomKey(x, y) {
  return `${x},${y}`;
}

function parseRoomKey(key) {
  const [x, y] = String(key || "0,0").split(",").map((value) => Number(value));
  return {
    x: Number.isFinite(x) ? x : 0,
    y: Number.isFinite(y) ? y : 0,
  };
}

function createRng(seed) {
  let state = (Number(seed) || 1) >>> 0;
  if (!state) {
    state = 1;
  }
  return () => {
    state = Math.imul(state, 1664525) + 1013904223;
    state >>>= 0;
    return state / 4294967296;
  };
}

function randomInt(rand, min, max) {
  const low = Math.floor(Math.min(min, max));
  const high = Math.floor(Math.max(min, max));
  const span = high - low + 1;
  return low + Math.floor(rand() * Math.max(1, span));
}

function randomPick(rand, values) {
  const list = Array.isArray(values) ? values : [];
  if (!list.length) {
    return null;
  }
  return list[randomInt(rand, 0, list.length - 1)];
}

function withDefaultMeta(meta) {
  const source = meta && typeof meta === "object" ? meta : {};
  const upgrades = source.upgrades && typeof source.upgrades === "object" ? source.upgrades : {};
  const preparedEquipment = normalizeEquipment(source.preparedEquipment);
  return {
    gold: Math.max(0, Math.floor(Number(source.gold) || 0)),
    upgrades: {
      hp: Math.max(0, Math.floor(Number(upgrades.hp) || 0)),
      attack: Math.max(0, Math.floor(Number(upgrades.attack) || 0)),
      stamina: Math.max(0, Math.floor(Number(upgrades.stamina) || 0)),
      rare: Math.max(0, Math.floor(Number(upgrades.rare) || 0)),
      slots: Math.max(0, Math.floor(Number(upgrades.slots) || 0)),
    },
    totalRuns: Math.max(0, Math.floor(Number(source.totalRuns) || 0)),
    totalDeaths: Math.max(0, Math.floor(Number(source.totalDeaths) || 0)),
    bestFloor: Math.max(1, Math.floor(Number(source.bestFloor) || 1)),
    preparedEquipment,
  };
}

function dccModifiers(state) {
  const modifiers = prestigeModifiersFromState(state || {});
  const source = modifiers && modifiers.dcc && typeof modifiers.dcc === "object" ? modifiers.dcc : {};
  return {
    maxHpBonus: Math.max(0, Number(source.maxHpBonus) || 0),
    attackBonus: Math.max(0, Number(source.attackBonus) || 0),
    goldGainBonus: Math.max(0, Number(source.goldGainBonus) || 0),
    rareDropBonus: Math.max(0, Number(source.rareDropBonus) || 0),
    startWithSponsorSkill: Boolean(source.startWithSponsorSkill),
    extraAbilitySlots: Math.max(0, Number(source.extraAbilitySlots) || 0),
  };
}

function dccProgressFromState(state) {
  const source =
    state && state.systems && state.systems.dungeonCrawl && typeof state.systems.dungeonCrawl === "object"
      ? state.systems.dungeonCrawl
      : {};
  return {
    floor3Unlocked: Boolean(source.floor3Unlocked),
    checkpointFloor: Math.max(1, Math.floor(Number(source.checkpointFloor) || 1)),
  };
}

function deriveBaseStats(meta, modifiers) {
  const slotCount = Math.max(2, 2 + meta.upgrades.slots + modifiers.extraAbilitySlots);
  return {
    maxHp: 70 + (meta.upgrades.hp * 12) + modifiers.maxHpBonus,
    attack: 8 + (meta.upgrades.attack * 2) + modifiers.attackBonus,
    maxStamina: 6 + (meta.upgrades.stamina * 2),
    slotCount,
    rareBonus: Math.min(0.45, (meta.upgrades.rare * 0.05) + modifiers.rareDropBonus),
    goldMultiplier: 1 + modifiers.goldGainBonus,
  };
}

function equipmentDefaults() {
  return {
    head: null,
    chest: null,
    legs: null,
    trinket: null,
  };
}

function normalizeEquipment(candidate) {
  const source = candidate && typeof candidate === "object" ? candidate : {};
  const base = equipmentDefaults();
  for (const slot of Object.keys(base)) {
    const entry = source[slot];
    base[slot] = entry && typeof entry === "object" ? entry : null;
  }
  return base;
}

function equippedBonuses(run) {
  const equipment = normalizeEquipment(run && run.equipment);
  const result = {
    hp: 0,
    attack: 0,
    stamina: 0,
  };
  for (const item of Object.values(equipment)) {
    if (!item) {
      continue;
    }
    result.hp += Math.max(0, Math.floor(Number(item.hpBonus || 0)));
    result.attack += Math.max(0, Math.floor(Number(item.attackBonus || 0)));
    result.stamina += Math.max(0, Math.floor(Number(item.staminaBonus || 0)));
  }
  return result;
}

function applyEquipmentToRun(run) {
  if (!run) {
    return;
  }
  const bonuses = equippedBonuses(run);
  const baseMaxHp = Math.max(1, Number(run.baseMaxHp || run.maxHp || 1));
  const baseAttack = Math.max(1, Number(run.baseAttack || run.attack || 1));
  const baseMaxStamina = Math.max(1, Number(run.baseMaxStamina || run.maxStamina || 1));
  run.maxHp = baseMaxHp + bonuses.hp;
  run.attack = baseAttack + bonuses.attack;
  run.maxStamina = baseMaxStamina + bonuses.stamina;
  run.hp = Math.min(run.maxHp, Math.max(0, Number(run.hp || 0)));
  run.stamina = Math.min(run.maxStamina, Math.max(0, Number(run.stamina || 0)));
}

function collectNeighbors(openRooms, key) {
  const from = parseRoomKey(key);
  const result = [];
  for (const [direction, vector] of Object.entries(DIRECTIONS)) {
    const targetX = from.x + vector.dx;
    const targetY = from.y + vector.dy;
    if (targetX < 0 || targetX >= MAP_SIZE || targetY < 0 || targetY >= MAP_SIZE) {
      continue;
    }
    const targetKey = roomKey(targetX, targetY);
    if (openRooms.has(targetKey)) {
      result.push({ direction, targetKey });
    }
  }
  return result;
}

function farthestRooms(startKey, roomKeys) {
  const start = parseRoomKey(startKey);
  return [...roomKeys].sort((a, b) => {
    const pa = parseRoomKey(a);
    const pb = parseRoomKey(b);
    const da = Math.abs(pa.x - start.x) + Math.abs(pa.y - start.y);
    const db = Math.abs(pb.x - start.x) + Math.abs(pb.y - start.y);
    return db - da;
  });
}

function chooseLootDrop(rand, rareBonus) {
  const entries = LOOT_TABLE.map((entry) => {
    let weight = Number(entry.weight) || 1;
    if (entry.rarity === "rare") {
      weight *= 1 + (rareBonus * 4.2);
    } else if (entry.rarity === "common") {
      weight *= Math.max(0.55, 1 - (rareBonus * 0.35));
    }
    return {
      ...entry,
      adjustedWeight: Math.max(0.1, weight),
    };
  });

  const total = entries.reduce((sum, entry) => sum + entry.adjustedWeight, 0);
  let cursor = rand() * Math.max(0.1, total);
  for (const entry of entries) {
    cursor -= entry.adjustedWeight;
    if (cursor <= 0) {
      return {
        id: `${entry.itemId}-${Date.now()}-${Math.floor(rand() * 10000)}`,
        type: entry.type,
        itemId: entry.itemId,
        label: entry.label,
        abilityId: entry.abilityId || "",
      };
    }
  }
  const fallback = entries[0];
  return {
    id: `${fallback.itemId}-${Date.now()}-fallback`,
    type: fallback.type,
    itemId: fallback.itemId,
    label: fallback.label,
    abilityId: fallback.abilityId || "",
  };
}

function generateFloorMap(seed, floor) {
  const rand = createRng(seed + floor * 101);
  const center = roomKey(Math.floor(MAP_SIZE / 2), Math.floor(MAP_SIZE / 2));
  const openRooms = new Set([center]);
  let current = center;

  while (openRooms.size < FLOOR_ROOMS) {
    const neighbors = collectNeighbors(new Set(
      Array.from({ length: MAP_SIZE * MAP_SIZE }, (_, index) => {
        const x = index % MAP_SIZE;
        const y = Math.floor(index / MAP_SIZE);
        return roomKey(x, y);
      }),
    ), current).map((entry) => entry.targetKey);
    current = randomPick(rand, neighbors) || center;
    openRooms.add(current);
  }

  const ranked = farthestRooms(center, openRooms);
  const bossRoomId = ranked[0] || center;
  const stairsRoomId = ranked.find((key) => key !== bossRoomId) || center;
  const specialExcluded = new Set([center, bossRoomId, stairsRoomId]);

  const candidateRooms = ranked.filter((key) => !specialExcluded.has(key));
  const shopRoomId = randomPick(rand, candidateRooms) || "";
  const remainingCandidates = candidateRooms.filter((key) => key !== shopRoomId);
  const lootRooms = new Set(remainingCandidates.slice(0, 3));
  const encounterRooms = new Set(remainingCandidates.slice(3, 7));

  const rooms = {};
  for (const key of openRooms) {
    const position = parseRoomKey(key);
    const neighbors = collectNeighbors(openRooms, key);
    let type = "monster";
    if (key === center) {
      type = "start";
    } else if (key === bossRoomId) {
      type = "boss";
    } else if (key === stairsRoomId) {
      type = "stairs";
    } else if (key === shopRoomId) {
      type = "shop";
    } else if (lootRooms.has(key)) {
      type = "loot";
    } else if (encounterRooms.has(key)) {
      type = "encounter";
    }

    rooms[key] = {
      id: key,
      x: position.x,
      y: position.y,
      type,
      discovered: key === center,
      visited: key === center,
      cleared: key === center,
      rested: false,
      encounterId: type === "encounter" ? (randomPick(rand, ENCOUNTERS) || ENCOUNTERS[0]).id : "",
      doors: Object.fromEntries(
        neighbors.map((entry) => [
          entry.direction,
          {
            to: entry.targetKey,
            lockId: [key, entry.targetKey].sort().join("|"),
          },
        ]),
      ),
    };
  }

  const lockState = {};
  for (const room of Object.values(rooms)) {
    for (const door of Object.values(room.doors || {})) {
      if (!door || !door.lockId || lockState[door.lockId]) {
        continue;
      }
      const shouldLock = rand() < 0.16 && door.to !== center && room.id !== center;
      lockState[door.lockId] = {
        locked: shouldLock,
        opened: !shouldLock,
        keyType: shouldLock ? (randomPick(rand, KEY_DEFINITIONS) || KEY_DEFINITIONS[0]).itemId : "",
      };
    }
  }

  // Guarantee floor completion: keep at least one unlocked route from start to boss.
  const queue = [center];
  const visited = new Set([center]);
  const parentByRoom = {};
  while (queue.length) {
    const roomId = queue.shift();
    if (roomId === bossRoomId) {
      break;
    }
    const room = rooms[roomId];
    const doors = room && room.doors && typeof room.doors === "object" ? room.doors : {};
    for (const door of Object.values(doors)) {
      if (!door || !door.to || visited.has(door.to)) {
        continue;
      }
      visited.add(door.to);
      parentByRoom[door.to] = roomId;
      queue.push(door.to);
    }
  }

  if (visited.has(bossRoomId)) {
    const path = [];
    let cursor = bossRoomId;
    while (cursor) {
      path.push(cursor);
      if (cursor === center) {
        break;
      }
      cursor = parentByRoom[cursor] || "";
    }
    path.reverse();
    for (let index = 0; index < path.length - 1; index += 1) {
      const from = path[index];
      const to = path[index + 1];
      const lockId = [from, to].sort().join("|");
      if (!lockState[lockId]) {
        continue;
      }
      lockState[lockId].locked = false;
      lockState[lockId].opened = true;
      lockState[lockId].keyType = "";
    }
  }

  return {
    floor,
    size: MAP_SIZE,
    startRoomId: center,
    bossRoomId,
    stairsRoomId,
    rooms,
    lockState,
  };
}

function normalizeRuntime(candidate) {
  const source = candidate && typeof candidate === "object" ? candidate : {};
  return {
    solved: Boolean(source.solved),
    inventoryOpen: Boolean(source.inventoryOpen),
    lootEvents: Array.isArray(source.lootEvents) ? source.lootEvents.filter((entry) => entry && typeof entry === "object") : [],
    meta: withDefaultMeta(source.meta),
    run: source.run && typeof source.run === "object" ? source.run : null,
    lastMessage: String(source.lastMessage || ""),
    selectedLootItemId: String(source.selectedLootItemId || ""),
  };
}

function createInitialRuntime() {
  return {
    solved: false,
    inventoryOpen: false,
    lootEvents: [],
    meta: withDefaultMeta({}),
    run: null,
    lastMessage: "Welcome to Floor 1. Build a run and survive the crawl.",
  };
}

function withLootEventsFromBagGrowth(previousRuntime, nextRuntime, actionType) {
  const before = previousRuntime && previousRuntime.run && Array.isArray(previousRuntime.run.bag)
    ? previousRuntime.run.bag.length
    : 0;
  const after = nextRuntime && nextRuntime.run && Array.isArray(nextRuntime.run.bag)
    ? nextRuntime.run.bag.length
    : 0;
  const growth = Math.max(0, after - before);
  if (!growth) {
    return {
      ...nextRuntime,
      lootEvents: [],
    };
  }

  const eligible = new Set(["dcc-combat-use", "dcc-encounter-option", "dcc-move", "dcc-descend"]);
  if (!eligible.has(String(actionType || ""))) {
    return {
      ...nextRuntime,
      lootEvents: [],
    };
  }

  const run = nextRuntime && nextRuntime.run && typeof nextRuntime.run === "object" ? nextRuntime.run : {};
  const rarityBias = Math.max(0, Number(run.rareBonus || 0));
  const events = Array.from({ length: growth }, () => ({
    sourceRegion: "dcc",
    triggerType: "crawl-drop",
    dropChance: 0.35,
    outRegionChance: 0.2,
    rarityBias,
  }));

  return {
    ...nextRuntime,
    lootEvents: events,
  };
}

function cloneRun(run) {
  return JSON.parse(JSON.stringify(run));
}

function currentRoom(run) {
  return run && run.map && run.map.rooms ? run.map.rooms[run.currentRoomId] || null : null;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function manhattanDistance(ax, ay, bx, by) {
  return Math.abs(ax - bx) + Math.abs(ay - by);
}

function hashText(value) {
  const text = String(value || "");
  let hash = 2166136261 >>> 0;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function doorTileForDirection(direction) {
  const midX = Math.floor(ROOM_WIDTH / 2);
  const midY = Math.floor(ROOM_HEIGHT / 2);
  if (direction === "up") {
    return { x: midX, y: 0 };
  }
  if (direction === "down") {
    return { x: midX, y: ROOM_HEIGHT - 1 };
  }
  if (direction === "left") {
    return { x: 0, y: midY };
  }
  return { x: ROOM_WIDTH - 1, y: midY };
}

function randomRoomPoint(rand, blocked = new Set()) {
  for (let attempt = 0; attempt < 90; attempt += 1) {
    const x = randomInt(rand, 1, ROOM_WIDTH - 2);
    const y = randomInt(rand, 1, ROOM_HEIGHT - 2);
    const key = roomKey(x, y);
    if (!blocked.has(key)) {
      return { x, y };
    }
  }
  return { x: Math.floor(ROOM_WIDTH / 2), y: Math.floor(ROOM_HEIGHT / 2) };
}

function buildRoomState(run, room, entryDoorDirection = "") {
  const state = {
    width: ROOM_WIDTH,
    height: ROOM_HEIGHT,
    player: {
      x: Math.floor(ROOM_WIDTH / 2),
      y: Math.floor(ROOM_HEIGHT / 2),
    },
    doors: [],
    chest: null,
    encounterMarker: null,
    shop: null,
    stairs: null,
  };
  if (!room) {
    return state;
  }

  const rand = createRng((Number(run.seed) || 1) + hashText(room.id) + (run.floor * 131));
  state.doors = Object.entries(room.doors || {}).map(([direction, door]) => {
    const tile = doorTileForDirection(direction);
    return {
      direction,
      to: door.to,
      lockId: door.lockId,
      x: tile.x,
      y: tile.y,
    };
  });

  const spawnDoor =
    state.doors.find((door) => door.direction === String(entryDoorDirection || "")) ||
    (!entryDoorDirection && state.doors.length ? state.doors[0] : null);
  if (spawnDoor) {
    state.player.x = spawnDoor.x;
    state.player.y = spawnDoor.y;
  }

  const blocked = new Set(state.doors.map((door) => roomKey(door.x, door.y)));
  blocked.add(roomKey(state.player.x, state.player.y));

  if (room.type === "loot" && !room.cleared) {
    state.chest = randomRoomPoint(rand, blocked);
    blocked.add(roomKey(state.chest.x, state.chest.y));
  }

  if (room.type === "encounter" && !room.cleared) {
    state.encounterMarker = randomRoomPoint(rand, blocked);
    blocked.add(roomKey(state.encounterMarker.x, state.encounterMarker.y));
  }

  if (room.type === "shop") {
    state.shop = randomRoomPoint(rand, blocked);
    blocked.add(roomKey(state.shop.x, state.shop.y));
  }

  if (room.type === "stairs") {
    state.stairs = randomRoomPoint(rand, blocked);
  }

  return state;
}

function makeEnemy(rand, roomType) {
  const template = roomType === "boss"
    ? (randomPick(rand, BOSS_ENEMIES) || BOSS_ENEMIES[0])
    : (randomPick(rand, MINOR_ENEMIES) || MINOR_ENEMIES[0]);
  return {
    name: template.name,
    trait: template.trait,
    maxHp: template.hp,
    hp: template.hp,
    attack: template.attack,
    range: Math.max(1, Number(template.range) || 1),
    goldMin: template.goldMin,
    goldMax: template.goldMax,
    acted: 0,
    blinded: false,
    stunned: false,
    swarm: 0,
    lockdownTriggered: false,
    x: 1,
    y: 1,
  };
}

function startCombat(run, roomType, seedOffset = 0) {
  const roomState = run.roomState || buildRoomState(run, currentRoom(run));
  const blocked = new Set([roomKey(roomState.player.x, roomState.player.y)]);
  const rand = createRng(Date.now() + seedOffset + run.floor * 31 + hashText(run.currentRoomId));
  const enemy = makeEnemy(rand, roomType);
  const spawn = randomRoomPoint(rand, blocked);
  enemy.x = spawn.x;
  enemy.y = spawn.y;
  run.combat = {
    enemy,
    round: 1,
    block: 0,
    silenced: false,
  };
  run.nextEnemyActAt = Date.now() + ENEMY_ACTION_INTERVAL_MS;
}

function ensureRunActionable(run) {
  if (!run) {
    return false;
  }
  return true;
}

function startFloor(runtime, state, floor = 1) {
  const modifiers = dccModifiers(state);
  const stats = deriveBaseStats(runtime.meta, modifiers);
  const seed = Date.now() + floor * 7919;
  const map = generateFloorMap(seed, floor);
  const slots = Array.from({ length: stats.slotCount }, () => "");
  if (modifiers.startWithSponsorSkill) {
    slots[0] = "sponsor_blast";
  }

  const run = {
    active: true,
    floor,
    seed,
    map,
    currentRoomId: map.startRoomId,
    hp: stats.maxHp,
    maxHp: stats.maxHp,
    stamina: stats.maxStamina,
    maxStamina: stats.maxStamina,
    attack: stats.attack,
    baseMaxHp: stats.maxHp,
    baseMaxStamina: stats.maxStamina,
    baseAttack: stats.attack,
    rareBonus: stats.rareBonus,
    goldMultiplier: stats.goldMultiplier,
    bag: [],
    hasFloorMap: false,
    abilitySlots: slots,
    combat: null,
    event: null,
    equipment: normalizeEquipment(runtime && runtime.meta ? runtime.meta.preparedEquipment : null),
    roomState: null,
    nextEnemyActAt: 0,
    bossDefeated: false,
    log: [`Floor ${floor} opens. Keep moving.`],
  };
  applyEquipmentToRun(run);
  return run;
}

function addLog(run, line) {
  run.log = [String(line || ""), ...(Array.isArray(run.log) ? run.log : [])].slice(0, 20);
}

const NOTIFICATION_CHARS_PER_LINE = 34;
const NOTIFICATION_MAX_LINES = 11;

function estimatedNotificationLines(message) {
  const text = String(message || "");
  if (!text) {
    return 1;
  }
  const hardLines = text.split(/\r?\n/);
  return hardLines.reduce((sum, line) => {
    const length = Math.max(1, line.length);
    return sum + Math.max(1, Math.ceil(length / NOTIFICATION_CHARS_PER_LINE));
  }, 0);
}

function notificationsFit(entries) {
  const list = Array.isArray(entries) ? entries : [];
  let usedLines = 0;
  for (const entry of list) {
    const lines = estimatedNotificationLines(entry);
    usedLines += lines;
    if (usedLines > NOTIFICATION_MAX_LINES) {
      return false;
    }
  }
  return true;
}

function visibleNotifications(logEntries) {
  const source = Array.isArray(logEntries) ? logEntries : [];
  let count = source.length;
  while (count > 0) {
    const candidate = source.slice(0, count);
    if (notificationsFit(candidate)) {
      return candidate;
    }
    count -= 1;
  }
  return [];
}

function startEncounter(run, encounterId) {
  const entry = ENCOUNTER_BY_ID[encounterId] || ENCOUNTERS[0];
  run.event = {
    id: entry.id,
    title: entry.title,
    text: entry.text,
    options: entry.options.map((option) => ({ ...option })),
  };
}

function shopValueForItem(item) {
  if (!item || typeof item !== "object") {
    return 1;
  }
  if (item.type === "consumable") {
    return 2;
  }
  if (item.type === "key") {
    if (item.itemId === "obsidian_key") {
      return 8;
    }
    if (item.itemId === "silver_key") {
      return 5;
    }
    return 3;
  }
  if (item.type === "book") {
    return 7;
  }
  if (item.type === "utility") {
    return 4;
  }
  return 2;
}

function startShopEvent(run) {
  const bag = Array.isArray(run && run.bag) ? run.bag : [];
  const sellOptions = bag.slice(0, 12).map((item, index) => {
    const value = shopValueForItem(item);
    return {
      id: `sell-${index}`,
      label: `Sell ${item.label} (+${value} gold)`,
      effect: "sell",
      itemIndex: index,
      gold: value,
    };
  });
  run.event = {
    id: "shop",
    mode: "shop",
    title: "Pop-Up Bazaar",
    text: "A vendor appears between floors, buying almost anything at a bad rate.",
    options: [
      ...sellOptions,
      {
        id: "leave-shop",
        label: "Leave shop",
        effect: "leave-shop",
      },
    ],
  };
}

function enterRoom(run, roomId, entryDoorDirection = "") {
  run.currentRoomId = roomId;
  const room = currentRoom(run);
  if (!room) {
    return;
  }
  room.discovered = true;
  room.visited = true;
  run.event = null;
  run.combat = null;
  run.roomState = buildRoomState(run, room, entryDoorDirection);
  run.nextEnemyActAt = 0;

  if (room.type === "monster" || room.type === "boss") {
    if (!room.cleared) {
      startCombat(run, room.type, room.x + room.y);
      addLog(run, `Encountered ${room.type === "boss" ? "a boss" : "a monster"} in room ${room.id}.`);
    }
    return;
  }

  if (room.type === "encounter") {
    addLog(run, "You hear the scrape of scripted danger.");
  }
  if (room.type === "loot" && !room.cleared) {
    addLog(run, "A chest sits in the room. Step onto it to open.");
  }
  if (room.type === "stairs") {
    if (run.bossDefeated) {
      addLog(run, "The stairs are active. Step onto them to descend.");
    } else {
      addLog(run, "Stairs are present, but sealed by the floor boss.");
    }
  } else if (room.type === "shop") {
    addLog(run, "A pop-up bazaar has appeared in this room.");
  }
}

function roomStateFromRun(run) {
  const roomState = run && run.roomState && typeof run.roomState === "object" ? run.roomState : null;
  if (!roomState) {
    return null;
  }
  if (!roomState.player || typeof roomState.player !== "object") {
    return null;
  }
  return roomState;
}

function resolveDeath(runtime) {
  runtime.meta.totalDeaths += 1;
  runtime.run = null;
  runtime.inventoryOpen = false;
  return "You died. Loot and learned abilities were lost, but your gold remains.";
}

function resolveRoomVictory(runtime, run) {
  const room = currentRoom(run);
  if (!room) {
    return;
  }
  const enemy = run.combat && run.combat.enemy ? { ...run.combat.enemy } : null;
  room.cleared = true;
  if (room.type === "boss") {
    run.bossDefeated = true;
  }
  run.combat = null;
  run.nextEnemyActAt = 0;
  const rand = createRng(Date.now() + run.floor * 313);
  const goldLow = Math.max(8, Number(enemy && enemy.goldMin ? enemy.goldMin : 10));
  const goldHigh = Math.max(goldLow, Number(enemy && enemy.goldMax ? enemy.goldMax : 18));
  const bossBoost = room.type === "boss" ? 1.35 : 1;
  const goldGain = Math.max(
    1,
    Math.round(randomInt(rand, goldLow, goldHigh) * bossBoost * run.goldMultiplier),
  );
  runtime.meta.gold += goldGain;
  addLog(run, `Victory. +${goldGain} gold.`);

  const dropCount = room.type === "boss" ? 3 : 1;
  const bossRareBonus = room.type === "boss" ? 0.25 : 0;
  for (let index = 0; index < dropCount; index += 1) {
    if (rand() < (room.type === "boss" ? 1 : 0.62)) {
      const item = chooseLootDrop(rand, run.rareBonus + bossRareBonus);
      run.bag.push(item);
      addLog(run, `Loot drop: ${item.label}.`);
    }
  }
}

function enemyMoveTowardPlayer(run, rand) {
  if (!run || !run.combat || !run.combat.enemy) {
    return;
  }
  const enemy = run.combat.enemy;
  const roomState = roomStateFromRun(run);
  if (!roomState) {
    return;
  }
  const player = roomState.player;
  const dx = player.x - enemy.x;
  const dy = player.y - enemy.y;
  const moveXFirst = Math.abs(dx) >= Math.abs(dy) ? true : rand() < 0.5;
  const stepAxis = (axis) => {
    if (axis === "x" && dx !== 0) {
      enemy.x = clamp(enemy.x + (dx > 0 ? 1 : -1), 1, ROOM_WIDTH - 2);
      return true;
    }
    if (axis === "y" && dy !== 0) {
      enemy.y = clamp(enemy.y + (dy > 0 ? 1 : -1), 1, ROOM_HEIGHT - 2);
      return true;
    }
    return false;
  };
  if (moveXFirst) {
    if (!stepAxis("x")) {
      stepAxis("y");
    }
  } else if (!stepAxis("y")) {
    stepAxis("x");
  }
}

function enemyAct(runtime, now) {
  const run = runtime.run;
  if (!run || !run.combat || !run.combat.enemy) {
    return "";
  }

  const combat = run.combat;
  const enemy = combat.enemy;
  const roomState = roomStateFromRun(run);
  if (!roomState) {
    return "";
  }
  const player = roomState.player;
  const rand = createRng((Number(now) || Date.now()) + run.floor * 137 + enemy.acted * 31);

  if (enemy.stunned) {
    enemy.stunned = false;
    enemy.acted += 1;
    return "";
  }

  if (enemy.trait === "self_patch" && enemy.hp < enemy.maxHp && rand() < 0.2) {
    const heal = randomInt(rand, 2, 6);
    enemy.hp = Math.min(enemy.maxHp, enemy.hp + heal);
  }

  if (enemy.trait === "swarm_summoner" && enemy.acted > 0 && enemy.acted % 3 === 0) {
    enemy.swarm = Math.min(4, (Number(enemy.swarm) || 0) + 1);
    addLog(run, `${enemy.name} summons reinforcements (${enemy.swarm}).`);
  }

  if (enemy.trait === "door_lockdown" && !enemy.lockdownTriggered && enemy.acted >= 1) {
    const room = currentRoom(run);
    const doorIds = room && room.doors ? Object.values(room.doors).map((door) => door.lockId) : [];
    const candidates = doorIds.filter((lockId) => {
      const lock = run.map && run.map.lockState ? run.map.lockState[lockId] : null;
      return lock && !lock.opened;
    });
    const picked = randomPick(rand, candidates);
    if (picked && run.map && run.map.lockState && run.map.lockState[picked]) {
      run.map.lockState[picked].locked = true;
      if (!run.map.lockState[picked].keyType) {
        run.map.lockState[picked].keyType = (randomPick(rand, KEY_DEFINITIONS) || KEY_DEFINITIONS[0]).itemId;
      }
      enemy.lockdownTriggered = true;
      addLog(run, `${enemy.name} hardens the room locks.`);
    }
  }

  const distance = manhattanDistance(player.x, player.y, enemy.x, enemy.y);
  const effectiveRange = Math.max(1, Number(enemy.range) || 1);
  if (distance > effectiveRange) {
    enemyMoveTowardPlayer(run, rand);
    if (enemy.trait === "thief_lunge" && distance > 2 && rand() < 0.4) {
      enemyMoveTowardPlayer(run, rand);
    }
    enemy.acted += 1;
    return "";
  }

  if (enemy.blinded) {
    enemy.blinded = false;
    if (rand() < 0.75) {
      enemy.acted += 1;
      return "";
    }
  }

  let base = enemy.attack + randomInt(rand, 0, 3);
  if (enemy.trait === "opening_strike" && enemy.acted === 0) {
    base += 4;
  }
  if (enemy.trait === "corridor_power") {
    base += 1;
  }
  if (enemy.trait === "armor_bite" && rand() < 0.4) {
    base += 2;
  }
  if (enemy.trait === "bleed_bite" && rand() < 0.35) {
    base += 2;
  }
  if (enemy.trait === "ambush" && enemy.acted === 0) {
    base += 3;
  }
  if (enemy.trait === "swarm_summoner") {
    base += Number(enemy.swarm) || 0;
  }
  if (enemy.trait === "silence_pulse" && rand() < 0.25) {
    combat.silenced = true;
  }

  enemy.acted += 1;
  const blocked = Math.min(base, Math.max(0, Number(combat.block) || 0));
  combat.block = Math.max(0, (Number(combat.block) || 0) - blocked);
  const damage = Math.max(0, base - blocked);
  run.hp = Math.max(0, run.hp - damage);

  if (enemy.trait === "leech_hit" && damage > 0 && rand() < 0.3) {
    enemy.hp = Math.min(enemy.maxHp, enemy.hp + Math.max(1, Math.floor(damage / 2)));
  }

  if (run.hp <= 0) {
    return resolveDeath(runtime);
  }
  return "";
}

function runEnemyTimeline(runtime, now, forceSingle = false) {
  const run = runtime.run;
  if (!run || !run.combat) {
    return "";
  }

  if (!run.nextEnemyActAt || !Number.isFinite(Number(run.nextEnemyActAt))) {
    run.nextEnemyActAt = now + ENEMY_ACTION_INTERVAL_MS;
  }

  const actionLimit = forceSingle ? 1 : 5;
  let message = "";
  let count = 0;
  while (runtime.run && runtime.run.combat && count < actionLimit) {
    if (!forceSingle && now < run.nextEnemyActAt) {
      break;
    }
    message = enemyAct(runtime, now) || message;
    if (!runtime.run || !runtime.run.combat) {
      break;
    }
    run.nextEnemyActAt = (forceSingle ? now : run.nextEnemyActAt) + ENEMY_ACTION_INTERVAL_MS;
    count += 1;
    if (forceSingle) {
      break;
    }
  }
  return message;
}

function useItemInRun(run, itemIndex) {
  const bag = Array.isArray(run.bag) ? run.bag : [];
  const index = Math.floor(Number(itemIndex));
  if (!Number.isInteger(index) || index < 0 || index >= bag.length) {
    return "Invalid item selection.";
  }
  const item = bag[index];
  if (!item) {
    return "Item not found.";
  }
  if (item.type === "consumable" && item.itemId === "health_potion") {
    run.hp = Math.min(run.maxHp, run.hp + 28);
    bag.splice(index, 1);
    return "Health restored.";
  }
  if (item.type === "consumable" && item.itemId === "stamina_potion") {
    run.stamina = Math.min(run.maxStamina, run.stamina + 4);
    bag.splice(index, 1);
    return "Stamina restored.";
  }
  if (item.type === "key") {
    return "Keys are used automatically on matching locks.";
  }
  if (item.type === "book") {
    return "Choose an ability slot to learn this book.";
  }
  if (item.type === "utility" && item.itemId === "floor_map") {
    run.hasFloorMap = true;
    bag.splice(index, 1);
    return "You can now read the floor map while this run lasts.";
  }
  return "Item has no usable effect.";
}

function consumeMatchingKeyFromBag(run, keyType) {
  const desired = String(keyType || "");
  if (!desired) {
    return false;
  }
  const bag = Array.isArray(run && run.bag) ? run.bag : [];
  const index = bag.findIndex((entry) => entry && entry.type === "key" && entry.itemId === desired);
  if (index < 0) {
    return false;
  }
  bag.splice(index, 1);
  return true;
}

function learnBook(run, itemIndex, slotIndex) {
  const bag = Array.isArray(run.bag) ? run.bag : [];
  const index = Math.floor(Number(itemIndex));
  if (!Number.isInteger(index) || index < 0 || index >= bag.length) {
    return "Invalid book selection.";
  }
  const item = bag[index];
  if (!item || item.type !== "book" || !ABILITIES[item.abilityId]) {
    return "Selected item is not a valid ability book.";
  }

  const slots = Array.isArray(run.abilitySlots) ? run.abilitySlots : [];
  let resolvedSlot = Math.floor(Number(slotIndex));
  if (!Number.isInteger(resolvedSlot) || resolvedSlot < 0 || resolvedSlot >= slots.length) {
    resolvedSlot = slots.findIndex((entry) => !entry);
  }
  if (resolvedSlot < 0 || resolvedSlot >= slots.length) {
    return "No empty ability slots.";
  }

  slots[resolvedSlot] = item.abilityId;
  bag.splice(index, 1);
  return `${ABILITIES[item.abilityId].label} learned in slot ${resolvedSlot + 1}.`;
}

function resolveCombatAction(runtime, abilityIndex) {
  const run = runtime.run;
  if (!run || !run.combat) {
    return "No active combat.";
  }
  const combat = run.combat;
  const enemy = combat.enemy;
  if (!enemy) {
    return "No enemy target.";
  }

  const index = Math.max(0, Math.floor(Number(abilityIndex) || 0));
  const abilityId = index === 0
    ? "basic"
    : Array.isArray(run.abilitySlots) && run.abilitySlots[index - 1]
      ? run.abilitySlots[index - 1]
      : "";
  if (!abilityId || !ABILITIES[abilityId]) {
    return "No ability bound to that slot.";
  }
  if (combat.silenced && abilityId !== "basic") {
    combat.silenced = false;
    return "Your technique fizzles under silence.";
  }

  const ability = ABILITIES[abilityId];
  if (run.stamina < ability.staminaCost) {
    return "Not enough stamina.";
  }
  const roomState = roomStateFromRun(run);
  if (!roomState) {
    return "Room state unavailable.";
  }
  const distance = manhattanDistance(
    roomState.player.x,
    roomState.player.y,
    enemy.x,
    enemy.y,
  );
  if (distance > (Number(ability.range) || 1)) {
    return `${enemy.name} is out of range.`;
  }
  run.stamina -= ability.staminaCost;

  const rand = createRng(Date.now() + run.floor * 147 + index * 17);
  if (!(enemy.trait === "dodge_after_move" && enemy.acted === 0 && rand() < 0.22)) {
    const damage = Math.max(1, Math.round((run.attack * ability.multiplier) + ability.bonusDamage + randomInt(rand, 0, 3)));
    enemy.hp = Math.max(0, enemy.hp - damage);
    if (ability.inflictBlind) {
      enemy.blinded = true;
    }
    if (ability.inflictStun) {
      enemy.stunned = true;
    }
    if (ability.gainBlock) {
      combat.block = Math.max(0, Number(combat.block) || 0) + ability.gainBlock;
    }
  }

  if (enemy.hp <= 0) {
    resolveRoomVictory(runtime, run);
    return "Enemy defeated.";
  }

  return runEnemyTimeline(runtime, Date.now(), true);
}

function resolveEncounter(runtime, optionId) {
  const run = runtime.run;
  if (!run || !run.event) {
    return "No active encounter.";
  }

  const event = run.event;
  if (event.mode === "shop") {
    if (optionId === "leave-shop") {
      run.event = null;
      addLog(run, "You leave the pop-up bazaar.");
      return "Shop closed.";
    }
    const sellOption = (event.options || []).find((entry) => entry.id === optionId && entry.effect === "sell");
    if (!sellOption) {
      return "Shop option unavailable.";
    }
    const bag = Array.isArray(run.bag) ? run.bag : [];
    const index = Math.floor(Number(sellOption.itemIndex));
    if (!Number.isInteger(index) || index < 0 || index >= bag.length) {
      startShopEvent(run);
      return "That item is no longer available.";
    }
    const item = bag[index];
    const value = Math.max(1, Number(sellOption.gold) || shopValueForItem(item));
    bag.splice(index, 1);
    runtime.meta.gold += value;
    addLog(run, `Sold ${item.label} for ${value} gold.`);
    startShopEvent(run);
    return `Sold ${item.label}.`;
  }

  const option = (event.options || []).find((entry) => entry.id === optionId);
  if (!option) {
    return "Encounter option unavailable.";
  }

  const room = currentRoom(run);
  const rand = createRng(Date.now() + run.floor * 521);
  if (option.effect === "loot") {
    const item = chooseLootDrop(rand, run.rareBonus);
    run.bag.push(item);
    room.cleared = true;
    run.event = null;
    if (run.roomState) {
      run.roomState.encounterMarker = null;
    }
    addLog(run, `Encounter reward: ${item.label}.`);
    return "You recovered hidden loot.";
  }
  if (option.effect === "buy_supply") {
    if (runtime.meta.gold < 12) {
      return "Need 12 gold.";
    }
    runtime.meta.gold -= 12;
    run.bag.push({
      id: `health_potion-${Date.now()}`,
      type: "consumable",
      itemId: "health_potion",
      label: "Health Potion",
      abilityId: "",
    });
    room.cleared = true;
    run.event = null;
    if (run.roomState) {
      run.roomState.encounterMarker = null;
    }
    addLog(run, "Encounter resolved: you bought supplies.");
    return "Supply purchased.";
  }
  if (option.effect === "steal_key") {
    if (rand() < 0.6) {
      const key = randomPick(rand, KEY_DEFINITIONS) || KEY_DEFINITIONS[0];
      run.bag.push({
        id: `${key.itemId}-${Date.now()}-${randomInt(rand, 1000, 9999)}`,
        type: "key",
        itemId: key.itemId,
        label: key.label,
        abilityId: "",
      });
      room.cleared = true;
      run.event = null;
      if (run.roomState) {
        run.roomState.encounterMarker = null;
      }
      addLog(run, `Encounter resolved: you stole ${key.label}.`);
      return `You snatched ${key.label}.`;
    }
    room.cleared = true;
    if (run.roomState) {
      run.roomState.encounterMarker = null;
    }
    startCombat(run, "monster", 77);
    run.event = null;
    addLog(run, "Encounter turned hostile.");
    return "You were spotted. Combat begins.";
  }
  if (option.effect === "fight_mimic" || option.effect === "fight_warden" || option.effect === "ambush") {
    room.cleared = true;
    if (run.roomState) {
      run.roomState.encounterMarker = null;
    }
    startCombat(run, "monster", 101);
    run.event = null;
    addLog(run, "Encounter turned into combat.");
    return "Combat begins.";
  }
  room.cleared = true;
  run.event = null;
  if (run.roomState) {
    run.roomState.encounterMarker = null;
  }
  addLog(run, "Encounter concluded. You moved on.");
  return "You leave the encounter behind.";
}

function descendFloor(runtime, state) {
  const run = runtime.run;
  if (!run || run.combat || run.event) {
    return "Cannot descend right now.";
  }

  const room = currentRoom(run);
  const roomState = roomStateFromRun(run);
  if (!roomState || !roomState.stairs) {
    return "No stairs in this room.";
  }
  const onStairs =
    roomState.player.x === roomState.stairs.x &&
    roomState.player.y === roomState.stairs.y;
  if (!onStairs) {
    return "Stand on the stairs tile to descend.";
  }
  if (!room) {
    return "You are not at the stairs.";
  }
  if (!run.bossDefeated) {
    return "The stairs remain sealed until the floor boss falls.";
  }

  const nextFloor = run.floor + 1;
  const progress = dccProgressFromState(state);
  if (nextFloor >= 3 && !progress.floor3Unlocked) {
    return "A sealed gate blocks the lower floors. A keyed artifact is required.";
  }
  runtime.solved = true;
  runtime.meta.bestFloor = Math.max(runtime.meta.bestFloor, nextFloor);
  const nextRun = startFloor(runtime, state, nextFloor);
  // Preserve current wounds for persistence feel.
  nextRun.hp = Math.max(1, Math.min(nextRun.maxHp, Math.round((run.hp / Math.max(1, run.maxHp)) * nextRun.maxHp)));
  nextRun.stamina = nextRun.maxStamina;
  enterRoom(nextRun, nextRun.currentRoomId);
  runtime.run = nextRun;
  return `Descended to floor ${nextFloor}.`;
}

function resolveTileInteraction(runtime, contextState) {
  const run = runtime.run;
  if (!run) {
    return "";
  }
  const room = currentRoom(run);
  const roomState = roomStateFromRun(run);
  if (!room || !roomState) {
    return "";
  }
  const player = roomState.player;

  if (roomState.chest && player.x === roomState.chest.x && player.y === roomState.chest.y && !room.cleared) {
    const rand = createRng(Date.now() + run.floor * 977 + hashText(room.id));
    const item = chooseLootDrop(rand, run.rareBonus);
    run.bag.push(item);
    room.cleared = true;
    roomState.chest = null;
    addLog(run, `Opened chest: ${item.label}.`);
    return `Found ${item.label}.`;
  }

  if (roomState.encounterMarker && player.x === roomState.encounterMarker.x && player.y === roomState.encounterMarker.y) {
    if (!run.event && !room.cleared) {
      startEncounter(run, room.encounterId);
      addLog(run, "A scripted encounter begins.");
      return "Encounter started.";
    }
  }

  if (roomState.shop && player.x === roomState.shop.x && player.y === roomState.shop.y) {
    if (!run.event) {
      startShopEvent(run);
      return "Shop opened.";
    }
  }

  if (roomState.stairs && player.x === roomState.stairs.x && player.y === roomState.stairs.y) {
    return descendFloor(runtime, contextState);
  }

  const touchedDoor = (roomState.doors || []).find((door) => player.x === door.x && player.y === door.y);
  if (!touchedDoor) {
    return "";
  }
  if (run.combat) {
    return "The enemy blocks your escape.";
  }
  if (run.event) {
    return "Resolve the encounter first.";
  }
  const lock = run.map && run.map.lockState ? run.map.lockState[touchedDoor.lockId] : null;
  if (lock && lock.locked && !lock.opened) {
    const keyType = String(lock.keyType || "bronze_key");
    if (!consumeMatchingKeyFromBag(run, keyType)) {
      const label = KEY_LABEL_BY_ID[keyType] || "Key";
      return `Door is sealed. ${label} required.`;
    }
    lock.opened = true;
    addLog(run, `Unlocked a sealed door with ${KEY_LABEL_BY_ID[keyType] || "a key"}.`);
  }

  const entryDoorDirection = OPPOSITE_DIRECTION[touchedDoor.direction] || "";
  enterRoom(run, touchedDoor.to, entryDoorDirection);
  return `Moved into room ${touchedDoor.to}.`;
}

function moveDirection(runtime, direction, contextState) {
  const run = runtime.run;
  if (!run || !ensureRunActionable(run)) {
    return "No active crawl.";
  }
  if (run.event) {
    return "Resolve the encounter first.";
  }
  const vector = DIRECTIONS[direction];
  if (!vector) {
    return "Invalid direction.";
  }
  const roomState = roomStateFromRun(run);
  if (!roomState) {
    return "Room state unavailable.";
  }

  const nextX = clamp(roomState.player.x + vector.dx, 0, ROOM_WIDTH - 1);
  const nextY = clamp(roomState.player.y + vector.dy, 0, ROOM_HEIGHT - 1);
  if (nextX === roomState.player.x && nextY === roomState.player.y) {
    return "";
  }
  const wallTile = nextX === 0 || nextY === 0 || nextX === ROOM_WIDTH - 1 || nextY === ROOM_HEIGHT - 1;
  const doorTile = (roomState.doors || []).some((door) => door.x === nextX && door.y === nextY);
  if (wallTile && !doorTile) {
    return "";
  }
  roomState.player.x = nextX;
  roomState.player.y = nextY;
  const interactionMessage = resolveTileInteraction(runtime, contextState);
  if (!runtime.run) {
    return interactionMessage;
  }
  if (runtime.run.combat) {
    const pressure = runEnemyTimeline(runtime, Date.now(), true);
    if (pressure) {
      return pressure;
    }
  }
  return interactionMessage;
}

function upgradeCost(meta, upgradeId) {
  const level = meta && meta.upgrades ? Number(meta.upgrades[upgradeId] || 0) : 0;
  if (upgradeId === "hp") {
    return 28 * (level + 1);
  }
  if (upgradeId === "attack") {
    return 36 * (level + 1);
  }
  if (upgradeId === "stamina") {
    return 24 * (level + 1);
  }
  if (upgradeId === "slots") {
    return 120 * (level + 1);
  }
  if (upgradeId === "rare") {
    return 88 * (level + 1);
  }
  return 999999;
}

function reduceDccRuntime(runtime, action, context = {}) {
  const current = normalizeRuntime(runtime);
  if (!action || typeof action !== "object") {
    return current;
  }

  if (action.type === "dcc-toggle-inventory") {
    return withLootEventsFromBagGrowth(current, {
      ...current,
      inventoryOpen: !current.inventoryOpen,
      lastMessage: "",
    }, action.type);
  }

  if (action.type === "dcc-enter-floor") {
    if (current.run && current.run.active) {
      return {
        ...current,
        lastMessage: "A run is already active.",
      };
    }
    const progress = dccProgressFromState(context.state);
    const requestedFloor = Math.max(1, Math.floor(Number(action.startFloor) || progress.checkpointFloor || 1));
    const startAt = requestedFloor >= 3 && !progress.floor3Unlocked ? 1 : requestedFloor;
    const nextRun = startFloor(current, context.state, startAt);
    enterRoom(nextRun, nextRun.currentRoomId);
    return withLootEventsFromBagGrowth(current, {
      ...current,
      meta: {
        ...current.meta,
        totalRuns: current.meta.totalRuns + 1,
      },
      run: nextRun,
      inventoryOpen: false,
      lastMessage: `Floor ${startAt} generated.`,
    }, action.type);
  }

  if (action.type === "dcc-unlock-floor3") {
    if (action.atGate !== true) {
      return {
        ...current,
        lastMessage: "Reach the sealed stair gate on Floor 2 first.",
      };
    }
    if (action.ready !== true) {
      return {
        ...current,
        lastMessage: "You need the DCC Floor-3 Key selected to unlock this gate.",
      };
    }
    return {
      ...current,
      lastMessage: "The floor-three gate unlocks with a deep mechanical shudder.",
    };
  }

  if (action.type === "dcc-apply-checkpoint-pyramid") {
    if (action.ready !== true) {
      return {
        ...current,
        lastMessage: "You need the Checkpoint Pyramid selected to anchor this checkpoint.",
      };
    }
    return {
      ...current,
      lastMessage: "Checkpoint stabilized at Floor 3.",
    };
  }

  if (action.type === "dcc-buy-upgrade") {
    if (current.run && current.run.active) {
      return {
        ...current,
        lastMessage: "Upgrade purchases are only available outside a run.",
      };
    }
    const upgradeId = String(action.upgradeId || "");
    if (!Object.prototype.hasOwnProperty.call(current.meta.upgrades, upgradeId)) {
      return {
        ...current,
        lastMessage: "Unknown upgrade.",
      };
    }
    const cost = upgradeCost(current.meta, upgradeId);
    if (current.meta.gold < cost) {
      return {
        ...current,
        lastMessage: `Need ${cost} gold.`,
      };
    }
    const nextMeta = withDefaultMeta({
      ...current.meta,
      gold: current.meta.gold - cost,
      upgrades: {
        ...current.meta.upgrades,
        [upgradeId]: (current.meta.upgrades[upgradeId] || 0) + 1,
      },
    });
    return withLootEventsFromBagGrowth(current, {
      ...current,
      meta: nextMeta,
      lastMessage: `Upgraded ${upgradeId}.`,
    }, action.type);
  }

  if (action.type === "dcc-reset-run") {
    return withLootEventsFromBagGrowth(current, {
      ...current,
      run: null,
      inventoryOpen: false,
      lastMessage: "Run abandoned.",
    }, action.type);
  }

  if (!current.run) {
    return current;
  }

  const next = {
    ...current,
    run: cloneRun(current.run),
  };

  if (action.type === "dcc-move") {
    const direction = String(action.direction || "");
    const message = moveDirection(next, direction, context.state);
    return withLootEventsFromBagGrowth(current, {
      ...next,
      lastMessage: message,
    }, action.type);
  }

  if (action.type === "dcc-rest") {
    if (next.run.combat || next.run.event) {
      return {
        ...next,
        lastMessage: "Cannot rest during combat or an encounter.",
      };
    }
    const room = currentRoom(next.run);
    if (room && room.rested) {
      return {
        ...next,
        lastMessage: "You have already rested in this room.",
      };
    }
    next.run.stamina = Math.min(next.run.maxStamina, next.run.stamina + 2);
    next.run.hp = Math.min(next.run.maxHp, next.run.hp + 4);
    if (room) {
      room.rested = true;
    }
    return withLootEventsFromBagGrowth(current, {
      ...next,
      lastMessage: "Recovered a little health and stamina.",
    }, action.type);
  }

  if (action.type === "dcc-descend") {
    const message = descendFloor(next, context.state);
    return withLootEventsFromBagGrowth(current, {
      ...next,
      lastMessage: message,
    }, action.type);
  }

  if (action.type === "dcc-use-item") {
    const message = useItemInRun(next.run, action.itemIndex);
    return withLootEventsFromBagGrowth(current, {
      ...next,
      lastMessage: message,
    }, action.type);
  }

  if (action.type === "dcc-learn-book") {
    const message = learnBook(next.run, action.itemIndex, action.slotIndex);
    return withLootEventsFromBagGrowth(current, {
      ...next,
      lastMessage: message,
    }, action.type);
  }

  if (action.type === "dcc-combat-use") {
    const message = resolveCombatAction(next, action.abilityIndex);
    return {
      ...next,
      lastMessage: message,
    };
  }

  if (action.type === "dcc-encounter-option") {
    const message = resolveEncounter(next, action.optionId);
    return withLootEventsFromBagGrowth(current, {
      ...next,
      lastMessage: message,
    }, action.type);
  }

  return withLootEventsFromBagGrowth(current, next, action.type);
}

function roomSymbol(room, run) {
  if (!room) {
    return "";
  }
  if (run.currentRoomId === room.id) {
    return "@";
  }
  if (!room.discovered) {
    return "";
  }
  if (room.type === "start") {
    return "S";
  }
  if (room.type === "stairs") {
    return ">";
  }
  if (room.type === "boss") {
    return room.cleared ? "b" : "B";
  }
  if (room.type === "loot") {
    return room.cleared ? "l" : "L";
  }
  if (room.type === "encounter") {
    return room.cleared ? "e" : "E";
  }
  return room.cleared ? "." : "M";
}

function discoveredMapMarkup(run) {
  if (!run.hasFloorMap) {
    return "";
  }
  const cells = [];
  for (let y = 0; y < run.map.size; y += 1) {
    for (let x = 0; x < run.map.size; x += 1) {
      const key = roomKey(x, y);
      const room = run.map.rooms[key] || null;
      const discovered = room && room.discovered;
      const active = room && run.currentRoomId === room.id;
      const classes = ["dcc-map-cell"];
      if (!room) {
        classes.push("is-empty");
      } else if (!discovered) {
        classes.push("is-undiscovered");
      } else {
        classes.push("is-discovered");
      }
      if (active) {
        classes.push("is-active");
      }
      cells.push(`
        <div class="${classes.join(" ")}" title="${escapeHtml(room ? `${room.id} (${room.type})` : "Void")}">
          <span>${escapeHtml(roomSymbol(room, run))}</span>
        </div>
      `);
    }
  }
  return `
    <section class="card dcc-floor-map">
      <h4>Floor Map</h4>
      <section class="dcc-map-grid">${cells.join("")}</section>
    </section>
  `;
}

function roomViewMarkup(run) {
  const roomState = roomStateFromRun(run);
  const room = currentRoom(run);
  if (!roomState || !room) {
    return "";
  }

  const doorAt = Object.fromEntries(
    (roomState.doors || []).map((door) => [roomKey(door.x, door.y), door]),
  );
  const enemy = run.combat && run.combat.enemy ? run.combat.enemy : null;
  const cells = [];

  for (let y = 0; y < ROOM_HEIGHT; y += 1) {
    for (let x = 0; x < ROOM_WIDTH; x += 1) {
      let glyph = ".";
      let kind = "empty";
      const key = roomKey(x, y);
      const isWall = x === 0 || y === 0 || x === ROOM_WIDTH - 1 || y === ROOM_HEIGHT - 1;
      const door = doorAt[key] || null;
      if (isWall) {
        glyph = "#";
        kind = "wall";
      }
      if (door) {
        const lock = run.map && run.map.lockState ? run.map.lockState[door.lockId] : null;
        const locked = lock && lock.locked && !lock.opened;
        glyph = locked ? "L" : "D";
        kind = locked ? "door-locked" : "door";
      }
      if (roomState.stairs && x === roomState.stairs.x && y === roomState.stairs.y) {
        glyph = ">";
        kind = "stairs";
      }
      if (roomState.encounterMarker && x === roomState.encounterMarker.x && y === roomState.encounterMarker.y) {
        glyph = "?";
        kind = "encounter";
      }
      if (roomState.shop && x === roomState.shop.x && y === roomState.shop.y) {
        glyph = "$";
        kind = "shop";
      }
      if (roomState.chest && x === roomState.chest.x && y === roomState.chest.y) {
        glyph = "C";
        kind = "chest";
      }
      if (enemy && x === enemy.x && y === enemy.y) {
        glyph = "M";
        kind = "enemy";
      }
      if (x === roomState.player.x && y === roomState.player.y) {
        glyph = "@";
        kind = "player";
      }

      cells.push(`<div class="dcc-room-cell is-${escapeHtml(kind)}">${escapeHtml(glyph)}</div>`);
    }
  }

  return `
    <section class="card dcc-room">
      <h4>Active Room ${escapeHtml(room.id)}</h4>
      <div class="dcc-room-grid">${cells.join("")}</div>
    </section>
  `;
}

function combatMarkup(run) {
  const enemy = run && run.combat && run.combat.enemy ? run.combat.enemy : null;
  const abilityButtons = [
    {
      index: 0,
      label: `1: ${ABILITIES.basic.label}`,
      detail: ABILITIES.basic.detail,
      empty: false,
      ability: ABILITIES.basic,
    },
    ...(Array.isArray(run && run.abilitySlots) ? run.abilitySlots : []).map((abilityId, slotIndex) => {
      const ability = ABILITIES[abilityId];
      return {
        index: slotIndex + 1,
        label: `${slotIndex + 2}: ${ability ? ability.label : "Empty Slot"}`,
        detail: ability ? ability.detail : "Learn a book to fill this slot.",
        empty: !ability,
        ability,
      };
    }),
  ];

  return `
    <section class="card dcc-combat">
      <h4>Abilities</h4>
      ${
        enemy
          ? `<p><strong>Enemy:</strong> ${escapeHtml(enemy.name)} (${escapeHtml(String(enemy.hp))}/${escapeHtml(String(enemy.maxHp))} HP)</p>`
          : `<p class="muted">No active enemy in this room.</p>`
      }
      <div class="dcc-ability-grid">
        ${abilityButtons.map((entry) => `
          <button
            type="button"
            data-node-id="${NODE_ID}"
            data-node-action="dcc-combat-use"
            data-ability-index="${entry.index}"
            ${entry.empty || !enemy ? "disabled" : ""}
            title="${escapeHtml(entry.detail)}"
          >
            ${escapeHtml(entry.label)}
            ${entry.ability ? `<small>R${escapeHtml(String(entry.ability.range || 1))} | S${escapeHtml(String(entry.ability.staminaCost || 0))}</small>` : ""}
          </button>
        `).join("")}
      </div>
      <p class="muted">Use number keys 1-${escapeHtml(String(abilityButtons.length))} to attack while moving.</p>
    </section>
  `;
}

function encounterMarkup(run) {
  if (!run.event) {
    return "";
  }
  return `
    <section class="card dcc-encounter">
      <h4>${escapeHtml(run.event.title)}</h4>
      <p>${escapeHtml(run.event.text)}</p>
      <div class="toolbar">
        ${(run.event.options || []).map((option) => `
          <button
            type="button"
            data-node-id="${NODE_ID}"
            data-node-action="dcc-encounter-option"
            data-option-id="${escapeHtml(option.id)}"
          >
            ${escapeHtml(option.label)}
          </button>
        `).join("")}
      </div>
    </section>
  `;
}

function bagMarkup(run, open) {
  if (!open) {
    return "";
  }
  const bag = Array.isArray(run.bag) ? run.bag : [];
  return `
    <section class="card dcc-inventory">
      <h4>Run Inventory</h4>
      ${
        bag.length
          ? `
            <ul class="dcc-item-list">
              ${bag.map((item, index) => `
                <li>
                  <span>${escapeHtml(item.label)}</span>
                  <div class="toolbar">
                    <button
                      type="button"
                      data-node-id="${NODE_ID}"
                      data-node-action="dcc-use-item"
                      data-item-index="${index}"
                      ${item.type === "book" || item.type === "key" ? "disabled" : ""}
                    >
                      Use
                    </button>
                    ${
                      item.type === "book"
                        ? `
                          <button
                            type="button"
                            data-node-id="${NODE_ID}"
                            data-node-action="dcc-learn-book"
                            data-item-index="${index}"
                          >
                            Learn
                          </button>
                        `
                        : ""
                    }
                  </div>
                </li>
              `).join("")}
            </ul>
          `
          : `<p class="muted">Inventory empty.</p>`
      }
    </section>
  `;
}

function abilitySlotMarkup(run) {
  return `
    <ul class="dcc-slot-list">
      ${run.abilitySlots.map((abilityId, index) => {
        const ability = ABILITIES[abilityId];
        return `
          <li>
            <strong>Slot ${index + 1}:</strong>
            ${escapeHtml(ability ? ability.label : "Empty")}
          </li>
        `;
      }).join("")}
    </ul>
  `;
}

function dccLootPanelMarkup(runtime, state) {
  const equipment = runtime && runtime.run
    ? normalizeEquipment(runtime.run.equipment)
    : normalizeEquipment(runtime && runtime.meta ? runtime.meta.preparedEquipment : null);
  const rows = [
    { slot: "head", label: "Head" },
    { slot: "chest", label: "Chest" },
    { slot: "legs", label: "Legs" },
    { slot: "trinket", label: "Trinket" },
  ];
  const selectedLootItemId = String(runtime && runtime.selectedLootItemId ? runtime.selectedLootItemId : "");
  const canEquip = Boolean(runtime && !runtime.run && selectedLootItemId);
  const ringSlots = rows.map((row) => {
    const item = equipment[row.slot];
    const details = item
      ? `${row.label}: ${item.label || "Armor"} (${item.rarity || "common"})${item.enchantLabel ? ` | Enchant: ${item.enchantLabel}` : ""}`
      : `${row.label}: empty`;
    return {
      filled: Boolean(item),
      clickable: canEquip,
      title: details,
      ariaLabel: `${row.label} gear slot`,
      symbolHtml: item
        ? renderArtifactSymbol({
            artifactName: item.label || row.label,
            className: "slot-ring-symbol artifact-symbol",
          })
        : renderArtifactSymbol({
            artifactName: `${row.label} Slot`,
            className: "slot-ring-symbol artifact-symbol is-slot-ghost",
          }),
      attrs: canEquip
        ? {
            "data-action": "loot-equip-target",
            "data-region": "dcc",
            "data-slot-id": row.slot,
            "data-target-id": row.slot,
          }
        : {},
    };
  });

  return `
    <section class="card dcc-sheet">
      <h4>Run-Limited Gear</h4>
      ${renderSlotRing({
        slots: ringSlots,
        className: "dcc-gear-slot-ring",
        radiusPct: 42,
        centerHtml: renderRegionSymbol({
          section: "Dungeon Crawler Carl",
          className: "slot-ring-center-symbol",
        }),
        ariaLabel: "DCC gear slots",
      })}
      <p class="muted">${canEquip ? "Click a slot to set run gear." : "Select DCC loot, then click a gear slot before entering a run."}</p>
      <div class="toolbar">
        <button type="button" data-action="toggle-widget" data-widget="loot">Open Loot Panel</button>
      </div>
    </section>
  `;
}

function compactGearSummaryMarkup(run) {
  const equipment = normalizeEquipment(run && run.equipment);
  const entries = [
    { slot: "head", label: "H" },
    { slot: "chest", label: "C" },
    { slot: "legs", label: "L" },
    { slot: "trinket", label: "T" },
  ];
  return `
    <div class="dcc-gear-mini" aria-label="Run gear summary">
      ${entries.map((entry) => {
    const item = equipment[entry.slot];
    const title = item
      ? `${entry.slot}: ${item.label || "gear"}${item.enchantLabel ? ` | ${item.enchantLabel}` : ""}`
      : `${entry.slot}: empty`;
    return `
          <span class="dcc-gear-mini-slot ${item ? "is-filled" : ""}" title="${escapeHtml(title)}">${escapeHtml(entry.label)}</span>
        `;
  }).join("")}
    </div>
  `;
}

function outsideMarkup(runtime, state, selectedArtifact = "") {
  const meta = runtime.meta;
  const modifiers = dccModifiers(state);
  const stats = deriveBaseStats(meta, modifiers);
  const progress = dccProgressFromState(state);
  const artifact = safeText(selectedArtifact);
  const pyramidSelected = artifact === "Checkpoint Pyramid";

  const upgradeRows = [
    { id: "hp", label: "Max Health", value: meta.upgrades.hp },
    { id: "attack", label: "Attack", value: meta.upgrades.attack },
    { id: "stamina", label: "Max Stamina", value: meta.upgrades.stamina },
    { id: "slots", label: "Ability Slots", value: meta.upgrades.slots },
    { id: "rare", label: "Loot Rarity", value: meta.upgrades.rare },
  ];

  return `
    <section class="card dcc-outside">
      <h3>Outside The Dungeon</h3>
      <p>Gold: <strong>${escapeHtml(String(meta.gold))}</strong> | Runs: ${escapeHtml(String(meta.totalRuns))} | Deaths: ${escapeHtml(String(meta.totalDeaths))} | Best Floor: ${escapeHtml(String(meta.bestFloor))}</p>
      <p class="muted">Floor 3 Gate: ${progress.floor3Unlocked ? "Unlocked" : "Locked"} | Checkpoint Floor: ${progress.checkpointFloor}</p>
      <div class="toolbar">
        <button type="button" data-node-id="${NODE_ID}" data-node-action="dcc-enter-floor">Enter Floor ${escapeHtml(String(progress.checkpointFloor))}</button>
        <button
          type="button"
          data-node-id="${NODE_ID}"
          data-node-action="dcc-apply-checkpoint-pyramid"
          data-artifact="${escapeHtml(artifact)}"
          data-ready="${pyramidSelected ? "true" : "false"}"
        >
          Set Checkpoint: Floor 3
        </button>
      </div>
    </section>

    <section class="card dcc-sheet dcc-sheet-summary">
      <h4>Character Sheet</h4>
      <p><strong>Max HP:</strong> ${escapeHtml(String(stats.maxHp))} | <strong>Attack:</strong> ${escapeHtml(String(stats.attack))} | <strong>Max Stamina:</strong> ${escapeHtml(String(stats.maxStamina))} | <strong>Ability Slots:</strong> ${escapeHtml(String(stats.slotCount))}</p>
      <p><strong>Base Abilities:</strong> Basic Attack</p>
    </section>

    <section class="dcc-sheet-grid">
      <section class="card dcc-upgrades">
        <h4>Gold Upgrades</h4>
        <div class="dcc-upgrade-grid">
          ${upgradeRows.map((row) => {
            const cost = upgradeCost(meta, row.id);
            return `
              <article class="dcc-upgrade-card">
                <h5>${escapeHtml(row.label)}</h5>
                <p>Level: ${escapeHtml(String(row.value))}</p>
                <p>Cost: ${escapeHtml(String(cost))} gold</p>
                <button
                  type="button"
                  data-node-id="${NODE_ID}"
                  data-node-action="dcc-buy-upgrade"
                  data-upgrade-id="${escapeHtml(row.id)}"
                  ${meta.gold >= cost ? "" : "disabled"}
                >
                  Upgrade
                </button>
              </article>
            `;
          }).join("")}
        </div>
      </section>
      <div class="dcc-gear-column">
        ${dccLootPanelMarkup(runtime, state)}
      </div>
    </section>
  `;
}

function runMarkup(runtime, state, selectedArtifact = "") {
  const run = runtime.run;
  if (!run) {
    return "";
  }
  const progress = dccProgressFromState(state);
  const artifact = safeText(selectedArtifact);
  const keySelected = artifact === "DCC Floor-3 Key";
  const atFloorGate = run.floor === 2 && run.bossDefeated;
  const room = currentRoom(run);
  const roomState = roomStateFromRun(run);
  const enemy = run.combat && run.combat.enemy ? run.combat.enemy : null;
  const distance = enemy && roomState
    ? manhattanDistance(roomState.player.x, roomState.player.y, enemy.x, enemy.y)
    : 0;
  const feedEntries = visibleNotifications(run.log || []);

  return `
    <section class="dcc-run-layout">
      <div class="dcc-run-main">
        <section class="card dcc-status">
          <h3>Floor ${escapeHtml(String(run.floor))}</h3>
          <p><strong>HP:</strong> ${escapeHtml(String(run.hp))}/${escapeHtml(String(run.maxHp))} | <strong>Stamina:</strong> ${escapeHtml(String(run.stamina))}/${escapeHtml(String(run.maxStamina))}</p>
          ${compactGearSummaryMarkup(run)}
          <p><strong>Gold:</strong> ${escapeHtml(String(runtime.meta.gold))} | <strong>Current Room:</strong> ${escapeHtml(room ? room.id : "Unknown")}</p>
          ${
            enemy
              ? `<p><strong>Enemy Range:</strong> ${escapeHtml(String(distance))} tiles | <strong>Block:</strong> ${escapeHtml(String(Math.max(0, Number(run.combat.block) || 0)))}</p>`
              : ""
          }
          <div class="toolbar">
            <button type="button" data-node-id="${NODE_ID}" data-node-action="dcc-rest" ${run.combat || run.event ? "disabled" : ""}>Rest (R)</button>
            <button type="button" data-node-id="${NODE_ID}" data-node-action="dcc-toggle-inventory">Toggle Inventory (I)</button>
            <button
              type="button"
              data-node-id="${NODE_ID}"
              data-node-action="dcc-unlock-floor3"
              data-artifact="${escapeHtml(artifact)}"
              data-ready="${!progress.floor3Unlocked && keySelected && atFloorGate ? "true" : "false"}"
              data-at-gate="${atFloorGate ? "true" : "false"}"
              ${progress.floor3Unlocked || !atFloorGate ? "disabled" : ""}
            >
              Unlock Floor 3 Gate
            </button>
            <button type="button" class="ghost" data-node-id="${NODE_ID}" data-node-action="dcc-reset-run">Abandon Run</button>
          </div>
        </section>

        ${encounterMarkup(run)}
        ${roomViewMarkup(run)}
        ${combatMarkup(run)}
        ${bagMarkup(run, runtime.inventoryOpen)}
        ${discoveredMapMarkup(run)}

        <section class="card dcc-sheet">
          <h4>Combat Loadout</h4>
          <p><strong>Attack:</strong> ${escapeHtml(String(run.attack))} | <strong>Rare Drop Bias:</strong> ${escapeHtml((run.rareBonus * 100).toFixed(0))}%</p>
          ${abilitySlotMarkup(run)}
        </section>
      </div>

      <aside class="card dcc-feed">
        <h4>Notifications</h4>
        <div class="dcc-feed-scroll">
          <ul>
            ${feedEntries.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}
          </ul>
        </div>
      </aside>
    </section>
  `;
}

function renderDcc01(context) {
  const runtime = normalizeRuntime(context.runtime);
  const selectedArtifact = String(context && context.selectedArtifactReward ? context.selectedArtifactReward : "");

  return `
    <article class="dcc01-node" data-node-id="${NODE_ID}">
      <section class="card dcc-head">
        <h3>DCC01: The Crawl</h3>
      </section>
      ${runtime.run ? runMarkup(runtime, context.state, selectedArtifact) : outsideMarkup(runtime, context.state, selectedArtifact)}
    </article>
  `;
}

function actionFromElement(element) {
  const actionName = element.getAttribute("data-node-action");
  if (!actionName) {
    return null;
  }
  const common = { at: Date.now() };
  if (actionName === "dcc-enter-floor") {
    return { type: "dcc-enter-floor", ...common };
  }
  if (actionName === "dcc-buy-upgrade") {
    return {
      type: "dcc-buy-upgrade",
      upgradeId: element.getAttribute("data-upgrade-id") || "",
      ...common,
    };
  }
  if (actionName === "dcc-reset-run") {
    return { type: "dcc-reset-run", ...common };
  }
  if (actionName === "dcc-toggle-inventory") {
    return { type: "dcc-toggle-inventory", ...common };
  }
  if (actionName === "dcc-move") {
    return {
      type: "dcc-move",
      direction: element.getAttribute("data-direction") || "",
      ...common,
    };
  }
  if (actionName === "dcc-rest") {
    return { type: "dcc-rest", ...common };
  }
  if (actionName === "dcc-descend") {
    return { type: "dcc-descend", ...common };
  }
  if (actionName === "dcc-unlock-floor3") {
    return {
      type: "dcc-unlock-floor3",
      artifact: element.getAttribute("data-artifact") || "",
      ready: element.getAttribute("data-ready") === "true",
      atGate: element.getAttribute("data-at-gate") === "true",
      ...common,
    };
  }
  if (actionName === "dcc-apply-checkpoint-pyramid") {
    return {
      type: "dcc-apply-checkpoint-pyramid",
      artifact: element.getAttribute("data-artifact") || "",
      ready: element.getAttribute("data-ready") === "true",
      ...common,
    };
  }
  if (actionName === "dcc-use-item") {
    return {
      type: "dcc-use-item",
      itemIndex: Number(element.getAttribute("data-item-index") || -1),
      ...common,
    };
  }
  if (actionName === "dcc-learn-book") {
    return {
      type: "dcc-learn-book",
      itemIndex: Number(element.getAttribute("data-item-index") || -1),
      slotIndex: Number(element.getAttribute("data-slot-index") || -1),
      ...common,
    };
  }
  if (actionName === "dcc-combat-use") {
    return {
      type: "dcc-combat-use",
      abilityIndex: Number(element.getAttribute("data-ability-index") || 0),
      ...common,
    };
  }
  if (actionName === "dcc-encounter-option") {
    return {
      type: "dcc-encounter-option",
      optionId: element.getAttribute("data-option-id") || "",
      ...common,
    };
  }
  return null;
}

function keyAction(event, runtime) {
  if (event.metaKey || event.ctrlKey || event.altKey) {
    return null;
  }
  const current = normalizeRuntime(runtime);
  const lowerKey = String(event.key || "").toLowerCase();
  const common = { at: Date.now() };

  if (!current.run) {
    if (event.key === "Enter") {
      return { type: "dcc-enter-floor", ...common };
    }
    return null;
  }

  if (lowerKey === "i") {
    return { type: "dcc-toggle-inventory", ...common };
  }
  if (lowerKey === "r") {
    return { type: "dcc-rest", ...common };
  }
  if (lowerKey === "e") {
    return { type: "dcc-descend", ...common };
  }
  if (Object.prototype.hasOwnProperty.call(DIRECTION_BY_KEY, lowerKey)) {
    return {
      type: "dcc-move",
      direction: DIRECTION_BY_KEY[lowerKey],
      ...common,
    };
  }

  if (current.run.combat && /^Digit[1-9]$/.test(event.code || "")) {
    const index = Math.max(0, Number((event.code || "").replace("Digit", "")) - 1);
    return {
      type: "dcc-combat-use",
      abilityIndex: index,
      ...common,
    };
  }

  return null;
}

function synchronizeDccRuntime(runtime, context = {}) {
  const current = normalizeRuntime(runtime);
  const selectedLootItemId = String(context.selectedLootItemId || "");
  const synced = {
    ...current,
    selectedLootItemId,
  };
  if (!synced.run) {
    return synced;
  }

  const next = {
    ...synced,
    run: cloneRun(synced.run),
  };
  if (!roomStateFromRun(next.run)) {
    enterRoom(next.run, next.run.currentRoomId);
  }

  const now = Number(context.now) || Date.now();
  const pressureMessage = runEnemyTimeline(next, now, false);
  if (pressureMessage) {
    next.lastMessage = pressureMessage;
  }
  return next;
}

export const DCC01_NODE_EXPERIENCE = {
  nodeId: NODE_ID,
  initialState: createInitialRuntime,
  render: renderDcc01,
  reduceRuntime(runtime, action, context) {
    return reduceDccRuntime(runtime, action, context || {});
  },
  validateRuntime(runtime) {
    const normalized = normalizeRuntime(runtime);
    return Boolean(normalized.solved);
  },
  buildActionFromElement(element) {
    return actionFromElement(element);
  },
  buildKeyAction(event, runtime) {
    return keyAction(event, runtime);
  },
  synchronizeRuntime(runtime, context = {}) {
    return synchronizeDccRuntime(runtime, context);
  },
};
