import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import ts from "typescript";
import { createBoatAnimations } from "../app/scene/harbor-motion.mjs";
import { createModelTurntable } from "../app/scene/model-turntable.mjs";
import { createAutoNightSwitch } from "../app/scene/auto-night.mjs";
import * as harborWaves from "../app/scene/harbor-waves.mjs";

function load(name, overrides = {}) {
  const source = readFileSync(new URL(`../app/scene/${name}.ts`, import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const compiledModule = { exports: {} };
  const require = dependency => {
    if (dependency === "three") return { ...THREE, ...overrides };
    if (dependency.includes("RoundedBoxGeometry")) return { RoundedBoxGeometry };
    if (dependency.includes("BufferGeometryUtils")) return { mergeGeometries };
    if (dependency.includes("OrbitControls")) return { OrbitControls: overrides.Controls };
    if (dependency === "./harbor-motion.mjs") return { createBoatAnimations };
    if (dependency === "./model-turntable.mjs") return { createModelTurntable };
    if (dependency === "./auto-night.mjs") return { createAutoNightSwitch };
    if (dependency === "./harbor-waves.mjs") return harborWaves;
    if (["./campus-emblem", "./cijin-model", "./harbor-life", "./harbor-atmosphere", "./cijin-shore-life"].includes(dependency)) return load(dependency.slice(2), overrides);
    throw new Error(`Unexpected dependency ${dependency}`);
  };
  new Function("require", "module", "exports", compiled)(require, compiledModule, compiledModule.exports);
  return compiledModule.exports;
}

function environment(width = 1280, height = 724) {
  const originals = new Map(), frames = new Map(); let nextFrame = 0;
  function set(name, value) { originals.set(name, Object.getOwnPropertyDescriptor(globalThis, name)); Object.defineProperty(globalThis, name, { configurable: true, writable: true, value }); }
  const canvas = Object.assign(new EventTarget(), { dataset: {}, style: {}, clientWidth: width, clientHeight: height, setAttribute() {}, remove() { this.removed = true; }, hasPointerCapture() { return false; }, releasePointerCapture() {} });
  set("window", Object.assign(new EventTarget(), { devicePixelRatio: 2, matchMedia: () => ({ matches: height < 500 }), setTimeout, clearTimeout }));
  set("navigator", { hardwareConcurrency: 8 });
  set("document", Object.assign(new EventTarget(), { hidden: false, createElement: () => ({ getContext: () => ({ fillText() {} }) }) }));
  set("requestAnimationFrame", callback => { frames.set(++nextFrame, callback); return nextFrame; });
  set("cancelAnimationFrame", id => frames.delete(id));
  const state = {};
  set("ResizeObserver", class { constructor(callback) { this.callback = callback; state.observer = this; } observe() {} disconnect() { this.disconnected = true; } });
  class Renderer {
    constructor() { state.renderer = this; this.domElement = canvas; this.shadowMap = {}; this.debug = {}; this.info = { render: { triangles: 0, calls: 0, points: 0 }, memory: {} }; }
    setPixelRatio(value) { this.ratio = value; }
    setSize() {}
    render(scene, camera) { this.scene = scene; this.camera = camera; scene.updateMatrixWorld(true); camera.updateMatrixWorld(true); }
    dispose() { this.disposed = true; }
    forceContextLoss() { this.contextLost = true; }
  }
  class Controls extends THREE.EventDispatcher {
    constructor(camera) { super(); this.camera = camera; this.target = new THREE.Vector3(); this.touches = {}; }
    update() { this.camera.lookAt(this.target); }
    dispose() { this.disposed = true; }
  }
  const host = { clientWidth: width, clientHeight: height, appendChild() {} };
  function flush(time) { for (const [id, callback] of [...frames]) { frames.delete(id); callback(time); } }
  function restore() { for (const [key, descriptor] of originals) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; } }
  return { state, frames, canvas, host, flush, restore, overrides: { WebGLRenderer: Renderer, Controls } };
}

test("harbor has four boats, one square base, bounded geometry and varied 30-40% night windows", t => {
  const e = environment(), campus = load("cijin-model").createCijinCampus();
  try {
    let triangles = 0, batches = 0, shadowBatches = 0;
    campus.campusGroup.traverse(object => {
      if (!object.isMesh) return;
      triangles += (object.geometry.index?.count ?? object.geometry.attributes.position.count) / 3 * (object.count ?? 1);
      batches++; if (object.castShadow) shadowBatches++;
      assert.ok(Array.from(object.geometry.attributes.position.array).every(Number.isFinite));
    });
    assert.equal(campus.boats.length, 4);
    assert.equal(campus.boats[0].scale.x, 1.2, "Training vessel is 20% larger");
    assert.ok(campus.windowCount < 372, "Improve silhouette without adding more windows");
    assert.ok(campus.bounds.min.y <= -1.49, "Solid 1.5-unit display plinth");
    assert.ok(triangles < 35000, `Triangles ${triangles}`);
    assert.ok(batches + shadowBatches < 100, `Main and shadow batches ${batches + shadowBatches}`);
    assert.ok(campus.bounds.min.x >= -11.2 && campus.bounds.max.x <= 11.2, JSON.stringify(campus.bounds));
    assert.ok(campus.bounds.min.z >= -11.2 && campus.bounds.max.z <= 11.2);
    const lit = (campus.brightCount + campus.dimCount) / campus.windowCount;
    assert.ok(lit >= .3 && lit <= .4); assert.ok(campus.brightCount > 0 && campus.dimCount > 0);
    for (const boat of campus.boats) assert.equal(boat.parent, campus.campusGroup);
    assert.equal(campus.water.parent, campus.campusGroup);
    t.diagnostic(`${Math.round(triangles)} triangles; ${batches} main / ${shadowBatches} shadow batches; ${(lit * 100).toFixed(1)}% lit windows.`);
  } finally { campus.disposeCampus(); e.restore(); }
});

test("recessed window cells have real openings and lights are grouped into rooms", () => {
  const e = environment(), campus = load("cijin-model").createCijinCampus();
  try {
    assert.equal(campus.windowRooms.reduce((sum, room) => sum + room.count, 0), campus.windowCount);
    for (const room of campus.windowRooms) assert.ok(room.count === 2 || room.count === 3);
    const frames = [];
    campus.campusGroup.traverse(object => { if (object.isInstancedMesh && object.geometry.type === "ExtrudeGeometry") frames.push(object); });
    assert.ok(frames.length >= 3 && frames.length <= 4, "Window regions share a small number of frame geometries");
    for (const frame of frames) {
      frame.geometry.computeBoundingBox();
      assert.ok(Math.abs(frame.geometry.boundingBox.min.z + .18) < 1e-5);
      const matrix = new THREE.Matrix4(); frame.getMatrixAt(0, matrix); matrix.premultiply(frame.matrixWorld);
      function hitsFirst(x, y) {
        const origin = new THREE.Vector3(x, y, .5).applyMatrix4(matrix), target = new THREE.Vector3(x, y, -.3).applyMatrix4(matrix);
        const ray = new THREE.Raycaster(origin, target.sub(origin).normalize(), 0, 1);
        return ray.intersectObject(frame).some(hit => hit.instanceId === 0);
      }
      assert.equal(hitsFirst(0, 0), false, "The window opening is not a solid face");
      assert.equal(hitsFirst(.47, .46), true, "The surrounding wall has actual depth");
    }
  } finally { campus.disposeCampus(); e.restore(); }
});

test("boats and surface-following wake stay inside the harbor through a curved loop", () => {
  const e = environment(), campus = load("cijin-model").createCijinCampus();
  try {
    const initial = campus.boats.map(boat => boat.position.clone()), animation = createBoatAnimations(campus.boats, campus.radar, campus.wake);
    const headings = new Set();
    for (let seconds = 0; seconds <= 280; seconds += .5) {
      animation.update(seconds); campus.campusGroup.updateMatrixWorld(true);
      for (let i = 0; i < 4; i++) {
        const boat = campus.boats[i];
        assert.ok(Math.abs(boat.position.y - initial[i].y) <= .061);
        assert.ok(Math.abs(boat.rotation.x) < .03 && Math.abs(boat.rotation.z) < .03);
        if (i < 3) { assert.equal(boat.position.x, initial[i].x); assert.equal(boat.position.z, initial[i].z); }
        const box = new THREE.Box3().setFromObject(boat);
        assert.ok(box.min.x >= -11 && box.max.x <= 11 && box.min.z >= 3.58 && box.max.z <= 10.98, `Boat or wake left water at ${seconds}: ${JSON.stringify(box)}`);
      }
      assert.ok(Math.abs(campus.boats[0].rotation.x) <= .0061 && Math.abs(campus.boats[0].rotation.z) <= .0051);
      assert.equal(campus.wake.position.y, harborWaves.HARBOR_WATER_LEVEL); assert.equal(campus.wake.rotation.x, 0); assert.equal(campus.wake.rotation.z, 0);
      for (let i = 0; i < campus.boats.length; i++) {
        const boat = campus.boats[i], wave = harborWaves.sampleHarborWave(boat.position.x, boat.position.z, seconds);
        assert.ok(Math.abs(boat.position.y - initial[i].y - wave.height) < 1e-9, "Boat and rendered water share their wave phase");
      }
      assert.equal(campus.wake.position.x, campus.boats[3].position.x); assert.equal(campus.wake.position.z, campus.boats[3].position.z);
      const wakeBox = new THREE.Box3().setFromObject(campus.wake);
      assert.ok(wakeBox.min.x >= -11 && wakeBox.max.x <= 11 && wakeBox.min.z >= 3.58 && wakeBox.max.z <= 10.98, `Wake outside harbor at ${seconds}`);
      headings.add(Math.round(campus.boats[3].rotation.y * 10));
    }
    assert.ok(Math.abs(campus.radar.rotation.y) > 1);
    assert.ok(headings.size > 30, "Small workboat follows a curve, not a straight ping-pong path");
    campus.campusGroup.rotation.y = 1;
    campus.campusGroup.updateMatrixWorld(true);
    const local = campus.boats[3].position.clone(), world = campus.boats[3].getWorldPosition(new THREE.Vector3());
    assert.ok(world.distanceTo(local.applyMatrix4(campus.campusGroup.matrixWorld)) < 1e-9);
  } finally { campus.disposeCampus(); e.restore(); }
});

test("three shared harbor waves remain small, attenuate near shore and produce accurate normals", () => {
  assert.equal(harborWaves.HARBOR_WAVES.length, 3);
  const amplitude = harborWaves.HARBOR_WAVES.reduce((sum, wave) => sum + wave.amplitude, 0);
  assert.ok(amplitude >= .034 && amplitude <= .036, "base waves stay moderate before the stronger daytime multiplier");
  const result = { height: 0, dx: 0, dz: 0 }, epsilon = .0001;
  let nearEnergy = 0, farEnergy = 0;
  for (let time = 0; time < 120; time += .7) for (const z of [3.58, 4.1, 6.4, 9.8]) {
    const x = Math.sin(time) * 9;
    assert.equal(harborWaves.sampleHarborWave(x, z, time, result), result);
    assert.ok(Math.abs(result.height) <= .0351);
    const dx = (harborWaves.sampleHarborWave(x + epsilon, z, time).height - harborWaves.sampleHarborWave(x - epsilon, z, time).height) / (2 * epsilon);
    const dz = (harborWaves.sampleHarborWave(x, z + epsilon, time).height - harborWaves.sampleHarborWave(x, z - epsilon, time).height) / (2 * epsilon);
    assert.ok(Math.abs(dx - result.dx) < 1e-5 && Math.abs(dz - result.dz) < 1e-5);
    if (z === 3.58) nearEnergy += result.height ** 2;
    if (z === 6.4) farEnergy += result.height ** 2;
  }
  assert.ok(nearEnergy < farEnergy * .15, "Quay waves must be calmer than open harbor water");
});

for (const compact of [false, true]) test(`shore life tells different day and night stories (${compact ? "mobile" : "desktop"})`, () => {
  const e = environment(), campus = load("cijin-model").createCijinCampus();
  const life = load("cijin-shore-life").createCijinShoreLife(campus.campusGroup, campus.boats, compact);
  try {
    let triangles = 0, calls = 0;
    life.group.traverse(object => {
      if (!object.geometry) return;
      triangles += (object.geometry.index?.count ?? object.geometry.attributes.position.count) / 3 * (object.count ?? 1);
      calls += 1 + Number(object.castShadow);
    });
    assert.equal(life.students.length, 4); assert.equal(life.rippleCount, compact ? 9 : 12);
    assert.ok(triangles < 9000 && calls < 22, `${triangles} triangles / ${calls} calls`);
    life.update(7.8, 1.42);
    assert.equal(life.scenario, "day"); assert.equal(life.fishingLines.visible, false); assert.equal(life.bobbers.visible, false);
    for (const student of life.students) assert.ok(student.root.scale.x < .01, "students walk through the entrance before hiding");
    const vehicleX = life.vehicle.position.x; life.update(8.2, 1.42); assert.notEqual(life.vehicle.position.x, vehicleX);
    life.setScenario(true); life.setNight(1); life.update(10, .72);
    assert.equal(life.scenario, "night"); assert.ok(life.students[0].root.scale.x > .9, "first student emerges after the night transition");
    life.update(18.5, .72); assert.equal(life.fishingLines.visible, true); assert.equal(life.bobbers.visible, true);
    assert.ok(life.students[0].root.position.z > 3.1 && life.students[1].root.position.z > 3.1, "anglers reach the quay before fishing");
    let fishSeen = false, splashSeen = false;
    for (let seconds = 18.5; seconds < 31; seconds += .08) { life.update(seconds, .72); fishSeen ||= life.fish.scale.x > .5; splashSeen ||= life.droplets.some(drop => drop.scale.x > .05); }
    assert.ok(fishSeen && splashSeen, "hooked fish and its small splash both become visible");
    life.setScenario(false); life.setNight(0); life.update(31.1, 1.42);
    assert.equal(life.fishingLines.visible, false); assert.ok(life.fish.scale.x < .01); assert.equal(life.scenario, "day");
    life.dispose(); assert.equal(life.group.parent, null); assert.equal(life.group.children.length, 0);
  } finally { life.dispose(); campus.disposeCampus(); e.restore(); }
});

test("harbor details share low-cost batches and moorings follow boats without moving dock ends", () => {
  const e = environment(), campus = load("cijin-model").createCijinCampus();
  try {
    const { life } = campus;
    assert.equal(life.cables.length, 6); assert.equal(life.ropes.geometry.attributes.position.count, 60);
    assert.equal(life.reflectionMesh.count, 39); assert.equal(life.reflectionMesh.visible, false);
    assert.ok(campus.interiorWindowCount > 0 && campus.interiorWindowCount < 35);
    assert.equal(campus.sceneObjects.windowInteriors.count, campus.interiorWindowCount * 2);
    for (const details of campus.shipDetails) {
      assert.deepEqual(details.lights.map(light => light.kind), ["port", "starboard", "mast"]);
      assert.ok(details.lights[0].position.z < 0 && details.lights[1].position.z > 0);
      assert.equal(details.lights[0].color, 0xff654c); assert.equal(details.lights[1].color, 0x54dc9e); assert.equal(details.lights[2].color, 0xfff4e7);
    }
    const animation = createBoatAnimations(campus.boats, campus.radar, campus.wake), matrix = new THREE.Matrix4(), p = new THREE.Vector3();
    life.setNight(1); assert.equal(life.reflections.uniforms.opacity.value, .19);
    for (let seconds = 0; seconds <= 140; seconds += 7) {
      animation.update(seconds); life.update(seconds);
      const vertices = life.ropes.geometry.attributes.position;
      life.cables.forEach((cable, i) => {
        assert.ok(p.fromBufferAttribute(vertices, i * 10).distanceTo(cable.dock) < 1e-6);
        const endpoint = cable.local.clone().applyMatrix4(campus.boats[cable.boatIndex].matrix);
        assert.ok(p.fromBufferAttribute(vertices, i * 10 + 9).distanceTo(endpoint) < 1e-6);
      });
      for (let i = 0; i < life.reflectionMesh.count; i++) {
        life.reflectionMesh.getMatrixAt(i, matrix); p.setFromMatrixPosition(matrix);
        assert.ok(Math.abs(p.x) < 11 && p.z > 3.58 && p.z < 10.98 && Math.abs(p.y - .158) < 1e-6);
      }
    }
    life.setNight(0); assert.equal(life.reflectionMesh.visible, false);
    let disposed = 0;
    life.ropes.geometry.addEventListener("dispose", () => disposed++);
    life.reflections.addEventListener("dispose", () => disposed++);
    campus.disposeCampus(); assert.equal(disposed, 2);
  } finally { campus.disposeCampus(); e.restore(); }
});

test("three distant silhouettes reuse the harbor clock and do not affect model bounds", () => {
  const time = { value: 0 }, night = { value: 0 }, aspect = { value: 1.8 };
  const birds = load("harbor-life").createDistantSeabirds(time, night, aspect);
  assert.equal(birds.mesh.count, 3); assert.equal(birds.mesh.geometry.attributes.position.count, 12);
  assert.equal(birds.mesh.material.uniforms.time, time); assert.equal(birds.mesh.material.uniforms.night, night);
  assert.equal(birds.mesh.castShadow, false); assert.equal(birds.mesh.material.depthWrite, false);
  let disposed = 0; birds.mesh.geometry.addEventListener("dispose", () => disposed++); birds.mesh.material.addEventListener("dispose", () => disposed++);
  birds.dispose(); assert.equal(disposed, 2);
});

for (const compact of [false, true]) test(`GPU atmosphere is bounded, shared and disposable (${compact ? "mobile" : "desktop"})`, () => {
  const e = environment(), campus = load("cijin-model").createCijinCampus();
  const time = campus.waterTime, night = { value: 0 };
  const atmosphere = load("harbor-atmosphere").createHarborAtmosphere(campus.campusGroup, campus.boats[0], campus.workLight, time, night, compact);
  try {
    assert.equal(atmosphere.particles.geometry.attributes.position.count, compact ? 56 : 92);
    assert.equal(atmosphere.beams.count, 5); assert.equal(atmosphere.beams.castShadow, false);
    assert.equal(atmosphere.beams.material.blending, THREE.AdditiveBlending); assert.equal(atmosphere.beams.material.depthWrite, false);
    assert.equal(atmosphere.particles.material.uniforms.time, time); assert.equal(atmosphere.particles.material.uniforms.night, night);
    const animation = createBoatAnimations(campus.boats, campus.radar, campus.wake), matrix = new THREE.Matrix4();
    const version = atmosphere.particles.geometry.attributes.position.version;
    for (const seconds of [0, 20, 106, 140, 280]) {
      night.value = seconds ? 1 : 0; animation.update(seconds); atmosphere.update(seconds, animation.sampleLaunch);
      assert.equal(atmosphere.beams.visible, Boolean(seconds));
      assert.equal(atmosphere.particles.geometry.attributes.position.version, version, "Particle positions stay on the GPU");
      for (let i = 0; i < 8; i++) {
        const expected = animation.sampleLaunch(seconds - i * .6, new THREE.Vector4());
        assert.ok(atmosphere.trail[i].clone().sub(expected).length() < 1e-9);
        assert.ok(Math.abs(expected.x) < 9 && expected.y > 6.5 && expected.y < 9.5);
      }
      if (seconds) {
        atmosphere.beams.getMatrixAt(4, matrix);
        const lamp = campus.workLight.clone().applyMatrix4(campus.boats[0].matrix);
        assert.ok(new THREE.Vector3().setFromMatrixPosition(matrix).distanceTo(lamp) < 1e-6);
      }
    }
    assert.ok(campus.wake.geometry.index.count / 3 <= 16); assert.equal(campus.wake.material.uniforms.time, time);
    assert.match(campus.wake.material.fragmentShader, /pow\(1\.-wakeUv.y/);
    assert.match(campus.life.reflections.vertexShader, /harborWave\(p.xz,time\)/);
    let disposed = 0;
    for (const object of [atmosphere.particles, atmosphere.beams]) for (const resource of [object.geometry, object.material]) resource.addEventListener("dispose", () => disposed++);
    atmosphere.dispose(); assert.equal(disposed, 4);
  } finally { atmosphere.dispose(); campus.disposeCampus(); e.restore(); }
});

for (const [width, height] of [[1280, 724], [390, 710], [844, 322], [568, 240]]) test(`harbor lifecycle, day/night and camera fit at ${width}x${height}`, () => {
  const e = environment(width, height), api = load("cijin", e.overrides).createCijinScene(e.host);
  try {
    for (let time = 1; time < 1800; time += 34) e.flush(time);
    const { renderer } = e.state, meshes = renderer.scene.children.slice(), camera = renderer.camera;
    const group = api.sceneObjects.model, sun = api.lights.sun;
    assert.equal(sun.parent, renderer.scene); assert.equal(api.lights.dockLeft.parent, group);
    assert.equal(e.canvas.dataset.lighting, "day");
    assert.equal(e.canvas.dataset.seabirds, "3"); assert.equal(e.canvas.dataset.reflections, "0");
    assert.equal(e.canvas.dataset.lightBeams, "0"); assert.equal(Number(e.canvas.dataset.particles), Math.min(width, height) < 500 ? 56 : 92);
    assert.equal(api.sceneObjects.windowInteriors.visible, false);
    let pointLights = 0; renderer.scene.traverse(object => { if (object.isPointLight) pointLights++; });
    assert.equal(pointLights, 3, "Decorations must not add real lights");
    const bounds = new THREE.Box3().setFromObject(group);
    for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
      const point = new THREE.Vector3(x, y, z).project(camera);
      assert.ok(Math.abs(point.x) < 1 && Math.abs(point.y) < 1, `Clipped ${point.toArray()}`);
    }
    const boatBefore = e.canvas.dataset.boatX;
    const dayAmbient = api.lights.hemisphere.intensity, daySun = sun.intensity;
    api.setNightMode(); for (let time = 1800; time < 3600; time += 34) e.flush(time);
    assert.equal(e.canvas.dataset.lighting, "night"); assert.notEqual(e.canvas.dataset.boatX, boatBefore);
    assert.equal(e.canvas.dataset.seabirds, "0"); assert.equal(e.canvas.dataset.reflections, "39");
    assert.equal(e.canvas.dataset.lightBeams, "5");
    assert.equal(api.sceneObjects.windowInteriors.visible, true);
    assert.ok(api.lights.hemisphere.intensity < dayAmbient * .3 && sun.intensity < daySun * .05);
    assert.ok(api.lights.dockLeft.distance < 5 && api.lights.dockLeft.intensity < 5);
    assert.ok(api.lights.dockLeft.color.r > api.lights.dockLeft.color.b * 2, "Quay lights stay warm");
    assert.deepEqual(renderer.scene.children, meshes, "No model rebuild on day/night");
    api.setDayMode(); for (let time = 3600; time < 5500; time += 34) e.flush(time);
    assert.equal(e.canvas.dataset.lighting, "day");
    api.setActive(false); assert.equal(e.frames.size, 0);
    api.setActive(true); assert.equal(e.frames.size, 1); e.flush(10000);
    assert.equal(sun.castShadow, true); assert.equal(api.lights.dockLeft.castShadow, false);
    assert.ok(renderer.ratio <= 1.5);
    api.dispose(); api.dispose(); assert.equal(e.frames.size, 0); assert.equal(renderer.disposed, true); assert.equal(renderer.contextLost, true); assert.equal(e.canvas.removed, true); assert.equal(e.state.observer.disconnected, true);
  } finally { api.dispose(); e.restore(); }
});
