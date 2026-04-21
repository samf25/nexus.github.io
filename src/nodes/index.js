import { HUB01_NODE_EXPERIENCE } from "./hub/hub01ShatteredFrontispiece.js";
import { HUB02_NODE_EXPERIENCE } from "./hub/hub02CompassOfGenres.js";
import { HUB03_NODE_EXPERIENCE } from "./hub/hub03MarginalIndex.js";
import { HUB04_NODE_EXPERIENCE } from "./hub/hub04ObservatoryCalibration.js";
import { HUB05_NODE_EXPERIENCE } from "./hub/hub05FirstCrossroad.js";
import { HUB06_NODE_EXPERIENCE } from "./hub/hub06CorrespondenceUnlock.js";
import { HUB07_NODE_EXPERIENCE } from "./hub/hub07TornDedication.js";
import { CRD01_NODE_EXPERIENCE } from "./cradle/crd01PathSeeding.js";
import { CRD02_NODE_EXPERIENCE } from "./cradle/crd02MadraWell.js";
import { CRD03_NODE_EXPERIENCE } from "./cradle/crd03AuraAlignment.js";
import { CRD04_NODE_EXPERIENCE } from "./cradle/crd04SevenYearFestival.js";
import { WORM01_NODE_EXPERIENCE } from "./worm/worm01DeckDuel.js";

const NODE_EXPERIENCE_REGISTRY = Object.freeze({
  HUB01: HUB01_NODE_EXPERIENCE,
  HUB02: HUB02_NODE_EXPERIENCE,
  HUB03: HUB03_NODE_EXPERIENCE,
  HUB04: HUB04_NODE_EXPERIENCE,
  HUB05: HUB05_NODE_EXPERIENCE,
  HUB06: HUB06_NODE_EXPERIENCE,
  HUB07: HUB07_NODE_EXPERIENCE,
  CRD01: CRD01_NODE_EXPERIENCE,
  CRD02: CRD02_NODE_EXPERIENCE,
  CRD03: CRD03_NODE_EXPERIENCE,
  CRD04: CRD04_NODE_EXPERIENCE,
  WORM01: WORM01_NODE_EXPERIENCE,
});

export function getNodeExperience(nodeId) {
  return NODE_EXPERIENCE_REGISTRY[nodeId] || null;
}
