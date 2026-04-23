import { escapeHtml } from "../../templates/shared.js";
import { renderRegionSymbol } from "../../core/symbology.js";
import {
  prestigeRegionDefinitions,
  prestigeRegionSnapshot,
} from "../../systems/prestige.js";
import {
  activePracticalGuideRoleFromState,
  practicalGuideRoleArtifacts,
} from "../../systems/practicalGuide.js";
import {
  createMemoryGameRuntime,
  reduceMemoryGameBegin,
  reduceMemoryGameEnterInput,
  reduceMemoryGamePick,
  renderMemoryDisplay,
  renderMemoryField,
  synchronizeMemoryGameRuntime,
} from "./memoryGameCore.js";

const NODE_ID = "MOL02";
const RESET_CHALLENGE_TARGET = 5;
const PRESTIGE_REGIONS = prestigeRegionDefinitions().filter(
  (region) => region.id === "cradle" || region.id === "worm" || region.id === "dcc",
);
const PRACTICAL_GUIDE_REGION = Object.freeze({
  id: "practical-guide",
  label: "Practical Guide",
  currencyLabel: "Role Fate",
  pointLabel: "Role Realignments",
});
const REGIONS = Object.freeze([...PRESTIGE_REGIONS, PRACTICAL_GUIDE_REGION]);
const ROLE_ARTIFACTS = Object.freeze(practicalGuideRoleArtifacts());

function isPracticalGuideRegionId(regionId) {
  return String(regionId || "").trim().toLowerCase() === PRACTICAL_GUIDE_REGION.id;
}

function resetRegionSnapshot(state, regionId) {
  if (!isPracticalGuideRegionId(regionId)) {
    return prestigeRegionSnapshot(state, regionId);
  }

  const currentRole = activePracticalGuideRoleFromState(state);
  return {
    regionId: PRACTICAL_GUIDE_REGION.id,
    regionDef: PRACTICAL_GUIDE_REGION,
    points: 0,
    resets: 0,
    nextCost: 0,
    currency: currentRole ? 1 : 0,
    affordable: true,
    upgrades: {},
    currentRole,
  };
}

function normalizeRuntime(candidate) {
  const source = candidate && typeof candidate === "object" ? candidate : {};
  return {
    selectedIndex: Math.max(0, Math.min(REGIONS.length - 1, Math.floor(Number(source.selectedIndex) || 0))),
    confirmRegionId: REGIONS.some((region) => region.id === source.confirmRegionId) ? source.confirmRegionId : "",
    challenge: source.challenge && typeof source.challenge === "object" ? source.challenge : null,
    resetPulseUntil: Number.isFinite(source.resetPulseUntil) ? Number(source.resetPulseUntil) : 0,
    solved: Boolean(source.solved),
    lastMessage: String(source.lastMessage || ""),
  };
}

function selectedRegionId(runtime) {
  const region = REGIONS[runtime.selectedIndex] || REGIONS[0];
  return region ? region.id : "cradle";
}

function wheelMarkup(runtime) {
  const selected = selectedRegionId(runtime);
  const radius = REGIONS.length === 2 ? 24 : 38;
  const points = REGIONS.map((_, index) => {
    const angle = REGIONS.length === 2
      ? -90 + index * 180
      : ((360 / Math.max(1, REGIONS.length)) * index) - 90;
    const radians = (angle * Math.PI) / 180;
    return {
      x: 50 + Math.cos(radians) * radius,
      y: 50 + Math.sin(radians) * radius,
    };
  });

  return `
    <section class="mol02-ring-stage">
      <div class="mol02-ring-guide" aria-hidden="true"></div>
      <div class="mol02-ring-core">
        ${renderRegionSymbol({
          section: "Mother of Learning",
          className: "mol-wheel-core-symbol",
        })}
      </div>
      ${REGIONS.map((region, index) => {
        const selectedClass = selected === region.id ? "is-selected" : "";
        const point = points[index];
        return `
          <button
            type="button"
            class="mol02-ring-node ${selectedClass}"
            style="left:${point.x}%; top:${point.y}%;"
            data-node-id="${NODE_ID}"
            data-node-action="mol02-open-confirm"
            data-region-id="${escapeHtml(region.id)}"
            aria-label="${escapeHtml(region.label)} reset target"
          >
            ${renderRegionSymbol({
              section: region.label,
              className: "mol-wheel-node-symbol",
            })}
          </button>
        `;
      }).join("")}
    </section>
  `;
}

