import { escapeHtml } from "../../templates/shared.js";
import { normalizeWormSystemState, wormOwnedCards } from "../../systems/wormDeck.js";
import { lootInventoryFromState } from "../../systems/loot.js";
import { wormCardById } from "../worm/wormData.js";
import { getNodeRuntime } from "../../core/state.js";

const NODE_ID = "TWI03";
const QUEST_SLOTS = 3;
export const TWI03_SPECIAL_REWARD_SEQUENCE = Object.freeze([
  "DCC Floor-2 Key",
  "Cape Compactifier",
  "Wave-III Passkey",
  "x10 Hiring Access",
  "The Transient, Ephemeral, Fleeting Vault of the Mortal World. The Evanescent Safe of Passing Moments, the Faded Chest of Then and Them. The Box of Incontinuity",
]);

const COMMON_CHARACTERS = Object.freeze(["Erin", "Lyonette", "Pisces", "Ceria"]);
const UNCOMMON_CHARACTERS = Object.freeze(["Numbtongue", "Olesm", "Bird", "Rags"]);
const RARE_CHARACTERS = Object.freeze(["Niers", "Relc", "Mrsha", "Ryoka"]);

const QUEST_TYPES = Object.freeze([
  Object.freeze({ type: "madra", baseAmount: 30, growth: 25, label: "Madra" }),
  Object.freeze({ type: "clout", baseAmount: 18, growth: 14, label: "Clout" }),
  Object.freeze({ type: "gold", baseAmount: 28, growth: 22, label: "Gold" }),
  Object.freeze({ type: "sacrifice_int", baseAmount: 1, growth: 0, label: "Cape Sacrifice" }),
]);

function safeText(value) {
  return String(value || "").trim();
}

