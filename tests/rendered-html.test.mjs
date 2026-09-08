import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createAutoNightSwitch } from "../app/scene/auto-night.mjs";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the NKUST art quest shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  assert.match(response.headers.get("content-security-policy") ?? "", /frame-ancestors 'none'/);
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("x-frame-options"), "DENY");
  assert.equal(response.headers.get("referrer-policy"), "strict-origin-when-cross-origin");

  const html = await response.text();
  assert.match(html, /<title>高科生力軍｜五校區藝術探索<\/title>/i);
  assert.match(html, /選擇校區/);
  assert.match(html, /高科生力軍/);
  assert.match(html, /guide_nkust/);
  assert.match(html, /logo-guide\.png/);
  assert.match(html, /校區導覽/);
  assert.match(html, /campus-map-canvas/);
  assert.equal((html.match(/data-campus="/g) ?? []).length, 5);
  assert.doesNotMatch(html, /進入 3D|城市工程|海洋科技|創新綠意|山林人文|港灣航海/);
  assert.doesNotMatch(html, /開始配對/);
  assert.doesNotMatch(html, /看 3D/);
  assert.doesNotMatch(html, /選好後才載入該校區內容，手機開啟會更快。/);
  assert.doesNotMatch(html, /高科大五校區 3D 漂浮島世界/);
  assert.doesNotMatch(html, /alt="導覽員小高"/);
  assert.match(html, /建工校區/);
  assert.match(html, /楠梓校區/);
  assert.match(html, /第一校區/);
  assert.match(html, /燕巢校區/);
  assert.match(html, /旗津校區/);
  assert.doesNotMatch(html, /Your site is taking shape|react-loading-skeleton/);
});

test("home loads a native, disposable 3D map with clickable campus models", async () => {
  const component = await readFile(new URL("../app/features/campus-explorer/CampusMap.tsx", import.meta.url), "utf8");
  const scene = await readFile(new URL("../app/scene/campus-map.ts", import.meta.url), "utf8");
  assert.match(component, /import\("\.\.\/\.\.\/scene\/campus-map"\)/);
  assert.match(component, /onClick=\{\(\) => onSelect\(campus.name\)\}/);
  assert.match(scene, /new THREE\.InstancedMesh/);
  assert.match(scene, /raycaster\.intersectObjects\(pickTargets, false\)/);
  assert.match(scene, /if \(clicked\).*callbacks.onSelect\(name\)/);
  assert.match(scene, /activePointers.size > 1/);
  assert.match(scene, /Math\.hypot.*> 7/);
  assert.match(scene, /Math.min\(window.devicePixelRatio, 1.5\)/);
  assert.match(scene, /document.hidden/);
  assert.match(scene, /observer.disconnect\(\)/);
  assert.match(scene, /renderer.dispose\(\)/);
  assert.doesNotMatch(scene, /TextureLoader|GLTFLoader|\.png|\.webp|EffectComposer/);
});

test("keeps the 2D art map data wired into the game source", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(page, /const jiangongArtSpots = \[/);
  assert.match(page, /遒銅純懿/);
  assert.match(page, /art-qiu-tong-chun-yi@3x\.webp/);
  assert.match(page, /弘毅精勤/);
  assert.match(page, /art-hong-yi-jing-qin\.webp/);
  assert.match(page, /歐趴熊公仔/);
  assert.match(page, /art-op-bear\.jpg/);
  assert.match(page, /天地之間/);
  assert.match(page, /art-between-heaven-earth\.jpg/);
  assert.match(page, /jiangong-art-map\.webp/);
  assert.match(page, /intro: "以金屬與線條交錯出流動的造形/);
  assert.match(page, /sourceX: 39\.8/);
  assert.match(page, /labelY: 28\.7/);
  assert.match(page, /labelX: 9\.5/);
  assert.match(page, /條碼叢林/);
  assert.match(page, /art-barcode-jungle\.webp/);
  assert.match(page, /360度/);
  assert.match(page, /art-360-degree\.webp/);
  assert.match(page, /落陽坡/);
  assert.match(page, /art-luoyang-slope\.webp/);
  assert.match(page, /鳩池/);
  assert.match(page, /art-jiu-pond\.webp/);
  assert.match(page, /木棉道/);
  assert.match(page, /art-kapok-road\.webp/);
  assert.match(page, /時光噴泉/);
  assert.match(page, /art-time-fountain\.webp/);
  assert.match(page, /資訊樂園/);
  assert.match(page, /art-info-park\.webp/);
  assert.match(page, /知識拼圖/);
  assert.match(page, /art-knowledge-puzzle\.webp/);
  assert.match(page, /翱翔科技天空/);
  assert.match(page, /art-soaring-tech-sky\.webp/);
  assert.match(page, /初芽/);
  assert.match(page, /art-sprout\.webp/);
  assert.match(page, /創夢工廠/);
  assert.match(page, /art-dream-workshop\.webp/);
  assert.match(page, /className=\{`art-source/);
  assert.match(page, /className=\{`art-slot/);
  assert.match(page, /拖曳平移/);
  assert.match(page, /art-source\{display:none\}/);
  assert.match(page, /art-slot\{width:58px;height:24px/);
  assert.match(page, /art-slot\.empty\{width:58px/);
  assert.match(page, /background:#fff/);
  assert.match(page, /choice-popover button\{min-height:42px/);
  assert.match(page, /onDrop=\{\(\) => placeArtSpot\(spot\.name\)\}/);
  assert.match(page, /placeSelectedArtSpot/);
  assert.match(page, /features\/art-quest\/randomize/);
  assert.match(page, /shuffleChoiceNames/);
  assert.match(page, /sampleArtSpots\(catalog\)/);
  assert.match(page, /useState<"home"\|"world"\|"map">\("home"\)/);
  assert.match(page, /mode !== "world"/);
  assert.match(page, /<CampusMap campuses=\{campuses\} onSelect=\{focusCampus\}/);
  assert.doesNotMatch(page, /開始配對/);
  assert.doesNotMatch(page, /看 3D/);
  assert.match(page, /setDayMode/);
  assert.match(page, /setNightMode/);
  assert.match(page, /toggleDayNight/);
  assert.match(page, /setChoiceOrder\(shuffleChoiceNames\(nextSpots\)\)/);
  assert.match(page, /setChoiceOrder\(shuffleChoiceNames\(activeArtSpots\)\)/);
  assert.match(page, /choiceTarget/);
  assert.match(page, /chooseArtForSlot/);
  assert.match(page, /choice-popover/);
  assert.match(page, /答錯了，再選一次/);
  assert.match(page, /setSelectedArtSpot\(choiceTarget\)/);
  assert.match(page, /completeArtSpot\(choiceTarget\)/);
  assert.match(page, /setQuestCardCollapsed\(false\)/);
  assert.doesNotMatch(page, /className=\{selectedArtSpot === spot\.name \? "active" : ""\}/);
  assert.doesNotMatch(page, /jiangongArtSpots\.find\(\(spot\) => spot\.name === choiceTarget\)\?\.place/);
  assert.match(page, /setQuestCardCollapsed\(true\);setCelebrationDismissed/);
  assert.match(page, /點空格選擇正確作品/);
  assert.match(page, /選答案/);
  assert.match(page, /setDraggingArtSpot\(name\)/);
  assert.match(page, /beginPointerDrag/);
  assert.match(page, /document\.elementFromPoint/);
  assert.match(page, /data-art-slot/);
  assert.match(page, /drag-ghost/);
  assert.doesNotMatch(page, /放這裡/);
  assert.match(page, /找尋提示/);
  assert.match(page, /作品介紹/);
  assert.match(page, /<h2>\{currentArtSpot\.name\}<\/h2>/);
  assert.match(page, /aria-label=\{`\$\{selected\}藝術品 2D 導覽圖`\}/);
  assert.match(page, /className="quest-card game-card"/);
  assert.doesNotMatch(page, /任務卡/);
  assert.match(page, /quest-collapse/);
  assert.match(page, /isArtQuestComplete/);
  assert.match(page, /showCelebration/);
  assert.match(page, /showConfetti/);
  assert.match(page, /\{activeArtSpots\.length\} 件公共藝術/);
  assert.match(page, /new window\.Image\(\)/);
  assert.match(page, /6000/);
  assert.match(page, /completeArtSpot/);
  assert.match(page, /completion-confetti/);
  assert.match(styles, /confetti-fall var\(--d\) linear 2/);
  assert.match(page, /guide-complete-spark/);
  assert.match(page, /guide\.webp/);
  assert.match(page, /太棒了，全部作品都完成了！/);
  assert.match(page, /complete-celebration/);
  assert.match(page, /completionDialogRef/);
  assert.match(page, /showModal\(\)/);
  assert.match(page, /aria-labelledby="completion-title"/);
  assert.match(page, /complete-close/);
  assert.match(page, /關閉完成提示/);
  assert.match(page, /填寫回饋問卷/);
  assert.match(page, /1FAIpQLSefbdYgZY3kenMTrydfMOwWoHCu5XxRd1ScOgwUVj0c9BYKaQ/);
  assert.match(page, /window\.location\.assign\(completionSurveyUrl\)/);
  assert.doesNotMatch(page, /className="quest-list"/);
  assert.match(page, /aria-live="polite"/);
  assert.doesNotMatch(page, /island-dots/);
  assert.doesNotMatch(page, /漂浮島/);
});

test("uses a native Three.js miniature gate scene instead of loading a heavy campus GLB", async () => {
  const page = await readFile(new URL("../app/scene/jiangong.ts", import.meta.url), "utf8");

  assert.match(page, /createBase\(\)/);
  assert.match(page, /createRoad\(\)/);
  assert.match(page, /createGate\(\)/);
  assert.match(page, /createGuardHouse\(\)/);
  assert.match(page, /createUtilityPole\(\)/);
  assert.match(page, /new THREE\.InstancedMesh\(batch.geometry, batch.material/);
  assert.match(page, /setDayMode, setNightMode, toggleDayNight/);
  assert.match(page, /createMainBuilding/);
  assert.match(page, /createSchoolWall/);
  assert.match(page, /createPalmTrees/);
  assert.match(page, /createWindows/);
  assert.match(page, /renderer\.setPixelRatio\(Math\.min\(window\.devicePixelRatio, 1\.5\)\)/);
  assert.doesNotMatch(page, /GLTFLoader/);
  assert.doesNotMatch(page, /\/models\/jiangong-campus\.glb/);
});

test("loads only the selected detailed campus and disposes it on navigation", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(page, /campus === "旗津校區"\s*\? import\("\.\/scene\/cijin"\)/);
  assert.match(page, /if \(cancelled\) return;\s*ownedScene = createScene/);
  assert.match(page, /ownedScene\?\.dispose\(\)/);
  assert.match(page, /campusForHash\(window\.location\.hash\)/);
  assert.match(page, /hashForCampus\(name\)/);
  assert.match(page, /const pureModel = mode === "world";/);
  assert.match(page, /import\("\.\/scene\/nanzih"\)/);
  assert.match(page, /import\("\.\/scene\/yanchao"\)/);
  assert.match(page, /Promise\.all\(campuses\.map\(\(campus\) => loadCampusSceneFactory\(campus\.name\)\)\)/);
  assert.doesNotMatch(page, /new THREE\.Scene|new THREE\.WebGLRenderer|className="campus-hud focused"/);
  assert.match(page, /modelActions\.current\.enterMap\(selected\)/);
  assert.match(page, /className="three-world jiangong-world" hidden=\{!pureModel\}/);
  assert.match(page, /aria-label="重設視角"/);
  assert.match(page, /modelNight \? "切換至白天" : "切換至夜晚"/);
  assert.match(page, /miniatureRef\.current\?\.resetView\(\)/);
  assert.match(page, /className="model-enter-game"/);
  assert.match(styles, /\.model-controls button \{[\s\S]*?min-height: 48px/);
  for (const edge of ["top", "bottom", "left", "right"]) assert.ok(styles.includes(`safe-area-inset-${edge}`));
});

test("keeps a single lighting transition, bounded camera and on-demand rendering", async () => {
  const scene = await readFile(new URL("../app/scene/jiangong.ts", import.meta.url), "utf8");
  assert.match(scene, /const centerZ = -4\.04, depthScale = \.44/);
  assert.match(scene, /selection < \.13/);
  assert.match(scene, /selection >= \.13 && selection < \.35/);
  assert.match(scene, /mats\.dimGlass\.emissiveIntensity = t \* \.42/);
  assert.match(scene, /\(time - transitionStarted\) \/ 1600/);
  assert.equal((scene.match(/new THREE\.WebGLRenderer/g) ?? []).length, 1);
  assert.equal((scene.match(/new THREE\.PointLight/g) ?? []).length, 3);
  assert.match(scene, /function resetView\(\) \{[\s\S]*?turntable\.reset\(true\); syncModelRotation\(\); fitCamera\(\);/);
  assert.match(scene, /active && !document\.hidden && contextAvailable/);
  assert.match(scene, /transitionStarted \+= performance\.now\(\) - pausedAt/);
  assert.match(scene, /controls\.maxPolarAngle = 1\.35/);
  assert.match(scene, /modelRadius \+ controls\.target\.distanceTo\(rotatedModelCenter\)/);
  assert.match(scene, /startEntryAnimation\(\)/);
  assert.match(scene, /dataset\.entrance = cameraTween \? "entering" : "ready"/);
  assert.match(scene, /renderer\.shadowMap\.autoUpdate = false/);
  assert.match(scene, /if \(changed \|\| rotationChanged \|\| cameraTween \|\| progress < 1 \|\| campusLife.moving\) invalidate\(\)/);
  assert.doesNotMatch(scene, /EffectComposer|UnrealBloomPass|SSAOPass|SSRPass/);
});

test("aligns the guard house behind the NKUST median with its light and shadow", async () => {
  const scene = await readFile(new URL("../app/scene/jiangong.ts", import.meta.url), "utf8");
  assert.match(scene, /const gateLayout = \{ islandX: 0, islandZ: 2\.68, guardZ: 0, guardElevation: \.18 \}/);
  assert.match(scene, /box\(\[gateLayout\.islandX, \.05, \.45\]/);
  assert.match(scene, /islandX - textCenter/);
  assert.match(scene, /const x = islandX \+ side \* 1\.72, z = 2\.65, width = 1\.16/);
  assert.match(scene, /const \{ islandX, guardZ, guardElevation \} = gateLayout/);
  assert.match(scene, /box\(\[islandX \+ p\[0\], guardElevation \+ p\[1\], guardZ \+ p\[2\]\]/);
  assert.match(scene, /lights\.guard\.position\.set\(gateLayout\.islandX, gateLayout\.guardElevation \+ 1\.32, gateLayout\.guardZ \+ \.92\)/);
  assert.match(scene, /mesh\("gate-island-grass", islandGeometry\(\.97, 1\.33, \.56, \.04\)/);
  assert.match(scene, /\[gateLayout\.islandX, \.253, gateLayout\.guardZ\]/);
  assert.doesNotMatch(scene, /box\(\[2\.8, \.69, 1\.02\]/);
});

function autoNightHarness() {
  let time = 0, id = 0, fired = 0;
  const tasks = new Map();
  const timer = createAutoNightSwitch(() => { fired++; }, {
    now: () => time,
    schedule: (callback, ms) => { tasks.set(++id, { at: time + ms, callback }); return id; },
    cancel: handle => tasks.delete(handle),
  });
  function advance(ms) {
    const end = time + ms;
    while (true) {
      const next = [...tasks].filter(([, task]) => task.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
      if (!next) break;
      tasks.delete(next[0]); time = next[1].at; next[1].callback();
    }
    time = end;
  }
  return { timer, advance, fired: () => fired, pending: () => tasks.size };
}

test("automatic night waits eight seconds and fires only once per visit", () => {
  const h = autoNightHarness();
  h.timer.restart(); h.advance(7999); assert.equal(h.fired(), 0);
  h.advance(1); assert.equal(h.fired(), 1); assert.equal(h.timer.getState().status, "done");
  h.timer.resume(); h.advance(60000); assert.equal(h.fired(), 1); assert.equal(h.pending(), 0);
  h.timer.restart(); h.advance(7999); assert.equal(h.fired(), 1);
  h.advance(1); assert.equal(h.fired(), 2);
});

test("automatic night excludes background time and cleans up on disposal", () => {
  const h = autoNightHarness();
  h.timer.restart(false); h.advance(100000); assert.equal(h.fired(), 0);
  h.timer.resume(); h.advance(3000); h.timer.pause(); h.timer.pause();
  assert.equal(h.timer.getState().remainingMs, 5000); assert.equal(h.pending(), 0);
  h.advance(100000); h.timer.resume(); h.timer.resume(); assert.equal(h.pending(), 1);
  h.advance(4999); assert.equal(h.fired(), 0); h.advance(1); assert.equal(h.fired(), 1);
  h.timer.restart(); h.advance(1000); h.timer.dispose(); h.timer.resume(); h.timer.restart();
  h.advance(10000); assert.equal(h.fired(), 1); assert.equal(h.pending(), 0);
});

test("manual day/night remains independent of the automatic one-shot deadline", () => {
  let now = 0, scheduled, mode = "day", automaticCalls = 0;
  const timer = createAutoNightSwitch(() => { automaticCalls++; mode = "night"; }, {
    now: () => now,
    schedule: (callback, delay) => { scheduled = { callback, at: now + delay }; return 1; },
    cancel: () => { scheduled = undefined; },
  });
  timer.restart();
  now = 2000; mode = "night";
  now = 4000; mode = "day";
  assert.equal(scheduled.at, 8000); assert.equal(timer.getState().remainingMs, 4000);
  now = 8000; scheduled.callback(); scheduled = undefined;
  assert.equal(mode, "night"); assert.equal(automaticCalls, 1);
  mode = "day"; now = 40000; timer.resume();
  assert.equal(scheduled, undefined); assert.equal(mode, "day"); assert.equal(automaticCalls, 1);
  timer.dispose();
});

test("scene connects auto night to the existing transition without a second animation loop", async () => {
  const scene = await readFile(new URL("../app/scene/jiangong.ts", import.meta.url), "utf8");
  assert.match(scene, /createAutoNightSwitch\(\(\) => \{ setNightMode\(\)/);
  assert.match(scene, /delay: trafficChoreography\.autoNightDelay \* 1000/);
  assert.match(scene, /if \(value === nightTarget\) return/);
  assert.match(scene, /const entering = value && !active/);
  assert.match(scene, /if \(entering\) beginVisit\(\)/);
  assert.match(scene, /autoNight\.restart\(visible\)/);
  assert.match(scene, /autoNight\.pause\(\)/);
  assert.match(scene, /autoNight\.dispose\(\)/);
  const manualFunctions = scene.slice(scene.indexOf("function changeMode"), scene.indexOf("let frame ="));
  assert.doesNotMatch(manualFunctions, /autoNight|setTimeout|requestAnimationFrame/);
  assert.equal((scene.match(/requestAnimationFrame\(/g) ?? []).length, 1);
  assert.match(scene, /skyBlend\.value = t/);
  assert.match(scene, /lightPoolMaterial\.opacity = t \* \.65/);
});

test("surface highlights use a shared world-space environment without camera-following lights", async () => {
  const scene = await readFile(new URL("../app/scene/jiangong.ts", import.meta.url), "utf8");
  assert.match(scene, /width = 256, height = 128, pixels = new Float32Array/);
  assert.match(scene, /pmrem\.fromEquirectangular\(reflectionSource\); pmrem\.dispose\(\)/);
  assert.match(scene, /m\.envMap = reflectionTarget\.texture/);
  assert.match(scene, /m\.envMapIntensity = THREE\.MathUtils\.lerp\(dayIntensity, nightIntensity, t\)/);
  assert.match(scene, /mats\.road\.roughnessMap = mats\.road\.bumpMap/);
  assert.match(scene, /normals\.setXYZ\(i, sign \* x \/ r, 0, sign \* z \/ r\)/);
  assert.match(scene, /scene\.add\(lights\.hemisphere, lights\.sun, lights\.sun\.target\)/);
  assert.match(scene, /model\.add\(lights\.entrance, lights\.guard, lights\.street, lights\.wall, lights\.wall\.target\)/);
  assert.match(scene, /reflectionTarget\?\.dispose\(\); lights\.sun\.shadow\.dispose/);
  assert.match(scene, /contextRestored = \(\) => \{ createSurfaceLighting\(\)/);
  const renderLoop = scene.slice(scene.indexOf("function animate("), scene.indexOf("function onWindowResize("));
  assert.doesNotMatch(renderLoop, /createSurfaceLighting|PMREMGenerator|fromEquirectangular/);
  assert.match(renderLoop, /if \(actorsChanged\) \{ renderer\.shadowMap\.needsUpdate = true/);
  assert.doesNotMatch(scene, /camera\.add\(.*light|lights\.\w+\.position\.copy\(camera|CubeCamera|Reflector|EffectComposer/);
  assert.equal((scene.match(/new THREE\.PointLight/g) ?? []).length, 3);
});

test("turntable input rotates the complete model while the sun stays in world space", async () => {
  const scene = await readFile(new URL("../app/scene/jiangong.ts", import.meta.url), "utf8");
  const turntable = await readFile(new URL("../app/scene/model-turntable.mjs", import.meta.url), "utf8");
  assert.match(scene, /const model = new THREE\.Group\(\)/);
  assert.match(scene, /sceneObjects\.model = model/);
  assert.match(scene, /controls\.enableRotate = false/);
  assert.match(scene, /createModelTurntable\(renderer\.domElement/);
  assert.match(scene, /model\.quaternion\.copy\(modelOrientation\)/);
  assert.match(scene, /renderer\.shadowMap\.needsUpdate = true; shadowRevision\+\+/);
  assert.match(scene, /scene\.add\(lights\.hemisphere, lights\.sun, lights\.sun\.target\)/);
  assert.match(scene, /model\.add\(lights\.entrance, lights\.guard, lights\.street, lights\.wall, lights\.wall\.target\)/);
  assert.match(scene, /startEntryAnimation\(\)/);
  assert.match(scene, /dataset\.entrance = cameraTween \? "entering" : "ready"/);
  assert.match(scene, /turntable\.reset\(true\); syncModelRotation\(\); fitCamera\(\)/);
  assert.match(scene, /dataset\.modelRotation/);
  assert.match(scene, /dataset\.shadowRevision/);
  assert.match(turntable, /target \+= \(event\.clientX - drag\.x\)/);
  assert.match(turntable, /pointers\.size !== 1/);
  assert.match(turntable, /MathUtils\.damp\(angle, target/);
  assert.doesNotMatch(turntable, /requestAnimationFrame|camera|light/);
});
