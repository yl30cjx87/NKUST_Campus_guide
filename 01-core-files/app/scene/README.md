# 建工校區建築微縮模型

入口：`http://localhost:3000/#jiangong`。由校區選單選擇建工也會直接進入。
保留原本其他校區與配對遊戲。桌面頂部／手機底部為精簡 HTML 控制列，
模型取景區與按鈕分開，沒有覆蓋建築的大型資訊卡。

## 控制與整合

- 滑鼠左鍵／單指拖曳可左右旋轉、上下翻轉完整微縮模型；滾輪／雙指縮放，滑鼠右鍵／雙指平移。
- `N`：日夜切換；`R`：恢復完整取景；`Escape`：校區選單；`Enter`：進入建工配對遊戲。
- 場景完成載入後，外部 HTML 可呼叫 `window.setDayMode()`、`window.setNightMode()`、`window.toggleDayNight()`。
- 外部導覽可呼叫 `window.enterCampusGame()`、`window.returnToCampusSelection()`。
- `window.resetCampusView()` 或重設按鈕會回復模型朝向與相機取景，保留日夜狀態。
- `createJiangongScene(host, options)` 回傳 `sceneObjects`、`lights`、模式控制、`resetView()`、`setActive()` 與 `dispose()`。
- 可傳入 `onModeChange` 更新按鈕、`onBackgroundChange` 同步畫布外背景，沒有第二組過渡。
- 返回選單／進入遊戲後保留同一個 renderer 與模型，隱藏畫布並停止繪製、停用控制。
- 回到模型時保留原視角，預設白天並重新開始該次參觀的 8 秒計時；整個 React 頁面卸載時才釋放 GPU 資源及事件。
- 進入模型後約 8 秒，使用同一個 1.6 秒過渡自動切換夜晚，只執行一次，不自動切回白天。
- 手動日夜切換不取消或延後自動計時；若期限到時已經是夜晚，不重啟過渡。自動切換完成後，手動切回白天會保持白天。
- 分頁隱藏、WebGL context 中斷時暫停計時與過渡；恢復後延續剩餘時間。離開展示停用計時，重新進入則開始新一次參觀。

## 模型與效能

以校門照片的中央圓弧窗帶、左右翼、門廊柱列作為建模參考，並非測繪復原。
底座為 18 × 18，初始俯角約 37 度，略偏右前方。沒有照片貼圖、GLB、人物、車流或後製。
中央立面寬約 6、突出約 1.3，使用寬而淺的橢圓弧；左右翼各延伸約 5。
石材、紅磚、路面、草地採用 256px 程序貼圖，部分共用為微弱 bump；NKUST 使用簡單實體字。
日間採方向性暖陽與較低環境光；天空使用單一全畫面 shader 漸層與 512px 淡雲遮罩，共用既有日夜進度。
弧面採連續徑向法線，保留樓板與端面硬邊；玻璃、石材、金屬、葉片依材質使用不同粗糙度。
表面共用 256 × 128 程序環境照明，僅初始化時預濾一次，日夜只漸變材質強度。
太陽與環境光固定於世界座標，沒有跟隨相機的頭燈，也不逐幀拍攝反射或使用 SSR。
模型、底座與所有校園設施在同一個轉盤群組；拖曳時轉動模型而非相機，因此 PBR 材質依固定光向重新計算受光面、高光與邊緣反射。
太陽陰影只在轉盤持續移動時更新，模型停止後保留陰影快取；警衛室、入口與路燈則與模型一同轉動，不會在夜間錯位。
WebGL context 還原時重建預濾環境，卸載時釋放 render target。
中文校名用貼合曲面的字樣貼圖及微弱字影表現厚度，避免大量中文字幾何。

窗戶、灌木、棕櫚樹與道路標線採共用材質／InstancedMesh。
584 片窗玻璃中固定隨機選取 150 片微亮、70 片明亮（約 38% 亮燈），切換不重抽或重建模型。
同一組燈光與材質進行 1.6 秒漸變。只有太陽使用 1024px 陰影，
低記憶體／低核心數裝置使用 512px。3 盞 PointLight 與校名牆 SpotLight 都不投射陰影。
64px 共用接觸遮罩提供植物與建築落地感，不使用 SSAO。
夜間六處光池使用同一張 64px 徑向遮罩及 InstancedMesh，沒有新增真實燈光；保留冷色環境光、暖色入口照明與乾燥路面的微弱高光。
DPR 上限 1.5；靜止時不持續重繪，陰影只在模型轉動、日夜過渡或必要狀態變更時更新。

正常可見畫面測得約 48,188 triangles、76 draw calls，首次計算陰影另有額外成本。
桌面／手機直向／橫向採不同 FOV 與相機方向，根據零件包圍盒角點自動取景，減少空白且保留完整模型。
一般 resize 保留手動視角，明顯轉向或重設才重新取景；縮放與平移受限以避免穿模。
canvas 的 `data-triangles`、`data-draw-calls`、`data-window-levels`、`data-frames`、
`data-model-rotation`、`data-model-tilt`、`data-model-quaternion`、`data-shadow-revision`、
`data-scene-id`、`data-preset`、`data-geometries`、`data-textures`、`data-auto-night`、
`data-azimuth`、`data-sun-position`、`data-reflection-map` 可供診斷，
不是不同手機的 FPS 保證。

## 素材來源

- 建築外觀參考：[校門照片](https://pic.pimg.tw/kuas1022/1588992550-703157875_l.jpg)，僅用於建模觀察，未打包進網站。
- `helvetiker_regular.typeface.json` 取自 [Three.js r180](https://github.com/mrdoob/three.js/blob/r180/examples/fonts/helvetiker_regular.typeface.json)。
  原字型著作權及授權全文保留於 JSON 的 `original_font_information`。

## 驗證

執行 `npm run lint` 與 `npm test`。另外於瀏覽器檢查桌面／手機預設取景、
拖曳縮放、日夜切換、靜止停繪、進出場景與配對遊戲。
專案原有的 `tsc --noEmit` 尚有舊 3D 地圖名稱及 Cloudflare 環境型別錯誤，
不屬於本模組；不要把成功建置等同全專案型別檢查通過。
