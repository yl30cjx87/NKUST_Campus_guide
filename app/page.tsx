"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Maximize2, X } from "lucide-react";
import type { CampusScene, CampusSceneOptions } from "./scene/campus-scene";
import CampusMap from "./features/campus-explorer/CampusMap";
import { sampleArtSpots, shuffleChoiceNames, shuffleSpots } from "./features/art-quest/randomize";
import { campusForHash, hashForCampus } from "./shared/routing/campus-routes.mjs";

const campuses = [
  { name: "建工校區", short: "建工", tag: "城市工程", color: 0xe98755, pos: [-7, 0.7, 1] },
  { name: "楠梓校區", short: "楠梓", tag: "海洋科技", color: 0x4bb5bd, pos: [-3.4, 1.7, -3.8] },
  { name: "第一校區", short: "第一", tag: "創新綠意", color: 0xf0bc4e, pos: [0, 0, 0] },
  { name: "燕巢校區", short: "燕巢", tag: "山林人文", color: 0x9670b0, pos: [4, 1.3, -3.3] },
  { name: "旗津校區", short: "旗津", tag: "港灣航海", color: 0x458fc0, pos: [7.2, 0.2, 1.4] },
] as const;

type SceneFactory = (host: HTMLElement, options?: CampusSceneOptions) => CampusScene;
const sceneFactoryCache = new Map<string, Promise<SceneFactory>>();

function loadCampusSceneFactory(campus: string): Promise<SceneFactory> {
  const cached = sceneFactoryCache.get(campus);
  if (cached) return cached;
  const pending: Promise<SceneFactory> = campus === "旗津校區"
    ? import("./scene/cijin").then((module) => module.createCijinScene)
    : campus === "建工校區"
      ? import("./scene/jiangong").then((module) => module.createJiangongScene)
      : campus === "第一校區"
        ? import("./scene/first-campus").then((module) => module.createFirstCampusScene)
        : campus === "楠梓校區"
          ? import("./scene/nanzih").then((module) => module.createNanzihScene)
          : import("./scene/yanchao").then((module) => module.createYanchaoScene);
  sceneFactoryCache.set(campus, pending);
  pending.catch(() => sceneFactoryCache.delete(campus));
  return pending;
}

const completionSurveyUrl = "https://docs.google.com/forms/d/e/1FAIpQLSefbdYgZY3kenMTrydfMOwWoHCu5XxRd1ScOgwUVj0c9BYKaQ/viewform?usp=header";

const jiangongArtSpots = [
  { name: "遒銅純懿", place: "育賢樓前方", clue: "從汽車停車場往育賢樓走，尋找橘色編織感的公共藝術。", intro: "以金屬與線條交錯出流動的造形，像把工程材料轉成校園裡可以靠近觀察的雕塑語彙。", image: "/art-qiu-tong-chun-yi@3x.webp", imageRatio: "441 / 354", sourceX: 39.8, sourceY: 27.5, labelX: 9.5, labelY: 28.7, previewX: 6, previewY: 34 },
  { name: "弘毅精勤", place: "校史館前", clue: "沿著建工路旁步道前進，在校史館前方找到第二件作品。", intro: "高聳的碑體呼應校園精神，適合引導玩家觀察校門、校史館與公共藝術的關係。", image: "/art-hong-yi-jing-qin.webp", imageRatio: "520 / 576", sourceX: 48.9, sourceY: 25.4, labelX: 9.5, labelY: 47.4, previewX: 7, previewY: 52 },
  { name: "歐趴熊公仔", place: "校門口旁", clue: "靠近校門口與機車棚一帶，尋找一組高科大角色公仔。", intro: "角色公仔把校園入口變得更親切，也能當作新手任務的第一個辨識目標。", image: "/art-op-bear.jpg", imageRatio: "298 / 340", sourceX: 57.0, sourceY: 23.7, labelX: 9.5, labelY: 71.7, previewX: 7, previewY: 75 },
  { name: "天地之間", place: "雙科館前", clue: "穿過人行步道往雙科館前方，觀察地圖標記的第四件公共藝術。", intro: "銀色曲面反射周圍建築與天空，讓玩家從不同角度看見作品和環境一起變化。", image: "/art-between-heaven-earth.jpg", imageRatio: "1 / 1", sourceX: 66.7, sourceY: 48.4, labelX: 9.5, labelY: 90.2, previewX: 9, previewY: 91 },
] as const;

const yanchaoArtSpots = [
  { name: "神話之鳥", place: "校門口多功能球場旁", clue: "由校門口往西側多功能球場前進，尋找由金屬圓球與垂直線條構成的鳥。", intro: "作品以抽象金屬構件描繪神話鳥形，從不同角度會看見不同輪廓。", image: "/art-myth-bird.webp", imageRatio: "1 / 1", sourceX: 36.7, sourceY: 68.2, labelX: 8.6, labelY: 87.6, previewX: 14, previewY: 88 },
  { name: "燕翔印記", place: "校門口中央", clue: "從校門進入後留意入口圓環，尋找白色直立、頂端帶有燕形符號的作品。", intro: "直立碑體標記校園入口，將燕子飛翔的意象化為迎接訪客的精神地標。", image: "/art-yanxiang-mark.webp", imageRatio: "640 / 480", sourceX: 41.2, sourceY: 64.2, labelX: 33.2, labelY: 87.8, previewX: 36, previewY: 88 },
  { name: "薪傳", place: "商業智慧學院前", clue: "沿深中路旁步道走到商業智慧學院前，尋找低矮的黑白幾何作品。", intro: "作品透過相連的量體表現知識與經驗代代延續，也呼應校園的學習軸線。", image: "/art-xin-chuan.webp", imageRatio: "1395 / 1792", sourceX: 53.3, sourceY: 56.4, labelX: 58.2, labelY: 77.2, previewX: 58, previewY: 88 },
  { name: "弘毅精勤", place: "開心農場西側路口", clue: "由商業智慧學院往東北方前進，在開心農場西側道路旁找到彩色作品。", intro: "鮮明色彩與校訓意象結合，提醒學子以堅定、勤勉的態度持續前進。", image: "/art-yanchao-hong-yi-jing-qin.webp", imageRatio: "600 / 800", sourceX: 70.2, sourceY: 52.6, labelX: 75.2, labelY: 74.2, previewX: 77, previewY: 88 },
  { name: "燕巢", place: "教職員生宿舍區", clue: "穿過景觀吊橋往宿舍區，在詠絮樓、涵芳樓附近尋找大型彩色雕塑。", intro: "交織的有機形體像巢、枝枒與生命網絡，成為宿舍區醒目的公共藝術。", image: "/art-yanchao.webp", imageRatio: "1 / 1", sourceX: 76.2, sourceY: 37.1, labelX: 92.4, labelY: 65.2, previewX: 89, previewY: 73 },
] as const;

