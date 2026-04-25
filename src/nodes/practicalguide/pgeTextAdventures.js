import { escapeHtml } from "../../templates/shared.js";
import { renderArtifactSymbol } from "../../core/artifacts.js";
import {
  activePracticalGuideRoleFromState,
  normalizePracticalGuideRoleArtifact,
  practicalGuideRoleArtifacts,
} from "../../systems/practicalGuide.js";

const ROLE_ARTIFACTS = Object.freeze(practicalGuideRoleArtifacts());
const EMPTY_ROLE_SCORES = Object.freeze(
  Object.fromEntries(ROLE_ARTIFACTS.map((role) => [role, 0])),
);

function scene(id, text, choices) {
  return {
    id,
    type: "decision",
    text,
    choices,
  };
}

function winScene(id, text, requiresArtifacts = [], requiresRole = [], rewardArtifact = "") {
  return {
    id,
    type: "terminal",
    terminal: "win",
    text,
    requiresArtifacts,
    requiresRole,
    rewardArtifact: String(rewardArtifact || ""),
  };
}

function failScene(id, text, requiresArtifacts = [], requiresRole = [], requiresFlags = []) {
  return {
    id,
    type: "terminal",
    terminal: "fail",
    text,
    requiresArtifacts,
    requiresRole,
    requiresFlags,
  };
}

function adjudicationScene(id, text) {
  return {
    id,
    type: "terminal",
    terminal: "adjudication",
    text,
  };
}

