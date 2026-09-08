/**
 * 全螢幕必須從點擊事件發起；任一 API 被拒絕時保留手動旋轉的退路。
 * @param {{requestFullscreen?: () => Promise<void>, lock?: () => Promise<void>}} actions
 */
export async function requestLandscapeMode({ requestFullscreen, lock }) {
  let fullscreen = false;
  if (requestFullscreen) {
    try { await requestFullscreen(); fullscreen = true; } catch { /* 瀏覽器可能限制全螢幕，仍嘗試可用的方向 API。 */ }
  }
  if (lock) {
    try { await lock(); return { fullscreen, locked: true }; } catch { /* 不支援自動轉向時，由畫面顯示手動旋轉提示。 */ }
  }
  return { fullscreen, locked: false };
}
