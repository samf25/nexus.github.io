# Nexus Hub Node Design Instructions

This document translates plan metadata into implementation-ready design instructions for HUB01-HUB08.

## Global Requirements For Nexus Nodes

- Keep node logic modular and isolated by `node_id`.
- Keep shared mechanics generic so future sectors can reuse them.
- Persist interaction state under `state.nodeRuntime.<node_id>` only.
- Keep validation deterministic and inspectable (no opaque magic).
- Prefer direct manipulation UI: drag, rotate, snap, reorder, dial, graph traversal.
- Include keyboard parity for all critical interactions.
- Include hint rail support through existing Desk system (`hint_1`..`hint_3`).
- Keep extraction and solve conditions clear in UI once relevant.

## Node Implementation Contract

Each implemented node should expose:

- `initialState(): object`
- `render(context): string`
- `attach(mountContext): () => void`

Where:

- `render` outputs HTML only.
- `attach` wires behavior, updates state, and returns a cleanup function.
- `initialState` is pure and deterministic.

## HUB01 - Shattered Frontispiece

### Objective

Reassemble 12 torn shards into the correct dedication plate by spatial placement and rotation.

### Core Interaction

- Freeform drag pieces in a bounded workspace.
- Rotate selected piece in 90-degree steps (keyboard + UI control).
- Snap piece into place only when near target and correctly rotated.
- Offer per-piece lock toggle so solved placements are protected.

### Required UI Components

- Main board target silhouette.
- Piece tray/workspace with all shards.
- Piece status strip (`placed / unplaced`, `locked`).
- Reveal panel that becomes active on full solve.
- Controls: `reset`, `auto-arrange in tray`, optional `rotate selected`.

### State Contract (`nodeRuntime.HUB01`)

- `pieces[]`: `{ id, x, y, rotation, placed, locked }`
- `selectedPieceId`: string or null
- `solved`: boolean
- `revealedPhrase`: string

### Validation

- Solved when all 12 pieces satisfy target slot and target rotation.
- Reward should auto-issue through normal solve flow.
- Validation must be deterministic and local.

### Accessibility

- Focusable pieces.
- Keyboard move nudge (`arrow`), rotate (`Q/E` or `[`/`]`).
- Screen-readable status summary.

### Visual Direction

- Antiquarian parchment with torn-edge shards.
- Faint compass border continuity cues.
- Piece motifs hint future sectors.

### Reuse Target

Promote this into a generic `shardAssembly` mechanic for later document restoration nodes.

## HUB02 - Compass of Genres

### Objective

Sort 12 icons into two rings, then rotate rings to align notches and extract the bearings code.

### Core Interaction

- Drag icon chips into ring sockets.
- Distinguish outer 8 fiction slots vs inner 4 math slots.
- Rotate each ring independently after sorting.
- Show notch engagement feedback when alignment is correct.

### Required UI Components

- Dual-ring compass board with snap sockets.
- Icon bank with tooltips.
- Ring rotation handles or dial controls.
- Output rail that unlocks once both mapping and alignment are valid.

### State Contract (`nodeRuntime.HUB02`)

- `placements`: `{ iconId: socketId }`
- `outerRotation`: integer step
- `innerRotation`: integer step
- `solved`: boolean

### Validation

- Validate icon-to-socket mapping first.
- Validate ring-step alignment second.
- Extraction reads engaged ticks clockwise.

### Accessibility

- Alternative list-based icon assignment mode.
- Keyboard ring rotation.

### Visual Direction

- Brass instrument aesthetic with engraved sector glyphs.

### Reuse Target

Reusable radial sort + ring align component.

## HUB03 - The Marginal Index

### Objective

Discover 12 marginalia clues in page furniture, then order by footnote index for extraction.

### Core Interaction

- Hover/click inspect hotspots: margin marks, alt text, sidenotes, footnotes.
- Toggle discovered-state badges on each clue.
- Reorder discovered clues in an indexed rail.

### Required UI Components

- Rich annotated document view.
- Discoverable hotspot overlays.
- Found clue list with drag reorder.
- Extraction preview panel.

### State Contract (`nodeRuntime.HUB03`)

- `discoveredIds[]`
- `orderedIds[]`
- `solved`: boolean

### Validation

- Require all 12 discovered.
- Require correct footnote order.
- Accept normalized text answer fallback.

### Accessibility

- Non-hover reveal mode (`tab` through hotspots).
- High-contrast hotspot outlines.

### Visual Direction

- Faux title-page with subtle metadata layers.

### Reuse Target

Reusable annotated-document discovery engine.

## HUB04 - Observatory Calibration

### Objective

Align sky map and sigil overlay to match four target constellations and extract activation order.

### Core Interaction

