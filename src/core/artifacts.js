import { isPracticalGuidePersistentArtifact } from "../systems/practicalGuide.js";

function escapeAttribute(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("\"", "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function hashText(text) {
  let hash = 2166136261 >>> 0;
  const value = String(text || "artifact");
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededUnit(seed, salt) {
  const mixed = (seed + Math.imul(salt + 11, 2654435761)) >>> 0;
  const value = Math.sin(mixed * 0.0001 + salt * 0.731) * 43758.5453;
  return value - Math.floor(value);
}

function polarPoint(angleDegrees, radius) {
  const angle = (Math.PI / 180) * (angleDegrees - 90);
  return {
    x: 12 + Math.cos(angle) * radius,
    y: 12 + Math.sin(angle) * radius,
  };
}

function anchorPoints() {
  return Array.from({ length: 12 }, (_, index) => polarPoint(index * 30, 7.9));
}

const ARTIFACT_ANCHORS = Object.freeze(anchorPoints());

export const KEY_SLOT_DEFINITIONS = Object.freeze([
  {
    slotId: "wave1",
    label: "Wave I",
    rewardAliases: Object.freeze(["Wave-I Passkey", "Wave 1 Passkey"]),
  },
  {
    slotId: "wave2",
    label: "Wave II",
    rewardAliases: Object.freeze(["Wave-II Passkey", "Wave 2 Passkey"]),
  },
  {
    slotId: "wave3",
    label: "Wave III",
    rewardAliases: Object.freeze(["Wave-III Passkey", "Wave 3 Passkey"]),
  },
]);

const DEFAULT_KEY_SLOTS = Object.freeze(
  Object.fromEntries(KEY_SLOT_DEFINITIONS.map((slot) => [slot.slotId, null])),
);

function normalizeRewardName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function cloneDefaultKeySlots() {
  return {
    ...DEFAULT_KEY_SLOTS,
  };
}

function artifactPathSet(artifactName) {
  const seed = hashText(artifactName);
  const paths = [];

  for (let segmentIndex = 0; segmentIndex < 4; segmentIndex += 1) {
    const fromIndex = Math.floor(seededUnit(seed, segmentIndex * 5 + 1) * ARTIFACT_ANCHORS.length);
    let toIndex = Math.floor(seededUnit(seed, segmentIndex * 5 + 2) * ARTIFACT_ANCHORS.length);
    if (toIndex === fromIndex) {
      toIndex = (toIndex + 5) % ARTIFACT_ANCHORS.length;
    }

    const from = ARTIFACT_ANCHORS[fromIndex];
    const to = ARTIFACT_ANCHORS[toIndex];
    paths.push(`M${from.x.toFixed(2)} ${from.y.toFixed(2)}L${to.x.toFixed(2)} ${to.y.toFixed(2)}`);
  }

  const chainStart = Math.floor(seededUnit(seed, 49) * ARTIFACT_ANCHORS.length);
  const chainMid = (chainStart + 3 + Math.floor(seededUnit(seed, 50) * 3)) % ARTIFACT_ANCHORS.length;
  const chainEnd = (chainMid + 4 + Math.floor(seededUnit(seed, 51) * 2)) % ARTIFACT_ANCHORS.length;
  const start = ARTIFACT_ANCHORS[chainStart];
  const mid = ARTIFACT_ANCHORS[chainMid];
  const end = ARTIFACT_ANCHORS[chainEnd];
  paths.push(
    `M${start.x.toFixed(2)} ${start.y.toFixed(2)}Q12.00 12.00 ${mid.x.toFixed(2)} ${mid.y.toFixed(2)}T${end.x.toFixed(2)} ${end.y.toFixed(2)}`,
  );

  const innerRadius = 2.2 + seededUnit(seed, 77) * 1.5;
  const innerPoint = polarPoint(Math.floor(seededUnit(seed, 78) * 360), innerRadius);
  paths.push(`M12 12L${innerPoint.x.toFixed(2)} ${innerPoint.y.toFixed(2)}`);

  return paths;
}

function rewardStoreFromState(state) {
  return state && state.inventory && state.inventory.rewards && typeof state.inventory.rewards === "object"
    ? state.inventory.rewards
    : {};
}

function usedRewardsFromState(state) {
  return state && state.inventory && state.inventory.usedRewards && typeof state.inventory.usedRewards === "object"
    ? state.inventory.usedRewards
    : {};
}

export function slotIdForReward(rewardName) {
  const reward = normalizeRewardName(rewardName);
  if (!reward) {
    return null;
  }

  for (const slot of KEY_SLOT_DEFINITIONS) {
    if (
      slot.rewardAliases.some((alias) => {
        const normalizedAlias = normalizeRewardName(alias);
        return (
          normalizedAlias === reward ||
          reward.includes(normalizedAlias) ||
          normalizedAlias.includes(reward)
        );
      })
    ) {
      return slot.slotId;
    }
  }
  return null;
}

function resolveRewardStoreKey(rewards, rewardName) {
  const requested = String(rewardName || "");
  if (!requested || !rewards || typeof rewards !== "object") {
    return "";
  }

  if (Object.prototype.hasOwnProperty.call(rewards, requested)) {
    return requested;
  }

  const normalizedRequested = normalizeRewardName(requested);
  if (!normalizedRequested) {
    return "";
  }

  const candidates = Object.keys(rewards).filter((key) => normalizeRewardName(key) === normalizedRequested);
  if (candidates.length === 1) {
    return candidates[0];
  }

  return "";
}

export function keySlotsFromState(state) {
  const incoming =
    state && state.inventory && state.inventory.keySlots && typeof state.inventory.keySlots === "object"
      ? state.inventory.keySlots
      : {};
  const slots = cloneDefaultKeySlots();

  for (const slot of KEY_SLOT_DEFINITIONS) {
    const value = incoming[slot.slotId];
    slots[slot.slotId] = value && typeof value === "object" ? value : null;
  }

  return slots;
}

export function hasWaveOnePasskey(state) {
  const slots = keySlotsFromState(state);
  return Boolean(slots.wave1);
}

export function hasWaveTwoPasskey(state) {
  const slots = keySlotsFromState(state);
  return Boolean(slots.wave2);
}

export function consumeReward(state, rewardName, usedBy = "") {
  const reward = String(rewardName || "");
  if (!reward) {
    return state;
  }

  if (isPracticalGuidePersistentArtifact(reward)) {
    return state;
  }

  const rewards = { ...rewardStoreFromState(state) };
  const consumed = rewards[reward];
  if (!consumed) {
    return state;
  }

  delete rewards[reward];
  const usedRewards = usedRewardsFromState(state);

  return {
    ...state,
    inventory: {
      ...(state.inventory || {}),
      rewards,
      keySlots: keySlotsFromState(state),
      usedRewards: {
        ...usedRewards,
        [reward]: {
          ...consumed,
          usedBy,
          usedAt: Date.now(),
        },
      },
    },
  };
}

export function socketRewardKey(state, rewardName, slotId) {
  const selectedRewardName = String(rewardName || "");
  const targetSlot = String(slotId || "");
  const expectedSlotId = slotIdForReward(selectedRewardName);
  if (!expectedSlotId || expectedSlotId !== targetSlot) {
    return state;
  }

  const rewards = { ...rewardStoreFromState(state) };
  const rewardStoreKey = resolveRewardStoreKey(rewards, selectedRewardName);
  if (!rewardStoreKey) {
    return state;
  }

  const rewardData = rewards[rewardStoreKey];
  if (!rewardData) {
    return state;
  }

  const keySlots = keySlotsFromState(state);
  if (keySlots[targetSlot]) {
    return state;
  }

  keySlots[targetSlot] = {
    reward: rewardStoreKey,
    insertedAt: Date.now(),
    source: rewardData.source || "",
    section: rewardData.section || "",
  };

  delete rewards[rewardStoreKey];
  return {
    ...state,
    inventory: {
      ...(state.inventory || {}),
      rewards,
      keySlots,
      usedRewards: usedRewardsFromState(state),
    },
  };
}

export function renderArtifactSymbol({
  artifactName,
  className = "",
  decorative = true,
} = {}) {
  const label = String(artifactName || "Artifact");
  const classes = ["artifact-symbol", className].filter(Boolean).join(" ");
  const aria = decorative
    ? 'aria-hidden="true" focusable="false"'
    : `role="img" aria-label="${escapeAttribute(label)}"`;
  const paths = artifactPathSet(label)
    .map((path) => `<path class="artifact-symbol-line" d="${escapeAttribute(path)}"></path>`)
    .join("");

  return `
    <svg class="${escapeAttribute(classes)}" data-artifact-symbol="${escapeAttribute(label)}" viewBox="0 0 24 24" ${aria}>
      <circle class="artifact-symbol-orbit" cx="12" cy="12" r="10"></circle>
      ${paths}
    </svg>
  `;
}
