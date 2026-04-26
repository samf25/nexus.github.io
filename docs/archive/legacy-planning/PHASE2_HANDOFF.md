# Phase 2 Handoff

## Immediate Priorities

1. Replace scaffold interactions with real mechanic implementations for each canonical template family.
2. Implement robust validation contracts and submission workflow (`api_submit` placeholders currently local-only).
3. Expand persistent systems with authored content payloads and milestone unlock side effects.
4. Add content packaging for lore-heavy feeders using canon payload structures.

## Suggested Implementation Order

Aligned to workbook `Build Notes`:

1. Keep shell/unlock/inventory/desk stable.
2. Build generic template families in this order:
   - CanvasPuzzle
   - BoardPuzzle
   - DocumentPuzzle
   - MapPlanner
   - CraftingPage
   - BossAssembler
3. Flesh out persistent systems:
   - Madra Well
   - Delivery Board
   - Dungeon Crawl
4. Author wave-I content and validation.
5. Add mutation/revisit layer before heavy MoL/finale revisits.

## Content Data Strategy

- Keep node logic generic.
- Put lore specifics into payload data keyed by `node_id`.
- Continue using fairness rails:
  - candidate drawers
  - glossary toggles
  - spoiler labels
  - anchor facts

## Technical Debt to Address in Phase 2

- Add stronger runtime type validation for blueprint schema.
- Add unit tests for unlock logic and system determinism.
- Add import/export progress tools for playtesting.
- Add analytics/event logging hooks for puzzle telemetry.
- Add static content bundling strategy for large canon payloads.

## Completion Criteria for Phase 2

- At least one fully implemented node for each canonical template family.
- Full solve->unlock loops proven across one starter wave.
- Desk hint escalation integrated with solved-state and stuck-frontier detection.
- Persistent systems used by at least two downstream nodes each.
