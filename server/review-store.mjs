import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {z} from 'zod';
import {root,loadPrivateSource,assertSourceDatabase} from './review-data-source.mjs';
import {validateReviewData} from './review-data-validation.mjs';
export {root,artifacts,readArtifact} from './review-data-source.mjs';
export const statusSchema=z.enum(['UNVERIFIED','VERIFIED','REJECTED','NEEDS_REVIEW']);
const positive=z.number().finite().positive().nullable();
export const valuesSchema=z.object({radius_mm:positive,main_boom_length_mm:positive,capacity_kg:positive,jib_angle_rad:z.number().finite().min(0).max(Math.PI).nullable(),value_kind:z.enum(['NUMERIC','BLANK','UNRESOLVED'])}).strict().superRefine((v,ctx)=>{if(v.value_kind!=='NUMERIC'&&v.capacity_kg!==null)ctx.addIssue({code:'custom',message:'空白或未解決資料不得有能力值'});});
export const reviewSchema=z.object({items:z.array(z.object({id:z.string().min(1),revision:z.number().int().nonnegative(),corrected:valuesSchema.nullable()})).min(1).max(100),status:statusSchema,reviewer:z.string().trim().min(1).max(100),reason:z.string().trim().min(1).max(2000),confirmed:z.literal(true)}).strict();
export function candidateValues(raw){return {radius_mm:raw.radius_mm_candidate,main_boom_length_mm:raw.main_boom_length_mm_candidate,capacity_kg:raw.capacity_kg_candidate,jib_angle_rad:raw.jib_angle_rad_candidate,value_kind:raw.value_kind==='NUMERIC_CANDIDATE'?'NUMERIC':raw.value_kind==='BLANK'?'BLANK':'UNRESOLVED'};}
export function priorities(raw,region){return [...(raw.pdf_page===34&&raw.radius_mm_candidate===null?['P34_RADIUS_MISMATCH']:[]),'OUTRIGGER_UNRESOLVED','BALLAST_RADIUS_COLOR',...(raw.pdf_page===16?['SPECIAL_EQUIPMENT_THRESHOLD']:[]),...(raw.column_header_raw?.includes('*')||raw.slew_sector_candidate==='OVER_REAR_ONLY'?['SECTOR_OR_MODE_RESTRICTION']:[]),...(region.cross_page_group?['CROSS_PAGE']:[]),...(region.family!=='T'?['JIB_OUTSIDE_PHASE1']:[])];}
export function openStore(path){const db=new DatabaseSync(path);db.exec(readFileSync(new URL('database/review-schema.sql',root),'utf8'));db.exec('PRAGMA busy_timeout=5000');return db;}
export function importCandidates(db,source=loadPrivateSource()){
 const {manifest:m,entries,notes}=validateReviewData(source,{synthetic:source.synthetic});
 assertSourceDatabase(db,source);
 const existing=db.prepare('SELECT id FROM chart_documents WHERE source_sha256=?').get(m.source.sha256);
 if(existing){if(db.prepare('SELECT count(*) n FROM load_chart_entries WHERE document_id=?').get(existing.id).n!==entries.length)throw Error('Incomplete existing import');return {imported:0,total:entries.length};}
 const modelId=source.synthetic?'SYNTHETIC-TEST-FLEET':'LTM1300-6.3';
 const docId=modelId+'-'+m.source.sha256;db.exec('BEGIN IMMEDIATE');
 try{
 db.prepare('INSERT OR IGNORE INTO crane_models VALUES (?,?,?)').run(modelId,source.synthetic?'SYNTHETIC_TEST_DATA':'Liebherr',m.source.model);
 db.prepare('INSERT INTO chart_documents(id,model_id,source_sha256,source_commit,version,source_json,document_class) VALUES (?,?,?,?,?,?,?)').run(docId,modelId,m.source.sha256,m.source.commit,m.source.document_code_raw,JSON.stringify(m.source),m.source.document_class);
 const regions=new Map(m.regions.map(r=>[r.id,r]));
 for(const r of m.regions){db.prepare('INSERT INTO load_chart_tables(id,document_id,pdf_page,metadata_json) VALUES (?,?,?,?)').run(r.id,docId,r.pdf_page,JSON.stringify(r));r.columns.forEach((c,i)=>db.prepare('INSERT INTO crane_configurations(id,table_id,document_id,conditions_json) VALUES (?,?,?,?)').run(r.id+'-C'+(i+1),r.id,docId,JSON.stringify({...c,counterweight_kg_candidate:r.counterweight_kg_candidate,jib_type_candidates:r.jib_type_candidates,jib_length_mm_candidate:r.jib_length_mm_candidate,boom_extension_mm_candidate:r.boom_extension_mm_candidate,counterweight_radius_mm:null,outrigger_geometry_mm:source.synthetic?c.outrigger_geometry_mm:null,data_class:source.synthetic?'SYNTHETIC_TEST_DATA':undefined,source_version:m.source.document_code_raw})));}
 const insert=db.prepare('INSERT INTO load_chart_entries(id,table_id,document_id,configuration_id,pdf_page,data_row,data_column,raw_json,priority_json) VALUES (?,?,?,?,?,?,?,?,?)');
 for(const e of entries)insert.run(e.id,e.table_id,docId,e.table_id+'-C'+e.data_column,e.pdf_page,e.data_row,e.data_column,JSON.stringify(e),JSON.stringify(priorities(e,regions.get(e.table_id))));
 for(const n of notes)db.prepare('INSERT INTO load_chart_notes VALUES (?,?,?,?)').run(n.id,docId,n.pdf_page,JSON.stringify(n));
 db.exec('COMMIT');return {imported:entries.length,total:entries.length};
 }catch(e){db.exec('ROLLBACK');throw e;}
}
export function review(db,input){const data=reviewSchema.parse(input);if(new Set(data.items.map(i=>i.id)).size!==data.items.length)throw Error('重複項目');db.exec('BEGIN IMMEDIATE');
 try{for(const item of data.items){const old=db.prepare('SELECT * FROM load_chart_entries WHERE id=?').get(item.id);if(!old||old.revision!==item.revision)throw Error('版本衝突，請重新載入');const raw=JSON.parse(old.raw_json);const effective=item.corrected??candidateValues(raw);if(data.status==='VERIFIED'){valuesSchema.parse(effective);if(raw.prohibited||effective.value_kind==='UNRESOLVED'||(effective.value_kind==='NUMERIC'&&(effective.capacity_kg===null||effective.radius_mm===null||effective.main_boom_length_mm===null)))throw Error('未解決數值不可標示 VERIFIED');}
 const next=item.corrected===null?null:JSON.stringify(item.corrected);const rev=old.revision+1;
 db.prepare('INSERT INTO load_chart_reviews(entry_id,from_status,to_status,before_json,after_json,reviewer,reviewed_at,reason,revision) VALUES (?,?,?,?,?,?,?,?,?)').run(old.id,old.status,data.status,old.corrected_json,next,data.reviewer,new Date().toISOString(),data.reason,rev);
 db.prepare('UPDATE load_chart_entries SET status=?,corrected_json=?,revision=? WHERE id=?').run(data.status,next,rev,old.id);
 }db.exec('COMMIT');return {updated:data.items.length};}catch(e){db.exec('ROLLBACK');throw e;}}
