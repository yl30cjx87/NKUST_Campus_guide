import * as THREE from "three";
import { HARBOR_WATER_LEVEL, sampleHarborWave } from "./harbor-waves.mjs";

type V3 = [number, number, number];
type Batch = { geometry: THREE.BufferGeometry; material: THREE.Material; nodes: THREE.Object3D[]; colors: number[]; shadow: boolean; mesh?: THREE.InstancedMesh };
type Route = { points: THREE.Vector3[]; lengths: number[]; length: number };

// 港邊生活層只使用共用幾何、簡單路徑與一批程序波紋，不建立額外動畫迴圈。
export function createCijinShoreLife(parent: THREE.Group, boats: THREE.Group[], compact: boolean) {
  const group = new THREE.Group(); group.name = "Cijin day-night shore life"; parent.add(group);
  const rig = new THREE.Group(), batches = new Map<string, Batch>();
  const cube = new THREE.BoxGeometry(1, 1, 1), sphere = new THREE.SphereGeometry(1, 9, 6);
  const cylinder = new THREE.CylinderGeometry(1, 1, 1, 8), ring = new THREE.TorusGeometry(1, .11, 4, 12);
  const solid = new THREE.MeshToonMaterial({ color: 0xffffff });
  const lamp = new THREE.MeshStandardMaterial({ color: 0xffe0aa, emissive: 0xffc36e, emissiveIntensity: 0, roughness: .55 });
  const geometries: THREE.BufferGeometry[] = [cube, sphere, cylinder, ring], materials: THREE.Material[] = [solid, lamp];
  const skin = 0xc99675, dark = 0x2d3b43, cream = 0xe9e4d7, workerOrange = 0xd77a45;
  function joint(parentNode: THREE.Object3D, position: V3 = [0, 0, 0]) { const node = new THREE.Group(); node.position.set(...position); parentNode.add(node); return node; }
  function part(parentNode: THREE.Object3D, geometry: THREE.BufferGeometry, color: number, position: V3, scale: V3, rotation: V3 = [0, 0, 0], material = solid, shadow = true) {
    const node = new THREE.Object3D(); node.position.set(...position); node.scale.set(...scale); node.rotation.set(...rotation); parentNode.add(node);
    const key = `${geometry.uuid}:${material.uuid}:${shadow}`;
    if (!batches.has(key)) batches.set(key, { geometry, material, shadow, nodes: [], colors: [] });
    const batch = batches.get(key)!; batch.nodes.push(node); batch.colors.push(color); return node;
  }
  const box = (p: THREE.Object3D, color: number, position: V3, scale: V3, rotation: V3 = [0, 0, 0], shadow = true) => part(p, cube, color, position, scale, rotation, solid, shadow);
  function makeStudent(shirt: number, trousers: number, backpack: boolean) {
    const root = joint(rig), limbs: THREE.Group[] = [];
    box(root, shirt, [0, .42, 0], [.21, .25, .13]);
    if (backpack) box(root, 0x40535e, [0, .43, -.105], [.16, .2, .08]);
    part(root, sphere, skin, [0, .64, 0], [.082, .1, .08]);
    part(root, sphere, 0x34332f, [0, .695, -.005], [.086, .06, .085]);
    for (const side of [-1, 1]) {
      const leg = joint(root, [side * .063, .3, 0]); limbs.push(leg); box(leg, trousers, [0, -.12, 0], [.068, .24, .075]); box(leg, cream, [0, -.275, .03], [.08, .06, .14]);
      const arm = joint(root, [side * .14, .49, 0]); limbs.push(arm); box(arm, shirt, [0, -.06, 0], [.064, .12, .075]); part(arm, cylinder, skin, [0, -.15, 0], [.026, .08, .026]);
    }
    return { root, limbs };
  }
  const students = [
    makeStudent(0x5685a0, dark, true), makeStudent(0xb85e51, 0x424b52, true),
    makeStudent(0xd2b66b, 0x4d5656, true), makeStudent(0x708c6e, 0x414c52, false),
  ];
  const worker = makeStudent(workerOrange, dark, false);
  box(worker.root, 0xf0ca4f, [0, .53, .066], [.22, .055, .135]);

  function createRod(studentIndex: number, side: number) {
    const student = students[studentIndex], root = joint(student.root, [side * .14, .52, .03]);
    const arm = student.limbs[side > 0 ? 3 : 1];
    part(root, cylinder, 0x4e4034, [0, .56, 0], [.018, 1.12, .018], [0, 0, 0], solid, false);
    const bucket = joint(student.root, [-side * .3, .14, -.02]);
    part(bucket, cylinder, 0x75939a, [0, .1, 0], [.12, .2, .12], [0, 0, 0], solid, false);
    return { root, arm, bucket, side, studentIndex };
  }
  const rods = [createRod(0, 1), createRod(1, -1)];
  const fishRoot = joint(rig); part(fishRoot, sphere, 0x6f9c9d, [0, 0, 0], [.13, .065, .045], [0, 0, Math.PI / 2], solid, false);
  box(fishRoot, 0xd79852, [0, 0, -.09], [.1, .012, .11], [0, Math.PI / 4, 0], false);
  const droplets = Array.from({ length: 3 }, (_, i) => { const root = joint(rig); part(root, sphere, 0xd8f0ed, [0, 0, 0], [.024 + i * .006, .032 + i * .008, .024 + i * .006], [0, 0, 0], solid, false); return root; });

  function createServiceCart() {
    const root = joint(rig); root.name = "moving harbor service cart";
    part(root, cube, 0xe3e6dd, [0, .23, 0], [.82, .25, .42]);
    part(root, cube, 0x506a73, [-.08, .4, 0], [.42, .22, .37]);
    box(root, workerOrange, [0, .29, .214], [.66, .07, .014]);
    for (const x of [-.27, .27]) for (const z of [-.22, .22]) part(root, cylinder, dark, [x, .105, z], [.1, .065, .1], [Math.PI / 2, 0, 0]);
    for (const z of [-.13, .13]) part(root, sphere, 0xffffff, [.42, .25, z], [.045, .045, .025], [0, 0, 0], lamp, false);
    box(root, 0xa34b3e, [-.42, .24, 0], [.018, .06, .2], [0, 0, 0], false);
    return root;
  }
  const vehicle = createServiceCart();
  const scooter = joint(rig, [8.25, .34, 2.28]); scooter.rotation.y = Math.PI / 2;
  for (const x of [-.2, .2]) part(scooter, cylinder, dark, [x, .1, 0], [.095, .055, .095], [Math.PI / 2, 0, 0]);
  box(scooter, 0xa85648, [0, .23, 0], [.34, .17, .17]); box(scooter, dark, [-.08, .35, 0], [.24, .055, .19]);

  for (const batch of batches.values()) {
    const mesh = new THREE.InstancedMesh(batch.geometry, batch.material, batch.nodes.length);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); batch.colors.forEach((color, i) => mesh.setColorAt(i, new THREE.Color(color)));
    mesh.castShadow = batch.shadow; mesh.receiveShadow = true; mesh.frustumCulled = false; batch.mesh = mesh; group.add(mesh);
  }

  const lineGeometry = new THREE.BufferGeometry(), linePositions = new Float32Array(12);
  lineGeometry.setAttribute("position", new THREE.BufferAttribute(linePositions, 3).setUsage(THREE.DynamicDrawUsage)); geometries.push(lineGeometry);
  const lineMaterial = new THREE.LineBasicMaterial({ color: 0x3d4544, transparent: true, opacity: .78 }); materials.push(lineMaterial);
  const fishingLines = new THREE.LineSegments(lineGeometry, lineMaterial); fishingLines.frustumCulled = false; group.add(fishingLines);
  const bobbers = new THREE.InstancedMesh(sphere, solid, 2); bobbers.instanceMatrix.setUsage(THREE.DynamicDrawUsage); bobbers.frustumCulled = false;
  bobbers.setColorAt(0, new THREE.Color(0xef6d51)); bobbers.setColorAt(1, new THREE.Color(0xf0d04f)); group.add(bobbers);

  const rippleGeometry = new THREE.RingGeometry(.82, 1, 24); geometries.push(rippleGeometry);
  const rippleUniforms = { night: { value: 0 } };
  const rippleMaterial = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, uniforms: rippleUniforms,
    vertexShader: `varying vec3 tint;void main(){tint=instanceColor;gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);}`,
    fragmentShader: `uniform float night;varying vec3 tint;void main(){vec3 day=vec3(.75,.91,.88),dark=vec3(.28,.5,.57);gl_FragColor=vec4(mix(day,dark,night),tint.r);}`,
  }); materials.push(rippleMaterial);
  const rippleCount = compact ? 9 : 12, ripples = new THREE.InstancedMesh(rippleGeometry, rippleMaterial, rippleCount);
  ripples.instanceMatrix.setUsage(THREE.DynamicDrawUsage); ripples.frustumCulled = false; group.add(ripples);
  const rippleDummy = new THREE.Object3D(), bobberDummy = new THREE.Object3D(), wave = { height: 0, dx: 0, dz: 0 };

  const route = (points: V3[]): Route => {
    const vectors = points.map(p => new THREE.Vector3(...p)), lengths = [0];
    for (let i = 1; i < vectors.length; i++) lengths.push(lengths.at(-1)! + vectors[i].distanceTo(vectors[i - 1]));
    return { points: vectors, lengths, length: lengths.at(-1)! };
  };
  const dayStarts: V3[] = [[-7.4, .36, 2.35], [-4.5, .36, 1.35], [4.9, .36, 2.25], [7.6, .36, 1.35]];
  const dayRoutes = dayStarts.map((start, i) => route([start, [start[0] * .55, .36, 1.35 + i * .08], [-1.4 + i * .35, .34, 1.05], [-.65, .31, .5], [-.65, .32, -.28]]));
  const nightDestinations: V3[] = [[.65, .36, 3.25], [6.05, .36, 3.24], [-3.2, .36, 2.48], [3.15, .36, 3.12]];
  const nightRoutes = nightDestinations.map((end, i) => route([[-.65, .32, -.28], [-.65, .33, .65], [-1.25 + i * .62, .36, 1.35], [end[0] * .62, .36, 2.35], end]));
  function moveOnRoute(root: THREE.Object3D, path: Route, progress: number) {
    const distance = THREE.MathUtils.clamp(progress, 0, 1) * path.length;
    let segment = 1; while (segment < path.lengths.length - 1 && path.lengths[segment] < distance) segment++;
    const a = path.points[segment - 1], b = path.points[segment], span = path.lengths[segment] - path.lengths[segment - 1];
    root.position.lerpVectors(a, b, span ? (distance - path.lengths[segment - 1]) / span : 0);
    root.rotation.y = Math.atan2(b.x - a.x, b.z - a.z);
  }

  let scenarioNight = false, modeStartedAt = 0, lastSeconds = 0, disposed = false;
  const primaryBobber = new THREE.Vector3(), secondaryBobber = new THREE.Vector3(), rodTip = new THREE.Vector3(), bucketPoint = new THREE.Vector3();
  function setScenario(night: boolean) { scenarioNight = night; modeStartedAt = lastSeconds; }
  function setNight(value: number) { rippleUniforms.night.value = value; lamp.emissiveIntensity = value * 1.25; }
  function updateFishing(elapsed: number, waveScale: number) {
    fishingLines.visible = bobbers.visible = scenarioNight && elapsed >= 8.1;
    const fishingStarts = [8.1, 8.8], targets = [primaryBobber, secondaryBobber];
    rods.forEach((rod, index) => {
      const active = scenarioNight && elapsed >= fishingStarts[index];
      rod.root.scale.setScalar(active ? 1 : .001); rod.bucket.scale.setScalar(active ? 1 : .001);
      if (!active) return;
      const cycle = (elapsed - fishingStarts[index]) % (index ? 12 : 10);
      let angle = .78 + Math.sin(cycle * .55) * .025;
      const target = targets[index].set(index ? 6.05 : .65, HARBOR_WATER_LEVEL, index ? 4.16 : 4.2);
      sampleHarborWave(target.x, target.z, lastSeconds, wave); target.y += wave.height * waveScale + .035;
      if (index === 0) {
        if (cycle < 1) angle = THREE.MathUtils.lerp(.32, .78, cycle);
        else if (cycle >= 5 && cycle < 5.65) target.y -= Math.sin((cycle - 5) / .65 * Math.PI) * .075;
        else if (cycle >= 5.65 && cycle < 7.2) angle = THREE.MathUtils.lerp(.78, .3, (cycle - 5.65) / 1.55);
        else if (cycle >= 7.2 && cycle < 8.2) angle = .3;
      }
      rod.root.rotation.x = angle; rod.arm.rotation.x = -angle * .32;
      students[index].root.updateMatrixWorld(true); rod.root.updateMatrixWorld(true);
      rodTip.set(0, 1.12, 0).applyMatrix4(rod.root.matrixWorld);
      if (index === 0 && cycle >= 5.65 && cycle < 7.2) target.lerpVectors(target, rodTip.clone().add(new THREE.Vector3(0, -.22, 0)), (cycle - 5.65) / 1.55);
      if (index === 0 && cycle >= 7.2 && cycle < 8.2) {
        bucketPoint.copy(students[0].root.position).add(new THREE.Vector3(-.3, .3, -.02)); target.lerpVectors(rodTip.clone().add(new THREE.Vector3(0, -.22, 0)), bucketPoint, (cycle - 7.2));
      }
      const offset = index * 6; linePositions.set([rodTip.x, rodTip.y, rodTip.z, target.x, target.y, target.z], offset);
      bobberDummy.position.copy(target); bobberDummy.scale.set(.045, .055, .045); bobberDummy.updateMatrix(); bobbers.setMatrixAt(index, bobberDummy.matrix);
      if (index === 0 && cycle >= 5.65 && cycle < 8.2) { fishRoot.position.copy(target).add(new THREE.Vector3(0, -.11, 0)); fishRoot.rotation.z = Math.sin(cycle * 8) * .35; fishRoot.scale.setScalar(1); }
    });
    if (!scenarioNight || elapsed < 8.1 || (elapsed - 8.1) % 10 < 5.65 || (elapsed - 8.1) % 10 >= 8.2) fishRoot.scale.setScalar(.001);
    lineGeometry.attributes.position.needsUpdate = true; bobbers.instanceMatrix.needsUpdate = true;
  }
  function updateRipples(seconds: number, elapsed: number, waveScale: number) {
    const shore: V3[] = [[-8, 0, 3.78], [-4.5, 0, 3.76], [0, 0, 3.77], [4.4, 0, 3.76], [8, 0, 3.78]];
    for (let i = 0; i < rippleCount; i++) {
      let x = 0, z = 4, phase = (seconds * .24 + i * .17) % 1, alpha = (1 - phase) * .18, radius = .28 + phase * .75;
      if (i < 5) { [x, , z] = shore[i]; radius *= 1.25; }
      else if (i < 7) { const boat = boats[i === 5 ? 0 : 3]; x = boat.position.x; z = boat.position.z; radius *= 1.35; alpha *= .85; }
      else if (i < 9) { const p = i === 7 ? primaryBobber : secondaryBobber; x = p.x; z = p.z; radius *= .5; alpha *= scenarioNight ? .8 : 0; }
      else { x = .65; z = 4.2; const splash = scenarioNight ? (elapsed - 8.1) % 10 : 0; phase = THREE.MathUtils.clamp((splash - 5.55) / .8, 0, 1); radius = .16 + phase * .65; alpha = splash >= 5.55 && splash < 6.35 ? (1 - phase) * .42 : 0; }
      sampleHarborWave(x, z, seconds, wave); rippleDummy.position.set(x, HARBOR_WATER_LEVEL + wave.height * waveScale + .018, z); rippleDummy.rotation.set(-Math.PI / 2, 0, 0); rippleDummy.scale.setScalar(radius); rippleDummy.updateMatrix();
      ripples.setMatrixAt(i, rippleDummy.matrix); ripples.setColorAt(i, new THREE.Color(alpha, 0, 0));
    }
    ripples.instanceMatrix.needsUpdate = true; if (ripples.instanceColor) ripples.instanceColor.needsUpdate = true;
  }
  function update(seconds: number, waveScale = 1) {
    if (disposed) return false; lastSeconds = seconds; const elapsed = Math.max(0, seconds - modeStartedAt);
    students.forEach((student, i) => {
      if (!scenarioNight) {
        const start = i * .48, duration = 5.55; moveOnRoute(student.root, dayRoutes[i], (elapsed - start) / duration);
        student.root.scale.setScalar(elapsed < start || elapsed > start + duration + .25 ? .001 : 1);
      } else {
        const start = 1.65 + i * .38, duration = i < 2 ? 5.85 : 5.1; moveOnRoute(student.root, nightRoutes[i], (elapsed - start) / duration);
        student.root.scale.setScalar(elapsed < start ? .001 : 1);
      }
      const walking = student.root.scale.x > .5 && (!scenarioNight ? elapsed < i * .48 + 5.55 : elapsed < 1.65 + i * .38 + (i < 2 ? 5.85 : 5.1));
      const swing = walking ? Math.sin(seconds * 6 + i) * .43 : 0; student.limbs.forEach((limb, j) => { limb.rotation.x = (j === 0 || j === 3 ? 1 : -1) * swing; });
    });
    const workerProgress = (1 - Math.cos(seconds * .18)) / 2; worker.root.position.set(THREE.MathUtils.lerp(-8.1, -3.2, workerProgress), .36, 2.45); worker.root.rotation.y = Math.sin(seconds * .18) >= 0 ? Math.PI / 2 : -Math.PI / 2;
    const workerSwing = Math.sin(seconds * 5.4) * .38; worker.limbs.forEach((limb, i) => { limb.rotation.x = (i === 0 || i === 3 ? 1 : -1) * workerSwing; });
    const theta = seconds * .13; vehicle.position.set(Math.sin(theta) * 6.25, .22, 1.68 + Math.cos(theta) * .24); vehicle.rotation.y = Math.atan2(Math.sin(theta) * .24, Math.cos(theta) * 6.25);
    updateFishing(elapsed, waveScale);
    const splashCycle = scenarioNight ? (elapsed - 8.1) % 10 : -1;
    droplets.forEach((drop, i) => {
      if (splashCycle >= 5.55 && splashCycle < 6.25) { const t = (splashCycle - 5.55) / .7; drop.position.set(.65 + (i - 1) * .075 * t, HARBOR_WATER_LEVEL + Math.sin(t * Math.PI) * (.13 + i * .03), 4.2 + (i % 2 ? .04 : -.03) * t); drop.scale.setScalar(1 - t); }
      else drop.scale.setScalar(.001);
    });
    updateRipples(seconds, elapsed, waveScale);
    rig.updateMatrixWorld(true); batches.forEach(batch => { batch.nodes.forEach((node, i) => batch.mesh!.setMatrixAt(i, node.matrixWorld)); batch.mesh!.instanceMatrix.needsUpdate = true; });
    return true;
  }
  setScenario(false); setNight(0); update(0, 1);
  function dispose() {
    if (disposed) return; disposed = true; group.removeFromParent(); batches.forEach(batch => batch.mesh!.dispose()); bobbers.dispose(); ripples.dispose(); geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); group.clear(); rig.clear();
  }
  return { group, students, worker: worker.root, vehicle, scooter, rods, fish: fishRoot, droplets, bobbers, fishingLines, ripples, rippleCount, setScenario, setNight, update, dispose, get scenario() { return scenarioNight ? "night" : "day"; }, get elapsed() { return Math.max(0, lastSeconds - modeStartedAt); } };
}
