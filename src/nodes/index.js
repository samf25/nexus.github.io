
import { HUB01_NODE_EXPERIENCE } from "./hub/hub01ShatteredFrontispiece.js";
import { HUB02_NODE_EXPERIENCE } from "./hub/hub02CompassOfGenres.js";


const NODE_EXPERIENCE_REGISTRY = Object.freeze({
  HUB01: HUB01_NODE_EXPERIENCE,
  HUB02: HUB02_NODE_EXPERIENCE,
});

export function getNodeExperience(nodeId) {
  return NODE_EXPERIENCE_REGISTRY[nodeId] || null;
}
