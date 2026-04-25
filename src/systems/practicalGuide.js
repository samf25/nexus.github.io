const ROLE_ARTIFACTS = Object.freeze([
  "Squire",
  "Archer",
  "Warlock",
  "Black Knight",
  "Ranger",
  "Captain",
  "Hierophant",
  "Warden",
  "Thief",
  "Bard",
]);

const ROLE_SET = Object.freeze(new Set(ROLE_ARTIFACTS));

const REQUIRED_ARTIFACTS = Object.freeze([
  "Westwall Ram",
  "Oathbreaker Bell",
  "Sunforge Powder",
  "Mirror of Nine Lies",
  "Green Wax Seal",
  "Veiled Signet",
  "Sunless Lantern",
  "Bone Key",
  "River-Map of Silt",
  "Ashen Treaty Pins",
  "Red Petition Docket",
  "Saintglass Vial",
  "Ivory Truce Fork",
  "Nightwine Ledger",
  "Mercy Bell Chime",
]);

const WIN_ARTIFACTS = Object.freeze([
  "Underlord Revelation I",
  "Underlord Revelation II",
  "Underlord Revelation Cipher",
  "Gallery Verdict Arrow",
  "Triune Succession Ledger",
  "Winter Mask Mandate",
  "Sunless Crown Accord",
  "Ossuary Keeper Sigil",
  "Silt-River Exit Seal",
  "Mercy Charter Seal",
  "Conqueror's Due Process",
  "Measured Iron Mandate",
  "Table of Last Reconciliation",
  "Midnight Carving Accord",
  "Bell of Unbroken Guest-Right",
]);

const PERSISTENT_ARTIFACT_SET = Object.freeze(
  new Set([...ROLE_ARTIFACTS, ...REQUIRED_ARTIFACTS, ...WIN_ARTIFACTS]),
);

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function rewardsFromState(state) {
  return state && state.inventory && state.inventory.rewards && typeof state.inventory.rewards === "object"
    ? state.inventory.rewards
    : {};
}

function keySlotsFromState(state) {
  return state && state.inventory && state.inventory.keySlots && typeof state.inventory.keySlots === "object"
    ? state.inventory.keySlots
    : {
      wave1: null,
      wave2: null,
      wave3: null,
    };
}

function usedRewardsFromState(state) {
  return state && state.inventory && state.inventory.usedRewards && typeof state.inventory.usedRewards === "object"
    ? state.inventory.usedRewards
    : {};
}

export function practicalGuideRoleArtifacts() {
  return ROLE_ARTIFACTS.slice();
}

export function practicalGuideRequiredArtifacts() {
  return REQUIRED_ARTIFACTS.slice();
}

export function practicalGuideWinArtifacts() {
  return WIN_ARTIFACTS.slice();
}

export function isPracticalGuidePersistentArtifact(name) {
  return PERSISTENT_ARTIFACT_SET.has(String(name || ""));
}

export function countPracticalGuideWinArtifacts(state) {
  const rewards = rewardsFromState(state);
  let count = 0;
  for (const artifact of WIN_ARTIFACTS) {
    if (rewards[artifact]) {
      count += 1;
    }
  }
  return count;
}

export function isPracticalGuideRoleArtifact(name) {
  return ROLE_SET.has(String(name || ""));
}

export function normalizePracticalGuideRoleArtifact(name) {
  const target = normalizeText(name);
  if (!target) {
    return "";
  }
  const match = ROLE_ARTIFACTS.find((role) => normalizeText(role) === target);
  return match || "";
}

export function activePracticalGuideRoleFromState(state) {
  const rewards = rewardsFromState(state);
  for (const role of ROLE_ARTIFACTS) {
    if (rewards[role]) {
      return role;
    }
  }
  return "";
}

export function grantPracticalGuideRoleArtifact(state, roleArtifact, sourceNodeId = "PGE01") {
  const role = normalizePracticalGuideRoleArtifact(roleArtifact);
  if (!role) {
    return state;
  }

  const rewards = { ...rewardsFromState(state) };
  for (const candidate of ROLE_ARTIFACTS) {
    if (candidate !== role && rewards[candidate]) {
      delete rewards[candidate];
    }
  }

  rewards[role] = {
    source: sourceNodeId,
    section: "A Practical Guide to Evil",
    awardedAt: Date.now(),
  };

  return {
    ...state,
    inventory: {
      ...(state.inventory || {}),
      rewards,
      keySlots: keySlotsFromState(state),
      usedRewards: usedRewardsFromState(state),
    },
  };
}

export function applyPracticalGuideRoleReset(state) {
  const rewards = { ...rewardsFromState(state) };
  let removedRole = "";
  for (const role of ROLE_ARTIFACTS) {
    if (rewards[role]) {
      delete rewards[role];
      removedRole = role;
    }
  }

  const runtimeRoot =
    state && state.nodeRuntime && typeof state.nodeRuntime === "object"
      ? { ...state.nodeRuntime }
      : {};
  if (runtimeRoot.PGE01) {
    delete runtimeRoot.PGE01;
  }

  const solved = new Set(state && Array.isArray(state.solvedNodeIds) ? state.solvedNodeIds : []);
  solved.delete("PGE01");
  const currentPrestige =
    state && state.systems && state.systems.prestige && typeof state.systems.prestige === "object"
      ? state.systems.prestige
      : {};
  const nextPracticalGuideResets = Math.max(
    0,
    Math.floor(Number(currentPrestige.practicalGuideResets || 0)) + 1,
  );

  return {
    nextState: {
      ...state,
      solvedNodeIds: [...solved],
      nodeRuntime: runtimeRoot,
      systems: {
        ...(state.systems || {}),
        prestige: {
          ...currentPrestige,
          practicalGuideResets: nextPracticalGuideResets,
        },
      },
      inventory: {
        ...(state.inventory || {}),
        rewards,
      },
    },
    applied: true,
    removedRole,
    message: removedRole
      ? `${removedRole} unraveled. PGE01 reopened for a new Role.`
      : "Role strands cleared. PGE01 reopened.",
  };
}
