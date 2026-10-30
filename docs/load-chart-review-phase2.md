# Phase 2：Load Chart 資料驗證與資料庫準備

本版本僅供本機人工資料核對。**數據 VERIFIED 不等於表格核准；所有型錄能力資料目前均不能用於正式能力判定。** 沒有改動 Phase 1 計算公式，也沒有將原廠候選數據混入虛構測試表。

## 實際檔案位置

專案根目錄為 `/workspace/construction`。以下檔案已存於該 Git 專案工作區；尚未提交或推送 GitHub。

| 用途 | 實際路徑 |
| --- | --- |
| 分析報告 | `/workspace/construction/docs/manufacturer/README.md` |
| 原始候選 JSON | `/workspace/construction/docs/manufacturer/ltm1300-6-3/capacity-candidates.json` |
| 原始逐筆 CSV | `/workspace/construction/docs/manufacturer/ltm1300-6-3/manual-review.csv` |
| 原廠註記 | `/workspace/construction/docs/manufacturer/ltm1300-6-3/notes.json` |
| 文件及配置索引 | `/workspace/construction/docs/manufacturer/ltm1300-6-3/manifest.json` |
| 原始表格列欄 | `/workspace/construction/docs/manufacturer/ltm1300-6-3/raw-grid.json` |
| 全 PDF 原文與座標 | `/workspace/construction/docs/manufacturer/ltm1300-6-3/source-pages.json` |
| Phase 2 初始 UNVERIFIED JSON | `/workspace/construction/docs/manufacturer/ltm1300-6-3/review-baseline.json` |
| 同欄位初始 CSV | `/workspace/construction/docs/manufacturer/ltm1300-6-3/review-baseline.csv` |
| 優先核對索引 | `/workspace/construction/docs/manufacturer/ltm1300-6-3/priority-review.json` |
| SQLite 七表結構 | `/workspace/construction/database/review-schema.sql` |
| 實際核對資料庫（ignored） | `/workspace/construction/.local/load-chart-review.sqlite` |
| 原始 PDF（ignored） | `/workspace/construction/.local/manufacturer/300T-G.pdf` |

每筆資料以文件SHA-256、文件碼、table_id、pdf_page、data_row、data_column、bbox_pt及原始詞級座標追溯。PDF／印刷頁碼一開始計數；data_row/column不含表頭與左右半徑欄。raw-grid的合併儲存格列欄是另一組座標，不可混用。原始候選檔保留先前 `PENDING_MANUAL_REVIEW` 擷取標記作為不可變來源證據；**Phase 2 的權威核對狀態在初始baseline及SQLite中全部設為 UNVERIFIED**。重新匯入不會重置後續人工核對。

## 啟動核對介面

需要 Node.js 24+、Python 3及PyMuPDF 1.26.6（本環境已具備；其他環境可用虛擬環境執行 `python3 -m pip install -r scripts/review-requirements.txt` 安裝）。在專案根目錄執行：

```sh
npm ci
npm run review:prepare
npm run review:server
```

另開終端機：

```sh
cd /workspace/construction
npm run dev
```

開啟 Vite 的5173 port，選擇「負載表人工核對」，或於網址尾端使用 `/#load-chart-review`。後端綁定127.0.0.1:3001，Vite以同來源proxy轉送 `/api/review`。後端首次啟動匯入26,114筆，後續啟動保留狀態與歷史。`review:prepare`只建立初始核對快照及優先索引，**不是目前人工核對結果匯出，也不改變SQLite**。

原始PDF必須存在，且啟動時SHA-256需符合manifest；缺少時從manifest內的固定Git commit來源下載到上述位置，保留TLS驗證。不要以另一份同名PDF替換。核對頁直接顯示同SHA-256原始PDF轉繪的頁面影像，避免瀏覽器PDF插件不支援；亦可另開原始PDF。影像依原件雜湊分開儲存，啟動時補齊30頁。此版提供bbox文字定位，尚未做自動高亮。

## 核對操作

1. 選擇PDF頁碼／表格及能力欄配置；表頭原文可展開。欄位選擇不代表配置已確認。
2. 選擇狀態或優先事項；資料每頁最多50筆，避免將26,114筆一次渲染。
3. 點R／C開啟單筆，比對PDF、原始字串、候選數值與座標。修正欄使用kg、mm、rad，空白輸入是null，不是0。修正值不會直接改寫候選配置；日後正式匯入仍須依修正後的條件重建／複核配置關聯。
4. 填核對人與原因，選擇目標狀態，明確勾選逐筆確認，再儲存。時間由伺服器產生，原始值永不覆寫。
5. 批次限明確選取的本頁資料，最多100筆；只變更狀態並保留每筆既有修正值，不套用單筆編輯器的數字。更換條件、勾選資料或編輯內容後須重新確認。
6. 歷史顯示前後狀態、修正值、核對人、時間、原因及revision。遇到多人版本衝突整批回滾，重新載入後再核對。

| 狀態 | 意義 |
| --- | --- |
| UNVERIFIED | 尚未人工核對，所有首次匯入資料皆為此狀態 |
| VERIFIED | 已確認抄錄數據；不代表原廠來源適用、配置完整或表格核准 |
| REJECTED | 原擷取錯誤、不能採用；修正前後值仍保存 |
| NEEDS_REVIEW | 有疑義待處理，可保留未完成修正資料 |

