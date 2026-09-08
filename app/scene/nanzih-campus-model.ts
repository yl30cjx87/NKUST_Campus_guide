import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

type V3 = [number, number, number];

/** A dedicated, presentation-grade reconstruction of the Nanzih ceremonial gate. */
export function createNanzihCampusModel() {
  const group = new THREE.Group();
  group.name = "楠梓校區三拱牌樓建築微縮模型";
  group.userData.campus = "楠梓校區";
  group.userData.visualStyle = "architectural-miniature-rebuild";
  const sceneObjects: Record<string, THREE.Object3D> = { model: group };
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  const own = <T extends THREE.BufferGeometry>(value: T) => (geometries.add(value), value);

  function surface(kind: "brick" | "limestone" | "tile" | "paving" | "road" | "grass") {
    const size = 512;
    const data = new Uint8Array(size * size * 4);
    const base = kind === "brick" ? [176, 101, 82] : kind === "limestone" ? [218, 211, 195] :
      kind === "tile" ? [140, 52, 38] : kind === "road" ? [78, 82, 82] :
      kind === "grass" ? [103, 126, 75] : [184, 178, 164];
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const hash = Math.sin(x * 91.17 + y * 47.31) * 16731.73;
      let grain = (hash - Math.floor(hash) - .5) * (kind === "road" ? 24 : kind === "grass" ? 18 : 9);
      if (kind === "brick") {
        const row = Math.floor(y / 24), offset = row % 2 ? 34 : 0;
        const joint = y % 24 < 2 || (x + offset) % 68 < 2;
        if (joint) grain -= 48;
      } else if (kind === "tile") {
        if (x % 18 < 2) grain -= 24;
      } else if (kind === "paving" || kind === "limestone") {
        if (x % 64 < 2 || y % 64 < 2) grain -= 16;
      }
      data[i] = THREE.MathUtils.clamp(base[0] + grain, 0, 255);
      data[i + 1] = THREE.MathUtils.clamp(base[1] + grain * .75, 0, 255);
      data[i + 2] = THREE.MathUtils.clamp(base[2] + grain * .55, 0, 255);
      data[i + 3] = 255;
    }
    const texture = new THREE.DataTexture(data, size, size);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(kind === "brick" ? 4 : 3, kind === "brick" ? 5 : 3);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 12;
    texture.needsUpdate = true;
    textures.add(texture);
    return texture;
  }

  const maps = { brick: surface("brick"), limestone: surface("limestone"), tile: surface("tile"), paving: surface("paving"), road: surface("road"), grass: surface("grass") };
  function pbr(color: number, map?: THREE.Texture, roughness = .78, metalness = 0) {
    const parameters: THREE.MeshStandardMaterialParameters = { color, roughness, metalness };
    if (map) Object.assign(parameters, { map, bumpMap: map, bumpScale: .018 });
    const material = new THREE.MeshStandardMaterial(parameters);
    materials.add(material);
    return material;
  }
  const brightGlass = pbr(0x263e44, undefined, .25), dimGlass = pbr(0x283f43, undefined, .3), guardGlass = pbr(0x31525a, undefined, .2);
  brightGlass.emissive.set(0xffc06d); dimGlass.emissive.set(0xe8a762); guardGlass.emissive.set(0xffbd73);
  const mats = {
    base: pbr(0x747b78, undefined, .92), soil: pbr(0x735c4a, undefined, 1), road: pbr(0xffffff, maps.road, .98),
    paving: pbr(0xffffff, maps.paving, .9), brick: pbr(0xffffff, maps.brick, .86), brickDark: pbr(0x8f4c3f, maps.brick, .92),
    stone: pbr(0xffffff, maps.limestone, .7), stoneDark: pbr(0xc7bba6, maps.limestone, .84), tile: pbr(0xffffff, maps.tile, .74),
    tileEdge: pbr(0x873428, undefined, .72), wood: pbr(0x623329, undefined, .86), metal: pbr(0x20292b, undefined, .35, .38),
    grass: pbr(0xffffff, maps.grass, 1), leafDark: pbr(0x315f3a, undefined, .9), leaf: pbr(0x477d48, undefined, .88),
    leafLight: pbr(0x6c9657, undefined, .88), trunk: pbr(0x675143, undefined, .98), sign: pbr(0x152d43, undefined, .44),
    glass: pbr(0x36545a, undefined, .28), brightGlass, dimGlass, guardGlass, warm: pbr(0xffd39a, undefined, .58),
    stripe: pbr(0xf2eee4, undefined, .9), yellowMark: pbr(0xd7ae42, undefined, .88), carPaint: pbr(0x315c78, undefined, .28, .34),
    carChrome: pbr(0xd9dddb, undefined, .2, .78), tire: pbr(0x17191a, undefined, .94), skin: pbr(0xe2b28f, undefined, .78), clothing: pbr(0xc77a45, undefined, .84),
  };
  mats.sign.emissive.set(0xffcf85); mats.warm.emissive.set(0xffb65d);
  mats.brick.bumpScale = mats.brickDark.bumpScale = .009;
  mats.stone.bumpScale = mats.stoneDark.bumpScale = .006;

  const boxGeo = own(new THREE.BoxGeometry(1, 1, 1));
  const roundedGeo = own(new RoundedBoxGeometry(1, 1, 1, 2, .055));
  const cylinderGeo = own(new THREE.CylinderGeometry(.5, .5, 1, 18));
  const sphereGeo = own(new THREE.SphereGeometry(.5, 18, 12));
  const leafClusterGeo = own(new THREE.IcosahedronGeometry(.5, 2));
  const spearGeo = own(new THREE.ConeGeometry(.075, .22, 8));
  const planeGeo = own(new THREE.PlaneGeometry(1, 1));
  const dummy = new THREE.Object3D();
  const instances = new Map<string, { geometry: THREE.BufferGeometry; material: THREE.Material; matrices: THREE.Matrix4[]; colors: THREE.Color[]; shadow: boolean }>();
  function instance(geometry: THREE.BufferGeometry, material: THREE.Material, position: V3, scale: V3, rotation: V3 = [0, 0, 0], shadow = true, tint = 0xffffff) {
    const key = `${geometry.uuid}:${material.uuid}:${shadow}`;
    if (!instances.has(key)) instances.set(key, { geometry, material, matrices: [], colors: [], shadow });
    dummy.position.set(...position); dummy.rotation.set(...rotation); dummy.scale.set(...scale); dummy.updateMatrix();
    const batch = instances.get(key)!; batch.matrices.push(dummy.matrix.clone()); batch.colors.push(new THREE.Color(tint));
  }
  const box = (position: V3, size: V3, material: THREE.Material, shadow = true, rounded = false) => instance(rounded ? roundedGeo : boxGeo, material, position, size, [0, 0, 0], shadow);
  function mesh(name: string, geometry: THREE.BufferGeometry, material: THREE.Material, position: V3, shadow = true) {
    const value = new THREE.Mesh(geometry, material); value.name = name; value.position.set(...position); value.castShadow = shadow; value.receiveShadow = true;
    group.add(value); sceneObjects[name] = value; return value;
  }
  function mergeDirectMeshes(parent: THREE.Group, name: string, excluded = new Set<THREE.Mesh>()) {
    const source = parent.children.filter((child): child is THREE.Mesh => child instanceof THREE.Mesh && !excluded.has(child));
    const byMaterial = new Map<THREE.Material, { geometries: THREE.BufferGeometry[]; shadow: boolean; receive: boolean }>();
    for (const child of source) {
      child.updateMatrix();
      const material = child.material as THREE.Material;
      const entry = byMaterial.get(material) ?? { geometries: [], shadow: false, receive: false };
      let geometry = child.geometry.clone();
      if (geometry.index) {
        const nonIndexed = geometry.toNonIndexed();
        geometry.dispose();
        geometry = nonIndexed;
      }
      entry.geometries.push(geometry.applyMatrix4(child.matrix));
      entry.shadow ||= child.castShadow; entry.receive ||= child.receiveShadow;
      byMaterial.set(material, entry); parent.remove(child);
    }
    let index = 0;
    for (const [material, entry] of byMaterial) {
      const geometry = mergeGeometries(entry.geometries, false); entry.geometries.forEach(value => value.dispose());
      if (!geometry) continue;
      const combined = new THREE.Mesh(own(geometry), material); combined.name = `${name}-${index++}`;
      combined.castShadow = entry.shadow; combined.receiveShadow = entry.receive; parent.add(combined);
    }
  }

  // Museum plinth and a compressed foreground so the gate dominates the composition.
  box([0, -.46, 0], [18, .92, 18], mats.base, false, true);
  box([0, .035, 0], [17.72, .12, 17.72], mats.soil, false, true);
  box([0, .14, 7.35], [17.6, .16, 2.28], mats.road, false, true);
  box([0, .245, 5.85], [17.55, .12, .72], mats.paving, false);
  // Raised pale kerbs clearly separate the asphalt from the campus pavement.
  box([0, .36, 6.13], [17.58, .16, .18], mats.stone, false, true);
  box([0, .28, 8.52], [17.58, .1, .13], mats.stoneDark, false, true);
  box([0, .24, 2.85], [5.4, .12, 6.65], mats.paving, false);
  // Six broad zebra bands replace the previous barcode-like crossing.
  for (let i = 0; i < 6; i++) box([0, .335, 6.55 + i * .34], [2.18, .025, .19], mats.stripe, false, true);
  // Centre dashes stop before the crossing instead of running through it.
  for (let x = -7.75; x <= 7.75; x += 1.45) if (Math.abs(x) > 1.75) box([x, .335, 7.48], [.66, .02, .055], mats.yellowMark, false, true);
  box([-1.34, .337, 7.48], [.08, .022, 1.85], mats.stripe, false, true);
  box([1.34, .337, 7.48], [.08, .022, 1.85], mats.stripe, false, true);
  // Small drain grates anchor the road detail without adding visual clutter.
  for (const x of [-5.8, 5.8]) {
    box([x, .342, 6.24], [.72, .025, .18], mats.metal, false, true);
    for (let dx = -.27; dx <= .27; dx += .09) box([x + dx, .358, 6.24], [.025, .012, .15], mats.stoneDark, false);
  }
  for (const side of [-1, 1]) box([side * 5.9, .19, 1.25], [5.6, .23, 8.6], mats.grass, false, true);
  // Dedicated pull-in bay keeps the angled bus off the lawn and clear of the zebra crossing.
  box([3.0, .245, 4.62], [6.0, .11, 2.18], mats.paving, false, true);
  box([3.0, .33, 5.73], [6.05, .1, .12], mats.stoneDark, false, true);

  function archPanel(name: string, width: number, height: number, openingW: number, openingH: number, x: number, z: number, depth: number) {
    const shape = new THREE.Shape();
    shape.moveTo(-width / 2, 0); shape.lineTo(width / 2, 0); shape.lineTo(width / 2, height); shape.lineTo(-width / 2, height); shape.closePath();
    const opening = new THREE.Path(), radius = openingW / 2, spring = openingH - radius;
    opening.moveTo(-radius, 0); opening.lineTo(-radius, spring); opening.absarc(0, spring, radius, Math.PI, 0, true); opening.lineTo(radius, 0); opening.closePath();
    shape.holes.push(opening);
    const geometry = own(new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSize: .035, bevelThickness: .045, bevelSegments: 3, curveSegments: 36 }));
    geometry.translate(0, 0, -depth / 2);
    return mesh(name, geometry, mats.brick, [x, .31, z]);
  }
  // Three genuinely deep arches, with side bays recessed behind the ceremonial tower.
  archPanel("central-gate", 5.72, 7.15, 3.12, 4.82, 0, .35, 1.34);
  archPanel("left-gate", 3.75, 4.92, 1.64, 3.18, -4.72, .05, 1.08);
  archPanel("right-gate", 3.75, 4.92, 1.64, 3.18, 4.72, .05, 1.08);
  // Side wings finish as low masonry walls and wrought fencing, not featureless red blocks.
  for (const side of [-1, 1]) {
    const x = side * 7.18;
    box([x, .68, .02], [.82, .74, 1.18], mats.stone, true, true);
    box([x, 1.68, .02], [.66, 1.34, 1.02], mats.brickDark, true, true);
    box([x, 2.43, .02], [.88, .16, 1.22], mats.stone, true, true);
    box([x, 2.58, .02], [.58, .15, .82], mats.tileEdge, true, true);
    // The boundary recedes into the campus, revealing trees and buildings through the ironwork.
    box([x, .72, -2.05], [.48, .92, 3.15], mats.brickDark, true, true);
    box([x, 1.22, -2.05], [.62, .14, 3.32], mats.stone, true, true);
    for (let z = -.72; z >= -3.35; z -= .31) {
      instance(cylinderGeo, mats.metal, [x, 1.82, z], [.025, 1.08, .025], [0, 0, 0], true);
      instance(spearGeo, mats.metal, [x, 2.42, z], [.78, .78, .78], [0, 0, 0], true);
    }
    for (const y of [1.36, 2.18]) box([x, y, -2.05], [.11, .055, 3.02], mats.metal, true, true);
    // Inset limestone panel breaks up the terminal pier and echoes the main arch trim.
    box([x - side * .345, 1.66, .25], [.055, .72, .48], mats.stoneDark, false, true);
  }

  function stoneArch(name: string, x: number, radius: number, spring: number, z: number, depth: number) {
    // A true open stone arch: tubular mouldings replace the previous filled half-disc.
    const points: THREE.Vector3[] = [];
    for (let i = 0; i <= 48; i++) {
      const angle = i / 48 * Math.PI;
      points.push(new THREE.Vector3(x + Math.cos(angle) * (radius + .12), spring + Math.sin(angle) * (radius + .12), z));
    }
    const curve = new THREE.CatmullRomCurve3(points);
    const outerRing = mesh(name, own(new THREE.TubeGeometry(curve, 72, .15, 10, false)), mats.stone, [0, 0, 0]);
    outerRing.castShadow = true;
    const innerPoints = points.map((point, i) => {
      const angle = i / 48 * Math.PI;
      return new THREE.Vector3(x + Math.cos(angle) * (radius - .055), spring + Math.sin(angle) * (radius - .055), z + depth * .18);
    });
    mesh(`${name}-inner-moulding`, own(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(innerPoints), 72, .045, 8, false)), mats.stoneDark, [0, 0, 0], false);
    box([x - radius - .12, (spring + .38) / 2, z], [.24, spring - .38, depth], mats.stone);
    box([x + radius + .12, (spring + .38) / 2, z], [.24, spring - .38, depth], mats.stone);
    // Individual voussoirs make the arch readable from the default camera distance.
    const count = radius > 1 ? 19 : 13;
    for (let i = 0; i < count; i++) {
      const a = Math.PI * (i + .5) / count;
      instance(roundedGeo, mats.stoneDark, [x + Math.cos(a) * (radius + .13), spring + Math.sin(a) * (radius + .13), z + depth * .53], [.2, .1, .12], [0, 0, a - Math.PI / 2], false);
    }
    // Enlarged keystone and springing blocks make the arch construction legible.
    box([x, spring + radius + .18, z + depth * .53], [radius > 1 ? .34 : .25, .42, .14], mats.stoneDark, true, true);
    for (const side of [-1, 1]) box([x + side * (radius + .12), spring - .03, z + depth * .53], [.34, .22, .14], mats.stoneDark, true, true);
  }
  stoneArch("central-stone-arch", 0, 1.56, 3.57, 1.045, .2);
  stoneArch("left-stone-arch", -4.72, .82, 2.59, .67, .18);
  stoneArch("right-stone-arch", 4.72, .82, 2.59, .67, .18);

  function pilaster(x: number, height: number, z: number, major = false) {
    const width = major ? .56 : .48;
    box([x, .69, z], [width + .26, .72, 1.34], mats.stone, true, true);
    box([x, 1.12, z], [width + .12, .18, 1.2], mats.stoneDark);
    box([x, (height + 1.08) / 2, z], [width, height - 1.08, 1.02], mats.stone, true, true);
    // Shallow fluting keeps the white structural frame from reading as a plain box.
    for (const offset of [-.13, .13]) box([x + offset, (height + 1.14) / 2, z + .523], [.055, height - 1.34, .035], mats.stoneDark, false, true);
    box([x, height - .24, z], [width + .2, .2, 1.18], mats.stoneDark, true, true);
    box([x, height - .06, z], [width + .38, .18, 1.32], mats.stone, true, true);
    for (const side of [-1, 1]) box([x + side * (width * .52), height - .02, z + .55], [.13, .26, .16], mats.stoneDark, true, true);
  }
  for (const x of [-5.96, -3.48, 3.48, 5.96]) pilaster(x, 4.78, .63);
  for (const x of [-2.13, 2.13]) pilaster(x, 6.15, 1.04, true);
  // Layered stone string courses, wall caps and a deeply framed university plaque.
  box([0, 5.26, 1.07], [5.22, .18, 1.55], mats.stoneDark);
  box([0, 6.18, 1.08], [4.46, 1.04, 1.38], mats.brickDark, true, true);
  box([0, 6.73, 1.13], [4.78, .15, 1.5], mats.stone);
  box([0, 5.92, 1.79], [4.0, .88, .2], mats.stone, false, true);
  box([0, 5.92, 1.91], [3.66, .63, .12], mats.sign, false, true);
  sceneObjects.signboard = new THREE.Object3D(); sceneObjects.signboard.position.set(0, 5.92, 1.95); group.add(sceneObjects.signboard);
  for (const x of [-4.72, 4.72]) { box([x, 3.85, .7], [1.22, .48, .24], mats.stone, false, true); box([x, 3.85, .84], [.98, .29, .1], mats.sign, false, true); }

  function label(text: string, position: V3, scale: V3, fontSize = 86) {
    const canvas = document.createElement("canvas"); canvas.width = 1024; canvas.height = 192;
    const context = canvas.getContext("2d")!; context.fillStyle = "#f4e8c8"; context.font = `700 ${fontSize}px "Microsoft JhengHei",sans-serif`;
    context.textAlign = "center"; context.textBaseline = "middle"; context.fillText(text, 512, 98, 940);
    const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 8; textures.add(map);
    const material = new THREE.MeshStandardMaterial({ map, emissiveMap: map, emissive: 0xffcf85, emissiveIntensity: 0, transparent: true, roughness: .7 }); materials.add(material);
    const value = new THREE.Mesh(planeGeo, material); value.name = text; value.position.set(...position); value.scale.set(...scale); group.add(value); sceneObjects[text] = value; return material;
  }
  const signText = label("國立高雄科技大學", [0, 5.92, 1.985], [3.34, .61, 1], 93);
  label("楠梓", [-4.72, 3.85, .905], [.86, .27, 1], 82); label("校區", [4.72, 3.85, .905], [.86, .27, 1], 82);

  function roof(name: string, x: number, y: number, z: number, width: number, depth: number, rise: number) {
    const xs = 44, zs = 22, positions: number[] = [], uvs: number[] = [], indices: number[] = [];
    const heightAt = (lx: number, lz: number) => {
      const nx = Math.abs(lx) / (width / 2), nz = Math.abs(lz) / (depth / 2);
      return rise * (1 - nz) + .28 * Math.pow(nx, 7) + .16 * Math.pow(nz, 7);
    };
    for (let iz = 0; iz <= zs; iz++) for (let ix = 0; ix <= xs; ix++) {
      const lx = (ix / xs - .5) * width, lz = (iz / zs - .5) * depth;
      positions.push(lx, heightAt(lx, lz), lz); uvs.push(ix / xs * 5, iz / zs * 2);
    }
    for (let iz = 0; iz < zs; iz++) for (let ix = 0; ix < xs; ix++) { const a = iz * (xs + 1) + ix, b = a + 1, c = a + xs + 1, d = c + 1; indices.push(a, c, b, b, c, d); }
    const roofGeo = own(new THREE.BufferGeometry()); roofGeo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3)); roofGeo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2)); roofGeo.setIndex(indices); roofGeo.computeVertexNormals();
    mesh(name, roofGeo, mats.tile, [x, y, z]);
    const underside = own(roofGeo.clone()); underside.translate(0, -.12, 0); mesh(`${name}-soffit`, underside, mats.wood, [x, y, z]);
    // Raised cylindrical tile ribs follow the actual roof curvature.
    const ribs: THREE.BufferGeometry[] = [];
    const ribCount = Math.round(width * 5.1);
    for (let i = 0; i < ribCount; i++) {
      const lx = ((i + .5) / ribCount - .5) * width * .96, points: THREE.Vector3[] = [];
      for (let j = 0; j <= 14; j++) { const lz = (j / 14 - .5) * depth * .98; points.push(new THREE.Vector3(lx, heightAt(lx, lz) + .035, lz)); }
      ribs.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 20, .025, 6, false));
    }
    const merged = mergeGeometries(ribs, false); ribs.forEach(value => value.dispose()); if (merged) mesh(`${name}-tile-ribs`, own(merged), mats.tileEdge, [x, y, z], false);
    box([x, y + rise + .08, z], [width * .91, .14, .16], mats.tileEdge, true, true);
    // Layered fascia, rafters and brackets under the deep eaves.
    for (const front of [-1, 1]) {
      box([x, y - .02, z + front * depth * .5], [width, .18, .16], mats.tileEdge, true, true);
      for (let px = -width * .44; px <= width * .44; px += .34) {
        box([x + px, y - .19, z + front * depth * .43], [.1, .25, .42], mats.wood, true, true);
        box([x + px, y - .33, z + front * depth * .35], [.18, .14, .24], mats.stoneDark, true, true);
      }
    }
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      instance(sphereGeo, mats.tileEdge, [x + sx * width * .505, y + .22, z + sz * depth * .505], [.13, .1, .13], [0, 0, 0], true);
    }
  }
  roof("central-tiled-roof", 0, 7.48, .55, 7.25, 2.25, .66);
  roof("left-tiled-roof", -4.72, 5.18, .22, 4.65, 2.0, .55);
  roof("right-tiled-roof", 4.72, 5.18, .22, 4.65, 2.0, .55);

  // Bespoke wrought-iron gates: real hinge pivots, arched pickets and ornamental scrollwork.
  const gateKnobGeo = own(new THREE.SphereGeometry(.5, 16, 10));
  function gateBar(parent: THREE.Group, position: V3, scale: V3, geometry = cylinderGeo, material: THREE.Material = mats.metal) {
    const value = new THREE.Mesh(geometry, material); value.position.set(...position); value.scale.set(...scale); value.castShadow = true; value.receiveShadow = true; parent.add(value); return value;
  }
  function scroll(parent: THREE.Group, cx: number, cy: number, mirror = 1, scale = 1) {
    const points: THREE.Vector3[] = [];
    for (let i = 0; i <= 32; i++) {
      const t = i / 32 * Math.PI * 1.72, radius = (.34 - i / 32 * .21) * scale;
      points.push(new THREE.Vector3(cx + mirror * Math.cos(t) * radius, cy + Math.sin(t) * radius, .012));
    }
    const geometry = own(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 40, .018, 6, false));
    const value = new THREE.Mesh(geometry, mats.metal); value.castShadow = true; parent.add(value);
  }
  function gateLeaf(name: string, hingeX: number, direction: -1 | 1, width: number, height: number, z: number, openAngle: number, arched: boolean) {
    const leaf = new THREE.Group(); leaf.name = name; leaf.position.set(hingeX, .31, z); leaf.rotation.y = openAngle; group.add(leaf); sceneObjects[name] = leaf;
    const frameX = direction * width / 2;
    gateBar(leaf, [frameX, .11, 0], [width, .08, .075], boxGeo);
    gateBar(leaf, [frameX, 1.02, 0], [width, .065, .065], boxGeo);
    gateBar(leaf, [frameX, height - .18, 0], [width, .075, .075], boxGeo);
    for (const edge of [0, direction * width]) gateBar(leaf, [edge, height / 2, 0], [.052, height, .052]);
    const count = Math.max(6, Math.round(width / .18));
    for (let i = 1; i < count; i++) {
      const localX = direction * width * i / count;
      const worldX = hingeX + localX;
      const archRise = arched ? Math.sqrt(Math.max(0, 1.56 ** 2 - worldX ** 2)) - .48 : 0;
      const barHeight = height + archRise;
      gateBar(leaf, [localX, barHeight / 2, 0], [.023, barHeight, .023]);
      gateBar(leaf, [localX, barHeight + .08, 0], [1, 1, 1], spearGeo);
      if (i % 2 === 0) gateBar(leaf, [localX, .62, 0], [.04, .04, .04], gateKnobGeo, mats.stoneDark);
    }
    // Dense lower lattice gives the gate visual weight and keeps its proportions architectural.
    for (let i = 1; i < count; i++) {
      const localX = direction * width * i / count;
      gateBar(leaf, [localX, .55, .018], [.018, .68, .018], cylinderGeo);
    }
    for (const y of [.28, .52, .76]) gateBar(leaf, [frameX, y, .018], [width, .025, .035], boxGeo);
    // Paired S-scrolls and a warm stone medallion form a clear central ornament.
    scroll(leaf, frameX - direction * width * .18, 1.58, direction, .88);
    scroll(leaf, frameX + direction * width * .18, 1.58, -direction, .88);
    const medallion = gateBar(leaf, [frameX, 1.57, .02], [.13, .13, .065], gateKnobGeo, mats.stoneDark);
    medallion.scale.y = .17;
    for (let spoke = 0; spoke < 8; spoke++) {
      const angle = spoke / 8 * Math.PI * 2;
      const ornament = gateBar(leaf, [frameX + Math.cos(angle) * .18, 1.57 + Math.sin(angle) * .18, .025], [.018, .22, .018], cylinderGeo, mats.stoneDark);
      ornament.rotation.z = angle + Math.PI / 2;
    }
    // Hinge barrels and latch are visible when the user rotates close to the gate.
    for (const y of [.48, 1.52, height - .42]) gateBar(leaf, [0, y, -.02], [.075, .18, .075], cylinderGeo, mats.stoneDark);
    gateBar(leaf, [direction * width, 1.14, .08], [.055, .32, .055], cylinderGeo, mats.stoneDark);
    mergeDirectMeshes(leaf, `${name}-ironwork`);
    return leaf;
  }
  const centralGateLeft = gateLeaf("central-gate-left-leaf", -1.48, 1, 1.48, 3.42, -.39, 0, true);
  const centralGateRight = gateLeaf("central-gate-right-leaf", 1.48, -1, 1.48, 3.42, -.39, 0, true);
  gateLeaf("left-side-iron-gate", -5.42, 1, 1.4, 2.28, -.5, 0, false);
  gateLeaf("right-side-iron-gate", 5.42, -1, 1.4, 2.28, -.5, 0, false);

  // A detailed campus shuttle and one passenger tell a complete day/night story.
  const shuttle = new THREE.Group(); shuttle.name = "campus-shuttle-bus"; shuttle.position.set(-10.5, .35, 7.35); shuttle.rotation.y = -Math.PI / 2; shuttle.scale.setScalar(.74); group.add(shuttle); sceneObjects[shuttle.name] = shuttle;
  function movingPart(parent: THREE.Object3D, geometry: THREE.BufferGeometry, material: THREE.Material, position: V3, scale: V3, rotation: V3 = [0, 0, 0]) {
    const value = new THREE.Mesh(geometry, material); value.position.set(...position); value.scale.set(...scale); value.rotation.set(...rotation); value.castShadow = true; value.receiveShadow = true; parent.add(value); return value;
  }
  movingPart(shuttle, roundedGeo, mats.carPaint, [0, .76, 0], [2.02, 1.12, 6.15]);
  movingPart(shuttle, roundedGeo, mats.stripe, [0, 1.55, .08], [1.9, 1.12, 5.68]);
  movingPart(shuttle, roundedGeo, mats.carPaint, [0, 2.16, .08], [1.98, .2, 5.82]);
  movingPart(shuttle, boxGeo, mats.glass, [0, 1.61, -2.86], [1.7, .72, .055], [-.08, 0, 0]);
  movingPart(shuttle, boxGeo, mats.glass, [0, 1.61, 2.96], [1.7, .72, .055], [.08, 0, 0]);
  movingPart(shuttle, roundedGeo, mats.carChrome, [0, .54, -3.1], [1.72, .16, .14]);
  movingPart(shuttle, roundedGeo, mats.carChrome, [0, .54, 3.1], [1.72, .16, .14]);
  movingPart(shuttle, boxGeo, mats.tire, [0, .83, -3.13], [.92, .3, .055]);
  // Front grille, number plate, roof vents and mirrors add readable bus-scale detail.
  for (let gx = -.62; gx <= .62; gx += .16) movingPart(shuttle, boxGeo, mats.carChrome, [gx, .83, -3.145], [.045, .24, .035]);
  movingPart(shuttle, roundedGeo, mats.stripe, [0, .42, -3.19], [.62, .18, .035]);
  for (const z of [-1.55, .55]) movingPart(shuttle, roundedGeo, mats.tire, [0, 2.31, z], [.64, .09, .55]);
  for (const side of [-1, 1]) {
    movingPart(shuttle, cylinderGeo, mats.carChrome, [side * 1.18, 1.67, -2.68], [.055, .48, .055], [0, 0, side * .8]);
    movingPart(shuttle, roundedGeo, mats.tire, [side * 1.37, 1.75, -2.68], [.24, .15, .1]);
  }
  // Individual side windows and pillars make the vehicle read clearly as a campus bus.
  for (const side of [-1, 1]) for (const z of [-2.12, -1.28, -.44, .4, 1.24, 2.08]) {
    movingPart(shuttle, roundedGeo, mats.glass, [side * .965, 1.62, z], [.045, .65, .68]);
    movingPart(shuttle, boxGeo, mats.carPaint, [side * .99, 1.62, z + .4], [.065, .78, .1]);
  }
  movingPart(shuttle, boxGeo, mats.yellowMark, [0, 1.04, -3.14], [1.28, .14, .035]);
  movingPart(shuttle, boxGeo, mats.yellowMark, [0, 1.04, 3.14], [1.28, .14, .035]);
  const wheels: THREE.Mesh[] = [];
  for (const side of [-1, 1]) for (const z of [-2.12, 2.05]) {
    const wheel = movingPart(shuttle, cylinderGeo, mats.tire, [side * 1.04, .4, z], [.4, .2, .4], [0, 0, Math.PI / 2]); wheels.push(wheel);
    movingPart(shuttle, cylinderGeo, mats.carChrome, [side * 1.17, .4, z], [.19, .21, .19], [0, 0, Math.PI / 2]);
  }
  for (const side of [-1, 1]) {
    movingPart(shuttle, sphereGeo, mats.warm, [side * .64, .72, -3.17], [.22, .14, .06]);
    movingPart(shuttle, sphereGeo, mats.brickDark, [side * .64, .72, 3.17], [.22, .14, .06]);
  }
  // Front-left passenger door: the coach nose is local -Z, so this sits ahead of
  // the front axle on its left side and faces the clear gate-side pavement.
  const passengerDoor = new THREE.Group(); passengerDoor.position.set(-1.02, .94, -2.25); shuttle.add(passengerDoor);
  movingPart(passengerDoor, roundedGeo, mats.carPaint, [0, .1, .58], [.065, 1.35, 1.14]);
  movingPart(passengerDoor, boxGeo, mats.glass, [-.04, .42, .58], [.03, .52, .86]);
  movingPart(shuttle, roundedGeo, mats.carChrome, [-1.06, .28, -1.12], [.52, .12, .64]);
  mergeDirectMeshes(shuttle, "campus-shuttle-body", new Set(wheels));

  const passenger = new THREE.Group(); passenger.name = "campus-passenger"; passenger.position.set(.8, .31, -4.2); passenger.scale.setScalar(.68); group.add(passenger); sceneObjects[passenger.name] = passenger;
  const torso = movingPart(passenger, roundedGeo, mats.clothing, [0, .78, 0], [.34, .53, .25]);
  const head = movingPart(passenger, sphereGeo, mats.skin, [0, 1.35, 0], [.3, .32, .3]);
  movingPart(passenger, sphereGeo, mats.tire, [0, 1.48, -.02], [.31, .16, .31]);
  movingPart(passenger, sphereGeo, mats.tire, [-.1, 1.37, -.285], [.035, .045, .025]); movingPart(passenger, sphereGeo, mats.tire, [.1, 1.37, -.285], [.035, .045, .025]);
  const leftArm = new THREE.Group(), rightArm = new THREE.Group(), leftLeg = new THREE.Group(), rightLeg = new THREE.Group();
  leftArm.name = "left-arm"; rightArm.name = "right-arm"; leftLeg.name = "left-leg"; rightLeg.name = "right-leg";
  leftArm.position.set(-.24, 1.02, 0); rightArm.position.set(.24, 1.02, 0); leftLeg.position.set(-.13, .53, 0); rightLeg.position.set(.13, .53, 0);
  passenger.add(leftArm, rightArm, leftLeg, rightLeg);
  movingPart(leftArm, cylinderGeo, mats.skin, [0, -.27, 0], [.07, .55, .07]); movingPart(rightArm, cylinderGeo, mats.skin, [0, -.27, 0], [.07, .55, .07]);
  movingPart(leftLeg, cylinderGeo, mats.clothing, [0, -.28, 0], [.085, .56, .085]); movingPart(rightLeg, cylinderGeo, mats.clothing, [0, -.28, 0], [.085, .56, .085]);
  movingPart(leftLeg, roundedGeo, mats.tire, [0, -.58, -.06], [.16, .1, .28]); movingPart(rightLeg, roundedGeo, mats.tire, [0, -.58, -.06], [.16, .1, .28]);
  void torso; void head;
  type PassengerRig = { root: THREE.Group; leftArm: THREE.Group; rightArm: THREE.Group; leftLeg: THREE.Group; rightLeg: THREE.Group };
  const rigFor = (root: THREE.Group): PassengerRig => ({
    root,
    leftArm: root.getObjectByName("left-arm") as THREE.Group,
    rightArm: root.getObjectByName("right-arm") as THREE.Group,
    leftLeg: root.getObjectByName("left-leg") as THREE.Group,
    rightLeg: root.getObjectByName("right-leg") as THREE.Group,
  });
  const passengerRigs: PassengerRig[] = [rigFor(passenger)];
  for (let i = 1; i < 3; i++) {
    const student = passenger.clone(true); student.name = `campus-passenger-${i + 1}`;
    // Small clothing variations keep the group readable without creating new geometry.
    student.rotation.y = i === 1 ? .08 : -.08; group.add(student); sceneObjects[student.name] = student; passengerRigs.push(rigFor(student));
  }

  const animationState = new THREE.Object3D(); animationState.name = "arrival-animation-state"; animationState.userData.phase = "waiting"; group.add(animationState); sceneObjects[animationState.name] = animationState;
  const smooth = (value: number) => { const p = THREE.MathUtils.clamp(value, 0, 1); return p * p * (3 - 2 * p); };
  const arrivalPath = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-11.2,.35,7.35), new THREE.Vector3(-5.2,.35,7.35), new THREE.Vector3(-1.3,.35,6.95),
    new THREE.Vector3(.75,.35,5.45), new THREE.Vector3(2.25,.35,4.55),
  ], false, "centripetal");
  const departurePath = new THREE.CatmullRomCurve3([
    new THREE.Vector3(2.25,.35,4.55), new THREE.Vector3(3.7,.35,5.55), new THREE.Vector3(5.55,.35,7.1),
    new THREE.Vector3(8.0,.35,7.35), new THREE.Vector3(11.5,.35,7.35),
  ], false, "centripetal");
  function placeBus(path: THREE.Curve<THREE.Vector3>, amount: number) {
    const p = THREE.MathUtils.clamp(amount, 0, 1), point = path.getPointAt(p), tangent = path.getTangentAt(Math.min(.999, p)).normalize();
    // The grille, windscreen, mirrors and warm headlamps are built at local -Z.
    // Keep that unmistakable front end aligned with the direction of travel.
    shuttle.position.copy(point); shuttle.rotation.y = Math.atan2(-tangent.x, -tangent.z);
  }
  const lerpPosition = (target: THREE.Object3D, from: V3, to: V3, amount: number) => target.position.set(
    THREE.MathUtils.lerp(from[0], to[0], amount), THREE.MathUtils.lerp(from[1], to[1], amount), THREE.MathUtils.lerp(from[2], to[2], amount),
  );

  // Layered campus beyond the open arch provides depth without competing with it.
  box([0, .22, -3.45], [3.0, .12, 6.6], mats.paving, false);
  for (const side of [-1, 1]) box([side * 3.75, .27, -3.65], [4.2, .18, 6.2], mats.grass, false, true);
  function rearBuilding(x: number, z: number, width: number, height: number) {
    box([x, height / 2 + .28, z], [width, height, 2.15], mats.brickDark, true, true);
    box([x, height + .33, z], [width + .28, .16, 2.38], mats.stone);
    for (let floor = 0; floor < 3; floor++) for (let wx = -width / 2 + .55; wx < width / 2; wx += .82) {
      box([x + wx, .82 + floor * .78, z + 1.085], [.44, .47, .035], (floor * 7 + Math.round(wx * 10)) % 3 === 0 ? mats.brightGlass : mats.glass, false);
      box([x + wx, .82 + floor * .78, z + 1.105], [.49, .055, .04], mats.stoneDark, false);
    }
  }
  rearBuilding(-4.65, -6.45, 4.5, 3.35); rearBuilding(0, -7.0, 4.8, 3.9); rearBuilding(4.65, -6.45, 4.5, 3.35);
  // Proper guardhouse, pushed behind the right wing.
  box([7.25, .29, 2.85], [1.75, .12, 2.15], mats.paving, false);
  box([7.25, 1.06, 2.85], [1.45, 1.45, 1.72], mats.brickDark, true, true);
  box([7.25, 1.87, 2.85], [1.86, .17, 2.08], mats.stone, true, true);
  box([7.25, 1.37, 3.73], [1.1, .62, .035], mats.guardGlass, false);
  roof("guardhouse-roof", 7.25, 1.96, 2.85, 2.05, 2.14, .27);

  // Natural multi-cluster trees and layered hedges frame, rather than hide, the gate.
  const treeCrowns: THREE.Group[] = [];
  function tree(x: number, z: number, height: number, phase: number) {
    const crown = new THREE.Group(); crown.position.set(x, height, z); crown.userData.phase = phase; group.add(crown); treeCrowns.push(crown);
    instance(cylinderGeo, mats.trunk, [x, height * .5, z], [.13, height, .13], [0, 0, .035 * Math.sin(phase)], true);
    // Tapered primary branches live with the moving crown and split into fine twigs.
    for (let branch = 0; branch < 6; branch++) {
      const angle = branch / 6 * Math.PI * 2 + phase * .3;
      const length = .78 + (branch % 3) * .13;
      const limb = new THREE.Mesh(cylinderGeo, mats.trunk); limb.scale.set(.055, length, .055);
      limb.position.set(Math.cos(angle) * .24, -.22 + (branch % 2) * .2, Math.sin(angle) * .24);
      limb.rotation.set(Math.sin(angle) * .55, 0, -Math.cos(angle) * .55); limb.castShadow = true; crown.add(limb);
      for (const fork of [-1, 1]) {
        const twig = new THREE.Mesh(cylinderGeo, mats.trunk); twig.scale.set(.025, .46, .025);
        twig.position.set(Math.cos(angle) * (.55 + fork * .08), .08 + fork * .12, Math.sin(angle) * (.55 - fork * .06));
        twig.rotation.set(Math.sin(angle + fork * .45) * .82, 0, -Math.cos(angle + fork * .45) * .82); crown.add(twig);
      }
    }
    const colors = [mats.leafDark, mats.leaf, mats.leafLight];
    const clusters = 15;
    for (let i = 0; i < clusters; i++) {
      const angle = i * 2.399 + phase;
      const radius = i < 8 ? .86 : i < 13 ? .53 : .18;
      const px = Math.cos(angle) * radius, pz = Math.sin(angle) * radius * .82;
      const py = (i < 8 ? -.02 : i < 13 ? .36 : .67) + Math.sin(i * 1.7) * .11;
      const size = i < 8 ? .48 + (i % 4) * .045 : i < 13 ? .42 + (i % 3) * .04 : .38;
      const leaf = new THREE.Mesh(leafClusterGeo, colors[(i + Math.round(phase)) % 3]);
      leaf.position.set(px, py, pz); leaf.rotation.set(i * .37, angle, i * .21);
      leaf.scale.set(size * (1 + (i % 2) * .16), size * .78, size * (.84 + (i % 3) * .08));
      leaf.castShadow = true; leaf.receiveShadow = true; crown.add(leaf);
    }
    mergeDirectMeshes(crown, `tree-crown-${treeCrowns.length}`);
  }
  [[-7.25,-2.2,3.6,0],[-6.25,-4.2,4.1,1.1],[-7.2,-6.15,3.8,2.3],[7.1,-2.35,3.8,3.1],[6.2,-4.5,4.25,4.2],[7.15,-6.2,3.65,5.1]].forEach(v => tree(v[0],v[1],v[2],v[3]));
  for (const side of [-1, 1]) for (let z = .9; z < 5.15; z += .52) {
    instance(sphereGeo, z % 1 > .5 ? mats.leafLight : mats.leaf, [side * 6.45, .55, z], [.34, .27, .34], [0,0,0], true);
  }
  for (const side of [-1, 1]) for (let i = 0; i < 22; i++) {
    const x = side * (5.15 + (i % 4) * .42), z = 1.0 + Math.floor(i / 4) * .62;
    instance(sphereGeo, i % 3 ? mats.leaf : mats.leafLight, [x, .38, z], [.2, .15, .2], [0,0,0], false);
    if (i % 2 === 0) instance(sphereGeo, mats.warm, [x + .04, .55, z], [.052, .06, .052], [0,0,0], false, i % 4 ? 0xffbd72 : 0xe98d78);
  }
  // Benches, campus lamps and a central flag complete the architectural miniature.
  for (const side of [-1, 1]) for (const z of [-2.1, -4.25]) {
    box([side * 5.1, .55, z], [1.45, .14, .46], mats.wood, true, true);
    box([side * 5.1, .88, z - .19], [1.45, .52, .12], mats.wood, true, true);
    for (const dx of [-.58, .58]) box([side * 5.1 + dx, .32, z], [.08, .45, .34], mats.metal);
  }
  const lampPositions: V3[] = [];
  for (const x of [-7.7, 7.7]) for (const z of [3.65, -2.5]) {
    const side = Math.sign(x);
    instance(cylinderGeo, mats.metal, [x, 1.52, z], [.06, 2.62, .06], [0,0,0], true);
    instance(cylinderGeo, mats.metal, [x - side * .18, 2.76, z], [.045, .52, .045], [0,0,side * .72], true);
    // A framed lantern with cap, glass body and finial replaces the floating white cube.
    box([x - side * .36, 2.91, z], [.46, .1, .4], mats.metal, true, true);
    box([x - side * .36, 2.77, z], [.34, .26, .3], mats.warm, false, true);
    box([x - side * .36, 2.62, z], [.42, .08, .36], mats.metal, true, true);
    instance(spearGeo, mats.metal, [x - side * .36, 3.04, z], [.62,.62,.62], [0,0,0], true);
    lampPositions.push([x - side * .36, 2.77, z]);
  }
  instance(cylinderGeo, mats.metal, [0, 8.56, .55], [.023, 1.72, .023], [0,0,0], true);
  const flag = new THREE.Mesh(own(new THREE.PlaneGeometry(.85, .44, 14, 4)), mats.brick); flag.name = "campus-flag"; flag.position.set(.44, 9.05, .55); flag.castShadow = true; group.add(flag); sceneObjects[flag.name] = flag;

  // Soft baked contact shadow keeps the rebuilt structure grounded.
  const shadowCanvas = document.createElement("canvas"); shadowCanvas.width = shadowCanvas.height = 512;
  const shadowContext = shadowCanvas.getContext("2d")!; const gradient = shadowContext.createRadialGradient(256,256,30,256,256,250);
  gradient.addColorStop(0,"rgba(35,27,20,.42)"); gradient.addColorStop(1,"rgba(35,27,20,0)"); shadowContext.fillStyle = gradient; shadowContext.fillRect(0,0,512,512);
  const shadowMap = new THREE.CanvasTexture(shadowCanvas); textures.add(shadowMap);
  const shadowMat = new THREE.MeshBasicMaterial({ map: shadowMap, transparent: true, depthWrite: false, toneMapped: false }); materials.add(shadowMat);
  instance(planeGeo, shadowMat, [0,.335,.45], [14.8,4.5,1], [-Math.PI/2,0,0], false);
  instance(planeGeo, shadowMat, [0,.325,-6.25], [15.5,5.2,1], [-Math.PI/2,0,0], false);

  for (const batch of instances.values()) {
    const value = new THREE.InstancedMesh(batch.geometry, batch.material, batch.matrices.length);
    batch.matrices.forEach((matrix, index) => { value.setMatrixAt(index, matrix); value.setColorAt(index, batch.colors[index]); });
    value.castShadow = batch.shadow; value.receiveShadow = true; value.computeBoundingSphere(); group.add(value);
  }

  const bounds = new THREE.Box3(new THREE.Vector3(-9, -.94, -9), new THREE.Vector3(9, 9.3, 9));
  group.userData.cameraBounds = bounds.clone();
  let time = 0, dayTime = 0, nightTime = 0, wasNight = false, disposed = false;
  let storyTimestamp = performance.now();
  function setWalkPose(rig: PassengerRig, amount: number, moving: boolean, phase: number) {
    const stride = moving ? Math.sin(amount * Math.PI * 8) * .46 : 0;
    rig.leftArm.rotation.x = stride; rig.rightArm.rotation.x = -stride; rig.leftLeg.rotation.x = -stride; rig.rightLeg.rotation.x = stride;
    rig.root.position.y += moving ? Math.abs(Math.sin(amount * Math.PI * 8 + phase)) * .025 : 0;
  }
  function updateArrivalStory(delta: number, night: number, reduced: boolean) {
    const now = performance.now();
    const storyDelta = Math.max(delta, Math.min(.6, Math.max(0, (now - storyTimestamp) / 1000)));
    storyTimestamp = now;
    if (!reduced) {
      if (night < .05) {
        if (wasNight) { dayTime = 0; nightTime = 0; wasNight = false; }
        dayTime += storyDelta;
      } else if (night > .95) { wasNight = true; nightTime += storyDelta; }
    }
    let gateOpen = smooth((dayTime - .35) / 1.15);
    if (wasNight) gateOpen = 1 - smooth((nightTime - 7.15) / 1.05);
    centralGateLeft.rotation.y = -.92 * gateOpen;
    centralGateRight.rotation.y = .92 * gateOpen;

    if (!wasNight) {
      shuttle.visible = true;
      const drive = smooth((dayTime - 1.35) / 2.85);
      placeBus(arrivalPath, drive);
      const doorOpen = Math.min(smooth((dayTime - 4.05) / .45), 1 - smooth((dayTime - 6.75) / .45));
      passengerDoor.rotation.y = 1.08 * doorOpen;
      passengerRigs.forEach((rig, index) => {
        const delay = index * .38, lane = (index - 1) * .38, exitStart = 4.65 + delay, exitEnd = 5.5 + delay;
        rig.root.visible = dayTime > exitStart;
        if (dayTime <= exitEnd) {
          const exit = smooth((dayTime - exitStart) / .85);
          // Step down beyond the front-left body corner, then fan toward the gate.
          // Both points remain clear of the bumper, wheel and planted strip.
          lerpPosition(rig.root, [2.92 + index * .1,.31,2.68 - index * .13], [1.58 + lane * .52,.31,2.1 + index * .15], exit);
          rig.root.rotation.y = -2.72; setWalkPose(rig, exit, exit > 0 && exit < 1, index * .8);
        } else {
          const walk = smooth((dayTime - exitEnd) / (2.25 - delay * .45));
          lerpPosition(rig.root, [1.58 + lane * .52,.31,2.1 + index * .15], [lane * .72,.31,-6.18 - index * .18], walk);
          rig.root.rotation.y = Math.PI; setWalkPose(rig, walk, walk < 1, index * .8);
        }
      });
      animationState.userData.phase = dayTime < .35 ? "gate-closed" : dayTime < 1.5 ? "opening-gate" : dayTime < 4.2 ? "bus-arriving" : dayTime < 5.35 ? "passenger-exiting-bus" : "passenger-entering-campus";
    } else {
      passengerRigs.forEach((rig, index) => {
        const delay = index * .38, lane = (index - 1) * .38, reachDoor = 2.15 + delay, boardEnd = 3.0 + delay;
        rig.root.visible = nightTime < boardEnd;
        if (nightTime < reachDoor) {
          const leaveCampus = smooth((nightTime - delay) / 2.12);
          lerpPosition(rig.root, [lane * .72,.31,-6.18 - index * .18], [1.58 + lane * .52,.31,2.1 + index * .15], leaveCampus);
          rig.root.rotation.y = 0; setWalkPose(rig, leaveCampus, leaveCampus < 1, index * .8);
        } else {
          const board = smooth((nightTime - reachDoor) / .85);
          lerpPosition(rig.root, [1.58 + lane * .52,.31,2.1 + index * .15], [2.92 + index * .1,.31,2.68 - index * .13], board);
          rig.root.rotation.y = .42; setWalkPose(rig, board, board < 1, index * .8);
        }
      });
      const doorOpen = Math.min(smooth((nightTime - 1.65) / .45), 1 - smooth((nightTime - 4.05) / .48)); passengerDoor.rotation.y = 1.08 * doorOpen;
      const leave = smooth((nightTime - 4.45) / 2.65);
      shuttle.visible = leave < 1;
      placeBus(departurePath, leave);
      animationState.userData.phase = nightTime < 2.15 ? "passengers-leaving-campus" : nightTime < 4.1 ? "passengers-boarding-bus" : nightTime < 7.1 ? "bus-departing" : "closing-gate";
    }
    const wheelSpeed = wasNight ? (nightTime > 4.45 && nightTime < 7.1 ? delta * 9 : 0) : (dayTime > 1.35 && dayTime < 4.2 ? delta * 9 : 0);
    wheels.forEach(wheel => { wheel.rotation.x += wheelSpeed; });
  }
  function update(delta: number, night: number, reduced = false) {
    if (disposed) return false; if (!reduced) time += delta;
    updateArrivalStory(delta, night, reduced);
    treeCrowns.forEach(crown => { crown.rotation.z = reduced ? 0 : Math.sin(time * .72 + crown.userData.phase) * .012; });
    const positions = flag.geometry.attributes.position as THREE.BufferAttribute;
    if (!reduced) for (let i = 0; i < positions.count; i++) positions.setZ(i, Math.sin(time * 2.1 + positions.getX(i) * 7) * .035); positions.needsUpdate = true;
    mats.sign.emissiveIntensity = night * .58; signText.emissiveIntensity = night * .46; mats.glass.emissiveIntensity = night * .34;
    mats.brightGlass.emissiveIntensity = night * 1.12; mats.dimGlass.emissiveIntensity = night * .46; mats.guardGlass.emissiveIntensity = night * .92; mats.warm.emissiveIntensity = night * 1.85;
    return !reduced;
  }
  function dispose() {
    if (disposed) return; disposed = true;
    group.traverse(value => { if (value instanceof THREE.InstancedMesh) value.dispose(); });
    geometries.forEach(value => value.dispose()); materials.forEach(value => value.dispose()); textures.forEach(value => value.dispose()); group.clear();
  }
  return { group, sceneObjects, bounds, mats, labels: [signText], entryZ: 1.05, id: "nanzih", windowCount: 36, litWindowCount: 13, lampPositions, moving: true, update, dispose };
}
