import { escapeHtml } from "../../templates/shared.js";
import { renderRegionSymbol } from "../../core/symbology.js";
import { renderArtifactSymbol } from "../../core/artifacts.js";

const NODE_ID = "HUB04";
const REQUIRED_ARTIFACT = "Nexus Bearings";
const ANGLE_STEP = 6;
const SOLVED_SKY_ANGLE = 66;

const CONSTELLATIONS = Object.freeze([
  { id: "const-cradle", symbolKey: "cradle", label: "Cradle", baseAngle: 14, radius: 30 },
  {
    id: "const-wandering-inn",
    symbolKey: "wandering-inn",
    label: "Wandering Inn",
    baseAngle: 104,
    radius: 29,
  },
  { id: "const-worm", symbolKey: "worm", label: "Worm", baseAngle: 194, radius: 30 },
  {
    id: "const-mol",
    symbolKey: "mother-of-learning",
    label: "Mother of Learning",
    baseAngle: 284,
    radius: 29,
  },
]);

function seededValue(seed) {
  const value = Math.sin(seed * 127.11 + 9.17) * 43758.5453;
  return value - Math.floor(value);
}

function buildStars(count) {
  return Array.from({ length: count }, (_, index) => ({
    x: Math.round(8 + seededValue(index + 1) * 84),
    y: Math.round(8 + seededValue(index + 41) * 84),
    size: 1 + Math.round(seededValue(index + 71) * 2),
    alpha: 0.35 + seededValue(index + 101) * 0.65,
  }));
}

const STAR_FIELD = Object.freeze(buildStars(96));

function normalizeAngle(value) {
  const numeric = Number(value) || 0;
  return ((numeric % 360) + 360) % 360;
}

function polarPosition(angleDegrees, radiusPercent) {
  const angle = (Math.PI / 180) * (angleDegrees - 90);
  return {
    x: 50 + Math.cos(angle) * radiusPercent,
    y: 50 + Math.sin(angle) * radiusPercent,
  };
}

function constellationTargetAngle(baseAngle) {
  return normalizeAngle(baseAngle + SOLVED_SKY_ANGLE);
}

function isAligned(skyAngle) {
  return normalizeAngle(skyAngle) === SOLVED_SKY_ANGLE;
}

function normalizeRuntime(runtime) {
  const source = runtime && typeof runtime === "object" ? runtime : {};
  const skyAngle = normalizeAngle(source.skyAngle);
  const artifactPrimed = Boolean(source.artifactPrimed);
  const solved = artifactPrimed && isAligned(skyAngle);

  return {
    skyAngle,
    artifactPrimed,
    solved,
  };
}

function withSolvedState(runtime) {
  return {
    ...runtime,
    solved: runtime.artifactPrimed && isAligned(runtime.skyAngle),
  };
}

function starLayerMarkup() {
  return STAR_FIELD.map(
    (star) => `
      <span
        class="hub04-star"
        style="left:${star.x}%; top:${star.y}%; width:${star.size}px; height:${star.size}px; opacity:${star.alpha};"
      ></span>
    `,
  ).join("");
}

function constellationLayerMarkup(runtime) {
  return CONSTELLATIONS.map((constellation) => {
    const point = polarPosition(constellation.baseAngle, constellation.radius);
    return `
      <div class="hub04-constellation" style="left:${point.x}%; top:${point.y}%;" aria-hidden="true">
        ${renderRegionSymbol({
          symbolKey: constellation.symbolKey,
          className: "hub04-constellation-symbol",
        })}
      </div>
    `;
  }).join("");
}

function targetRingMarkup(runtime) {
  if (!runtime.artifactPrimed) {
    return `
      <div class="hub04-target-marker hub04-target-required hub04-target-artifact" style="left:50%; top:7%;">
        ${renderArtifactSymbol({
          artifactName: REQUIRED_ARTIFACT,
          className: "hub04-target-symbol artifact-symbol",
        })}
      </div>
    `;
  }

  return CONSTELLATIONS.map((constellation) => {
    const targetPosition = polarPosition(constellationTargetAngle(constellation.baseAngle), 46);
    return `
      <div class="hub04-target-marker" style="left:${targetPosition.x}%; top:${targetPosition.y}%;">
        ${renderRegionSymbol({
          symbolKey: constellation.symbolKey,
          className: "hub04-target-symbol",
        })}
      </div>
    `;
  }).join("");
}

