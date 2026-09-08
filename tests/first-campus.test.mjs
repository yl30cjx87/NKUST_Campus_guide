import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";
import * as THREE from "three";
import { TextGeometry } from "three/addons/geometries/TextGeometry.js";
import { FontLoader } from "three/addons/loaders/FontLoader.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { createModelTurntable } from "../app/scene/model-turntable.mjs";
import { createAutoNightSwitch } from "../app/scene/auto-night.mjs";
import { campusForHash, hashForCampus } from "../app/shared/routing/campus-routes.mjs";

function load(name, overrides = {}) {
  const source = readFileSync(new URL(`../app/scene/${name}.ts`, import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const compiledModule = { exports: {} };
  const require = dependency => {
    if (dependency === "three") return { ...THREE, ...overrides };
    if (dependency.includes("TextGeometry")) return { TextGeometry };
    if (dependency.includes("FontLoader")) return { FontLoader };
    if (dependency.endsWith(".json")) return { default: JSON.parse(readFileSync(new URL(`../app/scene/${dependency.slice(2)}`, import.meta.url), "utf8")) };
    if (dependency.includes("RoundedBoxGeometry")) return { RoundedBoxGeometry };
    if (dependency.includes("BufferGeometryUtils")) return { mergeGeometries };
    if (dependency.includes("OrbitControls")) return { OrbitControls: overrides.Controls };
    if (dependency === "./model-turntable.mjs") return { createModelTurntable };
    if (dependency === "./auto-night.mjs") return { createAutoNightSwitch };
    if (["./first-campus-life", "./first-campus-model"].includes(dependency)) return load(dependency.slice(2), overrides);
    throw new Error(`Unexpected dependency ${dependency}`);
  };
  new Function("require", "module", "exports", compiled)(require, compiledModule, compiledModule.exports);
  return compiledModule.exports;
}

function environment(width = 1280, height = 724) {
  const originals = new Map(), frames = new Map(); let nextFrame = 0;
  const set = (key, value) => { originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key)); Object.defineProperty(globalThis, key, { configurable: true, writable: true, value }); };
  const canvas = Object.assign(new EventTarget(), { dataset: {}, style: {}, clientWidth: width, clientHeight: height, setAttribute() {}, remove() { this.removed = true; }, setPointerCapture() {}, hasPointerCapture() { return false; }, releasePointerCapture() {} });
  set("window", Object.assign(new EventTarget(), { devicePixelRatio: 2, matchMedia: query => ({ matches: query.includes("prefers-reduced-motion") ? false : width < 500 }) }));
  set("document", Object.assign(new EventTarget(), { hidden: false, createElement: () => ({ getContext: () => ({ fillText() {} }) }) }));
  set("requestAnimationFrame", callback => { frames.set(++nextFrame, callback); return nextFrame; });
  set("cancelAnimationFrame", id => frames.delete(id));
  const state = {};
  set("ResizeObserver", class { constructor(callback) { this.callback = callback; state.observer = this; } observe() {} disconnect() { this.disconnected = true; } });
  class Renderer {
    constructor() { state.renderer = this; this.domElement = canvas; this.shadowMap = {}; this.info = { render: { triangles: 0, calls: 0 } }; this.renders = 0; }
    setPixelRatio(value) { this.ratio = value; }
    setSize() {}
    render(scene, camera) { this.renders++; this.scene = scene; this.camera = camera; scene.updateMatrixWorld(true); camera.updateMatrixWorld(true); this.shadowMap.needsUpdate = false; }
    dispose() { this.disposed = true; }
    forceContextLoss() { this.contextLost = true; }
  }
  class Controls extends THREE.EventDispatcher {
    constructor(camera) { super(); this.camera = camera; this.target = new THREE.Vector3(); this.touches = {}; }
    update() { this.camera.lookAt(this.target); return false; }
    dispose() {}
  }
  const host = { clientWidth: width, clientHeight: height, appendChild() {} };
  const flush = time => { for (const [id, callback] of [...frames]) { frames.delete(id); callback(time); } };
  const restore = () => { for (const [key, descriptor] of originals) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; } };
  return { state, canvas, frames, host, flush, restore, overrides: { WebGLRenderer: Renderer, Controls } };
}

