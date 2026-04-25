import { escapeHtml } from "../../templates/shared.js";
import { renderArtifactSymbol } from "../../core/artifacts.js";
import { renderRegionSymbol } from "../../core/symbology.js";
import { renderSlotRing } from "../../ui/slotRing.js";
import {
  madraPoolMultiplierForStage,
  normalizeCombatStage,
  randomUnit,
  rollDamage,
} from "./combatSystem.js";
import { prestigeModifiersFromState } from "../../systems/prestige.js";
import { lootInventoryFromState } from "../../systems/loot.js";

const NODE_ID = "CRD07";
const REQUIRED_MATERIALS = Object.freeze([
  "Nightwheel Ember Lotus",
  "Moonwell Pearl",
  "Stormforged Scale",
  "Dreadbeast Core",
]);
const REVELATION_ONE = "Underlord Revelation I";
const REVELATION_TWO = "Underlord Revelation II";
const REVELATION_CIPHER = "Underlord Revelation Cipher";
const REVELATION_TEXT = "I rise so I am no longer cast aside.";

const HUNT_ENEMIES = Object.freeze([
  { name: "Nightwheel Dreadboar", stage: "lowgold", maxHp: 240, attack: 24, ability: "charge" },
  { name: "Bleeding Moon Hound", stage: "highgold", maxHp: 260, attack: 26, ability: "bleed" },
  { name: "Stonehorn Tyrant", stage: "truegold", maxHp: 300, attack: 29, ability: "guard" },
  { name: "Riftback Raven", stage: "highgold", maxHp: 232, attack: 25, ability: "shroud" },
]);

function nowMs() {
  return Date.now();
}

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function rewardMatches(name, expected) {
  return normalizeText(name) === normalizeText(expected);
}

function readCrd02Runtime(state) {
  if (!state || !state.nodeRuntime || typeof state.nodeRuntime !== "object") {
    return {};
  }
  const runtime = state.nodeRuntime.CRD02;
  return runtime && typeof runtime === "object" ? runtime : {};
}

function rewardsMap(state) {
  return state && state.inventory && state.inventory.rewards && typeof state.inventory.rewards === "object"
    ? state.inventory.rewards
    : {};
}

function hasReward(state, name) {
  const rewards = rewardsMap(state);
  return Boolean(rewards[name]);
}

function revelationLine(line, hasCipher) {
  if (hasCipher) {
    return line;
  }
  return line
    .split("")
    .map((char, index) => {
      if (char === " ") {
        return " ";
      }
      return index % 3 === 0 ? "█" : "◊";
    })
    .join("");
}

function combatProfileFromState(state) {
  const crd02 = readCrd02Runtime(state);
  const upgrades = crd02.upgrades && typeof crd02.upgrades === "object" ? crd02.upgrades : {};
  const stage = normalizeCombatStage(crd02.cultivationStage || "foundation");
  const ironBody = Number(upgrades["blood-forged-iron-body"] || 0);
  const soulCloak = Number(upgrades["soul-cloak"] || 0);
  const emptyPalm = Number(upgrades["empty-palm"] || 0);
  const consume = Number(upgrades.consume || 0);
  const hollowDomain = Number(upgrades["hollow-domain"] || 0);
  const soulfireCycler = Number(crd02.soulfire && crd02.soulfire.soulfireCyclerLevel ? crd02.soulfire.soulfireCyclerLevel : 0);
  const modifiers = prestigeModifiersFromState(state || {});
  const attackMultiplier = Math.max(1, Number(modifiers.cradle && modifiers.cradle.combatAttackMultiplier) || 1);

  return {
    stage,
    hasEmptyPalm: emptyPalm > 0,
    meleeBonus: (soulCloak + consume + hollowDomain + soulfireCycler) * attackMultiplier,
    dodgeBonus: soulCloak + hollowDomain,
    maxHp: 145 + ironBody * 30 + (stage === "truegold" ? 40 : stage === "underlord" ? 80 : 0),
    maxMadra: Math.round((130 + soulCloak * 4 + consume * 7 + hollowDomain * 8) * madraPoolMultiplierForStage(stage)),
  };
}

