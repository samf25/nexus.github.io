# Loot Types by Region

Snapshot date: 2026-04-26

## Core Loot Tables (from `src/systems/loot.js`)

### Cradle (`crd`)
- `Cycling Surge Draft` (consumable boost)
- `Refiner's Focus Draft` (consumable boost)
- `Soul Crystal` (socketable power item)
- `Deep Well Socket` (slot expansion)
- `Combat Relic` (combat stat booster)

### Worm (`worm`)
- `Shard Enhancement` (single-stat cape shard boost)
- `Shard Lattice Socket` (consumed on a specific cape to expand that cape's shard slots)
- `Sickbay Expansion Permit` (more healing slots)
- `Advanced Hiring Dossier` (improves hiring rarity window)

### Dungeon Crawler Carl (`dcc`)
- `Crawler Armor` (run-limited armor with possible embedded enchants)
- Embedded armor enchants can add stats, ability access, ability slots, or extended run lifespan

### Arcane Ascension (`aa`)
- `Aether Capacitor` (mana cap)
- `Precision Lens` (rune accuracy)
- `Regeneration Coil` (mana regen)
- `Auxiliary Workshop Armature` (extra workshop slot)
- `Court Market Seal` (sell bonus + buy discount)
- `Glyphwork Focus Charm` (accuracy)
- `Junk Enchantment Fragment` (low-value craft output)

## Region-Specific Fixed Drops / Milestones

### Nexus Hub
- Key progression artifacts (Wave-I, Wave-II, Wave-III unlock flow)
- No random loot-table drops

### Cradle
- Fixed artifacts from CRD04+ (`Cultivation Potion`, `Jade Condensation Elixir`, summon artifacts, sigils)
- CRD07 hunts also drop custom `crd_advancement_material` loot items for Underlord progression
- CRD08/CRD11 add cross-region loot bundles (CRD/WORM/DCC pulls)

### Worm
- Arena first-win artifacts by difficulty (`Ashen Treaty Pins`, `Red Petition Docket`, `Saintglass Vial`)
- Arena boss/endbringer chains grant fixed sigils + PTG artifacts + bundled random loot pulls
- WORM06/WORM08 include high-value multi-region loot bundles

### Wandering Inn
- TWI03 quests produce out-of-region random loot rolls and deterministic milestone artifacts:
  - `DCC Floor-2 Key`
  - `Cape Compactifier`
  - `Wave-III Passkey`
  - `x10 Hiring Access`
  - `Box of Incontinuity`

### Dungeon Crawler Carl
- Procedural in-run drops from DCC-specific room loot table
- Floor boss first-kill artifacts:
  - Floor 3: `Dockside Broker Contract`
  - Floor 4: `National Broker Mandate`
  - Floor 5: `The Dungeon Anarchist's Cookbook`

### Arcane Ascension
- AA02 tome pulls generate loot items (primarily AA table via crystal spending)
- AA03 crafting can output AA and cross-region loot depending on craft quality/path

### Practical Guide to Evil
- Primary outputs are progression artifacts (requirements/revelation/finale modifiers), not random loot-table drops

### Mother of Learning
- Primarily reset/prestige systems; no dedicated random loot table

### Math Vaults (LOG/NUM/ALG/GEO)
- Primarily fixed artifact rewards (including PTG requirement artifacts and finale-modifier artifacts)
- No dedicated random loot-table drops

### Final Arc
- Consumes resources and uses artifact puzzle metadata; no standalone random loot table
