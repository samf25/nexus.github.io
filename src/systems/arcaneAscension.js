const REGION_GLYPHS = Object.freeze(["crd", "worm", "dcc", "aa"]);

const ENHANCEMENT_GLYPHS = Object.freeze([
  "force-lattice",
  "precision-mark",
  "resonance-loop",
  "vital-knot",
  "swift-circuit",
  "merchant-sigil",
  "overflow-channel",
  "stability-anchor",
  "echo-ward",
  "surge-glyph",
]);

const GLYPH_TEMPLATES = Object.freeze({
  region: Object.freeze({
    crd: Object.freeze([[0.12, 0.86], [0.25, 0.6], [0.45, 0.4], [0.72, 0.2], [0.86, 0.32], [0.64, 0.58], [0.41, 0.78], [0.2, 0.9]]),
    worm: Object.freeze([[0.14, 0.2], [0.32, 0.18], [0.46, 0.32], [0.55, 0.54], [0.7, 0.72], [0.84, 0.84], [0.62, 0.8], [0.45, 0.66], [0.36, 0.42], [0.18, 0.28]]),
    dcc: Object.freeze([[0.15, 0.18], [0.85, 0.18], [0.74, 0.36], [0.67, 0.53], [0.57, 0.72], [0.43, 0.72], [0.33, 0.53], [0.26, 0.36], [0.15, 0.18]]),
    aa: Object.freeze([[0.14, 0.78], [0.31, 0.24], [0.52, 0.58], [0.72, 0.22], [0.86, 0.78], [0.67, 0.62], [0.52, 0.82], [0.33, 0.62], [0.14, 0.78]]),
  }),
  enhancement: Object.freeze({
    "force-lattice": Object.freeze([[0.15, 0.15], [0.85, 0.15], [0.85, 0.85], [0.15, 0.85], [0.15, 0.15], [0.5, 0.5], [0.85, 0.85]]),
    "precision-mark": Object.freeze([[0.15, 0.85], [0.5, 0.15], [0.85, 0.85], [0.5, 0.56], [0.15, 0.85]]),
    "resonance-loop": Object.freeze([[0.22, 0.5], [0.34, 0.28], [0.56, 0.2], [0.75, 0.34], [0.82, 0.56], [0.67, 0.76], [0.42, 0.8], [0.24, 0.64], [0.22, 0.5]]),
    "vital-knot": Object.freeze([[0.2, 0.2], [0.8, 0.8], [0.6, 0.5], [0.8, 0.2], [0.2, 0.8], [0.4, 0.5], [0.2, 0.2]]),
    "swift-circuit": Object.freeze([[0.16, 0.62], [0.35, 0.28], [0.55, 0.48], [0.72, 0.18], [0.84, 0.4], [0.62, 0.72], [0.42, 0.58], [0.26, 0.82]]),
    "merchant-sigil": Object.freeze([[0.22, 0.2], [0.78, 0.2], [0.78, 0.6], [0.5, 0.82], [0.22, 0.6], [0.22, 0.2], [0.5, 0.5], [0.78, 0.6]]),
    "overflow-channel": Object.freeze([[0.14, 0.3], [0.34, 0.2], [0.52, 0.3], [0.64, 0.48], [0.52, 0.68], [0.34, 0.8], [0.14, 0.7], [0.26, 0.52], [0.42, 0.5], [0.6, 0.52], [0.82, 0.7]]),
    "stability-anchor": Object.freeze([[0.5, 0.15], [0.5, 0.8], [0.32, 0.56], [0.5, 0.8], [0.68, 0.56], [0.5, 0.8]]),
    "echo-ward": Object.freeze([[0.2, 0.8], [0.22, 0.22], [0.78, 0.22], [0.8, 0.8], [0.6, 0.62], [0.4, 0.62], [0.2, 0.8]]),
    "surge-glyph": Object.freeze([[0.18, 0.72], [0.42, 0.18], [0.58, 0.46], [0.74, 0.2], [0.82, 0.42], [0.64, 0.82], [0.48, 0.56], [0.34, 0.8]]),
  }),
});

const REGION_GLYPH_LABELS = Object.freeze({
  crd: "Cradle Region Glyph",
  worm: "Worm Region Glyph",
  dcc: "Dungeon Crawler Carl Region Glyph",
  aa: "Arcane Ascension Region Glyph",
});

const REGION_GLYPH_ALIASES = Object.freeze({
  cradle: "crd",
  crd: "crd",
  worm: "worm",
  dcc: "dcc",
  "dungeoncrawlercarl": "dcc",
  "dungeon crawler carl": "dcc",
  aa: "aa",
  "arcane ascension": "aa",
  "arcaneascension": "aa",
});

