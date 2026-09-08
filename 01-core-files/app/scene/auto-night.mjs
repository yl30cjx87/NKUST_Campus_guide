/**
 * 單次可暫停計時器，與場景的日夜過渡分開；手動切換不重設計時。
 * @param {() => void} onNight
 * @param {{delay?: number, now?: () => number, schedule?: (callback: () => void, ms: number) => unknown, cancel?: (handle: any) => void}} options
 */
export function createAutoNightSwitch(onNight, {
  delay = 8000,
  now = () => performance.now(),
  schedule = (callback, ms) => setTimeout(callback, ms),
  cancel = handle => clearTimeout(handle),
} = {}) {
  let remaining = delay, startedAt = 0, running = false, done = false, disposed = false;
  let handle = null;
  function pause() {
    if (!running) return;
    remaining = Math.max(0, remaining - (now() - startedAt));
    cancel(handle); handle = null; running = false;
  }
  function resume() {
    if (disposed || done || running) return;
    running = true; startedAt = now();
    handle = schedule(() => {
      handle = null; running = false; done = true; remaining = 0;
      onNight();
    }, remaining);
  }
  function restart(visible = true) {
    if (disposed) return;
    pause(); remaining = delay; done = false;
    if (visible) resume();
  }
  function getState() {
    return {
      status: disposed ? "disposed" : done ? "done" : running ? "pending" : "paused",
      remainingMs: Math.max(0, remaining - (running ? now() - startedAt : 0)),
    };
  }
  function dispose() { pause(); disposed = true; }
  return { restart, pause, resume, dispose, getState };
}
