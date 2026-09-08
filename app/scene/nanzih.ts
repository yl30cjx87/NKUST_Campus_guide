import { createNanzihCampusModel } from "./nanzih-campus-model";
import { createSimpleCampusScene } from "./simple-campus";
import type { CampusSceneOptions } from "./campus-scene";

export function createNanzihScene(host: HTMLElement, options: CampusSceneOptions = {}) {
  return createSimpleCampusScene(host, "楠梓校區", options, createNanzihCampusModel);
}
