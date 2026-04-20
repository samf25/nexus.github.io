# HUB02 Implementation Brief - Compass of Genres

## Node Identity

- `node_id`: `HUB02`
- `route`: `/nexus/compass-of-genres`
- `template`: `radial_sort`
- `runtime`: `client_puzzle`
- `reward`: `Nexus Bearings`

## Blueprint Summary

- Sort 12 icons into two rings.
- Outer ring: 8 fiction realms.
- Inner ring: 4 math overlays.
- After sorting, rotate rings to align icon notches with engraved tick marks.
- Extraction is clockwise engaged tick sequence.

## Deliverable

A playable radial sort + ring alignment puzzle with deterministic validation and solve integration.

## Required UI

- Compass board with two rings and visible sockets.
- Icon bank/tray of 12 draggable chips.
- Socket highlights during drag hover.
- Rotation controls for outer and inner rings.
- Validation status section showing:
  - placement completion
  - alignment status
  - extracted sequence (only when valid)
- Reset controls:
  - reset placements
  - reset rotations

## State Contract (`nodeRuntime.HUB02`)

- `placements`: record from `iconId` to `socketId`
- `outerRotationStep`: integer
- `innerRotationStep`: integer
- `solved`: boolean
- `extracted`: string

## Interaction Contract

- Drag icon from tray to socket.
- Replacing a socket returns prior icon to tray.
- Rotations are step-based (deterministic), not free-angle.
- Keyboard controls:
  - focus icon/socket operations
  - rotate outer/inner rings via key shortcuts or focused buttons

## Validation Contract

Validation must check both layers:

1. Placement validity:
- All 12 icons placed.
- Each icon in the correct socket category and exact target slot.

2. Rotation validity:
- `outerRotationStep` and `innerRotationStep` match the authored solved steps.

3. Extraction:
- Produce deterministic clockwise tick code when solved.

If solved and node not previously solved, main flow must call `markNodeSolved`.

## Data-Driven Requirement

Define icon metadata and socket metadata as local data tables in the HUB02 module:

- `iconId`, `label`, `ringType`, `theme`
- `socketId`, `ringType`, `index`
- target solved mapping
- target solved ring steps

This keeps future reskins data-only.

## File Touchpoints

- Add new module: `src/nodes/hub/hub02CompassOfGenres.js`
- Register in: `src/nodes/index.js`
- Add CSS under node prefix in: `styles/main.css`
- Reuse current node override plumbing in `src/main.js` (do not add bespoke HUB02 logic there unless absolutely required)

## Visual Direction

- Brass and engraved instrument look.
- Strong ring distinction (outer fiction, inner math).
- Tick marks that visibly engage when aligned.
- Subtle motion cues on rotation step change.

## Acceptance Checklist

- Route renders full interactive puzzle at `/nexus/compass-of-genres`.
- Drag/drop assignment works for all 12 icons.
- Rotations are controllable and persisted.
- Solve is deterministic and repeatable.
- Solve awards reward through normal flow.
- Node runtime persists across navigation/reload.
- Syntax checks pass and diagnostics clean.