function pickEnemy(seed) {
  const index = Math.abs(Math.floor(Number(seed) || nowMs())) % HUNT_ENEMIES.length;
  const source = HUNT_ENEMIES[index] || HUNT_ENEMIES[0];
  return {
    ...source,
    hp: source.maxHp,
    stunnedTurns: 0,
    shieldTurns: 0,
  };
}

function normalizeRuntime(candidate) {
  const source = candidate && typeof candidate === "object" ? candidate : {};
  const sourceMaterials = source.materials && typeof source.materials === "object" ? source.materials : {};
  const materials = {};
  for (const material of REQUIRED_MATERIALS) {
    materials[material] = String(sourceMaterials[material] || "");
  }

  return {
    tab: source.tab === "hunts" ? "hunts" : "home",
    materials,
    revelationInput: String(source.revelationInput || ""),
    battle: source.battle && typeof source.battle === "object" ? {
      ...source.battle,
      playerHp: Math.max(0, Number(source.battle.playerHp) || 0),
      playerMaxHp: Math.max(1, Number(source.battle.playerMaxHp) || 1),
      playerMadra: Math.max(0, Number(source.battle.playerMadra) || 0),
      playerMaxMadra: Math.max(1, Number(source.battle.playerMaxMadra) || 1),
      playerStage: normalizeCombatStage(source.battle.playerStage || "foundation"),
      enemy: source.battle.enemy && typeof source.battle.enemy === "object" ? {
        ...source.battle.enemy,
        hp: Math.max(0, Number(source.battle.enemy.hp) || 0),
        maxHp: Math.max(1, Number(source.battle.enemy.maxHp) || 1),
        stage: normalizeCombatStage(source.battle.enemy.stage || "foundation"),
        attack: Math.max(1, Number(source.battle.enemy.attack) || 1),
        stunnedTurns: Math.max(0, Math.floor(Number(source.battle.enemy.stunnedTurns) || 0)),
        shieldTurns: Math.max(0, Math.floor(Number(source.battle.enemy.shieldTurns) || 0)),
      } : null,
      dodgeReady: Boolean(source.battle.dodgeReady),
      dodgeBonus: Math.max(0, Number(source.battle.dodgeBonus) || 0),
      meleeBonus: Math.max(0, Number(source.battle.meleeBonus) || 0),
      emptyPalmUnlocked: Boolean(source.battle.emptyPalmUnlocked),
      log: Array.isArray(source.battle.log) ? source.battle.log.slice(-10).map((line) => String(line)) : [],
      winner: String(source.battle.winner || ""),
      seed: Number.isFinite(source.battle.seed) ? Number(source.battle.seed) >>> 0 : (Date.now() >>> 0),
      rewardMaterial: String(source.battle.rewardMaterial || ""),
      rewardMadra: Math.max(0, Number(source.battle.rewardMadra) || 0),
      turn: Math.max(1, Math.floor(Number(source.battle.turn) || 1)),
    } : null,
    pendingMadraAward: Math.max(0, Number(source.pendingMadraAward) || 0),
    pendingUnderlordAdvance: Boolean(source.pendingUnderlordAdvance),
    consumeLootItemId: String(source.consumeLootItemId || ""),
    lootEvents: Array.isArray(source.lootEvents) ? source.lootEvents.filter((entry) => entry && typeof entry === "object") : [],
    solved: Boolean(source.solved),
    lastMessage: String(source.lastMessage || ""),
  };
}

function allMaterialsSocketed(materials) {
  return REQUIRED_MATERIALS.every((material) => Boolean(materials[material]));
}

