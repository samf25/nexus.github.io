# Artifact Tracker (Current Build)

Snapshot date: 2026-04-26

## Actively Implemented Progression Artifacts (in use)

- Nexus progression:
  - `Archive Address`, `Nexus Bearings`, `Index String`, `Constellation Order`, `Wave-I Passkey`, `Wave-II Passkey`, `Wave-III Passkey`
- Cradle progression:
  - `Starter Core`, `Seven-Year Festival Tournament Pass`, `Cultivation Potion`, `Jade Condensation Elixir`, `Checkpoint Pyramid`
- Worm/Cradle summon chain:
  - `Leviathan Summoning Amulet`, `Simurgh Summoning Bracelet`, `Behemoth Summoning Anklet`
- Worm endboss sigils:
  - `Leviathan Core Sigil`, `Simurgh Feather Sigil`, `Behemoth Ember Sigil`
- DCC gates and finale locks:
  - `DCC Floor-3 Key`, `The Dungeon Anarchist's Cookbook`, `The Transient, Ephemeral, Fleeting Vault of the Mortal World. The Evanescent Safe of Passing Moments, the Faded Chest of Then and Them. The Box of Incontinuity`
- Practical Guide gate set (persistent):
  - `Westwall Ram`, `Oathbreaker Bell`, `Sunforge Powder`, `Mirror of Nine Lies`, `Green Wax Seal`, `Veiled Signet`, `Sunless Lantern`, `Bone Key`, `River-Map of Silt`, `Ashen Treaty Pins`, `Red Petition Docket`, `Saintglass Vial`, `Ivory Truce Fork`, `Nightwine Ledger`, `Mercy Bell Chime`
- Revelation chains (consumed by progression):
  - Underlord: `Underlord Revelation I`, `Underlord Revelation II`, `Underlord Revelation Cipher`
  - Overlord: `Overlord Revelation I`, `Overlord Revelation II`, `Overlord Revelation Cipher`
  - Archlord: `Archlord Revelation I`, `Archlord Revelation II`, `Archlord Revelation Cipher`
- Finale puzzle artifacts (persistent phase modifiers):
  - `Mercy Charter Seal`, `Conqueror's Due Process`, `Measured Iron Mandate`, `Table of Last Reconciliation`, `Midnight Carving Accord`, `Bell of Unbroken Guest-Right`, `Consistency Key`, `Public-Private Key`, `Homomorphism Key`, `Field Marker`, `Proof Stamp`, `Congruence Lens`, `Symmetry Mirror`, `Curvature Compass`

## Referenced but Not Fully Implemented

- `DCC Floor-2 Key`
  - Granted from TWI03 reward chain, but DCC gate logic currently only checks `DCC Floor-3 Key`.
- `DCC Floor-4 Key`
  - No active grant/use path found.
- `DCC Floor-5 Key`
  - No active grant/use path found.

## Removed from Reward Pool (auto-pruned)

The following artifacts are now suppressed as node rewards and removed from saves during load/import cleanup:

- `Spire Badge`
- `Mana Pair`
- `Blueprint Thread`
- `Madra Charges`
- `Path Schema`
- `Forged Component`
- `Remnant Diagram`
- `Resonance Thread`
- `Advancement Thread`
- `Revelation Thread`
- `Advancement Seal; Technique Set`
- `Crawler Badge`
- `Palimpsest Letters`
- `Cycle Count`
- `Memory Marker`
- `Route Thread`
- `Common Tongue Scrap`
- `Board Code`

## Implemented but Currently Unused As Gameplay Dependencies

The following active-node blueprint rewards are currently trophy-only (no downstream checks/use consumers found in `src`):

- Hall of Proofs: `Witness Token`, `Proof Frame`, `Necessity Lens`
- Prime Vault: `Prime Teeth`, `Congruence Pair`, `Square Root Lantern`
- Symmetry Forge: `Operation Card`, `Orbit Ribbon`, `Mirror Pair`, `Lattice Hook`
- Curved Atlas: `Path Thread`, `Chart Pair`, `Curvature Chip`, `Transport Arrow`
- Practical Guide (blueprint reward fields): `Story Beat A`, `Role Card`, `Storyweight Seed`, `Formation Thread`, `Moral Thread`, `Dinner Thread`
- Worm (blueprint reward fields): `Trauma Pair`, `Harbor Coordinates`, `Buzz Pattern`, `Threat Pattern`, `Evac Grid`, `Vial Key`

## Notes

- Several entries above are intentionally superseded by custom reward overrides and retained only in blueprint metadata.
- Practical Guide required artifacts and role/win artifacts are intentionally persistent and not consumed by normal artifact use.