核對空白可標示VERIFIED，但其能力仍為null；缺半徑的數字資料或UNRESOLVED不能標示VERIFIED。狀態退回、拒絕及修正都追加歷史。核對人目前自行填寫，**沒有身份驗證或電子簽章**；不可當作正式審查稽核身份。

## 優先人工確認項目

- **第34頁首列21格**：左右半徑文字不一致，半徑候選維持null；未自行修正成8 m。可用優先事項 `P34_RADIUS_MISMATCH` 篩選。
- 所有資料：逐腿支腿展伸、支承條件、底色對應4.94／5.94 m配重半徑。這些缺值不以尺寸圖猜測補入。
- 第16頁：後方作業欄、超過155.7 t／170 t所需額外滑輪組及特殊設備適用性。
- 星號欄：後方區域、僅TNZK模式；跨頁表格的欄位／附註綁定。
- 副臂／延伸段配置：只供保存核對，仍不在Phase 1自動能力判定支援範圍。
- 實車鉤組、吊具扣減與穿繞、風速與受風面積限制，以及正式操作手冊／負載表冊版本。

優先標籤獨立於核對狀態；不會因標籤而自動改為NEEDS_REVIEW或VERIFIED。完整筆數與21格清單見priority-review.json。

## 資料庫與安全限制

七表位於獨立SQLite檔，避免破壞一期吊裝計畫資料庫：

- crane_models → chart_documents：型號與固定來源文件／版本／SHA。
- load_chart_tables → chart_documents：表格原始頁與表頭、續表metadata。
- crane_configurations → load_chart_tables／chart_documents：各能力欄的候選配置；支腿與配重半徑未確認，resolution_status保持UNRESOLVED。
- load_chart_entries → 正確table／document／configuration：複合外鍵阻止跨表配置關聯，原始raw_json與修正corrected_json分離。
- load_chart_reviews：不可變更／刪除的逐筆歷史；資料更新必須對應新增的歷史及遞增revision。
- load_chart_notes → chart_documents：原廠註記及頁碼／座標來源。

原始值、來源列欄及配置關聯禁止直接覆寫；資料與歷史在同一交易更新。每個版本有樂觀鎖，避免覆寫別人的核對。原始來源JSON內保留其初始擷取標記，並不作為核對權威狀態。

本版document／table的approval_status由DB限制為UNAPPROVED，沒有核准或正式發布端點；之後需另設不可變核准版本與權限流程才能擴充。`formalLookup` 明確拒絕UNVERIFIED、錯誤配置、未核准文件／表格及未確認配置；即使逐筆VERIFIED仍回傳INSUFFICIENT_DATA。現有Phase 1 lookup未接入此資料庫，禁止自行將候選JSON轉為已核准Chart。

沒有內插；空白不轉零；不推估缺漏值。每格底色等原文仍保存，但**本階段不提供完整配置人工核准編輯器或正式工程能力查詢**。核對數據與工程發布保持分離。

本機API提供表格進度、分頁資料、註記、PDF、歷史與明確確認後的核對寫入。寫入需同來源UI標頭、禁止跨站；這不是登入授權機制。不要將未加身份驗證的API公開部署至多人正式工程環境。

## 測試

```sh
npm test
npm run test:private
npm run build
python3 scripts/validate-manufacturer.py
```

`npm test` 現在執行工程核心、虛構 SQLite 及 HTTP API 測試；原有35項核心測試保留。`npm run test:private` 在授權資料完整時執行原有15項Node SQLite／原廠資料驗證測試：全部26,114筆原始JSON/CSV欄位一致、baseline一致、頁表列欄及版本追溯、21筆半徑疑義、錯配置拒絕、未核對／未核准拒絕、原值保護、歷史追加、批次衝突回滾、空白null、重匯入不覆寫，以及未經歷史的直接更新拒絕。Node內建node:test直接執行檔案，會保留失敗exit code。

已另以環境提供的Playwright與系統Chromium完成瀏覽器操作測試，使用**獨立測試資料庫** `.local/load-chart-review-e2e.sqlite`：

```sh
REVIEW_PORT=3002 REVIEW_DB_PATH=.local/load-chart-review-e2e.sqlite node server/start-review.mjs
# 另一終端機；需可用的Playwright與Chromium（CHROMIUM_PATH可指定）
node scripts/review-browser-smoke.cjs
```

此腳本將5173介面的API請求轉至隔離3002 API，測試NEEDS_REVIEW／REJECTED篩選、確認前禁止儲存、單筆／批次操作、數字修正、歷史及重新整理持久化；測試數字不是原廠更正。不要將3002指向工作資料庫；可刪除該隔離測試檔後重跑。Playwright是目前環境提供的測試工具，不在package依賴內。

目前工作資料庫初始化結果：26,114筆UNVERIFIED、VERIFIED=0、REJECTED=0、NEEDS_REVIEW=0；34張表皆UNAPPROVED。這是本次驗證時觀察，不保證之後人工操作仍維持零進度。

最新獨立測試、無私有資料的 demo 及授權資料設定，請見 [Phase 2 測試與資料設定](phase2-test-data.md)。
