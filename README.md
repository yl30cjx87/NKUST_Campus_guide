# 高科生力軍｜五校區藝術探索

國立高雄科技大學五校區互動式 3D 校園導覽與公共藝術配對遊戲。

使用者可從首頁選擇 **建工、燕巢、第一、楠梓、旗津** 五個校區，觀看可自由旋轉、縮放與切換日夜模式的 Three.js 微縮校園模型，再進入各校區的公共藝術配對遊戲。完成遊戲後，可進一步開啟回饋表單。

**正式網站：**
[https://nkust-art-islands.tcvs-bald.chatgpt.site/](https://nkust-art-islands.tcvs-bald.chatgpt.site/)

### 手機掃描

[<img src="./NKUST-art-quest-QR.png" alt="掃描 QR Code 開啟高科生力軍五校區藝術探索" width="220">](https://nkust-art-islands.tcvs-bald.chatgpt.site/)

掃描上方 QR Code，或直接點擊圖片進入正式網站。

---

## 功能

- 五校區首頁地圖：建工、燕巢、第一、楠梓、旗津。
- 校區模型：自由旋轉、上下傾斜、平移、滾輪／雙指縮放與重設視角。
- 日夜模式：平滑切換天空、窗光、路燈與校園活動。
- 建工：校門、校園生活與車輛進出動畫。
- 第一：主建築、NKUST、羽球與夜間 Live 活動。
- 旗津：港灣、水面、船舶與海岸生活動畫。
- 楠梓：三拱紅磚牌樓、道路、警衛室與校園入口微縮模型。
- 燕巢：山林吊橋、鐘塔、教學樓與橋上人物動畫。
- 五校區公共藝術配對遊戲、作品圖片檢視與完成回饋表單。

---

## 核心技術

- React 19
- Vinext
- Vite
- Three.js
- TypeScript
- Tailwind CSS
- ESLint
- Cloudflare Workers

---

## 環境需求

- Node.js `>= 22.13.0`
- npm（隨 Node.js 安裝）
- 支援 WebGL 的現代瀏覽器

> 不要複製 `node_modules`，也不要將 Git 密碼、Token、`.env` 或其他敏感環境變數提交至 Git repository。

---

## 本機開發

```bash
npm install
npm run dev
```

依終端機顯示開啟網址，通常為 `http://localhost:3000/`。

## 測試

```bash
npm test
```

測試會先完成正式建置，再驗證首頁、五校區路由、模型邊界、日夜切換、旋轉／縮放／平移、校園動畫、遊戲流程與資源清理。

---

## 專案結構

- `app/page.tsx`：組合網站主要流程與公共藝術遊戲。
- `app/features/campus-explorer/`：五校區 3D 選擇首頁功能。
- `app/features/art-quest/`：公共藝術遊戲的隨機與選題邏輯。
- `app/features/landscape/`：手機橫向體驗與方向控制。
- `app/shared/`：跨功能共用的路由與基礎工具。
- `app/scene/`：校區模型、日夜、角色、船舶、水面與互動控制。
- `public/`：公共藝術圖片、校區遊戲地圖與品牌素材。
- `tests/`：場景、操作、效能預算與遊戲流程測試。
- `worker/`：Vinext／Cloudflare Worker 入口。
- `docs/`：架構、部署與產品規格文件。
- `.github/workflows/ci.yml`：推送與 Pull Request 的自動檢查。
- `.openai/hosting.json`：網站發布設定。
- `docs/PRODUCT_RULES.md`：產品流程、視覺、遊戲、日夜與效能規格。
- `NKUST-art-quest-QR.png`：正式網站 QR Code。

---

## GitHub 交接與部署

### 1. 建立 Repository

在 GitHub 建立空白 repository，將本專案根目錄推送上去。

### 2. 執行自動檢查

GitHub Actions 已包含 Node.js 22 的 lint、測試與建置檢查；本機可依序執行：

   ```bash
   npm ci
   npm test
   npm run build
   ```

### 3. 正式網站部署

既有正式網站使用 `.openai/hosting.json` 的 Sites／Cloudflare 設定；保留此檔案，但不要將部署 Token、帳密或環境變數寫入 Git。

`dist/`、`.next/`、`.vinext/`、`.wrangler/`、`node_modules/` 與 `source-assets/` 都已在 `.gitignore` 排除：它們分別是建置輸出、依賴或歷史素材備份，不需要放進 GitHub。

---

## 延伸文件

- [專案架構](docs/ARCHITECTURE.md)
- [部署說明](docs/DEPLOYMENT.md)
- [產品規格](docs/PRODUCT_RULES.md)

---

## 常用指令

| 指令功能 | 說明 |
| --- | --- |
| `npm run dev` | 啟動本機開發伺服器 |
| `npm run build` | 建立正式版本 |
| `npm run start` | 啟動已建置的正式版本 |
| `npm test` | 執行完整建置與 3D／遊戲回歸測試 |
| `npm run lint` | 執行程式碼規則檢查 |