test("all five campus URLs round-trip without changing existing Jiangong and Cijin links", () => {
  for (const [hash, name] of [["#jiangong", "建工校區"], ["#cijin", "旗津校區"], ["#nanzih", "楠梓校區"], ["#first", "第一校區"], ["#yanchao", "燕巢校區"]]) {
    assert.equal(campusForHash(hash), name); assert.equal(hashForCampus(name), hash);
  }
  for (const hash of ["", "#", "#unknown", "toString"]) assert.equal(campusForHash(hash), undefined);
  assert.equal(hashForCampus("unknown"), undefined);
});

for (const name of ["第一校區"]) {
  test(`${name}: detailed square model, shared materials and 30-40% lit windows`, t => {
    const e = environment(), model = load("first-campus-model").createFirstCampusModel();
    try {
      let triangles = 0, calls = 0;
      model.group.traverse(object => {
        if (!object.isMesh) return;
        triangles += (object.geometry.index?.count ?? object.geometry.attributes.position.count) / 3 * (object.count ?? 1);
        calls++; if (object.castShadow) calls++;
      });
      assert.ok(triangles < 90000, `${triangles} triangles`); assert.ok(calls < 120, `${calls} batches`);
      assert.ok(model.sceneObjects.dome); assert.ok(model.sceneObjects.NKUST);
      assert.ok(model.sceneObjects['entrance-colonnade']);
      assert.ok(model.sceneObjects['badminton-net']); assert.ok(model.sceneObjects['student-live-stage']);
      assert.equal(model.life.stats.dayPlayers, 4); assert.equal(model.life.stats.dayExtras, 3);
      assert.equal(model.life.stats.bandMembers, 4); assert.equal(model.life.stats.audience, 10); assert.equal(model.life.stats.speakers, 2);
      model.life.update(.1, 0, false); assert.equal(model.life.dayGroup.visible, true); assert.equal(model.life.nightGroup.visible, false);
      const shuttle = model.life.dayGroup.getObjectByName('badminton-shuttlecock'), before = shuttle.position.clone();
      model.life.update(.25, 0, false); assert.ok(!shuttle.position.equals(before), 'shuttle follows a visible parabolic route');
      const dayRoots = model.life.dayGroup.children.filter(o => o.name.startsWith('actor-'));
      assert.equal(dayRoots.length, 7); assert.ok(dayRoots.every(o => o.children.length >= 3), 'actors use hierarchical joints');
      for (let i = 0; i < 120; i++) model.life.update(1 / 30, 0, false);
      for (const root of dayRoots) {
        assert.ok(root.position.x >= -6.2 && root.position.x <= 6.2); assert.ok(root.position.z >= -1.25 && root.position.z <= 6.7);
        assert.ok(Math.abs(root.position.y - root.userData.floor) < .03, 'feet remain grounded');
      }
      assert.ok(dayRoots.slice(0, 4).every(o => Math.abs(o.position.z - 2.4) > .45), 'players do not enter the net');
      for (let i = 1; i <= 4; i++) { const racket = model.life.dayGroup.getObjectByName(`player-${i}-racket`); assert.ok(racket?.parent?.parent, 'racket follows the wrist hierarchy'); }
      model.life.update(.1, 1, false); assert.equal(model.life.dayGroup.visible, false); assert.equal(model.life.nightGroup.visible, true);
      const nightRoots = model.life.nightGroup.children.filter(o => o.name.startsWith('actor-'));
      assert.equal(nightRoots.length, 14); assert.ok(model.life.nightGroup.getObjectByName('microphone')?.parent?.parent);
      assert.ok(model.life.nightGroup.getObjectByName('guitar')?.parent?.parent); assert.ok(model.life.nightGroup.getObjectByName('right-drumstick')?.parent?.parent);
      for (const root of nightRoots.slice(0, 4)) { assert.ok(Math.abs(root.position.x) <= 2.2 && root.position.z >= -1.05 && root.position.z <= .65); assert.equal(root.userData.floor, .41); }
      assert.equal(model.bounds.min.x, -9); assert.equal(model.bounds.max.x, 9); assert.equal(model.bounds.min.z, -9); assert.equal(model.bounds.max.z, 9);
      assert.ok(model.bounds.min.y <= -.79); assert.equal(model.group.userData.campus, name);
      assert.ok(model.litWindowCount / model.windowCount >= .3 && model.litWindowCount / model.windowCount <= .4, `${model.litWindowCount}/${model.windowCount}`);
      t.diagnostic(`${triangles} triangles, ${calls} main+shadow batches, ${model.litWindowCount}/${model.windowCount} windows lit`);
    } finally { model.dispose(); model.dispose(); e.restore(); }
  });
  for (const [width, height] of [[1280, 724], [390, 768], [844, 314]]) test(`${name}: day/night, idle, rotation, resize and disposal at ${width}x${height}`, () => {
    const e = environment(width, height), api = load("first-campus", e.overrides).createFirstCampusScene(e.host);
    try {
      e.flush(1); const { renderer } = e.state, model = api.sceneObjects.model, meshes = renderer.scene.children.slice();
      assert.equal(e.canvas.dataset.lighting, "day"); assert.equal(e.canvas.dataset.modelKind, "first-campus-detailed");
      assert.equal(e.canvas.dataset.activity, "badminton"); assert.equal(e.canvas.dataset.dayPlayers, "4");
      assert.equal(e.canvas.dataset.entrance, "entering");
      const bounds = new THREE.Box3().setFromObject(model);
      for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
        const p = new THREE.Vector3(x, y, z).project(renderer.camera); assert.ok(Math.abs(p.x) < 1 && Math.abs(p.y) < 1);
      }
      assert.equal(api.lights.sun.parent, renderer.scene); assert.equal(api.lights.gate.parent, model);
      const cameraBefore = renderer.camera.position.clone();
      e.canvas.dispatchEvent(Object.assign(new Event("pointerdown"), { button: 0, pointerId: 1, clientX: 100, clientY: 100 }));
      e.canvas.dispatchEvent(Object.assign(new Event("pointermove"), { button: 0, pointerId: 1, buttons: 1, clientX: 160, clientY: 120 }));
      e.canvas.dispatchEvent(Object.assign(new Event("pointerup"), { pointerId: 1 }));
      for (let time = 30; time < 2000; time += 34) e.flush(time);
      assert.equal(e.canvas.dataset.entrance, "ready");
      assert.notEqual(e.canvas.dataset.modelRotation, "0.0000"); assert.notEqual(e.canvas.dataset.modelTilt, "0.0000"); assert.ok(renderer.camera.position.equals(cameraBefore));
      assert.ok(Number(e.canvas.dataset.shadowRevision) > 1);
      api.resetView(); for (let time = 2001; time < 3200; time += 34) e.flush(time); assert.equal(e.canvas.dataset.modelRotation, "0.0000"); assert.equal(e.canvas.dataset.modelTilt, "0.0000");
      api.setNightMode(); for (let time = 2035; time < 3900; time += 34) e.flush(time);
      assert.equal(e.canvas.dataset.lighting, "night"); assert.ok(api.lights.gate.intensity > 0);
      assert.equal(e.canvas.dataset.activity, "live"); assert.equal(e.canvas.dataset.bandMembers, "4"); assert.equal(e.canvas.dataset.audience, "10");
      assert.deepEqual(renderer.scene.children, meshes, "Day and night retain the same models");
      api.setDayMode(); e.flush(4000); e.flush(4100); api.setActive(false); assert.equal(e.frames.size, 0);
      api.setActive(true); e.flush(9000); assert.equal(e.canvas.dataset.lighting, "transition", "Suspension must not jump through the transition");
      for (let time = 9034; time < 11000; time += 34) e.flush(time);
      assert.equal(e.canvas.dataset.lighting, "day");
      e.host.clientWidth = height; e.host.clientHeight = width; e.state.observer.callback(); e.flush(11001);
      assert.equal(renderer.camera.aspect, height / width);
      api.dispose(); api.dispose(); assert.equal(e.frames.size, 0); assert.equal(renderer.disposed, true); assert.equal(e.canvas.removed, true); assert.equal(e.state.observer.disconnected, true);
    } finally { api.dispose(); e.restore(); }
  });
}
