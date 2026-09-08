"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { Maximize, Smartphone } from "lucide-react";
import { requestLandscapeMode } from "./landscape-mode.mjs";

const portraitQuery = "(max-width: 600px) and (orientation: portrait), (pointer: coarse) and (max-width: 1024px) and (orientation: portrait)";
const subscribe = (callback: () => void) => {
  const query = window.matchMedia(portraitQuery);
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
};
const isPortraitPhone = () => window.matchMedia(portraitQuery).matches;
type LockableOrientation = ScreenOrientation & { lock?: (orientation: "landscape") => Promise<void> };

export default function LandscapeExperience({ children }: { children: ReactNode }) {
  const portrait = useSyncExternalStore(subscribe, isPortraitPhone, () => false);
  const [dismissed, setDismissed] = useState(false);
  const [pending, setPending] = useState(false);
  const [manual, setManual] = useState(false);
  const ownedLock = useRef(false);
  const mounted = useRef(true);
  const primary = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLElement>(null);
  const showing = portrait && !dismissed;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (ownedLock.current) { window.screen.orientation?.unlock?.(); ownedLock.current = false; }
    };
  }, []);
  useEffect(() => {
    if (!showing) return;
    const previous = document.activeElement;
    primary.current?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDismissed(true);
      if (event.key !== "Tab") return;
      const buttons = dialog.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)");
      if (!buttons?.length) return;
      const first = buttons[0], last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", keydown);
    return () => {
      document.removeEventListener("keydown", keydown);
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  }, [showing]);

  async function enterLandscape() {
    if (pending) return;
    setPending(true);
    const orientation = window.screen.orientation as LockableOrientation | undefined;
    const root = document.documentElement;
    const result = await requestLandscapeMode({
      requestFullscreen: document.fullscreenElement ? undefined : root.requestFullscreen?.bind(root),
      lock: orientation?.lock ? () => orientation.lock!("landscape") : undefined,
    });
    if (!mounted.current) { if (result.locked) orientation?.unlock(); return; }
    ownedLock.current ||= result.locked;
    setManual(!result.locked);
    setPending(false);
  }

  return <>
    <div className="orientation-content" inert={showing} aria-hidden={showing || undefined}>{children}</div>
    {showing && <section ref={dialog} className="landscape-entry" role="dialog" aria-modal="true" aria-labelledby="landscape-title" aria-describedby="landscape-message">
      <Smartphone size={54} strokeWidth={1.5} className="landscape-phone" aria-hidden="true" />
      <h2 id="landscape-title">橫式校園導覽</h2>
      <p id="landscape-message" role="status">{manual ? "此瀏覽器無法自動轉向，請將手機轉為橫向。" : "請將手機轉為橫向，或開啟橫式全螢幕。"}</p>
      <button ref={primary} type="button" className="landscape-start" disabled={pending} onClick={enterLandscape}><Maximize size={19} aria-hidden="true" />{pending ? "正在開啟" : "橫式全螢幕"}</button>
      <button type="button" className="landscape-skip" onClick={() => setDismissed(true)}>先以直式瀏覽</button>
    </section>}
  </>;
}
