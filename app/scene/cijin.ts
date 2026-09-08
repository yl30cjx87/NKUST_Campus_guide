import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { createCijinCampus } from "./cijin-model";
import { createAutoNightSwitch } from "./auto-night.mjs";
import { createModelTurntable } from "./model-turntable.mjs";
import { createBoatAnimations } from "./harbor-motion.mjs";
import { createDistantSeabirds } from "./harbor-life";
import { createHarborAtmosphere } from "./harbor-atmosphere";
import { createCijinShoreLife } from "./cijin-shore-life";
import type { CampusScene, CampusSceneOptions } from "./campus-scene";

export function createCijinScene(host: HTMLElement, options: CampusSceneOptions = {}): CampusScene {
  const scene = new THREE.Scene();
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  let campus: ReturnType<typeof createCijinCampus>;
  try { campus = createCijinCampus(); } catch (error) { renderer.dispose(); throw error; }
  const { campusGroup, sceneObjects, bounds, mats } = campus;
  scene.add(campusGroup);
  const compact = window.matchMedia("(pointer: coarse)").matches || Math.min(host.clientWidth, host.clientHeight) < 500 || (navigator.hardwareConcurrency || 8) <= 4;
  const pixelRatio = Math.min(window.devicePixelRatio, compact ? 1.25 : 1.5);
  renderer.setPixelRatio(pixelRatio);
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.07; renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false; renderer.domElement.tabIndex = 0;
  renderer.domElement.setAttribute("aria-label", "旗津校區港灣互動式三維微縮模型");
  renderer.domElement.dataset.campus = "cijin"; host.appendChild(renderer.domElement);
  renderer.domElement.dataset.shaderStatus = "pending";
  renderer.debug.onShaderError = (gl, program, vertex, fragment) => {
    renderer.domElement.dataset.shaderStatus = "error";
    console.error("Cijin shader compilation failed", gl.getProgramInfoLog(program), gl.getShaderInfoLog(vertex), gl.getShaderInfoLog(fragment));
  };
  const camera = new THREE.PerspectiveCamera(38, 1, .1, 180);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableRotate = false; controls.enableDamping = true; controls.dampingFactor = .09;
  controls.enablePan = true; controls.panSpeed = .38; controls.zoomSpeed = .68;
  controls.touches.ONE = THREE.TOUCH.ROTATE; controls.touches.TWO = THREE.TOUCH.DOLLY_PAN;
  let disposed = false, active = true, visible = !document.hidden, contextAvailable = true;
  let frame = 0, previousFrame = 0, seconds = 0, lastInteraction = performance.now(), lastShadow = 0, shadowRevision = 0;
  let blend = 0, targetBlend = 0, startBlend = 0, transitionElapsed = 1.6;
  const defaultTarget = new THREE.Vector3(0, 2.25, -.15), direction = new THREE.Vector3(7, 22, 28).normalize();
  const fitPosition = new THREE.Vector3();
  type CameraTween = { from: THREE.Vector3; targetFrom: THREE.Vector3; elapsed: number; duration: number };
  let cameraTween: CameraTween | null = null;
  const rotation = new THREE.Quaternion(), yaw = new THREE.Quaternion(), tiltAxis = new THREE.Vector3();
  const turntable = createModelTurntable(renderer.domElement, { invalidate, tiltLimit: .18, onStart: interactionStarted });
  const boatAnimation = createBoatAnimations(campus.boats, campus.radar, campus.wake);

  function createLighting() {
    const hemisphere = new THREE.HemisphereLight(0xe1edf3, 0x829886, 1.05);
    const sun = new THREE.DirectionalLight(0xffedcf, 2.7); sun.position.set(12, 20, 16); sun.castShadow = true;
    const size = compact ? 512 : 1024; sun.shadow.mapSize.set(size, size);
    Object.assign(sun.shadow.camera, { left: -17, right: 17, top: 17, bottom: -17, near: .5, far: 65 });
    sun.shadow.bias = -.0002; sun.shadow.normalBias = .04; sun.shadow.radius = 2;
    const entrance = new THREE.PointLight(0xffbc75, 0, 2.8, 2); entrance.position.set(-.65, 1.55, .7);
    const dockLeft = new THREE.PointLight(0xffbd72, 0, 4.7, 2); dockLeft.position.set(-8.3, 2.85, 3.13);
    const dockRight = new THREE.PointLight(0xffbd72, 0, 4.7, 2); dockRight.position.set(8.25, 2.85, 3.13);
    // 太陽留在世界座標；碼頭與入口燈跟隨校區模型。
    scene.add(hemisphere, sun, sun.target); campusGroup.add(entrance, dockLeft, dockRight);
    return { hemisphere, sun, entrance, dockLeft, dockRight };
  }
  const lights = createLighting();
  function createSky() {
    const material = new THREE.ShaderMaterial({
      depthTest: false, depthWrite: false,
      uniforms: { night: { value: 0 }, aspect: { value: 1 } },
      vertexShader: "varying vec2 skyUv; void main(){skyUv=uv;gl_Position=vec4(position.xy,1.0,1.0);}",
      fragmentShader: `
        varying vec2 skyUv; uniform float night; uniform float aspect;
        float puff(vec2 p,vec2 c,vec2 s){vec2 d=(p-c)/s;return exp(-dot(d,d)*3.0);}
        void main(){
          vec2 p=vec2(skyUv.x*aspect,skyUv.y);
          vec3 day=mix(vec3(.77,.88,.9),vec3(.4,.67,.78),smoothstep(0.,1.,skyUv.y));
          vec3 dark=mix(vec3(.1,.19,.27),vec3(.035,.07,.14),skyUv.y);
          float cloud=puff(p,vec2(aspect*.21,.78),vec2(.22,.028)) + puff(p,vec2(aspect*.25,.8),vec2(.13,.037));
          cloud+=puff(p,vec2(aspect*.75,.66),vec2(.3,.023))+puff(p,vec2(aspect*.81,.69),vec2(.18,.034));
          gl_FragColor=vec4(mix(day+vec3(clamp(cloud,0.,1.)*.13),dark,night),1.0);
          #include <colorspace_fragment>
        }`,
    });
    const geometry = new THREE.PlaneGeometry(2, 2), mesh = new THREE.Mesh(geometry, material);
    mesh.frustumCulled = false; mesh.renderOrder = -100; scene.add(mesh);
    return { material, geometry };
  }
  const sky = createSky();
  const birds = createDistantSeabirds(campus.waterTime, sky.material.uniforms.night, sky.material.uniforms.aspect);
  scene.add(birds.mesh); sceneObjects.seabirds = birds.mesh;
  const atmosphere = createHarborAtmosphere(campusGroup, campus.boats[0], campus.workLight, campus.waterTime, sky.material.uniforms.night, compact);
  const shoreLife = createCijinShoreLife(campusGroup, campus.boats, compact);
  sceneObjects.shoreLife = shoreLife.group; sceneObjects.shoreRipples = shoreLife.ripples;
  sceneObjects.particles = atmosphere.particles; sceneObjects.lightBeams = atmosphere.beams;
  campus.wake.material.uniforms.night = sky.material.uniforms.night;
  const dayWater = new THREE.Color(0x508d97), nightWater = new THREE.Color(0x244d65);
  const daySun = new THREE.Color(0xffedcf), nightSun = new THREE.Color(0x87afd6);
  const dayAmbient = new THREE.Color(0xe1edf3), nightAmbient = new THREE.Color(0x859dbf);
  function applyLighting(value: number) {
    sky.material.uniforms.night.value = value;
    lights.hemisphere.color.copy(dayAmbient).lerp(nightAmbient, value); lights.hemisphere.intensity = THREE.MathUtils.lerp(1.05, .28, value);
    lights.sun.color.copy(daySun).lerp(nightSun, value); lights.sun.intensity = THREE.MathUtils.lerp(2.7, .12, value);
    lights.entrance.intensity = value * 1.6; lights.dockLeft.intensity = value * 4.8; lights.dockRight.intensity = value * 4.8;
    mats.litGlass.emissiveIntensity = value * .85; mats.dimGlass.emissiveIntensity = value * .32; mats.entryGlass.emissiveIntensity = value * .22;
    mats.warm.emissiveIntensity = value * 2; mats.redLamp.emissiveIntensity = value * 1.9; mats.greenLamp.emissiveIntensity = value * 1.9;
    mats.whiteLamp.emissiveIntensity = value * 1.65;
    mats.interiorShadows.opacity = value * .72; sceneObjects.windowInteriors.visible = value > .001;
    birds.mesh.visible = value < .999;
    campus.waterMaterial.color.copy(dayWater).lerp(nightWater, value); campus.waterMaterial.roughness = THREE.MathUtils.lerp(.58, .64, value);
    campus.waterMaterial.emissiveIntensity = value * .18;
    campus.waterWaveScale.value = THREE.MathUtils.lerp(1.42, .72, value); campus.waterNight.value = value;
    campus.life.setNight(value);
    shoreLife.setNight(value);
    renderer.toneMappingExposure = THREE.MathUtils.lerp(1.07, .96, value);
    options.onBackgroundChange?.(value > .5 ? "#193344" : "#c9e0e5");
    renderer.domElement.dataset.lighting = value < .001 ? "day" : value > .999 ? "night" : "transition";
  }
  function changeMode(night: boolean) {
    if (disposed) return;
    startBlend = blend; targetBlend = night ? 1 : 0; transitionElapsed = 0; shoreLife.setScenario(night);
    options.onModeChange?.(night); invalidate();
  }
  const setDayMode = () => changeMode(false), setNightMode = () => changeMode(true), toggleDayNight = () => changeMode(!targetBlend);
  const autoNight = createAutoNightSwitch(() => { setNightMode(); renderer.domElement.dataset.autoNight = "done"; });

  function createResponsiveCamera() {
    const width = host.clientWidth, height = host.clientHeight;
    camera.aspect = width / height; camera.fov = width < height ? 42 : height < 500 ? 40 : 36; camera.updateProjectionMatrix();
    renderer.setSize(width, height); sky.material.uniforms.aspect.value = camera.aspect;
    atmosphere.setPixelScale(height, pixelRatio);
    const forward = direction.clone().negate(), right = new THREE.Vector3().crossVectors(forward, camera.up).normalize(), up = new THREE.Vector3().crossVectors(right, forward).normalize();
    const vertical = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), horizontal = vertical * camera.aspect;
    let distance = 0;
    for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
      const point = new THREE.Vector3(x, y, z).sub(defaultTarget);
      distance = Math.max(distance, Math.abs(point.dot(right)) / horizontal + point.dot(direction), Math.abs(point.dot(up)) / vertical + point.dot(direction));
    }
    distance *= 1.075; fitPosition.copy(defaultTarget).addScaledVector(direction, distance);
    controls.minDistance = Math.max(bounds.getSize(new THREE.Vector3()).length() * .55, distance * .65); controls.maxDistance = distance * 1.8;
    renderer.domElement.dataset.preset = width < height ? "portrait" : height < 500 ? "landscape" : "desktop";
  }
  function resetView() {
    if (disposed) return;
    turntable.reset(true); createResponsiveCamera();
    cameraTween = { from: camera.position.clone(), targetFrom: controls.target.clone(), elapsed: 0, duration: .9 };
    invalidate();
  }
  function interactionStarted() { lastInteraction = performance.now(); cameraTween = null; invalidate(); }
  controls.addEventListener("start", interactionStarted); controls.addEventListener("change", invalidate);
  function invalidate() { if (!disposed && visible && !frame) frame = requestAnimationFrame(animate); }
  function animate(time: number) {
    frame = 0; if (disposed || !visible) return;
    const busy = cameraTween !== null || transitionElapsed < 1.6 || time - lastInteraction < 1400;
    const fps = busy ? (compact ? 40 : 60) : compact ? 24 : 30;
    if (previousFrame && time - previousFrame < 1000 / fps - 1) { invalidate(); return; }
    const delta = previousFrame ? Math.min(.12, (time - previousFrame) / 1000) : 0; previousFrame = time; seconds += delta;
    const moved = turntable.update(delta || 1 / 60);
    tiltAxis.set(1, 0, 0).applyQuaternion(camera.quaternion).normalize();
    rotation.setFromAxisAngle(tiltAxis, turntable.tilt); yaw.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, turntable.angle); rotation.multiply(yaw);
    campusGroup.quaternion.copy(rotation); campusGroup.updateMatrixWorld(true);
    if (cameraTween) {
      cameraTween.elapsed += delta;
      const t = Math.min(1, cameraTween.elapsed / cameraTween.duration), ease = t * t * (3 - 2 * t);
      const damping = controls.enableDamping; controls.enableDamping = false;
      camera.position.lerpVectors(cameraTween.from, fitPosition, ease); controls.target.lerpVectors(cameraTween.targetFrom, defaultTarget, ease); controls.update(); controls.enableDamping = damping;
      if (t === 1) cameraTween = null;
    } else {
      controls.update();
      const previous = controls.target.clone();
      controls.target.x = THREE.MathUtils.clamp(controls.target.x, -1.8, 1.8); controls.target.y = THREE.MathUtils.clamp(controls.target.y, 1.4, 3.3); controls.target.z = THREE.MathUtils.clamp(controls.target.z, -1.8, 1.8);
      camera.position.add(controls.target.clone().sub(previous));
    }
    boatAnimation.update(seconds, campus.waterWaveScale.value); campus.waterTime.value = seconds;
    campus.wake.material.uniforms.pose.value.set(campus.boats[3].position.x, campus.boats[3].position.z, campus.boats[3].rotation.y);
    for (let ripple = 0; ripple < 2; ripple++) {
      const boat = campus.boats[ripple === 0 ? 0 : 3];
      campus.boatRipples.value[ripple].set(boat.position.x, boat.position.z, Math.cos(boat.rotation.y), -Math.sin(boat.rotation.y));
    }
    if (transitionElapsed < 1.6) {
      transitionElapsed = Math.min(1.6, transitionElapsed + delta); const p = transitionElapsed / 1.6;
      blend = THREE.MathUtils.lerp(startBlend, targetBlend, p * p * (3 - 2 * p)); applyLighting(blend);
    }
    campus.life.update(seconds);
    shoreLife.update(seconds, campus.waterWaveScale.value);
    atmosphere.update(seconds, boatAnimation.sampleLaunch);
    // 停泊船的微動陰影以較低頻率刷新，拖曳模型時每幀刷新。
    if (moved || time - lastShadow > 90) { renderer.shadowMap.needsUpdate = true; lastShadow = time; shadowRevision++; }
    renderer.render(scene, camera);
    if (renderer.domElement.dataset.shaderStatus !== "error") renderer.domElement.dataset.shaderStatus = "ready";
    Object.assign(renderer.domElement.dataset, {
      triangles: String(renderer.info.render.triangles), drawCalls: String(renderer.info.render.calls),
      modelRotation: turntable.angle.toFixed(4), modelTilt: turntable.tilt.toFixed(4), shadowRevision: String(shadowRevision),
      boatX: campus.boats[3].position.x.toFixed(4), boatZ: campus.boats[3].position.z.toFixed(4),
      radar: campus.radar.rotation.y.toFixed(4), waterTime: seconds.toFixed(3),
      cameraPosition: camera.position.toArray().map(n => n.toFixed(4)).join(","),
      windows: String(campus.windowCount), litWindows: String(campus.brightCount + campus.dimCount),
      interiorWindows: String(campus.interiorWindowCount), mooringLines: String(campus.life.cables.length),
      reflections: String(campus.life.reflectionMesh.visible ? campus.life.reflectionMesh.count : 0), seabirds: String(birds.mesh.visible ? birds.mesh.count : 0),
      particles: String(atmosphere.particles.geometry.attributes.position.count), lightBeams: String(atmosphere.beams.visible ? atmosphere.beams.count : 0),
      renderedPoints: String(renderer.info.render.points),
      workboatHeight: campus.boats[0].position.y.toFixed(5),
      shorePeople: "5", shoreScenario: shoreLife.scenario, fishing: shoreLife.fishingLines.visible ? "2" : "0",
      shoreRipples: String(shoreLife.rippleCount), harborVehicle: shoreLife.vehicle.position.x.toFixed(3), fishVisible: String(shoreLife.fish.scale.x > .5),
      textures: String(renderer.info.memory.textures), geometries: String(renderer.info.memory.geometries),
    });
    invalidate();
  }
  function syncVisibility() {
    const next = active && !document.hidden && contextAvailable;
    if (visible === next) return;
    visible = next; previousFrame = 0; turntable.setEnabled(visible);
    if (visible) { autoNight.resume(); invalidate(); }
    else { autoNight.pause(); cancelAnimationFrame(frame); frame = 0; }
  }
  function setActive(value: boolean) { if (disposed) return; active = value; syncVisibility(); }
  let lastWidth = 0, lastHeight = 0;
  function onWindowResize() {
    if (!host.clientWidth || !host.clientHeight || (lastWidth === host.clientWidth && lastHeight === host.clientHeight)) return;
    lastWidth = host.clientWidth; lastHeight = host.clientHeight; createResponsiveCamera();
    camera.position.copy(fitPosition); controls.target.copy(defaultTarget); controls.update(); cameraTween = null; invalidate();
  }
  const observer = new ResizeObserver(onWindowResize); observer.observe(host);
  const lost = (event: Event) => { event.preventDefault(); contextAvailable = false; syncVisibility(); };
  const restored = () => { contextAvailable = true; renderer.shadowMap.needsUpdate = true; syncVisibility(); };
  const blurred = () => turntable.cancel();
  const keydown = (event: KeyboardEvent) => {
    if (event.repeat || event.ctrlKey || event.metaKey || event.altKey || event.target !== renderer.domElement) return;
    if (event.key.toLowerCase() === "n") toggleDayNight();
    if (event.key.toLowerCase() === "r") resetView();
  };
  renderer.domElement.addEventListener("webglcontextlost", lost); renderer.domElement.addEventListener("webglcontextrestored", restored); renderer.domElement.addEventListener("keydown", keydown);
  document.addEventListener("visibilitychange", syncVisibility); window.addEventListener("blur", blurred);
  applyLighting(0); options.onModeChange?.(false); onWindowResize();
  camera.position.copy(defaultTarget).add(fitPosition.clone().sub(defaultTarget).multiplyScalar(1.1));
  cameraTween = { from: camera.position.clone(), targetFrom: defaultTarget.clone(), elapsed: 0, duration: 1.1 };
  autoNight.restart(visible); renderer.domElement.dataset.autoNight = "pending"; renderer.shadowMap.needsUpdate = true; invalidate();
  function dispose() {
    if (disposed) return;
    disposed = true; cancelAnimationFrame(frame); frame = 0; autoNight.dispose(); turntable.dispose();
    observer.disconnect(); controls.removeEventListener("start", interactionStarted); controls.removeEventListener("change", invalidate); controls.dispose();
    document.removeEventListener("visibilitychange", syncVisibility); window.removeEventListener("blur", blurred);
    renderer.domElement.removeEventListener("webglcontextlost", lost); renderer.domElement.removeEventListener("webglcontextrestored", restored); renderer.domElement.removeEventListener("keydown", keydown);
    shoreLife.dispose(); atmosphere.dispose(); birds.dispose(); campus.disposeCampus(); sky.geometry.dispose(); sky.material.dispose(); lights.sun.shadow.dispose(); renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove(); scene.clear();
  }
  return { sceneObjects, lights, setDayMode, setNightMode, toggleDayNight, resetView, setActive, dispose };
}
