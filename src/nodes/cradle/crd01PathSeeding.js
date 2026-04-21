import { escapeHtml } from "../../templates/shared.js";
import {
  CRD01_RHYTHM_PATTERNS,
  nearestPulse,
  normalizePatternIndex,
  patternByIndex,
  patternCadence,
  pulsePhaseDelaySeconds,
} from "./rhythmCore.js";

const NODE_ID = "CRD01";
const STREAK_TARGET = 5;
const HIT_TOLERANCE_MS = 180;
const RHYTHM_PATTERNS = CRD01_RHYTHM_PATTERNS;

function normalizeRuntime(runtime) {
  const source = runtime && typeof runtime === "object" ? runtime : {};
  const maxIndex = RHYTHM_PATTERNS.length - 1;
  const solved = Boolean(source.solved);
  const patternIndex = solved ? maxIndex : normalizePatternIndex(source.patternIndex, maxIndex);
  const now = Date.now();

  return {
    introDismissed: Boolean(source.introDismissed),
    patternIndex,
    streak: Math.max(0, Number(source.streak) || 0),
    patternStartedAt: Number.isFinite(source.patternStartedAt) ? Number(source.patternStartedAt) : now,
    lastBeatOrdinal: Number.isFinite(source.lastBeatOrdinal) ? Number(source.lastBeatOrdinal) : -1,
    feedback: source.feedback === "bad" ? "bad" : source.feedback === "good" ? "good" : "",
    feedbackUntil: Number.isFinite(source.feedbackUntil) ? Number(source.feedbackUntil) : 0,
    solved,
  };
}

export function initialCrd01Runtime() {
  return {
    introDismissed: false,
    patternIndex: 0,
    streak: 0,
    patternStartedAt: Date.now(),
    lastBeatOrdinal: -1,
    feedback: "",
    feedbackUntil: 0,
    solved: false,
  };
}

export function validateCrd01Runtime(runtime) {
  return Boolean(normalizeRuntime(runtime).solved);
}

export function reduceCrd01Runtime(runtime, action) {
  const existing = runtime && typeof runtime === "object" ? runtime : null;
  const current = normalizeRuntime(runtime);
  if (!action || typeof action !== "object") {
    return existing || current;
  }

  if (action.type === "dismiss-intro") {
    const at = Number(action.at) || Date.now();
    return {
      ...current,
      introDismissed: true,
      patternStartedAt: at,
      feedback: "",
      feedbackUntil: 0,
      streak: 0,
      lastBeatOrdinal: -1,
    };
  }

  if (action.type !== "tap-madra") {
    return existing || current;
  }

  if (!current.introDismissed || current.solved) {
    return existing || current;
  }

  const at = Number(action.at) || Date.now();
  const pattern = patternByIndex(RHYTHM_PATTERNS, current.patternIndex);
  const match = nearestPulse(pattern, current.patternStartedAt, at, HIT_TOLERANCE_MS);

  if (match.beatOrdinal === current.lastBeatOrdinal) {
    return existing || current;
  }

  if (!match.onBeat) {
    if (current.streak === 0) {
      return existing || current;
    }

    return {
      ...current,
      streak: 0,
      feedback: "",
      feedbackUntil: 0,
    };
  }

  let nextPatternIndex = current.patternIndex;
  let nextStreak = current.streak + 1;
  let solved = current.solved;
  let patternStartedAt = current.patternStartedAt;

  if (nextStreak >= STREAK_TARGET) {
    nextPatternIndex += 1;
    nextStreak = 0;
    patternStartedAt = at;
    if (nextPatternIndex >= RHYTHM_PATTERNS.length) {
      nextPatternIndex = RHYTHM_PATTERNS.length - 1;
      solved = true;
      nextStreak = STREAK_TARGET;
    }
  }

  return {
    ...current,
    patternIndex: nextPatternIndex,
    streak: nextStreak,
    patternStartedAt,
    feedback: "good",
    feedbackUntil: at + 360,
    lastBeatOrdinal: match.beatOrdinal,
    solved,
  };
}

