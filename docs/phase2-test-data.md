# Phase 2 測試與授權資料設定

## 問題與診斷

原本 `npm test` 先執行 35 項工程測試，再直接載入 `server/review.test.mjs`。該檔在註冊 15 項測試前，便以 `importCandidates` 開啟私有資料與 PDF；全新 checkout 缺少 `manifest.json` 時立即拋出 `ENOENT`，15 項測試都尚未執行。這是測試資料依賴缺失與測試架構耦合，不是已證實的計算錯誤或資料權限錯誤。

目前將檔案讀取、純結構驗證、SQLite 匯入及 HTTP server 分開。一般測試使用完全獨立、虛構的 Truck Crane / All Terrain Crane fixture，不需 PDF、Python、網路或私有資料；API 測試需允許本機 socket。私有資料來源預設不會自動改用 fixture。缺少授權資料時 `review:server` 以 `MISSING_PRIVATE_DATA` 和非零狀態結束。

## 測試指令

在 `/workspace/construction`：

```sh
npm ci
npm test                 # engineering + synthetic SQLite + real HTTP API tests
npm run test:engineering # 既有 35 項核心測試
npm run test:db          # 獨立 SQLite／資料驗證測試
npm run test:api         # 獨立本機 HTTP 整合測試
npm run test:private     # 私有檔案缺少：明確 SKIPPED / MISSING_PRIVATE_DATA
npm run typecheck
npm run build
```

`test:private` 保留 `server/review.test.mjs` 的原有 15 項測試與所有斷言、26,114 筆／34 表／21 筆疑義等原始預期值。缺少必要檔案時回報一項 suite gate 略過，代表原有 15 項尚未執行，不算通過。資料完整時執行原有測試與 Python 原廠擷取驗證，保留失敗 exit status。檔案損壞、JSON 格式、SHA-256 不符等錯誤不會當作成功或略過。Python 的選用 jsonschema 檢查仍依既有驗證程式明確回報是否執行。

## 無私有資料時測試核對介面

```sh
npm run review:demo
# 另一終端機
npm run dev
```

demo API 使用 127.0.0.1:3001，資料庫預設 `.local/synthetic-review.sqlite`。UI 與 API 顯示 `SYNTHETIC_TEST_DATA`，不假造原廠 PDF；PDF 與頁面端點回傳 404。可測試逐筆核對、四種狀態、修正值、版本衝突與歷史。這不是正式能力判定，也不是原廠資料驗證。

## 授權環境載入私有資料

由有權限的維護者透過組織允許的非公開管道還原資料，勿將資料、憑證貼進聊天或提交公開 GitHub。支援兩種路徑：既有預設路徑，或明確指定資料目錄與 PDF。建議使用已忽略的 `private-data/`：

```sh
export REVIEW_DATA_DIR=/workspace/construction/private-data/load-chart
export REVIEW_PDF_PATH=/workspace/construction/private-data/source.pdf
npm run test:private
npm run review:prepare
npm run review:server
```

`REVIEW_DATA_DIR` 未設定時使用 `docs/manufacturer/ltm1300-6-3/`；`REVIEW_PDF_PATH` 未設定時使用 `.local/manufacturer/300T-G.pdf`。兩個環境變數亦適用於準備、轉繪與原廠驗證。工作資料庫預設 `.local/load-chart-review.sqlite`；`REVIEW_DB_PATH` 可指定另一檔案。資料庫不可混入虛構與私有文件；demo 不得使用預設工作資料庫位置。不要將測試指向有真實核對歷史的工作資料庫。

必要資料格式：

| 檔案 | 用途與格式 |
| --- | --- |
| `manifest.json` | JSON object；`source` 含 SHA-256、commit、model、document_code_raw、document_class；`regions` 含 id、pdf_page、columns；`chart_pages` 為頁碼陣列 |
| `capacity-candidates.json` | JSON array；每格含唯一 id、table_id、pdf_page、data_row、data_column、bbox_pt、半徑／主臂／能力候選值（mm/kg）及 value_kind；既有完整 schema 見 `docs/manufacturer/ltm1300-6-3/capacity-candidate.schema.json` |
| `notes.json` | JSON array；每筆含 id、pdf_page、原始註記與追溯資訊 |
| 原始 PDF | 必須與 manifest 的 SHA-256 一致；來源 API 僅服務此經驗證的檔案 |
| `manual-review.csv` | 與候選 JSON 欄位、筆數一致的逐筆資料 |
| `review-baseline.json` / `.csv`、`priority-review.json` | 原有私有測試所需初始核對快照、優先事項；`review:prepare` 可重建，不能取代人工歷史 |
| `source-pages.json`、`raw-grid.json` | 原始詞級座標與表格矩陣；Python 擷取完整性驗證所需 |

API 匯入只需 manifest、候選 JSON、notes 與匹配的 PDF；完整原廠測試還需其餘列出的資料。PDF 影像存於 `.local/manufacturer/review-pages/<SHA-256>/page-<N>.png`，由 `review:prepare` 或 `review:render` 建立。未建立影像時頁面 API 回傳 404。

忽略規則涵蓋 `private-data/`、`.local/`、PDF、SQLite 及既有原廠擷取目錄。不要將私有目錄改放到其他未忽略路徑；提交前使用 `git status` 與 `git check-ignore` 核對。

## 保留安全邊界

`UNVERIFIED`、`VERIFIED`、`REJECTED`、`NEEDS_REVIEW` 均保留；VERIFIED 僅表示抄錄核對。禁止工況不能以修正數值標示 VERIFIED。SQLite 的整表／文件 `UNAPPROVED`、配置 `UNRESOLVED`、不可變原值、追加歷史、樂觀鎖及整批回滾限制保留。`formalLookup` 額外明確拒絕 `SYNTHETIC_TEST_DATA`，不提供正式 PASS、核准或發布端點。Phase 2 不接入 Phase 1 計算；fixture 不由正式應用自動載入。既有工程核心的虛構資料隔離測試仍執行。