const PGE_STORIES = Object.freeze({
  PGE01: {
    nodeId: "PGE01",
    title: "Claimant's Knife",
    subtitle: "No perfect ending. The story is measuring which Name fits your choices.",
    startSceneId: "PGE01-S1",
    devArtifacts: Object.freeze([]),
    scenes: Object.freeze([
      scene("PGE01-S1", "At Ash Ford, soldiers drag refugees from a burning cart and demand a champion.", [
        {
          id: "s1-stand",
          text: "Step forward and challenge their captain in front of everyone.",
          next: "PGE01-S2",
          roleScore: { Squire: 2, Captain: 1, "Black Knight": 1 },
          setFlags: ["open_challenge"],
        },
        {
          id: "s1-ridge",
          text: "Climb the ridge and mark officers before anyone notices.",
          next: "PGE01-S2",
          roleScore: { Archer: 2, Ranger: 1, Thief: 1 },
          setFlags: ["high_ground"],
        },
        {
          id: "s1-omen",
          text: "Whisper to the village priest that this must become a three-beat omen.",
          next: "PGE01-S2",
          roleScore: { Hierophant: 2, Bard: 1, Warlock: 1 },
          setFlags: ["omen_seeded"],
        },
      ]),
      scene("PGE01-S2", "The skirmish ends, and both survivors and mercenaries look to you for a story to follow.", [
        {
          id: "s2-command",
          text: "Take command, assign watches, and name a clear chain of order.",
          next: "PGE01-S3",
          roleScore: { Captain: 2, Warden: 1, Squire: 1 },
          setFlags: ["order"],
        },
        {
          id: "s2-proxy",
          text: "Put a decoy leader in front while you move unseen.",
          next: "PGE01-S3",
          roleScore: { Thief: 2, Bard: 1, Ranger: 1 },
          setFlags: ["proxy"],
        },
        {
          id: "s2-vow",
          text: "Swear a binding vow before witnesses and force both sides to answer it.",
          next: "PGE01-S3",
          roleScore: { Hierophant: 2, Squire: 1, Warden: 1 },
          setFlags: ["vow"],
        },
      ]),
      scene("PGE01-S3", "A broken bridge blocks retreat while enemy banners gather on the far bank.", [
        {
          id: "s3-hold",
          text: "Hold the near side and make the bridge your first stand.",
          next: "PGE01-S4",
          roleScore: { Warden: 2, Squire: 1, "Black Knight": 1 },
          setFlags: ["chokepoint"],
        },
        {
          id: "s3-flank",
          text: "Take a narrow deer path and threaten them from the flank.",
          next: "PGE01-S4",
          roleScore: { Ranger: 2, Archer: 1, Thief: 1 },
          setFlags: ["flank"],
        },
        {
          id: "s3-ash",
          text: "Carve runes into the ropes and burn the crossing behind you.",
          next: "PGE01-S4",
          roleScore: { Warlock: 2, "Black Knight": 1, Thief: 1 },
          setFlags: ["burned_bridge"],
        },
      ]),
      scene("PGE01-S4", "Night camp turns uneasy as rumors spread that the dead are counting your choices.", [
        {
          id: "s4-watch",
          text: "Double watches and punish anyone who breaks rotation.",
          next: "PGE01-S5",
          roleScore: { Captain: 2, Warden: 1, "Black Knight": 1 },
          setFlags: ["discipline"],
        },
        {
          id: "s4-tale",
          text: "Tell a careful tale that casts tomorrow as the second beat.",
          next: "PGE01-S5",
          roleScore: { Bard: 2, Hierophant: 1, Squire: 1 },
          setFlags: ["second_beat_named"],
        },
        {
          id: "s4-scout",
          text: "Slip out alone and map every fire and sentry post.",
          next: "PGE01-S5",
          roleScore: { Ranger: 2, Archer: 1, Thief: 1 },
          setFlags: ["mapped_camp"],
        },
      ]),
      scene("PGE01-S5", "At dawn, a sealed waystone asks who has authority to pass and who has right to take.", [
        {
          id: "s5-rite",
          text: "Knock three times and invoke old treaty law.",
          next: "PGE01-S6",
          roleScore: { Hierophant: 2, Bard: 1, Captain: 1 },
          setFlags: ["ritual_entry"],
        },
        {
          id: "s5-pick",
          text: "Open it quietly and leave no trace behind.",
          next: "PGE01-S6",
          roleScore: { Thief: 2, Ranger: 1, Archer: 1 },
          setFlags: ["silent_entry"],
        },
        {
          id: "s5-force",
          text: "Break the sigil and take the path by strength.",
          next: "PGE01-S6",
          roleScore: { "Black Knight": 2, Warlock: 1, Squire: 1 },
          setFlags: ["forced_entry"],
        },
      ]),
      scene("PGE01-S6", "A black plain opens ahead, with your followers waiting to see whether you walk first or send others.", [
        {
          id: "s6-lead",
          text: "Lead from the front and keep the line tight.",
          next: "PGE01-S7",
          roleScore: { Squire: 2, Captain: 1, Warden: 1 },
          setFlags: ["frontline"],
        },
        {
          id: "s6-screen",
          text: "Spread skirmishers and let speed decide where you strike.",
          next: "PGE01-S7",
          roleScore: { Ranger: 2, Archer: 1, Thief: 1 },
          setFlags: ["skirmish_line"],
        },
        {
          id: "s6-anchor",
          text: "Set a hard center and dare them to break on you.",
          next: "PGE01-S7",
          roleScore: { "Black Knight": 2, Warden: 1, Captain: 1 },
          setFlags: ["anvil_center"],
        },
      ]),
      scene("PGE01-S7", "A mirrored oath appears: keep your promise as spoken, rewrite it, or abandon it.", [
        {
          id: "s7-keep",
          text: "Keep the oath exactly and pay the full cost.",
          next: "PGE01-S8",
          roleScore: { Squire: 2, Hierophant: 1, Warden: 1 },
          setFlags: ["oath_kept"],
        },
        {
          id: "s7-rewrite",
          text: "Rewrite the oath to trap your enemy in your wording.",
          next: "PGE01-S8",
          roleScore: { Warlock: 2, Bard: 1, Thief: 1 },
          setFlags: ["oath_rewritten"],
        },
        {
          id: "s7-abandon",
          text: "Abandon the oath and survive by motion and distance.",
          next: "PGE01-S8",
          roleScore: { Ranger: 2, Archer: 1, Thief: 1 },
          setFlags: ["oath_abandoned"],
        },
      ]),
      scene("PGE01-S8", "A ruined standard hangs over a field of old bones. Everyone waits to see what symbol you raise.", [
        {
          id: "s8-raise",
          text: "Raise the standard and demand people rally behind it.",
          next: "PGE01-S9",
          roleScore: { Captain: 2, Squire: 1, Bard: 1 },
          setFlags: ["banner_raised"],
        },
        {
          id: "s8-bury",
          text: "Bury the standard and make defense the only promise.",
          next: "PGE01-S9",
          roleScore: { Warden: 2, "Black Knight": 1, Hierophant: 1 },
          setFlags: ["banner_buried"],
        },
        {
          id: "s8-steal",
          text: "Steal the enemy colors and use their story against them.",
          next: "PGE01-S9",
          roleScore: { Thief: 2, Bard: 1, Warlock: 1 },
          setFlags: ["colors_stolen"],
        },
      ]),
      scene("PGE01-S9", "Before dawn, scouts report three possible threats and only one force you can personally answer.", [
        {
          id: "s9-gate",
          text: "Count gate posts and build a denial line.",
          next: "PGE01-S10",
          roleScore: { Warden: 2, Captain: 1, Squire: 1 },
          setFlags: ["gate_math"],
        },
        {
          id: "s9-shot",
          text: "Count wind shifts and set one impossible shot.",
          next: "PGE01-S10",
          roleScore: { Archer: 2, Ranger: 1, Thief: 1 },
          setFlags: ["wind_math"],
        },
        {
          id: "s9-names",
          text: "Count which names matter and cut the rest from the tale.",
          next: "PGE01-S10",
          roleScore: { Bard: 2, Hierophant: 1, Warlock: 1 },
          setFlags: ["name_math"],
        },
      ]),
      scene("PGE01-S10", "At the cairn of old claimants, the final turn asks what shape your authority takes.", [
        {
          id: "s10-oath",
          text: "Authority by sworn burden.",
          next: "PGE01-ADJ",
          roleScore: { Squire: 2, Hierophant: 1, Warden: 1 },
          setFlags: ["final_oath"],
        },
        {
          id: "s10-iron",
          text: "Authority by fear, steel, and refusal.",
          next: "PGE01-ADJ",
          roleScore: { "Black Knight": 2, Captain: 1, Warlock: 1 },
          setFlags: ["final_iron"],
        },
        {
          id: "s10-road",
          text: "Authority by movement, reach, and selection.",
          next: "PGE01-ADJ",
          roleScore: { Ranger: 2, Archer: 1, Thief: 1 },
          setFlags: ["final_road"],
        },
      ]),
      adjudicationScene("PGE01-ADJ", "The pattern closes. Your Role is chosen from what you repeatedly made true."),
    ]),
  },
  PGE02: {
    nodeId: "PGE02",
    title: "Siege of the Last Gate",
    subtitle: "Westwall drowns in rain while claimants try to force the ending.",
    startSceneId: "PGE02-01",
    devArtifacts: Object.freeze(["Westwall Ram", "Oathbreaker Bell", "Sunforge Powder"]),
    scenes: Object.freeze([
      scene("PGE02-01", "Night rain on Westwall. Three breaches open at once, and everyone waits to see which tale you declare first.", [
        {
          id: "p2-1-threefold",
          text: "Declare a Rule of Three defense.",
          requiresRole: ["Captain", "Squire", "Warden"],
          setFlags: ["frame_threefold", "beat1_lost"],
          next: "PGE02-02A",
        },
        {
          id: "p2-1-villain",
          text: "Crown yourself the villain.",
          requiresRole: ["Black Knight", "Bard", "Warlock"],
          setFlags: ["frame_villain"],
          next: "PGE02-02B",
        },
        {
          id: "p2-1-culvert",
          text: "Commit to culvert extraction.",
          requiresRole: ["Thief", "Ranger"],
          setFlags: ["frame_culvert"],
          next: "PGE02-02C",
        },
        {
          id: "p2-1-panic",
          text: "Spread everyone thin across all three breaches.",
          setFlags: ["frame_panic"],
          next: "PGE02-02D",
        },
      ]),
      scene("PGE02-02A", "You publicly concede the outer yard as your first beat and force witnesses to mark it.", [
        {
          id: "p2-2a-ram",
          text: "Drag the Westwall Ram to the second gate and swear this line will hold.",
          requiresArtifacts: ["Westwall Ram"],
          setFlags: ["ram_center", "witness_line"],
          next: "PGE02-03A",
        },
        {
          id: "p2-2a-bell",
          text: "Ring the Oathbreaker Bell and call every deserter back to the second line.",
          requiresArtifacts: ["Oathbreaker Bell"],
          setFlags: ["witness_line", "bell_brand"],
          next: "PGE02-03A",
        },
        {
          id: "p2-2a-feint",
          text: "Pretend to break and seed a false rush lane.",
          setFlags: ["false_lane"],
          next: "PGE02-03A",
        },
      ]),
      scene("PGE02-02B", "You let rumors paint you monstrous while rival officers step forward to oppose you.", [
        {
          id: "p2-2b-crown",
          text: "Lean into it, crown yourself in torchlight, and bait a hero charge.",
          setFlags: ["villain_crowned", "witness_line"],
          next: "PGE02-03B",
        },
        {
          id: "p2-2b-bell",
          text: "Ring the Oathbreaker Bell as an execution signal to force a claimant reveal.",
          requiresArtifacts: ["Oathbreaker Bell"],
          setFlags: ["bell_brand", "claimant_hunt"],
          next: "PGE02-03B",
        },
        {
          id: "p2-2b-underplay",
          text: "Stay subtle and hope the claimant reveals naturally.",
          setFlags: ["soft_play"],
          next: "PGE02-03B",
        },
      ]),
      scene("PGE02-02C", "You map servant tunnels while the public fight keeps all eyes on the battlements.", [
        {
          id: "p2-2c-mark",
          text: "Plant runners and mark the lord's route toward the culvert.",
          setFlags: ["lord_marked", "route_seeded"],
          next: "PGE02-03C",
        },
        {
          id: "p2-2c-powder",
          text: "Stage Sunforge Powder caches to fake a final stand upstairs.",
          requiresArtifacts: ["Sunforge Powder"],
          setFlags: ["powder_decoy", "route_seeded"],
          next: "PGE02-03C",
        },
        {
          id: "p2-2c-shortcut",
          text: "Take an unknown drain and pray it reaches open water.",
          setFlags: ["blind_route"],
          next: "PGE02-03C",
        },
      ]),
      scene("PGE02-02D", "The defense splinters into shouting captains. You still have time to pick a pattern before collapse.", [
        {
          id: "p2-2d-salvage-three",
          text: "Impose a late Rule of Three and force everyone into a second line.",
          requiresRole: ["Captain", "Warden", "Squire"],
          setFlags: ["frame_threefold", "late_salvage"],
          next: "PGE02-03A",
        },
        {
          id: "p2-2d-salvage-villain",
          text: "Take blame publicly and bait a single challenger.",
          requiresRole: ["Black Knight", "Bard", "Warlock"],
          setFlags: ["frame_villain", "late_salvage"],
          next: "PGE02-03B",
        },
        {
          id: "p2-2d-salvage-culvert",
          text: "Abandon wall command and pivot to extraction.",
          requiresRole: ["Thief", "Ranger"],
          setFlags: ["frame_culvert", "late_salvage"],
          next: "PGE02-03C",
        },
      ]),
      scene("PGE02-03A", "Second beat: enemy elites hit the inner stair and demand a duel under witness law.", [
        {
          id: "p2-3a-accept",
          text: "Accept, lose ground by inches, and preserve the pattern.",
          setFlags: ["beat2_set", "duel_witnessed"],
          next: "PGE02-04",
        },
        {
          id: "p2-3a-powder",
          text: "Detonate Sunforge Powder behind your own line to force a clean reset.",
          requiresArtifacts: ["Sunforge Powder"],
          setFlags: ["beat2_set", "smoke_reset"],
          next: "PGE02-04",
        },
        {
          id: "p2-3a-break",
          text: "Refuse witness law and go for a full rout now.",
          setFlags: ["pattern_broken"],
          next: "PGE02-04",
        },
      ]),
      scene("PGE02-03B", "A self-styled Hero answers your provocation and calls for a single deciding clash.", [
        {
          id: "p2-3b-stage",
          text: "Stage your own betrayal so the Hero commits too deep.",
          setFlags: ["betrayal_lure", "duel_witnessed"],
          next: "PGE02-04",
        },
        {
          id: "p2-3b-bell",
          text: "Use the Oathbreaker Bell to force every oathsworn into the same killbox.",
          requiresArtifacts: ["Oathbreaker Bell"],
          setFlags: ["bell_brand", "killbox_ready"],
          next: "PGE02-04",
        },
        {
          id: "p2-3b-fair",
          text: "Fight honorably and trust skill over narrative pressure.",
          setFlags: ["fair_duel"],
          next: "PGE02-04",
        },
      ]),
      scene("PGE02-03C", "The culvert route is half-collapsed and civilians are clogging the only dry passage.", [
        {
          id: "p2-3c-open",
          text: "Use the Westwall Ram to punch open the collapsed side channel.",
          requiresArtifacts: ["Westwall Ram"],
          setFlags: ["tunnel_open", "exfil_ready"],
          next: "PGE02-04",
        },
        {
          id: "p2-3c-powder",
          text: "Flash Sunforge Powder topside to draw every pursuer upward.",
          requiresArtifacts: ["Sunforge Powder"],
          setFlags: ["powder_decoy", "exfil_ready"],
          next: "PGE02-04",
        },
        {
          id: "p2-3c-abandon",
          text: "Drop baggage and scatter through side cracks.",
          setFlags: ["scattered_exfil"],
          next: "PGE02-04",
        },
      ]),
      scene("PGE02-04", "Midnight to dawn: the story is now committed. You need one decisive turn that matches your frame.", [
        {
          id: "p2-4-three",
          text: "Call out that this is the third beat and make everyone witness it.",
          requiresFlags: ["frame_threefold", "beat2_set"],
          setFlags: ["beat3_called"],
          next: "PGE02-04B",
        },
        {
          id: "p2-4-villain",
          text: "Let the Hero strike first, then pivot the crowd against them.",
          requiresFlags: ["frame_villain", "betrayal_lure"],
          setFlags: ["reversal_ready"],
          next: "PGE02-04B",
        },
        {
          id: "p2-4-culvert",
          text: "Cut lights and move the marked lord through the wet passage now.",
          requiresFlags: ["frame_culvert", "exfil_ready", "lord_marked"],
          setFlags: ["lord_moving"],
          next: "PGE02-04B",
        },
        {
          id: "p2-4-countersign",
          text: "Write a countersign order and require every captain to repeat it under witness.",
          requiresRole: ["Captain", "Hierophant", "Warden"],
          setFlags: ["command_countersign", "witness_line"],
          next: "PGE02-04B",
        },
        {
          id: "p2-4-noise",
          text: "Call for every reserve at once and hope momentum is enough.",
          setFlags: ["noise_plan"],
          next: "PGE02-04B",
        },
      ]),
      scene("PGE02-04B", "Courtyard clocks run unevenly. You can force one tempo before reserves commit.", [
        {
          id: "p2-4b-drum",
          text: "Signal a fixed drum cadence and pin every push to counted beats.",
          requiresFlags: ["command_countersign"],
          setFlags: ["tempo_fixed"],
          next: "PGE02-05",
        },
        {
          id: "p2-4b-bait",
          text: "Leave one breach visibly weak and load it with hidden spears.",
          requiresFlags: ["reversal_ready"],
          setFlags: ["honeytrap_breach"],
          next: "PGE02-05",
        },
        {
          id: "p2-4b-ferry",
          text: "Move noncombatants first and preserve lane discipline through the culvert.",
          requiresFlags: ["lord_moving"],
          setFlags: ["ferry_order"],
          next: "PGE02-05",
        },
        {
          id: "p2-4b-scatter",
          text: "Abandon synchronized timing and let each stair command itself.",
          setFlags: ["tempo_lost"],
          next: "PGE02-05",
        },
      ]),
      scene("PGE02-05", "A steward asks what your win condition is before committing the last reserves.", [
        {
          id: "p2-5-hold",
          text: "Win is survival until first light over the inner gate.",
          requiresFlags: ["beat3_called", "witness_line"],
          setFlags: ["win_hold"],
          next: "PGE02-06",
        },
        {
          id: "p2-5-turn",
          text: "Win is the claimant overextending into your staged villain trap.",
          requiresFlags: ["reversal_ready", "duel_witnessed"],
          setFlags: ["win_reversal"],
          next: "PGE02-06",
        },
        {
          id: "p2-5-slip",
          text: "Win is extracting the lord with enough witnesses to keep legitimacy.",
          requiresFlags: ["lord_moving"],
          setFlags: ["win_exfil"],
          next: "PGE02-06",
        },
        {
          id: "p2-5-bleed",
          text: "Win is killing as many as possible before collapse.",
          setFlags: ["pyrrhic"],
          next: "PGE02-06",
        },
      ]),
      scene("PGE02-06", "The enemy finally commits their reserve. You get one final lever.", [
        {
          id: "p2-6-ram",
          text: "Brace the last gate with the Westwall Ram.",
          requiresArtifacts: ["Westwall Ram"],
          setFlags: ["last_gate_braced"],
          next: "PGE02-06B",
        },
        {
          id: "p2-6-bell",
          text: "Ring the Oathbreaker Bell to trigger oath panic and break command cohesion.",
          requiresArtifacts: ["Oathbreaker Bell"],
          setFlags: ["oath_panic"],
          next: "PGE02-06B",
        },
        {
          id: "p2-6-powder",
          text: "Prime Sunforge Powder as a last-resort turn, not a first strike.",
          requiresArtifacts: ["Sunforge Powder"],
          setFlags: ["powder_turn"],
          next: "PGE02-06B",
        },
        {
          id: "p2-6-nothing",
          text: "Spend nothing and trust pure combat.",
          setFlags: ["no_lever"],
          next: "PGE02-06B",
        },
      ]),
      scene("PGE02-06B", "The claimant line wavers. You can press one narrative interpretation before witnesses fix it forever.", [
        {
          id: "p2-6b-herald",
          text: "Name your own herald and have them repeat your win condition to every stair.",
          requiresRole: ["Bard", "Captain", "Hierophant"],
          setFlags: ["narrative_locked"],
          next: "PGE02-07",
        },
        {
          id: "p2-6b-surge",
          text: "Use the tempo break to surge two gates and gamble on shock.",
          requiresFlags: ["tempo_fixed"],
          setFlags: ["surge_timed"],
          next: "PGE02-07",
        },
        {
          id: "p2-6b-shadow",
          text: "Fade command presence and let rival officers take visible credit.",
          setFlags: ["credit_blurred"],
          next: "PGE02-07",
        },
        {
          id: "p2-6b-noise",
          text: "Keep shouting contradictory orders and ride momentum.",
          setFlags: ["record_fractured"],
          next: "PGE02-07",
        },
      ]),
      scene("PGE02-07", "Witnesses from all three factions gather on the stair to judge whose claim will survive dawn.", [
        {
          id: "p2-7-legal",
          text: "Force every move in public under witness law.",
          setFlags: ["public_record"],
          next: "PGE02-08",
        },
        {
          id: "p2-7-smoke",
          text: "Drop smoke and disappear from all accountability.",
          setFlags: ["lost_record"],
          next: "PGE02-08",
        },
        {
          id: "p2-7-split",
          text: "Split witnesses so each side remembers a different truth.",
          requiresRole: ["Bard", "Warlock", "Thief"],
          setFlags: ["split_record"],
          next: "PGE02-08",
        },
      ]),
      scene("PGE02-08", "The rival claimant appears for the final turn with a hero speech already in progress.", [
        {
          id: "p2-8-answer-three",
          text: "Answer with 'first loss, second hold, third break' and force the pattern closed.",
          requiresFlags: ["win_hold", "last_gate_braced", "public_record", "narrative_locked"],
          setFlags: ["threefold_closed"],
          next: "PGE02-09",
        },
        {
          id: "p2-8-answer-villain",
          text: "Play the monster one beat longer, then reveal the staged betrayal.",
          requiresFlags: ["win_reversal", "oath_panic"],
          setFlags: ["villain_flip"],
          next: "PGE02-09",
        },
        {
          id: "p2-8-answer-culvert",
          text: "Signal the culvert team and keep the claimant occupied with a false duel.",
          requiresFlags: ["win_exfil", "powder_turn"],
          setFlags: ["culvert_slip"],
          next: "PGE02-09",
        },
        {
          id: "p2-8-answer-chaos",
          text: "Charge and break formation to decide it by force alone.",
          setFlags: ["chaos_end"],
          next: "PGE02-09",
        },
        {
          id: "p2-8-answer-forked",
          text: "Use split witness accounts to produce two incompatible but survivable endings.",
          requiresFlags: ["split_record", "credit_blurred"],
          setFlags: ["forked_truth"],
          next: "PGE02-09",
        },
      ]),
      scene("PGE02-09", "Dawn edge. One declaration remains before the field freezes into history.", [
        {
          id: "p2-9-fortress",
          text: "The gate stands; the siege loses its claim.",
          requiresFlags: ["threefold_closed"],
          next: "PGE02-W1",
        },
        {
          id: "p2-9-crownfall",
          text: "The claimant overreaches; villain narrative inverts and breaks them.",
          requiresFlags: ["villain_flip", "public_record"],
          next: "PGE02-W2",
        },
        {
          id: "p2-9-river",
          text: "The lord escapes through the culvert and legitimacy leaves with them.",
          requiresFlags: ["culvert_slip", "route_seeded"],
          next: "PGE02-W3",
        },
        {
          id: "p2-9-disaster",
          text: "Everyone claims victory at once and the keep burns for it.",
          requiresFlags: ["chaos_end"],
          next: "PGE02-L1",
        },
        {
          id: "p2-9-hollow",
          text: "The field goes silent. No witness accepts your version of events.",
          requiresFlags: ["lost_record"],
          next: "PGE02-L2",
        },
        {
          id: "p2-9-fracture",
          text: "The keep survives, but your command fractures into feuding claims.",
          requiresFlags: ["forked_truth"],
          next: "PGE02-L3",
        },
      ]),
      scene("PGE02-MISS-path", "You call for a turn your own setup cannot support. The officers hear the break in your story and hesitate at once.", [
        {
          id: "p2-miss-path-a",
          text: "Force the order through anyway.",
          next: "PGE02-MISS-ending",
        },
        {
          id: "p2-miss-path-b",
          text: "Try to rewrite the frame mid-turn.",
          next: "PGE02-MISS-ending",
        },
      ]),
      failScene("PGE02-MISS-ending", "The thread snaps under witness. Westwall's line folds before dawn."),
      winScene("PGE02-W1", "Third beat lands exactly on dawn. The siege breaks because the story says it must.", ["Westwall Ram"], [], "Underlord Revelation I"),
      winScene("PGE02-W2", "You wore the villain mask until the claimant stepped into your ending.", ["Oathbreaker Bell", "Sunforge Powder"], [], "Underlord Revelation II"),
      winScene("PGE02-W3", "The wall was always a decoy. The true victory left through dark water.", ["Sunforge Powder", "Westwall Ram"], [], "Underlord Revelation Cipher"),
      failScene("PGE02-L1", "Sunforge fire runs through dry beams. The keep becomes a cautionary tale."),
      failScene("PGE02-L2", "Without witnesses, your truth dies before the dead are counted."),
      failScene("PGE02-L3", "Two official versions survive. The war pauses, but your authority does not."),
    ]),
  },
  PGE03: {
    nodeId: "PGE03",
    title: "Winter Court Knife-Game",
    subtitle: "Court stories are duels in slow motion: reveal, claim, and seal.",
    startSceneId: "PGE03-01",
    devArtifacts: Object.freeze(["Mirror of Nine Lies", "Green Wax Seal", "Veiled Signet"]),
    scenes: Object.freeze([
      scene("PGE03-01", "Frost court opens with three simultaneous performances: legal petition, masked gossip, and gallery duel.", [
        {
          id: "p3-1-gallery",
          text: "Take the gallery and build an Archer line of sight before anyone notices.",
          requiresRole: ["Archer", "Ranger"],
          setFlags: ["frame_archer", "high_line"],
          next: "PGE03-02A",
        },
        {
          id: "p3-1-ledger",
          text: "Enter by law: petition desk, witness log, and succession ledgers.",
          requiresArtifacts: ["Green Wax Seal"],
          setFlags: ["frame_legal", "ledger_open"],
          next: "PGE03-02B",
        },
        {
          id: "p3-1-masks",
          text: "Enter through mask circles and trade rumor debt for leverage.",
          requiresRole: ["Bard", "Thief"],
          setFlags: ["frame_rumor", "network_open"],
          next: "PGE03-02C",
        },
        {
          id: "p3-1-late",
          text: "Wait and react to the loudest faction.",
          setFlags: ["frame_reactive"],
          next: "PGE03-02D",
        },
      ]),
      scene("PGE03-02A", "From the gallery you can map bell rope, throne dais, and usurper escort in one sweep.", [
        {
          id: "p3-2a-mark",
          text: "Mark the usurper's seal hand for a precision break shot.",
          requiresRole: ["Archer"],
          setFlags: ["mark_hand", "sightline"],
          next: "PGE03-03",
        },
        {
          id: "p3-2a-mirror",
          text: "Use Mirror of Nine Lies to identify the decoy body-double.",
          requiresArtifacts: ["Mirror of Nine Lies"],
          setFlags: ["decoy_revealed", "sightline"],
          next: "PGE03-03",
        },
        {
          id: "p3-2a-rumor",
          text: "Signal mask-runners to seed panic below before your shot.",
          requiresRole: ["Bard", "Thief"],
          setFlags: ["panic_seeded", "sightline"],
          next: "PGE03-03",
        },
      ]),
      scene("PGE03-02B", "The petition chamber is stacked with forged claims and one authentic succession chain.", [
        {
          id: "p3-2b-proof",
          text: "Anchor your petition with Green Wax Seal and demand witness countersigns.",
          requiresArtifacts: ["Green Wax Seal"],
          setFlags: ["legal_weight", "witness_chain"],
          next: "PGE03-03",
        },
        {
          id: "p3-2b-signet",
          text: "Use Veiled Signet to force access to private testimony.",
          requiresArtifacts: ["Veiled Signet"],
          setFlags: ["private_access", "witness_chain"],
          next: "PGE03-03",
        },
        {
          id: "p3-2b-quiet",
          text: "Copy ledgers quietly and hope exposure later is enough.",
          setFlags: ["cold_evidence"],
          next: "PGE03-03",
        },
      ]),
      scene("PGE03-02C", "Mask circles offer three favors for one future betrayal each.", [
        {
          id: "p3-2c-trade",
          text: "Trade a future debt for escort access and stage-manage entrances.",
          setFlags: ["escort_access", "debt_taken"],
          next: "PGE03-03",
        },
        {
          id: "p3-2c-steal",
          text: "Steal a signet impression and forge a temporary route.",
          requiresRole: ["Thief"],
          setFlags: ["forged_route", "debt_taken"],
          next: "PGE03-03",
        },
        {
          id: "p3-2c-ballad",
          text: "Compose a three-verse accusation and prep the room to echo it.",
          requiresRole: ["Bard"],
          setFlags: ["three_verses", "crowd_hooked"],
          next: "PGE03-03",
        },
      ]),
      scene("PGE03-02D", "By reacting late, you inherit everyone else's framing and none of your own.", [
        {
          id: "p3-2d-salvage-archer",
          text: "Rush the gallery and improvise an Archer lane.",
          requiresRole: ["Archer"],
          setFlags: ["frame_archer", "late_start"],
          next: "PGE03-03",
        },
        {
          id: "p3-2d-salvage-legal",
          text: "Grab the legal desk and demand immediate witness law.",
          requiresArtifacts: ["Green Wax Seal"],
          setFlags: ["frame_legal", "late_start"],
          next: "PGE03-03",
        },
        {
          id: "p3-2d-salvage-rumor",
          text: "Let masks carry your claim while you stay deniable.",
          requiresRole: ["Bard", "Thief"],
          setFlags: ["frame_rumor", "late_start"],
          next: "PGE03-03",
        },
      ]),
      scene("PGE03-03", "First verdict call: the usurper demands immediate arrest powers.", [
        {
          id: "p3-3-bell",
          text: "Cut the arrest bell rope and buy one unscripted beat.",
          requiresRole: ["Archer"],
          requiresFlags: ["sightline"],
          setFlags: ["bell_cut"],
          next: "PGE03-04",
        },
        {
          id: "p3-3-seal",
          text: "Counter-file with Green Wax Seal and force procedural delay.",
          requiresArtifacts: ["Green Wax Seal"],
          setFlags: ["procedure_lock"],
          next: "PGE03-04",
        },
        {
          id: "p3-3-mirror",
          text: "Expose one major lie publicly with the Mirror of Nine Lies.",
          requiresArtifacts: ["Mirror of Nine Lies"],
          setFlags: ["lie_exposed"],
          next: "PGE03-04",
        },
        {
          id: "p3-3-hide",
          text: "Disappear into side galleries and wait for chaos.",
          setFlags: ["offstage"],
          next: "PGE03-04",
        },
      ]),
      scene("PGE03-04", "Second verdict call: factions split. You must define what counts as truth in this room.", [
        {
          id: "p3-4-archer",
          text: "Name a single target and force the room to watch your line of fire.",
          requiresRole: ["Archer"],
          requiresFlags: ["mark_hand"],
          setFlags: ["single_target"],
          next: "PGE03-04B",
        },
        {
          id: "p3-4-triad",
          text: "Bind Mirror, Seal, and Signet into one chain of admissible proof.",
          requiresArtifacts: ["Mirror of Nine Lies", "Green Wax Seal", "Veiled Signet"],
          setFlags: ["triad_proof"],
          next: "PGE03-04B",
        },
        {
          id: "p3-4-ballad",
          text: "Deliver a three-verse accusation where each verse names one witness.",
          requiresFlags: ["three_verses", "crowd_hooked"],
          setFlags: ["verse_complete"],
          next: "PGE03-04B",
        },
        {
          id: "p3-4-committee",
          text: "Demand a rotating witness committee and lock every claim to signatures.",
          requiresRole: ["Captain", "Hierophant", "Warden"],
          setFlags: ["committee_formed", "witness_chain"],
          next: "PGE03-04B",
        },
        {
          id: "p3-4-fumble",
          text: "Argue from memory with no anchor.",
          setFlags: ["credibility_thin"],
          next: "PGE03-04B",
        },
      ]),
      scene("PGE03-04B", "The chamber splinters into side negotiations. You can still choose what form closure takes.", [
        {
          id: "p3-4b-lock-ledger",
          text: "Close side doors and force every side bargain into the public ledger.",
          requiresFlags: ["committee_formed"],
          setFlags: ["side_deals_public"],
          next: "PGE03-05",
        },
        {
          id: "p3-4b-mask-wave",
          text: "Let mask circles spread one rumor wave, then abruptly reveal your receipts.",
          requiresFlags: ["network_open"],
          setFlags: ["rumor_timing"],
          next: "PGE03-05",
        },
        {
          id: "p3-4b-iron-quiet",
          text: "Station steel at exits and prevent anyone from leaving before verdict.",
          requiresRole: ["Black Knight", "Warden"],
          setFlags: ["chamber_sealed"],
          next: "PGE03-05",
        },
        {
          id: "p3-4b-fray",
          text: "Let the side halls run wild and trust instinct.",
          setFlags: ["verdict_frayed"],
          next: "PGE03-05",
        },
      ]),
      scene("PGE03-05", "Third verdict call: the chamberlain asks for a final mechanism.", [
        {
          id: "p3-5-shot",
          text: "Mechanism is force: break the usurper's seal hand and collapse command.",
          requiresRole: ["Archer"],
          requiresFlags: ["single_target", "bell_cut"],
          setFlags: ["archer_finish_ready"],
          next: "PGE03-06",
        },
        {
          id: "p3-5-law",
          text: "Mechanism is law: succession chain with triad proof and witness chain.",
          requiresFlags: ["triad_proof", "side_deals_public"],
          setFlags: ["legal_finish_ready"],
          next: "PGE03-06",
        },
        {
          id: "p3-5-rumor",
          text: "Mechanism is narrative: turn the crowd before steel is drawn.",
          requiresFlags: ["verse_complete", "network_open", "rumor_timing"],
          setFlags: ["rumor_finish_ready"],
          next: "PGE03-06",
        },
        {
          id: "p3-5-committee",
          text: "Mechanism is majority witness ruling from the emergency committee.",
          requiresFlags: ["committee_formed"],
          setFlags: ["committee_finish_ready"],
          next: "PGE03-06",
        },
        {
          id: "p3-5-chaos",
          text: "Mechanism is panic: whoever runs first loses least.",
          setFlags: ["panic_finish"],
          next: "PGE03-06",
        },
      ]),
      scene("PGE03-06", "The throne dais opens. One last declaration determines whose story survives winter.", [
        {
          id: "p3-6-w1",
          text: "Loose the prepared Archer shot and end the usurper in one visible beat.",
          requiresRole: ["Archer"],
          requiresArtifacts: ["Mirror of Nine Lies"],
          requiresFlags: ["archer_finish_ready"],
          next: "PGE03-W1",
        },
        {
          id: "p3-6-w2",
          text: "Seal succession with Mirror, Green Wax Seal, and Veiled Signet together.",
          requiresArtifacts: ["Mirror of Nine Lies", "Green Wax Seal", "Veiled Signet"],
          requiresFlags: ["legal_finish_ready"],
          next: "PGE03-W2",
        },
        {
          id: "p3-6-w3",
          text: "Hand the crowd a complete three-verse villain tale and let them enforce it.",
          requiresRole: ["Bard", "Thief"],
          requiresFlags: ["rumor_finish_ready"],
          next: "PGE03-W3",
        },
        {
          id: "p3-6-l1",
          text: "Call the wrong claimant and trust confusion.",
          requiresFlags: ["credibility_thin"],
          next: "PGE03-L1",
        },
        {
          id: "p3-6-l2",
          text: "Run before verdict and let the chamber close without you.",
          requiresFlags: ["offstage"],
          next: "PGE03-L2",
        },
        {
          id: "p3-6-l3",
          text: "Accept committee compromise that keeps peace but erases your claim.",
          requiresFlags: ["committee_finish_ready", "verdict_frayed"],
          next: "PGE03-L3",
        },
      ]),
      scene("PGE03-MISS-path", "You reach for a closing move that was never prepared. The court notices the seam and turns on the speaker.", [
        {
          id: "p3-miss-path-a",
          text: "Double down on the claim.",
          next: "PGE03-MISS-ending",
        },
        {
          id: "p3-miss-path-b",
          text: "Retreat into etiquette and delay.",
          next: "PGE03-MISS-ending",
        },
      ]),
      failScene("PGE03-MISS-ending", "Winter court strips your standing. Your claim ends as a cautionary rumor."),
      winScene("PGE03-W1", "One precise shot rewrites succession in a single heartbeat.", ["Mirror of Nine Lies"], ["Archer"], "Gallery Verdict Arrow"),
      winScene("PGE03-W2", "Three relics, one legal chain. The court bends instead of breaking.", ["Mirror of Nine Lies", "Green Wax Seal", "Veiled Signet"], [], "Triune Succession Ledger"),
      winScene("PGE03-W3", "You never sat the throne, but your version of events did.", ["Veiled Signet", "Green Wax Seal"], ["Bard", "Thief"], "Winter Mask Mandate"),
      failScene("PGE03-L1", "A false claim under witness law brands you for all factions."),
      failScene("PGE03-L2", "By leaving before closure, you become the missing villain in someone else's story."),
      failScene("PGE03-L3", "The court stabilizes under committee compromise, and your knife-game ends in stalemate."),
    ]),
  },
  PGE04: {
    nodeId: "PGE04",
    title: "Tomb of the Sunless King",
    subtitle: "Underground stories run on bargains, names, and who gets to leave with the relic.",
    startSceneId: "PGE04-S1",
    devArtifacts: Object.freeze(["Sunless Lantern", "Bone Key", "River-Map of Silt"]),
    scenes: Object.freeze([
      scene("PGE04-S1", "The tomb opens three ways: name-choir hall, ossuary lockline, and flood galleries.", [
        {
          id: "p4-1-lantern",
          text: "Take the name-choir hall with Sunless Lantern raised.",
          requiresArtifacts: ["Sunless Lantern"],
          setFlags: ["frame_names", "lit"],
          next: "PGE04-S2A",
        },
        {
          id: "p4-1-bone",
          text: "Take the ossuary lockline and work by Bone Key pressure points.",
          requiresArtifacts: ["Bone Key"],
          setFlags: ["frame_bone"],
          next: "PGE04-S2B",
        },
        {
          id: "p4-1-river",
          text: "Take the flood galleries and read current marks from the River-Map of Silt.",
          requiresArtifacts: ["River-Map of Silt"],
          setFlags: ["frame_river"],
          next: "PGE04-S2C",
        },
        {
          id: "p4-1-force",
          text: "Split the team and force all routes at once.",
          setFlags: ["frame_force"],
          next: "PGE04-S2D",
        },
      ]),
      scene("PGE04-S2A", "Name-choir hall: carved mouths repeat claimant titles and demand a spoken price.", [
        {
          id: "p4-2a-read",
          text: "Read each title aloud and keep the sequence intact.",
          requiresArtifacts: ["Sunless Lantern"],
          setFlags: ["name_sequence"],
          next: "PGE04-S3",
        },
        {
          id: "p4-2a-bargain",
          text: "Offer a pact to the hall itself and trade one future debt for passage.",
          requiresRole: ["Warlock"],
          setFlags: ["hall_bargain"],
          next: "PGE04-S3",
        },
        {
          id: "p4-2a-ignore",
          text: "Ignore the mouths and push through by speed.",
          setFlags: ["name_disrespect"],
          next: "PGE04-S3",
        },
      ]),
      scene("PGE04-S2B", "Ossuary lockline: bone latches in triplicate react to weight, breath, and oath.", [
        {
          id: "p4-2b-key",
          text: "Solve the triplicate latch with Bone Key and mirrored pressure.",
          requiresArtifacts: ["Bone Key"],
          setFlags: ["latch_solved"],
          next: "PGE04-S3",
        },
        {
          id: "p4-2b-break",
          text: "Break one latch and accept structural instability.",
          setFlags: ["latch_cracked"],
          next: "PGE04-S3",
        },
        {
          id: "p4-2b-trade",
          text: "Trade your name for passage and leave a fragment behind.",
          requiresRole: ["Warlock", "Bard"],
          setFlags: ["name_traded"],
          next: "PGE04-S3",
        },
      ]),
      scene("PGE04-S2C", "Flood gallery: black water rises and recedes on a repeating three-beat rhythm.", [
        {
          id: "p4-2c-map",
          text: "Follow the River-Map and move only on the third recede.",
          requiresArtifacts: ["River-Map of Silt"],
          setFlags: ["flood_timed"],
          next: "PGE04-S3",
        },
        {
          id: "p4-2c-lantern",
          text: "Use lantern reflection to find hidden dry ridges.",
          requiresArtifacts: ["Sunless Lantern"],
          setFlags: ["dry_ridge"],
          next: "PGE04-S3",
        },
        {
          id: "p4-2c-rush",
          text: "Sprint between pulses and accept losses.",
          setFlags: ["flood_panicked"],
          next: "PGE04-S3",
        },
      ]),
      scene("PGE04-S2D", "Forced split costs time and people. You can still salvage one coherent frame.", [
        {
          id: "p4-2d-salvage-names",
          text: "Consolidate to the name hall and restore sequence discipline.",
          requiresArtifacts: ["Sunless Lantern"],
          setFlags: ["frame_names", "late_salvage"],
          next: "PGE04-S3",
        },
        {
          id: "p4-2d-salvage-bone",
          text: "Consolidate to lockline and make the Bone Key route primary.",
          requiresArtifacts: ["Bone Key"],
          setFlags: ["frame_bone", "late_salvage"],
          next: "PGE04-S3",
        },
        {
          id: "p4-2d-salvage-river",
          text: "Consolidate to flood timing and trust the river pattern.",
          requiresArtifacts: ["River-Map of Silt"],
          setFlags: ["frame_river", "late_salvage"],
          next: "PGE04-S3",
        },
      ]),
      scene("PGE04-S3", "Inner vault antechamber: three mechanisms can open the buried court, but only one can be controlled.", [
        {
          id: "p4-3-crown",
          text: "Prime throne mechanism by binding names, lock, and flood timing together.",
          requiresFlags: ["name_sequence", "latch_solved", "flood_timed"],
          setFlags: ["throne_mechanism"],
          next: "PGE04-S4",
        },
        {
          id: "p4-3-ossuary",
          text: "Prime ossuary mechanism and keep flood pressure low.",
          requiresFlags: ["latch_solved"],
          setFlags: ["ossuary_mechanism"],
          next: "PGE04-S4",
        },
        {
          id: "p4-3-sluice",
          text: "Prime sluice mechanism and redirect the lower chamber.",
          requiresFlags: ["flood_timed"],
          setFlags: ["sluice_mechanism"],
          next: "PGE04-S4",
        },
        {
          id: "p4-3-chaos",
          text: "Trigger all mechanisms and outrun collapse.",
          setFlags: ["mechanism_chaos"],
          next: "PGE04-S4",
        },
      ]),
      scene("PGE04-S4", "The buried court wakes. It asks who has the right to claim and who has merely survived.", [
        {
          id: "p4-4-warlock",
          text: "Answer with a Warlock bargain: power for debt, not entitlement.",
          requiresRole: ["Warlock"],
          requiresFlags: ["throne_mechanism"],
          setFlags: ["warlock_claim"],
          next: "PGE04-S4B",
        },
        {
          id: "p4-4-keeper",
          text: "Answer as a keeper: contain relics, take only what is stable.",
          requiresFlags: ["ossuary_mechanism"],
          setFlags: ["keeper_claim"],
          next: "PGE04-S4B",
        },
        {
          id: "p4-4-river",
          text: "Answer as a ferryman: redirect and leave with less than you came for.",
          requiresFlags: ["sluice_mechanism"],
          setFlags: ["river_claim"],
          next: "PGE04-S4B",
        },
        {
          id: "p4-4-oathkeeper",
          text: "Answer with strict witness oath: no claim stands without three confirmations.",
          requiresRole: ["Hierophant", "Warden"],
          setFlags: ["oath_claim"],
          next: "PGE04-S4B",
        },
        {
          id: "p4-4-pry",
          text: "Pry the crown by force and pray the hall does not react.",
          setFlags: ["greedy_claim"],
          next: "PGE04-S4B",
        },
      ]),
      scene("PGE04-S4B", "Buried judges demand collateral for your claim. You can pay in blood, memory, or relic authority.", [
        {
          id: "p4-4b-collateral",
          text: "Offer relic authority: bind Lantern, Key, and Map into one audited claim.",
          requiresArtifacts: ["Sunless Lantern", "Bone Key", "River-Map of Silt"],
          setFlags: ["collateral_paid"],
          next: "PGE04-S5",
        },
        {
          id: "p4-4b-memory",
          text: "Offer memory: surrender one triumph to gain uncontested passage.",
          requiresFlags: ["name_sequence"],
          setFlags: ["memory_paid"],
          next: "PGE04-S5",
        },
        {
          id: "p4-4b-blood",
          text: "Offer blood and push forward before the chamber re-evaluates.",
          setFlags: ["blood_paid"],
          next: "PGE04-S5",
        },
        {
          id: "p4-4b-cheat",
          text: "Fake collateral and hope old wards cannot verify.",
          setFlags: ["false_collateral"],
          next: "PGE04-S5",
        },
      ]),
      scene("PGE04-S5", "Final chamber pressure climbs. One ending can still be made stable.", [
        {
          id: "p4-5-w1",
          text: "Seat the Sunless Crown through sanctioned debt and complete the bargain.",
          requiresRole: ["Warlock"],
          requiresArtifacts: ["Sunless Lantern", "Bone Key", "River-Map of Silt"],
          requiresFlags: ["warlock_claim", "collateral_paid"],
          next: "PGE04-W1",
        },
        {
          id: "p4-5-w2",
          text: "Take the ossuary relics only and seal the crown vault.",
          requiresArtifacts: ["Sunless Lantern", "Bone Key"],
          requiresFlags: ["keeper_claim", "memory_paid"],
          next: "PGE04-W2",
        },
        {
          id: "p4-5-w3",
          text: "Open the sluice fully, drown the claim, and leave with map-safe relic fragments.",
          requiresArtifacts: ["River-Map of Silt"],
          requiresFlags: ["river_claim", "blood_paid"],
          next: "PGE04-W3",
        },
        {
          id: "p4-5-l1",
          text: "Grab the crown and run before closure.",
          requiresFlags: ["greedy_claim", "mechanism_chaos"],
          next: "PGE04-L1",
        },
        {
          id: "p4-5-l2",
          text: "Wait too long and let pressure decide for you.",
          requiresFlags: ["flood_panicked"],
          next: "PGE04-L2",
        },
        {
          id: "p4-5-l3",
          text: "Present false collateral and try to bluff dead judges.",
          requiresFlags: ["false_collateral"],
          next: "PGE04-L3",
        },
      ]),
      scene("PGE04-MISS-path", "You invoke a mechanism your run never primed. Stone groans; the tomb rejects your sequence.", [
        {
          id: "p4-miss-path-a",
          text: "Push deeper before the hall rebalances.",
          next: "PGE04-MISS-ending",
        },
        {
          id: "p4-miss-path-b",
          text: "Try to force a bargain with no prepared leverage.",
          next: "PGE04-MISS-ending",
        },
      ]),
      failScene("PGE04-MISS-ending", "The chamber closes on an invalid claim. Water and stone keep what you reached for."),
      winScene("PGE04-W1", "Debt is accepted, crown is seated, and the tomb records you as lawful inheritor.", ["Sunless Lantern", "Bone Key", "River-Map of Silt"], ["Warlock"], "Sunless Crown Accord"),
      winScene("PGE04-W2", "You leave with lesser relics and a sealed chamber that will not reopen easily.", ["Sunless Lantern", "Bone Key"], [], "Ossuary Keeper Sigil"),
      winScene("PGE04-W3", "You refuse kingship, redirect the flood, and survive with knowledge intact.", ["River-Map of Silt"], [], "Silt-River Exit Seal"),
      failScene("PGE04-L1", "The crown rejects theft. Stone and water close over your route."),
      failScene("PGE04-L2", "The flood completes its third beat without you and the chamber erases your claim."),
      failScene("PGE04-L3", "The judges accept your bluff long enough to trap you at the sealed threshold."),
    ]),
  },
  PGE05: {
    nodeId: "PGE05",
    title: "March of Small Mercies",
    subtitle: "After victory, the harder story begins: who gets protected, who gets punished, and who gets written out.",
    startSceneId: "PGE05-01",
    devArtifacts: Object.freeze(["Ashen Treaty Pins", "Red Petition Docket", "Saintglass Vial"]),
    scenes: Object.freeze([
      scene("PGE05-01", "Conquered districts petition for terms while your officers demand immediate reprisals.", [
        {
          id: "p5-1-mercy",
          text: "Frame the campaign as restoration: protect civilians first, punish second.",
          requiresRole: ["Squire", "Warden", "Captain"],
          setFlags: ["frame_mercy", "civilian_priority"],
          next: "PGE05-02A",
        },
        {
          id: "p5-1-ledger",
          text: "Frame it as lawful transition: every sentence tied to signed records.",
          requiresArtifacts: ["Red Petition Docket"],
          setFlags: ["frame_law", "records_open"],
          next: "PGE05-02B",
        },
        {
          id: "p5-1-fear",
          text: "Frame it as deterrence: one hard example prevents ten future uprisings.",
          requiresRole: ["Black Knight", "Warlock", "Bard"],
          setFlags: ["frame_deterrence"],
          next: "PGE05-02C",
        },
        {
          id: "p5-1-drift",
          text: "Delay the decision and let local officers improvise.",
          setFlags: ["frame_drift"],
          next: "PGE05-02D",
        },
      ]),
      scene("PGE05-02A", "Refugees and collaborators queue in the same square. Every order is witnessed.", [
        {
          id: "p5-2a-pins",
          text: "Issue Ashen Treaty Pins to marked noncombatants and forbid retaliation against wearers.",
          requiresArtifacts: ["Ashen Treaty Pins"],
          setFlags: ["pins_issued", "witness_mercy"],
          next: "PGE05-03",
        },
        {
          id: "p5-2a-captains",
          text: "Create rotating captain courts with public sentence logs.",
          requiresRole: ["Captain", "Warden"],
          setFlags: ["captain_courts", "witness_mercy"],
          next: "PGE05-03",
        },
        {
          id: "p5-2a-short",
          text: "Push through quick decisions to keep marches moving.",
          setFlags: ["mercy_thin"],
          next: "PGE05-03",
        },
      ]),
      scene("PGE05-02B", "The docket hall overflows with contradictory testimony and forged seals.", [
        {
          id: "p5-2b-docket",
          text: "Use Red Petition Docket to chain each accusation to accountable witnesses.",
          requiresArtifacts: ["Red Petition Docket"],
          setFlags: ["docket_chain", "legal_mass"],
          next: "PGE05-03",
        },
        {
          id: "p5-2b-vial",
          text: "Use Saintglass Vial to verify confession oaths against glamour and coercion.",
          requiresArtifacts: ["Saintglass Vial"],
          setFlags: ["truth_vetted", "legal_mass"],
          next: "PGE05-03",
        },
        {
          id: "p5-2b-bulk",
          text: "Issue bulk sentences by district quota.",
          setFlags: ["quota_sentences"],
          next: "PGE05-03",
        },
      ]),
      scene("PGE05-02C", "Your deterrence decree lands fast, and every minor lord starts settling scores under your banner.", [
        {
          id: "p5-2c-stage",
          text: "Stage one exemplary trial and cap retaliation after it.",
          setFlags: ["exampled_once", "deterrence_bounded"],
          next: "PGE05-03",
        },
        {
          id: "p5-2c-night",
          text: "Authorize quiet night arrests to prevent mass panic.",
          requiresRole: ["Thief", "Ranger"],
          setFlags: ["night_net"],
          next: "PGE05-03",
        },
        {
          id: "p5-2c-open",
          text: "Let reprisals proceed publicly until resistance breaks.",
          setFlags: ["reprisal_open"],
          next: "PGE05-03",
        },
      ]),
      scene("PGE05-02D", "Officer improvisation creates four incompatible policies in one day.", [
        {
          id: "p5-2d-salvage-mercy",
          text: "Impose mercy frame with immediate protected-zone markers.",
          requiresArtifacts: ["Ashen Treaty Pins"],
          setFlags: ["frame_mercy", "pins_issued", "late_salvage"],
          next: "PGE05-03",
        },
        {
          id: "p5-2d-salvage-law",
          text: "Impose law frame and centralize all sentencing in docket halls.",
          requiresArtifacts: ["Red Petition Docket"],
          setFlags: ["frame_law", "docket_chain", "late_salvage"],
          next: "PGE05-03",
        },
        {
          id: "p5-2d-salvage-fear",
          text: "Impose deterrence frame with one public execution cap.",
          requiresRole: ["Black Knight", "Warlock"],
          setFlags: ["frame_deterrence", "exampled_once", "late_salvage"],
          next: "PGE05-03",
        },
      ]),
      scene("PGE05-03", "A famine shipment arrives one day short. Feeding one district means starving another.", [
        {
          id: "p5-3-priority",
          text: "Feed the district that kept order under your terms.",
          setFlags: ["order_rewarded"],
          next: "PGE05-04",
        },
        {
          id: "p5-3-lottery",
          text: "Run a witnessed ration lottery and accept political backlash.",
          requiresFlags: ["records_open", "docket_chain"],
          setFlags: ["lottery_run"],
          next: "PGE05-04",
        },
        {
          id: "p5-3-raids",
          text: "Seize hidden grain stores through forced raids.",
          requiresRole: ["Ranger", "Thief", "Captain"],
          setFlags: ["grain_seized"],
          next: "PGE05-04",
        },
        {
          id: "p5-3-denial",
          text: "Delay distribution and claim inventory mismatch.",
          setFlags: ["hunger_riot"],
          next: "PGE05-04",
        },
      ]),
      scene("PGE05-04", "Your own staff splits over whether mercy is policy or weakness.", [
        {
          id: "p5-4-bind",
          text: "Bind the officer corps to a written code signed under witness.",
          requiresArtifacts: ["Red Petition Docket"],
          setFlags: ["officer_code"],
          next: "PGE05-05",
        },
        {
          id: "p5-4-saintglass",
          text: "Use Saintglass Vial to expose the loudest hypocrites before the whole room.",
          requiresArtifacts: ["Saintglass Vial"],
          setFlags: ["hypocrisy_broken"],
          next: "PGE05-05",
        },
        {
          id: "p5-4-purge",
          text: "Purge dissenters and replace them with loyal hardliners.",
          setFlags: ["hardline_staff"],
          next: "PGE05-05",
        },
      ]),
      scene("PGE05-05", "Final decree window: the city will remember one sentence as your doctrine.", [
        {
          id: "p5-5-w1",
          text: "Mercy is binding law: marked civilians are untouchable even after rebellion.",
          requiresArtifacts: ["Ashen Treaty Pins", "Red Petition Docket"],
          requiresFlags: ["frame_mercy", "pins_issued", "officer_code"],
          next: "PGE05-W1",
        },
        {
          id: "p5-5-w2",
          text: "Law is transparent force: every punishment is witnessed and appealable.",
          requiresArtifacts: ["Red Petition Docket", "Saintglass Vial"],
          requiresFlags: ["frame_law", "docket_chain", "truth_vetted"],
          next: "PGE05-W2",
        },
        {
          id: "p5-5-w3",
          text: "Deterrence with boundaries: one hard example, then amnesty corridor.",
          requiresFlags: ["frame_deterrence", "exampled_once", "deterrence_bounded"],
          next: "PGE05-W3",
        },
        {
          id: "p5-5-l1",
          text: "Authorize total reprisal and silence objections.",
          requiresFlags: ["reprisal_open", "hardline_staff"],
          next: "PGE05-L1",
        },
        {
          id: "p5-5-l2",
          text: "Issue no doctrine and let district commanders decide.",
          requiresFlags: ["frame_drift"],
          next: "PGE05-L2",
        },
      ]),
      scene("PGE05-MISS-path", "You reach for doctrine that your own campaign choices never prepared. The room hears the contradiction instantly.", [
        {
          id: "p5-miss-a",
          text: "Threaten the council into accepting it.",
          next: "PGE05-MISS-ending",
        },
        {
          id: "p5-miss-b",
          text: "Delay and claim transcription errors.",
          next: "PGE05-MISS-ending",
        },
      ]),
      failScene("PGE05-MISS-ending", "Your decree fails under witness challenge. Districts revert to private vendettas."),
      winScene("PGE05-W1", "Mercy survives because you made it enforceable, not sentimental.", ["Ashen Treaty Pins", "Red Petition Docket"], [], "Mercy Charter Seal"),
      winScene("PGE05-W2", "You turn vengeance into process and process into legitimacy.", ["Red Petition Docket", "Saintglass Vial"], [], "Conqueror's Due Process"),
      winScene("PGE05-W3", "Fear opens the door, then limits close it before the realm tears itself apart.", ["Ashen Treaty Pins"], [], "Measured Iron Mandate"),
      failScene("PGE05-L1", "Reprisal outruns command. You keep the city and lose the realm."),
      failScene("PGE05-L2", "By refusing doctrine, you inherit every atrocity committed in your name."),
    ]),
  },
  PGE06: {
    nodeId: "PGE06",
    title: "The Long Night Banquet",
    subtitle: "Guest-right, poison, and policy share one table; your choice is which law survives dessert.",
    startSceneId: "PGE06-01",
    devArtifacts: Object.freeze(["Ivory Truce Fork", "Nightwine Ledger", "Mercy Bell Chime"]),
    scenes: Object.freeze([
      scene("PGE06-01", "A coalition banquet begins under truce terms while three rumors spread: poison, coup, and staged martyrdom.", [
        {
          id: "p6-1-host",
          text: "Host openly and anchor the evening in guest-right ritual.",
          requiresArtifacts: ["Ivory Truce Fork"],
          setFlags: ["frame_guest_right", "ritual_open"],
          next: "PGE06-02A",
        },
        {
          id: "p6-1-ledger",
          text: "Audit every cup and plate transfer with the Nightwine Ledger.",
          requiresArtifacts: ["Nightwine Ledger"],
          setFlags: ["frame_audit", "service_chain"],
          next: "PGE06-02B",
        },
        {
          id: "p6-1-shadow",
          text: "Work the kitchens and corridors in shadow, not the table.",
          requiresRole: ["Thief", "Ranger", "Bard"],
          setFlags: ["frame_shadow"],
          next: "PGE06-02C",
        },
        {
          id: "p6-1-react",
          text: "Wait for the first incident and respond live.",
          setFlags: ["frame_reactive"],
          next: "PGE06-02D",
        },
      ]),
      scene("PGE06-02A", "Ceremonial toasts begin. One faction refuses to drink unless you eat first.", [
        {
          id: "p6-2a-fork",
          text: "Use Ivory Truce Fork to invoke precedence law and force equal tasting order.",
          requiresArtifacts: ["Ivory Truce Fork"],
          setFlags: ["precedence_enforced", "trust_visible"],
          next: "PGE06-03",
        },
        {
          id: "p6-2a-bell",
          text: "Strike Mercy Bell Chime and declare a no-blood hall under pain of exile.",
          requiresArtifacts: ["Mercy Bell Chime"],
          setFlags: ["hall_sanctified"],
          next: "PGE06-03",
        },
        {
          id: "p6-2a-bluff",
          text: "Bluff confidence and keep the course moving.",
          setFlags: ["trust_thin"],
          next: "PGE06-03",
        },
      ]),
      scene("PGE06-02B", "Your auditors find mismatched vintages and two forged kitchen seals.", [
        {
          id: "p6-2b-ledger",
          text: "Freeze service and reconcile every vessel against the Nightwine Ledger.",
          requiresArtifacts: ["Nightwine Ledger"],
          setFlags: ["chain_reconciled", "trust_visible"],
          next: "PGE06-03",
        },
        {
          id: "p6-2b-fork",
          text: "Escalate to host-ritual authority and require public retasting.",
          requiresArtifacts: ["Ivory Truce Fork"],
          setFlags: ["precedence_enforced"],
          next: "PGE06-03",
        },
        {
          id: "p6-2b-rush",
          text: "Ignore inconsistencies to avoid insulting the delegates.",
          setFlags: ["audit_skipped"],
          next: "PGE06-03",
        },
      ]),
      scene("PGE06-02C", "Shadow sweep turns up a hidden passage and one paid saboteur who offers names for immunity.", [
        {
          id: "p6-2c-turn",
          text: "Take the deal, feed false timing to the saboteur's paymaster.",
          requiresRole: ["Thief", "Bard"],
          setFlags: ["double_agent"],
          next: "PGE06-03",
        },
        {
          id: "p6-2c-detain",
          text: "Detain quietly and replace all corridor staff.",
          requiresRole: ["Captain", "Warden"],
          setFlags: ["corridors_locked"],
          next: "PGE06-03",
        },
        {
          id: "p6-2c-cut",
          text: "Eliminate the saboteur and hide the body to avoid panic.",
          setFlags: ["blood_hidden"],
          next: "PGE06-03",
        },
      ]),
      scene("PGE06-02D", "Reactive play lets rival delegations frame the first incident before you speak.", [
        {
          id: "p6-2d-salvage-host",
          text: "Seize host authority and invoke guest-right penalties.",
          requiresArtifacts: ["Ivory Truce Fork"],
          setFlags: ["frame_guest_right", "late_salvage"],
          next: "PGE06-03",
        },
        {
          id: "p6-2d-salvage-audit",
          text: "Seize service records and run emergency audit in public.",
          requiresArtifacts: ["Nightwine Ledger"],
          setFlags: ["frame_audit", "late_salvage"],
          next: "PGE06-03",
        },
        {
          id: "p6-2d-salvage-shadow",
          text: "Discredit all public witnesses and control the corridors instead.",
          requiresRole: ["Thief", "Ranger"],
          setFlags: ["frame_shadow", "late_salvage"],
          next: "PGE06-03",
        },
      ]),
      scene("PGE06-03", "Mid-course collapse: one delegate foams at the mouth and accusations erupt.", [
        {
          id: "p6-3-ring",
          text: "Ring Mercy Bell Chime and lock all blades and bows under truce law.",
          requiresArtifacts: ["Mercy Bell Chime"],
          setFlags: ["violence_paused"],
          next: "PGE06-04",
        },
        {
          id: "p6-3-prove",
          text: "Run immediate poison trace from cup chain and kitchen route.",
          requiresFlags: ["service_chain"],
          setFlags: ["trace_started"],
          next: "PGE06-04",
        },
        {
          id: "p6-3-blame",
          text: "Name a likely culprit faction before evidence settles.",
          setFlags: ["premature_blame"],
          next: "PGE06-04",
        },
      ]),
      scene("PGE06-04", "Final course. You can save peace, seize leverage, or burn all trust for immediate dominance.", [
        {
          id: "p6-4-w1",
          text: "Complete host-right chain and prove no guest was targeted by the host table.",
          requiresArtifacts: ["Ivory Truce Fork", "Nightwine Ledger"],
          requiresFlags: ["precedence_enforced", "chain_reconciled", "violence_paused"],
          next: "PGE06-W1",
        },
        {
          id: "p6-4-w2",
          text: "Expose the orchestrator through audited records and controlled witness timing.",
          requiresArtifacts: ["Nightwine Ledger", "Mercy Bell Chime"],
          requiresFlags: ["trace_started", "trust_visible"],
          next: "PGE06-W2",
        },
        {
          id: "p6-4-w3",
          text: "Use shadow intel to force a private surrender and preserve the coalition publicly.",
          requiresFlags: ["frame_shadow", "double_agent"],
          next: "PGE06-W3",
        },
        {
          id: "p6-4-l1",
          text: "Double down on premature blame and arrest the wrong delegation.",
          requiresFlags: ["premature_blame"],
          next: "PGE06-L1",
        },
        {
          id: "p6-4-l2",
          text: "Silence the hall and keep power through fear alone.",
          requiresFlags: ["blood_hidden", "trust_thin"],
          next: "PGE06-L2",
        },
      ]),
      scene("PGE06-MISS-path", "Your closing call assumes evidence or ritual authority you never established. The table rejects the claim.", [
        {
          id: "p6-miss-a",
          text: "Force acceptance at bladepoint.",
          next: "PGE06-MISS-ending",
        },
        {
          id: "p6-miss-b",
          text: "Withdraw and leave delegates to self-police.",
          next: "PGE06-MISS-ending",
        },
      ]),
      failScene("PGE06-MISS-ending", "Banquet law collapses. The coalition survives only as a rumor for one night."),
      winScene("PGE06-W1", "Guest-right holds through poison and panic. The truce outlives the table.", ["Ivory Truce Fork", "Nightwine Ledger"], [], "Table of Last Reconciliation"),
      winScene("PGE06-W2", "You make accountability faster than vengeance, and the hall chooses process.", ["Nightwine Ledger", "Mercy Bell Chime"], [], "Midnight Carving Accord"),
      winScene("PGE06-W3", "No speech saves the room; a private surrender does, and history credits peace.", ["Ivory Truce Fork"], ["Thief", "Ranger", "Bard"], "Bell of Unbroken Guest-Right"),
      failScene("PGE06-L1", "You turn suspicion into civil fracture. The feast becomes the first battle."),
      failScene("PGE06-L2", "You keep immediate control and lose every ally by dawn."),
    ]),
  },
});