export function buildCrd01ActionFromElement(element) {
  const actionName = element.getAttribute("data-node-action");
  if (!actionName) {
    return null;
  }

  if (actionName === "dismiss-intro") {
    return {
      type: "dismiss-intro",
      at: Date.now(),
    };
  }

  return null;
}

export function buildCrd01KeyAction(event) {
  if (event.metaKey || event.ctrlKey || event.altKey) {
    return null;
  }

  if (event.repeat) {
    return null;
  }

  if (event.code !== "Space" && event.key !== " ") {
    return null;
  }

  return {
    type: "tap-madra",
    at: Date.now(),
  };
}

export function renderCrd01Experience(context) {
  const runtime = normalizeRuntime(context.runtime);
  const solvedNow = Boolean(context.solved || runtime.solved);
  const pattern = patternByIndex(RHYTHM_PATTERNS, runtime.patternIndex);
  const cadence = patternCadence(pattern);
  const feedbackActive = runtime.feedback && Date.now() < runtime.feedbackUntil;
  const showHitFlash = feedbackActive && runtime.feedback === "good";
  const completed = solvedNow ? RHYTHM_PATTERNS.length : runtime.patternIndex;
  const progressPercent = Math.round((completed / RHYTHM_PATTERNS.length) * 100);
  const phaseDelay = pulsePhaseDelaySeconds(pattern, runtime.patternStartedAt);

  if (!runtime.introDismissed) {
    return `
      <article class="crd01-node" data-node-id="${NODE_ID}">
        <section class="crd01-intro-bubble">
          <h3>Copper Breathing</h3>
          <p>
            Draw aura in rhythm and cycle it clean through your channels.
            Miss the pulse and your madra scatters; strike true and your core answers.
          </p>
          <p>
            Press space with each pulse. Hold five true cycles in a row to stabilize the pattern.
            Five patterns and your seed is set.
          </p>
          <div class="crd01-intro-actions">
            <button type="button" data-node-id="${NODE_ID}" data-node-action="dismiss-intro">Begin Cycling</button>
          </div>
        </section>
      </article>
    `;
  }

  return `
    <article class="crd01-node" data-node-id="${NODE_ID}">
      <section class="crd01-stage">
        <div
          class="crd01-core is-pattern-${escapeHtml(String(runtime.patternIndex))}"
          style="animation-delay: ${escapeHtml(phaseDelay.toFixed(3))}s;"
          aria-hidden="true"
        >
          <span class="crd01-stream stream-a"></span>
          <span class="crd01-stream stream-b"></span>
          <span class="crd01-stream stream-c"></span>
          ${showHitFlash ? `<span class="crd01-hit-flash"></span>` : ""}
          <span class="crd01-core-shell"></span>
        </div>
      </section>

      <section class="crd01-status">
        <p><strong>Pattern:</strong> ${escapeHtml(pattern.label)} (${runtime.patternIndex + 1}/${RHYTHM_PATTERNS.length})</p>
        <p><strong>Cadence:</strong> ${escapeHtml(cadence)}</p>
        <p><strong>Current Streak:</strong> ${escapeHtml(String(runtime.streak))}/${STREAK_TARGET}</p>
        <div class="progress-bar"><span style="width:${progressPercent}%"></span></div>
      </section>

      <p class="sr-only" role="status" aria-live="polite">
        ${escapeHtml(
          solvedNow
            ? "Path seeding complete."
            : `Pattern ${runtime.patternIndex + 1}. Streak ${runtime.streak} of ${STREAK_TARGET}.`,
        )}
      </p>

      ${
        solvedNow
          ? `
            <section class="hub04-status" aria-live="polite">
              <p><strong>Starter core seeded.</strong></p>
            </section>
          `
          : ""
      }
    </article>
  `;
}

export const CRD01_NODE_EXPERIENCE = {
  nodeId: NODE_ID,
  initialState: initialCrd01Runtime,
  render: renderCrd01Experience,
  reduceRuntime: reduceCrd01Runtime,
  validateRuntime: validateCrd01Runtime,
  buildActionFromElement: buildCrd01ActionFromElement,
  buildKeyAction: buildCrd01KeyAction,
};