function barMarkup(label, current, max, className = "") {
  const safeMax = Math.max(1, Number(max) || 1);
  const value = Math.max(0, Number(current) || 0);
  const percent = Math.min(100, Math.max(0, (value / safeMax) * 100));
  return `
    <div class="crd04-bar ${className}">
      <div class="crd04-bar-label">${escapeHtml(label)}</div>
      <div class="crd04-bar-track"><span style="width:${percent.toFixed(2)}%"></span></div>
      <div class="crd04-bar-value">${escapeHtml(String(Math.round(value)))}/${escapeHtml(String(Math.round(safeMax)))}</div>
    </div>
  `;
}

function resolveEnemyTurn(battle) {
  const enemy = battle.enemy;
  if (!enemy) {
    return battle;
  }
  let next = {
    ...battle,
    enemy: { ...enemy },
  };

  if (next.enemy.stunnedTurns > 0) {
    next.enemy.stunnedTurns -= 1;
    next.log = [...next.log, `${next.enemy.name} is stunned by disrupted channels.`].slice(-10);
    return next;
  }

  if (next.enemy.ability === "guard" && next.turn % 3 === 0) {
    next.enemy.shieldTurns = 1;
    next.log = [...next.log, `${next.enemy.name} hardens its hide with aura plating.`].slice(-10);
    return next;
  }

  const dodgeChance = next.dodgeReady ? Math.min(0.85, 0.45 + next.dodgeBonus * 0.05) : 0;
  if (dodgeChance > 0) {
    const dodgeRoll = randomUnit(next.seed, 33);
    next.seed = dodgeRoll.seed;
    if (dodgeRoll.value < dodgeChance) {
      next.dodgeReady = false;
      next.log = [...next.log, "You slip clear of the beast's strike."].slice(-10);
      return next;
    }
  }

  const bonus = next.enemy.ability === "bleed" ? 4 : next.enemy.ability === "charge" ? 6 : 0;
  const roll = rollDamage({
    seed: next.seed,
    salt: 19,
    base: next.enemy.attack + bonus,
    spread: 6,
    attackerStage: next.enemy.stage,
    defenderStage: next.playerStage,
  });
  next.seed = roll.seed;
  next.playerHp = Math.max(0, next.playerHp - roll.damage);
  next.dodgeReady = false;
  next.log = [...next.log, `${next.enemy.name} tears across you for ${roll.damage}.`].slice(-10);
  return next;
}

function resolvePlayerMove(battle, move) {
  const enemy = battle.enemy;
  if (!enemy) {
    return battle;
  }
  const next = {
    ...battle,
    enemy: { ...enemy },
  };

  if (move === "dodge") {
    next.dodgeReady = true;
    next.log = [...next.log, "You settle your breath and step into evasive cadence."].slice(-10);
    return next;
  }

  if (move === "empty-palm") {
    if (!next.emptyPalmUnlocked) {
      next.log = [...next.log, "You have not learned the Empty Palm."].slice(-10);
      return next;
    }
    if (next.playerMadra < 16) {
      next.log = [...next.log, "Not enough madra for the Empty Palm."].slice(-10);
      return next;
    }
    const roll = rollDamage({
      seed: next.seed,
      salt: 11,
      base: 19 + next.meleeBonus,
      spread: 4,
      attackerStage: next.playerStage,
      defenderStage: next.enemy.stage,
    });
    next.seed = roll.seed;
    next.playerMadra = Math.max(0, next.playerMadra - 16);
    next.enemy.hp = Math.max(0, next.enemy.hp - roll.damage);
    next.enemy.stunnedTurns = Math.max(1, next.enemy.stunnedTurns);
    next.log = [...next.log, `Empty Palm lands for ${roll.damage}.`].slice(-10);
    return next;
  }

  const roll = rollDamage({
    seed: next.seed,
    salt: 7,
    base: 15 + next.meleeBonus * 2,
    spread: 6,
    attackerStage: next.playerStage,
    defenderStage: next.enemy.stage,
  });
  next.seed = roll.seed;
  const shielded = next.enemy.shieldTurns > 0;
  if (shielded) {
    next.enemy.shieldTurns = 0;
    next.enemy.hp = Math.max(0, next.enemy.hp - Math.max(1, Math.floor(roll.damage * 0.45)));
    next.log = [...next.log, `Your strike is partially deflected (${roll.damage} -> reduced).`].slice(-10);
  } else {
    next.enemy.hp = Math.max(0, next.enemy.hp - roll.damage);
    next.log = [...next.log, `You strike for ${roll.damage}.`].slice(-10);
  }
  return next;
}