function scenesById(story) {
  return Object.fromEntries((story.scenes || []).map((entry) => [entry.id, entry]));
}

function rewardsMap(state) {
  return state && state.inventory && state.inventory.rewards && typeof state.inventory.rewards === "object"
    ? state.inventory.rewards
    : {};
}

function normalizeRuntime(candidate, story) {
  const source = candidate && typeof candidate === "object" ? candidate : {};
  const sceneLookup = scenesById(story);
  const startSceneId = story && story.startSceneId ? story.startSceneId : "";
  const initialScene = sceneLookup[startSceneId] ? startSceneId : Object.keys(sceneLookup)[0] || "";
  const sceneId = sceneLookup[source.sceneId] ? source.sceneId : initialScene;
  const roleScoresInput = source.roleScores && typeof source.roleScores === "object" ? source.roleScores : {};
  const roleScores = Object.fromEntries(
    ROLE_ARTIFACTS.map((role) => [role, Number(roleScoresInput[role]) || 0]),
  );
  const flagsInput = source.flags && typeof source.flags === "object" ? source.flags : {};
  const flags = {};
  for (const [key, value] of Object.entries(flagsInput)) {
    if (value) {
      flags[key] = true;
    }
  }
  const currentScene = sceneLookup[sceneId] || null;
  return {
    sceneId,
    flags,
    roleScores,
    choiceCount: Math.max(0, Math.floor(Number(source.choiceCount) || 0)),
    solved: Boolean(source.solved),
    outcomeRole: String(source.outcomeRole || ""),
    history:
      Array.isArray(source.history)
        ? source.history.map((entry) => String(entry || "")).filter((entry) => entry).slice(-60)
        : [],
    lastMessage: String(source.lastMessage || ""),
    terminalType: currentScene && currentScene.type === "terminal" ? String(currentScene.terminal || "") : "",
    routeVisitNonce: Math.max(0, Math.floor(Number(source.routeVisitNonce) || 0)),
    pendingRewards:
      Array.isArray(source.pendingRewards)
        ? source.pendingRewards.map((entry) => String(entry || "")).filter((entry) => entry).slice(-8)
        : [],
    winRewardHistory:
      source.winRewardHistory && typeof source.winRewardHistory === "object"
        ? Object.fromEntries(
            Object.entries(source.winRewardHistory).filter(([, value]) => Boolean(value)),
          )
        : {},
  };
}

