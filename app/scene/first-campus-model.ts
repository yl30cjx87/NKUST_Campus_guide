import * as THREE from "three";
import { TextGeometry } from "three/addons/geometries/TextGeometry.js";
import { FontLoader } from "three/addons/loaders/FontLoader.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import fontData from "./helvetiker_regular.typeface.json";
import { createFirstCampusLife } from "./first-campus-life";

type V3 = [number, number, number];

/** Photo-derived front elevation; one building, with a recessed colonnade. */
export type FirstCampusQuality = "desktop" | "mobile";
export function createFirstCampusModel(options: { quality?: FirstCampusQuality } = {}) {
  // The quality setting still controls procedural detail density, while all
  // material maps remain local and deterministic.
  const quality = options.quality ?? "desktop";
  const group = new THREE.Group(); group.name = "第一校區主建築與中央廣場"; group.userData.campus = "第一校區";
  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>(), textures = new Set<THREE.Texture>();
  const geo = <T extends THREE.BufferGeometry>(g: T) => { geometries.add(g); return g; };
  // Small deterministic, repeating material maps; no photographic textures.
  function surface(kind: "brick" | "stone" | "grass" | "wood", repeat = 2) {
    const size = 128, data = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const brickSeam = kind === "brick" && (y % 16 < 1 || (x + (Math.floor(y / 16) % 2) * 16) % 32 < 1);
      const stoneSeam = kind === "stone" && (x % 32 < 1 || y % 32 < 1);
      const broadWash = Math.sin(x * .105 + y * .025) * 7 + Math.cos(y * .075 - x * .018) * 5;
      const fibers = kind === "wood" ? Math.sin(y * .42 + Math.sin(x * .08) * 2) * 8 : 0;
      const speckle = kind === "grass" ? (((x * 13 + y * 29) % 31) < 5 ? -15 : 4) : 0;
      const grain = ((x * 37 + y * 19 + x * y * 3) % 21) - 10;
      const v = brickSeam ? 171 : stoneSeam ? 207 : THREE.MathUtils.clamp(229 + broadWash + fibers + speckle + grain, 185, 250);
      const i = (y * size + x) * 4; data[i] = data[i + 1] = data[i + 2] = v; data[i + 3] = 255;
    }
    const t = new THREE.DataTexture(data, size, size); t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.repeat.set(repeat, repeat); t.needsUpdate = true; textures.add(t); return t;
  }
  const brick = surface("brick", 3), stone = surface("stone", 2), grassWash = surface("grass", 5), woodWash = surface("wood", 3);
  // Reuse compact procedural maps for the hand-painted breakup. This removes
  // five large startup downloads and their image-decoding cost.
  const plasterPaint = brick, pavingPaint = stone;
  const grassPaint = grassWash, foliagePaint = grassWash, woodPaint = woodWash;
  // Three broad values emulate Blender's Shader-to-RGB + Color Ramp NPR setup.
  const gradient = new THREE.DataTexture(new Uint8Array([105, 177, 238]), 3, 1, THREE.RedFormat);
  gradient.minFilter = gradient.magFilter = THREE.NearestFilter; gradient.needsUpdate = true; textures.add(gradient);
  function toon(color: number, map?: THREE.Texture, relief?: THREE.Texture) {
    const m = new THREE.MeshToonMaterial({ color, map: map ?? null, gradientMap: gradient, bumpMap: relief ?? null, bumpScale: relief ? .035 : 1 }); materials.add(m); return m;
  }
  function glass(emissive = 0) {
    const m = new THREE.MeshStandardMaterial({ color: 0x4f7775, roughness: .48, metalness: .04, emissive, emissiveIntensity: 0 }); materials.add(m); return m;
  }
  const mats = {
    base: toon(0x594b3d, woodPaint), trim: toon(0xfff1cf, plasterPaint, stone), wall: toon(0xe3a65f, plasterPaint, brick), concrete: toon(0xd6c8aa, plasterPaint, stone),
    paving: toon(0xd5c69f, pavingPaint, stone), grout: toon(0xf4ead0, pavingPaint), grass: toon(0x55b83d, grassPaint, grassWash), leaves: toon(0x39a84b, foliagePaint, grassWash), darkLeaves: toon(0x167044, foliagePaint, grassWash),
    trunk: toon(0x81513a, woodPaint, woodWash), metal: toon(0x3f5655, plasterPaint), orange: toon(0xff8a1d, plasterPaint), wood: toon(0xb96936, woodPaint, woodWash), flower: toon(0xffb1b8, foliagePaint),
    glass: glass(), brightGlass: glass(0xffce7f), dimGlass: glass(0xefac62), guardGlass: glass(0xffc878), warm: toon(0xffe0a2),
  };
  mats.warm.emissive.set(0xffc480); mats.warm.emissiveIntensity = 0;
  const cube = geo(new THREE.BoxGeometry(1, 1, 1)), roundedCube = geo(new RoundedBoxGeometry(1, 1, 1, 2, .035)), cylinder = geo(new THREE.CylinderGeometry(.5, .5, 1, 12));
  const leaf = geo(new THREE.IcosahedronGeometry(.5, 1));
  const batches = new Map<string, { g: THREE.BufferGeometry; m: THREE.Material; shadow: boolean; matrices: THREE.Matrix4[]; colors: THREE.Color[] }>();
  const dummy = new THREE.Object3D();
  function instance(g: THREE.BufferGeometry, m: THREE.Material, p: V3, s: V3, shadow = false, tint = 0xffffff) {
    const key = `${g.uuid}:${m.uuid}:${shadow}`;
    if (!batches.has(key)) batches.set(key, { g, m, shadow, matrices: [], colors: [] });
    dummy.position.set(...p); dummy.scale.set(...s); dummy.rotation.set(0, 0, 0); dummy.updateMatrix();
    batches.get(key)!.matrices.push(dummy.matrix.clone()); batches.get(key)!.colors.push(new THREE.Color(tint));
  }
  const box = (p: V3, s: V3, m: THREE.Material, shadow = false) => instance(cube, m, p, s, shadow);
  const outlineMat = new THREE.LineBasicMaterial({ color: 0x57483d, transparent: true, opacity: .24 }); materials.add(outlineMat);
  function outline(g: THREE.BufferGeometry, p: V3, s: V3 = [1, 1, 1]) {
    const line = new THREE.LineSegments(geo(new THREE.EdgesGeometry(g, 32)), outlineMat); line.position.set(...p); line.scale.set(...s); group.add(line);
  }
  function volume(p: V3, s: V3, m: THREE.Material) { instance(roundedCube, m, p, s, true); outline(roundedCube, p, s); }
  const sceneObjects: Record<string, THREE.Object3D> = { model: group };
  function marker(name: string, p: V3) { const node = new THREE.Object3D(); node.name = name; node.position.set(...p); group.add(node); sceneObjects[name] = node; }
  volume([0, -.42, 0], [18, .84, 18], mats.base);
  volume([0, .035, 0], [17.88, .11, 17.88], mats.concrete);
  box([0, .105, 0], [17.58, .04, 17.58], mats.grass);
  // The building occupies the rear third. Its entrance remains an actual recess.
  volume([0, 2.25, -5.65], [10.8, 3.5, 3.8], mats.wall);
  box([0, 1.75, -3.715], [8.6, 2.8, .035], mats.guardGlass);
  volume([0, 3.7, -3.38], [11.1, 1.45, .7], mats.wall);
  box([0, 4.47, -4.9], [11.28, .16, 5.35], mats.concrete);
  for (const x of [-5.2, 5.2]) volume([x, 1.65, -3.35], [.7, 2.7, .75], mats.wall);
  for (const x of [-3.9, -2.34, -.78, .78, 2.34, 3.9]) {
    instance(cylinder, mats.trim, [x, 1.76, -2.98], [.25, 2.64, .25], true);
    box([x, .47, -2.98], [.4, .15, .4], mats.concrete);
    box([x, 3.07, -2.98], [.36, .14, .4], mats.trim);
  }
  for (let i = 0; i < 5; i++) box([0, .145 + i * .062, -2.2 - i * .18], [8.5 - i * .1, .07 + i * .124, 1.35 - i * .18], mats.trim, false);
  // Central upper tower, two massive front piers, white vertical structural fins.
  volume([0, 6.2, -5.65], [8.1, 3.45, 3.7], mats.wall);
  box([0, 6.15, -3.775], [3.2, 3.15, .055], mats.guardGlass);
  for (const x of [-2.85, 2.85]) {
    volume([x, 6.26, -3.65], [1.5, 3.5, .7], mats.wall);
    volume([x, 8.07, -3.65], [1.72, .65, .86], mats.concrete);
    box([x, 7.36, -3.275], [.9, .6, .045], mats.glass);
    box([x, 5.85, -3.275], [.19, 1.6, .04], mats.glass);
  }
  for (const x of [-1.42, -.71, 0, .71, 1.42]) box([x, 6.7, -3.5], [.105, 2.32, .22], mats.trim, true);
  volume([0, 5.6, -3.27], [3.48, .47, .82], mats.concrete);
  box([0, 7.92, -5.65], [8.25, .18, 3.92], mats.concrete);
  for (const x of [-4.16, 4.16]) for (const z of [-4.1, -5.15, -6.2, -7.25]) box([x, 6.15, z], [.2, 3.68, .25], mats.trim, true);
  const windows: { p: V3; s: V3 }[] = [];
  for (let i = 0; i < 10; i++) windows.push({ p: [-4.8 + i * 1.065, 3.76, -3.015], s: [.3, .38, .04] });
  for (const side of [-1, 1]) for (let row = 0; row < 3; row++) for (let j = 0; j < 6; j++) windows.push({ p: [side * 4.062, 4.95 + row * .88, -4.12 - j * .56], s: [.035, .64, .34] });
  for (let row = 0; row < 3; row++) for (let j = 0; j < 11; j++) windows.push({ p: [-4.9 + j * .98, .95 + row * .78, -7.568], s: [.5, .5, .035] });
  const litWindowCount = Math.round(windows.length * .35);
  const order = windows.map((_, i) => i); let seed = 49;
  for (let i = order.length - 1; i > 0; i--) { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; const j = seed % (i + 1); [order[i], order[j]] = [order[j], order[i]]; }
  const lit = new Set(order.slice(0, litWindowCount));
  windows.forEach((w, i) => { box(w.p, w.s, lit.has(i) ? i % 3 ? mats.dimGlass : mats.brightGlass : mats.glass); });
  // Thin mullions introduce scale without outlining every pane.
  for (let x = -4; x <= 4; x += .5) box([x, 1.78, -3.67], [.035, 2.68, .04], mats.metal);
  for (const y of [.8, 1.5, 2.2, 2.85]) box([0, y, -3.67], [8.2, .035, .04], mats.metal);
  const domeGeo = geo(new THREE.SphereGeometry(1, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2));
  const dome = new THREE.Mesh(domeGeo, mats.trim); dome.position.set(0, 8.06, -5.4); dome.scale.set(2.25, .82, 2.25); dome.castShadow = true; dome.receiveShadow = true; group.add(dome); sceneObjects.dome = dome;
  instance(cylinder, mats.concrete, [0, 8.04, -5.4], [4.65, .18, 4.65], true);
  const ribMat = new THREE.LineBasicMaterial({ color: 0x89918d }); materials.add(ribMat);
  for (let i = 0; i < 16; i++) {
    const angle = i * Math.PI / 8, points = [];
    for (let j = 0; j <= 12; j++) { const a = j * Math.PI / 24; points.push(new THREE.Vector3(Math.sin(a) * Math.cos(angle) * 2.26, Math.cos(a) * .83 + 8.06, Math.sin(a) * Math.sin(angle) * 2.26 - 5.4)); }
    group.add(new THREE.Line(geo(new THREE.BufferGeometry().setFromPoints(points)), ribMat));
  }
  marker("main-building", [0, 4, -5.4]); marker("entrance-colonnade", [0, 1.7, -3]);
  // Plaza: large stone squares, narrow pale joints and subtle inset paving.
  let tileIndex = 0;
  for (let z = -1.1; z < 8.2; z += 1.3) for (let x = -3.9; x < 4.1; x += 1.3) {
    const jitter = ((tileIndex++ * 37) % 9 - 4) * .009;
    const tint = ((Math.round((x + 4) * 10) * 17 + Math.round((z + 2) * 10) * 11) % 3 === 0) ? 0xeee9dd : 0xffffff;
    instance(cube, mats.paving, [x + jitter, .145, z - jitter], [1.19 + jitter, .04, 1.19 - jitter], false, tint);
    instance(cube, mats.paving, [x + jitter, .169, z - jitter], [1.025 + jitter, .012, 1.025 - jitter], false, tint);
  }
  marker("square-plaza", [0, .15, 3]);
  for (const side of [-1, 1]) {
    box([side * 6.4, .17, 2.55], [3.65, .13, 9.8], mats.grass);
    for (const x of [side * 4.7, side * 8.1]) box([x, .38, 2.55], [.22, .42, 9.7], mats.darkLeaves);
    for (const z of [-2.15, 7.3]) box([side * 6.4, .38, z], [3.55, .42, .24], mats.darkLeaves);
    for (let j = 0; j < 2; j++) {
      instance(cylinder, mats.concrete, [side * 6.4, .22, .4 + j * 3.6], [1.55, .12, 1.55]);
      for (let k = 0; k < 18; k++) { const a = k * Math.PI / 9; instance(leaf, mats.flower, [side * 6.4 + Math.cos(a) * .57, .34, .4 + j * 3.6 + Math.sin(a) * .57], [.22, .18, .22], false, k % 2 ? 0xffdbac : 0xffffff); }
    }
    // Loosely layered shrubs and ground tufts break the geometric garden edges.
    for (let i = 0; i < 13; i++) {
      const z = -1.65 + i * .7, x = side * (4.92 + (i % 3) * .16), size = .2 + (i % 4) * .045;
      instance(leaf, mats.leaves, [x, .38 + size * .35, z], [size * 1.35, size, size], false, i % 3 === 0 ? 0xd0e4a2 : i % 3 === 1 ? 0xffffff : 0xb7d488);
    }
    for (let i = 0; i < 10; i++) {
      const x = side * (5.25 + (i % 3) * .72), z = -.9 + Math.floor(i / 3) * 2.25 + (i % 2) * .28;
      instance(leaf, mats.darkLeaves, [x, .31, z], [.16 + (i % 2) * .05, .22 + (i % 3) * .04, .14], false, i % 2 ? 0xc3d99a : 0xe1e9b8);
    }
  }
  // Small climbing-green clusters soften the lower corners without obscuring the façade.
  for (const side of [-1, 1]) for (let i = 0; i < 5; i++) {
    instance(leaf, mats.leaves, [side * (4.72 + (i % 2) * .16), .5 + i * .24, -3.17], [.24, .3, .16], false, i % 2 ? 0xb7d38b : 0xd7e7a9);
  }
  const trees: { x: number; z: number; height: number; crown: "round" | "wide" | "tall"; phase: number; scale: number }[] = [];
  const treeRows = [[-5.8, 2.95, "tall", 1.08], [-1.4, 2.35, "wide", .96], [3, 2.7, "round", 1.02], [6.5, 2.25, "wide", .9]] as const;
  for (const side of [-1, 1]) for (let i = 0; i < treeRows.length; i++) {
    const [z, height, crown, scale] = treeRows[i], x = side * (7.1 + (i % 2) * .22);
    trees.push({ x, z, height, crown, phase: i * .93 + (side > 0 ? 1.7 : 0), scale });
    const lean = side * (.1 + i * .018);
    instance(cylinder, mats.trunk, [x + lean * .35, height / 2, z], [.16 + i * .01, height, .14 + i * .008], true, i % 2 ? 0xe8cfaa : 0xffffff);
    for (const branchSide of [-1, 1]) {
      dummy.position.set(x + lean + branchSide * .18, height * .72, z); dummy.scale.set(.075, .75, .07); dummy.rotation.set(0, 0, branchSide * .48); dummy.updateMatrix();
      const key = `${cylinder.uuid}:${mats.trunk.uuid}:true`; if (!batches.has(key)) batches.set(key, { g: cylinder, m: mats.trunk, shadow: true, matrices: [], colors: [] });
      batches.get(key)!.matrices.push(dummy.matrix.clone()); batches.get(key)!.colors.push(new THREE.Color(branchSide > 0 ? 0xe6c79f : 0xffffff));
    }
  }
  // Lush painted ground details stay at the garden edges so the plaza remains readable.
  const grassBlade = geo(new THREE.ConeGeometry(.045, .34, 3));
  const detailStride = quality === "mobile" ? 3 : 1;
  for (let i = 0; i < 300; i += detailStride) {
    const side = i % 2 ? -1 : 1, lane = Math.floor(i / 2);
    const x = side * (4.95 + ((lane * 47) % 270) / 100), z = -2.05 + ((lane * 83) % 900) / 100;
    const h = .22 + ((i * 31) % 15) / 100;
    instance(grassBlade, i % 5 ? mats.leaves : mats.darkLeaves, [x, .25 + h / 2, z], [.72, h / .34, .72], false, i % 7 ? 0xffffff : 0xcff47c);
  }
  const rockGeo = geo(new THREE.DodecahedronGeometry(.5, 0));
  for (const [x, z, s] of [[-7.7, 7.1, .55], [7.55, 6.9, .48], [-5.4, -1.1, .32], [5.65, 3.7, .28]] as const) instance(rockGeo, mats.concrete, [x, .26, z], [s, s * .62, s * .82], false, 0xc9d3b4);
  for (const side of [-1, 1]) for (const z of [1.5, 5.4]) {
    for (const offset of [-.44, .44]) box([side * 5.45 + offset, .32, z], [.1, .42, .38], mats.metal);
    for (let i = 0; i < 3; i++) box([side * 5.45, .55, z - .2 + i * .16], [1.22, .09, .12], mats.wood);
    box([side * 5.45, .83, z - .27], [1.22, .29, .07], mats.wood);
  }
  const lampPositions: V3[] = [];
  for (const x of [-4.5, 4.5]) for (const z of [-.8, 4.8]) {
    instance(cylinder, mats.metal, [x, 1.31, z], [.065, 2.42, .065]); box([x, 2.55, z], [.32, .1, .32], mats.metal);
    box([x, 2.47, z], [.23, .09, .23], mats.warm); lampPositions.push([x, 2.36, z]);
  }
  const textGeo = geo(new TextGeometry("NKUST", { font: new FontLoader().parse(fontData), size: 1.23, depth: .2, curveSegments: 6, bevelEnabled: true, bevelThickness: .025, bevelSize: .018, bevelSegments: 2 }));
  textGeo.computeBoundingBox(); textGeo.translate(-textGeo.boundingBox!.getSize(new THREE.Vector3()).x / 2, 0, 0);
  const letters = new THREE.Mesh(textGeo, mats.orange); letters.position.set(0, .34, 6); letters.castShadow = true; letters.receiveShadow = true; group.add(letters); sceneObjects.NKUST = letters; outline(textGeo, [0, .34, 6]);
  box([0, .26, 6.12], [5.85, .18, .56], mats.metal);
  // Analytic soft contact occlusion, inexpensive and stable under model rotation.
  const shadowData = new Uint8Array(32 * 32 * 4);
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) { const i = (y * 32 + x) * 4; shadowData[i + 3] = Math.round(100 * Math.pow(Math.max(0, 1 - Math.hypot((x - 15.5) / 16, (y - 15.5) / 16)), 1.3)); }
  const shadowTexture = new THREE.DataTexture(shadowData, 32, 32); shadowTexture.magFilter = THREE.LinearFilter; shadowTexture.needsUpdate = true; textures.add(shadowTexture);
  const contactMat = new THREE.MeshBasicMaterial({ map: shadowTexture, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 }); materials.add(contactMat);
  const contactGeo = geo(new THREE.PlaneGeometry(1, 1)); contactGeo.rotateX(-Math.PI / 2);
  instance(contactGeo, contactMat, [0, .19, -3.05], [11.3, 1, 3]); instance(contactGeo, contactMat, [0, .19, 6.1], [6.5, 1, 1.5]);
  trees.forEach(t => instance(contactGeo, contactMat, [t.x, .25, t.z], [2.25, 1, 2.25]));
  for (const batch of batches.values()) {
    const mesh = new THREE.InstancedMesh(batch.g, batch.m, batch.matrices.length);
    batch.matrices.forEach((m, i) => { mesh.setMatrixAt(i, m); mesh.setColorAt(i, batch.colors[i]); });
    mesh.castShadow = batch.shadow; mesh.receiveShadow = true; mesh.computeBoundingSphere(); group.add(mesh);
  }
  const life = createFirstCampusLife(group, trees, mats.leaves);
  sceneObjects[life.dayGroup.name] = life.dayGroup; sceneObjects[life.nightGroup.name] = life.nightGroup;
  sceneObjects["badminton-net"] = life.dayGroup.getObjectByName("badminton-net")!;
  sceneObjects["student-live-stage"] = life.nightGroup.getObjectByName("student-live-stage")!;
  group.updateMatrixWorld(true); const bounds = new THREE.Box3().setFromObject(group);
  let disposed = false;
  function dispose() {
    if (disposed) return; disposed = true; life.dispose();
    group.traverse(o => { if (o instanceof THREE.InstancedMesh) o.dispose(); });
    geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose()); group.clear();
  }
  group.userData.visualStyle = "lush-gouache-anime-miniature"; group.userData.quality = quality;
  return { group, sceneObjects, bounds, mats, labels: [], entryZ: -3, id: "first", windowCount: windows.length, litWindowCount, lampPositions, life, dispose };
}
