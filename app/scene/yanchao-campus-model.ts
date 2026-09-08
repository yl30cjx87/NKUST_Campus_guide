import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

type V3 = [number, number, number];

export function createYanchaoCampusModel() {
  const group = new THREE.Group();
  group.name = "燕巢校區山林吊橋微雕模型";
  group.userData.campus = "燕巢校區";
  group.userData.visualStyle = "cinematic-architectural-miniature";
  const sceneObjects: Record<string, THREE.Object3D> = { model: group };
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  const own = <T extends THREE.BufferGeometry>(value: T) => (geometries.add(value), value);

  function noiseTexture(base: [number, number, number], variation: number, repeat: [number, number]) {
    const size = 256, pixels = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
      const grain = (n - Math.floor(n) - .5) * variation + Math.sin(x * .08) * Math.cos(y * .06) * variation * .16;
      pixels[i] = THREE.MathUtils.clamp(base[0] + grain, 0, 255);
      pixels[i + 1] = THREE.MathUtils.clamp(base[1] + grain, 0, 255);
      pixels[i + 2] = THREE.MathUtils.clamp(base[2] + grain, 0, 255);
      pixels[i + 3] = 255;
    }
    const map = new THREE.DataTexture(pixels, size, size);
    map.wrapS = map.wrapT = THREE.RepeatWrapping; map.repeat.set(...repeat);
    map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 8; map.needsUpdate = true; textures.add(map); return map;
  }
  const maps = {
    soil: noiseTexture([104, 82, 58], 25, [5, 5]), grass: noiseTexture([76, 116, 61], 24, [7, 7]),
    concrete: noiseTexture([203, 198, 181], 13, [3, 3]), wood: noiseTexture([148, 91, 48], 25, [2, 8]),
    wall: noiseTexture([204, 189, 158], 12, [3, 3]), water: noiseTexture([52, 104, 105], 20, [5, 2]),
  };
  const mat = (color: number, map?: THREE.Texture, emissive = 0, roughness = .88, metalness = 0) => {
    const parameters: THREE.MeshStandardMaterialParameters = { color, roughness, metalness, emissive, emissiveIntensity: 0 };
    if (map) Object.assign(parameters, { map, bumpMap: map, bumpScale: .008 });
    const value = new THREE.MeshStandardMaterial(parameters);
    materials.add(value); return value;
  };
  const mats = {
    base: mat(0x52665c), soil: mat(0x79634f, maps.soil), grass: mat(0x557c43, maps.grass), grassLight: mat(0x719452, maps.grass),
    rock: mat(0x7f8378, maps.concrete), wetRock: mat(0x485a55, maps.concrete, 0x102724, .32), path: mat(0xc5bdac, maps.concrete), wood: mat(0xa86332, maps.wood), woodDark: mat(0x6f4228, maps.wood),
    orange: mat(0xc86f2c, undefined, 0, .74), orangeDark: mat(0x8d4423), white: mat(0xe5e1d5, maps.concrete), cable: mat(0x20292c, undefined, 0, .38, .48),
    water: mat(0x4d8d91, maps.water, 0x214f57, .24), wall: mat(0xc6b58e, maps.wall), balcony: mat(0xa55e45), trim: mat(0xe5e0d2, maps.concrete),
    glass: mat(0x365b68, undefined, 0, .28), brightGlass: mat(0x3c6170, undefined, 0xffc978, .28), dimGlass: mat(0x395a65, undefined, 0xe9a85f, .31),
    guardGlass: mat(0x406c74, undefined, 0xffc783, .3), warm: mat(0xffd39b, undefined, 0xffb45b, .55),
    leaf: mat(0x2f6139), leafMid: mat(0x477a42), leafLight: mat(0x6f964b), trunk: mat(0x6e523b), sign: mat(0x9a6d31, undefined, 0xffc76d, .6),
    skin: mat(0xd6a17f), hair: mat(0x332a27), uniformA: mat(0xd9e2dc), uniformB: mat(0x6d8797), uniformC: mat(0xb46d55), trousers: mat(0x344350), shoe: mat(0x262b2d),
  };
  mats.water.transparent = true; mats.water.opacity = .82;

  const boxGeo = own(new THREE.BoxGeometry(1, 1, 1));
  const roundedGeo = own(new RoundedBoxGeometry(1, 1, 1, 3, .04));
  const cylinderGeo = own(new THREE.CylinderGeometry(.5, .5, 1, 14));
  const sphereGeo = own(new THREE.SphereGeometry(.5, 16, 10));
  const rockGeo = own(new THREE.DodecahedronGeometry(.5, 1));
  const grassBladeGeo = own(new THREE.ConeGeometry(.5, 1, 5));
  const planeGeo = own(new THREE.PlaneGeometry(1, 1));
  const dummy = new THREE.Object3D();
  const batches = new Map<string, { geometry: THREE.BufferGeometry; material: THREE.Material; cast: boolean; matrices: THREE.Matrix4[]; colors: THREE.Color[] }>();
  function instance(geometry: THREE.BufferGeometry, material: THREE.Material, position: V3, scale: V3, rotation: V3 = [0, 0, 0], cast = false, tint = 0xffffff) {
    const key = `${geometry.uuid}:${material.uuid}:${cast}`;
    if (!batches.has(key)) batches.set(key, { geometry, material, cast, matrices: [], colors: [] });
    dummy.position.set(...position); dummy.scale.set(...scale); dummy.rotation.set(...rotation); dummy.updateMatrix();
    const batch = batches.get(key)!; batch.matrices.push(dummy.matrix.clone()); batch.colors.push(new THREE.Color(tint));
  }
  const box = (position: V3, scale: V3, material: THREE.Material, cast = false, rounded = false, rotation: V3 = [0, 0, 0]) => instance(rounded ? roundedGeo : boxGeo, material, position, scale, rotation, cast);
  function mesh(name: string, geometry: THREE.BufferGeometry, material: THREE.Material, position: V3, cast = true) {
    const value = new THREE.Mesh(geometry, material); value.name = name; value.position.set(...position); value.castShadow = cast; value.receiveShadow = true;
    group.add(value); sceneObjects[name] = value; return value;
  }
  function mergeDirectMeshes(parent: THREE.Group, name: string) {
    const source = parent.children.filter((child): child is THREE.Mesh => child instanceof THREE.Mesh);
    const byMaterial = new Map<THREE.Material, { geometries: THREE.BufferGeometry[]; cast: boolean; receive: boolean }>();
    for (const child of source) {
      child.updateMatrix();
      const material = child.material as THREE.Material;
      const entry = byMaterial.get(material) ?? { geometries: [], cast: false, receive: false };
      let geometry = child.geometry.clone();
      if (geometry.index) {
        const nonIndexed = geometry.toNonIndexed();
        geometry.dispose();
        geometry = nonIndexed;
      }
      entry.geometries.push(geometry.applyMatrix4(child.matrix));
      entry.cast ||= child.castShadow; entry.receive ||= child.receiveShadow;
      byMaterial.set(material, entry); parent.remove(child);
    }
    let index = 0;
    for (const [material, entry] of byMaterial) {
      const geometry = mergeGeometries(entry.geometries, false); entry.geometries.forEach(value => value.dispose());
      if (!geometry) continue;
      const combined = new THREE.Mesh(own(geometry), material); combined.name = `${name}-${index++}`;
      combined.castShadow = entry.cast; combined.receiveShadow = entry.receive; parent.add(combined);
    }
  }
  function tube(name: string, points: THREE.Vector3[], radius: number, material: THREE.Material, segments = 40) {
    const geometry = own(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), segments, radius, 7, false));
    return mesh(name, geometry, material, [0, 0, 0], true);
  }

  // Layered display base and a real ravine instead of the shared flat campus template.
  box([0, -.46, 0], [18, .92, 18], mats.base, false, true);
  box([0, .02, 0], [17.75, .16, 17.75], mats.soil, false, true);
  const terrainHeight = (worldX: number, z: number) => {
    const slope = THREE.MathUtils.clamp((Math.abs(worldX) - 1.45) / 6.85, 0, 1);
    return .34 + Math.pow(slope, .72) * .82 + Math.sin(worldX * 1.12 + z * .41) * .09 + Math.cos(z * .83 - worldX * .27) * .065 + (worldX > 0 ? .05 : 0);
  };
  function terrainSide(side: number) {
    const geometry = own(new THREE.PlaneGeometry(7.25, 16.75, 34, 66)); geometry.rotateX(-Math.PI / 2);
    const positions = geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < positions.count; i++) {
      const localX = positions.getX(i), z = positions.getZ(i), worldX = side * 5.2 + localX;
      positions.setY(i, terrainHeight(worldX, z));
    }
    positions.needsUpdate = true; geometry.computeVertexNormals();
    const terrain = mesh(side < 0 ? "西側山坡" : "東側山坡", geometry, mats.grass, [0, 0, 0], false);
    terrain.position.x = side * 5.2; return terrain;
  }
  terrainSide(-1); terrainSide(1);
  box([0, .32, -6.75], [4.25, .55, 4.15], mats.grass, true, true);
  // Creek and rocks remain visible through the bridge structure.
  box([0, .18, .5], [3.35, .09, 16.2], mats.water, false, true);
  for (let z = -6.5; z < 7.5; z += .72) for (const side of [-1, 1]) {
    const wet = Math.abs(side * (1.75 + .25 * Math.sin(z * 1.7))) < 1.88;
    instance(rockGeo, wet ? mats.wetRock : mats.rock, [side * (1.75 + .25 * Math.sin(z * 1.7)), .38, z], [.34 + (Math.abs(z) % 2) * .06, .22, .42], [0, z, .2], false, side > 0 ? 0xa4a58f : 0x8d9181);
  }
  box([0, .73, 6.85], [4.5, .22, 3.25], mats.path, false, true);
  box([0, .72, -6.65], [4.2, .22, 3.4], mats.path, false, true);

  // Suspension footbridge follows the reference photos: timber deck, orange rails,
  // white portals, black main cables and dense vertical suspenders.
  const bridgeStart = 5.45, bridgeEnd = -4.75, bridgeLength = bridgeStart - bridgeEnd, deckCount = 54;
  const deckY = (t: number) => 2.42 - .34 * (1 - Math.pow(t * 2 - 1, 2));
  const bridge = new THREE.Group(); bridge.name = "燕巢生態景觀吊橋"; group.add(bridge); sceneObjects.bridge = bridge;
  for (let i = 0; i < deckCount; i++) {
    const t = (i + .5) / deckCount, z = THREE.MathUtils.lerp(bridgeStart, bridgeEnd, t), y = deckY(t);
    box([0, y, z], [2.18, .12, bridgeLength / deckCount * .92], mats.wood, true, false);
    box([0, y - .14, z], [2.32, .12, .08], mats.cable, true);
    if (i % 3 === 0) {
      for (const side of [-1, 1]) {
        box([side * 1.12, y + .62, z], [.07, 1.22, .07], mats.orange, true);
        box([side * 1.12, y + .48, z], [.055, .055, bridgeLength / deckCount * 3.08], mats.orange, true);
        box([side * 1.12, y + .92, z], [.075, .075, bridgeLength / deckCount * 3.08], mats.orange, true);
        instance(sphereGeo, mats.cable, [side * 1.12, y + .91, z], [.075, .075, .075], [0, 0, 0], false);
      }
    }
    // Silver under-deck Warren truss.
    if (i < deckCount - 1) for (const side of [-1, 1]) {
      const angle = i % 2 ? .62 : -.62;
      box([side * 1.02, y - .38, z], [.05, .05, .31], mats.white, true, false, [angle, 0, 0]);
      box([side * 1.02, y - .62, z], [.055, .055, bridgeLength / deckCount * 1.08], mats.white, true);
    }
  }
  const towerZ = [4.72, -4.02];
  for (const [towerIndex, z] of towerZ.entries()) {
    const t = (bridgeStart - z) / bridgeLength, baseY = deckY(t);
    for (const side of [-1, 1]) {
      box([side * 1.48, (baseY + 5.35) / 2, z], [.24, 5.35 - baseY + .72, .28], mats.white, true, true, [0, 0, side * .035]);
      box([side * 1.48, .66, z], [.55, .75, .7], mats.path, true, true);
      box([side * 1.48, 5.45, z], [.38, .2, .44], mats.white, true, true);
      instance(cylinderGeo, mats.cable, [side * 1.48, 5.68, z], [.09, .16, .09], [0, 0, 0], true);
    }
    box([0, 5.18, z], [3.18, .24, .3], mats.white, true, true);
    box([0, 4.16, z], [3.0, .16, .22], mats.white, true);
    if (towerIndex > 0) {
      box([0, 4.67, z], [3.0, .075, .12], mats.white, true, false, [0, 0, .28]);
      box([0, 4.67, z], [3.0, .075, .12], mats.white, true, false, [0, 0, -.28]);
    }
    const tower = new THREE.Object3D(); tower.name = towerIndex ? "後吊橋塔" : "前吊橋塔"; tower.position.set(0, 0, z); group.add(tower); sceneObjects[tower.name] = tower;
  }
  const bridgeCables: THREE.Mesh[] = [];
  for (const side of [-1, 1]) {
    const cablePoints: THREE.Vector3[] = [];
    for (let i = 0; i <= 40; i++) {
      const t = i / 40, z = THREE.MathUtils.lerp(bridgeStart + 1.1, bridgeEnd - 1.1, t);
      const between = THREE.MathUtils.clamp((bridgeStart - z) / bridgeLength, 0, 1);
      const cableY = z > towerZ[0] || z < towerZ[1] ? 3.05 + Math.abs(z - (z > 0 ? towerZ[0] : towerZ[1])) * 1.05 : 3.28 + Math.pow(between * 2 - 1, 2) * 1.72;
      cablePoints.push(new THREE.Vector3(side * 1.56, cableY, z));
    }
    bridgeCables.push(tube(`${side < 0 ? "左" : "右"}主纜`, cablePoints, .038, mats.cable, 96));
    for (let i = 2; i < deckCount - 2; i += 2) {
      const t = (i + .5) / deckCount, z = THREE.MathUtils.lerp(bridgeStart, bridgeEnd, t);
      const cableY = 3.28 + Math.pow(t * 2 - 1, 2) * 1.72, y = deckY(t) + .92;
      box([side * 1.56, (cableY + y) / 2, z], [.018, cableY - y, .018], mats.cable, false);
    }
    tube(`${side < 0 ? "左" : "右"}前錨索`, [new THREE.Vector3(side * 1.56, 5.05, towerZ[0]), new THREE.Vector3(side * 1.82, 3.38, 6.5)], .038, mats.cable, 18);
    tube(`${side < 0 ? "左" : "右"}後錨索`, [new THREE.Vector3(side * 1.56, 5.05, towerZ[1]), new THREE.Vector3(side * 1.82, 3.15, -5.75)], .038, mats.cable, 18);
    for (const z of [6.5, -5.75]) box([side * 1.82, .72, z], [.58, .72, .75], mats.path, true, true);
  }

  // Clean NKUST landmark plate suspended in the front portal.
  const signCanvas = document.createElement("canvas"); signCanvas.width = 768; signCanvas.height = 220;
  const signContext = signCanvas.getContext("2d")!; signContext.fillStyle = "#c9954f"; signContext.font = 'italic 800 132px "Arial",sans-serif'; signContext.textAlign = "center"; signContext.textBaseline = "middle"; signContext.fillText("NKUST", 384, 116, 700);
  const signMap = new THREE.CanvasTexture(signCanvas); signMap.colorSpace = THREE.SRGBColorSpace; textures.add(signMap);
  const signMaterial = new THREE.MeshStandardMaterial({ map: signMap, emissiveMap: signMap, emissive: 0xffba63, emissiveIntensity: 0, transparent: true, roughness: .65 }); materials.add(signMaterial);
  box([0, 4.55, 4.53], [2.52, .78, .07], mats.cable, true, true);
  const sign = mesh("NKUST吊橋標誌", planeGeo, signMaterial, [0, 4.55, 4.58], false); sign.scale.set(2.35, .72, 1);

  // Rear academic ensemble: the tan balcony building and clock tower on the left,
  // contrasted with the modern white-framed laboratory block on the right.
  const academicMarker = new THREE.Object3D(); academicMarker.name = "米色鐘塔教學大樓"; academicMarker.position.set(-3.2, 0, -7.05); group.add(academicMarker); sceneObjects[academicMarker.name] = academicMarker;
  let windowCount = 0, litWindowCount = 0;
  function nextWindowMaterial() {
    const index = windowCount++, lit = (index * 7 + 3) % 20 < 7;
    if (!lit) return mats.glass; litWindowCount++; return index % 3 ? mats.dimGlass : mats.brightGlass;
  }
  box([-3.55, 2.75, -7.05], [5.9, 4.45, 2.55], mats.wall, true, true);
  box([-3.55, 4.99, -7.05], [6.1, .22, 2.75], mats.trim, true, true);
  for (let floor = 0; floor < 5; floor++) {
    const y = 1.05 + floor * .77;
    box([-3.55, y, -5.73], [5.62, .56, .07], mats.cable);
    box([-3.55, y - .34, -5.62], [6.05, .15, .52], mats.balcony, true);
    for (let column = 0; column < 9; column++) {
      const x = -6.0 + column * .61;
      box([x, y, -5.68], [.44, .48, .035], nextWindowMaterial());
      box([x + .27, y, -5.61], [.055, .64, .08], mats.trim);
    }
    box([-3.55, y + .32, -5.58], [6.08, .075, .62], mats.trim, true);
  }
  box([-.6, 3.75, -7.05], [1.38, 6.5, 2.5], mats.wall, true, true);
  box([-.6, 7.08, -7.05], [1.55, .22, 2.7], mats.trim, true, true);
  const clock = mesh("鐘塔時鐘", own(new THREE.CircleGeometry(.35, 30)), mats.white, [-.6, 5.82, -5.77], false);
  const clockRing = mesh("鐘塔時鐘外框", own(new THREE.TorusGeometry(.39, .045, 8, 36)), mats.balcony, [-.6, 5.82, -5.73], true); clockRing.rotation.z = 0;
  for (let tick = 0; tick < 12; tick++) {
    const angle = tick / 12 * Math.PI * 2;
    box([-.6 + Math.sin(angle) * .27, 5.82 + Math.cos(angle) * .27, -5.7], [.025, .085, .025], mats.cable, false, false, [0, 0, -angle]);
  }
  box([-.6, 5.91, -5.68], [.035, .2, .025], mats.cable); box([-.5, 5.82, -5.67], [.2, .035, .025], mats.cable, false, false, [0, 0, .18]);
  for (const x of [-.94, -.6, -.26]) box([x, 3.35, -5.72], [.16, 2.9, .06], mats.glass);
  box([-.6, 1.18, -5.7], [.82, 1.28, .09], mats.guardGlass); box([-.6, 1.93, -5.62], [1.12, .15, .52], mats.trim, true);
  void clock;

  const modernMarker = new THREE.Object3D(); modernMarker.name = "現代白框教學大樓"; modernMarker.position.set(4.1, 0, -7.05); group.add(modernMarker); sceneObjects[modernMarker.name] = modernMarker;
  box([4.1, 2.8, -7.05], [5.2, 4.55, 2.55], mats.trim, true, true);
  box([4.1, 5.12, -7.05], [5.42, .18, 2.76], mats.white, true, true);
  box([4.1, 2.82, -5.72], [4.9, 4.18, .08], mats.cable);
  for (let floor = 0; floor < 5; floor++) for (let column = 0; column < 8; column++) {
    const x = 1.85 + column * .64, y = 1.02 + floor * .78;
    box([x, y, -5.66], [.47, .55, .045], nextWindowMaterial());
    const finMaterial = column % 4 === 0 ? mats.orangeDark : column % 4 === 2 ? mats.balcony : mats.trim;
    box([x + .27, y, -5.57], [.055, .7, .14], finMaterial, true);
  }
  for (let floor = 0; floor <= 5; floor++) box([4.1, .62 + floor * .78, -5.54], [5.25, .075, .16], mats.white, true);
  box([1.58, 2.8, -5.52], [.14, 4.6, .2], mats.white, true); box([6.62, 2.8, -5.52], [.14, 4.6, .2], mats.white, true);

  // Dense, varied forest with an intentionally clear bridge silhouette.
  const crowns: THREE.Group[] = [];
  function tree(x: number, z: number, height: number, radius: number, phase: number) {
    const baseY = terrainHeight(x, z);
    instance(cylinderGeo, mats.trunk, [x, baseY + height * .38, z], [.11 + radius * .035, height * .76, .11 + radius * .035], [0, 0, .05 * Math.sin(phase)], true);
    instance(cylinderGeo, mats.trunk, [x + Math.sin(phase) * .08, baseY + height * .73, z], [.075, height * .32, .075], [0, 0, -.1 * Math.sin(phase)], true);
    const crown = new THREE.Group(); crown.position.set(x, baseY + height, z); crown.userData.phase = phase; group.add(crown); crowns.push(crown);
    for (let branch = 0; branch < 5; branch++) {
      const angle = branch / 5 * Math.PI * 2 + phase, limb = new THREE.Mesh(cylinderGeo, mats.trunk);
      limb.position.set(Math.cos(angle) * .22, -.22 + branch % 2 * .16, Math.sin(angle) * .22); limb.scale.set(.045, .62 + branch % 3 * .08, .045);
      limb.rotation.set(Math.sin(angle) * .62, 0, -Math.cos(angle) * .62); limb.castShadow = true; crown.add(limb);
    }
    for (let i = 0; i < 7; i++) {
      const leaf = new THREE.Mesh(sphereGeo, [mats.leaf, mats.leafMid, mats.leafLight][(i + Math.floor(phase)) % 3]);
      const angle = i * 2.399 + phase, spread = i < 5 ? radius * .56 : radius * .18;
      leaf.position.set(Math.cos(angle) * spread, (i > 4 ? .38 : 0) + Math.sin(i * 1.4) * .08, Math.sin(angle) * spread * .78);
      leaf.scale.set(radius * (.78 + i % 2 * .12), radius * (.62 + i % 3 * .08), radius * (.72 + i % 2 * .1)); leaf.castShadow = true; leaf.receiveShadow = true; crown.add(leaf);
    }
    mergeDirectMeshes(crown, `forest-crown-${crowns.length}`);
  }
  const treeSites: V3[] = [
    [-7.4,6.4,2.2],[-6.4,5.1,2.6],[-7.35,3.6,2.9],[-5.9,2.4,2.35],[-7.4,.8,2.8],[-5.95,-.6,2.5],[-7.1,-2.2,3],[-5.8,-3.7,2.5],[-7.2,-5.1,2.65],
    [7.3,6.1,2.45],[6.1,5,2.7],[7.3,3.5,2.85],[5.95,2.1,2.45],[7.2,.5,2.9],[5.9,-1,2.55],[7.25,-2.5,2.75],[6.15,-4,2.4]
  ];
  // Irregular undergrowth replaces the former rows of identical spherical dots.
  const hash = (value: number) => { const n = Math.sin(value * 91.733) * 43758.5453; return n - Math.floor(n); };
  for (const side of [-1, 1]) {
    for (let i = 0; i < 320; i++) {
      const x = side * (2.25 + hash(i + side * 31) * 5.7), z = -5.35 + hash(i * 2.71 + side * 17) * 11.75, y = terrainHeight(x, z);
      const height = .07 + hash(i * 4.17) * .12;
      instance(grassBladeGeo, i % 5 ? mats.grass : mats.grassLight, [x, y + height * .5, z], [.02 + hash(i * 7.2) * .02, height, .02], [0, hash(i * 9.1) * Math.PI, (hash(i * 3.3) - .5) * .2], false);
    }
    for (let i = 0; i < 24; i++) {
      const x = side * (2.55 + hash(i * 6.21 + side * 11) * 5.05), z = -4.9 + hash(i * 8.7 + side * 3) * 10.9, y = terrainHeight(x, z);
      for (let leaf = 0; leaf < 4; leaf++) {
        const angle = leaf * 1.8 + i, radius = .18 + leaf * .04;
        instance(sphereGeo, leaf % 2 ? mats.leafMid : mats.leaf, [x + Math.cos(angle) * radius, y + .2 + leaf % 2 * .12, z + Math.sin(angle) * radius], [.28 + leaf * .025, .23, .27], [0, angle, 0], false);
      }
    }
    for (let i = 0; i < 48; i++) {
      const x = side * (2.45 + hash(i * 3.7 + side * 5) * 5.25), z = -5.1 + hash(i * 5.33 + side * 8) * 11.25, y = terrainHeight(x, z);
      instance(rockGeo, i % 3 ? mats.leafMid : mats.leafLight, [x, y + .2, z], [.26 + hash(i) * .25, .2 + hash(i * 2) * .18, .28 + hash(i * 4) * .25], [hash(i) * .3, hash(i * 5) * Math.PI, 0], false);
    }
  }
  treeSites.forEach((site, i) => tree(site[0], site[1], site[2], .62 + i % 3 * .1, i * .77));

  // Three articulated miniature students provide scale without crowding the bridge.
  type StudentRig = { root: THREE.Group; leftArm: THREE.Group; rightArm: THREE.Group; leftLeg: THREE.Group; rightLeg: THREE.Group; phase: number; mode: "forward" | "backward" | "lookout" };
  const studentGroup = new THREE.Group(); studentGroup.name = "橋上學生"; group.add(studentGroup); sceneObjects[studentGroup.name] = studentGroup;
  const contactMaterial = new THREE.MeshBasicMaterial({ color: 0x17211d, transparent: true, opacity: .24, depthWrite: false, toneMapped: false }); materials.add(contactMaterial);
  const contactGeo = own(new THREE.CircleGeometry(.32, 18));
  function studentPart(parent: THREE.Object3D, geometry: THREE.BufferGeometry, material: THREE.Material, position: V3, scale: V3) {
    const value = new THREE.Mesh(geometry, material); value.position.set(...position); value.scale.set(...scale); value.castShadow = true; value.receiveShadow = true; parent.add(value); return value;
  }
  function createStudent(name: string, clothing: THREE.Material, phase: number, mode: StudentRig["mode"]) {
    const root = new THREE.Group(); root.name = name; root.scale.setScalar(.58); studentGroup.add(root);
    const shadow = new THREE.Mesh(contactGeo, contactMaterial); shadow.rotation.x = -Math.PI / 2; shadow.position.y = .015; shadow.receiveShadow = false; root.add(shadow);
    studentPart(root, roundedGeo, clothing, [0, .72, 0], [.34, .48, .24]);
    studentPart(root, sphereGeo, mats.skin, [0, 1.22, 0], [.3, .31, .29]);
    studentPart(root, sphereGeo, mats.hair, [0, 1.34, -.015], [.31, .18, .3]);
    const leftArm = new THREE.Group(), rightArm = new THREE.Group(), leftLeg = new THREE.Group(), rightLeg = new THREE.Group();
    leftArm.position.set(-.27, .96, 0); rightArm.position.set(.27, .96, 0); leftLeg.position.set(-.13, .49, 0); rightLeg.position.set(.13, .49, 0);
    root.add(leftArm, rightArm, leftLeg, rightLeg);
    studentPart(leftArm, cylinderGeo, mats.skin, [0, -.24, 0], [.07, .48, .07]); studentPart(rightArm, cylinderGeo, mats.skin, [0, -.24, 0], [.07, .48, .07]);
    studentPart(leftLeg, cylinderGeo, mats.trousers, [0, -.24, 0], [.085, .48, .085]); studentPart(rightLeg, cylinderGeo, mats.trousers, [0, -.24, 0], [.085, .48, .085]);
    studentPart(leftLeg, roundedGeo, mats.shoe, [0, -.5, -.07], [.17, .1, .27]); studentPart(rightLeg, roundedGeo, mats.shoe, [0, -.5, -.07], [.17, .1, .27]);
    if (mode !== "lookout") studentPart(root, roundedGeo, mode === "forward" ? mats.uniformB : mats.uniformC, [0, .76, .22], [.3, .42, .12]);
    return { root, leftArm, rightArm, leftLeg, rightLeg, phase, mode } as StudentRig;
  }
  const students = [
    createStudent("往教學樓學生", mats.uniformA, 0, "forward"),
    createStudent("往入口學生", mats.uniformB, 1.8, "backward"),
    createStudent("橋上看風景學生", mats.uniformC, 3.4, "lookout"),
  ];
  studentGroup.userData.studentCount = students.length;
  studentGroup.userData.bridgeLaneLimit = .82;
  function placeStudent(rig: StudentRig, t: number, x: number, walking: boolean, reduced: boolean, speed = 1) {
    const z = THREE.MathUtils.lerp(bridgeStart, bridgeEnd, t), y = deckY(t) + .09;
    rig.root.position.set(x, y, z);
    if (rig.mode === "lookout") rig.root.rotation.y = Math.PI / 2;
    else rig.root.rotation.y = rig.mode === "forward" ? Math.PI : 0;
    const stride = reduced || !walking ? 0 : Math.sin(time * 6.2 * speed + rig.phase) * .48;
    rig.leftArm.rotation.x = stride; rig.rightArm.rotation.x = -stride;
    rig.leftLeg.rotation.x = -stride; rig.rightLeg.rotation.x = stride;
    rig.root.position.y += reduced || !walking ? 0 : Math.abs(Math.sin(time * 6.2 * speed + rig.phase)) * .018;
  }

  // Bridge marker lights provide a warm route through the dark valley.
  const lampPositions: V3[] = [];
  for (let i = 1; i < deckCount - 1; i += 4) {
    const t = (i + .5) / deckCount, z = THREE.MathUtils.lerp(bridgeStart, bridgeEnd, t), y = deckY(t) + .98;
    for (const side of [-1, 1]) { instance(sphereGeo, mats.warm, [side * 1.13, y, z], [.095, .095, .095]); lampPositions.push([side * 1.13, y, z]); }
  }

  for (const batch of batches.values()) {
    const value = new THREE.InstancedMesh(batch.geometry, batch.material, batch.matrices.length);
    batch.matrices.forEach((matrix, index) => { value.setMatrixAt(index, matrix); value.setColorAt(index, batch.colors[index]); });
    value.castShadow = batch.cast; value.receiveShadow = batch.material !== mats.water; value.computeBoundingSphere(); group.add(value);
  }
  const bounds = new THREE.Box3(new THREE.Vector3(-9, -.92, -9), new THREE.Vector3(9, 7.3, 9));
  group.userData.cameraBounds = bounds.clone();
  let time = 0, disposed = false;
  function update(delta: number, night: number, reduced = false) {
    if (disposed) return false; if (!reduced) time += delta;
    crowns.forEach(crown => { crown.rotation.z = reduced ? 0 : Math.sin(time * .62 + crown.userData.phase) * .012; });
    if (!reduced) { maps.water.offset.x = (time * .018) % 1; maps.water.offset.y = Math.sin(time * .25) * .012; }
    const pingPong = (value: number) => { const cycle = ((value % 2) + 2) % 2; return { amount: cycle <= 1 ? cycle : 2 - cycle, forward: cycle <= 1 }; };
    const first = reduced ? { amount: .24, forward: true } : pingPong(time * .052);
    const second = reduced ? { amount: .68, forward: false } : pingPong(time * .044 + .86);
    placeStudent(students[0], .14 + first.amount * .72, -.38, true, reduced, .95); students[0].root.rotation.y = first.forward ? Math.PI : 0;
    placeStudent(students[1], .14 + second.amount * .72, .34, true, reduced, .82); students[1].root.rotation.y = second.forward ? Math.PI : 0;
    placeStudent(students[2], .58, .78, false, reduced);
    students[2].leftArm.rotation.x = -.72 + (reduced ? 0 : Math.sin(time * .85) * .04);
    students[2].rightArm.rotation.x = -.5; students[2].root.rotation.z = reduced ? 0 : Math.sin(time * .72 + 2.1) * .012;
    bridgeCables.forEach((cable, index) => { cable.position.y = reduced ? 0 : Math.sin(time * .64 + index * 1.7) * .004; });
    mats.grass.emissive.setHex(0x142713); mats.grassLight.emissive.setHex(0x192d15);
    mats.grass.emissiveIntensity = (1 - night) * .14; mats.grassLight.emissiveIntensity = (1 - night) * .1;
    mats.water.emissiveIntensity = .2 + night * .16; mats.brightGlass.emissiveIntensity = night * 1.08; mats.dimGlass.emissiveIntensity = night * .48;
    mats.wetRock.emissiveIntensity = night * .08; mats.guardGlass.emissiveIntensity = night * .8; mats.warm.emissiveIntensity = night * 1.8; signMaterial.emissiveIntensity = night * .7;
    return !reduced;
  }
  function dispose() {
    if (disposed) return; disposed = true;
    group.traverse(object => { if (object instanceof THREE.InstancedMesh) object.dispose(); });
    geometries.forEach(value => value.dispose()); materials.forEach(value => value.dispose()); textures.forEach(value => value.dispose()); group.clear();
  }
  return { group, sceneObjects, bounds, mats, labels: [signMaterial], entryZ: 4.72, id: "yanchao", windowCount, litWindowCount, lampPositions, moving: true, update, dispose };
}