function storyForNodeId(nodeId) {
  return PGE_STORIES[String(nodeId || "")] || null;
}

function choiceNextId(choice) {
  if (choice && typeof choice === "object" && choice.next) {
    return String(choice.next);
  }
  if (choice && typeof choice === "object" && Array.isArray(choice.nextSceneIds) && choice.nextSceneIds[0]) {
    return String(choice.nextSceneIds[0]);
  }
  return "";
}

function listFrom(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry || "")).filter((entry) => entry);
  }
  if (value) {
    return [String(value)];
  }
  return [];
}

function requiresCheck(
  { requiresRole = [], requiresArtifacts = [], requiresFlags = [] },
  context,
  { includeRole = true, includeArtifacts = true, includeFlags = true } = {},
) {
  const safeContext = context && typeof context === "object" ? context : {};
  const runtimeFlags =
    safeContext.runtime &&
    typeof safeContext.runtime === "object" &&
    safeContext.runtime.flags &&
    typeof safeContext.runtime.flags === "object"
      ? safeContext.runtime.flags
      : {};
  const rewards = rewardsMap(safeContext.state);
  const activeRole = activePracticalGuideRoleFromState(safeContext.state);
  const roleNeed = listFrom(requiresRole);
  const artifactNeed = listFrom(requiresArtifacts);
  const flagNeed = listFrom(requiresFlags);

  const missingRole = includeRole && roleNeed.length && !roleNeed.includes(activeRole) ? roleNeed : [];
  const missingArtifacts = includeArtifacts ? artifactNeed.filter((artifact) => !rewards[artifact]) : [];
  const missingFlags = includeFlags ? flagNeed.filter((flag) => !runtimeFlags[flag]) : [];

  return {
    missingRole,
    missingArtifacts,
    missingFlags,
    locked: Boolean(missingRole.length || missingArtifacts.length || missingFlags.length),
  };
}

