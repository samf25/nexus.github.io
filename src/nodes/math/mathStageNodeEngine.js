import { escapeHtml } from "../../templates/shared.js";

function safeText(value) {
  return String(value == null ? "" : value).trim();
}

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function defaultNormalize(value) {
  return safeText(value)
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function isSolved(runtime, stages) {
  return stages.every((stage) => runtime.solvedStages[stage.id]);
}

function normalizeRuntime(candidate, stages) {
  const source = candidate && typeof candidate === "object" ? candidate : {};
  const rawInputs = source.inputs && typeof source.inputs === "object" ? source.inputs : {};
  const rawSolved = source.solvedStages && typeof source.solvedStages === "object" ? source.solvedStages : {};
  const inputs = {};
  const solvedStages = {};

  for (const stage of stages) {
    inputs[stage.id] = safeText(rawInputs[stage.id] || "");
    solvedStages[stage.id] = Boolean(rawSolved[stage.id]);
  }

  const solved = Boolean(source.solved) || isSolved({ solvedStages }, stages);

  return {
    inputs,
    solvedStages,
    solved,
    feedback: safeText(source.feedback || ""),
    feedbackStageId: safeText(source.feedbackStageId || ""),
  };
}

function stageUnlocked(stages, solvedStages, stageIndex) {
  if (stageIndex <= 0) {
    return true;
  }
  const previous = stages[stageIndex - 1];
  return Boolean(previous && solvedStages[previous.id]);
}

function answerAccepted(stage, value) {
  if (typeof stage.check === "function") {
    return Boolean(stage.check(value));
  }

  const expected = Array.isArray(stage.answers) ? stage.answers.map(defaultNormalize).filter(Boolean) : [];
  if (!expected.length) {
    return false;
  }
  const normalized = defaultNormalize(value);
  return expected.includes(normalized);
}

export function createMathStageNodeExperience(config) {
  const nodeId = safeText(config && config.nodeId);
  const title = safeText(config && config.title);
  const subtitle = safeText(config && config.subtitle);
  const solvedMessage = safeText(config && config.solvedMessage);
  const stages = Array.isArray(config && config.stages)
    ? config.stages
      .map((stage, index) => ({
        id: safeText(stage && stage.id) || `stage-${index + 1}`,
        label: safeText(stage && stage.label) || `Stage ${index + 1}`,
        prompt: safeText(stage && stage.prompt),
        placeholder: safeText(stage && stage.placeholder),
        hint: safeText(stage && stage.hint),
        solvedText: safeText(stage && stage.solvedText),
        answers: Array.isArray(stage && stage.answers) ? stage.answers.map((entry) => safeText(entry)).filter(Boolean) : [],
        check: stage && typeof stage.check === "function" ? stage.check : null,
      }))
      .filter((stage) => stage.prompt)
    : [];

  function initialState() {
    return normalizeRuntime({}, stages);
  }

  function validateRuntime(runtime) {
    return Boolean(normalizeRuntime(runtime, stages).solved);
  }

  function reduceRuntime(runtime, action) {
    const current = normalizeRuntime(runtime, stages);
    if (!action || typeof action !== "object") {
      return current;
    }

    if (action.type === "math-stage-set-input") {
      const stageId = safeText(action.stageId);
      if (!hasOwn(current.inputs, stageId)) {
        return current;
      }
      return {
        ...current,
        inputs: {
          ...current.inputs,
          [stageId]: safeText(action.value || ""),
        },
      };
    }

    if (action.type !== "math-stage-submit") {
      return current;
    }

    const stageId = safeText(action.stageId);
    const stageIndex = stages.findIndex((stage) => stage.id === stageId);
    if (stageIndex < 0) {
      return current;
    }

    if (!stageUnlocked(stages, current.solvedStages, stageIndex)) {
      return current;
    }

    const stage = stages[stageIndex];
    const submitted = safeText(action.value || current.inputs[stageId] || "");
    if (!submitted) {
      return {
        ...current,
        feedback: "Enter an answer before submitting.",
        feedbackStageId: stageId,
      };
    }

    if (!answerAccepted(stage, submitted)) {
      return {
        ...current,
        inputs: {
          ...current.inputs,
          [stageId]: submitted,
        },
        feedback: "That answer is not correct for this stage.",
        feedbackStageId: stageId,
      };
    }

    const next = {
      ...current,
      inputs: {
        ...current.inputs,
        [stageId]: submitted,
      },
      solvedStages: {
        ...current.solvedStages,
        [stageId]: true,
      },
      feedback: "",
      feedbackStageId: "",
    };

    return {
      ...next,
      solved: isSolved(next, stages),
    };
  }

  function buildActionFromElement(element) {
    const actionName = element.getAttribute("data-node-action");
    if (actionName !== "math-stage-submit") {
      return null;
    }

    const stageId = safeText(element.getAttribute("data-stage-id"));
    if (!stageId) {
      return null;
    }

    const node = element.closest(`[data-node-id="${nodeId}"]`) || element.closest(".math-stage-node");
    const input = node ? node.querySelector(`[data-stage-input="${stageId}"]`) : null;
    const value = input && "value" in input ? String(input.value || "") : "";

    return {
      type: "math-stage-submit",
      stageId,
      value,
      at: Date.now(),
    };
  }

  function buildKeyAction(event) {
    if (event.key !== "Enter") {
      return null;
    }
    const target = event.target;
    if (!(target instanceof Element) || !target.matches("[data-stage-input]")) {
      return null;
    }

    return {
      type: "math-stage-submit",
      stageId: safeText(target.getAttribute("data-stage-input")),
      value: "value" in target ? String(target.value || "") : "",
      at: Date.now(),
    };
  }

  function stageMarkup(runtime, stage, index) {
    const unlocked = stageUnlocked(stages, runtime.solvedStages, index);
    const solved = Boolean(runtime.solvedStages[stage.id]);
    const value = runtime.inputs[stage.id] || "";
    const showFeedback = runtime.feedbackStageId === stage.id && runtime.feedback;
    return `
      <article class="card math-stage-card ${solved ? "is-solved" : ""} ${!unlocked ? "is-locked" : ""}">
        <header class="math-stage-card-head">
          <h4>${escapeHtml(stage.label)}</h4>
        </header>
        <p>${escapeHtml(stage.prompt)}</p>
        ${
          unlocked
            ? `
              <div class="math-stage-answer-row">
                <input
                  type="text"
                  class="math-stage-input"
                  data-stage-input="${escapeHtml(stage.id)}"
                  value="${escapeHtml(value)}"
                  placeholder="Enter answer"
                  ${solved ? "disabled" : ""}
                  autocomplete="off"
                  spellcheck="false"
                />
                <button
                  type="button"
                  data-node-id="${escapeHtml(nodeId)}"
                  data-node-action="math-stage-submit"
                  data-stage-id="${escapeHtml(stage.id)}"
                  ${solved ? "disabled" : ""}
                >
                  ${solved ? "Locked" : "Submit"}
                </button>
              </div>
            `
            : `<p class="muted">Solve the previous stage to unlock this one.</p>`
        }
        ${
          solved && stage.solvedText
            ? `<p class="muted">${escapeHtml(stage.solvedText)}</p>`
            : ""
        }
        ${
          showFeedback
            ? `<p class="muted">${escapeHtml(runtime.feedback)}</p>`
            : ""
        }
      </article>
    `;
  }

  function render(context) {
    const runtime = normalizeRuntime(context.runtime, stages);
    const solvedNow = Boolean(context.solved || runtime.solved);
    const solvedCount = stages.filter((stage) => runtime.solvedStages[stage.id]).length;
    const progress = stages.length ? Math.round((solvedCount / stages.length) * 100) : 0;

    return `
      <article class="math-stage-node" data-node-id="${escapeHtml(nodeId)}">
        <section class="card math-stage-head">
          <h3>${escapeHtml(title)}</h3>
          <p>${escapeHtml(subtitle)}</p>
          <p class="muted">${escapeHtml(String(solvedCount))}/${escapeHtml(String(stages.length))} stages solved</p>
          <div class="progress-bar"><span style="width:${progress}%;"></span></div>
        </section>
        <section class="math-stage-grid">
          ${stages.map((stage, index) => stageMarkup(runtime, stage, index)).join("")}
        </section>
        ${
          solvedNow
            ? `
              <section class="completion-banner" aria-live="polite">
                <p><strong>${escapeHtml(solvedMessage)}</strong></p>
              </section>
            `
            : ""
        }
      </article>
    `;
  }

  return {
    nodeId,
    initialState,
    render,
    reduceRuntime,
    validateRuntime,
    buildActionFromElement,
    buildKeyAction,
  };
}
