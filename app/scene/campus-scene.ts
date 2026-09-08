import type * as THREE from "three";

export type CampusSceneOptions = {
  onModeChange?: (night: boolean) => void;
  onBackgroundChange?: (color: string) => void;
};

export type CampusScene = {
  sceneObjects: Record<string, THREE.Object3D>;
  lights: Record<string, THREE.Light>;
  setDayMode(): void;
  setNightMode(): void;
  toggleDayNight(): void;
  resetView(): void;
  setActive(active: boolean): void;
  dispose(): void;
};
