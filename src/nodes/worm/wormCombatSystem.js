import { buildWormActionFlavor, WORM_ACTION_TYPES } from "./wormFlavorText.js";

const STAT_KEYS = Object.freeze([
  "attack",
  "defense",
  "endurance",
  "info",
  "manipulation",
  "range",
  "speed",
  "stealth",
]);

const SELECTABLE_ACTIONS = Object.freeze([
  WORM_ACTION_TYPES.attack,
  WORM_ACTION_TYPES.defense,
  WORM_ACTION_TYPES.info,
  WORM_ACTION_TYPES.manipulation,
  WORM_ACTION_TYPES.speed,
  WORM_ACTION_TYPES.stealth,
]);

const INFO_DEBUFF_KEYS = Object.freeze(STAT_KEYS.slice());
const ENEMY_AI_MODES = Object.freeze({
  basic: "basic",
  weighted: "weighted",
  boss: "boss",
});

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function safeText(value) {
  return String(value == null ? "" : value).trim();
}

function toStat(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 0;
  }
  return Math.max(0, Math.round(numeric));
}

function seededStep(seed, salt = 0) {
  const base = Number.isFinite(seed) ? Number(seed) >>> 0 : 1;
  return (Math.imul(base, 1664525) + 1013904223 + (salt >>> 0)) >>> 0;
}

function randomUnit(seed, salt = 0) {
  const nextSeed = seededStep(seed, salt);
  return {
    seed: nextSeed,
    value: nextSeed / 4294967296,
  };
}

function rollDie(seed, sides, salt = 0) {
  const maxSides = Math.max(1, Math.floor(Number(sides) || 1));
  const roll = randomUnit(seed, salt);
  const value = 1 + Math.floor(roll.value * maxSides);
  return {
    seed: roll.seed,
    value,
  };
}

function emptyDebuffs() {
  return {
    attack: 0,
    defense: 0,
    endurance: 0,
    info: 0,
    manipulation: 0,
    range: 0,
    speed: 0,
    stealth: 0,
  };
}

function emptyModifiers() {
  return {
    attack: 0,
    defense: 0,
    endurance: 0,
    info: 0,
    manipulation: 0,
    range: 0,
    speed: 0,
    stealth: 0,
  };
}

function normalizeCard(card) {
  const source = card && typeof card === "object" ? card : {};
  return {
    id: safeText(source.id || source.cardId),
    heroName: safeText(source.heroName || source.name || "Unknown Cape"),
    power: safeText(source.power || "Unknown power"),
    powerFull: safeText(source.powerFull || source.power || "Unknown power"),
    attack: toStat(source.attack),
    defense: toStat(source.defense),
    endurance: toStat(source.endurance),
    info: toStat(source.info),
    manipulation: toStat(source.manipulation),
    range: toStat(source.range),
    speed: toStat(source.speed),
    stealth: toStat(source.stealth),
    currentHp: Number.isFinite(Number(source.currentHp)) ? Math.max(0, Math.round(Number(source.currentHp))) : null,
    rarity: Number.isFinite(Number(source.rarity)) ? Number(source.rarity) : 0,
    rarityTier: safeText(source.rarityTier || "common"),
  };
}

function buildCombatant(card, teamId, slotIndex) {
  const normalized = normalizeCard(card);
  const baseHp = Math.max(40, normalized.endurance * 50);
  const startingHp = Number.isFinite(normalized.currentHp)
    ? clamp(normalized.currentHp, 0, baseHp)
    : baseHp;
  return {
    combatantId: `${teamId}-${slotIndex + 1}`,
    teamId,
    slotIndex,
    cardId: normalized.id,
    heroName: normalized.heroName,
    power: normalized.power,
    powerFull: normalized.powerFull,
    stats: {
      attack: normalized.attack,
      defense: normalized.defense,
      endurance: normalized.endurance,
      info: normalized.info,
      manipulation: normalized.manipulation,
      range: normalized.range,
      speed: normalized.speed,
      stealth: normalized.stealth,
    },
    rarity: normalized.rarity,
    rarityTier: normalized.rarityTier,
    maxHp: baseHp,
    hp: startingHp,
    modifiers: emptyModifiers(),
    debuffs: emptyDebuffs(),
    guardTargetId: "",
    guardCharges: 0,
    speedReady: false,
    stealthReady: false,
    confusedAttack: false,
  };
}

