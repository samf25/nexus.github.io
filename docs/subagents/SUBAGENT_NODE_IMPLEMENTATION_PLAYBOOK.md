# Sub-Agent Node Implementation Playbook

Use this playbook for all node implementation delegations.

## Mission

Implement one node at a time as a complete, playable interaction while preserving maintainability and reuse.

## Hard Rules

- Keep code ASCII.
- Do not change unrelated node behavior.
- Keep route compatibility and existing unlock flow intact.
- Keep node logic modular and namespaced by `node_id`.
- Persist node runtime only at `state.nodeRuntime.<node_id>`.
- Keep validation deterministic and inspectable.
- Do not gate core interactions behind hover-only UI.
- Provide keyboard parity for all critical interactions.

## Required Architecture Pattern

1. Node module under `src/nodes/<sector>/`.
2. Register node module in `src/nodes/index.js`.
3. Node module exports:
   - `initialState`
   - `render`
   - `reduceRuntime`
   - `validateRuntime`
   - optional action builders (`buildActionFromElement`, `buildDropAction`, `buildKeyAction`)
4. Main route path uses node override registry before canonical template fallback.
5. Solve uses existing progression flow (`markNodeSolved`) so rewards/unlocks remain centralized.

## UX Quality Bar

- Puzzle must be visual and tactile, not form-only.
- Include immediate interaction feedback (snapping, highlighting, lock indicators, status rail, or equivalent).
- Include clear solve progress cues.
- Include reset path.
- Include concise control hints.

## Accessibility Requirements

- Every critical action available by keyboard.
- Focus-visible controls.
- Status updates through visible text (and where appropriate `aria-live`).
- Avoid hidden-only state.

## Maintainability Requirements

- Keep helper functions pure where possible.
- Keep state shape explicit and documented in code comments near reducer.
- Use dedicated CSS classes under a node-specific prefix (example: `.hub02-*`).
- Avoid hardcoding behavior in `src/main.js`; keep node-specific logic in node module.

## Validation And Testing Requirements

- Run `node --check` for all changed JS files.
- Run diagnostics (`get_errors`) and ensure no new errors.
- Perform one browser smoke test for the node route.
- Verify solve transitions to normal solved state and reward issuance.

## Required Final Report Format

- Files changed
- Runtime/state shape
- Actions implemented
- Validation logic summary
- Commands run + results
- Follow-up TODOs for next node