- Rotate sky layer and transparent sigil layer independently.
- Snap/soft lock when near correct alignment.
- Sequence panel records ring-light order.

### Required UI Components

- Dual-layer circular overlay canvas.
- Angle indicators with optional fine/coarse control.
- Four constellation targets.

### State Contract (`nodeRuntime.HUB04`)

- `skyAngle`
- `sigilAngle`
- `matchedTargets[]`
- `lightOrder[]`
- `solved`

### Validation

- Validate angular tolerances for each target.
- Validate emitted order string.

### Accessibility

- Numeric angle controls for keyboard users.
- Optional snap-step increments.

### Visual Direction

- Observatory brass and starlight motif.

### Reuse Target

Generic two-layer rotational alignment puzzle.

## HUB05 - The First Crossroad

### Objective

Combine outputs from HUB01-04 by applying each artifact as a different selector type.

### Core Interaction

- Four selector dials (`line`, `direction`, `order`, `coordinate`).
- Shared extraction surface (repaired dedication).
- Live highlight of selected letters.

### Required UI Components

- Crossroad desk with four input channels.
- Selector-to-surface mapping legend.
- Extraction rail and checksum indicator.

### State Contract (`nodeRuntime.HUB05`)

- `selectorState`: `{ addressLine, bearingDir, indexOrder, constellationCoords }`
- `selectedLetters[]`
- `solved`

### Validation

- Validate full selector-state or normalized output string.
- Must enforce dependency readiness (HUB01-04 complete artifacts available).

### Accessibility

- Text-mode selector entry equivalent.
- Explicit validity messages per selector.

### Visual Direction

- Mechanical desk with luminous inlay guides.

### Reuse Target

Meta-assembler scaffold for later bosses.

## HUB06 - Correspondence Desk

### Objective

Diegetic inbox system for hint escalation and frontier guidance.

### Core Interaction

- Thread selection by node/frontier.
- Tiered replies (`level 1/2/3`) with history log.
- Optional flavor replies and route nudges.

### Required UI Components

- Inbox/thread pane.
- Hint request controls.
- Reply transcript + request timeline.

### State Contract (`nodeRuntime.HUB06` optional, plus global hint state)

- `activeThreadNodeId`
- `threadFlags`
- `firstUnlockCompleted`

### Validation

- First valid request after HUB05 awards `Reply Protocol`.
- Continued use should not re-award.

### Accessibility

- Fully menu-driven, no NLP required.

### Visual Direction

- Typewriter/dispatch desk fiction layer.

### Reuse Target

Global hint UX system used by all sectors.

## HUB07 - Torn Dedication

### Objective

Reorder poem lines using Index String, then combine acrostic and alt-text fragments into Fog Phrase.

### Core Interaction

- Line-reorder list controlled by drag + keyboard.
- Decorated initials become active after proper order.
- Placeholder image alt-text bank selection.

### Required UI Components

- Torn poem panel with reorder controls.
- Initial letters extraction strip.
- Alt-text chooser and merge panel.

### State Contract (`nodeRuntime.HUB07`)

- `lineOrder[]`
- `initialExtraction`
- `selectedAltFragments[]`
- `solved`

### Validation

- Accept final phrase or equivalent fully solved state.

### Accessibility

- Up/down reorder controls for non-drag input.
- Plain-text alt-fragment list for screen readers.

### Visual Direction

- Torn vellum with ornamental capitals.

### Reuse Target

Document reorder + multi-source extraction pattern.

## HUB08 - Fog Key Lattice

### Objective

Boss assembly: socket eight first-wave artifacts, then traverse lattice via Fog Phrase movement instructions.

### Core Interaction

- Artifact socketing into silhouette-matched locks.
- Lattice traversal animator guided by phrase tokens.
- Path verification and passkey extraction.

### Required UI Components

- Eight lock sockets around central seal.
- Inventory-to-socket assignment UI.
- Traversal board with replay controls.

### State Contract (`nodeRuntime.HUB08`)

- `socketAssignments`
- `traversalPath[]`
- `solved`

### Validation

- Validate artifact placement correctness.
- Validate traversal path and extracted token.

### Accessibility

- List-based socket assignment mode.
- Step-by-step traversal controls.

### Visual Direction

- Fogged sigil lattice with staged illumination.

### Reuse Target

Primary pattern for multi-branch boss gates.

## Delivery Order (Nexus Hub)

1. HUB01
2. HUB02
3. HUB03
4. HUB04
5. HUB05
6. HUB06
7. HUB07
8. HUB08

## Engineering Checklist Per Node

- Add node module under `src/nodes/hub/`.
- Register node module in node registry.
- Add/extend CSS only for new mechanic classes.
- Add deterministic validation function.
- Add local smoke test pass (`node --check` and browser run).
- Confirm reward unlock and frontier updates.
