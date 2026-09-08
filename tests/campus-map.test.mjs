import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import ts from "typescript";

const campuses = ["建工校區", "楠梓校區", "第一校區", "燕巢校區", "旗津校區"].map(name => ({ name, color: 0x448888 }));
const source = readFileSync(new URL("../app/scene/campus-map.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const emblemSource = readFileSync(new URL("../app/scene/campus-emblem.ts", import.meta.url), "utf8");
const compiledEmblem = ts.transpileModule(emblemSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;

// 僅替代 GPU 與瀏覽器生命週期；模型、矩陣、投影和 Raycaster 使用真正的 Three.js。
function fixture(width, height) {
  const originals = new Map(), frames = new Map();
  let nextFrame = 0;
  const state = {};
  const selected = [];
  const canvas = new EventTarget();
  Object.assign(canvas, { dataset: {}, style: {}, remove() {}, getBoundingClientRect: () => ({ left: 0, top: 0, width, height }) });
  const host = { clientWidth: width, clientHeight: height, appendChild() {} };
  const compact = width > height && height < 450;
  const labels = new Map(campuses.map(({ name }) => [name, { offsetWidth: compact || width < 700 ? 96 : 108, offsetHeight: compact ? 48 : width < 700 ? 68 : 76, style: {}, dataset: {} }]));
  function global(name, value) { originals.set(name, Object.getOwnPropertyDescriptor(globalThis, name)); Object.defineProperty(globalThis, name, { configurable: true, writable: true, value }); }
  global("window", Object.assign(new EventTarget(), { devicePixelRatio: 2 }));
  global("document", Object.assign(new EventTarget(), { hidden: false }));
  global("requestAnimationFrame", callback => { frames.set(++nextFrame, callback); return nextFrame; });
  global("cancelAnimationFrame", id => frames.delete(id));
  global("ResizeObserver", class { constructor(callback) { this.callback = callback; state.observer = this; } observe() {} disconnect() { this.disconnected = true; } });
  class Renderer {
    constructor() { state.renderer = this; this.domElement = canvas; this.shadowMap = {}; this.info = { render: {} }; }
    setPixelRatio(ratio) { this.ratio = ratio; }
    setSize() {}
    render(scene, camera) {
      this.scene = scene; this.camera = camera; scene.updateMatrixWorld(true); camera.updateMatrixWorld(true);
      let triangles = 0, calls = 0;
      scene.traverse(object => {
        if (!object.isMesh) return;
        triangles += (object.geometry.index?.count ?? object.geometry.attributes.position.count) / 3 * (object.isInstancedMesh ? object.count : 1);
        calls++;
      });
      this.info.render = { triangles, calls };
    }
    dispose() { this.disposed = true; }
    forceContextLoss() {}
  }
  class Controls extends THREE.EventDispatcher {
    constructor(camera) { super(); this.camera = camera; this.target = new THREE.Vector3(); this.mouseButtons = {}; this.touches = {}; }
    update() { return false; }
    saveState() {}
    reset() {}
    dispose() { this.disposed = true; }
  }
  const compiledModule = { exports: {} };
  const require = name => {
    if (name === "three") return { ...THREE, WebGLRenderer: Renderer };
    if (name.includes("OrbitControls")) return { OrbitControls: Controls };
    if (name.includes("RoundedBoxGeometry")) return { RoundedBoxGeometry };
    if (name.includes("BufferGeometryUtils")) return { mergeGeometries };
    if (name === "./campus-emblem") {
      const emblemModule = { exports: {} };
      new Function("require", "module", "exports", compiledEmblem)(require, emblemModule, emblemModule.exports);
      return emblemModule.exports;
    }
    throw new Error(`Unexpected dependency: ${name}`);
  };
  new Function("require", "module", "exports", compiled)(require, compiledModule, compiledModule.exports);
  const map = compiledModule.exports.createCampusSelectionMap(host, labels, campuses, { onSelect: name => selected.push(name), onHover() {} });
  function flush() { for (const [id, callback] of [...frames]) { frames.delete(id); callback(); } }
  flush();
  function pointer(type, x, y, id = 1) { const event = new Event(type); Object.assign(event, { clientX: x, clientY: y, pointerId: id, pointerType: "mouse", button: 0 }); canvas.dispatchEvent(event); }
  function dispose() { map.dispose(); for (const [key, descriptor] of originals) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; } }
  return { map, renderer: state.renderer, labels, frames, selected, observer: state.observer, pointer, flush, dispose, width, height };
}

for (const [width, height] of [[1280, 716], [390, 772], [320, 496], [844, 338], [667, 323], [568, 268]]) test(`campus map fits five non-overlapping entrances at ${width}x${height}`, t => {
  const f = fixture(width, height);
  try {
    const boxes = [...f.labels.values()].map(label => ({ x: parseFloat(label.style.left) - label.offsetWidth / 2, y: parseFloat(label.style.top) - label.offsetHeight, w: label.offsetWidth, h: label.offsetHeight }));
    for (const box of boxes) { assert.ok(box.x >= 0 && box.y >= 0); assert.ok(box.x + box.w <= width && box.y + box.h <= height); }
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i], b = boxes[j];
      assert.ok(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y, `Campus labels ${i} and ${j} overlap`);
    }
    assert.equal(f.renderer.ratio, 1.5);
    assert.ok(f.renderer.info.render.triangles < 50000, `Triangles: ${f.renderer.info.render.triangles}`);
    assert.ok(f.renderer.info.render.calls < 100, `Draw calls before shadows: ${f.renderer.info.render.calls}`);
    t.diagnostic(`Geometry budget: ${f.renderer.info.render.triangles} triangles, ${f.renderer.info.render.calls} main-pass batches (GPU render is not simulated).`);
    assert.equal(f.frames.size, 0, "No continuous animation while idle");
    const emblem = f.renderer.scene.getObjectByName("NKUST-emblem");
    assert.ok(emblem, "Central native 3D emblem is present");
    let emblemMeshes = 0;
    emblem.traverse(object => { if (object.isMesh) { emblemMeshes++; assert.equal(object.material.map, null); } });
    assert.equal(emblemMeshes, 4, "Three combined colors and one pedestal");
  } finally { f.dispose(); }
});

test("model clicks select each campus, but dragging or multitouch does not", () => {
  const f = fixture(1280, 716);
  try {
    for (const { name } of campuses) {
      const group = f.renderer.scene.getObjectByName(name);
      const point = new THREE.Vector3(0, .06, 1.1).applyMatrix4(group.matrixWorld).project(f.renderer.camera);
      const x = (point.x * .5 + .5) * f.width, y = (-point.y * .5 + .5) * f.height;
      f.pointer("pointerdown", x, y); f.pointer("pointerup", x, y);
      assert.equal(f.selected.at(-1), name);
      const count = f.selected.length;
      f.pointer("pointerdown", x, y); f.pointer("pointermove", x + 20, y); f.pointer("pointerup", x, y);
      assert.equal(f.selected.length, count);
      f.pointer("pointerdown", x, y); f.pointer("pointerdown", x, y, 2); f.pointer("pointerup", x, y, 2); f.pointer("pointerup", x, y);
      assert.equal(f.selected.length, count);
    }
    f.map.zoom(1.2); f.flush(); assert.equal(f.renderer.camera.zoom, 1.2);
    f.map.reset(); f.flush(); assert.equal(f.renderer.camera.zoom, 1);
  } finally { f.dispose(); }
  assert.equal(f.renderer.disposed, true);
  assert.equal(f.observer.disconnected, true);
  assert.equal(f.frames.size, 0);
});