function terminalOutcomeRole(runtime) {
  let winner = ROLE_ARTIFACTS[0];
  let winnerScore = Number(runtime.roleScores[winner]) || 0;
  for (const role of ROLE_ARTIFACTS) {
    const score = Number(runtime.roleScores[role]) || 0;
    if (score > winnerScore) {
      winner = role;
      winnerScore = score;
    }
  }
  return winner;
}

function lockReason(lockInfo) {
  const parts = [];
  if (lockInfo.missingRole.length) {
    parts.push(`Role: ${lockInfo.missingRole.join(" / ")}`);
  }
  if (lockInfo.missingArtifacts.length) {
    parts.push(`Artifacts: ${lockInfo.missingArtifacts.join(", ")}`);
  }
  if (lockInfo.missingFlags.length) {
    parts.push("Story conditions unmet");
  }
  return parts.join(" | ");
}

function mergeUnique(values) {
  return [...new Set(values.filter((entry) => entry))];
}

function fallbackSceneId(nodeId, choice, stage = "path") {
  if (choice && typeof choice.onMissingFlagsNext === "string" && choice.onMissingFlagsNext) {
    return choice.onMissingFlagsNext;
  }
  return `${String(nodeId || "")}-MISS-${stage}`;
}

function renderChoices(nodeId, currentScene, runtime, context, story) {
  const sceneLookup = scenesById(story);
  const lockedRequirementSymbols = [];
  const visibleChoices = (currentScene.choices || []).filter((choice) => {
    const nextId = choiceNextId(choice);
    const nextScene = sceneLookup[nextId] || null;
    const hardLock = requiresCheck({
      requiresRole: choice.requiresRole,
      requiresArtifacts: choice.requiresArtifacts,
      requiresFlags: choice.requiresFlags,
    }, context, { includeFlags: false });
    if (hardLock.locked) {
      lockedRequirementSymbols.push(...hardLock.missingRole, ...hardLock.missingArtifacts);
      return false;
    }
    if (nextScene && nextScene.type === "terminal") {
      const terminalHardLock = requiresCheck({
        requiresRole: nextScene.requiresRole,
        requiresArtifacts: nextScene.requiresArtifacts,
        requiresFlags: nextScene.requiresFlags,
      }, context, { includeFlags: false });
      if (terminalHardLock.locked) {
        lockedRequirementSymbols.push(...terminalHardLock.missingRole, ...terminalHardLock.missingArtifacts);
        return false;
      }
    }
    return true;
  });
  const uniqueSymbols = mergeUnique(lockedRequirementSymbols);
  const symbolStrip = uniqueSymbols.length
    ? `
      <section class="card pge-lock-sigil-strip" aria-label="Hidden route sigils">
        ${uniqueSymbols.map((name) => `
          <span class="pge-lock-sigil">
            ${renderArtifactSymbol({
    artifactName: name,
    className: "artifact-symbol",
  })}
          </span>
        `).join("")}
      </section>
    `
    : "";

  if (!visibleChoices.length) {
    return `
      ${symbolStrip}
      <section class="card pge-terminal is-fail">
        <h4>No Current Openings</h4>
        <p>None of your available roles or artifacts unlock a stable move in this scene.</p>
      </section>
    `;
  }

  return `
    ${symbolStrip}
    <div class="pge-choice-grid">
      ${visibleChoices.map((choice) => {
        return `
          <button
            type="button"
            class="pge-choice"
            data-node-id="${escapeHtml(nodeId)}"
            data-node-action="pge-choose"
            data-choice-id="${escapeHtml(choice.id)}"
          >
            <span>${escapeHtml(choice.text)}</span>
          </button>
        `;
      }).join("")}
    </div>
  `;
}