export function initialMol02Runtime() {
  return normalizeRuntime({});
}

export function synchronizeMol02Runtime(runtime, { now = Date.now(), state = null } = {}) {
  const current = normalizeRuntime(runtime);
  const challenge = current.challenge
    ? synchronizeMemoryGameRuntime(current.challenge)
    : null;
  const normalizedPrestige = REGIONS.map((region) => resetRegionSnapshot(state, region.id));
  const solved = current.solved || normalizedPrestige.some((entry) => entry.resets > 0);

  return {
    ...current,
    challenge,
    solved,
  };
}

export function validateMol02Runtime(runtime) {
  return Boolean(runtime && runtime.solved);
}

export function reduceMol02Runtime(runtime, action) {
  const now = Number(action && action.at) || Date.now();
  const current = synchronizeMol02Runtime(runtime, { now });
  if (!action || typeof action !== "object") {
    return current;
  }

  if (action.type === "mol02-cycle") {
    if (current.challenge) {
      return current;
    }
    const step = Number(action.step) >= 0 ? 1 : -1;
    const size = Math.max(1, REGIONS.length);
    const selectedIndex = (current.selectedIndex + step + size) % size;
    return {
      ...current,
      selectedIndex,
      confirmRegionId: "",
      lastMessage: "",
    };
  }

  if (action.type === "mol02-open-confirm") {
    const regionId = REGIONS.some((region) => region.id === action.regionId)
      ? action.regionId
      : selectedRegionId(current);
    return {
      ...current,
      confirmRegionId: regionId,
      challenge: null,
      lastMessage: "",
    };
  }

  if (action.type === "mol02-close-confirm") {
    return {
      ...current,
      confirmRegionId: "",
      challenge: null,
    };
  }

  if (action.type === "mol02-start-challenge") {
    if (!action.affordable) {
      return {
        ...current,
        lastMessage: "Insufficient regional currency for loop reset.",
      };
    }

    return {
      ...current,
      confirmRegionId: action.regionId,
      challenge: createMemoryGameRuntime({
        targetSuccesses: RESET_CHALLENGE_TARGET,
        roll: Math.random(),
      }),
      lastMessage: "Press Begin Sequence to start the reset trial.",
    };
  }

  if (action.type === "mol02-memory-begin") {
    if (!current.challenge) {
      return current;
    }
    return {
      ...current,
      challenge: reduceMemoryGameBegin(current.challenge, { at: now }),
      lastMessage: "Sequence active. Observe, then press Repeat Sequence.",
    };
  }

  if (action.type === "mol02-memory-enter-input") {
    if (!current.challenge) {
      return current;
    }
    const nextChallenge = reduceMemoryGameEnterInput(current.challenge, { at: now });
    const unchanged = nextChallenge === current.challenge;
    return {
      ...current,
      challenge: nextChallenge,
      lastMessage: unchanged ? "Observe the full sequence before repeating it." : "",
    };
  }

  if (action.type === "mol02-memory-pick") {
    if (!current.challenge) {
      return current;
    }
    const nextChallenge = reduceMemoryGamePick(current.challenge, action);
    let lastMessage = current.lastMessage;
    if (current.challenge.phase === "input" && nextChallenge.phase === "idle" && nextChallenge.successCount === 0) {
      lastMessage = "Memory gate failed. Press Begin Sequence to try again.";
    } else if (current.challenge.phase === "input" && nextChallenge.phase === "idle") {
      lastMessage = "Round complete. Press Begin Sequence for the next pattern.";
    } else {
      lastMessage = "";
    }
    return {
      ...current,
      challenge: nextChallenge,
      lastMessage,
    };
  }

  if (action.type === "mol02-finalize-reset") {
    if (!current.challenge || !current.challenge.solved) {
      return current;
    }

    if (!action.applied) {
      return {
        ...current,
        lastMessage: String(action.message || "Reset failed."),
      };
    }

    return {
      ...current,
      confirmRegionId: "",
      challenge: null,
      solved: true,
      resetPulseUntil: now + 800,
      lastMessage: String(action.message || "Loop reset complete."),
    };
  }

  return current;
}

