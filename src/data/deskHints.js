function fallbackHintsForNode(node) {
  return [node.hint_1, node.hint_2, node.hint_3]
    .map((hint) => String(hint || "").trim())
    .filter(Boolean);
}

export const DESK_HINT_OVERRIDES = Object.freeze({
  HUB01: Object.freeze([
    "Start by matching torn edges and border grain, not sentence fragments.",
    "Lock pieces that are definitely on the frame before resolving the center.",
    "When the plate is complete, read the highlighted phrase exactly as shown.",
  ]),
  HUB02: Object.freeze([
    "Place every icon into the correct family first, then worry about rotation.",
    "Only the post-sort wheel alignment matters for completion.",
    "Use the labeled starter regions as anchors and rotate until all marks line up.",
  ]),
  HUB03: Object.freeze([
    "Scan every symbol with the same hover behavior; none are decorative.",
    "You are collecting index fragments, not solving a substitution cipher.",
    "Treat this as a complete field sweep and confirm every mark once.",
  ]),
  HUB04: Object.freeze([
    "The telescope is inert until the right artifact interaction is performed.",
    "Rotate the star field until all required constellation markers snap together.",
    "Alignment must be exact across every tracked pattern at once.",
  ]),
  HUB05: Object.freeze([
    "Use artifacts to reveal hidden guides before trying to place anything.",
    "This puzzle is about assigning each icon to its true constellation socket.",
    "Once every slot matches, the passkey forge resolves automatically.",
  ]),
  HUB06: Object.freeze([
    "This node is a discovery checkpoint; read and acknowledge the scene.",
    "No puzzle input is required beyond entering and progressing the moment.",
    "After first clear, the Desk route should be available globally.",
  ]),
  HUB07: Object.freeze([
    "Solve the page assembly first; phrase extraction is second.",
    "The ordering artifact reveals line indices for the final phrase readout.",
    "Enter the recovered phrase with spacing and wording exactly preserved.",
  ]),
  HUB08: Object.freeze([
    "Phase one is a seal check: place all required artifacts into the lattice.",
    "After unsealing, complete all three rites before expecting the key.",
    "Hold interactions and sacrifice conditions both matter; partial progress is tracked.",
  ]),

  CRD01: Object.freeze([
    "Treat this as timing discipline: hit in the pulse window only.",
    "Each rhythm phase needs a streak; misses reset the local streak only.",
    "Stay calm through pattern changes and clear all phases in sequence.",
  ]),
  CRD02: Object.freeze([
    "Finish the origin sequence first, then build Madra with manual cycling.",
    "Cycling techniques create passive gain; technique unlocks define combat growth.",
    "Breakthroughs gate by stage requirements plus specific artifacts where noted.",
  ]),
  CRD03: Object.freeze([
    "Use the popup entry for each covered location instead of typing on-map.",
    "You only need exact names; punctuation variants are tolerated in select entries.",
    "Clear every covered label on both the main map and the inset map.",
  ]),
  CRD04: Object.freeze([
    "Tournament entry requires the pass artifact and obeys retry cooldown rules.",
    "Without core techniques, winning is unlikely even with good turns.",
    "Plan around control abilities and survivability more than raw trading.",
  ]),
  CRD05: Object.freeze([
    "This duel is stage-skewed against you; defensive sequencing matters.",
    "Use your strongest control windows to deny enemy technique spikes.",
    "Victory unlocks vault rewards that open later Cradle and Worm progression.",
  ]),
  CRD06: Object.freeze([
    "Jai Long pressures hard early; stabilize before committing to burst turns.",
    "Track your Madra pool so your best techniques are available on key rounds.",
    "Winning unlocks HEPW and core cross-region progression artifacts.",
  ]),
  CRD07: Object.freeze([
    "Advancement needs all required Nightwheel materials plus the revelation text.",
    "The revelation stays corrupted until the matching cipher chain is complete.",
    "Use Hunts for drops and Madra, then socket materials at Home Base.",
  ]),
  CRD08: Object.freeze([
    "You must be Underlord before entering this gauntlet.",
    "Health and Madra restore between rounds, so optimize each duel independently.",
    "Beating all five underlords grants major cross-region rewards.",
  ]),
  CRD09: Object.freeze([
    "Each Lord-stage attempt requires full Madra and Soulfire investment first.",
    "If rhythm or revelation fails, both investment spheres drain and must be recharged.",
    "Overlord and Archlord each consume their own I/II/Cipher revelation set.",
  ]),
  CRD10: Object.freeze([
    "Only Archlords can attempt this branching advancement trial.",
    "Choice history determines which high realm endpoint becomes available.",
    "Expect intermittent combat checks; preserve resources for late branches.",
  ]),
  CRD11: Object.freeze([
    "Track and defeat each Dreadgod once; defeated targets grey out.",
    "Every Dreadgod has a different combat profile and reward artifact.",
    "Full completion requires all four hunts, not a single clear.",
  ]),

  TWI01: Object.freeze([
    "Each row has multiple blanks; complete all missing fields for that guest.",
    "Accepted entries lock in and become part of the permanent ledger styling.",
    "Use canonical spellings from the setting; near-miss names will fail.",
  ]),
  TWI02: Object.freeze([
    "Click a covered region, submit the city/region name in the popup, and clear it.",
    "Some labels accept canonical alias handling, but default to the displayed map lore.",
    "You win only after all covered sites on Izril are restored.",
  ]),
  TWI03: Object.freeze([
    "Inn tier controls which quests can appear and their reward pool quality.",
    "Keep enough supplies on hand so quest fulfillment is available when high-value quests roll.",
    "This node seeds multiple critical cross-region unlock artifacts over time.",
  ]),
  TWI04: Object.freeze([
    "This board is economy progression, not an artifact source.",
    "Greyed options indicate insufficient reputation for purchase.",
    "Upgrade order matters because later options depend on earlier infrastructure.",
  ]),

  WORM01: Object.freeze([
    "Pick a stable starter pair first; those cards shape early arena viability.",
    "Use Job Board pulls to widen your deck while Sickbay handles attrition.",
    "Shard slotting is per-cape and should match the card's strongest combat role.",
  ]),
  WORM02: Object.freeze([
    "Build your team by slotting two capes, then lock actions before resolving rounds.",
    "Difficulty changes enemy rarity weighting and payout multipliers substantially.",
    "First clears by difficulty and boss clear each grant one-time progression artifacts.",
  ]),
  WORM03: Object.freeze([
    "Socket the Leviathan amulet using standard artifact workflow to start the fight.",
    "This is a persistent 2v1 boss state; losses can be retried without re-clearing node setup.",
    "Clear grants major rewards and unlocks cleanup progression.",
  ]),
  WORM04: Object.freeze([
    "Cleanup jobs use elevated rarity bands and enhanced enemy kits.",
    "Watch for Slaughterhouse encounters and remove members from the pool by defeating them.",
    "Node completion requires full roster elimination, not just repeated job wins.",
  ]),
  WORM05: Object.freeze([
    "Summon flow matches other artifact-gated Worm boss nodes.",
    "Simurgh pressure is disruption-heavy; plan for control and evasion swings.",
    "Clear grants a sigil required for late-chain unlocks.",
  ]),
  WORM06: Object.freeze([
    "National Cleanup opponents are all high rarity with layered enhancements.",
    "Regular jobs farm clout and loot, but completion hinges on the Triumvirate fight.",
    "Prepare a specialized team before triggering the 2v3 boss sequence.",
  ]),
  WORM07: Object.freeze([
    "Use Behemoth summoning flow to start this boss gate.",
    "Expect sustained heavy damage and defensive pressure windows.",
    "Victory awards the final sigil needed for the Scion gate.",
  ]),
  WORM08: Object.freeze([
    "You must socket all three Endbringer sigils before Scion can be challenged.",
    "This is the hardest Worm encounter; optimize both team composition and shard setup.",
    "Treat survivability and control as mandatory, not optional.",
  ]),

  MOL01: Object.freeze([
    "Sequence starts from Begin and always resets on the first mistake.",
    "Watch the full reveal before clicking; input order must be exact.",
    "Progression requires consecutive successful rounds, not cumulative total hits.",
  ]),
  MOL02: Object.freeze([
    "Choose a target region, confirm reset terms, then clear the sequence challenge.",
    "Different regions reset different systems and currencies; review cost before committing.",
    "Practical Guide reset clears role state and reopens role acquisition only.",
  ]),
  MOL03: Object.freeze([
    "Select a prestige region on the ring to open its upgrade modal.",
    "Spend prestige currency on upgrades that materially alter region scaling.",
    "Check prerequisites: some stronger upgrades unlock only after key milestones.",
  ]),

  AA01: Object.freeze([
    "This node establishes attunement and starter crystal flow for Arcane systems.",
    "Clear conditions are straightforward; focus on reading and completing required interactions.",
    "Your reward here unlocks smoother progression in AA02 and AA03.",
  ]),
  AA02: Object.freeze([
    "The tome consumes crystals and reveals glyphs in staged flashes.",
    "Watch each reveal fully; you are building the grimoire for later crafting.",
    "When pulls run dry, pivot to economy loops to refill crystal supply.",
  ]),
  AA03: Object.freeze([
    "Crafting is gated by region rune then enhancement rune, then valid mana input.",
    "Draw cleanly and distinctly; matcher picks nearest learned glyph signature.",
    "High quality crafts require both rune fidelity and meaningful mana investment.",
  ]),

  LOG01: Object.freeze([
    "Treat this as strict logical consistency: every gate condition must cohere.",
    "Do not assume examples are clues; validate each assignment from first principles.",
    "Completion grants the Lemma artifact used in Nexus progression.",
  ]),
  LOG02: Object.freeze([
    "Counterexample structure matters more than speed for this witness puzzle.",
    "Build one consistent model and test every clause against it.",
    "A valid witness should satisfy all required constraints simultaneously.",
  ]),
  LOG03: Object.freeze([
    "The staircase proof expects ordered dependencies, not isolated claims.",
    "Lock earlier statements before attempting higher inference steps.",
    "One misplaced inference can invalidate the full chain.",
  ]),
  LOG04: Object.freeze([
    "Modal transitions need careful necessity/possibility discipline.",
    "Track world assumptions explicitly as you move between panels.",
    "A clean modal frame prevents contradictory branches.",
  ]),
  LOG05: Object.freeze([
    "Self-reference traps are intentional; avoid circular justification loops.",
    "Check each statement against the system rule, not intuition.",
    "Consistency is the win condition, not maximal truth assignment.",
  ]),
  LOG06: Object.freeze([
    "This final proof node combines techniques from the prior logic set.",
    "Secure base claims first, then bridge with valid transformations.",
    "Treat each step as auditable; one broken edge blocks completion.",
  ]),

  NUM01: Object.freeze([
    "The dial puzzle is about modular alignment, not direct value copying.",
    "Verify each wheel relative to modulus behavior across the full set.",
    "A solved state should satisfy all residue constraints at once.",
  ]),
  NUM02: Object.freeze([
    "Prime factor structure controls lock behavior in this node.",
    "Start from guaranteed factors and eliminate impossible combinations.",
    "Check each chamber after every change to avoid hidden contradictions.",
  ]),
  NUM03: Object.freeze([
    "Think in congruence classes and intersection of constraints.",
    "The Chinese-style merge only works when each local condition is satisfied.",
    "Build from pairwise agreement before final global alignment.",
  ]),
  NUM04: Object.freeze([
    "Quadratic behavior here is discrete; test residues, not just arithmetic roots.",
    "Use parity and modulus shortcuts to prune invalid candidates quickly.",
    "Final solve requires all lantern checks to pass together.",
  ]),
  NUM05: Object.freeze([
    "This node is keyflow reasoning: relation between public and private transforms.",
    "Small arithmetic slips compound; verify each transform step.",
    "Treat every stage as a pipeline with explicit inputs/outputs.",
  ]),
  NUM06: Object.freeze([
    "Calendar-style remainder syncing is the core mechanic here.",
    "Work from most restrictive cycle first, then fit the others.",
    "A single mismatched remainder means the schedule is invalid.",
  ]),

  ALG01: Object.freeze([
    "Focus on operation properties before trying to brute-force placements.",
    "Closure and identity checks usually reveal wrong branches early.",
    "Treat each move as preserving the structure, not just symbols.",
  ]),
  ALG02: Object.freeze([
    "Permutation cycle behavior is the key lens for this dance puzzle.",
    "Track orbit lengths to predict legal transitions.",
    "Solve by stabilizing the full cycle decomposition.",
  ]),
  ALG03: Object.freeze([
    "Isomorphism demands structure-preserving correspondence, not label matching.",
    "Check operation tables side-by-side for invariant patterns.",
    "A true match must preserve all relevant relations globally.",
  ]),
  ALG04: Object.freeze([
    "Subgroup lattice placement depends on containment, not size alone.",
    "Build lower levels first to constrain upper placement.",
    "One wrong containment edge cascades into many bad links.",
  ]),
  ALG05: Object.freeze([
    "Ring morphisms must respect both addition and multiplication.",
    "Kernel/image reasoning is usually faster than direct brute force.",
    "Confirm map consistency across generators before final submission.",
  ]),
  ALG06: Object.freeze([
    "Group action framing is central: track stabilizers and orbits.",
    "The winning state balances action constraints across all targets.",
    "Reuse insights from earlier algebra nodes for final assembly.",
  ]),

  GEO01: Object.freeze([
    "Geodesics should follow intrinsic geometry, not Euclidean shortcuts.",
    "Use local tangent intuition to judge path plausibility.",
    "A valid route minimizes correctly within the surface constraints.",
  ]),
  GEO02: Object.freeze([
    "Transition maps must agree where chart domains overlap.",
    "Check coordinate conversion consistency in both directions.",
    "One mismatch on overlap means the atlas is not coherent.",
  ]),
  GEO03: Object.freeze([
    "Curvature defects appear where local transport accumulates drift.",
    "Compare loops, not single segments, to detect true defects.",
    "Solve by identifying where parallel transport disagrees.",
  ]),
  GEO04: Object.freeze([
    "Tangent transport requires preserving vector relationships along the route.",
    "Follow the indicated connection rule throughout the full path.",
    "Endpoint agreement is necessary but not sufficient; path behavior matters.",
  ]),
  GEO05: Object.freeze([
    "Field continuity and orientation constraints drive this garden puzzle.",
    "Use directional consistency to eliminate impossible placements quickly.",
    "The final state should produce a smooth global flow.",
  ]),
  GEO06: Object.freeze([
    "This capstone tests manifold-level coherence across prior geometry ideas.",
    "Audit local-to-global compatibility before locking final choices.",
    "If one patch fails, revisit chart and transport assumptions first.",
  ]),

  PGE01: Object.freeze([
    "There is no single victory route here; your choices shape your Role.",
    "Keep a consistent narrative posture instead of random optimization.",
    "Reset Role through MOL02 if you need a different path identity later.",
  ]),
  PGE02: Object.freeze([
    "Story pressure rewards coherent narrative framing over tactical greed.",
    "Wrong setup choices can look viable for several steps before collapse.",
    "Watch for hidden-role or artifact branches hinted by symbol presence.",
  ]),
  PGE03: Object.freeze([
    "Court outcomes hinge on precedent, leverage, and controlled reveals.",
    "Some successful endings are role-specific even when choices look similar.",
    "Build your line of story logic early to avoid delayed fail branches.",
  ]),
  PGE04: Object.freeze([
    "This tomb arc is about lawful claim structure and constrained escalation.",
    "Artifact gates unlock key pivots; missing one silently narrows outcomes.",
    "Choose a narrative throughline and keep decisions aligned with it.",
  ]),
  PGE05: Object.freeze([
    "Balance moral pressure and strategic necessity; overcommitment backfires.",
    "Multiple true wins exist, but each requires consistent story setup.",
    "Look for subtle cues that a branch now favors your current Role.",
  ]),
  PGE06: Object.freeze([
    "Late Guide arc rewards payoff of earlier narrative commitments.",
    "Do not assume every visible choice is equally salvageable long-term.",
    "Successful runs feel like completed stories, not isolated correct clicks.",
  ]),

  DCC01: Object.freeze([
    "Route rooms efficiently: stamina is for abilities, not movement.",
    "Out-of-run setup matters; in-run gear is locked once the crawl starts.",
    "Deeper floors scale rewards and danger, so bank value before greed pushes.",
  ]),

  FIN01: Object.freeze([
    "Only two artifacts hard-lock entry; the rest change phase difficulty and options.",
    "Progress is checkpointed by phase, so stabilize one phase before pushing next.",
    "Final synthesis requires correct grouping and ordering, not simple fill-all slotting.",
  ]),
});

export function deskHintsForNode(node) {
  const nodeId = String(node && node.node_id ? node.node_id : "");
  const override = DESK_HINT_OVERRIDES[nodeId];
  if (Array.isArray(override) && override.length) {
    return override.slice(0, 3);
  }
  return fallbackHintsForNode(node || {});
}
