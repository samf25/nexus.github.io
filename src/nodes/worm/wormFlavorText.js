export const WORM_ACTION_TYPES = Object.freeze({
  attack: "attack",
  defense: "defense",
  info: "info",
  manipulation: "manipulation",
  speed: "speed",
  stealth: "stealth",
});

const ACTION_TYPE_LABELS = Object.freeze({
  [WORM_ACTION_TYPES.attack]: "Attack",
  [WORM_ACTION_TYPES.defense]: "Defense",
  [WORM_ACTION_TYPES.info]: "Info",
  [WORM_ACTION_TYPES.manipulation]: "Manipulation",
  [WORM_ACTION_TYPES.speed]: "Speed",
  [WORM_ACTION_TYPES.stealth]: "Stealth",
});

const FALLBACK_ACTION_TEMPLATES = Object.freeze({
  attack: Object.freeze({
    success: [
      "channels {power} to strike {target}{amountClause}.",
      "drives {power} into {target}{amountClause}.",
      "unleashes {power} and lands the hit on {target}{amountClause}.",
    ],
    fail: [
      "channels {power}, but the attack misses.",
      "lashes out with {power}, but fails to connect.",
      "commits {power}, but the opening closes.",
    ],
  }),
  defense: Object.freeze({
    success: [
      "anchors {power} to block {target}{amountClause}.",
      "raises {power} and absorbs the pressure{amountClause}.",
      "holds {power} steady and blunts the blow{amountClause}.",
    ],
    fail: [
      "tries to brace with {power}, but the guard breaks.",
      "sets {power} defensively, but gets breached.",
      "leans on {power}, but cannot hold the line.",
    ],
  }),
  info: Object.freeze({
    success: [
      "focuses {power} to read {target}{amountClause}.",
      "uses {power} to reveal key intel{amountClause}.",
      "scans through {power} and spots the opening.",
    ],
    fail: [
      "probes with {power}, but the signal is muddy.",
      "reaches with {power}, but gets incomplete intel.",
      "attempts a read with {power}, but finds no clear thread.",
    ],
  }),
  manipulation: Object.freeze({
    success: [
      "threads {power} through the field and shifts {target}{amountClause}.",
      "uses {power} to force {target} out of position{amountClause}.",
      "bends momentum with {power} and controls the exchange.",
    ],
    fail: [
      "tries to shape the fight with {power}, but loses control.",
      "pushes {power} into the field, but nothing takes hold.",
      "attempts to redirect with {power}, but the move collapses.",
    ],
  }),
  speed: Object.freeze({
    success: [
      "bursts with {power} and beats {target} to the play.",
      "channels {power} into movement and seizes tempo.",
      "accelerates with {power} and slips past pressure.",
    ],
    fail: [
      "kicks into {power}, but the burst is late.",
      "pushes {power} for speed, but gets checked.",
      "tries to surge with {power}, but loses momentum.",
    ],
  }),
  stealth: Object.freeze({
    success: [
      "veils with {power} and disappears from {target}'s read.",
      "uses {power} to erase traces and stay unseen.",
      "folds into {power} and bypasses detection.",
    ],
    fail: [
      "leans on {power} to hide, but gets spotted.",
      "attempts concealment with {power}, but leaves a tell.",
      "fades with {power}, but the cover breaks.",
    ],
  }),
});

function safeText(value, fallback = "") {
  const text = String(value == null ? "" : value).trim();
  return text ? text : fallback;
}

function normalizeActionType(actionType) {
  const normalizedType = safeText(actionType, WORM_ACTION_TYPES.info).toLowerCase();
  return Object.prototype.hasOwnProperty.call(FALLBACK_ACTION_TEMPLATES, normalizedType)
    ? normalizedType
    : WORM_ACTION_TYPES.info;
}

function formatPower(power) {
  const text = safeText(power, "their power");
  return text;
}

function formatTarget(targetName, actorName) {
  const actor = safeText(actorName).toLowerCase();
  const target = safeText(targetName, "the opponent");
  if (actor && target.toLowerCase() === actor) {
    return "the opponent";
  }
  return target;
}

function formatAmount(amount) {
  if (amount == null || amount === "") {
    return "";
  }

  if (typeof amount === "number" && Number.isFinite(amount)) {
    return String(amount);
  }

  const text = String(amount).trim();
  return text ? text : "";
}

function buildAmountClause(actionType, success, amount) {
  const amountText = formatAmount(amount);
  if (!amountText) {
    return "";
  }

  if (actionType === WORM_ACTION_TYPES.attack) {
    return ` for ${amountText}`;
  }

  if (actionType === WORM_ACTION_TYPES.defense) {
    return ` by ${amountText}`;
  }

  if (actionType === WORM_ACTION_TYPES.manipulation) {
    return ` by ${amountText}`;
  }

  if (actionType === WORM_ACTION_TYPES.info && success) {
    return ` by ${amountText}`;
  }

  return "";
}

function pickVariant(variants, rng) {
  const list = Array.isArray(variants) && variants.length > 0 ? variants : ["channels {power}."];
  const randomValue = typeof rng === "function" ? rng() : Math.random();
  const normalized = Number.isFinite(randomValue) ? randomValue : 0;
  const index = Math.min(list.length - 1, Math.max(0, Math.floor(normalized * list.length)));
  return list[index];
}

function applyTokens(template, values) {
  return template
    .split("{power}").join(values.power)
    .split("{target}").join(values.target)
    .split("{amountClause}").join(values.amountClause);
}

function ensureSentence(text) {
  const compact = String(text || "").replace(/\s+/g, " ").trim();
  if (!compact) {
    return "channels their power.";
  }
  return /[.!?]$/.test(compact) ? compact : `${compact}.`;
}

function buildActionPrefix(name, actionKey) {
  const actionLabel = ACTION_TYPE_LABELS[actionKey] || ACTION_TYPE_LABELS[WORM_ACTION_TYPES.info];
  return `${name} | ${actionLabel}: `;
}

export function buildWormActionFlavor({ card = {}, actionType, success, targetName, amount, rng } = {}) {
  const actionKey = normalizeActionType(actionType);
  const isSuccess = Boolean(success);
  const cardName = safeText(card && card.name, "The worm");
  const powerText = safeText(card && (card.power || card.powerFull), "their power");
  const fallbackTemplates = FALLBACK_ACTION_TEMPLATES[actionKey][isSuccess ? "success" : "fail"];
  const template = pickVariant(fallbackTemplates, rng);

  const values = {
    power: formatPower(powerText),
    target: formatTarget(targetName, cardName),
    amountClause: buildAmountClause(actionKey, isSuccess, amount),
  };

  const body = ensureSentence(applyTokens(template, values));
  return `${buildActionPrefix(cardName, actionKey)}${body}`;
}
