import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { createFirstCampusModel } from "./first-campus-model";
import { createModelTurntable } from "./model-turntable.mjs";
import { createAutoNightSwitch } from "./auto-night.mjs";
import type { CampusScene, CampusSceneOptions } from "./campus-scene";

export function createFirstCampusScene(host: HTMLElement, options: CampusSceneOptions = {}): CampusScene {
  const name = "第一校區";
  const compact = window.matchMedia("(pointer: coarse)").matches || Math.min(host.clientWidth, host.clientHeight) < 500;
  const model = createFirstCampusModel({ quality: compact ? "mobile" : "desktop" }), { group, sceneObjects, mats } = model;
  const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
  let renderer: THREE.WebGLRenderer;
  try { renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" }); }
  catch (error) { model.dispose(); throw error; }
  const scene = new THREE.Scene(); scene.add(group);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, compact ? 1.25 : 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap; renderer.shadowMap.autoUpdate = false;
  renderer.domElement.tabIndex = 0; renderer.domElement.setAttribute("aria-label", `${name}互動式三維微縮模型`);
  renderer.domElement.dataset.campus = model.id; renderer.domElement.dataset.modelKind = "first-campus-detailed"; host.appendChild(renderer.domElement);
  const camera = new THREE.PerspectiveCamera(38, 1, .1, 180), controls = new OrbitControls(camera, renderer.domElement);
  controls.enableRotate = false; controls.enableDamping = true; controls.dampingFactor = .09;
  controls.enablePan = true; controls.panSpeed = .38; controls.zoomSpeed = .68;
  controls.touches.ONE = THREE.TOUCH.ROTATE; controls.touches.TWO = THREE.TOUCH.DOLLY_PAN;
  let disposed = false, active = true, visible = !document.hidden, contextAvailable = true;
  let frame = 0, previousTime: number | null = null, shadowRevision = 0, lastRenderedAt = 0, lastShadowAt = 0;
  let lastWidth = 0, lastHeight = 0;
  let blend = 0, fromBlend = 0, targetBlend = 0, elapsed = 1.6;
  const defaultTarget = new THREE.Vector3(0, 2, 0), direction = new THREE.Vector3(5, 18.4, 23).normalize();
  const fitPosition = new THREE.Vector3();
  type CameraTween = { from: THREE.Vector3; targetFrom: THREE.Vector3; elapsed: number; duration: number };
  let cameraTween: CameraTween | null = null;
  const tiltAxis = new THREE.Vector3(), yaw = new THREE.Quaternion(), tilt = new THREE.Quaternion(), previousTarget = new THREE.Vector3();
  const turntable = createModelTurntable(renderer.domElement, { invalidate, tiltLimit: .24, onStart: interactionStarted });
  const hemisphere = new THREE.HemisphereLight(0xd9edf0, 0x8d936b, 1.12);
  const sun = new THREE.DirectionalLight(0xffdfa8, 2.55); sun.position.set(12, 18, 14); sun.castShadow = true;
  sun.shadow.mapSize.set(compact ? 1024 : 2048, compact ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -15, right: 15, top: 15, bottom: -15, near: .5, far: 65 });
  sun.shadow.normalBias = .035; sun.shadow.bias = -.0002; sun.shadow.radius = 3;
  scene.add(hemisphere, sun, sun.target);
  const entrance = new THREE.PointLight(0xffc385, 0, 4.3, 2); entrance.position.set(0, 1.55, model.entryZ + .8);
  const gate = new THREE.PointLight(0xffd097, 0, 7, 2); gate.position.set(0, 1.8, 7.2);
  const wall = new THREE.PointLight(0xffcf95, 0, 8, 2); wall.position.set(0, 4, -2);
  group.add(entrance, gate, wall);
  const lamps = model.lampPositions.map(position => { const light = new THREE.PointLight(0xffd49a, 0, 3.6, 2); light.position.set(...position); group.add(light); return light; });
  const lights = { hemisphere, sun, entrance, gate, wall };

  const skyMaterial = new THREE.ShaderMaterial({
    depthTest: false, depthWrite: false,
    uniforms: { night: { value: 0 }, aspect: { value: 1 }, time: { value: 0 } },
    vertexShader: "varying vec2 skyUv;void main(){skyUv=uv;gl_Position=vec4(position.xy,1.,1.);}",
    fragmentShader: `varying vec2 skyUv;uniform float night;uniform float aspect;uniform float time;
      float puff(vec2 p,vec2 c,vec2 s){vec2 d=(p-c)/s;return 1.-smoothstep(.38,1.05,dot(d,d));}
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float star(vec2 p){vec2 q=floor(p*145.);float h=hash(q);return step(.996,h)*(.42+.12*sin(time*.45+h*20.));}
      void main(){vec2 p=vec2(skyUv.x*aspect,skyUv.y);
        vec3 day=mix(vec3(.73,.91,.94),vec3(.20,.62,.86),smoothstep(0.,.92,skyUv.y));
        vec3 dark=mix(vec3(.10,.20,.34),vec3(.018,.045,.12),skyUv.y);
        float clouds=puff(p,vec2(aspect*.12,.75),vec2(.16,.09))+puff(p,vec2(aspect*.21,.78),vec2(.21,.13))+puff(p,vec2(aspect*.32,.74),vec2(.18,.1));
        clouds+=puff(p,vec2(aspect*.67,.66),vec2(.18,.11))+puff(p,vec2(aspect*.79,.7),vec2(.24,.15))+puff(p,vec2(aspect*.91,.67),vec2(.17,.1));
        clouds=min(clouds,1.); float moon=1.-smoothstep(.055,.082,length(p-vec2(aspect*.81,.82)));
        vec3 cloudInk=mix(vec3(.72,.87,.91),vec3(1.,.97,.84),smoothstep(.18,.8,clouds));
        vec3 daySky=mix(day,cloudInk,smoothstep(.08,.78,clouds)*.88);
        vec3 nightSky=dark+vec3(star(p)*.38)+vec3(.77,.83,.72)*moon*.72;
        float paper=(hash(floor(gl_FragCoord.xy*.45))-.5)*.026;
        gl_FragColor=vec4(mix(daySky,nightSky,night)+paper,1.);
        #include <colorspace_fragment>
      }`,
  });
  const skyGeometry = new THREE.PlaneGeometry(2, 2), sky = new THREE.Mesh(skyGeometry, skyMaterial);
  sky.renderOrder = -100; sky.frustumCulled = false; scene.add(sky);
  const daySun = new THREE.Color(0xffd486), nightSun = new THREE.Color(0x87afd6);
  const dayAmbient = new THREE.Color(0xd9edf0), nightAmbient = new THREE.Color(0x859dbf);
  function applyLighting(value: number) {
    skyMaterial.uniforms.night.value = value;
    hemisphere.color.copy(dayAmbient).lerp(nightAmbient, value); hemisphere.intensity = THREE.MathUtils.lerp(1.05, .28, value);
    sun.color.copy(daySun).lerp(nightSun, value); sun.intensity = THREE.MathUtils.lerp(2.7, .18, value);
    entrance.intensity = value * 3; gate.intensity = value * 3; wall.intensity = value * 2.6;
    lamps.forEach(light => { light.intensity = value * 1.4; });
    mats.brightGlass.emissiveIntensity = value * .82; mats.dimGlass.emissiveIntensity = value * .34;
    mats.guardGlass.emissiveIntensity = value * .65; mats.warm.emissiveIntensity = value * 1.5;
    renderer.toneMappingExposure = THREE.MathUtils.lerp(1.22, .98, value);
    renderer.domElement.dataset.lighting = value < .001 ? "day" : value > .999 ? "night" : "transition";
    options.onBackgroundChange?.(value > .5 ? "#193344" : "#d8e8df");
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
    camera.aspect = width / height; camera.fov = width < height ? 34 : height < 500 ? 32 : 30; camera.updateProjectionMatrix();
    renderer.setSize(width, height); skyMaterial.uniforms.aspect.value = camera.aspect;
    const forward = direction.clone().negate(), right = new THREE.Vector3().crossVectors(forward, camera.up).normalize(), up = new THREE.Vector3().crossVectors(right, forward).normalize();
    const vertical = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), horizontal = vertical * camera.aspect;
    let distance = 0;
    for (const x of [model.bounds.min.x, model.bounds.max.x]) for (const y of [model.bounds.min.y, model.bounds.max.y]) for (const z of [model.bounds.min.z, model.bounds.max.z]) {
      const p = new THREE.Vector3(x, y, z).applyQuaternion(group.quaternion).sub(defaultTarget);
      distance = Math.max(distance, Math.abs(p.dot(right)) / horizontal + p.dot(direction), Math.abs(p.dot(up)) / vertical + p.dot(direction));
    }
    distance *= 1.025; controls.minDistance = distance * .64; controls.maxDistance = distance * 1.95;
    const damping = controls.enableDamping; controls.enableDamping = false;
    fitPosition.copy(defaultTarget).addScaledVector(direction, distance);
    camera.position.copy(fitPosition); controls.target.copy(defaultTarget); controls.update(); controls.enableDamping = damping;
    renderer.domElement.dataset.preset = width < height ? "portrait" : height < 500 ? "landscape" : "desktop";
  }
  function syncRotation() {
    tiltAxis.set(1, 0, 0).applyQuaternion(camera.quaternion).normalize();
    tilt.setFromAxisAngle(tiltAxis, turntable.tilt); yaw.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, turntable.angle);
    group.quaternion.copy(tilt).multiply(yaw); group.updateMatrixWorld(true);
  }
  function startCameraTween(duration: number, distanceScale = 1) {
    fitCamera();
    const destination = fitPosition.clone();
    const from = defaultTarget.clone().add(fitPosition.clone().sub(defaultTarget).multiplyScalar(distanceScale));
    camera.position.copy(from); controls.target.copy(defaultTarget); controls.update();
    cameraTween = motionPreference.matches ? null : { from, targetFrom: controls.target.clone(), elapsed: 0, duration };
    if (!cameraTween) camera.position.copy(destination);
    renderer.domElement.dataset.entrance = cameraTween ? "entering" : "ready";
  }
  function interactionStarted() { cameraTween = null; renderer.domElement.dataset.entrance = "ready"; invalidate(); }
  function resetView() {
    if (disposed) return;
    turntable.reset(true); syncRotation(); fitCamera();
    if (motionPreference.matches) { camera.position.copy(fitPosition); controls.target.copy(defaultTarget); controls.update(); cameraTween = null; }
    else cameraTween = { from: camera.position.clone(), targetFrom: controls.target.clone(), elapsed: 0, duration: .95 };
    renderer.domElement.dataset.entrance = cameraTween ? "entering" : "ready";
    renderer.shadowMap.needsUpdate = true; invalidate();
  }
  function invalidate() {
    if (!disposed && visible && !frame) frame = requestAnimationFrame(animate);
  }
  function animate(time: number) {
    frame = 0; if (disposed || !visible) return;
    if (time < lastRenderedAt) { lastRenderedAt = 0; previousTime = null; }
    const minimumFrame = 1000 / (compact ? 24 : 30);
    if (lastRenderedAt && time - lastRenderedAt < minimumFrame) { frame = requestAnimationFrame(animate); return; }
    lastRenderedAt = time;
    const delta = previousTime === null ? 0 : Math.min(.1, Math.max(0, (time - previousTime) / 1000)); previousTime = time;
    const moved = turntable.update(delta || 1 / 60); syncRotation();
    const movingLife = !motionPreference.matches;
    const lifeChanged = model.life.update(delta, blend, !movingLife);
    skyMaterial.uniforms.time.value = time / 1000;
    let cameraChanged = false;
    if (cameraTween) {
      cameraTween.elapsed += delta;
      const p = Math.min(1, cameraTween.elapsed / cameraTween.duration), ease = p * p * (3 - 2 * p);
      const damping = controls.enableDamping; controls.enableDamping = false;
      camera.position.lerpVectors(cameraTween.from, fitPosition, ease); controls.target.lerpVectors(cameraTween.targetFrom, defaultTarget, ease);
      controls.update(); controls.enableDamping = damping; cameraChanged = true;
      if (p === 1) { cameraTween = null; renderer.domElement.dataset.entrance = "ready"; }
    } else cameraChanged = controls.update();
    previousTarget.copy(controls.target);
    controls.target.x = THREE.MathUtils.clamp(controls.target.x, -1.5, 1.5); controls.target.y = THREE.MathUtils.clamp(controls.target.y, 1, 2.5); controls.target.z = THREE.MathUtils.clamp(controls.target.z, -1.5, 1.5);
    camera.position.add(previousTarget.sub(controls.target).negate());
    if (elapsed < 1.6) {
      elapsed = Math.min(1.6, elapsed + delta); const p = elapsed / 1.6;
      blend = THREE.MathUtils.lerp(fromBlend, targetBlend, p * p * (3 - 2 * p)); applyLighting(blend);
    }
    if (moved || renderer.shadowMap.needsUpdate || (lifeChanged && time - lastShadowAt > (compact ? 240 : 160))) {
      renderer.shadowMap.needsUpdate = true; shadowRevision++; lastShadowAt = time;
    }
    renderer.render(scene, camera);
    Object.assign(renderer.domElement.dataset, {
      triangles: String(renderer.info.render.triangles), drawCalls: String(renderer.info.render.calls),
      windows: String(model.windowCount), litWindows: String(model.litWindowCount), modelRotation: turntable.angle.toFixed(4), modelTilt: turntable.tilt.toFixed(4),
      shadowRevision: String(shadowRevision), cameraPosition: camera.position.toArray().map(v => v.toFixed(4)).join(","),
      activity: blend < .5 ? "badminton" : "live", dayPlayers: String(model.life.stats.dayPlayers),
      bandMembers: String(model.life.stats.bandMembers), audience: String(model.life.stats.audience),
    });
    // 靜止且過渡完成後停繪；互動與八秒計時器會再次喚醒。
    if (movingLife || moved || cameraChanged || cameraTween || elapsed < 1.6) invalidate();
    else if (!frame) previousTime = null;
  }
  function syncVisibility() {
    const next = active && !document.hidden && contextAvailable; if (next === visible) return;
    visible = next; previousTime = null; turntable.setEnabled(next);
    if (visible) { autoNight.resume(); renderer.shadowMap.needsUpdate = true; invalidate(); }
    else { autoNight.pause(); cancelAnimationFrame(frame); frame = 0; }
  }
  function setActive(value: boolean) {
    if (disposed) return;
    const entering = value && !active; active = value; syncVisibility();
    if (entering && visible) startCameraTween(1.15, 1.14);
  }
  const resize = () => {
    if (disposed) return;
    const width = host.clientWidth, height = host.clientHeight;
    if (!width || !height || (width === lastWidth && height === lastHeight)) return;
    lastWidth = width; lastHeight = height; fitCamera(); cameraTween = null; renderer.domElement.dataset.entrance = "ready";
    renderer.shadowMap.needsUpdate = true; invalidate();
  };
  const observer = new ResizeObserver(resize); observer.observe(host);
  const lost = (event: Event) => { event.preventDefault(); contextAvailable = false; syncVisibility(); };
  const restored = () => { contextAvailable = true; syncVisibility(); };
  const blurred = () => turntable.cancel();
  const keydown = (event: KeyboardEvent) => {
    if (event.repeat || event.ctrlKey || event.metaKey || event.altKey || event.target !== renderer.domElement) return;
    if (event.key.toLowerCase() === "n") toggleDayNight();
    if (event.key.toLowerCase() === "r") resetView();
  };
  controls.addEventListener("start", interactionStarted); controls.addEventListener("change", invalidate);
  renderer.domElement.addEventListener("webglcontextlost", lost); renderer.domElement.addEventListener("webglcontextrestored", restored); renderer.domElement.addEventListener("keydown", keydown);
  document.addEventListener("visibilitychange", syncVisibility); window.addEventListener("blur", blurred);
  fitCamera(); lastWidth = host.clientWidth; lastHeight = host.clientHeight;
  startCameraTween(1.15, 1.14); applyLighting(0); options.onModeChange?.(false); autoNight.restart(visible);
  renderer.domElement.dataset.autoNight = "pending"; renderer.shadowMap.needsUpdate = true; invalidate();
  function dispose() {
    if (disposed) return; disposed = true;
    cancelAnimationFrame(frame); frame = 0; autoNight.dispose(); turntable.dispose(); observer.disconnect();
    controls.removeEventListener("start", interactionStarted); controls.removeEventListener("change", invalidate); controls.dispose();
    renderer.domElement.removeEventListener("webglcontextlost", lost); renderer.domElement.removeEventListener("webglcontextrestored", restored); renderer.domElement.removeEventListener("keydown", keydown);
    document.removeEventListener("visibilitychange", syncVisibility); window.removeEventListener("blur", blurred);
    model.dispose(); skyGeometry.dispose(); skyMaterial.dispose(); sun.shadow.dispose(); renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove(); scene.clear();
  }
  return { sceneObjects, lights, setDayMode, setNightMode, toggleDayNight, resetView, setActive, dispose };
}
