import * as THREE from "three";

// 使用既有車道的內側通行，避開中央分隔島、柵欄機、交通錐與外側護欄。
export const trafficLayout = Object.freeze({ lane: 1.62, gateZ: 2.79, entryStop: 3.5, exitStop: 2.08, coneX: 2.05 });
export const trafficVehicle = Object.freeze({ halfWidth: .21, halfLength: .44, wheelRadius: .09, wheelBase: .51 });
export const trafficSpeed = 1.65;
const { lane, entryStop, exitStop } = trafficLayout;
const vector = ([x, z]) => new THREE.Vector3(x, 0, z);
function path(points, radius = .22) {
  const vertices = points.map(vector), curve = new THREE.CurvePath();
  let start = vertices[0];
  for (let i = 1; i < vertices.length - 1; i++) {
    const corner = vertices[i], before = vertices[i - 1], after = vertices[i + 1];
    const r = Math.min(radius, corner.distanceTo(before) * .4, corner.distanceTo(after) * .4);
    const a = corner.clone().addScaledVector(before.clone().sub(corner).normalize(), r);
    const b = corner.clone().addScaledVector(after.clone().sub(corner).normalize(), r);
    curve.add(new THREE.LineCurve3(start, a)); curve.add(new THREE.QuadraticBezierCurve3(a, corner, b)); start = b;
  }
  curve.add(new THREE.LineCurve3(start, vertices.at(-1))); return curve;
}
const approach = path([[5.5, 5.85], [3, 5.85], [lane, 4.85], [lane, entryStop]], .65);
const enter = path([[lane, entryStop], [lane, -.5]]);
// 以完整車身淨空校驗的扁弧迴轉，避開分隔島後緣與既有大樓階梯。
const courtyard = new THREE.CurvePath();
courtyard.add(new THREE.CubicBezierCurve3(vector([lane, -.5]), vector([lane, -1.3]), vector([1.6, -1.71]), vector([0, -1.71])));
courtyard.add(new THREE.CubicBezierCurve3(vector([0, -1.71]), vector([-1.6, -1.71]), vector([-lane, -1.3]), vector([-lane, -.5])));
courtyard.add(new THREE.LineCurve3(vector([-lane, -.5]), vector([-lane, .2])));
const exitApproach = path([[-lane, .2], [-lane, exitStop]]);
const leave = path([[-lane, exitStop], [-lane, 4.85], [-.4, 7.2], [2.2, 7.2]], .65);
const returnRoad = path([[2.2, 7.2], [6.8, 7.2], [7.9, 6.7], [7.9, 5.85], [5.5, 5.85]], .4);
const smooth = t => { t = THREE.MathUtils.clamp(t, 0, 1); return t * t * (3 - 2 * t); };

// 停車、抬桿、通過與落桿使用同一時間軸，沒有獨立 timer 或物理模擬。
const phases = [
  { name: "approach", duration: 3, curve: approach },
  { name: "entry-wait", duration: .6, curve: approach, hold: 1 },
  { name: "entry-open", duration: .8, curve: approach, hold: 1 },
  { name: "enter", duration: 2.4, curve: enter },
  { name: "entry-close", duration: .7, curve: enter, hold: 1 },
  { name: "courtyard", duration: 4.8, curve: courtyard },
  { name: "exit-approach", duration: 2.6, curve: exitApproach },
  { name: "exit-wait", duration: .7, curve: exitApproach, hold: 1 },
  { name: "exit-open", duration: .8, curve: exitApproach, hold: 1 },
  { name: "leave", duration: 6, curve: leave },
  { name: "return-road", duration: 6, curve: returnRoad },
];
export const trafficDuration = phases.reduce((sum, phase) => sum + phase.duration, 0);
let start = 0;
export const trafficSchedule = Object.freeze(phases.map(phase => {
  const entry = Object.freeze({ name: phase.name, start, duration: phase.duration, moving: !phase.hold });
  start += phase.duration; return entry;
}));
// 第一輪展示先完成進校，再轉為夜景；夜色完成後才抵達出口。
export const trafficChoreography = Object.freeze({ autoNightDelay: 8, nightTransition: 1.6 });
export function sampleGateTraffic(time, result = { position: new THREE.Vector3(), tangent: new THREE.Vector3(), phase: "", progress: 0, entry: 0, exit: 0 }) {
  let local = ((time % trafficDuration) + trafficDuration) % trafficDuration;
  const phase = phases.find(p => { if (local < p.duration) return true; local -= p.duration; return false; }) ?? phases[0];
  const p = local / phase.duration, progress = phase.hold ?? smooth(p);
  result.position.copy(phase.curve.getPointAt(progress)); result.tangent.copy(phase.curve.getTangentAt(progress));
  result.phase = phase.name; result.progress = progress; result.entry = 0; result.exit = 0;
  if (phase.name === "entry-open") result.entry = smooth(p);
  if (phase.name === "enter") result.entry = 1;
  if (phase.name === "entry-close") result.entry = 1 - smooth(p);
  if (phase.name === "exit-open") result.exit = smooth(p);
  if (phase.name === "leave") result.exit = 1 - smooth((local - 3) / .8);
  return result;
}
