import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { FontLoader } from "three/addons/loaders/FontLoader.js";
import { TextGeometry } from "three/addons/geometries/TextGeometry.js";
import fontData from "./helvetiker_regular.typeface.json";
import { createAutoNightSwitch } from "./auto-night.mjs";
import { createModelTurntable } from "./model-turntable.mjs";
import { createJiangongLife } from "./jiangong-life";
import { trafficChoreography, trafficLayout } from "./jiangong-traffic.mjs";

type V3 = [number, number, number];
type Batch = { geometry: THREE.BufferGeometry; material: THREE.Material; shadow: boolean; matrices: THREE.Matrix4[]; colors: THREE.Color[] };
export type CampusScene = ReturnType<typeof createJiangongScene>;

// 模型正面朝 +Z；共用同一塊 18 × 18 底座及所有日夜模型。
export function createJiangongScene(host: HTMLElement, options: {
  onModeChange?: (night: boolean) => void;
  onBackgroundChange?: (color: string) => void;
} = {}) {
  const scene = new THREE.Scene();
  const sceneObjects: Record<string, THREE.Object3D> = {};
  const textures = new Set<THREE.Texture>();
  const geometries = new Set<THREE.BufferGeometry>();
  const materialSet = new Set<THREE.Material>();
  const batches = new Map<string, Batch>();
  const model = new THREE.Group();
  model.name = "Jiangong architectural miniature"; scene.add(model);
  sceneObjects.model = model;
  // 入口車道、警衛室與 NKUST 草地對齊主建築的 X=0 中線；+Z 朝校外。
  const gateLayout = { islandX: 0, islandZ: 2.68, guardZ: 0, guardElevation: .18 };
  const barriers: THREE.Group[] = [];
  let seed = 6415;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const geometry = <T extends THREE.BufferGeometry>(g: T): T => { geometries.add(g); return g; };
  const material = (options: THREE.MeshStandardMaterialParameters) => {
    const m = new THREE.MeshStandardMaterial(options); materialSet.add(m); return m;
  };

  // 小型程序貼圖提供表面層次，沒有外部照片下載或高成本 normal map。
  function surfaceTexture(kind: "stone" | "brick" | "road" | "grass") {
    const canvas = document.createElement("canvas"); canvas.width = canvas.height = 256;
    const ctx = canvas.getContext("2d")!;
    const image = ctx.createImageData(256, 256);
    const base = kind === "road" ? 145 : kind === "grass" ? 190 : 222;
    for (let i = 0; i < image.data.length; i += 4) {
      const x = (i / 4) % 256, y = Math.floor(i / 1024);
      const variation = Math.sin(x * .049) * Math.cos(y * .025) + .5 * Math.sin((x + y) * .074);
      const value = base + variation * (kind === "grass" ? 13 : kind === "road" ? 7 : 5) + (random() - .5) * (kind === "road" ? 55 : 24);
      image.data.set([value, value, value, 255], i);
    }
    ctx.putImageData(image, 0, 0);
    if (kind === "brick" || kind === "stone") {
      const row = kind === "brick" ? 32 : 16, column = kind === "brick" ? 64 : 16;
      ctx.strokeStyle = kind === "brick" ? "rgba(65,55,48,.35)" : "rgba(120,120,110,.18)";
      ctx.lineWidth = kind === "brick" ? 2 : 1;
      for (let y = 0; y <= 256; y += row) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(256, y); ctx.stroke();
        const offset = kind === "brick" && (y / row) % 2 ? column / 2 : 0;
        for (let x = offset; x <= 256; x += column) {
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + row); ctx.stroke();
        }
      }
    }
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.anisotropy = 4;
    textures.add(texture); return texture;
  }
  const mats = {
    base: material({ color: 0x8c9695, roughness: .85 }),
    stone: material({ color: 0xe4e0d3, roughness: .64, map: surfaceTexture("stone") }),
    trim: material({ color: 0xcbd0cd, roughness: .56 }),
    wall: material({ color: 0xbfc3bd, roughness: .66, map: surfaceTexture("stone") }),
    brick: material({ color: 0x9c5140, roughness: .94, map: surfaceTexture("brick") }),
    road: material({ color: 0x666f75, roughness: .95, map: surfaceTexture("road") }),
    paving: material({ color: 0xc0c5c1, roughness: .91, map: surfaceTexture("stone") }),
    grass: material({ color: 0x77905c, roughness: 1, map: surfaceTexture("grass") }),
    glass: material({ color: 0x6f929e, roughness: .24, metalness: .24 }),
    dimGlass: material({ color: 0x809da4, roughness: .27, metalness: .15, emissive: 0xffce92, emissiveIntensity: 0 }),
    litGlass: material({ color: 0x809da4, roughness: .27, metalness: .15, emissive: 0xffcb80, emissiveIntensity: 0 }),
    guardGlass: material({ color: 0x6a8b95, roughness: .23, metalness: .15, emissive: 0xffc474, emissiveIntensity: 0 }),
    frame: material({ color: 0xb4bdb9, roughness: .35, metalness: .36 }),
    metal: material({ color: 0x394750, roughness: .36, metalness: .55 }),
    white: material({ color: 0xeceee8, roughness: .72 }),
    yellow: material({ color: 0xad995e, roughness: .95 }),
    red: material({ color: 0xa44436, roughness: .87 }),
    trunk: material({ color: 0x89755c, roughness: 1 }),
    leaves: material({ color: 0x40654c, roughness: .58, side: THREE.DoubleSide }),
    bush: material({ color: 0x476745, roughness: .84 }),
    glow: material({ color: 0xe2dfce, roughness: .5, emissive: 0xffca81, emissiveIntensity: 0 }),
    landscapeLetters: material({ color: 0xeeeede, roughness: .65, emissive: 0xffd3a0, emissiveIntensity: 0 }),
  };
  // 共用既有 256px 灰階圖做極弱凹凸，石材、紅磚與柏油保留不同觸感。
  for (const [m, strength] of [[mats.stone, .006], [mats.wall, .008], [mats.brick, .012], [mats.road, .008]] as const) {
    const bump = m.map!.clone(); bump.colorSpace = THREE.NoColorSpace; textures.add(bump);
    m.bumpMap = bump; m.bumpScale = strength;
  }
  // 粗糙度使用既有資料貼圖，讓柏油保持乾燥、石材高光略有表面變化。
  mats.road.roughnessMap = mats.road.bumpMap;
  mats.stone.roughnessMap = mats.stone.bumpMap;
  mats.wall.roughnessMap = mats.wall.bumpMap;
  const cube = geometry(new THREE.BoxGeometry(1, 1, 1));
  const plane = geometry(new THREE.PlaneGeometry(1, 1));
  const pole = geometry(new THREE.CylinderGeometry(1, 1, 1, 12));
  const rounded = geometry(new RoundedBoxGeometry(1, 1, 1, 2, .035));
  const dummy = new THREE.Object3D();
  // 同類物件一次送給 GPU；陰影批次獨立，避免小物也重算陰影。
  function instance(g: THREE.BufferGeometry, m: THREE.Material, p: V3, s: V3, r: V3 = [0, 0, 0], shadow = false, tint = 0xffffff) {
    const key = `${g.uuid}:${m.uuid}:${shadow}`;
    if (!batches.has(key)) batches.set(key, { geometry: g, material: m, shadow, matrices: [], colors: [] });
    dummy.position.set(...p); dummy.scale.set(...s); dummy.rotation.set(...r); dummy.updateMatrix();
    batches.get(key)!.matrices.push(dummy.matrix.clone()); batches.get(key)!.colors.push(new THREE.Color(tint));
  }
  const box = (p: V3, s: V3, m: THREE.Material, shadow = false, bevel = false) => instance(bevel ? rounded : cube, m, p, s, [0, 0, 0], shadow);
  const mark = (x: number, z: number, w: number, d: number, m: THREE.Material, angle = 0, y = .064) => instance(plane, m, [x, y, z], [w, d, 1], [-Math.PI / 2, 0, angle]);
  function mesh(name: string, g: THREE.BufferGeometry, m: THREE.Material, p: V3, shadow = false) {
    const object = new THREE.Mesh(g, m); object.name = name; object.position.set(...p);
    object.castShadow = shadow; object.receiveShadow = true; model.add(object); sceneObjects[name] = object; return object;
  }
  // 連續圓弧面：Y 軸保持直立，樓層腰線與窗帶使用相同圓心。
  function arcGeometry(radius: number, depth: number, height: number, sweep = Math.PI, segments = 48) {
    const shape = new THREE.Shape();
    for (let i = 0; i <= segments; i++) {
      const a = -sweep / 2 + sweep * i / segments, x = radius * Math.sin(a), z = radius * Math.cos(a);
      if (!i) shape.moveTo(x, z); else shape.lineTo(x, z);
    }
    for (let i = segments; i >= 0; i--) {
      const a = -sweep / 2 + sweep * i / segments; shape.lineTo((radius - depth) * Math.sin(a), (radius - depth) * Math.cos(a));
    }
    shape.closePath();
    const g = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false, steps: 1, curveSegments: 1 });
    g.rotateX(Math.PI / 2); g.translate(0, height / 2, 0);
    // 弧面用連續徑向法線；保留上下平面與端面的硬邊，不增加面數。
    const positions = g.attributes.position, normals = g.attributes.normal;
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i), z = positions.getZ(i), r = Math.hypot(x, z);
      const alignment = (x * normals.getX(i) + z * normals.getZ(i)) / r;
      if (Math.abs(normals.getY(i)) < .5 && Math.abs(alignment) > .8) {
        const sign = Math.sign(alignment); normals.setXYZ(i, sign * x / r, 0, sign * z / r);
      }
    }
    return geometry(g);
  }
  function textTexture(text: string, ink: string, width = 1024, height = 128) {
    const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext("2d")!;
    ctx.font = `700 ${height * .74}px "Microsoft JhengHei", "Noto Sans TC", sans-serif`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillStyle = ink;
    ctx.shadowColor = "rgba(0,0,0,.22)"; ctx.shadowOffsetY = 2; ctx.shadowOffsetX = 1;
    ctx.fillText(text, width / 2, height / 2, width - 18);
    const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 4;
    textures.add(map); return map;
  }
  // 字牌貼合弧面，不隨攝影機轉向；避免下載巨大中文字型幾何。
  function arcLettering(name: string, text: string, center: V3, radius: number, sweep: number, height: number, depthScale = 1) {
    const g = geometry(new THREE.PlaneGeometry(radius * sweep, height, 64, 1));
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) { const a = pos.getX(i) / radius; pos.setXYZ(i, Math.sin(a) * radius, pos.getY(i), Math.cos(a) * radius * depthScale); }
    g.computeVertexNormals();
    const m = material({ map: textTexture(text, "#222a2e"), color: 0xffffff, roughness: .72, transparent: true, alphaTest: .15, side: THREE.DoubleSide });
    mesh(name, g, m, center);
  }
  function createBase() {
    mesh("square-base", geometry(new RoundedBoxGeometry(18, .52, 18, 2, .11)), mats.base, [0, -.3, 0]);
    box([0, -.03, 0], [17.85, .1, 17.85], mats.paving);
    box([0, .012, -2.4], [16.9, .035, 11.5], mats.grass);
    box([0, .028, -2.2], [5.5, .025, 10.9], mats.paving);
  }
  function createRoad() {
    box([0, .033, 6.5], [17.85, .035, 3.3], mats.road);
    box([gateLayout.islandX, .05, .45], [5.6, .035, 8.85], mats.road);
    for (const side of [-1, 1]) {
      const x = side * 5.85, width = 6.05;
      box([x, .095, 4.22], [width, .13, 1.13], mats.paving);
      box([x, .16, 4.78], [width, .14, .14], mats.trim, false, true);
      mark(x, 4.89, width, .055, mats.red);
    }
    box([0, .08, 8.56], [17.85, .12, .64], mats.paving);
    box([0, .15, 8.2], [17.85, .13, .13], mats.trim);
    mark(0, 7.94, 17.8, .055, mats.white);
    for (let x = -8.1; x < 8.4; x += 1.75) if (x < -2 || x > 2.6) mark(x, 6.5, .86, .055, mats.white);
    for (let i = 0; i < 9; i++) mark(-5.4, 5.18 + i * .32, 1.45, .16, mats.white);
    for (const z of [5.18, 7.62]) mark(gateLayout.islandX, z, 3.6, .032, mats.yellow);
    for (const side of [-1, 1]) mark(gateLayout.islandX + side * 1.8, 6.4, .032, 2.44, mats.yellow);
    // 對角線裁在禁停矩形內，不與斑馬線重疊。
    for (const slope of [-1, 1]) for (let b = -4.5; b <= 4.5; b += .64) {
      const points: [number, number][] = [];
      for (const x of [-2, 2]) { const z = slope * x + b; if (Math.abs(z) <= 1.35) points.push([x, z]); }
      for (const z of [-1.35, 1.35]) { const x = (z - b) / slope; if (Math.abs(x) < 2) points.push([x, z]); }
      if (points.length === 2) {
        const [a, c] = points, dx = c[0] - a[0], dz = c[1] - a[1];
        mark(gateLayout.islandX + (a[0] + c[0]) * .45, 6.4 + (a[1] + c[1]) * .45, Math.hypot(dx, dz) * .9, .022, mats.yellow, -Math.atan2(dz, dx));
      }
    }
    for (const side of [-1, 1]) mark(gateLayout.islandX + side * 2.18, .2, .045, 7.9, mats.white, 0, .076);
    for (const x of [-7.6, -3.15, 3.15, 7.7]) {
      mark(x, 4.58, .52, .24, mats.metal, 0, .17);
      for (let i = 0; i < 6; i++) mark(x - .2 + i * .08, 4.58, .023, .21, mats.trim, 0, .172);
    }
    for (let x = -8; x <= 8; x += .8) if (Math.abs(x) > 2.9) mark(x, 4.25, .009, .92, mats.wall, 0, .164);
  }
  function createSchoolWall() {
    mesh("brick-school-wall", arcGeometry(6.72, .27, 1.08, .83), mats.brick, [-4.8, .57, -3.35], true);
    mesh("stone-school-wall", arcGeometry(6.76, .34, .7, .83), mats.wall, [-4.8, 1.43, -3.35], true);
    mesh("wall-coping", arcGeometry(6.79, .4, .09, .84), mats.trim, [-4.8, 1.815, -3.35], true);
    arcLettering("school-wall-name", "國立高雄科技大學", [-4.8, 1.46, -3.35], 6.79, .74, .4);
    box([-4.9, .61, 1.7], [3, 1.12, .9], mats.brick, true, true);
    box([-4.9, 1.2, 1.7], [3.2, .13, 1.02], mats.trim, true, true);
    box([-4.9, 1.5, 1.78], [2.25, .46, .12], mats.metal);
    instance(plane, material({ map: textTexture("歡迎蒞臨 NKUST", "#ebba67", 512, 64), transparent: true, alphaTest: .15, emissive: 0xd7a661, emissiveMap: textTexture("歡迎蒞臨 NKUST", "#997644", 512, 64), emissiveIntensity: .4 }), [-4.9, 1.5, 1.846], [2.05, .23, 1]);
  }
  function createGate() {
    const { islandX, islandZ, guardZ } = gateLayout;
    // 一體成形的長圓分隔島，草皮延伸到警衛室下方，前端保留 NKUST 橢圓景觀。
    const islandGeometry = (radius: number, frontRadius: number, backRadius: number, height: number) => {
      const front = islandZ - guardZ, back = -.85;
      const shape = new THREE.Shape();
      shape.moveTo(-radius, back); shape.lineTo(-radius, front);
      shape.absellipse(0, front, radius, frontRadius, Math.PI, 0, true, 0);
      shape.lineTo(radius, back);
      shape.absellipse(0, back, radius, backRadius, 0, -Math.PI, true, 0);
      shape.closePath();
      const g = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false, steps: 1, curveSegments: 24 });
      g.rotateX(Math.PI / 2); return geometry(g);
    };
    mesh("gate-island-curb", islandGeometry(1.04, 1.4, .63, .14), mats.trim, [islandX, .21, guardZ]);
    mesh("gate-island-grass", islandGeometry(.97, 1.33, .56, .04), mats.grass, [islandX, .25, guardZ]);
    const letters = geometry(new TextGeometry("NKUST", { font: new FontLoader().parse(fontData), size: .4, depth: .065, curveSegments: 3, bevelEnabled: true, bevelThickness: .005, bevelSize: .004, bevelSegments: 1 }));
    letters.computeBoundingBox(); const textCenter = (letters.boundingBox!.min.x + letters.boundingBox!.max.x) / 2;
    mesh("NKUST-letters", letters, mats.landscapeLetters, [islandX - textCenter, .26, islandZ + .67]);
    for (const side of [-1, 1]) box([islandX + side * .625, .25, 3.62], [.16, .035, .12], mats.glow);
    for (const side of [-1, 1]) {
      const x = islandX + side * 1.72, z = 2.65, width = 1.16;
      // 桿身原位置不變，機座移到桿端作為轉軸，讓車道真正可以通行。
      const pivotX = x + side * width / 2;
      box([pivotX, .42, z], [.19, .72, .24], mats.trim, false, true);
      const arm = new THREE.Group(); arm.position.set(pivotX, .73, z + .14); model.add(arm); barriers.push(arm);
      sceneObjects[side > 0 ? "entry-barrier" : "exit-barrier"] = arm;
      const bar = new THREE.Mesh(cube, mats.white); bar.position.x = -side * width / 2; bar.scale.set(width, .075, .065); bar.castShadow = true; arm.add(bar);
      const pieces: THREE.BufferGeometry[] = [];
      for (let i = 0; i < 4; i++) pieces.push(cube.clone().scale(.13, .077, .008).translate(x - width / 2 + .12 + i * .32 - pivotX, 0, .04));
      const stripes = new THREE.Mesh(geometry(mergeGeometries(pieces)!), mats.red); pieces.forEach(g => g.dispose()); arm.add(stripes);
    }
    for (const side of [-1, 1]) {
      const x = islandX + side * 2.28;
      for (let i = 0; i < 8; i++) instance(pole, mats.metal, [x, .43, 1.15 + i * .26], [.023, .66, .023]);
      box([x, .75, 2.03], [.035, .04, 2.02], mats.metal);
    }
    const cone = geometry(new THREE.CylinderGeometry(.025, .11, .3, 12));
    for (const side of [-1, 1]) { const x = islandX + side * trafficLayout.coneX; instance(cone, mats.red, [x, .24, 3.72], [1, 1, 1]); box([x, .1, 3.72], [.24, .045, .24], mats.metal); }
  }
  function createGuardHouse() {
    const { islandX, guardZ, guardElevation } = gateLayout;
    const part = (p: V3, size: V3, mat: THREE.Material, shadow = false, bevel = false) =>
      box([islandX + p[0], guardElevation + p[1], guardZ + p[2]], size, mat, shadow, bevel);
    part([0, .1, 0], [1.55, .13, 1.88], mats.paving);
    part([0, .69, 0], [1.16, 1.3, 1.46], mats.brick, true, true);
    part([0, 1.4, 0], [1.38, .15, 1.65], mats.metal, true, true);
    part([0, 1.49, 0], [1.05, .04, 1.35], mats.wall);
    for (const z of [-.737, .738]) part([0, .98, z], [.92, .53, .012], mats.guardGlass);
    for (const x of [-.59, .59]) part([x, .98, 0], [.012, .53, 1.16], mats.guardGlass);
    for (const x of [-.45, -.15, .15, .45]) part([x, .98, .75], [.025, .56, .023], mats.frame);
    part([0, .7, .758], [1.03, .045, .055], mats.trim);
    part([0, .12, .95], [1.3, .14, .42], mats.paving);
    part([0, 1.3, .77], [.6, .025, .07], mats.glow);
  }
  function createMainBuilding() {
    for (const side of [-1, 1]) {
      box([side * 5.25, 3.28, -5.2], [5.0, 6.48, 2.22], mats.stone, true, true);
      box([side * 5.25, 6.58, -5.2], [5.12, .16, 2.36], mats.trim, true, true);
      for (let floor = 0; floor < 7; floor++) box([side * 5.25, .4 + floor * .87, -4.025], [5.06, .075, .24], mats.trim);
      for (let col = 0; col < 5; col++) box([side * (2.86 + col * 1.19), 3.26, -4.04], [.075, 6.38, .16], mats.wall, true);
      box([side * 5.7, 6.79, -5.43], [1.3, .29, .9], mats.wall, true, true);
    }
    box([0, 3.77, -5.23], [5.7, 5.55, 2.3], mats.stone, true);
    const centerZ = -4.04, depthScale = .44;
    const facade = (radius: number, depth: number, height: number) => arcGeometry(radius, depth, height).scale(1, 1, depthScale);
    // 寬而淺的橢圓弧自然接上左右翼，增加實牆高度，避免半圓柱塔的比例。
    for (let floor = 0; floor < 6; floor++) {
      const y = 1.47 + floor * .85, radius = floor === 5 ? 3.12 : 3.0;
      mesh(`curved-spandrel-${floor}`, facade(radius, .23, .5), mats.stone, [0, y, centerZ], true);
      mesh(`curved-sill-${floor}`, facade(radius + .055, .28, .055), mats.trim, [0, y + .274, centerZ]);
    }
    mesh("curved-crown", facade(3.16, .27, .49), mats.stone, [0, 6.58, centerZ], true);
    mesh("curved-roof-edge", facade(3.2, .34, .095), mats.trim, [0, 6.87, centerZ], true);
    mesh("central-roof", geometry(new THREE.CylinderGeometry(3.15, 3.15, .06, 64).scale(1, 1, depthScale)), mats.paving, [0, 6.84, centerZ]);
    arcLettering("building-name", "國立高雄科技大學", [0, 6.61, centerZ], 3.18, 1.9, .31, depthScale);
    arcLettering("administration-name", "行 政 大 樓", [0, 3.18, centerZ], 3.02, 1.15, .24, depthScale);
    box([0, .68, -4.04], [5.35, 1.22, .035], mats.guardGlass);
    for (let i = 0; i < 9; i++) box([-2.4 + i * .6, .68, -4.0], [.035, 1.25, .05], mats.frame);
    for (const a of [-1.14, -.4, .4, 1.14]) instance(pole, mats.wall, [2.88 * Math.sin(a), .68, centerZ + 2.88 * depthScale * Math.cos(a)], [.115, 1.3, .115], [0, 0, 0], true);
    for (let step = 0; step < 4; step++) box([0, .055 + step * .045, -2.2 - step * .19], [5.9 - step * .13, .055, .5], mats.trim);
  }
  let windowCount = 0, litWindowCount = 0, dimWindowCount = 0;
  function createWindows() {
    const addWindow = (p: V3, s: V3, angle = 0) => {
      const selection = random(), lit = selection < .13, dim = selection >= .13 && selection < .35;
      windowCount++; if (lit) litWindowCount++; if (dim) dimWindowCount++;
      const tint = new THREE.Color().setHSL(.54, .04 + random() * .08, .73 + random() * .23).getHex();
      instance(cube, lit ? mats.litGlass : dim ? mats.dimGlass : mats.glass, p, s, [0, angle, 0], false, tint);
      instance(cube, mats.frame, [p[0] + Math.sin(angle) * .017, p[1] + .075, p[2] + Math.cos(angle) * .017], [s[0], .018, s[2] + .018], [0, angle, 0]);
    };
    for (const side of [-1, 1]) for (let floor = 0; floor < 7; floor++) for (let col = 0; col < 14; col++) {
      const x = side * (2.95 + col * .35), y = .69 + floor * .86;
      addWindow([x, y, -4.065], [.31, .35, .03]);
      box([x + .17, y, -4.043], [.019, .36, .035], mats.frame);
      addWindow([x, y, -6.32], [.31, .35, .025], Math.PI);
    }
    for (let floor = 0; floor < 6; floor++) {
      const radius = floor === 5 ? 3.075 : 2.955, count = 32, depthScale = .44;
      for (let col = 0; col < count; col++) {
        const a = -Math.PI / 2 + (col + .5) * Math.PI / count, y = 1.91 + floor * .85;
        const normal = Math.atan2(Math.sin(a) * depthScale, Math.cos(a));
        const width = radius * Math.PI / count * Math.hypot(Math.cos(a), depthScale * Math.sin(a)) - .012;
        addWindow([radius * Math.sin(a), y, -4.04 + radius * depthScale * Math.cos(a)], [width, .30, .025], normal);
        const b = -Math.PI / 2 + col * Math.PI / count;
        instance(cube, mats.frame, [(radius + .018) * Math.sin(b), y, -4.04 + (radius + .018) * depthScale * Math.cos(b)], [.019, .32, .032], [0, Math.atan2(Math.sin(b) * depthScale, Math.cos(b)), 0]);
      }
    }
  }
  function createPalmTrees() {
    // 有弧度的中脊與分叉羽葉共用整組葉冠幾何，不使用方塊或球形葉冠。
    const pieces: THREE.BufferGeometry[] = [];
    for (let frond = 0; frond < 9; frond++) {
      const points: number[] = [], indices: number[] = [], starts: number[] = [];
      const angle = frond * Math.PI * 2 / 9;
      const rotate = (x: number, y: number, z: number) => [x * Math.cos(angle) + z * Math.sin(angle), y, -x * Math.sin(angle) + z * Math.cos(angle)];
      for (let j = 0; j <= 12; j++) {
        const t = j / 12, y = .42 * Math.sin(t * Math.PI) - .34 * t * t, w = .095 * Math.sin(Math.PI * t) + .008;
        starts.push(points.length / 3);
        points.push(...rotate(-w, y, t * 1.18), ...rotate(w, y, t * 1.18));
        if (j > 1 && j < 12) for (const side of [-1, 1]) {
          const width = .24 * Math.sin(t * Math.PI), n = points.length / 3;
          points.push(...rotate(0, y + .008, t * 1.18), ...rotate(side * width, y - .055, t * 1.18 + .12), ...rotate(side * .026, y, t * 1.18 + .075));
          indices.push(n, n + 1, n + 2);
        }
      }
      for (let j = 0; j < 12; j++) { const a = starts[j], b = starts[j + 1]; indices.push(a, a + 1, b, a + 1, b + 1, b); }
      const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(points, 3)); g.setIndex(indices); g.computeVertexNormals(); pieces.push(g);
    }
    const leaves = geometry(mergeGeometries(pieces)!); pieces.forEach(g => g.dispose());
    const trunk = geometry(new THREE.CylinderGeometry(.052, .092, 1, 12, 6));
    const positions: [number, number, number][] = [[-7.5, .65, 3.35], [-6.65, -2, 3.85], [-3.3, -1.45, 3.55], [-2.85, 1.35, 3.25], [4.3, 1.3, 3.65], [5.2, -1.8, 4], [7.5, .1, 3.45], [7.6, -3.3, 3.8]];
    positions.forEach(([baseX, baseZ, baseHeight], i) => {
      const x = baseX + (random() - .5) * .15, z = baseZ + (random() - .5) * .15;
      const height = baseHeight * (.85 + random() * .3), crown = .85 + random() * .25;
      const tilt = (random() - .5) * .06, heading = random() * Math.PI * 2;
      instance(trunk, mats.trunk, [x, height / 2 + .09, z], [1, height, 1], [0, 0, tilt], true);
      instance(leaves, mats.leaves, [x - Math.sin(tilt) * height / 2, height * Math.cos(tilt) + .09, z], [crown, crown, crown], [0, heading, tilt], true, i % 2 ? 0xc4d9b2 : 0xffffff);
    });
  }
  function createVegetation() {
    const bush = geometry(new THREE.SphereGeometry(1, 10, 7)), p = bush.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i), r = 1 + .035 * Math.sin(x * 13 + y * 9) * Math.cos(z * 11);
      p.setXYZ(i, x * r, y * r, z * r);
    }
    bush.computeVertexNormals();
    for (let i = 0; i < 16; i++) {
      const a = -.39 + i * .052;
      const height = .24 + random() * .1;
      instance(bush, mats.bush, [-4.8 + 7.2 * Math.sin(a), height + .05, -3.35 + 7.2 * Math.cos(a)], [.21 + random() * .035, height, .25], [0, i, 0], false, i % 3 ? 0xd3debe : 0xffffff);
    }
    for (const x of [-3.1, 3.1]) for (let i = 0; i < 15; i++) instance(bush, mats.bush, [x, .22, -.4 - i * .27], [.23, .19, .22], [0, i, 0]);
    for (const [x, z, scale] of [[-7.35, -6.6, 1], [7.3, -6.7, 1.15]]) {
      instance(pole, mats.trunk, [x, 1.17, z], [.09, 2.3, .09], [0, 0, .035], true);
      for (let i = 0; i < 6; i++) {
        const a = i * 2.4;
        instance(bush, mats.bush, [x + Math.cos(a) * .43, 2.2 + i % 3 * .25, z + Math.sin(a) * .43], [.7 * scale, .62, .7 * scale], [0, a, .13], true);
      }
    }
  }
  function createContactShadows() {
    // 一張共用的小遮罩補足根部接觸感，不使用 SSAO 或額外陰影燈。
    const canvas = document.createElement("canvas"); canvas.width = canvas.height = 64;
    const ctx = canvas.getContext("2d")!, gradient = ctx.createRadialGradient(32, 32, 3, 32, 32, 32);
    gradient.addColorStop(0, "rgba(22,32,27,.24)"); gradient.addColorStop(.5, "rgba(22,32,27,.10)"); gradient.addColorStop(1, "rgba(22,32,27,0)");
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, 64, 64);
    const texture = new THREE.CanvasTexture(canvas); textures.add(texture);
    const shadow = new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false }); materialSet.add(shadow);
    for (const [x, z, width, depth] of [[-4.8, 3.47, 6.3, 1.35], [gateLayout.islandX, (gateLayout.islandZ + gateLayout.guardZ) / 2, 2.5, gateLayout.islandZ - gateLayout.guardZ + 3], [0, -4.8, 16.2, 4.5], [-7.5, .65, 1, 1], [4.3, 1.3, 1, 1], [7.5, .1, 1, 1]]) {
      instance(plane, shadow, [x, .073, z], [width, depth, 1], [-Math.PI / 2, 0, 0]);
    }
    instance(plane, shadow, [gateLayout.islandX, .253, gateLayout.guardZ], [1.85, 2.4, 1], [-Math.PI / 2, 0, 0]);
  }
  let lightPoolMaterial: THREE.MeshBasicMaterial;
  function createLightPools() {
    // 共用小型漸淡貼圖補足局部落光，不加燈、不做反射或後製。
    const canvas = document.createElement("canvas"); canvas.width = canvas.height = 64;
    const ctx = canvas.getContext("2d")!, fill = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    fill.addColorStop(0, "rgba(255,198,112,.38)"); fill.addColorStop(.45, "rgba(255,187,96,.16)"); fill.addColorStop(1, "rgba(255,187,96,0)");
    ctx.fillStyle = fill; ctx.fillRect(0, 0, 64, 64);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; textures.add(texture);
    lightPoolMaterial = new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, opacity: 0, toneMapped: false });
    materialSet.add(lightPoolMaterial);
    for (const [x, y, z, w, d] of [[-7.65, .17, 4.25, 2.5, 1.05], [3.8, .17, 4.1, 2.4, 1.1], [0, .077, -1.7, 4.2, 2], [0, .256, 2.85, 1.7, 1.9], [-4.8, .17, 4.15, 4.2, .95], [1.5, .079, 1.6, 2.2, 2.8]]) {
      instance(plane, lightPoolMaterial, [x, y, z], [w, d, 1], [-Math.PI / 2, 0, 0]);
    }
  }
  const lights = {
    hemisphere: new THREE.HemisphereLight(0xe1edf4, 0x839477, 1.65),
    sun: new THREE.DirectionalLight(0xffeed5, 2.75),
    entrance: new THREE.PointLight(0xffce8d, 0, 7, 2),
    guard: new THREE.PointLight(0xffce8d, 0, 9, 2),
    street: new THREE.PointLight(0xffce8d, 0, 8, 2),
    wall: new THREE.SpotLight(0xffd8a0, 0, 9, .95, .6, 2),
  };
  function createStreetLights() {
    for (const [x, z] of [[-7.8, 4.25], [-2.4, -.65], [3.75, 3.95], [5.85, -.8]]) {
      instance(pole, mats.metal, [x, 1.22, z], [.029, 2.35, .029]);
      box([x + .12, 2.43, z], [.35, .08, .2], mats.metal, false, true);
      box([x + .12, 2.385, z], [.27, .018, .15], mats.glow);
    }
    for (const x of [-6.25, -4.8, -3.3]) { box([x, .16, 3.95], [.18, .12, .18], mats.metal); instance(plane, mats.glow, [x, .223, 3.92], [.13, .12, 1], [-1, 0, 0]); }
    for (const x of [-1, 0, 1]) box([x, 1.2, -3.15], [.28, .025, .22], mats.glow);
  }
  function createUtilityPole() {
    for (const z of [2, 7.5]) { instance(pole, mats.wall, [8.22, 1.85, z], [.055, 3.6, .055]); box([8.22, 3.38, z], [.66, .055, .075], mats.metal); }
    const m = new THREE.LineBasicMaterial({ color: 0x3f484f }); materialSet.add(m);
    for (const x of [8.02, 8.4]) {
      const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(x, 3.43, 2), new THREE.Vector3(x, 2.91, 4.75), new THREE.Vector3(x, 3.43, 7.5));
      model.add(new THREE.Line(geometry(new THREE.BufferGeometry().setFromPoints(curve.getPoints(16))), m));
    }
  }
  function createRoadSigns() {
    instance(pole, mats.metal, [5.7, .76, 4.15], [.027, 1.42, .027]);
    mesh("speed-sign", geometry(new THREE.CylinderGeometry(.235, .235, .045, 32)), mats.red, [5.7, 1.61, 4.15]).rotation.x = Math.PI / 2;
    mesh("speed-sign-face", geometry(new THREE.CircleGeometry(.192, 32)), mats.white, [5.7, 1.61, 4.177]);
    instance(plane, material({ map: textTexture("30", "#293b48", 128, 128), alphaTest: .2, transparent: true }), [5.7, 1.61, 4.18], [.31, .31, 1]);
  }
  function createLighting() {
    lights.sun.position.set(-8, 12, 7); lights.sun.target.position.set(0, 0, -1);
    lights.sun.castShadow = true;
    const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
    const limitedDevice = (memory !== undefined && memory <= 4) || navigator.hardwareConcurrency <= 4;
    const shadowSize = limitedDevice ? 512 : 1024;
    lights.sun.shadow.mapSize.set(shadowSize, shadowSize);
    Object.assign(lights.sun.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: .5, far: 40 });
    lights.sun.shadow.normalBias = .035; lights.sun.shadow.bias = -.0003; lights.sun.shadow.radius = 2;
    lights.entrance.position.set(0, 1.25, -3.05); lights.guard.position.set(gateLayout.islandX, gateLayout.guardElevation + 1.32, gateLayout.guardZ + .92);
    lights.street.position.set(-7.65, 2.28, 4.25); lights.wall.position.set(-4.8, .38, 5.3);
    lights.wall.target.position.set(-4.8, 1.42, 3.2);
    // 太陽與天空固定；校內燈具及投射目標跟著底座轉動，夜間才不會錯位。
    scene.add(lights.hemisphere, lights.sun, lights.sun.target);
    model.add(lights.entrance, lights.guard, lights.street, lights.wall, lights.wall.target);
  }
  function flushBatches() {
    for (const batch of batches.values()) {
      const object = new THREE.InstancedMesh(batch.geometry, batch.material, batch.matrices.length);
      batch.matrices.forEach((matrix, i) => { object.setMatrixAt(i, matrix); object.setColorAt(i, batch.colors[i]); });
      object.castShadow = batch.shadow; object.receiveShadow = true; object.computeBoundingSphere(); model.add(object);
    }
    batches.clear();
  }
  function initScene() {
    createBase(); createRoad(); createSchoolWall(); createGate(); createGuardHouse(); createMainBuilding();
    createWindows(); createPalmTrees(); createVegetation(); createContactShadows(); createLightPools(); createStreetLights(); createUtilityPole(); createRoadSigns(); createLighting(); flushBatches();
  }
  const camera = new THREE.PerspectiveCamera(36, 1, .1, 300);
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
  // 只有模型變動時才更新太陽陰影，靜止、縮放及日夜漸變沿用快取。
  renderer.shadowMap.autoUpdate = false; renderer.domElement.tabIndex = 0;
  renderer.domElement.setAttribute("aria-label", "建工校區校門口互動式三維建築模型"); host.appendChild(renderer.domElement);
  const surfaceResponses: [THREE.MeshStandardMaterial, number, number][] = [
    [mats.glass, .7, .2], [mats.dimGlass, .65, .18], [mats.litGlass, .65, .18], [mats.guardGlass, .7, .16],
    [mats.frame, .55, .2], [mats.metal, .5, .2], [mats.stone, .22, .08], [mats.wall, .25, .1],
    [mats.trim, .2, .08], [mats.road, .2, .07], [mats.leaves, .24, .14], [mats.bush, .12, .07],
  ];
  let reflectionSource: THREE.DataTexture | null = null;
  let reflectionTarget: THREE.WebGLRenderTarget | null = null;
  function createSurfaceLighting() {
    // 世界固定的低解析天空照明，只初始化一次；沒有逐幀捕捉場景或跟隨鏡頭。
    if (!reflectionSource) {
      const width = 256, height = 128, pixels = new Float32Array(width * height * 4);
      const sunDirection = lights.sun.position.clone().sub(lights.sun.target.position).normalize();
      for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        const elevation = (y / (height - 1) - .5) * Math.PI, azimuth = (x / width - .5) * Math.PI * 2;
        const dx = Math.cos(elevation) * Math.cos(azimuth), dy = Math.sin(elevation), dz = Math.cos(elevation) * Math.sin(azimuth);
        const sky = Math.max(0, dy), horizon = Math.pow(1 - Math.abs(dy), 4);
        const sun = Math.pow(Math.max(0, dx * sunDirection.x + dy * sunDirection.y + dz * sunDirection.z), 48) * 6;
        const i = (y * width + x) * 4;
        pixels[i] = .055 + sky * .22 + horizon * .2 + sun;
        pixels[i + 1] = .075 + sky * .33 + horizon * .22 + sun * .86;
        pixels[i + 2] = .09 + sky * .52 + horizon * .24 + sun * .66;
        pixels[i + 3] = 1;
      }
      reflectionSource = new THREE.DataTexture(pixels, width, height, THREE.RGBAFormat, THREE.FloatType);
      reflectionSource.colorSpace = THREE.LinearSRGBColorSpace; reflectionSource.mapping = THREE.EquirectangularReflectionMapping;
      reflectionSource.needsUpdate = true; textures.add(reflectionSource);
    }
    reflectionTarget?.dispose();
    const pmrem = new THREE.PMREMGenerator(renderer);
    reflectionTarget = pmrem.fromEquirectangular(reflectionSource); pmrem.dispose();
    for (const [m] of surfaceResponses) { m.envMap = reflectionTarget.texture; m.needsUpdate = true; }
  }
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableRotate = false;
  controls.enableDamping = true; controls.dampingFactor = .075; controls.rotateSpeed = .55; controls.zoomSpeed = .8;
  controls.enablePan = true; controls.panSpeed = .5; controls.minDistance = 15; controls.maxDistance = 100;
  controls.minPolarAngle = .3; controls.maxPolarAngle = 1.35;
  controls.touches.ONE = THREE.TOUCH.ROTATE; controls.touches.TWO = THREE.TOUCH.DOLLY_PAN;
  initScene();
  createSurfaceLighting();
  const bounds = new THREE.Box3().setFromObject(model);
  // 只計算一次各零件的包圍角點，避免把建築上方的空氣也納入取景。
  const framingPoints: THREE.Vector3[] = [];
  const instanceMatrix = new THREE.Matrix4(), worldMatrix = new THREE.Matrix4();
  model.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    if (!object.geometry.boundingBox) object.geometry.computeBoundingBox();
    const box = object.geometry.boundingBox!;
    const count = object instanceof THREE.InstancedMesh ? object.count : 1;
    for (let i = 0; i < count; i++) {
      if (object instanceof THREE.InstancedMesh) { object.getMatrixAt(i, instanceMatrix); worldMatrix.multiplyMatrices(object.matrixWorld, instanceMatrix); }
      else worldMatrix.copy(object.matrixWorld);
      for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) framingPoints.push(new THREE.Vector3(x, y, z).applyMatrix4(worldMatrix));
    }
  });
  // 生活層在原取景角點計算後加入，不改變既有模型構圖與鏡頭距離。
  const compactLife = window.matchMedia("(pointer: coarse)").matches || Math.min(host.clientWidth, host.clientHeight) < 500;
  const campusLife = createJiangongLife(compactLife, window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  model.add(campusLife.group); sceneObjects.life = campusLife.group;
  const viewDirection = new THREE.Vector3();
  const modelCenter = bounds.getCenter(new THREE.Vector3());
  const modelRadius = bounds.getSize(new THREE.Vector3()).length() / 2;
  const lookAt = new THREE.Vector3(0, 1.8, 0);
  const fitPosition = new THREE.Vector3();
  let viewAdjusted = false;
  type CameraTween = { from: THREE.Vector3; targetFrom: THREE.Vector3; elapsed: number; duration: number };
  let cameraTween: CameraTween | null = null;
  function interactionStarted() { viewAdjusted = true; cameraTween = null; renderer.domElement.dataset.entrance = "ready"; invalidate(); }
  const turntable = createModelTurntable(renderer.domElement, { invalidate, onStart: interactionStarted });
  const modelOrientation = new THREE.Quaternion(), yawOrientation = new THREE.Quaternion();
  const tiltAxis = new THREE.Vector3(1, 0, 0), rotatedModelCenter = new THREE.Vector3();
  let shadowRevision = 0, previousRenderTime = 0;
  function syncModelRotation() {
    // 垂直拖曳沿畫面的水平軸傾斜，不受目前模型朝向影響。
    tiltAxis.set(1, 0, 0).applyQuaternion(camera.quaternion).normalize();
    modelOrientation.setFromAxisAngle(tiltAxis, turntable.tilt);
    yawOrientation.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, turntable.angle);
    modelOrientation.multiply(yawOrientation);
    if (model.quaternion.equals(modelOrientation)) return;
    model.quaternion.copy(modelOrientation); model.updateMatrixWorld(true);
    renderer.shadowMap.needsUpdate = true; shadowRevision++;
  }
  function fitCamera() {
    // 清除尚未結束的慣性，避免重設／轉向螢幕後鏡頭繼續偏離。
    const damping = controls.enableDamping; controls.enableDamping = false; controls.update();
    const portrait = camera.aspect < .85;
    const landscape = !portrait && (host.clientHeight < 500 || window.matchMedia("(pointer: coarse)").matches);
    viewDirection.set(...(portrait ? [5, 22, 28] : [9, 22, 28]) as V3).normalize();
    camera.fov = portrait ? 42 : landscape ? 40 : 36; camera.updateProjectionMatrix();
    renderer.domElement.dataset.preset = portrait ? "portrait" : landscape ? "landscape" : "desktop";
    controls.target.copy(lookAt);
    const vfov = THREE.MathUtils.degToRad(camera.fov), hfov = 2 * Math.atan(Math.tan(vfov / 2) * camera.aspect);
    const forward = viewDirection.clone().negate(), right = new THREE.Vector3().crossVectors(forward, camera.up).normalize();
    const up = new THREE.Vector3().crossVectors(right, forward).normalize();
    let distance = 0;
    for (const point of framingPoints) {
      const p = point.clone().applyQuaternion(model.quaternion).sub(controls.target);
      distance = Math.max(distance, Math.abs(p.dot(right)) / Math.tan(hfov / 2) + p.dot(viewDirection), Math.abs(p.dot(up)) / Math.tan(vfov / 2) + p.dot(viewDirection));
    }
    controls.maxDistance = distance * 1.65;
    fitPosition.copy(controls.target).addScaledVector(viewDirection, distance * 1.025);
    camera.position.copy(fitPosition); controls.update(); controls.saveState();
    controls.enableDamping = damping; viewAdjusted = false;
  }
  function resetView() {
    if (disposed) return;
    const from = camera.position.clone(), targetFrom = controls.target.clone();
    turntable.reset(true); syncModelRotation(); fitCamera();
    cameraTween = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? null : { from, targetFrom, elapsed: 0, duration: .95 };
    if (!cameraTween) { camera.position.copy(fitPosition); controls.target.copy(lookAt); controls.update(); }
    renderer.domElement.dataset.entrance = cameraTween ? "entering" : "ready"; invalidate();
  }
  function startEntryAnimation() {
    fitCamera();
    const destination = fitPosition.clone();
    const from = lookAt.clone().add(destination.clone().sub(lookAt).multiplyScalar(1.16));
    camera.position.copy(from); controls.target.copy(lookAt); controls.update();
    cameraTween = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? null : { from, targetFrom: lookAt.clone(), elapsed: 0, duration: 1.05 };
    if (!cameraTween) camera.position.copy(destination);
    renderer.domElement.dataset.entrance = cameraTween ? "entering" : "ready";
  }
  let nightTarget = 0, blend = 0, startBlend = 0, transitionStarted = 0;
  const day = { background: new THREE.Color(0xdce9e9), top: new THREE.Color(0x7fb4d4), sky: new THREE.Color(0xcde4f5), ground: new THREE.Color(0x7e8b6d), sun: new THREE.Color(0xffe8c8) };
  const night = { background: new THREE.Color(0x263b50), top: new THREE.Color(0x0c182a), sky: new THREE.Color(0x8aaad9), ground: new THREE.Color(0x354a58), sun: new THREE.Color(0xaac6ee) };
  const skyBlend = { value: 0 };
  const skyAspect = { value: 1 };
  function createSky() {
    // 固定三朵淡雲共用 512px 遮罩；只混合同一個日夜進度，不另開動畫。
    const canvas = document.createElement("canvas"); canvas.width = 512; canvas.height = 256;
    const ctx = canvas.getContext("2d")!; ctx.filter = "blur(3px)";
    for (const [x, y, w, h] of [[32, 51, 168, 24], [322, 90, 155, 21], [222, 26, 100, 14]]) {
      ctx.save(); ctx.translate(x, y); ctx.scale(w, h); ctx.fillStyle = "rgba(255,255,255,.65)";
      ctx.beginPath(); ctx.moveTo(0, .75); ctx.bezierCurveTo(.04, .35, .14, .28, .26, .34);
      ctx.bezierCurveTo(.31, -.12, .54, -.05, .58, .31); ctx.bezierCurveTo(.7, .06, .87, .27, .87, .54);
      ctx.bezierCurveTo(1, .48, 1.06, .83, .94, .87); ctx.bezierCurveTo(.66, 1, .18, 1, 0, .75); ctx.fill(); ctx.restore();
    }
    const clouds = new THREE.CanvasTexture(canvas); textures.add(clouds);
    const skyMaterial = new THREE.ShaderMaterial({
      uniforms: { blend: skyBlend, aspect: skyAspect, clouds: { value: clouds }, dayTop: { value: day.top }, dayBottom: { value: day.background }, nightTop: { value: night.top }, nightBottom: { value: night.background } },
      vertexShader: "varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 1.0, 1.0); }",
      fragmentShader: `uniform float blend, aspect; uniform sampler2D clouds;
        uniform vec3 dayTop, dayBottom, nightTop, nightBottom; varying vec2 vUv;
        void main() {
          float h = smoothstep(0.0, 1.0, vUv.y);
          vec3 color = mix(mix(dayBottom, dayTop, h), mix(nightBottom, nightTop, h), blend);
          vec2 cloudUv = vec2(vUv.x, 1.0 - (1.0 - vUv.y) * 2.0 / aspect);
          float cloud = texture2D(clouds, cloudUv).a * (1.0 - blend) * .48;
          gl_FragColor = vec4(mix(color, vec3(.93, .96, 1.0), cloud), 1.0);
          #include <colorspace_fragment>
        }`,
      depthTest: false, depthWrite: false, toneMapped: false,
    });
    materialSet.add(skyMaterial);
    const sky = new THREE.Mesh(geometry(new THREE.PlaneGeometry(2, 2)), skyMaterial);
    sky.frustumCulled = false; sky.renderOrder = -100; scene.add(sky); sceneObjects.sky = sky;
  }
  scene.background = null; createSky();
  const dayGlass = mats.glass.color.clone(), nightGlass = new THREE.Color(0x243743);
  const skyTop = new THREE.Color(), skyBottom = new THREE.Color();
  let backgroundStyle = "";
  function applyLighting(t: number) {
    skyBlend.value = t;
    skyTop.copy(day.top).lerp(night.top, t); skyBottom.copy(day.background).lerp(night.background, t);
    const css = `linear-gradient(to bottom, #${skyTop.getHexString()}, #${skyBottom.getHexString()})`;
    if (css !== backgroundStyle) { backgroundStyle = css; options.onBackgroundChange?.(css); }
    lights.hemisphere.color.copy(day.sky).lerp(night.sky, t); lights.hemisphere.groundColor.copy(day.ground).lerp(night.ground, t);
    lights.hemisphere.intensity = THREE.MathUtils.lerp(.72, .6, t); lights.sun.color.copy(day.sun).lerp(night.sun, t);
    lights.sun.intensity = THREE.MathUtils.lerp(3.25, .26, t); lights.entrance.intensity = t * 14; lights.guard.intensity = t * 12;
    lights.street.intensity = t * 26; lights.wall.intensity = t * 22; lightPoolMaterial.opacity = t * .65;
    mats.glass.color.copy(dayGlass).lerp(nightGlass, t);
    mats.dimGlass.emissiveIntensity = t * .42; mats.litGlass.emissiveIntensity = t * 1.35;
    mats.guardGlass.emissiveIntensity = t * .85; mats.glow.emissiveIntensity = t * 1.8; mats.landscapeLetters.emissiveIntensity = t * .45;
    for (const [m, dayIntensity, nightIntensity] of surfaceResponses) m.envMapIntensity = THREE.MathUtils.lerp(dayIntensity, nightIntensity, t);
    mats.road.roughness = THREE.MathUtils.lerp(.98, .92, t); renderer.toneMappingExposure = THREE.MathUtils.lerp(1.02, 1.13, t);
    renderer.domElement.dataset.lighting = t < .001 ? "day" : t > .999 ? "night" : "transition";
  }
  function changeMode(value: number) {
    if (value === nightTarget) return;
    startBlend = blend; nightTarget = value; transitionStarted = performance.now(); options.onModeChange?.(Boolean(value)); invalidate();
  }
  function setDayMode() { changeMode(0); }
  function setNightMode() { changeMode(1); }
  function toggleDayNight() { changeMode(nightTarget ? 0 : 1); }
  let frame = 0, renderedFrames = 0, disposed = false, active = true, visible = !document.hidden, contextAvailable = true, drawing = false, lastWidth = 0, lastHeight = 0;
  let pausedAt: number | null = null;
  const autoNight = createAutoNightSwitch(() => { setNightMode(); updateTimerStatus(); }, { delay: trafficChoreography.autoNightDelay * 1000 });
  function updateTimerStatus() { renderer.domElement.dataset.autoNight = autoNight.getState().status; }
  function beginVisit() {
    // 每次進入展示從白天開始，沿用模型與相機，不重建 WebGL 資源。
    blend = startBlend = nightTarget = 0; transitionStarted = performance.now();
    options.onModeChange?.(false); applyLighting(0);
    startEntryAnimation(); autoNight.restart(visible); updateTimerStatus(); invalidate();
  }
  function syncVisibility() {
    const next = active && !document.hidden && contextAvailable;
    if (visible && !next) { pausedAt = performance.now(); cancelAnimationFrame(frame); frame = 0; }
    if (!visible && next && pausedAt !== null) { transitionStarted += performance.now() - pausedAt; pausedAt = null; }
    visible = next;
    turntable.setEnabled(visible); previousRenderTime = 0;
    if (visible) { autoNight.resume(); invalidate(); } else autoNight.pause();
    updateTimerStatus();
  }
  function setActive(value: boolean) {
    const entering = value && !active;
    active = value; controls.enabled = value; syncVisibility();
    if (value) { onWindowResize(); if (entering) beginVisit(); }
  }
  function invalidate() { if (!disposed && visible && !drawing && !frame) frame = requestAnimationFrame(animate); }
  function animate(time: number) {
    frame = 0; drawing = true;
    if (disposed || !visible) { drawing = false; return; }
    // 動態展示限制為 30 / 24 FPS，隱藏分頁則完全暫停同一時間軸。
    if (campusLife.moving && previousRenderTime && time - previousRenderTime < 1000 / (compactLife ? 24 : 30) - 1) { drawing = false; invalidate(); return; }
    const delta = previousRenderTime ? Math.min(.1, (time - previousRenderTime) / 1000) : 0;
    const rotationChanged = turntable.update(delta || 1 / 60);
    previousRenderTime = time; syncModelRotation();
    const progress = startBlend === nightTarget ? 1 : Math.min(1, (time - transitionStarted) / 1600);
    blend = THREE.MathUtils.lerp(startBlend, nightTarget, progress * progress * (3 - 2 * progress)); applyLighting(blend);
    const actorsChanged = campusLife.update(delta, blend, renderer.getPixelRatio());
    barriers[0].rotation.z = campusLife.traffic.exit * Math.PI * .48;
    barriers[1].rotation.z = -campusLife.traffic.entry * Math.PI * .48;
    if (actorsChanged) { renderer.shadowMap.needsUpdate = true; shadowRevision++; }
    let changed = false;
    if (cameraTween) {
      cameraTween.elapsed += delta;
      const p = Math.min(1, cameraTween.elapsed / cameraTween.duration), ease = p * p * (3 - 2 * p);
      const damping = controls.enableDamping; controls.enableDamping = false;
      camera.position.lerpVectors(cameraTween.from, fitPosition, ease); controls.target.lerpVectors(cameraTween.targetFrom, lookAt, ease);
      controls.update(); controls.enableDamping = damping; changed = true;
      if (p === 1) { cameraTween = null; renderer.domElement.dataset.entrance = "ready"; }
    } else changed = controls.update();
    // 平移有界限；鏡頭保持在包含模型的球體外，避免穿入建築或底座。
    const previousTarget = controls.target.clone();
    controls.target.clamp(new THREE.Vector3(-3, .7, -3), new THREE.Vector3(3, 3.5, 3));
    camera.position.add(controls.target.clone().sub(previousTarget));
    rotatedModelCenter.copy(modelCenter).applyQuaternion(model.quaternion);
    controls.minDistance = modelRadius + controls.target.distanceTo(rotatedModelCenter) + .3;
    const offset = camera.position.clone().sub(controls.target);
    if (offset.length() < controls.minDistance) camera.position.copy(controls.target).add(offset.setLength(controls.minDistance));
    camera.lookAt(controls.target); renderer.render(scene, camera);
    renderer.domElement.dataset.drawCalls = String(renderer.info.render.calls);
    renderer.domElement.dataset.triangles = String(renderer.info.render.triangles);
    renderer.domElement.dataset.windows = `${litWindowCount + dimWindowCount}/${windowCount}`;
    renderer.domElement.dataset.windowLevels = JSON.stringify({ off: windowCount - litWindowCount - dimWindowCount, dim: dimWindowCount, bright: litWindowCount });
    renderer.domElement.dataset.sceneId = scene.uuid;
    renderer.domElement.dataset.shadowSize = String(lights.sun.shadow.mapSize.x);
    renderer.domElement.dataset.geometries = String(renderer.info.memory.geometries);
    renderer.domElement.dataset.textures = String(renderer.info.memory.textures);
    renderer.domElement.dataset.distance = camera.position.distanceTo(controls.target).toFixed(2);
    renderer.domElement.dataset.frames = String(++renderedFrames);
    renderer.domElement.dataset.elevation = THREE.MathUtils.radToDeg(Math.PI / 2 - controls.getPolarAngle()).toFixed(1);
    renderer.domElement.dataset.azimuth = THREE.MathUtils.radToDeg(controls.getAzimuthalAngle()).toFixed(1);
    renderer.domElement.dataset.sunPosition = lights.sun.position.toArray().join(",");
    renderer.domElement.dataset.modelRotation = THREE.MathUtils.radToDeg(turntable.angle).toFixed(2);
    renderer.domElement.dataset.modelTilt = THREE.MathUtils.radToDeg(turntable.tilt).toFixed(2);
    renderer.domElement.dataset.modelQuaternion = model.quaternion.toArray().map(n => n.toFixed(6)).join(",");
    renderer.domElement.dataset.shadowRevision = String(shadowRevision);
    renderer.domElement.dataset.cameraPosition = camera.position.toArray().map(n => n.toFixed(4)).join(",");
    renderer.domElement.dataset.guardLightPosition = lights.guard.getWorldPosition(new THREE.Vector3()).toArray().map(n => n.toFixed(4)).join(",");
    renderer.domElement.dataset.reflectionMap = reflectionTarget?.texture.uuid ?? "";
    Object.assign(renderer.domElement.dataset, { trafficPhase: campusLife.traffic.phase, trafficTime: campusLife.time.toFixed(2), vehiclePosition: campusLife.vehicle.position.toArray().map(v => v.toFixed(3)).join(","), vehicleHeading: campusLife.vehicle.rotation.y.toFixed(3), entryBarrier: campusLife.traffic.entry.toFixed(3), exitBarrier: campusLife.traffic.exit.toFixed(3), students: "3", cars: "1", scooters: "1", bicycles: "1", nightParticles: campusLife.dust.visible ? String(campusLife.particleCount) : "0" });
    drawing = false; if (changed || rotationChanged || cameraTween || progress < 1 || campusLife.moving) invalidate();
  }
  function onWindowResize() {
    const w = host.clientWidth, h = host.clientHeight;
    if (!w || !h || (w === lastWidth && h === lastHeight)) return;
    const previousAspect = lastWidth / lastHeight;
    camera.aspect = w / h; skyAspect.value = camera.aspect; camera.updateProjectionMatrix(); renderer.setSize(w, h);
    if (!lastWidth || !viewAdjusted || (previousAspect > 1) !== (camera.aspect > 1)) { fitCamera(); cameraTween = null; renderer.domElement.dataset.entrance = "ready"; }
    lastWidth = w; lastHeight = h; invalidate();
  }
  const resizeObserver = new ResizeObserver(onWindowResize); resizeObserver.observe(host);
  controls.addEventListener("change", invalidate);
  controls.addEventListener("start", interactionStarted);
  const visibilityChanged = () => syncVisibility();
  const windowBlurred = () => turntable.cancel();
  const keydown = (event: KeyboardEvent) => {
    if (!active || event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
    if (event.target instanceof HTMLElement && event.target.closest("button, a, input, select, textarea, [contenteditable]")) return;
    if (event.key.toLowerCase() === "n") toggleDayNight();
    if (event.key.toLowerCase() === "r") resetView();
  };
  const contextLost = (event: Event) => { event.preventDefault(); contextAvailable = false; syncVisibility(); };
  const contextRestored = () => { createSurfaceLighting(); renderer.shadowMap.needsUpdate = true; contextAvailable = true; syncVisibility(); };
  window.addEventListener("keydown", keydown); document.addEventListener("visibilitychange", visibilityChanged);
  window.addEventListener("blur", windowBlurred);
  renderer.domElement.addEventListener("webglcontextlost", contextLost); renderer.domElement.addEventListener("webglcontextrestored", contextRestored);
  renderer.shadowMap.needsUpdate = true; onWindowResize(); startEntryAnimation(); beginVisit();
  function dispose() {
    if (disposed) return;
    disposed = true; autoNight.dispose(); turntable.dispose(); cancelAnimationFrame(frame); resizeObserver.disconnect(); controls.removeEventListener("change", invalidate); controls.removeEventListener("start", interactionStarted); controls.dispose();
    window.removeEventListener("blur", windowBlurred);
    window.removeEventListener("keydown", keydown); document.removeEventListener("visibilitychange", visibilityChanged);
    renderer.domElement.removeEventListener("webglcontextlost", contextLost); renderer.domElement.removeEventListener("webglcontextrestored", contextRestored);
    campusLife.dispose(); model.remove(campusLife.group);
    model.traverse(object => { if (object instanceof THREE.InstancedMesh) object.dispose(); });
    geometries.forEach(g => g.dispose()); materialSet.forEach(m => m.dispose()); textures.forEach(t => t.dispose());
    reflectionTarget?.dispose(); lights.sun.shadow.dispose(); renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove(); scene.clear();
  }
  return { sceneObjects, lights, setDayMode, setNightMode, toggleDayNight, resetView, setActive, dispose };
}
