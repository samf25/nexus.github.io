const PRESTIGE_REGIONS = Object.freeze([
  Object.freeze({
    id: "cradle",
    label: "Cradle",
    currencyLabel: "Madra",
    pointLabel: "Condensed Madra",
    baseResetCost: 200,
    growth: 2.35,
  }),
  Object.freeze({
    id: "worm",
    label: "Worm",
    currencyLabel: "Clout",
    pointLabel: "Shard",
    baseResetCost: 120,
    growth: 2.2,
  }),
  Object.freeze({
    id: "dcc",
    label: "Dungeon Crawler Carl",
    currencyLabel: "Gold",
    pointLabel: "Sponsor",
    baseResetCost: 500,
    growth: 2.3,
  }),
]);

const PRESTIGE_REGION_BY_ID = Object.freeze(
  Object.fromEntries(PRESTIGE_REGIONS.map((region) => [region.id, region])),
);

const PRESTIGE_UPGRADES = Object.freeze({
  cradle: Object.freeze([
    Object.freeze({
      id: "madra-surge",
      label: "Madra Surge",
      cost: 1,
      effect: "x10 madra gain",
    }),
    Object.freeze({
      id: "cycle-economy",
      label: "Cycle Economy",
      cost: 1,
      effect: "/10 cycling technique cost",
    }),
    Object.freeze({
      id: "combat-edge",
      label: "Combat Edge",
      cost: 1,
      effect: "x2 strength of attacks",
    }),
    Object.freeze({
      id: "soulfire-surge",
      label: "Soulfire Surge",
      cost: 1,
      effect: "x3 soulfire gain",
    }),
    Object.freeze({
      id: "soulfire-forge",
      label: "Soulfire Forge",
      cost: 1,
      effect: "Soulfire upgrades cost less in CRD02",
    }),
  ]),
  worm: Object.freeze([
    Object.freeze({
      id: "clout-surge",
      label: "Clout Surge",
      cost: 1,
      effect: "x2 clout gain",
    }),
    Object.freeze({
      id: "job-window",
      label: "Improved Job Window",
      cost: 1,
      effect: "higher odds for rarer cape pulls",
    }),
  ]),
  dcc: Object.freeze([
    Object.freeze({
      id: "sponsor-might",
      label: "Sponsor Might",
      cost: 1,
      effect: "Permanent attack and health boosts",
    }),
    Object.freeze({
      id: "sponsor-bounty",
      label: "Sponsor Bounty",
      cost: 1,
      effect: "Higher gold gain and better drop rarity",
    }),
    Object.freeze({
      id: "sponsor-arsenal",
      label: "Sponsor Arsenal",
      cost: 1,
      effect: "Start each crawl with a free combat technique",
    }),
  ]),
});

function safeText(value) {
  return String(value || "").trim().toLowerCase();
}

