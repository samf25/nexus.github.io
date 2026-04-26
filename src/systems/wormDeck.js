import { loadWormCardCatalog, wormCardById } from "../nodes/worm/wormData.js";

const STARTER_CAPE_NAMES = Object.freeze(["Chubster", "Chuckles", "Cinderhands", "Glace"]);
const BASIC_HIRE_COST = 10;
const BASIC_WINDOW_MAX_RARITY = 5;
const BASIC_WINDOW_WEIGHT_BASE = 0.125;
const SICKBAY_HEAL_FRACTION_PER_MINUTE = 0.25;
const SPECIAL_HIRING_WINDOWS = Object.freeze([
  Object.freeze({
    id: "dcc-floor3-window",
    rewardArtifact: "Dockside Broker Contract",
    label: "Dockside Contract Window",
    cost: 40,
    minRarity: 3.5,
    maxRarity: 6.5,
    weightBase: 1,
  }),
  Object.freeze({
    id: "dcc-floor4-window",
    rewardArtifact: "National Broker Mandate",
    label: "National Mandate Window",
    cost: 120,
    minRarity: 5,
    maxRarity: 10,
    weightBase: 1.35,
  }),
]);

function nowMs() {
  return Date.now();
}

function safeNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function maxHpForCard(card) {
  const endurance = Math.max(0, Math.round(safeNumber(card && card.endurance, 0)));
  return Math.max(40, endurance * 50);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normalizeDeckEntry(entry, card) {
  const maxHp = maxHpForCard(card);
  const source = entry && typeof entry === "object" ? entry : {};
  const copies = Math.max(1, Math.floor(safeNumber(source.copies, 1)));
  const currentHp = clamp(Math.round(safeNumber(source.currentHp, maxHp)), 0, maxHp);
  const sickbaySince = Number.isFinite(source.sickbaySince) ? Math.max(0, Number(source.sickbaySince)) : 0;
  return {
    copies,
    currentHp,
    sickbaySince,
  };
}

function normalizeDeck(candidateDeck) {
  const raw = candidateDeck && typeof candidateDeck === "object" ? candidateDeck : {};
  const next = {};
  for (const [cardId, entry] of Object.entries(raw)) {
    const card = wormCardById(cardId);
    if (!card) {
      continue;
    }
    next[cardId] = normalizeDeckEntry(entry, card);
  }
  return next;
}

function normalizeSickbayCardIds(deck, candidateCardIds) {
  const raw = Array.isArray(candidateCardIds) ? candidateCardIds : [candidateCardIds];
  const unique = [];
  for (const candidate of raw) {
    const cardId = String(candidate || "").trim();
    if (!cardId || unique.includes(cardId)) {
      continue;
    }
    if (!Object.prototype.hasOwnProperty.call(deck, cardId)) {
      continue;
    }
    unique.push(cardId);
  }
  return unique;
}

function healedHpForEntry(entry, card, now) {
  const maxHp = maxHpForCard(card);
  const baseHp = clamp(Math.round(safeNumber(entry.currentHp, maxHp)), 0, maxHp);
  const sickbaySince = Number.isFinite(entry.sickbaySince) ? Math.max(0, Number(entry.sickbaySince)) : 0;
  if (!sickbaySince || baseHp >= maxHp) {
    return baseHp;
  }

  const elapsedMs = Math.max(0, now - sickbaySince);
  const healed = baseHp + (elapsedMs / 60000) * (maxHp * SICKBAY_HEAL_FRACTION_PER_MINUTE);
  return clamp(Math.round(healed), 0, maxHp);
}

function snapshotSickbayHealing(state, now) {
  const sickbayCardIds = Array.isArray(state.sickbayCardIds) ? state.sickbayCardIds : [];
  if (!sickbayCardIds.length) {
    return state;
  }

  const nextDeck = { ...state.deck };
  const nextSickbayCardIds = [];
  for (const sickbayCardId of sickbayCardIds) {
    const card = wormCardById(sickbayCardId);
    const entry = card ? state.deck[sickbayCardId] : null;
    if (!card || !entry) {
      continue;
    }

    const healedHp = healedHpForEntry(entry, card, now);
    const maxHp = maxHpForCard(card);
    const fullyHealed = healedHp >= maxHp;
    nextDeck[sickbayCardId] = {
      ...entry,
      currentHp: healedHp,
      sickbaySince: fullyHealed ? 0 : now,
    };
    if (!fullyHealed) {
      nextSickbayCardIds.push(sickbayCardId);
    }
  }

  return {
    ...state,
    deck: nextDeck,
    sickbayCardIds: nextSickbayCardIds,
  };
}

function inSickbay(state, cardId) {
  return Array.isArray(state.sickbayCardIds) && state.sickbayCardIds.includes(cardId);
}

function removeFromSickbayIds(state, cardId) {
  if (!Array.isArray(state.sickbayCardIds)) {
    return [];
  }
  return state.sickbayCardIds.filter((entry) => entry !== cardId);
}

function safeSickbaySlots(action) {
  const requested = Math.max(1, Math.floor(safeNumber(action && action.maxSickbaySlots, 1)));
  return requested;
}

export function defaultWormSystemState() {
  return {
    clout: 20,
    startersConfirmed: false,
    starterCardIds: [],
    deck: {},
    sickbayCardIds: [],
    arenaFirstWinsByDifficulty: {
      easy: false,
      medium: false,
      hard: false,
    },
    arenaBossCleared: false,
  };
}

export function normalizeWormSystemState(candidate, now = nowMs()) {
  const source = candidate && typeof candidate === "object" ? candidate : {};
  const deck = normalizeDeck(source.deck);
  const starterCardIds = Array.isArray(source.starterCardIds)
    ? source.starterCardIds.map((cardId) => String(cardId || "").trim()).filter((cardId) => cardId)
    : [];
  const baseSickbayList = Array.isArray(source.sickbayCardIds)
    ? source.sickbayCardIds
    : source.sickbayCardId
      ? [source.sickbayCardId]
      : [];

  const base = {
    clout: Math.max(0, Number(safeNumber(source.clout, 20).toFixed(2))),
    startersConfirmed: Boolean(source.startersConfirmed),
    starterCardIds,
    deck,
    sickbayCardIds: normalizeSickbayCardIds(deck, baseSickbayList),
    arenaFirstWinsByDifficulty: {
      easy: Boolean(source.arenaFirstWinsByDifficulty && source.arenaFirstWinsByDifficulty.easy),
      medium: Boolean(source.arenaFirstWinsByDifficulty && source.arenaFirstWinsByDifficulty.medium),
      hard: Boolean(source.arenaFirstWinsByDifficulty && source.arenaFirstWinsByDifficulty.hard),
    },
    arenaBossCleared: Boolean(source.arenaBossCleared),
  };

  return snapshotSickbayHealing(base, now);
}

function createWindowPool(maxRarity = BASIC_WINDOW_MAX_RARITY, minRarity = 0) {
  const cap = Math.max(0, safeNumber(maxRarity, BASIC_WINDOW_MAX_RARITY));
  const floor = Math.max(0, safeNumber(minRarity, 0));
  return loadWormCardCatalog().filter((card) => {
    const rarity = safeNumber(card.rarity, 0);
    return rarity <= cap && rarity >= floor;
  });
}

function weightedPick(cards, { rng = Math.random, weightBase = BASIC_WINDOW_WEIGHT_BASE } = {}) {
  if (!Array.isArray(cards) || cards.length === 0) {
    return null;
  }

  let totalWeight = 0;
  const normalizedBase = Number.isFinite(Number(weightBase)) ? Number(weightBase) : BASIC_WINDOW_WEIGHT_BASE;
  const weighted = cards.map((card) => {
    const rarity = Math.max(0, safeNumber(card.rarity, 0));
    const weight = Math.max(0.000001, Math.pow(normalizedBase, rarity));
    totalWeight += weight;
    return { card, weight };
  });

  if (totalWeight <= 0) {
    return cards[0] || null;
  }

  let roll = Math.max(0, Math.min(1, safeNumber(typeof rng === "function" ? rng() : Math.random(), 0))) * totalWeight;
  for (const entry of weighted) {
    roll -= entry.weight;
    if (roll <= 0) {
      return entry.card;
    }
  }
  return weighted[weighted.length - 1].card;
}

function addCardToDeck(state, cardId) {
  const card = wormCardById(cardId);
  if (!card) {
    return {
      nextState: state,
      added: false,
      duplicate: false,
      copies: 0,
    };
  }

  const existing = state.deck[cardId];
  if (existing) {
    const copies = Math.max(1, Math.floor(safeNumber(existing.copies, 1))) + 1;
    return {
      nextState: {
        ...state,
        deck: {
          ...state.deck,
          [cardId]: {
            ...existing,
            copies,
          },
        },
      },
      added: true,
      duplicate: true,
      copies,
    };
  }

  const maxHp = maxHpForCard(card);
  return {
    nextState: {
      ...state,
      deck: {
        ...state.deck,
        [cardId]: {
          copies: 1,
          currentHp: maxHp,
          sickbaySince: 0,
        },
      },
    },
    added: true,
    duplicate: false,
    copies: 1,
  };
}

function starterDraftPool() {
  return STARTER_CAPE_NAMES.map((name) => {
    const card = loadWormCardCatalog().find((candidate) => candidate.heroName === name);
    return card || null;
  }).filter(Boolean);
}

function normalizeStarterSelection(starterCardIds) {
  const draftCards = starterDraftPool();
  const allowed = new Set(draftCards.map((card) => card.id));
  const unique = [];
  for (const cardId of starterCardIds || []) {
    const id = String(cardId || "").trim();
    if (!id || !allowed.has(id) || unique.includes(id)) {
      continue;
    }
    unique.push(id);
  }
  return unique.slice(0, 2);
}

function ownedDeckEntries(state, now = nowMs()) {
  const normalized = normalizeWormSystemState(state, now);
  const entries = [];
  for (const [cardId, entry] of Object.entries(normalized.deck)) {
    const card = wormCardById(cardId);
    if (!card) {
      continue;
    }
    const maxHp = maxHpForCard(card);
    const currentHp = inSickbay(normalized, cardId)
      ? healedHpForEntry(entry, card, now)
      : clamp(Math.round(safeNumber(entry.currentHp, maxHp)), 0, maxHp);
    entries.push({
      card,
      cardId,
      copies: Math.max(1, Math.floor(safeNumber(entry.copies, 1))),
      currentHp,
      maxHp,
      inSickbay: inSickbay(normalized, cardId),
      healPerMinute: maxHp * SICKBAY_HEAL_FRACTION_PER_MINUTE,
      sickbaySince: Number(entry.sickbaySince || 0),
    });
  }

  entries.sort((left, right) => {
    if (right.card.rarity !== left.card.rarity) {
      return right.card.rarity - left.card.rarity;
    }
    return String(left.card.heroName).localeCompare(String(right.card.heroName));
  });

  return entries;
}

export function wormStarterDraftCards() {
  return starterDraftPool();
}

export function wormOwnedCards(state, now = nowMs()) {
  return ownedDeckEntries(state, now);
}

export function wormHasMinimumDeck(state, minimum = 1, now = nowMs()) {
  return wormOwnedCards(state, now).length >= Math.max(0, Math.floor(safeNumber(minimum, 1)));
}

export function wormDrawBasicWindowCard(options = Math.random) {
  const isFunction = typeof options === "function";
  const rng = isFunction ? options : options && typeof options.rng === "function" ? options.rng : Math.random;
  const weightBase = isFunction
    ? BASIC_WINDOW_WEIGHT_BASE
    : Number.isFinite(Number(options && options.weightBase))
      ? Number(options.weightBase)
      : BASIC_WINDOW_WEIGHT_BASE;
  const maxRarity = isFunction
    ? BASIC_WINDOW_MAX_RARITY
    : Number.isFinite(Number(options && options.maxRarity))
      ? Number(options.maxRarity)
      : BASIC_WINDOW_MAX_RARITY;
  const pool = createWindowPool(maxRarity);
  return weightedPick(pool, { rng, weightBase });
}

export function wormDrawBasicWindowPack(count = 1, rng = Math.random) {
  return wormDrawWindowPack(count, {
    rng,
    weightBase: BASIC_WINDOW_WEIGHT_BASE,
    maxRarity: BASIC_WINDOW_MAX_RARITY,
  });
}

export function wormDrawWindowCard({
  rng = Math.random,
  weightBase = BASIC_WINDOW_WEIGHT_BASE,
  maxRarity = BASIC_WINDOW_MAX_RARITY,
  minRarity = 0,
} = {}) {
  const pool = createWindowPool(maxRarity, minRarity);
  return weightedPick(pool, { rng, weightBase });
}

export function wormDrawWindowPack(
  count = 1,
  {
    rng = Math.random,
    weightBase = BASIC_WINDOW_WEIGHT_BASE,
    maxRarity = BASIC_WINDOW_MAX_RARITY,
    minRarity = 0,
  } = {},
) {
  const picks = [];
  const total = Math.max(0, Math.floor(safeNumber(count, 1)));
  for (let index = 0; index < total; index += 1) {
    const card = wormDrawWindowCard({
      rng,
      weightBase,
      maxRarity,
      minRarity,
    });
    if (card) {
      picks.push(card);
    }
  }
  return picks;
}

export function wormSpecialHiringWindows() {
  return SPECIAL_HIRING_WINDOWS.slice();
}

function applyOutcomeToDeck(state, playerResults, now) {
  const nextDeck = { ...state.deck };
  for (const result of playerResults || []) {
    const cardId = String(result && result.cardId ? result.cardId : "").trim();
    if (!cardId || !nextDeck[cardId]) {
      continue;
    }

    const card = wormCardById(cardId);
    if (!card) {
      continue;
    }

    const maxHp = maxHpForCard(card);
    const hp = clamp(Math.round(safeNumber(result.hp, nextDeck[cardId].currentHp)), 0, maxHp);
    nextDeck[cardId] = {
      ...nextDeck[cardId],
      currentHp: hp,
      sickbaySince: inSickbay(state, cardId) && hp < maxHp ? now : 0,
    };
  }

  return {
    ...state,
    deck: nextDeck,
  };
}

function computeArenaReward(enemyRarities) {
  const values = Array.isArray(enemyRarities) ? enemyRarities.slice(0, 2).map((rarity) => Math.max(0, safeNumber(rarity, 0))) : [];
  if (values.length < 2) {
    return 0;
  }
  const raw = (Math.pow(2, values[0]) + Math.pow(2, values[1])) / 3;
  return Number(raw.toFixed(2));
}

function battleDifficultyMultiplier(difficulty) {
  const key = String(difficulty || "").trim().toLowerCase();
  if (key === "medium") {
    return 3;
  }
  if (key === "hard") {
    return 10;
  }
  return 1;
}

export function reduceWormSystemState(systemState, action, now = nowMs()) {
  const current = normalizeWormSystemState(systemState, now);
  if (!action || typeof action !== "object") {
    return {
      nextState: current,
      changed: false,
      message: "",
      meta: {},
    };
  }

  if (action.type === "worm01-confirm-starters") {
    if (current.startersConfirmed) {
      return { nextState: current, changed: false, message: "The Loft roster is already established.", meta: {} };
    }

    const picked = normalizeStarterSelection(Array.isArray(action.cardIds) ? action.cardIds : []);
    if (picked.length !== 2) {
      return { nextState: current, changed: false, message: "Choose exactly two starter capes.", meta: {} };
    }

    let next = { ...current, startersConfirmed: true, starterCardIds: picked.slice() };
    for (const cardId of picked) {
      const added = addCardToDeck(next, cardId);
      next = added.nextState;
    }

    return {
      nextState: next,
      changed: true,
      message: "The Undersiders' Loft is online. Your first two capes are ready.",
      meta: { starterCardIds: picked },
    };
  }

  if (action.type === "worm01-hire-basic") {
    if (current.clout < BASIC_HIRE_COST) {
      return {
        nextState: current,
        changed: false,
        message: `Not enough Clout. Basic Window requires ${BASIC_HIRE_COST}.`,
        meta: {},
      };
    }

    const maxRarity = Number.isFinite(Number(action.maxRarity))
      ? Number(action.maxRarity)
      : BASIC_WINDOW_MAX_RARITY;
    const requestedCardId = String(action.pulledCardId || "").trim();
    const requestedCard = requestedCardId ? wormCardById(requestedCardId) : null;
    const pulledCard =
      requestedCard && safeNumber(requestedCard.rarity, 0) <= maxRarity
        ? requestedCard
        : wormDrawBasicWindowCard({
          weightBase: Number(action.weightBase),
          maxRarity,
        });
    if (!pulledCard) {
      return { nextState: current, changed: false, message: "No capes are available in the Basic Window pool.", meta: {} };
    }

    let next = {
      ...current,
      clout: Number((current.clout - BASIC_HIRE_COST).toFixed(2)),
    };
    const addResult = addCardToDeck(next, pulledCard.id);
    next = addResult.nextState;

    return {
      nextState: next,
      changed: true,
      message: addResult.duplicate
        ? `${pulledCard.heroName} duplicate acquired (x${addResult.copies}).`
        : `${pulledCard.heroName} joined your roster.`,
      meta: {
        pulledCardId: pulledCard.id,
        duplicate: addResult.duplicate,
        copies: addResult.copies,
      },
    };
  }

  if (action.type === "worm01-hire-basic-ten") {
    const pullCost = Math.max(1, Math.floor(Number(action.cost) || BASIC_HIRE_COST * 10));
    if (current.clout < pullCost) {
      return {
        nextState: current,
        changed: false,
        message: `Not enough Clout. x10 hiring requires ${pullCost}.`,
        meta: {},
      };
    }

    const maxRarity = Number.isFinite(Number(action.maxRarity))
      ? Number(action.maxRarity)
      : BASIC_WINDOW_MAX_RARITY;
    const requestedIds = Array.isArray(action.pulledCardIds)
      ? action.pulledCardIds.map((value) => String(value || "").trim()).filter((value) => value)
      : [];

    const pulledCards = [];
    for (let index = 0; index < 10; index += 1) {
      const requestedCard = requestedIds[index] ? wormCardById(requestedIds[index]) : null;
      const pulled =
        requestedCard && safeNumber(requestedCard.rarity, 0) <= maxRarity
          ? requestedCard
          : wormDrawBasicWindowCard({
            weightBase: Number(action.weightBase),
            maxRarity,
          });
      if (pulled) {
        pulledCards.push(pulled);
      }
    }
    if (!pulledCards.length) {
      return {
        nextState: current,
        changed: false,
        message: "No capes are available in the Basic Window pool.",
        meta: {},
      };
    }

    let next = {
      ...current,
      clout: Number((current.clout - pullCost).toFixed(2)),
    };
    let duplicateCount = 0;
    for (const card of pulledCards) {
      const addResult = addCardToDeck(next, card.id);
      next = addResult.nextState;
      if (addResult.duplicate) {
        duplicateCount += 1;
      }
    }

    return {
      nextState: next,
      changed: true,
      message: `x10 hiring complete. ${duplicateCount} duplicate${duplicateCount === 1 ? "" : "s"} merged.`,
      meta: {
        pulledCardIds: pulledCards.map((card) => card.id),
        duplicateCount,
      },
    };
  }

  if (action.type === "worm01-hire-window") {
    const windowId = String(action.windowId || "").trim();
    const windowConfig = SPECIAL_HIRING_WINDOWS.find((entry) => entry.id === windowId);
    if (!windowConfig) {
      return {
        nextState: current,
        changed: false,
        message: "Unknown hiring window.",
        meta: {},
      };
    }

    const cost = Math.max(1, Number(action.cost || windowConfig.cost) || windowConfig.cost);
    if (current.clout < cost) {
      return {
        nextState: current,
        changed: false,
        message: `Not enough Clout. ${windowConfig.label} requires ${cost}.`,
        meta: {},
      };
    }

    const minRarity = Number.isFinite(Number(action.minRarity))
      ? Number(action.minRarity)
      : Number(windowConfig.minRarity);
    const maxRarity = Number.isFinite(Number(action.maxRarity))
      ? Number(action.maxRarity)
      : Number(windowConfig.maxRarity);
    const weightBase = Number.isFinite(Number(action.weightBase))
      ? Number(action.weightBase)
      : Number(windowConfig.weightBase);
    const requestedCardId = String(action.pulledCardId || "").trim();
    const requestedCard = requestedCardId ? wormCardById(requestedCardId) : null;
    const requestedRarity = requestedCard ? Number(safeNumber(requestedCard.rarity, 0)) : -1;
    const pulledCard =
      requestedCard && requestedRarity >= minRarity && requestedRarity <= maxRarity
        ? requestedCard
        : wormDrawWindowCard({
          weightBase,
          minRarity,
          maxRarity,
        });
    if (!pulledCard) {
      return {
        nextState: current,
        changed: false,
        message: `${windowConfig.label} has no available capes in range.`,
        meta: {},
      };
    }

    let next = {
      ...current,
      clout: Number((current.clout - cost).toFixed(2)),
    };
    const addResult = addCardToDeck(next, pulledCard.id);
    next = addResult.nextState;

    return {
      nextState: next,
      changed: true,
      message: addResult.duplicate
        ? `${windowConfig.label}: ${pulledCard.heroName} duplicate acquired (x${addResult.copies}).`
        : `${windowConfig.label}: ${pulledCard.heroName} joined your roster.`,
      meta: {
        pulledCardId: pulledCard.id,
        duplicate: addResult.duplicate,
        copies: addResult.copies,
      },
    };
  }

  if (action.type === "worm01-sickbay-assign") {
    const cardId = String(action.cardId || "").trim();
    if (!cardId || !Object.prototype.hasOwnProperty.call(current.deck, cardId)) {
      return { nextState: current, changed: false, message: "That cape is not in your deck.", meta: {} };
    }

    const card = wormCardById(cardId);
    if (!card) {
      return { nextState: current, changed: false, message: "Unknown cape selected.", meta: {} };
    }

    const maxHp = maxHpForCard(card);
    const entry = current.deck[cardId];
    const hpNow = inSickbay(current, cardId) ? healedHpForEntry(entry, card, now) : entry.currentHp;
    if (hpNow >= maxHp) {
      return { nextState: current, changed: false, message: `${card.heroName} is already at full health.`, meta: {} };
    }
    const maxSlots = safeSickbaySlots(action);
    if (!inSickbay(current, cardId) && (current.sickbayCardIds || []).length >= maxSlots) {
      return { nextState: current, changed: false, message: "All Sickbay slots are occupied.", meta: {} };
    }

    const nextDeck = {
      ...current.deck,
      [cardId]: {
        ...entry,
        currentHp: hpNow,
        sickbaySince: now,
      },
    };

    const nextSickbayIds = inSickbay(current, cardId)
      ? (current.sickbayCardIds || []).slice()
      : [...(current.sickbayCardIds || []), cardId];
    const next = {
      ...current,
      deck: nextDeck,
      sickbayCardIds: nextSickbayIds,
    };

    return {
      nextState: next,
      changed: true,
      message: `${card.heroName} moved to Sickbay.`,
      meta: { sickbayCardId: cardId },
    };
  }

  if (action.type === "worm01-sickbay-remove") {
    const cardId = String(action.cardId || "").trim();
    if (!(current.sickbayCardIds || []).length) {
      return { nextState: current, changed: false, message: "Sickbay is already empty.", meta: {} };
    }
    const targetCardId = cardId && inSickbay(current, cardId)
      ? cardId
      : current.sickbayCardIds[0];

    const card = wormCardById(targetCardId);
    const entry = card ? current.deck[targetCardId] : null;
    const nextDeck = { ...current.deck };
    if (card && entry) {
      nextDeck[targetCardId] = {
        ...entry,
        currentHp: healedHpForEntry(entry, card, now),
        sickbaySince: 0,
      };
    }

    return {
      nextState: {
        ...current,
        deck: nextDeck,
        sickbayCardIds: removeFromSickbayIds(current, targetCardId),
      },
      changed: true,
      message: "Sickbay slot cleared.",
      meta: {},
    };
  }

  if (action.type === "worm02-claim-outcome") {
    const mode = String(action.mode || "").trim().toLowerCase();
    const winner = String(action.winner || "").trim().toLowerCase();
    const difficulty = String(action.difficulty || "easy").trim().toLowerCase();
    const playerResults = Array.isArray(action.playerResults) ? action.playerResults : [];
    const enemyRarities = Array.isArray(action.enemyRarities) ? action.enemyRarities : [];
    let next = applyOutcomeToDeck(current, playerResults, now);

    let reward = 0;
    let firstWinDifficulty = "";
    let bossFirstClear = false;
    if (mode === "normal" && winner === "player") {
      const baseReward = computeArenaReward(enemyRarities);
      const cloutMultiplier = Math.max(1, safeNumber(action.cloutMultiplier, 1));
      reward = Number((baseReward * battleDifficultyMultiplier(difficulty) * cloutMultiplier).toFixed(2));
      next = {
        ...next,
        clout: Number((next.clout + reward).toFixed(2)),
      };
      if (["easy", "medium", "hard"].includes(difficulty) && !next.arenaFirstWinsByDifficulty[difficulty]) {
        firstWinDifficulty = difficulty;
        next = {
          ...next,
          arenaFirstWinsByDifficulty: {
            ...next.arenaFirstWinsByDifficulty,
            [difficulty]: true,
          },
        };
      }
    }

    if (mode === "boss" && winner === "player") {
      const bossCloutReward = Math.max(0, Number(action.bossCloutReward) || 0);
      bossFirstClear = !next.arenaBossCleared;
      next = {
        ...next,
        arenaBossCleared: true,
        clout: Number((next.clout + bossCloutReward).toFixed(2)),
      };
      reward = bossCloutReward;
    }

    if (winner === "player") {
      return {
        nextState: next,
        changed: true,
        message: reward > 0 ? `Arena victory. +${reward} Clout.` : "Arena victory.",
        meta: { reward, firstWinDifficulty, bossFirstClear },
      };
    }

    return {
      nextState: next,
      changed: true,
      message: "Defeat recorded. No Clout awarded.",
      meta: { reward: 0 },
    };
  }

  if (action.type === "worm-apply-battle-results") {
    const playerResults = Array.isArray(action.playerResults) ? action.playerResults : [];
    const next = applyOutcomeToDeck(current, playerResults, now);
    return {
      nextState: next,
      changed: true,
      message: "",
      meta: {},
    };
  }

  if (action.type === "worm-sacrifice-cape") {
    const cardId = String(action.cardId || "").trim();
    if (!cardId || !Object.prototype.hasOwnProperty.call(current.deck, cardId)) {
      return {
        nextState: current,
        changed: false,
        message: "Selected cape is not in your deck.",
        meta: {},
      };
    }

    const totalOwned = Object.values(current.deck).reduce(
      (sum, deckEntry) => sum + Math.max(1, Math.floor(Number(deckEntry && deckEntry.copies ? deckEntry.copies : 1))),
      0,
    );
    if (totalOwned < 3) {
      return {
        nextState: current,
        changed: false,
        message: "You need at least 3 capes before a sacrifice is allowed.",
        meta: {},
      };
    }

    const card = wormCardById(cardId);
    const entry = current.deck[cardId];
    if (!card || !entry) {
      return {
        nextState: current,
        changed: false,
        message: "Unable to resolve selected cape.",
        meta: {},
      };
    }

    const nextDeck = { ...current.deck };
    if (Number(entry.copies || 1) > 1) {
      nextDeck[cardId] = {
        ...entry,
        copies: Math.max(1, Math.floor(Number(entry.copies || 1)) - 1),
      };
    } else {
      delete nextDeck[cardId];
    }

    const nextSickbayCardIds = removeFromSickbayIds(current, cardId);
    return {
      nextState: {
        ...current,
        deck: nextDeck,
        sickbayCardIds: nextSickbayCardIds,
      },
      changed: true,
      message: `${card.heroName} is sacrificed to the lattice.`,
      meta: {
        sacrificedCardId: cardId,
      },
    };
  }

  return {
    nextState: current,
    changed: false,
    message: "",
    meta: {},
  };
}

export { BASIC_HIRE_COST, BASIC_WINDOW_MAX_RARITY, SICKBAY_HEAL_FRACTION_PER_MINUTE };
