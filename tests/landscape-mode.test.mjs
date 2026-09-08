import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { requestLandscapeMode } from "../app/features/landscape/landscape-mode.mjs";

test("landscape request enters fullscreen before requesting orientation", async () => {
  const calls = [];
  const result = await requestLandscapeMode({ requestFullscreen: async () => { calls.push("fullscreen"); }, lock: async () => { calls.push("landscape"); } });
  assert.deepEqual(calls, ["fullscreen", "landscape"]);
  assert.deepEqual(result, { fullscreen: true, locked: true });
});

test("unsupported or denied orientation falls back without rejecting", async () => {
  assert.deepEqual(await requestLandscapeMode({}), { fullscreen: false, locked: false });
  const denied = async () => { throw new Error("Browser denied this operation"); };
  assert.deepEqual(await requestLandscapeMode({ requestFullscreen: denied, lock: denied }), { fullscreen: false, locked: false });
  assert.deepEqual(await requestLandscapeMode({ requestFullscreen: async () => {}, lock: denied }), { fullscreen: true, locked: false });
});

test("orientation can still work when fullscreen is already active or unavailable", async () => {
  assert.deepEqual(await requestLandscapeMode({ lock: async () => {} }), { fullscreen: false, locked: true });
});

test("all campus games keep clickable targets on the map and dock only the expanded content", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(page, /mode === "map" \? " art-game"/);
  const layout = page.slice(page.indexOf('<div className="art-game-layout">'), page.indexOf('{mode==="map"&&showConfetti'));
  assert.match(layout, /<aside className="art-game-panel"/);
  assert.doesNotMatch(layout, /className="art-targets"/);
  assert.ok(layout.indexOf('className={`art-slot') < layout.indexOf('className="art-game-panel"'));
  assert.match(layout, /onClick=\{\(\) => placeSelectedArtSpot\(spot\.name\)\}/);
  assert.match(layout, /className="art-game-panel-content"/);
  assert.ok(layout.indexOf('className="art-game-panel"') < layout.indexOf('className="choice-popover"'));
  assert.match(css, /grid-template-columns: minmax\(0, 1fr\) clamp\(220px, 28%, 340px\)/);
  assert.match(css, /\.experience\.art-game \.map2d \.art-slot[^}]+display: grid/);
  assert.match(css, /100cqh - 8px\) \* var\(--map-aspect\)/);
  assert.match(css, /\.experience\.art-game \.art-game-panel-content[^}]+overflow-y: auto/);
  assert.match(layout, /hidden=\{!choiceTarget && !showArtDetails\}/);
  assert.match(css, /\.art-game-layout, \.art-game-panel, \.art-game-panel-content \{ display: contents/);
  assert.match(css, /\.experience\.art-game \.art-preview\.single[^}]+height: clamp\(130px, calc\(100svh - 200px\), 280px\) !important/);
  assert.match(page, /gamePanelRef\.current\?\.scrollTo\(\{top: 0\}\)/);
});

test("artwork photos keep their complete image and offer a dismissible large view", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(page, /artworkDialogRef\.current\?\.showModal\(\)/);
  assert.match(page, /<dialog ref=\{artworkDialogRef\}/);
  assert.match(page, /aria-label="關閉作品大圖"/);
  assert.match(page, /完整作品照片`\} fill sizes="100vw" style=\{\{objectFit:"contain"\}\}/);
  assert.match(css, /\.artwork-lightbox\[open\]/);
});

test("revisiting a completed target closes old choices and reopens its details", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const handler = page.slice(page.indexOf("const placeSelectedArtSpot"), page.indexOf("const chooseArtForSlot"));
  const completed = handler.slice(handler.indexOf("if (placedArtSpots.includes(target))"), handler.indexOf("return;"));
  assert.match(completed, /setChoiceTarget\(null\)/);
  assert.match(completed, /setChoiceError\(""\)/);
  assert.match(completed, /setQuestCardCollapsed\(false\)/);
});

test("answers open only after clicking a map target and details follow the correct answer", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(page, /setChoiceTarget\(nextSpots\[0\]\.name\)/);
  const handler = page.slice(page.indexOf("const placeSelectedArtSpot"), page.indexOf("const chooseArtForSlot"));
  assert.match(handler, /setChoiceTarget\(target\)/);
  const correctAnswer = page.slice(page.indexOf("const chooseArtForSlot"), page.indexOf("const beginPointerDrag"));
  assert.match(correctAnswer, /completeArtSpot\(choiceTarget\)/);
  assert.match(correctAnswer, /setChoiceTarget\(null\)/);
  assert.match(page, /const showArtDetails = !questCardCollapsed && !choiceTarget && placedArtSpots\.includes\(currentArtSpot\.name\)/);
  assert.match(page, /\{showArtDetails&&\s*<aside className="quest-card game-card"/);
  assert.doesNotMatch(page, /任務卡/);
});