function safeFinite(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function defaultRegionState(regionId) {
  const upgrades = Object.fromEntries(
    (PRESTIGE_UPGRADES[regionId] || []).map((upgrade) => [upgrade.id, 0]),
  );

  return {
    points: 0,
    resets: 0,
    upgrades,
  };
}

export function defaultPrestigeSystemState() {
  return {
    practicalGuideResets: 0,
    regions: Object.fromEntries(
      PRESTIGE_REGIONS.map((region) => [region.id, defaultRegionState(region.id)]),
    ),
  };
}

function normalizeRegionState(regionId, candidate) {
  const source = candidate && typeof candidate === "object" ? candidate : {};
  const base = defaultRegionState(regionId);
  const incomingUpgrades = source.upgrades && typeof source.upgrades === "object" ? source.upgrades : {};

  const upgrades = { ...base.upgrades };
  for (const [upgradeId] of Object.entries(upgrades)) {
    upgrades[upgradeId] = Math.max(0, Math.min(1, Math.floor(safeFinite(incomingUpgrades[upgradeId], 0))));
  }

  return {
    points: Math.max(0, Math.floor(safeFinite(source.points, 0))),
    resets: Math.max(0, Math.floor(safeFinite(source.resets, 0))),
    upgrades,
  };
}

export function normalizePrestigeSystemState(candidate) {
  const source = candidate && typeof candidate === "object" ? candidate : {};
  const regions = source.regions && typeof source.regions === "object" ? source.regions : {};

  return {
    practicalGuideResets: Math.max(0, Math.floor(safeFinite(source.practicalGuideResets, 0))),
    regions: Object.fromEntries(
      PRESTIGE_REGIONS.map((region) => [
        region.id,
        normalizeRegionState(region.id, regions[region.id]),
      ]),
    ),
  };
}

export function prestigeRegionDefinitions() {
  return PRESTIGE_REGIONS.slice();
}

export function prestigeRegionById(regionId) {
  return PRESTIGE_REGION_BY_ID[safeText(regionId)] || null;
}

export function prestigeUpgradesForRegion(regionId) {
  return (PRESTIGE_UPGRADES[safeText(regionId)] || []).slice();
}

export function prestigeUpgradePurchased(prestigeState, regionId, upgradeId) {
  const normalized = normalizePrestigeSystemState(prestigeState);
  const region = normalized.regions[safeText(regionId)];
  if (!region) {
    return false;
  }
  return Number(region.upgrades[safeText(upgradeId)] || 0) > 0;
}

export function prestigeResetCost(regionId, resetCount = 0) {
  const region = prestigeRegionById(regionId);
  if (!region) {
    return Infinity;
  }

  const count = Math.max(0, Math.floor(safeFinite(resetCount, 0)));
  return Math.max(1, Math.round(region.baseResetCost * Math.pow(region.growth, count)));
}

export function nextPrestigeResetCost(prestigeState, regionId) {
  const normalized = normalizePrestigeSystemState(prestigeState);
  const key = safeText(regionId);
  const region = normalized.regions[key];
  return prestigeResetCost(key, region ? region.resets : 0);
}

function crd02RuntimeFromState(state) {
  if (!state || !state.nodeRuntime || typeof state.nodeRuntime !== "object") {
    return null;
  }

  const runtime = state.nodeRuntime.CRD02;
  return runtime && typeof runtime === "object" ? runtime : null;
}

function cradleCurrencyAmount(state) {
  const runtime = crd02RuntimeFromState(state);
  return runtime ? Math.max(0, safeFinite(runtime.madra, 0)) : 0;
}

function wormCurrencyAmount(state) {
  const system = state && state.systems && state.systems.worm && typeof state.systems.worm === "object"
    ? state.systems.worm
    : {};
  return Math.max(0, safeFinite(system.clout, 0));
}

function dccRuntimeFromState(state) {
  if (!state || !state.nodeRuntime || typeof state.nodeRuntime !== "object") {
    return null;
  }
  const runtime = state.nodeRuntime.DCC01;
  return runtime && typeof runtime === "object" ? runtime : null;
}

function dccCurrencyAmount(state) {
  const runtime = dccRuntimeFromState(state);
  const meta = runtime && runtime.meta && typeof runtime.meta === "object" ? runtime.meta : {};
  return Math.max(0, safeFinite(meta.gold, 0));
}

export function prestigeCurrencyAmount(state, regionId) {
  const key = safeText(regionId);
  if (key === "cradle") {
    return cradleCurrencyAmount(state);
  }
  if (key === "worm") {
    return wormCurrencyAmount(state);
  }
  if (key === "dcc") {
    return dccCurrencyAmount(state);
  }
  return 0;
}

export function canAffordPrestigeReset(state, regionId) {
  const key = safeText(regionId);
  const cost = nextPrestigeResetCost(state && state.systems ? state.systems.prestige : {}, key);
  const amount = prestigeCurrencyAmount(state, key);
  return amount >= cost;
}

export function prestigeRegionSnapshot(state, regionId) {
  const key = safeText(regionId);
  const regionDef = prestigeRegionById(key);
  const normalized = normalizePrestigeSystemState(state && state.systems ? state.systems.prestige : {});
  const regionState = normalized.regions[key] || defaultRegionState(key);
  const currency = prestigeCurrencyAmount(state, key);
  const nextCost = prestigeResetCost(key, regionState.resets);

  return {
    regionId: key,
    regionDef,
    points: regionState.points,
    resets: regionState.resets,
    nextCost,
    currency,
    affordable: currency >= nextCost,
    upgrades: { ...regionState.upgrades },
  };
}

function zeroUpgradeLevels(upgrades) {
  const source = upgrades && typeof upgrades === "object" ? upgrades : {};
  return Object.fromEntries(Object.keys(source).map((upgradeId) => [upgradeId, 0]));
}

function applyCradleReset(state, cost, now) {
  const runtime = crd02RuntimeFromState(state);
  if (!runtime) {
    return {
      state,
      applied: false,
      message: "Madra Well must be unlocked before Cradle can reset.",
    };
  }

  const currentMadra = Math.max(0, safeFinite(runtime.madra, 0));
  if (currentMadra < cost) {
    return {
      state,
      applied: false,
      message: `Need ${cost} madra to reset Cradle.`,
    };
  }

  const manual = runtime.manual && typeof runtime.manual === "object" ? runtime.manual : {};
  const cycling = runtime.cycling && typeof runtime.cycling === "object" ? runtime.cycling : {};

  const nextRuntime = {
    ...runtime,
    cultivationStage: "foundation",
    madra: 0,
    cycling: {
      ...cycling,
      twinStarsLevel: 0,
      heavenEarthLevel: 0,
    },
    upgrades: zeroUpgradeLevels(runtime.upgrades),
    techniquesOpen: false,
    manual: {
      ...manual,
      open: false,
      streak: 0,
      lastBeatOrdinal: -1,
      flashUntil: 0,
      startedAt: now,
    },
    lastTickAt: now,
    lastMessage: "The loop snaps shut. Your core returns to Foundation.",
    soulfire: {
      unlocked: false,
      amount: 0,
      totalGenerated: 0,
      madraCyclerLevel: 0,
      soulfireCyclerLevel: 0,
    },
  };

  return {
    state: {
      ...state,
      nodeRuntime: {
        ...(state.nodeRuntime || {}),
        CRD02: nextRuntime,
      },
    },
    applied: true,
    message: "Cradle reset complete.",
  };
}

function applyWormReset(state, cost) {
  const worm = state && state.systems && state.systems.worm && typeof state.systems.worm === "object"
    ? state.systems.worm
    : null;

  if (!worm) {
    return {
      state,
      applied: false,
      message: "Worm system is unavailable.",
    };
  }

  const clout = Math.max(0, safeFinite(worm.clout, 0));
  if (clout < cost) {
    return {
      state,
      applied: false,
      message: `Need ${cost} clout to reset Worm.`,
    };
  }

  return {
    state: {
      ...state,
      systems: {
        ...(state.systems || {}),
        worm: {
          ...worm,
          clout: 0,
        },
      },
    },
    applied: true,
    message: "Worm reset complete.",
  };
}

function applyDccReset(state, cost) {
  const runtime = dccRuntimeFromState(state);
  const currentGold = dccCurrencyAmount(state);
  if (currentGold < cost) {
    return {
      state,
      applied: false,
      message: `Need ${cost} gold to reset Dungeon Crawler Carl.`,
    };
  }

  const sourceMeta = runtime && runtime.meta && typeof runtime.meta === "object" ? runtime.meta : {};
  const nextRuntime = {
    ...(runtime && typeof runtime === "object" ? runtime : {}),
    run: null,
    inventoryOpen: false,
    meta: {
      gold: 0,
      upgrades: {
        hp: 0,
        attack: 0,
        stamina: 0,
        rare: 0,
        slots: 0,
      },
      totalRuns: Math.max(0, Math.floor(safeFinite(sourceMeta.totalRuns, 0))),
      totalDeaths: Math.max(0, Math.floor(safeFinite(sourceMeta.totalDeaths, 0))),
      bestFloor: Math.max(1, Math.floor(safeFinite(sourceMeta.bestFloor, 1))),
    },
    lastMessage: "The crawl contract is void. You start over with empty pockets.",
  };

  return {
    state: {
      ...state,
      nodeRuntime: {
        ...(state.nodeRuntime || {}),
        DCC01: nextRuntime,
      },
    },
    applied: true,
    message: "Dungeon Crawler Carl reset complete.",
  };
}

function withPrestigeRegionAward(state, regionId) {
  const normalized = normalizePrestigeSystemState(state && state.systems ? state.systems.prestige : {});
  const key = safeText(regionId);
  const region = normalized.regions[key];
  if (!region) {
    return state;
  }

  return {
    ...state,
    systems: {
      ...(state.systems || {}),
      prestige: {
        regions: {
          ...normalized.regions,
          [key]: {
            ...region,
            points: region.points + 1,
            resets: region.resets + 1,
          },
        },
      },
    },
  };
}

export function applyPrestigeReset(state, regionId, now = Date.now()) {
  const key = safeText(regionId);
  const regionDef = prestigeRegionById(key);
  if (!regionDef) {
    return {
      nextState: state,
      applied: false,
      cost: 0,
      pointLabel: "",
      message: "Unknown reset target.",
    };
  }

  const snapshot = prestigeRegionSnapshot(state, key);
  if (!snapshot.affordable) {
    return {
      nextState: state,
      applied: false,
      cost: snapshot.nextCost,
      pointLabel: regionDef.pointLabel,
      message: `Not enough ${regionDef.currencyLabel} for ${regionDef.label} reset.`,
    };
  }

  const regionResult = key === "cradle"
    ? applyCradleReset(state, snapshot.nextCost, now)
    : key === "worm"
      ? applyWormReset(state, snapshot.nextCost)
      : applyDccReset(state, snapshot.nextCost);

  if (!regionResult.applied) {
    return {
      nextState: state,
      applied: false,
      cost: snapshot.nextCost,
      pointLabel: regionDef.pointLabel,
      message: regionResult.message,
    };
  }

  const awarded = withPrestigeRegionAward(regionResult.state, key);
  return {
    nextState: awarded,
    applied: true,
    cost: snapshot.nextCost,
    pointLabel: regionDef.pointLabel,
    message: `${regionDef.label} reset complete. +1 ${regionDef.pointLabel}.`,
  };
}

export function applyPrestigeUpgradePurchase(state, regionId, upgradeId) {
  const key = safeText(regionId);
  const targetUpgradeId = safeText(upgradeId);
  const regionDef = prestigeRegionById(key);
  const upgrades = prestigeUpgradesForRegion(key);
  const upgrade = upgrades.find((entry) => entry.id === targetUpgradeId) || null;

  if (!regionDef || !upgrade) {
    return {
      nextState: state,
      applied: false,
      message: "Unknown prestige upgrade.",
    };
  }

  const normalized = normalizePrestigeSystemState(state && state.systems ? state.systems.prestige : {});
  const region = normalized.regions[key];
  const level = Number(region && region.upgrades ? region.upgrades[targetUpgradeId] : 0);

  if (level > 0) {
    return {
      nextState: state,
      applied: false,
      message: `${upgrade.label} is already unlocked.`,
    };
  }

  if (!region || region.points < upgrade.cost) {
    return {
      nextState: state,
      applied: false,
      message: `Need ${upgrade.cost} ${regionDef.pointLabel} for ${upgrade.label}.`,
    };
  }

  const nextPrestige = {
    regions: {
      ...normalized.regions,
      [key]: {
        ...region,
        points: region.points - upgrade.cost,
        upgrades: {
          ...region.upgrades,
          [targetUpgradeId]: 1,
        },
      },
    },
  };

  return {
    nextState: {
      ...state,
      systems: {
        ...(state.systems || {}),
        prestige: nextPrestige,
      },
    },
    applied: true,
    message: `${upgrade.label} unlocked for ${regionDef.label}.`,
  };
}

export function prestigeModifiersFromState(state) {
  const normalized = normalizePrestigeSystemState(state && state.systems ? state.systems.prestige : {});
  const cradle = normalized.regions.cradle || defaultRegionState("cradle");
  const worm = normalized.regions.worm || defaultRegionState("worm");
  const dcc = normalized.regions.dcc || defaultRegionState("dcc");

  const hasCradle = (upgradeId) => Number(cradle.upgrades[upgradeId] || 0) > 0;
  const hasWorm = (upgradeId) => Number(worm.upgrades[upgradeId] || 0) > 0;
  const hasDcc = (upgradeId) => Number(dcc.upgrades[upgradeId] || 0) > 0;

  return {
    cradle: {
      madraGainMultiplier: hasCradle("madra-surge") ? 10 : 1,
      cyclingCostDivider: hasCradle("cycle-economy") ? 10 : 1,
      combatAttackMultiplier: hasCradle("combat-edge") ? 2 : 1,
      soulfireGainMultiplier: hasCradle("soulfire-surge") ? 3 : 1,
      soulfireCostDivider: hasCradle("soulfire-forge") ? 2 : 1,
    },
    worm: {
      cloutGainMultiplier: hasWorm("clout-surge") ? 2 : 1,
      jobWeightBaseMultiplier: hasWorm("job-window") ? 2 : 1,
    },
    dcc: {
      maxHpBonus: hasDcc("sponsor-might") ? 30 : 0,
      attackBonus: hasDcc("sponsor-might") ? 5 : 0,
      goldGainBonus: hasDcc("sponsor-bounty") ? 1 : 0,
      rareDropBonus: hasDcc("sponsor-bounty") ? 0.2 : 0,
      startWithSponsorSkill: hasDcc("sponsor-arsenal"),
      extraAbilitySlots: hasDcc("sponsor-arsenal") ? 1 : 0,
    },
  };
}
