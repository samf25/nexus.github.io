import { escapeHtml } from "../../templates/shared.js";

const NODE_ID = "HUB06";

function normalizeRuntime(runtime) {
  const source = runtime && typeof runtime === "object" ? runtime : {};
  const anchored = Boolean(source.anchored);
  return {
    anchored,
    solved: anchored || Boolean(source.solved),
  };
}

export function initialHub06Runtime() {
  return {
    anchored: false,
    solved: false,
  };
}

export function validateHub06Runtime(runtime) {
  return normalizeRuntime(runtime).solved;
}

export function reduceHub06Runtime(runtime, action) {
  const current = normalizeRuntime(runtime);
  if (!action || typeof action !== "object") {
    return current;
  }

  if (current.solved) {
    return current;
  }

  if (action.type === "hub06-anchor-desk") {
    return {
      anchored: true,
      solved: true,
    };
  }

  return current;
}

export function buildHub06ActionFromElement(element) {
  if (element.getAttribute("data-node-action") !== "hub06-anchor-desk") {
    return null;
  }
  return {
    type: "hub06-anchor-desk",
  };
}

export function renderHub06Experience(context) {
  const runtime = normalizeRuntime(context.runtime);
  const solvedNow = Boolean(context.solved || runtime.solved);

  return `
    <article class="hub06-node" data-node-id="${NODE_ID}">
      ${
        solvedNow
          ? `
            <section class="hub06-card">
              <h3>Correspondence Desk</h3>
              <p>The floating desk settles into orbit, ready to receive and return messages.</p>
              <p class="key-hint">The Desk route is now available from navigation.</p>
            </section>
          `
          : `
            <section class="hub06-card">
              <h3>Correspondence Desk</h3>
              <p>A desk floats alone in the void, lit by a cold constellation glow.</p>
              <p>Odd. It looks like it could help route messages and guidance through the Nexus.</p>
              <button type="button" data-node-id="${NODE_ID}" data-node-action="hub06-anchor-desk">
                Anchor The Desk
              </button>
            </section>
          `
      }
      <p class="sr-only" role="status" aria-live="polite">
        ${escapeHtml(solvedNow ? "Correspondence desk unlocked." : "Desk still unanchored.")}
      </p>
    </article>
  `;
}

export const HUB06_NODE_EXPERIENCE = {
  nodeId: NODE_ID,
  initialState: initialHub06Runtime,
  render: renderHub06Experience,
  reduceRuntime: reduceHub06Runtime,
  validateRuntime: validateHub06Runtime,
  buildActionFromElement: buildHub06ActionFromElement,
};
