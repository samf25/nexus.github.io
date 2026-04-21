import { powerSummaryForCape } from "./wormPowerSummaries.js";

const WORM_DATA_PATH = "src/nodes/worm/WormPowerRanks.csv";

const NORMALIZED_COLUMNS = Object.freeze([
  "Hero name",
  "Power",
  "Attack",
  "Defense",
  "Endurance",
  "Information Gathering",
  "Manipulation",
  "Range",
  "Speed",
  "Stealth",
  "Rarity",
]);

let cachedCards = null;

function safeText(value) {
  return String(value == null ? "" : value).trim();
}

function toInt(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 0;
  }
  return Math.max(0, Math.round(numeric));
}

function toRarity(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 0;
  }
  return Math.max(0, Math.round(numeric * 10) / 10);
}

function csvEscape(value) {
  const text = String(value == null ? "" : value);
  if (text.includes(",") || text.includes("\"") || text.includes("\n")) {
    return `"${text.replaceAll("\"", "\"\"")}"`;
  }
  return text;
}

function parseCsvRows(text) {
  const rows = [];
  let field = "";
  let row = [];
  let inQuotes = false;

  const pushField = () => {
    row.push(field);
    field = "";
  };

  const pushRow = () => {
    if (row.length === 1 && row[0] === "") {
      row = [];
      return;
    }
    rows.push(row);
    row = [];
  };

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === "\"") {
      if (inQuotes && next === "\"") {
        field += "\"";
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      pushField();
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        index += 1;
      }
      pushField();
      pushRow();
      continue;
    }

    field += char;
  }

  if (field !== "" || row.length > 0) {
    pushField();
    pushRow();
  }

  return rows;
}

function rarityTierForValue(value, thresholds) {
  if (value >= thresholds.legendary) {
    return "legendary";
  }
  if (value >= thresholds.epic) {
    return "epic";
  }
  if (value >= thresholds.rare) {
    return "rare";
  }
  if (value >= thresholds.uncommon) {
    return "uncommon";
  }
  return "common";
}

function quantile(sortedValues, portion) {
  if (!sortedValues.length) {
    return 0;
  }
  const clamped = Math.min(1, Math.max(0, Number(portion) || 0));
  const index = Math.round((sortedValues.length - 1) * clamped);
  return sortedValues[index];
}

function buildCardsFromRows(rows) {
  if (!Array.isArray(rows) || rows.length < 2) {
    return [];
  }

  const header = rows[0].map((value) => safeText(value));
  const indexByName = Object.fromEntries(header.map((name, index) => [name, index]));

  const cards = rows
    .slice(1)
    .map((row, index) => {
      const field = (name) => row[indexByName[name]] ?? "";
      const heroName = safeText(field("Cape"));
      if (!heroName) {
        return null;
      }
      const fullPower = safeText(field("Power"));

      return {
        id: `worm-${String(index + 1).padStart(3, "0")}`,
        heroName,
        power: safeText(powerSummaryForCape(heroName, fullPower)),
        powerFull: fullPower,
        attack: toInt(field("Attack Potency")),
        defense: toInt(field("Defense")),
        endurance: toInt(field("Endurance")),
        info: toInt(field("Information Gathering")),
        manipulation: toInt(field("Manipulation")),
        range: toInt(field("Range")),
        speed: toInt(field("Speed")),
        stealth: toInt(field("Stealth")),
        rarity: toRarity(field("Geometric Average")),
      };
    })
    .filter(Boolean);

  const rarityValues = cards.map((card) => card.rarity).sort((left, right) => left - right);
  const thresholds = {
    uncommon: quantile(rarityValues, 0.2),
    rare: quantile(rarityValues, 0.45),
    epic: quantile(rarityValues, 0.7),
    legendary: quantile(rarityValues, 0.88),
  };

  return cards.map((card) => ({
    ...card,
    rarityTier: rarityTierForValue(card.rarity, thresholds),
  }));
}

function readWormCsvSync() {
  if (typeof XMLHttpRequest === "undefined") {
    return "";
  }

  const request = new XMLHttpRequest();
  request.open("GET", WORM_DATA_PATH, false);
  request.send(null);

  if (request.status >= 200 && request.status < 300) {
    return String(request.responseText || "");
  }
  return "";
}

export function loadWormCardCatalog() {
  if (Array.isArray(cachedCards)) {
    return cachedCards;
  }

  const csvText = readWormCsvSync();
  const rows = parseCsvRows(csvText);
  cachedCards = Object.freeze(buildCardsFromRows(rows).map((card) => Object.freeze(card)));
  return cachedCards;
}

export function wormCardById(cardId) {
  const target = safeText(cardId);
  if (!target) {
    return null;
  }
  return loadWormCardCatalog().find((card) => card.id === target) || null;
}

export function normalizedWormCsvColumns() {
  return NORMALIZED_COLUMNS.slice();
}

export function exportNormalizedWormCsv(cards = loadWormCardCatalog()) {
  const header = NORMALIZED_COLUMNS.map((column) => csvEscape(column)).join(",");
  const lines = cards.map((card) =>
    [
      card.heroName,
      card.power,
      card.attack,
      card.defense,
      card.endurance,
      card.info,
      card.manipulation,
      card.range,
      card.speed,
      card.stealth,
      card.rarity.toFixed(1),
    ]
      .map((field) => csvEscape(field))
      .join(","),
  );

  return `${header}\n${lines.join("\n")}\n`;
}