function safeInt(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.floor(numeric) : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function randomIndex(seed, size) {
  const count = Math.max(1, Math.floor(Number(size) || 1));
  const state = Math.abs(Math.floor(Number(seed) || 0));
  return state % count;
}

function characterPoolForTier(tier) {
  if (tier >= 4) {
    return [...COMMON_CHARACTERS, ...UNCOMMON_CHARACTERS, ...RARE_CHARACTERS];
  }
  if (tier >= 2) {
    return [...COMMON_CHARACTERS, ...UNCOMMON_CHARACTERS];
  }
  return [...COMMON_CHARACTERS];
}

function createQuest(seed, tier, completedCount) {
  const typeDef = QUEST_TYPES[randomIndex(seed + 17, QUEST_TYPES.length)] || QUEST_TYPES[0];
  const pool = characterPoolForTier(tier);
  const character = pool[randomIndex(seed + 31, pool.length)] || "Guest";
  const amount = typeDef.type === "sacrifice_int"
    ? 1
    : Math.max(1, typeDef.baseAmount + (typeDef.growth * Math.max(0, tier - 1)));
  const repReward = Math.max(4, 6 + (tier * 3) + Math.floor(completedCount / 2));
  const questId = `quest-${seed}-${tier}-${completedCount}`;
  return {
    id: questId,
    character,
    requirementType: typeDef.type,
    requirementLabel: typeDef.label,
    amount,
    repReward,
    lootChance: 0.2,
    outRegionChance: 1,
  };
}

function normalizeRuntime(runtime) {
  const source = runtime && typeof runtime === "object" ? runtime : {};
  const quests = Array.isArray(source.quests) ? source.quests.filter((quest) => quest && typeof quest === "object") : [];
  return {
    quests: quests.slice(0, QUEST_SLOTS),
    selectedQuestId: safeText(source.selectedQuestId),
    specialRewardIndex: Math.max(0, safeInt(source.specialRewardIndex, 0)),
    totalCompleted: Math.max(0, safeInt(source.totalCompleted, 0)),
    totalCanceled: Math.max(0, safeInt(source.totalCanceled, 0)),
    generationNonce: Math.max(0, safeInt(source.generationNonce, 0)),
    lootEvents: Array.isArray(source.lootEvents) ? source.lootEvents.filter((entry) => entry && typeof entry === "object") : [],
    lastMessage: safeText(source.lastMessage),
    solved: Boolean(source.solved) || Math.max(0, safeInt(source.totalCompleted, 0)) > 0,
  };
}

function refillQuests(runtime, tier) {
  const quests = Array.isArray(runtime.quests) ? runtime.quests.slice(0, QUEST_SLOTS) : [];
  let nonce = Math.max(0, safeInt(runtime.generationNonce, 0));
  while (quests.length < QUEST_SLOTS) {
    const seed = Date.now() + (nonce * 97) + (tier * 311);
    quests.push(createQuest(seed, tier, runtime.totalCompleted));
    nonce += 1;
  }
  return {
    ...runtime,
    quests,
    generationNonce: nonce,
  };
}

export function initialTwi03Runtime() {
  return refillQuests(normalizeRuntime({}), 0);
}

export function synchronizeTwi03Runtime(runtime, context = {}) {
  const loot = lootInventoryFromState(context.state || {}, Date.now());
  const tier = Math.max(0, safeInt(loot.progression && loot.progression.innTier, 0));
  return refillQuests(normalizeRuntime(runtime), tier);
}

export function validateTwi03Runtime(runtime) {
  const normalized = normalizeRuntime(runtime);
  return normalized.solved || normalized.totalCompleted > 0;
}

export function reduceTwi03Runtime(runtime, action, context = {}) {
  const current = synchronizeTwi03Runtime(runtime, context);
  if (!action || typeof action !== "object") {
    return {
      ...current,
      lootEvents: [],
    };
  }

  if (action.type === "twi03-select-quest") {
    return {
      ...current,
      selectedQuestId: safeText(action.questId),
      lootEvents: [],
    };
  }

  if (action.type === "twi03-fulfill-quest") {
    if (!action.applied) {
      return {
        ...current,
        lootEvents: [],
        lastMessage: safeText(action.message) || "Quest requirements not met.",
      };
    }
    const questId = safeText(action.questId);
    const nextQuests = current.quests.filter((quest) => quest.id !== questId);
    const next = refillQuests({
      ...current,
      selectedQuestId: "",
      quests: nextQuests,
      specialRewardIndex: Math.max(
        current.specialRewardIndex,
        Math.max(0, safeInt(action.specialRewardIndex, current.specialRewardIndex)),
      ),
      totalCompleted: current.totalCompleted + 1,
      solved: true,
      lastMessage: safeText(action.message) || "Quest completed.",
    }, Math.max(0, safeInt(action.innTier, 0)));
    return {
      ...next,
      lootEvents: action.lootEligible
        ? [
            {
              sourceRegion: "twi",
              triggerType: "inn-quest",
              dropChance: Number(action.lootChance) || 0.2,
              outRegionChance: Number(action.outRegionChance) || 1,
              rarityBias: Number(action.rarityBias) || 0.05,
              forceOutRegion: true,
            },
          ]
        : [],
    };
  }

  if (action.type === "twi03-cancel-quest") {
    const questId = safeText(action.questId);
    const nextQuests = current.quests.filter((quest) => quest.id !== questId);
    const next = refillQuests({
      ...current,
      selectedQuestId: "",
      quests: nextQuests,
      totalCanceled: current.totalCanceled + 1,
      lastMessage: safeText(action.message) || "Quest canceled.",
    }, Math.max(0, safeInt(action.innTier, 0)));
    return {
      ...next,
      lootEvents: [],
    };
  }

  return {
    ...current,
    lootEvents: [],
  };
}

function requirementText(quest) {
  if (quest.requirementType === "madra") {
    return `Deliver ${quest.amount} Madra`;
  }
  if (quest.requirementType === "clout") {
    return `Deliver ${quest.amount} Clout`;
  }
  if (quest.requirementType === "gold") {
    return `Deliver ${quest.amount} Gold`;
  }
  return "Sacrifice a cape with INT > 5";
}

function eligibleSacrificeCards(state) {
  const wormState = normalizeWormSystemState(state && state.systems ? state.systems.worm : {}, Date.now());
  const owned = wormOwnedCards(wormState, Date.now());
  return owned.filter((entry) => {
    const card = wormCardById(entry.cardId);
    return card && Number(card.info || 0) > 5;
  });
}

function ownedAmountForRequirement(state, quest) {
  if (!quest) {
    return 0;
  }
  if (quest.requirementType === "madra") {
    const crd = getNodeRuntime(state || {}, "CRD02", () => ({}));
    return Number(crd && crd.madra ? crd.madra : 0);
  }
  if (quest.requirementType === "clout") {
    const wormState = state && state.systems && state.systems.worm ? state.systems.worm : {};
    return Number(wormState.clout || 0);
  }
  if (quest.requirementType === "gold") {
    const dcc = getNodeRuntime(state || {}, "DCC01", () => ({}));
    const meta = dcc && dcc.meta && typeof dcc.meta === "object" ? dcc.meta : {};
    return Number(meta.gold || 0);
  }
  return eligibleSacrificeCards(state || {}).length;
}

function questPopupMarkup(quest, context, innTier) {
  if (!quest) {
    return "";
  }
  const eligible = eligibleSacrificeCards(context.state || {});
  const needsCape = quest.requirementType === "sacrifice_int";
  const sacrificeOptions = eligible
    .map((entry) => `<option value="${escapeHtml(entry.cardId)}">${escapeHtml(entry.card.heroName)}</option>`)
    .join("");
  const owned = ownedAmountForRequirement(context.state || {}, quest);
  const canFulfill = needsCape
    ? eligible.length > 0
    : owned >= Number(quest.amount || 0);
  return `
    <div class="crd02-tech-modal" role="dialog" aria-label="Inn Quest">
      <section class="crd02-tech-surface">
        <header>
          <h3>${escapeHtml(quest.character)}'s Request</h3>
          <button type="button" class="ghost" data-node-id="${NODE_ID}" data-node-action="twi03-select-quest" data-quest-id="">Close</button>
        </header>
        <p>${escapeHtml(requirementText(quest))}</p>
        <p><strong>You have:</strong> ${escapeHtml(String(Math.floor(owned)))} ${escapeHtml(quest.requirementLabel)}</p>
        <p><strong>Reward:</strong> ${quest.repReward} Inn Reputation</p>
        <p class="muted">Inn Tier ${innTier}</p>
        ${
          needsCape
            ? `
              <label>
                <span class="muted">Cape</span>
                <select data-twi03-sacrifice="${escapeHtml(quest.id)}">
                  ${sacrificeOptions}
                </select>
              </label>
            `
            : ""
        }
        <div class="toolbar">
          <button
            type="button"
            data-node-id="${NODE_ID}"
            data-node-action="twi03-fulfill-quest"
            data-quest-id="${escapeHtml(quest.id)}"
            data-requirement-type="${escapeHtml(quest.requirementType)}"
            data-amount="${escapeHtml(String(quest.amount))}"
            data-rep-reward="${escapeHtml(String(quest.repReward))}"
            data-loot-chance="${escapeHtml(String(quest.lootChance))}"
            data-out-region-chance="${escapeHtml(String(quest.outRegionChance))}"
            ${canFulfill ? "" : "disabled"}
          >
            Fulfill
          </button>
          <button
            type="button"
            class="ghost"
            data-node-id="${NODE_ID}"
            data-node-action="twi03-cancel-quest"
            data-quest-id="${escapeHtml(quest.id)}"
          >
            Cancel Quest
          </button>
        </div>
      </section>
    </div>
  `;
}

function innBackdropClass(innTier) {
  if (innTier >= 5) {
    return "twi-inn-tier-5";
  }
  if (innTier >= 3) {
    return "twi-inn-tier-3";
  }
  if (innTier >= 1) {
    return "twi-inn-tier-1";
  }
  return "twi-inn-tier-0";
}

function innVisualTierClass(innTier) {
  if (innTier >= 5) {
    return "twi03-inn-visual-tier-5";
  }
  if (innTier >= 3) {
    return "twi03-inn-visual-tier-3";
  }
  if (innTier >= 1) {
    return "twi03-inn-visual-tier-1";
  }
  return "twi03-inn-visual-tier-0";
}

export function renderTwi03Experience(context) {
  const runtime = synchronizeTwi03Runtime(context.runtime, context);
  const loot = lootInventoryFromState(context.state || {}, Date.now());
  const innTier = clamp(safeInt(loot.progression && loot.progression.innTier, 0), 0, 99);
  const rep = Math.max(0, safeInt(loot.progression && loot.progression.twiReputation, 0));
  const selectedQuest = runtime.quests.find((quest) => quest.id === runtime.selectedQuestId) || null;
  const rewardProgress = Math.min(runtime.specialRewardIndex, TWI03_SPECIAL_REWARD_SEQUENCE.length);

  return `
    <article class="twi03-node" data-node-id="${NODE_ID}">
      <section class="card ${innBackdropClass(innTier)}">
        <h3>The Inn</h3>
        <p><strong>Inn Reputation:</strong> ${rep}</p>
        <p><strong>Inn Tier:</strong> ${innTier}</p>
        <p class="muted"><strong>Milestones:</strong> ${rewardProgress}/${TWI03_SPECIAL_REWARD_SEQUENCE.length}</p>
        <div class="twi03-inn-visual ${innVisualTierClass(innTier)}" aria-hidden="true">
          <span class="twi03-beam twi03-beam-a"></span>
          <span class="twi03-beam twi03-beam-b"></span>
          <span class="twi03-hearth"></span>
          <span class="twi03-table"></span>
          <span class="twi03-lantern twi03-lantern-a"></span>
          <span class="twi03-lantern twi03-lantern-b"></span>
          <span class="twi03-stair"></span>
        </div>
        <div class="toolbar">
          ${runtime.quests.map((quest) => `
            <button
              type="button"
              class="${runtime.selectedQuestId === quest.id ? "" : "ghost"}"
              data-node-id="${NODE_ID}"
              data-node-action="twi03-select-quest"
              data-quest-id="${escapeHtml(quest.id)}"
            >
              ${escapeHtml(quest.character)}
            </button>
          `).join("")}
        </div>
      </section>
      ${questPopupMarkup(selectedQuest, context, innTier)}
    </article>
  `;
}

export function buildTwi03ActionFromElement(element) {
  const actionName = element.getAttribute("data-node-action");
  if (!actionName) {
    return null;
  }

  if (actionName === "twi03-select-quest") {
    return {
      type: "twi03-select-quest",
      questId: safeText(element.getAttribute("data-quest-id")),
      at: Date.now(),
    };
  }

  if (actionName === "twi03-fulfill-quest") {
    const questId = safeText(element.getAttribute("data-quest-id"));
    const requirementType = safeText(element.getAttribute("data-requirement-type"));
    const amount = safeInt(element.getAttribute("data-amount"), 0);
    const repReward = safeInt(element.getAttribute("data-rep-reward"), 0);
    const lootChance = Number(element.getAttribute("data-loot-chance") || 0.2);
    const outRegionChance = Number(element.getAttribute("data-out-region-chance") || 1);
    const root = element.closest(".twi03-node");
    const capeSelect = root ? root.querySelector(`[data-twi03-sacrifice=\"${questId}\"]`) : null;
    const sacrificeCardId = capeSelect && "value" in capeSelect ? safeText(capeSelect.value) : "";
    return {
      type: "twi03-fulfill-quest",
      questId,
      requirementType,
      amount,
      repReward,
      lootChance,
      outRegionChance,
      sacrificeCardId,
      at: Date.now(),
    };
  }

  if (actionName === "twi03-cancel-quest") {
    return {
      type: "twi03-cancel-quest",
      questId: safeText(element.getAttribute("data-quest-id")),
      at: Date.now(),
    };
  }

  return null;
}

export const TWI03_NODE_EXPERIENCE = {
  nodeId: NODE_ID,
  initialState: initialTwi03Runtime,
  synchronizeRuntime: synchronizeTwi03Runtime,
  render: renderTwi03Experience,
  reduceRuntime: reduceTwi03Runtime,
  validateRuntime: validateTwi03Runtime,
  buildActionFromElement: buildTwi03ActionFromElement,
};