function renderDevGrant(nodeId, story, state) {
  const rewards = rewardsMap(state);
  const missing = (story.devArtifacts || []).filter((artifact) => !rewards[artifact]);
  if (!missing.length) {
    return "";
  }
  return `
    <section class="card pge-dev-tools">
      <h4>Testing Helper</h4>
      <p class="muted">Missing: ${escapeHtml(missing.join(", "))}</p>
      <button
        type="button"
        data-node-id="${escapeHtml(nodeId)}"
        data-node-action="pge-dev-grant-artifacts"
        data-artifacts="${escapeHtml(missing.join("|"))}"
      >
        Grant Missing Test Artifacts
      </button>
    </section>
  `;
}

function renderTerminal(nodeId, story, runtime, currentScene) {
  if (!currentScene || currentScene.type !== "terminal") {
    return "";
  }

  if (currentScene.terminal === "adjudication") {
    const role = runtime.outcomeRole || terminalOutcomeRole(runtime);
    const claimed = Boolean(runtime.solved);
    return `
      <section class="card pge-terminal is-adjudication">
        <h4>Role Settles</h4>
        <p>${escapeHtml(currentScene.text || "The story chooses.")}</p>
        <p><strong>Projected Role:</strong> ${escapeHtml(role)}</p>
        ${
          claimed
            ? `
              <p class="muted">Role already claimed. To change Role, complete a Practical Guide reset in MOL02.</p>
            `
            : `
              <div class="toolbar">
                <button
                  type="button"
                  data-node-id="${escapeHtml(nodeId)}"
                  data-node-action="pge01-claim-role"
                  data-role-artifact="${escapeHtml(role)}"
                >
                  Claim Role
                </button>
              </div>
            `
        }
      </section>
    `;
  }

  const isWin = currentScene.terminal === "win";
  return `
    <section class="card pge-terminal ${isWin ? "is-win" : "is-fail"}">
      <h4>${isWin ? "Story Victory" : "Story Collapse"}</h4>
      <p>${escapeHtml(currentScene.text || "")}</p>
      <div class="toolbar">
        <button
          type="button"
          class="ghost"
          data-node-id="${escapeHtml(nodeId)}"
          data-node-action="pge-restart"
        >
          Restart Story
        </button>
      </div>
    </section>
  `;
}

