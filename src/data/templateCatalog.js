export const CANONICAL_TEMPLATE_SPECS = {
  RegionHub: {
    contract:
      "Region overview with progress map, unlocked nodes, artifact slots, and optional live widget.",
    usedFor: "Section landings and section-level progression.",
  },
  CanvasPuzzle: {
    contract:
      "Single-screen interaction puzzle using drag, rotate, toggle, and spatial placement.",
    usedFor: "Visual or tactile feeders and tutorial nodes.",
  },
  BoardPuzzle: {
    contract:
      "Structured deterministic board state with cards, grids, ledgers, or brackets.",
    usedFor: "Logic grids, tactical boards, matrix solving, and classification pages.",
  },
  DocumentPuzzle: {
    contract:
      "Pseudo-document with annotations, metadata, revisions, and revisit-aware mutations.",
    usedFor: "Annotated pages, diff viewers, archive puzzles, and desk-linked clues.",
  },
  MapPlanner: {
    contract:
      "Route graph or scheduling planner with explicit travel/legality constraints.",
    usedFor: "Atlas pages, route planners, and transit/surveillance routing.",
  },
  CraftingPage: {
    contract:
      "Deterministic crafting simulator with tagged ingredients and recipe validation.",
    usedFor: "Soulsmith, enchanter, and system-backed crafting flows.",
  },
  IncrementalSystem: {
    contract:
      "Long-lived offline-accumulating system with milestones and conversion actions.",
    usedFor: "Madra Well and future incremental region widgets.",
  },
  SchedulingSystem: {
    contract:
      "Persistent dispatch board that resolves deterministic schedule simulations.",
    usedFor: "Delivery board and future logistics systems.",
  },
  DungeonSystem: {
    contract:
      "Persistent deterministic room graph with inventory and scripted room logic.",
    usedFor: "Dungeon crawl core loop and dungeon-linked crossovers.",
  },
  DialogueState: {
    contract:
      "Explicit conversation state machine with tracked truth/knowledge flags.",
    usedFor: "Dialogue-heavy nodes and desk-style stateful interactions.",
  },
  BossAssembler: {
    contract:
      "Synthesis page that imports prior artifacts and validates a combined solve state.",
    usedFor: "Wave bosses, crossovers, convergence, and final arc assemblers.",
  },
  ResponsivePuzzle: {
    contract:
      "Layout-sensitive puzzle with accessible alternative controls.",
    usedFor: "Web-native and adaptive interface challenges.",
  },
};

export const SYSTEM_BLUEPRINTS = {
  shell: {
    key: "Global Shell and Inventory Layer",
    routes: ["/", "/desk", "/<section>/<node>", "/finale/*"],
  },
  desk: {
    key: "Correspondence Desk",
    routes: ["/desk"],
  },
  madraWell: {
    key: "Madra Well",
    routes: ["/cradle/madra-well", "/cradle"],
  },
  deliveryBoard: {
    key: "Delivery Board",
    routes: ["/wandering-inn/delivery-board", "/wandering-inn"],
  },
  dungeonCrawl: {
    key: "Dungeon Crawl",
    routes: ["/dungeon-crawler-carl/tutorial-floor", "/dungeon-crawler-carl"],
  },
  mutationLayer: {
    key: "Page Mutation / Revisit Layer",
    routes: ["/mol/*", "/finale/*", "document nodes"],
  },
};

export const TEMPLATE_ALIASES = {
  landing_canvas: "CanvasPuzzle",
  radial_sort: "CanvasPuzzle",
  annotated_page: "DocumentPuzzle",
  overlay_canvas: "CanvasPuzzle",
  meta_table: "BossAssembler",
  timed_input: "CanvasPuzzle",
  card_match: "BoardPuzzle",
  correspondence_desk: "DialogueState",
  document_puzzle: "DocumentPuzzle",
  logic_board: "BoardPuzzle",
  diff_viewer: "DocumentPuzzle",
  calendar_board: "BoardPuzzle",
  clockface: "BoardPuzzle",
  logic_ledger: "BoardPuzzle",
  map_route: "MapPlanner",
  classification_form: "BoardPuzzle",
  story_match: "BoardPuzzle",
  incremental_system: "IncrementalSystem",
  bracket_board: "BoardPuzzle",
  logic_grid: "BoardPuzzle",
  proof_builder: "BoardPuzzle",
  state_grid: "BoardPuzzle",
  factor_locks: "BoardPuzzle",
  crt_console: "BoardPuzzle",
  classification_matrix: "BoardPuzzle",
  scheduling_board: "SchedulingSystem",
  chessboard: "BoardPuzzle",
  boss_lattice: "BossAssembler",
  evidence_board: "BoardPuzzle",
  audio_visual: "CanvasPuzzle",
  skill_tree: "CraftingPage",
  crafting_bench: "CraftingPage",
  state_graph: "BoardPuzzle",
  memory_palace: "BoardPuzzle",
  revisit_diff: "DocumentPuzzle",
  residue_console: "BoardPuzzle",
  cabinet_match: "BoardPuzzle",
  room_logic: "BoardPuzzle",
  door_gauntlet: "BoardPuzzle",
  table_deduction: "BoardPuzzle",
  permutation_animator: "CanvasPuzzle",
  star_map: "MapPlanner",
  layer_toggle: "CanvasPuzzle",
  dungeon_crawl: "DungeonSystem",
  loot_match: "BoardPuzzle",
  surface_path: "CanvasPuzzle",
  chart_match: "BoardPuzzle",
  choice_tree: "DialogueState",
  registry_board: "BoardPuzzle",
  schedule_map: "MapPlanner",
  constraint_web: "BoardPuzzle",
  nonogram: "BoardPuzzle",
  pattern_grid: "BoardPuzzle",
  blueprint_rotator: "CanvasPuzzle",
  mirror_match: "BoardPuzzle",
  graph_cluster: "BoardPuzzle",
  resource_ledger: "BoardPuzzle",
  ticker_decode: "DocumentPuzzle",
  timed_memory: "CanvasPuzzle",
  territory_board: "BoardPuzzle",
  polyhedron_table: "BoardPuzzle",
  geometry_canvas: "CanvasPuzzle",
  transport_canvas: "CanvasPuzzle",
  weight_scales: "BoardPuzzle",
  hex_board: "BoardPuzzle",
};