export function buildMol02ActionFromElement(element) {
  const actionName = element.getAttribute("data-node-action");
  if (!actionName) {
    return null;
  }

  if (actionName === "mol02-open-confirm") {
    return {
      type: "mol02-open-confirm",
      regionId: element.getAttribute("data-region-id") || "",
      at: Date.now(),
    };
  }

  if (actionName === "mol02-close-confirm") {
    return {
      type: "mol02-close-confirm",
      at: Date.now(),
    };
  }

  if (actionName === "mol02-start-challenge") {
    return {
      type: "mol02-start-challenge",
      regionId: element.getAttribute("data-region-id") || "",
      affordable: element.getAttribute("data-affordable") === "true",
      at: Date.now(),
    };
  }

  if (actionName === "mol02-memory-pick") {
    return {
      type: "mol02-memory-pick",
      symbolToken: element.getAttribute("data-symbol-token") || "",
      roll: Math.random(),
      at: Date.now(),
    };
  }

  if (actionName === "mol02-memory-begin") {
    return {
      type: "mol02-memory-begin",
      at: Date.now(),
    };
  }

  if (actionName === "mol02-memory-enter-input") {
    return {
      type: "mol02-memory-enter-input",
      at: Date.now(),
    };
  }

  if (actionName === "mol02-finalize-reset") {
    return {
      type: "mol02-finalize-reset",
      regionId: element.getAttribute("data-region-id") || "",
      at: Date.now(),
    };
  }

  return null;
}

export function buildMol02KeyAction(event, runtime) {
  if (event.metaKey || event.ctrlKey || event.altKey) {
    return null;
  }

  const current = normalizeRuntime(runtime);
  if (event.code === "Escape") {
    if (current.confirmRegionId || current.challenge) {
      return {
        type: "mol02-close-confirm",
        at: Date.now(),
      };
    }
    return null;
  }

  if (current.challenge) {
    return null;
  }

  if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
    return {
      type: "mol02-cycle",
      step: -1,
      at: Date.now(),
    };
  }

  if (event.key === "ArrowRight" || event.key === "ArrowDown") {
    return {
      type: "mol02-cycle",
      step: 1,
      at: Date.now(),
    };
  }

  if (event.key === "Enter") {
    return {
      type: "mol02-open-confirm",
      regionId: selectedRegionId(current),
      at: Date.now(),
    };
  }

  return null;
}

function regionPanelMarkup(snapshot) {
  const region = snapshot.regionDef;
  if (!region) {
    return "";
  }
  if (isPracticalGuideRegionId(snapshot.regionId)) {
    const currentRole = String(snapshot.currentRole || "");
    const roleText = currentRole || "None";
    return `
      <section class="card mol-reset-region">
        <h4>Reset Target</h4>
        <p><strong>Current Role:</strong> ${escapeHtml(roleText)}</p>
        <p><strong>Reset Cost:</strong> None</p>
        <p><strong>Effect:</strong> Remove active role artifact and reopen PGE01.</p>
      </section>
    `;
  }
  return `
    <section class="card mol-reset-region">
      <h4>Reset Target</h4>
      <p><strong>${escapeHtml(region.currencyLabel)}:</strong> ${escapeHtml(String(Math.floor(snapshot.currency)))}</p>
      <p><strong>Next Reset Cost:</strong> ${escapeHtml(String(snapshot.nextCost))}</p>
      <p><strong>${escapeHtml(region.pointLabel)}:</strong> ${escapeHtml(String(snapshot.points))}</p>
      <p class="muted">Completed resets: ${escapeHtml(String(snapshot.resets))}</p>
    </section>
  `;
}

