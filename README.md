# NEXUS ARG Scaffold (Phase 1)

This repository now contains a launchable ARG runtime scaffold designed for GitHub Pages.
It is built to scale directly from your blueprint files:

- `arg_lore_authenticity_revision.docx`
- `arg_implementation_pack_loreauth.xlsx`
- `arg_node_specs_loreauth.json`

## What Phase 1 Implements

- Blueprint-driven node routing for the full node list (`route`, `node_id`, `dependencies`, `reads_state`, `writes_state`, reward inventory).
- Hash-based routing compatible with GitHub Pages (`#/...`) to avoid server rewrite requirements.
- Global shell with:
  - section navigation
  - artifact tray (inventory)
  - open frontier list
  - reset button
- Unlock engine based on dependency completion.
- Correspondence Desk scaffold with hint escalation levels using node-authored hints (`hint_1`..`hint_3`).
- Canonical template registry and route-to-template resolution.
- Executable stubs for preserved persistent systems:
  - Madra Well (offline tick + charge refinement)
  - Delivery Board (deterministic dispatch simulation)
  - Dungeon Crawl (deterministic room-graph actions)
- Section hub pages and node detail pages for all blueprint nodes.

## Local Run

Because the app fetches JSON, run it over HTTP(S) instead of opening `index.html` directly.

### Option 1: Python

```powershell
cd C:\Users\samro\OneDrive\Desktop\nexus.github.io
python -m http.server 8000
```

Open `http://localhost:8000`.

### Option 2: Any static server

Use your preferred static server (`npx serve`, VS Code Live Server, etc).

## GitHub Pages Deployment

1. Push this repository to GitHub.
2. In repository settings, enable Pages and select the deployment source:
   - `Deploy from a branch`
   - Branch: `main` (or your default branch)
   - Folder: `/ (root)`
3. Save. GitHub Pages will publish `index.html` from the repo root.

Because routing is hash-based, deep links like `#/nexus/frontispiece` work without additional 404 rewrites.

## Project Structure

```text
index.html
styles/
  main.css
src/
  main.js
  core/
    router.js
    state.js
    unlock.js
  data/
    blueprint.js
    templateCatalog.js
  systems/
    madraWell.js
    deliveryBoard.js
    dungeonCrawl.js
  templates/
    *.js (canonical page template renderers)
  ui/
    shell.js
    desk.js
docs/
  ARCHITECTURE.md
  PHASE2_HANDOFF.md
arg_node_specs_loreauth.json
```

## Next Step (Phase 2)

Phase 1 intentionally focuses on architecture and launchability. Phase 2 should begin implementing template-specific mechanics and validation logic per node family while preserving this data-driven runtime.

See `docs/PHASE2_HANDOFF.md` for a concrete implementation handoff list.
