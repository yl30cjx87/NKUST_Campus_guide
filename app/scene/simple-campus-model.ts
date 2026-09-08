import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { createCampusEmblem } from "./campus-emblem";
import { createNanzihCampusModel } from "./nanzih-campus-model";
import { createYanchaoCampusModel } from "./yanchao-campus-model";

type V3 = [number, number, number];
type Block = { position: V3; size: V3; floors: number; columns: number };

function createNanzihRealisticModel() {
  const group = new THREE.Group(); group.name = "楠梓校區寫實牌樓微縮模型"; group.userData.campus = "楠梓校區"; group.userData.visualStyle = "museum-architectural-realism";
  const sceneObjects: Record<string, THREE.Object3D> = { model: group };
  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>(), textures = new Set<THREE.Texture>();
  const ownGeo = <T extends THREE.BufferGeometry>(g: T) => (geometries.add(g), g);
  function texture(kind: "brick" | "stone" | "road" | "grass" | "roof", repeat: V3) {
    const size = kind === "brick" ? 1024 : 256, data = new Uint8Array(size * size * 4), base = kind === "road" ? 150 : kind === "grass" ? 188 : kind === "roof" ? 205 : 222;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4, noise = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
      let value = base + (noise - Math.floor(noise) - .5) * (kind === "road" ? 26 : kind === "grass" ? 13 : 4) + Math.sin(x * .055) * Math.cos(y * .037) * 3;
      if (kind === "brick") { const row = Math.floor(y / 64), bx = (x + (row % 2) * 64) % 128; value += ((row * 13 + Math.floor(x / 128) * 7) % 7 - 3) * 1.5; if (y % 64 < 3 || bx < 3) value = 176; }
      if (kind === "stone" && (x % 48 < 1 || y % 36 < 1)) value -= 14;
      if (kind === "roof" && x % 16 < 1.2) value -= 16;
      value = THREE.MathUtils.clamp(value, 0, 255); data[i] = data[i + 1] = data[i + 2] = value; data[i + 3] = 255;
    }
    const map = new THREE.DataTexture(data, size, size); map.wrapS = map.wrapT = THREE.RepeatWrapping; map.repeat.set(repeat[0], repeat[1]); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 8; map.needsUpdate = true; textures.add(map); return map;
  }
  const maps = { brick: texture("brick", [2.4, 3.2, 1]), stone: texture("stone", [2, 2, 1]), road: texture("road", [4, 3, 1]), grass: texture("grass", [5, 5, 1]), roof: texture("roof", [4, 2, 1]) };
  const pbr = (color: number, map?: THREE.Texture, emissive = 0, roughness = .82) => { const parameters: THREE.MeshStandardMaterialParameters = { color, roughness, metalness: 0, emissive, emissiveIntensity: 0 }; if (map) Object.assign(parameters, { map, bumpMap: map, bumpScale: .006 }); const m = new THREE.MeshStandardMaterial(parameters); materials.add(m); return m; };
  const brightGlass = pbr(0x284b50, undefined, 0xffc876, .28), dimGlass = pbr(0x244349, undefined, 0xe99a55, .32), guardGlass = pbr(0x31585b, undefined, 0xffbd73, .3);
  const mats = { base: pbr(0x8c9695, undefined, 0, .86), soil: pbr(0x806d5e, undefined, 0, .96), paving: pbr(0xc8c2b5, maps.stone, 0, .9), road: pbr(0x666f75, maps.road, 0, .96), stripe: pbr(0xf0eee5), brick: pbr(0xad6553, maps.brick, 0, .94), brickLight: pbr(0xb9725e, maps.brick, 0, .92), stone: pbr(0xdfdbcf, maps.stone, 0, .74), roof: pbr(0x944338, undefined, 0, .86), roofLight: pbr(0xaf5142, undefined, 0, .8), sign: pbr(0x173552, undefined, 0xffd594, .5), metal: pbr(0x303a3d, undefined, 0, .4), grass: pbr(0x78935e, maps.grass, 0, 1), leaf: pbr(0x3f6747, undefined, 0, .88), leafLight: pbr(0x587b50, undefined, 0, .86), trunk: pbr(0x785f49, undefined, 0, .98), glass: pbr(0x527a82, undefined, 0, .28), brightGlass, dimGlass, guardGlass, warm: pbr(0xffd19a, undefined, 0xffb65d, .6) };
  mats.brick.bumpScale = mats.brickLight.bumpScale = .003;
  mats.roof.side = mats.roofLight.side = THREE.DoubleSide;
  const cube = ownGeo(new THREE.BoxGeometry(1, 1, 1)), plane = ownGeo(new THREE.PlaneGeometry(1, 1)), rounded = ownGeo(new RoundedBoxGeometry(1, 1, 1, 3, .035)), cylinder = ownGeo(new THREE.CylinderGeometry(.5, .5, 1, 14)), sphere = ownGeo(new THREE.SphereGeometry(.5, 18, 12)), crownGeo = ownGeo(new THREE.SphereGeometry(.5, 16, 10));
  const crownParts = Array.from({ length: 5 }, (_, j) => crownGeo.clone().applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(Math.cos(j * 2.4) * .45, j === 0 ? .45 : 0, Math.sin(j * 2.4) * .36), new THREE.Quaternion(), new THREE.Vector3(1.05 + (j % 2) * .22, .95 + (j % 3) * .16, 1.02))));
  const layeredCrownGeo = ownGeo(mergeGeometries(crownParts, false)!); crownParts.forEach(g => g.dispose());
  const batches = new Map<string, { g: THREE.BufferGeometry; m: THREE.Material; shadow: boolean; matrix: THREE.Matrix4[]; colors: THREE.Color[] }>(), dummy = new THREE.Object3D();
  function instance(g: THREE.BufferGeometry, m: THREE.Material, p: V3, s: V3, shadow = false, rotation: V3 = [0, 0, 0], tint = 0xffffff) { const key = `${g.uuid}:${m.uuid}:${shadow}`; if (!batches.has(key)) batches.set(key, { g, m, shadow, matrix: [], colors: [] }); dummy.position.set(...p); dummy.scale.set(...s); dummy.rotation.set(...rotation); dummy.updateMatrix(); const b = batches.get(key)!; b.matrix.push(dummy.matrix.clone()); b.colors.push(new THREE.Color(tint)); }
  const box = (p: V3, s: V3, m: THREE.Material, shadow = false, round = true) => instance(round ? rounded : cube, m, p, s, shadow);
  function addMesh(name: string, g: THREE.BufferGeometry, m: THREE.Material, p: V3, shadow = true) { const mesh = new THREE.Mesh(g, m); mesh.name = name; mesh.position.set(...p); mesh.castShadow = shadow; mesh.receiveShadow = true; group.add(mesh); sceneObjects[name] = mesh; return mesh; }
  function archWall(name: string, width: number, height: number, openingW: number, openingH: number, p: V3) { const shape = new THREE.Shape(); shape.moveTo(-width / 2, 0); shape.lineTo(width / 2, 0); shape.lineTo(width / 2, height); shape.lineTo(-width / 2, height); shape.closePath(); const hole = new THREE.Path(); hole.moveTo(-openingW / 2, 0); hole.lineTo(-openingW / 2, openingH - openingW / 2); hole.absarc(0, openingH - openingW / 2, openingW / 2, Math.PI, 0, true); hole.lineTo(openingW / 2, 0); hole.closePath(); shape.holes.push(hole); const g = ownGeo(new THREE.ExtrudeGeometry(shape, { depth: .78, bevelEnabled: true, bevelSize: .055, bevelThickness: .055, bevelSegments: 3, curveSegments: 20 })); g.translate(0, 0, -.39); return addMesh(name, g, mats.brick, p); }
  function archTrim(name: string, x: number, radius: number, springY: number, z: number) {
    const ring = addMesh(name, ownGeo(new THREE.TorusGeometry(radius, .16, 8, 36, Math.PI)), mats.stone, [x, springY, z]);
    ring.rotation.z = 0;
    box([x - radius, (springY + .3) / 2, z], [.3, springY - .3, .2], mats.stone, true);
    box([x + radius, (springY + .3) / 2, z], [.3, springY - .3, .2], mats.stone, true);
  }
  // Museum-style display base, a restrained road and a deep entrance axis.
  box([0, -.31, 0], [18, .62, 18], mats.base, false); box([0, .03, 0], [17.75, .12, 17.75], mats.soil); box([0, .12, 7.05], [17.55, .18, 2.6], mats.road, false);
  box([0, .24, 5.45], [17.55, .16, .58], mats.paving, false); box([0, .2, -.15], [6.2, .12, 10.2], mats.paving, false);
  for (let x = -7.4; x < 8; x += 1.65) box([x, .225, 6], [.72, .02, .07], mats.stripe, false, false);
  for (let z = 5.82; z < 8.12; z += .34) box([0, .235, z], [1.75, .025, .17], mats.stripe, false, false);
  for (const side of [-1, 1]) box([side * 5.7, .19, -.9], [5.8, .22, 7.55], mats.grass, false);
  // The photo-derived triple gate.
  archWall("central-gate", 5.65, 6.7, 2.9, 4.45, [0, .3, .58]); archWall("left-gate", 3.45, 4.65, 1.52, 2.95, [-4.5, .3, .48]); archWall("right-gate", 3.45, 4.65, 1.52, 2.95, [4.5, .3, .48]);
  archTrim("central-stone-arch", 0, 1.45, 3.28, .995); archTrim("left-stone-arch", -4.5, .76, 2.49, .895); archTrim("right-stone-arch", 4.5, .76, 2.49, .895);
  for (const x of [-5.75, -3.15, -1.95, 1.95, 3.15, 5.75]) { box([x, .72, .7], [.54, .8, 1.08], mats.stone, true); box([x, 2.58, .7], [.28, 3.05, .98], mats.stone, true); }
  box([0, 5.78, 1.13], [4.05, .82, .2], mats.sign, false); sceneObjects.signboard = new THREE.Object3D(); sceneObjects.signboard.position.set(0, 5.78, 1.13); group.add(sceneObjects.signboard);
  const signCanvas = document.createElement("canvas"); signCanvas.width = 1024; signCanvas.height = 180; const signContext = signCanvas.getContext("2d")!;
  signContext.fillStyle = "#f5dfb0"; signContext.font = '700 92px "Microsoft JhengHei",sans-serif'; signContext.textAlign = "center"; signContext.textBaseline = "middle"; signContext.fillText("國立高雄科技大學", 512, 92, 930);
  const signTexture = new THREE.CanvasTexture(signCanvas); signTexture.colorSpace = THREE.SRGBColorSpace; textures.add(signTexture);
  const signTextMaterial = new THREE.MeshBasicMaterial({ map: signTexture, transparent: true }); materials.add(signTextMaterial);
  const signText = new THREE.Mesh(ownGeo(new THREE.PlaneGeometry(1, 1)), signTextMaterial); signText.name = "國立高雄科技大學"; signText.position.set(0, 5.78, 1.245); signText.scale.set(3.7, .56, 1); group.add(signText); sceneObjects[signText.name] = signText;
  for (const [x, text] of [[-4.5, "楠梓"], [4.5, "校區"]] as const) { const canvas = document.createElement("canvas"); canvas.width = 256; canvas.height = 96; const ctx = canvas.getContext("2d")!; ctx.fillStyle = "#eee6d6"; ctx.font = '700 62px "Microsoft JhengHei",sans-serif'; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(text, 128, 49); const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace; textures.add(map); const material = new THREE.MeshStandardMaterial({ map, transparent: true, roughness: .75 }); materials.add(material); const label = new THREE.Mesh(ownGeo(new THREE.PlaneGeometry(1, 1)), material); label.name = `side-sign-${text}`; label.position.set(x, 3.82, .958); label.scale.set(.82, .27, 1); group.add(label); sceneObjects[label.name] = label; }
  function roof(name: string, x: number, y: number, width: number, depth: number, z = .55) {
    const xSegments = 28, zSegments = 16, positions: number[] = [], uvs: number[] = [], indices: number[] = [];
    const heightAt = (lx: number, lz: number) => .1 + .61 * (1 - Math.abs(lz) / (depth / 2)) + .17 * Math.pow(Math.abs(lx) / (width / 2), 6) + .045 * Math.pow(Math.abs(lz) / (depth / 2), 8);
    for (let iz = 0; iz <= zSegments; iz++) for (let ix = 0; ix <= xSegments; ix++) { const lx = (ix / xSegments - .5) * width, lz = (iz / zSegments - .5) * depth; positions.push(lx, heightAt(lx, lz), lz); uvs.push(ix / xSegments * 4, iz / zSegments * 2); }
    for (let iz = 0; iz < zSegments; iz++) for (let ix = 0; ix < xSegments; ix++) { const a = iz * (xSegments + 1) + ix, b = a + 1, c = a + xSegments + 1, d = c + 1; indices.push(a, c, b, b, c, d); }
    const geometry = ownGeo(new THREE.BufferGeometry()); geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3)); geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2)); geometry.setIndex(indices); geometry.computeVertexNormals();
    addMesh(name, geometry, mats.roof, [x, y, z]);
    const underside = ownGeo(geometry.clone()); underside.translate(0, -.09, 0); addMesh(`${name}-underside`, underside, mats.roof, [x, y, z], true);
    box([x, y + .72, z], [width * .9, .11, .12], mats.roofLight, true);
    const tileParts: THREE.BufferGeometry[] = [], tileCount = Math.max(18, Math.round(width * 3.6));
    for (let i = 0; i < tileCount; i++) { const lx = ((i + .5) / tileCount - .5) * width * .96, points: THREE.Vector3[] = []; for (let j = 0; j <= 8; j++) { const lz = (j / 8 - .5) * depth * .98; points.push(new THREE.Vector3(lx, heightAt(lx, lz) + .035, lz)); } tileParts.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 10, .023, 4, false)); }
    const tiles = mergeGeometries(tileParts, false); tileParts.forEach(part => part.dispose()); if (tiles) addMesh(`${name}-tiles`, ownGeo(tiles), mats.roofLight, [x, y, z], false);
    for (const side of [-1, 1]) for (const front of [-1, 1]) instance(sphere, mats.roofLight, [x + side * width * .49, y + .48, z + front * depth * .49], [.11, .09, .11], true);
  }
  roof("central-tiled-roof", 0, 6.95, 6.95, 1.75); roof("left-tiled-roof", -4.5, 4.93, 4.65, 1.58); roof("right-tiled-roof", 4.5, 4.93, 4.65, 1.58);
  for (const [x, y, width, depth] of [[0, 6.92, 6.35, 1.38], [-4.5, 4.9, 4.12, 1.25], [4.5, 4.9, 4.12, 1.25]] as const) { box([x, y, .55], [width, .16, depth], mats.stone, true, false); box([x, y - .11, .55], [width * .94, .08, depth * .84], mats.roof, true, false); const count = Math.round(width / .27); for (let i = 0; i < count; i++) instance(cube, mats.roofLight, [x - width / 2 + (i + .5) * width / count, y - .18, 1.2], [.05, .13, .25], false); }
  box([-4.5, 3.82, .91], [1.02, .34, .08], mats.sign, false); box([4.5, 3.82, .91], [1.02, .34, .08], mats.sign, false);
  // Fine wrought-iron entrance gate, recessed so the stone arch remains dominant.
  for (let i = 0; i < 15; i++) { const gx = -1.24 + i * (2.48 / 14), archHeight = 3.35 + Math.sqrt(Math.max(0, 1.42 * 1.42 - gx * gx)); instance(cylinder, mats.metal, [gx, archHeight / 2, .03], [.022, archHeight - .42, .022], false); instance(sphere, mats.metal, [gx, archHeight - .18, .03], [.045, .09, .045], false); }
  for (const gy of [.62, 1.55, 2.48]) box([0, gy, .03], [2.65, .045, .045], mats.metal, false, false);
  // Rear campus avenue, detailed guard house, side walls and restrained academic buildings.
  box([0, .2, -3.7], [2.5, .12, 5.4], mats.road, false);
  for (const side of [-1, 1]) { box([side * 7.25, 1.03, .5], [2.05, 1.48, .5], mats.brick, true); box([side * 7.25, 1.82, .5], [2.2, .12, .62], mats.stone, true); for (let i = 0; i < 7; i++) instance(cylinder, mats.metal, [side * (6.32 + i * .27), .9, .46], [.025, 1.25, .025], false); }
  box([6.65, .2, 2.15], [1.85, .12, 1.85], mats.paving, false); box([6.65, .84, 2.15], [1.45, 1.2, 1.48], mats.brick, true); box([6.65, 1.53, 2.15], [1.75, .14, 1.76], mats.stone, true); roof("guardhouse-roof", 6.65, 1.57, 1.98, 1.88, 2.15); for (const [wx, wz, ry] of [[6.65, 2.92, 0], [5.9, 2.15, Math.PI / 2], [7.4, 2.15, Math.PI / 2]] as const) instance(cube, mats.guardGlass, [wx, 1.02, wz], [ry ? .035 : 1.08, .58, ry ? 1.04 : .035], false);
  const rearBuildings = [{ x: -4.5, width: 3.7, height: 3 }, { x: 0, width: 4.5, height: 3.45 }, { x: 4.5, width: 3.7, height: 3 }]; let rearWindowIndex = 0;
  for (const building of rearBuildings) { box([building.x, building.height / 2 + .18, -6.25], [building.width, building.height, 2.15], mats.brickLight, true); box([building.x, building.height + .24, -6.25], [building.width + .22, .16, 2.35], mats.stone, true); for (let floor = 0; floor < 3; floor++) { const wy = .75 + floor * .78; box([building.x, wy + .34, -5.15], [building.width + .04, .055, .08], mats.stone, false); for (const offset of [-1.15, -.38, .38, 1.15]) { const index = rearWindowIndex++, m = index % 3 === 0 ? mats.brightGlass : index === 5 ? mats.dimGlass : mats.glass; box([building.x + offset, wy, -5.14], [.45, .48, .035], m); } } }
  // Layered mature trees and restrained entrance gardens.
  const trees: { root: THREE.Group; x: number; z: number; phase: number }[] = [];
  for (const side of [-1, 1]) for (let i = 0; i < 5; i++) { const x = side * (5.85 + (i % 2) * 1.18), z = -1.15 - i * 1.08, h = 3.45 + (i % 3) * .38; instance(cylinder, mats.trunk, [x, h / 2 + .18, z], [.13, h, .13], true); for (const branch of [-1, 1]) instance(cylinder, mats.trunk, [x + branch * .18, h * .82, z], [.065, .72, .065], true, [0, 0, branch * .48]); const root = new THREE.Group(); root.position.set(x, h + .25, z); root.userData.phase = i + (side > 0 ? 2 : 0); group.add(root); trees.push({ root, x, z, phase: root.userData.phase }); const crown = new THREE.Mesh(layeredCrownGeo, i % 2 ? mats.leafLight : mats.leaf); crown.scale.set(1.18 + (i % 2) * .16, 1.05 + (i % 3) * .12, 1.12); crown.castShadow = true; crown.receiveShadow = true; root.add(crown); }
  for (const side of [-1, 1]) for (const z of [-2.55, -4.5]) { box([side * 6.25, .52, z], [1.45, .14, .46], mats.roofLight, true); for (const xOffset of [-.58, .58]) { box([side * 6.25 + xOffset, .3, z], [.09, .42, .38], mats.metal, true); box([side * 6.25 + xOffset, .82, z - .18], [.09, .56, .09], mats.metal, true); } }
  for (const x of [-7.1, -6.55, 6.55, 7.1]) for (let z = -.3; z < 3; z += .62) instance(crownGeo, mats.leafLight, [x, .43, z], [.38, .34, .38]);
  for (const side of [-1, 1]) for (let i = 0; i < 14; i++) { const x = side * (6.15 + (i % 3) * .28), z = -.15 + Math.floor(i / 3) * .62; instance(sphere, i % 2 ? mats.leafLight : mats.leaf, [x, .35, z], [.2, .16, .2]); instance(sphere, i % 3 ? mats.warm : mats.brickLight, [x + .05, .51, z], [.055, .07, .055]); }
  const shadowSize = 192, shadowPixels = new Uint8Array(shadowSize * shadowSize * 4); for (let y = 0; y < shadowSize; y++) for (let x = 0; x < shadowSize; x++) { const dx = (x - shadowSize / 2) / (shadowSize / 2), dy = (y - shadowSize / 2) / (shadowSize / 2), distance = Math.min(1, Math.hypot(dx, dy)), alpha = Math.pow(1 - distance, 1.7) * .38, i = (y * shadowSize + x) * 4; shadowPixels[i] = 38; shadowPixels[i + 1] = 31; shadowPixels[i + 2] = 25; shadowPixels[i + 3] = Math.round(alpha * 255); } const shadowTexture = new THREE.DataTexture(shadowPixels, shadowSize, shadowSize); shadowTexture.needsUpdate = true; textures.add(shadowTexture); const shadowMaterial = new THREE.MeshBasicMaterial({ map: shadowTexture, transparent: true, depthWrite: false, toneMapped: false }); materials.add(shadowMaterial);
  instance(plane, shadowMaterial, [0, .275, .48], [13.2, 3.2, 1], false, [-Math.PI / 2, 0, 0]); instance(plane, shadowMaterial, [0, .27, -6.1], [14, 4.2, 1], false, [-Math.PI / 2, 0, 0]); instance(plane, shadowMaterial, [6.65, .275, 2.15], [2.3, 2.3, 1], false, [-Math.PI / 2, 0, 0]);
  const lampPositions: V3[] = []; for (const x of [-7.25, 7.25]) { instance(cylinder, mats.metal, [x, 1.45, 2.55], [.065, 2.45, .065]); box([x, 2.7, 2.55], [.3, .15, .3], mats.warm); lampPositions.push([x, 2.6, 2.55]); }
  instance(cylinder, mats.stone, [0, 8.03, .55], [.025, 1.55, .025], true);
  for (const batch of batches.values()) { const mesh = new THREE.InstancedMesh(batch.g, batch.m, batch.matrix.length); batch.matrix.forEach((m, i) => { mesh.setMatrixAt(i, m); mesh.setColorAt(i, batch.colors[i]); }); mesh.castShadow = batch.shadow; mesh.receiveShadow = true; mesh.computeBoundingSphere(); group.add(mesh); }
  const bounds = new THREE.Box3().set(new THREE.Vector3(-9, -.94, -9), new THREE.Vector3(9, 8.78, 9));
  let time = 0, disposed = false;
  function update(delta: number, night: number, reduced = false) { if (disposed) return false; if (!reduced) time += delta; trees.forEach((t) => { t.root.rotation.z = reduced ? 0 : Math.sin(time * .7 + t.phase) * .012; }); mats.sign.emissiveIntensity = night * .42; mats.glass.emissiveIntensity = night * .65; mats.warm.emissiveIntensity = night * 1.25; return !reduced; }
  function dispose() { if (disposed) return; disposed = true; group.traverse(o => { if (o instanceof THREE.InstancedMesh) o.dispose(); }); geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose()); group.clear(); }
  return { group, sceneObjects, bounds, mats, labels: [], entryZ: 1.1, id: "nanzih", windowCount: 36, litWindowCount: 13, lampPositions, moving: true, update, dispose };
}

