# Phase 2 GitHub 保存範圍

本開發分支以既有遠端 main 為基底，保存已完成的前端、工程計算核心、核對API、SQLite結構、驗證與測試程式，以及使用文件；不新增工程數值核准或變更計算公式。

## 不納入本次提交

- 原始PDF、PDF轉繪影像、原廠全文／註記及擷取能力數值。
- 26,114筆候選資料、CSV、核對baseline、來源索引與優先核對資料檔。
- `.local/`內的工作／測試SQLite、人工核對歷史及瀏覽器截圖。
- 憑證、環境設定值、node_modules、dist與快取。

原始分析報告`docs/manufacturer/README.md`亦保留在本機，不隨此分支新增公開。資料格式JSON Schema與不含原廠數值的SQL草案則納入版本控制。

既有main已包含的原廠PDF沿用原提交，不在本次變更中新增、修改或刪除。此說明不表示已取得原廠資料的重散布授權。

## 重現與驗證限制

`npm ci`與`npm run build`可從程式碼建立前端；`npx vitest run`執行35項一期工程核心測試。

`npm test`已改為獨立虛構資料測試。`npm run test:private`保留15項原廠資料／SQLite驗證測試；`review:prepare`、`review:server`及PDF頁面轉繪也依賴本次未公開提交的本機資料。請先由具有權限的維護者，透過組織允許的非公開管道提供Phase 2說明列出的原始PDF及擷取資料，並核對來源SHA-256。不要為了通過測試而將原廠資料提交到公開GitHub，獨立私有測試遇缺檔時明確回報SKIPPED / MISSING_PRIVATE_DATA（原有15項未執行），不得計為通過或更改原有斷言。

本次提交前已在保有完整資料的工作區執行50項測試及正式建置；這不表示沒有原廠資料的全新checkout已通過完整測試。

資料初始狀態為UNVERIFIED、整表UNAPPROVED；人工資料核對不等於正式工程核准。本機核對API尚無登入驗證，不應直接公開部署。
