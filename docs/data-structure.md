# 資料結構

內部重量 kg、長度 mm、角度 radians。反力使用 N、地盤壓力 Pa、面積 mm²（尚未計算）；禁止將 kg 當力直接代入。

| 表 | 用途 |
| --- | --- |
| crane_models | 廠牌、型號與吊車種類 |
| crane_units | 個別實車序號與牌照 |
| chart_documents | 來源、版本、SHA-256、虛構標記、核對人及時間、核准狀態 |
| crane_configurations | 配重、支腿跨距、吊臂、區域、附件及支承條件 |
| load_chart_tables | 文件、配置、原始頁碼與版次 |
| load_chart_entries | 精確半徑與能力；NULL 表示空白、另有禁止旗標 |
| load_chart_notes | 原始頁碼、註記及扣減規則 |
| load_chart_reviews | 文件版本、核對人與核對核准紀錄 |
| lift_plans | 計畫與不可覆寫版本、正式流程狀態 |
| lift_cases | 各工況重量、半徑、原廠扣減及支腿／地盤輸入欄位 |
| rigging_components | 吊具重量、WLL、角度與來源 |
| lift_checks | 獨立計算狀態、原因、輸入快照、計畫／表版次 |
| review_records | 工程審查紀錄 |
| attachments | 檔名、儲存鍵及雜湊 |

關聯：型號 → 實車、文件、配置；文件與配置 → 負載表 → entries/notes；計畫 → 工況 → 吊索具及檢核。SQL 見 database/schema.sql；初始化腳本另外建立子資料不可變 trigger，必須使用 npm run db:init。

正式流程 DRAFT、UNDER_REVIEW、APPROVED、SUPERSEDED 與計算 PASS、FAIL、INSUFFICIENT_DATA、NOT_APPLICABLE 完全獨立。核准版與其工況、吊具、檢核、附件、審查紀錄禁止直接異動；下一階段以交易新增版次並追加取代事件，目前不提供正式狀態轉移。來源負載表日後須加入版本不可變策略，現在不可作正式生產資料庫使用。

Plan、Chart、Configuration、Result 型別見 src/domain/engineering.ts。Zod 驗證配置及數值；UI adapter 僅記憶體，資料庫不由瀏覽器直接開啟。API 尚未實作，未具備身份驗證、持久化同步或權限控管。
