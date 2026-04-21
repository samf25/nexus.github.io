const WORM_POWER_SUMMARIES = Object.freeze(Object.fromEntries([
  ["Abhorror", "Produces liquid darkness that could be used to teleport over a wide range"],
  ["Accord", "Intelligence scales with the size, scope, and complexity of the problems presented to him"],
  ["Acidbath", "Could turn into, sling blasts of acid"],
  ["Adamant", "Metallokinetic that can crudely move and shape metal"],
  ["Aegis", "Possesses redundant biology that operates at peak capacity so long as alive"],
  ["Agnes Court", "Creates organic structures that grow exponentially before hardening to a stone-like substance"],
  ["Alabaster", "Restored to perfect condition every 4.3 sec"],
  ["Alexandria", "Invincibility via body in stasis, flight, and vastly enhanced strength"],
  ["Allfather", "Can create mid-air portals from which to launch volleys of weapons"],
  ["Andrew Richter", "Specialized in computers and AI in combat"],
  ["Animos", "Limited time transformation to beast form with power nullification scream"],
  ["Annex", "Can meld with inorganic material and reshape it"],
  ["Anomaly", "Creates black spheres that can pull in opponents"],
  ["Arbiter", "Danger sense, can determine threat level of those surrounding an individual based on color"],
  ["Armsmaster / Defiant", "Tinker with specializations in miniaturization, hybridization, and efficiency"],
  ["Ash Beast", "Shapeshifting beast form made of explosions generated through constant matter-to-energy and energy-to-matter conversion"],
  ["Assault", "Manipulates kinetic energy on demand in combat"],
  ["August Prince", "Stops people from taking any action that could directly harm him"],
  ["Bakuda", "Bomb tinker has an innate understanding of mechanisms and catalysts"],
  ["Ballistic", "Imbues kinetic energy on touched objects"],
  ["Bambina", "Launches at high speeds, ricochets with resulting explosions on impacts"],
  ["Barker", "Converts utterances to an energy that can then be converted into a variety of"],
  ["Barrow", "Slowly replaces the environment within a fair radius with an otherworldly forest"],
  ["Bastion", "Can create forcefields and deflectors for defense"],
  ["Battery", "Charges herself up with immobility to grant enhanced speed, reflexes, strength, and electromagnetic telekinesis"],
  ["Bauble", "Glasswork tinker specialist with focused tools"],
  ["Big Rig", "Construction drone tinker specialist with focused tools"],
  ["Bitch / Hellhound", "Can morph dogs into massive monsters"],
  ["Biter", "Distorts the size of individual body parts"],
  ["Black Kaze", "Teleports, with momentary existence in all spaces between departure and arrival"],
  ["Blasto", "Wet tinker, specializes in creating life forms"],
  ["Blowout", "Telekinetically enhanced strength and durability that scales with the size and reaction of his"],
  ["Bonesaw", "Biology, anatomy, and physiology tinker specialist with focused tools"],
  ["Brandish", "Makes energy weapons and can turn into a near-invulnerable sphere"],
  ["Breed", "Creates small lifeforms that inhabit corpses, grow, and become more dangerous over time/after eating"],
  ["Browbeat", "Point-blank telekinesis and personal biokinesis for personal healing and self-alteration"],
  ["Burnscar", "Pyrokinetic and fireproof, can teleport through flames"],
  ["Butcher XIV / Quarrel", "Ranged pain inducement, enhanced durability, enhanced strength"],
  ["Cache", "Can store/retrieve items and individuals in a pocket dimension"],
  ["Califa de Perro", "Super strength and agility augmented with point-blank aerokinesis"],
  ["Campanile", "Giant growth with gravity-altering aura on demand in combat"],
  ["Canary", "Enhanced singing that makes anyone who hears it susceptible to suggestions"],
  ["Carnal", "Durable healer that accelerates healing by bathing in blood"],
  ["Chariot", "Tinker, produced devices, suits, and vehicles relating to movement and teleportation"],
  ["Cherish / Butcher XV", "Can manipulate/sense emotions gained all former Butcher powers"],
  ["Chevalier", "Can combine similar items, giving resulting item select qualities of different 'parent' items"],
  ["Chitter", "Can control rats on demand in combat"],
  ["Chronicler", "Can create solid mirrors of past events, potentially multiplying attack effectiveness"],
  ["Chubster", "Gained durability and ambient momentum dampening effect at will"],
  ["Chuckles", "Super speed in head and legs"],
  ["Cinderhands", "Generates intensely hot fire from his hands"],
  ["Circus", "Many weaker powers, including balance, personal pocket dimension, and pyrokinesis if flame is available"],
  ["Citrine", "Alters reality in a small area, adjusting physics or natural laws"],
  ["Clairvoyant", "Has and can grant complete clairvoyance, also overriding other perception powers"],
  ["Clockblocker", "Freezes objects in spacetime for a random duration with a touch"],
  ["Codex", "Causes permanent brain damage to targets in exchange for a temporary boost to her"],
  ["Coil", "Can split timelines to attempt alternate strategies at will"],
  ["Contessa", "Is shown the \"Path to Victory\" to anything she wants to do"],
  ["Cozen", "Generates pocket dimensions that can stow/produce items and individuals at range"],
  ["Crane the Harmonious", "Keen understanding of movement and fighting styles"],
  ["Cranial", "Neurology tinker specialist with focused tools"],
  ["Crawler", "Powerful regeneration and gains personal adaptations in response to any damage taken"],
  ["Cricket", "Vastly increased reflexes, personal sonar that could be keyed to disrupt others' senses"],
  ["Crimson", "Enhances strength and durability by drinking the blood of others"],
  ["Crucible", "Generates forcefields within which he can create incinerating heat"],
  ["Crusader", "Can create shades of himself to fight and lift himself"],
  ["Cuff", "Enhanced strength, durability, and metallokinesis, augmenting agility by manipulating own armor"],
  ["Daiichi", "Creates a physically enhanced phantom version of himself until his concentration breaks or it"],
  ["Damsel of Distress", "Can produce high recoil 'shotgun' bursts of warped space"],
  ["Dauntless", "Incrementally empowers items day-by-day, permanently physically enhancing them and giving them unique abilities"],
  ["Dinah Alcott", "Probabilistic precognition in reflex to receiving questions about future events"],
  ["Dispatch", "Creates opaque, inviolable bubbles wherein time is accelerated"],
  ["Dodge", "Pocket dimension tinker specialist with focused tools"],
  ["Doormaker", "Can open portals to anywhere in his sensory awareness, including across dimensions"],
  ["Dovetail", "Flight, drops a 'rain' of forcefield pellets that accumulate and hamper those caught in"],
  ["Dragon", "AI with the ability to replicate other Tinkers' work"],
  ["Echidna", "Body absorbs living tissues and develops related body parts"],
  ["Eidolon", "Has a vast store of varied powers"],
  ["Eligos", "Creates blades of air that boomerang back to him"],
  ["Epoch", "Can move things forward, backward, or pause them in time in ten-second intervals"],
  ["Exalt", "Powerful aerokinetic, powers worked optimally only once in a given"],
  ["Fathom", "Displaces people and objects to and from a dimension filled with water"],
  ["Faultline", "Can destroy inorganic matter with a touch"],
  ["Felix Swoop", "Has limited control over certain types of birds"],
  ["Fenja / Menja", "Grows in size, with a space-warping effect granting increased durability at the same time"],
  ["Flashbang", "Creates orbs of energy that detonate explosively or concussively"],
  ["Flechette / Foil", "Can charge objects, rendering them immune to conventional physics (mass, friction, etc)"],
  ["Fleur", "Can create telekinetically controlled flowers or firecrackers of light"],
  ["Florence Vasil", "Can force people to follow actions if a set of conditions"],
  ["Floret", "Creates \"buds\" with intricate crystals, capable of a large variety of effects"],
  ["Fog", "Turns into living fog that causes harm to those within"],
  ["Gallant", "Shoots concussive blasts that inflict targets with specific emotions"],
  ["Galvanate", "Capable of granting invincibility, enhanced strength"],
  ["Garotte", "Case 53, living mass of tentacles that grab and crush independently of her will"],
  ["Gavel", "Power reduces incoming damage to a set amount"],
  ["Genesis", "Enters catatonic state to create and then control a body"],
  ["Geomancer", "Created streams of rubble, was stronger if rubble is already existent"],
  ["Getaway", "Teleporter who can only teleport to areas set up in advance"],
  ["Glace", "Cryogenics and stasis tinker specialist with focused tools"],
  ["Glaistig Uaine / Valkyrie", "Can harvest the powers of a parahuman by either touching them"],
  ["Glory Girl", "Emotion-affecting aura focused on awe/intimidation, flight"],
  ["Golem", "Can push his limbs into surfaces"],
  ["Grace", "Has increased agility and perception, can grant extremity/body part enhanced power and invulnerability/power immunity"],
  ["Grandiose", "Flies, has a personal forcefield that glows brighter over time before detonating"],
  ["Gray Boy", "Can trap those around him in manipulable time loops of pain at will"],
  ["Gregor the Snail", "Case 53, is boneless, durable, and produces various slimes with differing effects"],
  ["Grue", "Produces smoke-like darkness that dampens sound and light"],
  ["Gully", "Enhanced strength, thick-skinned, terrakinetic Case 53"],
  ["Gwerrus", "Super strength, reflects damage back onto the attacker"],
  ["Hack Job", "Enhanced strength and durability, and close proximity power nullification"],
  ["Halo", "Creates a five-foot wide halo that can be moved at will"],
  ["Hatchet Face", "Enhanced strength and durability, has an aura that nullifies the powers of those nearby"],
  ["Heartbreaker", "Can dramatically affect the emotions of those within his line of sight"],
  ["Hemorrhagia", "Hemokinetic with personal biokinesis and recovery"],
  ["Hero", "Wavelength and frequency tinker specialist with focused tools"],
  ["Hookwolf", "Can transform into a mass of blades and metal objects"],
  ["Hoyden", "Super strength/durability, resistance to long-range powers, and explosions on contact with attacks and attackers"],
  ["Ignus Fatuus", "Has a dimensional \"flickering\" ability that allows it to heal itself"],
  ["Imp", "Affects memories about herself in a way that makes her completely unnoticable and unrecallable"],
  ["Ingenue", "Alters and augments powers, but also alters the psychology of the victim"],
  ["Iron Rain", "Materialized spears/blades/weights blades at high altitudes and minor ferrokinesis allowed some aiming of the"],
  ["Jack Slash", "Can extend a blade's cutting edge nigh-infinitely"],
  ["Jacklight", "Creates orbs of light that redirect movement in the immediate vicinity"],
  ["Jamestowner", "Radiation blaster, could focus effects to turn individuals into docile (to him) mutants"],
  ["Jouster", "Conducts various effects along his lance"],
  ["Juliette Vasil", "Can make one person she targets freeze in place"],
  ["Kaiser", "Can produce all manner of metal shapes and objects from any solid surface"],
  ["Kazikli Bey", "Aerokinetic that is capable of forming whirlwinds and slicing people with air compressed into"],
  ["Khepri", "Jailbroken Administrator shard capable of controlling sapient creatures within sixteen feet of the host"],
  ["Kid Win", "Tinker specializing in modular devices, or ones with alternate settings or uses"],
  ["King", "Enhanced strength and endurance Transfers wounds, damage, and effects to those he's touched in"],
  ["King of Cups", "Healer, can create phantom limbs and recovery"],
  ["Krieg", "Wide range kinetic manipulation, more powerful closer to him, resulting in brute classification"],
  ["Kudzu", "Self-replication cape, clones could self-replicate Reined in by psychological drawback"],
  ["Lab Rat", "Specializes in tinker drugs that turn subjects into monsters while storing their original state"],
  ["Labyrinth", "Can massively manipulate surroundings by tapping into alternate universes"],
  ["Lady Photon", "Can fly, shoot energy beams, and project forcefields"],
  ["Laserdream", "Can fly, project weak forcefields, and shoot precisely controlled, powerful energy beams"],
  ["Leet", "Tinker with no limits, except that creations have a chance to misfire respective to"],
  ["Legend", "A flying laser-blaster with a large toolbox of possible types of laser and laser"],
  ["Leister", "Spear wielder with the ability to distort spear and convey self to target point"],
  ["Leonid", "Capable of hearing everything nearby, as well as teleporting himself to areas within earshot"],
  ["Ligeia", "Creates portals to otherworldly ocean depths"],
  ["Lizardtail", "Aura regenerates those in the area"],
  ["Lung", "Gains increasingly powerful strength, durability, healing"],
  ["Lustrum", "Massive breaker form fueled by draining from the physical and mental faculties of those"],
  ["Mannequin / Sphere", "Tinker specializes in closed systems, typically augmentations for a multi-piece suit containing his own"],
  ["Manpower", "Electromagnetic forcefield, used to augment own strength"],
  ["Mantellum", "Case 53 Blocks out sensory aspects of powers progressively more with proximity"],
  ["Marquis", "Skilled osteokinetic, produced and re-shaped a variety of bone constructions"],
  ["Masamune", "Can mass produce tinkertech specialist with focused tools"],
  ["Matryoshka", "Can unfold herself into ribbons Absorbs others, gaining memories/traits at the cost of her"],
  ["Miasma", "Can turn invisible and undetectable, spewing off an odorless gas that causes a variety"],
  ["Miss Militia", "Can call forth conventional weaponry, or modify the summoned weaponry at will"],
  ["Mockshow / Romp", "Can animate objects with a touch and command them"],
  ["Moord Nag", "Controls a massive, smoke-like pet that reacts to malicious intent and gets bigger and"],
  ["Mouse Protector", "Could teleport to tagged people or objects"],
  ["Mr. Keene", "Hyper-skilled, emphasizing teamwork and cooperation, secondary power enabled emotion reading"],
  ["Murder Rat", "Hybrid of Mouse Protector & Ravager"],
  ["Mush", "Formed a hulking body of detritus"],
  ["Myrddin", "Carried several pocket dimensions, flinging them out and activating them for a selection of"],
  ["Narwhal", "Can generate forcefields that can be finely moved and maniplated"],
  ["Nero", "Can create materials/goods Can track the location of the things he creates"],
  ["Newter", "Case 53, can adhere to surfaces"],
  ["Nice Guy", "Forces all others to regard him as friendly and non-threatening, regardless of his actions"],
  ["Night", "When not being observed, transforms into a strong, fast, and durable monster"],
  ["Night Hag", "Has a breaker state that can enter and \"infect\" surrounding material"],
  ["Nilbog", "Creates custom minions after recycling existing living matter"],
  ["Nix", "Cam produce harmless gas that could be shaped into controlled but fragile silent images"],
  ["Null / Zero", "Can split and delegate powers amongst a group"],
  ["Nyx", "Can produce toxic gas that could be shaped into controlled but fragile silent images"],
  ["Oliver", "Slowly shifts body into becoming personally attractive"],
  ["One", "Brainwashing-capable thinker for prediction at need"],
  ["Oni Lee", "Teleports, leaving behind a duplicate that can act autonomously for 5-10 seconds before bursting"],
  ["Othala", "Can grant temporary powers with a touch"],
  ["Othello", "Has an invisible, untouchable mirror self in a mirror world"],
  ["Panacea / Amy", "Touch-based biokinesis Can sense the biology of any lifeform at a touch, and modify"],
  ["Parian", "Can manipulate lightweight objects with telekinesis"],
  ["Particulate", "Dust tinker specialist with focused tools"],
  ["Perdition", "Can set a target's state and location back to how it was three seconds"],
  ["Phir S\u0113", "Creates portals that lead a couple of minutes back in time"],
  ["Prefab", "Can create walls over the course of several seconds"],
  ["Pretender", "Can take over the bodies of others"],
  ["Prism", "Can split self into three clones"],
  ["Professor Haywire", "Interdimentional technology tinker, could also build more general tinker gadgets"],
  ["Prolapse", "Biokinetic durability and size, could turn people inside-out with a touch"],
  ["Psychosoma", "Can turn people into controlled, wall-crawling beasts"],
  ["Purity", "Can fly, and can charge up with light over time and shoot it back"],
  ["Pyrotechnical", "Flame manipulation, special effects, and gun tinker"],
  ["Queen of Swords", "Can connect to nearby capes and combine the effects of their powers into bullets"],
  ["Ravager", "Enhanced physique, all wounds inflicted would fester and scar horrifically if not tended to"],
  ["Raymancer", "Creates innumerable energy blasts and condenses them to devastating effect with a lens he"],
  ["Regent / Hijack", "Can cause involuntary muscle movements in other's bodies"],
  ["Ren", "Can suction air into his mouth with enough force to pull objects towards himself"],
  ["Revel", "Can absorb energy with a lantern and launch it back as programmable energy orbs"],
  ["Rifle", "Can increase the range of projectile weapons"],
  ["Rime", "Can fly, and can create compressed ice fractals that can curve in the air"],
  ["Rosary", "Can break nonliving objects into small, sharp fragments that can be weakly telekinetically controlled"],
  ["Rune", "Can attune to discrete objects with momentary touch"],
  ["Saint", "Tinker 0, maintains an understanding of Dragon's tech via Teacher"],
  ["Samuel Vasil", "Can sense people based on their emotions"],
  ["Sanguine", "Can manipulate blood on demand in combat"],
  ["Satyrical", "Can shapeshift into other people, and produce clones capable of the same"],
  ["Scanner", "Can grant others the enhanced ability to read into verbal and non-verbal cues"],
  ["Scape One", "Can spatially twist matter until it dissolves into radioactive dust"],
  ["Scape Two", "Can press self and others into 2D space, hiding them on surfaces"],
  ["Scapegoat", "Can transfer physical and mental afflictions to and from himself"],
  ["Screamer", "Can manipulate sound with a high level of fidelity to pull of feats like"],
  ["Screen", "Allows those connected to them to communicate and handle information overload during thinker visions"],
  ["Scrub", "Chaotically generates spherical bursts that remove non-structural components of nearby matter from existence"],
  ["Sere", "Can violently draw in moisture in a tight cone or personal field"],
  ["Shadow Stalker", "Can shift self and touched objects into a shadow state"],
  ["Shamrock", "Case 53, utilizes telekinesis and clairvoyance at a microscopic level to emulate impossible levels"],
  ["Shatterbird", "Uses ultrasonic frequencies to manipulate silicon"],
  ["Sh\u00e9n Y\u00f9", "Thinker, maintained expert tactical abilities and understanding of movements and maneuvers"],
  ["Shielder", "Can fly, create lasers, and project forcefields"],
  ["Shuffle", "Can teleport sections of a landscape"],
  ["Siberian", "Generates an unstoppable and immovable projection that can share it's properties with people and"],
  ["Sifara", "Can spatially lock the relative positions and orientations of people, objects, and effects"],
  ["Silkroad", "Able to lay strips of power that multiply others' speed"],
  ["Skidmark", "Can cover surfaces with a field of unidirectional repulsive force"],
  ["Skinslip", "Regenerator capable of manipulating his own skin"],
  ["Skitter / Weaver", "Can telepathically control and communicate with bugs"],
  ["Sleeper", "Unknown wide-area effect with unclear rules and extreme danger"],
  ["Snowmann", "Tinker specialized in closed systems, with a heavy focus on the use of cold"],
  ["Spitfire", "Can forcefully spit a chemical that ignites intensely on contact with people or objects"],
  ["Spree", "Can rapidly generate clones, which degrade to the point of being braindead in seconds"],
  ["Spruce", "Can generate orbs that have a disintegration effect"],
  ["Spur", "Precog whose effectiveness increases with chaos and emotionality"],
  ["Squealer", "Vehicle tinker, focused on adding size, augmentations, and additions to the vehicles"],
  ["Stinger", "Tinker specializing in propulsion, mainly jetpacks and missiles"],
  ["Stormtiger", "Aerokinetic Can compress air into claws that can detonate explosively at will, carry sounds"],
  ["Strider", "Capable of mass teleportation for rapid repositioning"],
  ["String Theory", "Tinker favoring macro-scale doomsday devices, creates objects that have timers built in from the"],
  ["Subject 3016", "Capable of manifesting parts of his body from various dimensions"],
  ["Sundancer", "Can create balls of intense heat and light of varying sizes"],
  ["Tattletale", "Can intuitively extrapolate large amounts of data from a given source"],
  ["Teacher", "Grants tinker and thinker powers to those he touches"],
  ["Tecton", "Tinker specializing in power armor and short-range weapons/tools"],
  ["The Custodian", "Nearly intangible, capable of affecting surroundings through mass self-replication"],
  ["The Number Man / Harbinger", "A near-perfect calculator Effectively makes him omniscient regarding anything he observes that could be"],
  ["Thirteenth Hour / Standstill", "Can selectively force those around her into a sleep-like trance"],
  ["T\u014dng L\u00edng T\u01ce / Ziggurat", "Produced shaker waves that altered terrain within their scope, raising, restructuring, or leveling buildings"],
  ["Topsy", "Can alter the direction of the gravitational pull on himself and others"],
  ["Toy Soldier", "A power suit tinker with a suit the size of a small building"],
  ["Trainwreck", "Case 43, uses pseudopod-like limbs to generate power for tinker equipment"],
  ["Trickster", "Can swap the positions of any two objects or people within field of view"],
  ["Triumph", "Enhanced athleticism and durability Can control the force and area of effect of his"],
  ["Two", "Enhances the powers of nearby parahumans"],
  ["Tyrant", "Can transfer damage to anyone who had been previously touched within a certain time"],
  ["Uber", "Can maintain high-level mastery of any specific technique for as long as he maintains"],
  ["Ursa Aurora", "Creates bear-shaped forcefields on demand in combat"],
  ["Usher", "Provided single-target power immunity to others"],
  ["Valefor", "Can implant suggestions and instructions in those he makes eye contact with"],
  ["Vantage", "Super strength/reflexes that scale with the number of opponents faced"],
  ["Velocity", "Can move at supersonic speeds with the cost of limited effect on the world"],
  ["Vex", "Can fill empty space with razor-sharp forcefields"],
  ["Victor", "Steals skills of those nearby, the breadth and depth of the experience taken scaling"],
  ["Vista", "Can manipulate space, changing distances and distorting non-living material"],
  ["Wanton", "Can temporarily turn into a telekinetic whirlwind"],
  ["Watch", "Intense, short-ranged clairvoyance, short bursts of super speed"],
  ["Weld", "Case 53, is made of metal, which he bonds to and absorbs upon touch"],
  ["Whirlygig", "Telekinesis, but only in a counter-clockwise direction around herself"],
  ["Winter", "Can dampen physical and mental energy within an area"],
  ["Young Buck", "Can fly and turn himself into a living projectile that shoots in a straight"],
]));