// Retained as an explicit legacy fallback while the dedicated Nanzih model is active.
void createNanzihRealisticModel;

// 暫用量體示意，並非實際建築復刻；日後只需替換此處的校區配置／模型。
const configurations: Record<string, { id: string; accent: number; seed: number; blocks: Block[] }> = {
  楠梓校區: { id: "nanzih", accent: 0x4d9197, seed: 17, blocks: [
    { position: [0, 2.7, -4.4], size: [4.3, 5, 3.4], floors: 5, columns: 5 },
    { position: [-4.7, 2, -4.2], size: [4.5, 3.6, 3], floors: 4, columns: 5 },
    { position: [4.4, 2.2, -4.7], size: [3.7, 4, 4], floors: 4, columns: 4 },
  ] },
  第一校區: { id: "first", accent: 0xb99754, seed: 49, blocks: [
    { position: [-4.2, 2.5, -4.3], size: [4.5, 4.6, 4.3], floors: 5, columns: 5 },
    { position: [4.2, 2.5, -4.3], size: [4.5, 4.6, 4.3], floors: 5, columns: 5 },
    { position: [0, 1.9, -5.2], size: [4.1, 3.4, 2.6], floors: 3, columns: 4 },
  ] },
  燕巢校區: { id: "yanchao", accent: 0xb27668, seed: 73, blocks: [
    { position: [0, 2.9, -4.9], size: [4.2, 5.4, 3.6], floors: 5, columns: 4 },
    { position: [-4.5, 1.9, -3.7], size: [4.5, 3.4, 3.2], floors: 3, columns: 5 },
    { position: [4.4, 2.3, -4.6], size: [4, 4.2, 3.8], floors: 4, columns: 4 },
  ] },
};

