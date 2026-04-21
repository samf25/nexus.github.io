function freezePattern(pattern) {
  return Object.freeze({
    ...pattern,
    beats: Object.freeze([...(pattern.beats || [])]),
  });
}

function scaleBeats(beats, factor) {
  return Object.freeze(
    beats.map((beat) => Number((Number(beat || 0) * factor).toFixed(3))),
  );
}

const CRD01_BASE_PATTERNS = Object.freeze([
  freezePattern({
    id: "steady-draw",
    label: "Steady Draw",
    beats: Object.freeze([1]),
    visualId: 0,
  }),
  freezePattern({
    id: "split-current",
    label: "Split Current",
    beats: Object.freeze([1, 1, 2]),
    visualId: 1,
  }),
  freezePattern({
    id: "fanged-turn",
    label: "Fanged Turn",
    beats: Object.freeze([1, 0.5, 1, 1.5]),
    visualId: 2,
  }),
  freezePattern({
    id: "needle-thread",
    label: "Needle Thread",
    beats: Object.freeze([0.5, 1, 0.5, 2]),
    visualId: 3,
  }),
  freezePattern({
    id: "dragon-stair",
    label: "Dragon Stair",
    beats: Object.freeze([0.5, 0.5, 1, 1, 1]),
    visualId: 4,
  }),
]);

export const CRD01_RHYTHM_PATTERNS = CRD01_BASE_PATTERNS;

export const CRD02_MANUAL_RHYTHM_PATTERNS = Object.freeze([
  CRD01_BASE_PATTERNS[0],
  CRD01_BASE_PATTERNS[1],
  CRD01_BASE_PATTERNS[2],
  CRD01_BASE_PATTERNS[3],
  CRD01_BASE_PATTERNS[4],
  freezePattern({
    id: "split-current-rush",
    label: "Split Current (Rush)",
    beats: scaleBeats([1, 1, 2], 0.85),
    visualId: 1,
  }),
  freezePattern({
    id: "split-current-drawn",
    label: "Split Current (Drawn)",
    beats: scaleBeats([1, 1, 2], 1.2),
    visualId: 1,
  }),
  freezePattern({
    id: "fanged-turn-rush",
    label: "Fanged Turn (Rush)",
    beats: scaleBeats([1, 0.5, 1, 1.5], 0.85),
    visualId: 2,
  }),
  freezePattern({
    id: "needle-thread-drawn",
    label: "Needle Thread (Drawn)",
    beats: scaleBeats([0.5, 1, 0.5, 2], 1.15),
    visualId: 3,
  }),
  freezePattern({
    id: "dragon-stair-rush",
    label: "Dragon Stair (Rush)",
    beats: scaleBeats([0.5, 0.5, 1, 1, 1], 0.8),
    visualId: 4,
  }),
  freezePattern({
    id: "dragon-stair-drawn",
    label: "Dragon Stair (Drawn)",
    beats: scaleBeats([0.5, 0.5, 1, 1, 1], 1.2),
    visualId: 4,
  }),
  freezePattern({
    id: "fanged-turn-drawn",
    label: "Fanged Turn (Drawn)",
    beats: scaleBeats([1, 0.5, 1, 1.5], 1.18),
    visualId: 2,
  }),
]);

export function normalizePatternIndex(value, max) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 0;
  }
  return Math.min(Math.max(Math.floor(numeric), 0), max);
}

export function patternByIndex(patterns, index) {
  return patterns[index] || patterns[0];
}

export function cycleLength(pattern) {
  return (pattern && Array.isArray(pattern.beats) ? pattern.beats : [1]).reduce(
    (sum, beat) => sum + beat,
    0,
  );
}

export function pulseOffsets(pattern) {
  const beats = pattern && Array.isArray(pattern.beats) ? pattern.beats : [1];
  const offsets = [];
  let cursor = 0;
  for (const beat of beats) {
    offsets.push(cursor);
    cursor += beat;
  }
  return offsets;
}

export function formatBeat(beat) {
  const value = Number(beat);
  if (!Number.isFinite(value)) {
    return "1";
  }
  if (Math.abs(value - Math.round(value)) < 0.0001) {
    return String(Math.round(value));
  }
  return value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

export function patternCadence(pattern) {
  return (pattern && Array.isArray(pattern.beats) ? pattern.beats : [1])
    .map((beat) => formatBeat(beat))
    .join(":");
}

export function pulsePhaseDelaySeconds(pattern, startedAt, atMs = Date.now()) {
  const cycle = cycleLength(pattern);
  if (!Number.isFinite(cycle) || cycle <= 0) {
    return 0;
  }

  const elapsed = Math.max(0, (atMs - Number(startedAt || atMs)) / 1000);
  const phase = elapsed % cycle;
  return -phase;
}

export function nearestPulse(pattern, startedAt, atMs, toleranceMs) {
  const cycle = cycleLength(pattern);
  const offsets = pulseOffsets(pattern);
  const elapsedSeconds = Math.max(0, (atMs - Number(startedAt || atMs)) / 1000);
  const cycleIndex = Math.floor(elapsedSeconds / cycle);
  const phase = elapsedSeconds - cycleIndex * cycle;

  let closestDiff = Number.POSITIVE_INFINITY;
  let closestOrdinal = -1;

  for (let index = 0; index < offsets.length; index += 1) {
    const offset = offsets[index];
    const inCycleDiff = Math.abs(phase - offset);
    if (inCycleDiff < closestDiff) {
      closestDiff = inCycleDiff;
      closestOrdinal = cycleIndex * offsets.length + index;
    }

    const nextCycleDiff = Math.abs(offset + cycle - phase);
    if (nextCycleDiff < closestDiff) {
      closestDiff = nextCycleDiff;
      closestOrdinal = (cycleIndex + 1) * offsets.length + index;
    }
  }

  return {
    beatOrdinal: closestOrdinal,
    diffMs: closestDiff * 1000,
    onBeat: closestDiff * 1000 <= Number(toleranceMs || 0),
  };
}
