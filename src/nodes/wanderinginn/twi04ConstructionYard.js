import { escapeHtml } from "../../templates/shared.js";
import { lootInventoryFromState } from "../../systems/loot.js";

const NODE_ID = "TWI04";

const UPGRADE_DEFINITIONS = Object.freeze([
  Object.freeze({
    id: "common-room-benches",
    label: "Common Room Benches",
    cost: 8,
    tierGain: 1,
    description: "Adds seating and draws in more local guests.",
  }),
  Object.freeze({
    id: "kitchen-firepit",
    label: "Kitchen Firepit",
    cost: 14,
    tierGain: 1,
    description: "Better meals improve trust and quest quality.",
  }),
  Object.freeze({
    id: "guest-rooms",
    label: "Guest Rooms",
    cost: 22,
    tierGain: 1,
    description: "Travelers stay longer and request larger favors.",
  }),
  Object.freeze({
    id: "courtyard-fence",
    label: "Courtyard Fence",
    cost: 30,
    tierGain: 1,
    description: "Safer nights bring in rarer patrons.",
  }),
  Object.freeze({
    id: "messenger-board",
    label: "Messenger Board",
    cost: 42,
    tierGain: 2,
    description: "Wider requests begin arriving from distant regions.",
  }),
]);

function safeText(value) {
  return String(value || "").trim();
}

function safeInt(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.floor(numeric) : fallback;
}

function normalizeRuntime(runtime) {
  const source = runtime && typeof runtime === "object" ? runtime : {};
  return {
    purchased: source.purchased && typeof source.purchased === "object" ? { ...source.purchased } : {},
    lastMessage: safeText(source.lastMessage),
    solved: Boolean(source.solved),
  };
}

export function initialTwi04Runtime() {
  return normalizeRuntime({});
}

export function synchronizeTwi04Runtime(runtime, context = {}) {
  const current = normalizeRuntime(runtime);
  const loot = lootInventoryFromState(context.state || {}, Date.now());
  const upgrades = loot.progression && loot.progression.twiUpgrades && typeof loot.progression.twiUpgrades === "object"
    ? loot.progression.twiUpgrades
    : {};
  const solved = Object.keys(upgrades).length > 0;
  return {
    ...current,
    purchased: { ...upgrades },
    solved: current.solved || solved,
  };
}

export function validateTwi04Runtime(runtime) {
  return Boolean(normalizeRuntime(runtime).solved);
}

export function reduceTwi04Runtime(runtime, action, context = {}) {
  const current = synchronizeTwi04Runtime(runtime, context);
  if (!action || typeof action !== "object") {
    return current;
  }
  if (action.type !== "twi04-buy-upgrade") {
    return current;
  }
  if (!action.applied) {
    return {
      ...current,
      lastMessage: safeText(action.message) || "Unable to build upgrade.",
    };
  }
  const upgradeId = safeText(action.upgradeId);
  return {
    ...current,
    purchased: {
      ...current.purchased,
      [upgradeId]: 1,
    },
    solved: true,
    lastMessage: safeText(action.message) || "Upgrade complete.",
  };
}

export function renderTwi04Experience(context) {
  const runtime = synchronizeTwi04Runtime(context.runtime, context);
  const loot = lootInventoryFromState(context.state || {}, Date.now());
  const rep = safeInt(loot.progression && loot.progression.twiReputation, 0);
  const tier = safeInt(loot.progression && loot.progression.innTier, 0);

  return `
    <article class="twi04-node" data-node-id="${NODE_ID}">
      <section class="card">
        <h3>The Construction Yard</h3>
        <p><strong>Inn Reputation:</strong> ${rep}</p>
        <p><strong>The Inn Tier:</strong> ${tier}</p>
        <p class="muted">Spend reputation to improve quest quality in The Inn.</p>
      </section>
      <section class="worm01-card-grid">
        ${UPGRADE_DEFINITIONS.map((upgrade) => {
          const purchased = Boolean(runtime.purchased[upgrade.id]);
          const affordable = rep >= upgrade.cost;
          return `
            <article class="card ${!purchased && !affordable ? "is-unaffordable" : ""}">
              <h4>${escapeHtml(upgrade.label)}</h4>
              <p>${escapeHtml(upgrade.description)}</p>
              <p><strong>Cost:</strong> ${upgrade.cost} Inn Reputation</p>
              <p><strong>Tier Gain:</strong> +${upgrade.tierGain}</p>
              <button
                type="button"
                data-node-id="${NODE_ID}"
                data-node-action="twi04-buy-upgrade"
                data-upgrade-id="${escapeHtml(upgrade.id)}"
                data-cost="${escapeHtml(String(upgrade.cost))}"
                data-tier-gain="${escapeHtml(String(upgrade.tierGain))}"
                ${purchased || !affordable ? "disabled" : ""}
              >
                ${purchased ? "Constructed" : !affordable ? "Insufficient Reputation" : "Construct"}
              </button>
            </article>
          `;
        }).join("")}
      </section>
    </article>
  `;
}

export function buildTwi04ActionFromElement(element) {
  const actionName = element.getAttribute("data-node-action");
  if (actionName !== "twi04-buy-upgrade") {
    return null;
  }
  return {
    type: "twi04-buy-upgrade",
    upgradeId: safeText(element.getAttribute("data-upgrade-id")),
    cost: safeInt(element.getAttribute("data-cost"), 0),
    tierGain: safeInt(element.getAttribute("data-tier-gain"), 0),
    at: Date.now(),
  };
}

export const TWI04_NODE_EXPERIENCE = {
  nodeId: NODE_ID,
  initialState: initialTwi04Runtime,
  synchronizeRuntime: synchronizeTwi04Runtime,
  render: renderTwi04Experience,
  reduceRuntime: reduceTwi04Runtime,
  validateRuntime: validateTwi04Runtime,
  buildActionFromElement: buildTwi04ActionFromElement,
};