const firstCampusArtSpots = [
  { name: "木棉道", place: "西校區木棉道", clue: "到西校區運動場與生態池附近，尋找木棉樹形成的校園步道。", intro: "木棉道以季節色彩串起校園生活，也是第一校區最具辨識度的自然景觀之一。", image: "/art-kapok-road.webp", imageRatio: "275 / 183", sourceX: 34.3, sourceY: 51.0, labelX: 7.8, labelY: 35.6, previewX: 18, previewY: 32 },
  { name: "落陽坡", place: "西校區南側草坡", clue: "沿卓越路校門口往西側草地前進，尋找適合看夕陽的大草坡。", intro: "寬廣草坡連結校園地景與天空，是同學休憩、交流及欣賞夕照的場所。", image: "/art-luoyang-slope.webp", imageRatio: "580 / 435", sourceX: 42.4, sourceY: 61.0, labelX: 7.0, labelY: 64.3, previewX: 11, previewY: 70 },
  { name: "鳩池", place: "西校區生態池", clue: "在木棉道旁的水域尋找映著夕陽與校園建築的生態池。", intro: "池面、水岸草地與遠方建築形成開闊景觀，是第一校區適合觀察自然與校園日常的地點。", image: "/art-jiu-pond.webp", imageRatio: "580 / 435", sourceX: 42.6, sourceY: 55.2, labelX: 5.7, labelY: 91.0, previewX: 12, previewY: 88 },
  { name: "漾", place: "西校區生態池旁", clue: "在生態池與木棉道附近，尋找水紋般石材質感的公共藝術。", intro: "石材上的波紋像水面漣漪向外擴散，讓作品與旁邊的生態池景觀互相呼應。", image: "/art-yang.webp", imageRatio: "1 / 1", sourceX: 35.7, sourceY: 50.8, labelX: 22.4, labelY: 74.6, previewX: 21, previewY: 82 },
  { name: "時光噴泉", place: "學生活動中心附近", clue: "在東校區西南側，尋找夜晚會發光的噴泉景觀。", intro: "噴泉在燈光與水柱變化中呈現流動感，成為夜間校園裡醒目的景觀節點。", image: "/art-time-fountain.webp", imageRatio: "500 / 333", sourceX: 55.5, sourceY: 48.5, labelX: 42.0, labelY: 78.2, previewX: 43, previewY: 79 },
  { name: "360度", place: "學生活動中心北側", clue: "沿東校區中央步道尋找紅藍相交的圓形雕塑。", intro: "環形構造帶出多角度觀看的概念，引導觀者繞行並改變觀看視點。", image: "/art-360-degree.webp", imageRatio: "579 / 386", sourceX: 58.6, sourceY: 47.4, labelX: 52.6, labelY: 77.4, previewX: 55, previewY: 80 },
  { name: "翱翔科技天空", place: "東校區南側", clue: "前往東校區南側，在草地上尋找高聳的科技意象作品。", intro: "向上延伸的造形象徵科技、想像與學習能量向天空展開。", image: "/art-soaring-tech-sky.webp", imageRatio: "1 / 1", sourceX: 60.7, sourceY: 48.6, labelX: 67.8, labelY: 71.4, previewX: 66, previewY: 70 },
  { name: "創夢工廠", place: "創夢工場", clue: "在東校區創夢工場附近，尋找黃色入口與創新空間標誌。", intro: "創夢工場連結技術實作與創意發想，是第一校區孕育創新作品的特色空間。", image: "/art-dream-workshop.webp", imageRatio: "750 / 500", sourceX: 58.3, sourceY: 42.8, labelX: 91.0, labelY: 57.1, previewX: 78, previewY: 58 },
  { name: "資訊樂園", place: "東校區東南側", clue: "在東校區東南側尋找由石材與人物互動構成的作品。", intro: "作品將資訊、交流與遊戲意象結合，呈現知識共享的校園生活。", image: "/art-info-park.webp", imageRatio: "1 / 1", sourceX: 69.3, sourceY: 42.3, labelX: 87.8, labelY: 89.2, previewX: 91, previewY: 82 },
  { name: "條碼叢林", place: "東校區北側", clue: "在東校區北側尋找紅黑直立構件組成的作品。", intro: "密集直立線條如城市與叢林交疊，讓人在穿行中感受空間節奏。", image: "/art-barcode-jungle.webp", imageRatio: "579 / 386", sourceX: 57.8, sourceY: 34.0, labelX: 44.8, labelY: 11.4, previewX: 55, previewY: 8 },
  { name: "知識拼圖", place: "知識拼圖草地", clue: "在大學路校門口東側草地，尋找黑色幾何組件。", intro: "幾何量體像可以重新組合的知識片段，象徵跨域學習與創造。", image: "/art-knowledge-puzzle.webp", imageRatio: "500 / 375", sourceX: 67.5, sourceY: 28.7, labelX: 63.0, labelY: 15.2, previewX: 67, previewY: 9 },
  { name: "初芽", place: "工學院附近", clue: "在東校區東北側尋找如嫩芽向上生長的彩色雕塑。", intro: "作品以新芽象徵學習起點與成長能量，呼應新生展開校園生活。", image: "/art-sprout.webp", imageRatio: "1 / 1", sourceX: 81.4, sourceY: 29.5, labelX: 80.6, labelY: 4.8, previewX: 83, previewY: 10 },
] as const;

const qijinArtSpots = [
  { name: "教學碼頭", place: "旗津校區教學碼頭", clue: "從校園西側往港灣方向前進，尋找面向海面的教學碼頭。", intro: "教學碼頭把海洋實務、船舶訓練與校園生活連結在一起，是旗津校區最具代表性的港灣地標。", image: "/art-teaching-wharf.webp", imageRatio: "1000 / 683", sourceX: 60.5, sourceY: 10.0, labelX: 35.0, labelY: 16.0, previewX: 35, previewY: 24 },
  { name: "孔子雕像", place: "船舶機械實習工廠旁", clue: "沿主校區西側道路前進，在船舶機械實習工廠附近尋找孔子雕像。", intro: "孔子雕像象徵教育傳承與求知精神，在海洋專業校園中形成具有人文意義的學習節點。", image: "/art-confucius-statue.webp", imageRatio: "1500 / 965", sourceX: 58.2, sourceY: 24.8, labelX: 53.0, labelY: 88.0, previewX: 80, previewY: 88 },
  { name: "海錨", place: "旗津校區校門口", clue: "前往中洲三路校門口，在入口附近尋找大型船錨造形。", intro: "海錨以航海器具轉化為公共藝術，象徵穩定、方向與旗津校區深厚的海洋特色。", image: "/art-anchor.webp", imageRatio: "1 / 1", sourceX: 50.0, sourceY: 71.0, labelX: 76.0, labelY: 88.0, previewX: 89, previewY: 88 },
] as const;

