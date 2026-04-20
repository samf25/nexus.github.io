const SAMPLE_ORDERS = [
  { id: "order-1", window: "morning", fragile: false },
  { id: "order-2", window: "midday", fragile: true },
  { id: "order-3", window: "late", fragile: false },
  { id: "order-4", window: "late", fragile: true },
];

function deterministicScore(plan) {
  if (!Array.isArray(plan) || plan.length === 0) {
    return 0;
  }

  let score = 0;
  for (const assignment of plan) {
    if (!assignment || !assignment.staff || !assignment.orderId) {
      continue;
    }

    score += 10;
    if (assignment.staff === "swift" && assignment.window === "late") {
      score += 4;
    }
    if (assignment.staff === "careful" && assignment.fragile) {
      score += 4;
    }
  }

  return score;
}

export function buildDeliveryDay(state) {
  const day = state.totalDispatches + 1;
  return {
    day,
    orders: SAMPLE_ORDERS.map((order) => ({ ...order })),
  };
}

export function dispatchDeliveryPlan(deliveryState, plan) {
  const dayBoard = buildDeliveryDay(deliveryState);
  const score = deterministicScore(plan);
  const perfect = score >= 46;

  const run = {
    day: dayBoard.day,
    score,
    perfect,
    resolvedAt: Date.now(),
    assignments: Array.isArray(plan) ? plan : [],
  };

  return {
    nextState: {
      ...deliveryState,
      totalDispatches: deliveryState.totalDispatches + 1,
      perfectDays: deliveryState.perfectDays + (perfect ? 1 : 0),
      deliveryRuns: [run, ...(deliveryState.deliveryRuns || [])].slice(0, 24),
    },
    run,
  };
}

export function defaultDeliveryPlan(dayBoard) {
  const staffCycle = ["steady", "careful", "swift", "steady"];
  return dayBoard.orders.map((order, index) => ({
    orderId: order.id,
    window: order.window,
    fragile: order.fragile,
    staff: staffCycle[index % staffCycle.length],
  }));
}