function cloneCombatant(combatant) {
  return {
    ...combatant,
    stats: { ...combatant.stats },
    modifiers: { ...(combatant.modifiers || emptyModifiers()) },
    debuffs: { ...combatant.debuffs },
  };
}

function cloneBattleState(state) {
  return {
    ...state,
    playerTeam: Array.isArray(state.playerTeam) ? state.playerTeam.map(cloneCombatant) : [],
    enemyTeam: Array.isArray(state.enemyTeam) ? state.enemyTeam.map(cloneCombatant) : [],
    log: Array.isArray(state.log) ? state.log.slice() : [],
    lastRoundEvents: Array.isArray(state.lastRoundEvents) ? state.lastRoundEvents.slice() : [],
  };
}

function cardForFlavor(combatant) {
  return {
    name: combatant.heroName,
    power: combatant.power,
    powerFull: combatant.powerFull,
  };
}

function combatantList(state) {
  return [...state.playerTeam, ...state.enemyTeam];
}

function findCombatant(state, combatantId) {
  const id = safeText(combatantId);
  if (!id) {
    return null;
  }
  return combatantList(state).find((combatant) => combatant.combatantId === id) || null;
}

function teamById(state, teamId) {
  return teamId === "enemy" ? state.enemyTeam : state.playerTeam;
}

function opposingTeamId(teamId) {
  return teamId === "enemy" ? "player" : "enemy";
}

function isAlive(combatant) {
  return Boolean(combatant) && Number(combatant.hp) > 0;
}

function livingTeamMembers(state, teamId) {
  return teamById(state, teamId).filter(isAlive);
}

function effectiveStat(combatant, statKey) {
  const base = Number(combatant.stats[statKey] || 0);
  const modifier = Number((combatant.modifiers && combatant.modifiers[statKey]) || 0);
  const debuff = Number(combatant.debuffs[statKey] || 0);
  return Math.max(0, base + modifier - debuff);
}

function applyDamage(combatant, damage) {
  combatant.hp = Math.max(0, combatant.hp - Math.max(0, Math.round(damage)));
}

function logLine(state, line) {
  state.log = [...state.log.slice(-23), safeText(line)];
}

function hasLivingTeam(state, teamId) {
  return livingTeamMembers(state, teamId).length > 0;
}

function updateWinner(state) {
  const playerAlive = hasLivingTeam(state, "player");
  const enemyAlive = hasLivingTeam(state, "enemy");
  if (playerAlive && enemyAlive) {
    state.winner = "";
  } else if (playerAlive) {
    state.winner = "player";
  } else if (enemyAlive) {
    state.winner = "enemy";
  } else {
    state.winner = "draw";
  }
}

function pickRandom(arr, seed, salt = 0) {
  if (!Array.isArray(arr) || arr.length === 0) {
    return { seed, value: null, index: -1 };
  }
  const roll = randomUnit(seed, salt);
  const index = Math.floor(roll.value * arr.length);
  return {
    seed: roll.seed,
    value: arr[Math.max(0, Math.min(arr.length - 1, index))],
    index: Math.max(0, Math.min(arr.length - 1, index)),
  };
}

function pickWeighted(items, getWeight, seed, salt = 0) {
  if (!Array.isArray(items) || !items.length) {
    return {
      seed,
      value: null,
      index: -1,
    };
  }

  const weighted = [];
  let totalWeight = 0;
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    const weight = Math.max(0, Number(getWeight(item, index)) || 0);
    weighted.push({
      item,
      index,
      weight,
    });
    totalWeight += weight;
  }

  if (totalWeight <= 0) {
    return pickRandom(items, seed, salt);
  }

  const roll = randomUnit(seed, salt);
  let cursor = roll.value * totalWeight;
  for (const entry of weighted) {
    cursor -= entry.weight;
    if (cursor <= 0) {
      return {
        seed: roll.seed,
        value: entry.item,
        index: entry.index,
      };
    }
  }

  const fallback = weighted[weighted.length - 1];
  return {
    seed: roll.seed,
    value: fallback.item,
    index: fallback.index,
  };
}

function chooseAttackTarget(state, actor, orderTargetId) {
  const opponents = livingTeamMembers(state, opposingTeamId(actor.teamId));
  if (!opponents.length) {
    return null;
  }

  const selected = opponents.find((combatant) => combatant.combatantId === safeText(orderTargetId));
  return selected || opponents[0];
}

