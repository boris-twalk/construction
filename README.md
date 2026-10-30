# 吊裝計畫計算及檢核系統 — Phase 1

React + TypeScript + Vite、Tailwind CSS、Zod、Vitest；SQLite schema 與預留 API repository adapter。

**所有示範負載表均為虛構測試資料，不可作為實際吊裝依據。此軟體尚不可用於現場安全決策。**

## 啟動

需要 Node.js 24（SQLite 使用 Node 內建 node:sqlite）及 npm。

```sh
npm ci
npm run db:init
npm test
npm run build
npm run dev
```

瀏覽器開啟 Vite 顯示的開發位址（預設 port 5173）。正式編譯輸出為 dist/。SQLite 在 `.local/lift-planning.sqlite`；初始化可重複執行，不清除既有資料。執行指令的目錄均為專案根目錄。

## 已完成

十頁繁體中文導航；計畫草稿編輯、唯讀吊車配置與虛構負載表；重量加總、單位換算、精確半徑查找、原廠扣減輸入及使用率演示；計算狀態與審查狀態獨立；版次異動使檢核失效；SQLite 14 表、關聯及核准資料防覆寫；瀏覽器列印草稿。

UI 為記憶體示範，重新整理即重置；沒有連接 SQLite。`src/services/planRepository.ts` 定義非同步 API 邊界，SQLite 由未來後端存取。負載表管理、吊車管理目前為資料展示，尚無匯入與完整 CRUD。核准與送審按鈕刻意不開放。報告目前是列印／另存 PDF 草稿，並非正式 PDF 引擎。

## 限制

僅汽車式／全地形、單吊車單主鉤、支腿支承；不支援雙機、載人、輪胎支承或複雜副臂自動判定。無原廠真實資料；虛構表預設不能查詢，需明確啟用測試模式。計畫整體不會因測試計算 PASS 而合格。

未實作二肢吊索、支腿反力、地盤、吊點承載、風速及動態效應計算。系統不推估缺漏工程數據、不內插、不以標稱吊重代替負載表。測試資料中的核對、核准旗標僅模擬流程，不是真實核准。

## 下一階段

建立具驗證、權限與交易的後端 API，串接 SQLite 並保存不可變版次與稽核紀錄；加入原廠文件上傳、雜湊與雙人核對工作流、完整配置模型（各支腿展伸、吊臂模式、附件識別等）；經工程專業確認公式及測試案例後，再實作吊索與地盤檢核、正式 PDF 與端對端測試。現有簡化配置不足以表達所有實車條件。

文件：[資料結構](docs/data-structure.md)、[計算公式](docs/calculations.md)、[測試說明](docs/testing.md)。

## Phase 2 人工核對工作區

已新增Load Chart Review、獨立SQLite核對資料庫及本機API；啟動與操作、資料路徑、限制和驗證結果請見 [Phase 2 說明](docs/load-chart-review-phase2.md)。先執行 `npm run review:server`，再執行 `npm run dev`，進入「負載表人工核對」。原始26,114筆均初始化為UNVERIFIED，不核准或接入工程計算。

## GitHub 分支保存範圍

本分支不新增原廠PDF、擷取數據或本機SQLite。全新checkout的完整核對測試／啟動需要另以非公開方式還原資料，詳見 [公開提交範圍與重現限制](docs/github-publication.md)。本機資料及歷史不會因提交而刪除。