function compactSummaryText(value) {
  const text = String(value == null ? "" : value).replace(/\s+/g, " ").trim();
  if (!text) {
    return "";
  }

  const words = text.split(" ");
  if (words.length <= 14) {
    return text;
  }
  return `${words.slice(0, 14).join(" ")}...`;
}

function normalizeCapeKey(value) {
  return String(value == null ? "" : value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

const WORM_POWER_SUMMARIES_NORMALIZED = Object.freeze(
  Object.fromEntries(
    Object.entries(WORM_POWER_SUMMARIES).map(([capeName, summary]) => [normalizeCapeKey(capeName), summary]),
  ),
);

function powerSummaryForCape(capeName, fallbackPower = "") {
  const key = String(capeName == null ? "" : capeName).trim();
  if (!key) {
    return String(fallbackPower == null ? "" : fallbackPower).replace(/\s+/g, " ").trim();
  }

  if (Object.prototype.hasOwnProperty.call(WORM_POWER_SUMMARIES, key)) {
    return String(WORM_POWER_SUMMARIES[key]).replace(/\s+/g, " ").trim();
  }

  const normalizedKey = normalizeCapeKey(key);
  if (normalizedKey && Object.prototype.hasOwnProperty.call(WORM_POWER_SUMMARIES_NORMALIZED, normalizedKey)) {
    return String(WORM_POWER_SUMMARIES_NORMALIZED[normalizedKey]).replace(/\s+/g, " ").trim();
  }

  return String(fallbackPower == null ? "" : fallbackPower).replace(/\s+/g, " ").trim();
}

function summarizedPowerForCape(capeName, fallbackPower = "") {
  return compactSummaryText(powerSummaryForCape(capeName, fallbackPower));
}

const WORM_FLAVOR_ACTION_KEYS = Object.freeze([
  "attack",
  "defense",
  "info",
  "manipulation",
  "speed",
  "stealth",
]);

const SUMMARY_STOP_WORDS = Object.freeze(new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "can",
  "for",
  "from",
  "has",
  "in",
  "into",
  "is",
  "it",
  "its",
  "of",
  "on",
  "or",
  "that",
  "the",
  "their",
  "them",
  "to",
  "with",
]));