function createInitialRuntime(story) {
  return {
    sceneId: story.startSceneId,
    flags: {},
    roleScores: { ...EMPTY_ROLE_SCORES },
    choiceCount: 0,
    solved: false,
    outcomeRole: "",
    history: [],
    lastMessage: "",
    routeVisitNonce: 0,
    pendingRewards: [],
    winRewardHistory: {},
  };
}

function reduceAdventureRuntime(nodeId, runtime, action, context) {
  const story = storyForNodeId(nodeId);
  if (!story) {
    return runtime;
  }
  const current = normalizeRuntime(runtime, story);
  const sceneLookup = scenesById(story);
  const currentScene = sceneLookup[current.sceneId] || null;

  if (!action || typeof action !== "object") {
    return current;
  }

  if (action.type === "pge-restart") {
    if (nodeId === "PGE01" && current.solved) {
      return {
        ...current,
        lastMessage: "Role already claimed. Use MOL02 Loop Reset to take a new Role.",
      };
    }
    return {
      ...createInitialRuntime(story),
      lastMessage: "Story rewound.",
    };
  }

  if (action.type === "pge-dev-grant-artifacts") {
    return {
      ...current,
      lastMessage: "Test artifacts requested.",
    };
  }

  if (action.type === "pge01-claim-role") {
    if (nodeId !== "PGE01" || !currentScene || currentScene.terminal !== "adjudication") {
      return current;
    }
    const roleArtifact = normalizePracticalGuideRoleArtifact(action.roleArtifact);
    if (!roleArtifact) {
      return {
        ...current,
        lastMessage: "Role claim failed.",
      };
    }
    return {
      ...current,
      solved: true,
      outcomeRole: roleArtifact,
      lastMessage: `${roleArtifact} claimed.`,
    };
  }

  if (action.type !== "pge-choose" || !currentScene || currentScene.type !== "decision") {
    return current;
  }

  const choiceId = String(action.choiceId || "");
  const choice = (currentScene.choices || []).find((entry) => entry.id === choiceId);
  if (!choice) {
    return current;
  }

  const choiceLock = requiresCheck({
    requiresRole: choice.requiresRole,
    requiresArtifacts: choice.requiresArtifacts,
    requiresFlags: choice.requiresFlags,
  }, context, { includeFlags: false });
  if (choiceLock.locked) {
    return {
      ...current,
      lastMessage: "That path is currently locked.",
    };
  }

  let nextSceneId = choiceNextId(choice);
  if (!sceneLookup[nextSceneId]) {
    return {
      ...current,
      lastMessage: "The story thread frays and resets.",
    };
  }

  const choiceFlagLock = requiresCheck({
    requiresRole: choice.requiresRole,
    requiresArtifacts: choice.requiresArtifacts,
    requiresFlags: choice.requiresFlags,
  }, context, { includeRole: false, includeArtifacts: false, includeFlags: true });
  if (choiceFlagLock.missingFlags.length) {
    const fallbackId = fallbackSceneId(nodeId, choice, "path");
    if (sceneLookup[fallbackId]) {
      nextSceneId = fallbackId;
    } else {
      return {
        ...current,
        lastMessage: "That thread was never laid for this run.",
      };
    }
  }

  const nextFlags = { ...current.flags };
  for (const flag of listFrom(choice.setFlags)) {
    nextFlags[flag] = true;
  }
  const nextRoleScores = { ...current.roleScores };
  const roleScore = choice && typeof choice.roleScore === "object" ? choice.roleScore : {};
  for (const [role, bonus] of Object.entries(roleScore)) {
    const normalizedRole = normalizePracticalGuideRoleArtifact(role);
    if (!normalizedRole) {
      continue;
    }
    nextRoleScores[normalizedRole] = (Number(nextRoleScores[normalizedRole]) || 0) + (Number(bonus) || 0);
  }

  let nextScene = sceneLookup[nextSceneId];
  const nextHistory = [...current.history, choice.text].slice(-60);

  let solved = current.solved;
  let lastMessage = "";
  let outcomeRole = current.outcomeRole;
  const pendingRewards = Array.isArray(current.pendingRewards) ? [...current.pendingRewards] : [];
  const winRewardHistory =
    current.winRewardHistory && typeof current.winRewardHistory === "object"
      ? { ...current.winRewardHistory }
      : {};
  if (nextScene.type === "terminal") {
    const terminalHardLock = requiresCheck({
      requiresRole: nextScene.requiresRole,
      requiresArtifacts: nextScene.requiresArtifacts,
      requiresFlags: nextScene.requiresFlags,
    }, {
      ...context,
      runtime: {
        ...current,
        flags: nextFlags,
      },
    }, { includeFlags: false });
    if (terminalHardLock.locked) {
      const reason = lockReason(terminalHardLock);
      return {
        ...current,
        lastMessage: reason ? `Ending locked: ${reason}` : "You sense the ending would reject you.",
      };
    }
    const terminalFlagLock = requiresCheck({
      requiresRole: nextScene.requiresRole,
      requiresArtifacts: nextScene.requiresArtifacts,
      requiresFlags: nextScene.requiresFlags,
    }, {
      ...context,
      runtime: {
        ...current,
        flags: nextFlags,
      },
    }, { includeRole: false, includeArtifacts: false, includeFlags: true });
    if (terminalFlagLock.missingFlags.length) {
      const fallbackId = fallbackSceneId(nodeId, choice, "ending");
      if (sceneLookup[fallbackId]) {
        nextSceneId = fallbackId;
        nextScene = sceneLookup[nextSceneId];
      } else {
        return {
          ...current,
          lastMessage: "The finale rejects this line of play.",
        };
      }
    }
  }

  if (nextScene.type === "terminal") {
    if (nextScene.terminal === "win") {
      solved = true;
      lastMessage = "A winning story locks into place.";
      const rewardArtifact = String(nextScene.rewardArtifact || "");
      if (rewardArtifact && !winRewardHistory[rewardArtifact]) {
        winRewardHistory[rewardArtifact] = true;
        pendingRewards.push(rewardArtifact);
      }
    } else if (nextScene.terminal === "fail") {
      solved = false;
      lastMessage = "This thread ends in loss.";
    } else if (nextScene.terminal === "adjudication" && nodeId === "PGE01") {
      outcomeRole = terminalOutcomeRole({
        ...current,
        roleScores: nextRoleScores,
      });
      lastMessage = "The Role draws near.";
    }
  }

  return {
    ...current,
    sceneId: nextSceneId,
    flags: nextFlags,
    roleScores: nextRoleScores,
    choiceCount: current.choiceCount + 1,
    solved,
    outcomeRole,
    history: nextHistory,
    lastMessage,
    pendingRewards,
    winRewardHistory,
  };
}