export function renderMol02Experience(context) {
  const now = Date.now();
  const runtime = synchronizeMol02Runtime(context.runtime, { now, state: context.state });
  const selected = selectedRegionId(runtime);
  const selectedSnapshot = resetRegionSnapshot(context.state, selected);
  const confirmSnapshot = runtime.confirmRegionId
    ? resetRegionSnapshot(context.state, runtime.confirmRegionId)
    : null;
  const resetPulse = runtime.resetPulseUntil > now;

  return `
    <article class="mol02-node ${resetPulse ? "is-reset-pulse" : ""}" data-node-id="${NODE_ID}">
      <section class="card mol-reset-head">
        <h3>Loop Reset</h3>
        <p>Select a region to rewind, then survive the memory gate.</p>
      </section>
      ${wheelMarkup(runtime)}
      ${regionPanelMarkup(selectedSnapshot)}

      ${
        runtime.confirmRegionId
          ? `
            <section class="card mol-reset-confirm">
              <h4>Are you sure you want to reset this region?</h4>
              ${
                runtime.challenge
                  ? `
                    <p><strong>Memory Gate:</strong> ${runtime.challenge.successCount}/${runtime.challenge.targetSuccesses} rounds cleared</p>
                    ${renderMemoryDisplay(runtime.challenge)}
                    ${
                      !runtime.challenge.solved
                        ? `
                          <div class="toolbar">
                            ${
                              runtime.challenge.phase === "idle"
                                ? `
                                  <button type="button" data-node-id="${NODE_ID}" data-node-action="mol02-memory-begin">
                                    Begin Sequence
                                  </button>
                                `
                                : ""
                            }
                            ${
                              runtime.challenge.phase === "show"
                                ? `
                                  <button
                                    type="button"
                                    data-node-id="${NODE_ID}"
                                    data-node-action="mol02-memory-enter-input"
                                  >
                                    Repeat Sequence
                                  </button>
                                `
                                : ""
                            }
                          </div>
                        `
                        : ""
                    }
                    ${
                      !runtime.challenge.solved
                        ? renderMemoryField({
                          nodeId: NODE_ID,
                          actionName: runtime.challenge.phase === "input" ? "mol02-memory-pick" : "",
                          game: runtime.challenge,
                        })
                        : ""
                    }
                    ${
                      runtime.challenge.solved
                        ? `
                          <div class="toolbar">
                            <button
                              type="button"
                              data-node-id="${NODE_ID}"
                              data-node-action="mol02-finalize-reset"
                              data-region-id="${escapeHtml(runtime.confirmRegionId)}"
                            >
                              Finalize Reset
                            </button>
                          </div>
                        `
                        : ""
                    }
                  `
                  : `
                    <p><strong>Required:</strong> ${
                      isPracticalGuideRegionId(confirmSnapshot.regionId)
                        ? "No currency cost."
                        : `${escapeHtml(String(confirmSnapshot.nextCost))} ${escapeHtml(confirmSnapshot.regionDef.currencyLabel)}`
                    }</p>
                    ${
                      confirmSnapshot.affordable
                        ? `
                          <div class="toolbar">
                            <button
                              type="button"
                              data-node-id="${NODE_ID}"
                              data-node-action="mol02-start-challenge"
                              data-region-id="${escapeHtml(runtime.confirmRegionId)}"
                              data-affordable="true"
                            >
                              Begin Reset Trial
                            </button>
                            <button
                              type="button"
                              class="ghost"
                              data-node-id="${NODE_ID}"
                              data-node-action="mol02-close-confirm"
                            >
                              Cancel
                            </button>
                          </div>
                        `
                        : `
                          <div class="toolbar">
                            <button
                              type="button"
                              class="ghost"
                              data-node-id="${NODE_ID}"
                              data-node-action="mol02-close-confirm"
                            >
                              Close
                            </button>
                          </div>
                        `
                    }
                  `
              }
            </section>
          `
          : ""
      }
    </article>
  `;
}

export const MOL02_NODE_EXPERIENCE = {
  nodeId: NODE_ID,
  initialState: initialMol02Runtime,
  synchronizeRuntime: synchronizeMol02Runtime,
  render: renderMol02Experience,
  reduceRuntime: reduceMol02Runtime,
  validateRuntime: validateMol02Runtime,
  buildActionFromElement: buildMol02ActionFromElement,
  buildKeyAction: buildMol02KeyAction,
};