const nanzihArtSpots = [
  { name: "觀流", place: "文化走廊附近", clue: "沿文化走廊前進，在建築與植栽之間尋找白色直立雕塑。", intro: "直立造形呼應流動、觀看與海洋意象，讓不同角度產生不同的空間關係。", image: "/art-guan-liu.webp", imageRatio: "1 / 1", sourceX: 32.5, sourceY: 46.5, labelX: 50.0, labelY: 7.0, previewX: 50, previewY: 20 },
  { name: "念漪", place: "致遠樓附近", clue: "前往致遠樓一帶，尋找帶有星形與方位意象的圓形作品。", intro: "作品以星與方位構成視覺中心，象徵思考、方向及知識累積。", image: "/art-nian-yi.webp", imageRatio: "1 / 1", sourceX: 43.5, sourceY: 55.5, labelX: 70.0, labelY: 3.5, previewX: 78, previewY: 10 },
  { name: "海洋榮景陶壁", place: "海洋榮景陶壁旁", clue: "在西側教學區尋找鋪設於地面的陶板與海洋圖紋。", intro: "陶壁以色彩與紋理記錄海洋意象，將校園步行空間轉化為可閱讀的藝術地景。", image: "/art-ocean-glory-ceramic-wall.webp", imageRatio: "950 / 629", sourceX: 31.8, sourceY: 52.5, labelX: 10.0, labelY: 68.0, previewX: 10, previewY: 78 },
  { name: "與海洋共舞", place: "藝文中心南側", clue: "沿藝文中心南側步道尋找銀色波浪狀雕塑。", intro: "金屬曲線像海浪與魚群交錯，在光線下呈現持續流動的海洋節奏。", image: "/art-dance-with-ocean.webp", imageRatio: "578 / 386", sourceX: 34.0, sourceY: 67.5, labelX: 25.0, labelY: 76.0, previewX: 25, previewY: 88 },
  { name: "後勁之鯤", place: "立誠樓南側", clue: "到立誠樓南側的戶外空間，尋找以鯤形與金屬線條構成的作品。", intro: "作品以鯤魚意象連結海洋生命與校園記憶，呈現向前游動的力量。", image: "/art-houjin-kun.webp", imageRatio: "1 / 1", sourceX: 34.5, sourceY: 64.0, labelX: 36.8, labelY: 88.0, previewX: 50, previewY: 89 },
  { name: "思潮", place: "校門口東側", clue: "由校門口往東側草地前進，尋找白色拱形線條組成的作品。", intro: "交錯線條像思緒與潮汐擴散，象徵學習中不斷生成的新觀點。", image: "/art-si-chao.webp", imageRatio: "1 / 1", sourceX: 49.7, sourceY: 69.5, labelX: 68.0, labelY: 75.0, previewX: 77, previewY: 89 },
] as const;

type ArtSpot = (typeof jiangongArtSpots)[number] | (typeof yanchaoArtSpots)[number] | (typeof firstCampusArtSpots)[number] | (typeof qijinArtSpots)[number] | (typeof nanzihArtSpots)[number];
type ArtSpotName = ArtSpot["name"];

const campusSpotCatalog: Record<string, readonly ArtSpot[]> = {
  建工校區: jiangongArtSpots,
  燕巢校區: yanchaoArtSpots,
  第一校區: firstCampusArtSpots,
  旗津校區: qijinArtSpots,
  楠梓校區: nanzihArtSpots,
};

const campusMapImages: Record<string, string> = {
  建工校區: "/jiangong-art-map-no-names.png",
  燕巢校區: "/yanchao-art-map-no-names.webp",
  第一校區: "/first-campus-art-map-no-names.png",
  旗津校區: "/qijin-campus-art-map-no-names.png",
  楠梓校區: "/nanzih-campus-art-map-no-names.png",
};

const mapNameAnnotations: Record<string, readonly {name: string; labelX: number; labelY: number}[]> = {
  燕巢校區: [
    { name: "鳳棲", labelX: 35.5, labelY: 4.5 },
    { name: "燕之巢", labelX: 70.5, labelY: 4.5 },
    { name: "鳳之翼", labelX: 88.0, labelY: 7.0 },
  ],
  第一校區: [
    { name: "迎曦亭", labelX: 30.5, labelY: 78.4 },
    { name: "第e書房", labelX: 76.2, labelY: 64.2 },
    { name: "垂榕道", labelX: 78.6, labelY: 72.6 },
  ],
  楠梓校區: [
    { name: "月光劇場", labelX: 36.0, labelY: 3.0 },
    { name: "乘風", labelX: 91.0, labelY: 8.0 },
    { name: "帆船藝雕", labelX: 91.0, labelY: 69.0 },
  ],
};