function chooseFriendlyTarget(state, actor, seed) {
  const allies = livingTeamMembers(state, actor.teamId);
  if (!allies.length) {
    return {
      seed,
      target: actor,
    };
  }
  const pick = pickRandom(allies, seed, 103);
  return {
    seed: pick.seed,
    target: pick.value || actor,
  };
}

function maybeRedirectByGuard(state, target) {
  if (!target) {
    return target;
  }

  const team = livingTeamMembers(state, target.teamId);
  const guard = team.find(
    (candidate) =>
      candidate.combatantId !== target.combatantId &&
      candidate.guardCharges > 0 &&
      candidate.guardTargetId === target.combatantId,
  );

  if (!guard) {
    return target;
  }

  guard.guardCharges = Math.max(0, guard.guardCharges - 1);
  if (guard.guardCharges === 0) {
    guard.guardTargetId = "";
  }

  logLine(state, `${guard.heroName} pulls the attack onto themselves.`);
  return guard;
}

function consumeSpeedCheck(state, target, seed, salt = 0) {
  if (!target || !target.speedReady) {
    return {
      seed,
      dodged: false,
    };
  }

  target.speedReady = false;
  const speedValue = effectiveStat(target, "speed");
  const dodgeChance = clamp(speedValue * 0.1, 0, 0.95);
  const roll = randomUnit(seed, salt);

  return {
    seed: roll.seed,
    dodged: roll.value < dodgeChance,
    dodgeChance,
  };
}

function normalizeActionType(value) {
  const action = safeText(value).toLowerCase();
  return SELECTABLE_ACTIONS.includes(action) ? action : WORM_ACTION_TYPES.attack;
}

function normalizeInfoDebuffKey(value) {
  const key = safeText(value).toLowerCase();
  return INFO_DEBUFF_KEYS.includes(key) ? key : "attack";
}

function normalizeOrderForActor(actor, order, state) {
  const source = order && typeof order === "object" ? order : {};
  const type = normalizeActionType(source.type);
  const defaultTarget = chooseAttackTarget(state, actor, "");
  return {
    type,
    targetId: safeText(source.targetId || (defaultTarget ? defaultTarget.combatantId : "")),
    infoStat: normalizeInfoDebuffKey(source.infoStat),
  };
}

function enemyActionWeight(actor, action) {
  if (action === WORM_ACTION_TYPES.attack) {
    return Math.max(0.4, effectiveStat(actor, "attack"));
  }
  if (action === WORM_ACTION_TYPES.defense) {
    return Math.max(0.2, effectiveStat(actor, "defense"));
  }
  if (action === WORM_ACTION_TYPES.info) {
    return Math.max(0.2, effectiveStat(actor, "info"));
  }
  if (action === WORM_ACTION_TYPES.manipulation) {
    return Math.max(0.2, effectiveStat(actor, "manipulation"));
  }
  if (action === WORM_ACTION_TYPES.speed) {
    return Math.max(0.15, effectiveStat(actor, "speed"));
  }
  if (action === WORM_ACTION_TYPES.stealth) {
    return Math.max(0.15, effectiveStat(actor, "stealth"));
  }
  return 1;
}

function attackTargetWeight(actor, target) {
  const missingFraction =
    Math.max(0, Number(target.maxHp || 0) - Number(target.hp || 0)) / Math.max(1, Number(target.maxHp || 1));
  const rangeFactor = Math.max(1, effectiveStat(target, "range"));
  const actorRangeBoost = Math.max(1, effectiveStat(actor, "range"));
  return Math.max(0.1, missingFraction * rangeFactor * Math.max(0.5, actorRangeBoost / 6) + 0.2);
}

function skillTargetWeight(actionType, target) {
  if (actionType === WORM_ACTION_TYPES.manipulation) {
    return Math.max(0.1, 17 - effectiveStat(target, "manipulation") - effectiveStat(target, "range"));
  }

  if (actionType === WORM_ACTION_TYPES.info) {
    return Math.max(0.1, 17 - effectiveStat(target, "info"));
  }

  return 1;
}

function pickInfoDebuffStat(state, target, seed) {
  const statPick = pickWeighted(
    INFO_DEBUFF_KEYS,
    (statKey) => Math.max(0.1, effectiveStat(target, statKey)),
    seed,
    223,
  );
  return {
    seed: statPick.seed,
    statKey: statPick.value || "attack",
  };
}

