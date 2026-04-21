import { getCapeActionFlavorTemplates } from "./wormPowerSummaries.js";

export const WORM_ACTION_TYPES = Object.freeze({
  attack: "attack",
  defense: "defense",
  info: "info",
  manipulation: "manipulation",
  speed: "speed",
  stealth: "stealth",
});

const FALLBACK_ACTION_TEMPLATES = Object.freeze({
  attack: Object.freeze({
    success: [
      "{name} drives {power} into {target}{amountClause}.",
      "With {power}, {name} breaks through {target}{amountClause}.",
      "{name}'s {power} lands cleanly on {target}{amountClause}.",
    ],
    fail: [
      "{name} commits {power}, but the blow slips wide.",
      "The push of {power} from {name} misses its opening.",
      "{name}'s {power} falters before it reaches the mark.",
    ],
  }),
  defense: Object.freeze({
    success: [
      "{name} raises {power} and turns aside the threat from {target}{amountClause}.",
      "With {power}, {name} holds the line against {target}{amountClause}.",
      "{name} lets {power} settle into a steady guard, softening the strike{amountClause}.",
    ],
    fail: [
      "{name}'s {power} wavers, and the defense cracks open.",
      "For a breath, {power} shields {name}, then slips away.",
      "{name} cannot keep {power} locked in place, and the guard fails.",
    ],
  }),
  info: Object.freeze({
    success: [
      "{name} reads the field with {power}, and {target} is laid bare.",
      "Through {power}, {name} finds the shape of {target}{amountClause}.",
      "{name} uses {power} to uncover what was hidden in the haze.",
    ],
    fail: [
      "{name} reaches for meaning, but {power} returns only a blur.",
      "The signs resist, and {name}'s {power} reveals little.",
      "{power} brushes past the truth, leaving {name} with a false lead.",
    ],
  }),
  manipulation: Object.freeze({
    success: [
      "{name} bends the moment with {power}, pressing {target}{amountClause}.",
      "Under {power}, {name} twists the flow around {target}{amountClause}.",
      "{name} threads {power} through the field and shifts {target}{amountClause}.",
    ],
    fail: [
      "{name} tries to shape the field, but {power} slips loose.",
      "The weave resists {name}, and {power} goes unanswered.",
      "{power} fails to take hold, leaving {name}'s intent scattered.",
    ],
  }),
  speed: Object.freeze({
    success: [
      "{name} rides {power} into motion and slips past {target}.",
      "With {power}, {name} moves before {target} can answer.",
      "{power} sharpens {name}'s stride, and the opening is seized.",
    ],
    fail: [
      "{name} calls on {power}, but the burst comes too late.",
      "The rush falters, and {power} leaves {name} a step behind.",
      "{name} cannot keep {power} moving, and the pace breaks.",
    ],
  }),
  stealth: Object.freeze({
    success: [
      "{name} folds into the hush, and {power} keeps {target} from noticing.",
      "Wrapped in {power}, {name} slips cleanly past {target}.",
      "{power} dulls every trace as {name} vanishes into the shadows.",
    ],
    fail: [
      "{name}'s {power} leaves a trace, and the concealment fails.",
      "The shadows do not hold, and {power} exposes {name}.",
      "{name} tries to vanish, but {power} flickers out before it can hide the trail.",
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
  const text = safeText(power, "unnamed power");
  return text;
}

function formatTarget(targetName) {
  return safeText(targetName, "the target");
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
  const list = Array.isArray(variants) && variants.length > 0 ? variants : ["{name} moves with {power}."];
  const randomValue = typeof rng === "function" ? rng() : Math.random();
  const normalized = Number.isFinite(randomValue) ? randomValue : 0;
  const index = Math.min(list.length - 1, Math.max(0, Math.floor(normalized * list.length)));
  return list[index];
}

function applyTokens(template, values) {
  return template
    .split("{name}").join(values.name)
    .split("{power}").join(values.power)
    .split("{target}").join(values.target)
    .split("{amountClause}").join(values.amountClause);
}

function ensureSentence(text) {
  const compact = String(text || "").replace(/\s+/g, " ").trim();
  if (!compact) {
    return "The worm stirs.";
  }
  return /[.!?]$/.test(compact) ? compact : `${compact}.`;
}

export function buildWormActionFlavor({ card = {}, actionType, success, targetName, amount, rng } = {}) {
  const actionKey = normalizeActionType(actionType);
  const isSuccess = Boolean(success);
  const cardName = safeText(card && card.name, "The worm");
  const fallbackPower = safeText(card && (card.powerFull || card.power), "");
  const flavorPack = getCapeActionFlavorTemplates(cardName, actionKey, fallbackPower);
  const fallbackTemplates = FALLBACK_ACTION_TEMPLATES[actionKey][isSuccess ? "success" : "fail"];
  const templates =
    flavorPack &&
    typeof flavorPack === "object" &&
    Array.isArray(flavorPack[isSuccess ? "success" : "fail"]) &&
    flavorPack[isSuccess ? "success" : "fail"].length > 0
      ? flavorPack[isSuccess ? "success" : "fail"]
      : fallbackTemplates;
  const template = pickVariant(templates, rng);

  const values = {
    name: cardName,
    power: formatPower(card && card.power),
    target: formatTarget(targetName),
    amountClause: buildAmountClause(actionKey, isSuccess, amount),
  };

  return ensureSentence(applyTokens(template, values));
}
