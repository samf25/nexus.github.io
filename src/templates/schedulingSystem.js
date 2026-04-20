import { escapeHtml, renderNodeScaffold } from "./shared.js";
import { buildDeliveryDay } from "../systems/deliveryBoard.js";

export function renderSchedulingSystem(context) {
  const { node, templateSpec, solved, state } = context;
  const deliveryState = state.systems.deliveryBoard;
  const dayBoard = buildDeliveryDay(deliveryState);

  const bodyHtml = `
    <h3>Scheduling System Scaffold</h3>
    <p>${escapeHtml(node.surface || "Scheduling surface pending.")}</p>

    <div class="card-grid">
      <article class="card system">
        <h3>Dispatch Summary</h3>
        <p>Dispatches run: <strong>${escapeHtml(String(deliveryState.totalDispatches))}</strong></p>
        <p>Perfect days: <strong>${escapeHtml(String(deliveryState.perfectDays))}</strong></p>
        <button class="inline-action" data-action="delivery-dispatch">Run Deterministic Dispatch</button>
      </article>
      <article class="card">
        <h3>Current Day Orders</h3>
        <ul class="route-list">
          ${dayBoard.orders
            .map(
              (order) =>
                `<li class="route-item">${escapeHtml(order.id)} | ${escapeHtml(order.window)} | ${
                  order.fragile ? "fragile" : "durable"
                }</li>`,
            )
            .join("")}
        </ul>
      </article>
    </div>
  `;

  return renderNodeScaffold({ node, templateSpec, solved, bodyHtml });
}