export function initialHub04Runtime() {
  return {
    skyAngle: 0,
    artifactPrimed: false,
    solved: false,
  };
}

export function validateHub04Runtime(runtime) {
  return normalizeRuntime(runtime).solved;
}

export function reduceHub04Runtime(runtime, action) {
  const current = normalizeRuntime(runtime);
  if (!action || typeof action !== "object") {
    return current;
  }

  if (current.solved) {
    return current;
  }

  if (action.type === "rotate-sky") {
    const step = Number(action.step) || 1;
    return withSolvedState({
      ...current,
      skyAngle: normalizeAngle(current.skyAngle + step * ANGLE_STEP),
    });
  }

  if (action.type === "arm-bearings") {
    if (action.artifact !== REQUIRED_ARTIFACT) {
      return current;
    }

    return withSolvedState({
      ...current,
      artifactPrimed: true,
    });
  }

  return current;
}

export function buildHub04ActionFromElement(element) {
  const actionName = element.getAttribute("data-node-action");
  if (actionName !== "arm-bearings") {
    return null;
  }

  return {
    type: "arm-bearings",
    artifact: element.getAttribute("data-selected-artifact"),
  };
}

export function buildHub04KeyAction(event) {
  if (event.metaKey || event.ctrlKey || event.altKey) {
    return null;
  }

  if (event.key === "q" || event.key === "Q") {
    return {
      type: "rotate-sky",
      step: -1,
    };
  }

  if (event.key === "e" || event.key === "E") {
    return {
      type: "rotate-sky",
      step: 1,
    };
  }

  return null;
}

export function renderHub04Experience(context) {
  const normalized = normalizeRuntime(context.runtime);
  const solvedNow = Boolean(context.solved || normalized.solved);
  const selectedArtifact = String(context.selectedArtifactReward || "");
  const artifactSelected = selectedArtifact === REQUIRED_ARTIFACT;
  const aligned = isAligned(normalized.skyAngle);

  return `
    <article class="hub04-node" data-node-id="${NODE_ID}">
      <section class="hub04-observatory">
        <div
          class="hub04-telescope ${normalized.artifactPrimed ? "is-primed" : ""} ${artifactSelected ? "is-bearing-selected" : ""}"
          data-node-id="${NODE_ID}"
          data-node-action="arm-bearings"
          data-selected-artifact="${escapeHtml(selectedArtifact)}"
          role="button"
          tabindex="0"
          aria-label="Telescope alignment field"
        >
          <div class="hub04-target-ring">
            ${targetRingMarkup(normalized)}
          </div>

          <div class="hub04-sky-layer" style="transform: translate(-50%, -50%) rotate(${normalized.skyAngle}deg);">
            ${starLayerMarkup()}
            ${constellationLayerMarkup(normalized)}
          </div>
        </div>
      </section>

      <p class="sr-only" role="status" aria-live="polite">
        ${escapeHtml(
          solvedNow
            ? "Observatory solved."
            : `Sky angle ${normalized.skyAngle} degrees. ${
                normalized.artifactPrimed ? "Nexus Bearings primed." : "Nexus Bearings not primed."
              }`,
        )}
      </p>

      ${
        solvedNow
          ? `
            <section class="completion-banner" aria-live="polite">
              <p><strong>CONSTELLATION ORDER Stabilized</strong></p>
            </section>
          `
          : ""
      }

      ${
        !solvedNow && normalized.artifactPrimed && aligned
          ? `
            <section class="hub04-status hub04-status-soft" aria-live="polite">
              <p><strong>Alignment lock achieved.</strong></p>
            </section>
          `
          : ""
      }
    </article>
  `;
}

export const HUB04_NODE_EXPERIENCE = {
  nodeId: NODE_ID,
  initialState: initialHub04Runtime,
  render: renderHub04Experience,
  reduceRuntime: reduceHub04Runtime,
  validateRuntime: validateHub04Runtime,
  buildActionFromElement: buildHub04ActionFromElement,
  buildKeyAction: buildHub04KeyAction,
};
