import { MathUtils } from "three";

/**
 * 單指／左鍵雙軸轉動模型；雙指、滾輪及平移仍交給 OrbitControls。
 * 不自行啟動動畫迴圈，使用場景既有的 update / invalidate。
 * @param {HTMLElement} element
 * @param {{invalidate: () => void, onStart?: () => void, tiltLimit?: number}} callbacks
 */
export function createModelTurntable(element, { invalidate, onStart = () => {}, tiltLimit = Infinity }) {
  let angle = 0, target = 0, enabled = true, disposed = false;
  let tilt = 0, targetTilt = 0;
  /** @type {{id: number, x: number, y: number} | null} */
  let drag = null;
  const pointers = new Set();
  const captured = new Set();
  const previousCursor = element.style.cursor;
  element.style.cursor = "grab";

  function release(id) {
    captured.delete(id);
    if (element.hasPointerCapture(id)) element.releasePointerCapture(id);
  }
  function cancel() {
    drag = null; target = angle; targetTilt = tilt; pointers.clear();
    for (const id of [...captured]) release(id);
    element.style.cursor = "grab";
  }
  function pointerDown(event) {
    if (!enabled || disposed || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    pointers.add(event.pointerId);
    // 第二指落下後，必須全部放開才能再次單指旋轉，避免縮放結束突然跳角度。
    if (pointers.size !== 1) { drag = null; target = angle; targetTilt = tilt; element.style.cursor = "grab"; return; }
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
    element.setPointerCapture(event.pointerId); captured.add(event.pointerId);
    element.style.cursor = "grabbing"; onStart();
  }
  function pointerMove(event) {
    if (!enabled || !drag || drag.id !== event.pointerId || pointers.size !== 1) return;
    if ((event.pointerType === "mouse" && event.buttons === 0) || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) { cancel(); return; }
    const span = Math.max(1, Math.min(element.clientWidth, element.clientHeight));
    target += (event.clientX - drag.x) * Math.PI * 2 * .55 / span;
    targetTilt += (event.clientY - drag.y) * Math.PI * 2 * .55 / span;
    targetTilt = MathUtils.clamp(targetTilt, -tiltLimit, tiltLimit);
    drag.x = event.clientX; drag.y = event.clientY; invalidate();
  }
  function pointerUp(event) {
    pointers.delete(event.pointerId);
    if (drag?.id === event.pointerId) { drag = null; element.style.cursor = "grab"; }
    if (captured.has(event.pointerId)) release(event.pointerId);
  }
  function pointerCancel(event) {
    if (pointers.has(event.pointerId) || captured.has(event.pointerId)) cancel();
  }
  const listeners = { pointerdown: pointerDown, pointermove: pointerMove, pointerup: pointerUp, pointercancel: pointerCancel, lostpointercapture: pointerCancel };
  for (const [type, listener] of Object.entries(listeners)) element.addEventListener(type, listener);

  function update(deltaSeconds) {
    if (!enabled || disposed || (angle === target && tilt === targetTilt)) return false;
    const dt = Math.max(0, Math.min(.05, deltaSeconds));
    angle = MathUtils.damp(angle, target, 18, dt);
    tilt = MathUtils.damp(tilt, targetTilt, 18, dt);
    if (Math.abs(angle - target) < .00005) angle = target;
    if (Math.abs(tilt - targetTilt) < .00005) tilt = targetTilt;
    return true;
  }
  function setEnabled(value) { enabled = value; if (!value) cancel(); }
  function reset(smooth = false) {
    cancel(); target = smooth ? Math.round(angle / (Math.PI * 2)) * Math.PI * 2 : 0; targetTilt = 0;
    if (!smooth) angle = tilt = 0;
    invalidate();
  }
  function dispose() {
    cancel(); disposed = true;
    for (const [type, listener] of Object.entries(listeners)) element.removeEventListener(type, listener);
    element.style.cursor = previousCursor;
  }
  return { update, setEnabled, reset, cancel, dispose, get angle() { return angle; }, get tilt() { return tilt; } };
}
