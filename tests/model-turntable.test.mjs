import assert from "node:assert/strict";
import test from "node:test";
import { PerspectiveCamera } from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { createModelTurntable } from "../app/scene/model-turntable.mjs";

function harness(t, tiltLimit = Infinity) {
  class Canvas extends EventTarget {
    style = {};
    clientWidth = 1000;
    clientHeight = 800;
    ownerDocument = new EventTarget();
    captures = new Set();
    getRootNode() { return this.ownerDocument; }
    setPointerCapture(id) { this.captures.add(id); }
    hasPointerCapture(id) { return this.captures.has(id); }
    releasePointerCapture(id) { this.captures.delete(id); }
  }
  const canvas = new Canvas();
  const camera = new PerspectiveCamera(36, 1.25, .1, 300);
  camera.position.set(9, 22, 28);
  const orbit = new OrbitControls(camera, canvas);
  orbit.enableRotate = false;
  let redraws = 0;
  const control = createModelTurntable(canvas, { invalidate: () => { redraws++; }, tiltLimit });
  t.after(() => { control.dispose(); orbit.dispose(); });
  function pointer(type, x, y, id = 1, pointerType = "mouse") {
    const fields = { pointerId: id, pointerType, button: 0, buttons: type === "pointerup" ? 0 : 1, clientX: x, clientY: y, pageX: x, pageY: y };
    canvas.dispatchEvent(Object.assign(new Event(type, { cancelable: true }), fields));
    canvas.ownerDocument.dispatchEvent(Object.assign(new Event(type, { cancelable: true }), fields));
  }
  function settle() {
    for (let i = 0; i < 120; i++) { control.update(1 / 60); orbit.update(); }
    assert.equal(control.update(1 / 60), false, "A stopped model must stop requesting frames");
  }
  return { canvas, camera, orbit, control, pointer, settle, get redraws() { return redraws; } };
}

test("harbor tilt stays bounded and reset returns smoothly without changing the camera", t => {
  const h = harness(t, .18), position = h.camera.position.clone();
  h.pointer("pointerdown", 100, 100); h.pointer("pointermove", 550, 1900); h.pointer("pointerup", 550, 1900); h.settle();
  assert.equal(h.control.tilt, .18);
  const angle = h.control.angle;
  h.control.reset(true); assert.equal(h.control.angle, angle);
  h.control.update(1 / 60); assert.ok(h.control.angle < angle && h.control.angle > 0);
  h.settle(); assert.equal(h.control.angle, 0); assert.equal(h.control.tilt, 0);
  assert.ok(h.camera.position.distanceTo(position) < 1e-10);
});

test("diagonal mouse drag changes both model axes while OrbitControls leaves the camera fixed", t => {
  const h = harness(t), cameraPosition = h.camera.position.clone();
  h.pointer("pointerdown", 300, 300);
  h.pointer("pointermove", 500, 440);
  h.pointer("pointerup", 500, 440);
  h.settle();
  assert.ok(h.control.angle > .8);
  assert.ok(h.control.tilt > .5);
  assert.ok(h.camera.position.distanceTo(cameraPosition) < 1e-10);
  assert.ok(h.redraws > 0);
});

test("single-touch vertical drag tilts the model and wheel zoom remains available", t => {
  const h = harness(t);
  h.pointer("pointerdown", 300, 300, 2, "touch");
  h.pointer("pointermove", 300, 460, 2, "touch");
  h.pointer("pointerup", 300, 460, 2, "touch");
  h.settle();
  assert.equal(h.control.angle, 0);
  assert.ok(h.control.tilt > .6);
  const distance = h.camera.position.length();
  h.canvas.dispatchEvent(Object.assign(new Event("wheel", { cancelable: true }), { deltaY: -100, deltaMode: 0, clientX: 500, clientY: 400 }));
  h.settle();
  assert.ok(h.camera.position.length() < distance);
});

test("reset, cancellation and disabling clear both rotation axes and pending movement", t => {
  const h = harness(t);
  h.pointer("pointerdown", 300, 300);
  h.pointer("pointermove", 500, 500);
  h.control.update(1 / 60);
  h.control.cancel();
  const stopped = [h.control.angle, h.control.tilt];
  h.settle();
  assert.deepEqual([h.control.angle, h.control.tilt], stopped);
  h.control.reset();
  assert.deepEqual([h.control.angle, h.control.tilt], [0, 0]);
  h.control.setEnabled(false);
  h.pointer("pointerdown", 300, 300);
  h.pointer("pointermove", 600, 600);
  h.pointer("pointerup", 600, 600);
  h.settle();
  assert.deepEqual([h.control.angle, h.control.tilt], [0, 0]);
});