export function createSimpleCampusModel(name: string) {
  if (name === "楠梓校區") return createNanzihCampusModel();
  if (name === "燕巢校區") return createYanchaoCampusModel();
  const config = configurations[name];
  if (!config) throw new Error(`Unsupported placeholder campus: ${name}`);
  const group = new THREE.Group(); group.name = `${name}簡易微縮模型`; group.userData.campus = name;
  const sceneObjects: Record<string, THREE.Object3D> = { model: group };
  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>(), textures = new Set<THREE.Texture>();
  const geometry = <T extends THREE.BufferGeometry>(g: T) => { geometries.add(g); return g; };
  const toon = (color: number, emissive = 0) => {
    const m = new THREE.MeshStandardMaterial({ color, emissive, emissiveIntensity: 0, roughness: .88 }); materials.add(m); return m;
  };
  const mats = {
    base: toon(0x5e787d), ground: toon(0xcbd2c8), wall: toon(0xe7e7df), trim: toon(0xf3f1e7), accent: toon(config.accent),
    road: toon(0x606b70), stripe: toon(0xf4efda), grass: toon(0x8da67b), leaves: toon(0x578163), trunk: toon(0x8a7660),
    metal: toon(0x53666b), glass: toon(0x5c7c89), brightGlass: toon(0x647e87, 0xffcd87), dimGlass: toon(0x647e87, 0xefba7c),
    guardGlass: toon(0x5c7c89, 0xffce93), warm: toon(0xe9e3cc, 0xffd398),
  };
  mats.glass.roughness = .42; mats.brightGlass.roughness = mats.dimGlass.roughness = .42;
  const cube = geometry(new THREE.BoxGeometry(1, 1, 1)), rounded = geometry(new RoundedBoxGeometry(1, 1, 1, 1, .035));
  const sphere = geometry(new THREE.SphereGeometry(.5, 10, 7)), cylinder = geometry(new THREE.CylinderGeometry(.5, .5, 1, 8)), plane = geometry(new THREE.PlaneGeometry(1, 1));
  const batches = new Map<string, { g: THREE.BufferGeometry; m: THREE.Material; shadow: boolean; matrices: THREE.Matrix4[]; colors: THREE.Color[] }>();
  const dummy = new THREE.Object3D();
  function instance(g: THREE.BufferGeometry, m: THREE.Material, p: V3, scale: V3, shadow = false, rotation = 0, tint = 0xffffff) {
    const key = `${g.uuid}:${m.uuid}:${shadow}`;
    if (!batches.has(key)) batches.set(key, { g, m, shadow, matrices: [], colors: [] });
    dummy.position.set(...p); dummy.scale.set(...scale); dummy.rotation.set(0, rotation, 0); dummy.updateMatrix();
    const batch = batches.get(key)!; batch.matrices.push(dummy.matrix.clone()); batch.colors.push(new THREE.Color(tint));
  }
  const box = (p: V3, size: V3, m: THREE.Material, shadow = false, bevel = false) => instance(bevel ? rounded : cube, m, p, size, shadow);
  function label(text: string, p: V3, width: number, height: number) {
    const canvas = document.createElement("canvas"); canvas.width = 1024; canvas.height = 128;
    const ctx = canvas.getContext("2d")!; ctx.fillStyle = "#284653"; ctx.font = '700 82px "Microsoft JhengHei",sans-serif'; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(text, 512, 64, 985);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; textures.add(texture);
    const m = new THREE.MeshStandardMaterial({ map: texture, emissiveMap: texture, emissive: 0xffcb89, emissiveIntensity: 0, transparent: true, roughness: .9 }); materials.add(m);
    const mesh = new THREE.Mesh(plane, m); mesh.position.set(...p); mesh.scale.set(width, height, 1); group.add(mesh); sceneObjects[text] = mesh; return m;
  }

  box([0, -.45, 0], [18, .9, 18], mats.base, false, true);
  box([0, .1, 0], [17.98, .2, 17.98], mats.ground);
  box([0, .215, 6.5], [17.9, .03, 2.8], mats.road);
  box([0, .22, .95], [4.2, .03, 8.2], mats.road);
  for (const z of [4.86, 8.1]) box([0, .24, z], [17.9, .09, .2], mats.trim);
  for (let x = -8; x < 8.5; x += 1.55) box([x, .24, 6.7], [.74, .012, .05], mats.stripe);
  for (let z = 5.32; z < 7.7; z += .36) box([-5.6, .24, z], [1.28, .012, .18], mats.stripe);
  for (const x of [-2.02, 2.02]) box([x, .24, .9], [.035, .012, 7.8], mats.stripe);
  for (const x of [-5.3, 5.3]) box([x, .235, .85], [5.4, .075, 5.8], mats.grass);

  box([-4.65, .55, 3.98], [4.9, .7, .46], mats.accent, true);
  box([-4.65, 1.04, 3.98], [5.04, .65, .52], mats.wall, true, true);
  const wallLabel = label(`國立高雄科技大學 ${name}`, [-4.65, 1.04, 4.247], 4.75, .27);
  box([2.85, .35, 2.8], [1.75, .22, 1.72], mats.trim);
  box([2.85, 1.03, 2.8], [1.44, 1.22, 1.35], mats.accent, true, true);
  box([2.85, 1.7, 2.8], [1.72, .16, 1.63], mats.trim, true);
  box([2.85, 1.16, 3.49], [1.12, .51, .025], mats.guardGlass);
  box([3.585, 1.16, 2.8], [.025, .51, .95], mats.guardGlass);
  for (const x of [-1.52, 1.52]) {
    box([x, .68, 3.45], [.16, .9, .16], mats.metal);
    box([x > 0 ? .92 : -.92, 1.06, 3.45], [1.2, .065, .075], mats.stripe);
    for (const offset of [-.32, .1, .5]) box([x > 0 ? .92 + offset : -.92 + offset, 1.06, 3.45], [.15, .071, .08], mats.accent);
  }

  let windowCount = 0, litWindowCount = 0, seed = config.seed;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  // 固定種子洗牌，保持約 35% 亮窗，且日夜切換不會重新抽選。
  const totalWindows = config.blocks.reduce((sum, b) => sum + b.floors * b.columns * 2, 0);
  const windowMaterials = Array.from({ length: totalWindows }, (_, i) => i < Math.round(totalWindows * .14) ? mats.brightGlass : i < Math.round(totalWindows * .35) ? mats.dimGlass : mats.glass);
  for (let i = windowMaterials.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [windowMaterials[i], windowMaterials[j]] = [windowMaterials[j], windowMaterials[i]];
  }
  for (const block of config.blocks) {
    const [x, y, z] = block.position, [w, h, d] = block.size;
    box(block.position, block.size, mats.wall, true, true);
    box([x, y + h / 2 + .07, z], [w + .22, .18, d + .22], mats.accent);
    for (let floor = 0; floor < block.floors; floor++) {
      const fy = .65 + floor * (h - .52) / block.floors;
      box([x, fy + .42, z + d / 2 + .028], [w + .04, .07, .12], mats.trim);
      for (const side of [-1, 1]) for (let col = 0; col < block.columns; col++) {
        const m = windowMaterials[windowCount++];
        if (m !== mats.glass) litWindowCount++;
        instance(cube, m, [x - w / 2 + (col + .5) * w / block.columns, fy, z + side * (d / 2 + .015)], [w / block.columns * .67, .44, .03]);
      }
    }
  }
  const center = config.blocks.find(b => b.position[0] === 0)!;
  const entryZ = center.position[2] + center.size[2] / 2;
  box([0, .86, entryZ + .025], [1.6, 1.25, .055], mats.guardGlass);
  box([0, 1.62, entryZ + .4], [2.35, .16, 1.05], mats.trim, true);
  box([0, .3, entryZ + .48], [2.45, .16, .9], mats.trim);
  const titleLabel = label(name, [0, center.position[1] + center.size[1] / 2 - .31, entryZ + .035], 2.5, .31);
  instance(cylinder, mats.trim, [-4.25, .31, .05], [2.3, .15, 2.3]);
  const emblem = createCampusEmblem(); emblem.position.set(-4.25, .45, .05); emblem.scale.setScalar(.5); group.add(emblem); sceneObjects.emblem = emblem;

  for (const [x, z, h] of [[-7.1, .3, 2.5], [-7.1, -5.8, 2.8], [7.15, -5.7, 2.7], [6.6, 2.75, 2.35], [5.65, -.25, 2.65]] as V3[]) {
    instance(cylinder, mats.trunk, [x, h / 2, z], [.15, h, .15], true);
    for (let j = 0; j < 3; j++) instance(sphere, mats.leaves, [x + (j - 1) * .35, h + (j === 1 ? .38 : .14), z + (j % 2 ? -.12 : .12)], [1.15, 1.35, 1.12], true, j, j % 2 ? 0xb6c8a6 : 0xffffff);
  }
  for (let i = 0; i < 12; i++) instance(sphere, mats.leaves, [-6.85 + i * .4, .44, 4.48], [.45, .5, .45]);
  for (const x of [-7.45, 4.2, 7.5]) {
    instance(cylinder, mats.metal, [x, 1.57, 3.7], [.075, 2.75, .075]);
    box([x, 2.98, 3.7], [.36, .14, .36], mats.warm);
  }
  for (const batch of batches.values()) {
    const mesh = new THREE.InstancedMesh(batch.g, batch.m, batch.matrices.length);
    batch.matrices.forEach((m, i) => { mesh.setMatrixAt(i, m); mesh.setColorAt(i, batch.colors[i]); });
    mesh.castShadow = batch.shadow; mesh.receiveShadow = true; mesh.computeBoundingSphere(); group.add(mesh);
  }
  group.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(group);
  let disposed = false;
  function dispose() {
    if (disposed) return; disposed = true;
    group.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      if (object instanceof THREE.InstancedMesh) object.dispose();
      geometries.add(object.geometry);
      for (const m of Array.isArray(object.material) ? object.material : [object.material]) {
        materials.add(m); for (const value of Object.values(m)) if (value instanceof THREE.Texture) textures.add(value);
      }
    });
    geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose()); group.clear();
  }
  return { group, sceneObjects, bounds, mats, labels: [wallLabel, titleLabel], entryZ, id: config.id, windowCount, litWindowCount, dispose };
}