function renderAdventure(nodeId, context) {
  const story = storyForNodeId(nodeId);
  if (!story) {
    return `
      <article class="pge-node" data-node-id="${escapeHtml(nodeId)}">
        <section class="card"><p>Story payload missing.</p></section>
      </article>
    `;
  }

  const runtime = normalizeRuntime(context.runtime, story);
  const sceneLookup = scenesById(story);
  const currentScene = sceneLookup[runtime.sceneId];
  const activeRole = activePracticalGuideRoleFromState(context.state);

  return `
    <article class="pge-node" data-node-id="${escapeHtml(nodeId)}">
      <section class="card pge-head">
        <h3>${escapeHtml(story.title)}</h3>
        <p>${escapeHtml(story.subtitle || "")}</p>
        <p class="muted">
          <strong>Active Role:</strong> ${escapeHtml(activeRole || "None")}
          &nbsp;|&nbsp;
          <strong>Choices Made:</strong> ${escapeHtml(String(runtime.choiceCount))}
        </p>
      </section>

      ${
        currentScene
          ? `
            <section class="card pge-scene">
              <p>${escapeHtml(currentScene.text || "")}</p>
            </section>
          `
          : ""
      }

      ${
        currentScene && currentScene.type === "decision"
          ? renderChoices(nodeId, currentScene, runtime, context, story)
          : ""
      }

      ${renderTerminal(nodeId, story, runtime, currentScene)}
      ${renderDevGrant(nodeId, story, context.state)}
    </article>
  `;
}

function buildAdventureActionFromElement(nodeId, element) {
  const actionName = element.getAttribute("data-node-action");
  if (!actionName) {
    return null;
  }
  if (actionName === "pge-choose") {
    return {
      type: "pge-choose",
      choiceId: element.getAttribute("data-choice-id") || "",
      at: Date.now(),
    };
  }
  if (actionName === "pge-restart") {
    return {
      type: "pge-restart",
      at: Date.now(),
    };
  }
  if (actionName === "pge01-claim-role" && nodeId === "PGE01") {
    return {
      type: "pge01-claim-role",
      roleArtifact: element.getAttribute("data-role-artifact") || "",
      at: Date.now(),
    };
  }
  if (actionName === "pge-dev-grant-artifacts") {
    const raw = String(element.getAttribute("data-artifacts") || "");
    return {
      type: "pge-dev-grant-artifacts",
      artifacts: raw
        .split("|")
        .map((entry) => entry.trim())
        .filter((entry) => entry),
      at: Date.now(),
    };
  }
  return null;
}

function createPgeNodeExperience(nodeId) {
  const story = storyForNodeId(nodeId);
  return {
    nodeId,
    initialState() {
      return createInitialRuntime(story);
    },
    render(context) {
      return renderAdventure(nodeId, context);
    },
    synchronizeRuntime(runtime, context = {}) {
      const normalized = normalizeRuntime(runtime, story);
      const incomingNonce = Math.max(0, Math.floor(Number(context.routeVisitNonce) || 0));
      if (normalized.routeVisitNonce === 0) {
        return {
          ...normalized,
          routeVisitNonce: incomingNonce,
        };
      }
      if (normalized.routeVisitNonce !== incomingNonce) {
        if (!normalized.solved && normalized.choiceCount > 0) {
          return {
            ...createInitialRuntime(story),
            routeVisitNonce: incomingNonce,
            lastMessage: "Thread lost on exit. Story reset.",
          };
        }
        return {
          ...normalized,
          routeVisitNonce: incomingNonce,
        };
      }
      return normalized;
    },
    reduceRuntime(runtime, action, context) {
      return reduceAdventureRuntime(nodeId, runtime, action, context || {});
    },
    validateRuntime(runtime) {
      const normalized = normalizeRuntime(runtime, story);
      return Boolean(normalized.solved);
    },
    buildActionFromElement(element) {
      return buildAdventureActionFromElement(nodeId, element);
    },
  };
}

export const PGE01_NODE_EXPERIENCE = createPgeNodeExperience("PGE01");
export const PGE02_NODE_EXPERIENCE = createPgeNodeExperience("PGE02");
export const PGE03_NODE_EXPERIENCE = createPgeNodeExperience("PGE03");
export const PGE04_NODE_EXPERIENCE = createPgeNodeExperience("PGE04");
export const PGE05_NODE_EXPERIENCE = createPgeNodeExperience("PGE05");
export const PGE06_NODE_EXPERIENCE = createPgeNodeExperience("PGE06");
