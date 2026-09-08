import { createYanchaoCampusModel } from "./yanchao-campus-model";
import { createSimpleCampusScene } from "./simple-campus";
import type { CampusSceneOptions } from "./campus-scene";

export function createYanchaoScene(host: HTMLElement, options: CampusSceneOptions = {}) {
  return createSimpleCampusScene(host, "燕巢校區", options, createYanchaoCampusModel);
}
