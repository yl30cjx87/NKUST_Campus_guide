import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { createCampusEmblem } from "./campus-emblem";
import { createHarborLife, type ShipDetails } from "./harbor-life";
import { createHarborWake } from "./harbor-atmosphere";
import { HARBOR_WATER_LEVEL, HARBOR_WAVES_GLSL } from "./harbor-waves.mjs";

type V3 = [number, number, number];
type Batch = { parent: THREE.Group; geometry: THREE.BufferGeometry; material: THREE.Material; shadow: boolean; matrices: THREE.Matrix4[]; colors: THREE.Color[] };

// 港面朝 +Z。所有幾何、船舶和局部燈光皆附著於同一塊 22 × 22 底座。
export function createCijinCampus() {
  const campusGroup = new THREE.Group(); campusGroup.name = "Cijin harbor campus";
  const sceneObjects: Record<string, THREE.Object3D> = { model: campusGroup };
  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>(), textures = new Set<THREE.Texture>();
  const batches = new Map<string, Batch>();
  const waterTime = { value: 0 };
  let seed = 39721;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const geometry = <T extends THREE.BufferGeometry>(g: T): T => { geometries.add(g); return g; };
  const gradient = new THREE.DataTexture(new Uint8Array([90, 162, 222, 255]), 4, 1, THREE.RedFormat);
  gradient.minFilter = gradient.magFilter = THREE.NearestFilter; gradient.needsUpdate = true; textures.add(gradient);
  const toon = (color: number, emissive = 0) => {
    const material = new THREE.MeshToonMaterial({ color, gradientMap: gradient, emissive, emissiveIntensity: 0 });
    materials.add(material); return material;
  };
  const mats = {
    stone: toon(0xd8d9cf), wall: toon(0xe7e4d7), inset: toon(0xc9c7bc), trim: toon(0xf0eee2),
    sand: toon(0xc7bcb0), roof: toon(0x83534c), roofEdge: toon(0x654844), base: toon(0x596d72),
    asphalt: toon(0x777f7e), stripe: toon(0xe9dfbc), grass: toon(0x86a17a), leaves: toon(0x508365),
    trunk: toon(0x89786a), metal: toon(0x697b80), rubber: toon(0x273638), glass: toon(0x586e78),
    litGlass: toon(0x637b83, 0xffc078), dimGlass: toon(0x5e747d, 0xeeb577),
    entryGlass: toon(0x334b56, 0xf1b56f),
    green: toon(0x307260), white: toon(0xf4f1e8), orange: toon(0xdf7947), hull: toon(0x314d56),
    warm: toon(0xf3e3bc, 0xffd29d), redLamp: toon(0xa0524b, 0xff654c), greenLamp: toon(0x408577, 0x54dc9e),
    whiteLamp: toon(0xe1e5df, 0xfff4e7),
    interiorShadows: new THREE.MeshBasicMaterial({ color: 0x202c31, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, forceSinglePass: true }),
  };
  materials.add(mats.interiorShadows);
  const cube = geometry(new THREE.BoxGeometry(1, 1, 1));
  const rounded = geometry(new RoundedBoxGeometry(1, 1, 1, 1, .055));
  const cylinder = geometry(new THREE.CylinderGeometry(.5, .5, 1, 8));
  const sphere = geometry(new THREE.SphereGeometry(.5, 10, 7));
  const plane = geometry(new THREE.PlaneGeometry(1, 1));
  const ring = geometry(new THREE.TorusGeometry(.18, .055, 5, 12));
  const dummy = new THREE.Object3D();
  function instance(g: THREE.BufferGeometry, m: THREE.Material, p: V3, s: V3, r: V3 = [0, 0, 0], shadow = false, parent = campusGroup, color = 0xffffff) {
    const key = `${parent.uuid}:${g.uuid}:${m.uuid}:${shadow}`;
    if (!batches.has(key)) batches.set(key, { parent, geometry: g, material: m, shadow, matrices: [], colors: [] });
    dummy.position.set(...p); dummy.scale.set(...s); dummy.rotation.set(...r); dummy.updateMatrix();
    batches.get(key)!.matrices.push(dummy.matrix.clone()); batches.get(key)!.colors.push(new THREE.Color(color));
  }
  function box(p: V3, s: V3, mat: THREE.Material, shadow = false, bevel = false, parent = campusGroup) {
    instance(bevel ? rounded : cube, mat, p, s, [0, 0, 0], shadow, parent);
  }
  function beam(a: V3, b: V3, radius: number, mat: THREE.Material, parent = campusGroup) {
    const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b), middle = start.clone().add(end).multiplyScalar(.5);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), end.clone().sub(start).normalize());
    const r = new THREE.Euler().setFromQuaternion(q);
    instance(cylinder, mat, middle.toArray() as V3, [radius, start.distanceTo(end), radius], [r.x, r.y, r.z], false, parent);
  }
  function add(name: string, g: THREE.BufferGeometry, mat: THREE.Material, p: V3, parent = campusGroup) {
    const object = new THREE.Mesh(g, mat); object.name = name; object.position.set(...p); object.receiveShadow = true; parent.add(object); sceneObjects[name] = object; return object;
  }
  function lettering(text: string, p: V3, width: number, height: number, ink = "#254657", parent = campusGroup) {
    const canvas = document.createElement("canvas"); canvas.width = 1024; canvas.height = 128;
    const ctx = canvas.getContext("2d")!; ctx.font = '700 82px "Microsoft JhengHei", sans-serif'; ctx.fillStyle = ink; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(text, 512, 67, 980);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; textures.add(texture);
    const mat = new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, side: THREE.DoubleSide }); materials.add(mat);
    const object = add(text, plane, mat, p, parent); object.scale.set(width, height, 1); return object;
  }
  function makeHipRoof() {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute([
      -.5, 0, -.5, .5, 0, -.5, .5, 0, .5, -.5, 0, .5, -.3, 1, 0, .3, 1, 0,
    ], 3));
    g.setIndex([0, 4, 5, 0, 5, 1, 1, 5, 2, 2, 5, 4, 2, 4, 3, 3, 4, 0, 0, 1, 2, 0, 2, 3]);
    const result = g.toNonIndexed(); result.computeVertexNormals(); g.dispose(); return geometry(result);
  }
  const hipRoof = makeHipRoof();
  function roof(x: number, y: number, z: number, width: number, depth: number, rise: number) {
    box([x, y - .035, z], [width, .1, depth], mats.roofEdge);
    instance(hipRoof, mats.roof, [x, y, z], [width, rise, depth], [0, 0, 0], true);
  }

  function createHarbor() {
    box([0, -.75, 0], [22, 1.5, 22], mats.base, false, true);
    box([0, .095, -3.7], [22, .19, 14.6], mats.stone);
    box([0, .198, 1.6], [22, .025, 1.25], mats.asphalt);
    for (let x = -9.4; x < 10; x += 1.4) box([x, .215, 1.65], [.65, .01, .035], mats.stripe);
    box([0, .16, -9.5], [20.7, .08, 2.35], mats.grass);
    box([-9.8, .16, -3.4], [1.65, .08, 9.8], mats.grass);
    box([9.6, .16, -3.4], [1.8, .08, 9.8], mats.grass);
    lettering("NKUST  /  CIJIN", [0, -.75, 11.008], 4.5, .46, "#edf3f0");
  }

  let windowCount = 0, brightCount = 0, dimCount = 0, interiorWindowCount = 0;
  const windowRooms: { facade: number; floor: number; start: number; count: number; level: number }[] = [];
  const windowFrames = new Map<string, THREE.BufferGeometry>();
  let facadeIndex = 0;
  function windows(x: number, z: number, width: number, floors: number, columns: number, startY = .9, rotation = 0, pitch = 1.02, aperture: [number, number] = [.74, .53]) {
    const step = width / columns, facade = facadeIndex++;
    const key = aperture.join(":");
    if (!windowFrames.has(key)) {
      // 中空牆片共用同一份幾何；玻璃位於牆面後方，不在實心牆上貼圖。
      const shape = new THREE.Shape(); shape.moveTo(-.5, -.5); shape.lineTo(.5, -.5); shape.lineTo(.5, .5); shape.lineTo(-.5, .5); shape.closePath();
      const hole = new THREE.Path(), [w, h] = aperture;
      hole.moveTo(-w / 2, -h / 2); hole.lineTo(-w / 2, h / 2); hole.lineTo(w / 2, h / 2); hole.lineTo(w / 2, -h / 2); hole.closePath(); shape.holes.push(hole);
      const frame = new THREE.ExtrudeGeometry(shape, { depth: .18, bevelEnabled: false, steps: 1 }); frame.translate(0, 0, -.18);
      frame.clearGroups(); windowFrames.set(key, geometry(frame));
    }
    const localPoint = (column: number, y: number, depth: number): V3 => {
      const v = new THREE.Vector3(-width / 2 + (column + .5) * step, y, depth).applyAxisAngle(THREE.Object3D.DEFAULT_UP, rotation);
      return [x + v.x, v.y, z + v.z];
    };
    for (let floor = 0; floor < floors; floor++) {
      for (let col = 0; col < columns;) {
        let count = columns - col <= 3 ? columns - col : random() < .5 ? 2 : 3;
        if (columns - col - count === 1) count = 2;
        const pick = random(), level = pick < .14 ? 2 : pick < .36 ? 1 : 0;
        const mat = level === 2 ? mats.litGlass : level === 1 ? mats.dimGlass : mats.glass;
        windowRooms.push({ facade, floor, start: col, count, level });
        const tint = new THREE.Color().setRGB(.86 + random() * .12, .9, .92).getHex();
        for (let roomCol = col; roomCol < col + count; roomCol++) {
          windowCount++; if (level === 2) brightCount++; else if (level === 1) dimCount++;
          const y = startY + floor * pitch;
          instance(windowFrames.get(key)!, mats.wall, localPoint(roomCol, y, 0), [step, pitch, 1], [0, rotation, 0]);
          instance(cube, mat, localPoint(roomCol, y, -.15), [step * aperture[0] + .015, pitch * aperture[1] + .015, .025], [0, rotation, 0], false, campusGroup, tint);
          // 少量亮窗使用兩片薄剪影，不建立室內空間，也不改動房間亮燈亂數。
          if (level > 0 && (facade * 7 + floor * 3 + roomCol) % 4 === 0) {
            interiorWindowCount++;
            const w = step * aperture[0], h = pitch * aperture[1];
            instance(plane, mats.interiorShadows, localPoint(roomCol, y - h * .22, -.129), [w * .86, h * .065, 1], [0, rotation, 0]);
            instance(plane, mats.interiorShadows, localPoint(roomCol, y + h * .04, -.129), [w * (floor % 2 ? .86 : .34), h * (floor % 2 ? .075 : .25), 1], [0, rotation, 0]);
          }
        }
        col += count;
      }
    }
  }
  function createMainBuilding() {
    // 左翼低平屋頂、中央前凸門廳、右側深簷斜柱；實心核心退到凹窗後方。
    box([4.35, 3.08, -4.6], [8.06, 5.82, 5.74], mats.inset, true, true);
    box([-5.85, 2.45, -4.05], [6.36, 4.54, 5.66], mats.inset, true, true);
    box([-.65, 3.92, -2.7], [3.62, 4.45, 6.42], mats.sand, true, true);
    box([-.65, 1, -2.05], [3.62, 1.7, 3.7], mats.inset, true);
    for (const x of [-2.27, .97]) box([x, 1.02, .12], [.38, 1.7, 1.2], mats.trim, true);
    box([-.65, 4, .54], [.78, 4.25, .17], mats.trim, true);
    windows(-1.77, .72, 1.15, 4, 2, 2.23, 0, .87, [.48, .66]);
    windows(.47, .72, 1.15, 4, 2, 2.23, 0, .87, [.48, .66]);
    box([-.65, 5.99, -2.7], [3.98, .2, 6.83], mats.trim);
    roof(-.65, 6.16, -2.9, 4.55, 7.05, .46);
    roof(4.35, 6.06, -4.35, 9.75, 7.65, .38);
    roof(5.9, 6.55, -5.75, 6.05, 3.2, .2);
    roof(-3.35, 4.9, -6.1, 6.2, 2.4, .38);
    box([-5.85, 4.75, -4.05], [6.85, .18, 6.15], mats.trim);
    box([-7.7, 5.4, -5.05], [2.25, 1.2, 2.5], mats.wall, true);
    box([-7.7, 6.06, -5.05], [2.7, .17, 2.9], mats.trim);
    // 頂部露台在深簷下留出空隙，避免做成完整方形塔柱。
    box([-.1, 6.58, -4.6], [2.72, 1.2, 2.76], mats.wall, true);
    windows(-.1, -3.02, 2.72, 1, 2, 6.72, 0, 1.03, [.78, .37]);
    box([-.1, 7.25, -4.6], [3.05, .16, 3.42], mats.trim);
    box([-.1, 7.62, -4.6], [2, .57, 2.1], mats.glass);
    for (const x of [-1.32, 1.12]) for (const z of [-5.92, -2.96]) box([x, 7.63, z], [.17, .62, .17], mats.trim, true);
    roof(-.1, 7.99, -4.6, 4.05, 4.28, .18);
    windows(4.35, -1.5, 8.5, 5, 10, .93);
    windows(4.35, -7.7, 8.5, 5, 10, .93, Math.PI);
    windows(-5.85, -.98, 6.8, 4, 9, .91, 0, 1.04, [.63, .62]);
    windows(-5.85, -7.12, 6.8, 4, 9, .91, Math.PI, 1.04, [.63, .62]);
    windows(8.6, -4.6, 6.2, 5, 6, .93, Math.PI / 2);
    windows(-9.25, -4.05, 6.14, 4, 6, .91, -Math.PI / 2, 1.04, [.63, .62]);
    for (let level = 0; level < 6; level++) box([4.35, .4 + level * 1.02, -1.43], [8.55, .12, .28], mats.trim);
    for (const level of [0, 1, 3, 4]) box([-5.85, .39 + level * 1.04, -.88], [6.87, .17, .37], mats.trim);
    for (const x of [2.25, 4.25, 6.25, 8.25]) {
      instance(cube, mats.trim, [x, 3.02, -.98], [.22, 5.5, .3], [.11, 0, 0], true);
      box([x, 5.75, -.92], [.32, .22, 1.78], mats.inset);
    }
    for (const x of [3.18, 7.18]) {
      instance(cube, mats.glass, [x, 3.63, -.73], [.59, 3.25, .06], [.11, 0, 0]);
      for (let y = 2.45; y < 5.3; y += .52) box([x, y, -.67 + (y - 3.63) * .11], [.69, .065, .12], mats.trim);
    }
    box([-.65, .95, -.11], [2.58, 1.46, .07], mats.entryGlass);
    for (const x of [-1.36, -.65, .06]) box([x, .95, -.055], [.04, 1.46, .035], mats.metal);
    box([-.65, 1.88, .62], [3.24, .17, 1.55], mats.trim, true);
    box([-.65, 1.78, .55], [1.7, .035, .18], mats.warm);
    for (let step = 0; step < 3; step++) box([-.65, .2 + step * .05, .86 - step * .18], [3.04, .08, .75], mats.stone);
    lettering("國立高雄科技大學", [-.65, 5.74, .73], 3.6, .27);
    lettering("旗津校區", [-.65, 1.87, 1.404], 1.72, .21);
    const emblem = createCampusEmblem(); emblem.scale.setScalar(.26); emblem.position.set(-.65, 4.88, .82); emblem.rotation.x = .38; campusGroup.add(emblem); sceneObjects.emblem = emblem;
    const edgeMat = new THREE.LineBasicMaterial({ color: 0x526567, transparent: true, opacity: .18 }); materials.add(edgeMat);
    const edges = geometry(new THREE.EdgesGeometry(cube));
    for (const [p, s] of [[[4.35, 3.08, -4.6], [8.5, 5.82, 6.2]], [[-5.85, 2.45, -4.05], [6.8, 4.54, 6.14]]] as [V3, V3][]) {
      const outline = new THREE.LineSegments(edges, edgeMat); outline.position.set(...p); outline.scale.set(...s); campusGroup.add(outline);
    }
    for (const x of [-8, -7.4, .35]) {
      const y = x < 0 ? 6.1 : 8.24, z = x < 0 ? -5.25 : -4.4;
      beam([x, y, z], [x, y + 1.35, z], .045, mats.metal);
      beam([x - .38, y + .88, z], [x + .38, y + .88, z], .035, mats.metal);
    }
    for (let i = 0; i < 5; i++) box([-6.4 + i * .48, 4.9, -3.7], [.35, .22, .45], mats.inset);
  }

  function createDock() {
    box([0, .16, 2.92], [22, .38, 1.35], mats.stone);
    box([0, .08, 3.56], [22, .32, .09], mats.inset);
    for (let x = -10.2; x < 11; x += 1.4) {
      instance(ring, mats.rubber, [x, .18, 3.7], [.92, 1.15, .8]);
      box([x, .38, 3.22], [.18, .2, .18], mats.metal);
      box([x, .49, 3.22], [.32, .05, .15], mats.metal);
    }
    for (const x of [-9.6, -8.8, 8.8, 9.6]) {
      beam([x, .38, 2.3], [x, 1.06, 2.3], .047, mats.metal);
      beam([x, .96, 2.3], [x + .7, .96, 2.3], .044, mats.metal);
    }
    for (const x of [-3.4, 3.5]) {
      instance(cube, mats.metal, [x, .48, 3.94], [.46, .075, 1.08], [-.17, 0, 0]);
      for (let z = 3.55; z < 4.5; z += .18) box([x, .55, z], [.48, .025, .04], mats.trim);
    }
    box([-8.3, .69, 2.86], [.48, .68, .34], mats.orange);
    box([-8.3, .81, 3.038], [.3, .065, .015], mats.white);
    box([-8.14, .6, 3.04], [.035, .12, .018], mats.metal);
    box([7.45, .67, 2.75], [.44, .64, .36], mats.inset);
    box([7.45, .7, 2.936], [.32, .4, .015], mats.metal);
    box([7.56, .66, 2.95], [.035, .1, .018], mats.trim);
    for (const x of [-7.4, 6.8]) {
      box([x, .77, 2.92], [.055, .92, .055], mats.metal);
      instance(ring, mats.orange, [x, 1.04, 2.98], [1, 1, 1]);
      for (const y of [.87, 1.21]) box([x, y, 3.035], [.11, .075, .025], mats.white);
      box([x, .356, 3.25], [1.24, .018, .2], mats.rubber);
      for (let stripe = 0; stripe < 5; stripe++) instance(cube, mats.stripe, [x - .46 + stripe * .23, .367, 3.25], [.105, .01, .18], [0, -.4, 0], false, campusGroup, 0xf4cf60);
    }
  }

  function hullGeometry() {
    const outline = [[-.48, -.39], [.25, -.5], [.44, -.28], [.52, 0], [.44, .28], [.25, .5], [-.48, .39], [-.52, 0]];
    const vertices: number[] = [], indices: number[] = [];
    for (const [y, scale] of [[0, .75], [1, 1]]) for (const [x, z] of outline) vertices.push(x * scale, y, z * scale);
    for (let i = 0; i < 8; i++) { const j = (i + 1) % 8; indices.push(i, i + 8, j + 8, i, j + 8, j); }
    for (let i = 1; i < 7; i++) { indices.push(8, 9 + i, 8 + i); indices.push(0, i, i + 1); }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3)); g.setIndex(indices); g.computeVertexNormals(); return geometry(g);
  }
  const hull = hullGeometry(), boats: THREE.Group[] = [], shipDetails: ShipDetails[] = [];
  let radar: THREE.Group;
  const workLight = new THREE.Vector3(.55, 1.42, .63);
  function createShips() {
    const specs = [
      { name: "Moored training vessel", p: [-3.75, .13, 4.85] as V3, length: 6, width: 1.45, mat: mats.green },
      { name: "Moored white workboat", p: [3.5, .13, 4.7] as V3, length: 3.5, width: 1.18, mat: mats.white },
      { name: "Orange lifeboat", p: [8.2, .13, 4.75] as V3, length: 2.05, width: .92, mat: mats.orange },
      { name: "Moving harbor launch", p: [0, .13, 8] as V3, length: 2.25, width: .82, mat: mats.white },
    ];
    specs.forEach((spec, i) => {
      const group = new THREE.Group(); group.name = spec.name; group.position.set(...spec.p); campusGroup.add(group); boats.push(group); sceneObjects[spec.name] = group;
      if (i === 0) group.scale.setScalar(1.2);
      const l = spec.length, w = spec.width, h = i === 0 ? .58 : .38, shadow = i === 0;
      const details: ShipDetails = { lights: [], moorings: [new THREE.Vector3(-l * .35, h + .12, -w * .42), new THREE.Vector3(l * .32, h + .12, -w * .42)] };
      shipDetails.push(details);
      instance(hull, mats.hull, [0, -.18, 0], [l * .985, .3, w * .96], [0, 0, 0], shadow, group);
      instance(hull, spec.mat, [0, .035, 0], [l, h, w], [0, 0, 0], shadow, group);
      instance(hull, mats.trim, [0, h + .04, 0], [l * 1.01, .07, w * 1.015], [0, 0, 0], false, group);
      const cabinX = i === 0 ? -.65 : -.3, cabinY = h + (i === 0 ? .66 : .32), cabinL = i === 0 ? 1.9 : l * .44, cabinH = i === 0 ? 1.18 : .56;
      box([cabinX, cabinY, 0], [cabinL, cabinH, w * .71], i === 2 ? mats.orange : mats.white, shadow, true, group);
      box([cabinX, cabinY + cabinH / 2 + .035, 0], [cabinL * 1.12, .11, w * .84], spec.mat, false, false, group);
      for (const side of [-1, 1]) {
        box([cabinX, cabinY + .1, side * w * .36], [cabinL * .75, cabinH * .37, .025], mats.glass, false, false, group);
        for (let j = 0; j < 3; j++) box([cabinX - cabinL * .26 + j * cabinL * .26, cabinY + .1, side * w * .38], [.035, cabinH * .42, .03], mats.trim, false, false, group);
        const position: V3 = [cabinX + cabinL * .48, cabinY + cabinH / 2, side * w * .43];
        instance(sphere, side === -1 ? mats.redLamp : mats.greenLamp, position, [.075, .075, .075], [0, 0, 0], false, group);
        details.lights.push({ kind: side === -1 ? "port" : "starboard", position: new THREE.Vector3(...position), color: side === -1 ? 0xff654c : 0x54dc9e });
        beam([-l * .44, h + .2, side * w * .38], [l * .2, h + .2, side * w * .44], .025, mats.white, group);
      }
      box([cabinX + cabinL * .505, cabinY + .1, 0], [.028, cabinH * .37, w * .56], mats.glass, false, false, group);
      const mastY = cabinY + cabinH / 2;
      beam([cabinX, mastY, 0], [cabinX, mastY + .55, 0], .035, mats.metal, group);
      instance(sphere, mats.whiteLamp, [cabinX, mastY + .57, 0], [.08, .08, .08], [0, 0, 0], false, group);
      details.lights.push({ kind: "mast", position: new THREE.Vector3(cabinX, mastY + .57, 0), color: 0xfff4e7 });
      if (i === 0) {
        lettering("NKUST", [-.65, .37, w * .51], 1.25, .18, "#fff7e6", group);
        box([-2, h + .2, 0], [.35, .45, .52], mats.green, false, false, group);
        radar = new THREE.Group(); radar.position.set(cabinX, mastY + .56, 0); group.add(radar);
        box([0, .06, 0], [.7, .07, .1], mats.trim, false, false, radar);
        sceneObjects.radar = radar;
        box(workLight.toArray() as V3, [.16, .12, .1], mats.whiteLamp, false, false, group);
        beam([.38, 1.42, .5], workLight.toArray() as V3, .035, mats.metal, group);
      }
    });
    const wake = createHarborWake(waterTime); campusGroup.add(wake);
    sceneObjects.wake = wake;
  }

  function createVegetation() {
    for (const [x, z, size] of [[-8.5, .22, 1.8], [-5.5, -.35, 1.55], [3.4, -.35, 1.35], [7.55, .55, 1.65], [9.1, -5.8, 1.6], [-9.3, -6.4, 1.5], [6.8, -9.1, 1.5]] as V3[]) {
      const height = size * (.9 + random() * .32), heading = random() * Math.PI * 2;
      instance(cylinder, mats.trunk, [x, height * .51, z], [.12 + random() * .05, height, .14], [0, heading, (random() - .5) * .09]);
      for (let j = 0; j < 3; j++) {
        const angle = heading + j * 2.4, spread = size * (.2 + random() * .12), width = size * (.85 + random() * .38);
        instance(sphere, mats.leaves, [x + Math.cos(angle) * spread, height + .22 + random() * .44, z + Math.sin(angle) * spread], [width, size * (.63 + random() * .35), size * (.78 + random() * .36)], [(random() - .5) * .25, angle, (random() - .5) * .25], true, campusGroup, j % 2 ? 0xb4c7a5 : 0xffffff);
      }
    }
    const leaf = new THREE.BufferGeometry(), positions: number[] = [], indices: number[] = [];
    for (let i = 0; i <= 5; i++) {
      const t = i / 5, x = t * 1.55, y = Math.sin(t * Math.PI) * .3 - t * t * .45, width = Math.sin(t * Math.PI) * .15;
      positions.push(x, y, -width, x, y + .035, 0, x, y, width);
      if (i < 5) { const k = i * 3; indices.push(k, k + 3, k + 1, k + 1, k + 3, k + 4, k + 1, k + 4, k + 2, k + 2, k + 4, k + 5); }
    }
    leaf.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3)); leaf.setIndex(indices); leaf.computeVertexNormals(); geometry(leaf);
    const palmMat = toon(0x5e8769); palmMat.side = THREE.DoubleSide;
    for (const [x, z, h] of [[-9.5, -3.1, 3.45], [-9.3, 1.1, 3.6], [9.4, -1.4, 3.55], [9.4, -7.5, 3.8], [-6.7, -9.5, 3.5]] as V3[]) {
      instance(cylinder, mats.trunk, [x, h / 2, z], [.13, h, .13], [0, 0, .025], true);
      for (let j = 0; j < 7; j++) instance(leaf, palmMat, [x, h, z], [.85, 1, .85], [0, j * Math.PI * 2 / 7, 0], true);
    }
    for (let i = 0; i < 28; i++) {
      const x = i < 14 ? -9.8 : 9.7, z = -8.3 + (i % 14) * .61;
      instance(sphere, mats.leaves, [x, .4, z], [.56, .54, .63], [0, i, 0], false, campusGroup, i % 3 ? 0xffffff : 0xa9c398);
    }
  }
  function createLightingFixtures() {
    for (const x of [-8.3, .9, 8.25]) {
      instance(cylinder, mats.metal, [x, 1.7, 2.65], [.085, 3.1, .085]);
      beam([x, 3.21, 2.65], [x, 3.21, 3.15], .065, mats.metal);
      box([x, 3.17, 3.13], [.4, .09, .31], mats.warm);
    }
  }
  function createWater() {
    const boatRipples = { value: [new THREE.Vector4(), new THREE.Vector4()] };
    const waterWaveScale = { value: 1 };
    const waterNight = { value: 0 };
    const material = new THREE.MeshStandardMaterial({ color: 0x528e97, roughness: .58, metalness: .035, emissive: 0x2e5260, emissiveIntensity: 0 }); materials.add(material);
    material.onBeforeCompile = shader => {
      shader.uniforms.uHarborTime = waterTime;
      shader.uniforms.uBoatRipples = boatRipples;
      shader.uniforms.uWaveScale = waterWaveScale;
      shader.uniforms.uWaterNight = waterNight;
      shader.vertexShader = `${HARBOR_WAVES_GLSL}\nuniform float uHarborTime; uniform float uWaveScale; uniform vec4 uBoatRipples[2]; varying vec2 vHarborPosition;\n${shader.vertexShader}`
        .replace("#include <beginnormal_vertex>", `#include <beginnormal_vertex>\nvec3 wave=harborWave(position.xz+vec2(0.,7.28),uHarborTime); wave*=uWaveScale; objectNormal=normalize(vec3(-wave.y,1.,-wave.z));`)
        .replace("#include <begin_vertex>", `#include <begin_vertex>
          vHarborPosition=position.xz+vec2(0.,7.28); transformed.y+=wave.x;
          for(int i=0;i<2;i++){
            vec2 d=vHarborPosition-uBoatRipples[i].xy;float radius=length(d);
            float mask=smoothstep(.3,.55,radius)*(1.-smoothstep(.7,1.8,radius));
            transformed.y+=sin(radius*17.-uHarborTime*.85)*mask*.0025;
          }`);
      shader.fragmentShader = `uniform float uHarborTime; uniform float uWaterNight; uniform vec4 uBoatRipples[2]; varying vec2 vHarborPosition;\n${shader.fragmentShader}`
        .replace("#include <color_fragment>", `#include <color_fragment>
          float a=sin(dot(vHarborPosition,vec2(2.1,8.0))+sin(vHarborPosition.x*1.4)*.8+uHarborTime*.55);
          float b=sin(dot(vHarborPosition,vec2(-6.8,2.7))-uHarborTime*.34);
          float segment=smoothstep(.4,.93,sin(vHarborPosition.x*2.4+vHarborPosition.y*.8-uHarborTime*.25));
          float visibility=mix(1.35,.72,uWaterNight);
          float streak=(smoothstep(.93,1.,a)*.058+smoothstep(.97,1.,b)*.016)*segment*visibility;
          float shoreDistance=max(0.,vHarborPosition.y-3.58);
          float shoreBand=1.-smoothstep(.1,1.05,shoreDistance);
          diffuseColor.rgb*=1.-shoreBand*.14;
          streak+=smoothstep(.88,1.,sin(shoreDistance*21.+uHarborTime*.75+sin(vHarborPosition.x*1.6)*.4))*shoreBand*segment*.068*visibility;
          for(int i=0;i<2;i++){
            vec2 d=vHarborPosition-uBoatRipples[i].xy; vec2 direction=vec2(uBoatRipples[i].z,uBoatRipples[i].w);
            float radius=length(vec2(dot(d,direction)*.42,dot(d,vec2(-direction.y,direction.x))));
            float mask=smoothstep(.5,.8,radius)*(1.-smoothstep(1.,1.8,radius));
            streak+=smoothstep(.92,1.,sin(radius*22.-uHarborTime*.85))*mask*.038;
          }
          diffuseColor.rgb+=vec3(streak*.6,streak*.9,streak);`)
        .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>\ntotalEmissiveRadiance*=1.-shoreBand*.14; totalEmissiveRadiance+=vec3(streak*.045,streak*.12,streak*.15);`);
    };
    const g = geometry(new THREE.PlaneGeometry(21.98, 7.4, 56, 28)); g.rotateX(-Math.PI / 2);
    const water = add("harbor-water", g, material, [0, HARBOR_WATER_LEVEL, 7.28]); water.castShadow = false;
    return { water, waterMaterial: material, waterTime, waterWaveScale, waterNight, boatRipples };
  }
  createHarbor(); createMainBuilding(); createDock(); createShips(); createVegetation();
  createLightingFixtures();
  const water = createWater(), life = createHarborLife(campusGroup, boats, shipDetails, plane);
  sceneObjects.mooringLines = life.ropes; sceneObjects.reflections = life.reflectionMesh;
  // 船上少量異形零件按材質合併；大量窗戶與植栽仍使用 InstancedMesh。
  const shipParts = new Map<string, { parent: THREE.Group; material: THREE.Material; shadow: boolean; parts: THREE.BufferGeometry[] }>();
  for (const batch of batches.values()) {
    if (boats.includes(batch.parent)) {
      const key = `${batch.parent.uuid}:${batch.material.uuid}:${batch.shadow}`;
      if (!shipParts.has(key)) shipParts.set(key, { parent: batch.parent, material: batch.material, shadow: batch.shadow, parts: [] });
      for (const matrix of batch.matrices) {
        const part = batch.geometry.index ? batch.geometry.toNonIndexed() : batch.geometry.clone();
        part.deleteAttribute("uv");
        shipParts.get(key)!.parts.push(part.applyMatrix4(matrix));
      }
      continue;
    }
    const object = new THREE.InstancedMesh(batch.geometry, batch.material, batch.matrices.length);
    batch.matrices.forEach((matrix, i) => { object.setMatrixAt(i, matrix); object.setColorAt(i, batch.colors[i]); });
    object.castShadow = batch.shadow; object.receiveShadow = true; object.computeBoundingSphere(); batch.parent.add(object);
    if (batch.material === mats.interiorShadows) { object.name = "lit-window-interiors"; object.visible = false; sceneObjects.windowInteriors = object; }
  }
  for (const { parent, material, shadow, parts } of shipParts.values()) {
    const merged = mergeGeometries(parts)!; parts.forEach(part => part.dispose());
    const object = new THREE.Mesh(geometry(merged), material); object.castShadow = shadow; object.receiveShadow = true; parent.add(object);
  }
  batches.clear(); campusGroup.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(campusGroup);
  function disposeCampus() {
    campusGroup.traverse(object => {
      if (!(object instanceof THREE.Mesh || object instanceof THREE.LineSegments)) return;
      geometries.add(object.geometry);
      for (const mat of Array.isArray(object.material) ? object.material : [object.material]) {
        materials.add(mat); for (const value of Object.values(mat)) if (value instanceof THREE.Texture) textures.add(value);
      }
    });
    geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose()); campusGroup.clear();
  }
  return { campusGroup, sceneObjects, bounds, mats, boats, shipDetails, workLight, radar: radar!, wake: sceneObjects.wake as THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>, life, ...water, windowCount, brightCount, dimCount, interiorWindowCount, windowRooms, disposeCampus };
}
