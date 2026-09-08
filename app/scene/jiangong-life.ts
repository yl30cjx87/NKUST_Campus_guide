import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { sampleGateTraffic, trafficDuration, trafficVehicle } from "./jiangong-traffic.mjs";

type V3 = [number, number, number];
type Batch = { geometry: THREE.BufferGeometry; material: THREE.Material; nodes: THREE.Object3D[]; colors: number[]; shadow: boolean; mesh?: THREE.InstancedMesh };

// 附加生活層不修改建築。人物骨架只更新共用批次矩陣，不建立蒙皮或外部模型。
export function createJiangongLife(compact: boolean, reducedMotion = false) {
  const group = new THREE.Group(); group.name = "Jiangong campus daily life";
  const rig = new THREE.Group(), batches = new Map<string, Batch>();
  const cube = new THREE.BoxGeometry(1, 1, 1), sphere = new THREE.SphereGeometry(1, 10, 7);
  const rounded = new RoundedBoxGeometry(1, 1, 1, 1, .09);
  const cylinder = new THREE.CylinderGeometry(1, 1, 1, 10), ring = new THREE.TorusGeometry(1, .1, 5, 16);
  const solid = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .75 });
  const lamp = new THREE.MeshStandardMaterial({ color: 0xffe2b4, emissive: 0xffd19a, emissiveIntensity: 0, roughness: .5 });
  const glass = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .3, metalness: .15 });
  const geometries: THREE.BufferGeometry[] = [cube, rounded, sphere, cylinder, ring], materials: THREE.Material[] = [solid, lamp, glass];
  const skin = 0xc99776, dark = 0x33424b, cream = 0xe5e3d5;
  function part(parent: THREE.Object3D, g: THREE.BufferGeometry, color: number, p: V3, scale: V3, rotation: V3 = [0, 0, 0], material = solid, shadow = true) {
    const node = new THREE.Object3D(); node.position.set(...p); node.scale.set(...scale); node.rotation.set(...rotation); parent.add(node);
    const key = `${g.uuid}:${material.uuid}:${shadow}`;
    if (!batches.has(key)) batches.set(key, { geometry: g, material, shadow, nodes: [], colors: [] });
    const batch = batches.get(key)!; batch.nodes.push(node); batch.colors.push(color); return node;
  }
  const box = (parent: THREE.Object3D, color: number, p: V3, scale: V3, r: V3 = [0, 0, 0]) => part(parent, cube, color, p, scale, r);
  function joint(parent: THREE.Object3D, p: V3) { const node = new THREE.Group(); node.position.set(...p); parent.add(node); return node; }
  function student(shirt: number, trousers: number, tone: number) {
    const root = joint(rig, [0, 0, 0]), limbs: THREE.Group[] = [];
    box(root, shirt, [0, .415, 0], [.2, .23, .125]);
    box(root, dark, [0, .42, -.087], [.15, .18, .075]);
    part(root, sphere, tone, [0, .62, 0], [.079, .098, .077]);
    part(root, sphere, 0x35342f, [0, .672, -.006], [.083, .057, .082]);
    for (const side of [-1, 1]) {
      const leg = joint(root, [side * .059, .31, 0]); limbs.push(leg);
      box(leg, trousers, [0, -.126, 0], [.065, .252, .07]); box(leg, cream, [0, -.282, .028], [.079, .055, .13]);
      const arm = joint(root, [side * .133, .485, 0]); limbs.push(arm);
      box(arm, shirt, [0, -.053, 0], [.066, .11, .078]);
      part(arm, cylinder, tone, [0, -.143, 0], [.025, .09, .025]);
    }
    return { root, limbs };
  }
  const students = [student(0xb75d49, dark, skin), student(0x527c9a, 0x414c55, 0xb38361), student(0xd5bd72, 0x505555, 0xe0b592)];
  function scooter(color: number, rider: boolean) {
    const root = joint(rig, [0, 0, 0]);
    for (const z of [-.235, .235]) {
      part(root, cylinder, 0x293239, [0, .105, z], [.102, .065, .102], [0, 0, Math.PI / 2]);
      part(root, cylinder, 0x96a3a5, [0, .105, z], [.046, .072, .046], [0, 0, Math.PI / 2]);
    }
    box(root, color, [0, .23, -.13], [.19, .21, .28]);
    box(root, dark, [0, .352, -.1], [.21, .06, .27]);
    box(root, color, [0, .3, .235], [.185, .29, .085], [-.13, 0, 0]);
    box(root, dark, [0, .17, .075], [.17, .045, .24]);
    box(root, 0x9ba8a9, [0, .462, .21], [.29, .026, .026]);
    part(root, sphere, 0xffffff, [0, .397, .292], [.057, .044, .025], [0, 0, 0], lamp, false);
    box(root, 0xa24d3e, [0, .25, -.282], [.105, .045, .015]);
    if (rider) {
      box(root, 0x506d7c, [0, .506, -.048], [.19, .255, .13], [.1, 0, 0]);
      part(root, sphere, skin, [0, .7, -.016], [.077, .09, .078]);
      part(root, sphere, 0xbfd6ce, [0, .743, -.025], [.089, .065, .088]);
      for (const side of [-1, 1]) {
        box(root, dark, [side * .08, .295, .05], [.06, .22, .075], [.2, 0, 0]);
        box(root, 0x506d7c, [side * .115, .486, .09], [.055, .065, .22], [.2, 0, 0]);
      }
    }
    return root;
  }
  function serviceCar() {
    const root = joint(rig, [0, 0, 0]); root.name = "Campus service car";
    const wheels: THREE.Group[] = [], steering: THREE.Group[] = [];
    part(root, rounded, 0xe3e7df, [0, .225, 0], [.392, .235, .82]);
    part(root, rounded, 0x49636a, [0, .406, -.07], [.346, .235, .46], [0, 0, 0], glass);
    part(root, rounded, 0xf0f0e6, [0, .53, -.07], [.364, .045, .48]);
    box(root, 0xe3e7df, [0, .35, .265], [.35, .035, .23]);
    for (const side of [-1, 1]) {
      box(root, 0x487f85, [side * .198, .26, 0], [.008, .065, .66]);
      box(root, cream, [side * .174, .41, -.07], [.018, .22, .029]);
      box(root, cream, [side * .168, .41, .139], [.018, .22, .026]);
      box(root, dark, [side * .199, .36, .16], [.019, .045, .065]);
      part(root, cube, 0xffffff, [side * .124, .28, .414], [.075, .058, .018], [0, 0, 0], lamp, false);
      box(root, 0xa64839, [side * .13, .28, -.414], [.06, .06, .018]);
      for (const z of [-trafficVehicle.wheelBase / 2, trafficVehicle.wheelBase / 2]) {
        const axle = joint(root, [side * .18, trafficVehicle.wheelRadius, z]);
        if (z > 0) steering.push(axle);
        const wheel = joint(axle, [0, 0, 0]); wheels.push(wheel);
        part(wheel, cylinder, 0x273138, [0, 0, 0], [trafficVehicle.wheelRadius, .05, trafficVehicle.wheelRadius], [0, 0, Math.PI / 2]);
        part(wheel, cylinder, 0xa4afb1, [side * .026, 0, 0], [.047, .006, .047], [0, 0, Math.PI / 2]);
        box(wheel, dark, [side * .03, 0, 0], [.008, .013, .075]);
      }
    }
    for (const z of [-.427, .427]) box(root, dark, [0, .17, z], [.355, .035, .021]);
    box(root, 0xb7c6c8, [0, .248, .418], [.09, .035, .01]);
    return { root, wheels, steering };
  }
  const car = serviceCar(), vehicle = car.root, parked = scooter(0xab6255, false);
  parked.position.set(6.75, .167, 4.16); parked.rotation.set(0, Math.PI / 2, -.08);
  const bicycle = joint(rig, [4.75, .165, 4.12]); bicycle.rotation.y = Math.PI / 2;
  for (const z of [-.265, .265]) {
    part(bicycle, ring, dark, [0, .15, z], [.14, .14, .14], [0, Math.PI / 2, 0], solid, false);
    box(bicycle, 0xa1b0ae, [0, .15, z], [.018, .265, .009]);
  }
  function tube(a: V3, b: V3, color: number) {
    const from = new THREE.Vector3(...a), to = new THREE.Vector3(...b), delta = to.sub(from);
    const node = part(bicycle, cylinder, color, from.addScaledVector(delta, .5).toArray() as V3, [.014, delta.length(), .014], [0, 0, 0], solid, false);
    node.quaternion.setFromUnitVectors(THREE.Object3D.DEFAULT_UP, delta.normalize());
  }
  for (const [a, b] of [[[-.015, .15, -.265], [0, .36, -.07]], [[0, .36, -.07], [0, .14, 0]], [[0, .14, 0], [0, .15, -.265]], [[0, .36, -.07], [0, .4, .19]], [[0, .4, .19], [0, .14, 0]], [[0, .46, .18], [0, .15, .265]]] as [V3, V3][]) tube(a, b, 0x60898c);
  box(bicycle, dark, [0, .394, -.074], [.09, .025, .14]); box(bicycle, dark, [0, .46, .18], [.24, .022, .026]);

  for (const batch of batches.values()) {
    const mesh = new THREE.InstancedMesh(batch.geometry, batch.material, batch.nodes.length);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); batch.colors.forEach((color, i) => mesh.setColorAt(i, new THREE.Color(color)));
    mesh.castShadow = batch.shadow; mesh.receiveShadow = true; mesh.frustumCulled = false;
    batch.mesh = mesh; group.add(mesh);
  }
  const anchors: V3[] = [[-7.68, 2.38, 4.25], [-2.28, 2.38, -.65], [3.87, 2.38, 3.95], [5.97, 2.38, -.8], [0, 1.47, .77], [0, 1.2, -3.15], [-6.25, .26, 3.95], [-4.8, .26, 3.95], [-3.3, .26, 3.95], [-.625, .29, 3.62], [.625, .29, 3.62]];
  const uniforms = { night: { value: 0 }, time: { value: 0 }, pixelRatio: { value: 1 } };
  // 光暈只圍繞實際燈具，沒有新光源、Bloom 或體積光。
  const haloGeometry = new THREE.PlaneGeometry(1, 1); geometries.push(haloGeometry);
  const haloMaterial = new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `varying vec2 vUv; void main(){vUv=uv;vec4 p=modelViewMatrix*instanceMatrix*vec4(0.,0.,0.,1.);p.xy+=position.xy*length(instanceMatrix[0].xyz);gl_Position=projectionMatrix*p;}`,
    fragmentShader: `uniform float night;varying vec2 vUv;void main(){float d=length(vUv-.5)*2.;float a=exp(-d*d*5.)*(1.-smoothstep(.55,1.,d));gl_FragColor=vec4(1.,.74,.4,a*night*.12);}`,
  }); materials.push(haloMaterial);
  const halos = new THREE.InstancedMesh(haloGeometry, haloMaterial, anchors.length), dummy = new THREE.Object3D();
  anchors.forEach((p, i) => { dummy.position.set(...p); dummy.scale.setScalar(i < 6 ? .44 : .22); dummy.updateMatrix(); halos.setMatrixAt(i, dummy.matrix); });
  halos.frustumCulled = false; group.add(halos);
  const particleCount = compact ? 12 : 22, pointsGeometry = new THREE.BufferGeometry(); geometries.push(pointsGeometry);
  const positions = new Float32Array(particleCount * 3), phases = new Float32Array(particleCount);
  for (let i = 0; i < particleCount; i++) { positions.set(anchors[i % 6], i * 3); phases[i] = i * 2.399; }
  pointsGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3)); pointsGeometry.setAttribute("phase", new THREE.BufferAttribute(phases, 1));
  const particleMaterial = new THREE.ShaderMaterial({ uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `uniform float time,pixelRatio;attribute float phase;varying float fade;void main(){vec3 p=position+vec3(sin(time*.17+phase)*.2,-.25+sin(time*.12+phase*2.)*.24,cos(time*.14+phase)*.2);vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;gl_PointSize=clamp(42.*pixelRatio/max(1.,-mv.z),1.,3.);fade=.45+.3*sin(phase+time*.23);}`,
    fragmentShader: `uniform float night;varying float fade;void main(){float d=length(gl_PointCoord-.5)*2.;gl_FragColor=vec4(1.,.86,.65,(1.-smoothstep(.1,1.,d))*night*fade*.26);}`,
  }); materials.push(particleMaterial);
  const dust = new THREE.Points(pointsGeometry, particleMaterial); dust.frustumCulled = false; group.add(dust);
  let clock = 0, initialized = false, disposed = false;
  const traffic = sampleGateTraffic(0);
  const previousPosition = new THREE.Vector3();
  function update(delta: number, night: number, pixelRatio = 1) {
    if (disposed) return false;
    clock += reducedMotion ? 0 : Math.max(0, Math.min(delta, .1));
    sampleGateTraffic(clock, traffic);
    previousPosition.copy(vehicle.position); previousPosition.y = 0;
    const distance = initialized ? previousPosition.distanceTo(traffic.position) : 0;
    vehicle.position.copy(traffic.position); vehicle.position.y = .065;
    const heading = Math.atan2(traffic.tangent.x, traffic.tangent.z);
    const difference = Math.atan2(Math.sin(heading - vehicle.rotation.y), Math.cos(heading - vehicle.rotation.y));
    // 車身直接對齊平滑路徑切線；輪胎依實際位移滾動，停等時不空轉。
    vehicle.rotation.y = heading;
    car.wheels.forEach(wheel => { wheel.rotation.x += distance / trafficVehicle.wheelRadius; });
    const steeringAngle = distance > .00001 ? THREE.MathUtils.clamp(Math.atan(trafficVehicle.wheelBase * difference / distance), -.6, .6) : 0;
    car.steering.forEach(axle => { axle.rotation.y = THREE.MathUtils.damp(axle.rotation.y, steeringAngle, 12, Math.min(delta, .1)); });
    students.forEach(({ root, limbs }, i) => {
      const phase = clock * (i === 0 ? .18 : .13) + i * 1.9, progress = (1 - Math.cos(phase)) / 2;
      if (i === 0) root.position.set(-5.42 + .045 * Math.sin(phase), .065 + .1 * THREE.MathUtils.smoothstep(Math.abs(progress - .5), .37, .49), THREE.MathUtils.lerp(8.48, 4.52, progress));
      if (i === 1) root.position.set(-2.56 + .035 * Math.sin(phase * 2), .075, THREE.MathUtils.lerp(2.3, -.8, progress));
      if (i === 2) root.position.set(THREE.MathUtils.lerp(3.2, 6.2, progress), .167, 4.57 + .035 * Math.sin(phase * 2));
      const direction = i === 2 ? (Math.sin(phase) >= 0 ? Math.PI / 2 : -Math.PI / 2) : (Math.sin(phase) >= 0 ? Math.PI : 0);
      const turn = Math.atan2(Math.sin(direction - root.rotation.y), Math.cos(direction - root.rotation.y));
      root.rotation.y += initialized ? turn * (1 - Math.exp(-delta * 6)) : turn;
      const swing = Math.sin(clock * 5 + i) * .4 * Math.abs(Math.sin(phase));
      limbs.forEach((limb, index) => { limb.rotation.x = (index === 0 || index === 3 ? 1 : -1) * swing; });
    });
    if (!initialized || !reducedMotion && delta > 0) {
      rig.updateMatrixWorld(true);
      batches.forEach(batch => { batch.nodes.forEach((node, i) => batch.mesh!.setMatrixAt(i, node.matrixWorld)); batch.mesh!.instanceMatrix.needsUpdate = true; });
    }
    uniforms.night.value = night; uniforms.time.value = clock; uniforms.pixelRatio.value = pixelRatio;
    lamp.emissiveIntensity = night * .8; halos.visible = night > .01; dust.visible = night > .01 && !reducedMotion;
    initialized = true;
    return !reducedMotion && delta > 0;
  }
  update(0, 0);
  function dispose() {
    if (disposed) return; disposed = true;
    batches.forEach(batch => batch.mesh!.dispose()); halos.dispose(); geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); group.clear(); rig.clear();
  }
  return { group, traffic, students, vehicle, wheels: car.wheels, steering: car.steering, parked, bicycle, dust, halos, particleCount, duration: trafficDuration, moving: !reducedMotion, update, dispose, get time() { return clock; } };
}
