"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Minus, Plus, RotateCcw } from "lucide-react";
import type { CampusSelectionMap } from "./scene/campus-map";

type Campus = { name: string; color: number };

export default function CampusMap({ campuses, onSelect }: {
  campuses: readonly Campus[];
  onSelect: (name: string) => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const labels = useRef(new Map<string, HTMLButtonElement>());
  const sceneRef = useRef<CampusSelectionMap | null>(null);
  const selectRef = useRef(onSelect);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [hovered, setHovered] = useState<string | null>(null);

  useEffect(() => { selectRef.current = onSelect; }, [onSelect]);
  useEffect(() => {
    let cancelled = false;
    const host = hostRef.current;
    if (!host) return;
    import("./scene/campus-map").then(({ createCampusSelectionMap }) => {
      if (cancelled) return;
      sceneRef.current = createCampusSelectionMap(host, labels.current, campuses, {
        onSelect: name => selectRef.current(name),
        onHover: setHovered,
      });
      setStatus("ready");
    }).catch(error => {
      if (cancelled) return;
      console.error("校區地圖載入失敗", error);
      setStatus("error");
    });
    return () => {
      cancelled = true;
      sceneRef.current?.dispose();
      sceneRef.current = null;
    };
  }, [campuses]);

  return <section className={`campus-map campus-map--${status}`} aria-label="選擇校區">
    <div ref={hostRef} className="campus-map-canvas" aria-hidden="true" />
    <div className="campus-map-heading"><h1>校區導覽</h1><span aria-hidden="true">NKUST</span></div>
    <div className="campus-map-labels">
      {campuses.map((campus, index) => <button
        key={campus.name}
        type="button"
        ref={element => { if (element) labels.current.set(campus.name, element); else labels.current.delete(campus.name); }}
        className={`campus-map-node campus-map-node--${index}`}
        data-campus={campus.name}
        data-highlighted={hovered === campus.name}
        style={{ "--campus-accent": `#${campus.color.toString(16).padStart(6, "0")}` } as CSSProperties}
        onPointerEnter={() => setHovered(campus.name)}
        onPointerLeave={() => setHovered(null)}
        onFocus={() => setHovered(campus.name)}
        onBlur={() => setHovered(null)}
        onClick={() => onSelect(campus.name)}
      ><span aria-hidden="true" className="campus-map-pin" /><span className="campus-map-name">{campus.name}</span></button>)}
    </div>
    {status === "error" && <p className="campus-map-error" role="status">3D 地圖暫時無法載入，仍可選擇校區。</p>}
    {status === "ready" && <div className="campus-map-tools" aria-label="地圖視角">
      <button type="button" aria-label="放大地圖" title="放大地圖" onClick={() => sceneRef.current?.zoom(1.2)}><Plus size={20} aria-hidden="true" /></button>
      <button type="button" aria-label="縮小地圖" title="縮小地圖" onClick={() => sceneRef.current?.zoom(1 / 1.2)}><Minus size={20} aria-hidden="true" /></button>
      <button type="button" aria-label="重設地圖" title="重設地圖" onClick={() => sceneRef.current?.reset()}><RotateCcw size={18} aria-hidden="true" /></button>
    </div>}
    <div className="campus-map-compass" aria-hidden="true"><span>N</span><i /></div>
  </section>;
}