export function formalLookup(db,{entryId,configurationId,documentId,radiusMm}){const e=db.prepare('SELECT e.*, d.document_class,d.approval_status doc_approval,t.approval_status table_approval,c.resolution_status FROM load_chart_entries e JOIN chart_documents d ON d.id=e.document_id JOIN load_chart_tables t ON t.id=e.table_id JOIN crane_configurations c ON c.id=e.configuration_id WHERE e.id=?').get(entryId);if(e?.document_class==='SYNTHETIC_TEST_DATA')return {status:'INSUFFICIENT_DATA',reason:'SYNTHETIC_TEST_DATA 禁止工程使用'};if(!e||e.status!=='VERIFIED'||e.configuration_id!==configurationId||e.document_id!==documentId||e.doc_approval!=='APPROVED'||e.table_approval!=='APPROVED'||e.resolution_status!=='CONFIRMED')return {status:'INSUFFICIENT_DATA',reason:'資料、配置或文件未核准；型錄資料禁止工程使用'};const v=e.corrected_json?JSON.parse(e.corrected_json):candidateValues(JSON.parse(e.raw_json));if(v.value_kind!=='NUMERIC'||v.radius_mm!==radiusMm)return {status:'INSUFFICIENT_DATA',reason:'無精確可用資料，禁止內插'};return {status:'INSUFFICIENT_DATA',reason:'正式發布流程尚未實作'};}
export function listTables(db){return db.prepare(`SELECT t.id,t.pdf_page,t.metadata_json,t.approval_status,count(e.id) total,sum(e.status='VERIFIED') verified,sum(e.status='UNVERIFIED') unverified,sum(e.status='NEEDS_REVIEW') needs_review,sum(e.status='REJECTED') rejected FROM load_chart_tables t JOIN load_chart_entries e ON e.table_id=t.id GROUP BY t.id ORDER BY t.pdf_page,t.id`).all().map(r=>({...r,metadata:JSON.parse(r.metadata_json),metadata_json:undefined}));}