export default function Home() {
  const gamePanelRef = useRef<HTMLDivElement>(null);
  const artworkDialogRef = useRef<HTMLDialogElement>(null);
  const completionDialogRef = useRef<HTMLDialogElement>(null);
  const miniatureHostRef = useRef<HTMLDivElement>(null);
  const miniatureRef = useRef<CampusScene | null>(null);
  const [modelNight, setModelNight] = useState(false);
  const [selected, setSelected] = useState("第一校區");
  const [focused, setFocused] = useState(false);
  const [loaded, setLoaded] = useState(true);
  const [sceneError, setSceneError] = useState("");
  const [mode, setMode] = useState<"home"|"world"|"map">("home");
  const [activeArtSpots, setActiveArtSpots] = useState<readonly ArtSpot[]>(jiangongArtSpots);
  const [selectedArtSpot, setSelectedArtSpot] = useState<ArtSpotName>(jiangongArtSpots[0].name);
  const [draggingArtSpot, setDraggingArtSpot] = useState<ArtSpotName | null>(null);
  const [pointerDrag, setPointerDrag] = useState<{name: ArtSpotName; x: number; y: number} | null>(null);
  const [placedArtSpots, setPlacedArtSpots] = useState<ArtSpotName[]>([]);
  const [choiceTarget, setChoiceTarget] = useState<ArtSpotName | null>(null);
  const [choiceOrder, setChoiceOrder] = useState<ArtSpotName[]>(() => shuffleChoiceNames(jiangongArtSpots));
  const [choiceError, setChoiceError] = useState("");
  const [questCardCollapsed, setQuestCardCollapsed] = useState(false);
  const [celebrationDismissed, setCelebrationDismissed] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  useEffect(() => {
    // 首頁完成首屏後才背景下載各校區程式；不建立 WebGL 場景，也不增加 GPU 記憶體。
    const timer = window.setTimeout(() => {
      void Promise.all(campuses.map((campus) => loadCampusSceneFactory(campus.name))).catch(() => undefined);
    }, 250);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => {
    if (mode !== "world") return;
    const host = miniatureHostRef.current;
    if (!host) return;
    setLoaded(false);
    setSceneError("");
    let cancelled = false;
    let ownedScene: CampusScene | null = null;
    const api = window as typeof window & { setDayMode?: () => void; setNightMode?: () => void; toggleDayNight?: () => void; resetCampusView?: () => void };
    const activate = (miniature: CampusScene) => {
      miniature.setActive(true);
      api.setDayMode = miniature.setDayMode;
      api.setNightMode = miniature.setNightMode;
      api.toggleDayNight = miniature.toggleDayNight;
      api.resetCampusView = miniature.resetView;
      setLoaded(true);
    };
      // 只建立選定校區；程式通常已由首頁背景預載，離開時仍完整釋放 GPU 資源。
      loadCampusSceneFactory(selected).then((createScene) => {
        if (cancelled) return;
        ownedScene = createScene(host, {
          onModeChange: setModelNight,
          onBackgroundChange: (color) => host.parentElement?.style.setProperty("--model-background", color),
        });
        miniatureRef.current = ownedScene;
        activate(ownedScene);
      }).catch((error) => {
        if (cancelled) return;
        console.error(`${selected}模型載入失敗`, error);
        setSceneError("模型無法載入，請重新整理或確認瀏覽器已開啟硬體加速。");
        setLoaded(true);
      });
    return () => {
      cancelled = true;
      ownedScene?.dispose();
      if (miniatureRef.current === ownedScene) miniatureRef.current = null;
      delete api.setDayMode; delete api.setNightMode; delete api.toggleDayNight; delete api.resetCampusView;
    };
  }, [mode, selected]);

  useEffect(() => {
    if (!showConfetti) return;
    const confettiTimer = window.setTimeout(() => setShowConfetti(false), 6000);
    return () => window.clearTimeout(confettiTimer);
  }, [showConfetti]);

  const current = campuses.find(c => c.name === selected)!;
  const pureModel = mode === "world";
  useEffect(() => {
    const navigate = () => {
      const campus = campusForHash(window.location.hash);
      if (campus) {
        void loadCampusSceneFactory(campus);
        setSelected(campus); setFocused(true); setMode("world");
      } else if (!window.location.hash || window.location.hash === "#") {
        setMode("home"); setFocused(false);
      }
    };
    navigate();
    window.addEventListener("hashchange", navigate);
    return () => window.removeEventListener("hashchange", navigate);
  }, []);
  const focusCampus = (name: string) => {
    void loadCampusSceneFactory(name);
    const hash = hashForCampus(name);
    if (hash && window.location.hash !== hash) window.location.assign(hash);
    setSelected(name);
    setFocused(true);
    if (mode !== "world") {
      setMode("world");
      return;
    }
  };
  const returnHome = () => { if(window.location.hash) window.location.assign("#");setMode("home");setFocused(false);setLoaded(true);setChoiceTarget(null);setChoiceError("");setQuestCardCollapsed(false);setCelebrationDismissed(false);setShowConfetti(false); };
  const resetView = () => returnHome();
  const enterMap=(campusName = selected)=>{
    if(campusName!=="建工校區"&&campusName!=="燕巢校區"&&campusName!=="第一校區"&&campusName!=="旗津校區"&&campusName!=="楠梓校區")return;
    setSelected(campusName);
    const catalog = campusSpotCatalog[campusName] ?? jiangongArtSpots;
    let nextSpots: readonly ArtSpot[] = catalog.length > 4 ? sampleArtSpots(catalog) : shuffleSpots(catalog);
    if (catalog.length > 4) {
      const previousSet = [...activeArtSpots].map((spot) => spot.name).sort().join("|");
      let attempts = 0;
      while ([...nextSpots].map((spot) => spot.name).sort().join("|") === previousSet && attempts < 12) {
        nextSpots = sampleArtSpots(catalog);
        attempts += 1;
      }
    }
    setActiveArtSpots(nextSpots);setMode("map");setSelectedArtSpot(nextSpots[0].name);setChoiceOrder(shuffleChoiceNames(nextSpots));setDraggingArtSpot(null);setChoiceTarget(null);setChoiceError("");setPlacedArtSpots([]);setQuestCardCollapsed(true);setCelebrationDismissed(false);setShowConfetti(false);
  };
  const exitMap=()=>{returnHome();};
  const openCompletionSurvey=()=>{window.location.assign(completionSurveyUrl);};
  const modelActions = useRef({ enterMap, returnHome });
  useEffect(() => { modelActions.current = { enterMap, returnHome }; });
  useEffect(() => {
    if (!pureModel) return;
    const api = window as typeof window & { enterCampusGame?: () => void; returnToCampusSelection?: () => void };
    api.enterCampusGame = () => modelActions.current.enterMap(selected);
    api.returnToCampusSelection = () => modelActions.current.returnHome();
    const keydown = (event: KeyboardEvent) => {
      if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.target instanceof HTMLElement && event.target.closest("button, a, input, select, textarea, [contenteditable]")) return;
      if (event.key === "Escape") modelActions.current.returnHome();
      if (event.key === "Enter") modelActions.current.enterMap(selected);
    };
    window.addEventListener("keydown", keydown);
    return () => { window.removeEventListener("keydown", keydown); delete api.enterCampusGame; delete api.returnToCampusSelection; };
  }, [pureModel, selected]);
  const selectArtSpot = (name: ArtSpotName) => {setSelectedArtSpot(name);setDraggingArtSpot(name);setQuestCardCollapsed(false);};
  const currentArtSpot = activeArtSpots.find((spot) => spot.name === selectedArtSpot) ?? activeArtSpots[0];
  const choiceTargetSpot = activeArtSpots.find((spot) => spot.name === choiceTarget);
  const campusArtSpots = campusSpotCatalog[selected] ?? jiangongArtSpots;
  const campusMapImage = campusMapImages[selected] ?? campusMapImages["建工校區"];
  const extraMapLabels = mapNameAnnotations[selected] ?? [];
  const choiceTargetNumber = choiceTargetSpot ? campusArtSpots.findIndex((spot)=>spot.name===choiceTargetSpot.name) + 1 : 0;
  const completedCount = activeArtSpots.filter((spot) => placedArtSpots.includes(spot.name)).length;
  const isArtQuestComplete = completedCount === activeArtSpots.length;
  const showCelebration = isArtQuestComplete && !celebrationDismissed;
  const showArtDetails = !questCardCollapsed && !choiceTarget && placedArtSpots.includes(currentArtSpot.name);
  useEffect(() => {
    const dialog = completionDialogRef.current;
    if (showCelebration && dialog && !dialog.open) dialog.showModal();
  }, [showCelebration]);
  useEffect(() => {
    gamePanelRef.current?.scrollTo({top: 0});
  }, [choiceTarget, selectedArtSpot, questCardCollapsed, mode]);
  useEffect(() => {
    if (mode !== "map") return;
    [campusMapImage, ...activeArtSpots.map((spot) => spot.image).filter(Boolean)].forEach((src) => {
      const image = new window.Image();
      image.decoding = "async";
      image.src = src;
    });
  }, [activeArtSpots, campusMapImage, mode]);

  const completeArtSpot = (target: ArtSpotName) => {
    setPlacedArtSpots((spots) => {
      if (spots.includes(target)) return spots;
      const next = [...spots, target];
      if (next.length === activeArtSpots.length) setShowConfetti(true);
      return next;
    });
  };
  const placeArtSpot = (target: ArtSpotName) => {
    if (draggingArtSpot !== target) return;
    completeArtSpot(target);
    setSelectedArtSpot(target);
    setQuestCardCollapsed(false);
    setDraggingArtSpot(null);
  };
  const placeSelectedArtSpot = (target: ArtSpotName) => {
    if (placedArtSpots.includes(target)) {
      setSelectedArtSpot(target);
      setChoiceTarget(null);
      setChoiceError("");
      setQuestCardCollapsed(false);
      return;
    }
    setChoiceOrder(shuffleChoiceNames(activeArtSpots));
    setChoiceTarget(target);
    setChoiceError("");
    setQuestCardCollapsed(true);
  };
  const chooseArtForSlot = (name: ArtSpotName) => {
    if (!choiceTarget) {
      selectArtSpot(name);
      return;
    }
    if (name !== choiceTarget) {
      setChoiceError("答錯了，再選一次");
      return;
    }
    setSelectedArtSpot(choiceTarget);
    completeArtSpot(choiceTarget);
    setChoiceTarget(null);
    setChoiceError("");
    setQuestCardCollapsed(false);
  };
  const beginPointerDrag = (event: React.PointerEvent<HTMLButtonElement>, name: ArtSpotName) => {
    event.preventDefault();
    setSelectedArtSpot(name);
    setDraggingArtSpot(name);
    setPointerDrag({name, x: event.clientX, y: event.clientY});
    setQuestCardCollapsed(false);
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const movePointerDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!pointerDrag) return;
    event.preventDefault();
    setPointerDrag({...pointerDrag, x: event.clientX, y: event.clientY});
  };
  const finishPointerDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!pointerDrag) return;
    const slot = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-art-slot]");
    const target = slot?.dataset.artSlot as ArtSpotName | undefined;
    if (target === pointerDrag.name) {
      completeArtSpot(target);
      setSelectedArtSpot(target);
      setQuestCardCollapsed(false);
    }
    setDraggingArtSpot(null);
    setPointerDrag(null);
    event.currentTarget.releasePointerCapture(event.pointerId);
  };
  return <main className={`experience${pureModel ? " model-only" : ""}${pureModel && selected === "第一校區" ? " first-model" : ""}${mode === "home" ? " map-home" : ""}${mode === "map" ? " art-game" : ""}`}>
    <div ref={miniatureHostRef} className="three-world jiangong-world" hidden={!pureModel} aria-label={`${selected} 3D 校園微縮模型`} />
    {mode==="world"&&<div className={`loading ${loaded ? "hidden" : ""}`}><span className="loader-orbit"/><b>正在載入{selected}微縮模型</b></div>}
    {sceneError&&mode==="world"&&<p role="alert">{sceneError}</p>}
    {pureModel&&<nav className="model-controls" aria-label="校區導覽">
      <button type="button" onClick={returnHome}>返回選單</button>
      <div className="model-view-tools">
        <button type="button" disabled={!loaded || Boolean(sceneError)} onClick={() => miniatureRef.current?.toggleDayNight()} aria-label={modelNight ? "切換至白天" : "切換至夜晚"} title={modelNight ? "切換至白天" : "切換至夜晚"}><span aria-hidden="true">{modelNight ? "☀" : "☾"}</span></button>
        <button type="button" disabled={!loaded || Boolean(sceneError)} onClick={() => miniatureRef.current?.resetView()} aria-label="重設視角" title="重設視角"><span aria-hidden="true">↶</span></button>
      </div>
      <button type="button" className="model-enter-game" onClick={() => enterMap(selected)}>進入遊戲</button>
    </nav>}
    {!pureModel&&<header className="game-bar"><button className="mini-brand" type="button" onClick={mode==="map"?exitMap:returnHome} aria-label="高科生力軍首頁"><Image className="brand-logo" src="/logo-guide.png" alt="" width={52} height={52} priority /><span>高科生力軍<small>guide_nkust</small></span></button>{mode!=="home"&&<button className="sound" aria-label="音效尚未開放">♪</button>}</header>}
    {mode==="home"&&<CampusMap campuses={campuses} onSelect={focusCampus} />}
    {mode==="map"&&<div className="art-game-layout">
    <section className={`map2d ${selected==="燕巢校區"?"yanchao-map":selected==="第一校區"?"first-campus-map":selected==="旗津校區"?"qijin-map":selected==="楠梓校區"?"nanzih-map":""}`} style={{"--map-aspect":selected==="建工校區"?1136/793:3579/2552} as React.CSSProperties} aria-label={`${selected}藝術品 2D 導覽圖`}>
      <div className="map2d-sheet">
        <Image src={campusMapImage} alt={`${selected}藝術散步地圖`} width={selected==="建工校區"?1136:3579} height={selected==="建工校區"?793:2552} priority/>
        {selected==="第一校區"&&<>
          <span className="facility-label history-room">校史室</span>
          <span className="facility-label dream-workshop">創夢工廠</span>
        </>}
        {activeArtSpots.map((spot, index) => {
          const placed = placedArtSpots.includes(spot.name);
          return <button key={`source-${spot.name}`} className={`art-source ${selectedArtSpot === spot.name ? "active" : ""} ${placed ? "placed" : ""}`} draggable={!placed} style={{left:`${spot.sourceX}%`,top:`${spot.sourceY}%`}} onClick={() => selectArtSpot(spot.name)} onPointerDown={(event) => beginPointerDrag(event, spot.name)} onPointerMove={movePointerDrag} onPointerUp={finishPointerDrag} onPointerCancel={() => {setDraggingArtSpot(null);setPointerDrag(null);}} onDragStart={() => setDraggingArtSpot(spot.name)} onDragEnd={() => setDraggingArtSpot(null)} aria-label={`地圖上的作品標籤 ${index + 1}，${spot.name}`}>
            <span>{index + 1}</span>
            <strong>{spot.name}</strong>
          </button>;
        })}
        {extraMapLabels.map((spot) => <span key={`extra-${spot.name}`} className="map-art-note extra" style={{left:`${spot.labelX}%`,top:`${spot.labelY}%`}}>{spot.name}</span>)}
        {activeArtSpots.map((spot, index) => {
          const placed = placedArtSpots.includes(spot.name);
          return <button key={spot.name} className={`art-slot ${choiceTarget === spot.name ? "active" : ""} ${placed ? "placed" : "empty"}`} data-art-slot={spot.name} style={{left:`${spot.labelX}%`,top:`${spot.labelY}%`,"--slot-x":`${spot.labelX}%`,"--slot-y":`${spot.labelY}%`} as React.CSSProperties} onClick={() => placeSelectedArtSpot(spot.name)} onDragOver={(event) => event.preventDefault()} onDrop={() => placeArtSpot(spot.name)} aria-label={`標籤放置區 ${index + 1}，${spot.place}`}>
            {placed?<strong>{spot.name}</strong>:<em>選答案</em>}
          </button>;
        })}
        {choiceTargetSpot&&<div className="map-location-hint" style={{left:`${choiceTargetSpot.sourceX}%`,top:`${choiceTargetSpot.sourceY}%`}} aria-live="polite"><span>{choiceTargetNumber}</span></div>}
        {pointerDrag&&<div className="drag-ghost" style={{left:pointerDrag.x,top:pointerDrag.y}}><span>{activeArtSpots.findIndex((spot) => spot.name === pointerDrag.name) + 1}</span><strong>{pointerDrag.name}</strong></div>}
      </div>
    </section>
    <aside className="art-game-panel" aria-label="作品配對作答區" hidden={!choiceTarget && !showArtDetails}>
      <div ref={gamePanelRef} className="art-game-panel-content">
    {showArtDetails&&
      <aside className="quest-card game-card" aria-live="polite">
        <button className="quest-collapse" type="button" onClick={() => setQuestCardCollapsed(true)} aria-label="收合作品介紹">收合</button>
        <small>任務進度 {completedCount} / {activeArtSpots.length}</small>
        <h2>{currentArtSpot.name}</h2>
        <div className={`art-preview ${currentArtSpot.image ? "single" : ""}`} aria-label={`提示圖片：${currentArtSpot.place}`} style={currentArtSpot.image ? {aspectRatio:currentArtSpot.imageRatio} : {backgroundImage:`url(${campusMapImage})`,backgroundPosition:`${currentArtSpot.previewX}% ${currentArtSpot.previewY}%`}}>
          {currentArtSpot.image&&<Image src={currentArtSpot.image} alt={`${currentArtSpot.name}作品圖`} fill sizes="(max-width: 700px) 86vw, 308px" style={{objectFit:"contain",objectPosition:"center"}} />}
          {currentArtSpot.image&&<button className="art-photo-open" type="button" onClick={() => artworkDialogRef.current?.showModal()} aria-label={`放大${currentArtSpot.name}作品圖片`} title="放大作品圖片"><Maximize2 size={18} aria-hidden="true" /></button>}
        </div>
        <dl className="spot-intro">
          <div><dt>找尋提示</dt><dd>{currentArtSpot.clue}</dd></div>
          <div><dt>作品介紹</dt><dd>{currentArtSpot.intro}</dd></div>
        </dl>
        {placedArtSpots.includes(currentArtSpot.name)?<b className="answer-result correct">已完成：{currentArtSpot.name}</b>:null}
      </aside>}
    {choiceTarget&&<section className="choice-popover" aria-live="polite">
      <small>選擇這一格的作品</small>
      <b>請看地圖中的 {choiceTargetNumber} 號位置</b>
      <div>{choiceOrder.map((name) => <button key={name} onClick={() => chooseArtForSlot(name)}>{name}</button>)}</div>
      {choiceError&&<p>{choiceError}</p>}
      <button className="choice-close" type="button" onClick={() => {setChoiceTarget(null);setChoiceError("");}}>取消</button>
    </section>}
      </div>
    </aside>
    </div>}
    {mode==="map"&&<dialog ref={artworkDialogRef} className="artwork-lightbox" aria-labelledby="artwork-photo-title">
      <header><h2 id="artwork-photo-title">{currentArtSpot.name}</h2><button type="button" onClick={() => artworkDialogRef.current?.close()} aria-label="關閉作品大圖" title="關閉作品大圖"><X size={24} aria-hidden="true" /></button></header>
      <div className="artwork-lightbox-image">{currentArtSpot.image&&<Image src={currentArtSpot.image} alt={`${currentArtSpot.name}完整作品照片`} fill sizes="100vw" style={{objectFit:"contain"}} />}</div>
    </dialog>}
    {mode==="map"&&<div className="map-hud"><button onClick={exitMap}>← 返回校區選單</button><small>配對遊戲</small><h1>{selected.replace("校區","")}藝術地圖</h1><span className="map-game-progress" aria-label="配對進度" aria-live="polite">{completedCount} / {activeArtSpots.length}</span><p>本次挑戰 {activeArtSpots.length} 件公共藝術，點空格選擇正確作品</p></div>}
    {mode==="map"&&showConfetti&&<div className="completion-confetti" aria-hidden="true">{Array.from({length:18},(_,index)=><i key={index}/>)}</div>}
    {mode==="map"&&showCelebration&&<dialog ref={completionDialogRef} className="complete-celebration" aria-live="assertive" aria-labelledby="completion-title" onCancel={() => {setCelebrationDismissed(true);setShowConfetti(false);}}>
      <div className="celebration-burst" aria-hidden="true"><span>★</span><span>✦</span><span>★</span><span>✦</span></div>
      <div className="complete-card">
        <button className="complete-close" type="button" onClick={() => {setCelebrationDismissed(true);setShowConfetti(false);}} aria-label="關閉完成提示">×</button>
        <small>{selected}藝術巡禮完成</small>
        <h2 id="completion-title">全部成功！</h2>
        <p>你已經把 {activeArtSpots.length} 件公共藝術都配對到正確位置。</p>
        <button type="button" onClick={openCompletionSurvey}>填寫回饋問卷</button>
      </div>
    </dialog>}
    {mode!=="home"&&<div className={`guide-hud ${mode==="map"&&isArtQuestComplete ? "complete" : ""}`}><button className="guide-character" onClick={() => mode==="map"?exitMap():focused?resetView():focusCampus(selected)} aria-label="和導覽員小高互動"><span className="guide-spark">✦</span>{mode==="map"&&isArtQuestComplete&&<span className="guide-complete-spark">完成！</span>}<Image key={`${selected}-${focused}-${mode}`} src="/guide.webp" alt="導覽員小高" width={420} height={420} sizes="(max-width: 700px) 104px, 190px"/></button><div><small>小高說</small><p>{mode==="map"?isArtQuestComplete?"太棒了，全部作品都完成了！":`這裡標出${currentArtSpot.place}的藝術品線索！`:`這是${current.name}的 3D 微縮模型，可以旋轉、縮放觀看。`}</p></div></div>}
    {mode!=="home"&&<div className="gesture-tip"><span>↔</span> 拖曳平移 <i/> <span>⊕</span> 雙指縮放</div>}
    <style>{`
      .label-layer{position:absolute;inset:0;pointer-events:none;z-index:4}.island-name{padding:7px 12px;background:rgba(255,253,242,.9);border:2px solid #10365d;border-radius:999px;color:#10365d;font-size:12px;font-weight:900;letter-spacing:.08em;box-shadow:3px 4px 0 rgba(16,54,93,.18);white-space:nowrap;transition:.25s}.island-name:after{content:"";position:absolute;left:50%;top:100%;width:2px;height:13px;background:#10365d}.island-name.active{background:#10365d;color:#fff;transform:scale(1.08)}
      .map2d{position:absolute;z-index:5;inset:0;padding:86px 350px 78px 250px;background:linear-gradient(180deg,rgba(170,223,230,.96),rgba(131,199,211,.94));overflow:auto}.map2d-sheet{position:relative;width:min(70vw,1180px);margin:0 auto;border:3px solid rgba(255,255,255,.9);border-radius:8px;box-shadow:0 24px 70px rgba(16,54,93,.22);background:#eaf8fa}.map2d-sheet img{display:block;width:100%;height:auto;border-radius:5px}.art-source{position:absolute;translate:-50% -50%;display:none;grid-template-columns:22px auto;align-items:center;gap:5px;min-width:88px;height:28px;border:0;border-radius:999px;background:rgba(255,253,244,.97);color:#173f86;padding:3px 8px 3px 4px;box-shadow:0 4px 12px rgba(16,54,93,.16);cursor:grab;text-align:left;touch-action:none}.art-source:active{cursor:grabbing}.art-source span{width:20px;height:20px;border-radius:50%;display:grid;place-items:center;background:#e66b2e;color:#fff;font-size:11px;font-weight:900}.art-source strong,.art-slot strong{font-size:13px;font-weight:900;line-height:1.05;color:#173f86}.art-source.active{box-shadow:0 0 0 5px rgba(243,189,69,.38),0 4px 12px rgba(16,54,93,.16)}.art-source.placed{opacity:0;pointer-events:none}.map2d .art-slot{z-index:2}.art-slot{position:absolute;translate:-50% -50%;width:108px;height:34px;border:2px dashed rgba(16,54,93,.34);border-radius:10px;background:#fff;color:#10365d;display:grid;place-items:center;padding:3px 8px;box-shadow:0 0 0 5px #fff,0 6px 13px rgba(16,54,93,.12);font-weight:900;cursor:pointer;text-align:center}.art-slot em{font-style:normal;color:#8c8078;font-size:11px;letter-spacing:.08em}.art-slot.active{border-style:solid;border-color:#10365d;box-shadow:0 0 0 5px #fff,0 0 0 9px rgba(243,189,69,.38),0 6px 12px rgba(16,54,93,.14)}.art-slot.placed{border-style:solid;border-color:#1f7a52;background:#fff}.art-slot.placed strong{color:#173f86}.drag-ghost{position:fixed;z-index:30;display:grid;grid-template-columns:20px auto;align-items:center;gap:5px;min-width:80px;height:30px;padding:4px 9px 4px 5px;border-radius:999px;background:rgba(255,253,244,.96);border:2px solid #10365d;color:#173f86;pointer-events:none;transform:translate(-50%,-50%);box-shadow:0 9px 24px rgba(16,54,93,.22)}.drag-ghost span{width:20px;height:20px;border-radius:50%;display:grid;place-items:center;background:#e66b2e;color:#fff;font-size:11px;font-weight:900}.drag-ghost strong{font-size:11px;line-height:1;white-space:nowrap}.map-name{padding:4px 7px;border-radius:7px;background:rgba(255,255,255,.9);border:1px solid #10365d;color:#10365d;font-size:9px;font-weight:900;white-space:nowrap}.map-title-3d{padding:8px 14px;border-radius:999px;background:#10365d;color:#fff;font-size:14px;font-weight:900;letter-spacing:.08em;white-space:nowrap}.map-hud{position:absolute;z-index:7;left:clamp(15px,4vw,55px);top:95px;padding:17px 19px;border-radius:18px;background:rgba(255,250,235,.86);backdrop-filter:blur(12px);box-shadow:0 12px 35px rgba(16,54,93,.18)}.map-hud button{border:0;background:transparent;color:#287f88;font-size:11px;font-weight:900;padding:0 0 10px}.map-hud small{display:block;color:#287f88;font-size:10px;font-weight:900;letter-spacing:.15em}.map-hud h1{font-size:23px;margin:4px 0}.map-hud p{font-size:11px;margin:0;font-weight:700}.quest-card{position:absolute;z-index:7;right:clamp(15px,4vw,55px);top:95px;width:min(360px,calc(100vw - 30px));padding:17px 18px;border-radius:18px;background:rgba(255,253,244,.92);border:2px solid #10365d;box-shadow:5px 6px 0 rgba(16,54,93,.14);backdrop-filter:blur(12px)}.quest-card small{color:#287f88;font-size:10px;font-weight:900;letter-spacing:.15em}.quest-card h2{font-size:21px;margin:5px 0 7px}.quest-card b{font-size:11px;color:#8b5a14;letter-spacing:.08em}.art-preview{height:104px;border:2px solid rgba(16,54,93,.2);border-radius:8px;background-color:#fff;background-image:url('/jiangong-art-map.webp');background-repeat:no-repeat;background-size:360%;box-shadow:inset 0 0 0 999px rgba(255,255,255,.05);margin:9px 0 10px;overflow:hidden}.art-preview.single{position:relative;height:300px;background-image:none;box-shadow:none}.spot-intro{display:grid;gap:8px;margin:0 0 10px}.spot-intro div{padding:8px 9px;border-radius:8px;background:rgba(16,54,93,.06)}.spot-intro dt{margin:0 0 3px;color:#287f88;font-size:10px;font-weight:900;letter-spacing:.12em}.spot-intro dd{margin:0;color:#10365d;font-size:12px;line-height:1.55;font-weight:800}.answer-result{display:block;margin-top:10px}.answer-result.correct{color:#1f7a52}.answer-result.wrong{color:#b44444}.quest-list{position:absolute;z-index:7;left:50%;bottom:18px;translate:-50% 0;display:flex;gap:6px;max-width:calc(100vw - 24px);padding:6px;overflow:auto;border-radius:16px;background:rgba(255,255,255,.48);border:1px solid rgba(255,255,255,.58);backdrop-filter:blur(12px)}.quest-list button{border:0;border-radius:11px;background:transparent;color:#10365d;padding:8px 11px;font-size:10px;font-weight:900;white-space:nowrap}.quest-list button.active{background:#10365d;color:#fff}
      .explore-tip{position:absolute;z-index:7;left:50%;top:15%;translate:-50% 0;padding:9px 16px;border-radius:999px;background:rgba(16,54,93,.38);border:1px solid rgba(255,255,255,.4);backdrop-filter:blur(10px);color:white;font-size:12px;font-weight:800;letter-spacing:.08em;white-space:nowrap}.back-view{display:block!important;background:transparent!important;box-shadow:none!important;padding:0 0 12px!important;color:#287f88!important}.campus-hud.focused{animation:hud-in .45s ease}.enter-campus{animation:enter-pulse 1.8s ease-in-out infinite}
      .guide-character{position:relative;border:0;background:transparent;padding:0;cursor:pointer;transform-origin:60% 90%;animation:guide-breathe 3.2s ease-in-out infinite}.guide-character img{display:block;transform-origin:48% 60%;animation:guide-arrive .65s cubic-bezier(.2,1.5,.5,1),guide-look 4.8s ease-in-out .7s infinite}.guide-spark{position:absolute;z-index:2;left:15%;top:5%;color:#fff;font-size:20px;text-shadow:0 0 8px #f3bd45;animation:guide-spark 1.4s ease-in-out infinite}
      @keyframes hud-in{from{opacity:0;transform:translateX(-18px)}}@keyframes enter-pulse{50%{transform:translateY(-2px);box-shadow:0 7px 0 #c78e28}}@keyframes guide-breathe{50%{transform:translateY(-6px) scale(1.025)}}@keyframes guide-look{0%,25%,100%{transform:rotate(0)}35%,48%{transform:rotate(-3deg) translateX(-3px)}58%,70%{transform:rotate(2deg) translateX(2px)}}@keyframes guide-arrive{0%{opacity:0;transform:translateY(24px) scale(.75) rotate(8deg)}70%{transform:translateY(-7px) scale(1.05) rotate(-2deg)}100%{opacity:1}}@keyframes guide-spark{50%{opacity:.15;transform:scale(.5) rotate(90deg)}}
      .road-name{padding:3px 8px;border-radius:999px;background:rgba(54,62,65,.9);color:#fff;font-size:9px;font-weight:900;letter-spacing:.12em;white-space:nowrap}
      .art-preview.single{height:auto!important}
      @media(max-width:900px){.map2d{padding:305px 12px 90px}.map2d-sheet{width:min(92vw,560px)}.art-source{min-width:72px;height:24px}.art-source strong,.art-slot strong{font-size:11px}.art-slot{width:58px;height:24px;border-style:solid;box-shadow:none}.art-slot.empty{width:58px;min-width:58px}.map-hud{top:76px}.quest-card{left:12px;right:12px;top:190px;width:auto}}@media(max-width:700px){.island-name{font-size:10px;padding:5px 8px}.explore-tip{top:11%;font-size:10px}.campus-hud.focused{bottom:120px}.quest-list{left:9px;right:9px;translate:0;bottom:12px}.quest-list button{padding:7px 9px;font-size:9px}}
      .choice-popover{position:absolute;z-index:10;left:50%;bottom:18px;translate:-50% 0;width:min(440px,calc(100vw - 24px));padding:10px;border-radius:16px;background:rgba(255,253,244,.95);border:2px solid #10365d;box-shadow:5px 6px 0 rgba(16,54,93,.14);backdrop-filter:blur(12px)}.choice-popover small{display:block;color:#287f88;font-size:10px;font-weight:900;letter-spacing:.12em}.choice-popover b{display:block;margin:4px 0 8px;color:#10365d;font-size:13px}.choice-popover div{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}.choice-popover button{border:0;border-radius:11px;background:#fff;color:#10365d;padding:9px 8px;font-size:11px;font-weight:900;white-space:nowrap}.choice-popover button.active{background:#10365d;color:#fff}.choice-popover p{margin:8px 0 0;color:#b44444;font-size:12px;font-weight:900}.choice-close{position:absolute;right:8px;top:8px;padding:5px 7px!important;background:rgba(16,54,93,.08)!important}
      .yanchao-map .art-slot,.yanchao-map .art-slot.empty{width:82px;min-width:82px;height:26px}.first-campus-map .art-slot{width:74px;height:20px}.qijin-map .art-slot,.qijin-map .art-slot.empty{width:82px;min-width:82px;height:22px}.qijin-map .art-slot strong,.qijin-map .art-slot em{font-size:10px;line-height:1;letter-spacing:0;white-space:nowrap}.nanzih-map .art-slot,.nanzih-map .art-slot.empty{width:82px;min-width:82px;height:24px}.nanzih-map .art-slot strong,.nanzih-map .art-slot em{font-size:10px;line-height:1.05;letter-spacing:0}.map-art-note{position:absolute;z-index:1;translate:-50% -50%;color:#173f86;font-family:"DFKai-SB","BiauKai",serif;font-size:clamp(8px,.95vw,16px);font-weight:800;letter-spacing:.04em;text-shadow:0 1px 0 #fff,0 -1px 0 #fff,1px 0 0 #fff,-1px 0 0 #fff;white-space:nowrap;pointer-events:none}.map-art-note.extra{color:#a64a32}.map-location-hint{position:absolute;z-index:4;translate:-50% -50%;width:34px;height:34px;border-radius:50%;display:grid;place-items:center;background:#e8662f;color:#fff;border:3px solid #fff;box-shadow:0 0 0 4px #ffcf38,0 4px 12px rgba(16,54,93,.3);pointer-events:none}.map-location-hint span{font-size:14px;font-weight:950;line-height:1}
      .facility-label{position:absolute;z-index:1;color:#9b482d;font-family:"DFKai-SB","BiauKai",serif;font-size:clamp(9px,1.05vw,18px);font-weight:700;letter-spacing:.08em;white-space:nowrap;pointer-events:none}.facility-label.history-room{left:72.5%;top:52.5%}.facility-label.dream-workshop{left:88.5%;top:57.5%}
      @media(max-width:700px){.map2d{padding:245px 10px 150px}.map2d-sheet{width:min(94vw,560px)}.art-source{display:none}.art-slot{width:58px;height:24px;border-radius:8px;padding:2px 4px;background:#fff;border-style:solid;box-shadow:none}.art-slot.empty{width:58px;min-width:58px}.yanchao-map .art-slot,.yanchao-map .art-slot.empty{width:54px;min-width:54px;height:19px}.first-campus-map .art-slot,.first-campus-map .art-slot.empty{width:60px;min-width:60px;height:18px}.qijin-map .art-slot,.qijin-map .art-slot.empty{width:64px;min-width:64px;height:19px}.qijin-map .art-slot strong,.qijin-map .art-slot em{font-size:8px;line-height:1;letter-spacing:0;white-space:nowrap}.nanzih-map .art-slot,.nanzih-map .art-slot.empty{width:70px;min-width:70px;height:20px}.art-slot strong,.art-slot em{font-size:9px;line-height:1}.yanchao-map .art-slot strong,.yanchao-map .art-slot em{font-size:8px;line-height:.95;letter-spacing:0}.nanzih-map .art-slot strong,.nanzih-map .art-slot em{font-size:8px;line-height:.95;letter-spacing:0}.choice-popover{left:12px;right:12px;bottom:82px;translate:0;width:auto;padding:12px}.choice-popover div{grid-template-columns:repeat(2,1fr);gap:9px}.choice-popover button{min-height:42px;padding:11px 8px;font-size:12px}.guide-hud{right:0;bottom:126px}.guide-hud img{width:96px;margin-right:-12px}.gesture-tip{white-space:nowrap;font-size:9px;padding:6px 10px}.gesture-tip i{margin:0 5px}.quest-card{top:auto!important;bottom:104px!important;max-height:min(58svh,520px);overflow-y:auto;overscroll-behavior:contain}.quest-card h2{margin-right:78px}.art-preview.single{max-height:28svh}.spot-intro dd{font-size:11px;line-height:1.45}.map-hud{top:94px;max-width:min(76vw,270px)}.quest-card-toggle{top:112px}}
    `}</style>
  </main>;
}
