# Architecture Overview

## Runtime Model

This scaffold is a static-site single-page application using native ES modules.

- Entry: `src/main.js`
- Data source: `arg_node_specs_loreauth.json`
- Routing: hash router (`#/route`) from `src/core/router.js`
- Persistence: localStorage state (`nexus.arg.state.v1`) from `src/core/state.js`

## Core Flow

1. Load and index blueprint JSON.
2. Load persisted state.
3. Tick offline systems (Madra Well) and compute unlock state.
4. Resolve route to:
   - home dashboard
   - section hub
   - correspondence desk
   - node page
5. Render shell + content.
6. Handle UI actions via delegated events and persist updates.

## Blueprint-Driven Index

`src/data/blueprint.js` converts raw node JSON into:

- `nodesById`
- `nodesByRoute`
- `sectionNodes`
- `summary`

It also resolves each node to a canonical template using:

- alias mapping (`template` string -> canonical class)
- runtime/template heuristics fallback

## Canonical Templates

The scaffold aligns to workbook catalog classes:

- `RegionHub`
- `CanvasPuzzle`
- `BoardPuzzle`
- `DocumentPuzzle`
- `MapPlanner`
- `CraftingPage`
- `IncrementalSystem`
- `SchedulingSystem`
- `DungeonSystem`
- `DialogueState`
- `BossAssembler`
- `ResponsivePuzzle`

Each template currently renders scaffold-level UI with contracts and extension hooks.

## Preserved Systems

### Madra Well

- Offline deterministic growth (`tickMadraWell`)
- Preset multipliers
- Charge refinement action
- Milestone checks (`generated120`, `firstThreeCharges`)

### Delivery Board

- Deterministic day generation
- Deterministic dispatch scoring
- Perfect-day tracking

### Dungeon Crawl

- Deterministic room graph
- Room action execution
- Discovery and inventory updates

## Unlock + Progress

`src/core/unlock.js` computes:

- unlocked node IDs (all dependencies solved)
- section-level solved/unlocked totals
- frontier node list (unlocked and unsolved)

## Correspondence Desk

`src/ui/desk.js` provides menu-driven hint escalation:

- node selection from visible unlocked pool
- level 1/2/3 requests
- hint rendering from `hint_1`, `hint_2`, `hint_3`
- request state persisted in `hintLevels`

## State Shape (Current)

```json
{
  "solvedNodeIds": [],
  "seenNodeIds": [],
  "hintLevels": {},
  "inventory": {
    "rewards": {}
  },
  "systems": {
    "madraWell": {},
    "deliveryBoard": {},
    "dungeonCrawl": {}
  },
  "requestHistory": []
}
```

## Why Hash Routing

GitHub Pages does not automatically rewrite unknown paths to `index.html` for SPA-style deep links. Hash routing avoids this constraint and keeps all node routes shareable.

## Extension Points for Phase 2+

- Replace scaffold blocks in template renderers with node-family mechanics.
- Add canon payload renderers (`candidate_set`, taxonomy tables, maps, timelines).
- Add authored validation engines per template family.
- Add page mutation resolver layer for revisit-heavy nodes.
- Add boss assembler rule packs consuming real cross-node/system state.
