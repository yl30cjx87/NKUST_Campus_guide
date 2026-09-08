import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { createCampusEmblem } from "./campus-emblem";

type V3 = [number, number, number];
type Batch = { geometry: THREE.BufferGeometry; material: THREE.Material; matrices: THREE.Matrix4[]; shadow: boolean };
export type CampusSelectionMap = ReturnType<typeof createCampusSelectionMap>;

// 這是導覽用示意地圖，校區以同一片地景連接，不作實際地理定位。
export function createCampusSelectionMap(host: HTMLElement, labels: Map<string, HTMLButtonElement>, campuses: readonly { name: string; color: number }[], callbacks: {
  onSelect: (name: string) => void;
  onHover: (name: string | null) => void;
}) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x8bcbd3);
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;
  renderer.domElement.dataset.scene = "campus-selection";
  host.appendChild(renderer.domElement);

  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
  const toonRamp = new THREE.DataTexture(new Uint8Array([95, 160, 220, 255]), 4, 1, THREE.RedFormat);
  toonRamp.minFilter = toonRamp.magFilter = THREE.NearestFilter; toonRamp.needsUpdate = true;
  const geo = <T extends THREE.BufferGeometry>(g: T) => { geometries.add(g); return g; };
  const mat = (color: number, options: THREE.MeshStandardMaterialParameters = {}) => {
    const material = Object.keys(options).length
      ? new THREE.MeshStandardMaterial({ color, roughness: .88, ...options })
      : new THREE.MeshToonMaterial({ color, gradientMap: toonRamp });
    materials.add(material); return material;
  };
  const m = {
    wall: mat(0xe4e6dc), trim: mat(0xbac9c4), glass: mat(0x467885, { roughness: .38, metalness: .12 }),
    roof: mat(0x57818b), brick: mat(0xb87c64), white: mat(0xf2f1dc), grass: mat(0x8faa72),
    park: mat(0xa7bd81), road: mat(0x7b9290), path: mat(0xe0dcc3), shore: mat(0xc0c5ad),
    water: mat(0x5eb5c3, { roughness: .5, metalness: .08 }), trunk: mat(0x88795b),
    foliage: mat(0x547a52), foliageLight: mat(0x769655), court: mat(0x92b49b), track: mat(0xc79273),
  };
  const cube = geo(new THREE.BoxGeometry(1, 1, 1));
  const rounded = geo(new RoundedBoxGeometry(1, 1, 1, 1, .08));
  const cylinder = geo(new THREE.CylinderGeometry(1, 1, 1, 8));
  const crown = geo(new THREE.SphereGeometry(1, 10, 7));
  const dummy = new THREE.Object3D();
  const batches = new Map<THREE.Group, Map<string, Batch>>();
  const ground = new THREE.Group(); scene.add(ground);
  const campusGroups = new Map<string, THREE.Group>();
  const pickTargets: THREE.Object3D[] = [];
  let seed = 847;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };

  function instance(parent: THREE.Group, geometry: THREE.BufferGeometry, material: THREE.Material, position: V3, scale: V3, rotation: V3 = [0, 0, 0], shadow = false) {
    if (!batches.has(parent)) batches.set(parent, new Map());
    const entries = batches.get(parent)!;
    const key = `${geometry.uuid}:${material.uuid}:${shadow}`;
    if (!entries.has(key)) entries.set(key, { geometry, material, matrices: [], shadow });
    dummy.position.set(...position); dummy.scale.set(...scale); dummy.rotation.set(...rotation); dummy.updateMatrix();
    entries.get(key)!.matrices.push(dummy.matrix.clone());
  }
  const box = (parent: THREE.Group, position: V3, scale: V3, material: THREE.Material, shadow = false, bevel = false) => instance(parent, bevel ? rounded : cube, material, position, scale, [0, 0, 0], shadow);
  function mesh(parent: THREE.Group, geometry: THREE.BufferGeometry, material: THREE.Material, position: V3 = [0, 0, 0], shadow = false) {
    const object = new THREE.Mesh(geometry, material); object.position.set(...position); object.receiveShadow = true; object.castShadow = shadow; parent.add(object); return object;
  }
  function flatShape(parent: THREE.Group, points: [number, number][], material: THREE.Material, y = .025) {
    const shape = new THREE.Shape();
    points.forEach(([x, z], i) => i ? shape.lineTo(x, -z) : shape.moveTo(x, -z)); shape.closePath();
    const object = mesh(parent, geo(new THREE.ShapeGeometry(shape)), material, [0, y, 0]); object.rotation.x = -Math.PI / 2; return object;
  }
  function block(parent: THREE.Group, x: number, z: number, w: number, d: number, height: number, floors: number, wall = m.wall) {
    box(parent, [x, height / 2 + .08, z], [w, height, d], wall, true, true);
    box(parent, [x, height + .09, z], [w + .12, .12, d + .12], m.trim);
    for (let floor = 0; floor < floors; floor++) {
      const y = .32 + floor * (height - .22) / floors;
      for (let column = 0; column < Math.floor(w / .38); column++) {
        const wx = x - w / 2 + .22 + column * .38;
        box(parent, [wx, y, z + d / 2 + .012], [.26, .19, .025], m.glass);
        box(parent, [wx, y, z - d / 2 - .012], [.26, .19, .025], m.glass);
      }
      box(parent, [x, y + .18, z + d / 2 + .028], [w, .045, .055], m.white);
    }
  }
  function tree(parent: THREE.Group, x: number, z: number, size = 1) {
    instance(parent, cylinder, m.trunk, [x, .45 * size, z], [.06 * size, .9 * size, .06 * size]);
    instance(parent, crown, m.foliage, [x, .95 * size, z], [.4 * size, .54 * size, .42 * size], [0, 0, 0], true);
    instance(parent, crown, m.foliageLight, [x - .12 * size, 1.19 * size, z - .08], [.29 * size, .32 * size, .31 * size]);
  }
  const frond = (() => {
    const vertices: number[] = [];
    for (let i = 0; i < 5; i++) {
      const t = i / 5, next = (i + 1) / 5;
      const a = [t * .72, .25 * Math.sin(t * Math.PI) - t * .12, .105 * (1 - t)];
      const b = [next * .72, .25 * Math.sin(next * Math.PI) - next * .12, .105 * (1 - next)];
      vertices.push(a[0], a[1], -a[2], a[0], a[1], a[2], b[0], b[1], b[2], a[0], a[1], -a[2], b[0], b[1], b[2], b[0], b[1], -b[2]);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3)); g.computeVertexNormals(); return geo(g);
  })();
  const palmMaterial = mat(0x426e53, { side: THREE.DoubleSide });
  function palm(parent: THREE.Group, x: number, z: number) {
    instance(parent, cylinder, m.trunk, [x, .88, z], [.045, 1.76, .045], [0, 0, -.025], true);
    for (let i = 0; i < 7; i++) instance(parent, frond, palmMaterial, [x, 1.75, z], [1, 1, 1], [0, i * Math.PI * 2 / 7, 0], true);
  }

  // 一片連續的草地、海岸與中央水域，沒有獨立漂浮平台。
  mesh(ground, geo(new THREE.PlaneGeometry(180, 180)), m.water, [0, -.14, 0]).rotation.x = -Math.PI / 2;
  const coastline: [number, number][] = [[-26, -32], [26, -32], [26, 12], [13, 12], [9, 10.8], [5, 11.6], [1, 12], [-3, 10.6], [-7, 9.8], [-10, 8.6], [-17, 9.3], [-26, 6]];
  flatShape(ground, coastline, m.shore, -.06);
  flatShape(ground, coastline.map(([x, z]) => [x, z - .3]), m.grass, -.02);
  const lake = new THREE.Shape();
  lake.absellipse(0, 0, 2.1, 2.65, 0, Math.PI * 2, false, 0);
  const lakeMesh = mesh(ground, geo(new THREE.ShapeGeometry(lake, 40)), m.water, [.2, .01, -.2]); lakeMesh.rotation.x = -Math.PI / 2;
  const lakeEdge = mesh(ground, geo(new THREE.RingGeometry(1, 1.08, 48)), m.path, [.2, 0, -.2]); lakeEdge.rotation.x = -Math.PI / 2; lakeEdge.scale.set(2.1, 2.65, 1);
  const emblem = createCampusEmblem();
  emblem.position.set(.2, .065, -.2);
  ground.add(emblem);
  emblem.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    geometries.add(object.geometry);
    const shared = Array.isArray(object.material) ? object.material : [object.material];
    shared.forEach(material => materials.add(material));
  });
  for (let i = 0; i < 36; i++) {
    const x = (random() - .5) * 31, z = -10 - random() * 9;
    tree(ground, x, z, .8 + random() * .65);
  }
  for (let i = 0; i < 16; i++) tree(ground, (i % 2 ? -1 : 1) * (11 + random() * 4), -8 + random() * 15, .75 + random() * .5);

  campuses.forEach(campus => {
    const parent = new THREE.Group(); parent.name = campus.name; parent.userData.campus = campus.name;
    scene.add(parent); campusGroups.set(campus.name, parent);
    box(parent, [0, .018, .1], [5.4, .07, 3.8], m.path, false, true);
    box(parent, [0, .065, 1.5], [4.6, .035, .2], m.white);
    if (campus.name === "建工校區") {
      block(parent, -1.53, -.42, 1.4, 1.3, 2.12, 6);
      block(parent, 1.53, -.42, 1.4, 1.3, 2.12, 6);
      const arc = geo(new THREE.CylinderGeometry(1.05, 1.05, 1, 32, 1, false, -Math.PI / 2, Math.PI));
      for (let floor = 0; floor < 6; floor++) {
        instance(parent, arc, m.wall, [0, .27 + floor * .33, -.53], [1, .18, .58], [0, 0, 0], true);
        instance(parent, arc, m.glass, [0, .43 + floor * .33, -.53], [.99, .14, .57]);
      }
      box(parent, [0, 2.28, -.5], [2.2, .2, 1.05], m.wall, true, true);
      box(parent, [.25, .3, 1.1], [.53, .54, .4], m.brick, true);
      box(parent, [.25, .59, 1.1], [.69, .09, .55], m.roof);
      box(parent, [-1.4, .29, 1.6], [1.45, .48, .16], m.brick, true);
      box(parent, [-1.4, .59, 1.6], [1.45, .22, .19], m.wall);
      palm(parent, -2.35, -.2); palm(parent, 2.35, -.2);
    } else if (campus.name === "燕巢校區") {
      block(parent, -1.3, -.4, 1.7, 1.8, 2.0, 5, m.brick);
      block(parent, 1.1, -.5, 1.8, 1.5, 2.35, 6, m.brick);
      block(parent, -.05, -1.0, 1.0, .8, 1.25, 3);
      tree(parent, -2.28, .65); tree(parent, 2.25, .5, 1.1);
    } else if (campus.name === "第一校區") {
      block(parent, -1.35, -.3, 1.6, 1.4, 1.48, 4);
      block(parent, 1.35, -.3, 1.6, 1.4, 1.48, 4);
      block(parent, 0, -.88, 1.3, .8, 1.88, 5);
      box(parent, [0, .12, .9], [1.25, .11, .7], m.park, false, true);
      palm(parent, -2.3, .6); palm(parent, 2.3, .6);
    } else if (campus.name === "楠梓校區") {
      block(parent, -1.2, -.3, 1.65, 1.5, 1.85, 5);
      block(parent, 1.05, -.4, 1.9, 1.3, 1.55, 4);
      box(parent, [-1.2, 1.99, -.3], [1.8, .16, 1.65], m.roof);
      box(parent, [1.05, 1.69, -.4], [2.05, .16, 1.45], m.roof);
      palm(parent, -2.3, .9); palm(parent, 2.3, .7);
    } else {
      block(parent, -.85, -.5, 2.0, 1.5, 1.45, 4);
      block(parent, 1.18, -.58, 1.2, 1.3, 1.85, 5);
      box(parent, [1.18, 1.99, -.58], [1.45, .16, 1.5], m.roof);
      box(parent, [-1.7, .035, 2.25], [.65, .18, 2.0], m.path);
      instance(parent, rounded, m.white, [-1.68, .05, 3.35], [.67, .34, 1.65]);
      box(parent, [-1.68, .3, 3.25], [.48, .3, .78], m.roof);
      box(parent, [-1.68, .5, 3.32], [.35, .17, .5], m.white);
      instance(parent, cylinder, m.white, [-1.68, .87, 3.37], [.025, .66, .025]);
      palm(parent, -2.3, .8); palm(parent, 2.2, .7);
    }
    for (let i = 0; i < 9; i++) instance(parent, crown, i % 3 ? m.foliage : m.foliageLight, [-2.0 + i * .5, .16, 1.71], [.19, .17, .19]);
    tree(parent, -2.25, -1.45, .7); tree(parent, 2.25, -1.45, .8);
    const accent = mat(campus.color);
    instance(parent, cylinder, accent, [0, .09, 1.4], [.16, .08, .16]);
  });

  // 相同幾何與材質合成 InstancedMesh；每個校區保留自己的可點擊群組。
  for (const [parent, entries] of batches) for (const batch of entries.values()) {
    const object = new THREE.InstancedMesh(batch.geometry, batch.material, batch.matrices.length);
    batch.matrices.forEach((matrix, i) => object.setMatrixAt(i, matrix));
    object.castShadow = batch.shadow; object.receiveShadow = true; object.computeBoundingSphere(); parent.add(object);
    if (parent.userData.campus) { object.userData.campus = parent.userData.campus; pickTargets.push(object); }
  }
  batches.clear();
  const routes = new THREE.Group(); scene.add(routes);
  const hemi = new THREE.HemisphereLight(0xe1f2ff, 0x6f8660, 1.6); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffefd4, 2.5); sun.position.set(-12, 24, 14);
  sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -21, right: 21, top: 23, bottom: -23, near: 1, far: 70 });
  sun.shadow.normalBias = .025; sun.shadow.bias = -.0002; scene.add(sun);
  const camera = new THREE.OrthographicCamera(-14, 14, 12, -12, .1, 150);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableRotate = false; controls.enableDamping = true; controls.dampingFactor = .14;
  controls.mouseButtons.LEFT = THREE.MOUSE.PAN; controls.mouseButtons.RIGHT = THREE.MOUSE.PAN;
  controls.touches.ONE = THREE.TOUCH.PAN; controls.touches.TWO = THREE.TOUCH.DOLLY_PAN;
  controls.minZoom = .85; controls.maxZoom = 1.7; controls.panSpeed = .45; controls.zoomSpeed = .65;
  let disposed = false, frame = 0, drawing = false, width = 0, height = 0, portrait: boolean | null = null, compactLandscape = false, activeHover: string | null = null;
  const screen = new THREE.Vector3(), raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2();
  let down: { x: number; y: number; id: number; moved: boolean } | null = null;
  const activePointers = new Set<number>();

  function rebuildRoutes() {
    for (const child of [...routes.children]) { const road = child as THREE.Mesh; geometries.delete(road.geometry); road.geometry.dispose(); routes.remove(child); }
    campusGroups.forEach(group => {
      const end = group.position.clone().add(new THREE.Vector3(0, 0, 1.3));
      const start = new THREE.Vector3(end.x < 0 ? -2.5 : 2.5, 0, THREE.MathUtils.clamp(end.z, -3, 3));
      const curve = new THREE.QuadraticBezierCurve3(start, new THREE.Vector3(end.x, 0, start.z), end);
      const points = curve.getPoints(18), positions: number[] = [];
      for (let i = 0; i < points.length - 1; i++) {
        const a = points[i], b = points[i + 1], side = new THREE.Vector3(b.z - a.z, 0, a.x - b.x).normalize().multiplyScalar(.35);
        for (const p of [a.clone().add(side), b.clone().add(side), b.clone().sub(side), a.clone().add(side), b.clone().sub(side), a.clone().sub(side)]) positions.push(p.x, .035, p.z);
      }
      const g = geo(new THREE.BufferGeometry()); g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3)); g.computeVertexNormals();
      const road = mesh(routes, g, m.path); road.material.side = THREE.DoubleSide;
    });
  }
  function layout() {
    const positions: Record<string, [number, number]> = portrait ? {
      "第一校區": [-3.45, -7.6], "燕巢校區": [3.45, -4.1], "楠梓校區": [-3.45, -.3], "建工校區": [3.45, 4.0], "旗津校區": [-2.2, 9.0],
    } : compactLandscape ? {
      "第一校區": [-6.2, -3.6], "燕巢校區": [6.2, -3.6], "楠梓校區": [-7.0, 2.3], "建工校區": [7.0, 2.3], "旗津校區": [0, 6.7],
    } : {
      "第一校區": [-4.55, -5.6], "燕巢校區": [4.6, -5.1], "楠梓校區": [-7.0, 1.4], "建工校區": [5.9, 2.6], "旗津校區": [-2.0, 7.8],
    };
    campusGroups.forEach((group, name) => { const [x, z] = positions[name]; group.position.set(x, 0, z); });
    rebuildRoutes(); renderer.shadowMap.needsUpdate = true;
  }
  function fit() {
    camera.zoom = 1;
    controls.target.set(0, 0, portrait ? 1.5 : .25);
    camera.position.copy(controls.target).add(new THREE.Vector3(0, portrait ? 34 : 29, portrait ? 24 : 27));
    camera.lookAt(controls.target); scene.updateMatrixWorld(true); camera.updateMatrixWorld(true);
    const box = new THREE.Box3(); campusGroups.forEach(group => box.expandByObject(group));
    box.max.y += compactLandscape ? .6 : 1.6;
    const cameraBox = box.clone().applyMatrix4(camera.matrixWorldInverse), size = cameraBox.getSize(new THREE.Vector3());
    const center = cameraBox.getCenter(new THREE.Vector3());
    const viewHeight = Math.max(size.y * 1.08, (size.x + (portrait ? 1.4 : 2)) / (width / height));
    camera.top = center.y + viewHeight / 2; camera.bottom = center.y - viewHeight / 2;
    camera.right = center.x + viewHeight * width / height / 2; camera.left = center.x - viewHeight * width / height / 2;
    camera.updateProjectionMatrix(); controls.update(); controls.saveState();
    invalidate();
  }
  function projectLabels() {
    campusGroups.forEach((group, name) => {
      const label = labels.get(name); if (!label) return;
      screen.set(0, 2.9, .4).applyMatrix4(group.matrixWorld).project(camera);
      const x = (screen.x * .5 + .5) * width, y = (-screen.y * .5 + .5) * height;
      const halfWidth = label.offsetWidth / 2, labelHeight = label.offsetHeight;
      label.style.left = `${THREE.MathUtils.clamp(x, halfWidth + 10, width - halfWidth - 10)}px`;
      label.style.top = `${THREE.MathUtils.clamp(y, labelHeight + 8, height - 38)}px`;
      label.style.visibility = camera.zoom > 1.05 && (x < halfWidth || x > width - halfWidth || y < labelHeight || y > height) ? "hidden" : "visible";
      label.dataset.projected = "true";
    });
  }
  function invalidate() { if (!disposed && !document.hidden && !frame && !drawing) frame = requestAnimationFrame(render); }
  function render() {
    frame = 0; drawing = true;
    const moved = controls.update();
    const oldTarget = controls.target.clone();
    controls.target.clamp(new THREE.Vector3(-3, 0, -2), new THREE.Vector3(3, 0, 5)); camera.position.add(controls.target.clone().sub(oldTarget));
    renderer.render(scene, camera); projectLabels();
    renderer.domElement.dataset.triangles = String(renderer.info.render.triangles);
    renderer.domElement.dataset.drawCalls = String(renderer.info.render.calls);
    renderer.domElement.dataset.layout = portrait ? "portrait" : "landscape";
    renderer.domElement.dataset.zoom = camera.zoom.toFixed(2);
    drawing = false; if (moved) invalidate();
  }
  function resize() {
    const w = host.clientWidth, h = host.clientHeight; if (!w || !h || (w === width && h === height)) return;
    width = w; height = h; renderer.setSize(w, h);
    const nextPortrait = w < 700 && h > w;
    const nextCompact = w > h && h < 450;
    if (nextPortrait !== portrait || nextCompact !== compactLandscape) { portrait = nextPortrait; compactLandscape = nextCompact; layout(); }
    fit();
  }
  function hit(event: PointerEvent) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    return (raycaster.intersectObjects(pickTargets, false)[0]?.object.userData.campus as string | undefined) ?? null;
  }
  function hover(name: string | null) {
    if (name === activeHover) return; activeHover = name;
    renderer.domElement.style.cursor = name ? "pointer" : "grab"; callbacks.onHover(name);
  }
  function pointerDown(event: PointerEvent) {
    activePointers.add(event.pointerId);
    if (activePointers.size > 1) { if (down) down.moved = true; return; }
    if (event.button === 0) down = { x: event.clientX, y: event.clientY, id: event.pointerId, moved: false };
  }
  function pointerMove(event: PointerEvent) {
    if (down && Math.hypot(event.clientX - down.x, event.clientY - down.y) > 7) down.moved = true;
    if (!activePointers.size && event.pointerType !== "touch") hover(hit(event));
  }
  function pointerUp(event: PointerEvent) {
    activePointers.delete(event.pointerId);
    if (down?.id !== event.pointerId) return;
    const clicked = !down.moved; down = null;
    if (clicked) { const name = hit(event); if (name) callbacks.onSelect(name); }
  }
  function cancelPointer() { activePointers.clear(); down = null; hover(null); }
  function visibility() { if (document.hidden) { cancelAnimationFrame(frame); frame = 0; cancelPointer(); } else invalidate(); }
  function zoom(factor: number) { camera.zoom = THREE.MathUtils.clamp(camera.zoom * factor, controls.minZoom, controls.maxZoom); camera.updateProjectionMatrix(); invalidate(); }
  function reset() { controls.reset(); fit(); hover(null); }
  const observer = new ResizeObserver(resize); observer.observe(host);
  controls.addEventListener("change", invalidate);
  renderer.domElement.addEventListener("pointerdown", pointerDown);
  renderer.domElement.addEventListener("pointermove", pointerMove);
  renderer.domElement.addEventListener("pointerup", pointerUp);
  renderer.domElement.addEventListener("pointercancel", cancelPointer);
  const pointerLeave = () => hover(null);
  renderer.domElement.addEventListener("pointerleave", pointerLeave);
  document.addEventListener("visibilitychange", visibility); window.addEventListener("blur", cancelPointer);
  resize();
  function dispose() {
    disposed = true; cancelAnimationFrame(frame); observer.disconnect(); controls.removeEventListener("change", invalidate); controls.dispose();
    renderer.domElement.removeEventListener("pointerdown", pointerDown); renderer.domElement.removeEventListener("pointermove", pointerMove);
    renderer.domElement.removeEventListener("pointerup", pointerUp); renderer.domElement.removeEventListener("pointercancel", cancelPointer);
    renderer.domElement.removeEventListener("pointerleave", pointerLeave);
    document.removeEventListener("visibilitychange", visibility); window.removeEventListener("blur", cancelPointer);
    scene.traverse(object => { if (object instanceof THREE.InstancedMesh) object.dispose(); });
    geometries.forEach(g => g.dispose()); materials.forEach(material => material.dispose()); toonRamp.dispose(); sun.shadow.dispose();
    renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove(); scene.clear();
  }
  return { dispose, zoom, reset };
}
