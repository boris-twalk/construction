-- Proposal only. Do NOT execute against production capacity tables.
-- Store the entire manifest, raw-grid and raw-page artifacts outside the operational chart repository.
CREATE TABLE chart_import_batches (
 id TEXT PRIMARY KEY, source_sha256 TEXT NOT NULL, source_commit TEXT NOT NULL,
 document_code TEXT NOT NULL, document_class TEXT NOT NULL,
 manifest_json TEXT NOT NULL CHECK(json_valid(manifest_json)),
 status TEXT NOT NULL DEFAULT 'PENDING_MANUAL_REVIEW',
 eligible_for_capacity_lookup INTEGER NOT NULL DEFAULT 0 CHECK(eligible_for_capacity_lookup=0)
);
CREATE TABLE chart_import_cells (
 id TEXT PRIMARY KEY, batch_id TEXT NOT NULL REFERENCES chart_import_batches(id),
 table_id TEXT NOT NULL, pdf_page INTEGER NOT NULL, data_row INTEGER NOT NULL, data_column INTEGER NOT NULL,
 raw_text TEXT NOT NULL, candidate_json TEXT NOT NULL CHECK(json_valid(candidate_json)),
 bbox_json TEXT NOT NULL CHECK(json_valid(bbox_json)),
 review_status TEXT NOT NULL DEFAULT 'PENDING_MANUAL_REVIEW'
 CHECK(review_status IN ('PENDING_MANUAL_REVIEW','VERIFIED','REJECTED')),
 reviewed_value_json TEXT CHECK(reviewed_value_json IS NULL OR json_valid(reviewed_value_json)),
 reviewer TEXT, reviewed_at TEXT, review_comment TEXT,
 CHECK(review_status!='VERIFIED' OR (reviewer IS NOT NULL AND reviewed_at IS NOT NULL AND reviewed_value_json IS NOT NULL)),
 UNIQUE(batch_id,table_id,data_row,data_column)
);
-- No automatic promotion to load_chart_entries. This brochure alone cannot satisfy the production release gate.
