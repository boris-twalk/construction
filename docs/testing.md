# 測試說明

執行 `npm test`（Vitest）、`npm run build`（TypeScript strict 與 Vite）、`npm run db:init`（14 表及保護 trigger）。

engineering.test.ts 覆蓋重量與單位、零值／負值／非有限值／無效輸入、全配置比對、配重與支腿不符、缺少精確半徑、空白格、禁止工況、缺少原廠資料、虛構資料隔離、註記確認、超載與扣減、最不利工況、版次失效與核准防覆寫。全部使用虛構測試資料，測試成功不能證明實際吊裝安全。

尚未涵蓋實車原廠案例、PDF 視覺回歸、瀏覽器端對端、API 交易／權限測試或任何尚未實作的進階工程計算。資料庫 smoke test 請執行 `node scripts/check-db.mjs`。