function initialRuntime() {
  return normalizeRuntime({
    tab: "home",
    materials: {},
    revelationInput: "",
    battle: null,
    pendingMadraAward: 0,
    pendingUnderlordAdvance: false,
    consumeLootItemId: "",
    lootEvents: [],
    solved: false,
    lastMessage: "",
  });
}

export function initialCrd07Runtime() {
  return initialRuntime();
}

export function synchronizeCrd07Runtime(runtime) {
  return normalizeRuntime(runtime);
}

export function validateCrd07Runtime(runtime) {
  return Boolean(runtime && runtime.solved);
}

export function reduceCrd07Runtime(runtime, action, context = {}) {
  const current = normalizeRuntime(runtime);
  if (!action || typeof action !== "object") {
    return current;
  }

  if (action.type === "crd07-open-tab") {
    return {
      ...current,
      tab: action.tab === "hunts" ? "hunts" : "home",
    };
  }

  if (action.type === "crd07-start-hunt") {
    if (current.battle) {
      return current;
    }
    const profile = combatProfileFromState(context.state || {});
    const enemy = pickEnemy(action.seed || Date.now());
    const rewardMaterial = REQUIRED_MATERIALS[Math.abs(Math.floor(Number(action.seed) || Date.now())) % REQUIRED_MATERIALS.length];
    const rewardMadra = 1800 + Math.floor(Math.random() * 600);
    return {
      ...current,
      tab: "hunts",
      battle: {
        playerHp: profile.maxHp,
        playerMaxHp: profile.maxHp,
        playerMadra: profile.maxMadra,
        playerMaxMadra: profile.maxMadra,
        playerStage: profile.stage,
        dodgeReady: false,
        dodgeBonus: profile.dodgeBonus,
        meleeBonus: profile.meleeBonus,
        emptyPalmUnlocked: profile.hasEmptyPalm,
        enemy,
        log: [`${enemy.name} emerges from the ravine.`],
        winner: "",
        seed: (Date.now() >>> 0),
        rewardMaterial,
        rewardMadra,
        turn: 1,
      },
      lastMessage: "",
    };
  }

  if (action.type === "crd07-player-action") {
    if (!current.battle || current.battle.winner) {
      return current;
    }
    let battle = resolvePlayerMove(current.battle, String(action.move || "melee"));
    if (battle.enemy && battle.enemy.hp <= 0) {
      battle = {
        ...battle,
        winner: "player",
        log: [...battle.log, `${battle.enemy.name} collapses. Claim your spoils.`].slice(-10),
      };
      return {
        ...current,
        battle,
      };
    }

    battle = resolveEnemyTurn(battle);
    if (battle.playerHp <= 0) {
      battle = {
        ...battle,
        winner: "enemy",
        log: [...battle.log, "You are driven from Nightwheel Valley."].slice(-10),
      };
    }

    battle.turn += 1;
    return {
      ...current,
      battle,
    };
  }

  if (action.type === "crd07-claim-hunt") {
    if (!current.battle || !current.battle.winner) {
      return current;
    }
    const won = current.battle.winner === "player";
    if (!won) {
      return {
        ...current,
        battle: null,
        lastMessage: "The valley rejects your claim. Return stronger.",
      };
    }

    const material = current.battle.rewardMaterial;
    const label = `${material} (Uncommon)`;
    const customDrop = {
      templateId: `crd_underlord_material_${normalizeText(material).replace(/[^a-z0-9]+/g, "-")}`,
      label,
      region: "crd",
      rarity: "uncommon",
      kind: "crd_advancement_material",
      stackable: true,
      effects: [],
      sourceRegion: "crd",
      triggerType: "crd07-hunt",
      outOfRegion: false,
      createdAt: Date.now(),
      durationMs: 0,
    };

    return {
      ...current,
      battle: null,
      pendingMadraAward: current.battle.rewardMadra,
      lootEvents: [{ customDrop }],
      lastMessage: `${material} recovered from the valley hunt.`,
    };
  }

  if (action.type === "crd07-socket-material") {
    const material = String(action.material || "");
    if (!REQUIRED_MATERIALS.includes(material)) {
      return current;
    }
    if (current.materials[material]) {
      return current;
    }
    const itemId = String(action.itemId || "");
    const itemLabel = String(action.itemLabel || "");
    if (!itemId) {
      return {
        ...current,
        lastMessage: `Select ${material} in Loot before socketing.`,
      };
    }
    if (!normalizeText(itemLabel).includes(normalizeText(material))) {
      return {
        ...current,
        lastMessage: "That item does not resonate with this socket.",
      };
    }
    return {
      ...current,
      materials: {
        ...current.materials,
        [material]: itemId,
      },
      consumeLootItemId: itemId,
      lastMessage: `${material} socketed.`,
    };
  }

  if (action.type === "crd07-set-revelation") {
    return {
      ...current,
      revelationInput: String(action.value || ""),
    };
  }

  if (action.type === "crd07-advance-underlord") {
    const stage = normalizeCombatStage(action.playerStage || "foundation");
    const hasAllArtifacts = Boolean(action.hasR1 && action.hasR2 && action.hasCipher);
    const materialsReady = allMaterialsSocketed(current.materials);
    if (stage !== "truegold" && stage !== "underlord") {
      return {
        ...current,
        lastMessage: "Reach True Gold before attempting Underlord.",
      };
    }
    if (!materialsReady) {
      return {
        ...current,
        lastMessage: "You still lack Nightwheel advancement materials.",
      };
    }
    if (!hasAllArtifacts) {
      return {
        ...current,
        lastMessage: "The revelation fragments are incomplete.",
      };
    }
    if (normalizeText(current.revelationInput) !== normalizeText(REVELATION_TEXT)) {
      return {
        ...current,
        lastMessage: "Your revelation does not settle into truth.",
      };
    }

    return {
      ...current,
      solved: true,
      pendingUnderlordAdvance: true,
      lastMessage: "Soulfire ignites. You step into Underlord.",
    };
  }

  if (action.type === "crd07-clear-consumed-item") {
    return {
      ...current,
      consumeLootItemId: "",
    };
  }

  if (action.type === "crd07-clear-pending-madra") {
    return {
      ...current,
      pendingMadraAward: 0,
    };
  }

  if (action.type === "crd07-clear-underlord-pending") {
    return {
      ...current,
      pendingUnderlordAdvance: false,
    };
  }

  return current;
}