function targetByAction(state, actor, actionType, seed) {
  const opponents = livingTeamMembers(state, opposingTeamId(actor.teamId));
  if (!opponents.length) {
    return {
      seed,
      target: null,
    };
  }

  if (actionType === WORM_ACTION_TYPES.attack) {
    const pick = pickWeighted(opponents, (target) => attackTargetWeight(actor, target), seed, 181);
    return {
      seed: pick.seed,
      target: pick.value || opponents[0],
    };
  }

  if (actionType === WORM_ACTION_TYPES.info || actionType === WORM_ACTION_TYPES.manipulation) {
    const pick = pickWeighted(opponents, (target) => skillTargetWeight(actionType, target), seed, 191);
    return {
      seed: pick.seed,
      target: pick.value || opponents[0],
    };
  }

  return {
    seed,
    target: opponents[0],
  };
}

function defaultEnemyOrdersBasic(state) {
  const orders = {};
  for (const actor of livingTeamMembers(state, "enemy")) {
    const target = chooseAttackTarget(state, actor, "");
    orders[actor.combatantId] = {
      type: WORM_ACTION_TYPES.attack,
      targetId: target ? target.combatantId : "",
      infoStat: "attack",
    };
  }
  return orders;
}

function defaultEnemyOrdersWeighted(state) {
  const orders = {};
  let seed = state.seed;
  const actions = selectableWormActions();

  for (const actor of livingTeamMembers(state, "enemy")) {
    const actionPick = pickWeighted(actions, (action) => enemyActionWeight(actor, action), seed, 173);
    seed = actionPick.seed;
    const actionType = actionPick.value || WORM_ACTION_TYPES.attack;

    const targetPick = targetByAction(state, actor, actionType, seed);
    seed = targetPick.seed;
    const target = targetPick.target;
    const targetId = target ? target.combatantId : "";

    let infoStat = "attack";
    if (actionType === WORM_ACTION_TYPES.info && target) {
      const debuffPick = pickInfoDebuffStat(state, target, seed);
      seed = debuffPick.seed;
      infoStat = debuffPick.statKey;
    }

    orders[actor.combatantId] = {
      type: actionType,
      targetId,
      infoStat,
    };
  }

  state.seed = seed;
  return orders;
}

function defaultEnemyOrdersBoss(state) {
  const orders = {};
  let seed = state.seed;
  const enemies = livingTeamMembers(state, "enemy");
  const allies = livingTeamMembers(state, "enemy");
  for (const actor of enemies) {
    const opponents = livingTeamMembers(state, "player");
    const targetPick = targetByAction(state, actor, WORM_ACTION_TYPES.attack, seed);
    seed = targetPick.seed;
    const target = targetPick.target;
    const targetId = target ? target.combatantId : "";

    const name = safeText(actor.heroName).toLowerCase();
    let actionType = WORM_ACTION_TYPES.attack;

    if (name.includes("jack")) {
      const actionPick = pickWeighted(
        [WORM_ACTION_TYPES.manipulation, WORM_ACTION_TYPES.attack, WORM_ACTION_TYPES.info, WORM_ACTION_TYPES.stealth],
        (entry) => (entry === WORM_ACTION_TYPES.manipulation ? 5 : entry === WORM_ACTION_TYPES.attack ? 4 : 2.5),
        seed,
        311,
      );
      seed = actionPick.seed;
      actionType = actionPick.value || WORM_ACTION_TYPES.attack;
    } else if (name.includes("crawler")) {
      const allyMissing = allies.some((ally) => Number(ally.hp || 0) < Number(ally.maxHp || 1) * 0.5);
      const actionPick = pickWeighted(
        [WORM_ACTION_TYPES.defense, WORM_ACTION_TYPES.attack, WORM_ACTION_TYPES.speed],
        (entry) => (entry === WORM_ACTION_TYPES.defense ? (allyMissing ? 5 : 3) : entry === WORM_ACTION_TYPES.attack ? 4 : 2.2),
        seed,
        313,
      );
      seed = actionPick.seed;
      actionType = actionPick.value || WORM_ACTION_TYPES.attack;
    } else if (opponents.length === 1) {
      actionType = WORM_ACTION_TYPES.attack;
    } else {
      const actionPick = pickWeighted(
        [WORM_ACTION_TYPES.attack, WORM_ACTION_TYPES.manipulation, WORM_ACTION_TYPES.info, WORM_ACTION_TYPES.speed],
        (entry) => (entry === WORM_ACTION_TYPES.attack ? 4 : entry === WORM_ACTION_TYPES.manipulation ? 3.6 : 2),
        seed,
        317,
      );
      seed = actionPick.seed;
      actionType = actionPick.value || WORM_ACTION_TYPES.attack;
    }

    let infoStat = "attack";
    if (actionType === WORM_ACTION_TYPES.info && target) {
      const debuffPick = pickInfoDebuffStat(state, target, seed);
      seed = debuffPick.seed;
      infoStat = debuffPick.statKey;
    }

    orders[actor.combatantId] = {
      type: actionType,
      targetId,
      infoStat,
    };
  }
  state.seed = seed;
  return orders;
}

