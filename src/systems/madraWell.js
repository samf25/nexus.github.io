export const MADRA_PRESETS = {
  balanced: {
    label: "Balanced Cycle",
    multiplier: 1,
    description: "Steady growth, no penalties.",
  },
  ironBreath: {
    label: "Iron Breath",
    multiplier: 1.35,
    description: "Faster generation with higher conversion friction.",
  },
  ghostwheel: {
    label: "Ghostwheel",
    multiplier: 1.6,
    description: "High growth but less efficient charge refinement.",
  },
};

const BASE_RATE = 0.8;
const CATCH_UP_MINUTES = 60 * 12;
const CHARGE_COST = 40;

export function tickMadraWell(madraState, now = Date.now()) {
  const previous = Number(madraState.lastTickAt || now);
  const elapsedMs = Math.max(0, now - previous);
  const elapsedMinutes = Math.floor(elapsedMs / 60000);
  const effectiveMinutes = Math.min(elapsedMinutes, CATCH_UP_MINUTES);

  const preset = MADRA_PRESETS[madraState.presetId] || MADRA_PRESETS.balanced;
  const generated = effectiveMinutes * BASE_RATE * preset.multiplier;

  return {
    ...madraState,
    madraPool: Number((madraState.madraPool + generated).toFixed(2)),
    totalGenerated: Number((madraState.totalGenerated + generated).toFixed(2)),
    lastTickAt: now,
  };
}

export function convertMadraToCharge(madraState) {
  if (madraState.madraPool < CHARGE_COST) {
    return {
      nextState: madraState,
      produced: false,
      reason: `Need ${CHARGE_COST} madra for a single charge.`,
    };
  }

  return {
    nextState: {
      ...madraState,
      madraPool: Number((madraState.madraPool - CHARGE_COST).toFixed(2)),
      chargeCount: madraState.chargeCount + 1,
    },
    produced: true,
    reason: "Charge refined successfully.",
  };
}

export function setMadraPreset(madraState, presetId) {
  if (!MADRA_PRESETS[presetId]) {
    return madraState;
  }

  return {
    ...madraState,
    presetId,
  };
}

export function madraMilestones(madraState) {
  return {
    generated120: madraState.totalGenerated >= 120,
    firstThreeCharges: madraState.chargeCount >= 3,
  };
}
