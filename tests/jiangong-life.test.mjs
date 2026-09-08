import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { sampleGateTraffic, trafficDuration, trafficLayout, trafficVehicle, trafficSchedule, trafficSpeed, trafficChoreography } from "../app/scene/jiangong-traffic.mjs";

function createLife(compact = false, reduced = false) {
  const source = readFileSync(new URL("../app/scene/jiangong-life.ts", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const output = { exports: {} };
  new Function("require", "exports", compiled)(name => {
    if (name === "three") return THREE;
    if (name === "three/addons/geometries/RoundedBoxGeometry.js") return { RoundedBoxGeometry };
    if (name === "./jiangong-traffic.mjs") return { sampleGateTraffic, trafficDuration, trafficVehicle };
    throw new Error(name);
  }, output.exports);
  return output.exports.createJiangongLife(compact, reduced);
}
function median(x, z) {
  if (z >= -.85 && z <= 2.68) return Math.abs(x) < 1.045;
  if (z > 2.68) return (x / 1.045) ** 2 + ((z - 2.68) / 1.405) ** 2 < 1;
  return (x / 1.045) ** 2 + ((z + .85) / .635) ** 2 < 1;
}
function checkVehicle(position, heading, time) {
  for (const width of [-trafficVehicle.halfWidth, 0, trafficVehicle.halfWidth]) for (const length of [-trafficVehicle.halfLength, 0, trafficVehicle.halfLength]) {
    const x = position.x + width * Math.cos(heading) + length * Math.sin(heading);
    const z = position.z - width * Math.sin(heading) + length * Math.cos(heading);
    assert.ok(Math.abs(x) < 8.4 && z < 8.05, `outside road ${time}: ${x},${z}`);
    assert.ok(!median(x, z), `median collision ${time}: ${x},${z}`);
    assert.ok(z > -1.95, `entrance steps collision ${time}: ${x},${z}`);
    for (const side of [-1, 1]) assert.ok(Math.abs(x - side * trafficLayout.coneX) > .125 || Math.abs(z - 3.72) > .125, `cone collision at ${time}`);
    if (Math.abs(z - trafficLayout.gateZ) < .08) assert.ok(Math.abs(x) < 2.17, `gate support collision ${time}`);
  }
}

test("traffic uses continuous rounded paths and completes the entry/exit sequence", () => {
  const sequence = [], previous = sampleGateTraffic(0).position.clone();
  for (let t = 0; t < trafficDuration; t += .02) {
    const state = sampleGateTraffic(t);
    if (sequence.at(-1) !== state.phase) sequence.push(state.phase);
    assert.ok(state.position.distanceTo(previous) < .065, `teleport at ${t}`); previous.copy(state.position);
    checkVehicle(state.position, Math.atan2(state.tangent.x, state.tangent.z), t);
    if (Math.abs(state.position.z - trafficLayout.gateZ) < trafficVehicle.halfLength + .08) assert.ok((state.position.x > 0 ? state.entry : state.exit) > .99, `barrier closes onto vehicle at ${t}`);
  }
  assert.deepEqual(sequence, ["approach", "entry-wait", "entry-open", "enter", "entry-close", "courtyard", "exit-approach", "exit-wait", "exit-open", "leave", "return-road"]);
  assert.ok(previous.distanceTo(sampleGateTraffic(0).position) < .01);
  assert.deepEqual(sampleGateTraffic(1).position, sampleGateTraffic(trafficDuration + 1).position);
});
test("both gate waits are stationary and opening finishes before movement resumes", () => {
  for (const phase of trafficSchedule.filter(p => !p.moving)) {
    assert.ok(sampleGateTraffic(phase.start + .01).position.distanceTo(sampleGateTraffic(phase.start + phase.duration - .01).position) < .001);
  }
  for (const phase of trafficSchedule.filter(p => p.name.endsWith("-open"))) {
    const s = sampleGateTraffic(phase.start + phase.duration / 2); assert.equal(s.progress, 1); assert.ok(s.entry > 0 || s.exit > 0);
  }
});
test("car moves faster but eases into each stop and follows continuous headings", () => {
  assert.ok(trafficSpeed >= 1.3 && trafficSpeed <= 1.8);
  for (const phase of trafficSchedule.filter(p => p.moving)) {
    const at = t => sampleGateTraffic(phase.start + t);
    const speed = t => at(t + .01).position.distanceTo(at(t).position) / .01;
    assert.ok(speed(.02) < speed(phase.duration / 2) * .1);
    assert.ok(speed(phase.duration - .03) < speed(phase.duration / 2) * .1);
  }
  for (const phase of trafficSchedule) {
    const a = sampleGateTraffic(phase.start - .001), b = sampleGateTraffic(phase.start + .001);
    assert.ok(a.tangent.angleTo(b.tangent) < .03, `heading jump at ${phase.name}`);
  }
});
test("the first car enters by day and exits only after the night transition", () => {
  const endOf = name => { const phase = trafficSchedule.find(p => p.name === name); return phase.start + phase.duration; };
  const startOf = name => trafficSchedule.find(p => p.name === name).start;
  assert.equal(trafficChoreography.autoNightDelay, 8, "the established eight-second daylight must remain unchanged");
  assert.ok(endOf("entry-close") < trafficChoreography.autoNightDelay, "entry gate should close before dusk");
  assert.ok(trafficChoreography.autoNightDelay + trafficChoreography.nightTransition < startOf("exit-open"), "night should finish before exit gate opens");
});
for (const compact of [false, true]) test(`daily life shares bounded geometry, updates shadows and disposes resources (${compact ? "mobile" : "desktop"})`, t => {
  const life = createLife(compact); let triangles = 0, calls = 0, disposed = 0;
  const resources = new Set();
  life.group.traverse(o => {
    if (o.geometry) resources.add(o.geometry);
    if (o.material) resources.add(o.material);
    if (o.isInstancedMesh) { triangles += (o.geometry.index?.count ?? o.geometry.attributes.position.count) / 3 * o.count; calls += 1 + Number(o.castShadow); }
  });
  assert.ok(triangles < 6000); assert.ok(calls < 18); assert.equal(life.students.length, 3);
  assert.equal(life.vehicle.name, "Campus service car"); assert.equal(life.wheels.length, 4); assert.equal(life.steering.length, 2);
  assert.ok(life.particleCount <= (compact ? 12 : 22)); assert.equal(life.dust.visible, false); assert.equal(life.halos.visible, false);
  const delta = 1 / (compact ? 24 : 30);
  let turned = false, stopped = false;
  for (let t = 0; t < trafficDuration; t += delta) {
    const position = life.vehicle.position.clone(), rotation = life.wheels[0].rotation.x;
    assert.equal(life.update(delta, .8), true); checkVehicle(life.vehicle.position, life.vehicle.rotation.y, t);
    assert.ok(Math.abs(Math.sin(life.vehicle.rotation.y) - life.traffic.tangent.x) < .0001);
    assert.ok(Math.abs(Math.cos(life.vehicle.rotation.y) - life.traffic.tangent.z) < .0001);
    const distance = position.distanceTo(life.vehicle.position);
    assert.ok(Math.abs(life.wheels[0].rotation.x - rotation - distance / trafficVehicle.wheelRadius) < .0001);
    if (life.traffic.phase.endsWith("-wait") && distance === 0) { assert.equal(life.wheels[0].rotation.x, rotation); stopped = true; }
    if (Math.abs(life.steering[0].rotation.y) > .1) turned = true;
    // 轉向後的前輪可能突出車身，另驗輪胎外緣而不只檢查車身中心。
    for (const axle of life.steering) for (const x of [-.034, .034]) for (const z of [-.09, .09]) {
      const edge = new THREE.Vector3(x, 0, z).applyMatrix4(axle.matrixWorld);
      assert.ok(!median(edge.x, edge.z), `steered tire hits median at ${t}`);
      assert.ok(edge.z > -1.95, `steered tire hits steps at ${t}`);
    }
    for (const { root } of life.students) assert.ok(root.position.distanceTo(life.vehicle.position) > .5, `student and car intersect at ${t}`);
  }
  assert.ok(turned); assert.ok(stopped);
  assert.equal(life.dust.visible, true); assert.equal(life.halos.visible, true);
  const before = life.vehicle.position.clone(), clock = life.time;
  assert.equal(life.update(0, 0), false); assert.equal(life.time, clock); assert.deepEqual(life.vehicle.position, before); assert.equal(life.dust.visible, false);
  resources.forEach(r => r.addEventListener("dispose", () => disposed++)); life.dispose(); life.dispose();
  assert.equal(disposed, resources.size); assert.equal(life.group.children.length, 0); assert.equal(life.update(.1, 1), false);
  t.diagnostic(`${triangles} added triangles, ${calls} main + shadow batches, ${life.particleCount} night points`);
});
test("reduced motion freezes people and traffic while retaining night lighting", () => {
  const life = createLife(true, true), position = life.vehicle.position.clone();
  assert.equal(life.moving, false); assert.equal(life.update(10, 1), false);
  assert.deepEqual(life.vehicle.position, position); assert.equal(life.time, 0);
  assert.equal(life.dust.visible, false); assert.equal(life.halos.visible, true); life.dispose();
});