export function buildCrd07ActionFromElement(element) {
  const actionName = element.getAttribute("data-node-action");
  if (!actionName) {
    return null;
  }
  if (actionName === "crd07-open-tab") {
    return {
      type: "crd07-open-tab",
      tab: element.getAttribute("data-tab") || "home",
      at: Date.now(),
    };
  }
  if (actionName === "crd07-start-hunt") {
    return {
      type: "crd07-start-hunt",
      seed: Date.now(),
      at: Date.now(),
    };
  }
  if (actionName === "crd07-player-action") {
    return {
      type: "crd07-player-action",
      move: element.getAttribute("data-move") || "melee",
      at: Date.now(),
    };
  }
  if (actionName === "crd07-claim-hunt") {
    return {
      type: "crd07-claim-hunt",
      at: Date.now(),
    };
  }
  if (actionName === "crd07-socket-material") {
    return {
      type: "crd07-socket-material",
      material: element.getAttribute("data-material") || "",
      itemId: element.getAttribute("data-selected-item-id") || "",
      itemLabel: element.getAttribute("data-selected-item-label") || "",
      at: Date.now(),
    };
  }
  if (actionName === "crd07-set-revelation") {
    const container = element.closest(".crd07-node");
    const input = container ? container.querySelector("[data-crd07-revelation-input]") : null;
    return {
      type: "crd07-set-revelation",
      value: input && "value" in input ? String(input.value || "") : "",
      at: Date.now(),
    };
  }
  if (actionName === "crd07-advance-underlord") {
    return {
      type: "crd07-advance-underlord",
      playerStage: element.getAttribute("data-player-stage") || "foundation",
      hasR1: element.getAttribute("data-has-r1") === "true",
      hasR2: element.getAttribute("data-has-r2") === "true",
      hasCipher: element.getAttribute("data-has-cipher") === "true",
      at: Date.now(),
    };
  }
  return null;
}