function safeFinite(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function safeText(value) {
  return String(value || "").trim();
}

function readableGlyphName(glyphId) {
  return safeText(glyphId)
    .split("-")
    .map((part) => (part ? `${part[0].toUpperCase()}${part.slice(1)}` : ""))
    .join(" ")
    .trim();
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function uniqueLowerTextList(values, fallback = []) {
  const source = Array.isArray(values) ? values : fallback;
  const result = [];
  const seen = new Set();
  for (const value of source) {
    const key = safeText(value).toLowerCase();
    if (!key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(key);
  }
  return result;
}

function canonicalGlyphId(glyphType, glyphId) {
  const normalizedType = safeText(glyphType).toLowerCase() === "enhancement" ? "enhancement" : "region";
  const raw = safeText(glyphId).toLowerCase();
  if (!raw) {
    return "";
  }

  if (normalizedType === "region") {
    const aliasHit = REGION_GLYPH_ALIASES[raw];
    if (aliasHit && REGION_GLYPHS.includes(aliasHit)) {
      return aliasHit;
    }
    const compact = raw.replace(/[^a-z0-9]/g, "");
    const compactHit = REGION_GLYPH_ALIASES[compact];
    if (compactHit && REGION_GLYPHS.includes(compactHit)) {
      return compactHit;
    }
    return REGION_GLYPHS.includes(raw) ? raw : "";
  }

  const normalized = raw.replace(/\s+/g, "-");
  return ENHANCEMENT_GLYPHS.includes(normalized) ? normalized : "";
}

function hashText(value) {
  const text = safeText(value);
  let hash = 2166136261 >>> 0;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
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

function randomPick(rng, values) {
  const list = Array.isArray(values) ? values : [];
  if (!list.length) {
    return "";
  }
  const index = Math.floor(rng() * list.length);
  return safeText(list[index]).toLowerCase();
}

function withArcaneSystem(state, arcaneSystem) {
  const sourceState = state && typeof state === "object" ? state : {};
  const systems = sourceState.systems && typeof sourceState.systems === "object" ? sourceState.systems : {};
  return {
    ...sourceState,
    systems: {
      ...systems,
      arcane: normalizeArcaneSystemState(arcaneSystem, Date.now()),
    },
  };
}

function nextStarterRegionGlyphs(now) {
  const rng = createRng(hashText(`starter-region:${Math.floor(now / 86400000)}`));
  const pool = REGION_GLYPHS.slice();
  const picked = [];
  while (pool.length > 0 && picked.length < 2) {
    const index = Math.floor(rng() * pool.length);
    picked.push(pool[index]);
    pool.splice(index, 1);
  }
  return picked;
}

function nextStarterEnhancementGlyphs(now) {
  const rng = createRng(hashText(`starter-enh:${Math.floor(now / 86400000)}`));
  const pool = ENHANCEMENT_GLYPHS.slice();
  const picked = [];
  while (pool.length > 0 && picked.length < 3) {
    const index = Math.floor(rng() * pool.length);
    picked.push(pool[index]);
    pool.splice(index, 1);
  }
  return picked;
}

export function defaultArcaneSystemState(now = Date.now()) {
  return {
    manaCrystals: 0,
    totalSpentAtCourt: 0,
    attunements: {
      enchanter: false,
    },
    grimoire: {
      regionGlyphs: [],
      enhancementGlyphs: [],
      starterGranted: false,
      pullCount: 0,
    },
    workshop: {
      manaCurrent: 100,
      manaMax: 100,
      manaRegenPerHour: 100,
      lastManaTickAt: Math.floor(safeFinite(now, Date.now())),
      totalManaSpent: 0,
      equipSlotCount: 2,
      equippedLootIds: [],
    },
    crafting: {
      totalCrafts: 0,
      successfulCrafts: 0,
      nonJunkCrafts: 0,
      lastWorkshopResult: null,
    },
    bonuses: {
      accuracyFlat: 0,
      manaRegenPct: 0,
      buyDiscountPct: 0,
      sellBonusPct: 0,
      extraLootSlots: 0,
    },
  };
}

export function normalizeArcaneSystemState(candidate, now = Date.now()) {
  const base = defaultArcaneSystemState(now);
  const source = candidate && typeof candidate === "object" ? candidate : {};
  const attunements = source.attunements && typeof source.attunements === "object" ? source.attunements : {};
  const grimoire = source.grimoire && typeof source.grimoire === "object" ? source.grimoire : {};
  const workshop = source.workshop && typeof source.workshop === "object" ? source.workshop : {};
  const bonuses = source.bonuses && typeof source.bonuses === "object" ? source.bonuses : {};
  const crafting = source.crafting && typeof source.crafting === "object" ? source.crafting : {};

  const manaMax = Math.max(100, Math.floor(safeFinite(workshop.manaMax, base.workshop.manaMax)));
  const equipSlotCount = clamp(Math.floor(safeFinite(workshop.equipSlotCount, 2)), 2, 6);

  return {
    ...base,
    manaCrystals: Math.max(0, Math.floor(safeFinite(source.manaCrystals, 0))),
    totalSpentAtCourt: Math.max(0, Math.floor(safeFinite(source.totalSpentAtCourt, 0))),
    attunements: {
      enchanter: Boolean(attunements.enchanter),
    },
    grimoire: {
      regionGlyphs: uniqueLowerTextList(grimoire.regionGlyphs)
        .map((glyph) => canonicalGlyphId("region", glyph))
        .filter((glyph) => REGION_GLYPHS.includes(glyph)),
      enhancementGlyphs: uniqueLowerTextList(grimoire.enhancementGlyphs)
        .map((glyph) => canonicalGlyphId("enhancement", glyph))
        .filter((glyph) => ENHANCEMENT_GLYPHS.includes(glyph)),
      starterGranted: Boolean(grimoire.starterGranted),
      pullCount: Math.max(0, Math.floor(safeFinite(grimoire.pullCount, 0))),
    },
    workshop: {
      manaCurrent: clamp(safeFinite(workshop.manaCurrent, manaMax), 0, manaMax),
      manaMax,
      manaRegenPerHour: Math.max(20, Math.floor(safeFinite(workshop.manaRegenPerHour, 100))),
      lastManaTickAt: Math.max(0, Math.floor(safeFinite(workshop.lastManaTickAt, now))),
      totalManaSpent: Math.max(0, Math.floor(safeFinite(workshop.totalManaSpent, 0))),
      equipSlotCount,
      equippedLootIds: uniqueLowerTextList(workshop.equippedLootIds).slice(0, equipSlotCount),
    },
    crafting: {
      totalCrafts: Math.max(0, Math.floor(safeFinite(crafting.totalCrafts, 0))),
      successfulCrafts: Math.max(0, Math.floor(safeFinite(crafting.successfulCrafts, 0))),
      nonJunkCrafts: Math.max(0, Math.floor(safeFinite(crafting.nonJunkCrafts, 0))),
      lastWorkshopResult: crafting.lastWorkshopResult && typeof crafting.lastWorkshopResult === "object"
        ? { ...crafting.lastWorkshopResult }
        : null,
    },
    bonuses: {
      accuracyFlat: Math.max(0, Math.floor(safeFinite(bonuses.accuracyFlat, 0))),
      manaRegenPct: Math.max(0, safeFinite(bonuses.manaRegenPct, 0)),
      buyDiscountPct: clamp(safeFinite(bonuses.buyDiscountPct, 0), 0, 0.5),
      sellBonusPct: clamp(safeFinite(bonuses.sellBonusPct, 0), 0, 1),
      extraLootSlots: Math.max(0, Math.floor(safeFinite(bonuses.extraLootSlots, 0))),
    },
  };
}

function toPointArray(points) {
  const source = Array.isArray(points) ? points : [];
  const normalized = source
    .map((entry) => {
      let x = NaN;
      let y = NaN;
      if (Array.isArray(entry)) {
        x = safeFinite(entry[0], NaN);
        y = safeFinite(entry[1], NaN);
      } else if (entry && typeof entry === "object") {
        x = safeFinite(entry.x, NaN);
        y = safeFinite(entry.y, NaN);
      } else {
        return null;
      }
      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        return null;
      }
      return { x: clamp(x, 0, 1), y: clamp(y, 0, 1) };
    })
    .filter(Boolean);

  if (normalized.length <= 1) {
    return normalized;
  }

  const deduped = [normalized[0]];
  for (let index = 1; index < normalized.length; index += 1) {
    const point = normalized[index];
    const previous = deduped[deduped.length - 1];
    const dx = point.x - previous.x;
    const dy = point.y - previous.y;
    if (Math.sqrt((dx * dx) + (dy * dy)) >= 0.003) {
      deduped.push(point);
    }
  }
  return deduped;
}

function pointDistance(a, b) {
  const dx = safeFinite(a.x, 0) - safeFinite(b.x, 0);
  const dy = safeFinite(a.y, 0) - safeFinite(b.y, 0);
  return Math.sqrt((dx * dx) + (dy * dy));
}

function resamplePath(path, sampleCount = 48) {
  const source = toPointArray(path);
  if (!source.length) {
    return [];
  }
  if (source.length === 1) {
    return Array.from({ length: Math.max(2, Math.floor(sampleCount)) }, () => ({ ...source[0] }));
  }

  const normalizedCount = Math.max(2, Math.floor(safeFinite(sampleCount, 48)));
  const segments = [];
  let totalLength = 0;
  for (let index = 1; index < source.length; index += 1) {
    const length = pointDistance(source[index - 1], source[index]);
    totalLength += length;
    segments.push({
      from: source[index - 1],
      to: source[index],
      length,
      cumulative: totalLength,
    });
  }

  if (totalLength <= 0.00001) {
    return Array.from({ length: normalizedCount }, () => ({ ...source[0] }));
  }

  const result = [];
  for (let step = 0; step < normalizedCount; step += 1) {
    const targetLength = (step / Math.max(1, normalizedCount - 1)) * totalLength;
    const segment = segments.find((entry) => entry.cumulative >= targetLength) || segments[segments.length - 1];
    const previousCumulative = segment.cumulative - segment.length;
    const ratio = segment.length <= 0.00001 ? 0 : clamp((targetLength - previousCumulative) / segment.length, 0, 1);
    result.push({
      x: segment.from.x + ((segment.to.x - segment.from.x) * ratio),
      y: segment.from.y + ((segment.to.y - segment.from.y) * ratio),
    });
  }
  return result;
}

function normalizePointCloud(points) {
  const cloud = Array.isArray(points) ? points : [];
  if (!cloud.length) {
    return [];
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const point of cloud) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }
  const width = Math.max(0.001, maxX - minX);
  const height = Math.max(0.001, maxY - minY);
  const scale = Math.max(width, height);
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  return cloud.map((point) => ({
    x: (point.x - centerX) / scale,
    y: (point.y - centerY) / scale,
  }));
}

function weightedSignature(points, sampleCount = 72) {
  const sampled = resamplePath(points, sampleCount);
  if (!sampled.length) {
    return [];
  }
  const anchors = [
    sampled[0],
    sampled[Math.floor(sampled.length * 0.25)],
    sampled[Math.floor(sampled.length * 0.5)],
    sampled[Math.floor(sampled.length * 0.75)],
    sampled[sampled.length - 1],
  ].filter(Boolean);
  const weightedAnchors = anchors.flatMap((point) => [point, point, point, point]);
  return normalizePointCloud([...sampled, ...weightedAnchors]);
}

function preprocessRunePointCloud(points, sampleCount = 72) {
  return weightedSignature(points, sampleCount);
}

function makeCostMatrix(left, right) {
  const a = Array.isArray(left) ? left : [];
  const b = Array.isArray(right) ? right : [];
  if (!a.length || a.length !== b.length) {
    return [];
  }
  return a.map((pointA) => (
    b.map((pointB) => pointDistance(pointA, pointB))
  ));
}

function hungarianMinCost(costMatrix) {
  const matrix = Array.isArray(costMatrix) ? costMatrix : [];
  const n = matrix.length;
  if (!n || !Array.isArray(matrix[0]) || matrix[0].length !== n) {
    return { cost: Infinity, assignment: [] };
  }

  const u = Array.from({ length: n + 1 }, () => 0);
  const v = Array.from({ length: n + 1 }, () => 0);
  const p = Array.from({ length: n + 1 }, () => 0);
  const way = Array.from({ length: n + 1 }, () => 0);

  for (let row = 1; row <= n; row += 1) {
    p[0] = row;
    const minv = Array.from({ length: n + 1 }, () => Infinity);
    const used = Array.from({ length: n + 1 }, () => false);
    let col0 = 0;

    while (true) {
      used[col0] = true;
      const row0 = p[col0];
      let delta = Infinity;
      let col1 = 0;

      for (let col = 1; col <= n; col += 1) {
        if (used[col]) {
          continue;
        }
        const cur = matrix[row0 - 1][col - 1] - u[row0] - v[col];
        if (cur < minv[col]) {
          minv[col] = cur;
          way[col] = col0;
        }
        if (minv[col] < delta) {
          delta = minv[col];
          col1 = col;
        }
      }

      for (let col = 0; col <= n; col += 1) {
        if (used[col]) {
          u[p[col]] += delta;
          v[col] -= delta;
        } else {
          minv[col] -= delta;
        }
      }
      col0 = col1;
      if (p[col0] === 0) {
        break;
      }
    }

    while (true) {
      const col1 = way[col0];
      p[col0] = p[col1];
      col0 = col1;
      if (col0 === 0) {
        break;
      }
    }
  }

  const assignment = Array.from({ length: n }, () => -1);
  for (let col = 1; col <= n; col += 1) {
    if (p[col] > 0) {
      assignment[p[col] - 1] = col - 1;
    }
  }

  let cost = 0;
  for (let row = 0; row < n; row += 1) {
    const assignedCol = assignment[row];
    if (assignedCol < 0) {
      return { cost: Infinity, assignment };
    }
    cost += matrix[row][assignedCol];
  }

  return { cost, assignment };
}

function earthMoversDistance(left, right) {
  const a = Array.isArray(left) ? left : [];
  const b = Array.isArray(right) ? right : [];
  if (!a.length || a.length !== b.length) {
    return Infinity;
  }
  const matrix = makeCostMatrix(a, b);
  const assignment = hungarianMinCost(matrix);
  if (!Number.isFinite(assignment.cost)) {
    return Infinity;
  }
  return assignment.cost / a.length;
}

function scoreFromDistance(distance) {
  if (!Number.isFinite(distance)) {
    return 0;
  }
  return clamp(1 - (distance / 1.25), 0, 1);
}

function confidenceFromDistances(bestDistance, secondDistance) {
  if (!Number.isFinite(bestDistance)) {
    return 0;
  }
  const safeSecond = Number.isFinite(secondDistance) && secondDistance > 0
    ? secondDistance
    : bestDistance + 0.25;
  const separation = clamp((safeSecond - bestDistance) / Math.max(0.000001, safeSecond), 0, 1);
  const distanceQuality = Math.exp(-Math.pow(bestDistance / 0.065, 2));
  return clamp(distanceQuality * (0.55 + (0.45 * separation)), 0, 1);
}

export function normalizeRuneStroke(strokePoints) {
  return preprocessRunePointCloud(strokePoints, 72);
}

export function scoreRuneMatch({ strokePoints, glyphTemplatePoints } = {}) {
  const left = preprocessRunePointCloud(strokePoints, 72);
  const right = preprocessRunePointCloud(glyphTemplatePoints, 72);
  return scoreFromDistance(earthMoversDistance(left, right));
}

export function matchRuneAgainstGrimoire({ strokePoints, glyphType, ownedGlyphs } = {}) {
  const normalizedType = safeText(glyphType).toLowerCase() === "enhancement" ? "enhancement" : "region";
  const templates = GLYPH_TEMPLATES[normalizedType] || {};
  const ownedSet = new Set(
    uniqueLowerTextList(ownedGlyphs)
      .map((glyph) => canonicalGlyphId(normalizedType, glyph))
      .filter(Boolean),
  );
  const candidates = Object.keys(templates).filter((key) => ownedSet.has(key));
  if (!candidates.length) {
    return {
      bestMatch: "",
      secondMatch: "",
      accuracyScore: 0,
      ranked: [],
      insufficientStroke: false,
      noCandidates: true,
    };
  }

  const normalizedStroke = preprocessRunePointCloud(strokePoints, 72);
  if (normalizedStroke.length < 4) {
    return {
      bestMatch: "",
      secondMatch: "",
      accuracyScore: 0,
      ranked: [],
      insufficientStroke: true,
      noCandidates: false,
    };
  }

  const ranked = candidates
    .map((glyphId) => ({
      glyphId,
      distance: earthMoversDistance(
        normalizedStroke,
        preprocessRunePointCloud(templates[glyphId] || [], 72),
      ),
    }))
    .filter((entry) => Number.isFinite(entry.distance))
    .map((entry) => ({
      ...entry,
      score: scoreFromDistance(entry.distance),
    }))
    .sort((left, right) => left.distance - right.distance);

  const best = ranked[0] || { glyphId: "", score: 0 };
  const second = ranked[1] || { glyphId: "", score: 0 };
  const bestDistance = Number.isFinite(best.distance) ? best.distance : Infinity;
  const secondDistance = Number.isFinite(second.distance) ? second.distance : (bestDistance + 0.25);
  return {
    bestMatch: best.glyphId || "",
    secondMatch: second.glyphId || "",
    accuracyScore: confidenceFromDistances(bestDistance, secondDistance),
    ranked,
    insufficientStroke: false,
    noCandidates: false,
  };
}

export function estimateAppraisal({ trueAccuracy, totalCrafts, seed = 0 } = {}) {
  const accuracy = clamp(safeFinite(trueAccuracy, 0), 0, 1);
  const crafts = Math.max(0, Math.floor(safeFinite(totalCrafts, 0)));
  const jitterMagnitude = clamp(0.22 / Math.sqrt(crafts + 1), 0.025, 0.22);
  const rng = createRng((hashText(`${accuracy}:${crafts}:${seed}`) + 17) >>> 0);
  const noise = (rng() * 2) - 1;
  return {
    estimatedAccuracy: clamp(accuracy + (noise * jitterMagnitude), 0, 1),
    jitterMagnitude,
  };
}

export function enhancementDescriptor(enhancementGlyph) {
  const key = safeText(enhancementGlyph).toLowerCase();
  const table = {
    "force-lattice": { key: "aa_accuracy_flat", type: "flat", base: 2 },
    "precision-mark": { key: "aa_accuracy_flat", type: "flat", base: 3 },
    "resonance-loop": { key: "aa_mana_regen_pct", type: "flat", base: 0.06 },
    "vital-knot": { key: "aa_mana_max_flat", type: "flat", base: 12 },
    "swift-circuit": { key: "aa_mana_regen_pct", type: "flat", base: 0.08 },
    "merchant-sigil": { key: "aa_buy_discount_pct", type: "flat", base: 0.03 },
    "overflow-channel": { key: "aa_mana_max_flat", type: "flat", base: 15 },
    "stability-anchor": { key: "aa_extra_workshop_slot", type: "flat", base: 1 },
    "echo-ward": { key: "aa_sell_bonus_pct", type: "flat", base: 0.06 },
    "surge-glyph": { key: "aa_sell_bonus_pct", type: "flat", base: 0.08 },
  };
  return table[key] || { key: "aa_accuracy_flat", type: "flat", base: 2 };
}

export function resolveWorkshopCraftOutcome({
  regionGlyph,
  enhancementGlyph,
  accuracy,
  manaInvested,
  manaMax,
  totalCrafts,
  seed = 0,
} = {}) {
  const region = safeText(regionGlyph).toLowerCase();
  const enhancement = safeText(enhancementGlyph).toLowerCase();
  const trueAccuracy = clamp(safeFinite(accuracy, 0), 0, 1);
  const maxMana = Math.max(1, safeFinite(manaMax, 100));
  const invested = clamp(safeFinite(manaInvested, 0), 0, maxMana);
  const manaRatio = clamp(invested / maxMana, 0, 1);
  const craftCount = Math.max(0, Math.floor(safeFinite(totalCrafts, 0)));
  const junkChance = clamp(0.86 - (trueAccuracy * 0.5) - (manaRatio * 0.42), 0.18, 0.95);
  const rarityBias = clamp((trueAccuracy * 1.15) + (manaRatio * 0.85) - 0.5, 0, 2.2);
  const qualityScore = clamp((trueAccuracy * 0.75) + (manaRatio * 0.25), 0, 1);
  const rng = createRng((hashText(`${region}:${enhancement}:${trueAccuracy}:${invested}:${craftCount}`) + (Number(seed) || 0)) >>> 0);
  const isJunk = rng() < junkChance;
  return {
    regionGlyph: region,
    enhancementGlyph: enhancement,
    isJunk,
    junkChance,
    rarityBias,
    qualityScore,
    powerScalar: 0.7 + (qualityScore * 0.8),
    descriptor: enhancementDescriptor(enhancement),
  };
}

export function consumeWorkshopMana(state, amount, now = Date.now()) {
  const spend = Math.max(0, Math.floor(safeFinite(amount, 0)));
  const arcane = normalizeArcaneSystemState(state && state.systems ? state.systems.arcane : {}, now);
  const ticked = tickArcaneMana(arcane, now);
  if (ticked.workshop.manaCurrent < spend) {
    return {
      nextState: state,
      changed: false,
      message: "Not enough workshop mana.",
    };
  }
  const totalSpent = ticked.workshop.totalManaSpent + spend;
  const gainedCap = Math.floor(totalSpent / 20);
  const nextMax = 100 + gainedCap;
  const nextArcane = {
    ...ticked,
    workshop: {
      ...ticked.workshop,
      manaCurrent: clamp(ticked.workshop.manaCurrent - spend, 0, nextMax),
      totalManaSpent: totalSpent,
      manaMax: nextMax,
    },
  };
  return {
    nextState: withArcaneSystem(state, nextArcane),
    changed: true,
    message: `Invested ${spend} mana.`,
  };
}

export function setWorkshopEquippedLoot(state, slotIndex, itemId = null) {
  const arcane = normalizeArcaneSystemState(state && state.systems ? state.systems.arcane : {}, Date.now());
  const slots = Array.from({ length: Math.max(2, arcane.workshop.equipSlotCount) }, (_, index) => safeText(arcane.workshop.equippedLootIds[index]));
  const index = clamp(Math.floor(safeFinite(slotIndex, 0)), 0, slots.length - 1);
  const normalizedItem = safeText(itemId).toLowerCase();
  if (normalizedItem) {
    for (let scan = 0; scan < slots.length; scan += 1) {
      if (slots[scan] === normalizedItem) {
        slots[scan] = "";
      }
    }
  }
  slots[index] = normalizedItem || "";
  const nextArcane = {
    ...arcane,
    workshop: {
      ...arcane.workshop,
      equippedLootIds: slots.filter((entry) => entry).slice(0, arcane.workshop.equipSlotCount),
    },
  };
  return withArcaneSystem(state, nextArcane);
}

export function recordWorkshopCraftResult(state, { success = false, junk = false, resultSummary = null } = {}) {
  const arcane = normalizeArcaneSystemState(state && state.systems ? state.systems.arcane : {}, Date.now());
  const nextArcane = {
    ...arcane,
    crafting: {
      ...arcane.crafting,
      totalCrafts: arcane.crafting.totalCrafts + 1,
      successfulCrafts: arcane.crafting.successfulCrafts + (success ? 1 : 0),
      nonJunkCrafts: arcane.crafting.nonJunkCrafts + (success && !junk ? 1 : 0),
      lastWorkshopResult: resultSummary && typeof resultSummary === "object" ? { ...resultSummary } : null,
    },
  };
  return withArcaneSystem(state, nextArcane);
}

export function tickArcaneMana(arcaneState, now = Date.now()) {
  const current = normalizeArcaneSystemState(arcaneState, now);
  const lastTickAt = Math.max(0, Math.floor(safeFinite(current.workshop.lastManaTickAt, now)));
  const nowMs = Math.max(lastTickAt, Math.floor(safeFinite(now, Date.now())));
  const elapsedMs = Math.max(0, nowMs - lastTickAt);
  if (!elapsedMs) {
    return current;
  }

  const regenPerHour = current.workshop.manaRegenPerHour * (1 + current.bonuses.manaRegenPct);
  const regenPerMs = regenPerHour / 3600000;
  const gained = elapsedMs * regenPerMs;
  const nextMana = clamp(current.workshop.manaCurrent + gained, 0, current.workshop.manaMax);
  return {
    ...current,
    workshop: {
      ...current.workshop,
      manaCurrent: Number(nextMana.toFixed(4)),
      lastManaTickAt: nowMs,
    },
  };
}

export function awardManaCrystals(state, amount) {
  const delta = Math.max(0, Math.floor(safeFinite(amount, 0)));
  if (!delta) {
    return state;
  }
  const arcane = normalizeArcaneSystemState(state && state.systems ? state.systems.arcane : {}, Date.now());
  return withArcaneSystem(state, {
    ...arcane,
    manaCrystals: arcane.manaCrystals + delta,
  });
}

export function spendManaCrystals(state, amount) {
  const cost = Math.max(0, Math.floor(safeFinite(amount, 0)));
  const arcane = normalizeArcaneSystemState(state && state.systems ? state.systems.arcane : {}, Date.now());
  if (arcane.manaCrystals < cost) {
    return {
      nextState: state,
      changed: false,
      message: "Not enough mana crystals.",
    };
  }
  const nextArcane = {
    ...arcane,
    manaCrystals: arcane.manaCrystals - cost,
    totalSpentAtCourt: arcane.totalSpentAtCourt + cost,
  };
  return {
    nextState: withArcaneSystem(state, nextArcane),
    changed: true,
    message: `Spent ${cost} mana crystals.`,
  };
}

export function applyArcaneManaSpendProgress(state, manaSpent) {
  const spend = Math.max(0, Math.floor(safeFinite(manaSpent, 0)));
  if (!spend) {
    return state;
  }
  const now = Date.now();
  const arcane = normalizeArcaneSystemState(state && state.systems ? state.systems.arcane : {}, now);
  const ticked = tickArcaneMana(arcane, now);
  const totalSpent = ticked.workshop.totalManaSpent + spend;
  const gainedCap = Math.floor(totalSpent / 20);
  const nextMax = 100 + gainedCap;
  return withArcaneSystem(state, {
    ...ticked,
    workshop: {
      ...ticked.workshop,
      totalManaSpent: totalSpent,
      manaMax: nextMax,
      manaCurrent: clamp(ticked.workshop.manaCurrent, 0, nextMax),
    },
  });
}

export function grantStarterGlyphs(state, now = Date.now()) {
  const arcane = normalizeArcaneSystemState(state && state.systems ? state.systems.arcane : {}, now);
  if (arcane.grimoire.starterGranted) {
    return {
      nextState: state,
      changed: false,
      message: "Starter glyphs already unlocked.",
      grants: [],
    };
  }
  const regions = nextStarterRegionGlyphs(now);
  const enhancements = nextStarterEnhancementGlyphs(now);
  const nextArcane = {
    ...arcane,
    grimoire: {
      ...arcane.grimoire,
      starterGranted: true,
      regionGlyphs: uniqueLowerTextList([...arcane.grimoire.regionGlyphs, ...regions]),
      enhancementGlyphs: uniqueLowerTextList([...arcane.grimoire.enhancementGlyphs, ...enhancements]),
    },
  };
  return {
    nextState: withArcaneSystem(state, nextArcane),
    changed: true,
    message: "The Tome inscribes five starter glyphs into your grimoire.",
    grants: [...regions, ...enhancements],
  };
}

function tomePullCost(pullCount) {
  const count = Math.max(0, Math.floor(safeFinite(pullCount, 0)));
  return Math.floor(24 + (count * 9) + (Math.pow(count, 1.25) * 5));
}

export function pullGlyphFromTome(state, now = Date.now()) {
  const arcane = normalizeArcaneSystemState(state && state.systems ? state.systems.arcane : {}, now);
  const pullCount = arcane.grimoire.pullCount;
  const cost = tomePullCost(pullCount);

  const ownedRegions = new Set(arcane.grimoire.regionGlyphs);
  const ownedEnhancements = new Set(arcane.grimoire.enhancementGlyphs);
  const unownedRegions = REGION_GLYPHS.filter((glyph) => !ownedRegions.has(glyph));
  const unownedEnhancements = ENHANCEMENT_GLYPHS.filter((glyph) => !ownedEnhancements.has(glyph));
  const available = [
    ...unownedRegions.map((glyph) => ({ glyph, type: "region" })),
    ...unownedEnhancements.map((glyph) => ({ glyph, type: "enhancement" })),
  ];
  if (!available.length) {
    return {
      nextState: state,
      changed: false,
      message: "Your grimoire already contains every known glyph.",
      cost,
      grant: "",
      grantType: "",
    };
  }

  const spend = spendManaCrystals(state, cost);
  if (!spend.changed) {
    return {
      nextState: state,
      changed: false,
      message: spend.message,
      cost,
      grant: "",
      grantType: "",
    };
  }

  const working = normalizeArcaneSystemState(spend.nextState.systems.arcane, now);
  const rng = createRng(hashText(`tome:${pullCount}:${now}:${working.totalSpentAtCourt}`));
  const pick = available[Math.floor(rng() * available.length)] || available[0];
  const nextArcane = {
    ...working,
    grimoire: {
      ...working.grimoire,
      pullCount: working.grimoire.pullCount + 1,
      regionGlyphs: pick.type === "region"
        ? uniqueLowerTextList([...working.grimoire.regionGlyphs, pick.glyph])
        : working.grimoire.regionGlyphs,
      enhancementGlyphs: pick.type === "enhancement"
        ? uniqueLowerTextList([...working.grimoire.enhancementGlyphs, pick.glyph])
        : working.grimoire.enhancementGlyphs,
    },
  };

  return {
    nextState: withArcaneSystem(spend.nextState, nextArcane),
    changed: true,
    message: `Tome pull complete: ${pick.glyph}.`,
    cost,
    grant: pick.glyph,
    grantType: pick.type,
  };
}

export function setEnchanterAttunement(state, enabled = true) {
  const arcane = normalizeArcaneSystemState(state && state.systems ? state.systems.arcane : {}, Date.now());
  if (Boolean(arcane.attunements.enchanter) === Boolean(enabled)) {
    return state;
  }
  return withArcaneSystem(state, {
    ...arcane,
    attunements: {
      ...arcane.attunements,
      enchanter: Boolean(enabled),
    },
  });
}

export function arcaneSystemFromState(state, now = Date.now()) {
  return normalizeArcaneSystemState(state && state.systems ? state.systems.arcane : {}, now);
}

export function regionGlyphPool() {
  return REGION_GLYPHS.slice();
}

export function enhancementGlyphPool() {
  return ENHANCEMENT_GLYPHS.slice();
}

export function computeTomePullCost(state) {
  const arcane = normalizeArcaneSystemState(state && state.systems ? state.systems.arcane : {}, Date.now());
  return tomePullCost(arcane.grimoire.pullCount);
}

export function pickDeterministicGlyph(seed, type) {
  const normalizedType = safeText(type).toLowerCase();
  const pool = normalizedType === "region" ? REGION_GLYPHS : ENHANCEMENT_GLYPHS;
  const rng = createRng(hashText(`${normalizedType}:${seed}`));
  return randomPick(rng, pool);
}

export function glyphDisplayName(glyphId, glyphType = "") {
  const normalizedType = safeText(glyphType).toLowerCase();
  const canonical = canonicalGlyphId(normalizedType || "enhancement", glyphId)
    || canonicalGlyphId("region", glyphId)
    || safeText(glyphId).toLowerCase();
  if (REGION_GLYPH_LABELS[canonical]) {
    return REGION_GLYPHS.includes(canonical)
      ? REGION_GLYPH_LABELS[canonical]
      : readableGlyphName(canonical);
  }
  return readableGlyphName(canonical);
}

export function glyphTemplatePoints(glyphType, glyphId) {
  const normalizedType = safeText(glyphType).toLowerCase() === "enhancement" ? "enhancement" : "region";
  const canonical = canonicalGlyphId(normalizedType, glyphId);
  if (!canonical) {
    return [];
  }
  const templateSet = GLYPH_TEMPLATES[normalizedType] || {};
  const points = templateSet[canonical] || [];
  return Array.isArray(points)
    ? points.map((point) => (Array.isArray(point) ? [point[0], point[1]] : point))
    : [];
}