function defaultEnemyOrders(state) {
  const mode = safeText(state.enemyAiMode || ENEMY_AI_MODES.weighted).toLowerCase();
  if (mode === ENEMY_AI_MODES.basic) {
    return defaultEnemyOrdersBasic(state);
  }
  if (mode === ENEMY_AI_MODES.boss) {
    return defaultEnemyOrdersBoss(state);
  }
  return defaultEnemyOrdersWeighted(state);
}

function buildInitiativeOrder(state) {
  const living = combatantList(state).filter(isAlive);
  const scored = [];
  let seed = state.seed;

  for (const combatant of living) {
    const tieRoll = rollDie(seed, 6, 7);
    seed = tieRoll.seed;
    const score =
      effectiveStat(combatant, "endurance") * 100 +
      effectiveStat(combatant, "speed") * 10 +
      tieRoll.value;
    scored.push({
      combatantId: combatant.combatantId,
      score,
    });
  }

  scored.sort((left, right) => right.score - left.score);
  state.seed = seed;
  return scored.map((entry) => entry.combatantId);
}

function resolveAttack(state, actor, order) {
  let target = chooseAttackTarget(state, actor, order.targetId);
  if (!target) {
    return;
  }

  if (actor.confusedAttack) {
    const confusedPick = chooseFriendlyTarget(state, actor, state.seed);
    state.seed = confusedPick.seed;
    target = confusedPick.target;
    actor.confusedAttack = false;
    logLine(state, `${actor.heroName} is turned around and lashes at their own side.`);
  }

  target = maybeRedirectByGuard(state, target);

  const speedCheck = consumeSpeedCheck(state, target, state.seed, 17);
  state.seed = speedCheck.seed;

  const stealthBoost = actor.stealthReady ? 1.3 : 1;
  actor.stealthReady = false;

  if (speedCheck.dodged) {
    logLine(
      state,
      buildWormActionFlavor({
        card: cardForFlavor(actor),
        actionType: WORM_ACTION_TYPES.attack,
        success: false,
        targetName: target.heroName,
      }),
    );
    return;
  }

  const attackRoll = rollDie(state.seed, 6, 19);
  state.seed = attackRoll.seed;
  const defenseRoll = rollDie(state.seed, 6, 23);
  state.seed = defenseRoll.seed;

  const attackScore = attackRoll.value + effectiveStat(actor, "attack");
  const defenseScore =
    defenseRoll.value + Math.max(0, effectiveStat(target, "defense") + effectiveStat(target, "range") - 6);

  if (attackScore <= defenseScore) {
    logLine(
      state,
      buildWormActionFlavor({
        card: cardForFlavor(actor),
        actionType: WORM_ACTION_TYPES.attack,
        success: false,
        targetName: target.heroName,
      }),
    );
    return;
  }

  const baseAttack = Math.max(1, effectiveStat(actor, "attack"));
  const baseDamage = Math.max(1, Math.round(baseAttack * baseAttack));
  const damage = Math.max(1, Math.round(baseDamage * stealthBoost));
  applyDamage(target, damage);

  logLine(
    state,
    buildWormActionFlavor({
      card: cardForFlavor(actor),
      actionType: WORM_ACTION_TYPES.attack,
      success: true,
      targetName: target.heroName,
      amount: `${damage} damage`,
    }),
  );

  if (!isAlive(target)) {
    logLine(state, `${target.heroName} is knocked out.`);
  }
}

