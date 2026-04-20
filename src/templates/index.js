import { renderBoardPuzzle } from "./boardPuzzle.js";
import { renderBossAssembler } from "./bossAssembler.js";
import { renderCanvasPuzzle } from "./canvasPuzzle.js";
import { renderCraftingPage } from "./craftingPage.js";
import { renderDialogueState } from "./dialogueState.js";
import { renderDocumentPuzzle } from "./documentPuzzle.js";
import { renderDungeonSystem } from "./dungeonSystem.js";
import { renderIncrementalSystem } from "./incrementalSystem.js";
import { renderMapPlanner } from "./mapPlanner.js";
import { renderResponsivePuzzle } from "./responsivePuzzle.js";
import { renderSchedulingSystem } from "./schedulingSystem.js";

export const TEMPLATE_RENDERERS = {
  CanvasPuzzle: renderCanvasPuzzle,
  BoardPuzzle: renderBoardPuzzle,
  DocumentPuzzle: renderDocumentPuzzle,
  MapPlanner: renderMapPlanner,
  CraftingPage: renderCraftingPage,
  IncrementalSystem: renderIncrementalSystem,
  SchedulingSystem: renderSchedulingSystem,
  DungeonSystem: renderDungeonSystem,
  DialogueState: renderDialogueState,
  BossAssembler: renderBossAssembler,
  ResponsivePuzzle: renderResponsivePuzzle,
  RegionHub: renderBoardPuzzle,
};

export function getTemplateRenderer(canonicalName) {
  return TEMPLATE_RENDERERS[canonicalName] || renderBoardPuzzle;
}