function stableHash(value) {
  const text = String(value == null ? "" : value);
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return hash >>> 0;
}

function pickBySeed(list, seed, offset = 0) {
  const values = Array.isArray(list) ? list.filter((item) => typeof item === "string" && item) : [];
  if (!values.length) {
    return "";
  }
  const index = Math.abs((seed + offset) % values.length);
  return values[index];
}

function tokenizeSummary(summary) {
  return String(summary == null ? "" : summary)
    .toLowerCase()
    .replace(/[^a-z0-9'\-\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word && !SUMMARY_STOP_WORDS.has(word));
}

function buildSummaryMotif(summary, seed) {
  const words = tokenizeSummary(summary);
  if (words.length === 0) {
    return "raw force";
  }
  if (words.length === 1) {
    return words[0];
  }
  const start = Math.abs(seed % (words.length - 1));
  return `${words[start]} ${words[start + 1]}`;
}

function normalizeActionType(actionType) {
  const key = String(actionType == null ? "" : actionType).trim().toLowerCase();
  return WORM_FLAVOR_ACTION_KEYS.includes(key) ? key : "attack";
}

function buildFlavorVariants(summary, actionType, seed) {
  const motif = buildSummaryMotif(summary, seed);
  const motifAlt = buildSummaryMotif(summary, seed + 11);
  const motifThird = buildSummaryMotif(summary, seed + 23);

  if (actionType === "attack") {
    return Object.freeze({
      success: Object.freeze([
        `{name} hammers ${motif} into {target}{amountClause}.`,
        `${String(motifAlt)} drives {name}'s blow through {target}{amountClause}.`,
        `{name} turns ${motifThird} into a direct hit on {target}{amountClause}.`,
      ]),
      fail: Object.freeze([
        `{name} commits ${motif}, but the strike glances off.`,
        `${String(motifAlt)} surges, then slips wide of the mark.`,
        `{name} winds up ${motifThird}, but loses the opening.`,
      ]),
    });
  }

  if (actionType === "defense") {
    return Object.freeze({
      success: Object.freeze([
        `{name} braces with ${motif} and draws the pressure off {target}{amountClause}.`,
        `${String(motifAlt)} sets a hard guard around {name}{amountClause}.`,
        `{name} anchors ${motifThird}, intercepting the next threat{amountClause}.`,
      ]),
      fail: Object.freeze([
        `${String(motif)} starts to hold, then the guard cracks.`,
        `{name} raises ${motifAlt}, but the cover does not stick.`,
        `${String(motifThird)} slips out of line, leaving {name} exposed.`,
      ]),
    });
  }

  if (actionType === "info") {
    return Object.freeze({
      success: Object.freeze([
        `{name} reads ${motif} and maps a weakness in {target}{amountClause}.`,
        `${String(motifAlt)} reveals a pattern {name} can exploit{amountClause}.`,
        `{name} tracks ${motifThird} and strips clarity from {target}{amountClause}.`,
      ]),
      fail: Object.freeze([
        `${String(motif)} yields noise, not insight.`,
        `{name} searches through ${motifAlt}, but gets a false read.`,
        `${String(motifThird)} clouds the trail and {name} finds no opening.`,
      ]),
    });
  }

  if (actionType === "manipulation") {
    return Object.freeze({
      success: Object.freeze([
        `{name} twists ${motif} and turns {target} against their own timing{amountClause}.`,
        `${String(motifAlt)} lets {name} redirect the next move from {target}{amountClause}.`,
        `{name} threads ${motifThird} into the exchange and scrambles {target}{amountClause}.`,
      ]),
      fail: Object.freeze([
        `${String(motif)} almost takes hold, then breaks loose.`,
        `{name} reaches with ${motifAlt}, but cannot steer the moment.`,
        `${String(motifThird)} resists, and the turn fails to land.`,
      ]),
    });
  }

  if (actionType === "speed") {
    return Object.freeze({
      success: Object.freeze([
        `{name} snaps into motion on ${motif} and leaves {target} behind.`,
        `${String(motifAlt)} sharpens {name}'s burst; the counter misses.`,
        `{name} rides ${motifThird} through the gap before {target} can react.`,
      ]),
      fail: Object.freeze([
        `${String(motif)} flickers, but {name} cannot clear the line.`,
        `{name} lunges on ${motifAlt}, a beat too late.`,
        `${String(motifThird)} stutters and the dodge window closes.`,
      ]),
    });
  }

  return Object.freeze({
    success: Object.freeze([
      `{name} veils in ${motif} and drops out of {target}'s sight.`,
      `${String(motifAlt)} muffles every trace as {name} slips past {target}.`,
      `{name} folds ${motifThird} tight and disappears from the angle.`,
    ]),
    fail: Object.freeze([
      `${String(motif)} leaks a tell, and {name} is spotted.`,
      `{name} hides in ${motifAlt}, but leaves a trail.`,
      `${String(motifThird)} falters and the concealment breaks.`,
    ]),
  });
}

function getCapeActionFlavorTemplates(capeName, actionType, fallbackPower = "") {
  const normalizedCape = String(capeName == null ? "" : capeName).trim();
  const normalizedAction = normalizeActionType(actionType);
  const summary = powerSummaryForCape(normalizedCape, fallbackPower);
  const seed = stableHash(`${normalizedCape}|${summary}|${normalizedAction}`);
  const variants = buildFlavorVariants(summary, normalizedAction, seed);
  const rotated = Object.freeze({
    success: Object.freeze([
      pickBySeed(variants.success, seed, 0),
      pickBySeed(variants.success, seed, 1),
      pickBySeed(variants.success, seed, 2),
    ]),
    fail: Object.freeze([
      pickBySeed(variants.fail, seed, 0),
      pickBySeed(variants.fail, seed, 1),
      pickBySeed(variants.fail, seed, 2),
    ]),
  });

  return Object.freeze({
    cape: normalizedCape,
    actionType: normalizedAction,
    summary,
    success: rotated.success,
    fail: rotated.fail,
  });
}

function getCapeFlavorTemplate(capeName, actionType, success, fallbackPower = "") {
  const templates = getCapeActionFlavorTemplates(capeName, actionType, fallbackPower);
  const key = Boolean(success) ? "success" : "fail";
  return templates[key][0] || "{name} acts.";
}

function getCapeFlavorTemplatesByAction(capeName, fallbackPower = "") {
  const result = {};
  for (let i = 0; i < WORM_FLAVOR_ACTION_KEYS.length; i += 1) {
    const actionKey = WORM_FLAVOR_ACTION_KEYS[i];
    result[actionKey] = getCapeActionFlavorTemplates(capeName, actionKey, fallbackPower);
  }
  return Object.freeze(result);
}

export {
  WORM_POWER_SUMMARIES,
  WORM_FLAVOR_ACTION_KEYS,
  powerSummaryForCape,
  summarizedPowerForCape,
  getCapeActionFlavorTemplates,
  getCapeFlavorTemplate,
  getCapeFlavorTemplatesByAction,
};
