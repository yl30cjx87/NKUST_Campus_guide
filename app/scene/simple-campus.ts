import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { createSimpleCampusModel } from "./simple-campus-model";
import { createModelTurntable } from "./model-turntable.mjs";
import { createAutoNightSwitch } from "./auto-night.mjs";
import type { CampusScene, CampusSceneOptions } from "./campus-scene";

type CampusModel = ReturnType<typeof createSimpleCampusModel>;

// 楠梓、燕巢共用渲染器，但由各自的動態模組注入模型工廠，避免進入其中一校時下載另一校的模型。
export function createSimpleCampusScene(
  host: HTMLElement,
  name: string,
  options: CampusSceneOptions = {},
  createModel?: () => CampusModel,
): CampusScene {
  if (!createModel) throw new Error(`Missing model factory for ${name}`);
  const model = createModel(), { group, sceneObjects, mats } = model;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let renderer: THREE.WebGLRenderer;
  try { renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" }); }
  catch (error) { model.dispose(); throw error; }
  const scene = new THREE.Scene(); scene.add(group);
  const compact = window.matchMedia("(pointer: coarse)").matches || Math.min(host.clientWidth, host.clientHeight) < 500;
  const yanchao = name === "燕巢校區";
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, name === "楠梓校區" ? 2.5 : yanchao ? 2 : (compact ? 1.25 : 1.5)));
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap; renderer.shadowMap.autoUpdate = false;
  renderer.domElement.tabIndex = 0; renderer.domElement.setAttribute("aria-label", `${name}互動式三維微縮模型`);
  renderer.domElement.dataset.campus = model.id; renderer.domElement.dataset.modelKind = name === "楠梓校區" ? "nanzih-architectural-rebuild" : yanchao ? "yanchao-suspension-bridge" : "placeholder"; host.appendChild(renderer.domElement);
  const camera = new THREE.PerspectiveCamera(name === "楠梓校區" ? 34 : yanchao ? 35 : 38, 1, .1, 180), controls = new OrbitControls(camera, renderer.domElement);
  controls.enableRotate = false; controls.enableDamping = true; controls.dampingFactor = .09;
  controls.enablePan = true; controls.panSpeed = .38; controls.zoomSpeed = .68;
  controls.touches.ONE = THREE.TOUCH.ROTATE; controls.touches.TWO = THREE.TOUCH.DOLLY_PAN;
  let disposed = false, active = true, visible = !document.hidden, contextAvailable = true;
  let frame = 0, previousTime: number | null = null, shadowRevision = 0;
  let blend = 0, fromBlend = 0, targetBlend = 0, elapsed = 1.6;
  const nanzih = name === "楠梓校區";
  const defaultTarget = new THREE.Vector3(0, nanzih ? 3.05 : yanchao ? 2.45 : 1.8, nanzih ? .48 : yanchao ? -.4 : 0), direction = new THREE.Vector3(nanzih ? 2.15 : yanchao ? 7.4 : 6, nanzih ? 15.2 : yanchao ? 14.6 : 17, nanzih ? 24.6 : yanchao ? 23.5 : 23).normalize();
  const tiltAxis = new THREE.Vector3(), yaw = new THREE.Quaternion(), tilt = new THREE.Quaternion(), previousTarget = new THREE.Vector3();
  const turntable = createModelTurntable(renderer.domElement, { invalidate, tiltLimit: .24, onStart: invalidate });
  const hemisphere = new THREE.HemisphereLight(0xdbeef4, 0x81927e, 1.05);
  const sun = new THREE.DirectionalLight(0xffedce, 2.7); sun.position.set(12, 18, 14); sun.castShadow = true;
  const shadowSize = nanzih ? (compact ? 2048 : 4096) : yanchao ? 2048 : (compact ? 512 : 1024);
  sun.shadow.mapSize.set(shadowSize, shadowSize);
  Object.assign(sun.shadow.camera, { left: -15, right: 15, top: 15, bottom: -15, near: .5, far: 65 });
  sun.shadow.normalBias = .035; sun.shadow.bias = -.0002; sun.shadow.radius = 2;
  scene.add(hemisphere, sun, sun.target);
  const entrance = new THREE.PointLight(0xffc385, 0, 4.3, 2); entrance.position.set(0, 1.55, model.entryZ + .8);
  const gate = new THREE.PointLight(0xffd097, 0, 4.2, 2); gate.position.set(3.55, 2.1, 3.4);
  const wall = new THREE.PointLight(0xffcf95, 0, 4.8, 2); wall.position.set(-4.65, 1.5, 4.85);
  if (nanzih) { entrance.position.set(0, 2.7, 1.65); entrance.distance = 6; gate.position.set(-4.5, 1.8, 1.5); gate.distance = 4.8; wall.position.set(4.5, 1.8, 1.5); wall.distance = 4.8; }
  if (yanchao) { entrance.position.set(0, 3.1, 4.65); entrance.distance = 6.5; gate.position.set(0, 3.1, -3.95); gate.distance = 6; wall.position.set(-.6, 5.7, -5.4); wall.distance = 5.5; }
  group.add(entrance, gate, wall);
  const campusLamps: THREE.PointLight[] = [];
  if (nanzih || yanchao) for (const [index, position] of model.lampPositions.entries()) {
    if (yanchao && index % 2) continue;
    const lamp = new THREE.PointLight(0xffbd72, 0, 3.6, 2.15);
    lamp.position.set(position[0], position[1] - .12, position[2]); group.add(lamp); campusLamps.push(lamp);
  }
  const lights = { hemisphere, sun, entrance, gate, wall, campusLamps };
  let environmentTexture: THREE.DataTexture | null = null;
  if (nanzih) { const width = 512, height = 256, pixels = new Float32Array(width * height * 4), sunDirection = sun.position.clone().sub(sun.target.position).normalize(); for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) { const elevation = (y / (height - 1) - .5) * Math.PI, azimuth = (x / width - .5) * Math.PI * 2, dx = Math.cos(elevation) * Math.cos(azimuth), dy = Math.sin(elevation), dz = Math.cos(elevation) * Math.sin(azimuth), sky = Math.max(0, dy), horizon = Math.pow(1 - Math.abs(dy), 4), highlight = Math.pow(Math.max(0, dx * sunDirection.x + dy * sunDirection.y + dz * sunDirection.z), 72) * 7, i = (y * width + x) * 4; pixels[i] = .06 + sky * .24 + horizon * .22 + highlight; pixels[i + 1] = .08 + sky * .36 + horizon * .24 + highlight * .86; pixels[i + 2] = .1 + sky * .55 + horizon * .26 + highlight * .65; pixels[i + 3] = 1; } environmentTexture = new THREE.DataTexture(pixels, width, height, THREE.RGBAFormat, THREE.FloatType); environmentTexture.colorSpace = THREE.LinearSRGBColorSpace; environmentTexture.mapping = THREE.EquirectangularReflectionMapping; environmentTexture.needsUpdate = true; scene.environment = environmentTexture; scene.environmentIntensity = .54; }

  const skyMaterial = new THREE.ShaderMaterial({
    depthTest: false, depthWrite: false,
    uniforms: { night: { value: 0 }, aspect: { value: 1 } },
    vertexShader: "varying vec2 skyUv;void main(){skyUv=uv;gl_Position=vec4(position.xy,1.,1.);}",
    fragmentShader: `varying vec2 skyUv;uniform float night;uniform float aspect;
      float puff(vec2 p,vec2 c,vec2 s){vec2 d=(p-c)/s;return exp(-dot(d,d)*3.);}
      void main(){vec2 p=vec2(skyUv.x*aspect,skyUv.y);
        vec3 day=mix(vec3(.78,.88,.9),vec3(.42,.69,.8),skyUv.y);
        vec3 dark=mix(vec3(.1,.19,.27),vec3(.035,.07,.14),skyUv.y);
        float clouds=puff(p,vec2(aspect*.2,.79),vec2(.23,.028))+puff(p,vec2(aspect*.26,.8),vec2(.14,.034));
        clouds+=puff(p,vec2(aspect*.79,.68),vec2(.27,.025));
        gl_FragColor=vec4(mix(day+vec3(min(clouds,1.)*.12),dark,night),1.);
        #include <colorspace_fragment>
      }`,
  });
  const skyGeometry = new THREE.PlaneGeometry(2, 2), sky = new THREE.Mesh(skyGeometry, skyMaterial);
  sky.renderOrder = -100; sky.frustumCulled = false; scene.add(sky);
  const daySun = new THREE.Color(0xffedce), nightSun = new THREE.Color(0x87afd6);
  const dayAmbient = new THREE.Color(0xdbeef4), nightAmbient = new THREE.Color(0x859dbf);
  const dayGround = new THREE.Color(0x81927e), nightGround = new THREE.Color(0x26313b);
  function applyLighting(value: number) {
    skyMaterial.uniforms.night.value = value;
    hemisphere.color.copy(dayAmbient).lerp(nightAmbient, value);
    hemisphere.groundColor.copy(dayGround).lerp(nightGround, value);
    hemisphere.intensity = THREE.MathUtils.lerp(nanzih ? .88 : yanchao ? .78 : 1.05, nanzih ? .32 : yanchao ? .31 : .28, value);
    sun.color.copy(daySun).lerp(nightSun, value);
    sun.intensity = THREE.MathUtils.lerp(nanzih ? 3.65 : yanchao ? 3.3 : 2.7, nanzih ? .16 : yanchao ? .17 : .18, value);
    if (nanzih) scene.environmentIntensity = THREE.MathUtils.lerp(.64, .12, value);
    entrance.intensity = value * (nanzih ? 4.8 : yanchao ? 4.2 : 3); gate.intensity = value * (nanzih ? 3.45 : yanchao ? 3.6 : 3); wall.intensity = value * (nanzih ? 3.45 : yanchao ? 3.2 : 2.6);
    campusLamps.forEach((lamp, index) => { lamp.intensity = value * (yanchao ? (index < 4 ? 2.15 : 1.7) : index < 2 ? 1.85 : 1.45); });
    mats.brightGlass.emissiveIntensity = value * (nanzih ? 1.12 : .82); mats.dimGlass.emissiveIntensity = value * (nanzih ? .46 : .34);
    mats.guardGlass.emissiveIntensity = value * (nanzih ? .92 : .65); mats.warm.emissiveIntensity = value * (nanzih ? 1.85 : 1.5);
    model.labels.forEach(material => { material.emissiveIntensity = value * .3; });
    renderer.toneMappingExposure = THREE.MathUtils.lerp(nanzih ? 1.14 : yanchao ? 1.06 : 1.08, nanzih ? .9 : yanchao ? .9 : .98, value);
    renderer.domElement.dataset.lighting = value < .001 ? "day" : value > .999 ? "night" : "transition";
    options.onBackgroundChange?.(value > .5 ? (nanzih ? "#102536" : yanchao ? "#102333" : "#193344") : (yanchao ? "#bfd9df" : "#c9e0e5"));
  }
  function changeMode(night: boolean) {
    if (disposed) return;
    fromBlend = blend; targetBlend = night ? 1 : 0; elapsed = 0; previousTime = null;
    options.onModeChange?.(night); invalidate();
  }
  const setDayMode = () => changeMode(false), setNightMode = () => changeMode(true), toggleDayNight = () => changeMode(!targetBlend);
  const autoNight = createAutoNightSwitch(() => { setNightMode(); renderer.domElement.dataset.autoNight = "done"; });
  function fitCamera() {
    const width = host.clientWidth, height = host.clientHeight; if (!width || !height) return;
    camera.aspect = width / height; camera.fov = nanzih ? (width < height ? 39 : height < 500 ? 36 : 32) : yanchao ? (width < height ? 41 : height < 500 ? 38 : 34) : (width < height ? 42 : height < 500 ? 40 : 36); camera.updateProjectionMatrix();
    renderer.setSize(width, height); skyMaterial.uniforms.aspect.value = camera.aspect;
    const forward = direction.clone().negate(), right = new THREE.Vector3().crossVectors(forward, camera.up).normalize(), up = new THREE.Vector3().crossVectors(right, forward).normalize();
    const vertical = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), horizontal = vertical * camera.aspect;
    let distance = 0;
    for (const x of [model.bounds.min.x, model.bounds.max.x]) for (const y of [model.bounds.min.y, model.bounds.max.y]) for (const z of [model.bounds.min.z, model.bounds.max.z]) {
      const p = new THREE.Vector3(x, y, z).applyQuaternion(group.quaternion).sub(defaultTarget);
      distance = Math.max(distance, Math.abs(p.dot(right)) / horizontal + p.dot(direction), Math.abs(p.dot(up)) / vertical + p.dot(direction));
    }
    distance *= nanzih ? (width < height ? 1.07 : 1) : yanchao ? (width < height ? 1.08 : 1.02) : 1.1; controls.minDistance = distance * .56; controls.maxDistance = distance * 2.05;
    const damping = controls.enableDamping; controls.enableDamping = false;
    camera.position.copy(defaultTarget).addScaledVector(direction, distance); controls.target.copy(defaultTarget); controls.update(); controls.enableDamping = damping;
    renderer.domElement.dataset.preset = width < height ? "portrait" : height < 500 ? "landscape" : "desktop";
  }
  function syncRotation() {
    tiltAxis.set(1, 0, 0).applyQuaternion(camera.quaternion).normalize();
    tilt.setFromAxisAngle(tiltAxis, turntable.tilt); yaw.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, turntable.angle);
    group.quaternion.copy(tilt).multiply(yaw); group.updateMatrixWorld(true);
  }
  function resetView() { if (!disposed) { turntable.reset(); syncRotation(); fitCamera(); renderer.shadowMap.needsUpdate = true; invalidate(); } }
  function invalidate() {
    if (!disposed && visible && !frame) frame = requestAnimationFrame(animate);
  }
  function animate(time: number) {
    frame = 0; if (disposed || !visible) return;
    const delta = previousTime === null ? 0 : Math.min(.1, Math.max(0, (time - previousTime) / 1000)); previousTime = time;
    const moved = turntable.update(delta || 1 / 60); syncRotation();
    const modelMoving = "update" in model && typeof model.update === "function" ? model.update(delta, blend, reducedMotion) : false;
    const cameraChanged = controls.update();
    previousTarget.copy(controls.target);
    controls.target.x = THREE.MathUtils.clamp(controls.target.x, -1.5, 1.5); controls.target.y = THREE.MathUtils.clamp(controls.target.y, 1, 2.5); controls.target.z = THREE.MathUtils.clamp(controls.target.z, -1.5, 1.5);
    camera.position.add(previousTarget.sub(controls.target).negate());
    if (elapsed < 1.6) {
      elapsed = Math.min(1.6, elapsed + delta); const p = elapsed / 1.6;
      blend = THREE.MathUtils.lerp(fromBlend, targetBlend, p * p * (3 - 2 * p)); applyLighting(blend);
    }
    if (moved || renderer.shadowMap.needsUpdate) { renderer.shadowMap.needsUpdate = true; shadowRevision++; }
    renderer.render(scene, camera);
    Object.assign(renderer.domElement.dataset, {
      triangles: String(renderer.info.render.triangles), drawCalls: String(renderer.info.render.calls),
      windows: String(model.windowCount), litWindows: String(model.litWindowCount), modelRotation: turntable.angle.toFixed(4), modelTilt: turntable.tilt.toFixed(4),
      shadowRevision: String(shadowRevision), cameraPosition: camera.position.toArray().map(v => v.toFixed(4)).join(","),
    });
    // 靜止且過渡完成後停繪；互動與八秒計時器會再次喚醒。
    if (moved || cameraChanged || elapsed < 1.6 || modelMoving) invalidate();
    else if (!frame) previousTime = null;
  }
  function syncVisibility() {
    const next = active && !document.hidden && contextAvailable; if (next === visible) return;
    visible = next; previousTime = null; turntable.setEnabled(next);
    if (visible) { autoNight.resume(); renderer.shadowMap.needsUpdate = true; invalidate(); }
    else { autoNight.pause(); cancelAnimationFrame(frame); frame = 0; }
  }
  function setActive(value: boolean) { if (!disposed) { active = value; syncVisibility(); } }
  const resize = () => { if (!disposed) { fitCamera(); renderer.shadowMap.needsUpdate = true; invalidate(); } };
  const observer = new ResizeObserver(resize); observer.observe(host);
  const lost = (event: Event) => { event.preventDefault(); contextAvailable = false; syncVisibility(); };
  const restored = () => { contextAvailable = true; syncVisibility(); };
  const blurred = () => turntable.cancel();
  const keydown = (event: KeyboardEvent) => {
    if (event.repeat || event.ctrlKey || event.metaKey || event.altKey || event.target !== renderer.domElement) return;
    if (event.key.toLowerCase() === "n") toggleDayNight();
    if (event.key.toLowerCase() === "r") resetView();
  };
  controls.addEventListener("start", invalidate); controls.addEventListener("change", invalidate);
  renderer.domElement.addEventListener("webglcontextlost", lost); renderer.domElement.addEventListener("webglcontextrestored", restored); renderer.domElement.addEventListener("keydown", keydown);
  document.addEventListener("visibilitychange", syncVisibility); window.addEventListener("blur", blurred);
  fitCamera(); applyLighting(0); options.onModeChange?.(false); autoNight.restart(visible);
  renderer.domElement.dataset.autoNight = "pending"; renderer.shadowMap.needsUpdate = true; invalidate();
  function dispose() {
    if (disposed) return; disposed = true;
    cancelAnimationFrame(frame); frame = 0; autoNight.dispose(); turntable.dispose(); observer.disconnect();
    controls.removeEventListener("start", invalidate); controls.removeEventListener("change", invalidate); controls.dispose();
    renderer.domElement.removeEventListener("webglcontextlost", lost); renderer.domElement.removeEventListener("webglcontextrestored", restored); renderer.domElement.removeEventListener("keydown", keydown);
    document.removeEventListener("visibilitychange", syncVisibility); window.removeEventListener("blur", blurred);
    model.dispose(); environmentTexture?.dispose(); scene.environment = null; skyGeometry.dispose(); skyMaterial.dispose(); sun.shadow.dispose(); renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove(); scene.clear();
  }
  return { sceneObjects, lights, setDayMode, setNightMode, toggleDayNight, resetView, setActive, dispose };
}