function resolveDefense(state, actor) {
  const allies = livingTeamMembers(state, actor.teamId).filter(
    (combatant) => combatant.combatantId !== actor.combatantId,
  );

  if (!allies.length) {
    logLine(
      state,
      buildWormActionFlavor({
        card: cardForFlavor(actor),
        actionType: WORM_ACTION_TYPES.defense,
        success: false,
      }),
    );
    return;
  }

  const ally = allies[0];
  actor.guardTargetId = ally.combatantId;
  actor.guardCharges = 1;

  logLine(
    state,
    buildWormActionFlavor({
      card: cardForFlavor(actor),
      actionType: WORM_ACTION_TYPES.defense,
      success: true,
      targetName: ally.heroName,
      amount: "1 redirect",
    }),
  );
}

function resolveInfo(state, actor, order) {
  let target = chooseAttackTarget(state, actor, order.targetId);
  if (!target) {
    return;
  }

  target = maybeRedirectByGuard(state, target);
  const speedCheck = consumeSpeedCheck(state, target, state.seed, 29);
  state.seed = speedCheck.seed;
  if (speedCheck.dodged) {
    logLine(
      state,
      buildWormActionFlavor({
        card: cardForFlavor(actor),
        actionType: WORM_ACTION_TYPES.info,
        success: false,
        targetName: target.heroName,
      }),
    );
    return;
  }

  const attackRoll = rollDie(state.seed, 6, 31);
  state.seed = attackRoll.seed;
  const defenseRoll = rollDie(state.seed, 6, 37);
  state.seed = defenseRoll.seed;

  const score = attackRoll.value + effectiveStat(actor, "info");
  const resist = defenseRoll.value + effectiveStat(target, "info");

  if (score <= resist) {
    logLine(
      state,
      buildWormActionFlavor({
        card: cardForFlavor(actor),
        actionType: WORM_ACTION_TYPES.info,
        success: false,
        targetName: target.heroName,
      }),
    );
    return;
  }

  const infoValue = Math.max(2, effectiveStat(actor, "info"));
  const debuffRoll = rollDie(state.seed, infoValue, 41);
  state.seed = debuffRoll.seed;
  const reduction = Math.max(1, Math.floor(debuffRoll.value / 2));
  const statKey = normalizeInfoDebuffKey(order.infoStat);

  target.debuffs[statKey] = Math.max(0, Number(target.debuffs[statKey] || 0) + reduction);

  logLine(
    state,
    buildWormActionFlavor({
      card: cardForFlavor(actor),
      actionType: WORM_ACTION_TYPES.info,
      success: true,
      targetName: target.heroName,
      amount: `-${reduction} ${statKey}`,
    }),
  );
}

function resolveManipulation(state, actor, order) {
  let target = chooseAttackTarget(state, actor, order.targetId);
  if (!target) {
    return;
  }

  target = maybeRedirectByGuard(state, target);
  const speedCheck = consumeSpeedCheck(state, target, state.seed, 43);
  state.seed = speedCheck.seed;
  if (speedCheck.dodged) {
    logLine(
      state,
      buildWormActionFlavor({
        card: cardForFlavor(actor),
        actionType: WORM_ACTION_TYPES.manipulation,
        success: false,
        targetName: target.heroName,
      }),
    );
    return;
  }

  const attackRoll = rollDie(state.seed, 6, 47);
  state.seed = attackRoll.seed;
  const defenseRoll = rollDie(state.seed, 6, 53);
  state.seed = defenseRoll.seed;

  const score = attackRoll.value + effectiveStat(actor, "manipulation");
  const resist =
    defenseRoll.value +
    Math.max(0, effectiveStat(target, "manipulation") + effectiveStat(target, "range") - 3);

  if (score <= resist) {
    logLine(
      state,
      buildWormActionFlavor({
        card: cardForFlavor(actor),
        actionType: WORM_ACTION_TYPES.manipulation,
        success: false,
        targetName: target.heroName,
      }),
    );
    return;
  }

  target.confusedAttack = true;
  logLine(
    state,
    buildWormActionFlavor({
      card: cardForFlavor(actor),
      actionType: WORM_ACTION_TYPES.manipulation,
      success: true,
      targetName: target.heroName,
      amount: "confused",
    }),
  );
}

function resolveSpeed(state, actor) {
  actor.speedReady = true;
  logLine(
    state,
    buildWormActionFlavor({
      card: cardForFlavor(actor),
      actionType: WORM_ACTION_TYPES.speed,
      success: true,
      targetName: actor.heroName,
    }),
  );
}

function resolveStealth(state, actor) {
  actor.stealthReady = true;
  logLine(
    state,
    buildWormActionFlavor({
      card: cardForFlavor(actor),
      actionType: WORM_ACTION_TYPES.stealth,
      success: true,
      targetName: actor.heroName,
    }),
  );
}

