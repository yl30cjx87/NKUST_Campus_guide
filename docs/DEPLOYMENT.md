# 部署說明

## GitHub 驗證

每次推送到 `main` 或建立 Pull Request 時，GitHub Actions 會安裝鎖定版本的依賴、執行 lint 與完整測試。

```bash
npm ci
npm run lint
npm test
```

## 正式網站

目前正式網站使用既有 Sites／Cloudflare 設定；`.openai/hosting.json` 必須保留在專案根目錄。

正式部署前請確認：

1. `npm test` 通過。
2. 沒有提交 `.env`、金鑰、Token 或 `node_modules/`。
3. GitHub 的 `main` 分支內容為要發布的版本。

不要將任何部署憑證寫入 README、程式碼或 GitHub Actions 設定檔。