function homeTabMarkup(runtime, context) {
  const state = context.state || {};
  const loot = lootInventoryFromState(state, Date.now());
  const selectedItemId = String(context.selectedLootItemId || "");
  const selectedItem = selectedItemId ? loot.items[selectedItemId] : null;
  const selectedLabel = selectedItem ? String(selectedItem.label || "") : "";
  const hasR1 = hasReward(state, REVELATION_ONE);
  const hasR2 = hasReward(state, REVELATION_TWO);
  const hasCipher = hasReward(state, REVELATION_CIPHER);
  const crd02 = readCrd02Runtime(state);
  const stage = normalizeCombatStage(crd02.cultivationStage || "foundation");
  const canWriteRevelation = stage === "truegold" || stage === "underlord";
  const canAttempt = stage === "truegold" && hasR1 && hasR2 && hasCipher && allMaterialsSocketed(runtime.materials);

  const slots = REQUIRED_MATERIALS.map((material) => {
    const filled = Boolean(runtime.materials[material]);
    return {
      filled,
      clickable: !filled,
      ready: selectedLabel ? normalizeText(selectedLabel).includes(normalizeText(material)) : false,
      title: filled
        ? `${material} socketed`
        : selectedLabel
          ? `Socket ${material} with selected loot`
          : `Select ${material} in Loot, then click`,
      ariaLabel: `${material} socket`,
      symbolHtml: filled
        ? renderArtifactSymbol({ artifactName: material, className: "slot-ring-symbol artifact-symbol" })
        : "",
      attrs: {
        "data-node-id": NODE_ID,
        "data-node-action": "crd07-socket-material",
        "data-material": material,
        "data-selected-item-id": selectedItemId,
        "data-selected-item-label": selectedLabel,
      },
    };
  });

  return `
    <section class="crd02-panel">
      <h4>Nightwheel Base</h4>
      ${renderSlotRing({
    slots,
    className: "crd07-material-ring",
    centerHtml: renderRegionSymbol({
      section: "Cradle",
      className: "slot-ring-center-symbol",
    }),
    ariaLabel: "Underlord advancement materials",
  })}
      <div class="toolbar">
        <button type="button" data-action="toggle-widget" data-widget="loot">Open Loot Panel</button>
      </div>
      <p><strong>Revelation Fragments</strong></p>
      ${hasR1 ? `<p class="muted">${escapeHtml(revelationLine("I rise so I am", hasCipher))}</p>` : ""}
      ${hasR2 ? `<p class="muted">${escapeHtml(revelationLine("no longer cast aside.", hasCipher))}</p>` : ""}
      <input
        type="text"
        data-crd07-revelation-input
        value="${escapeHtml(runtime.revelationInput)}"
        placeholder="Underlord revelation"
        ${canWriteRevelation ? "" : "disabled"}
      />
      <div class="toolbar" style="margin-top:8px;">
        <button type="button" data-node-id="${NODE_ID}" data-node-action="crd07-set-revelation" ${canWriteRevelation ? "" : "disabled"}>Set Revelation</button>
        <button
          type="button"
          data-node-id="${NODE_ID}"
          data-node-action="crd07-advance-underlord"
          data-player-stage="${escapeHtml(stage)}"
          data-has-r1="${hasR1 ? "true" : "false"}"
          data-has-r2="${hasR2 ? "true" : "false"}"
          data-has-cipher="${hasCipher ? "true" : "false"}"
          ${canAttempt ? "" : "disabled"}
        >
          Advance to Underlord
        </button>
      </div>
    </section>
  `;
}