function resolveOrder(state, actor, order) {
  switch (order.type) {
    case WORM_ACTION_TYPES.attack:
      resolveAttack(state, actor, order);
      return;
    case WORM_ACTION_TYPES.defense:
      resolveDefense(state, actor);
      return;
    case WORM_ACTION_TYPES.info:
      resolveInfo(state, actor, order);
      return;
    case WORM_ACTION_TYPES.manipulation:
      resolveManipulation(state, actor, order);
      return;
    case WORM_ACTION_TYPES.speed:
      resolveSpeed(state, actor);
      return;
    case WORM_ACTION_TYPES.stealth:
      resolveStealth(state, actor);
      return;
    default:
      resolveAttack(state, actor, order);
  }
}

function normalizeBattleState(state) {
  const source = state && typeof state === "object" ? state : {};
  const playerTeam = Array.isArray(source.playerTeam)
    ? source.playerTeam.map((combatant) => cloneCombatant(combatant))
    : [];
  const enemyTeam = Array.isArray(source.enemyTeam)
    ? source.enemyTeam.map((combatant) => cloneCombatant(combatant))
    : [];

  return {
    round: Math.max(1, Math.floor(Number(source.round) || 1)),
    seed: Number.isFinite(Number(source.seed)) ? Number(source.seed) >>> 0 : Date.now() >>> 0,
    enemyAiMode:
      [ENEMY_AI_MODES.basic, ENEMY_AI_MODES.weighted, ENEMY_AI_MODES.boss]
        .includes(safeText(source.enemyAiMode || ENEMY_AI_MODES.weighted).toLowerCase())
        ? safeText(source.enemyAiMode || ENEMY_AI_MODES.weighted).toLowerCase()
        : ENEMY_AI_MODES.weighted,
    playerTeam,
    enemyTeam,
    log: Array.isArray(source.log) ? source.log.slice(-24).map((line) => safeText(line)) : [],
    lastRoundEvents: Array.isArray(source.lastRoundEvents)
      ? source.lastRoundEvents.map((line) => safeText(line)).filter((line) => line).slice(0, 12)
      : [],
    winner: safeText(source.winner),
  };
}

export function createWormBattleState({
  playerCards = [],
  enemyCards = [],
  seed = Date.now() >>> 0,
  enemyAiMode = ENEMY_AI_MODES.weighted,
} = {}) {
  const playerTeam = playerCards.slice(0, 2).map((card, index) => buildCombatant(card, "player", index));
  const enemyTeam = enemyCards.slice(0, 2).map((card, index) => buildCombatant(card, "enemy", index));

  const state = normalizeBattleState({
    round: 1,
    seed,
    enemyAiMode,
    playerTeam,
    enemyTeam,
    log: ["Battle initialized."],
    lastRoundEvents: ["Battle initialized."],
    winner: "",
  });
  updateWinner(state);
  return state;
}

export function selectableWormActions() {
  return SELECTABLE_ACTIONS.slice();
}

export function infoDebuffStatKeys() {
  return INFO_DEBUFF_KEYS.slice();
}

export function normalizeWormOrder(order, actor, state) {
  return normalizeOrderForActor(actor, order, state);
}

export function resolveWormRound(
  battleState,
  { playerOrders = {}, enemyOrders = null } = {},
) {
  const next = cloneBattleState(normalizeBattleState(battleState));
  if (next.winner) {
    return next;
  }

  const resolvedEnemyOrders =
    enemyOrders && typeof enemyOrders === "object" ? enemyOrders : defaultEnemyOrders(next);
  const startLogLength = next.log.length;

  const order = buildInitiativeOrder(next);
  for (const combatantId of order) {
    if (next.winner) {
      break;
    }

    const actor = findCombatant(next, combatantId);
    if (!isAlive(actor)) {
      continue;
    }

    const sourceOrders = actor.teamId === "player" ? playerOrders : resolvedEnemyOrders;
    const selectedOrder = normalizeOrderForActor(actor, sourceOrders[actor.combatantId], next);
    resolveOrder(next, actor, selectedOrder);
    updateWinner(next);
  }

  const roundEvents = next.log.slice(startLogLength).filter(Boolean);
  next.lastRoundEvents = roundEvents.length ? roundEvents.slice(0, 12) : ["No decisive actions."];
  next.round += 1;
  return next;
}