function huntsTabMarkup(runtime) {
  if (!runtime.battle) {
    return `
      <section class="crd02-panel">
        <h4>Nightwheel Hunts</h4>
        <p>Track valley beasts for advancement materials and madra.</p>
        <button type="button" data-node-id="${NODE_ID}" data-node-action="crd07-start-hunt">Begin Hunt</button>
      </section>
    `;
  }

  const battle = runtime.battle;
  const enemy = battle.enemy;
  return `
    <section class="crd04-combat-head">
      <h3>Nightwheel Hunt</h3>
      <p class="muted">Opponent: ${escapeHtml(enemy ? enemy.name : "Unknown")} (${escapeHtml(enemy ? enemy.stage : "")})</p>
    </section>

    <section class="crd04-bars">
      ${barMarkup("Health", battle.playerHp, battle.playerMaxHp, "is-health")}
      ${barMarkup("Madra", battle.playerMadra, battle.playerMaxMadra, "is-madra")}
    </section>

    <section class="crd04-bars enemy">
      ${barMarkup(`${enemy ? enemy.name : "Beast"} HP`, enemy ? enemy.hp : 0, enemy ? enemy.maxHp : 1, "is-enemy")}
    </section>

    <section class="crd04-actions">
      <button type="button" data-node-id="${NODE_ID}" data-node-action="crd07-player-action" data-move="melee" ${battle.winner ? "disabled" : ""}>Melee</button>
      <button type="button" data-node-id="${NODE_ID}" data-node-action="crd07-player-action" data-move="dodge" ${battle.winner ? "disabled" : ""}>Dodge</button>
      <button type="button" data-node-id="${NODE_ID}" data-node-action="crd07-player-action" data-move="empty-palm" ${battle.winner || !battle.emptyPalmUnlocked ? "disabled" : ""}>Empty Palm</button>
      ${battle.winner ? `<button type="button" data-node-id="${NODE_ID}" data-node-action="crd07-claim-hunt">Claim Outcome</button>` : ""}
    </section>

    <section class="crd04-log">
      <h4>Combat Log</h4>
      <ul>
        ${(battle.log || []).map((line) => `<li>${escapeHtml(line)}</li>`).join("")}
      </ul>
    </section>
  `;
}

export function renderCrd07Experience(context) {
  const runtime = normalizeRuntime(context.runtime);
  return `
    <article class="crd04-node crd07-node" data-node-id="${NODE_ID}">
      <section class="crd02-panel">
        <h3>CRD07: Nightwheel Valley</h3>
        <div class="toolbar">
          <button type="button" data-node-id="${NODE_ID}" data-node-action="crd07-open-tab" data-tab="home" ${runtime.tab === "home" ? "disabled" : ""}>Home Base</button>
          <button type="button" data-node-id="${NODE_ID}" data-node-action="crd07-open-tab" data-tab="hunts" ${runtime.tab === "hunts" ? "disabled" : ""}>Valley Hunts</button>
        </div>
        ${runtime.lastMessage ? `<p class="muted">${escapeHtml(runtime.lastMessage)}</p>` : ""}
      </section>

      ${runtime.tab === "hunts" ? huntsTabMarkup(runtime) : homeTabMarkup(runtime, context)}

      ${runtime.solved ? `<section class="completion-banner"><p><strong>Underlord Ascended</strong></p></section>` : ""}
    </article>
  `;
}

export const CRD07_NODE_EXPERIENCE = {
  nodeId: NODE_ID,
  initialState: initialCrd07Runtime,
  synchronizeRuntime: synchronizeCrd07Runtime,
  render: renderCrd07Experience,
  reduceRuntime: reduceCrd07Runtime,
  validateRuntime: validateCrd07Runtime,
  buildActionFromElement: buildCrd07ActionFromElement,
};
