import {test} from 'node:test';
import assert from 'node:assert/strict';
import {openStore,importCandidates,review,formalLookup,listTables,candidateValues} from '../server/review-store.mjs';
import {loadSyntheticSource} from '../server/review-data-source.mjs';
import {validateReviewData} from '../server/review-data-validation.mjs';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {root} from '../server/review-data-source.mjs';

const source=loadSyntheticSource();
const input=(items,status='NEEDS_REVIEW')=>({items,status,reviewer:'SYNTHETIC_TEST_DATA tester',reason:'Synthetic regression only',confirmed:true});
const item=(id,revision=0,corrected=null)=>({id,revision,corrected});
function setup(t){const db=openStore(':memory:');t.after(()=>db.close());importCandidates(db,source);return db;}
const first=source.entries[0].id;
const row=(db,id=first)=>db.prepare('SELECT * FROM load_chart_entries WHERE id=?').get(id);

test('synthetic truck and all terrain cover configuration, blank, prohibited and pending cases',()=>{
 assert.deepEqual(new Set(source.entries.map(e=>e.crane_type)),new Set(['TRUCK','ALL_TERRAIN']));
 for(const e of source.entries){assert.equal(e.data_class,'SYNTHETIC_TEST_DATA');assert.ok(e.main_boom_length_mm_candidate>0);assert.ok(e.counterweight_kg_candidate>0);assert.deepEqual(e.outrigger_geometry_mm,[6000,6000]);assert.equal(e.slew_sector_candidate,'360');assert.equal(e.approved,false);assert.equal(e.eligible_for_capacity_lookup,false);}
 assert.equal(source.entries.filter(e=>e.prohibited).length,2);
 assert.equal(source.entries.filter(e=>e.value_kind==='BLANK').length,2);
 assert.equal(source.entries.filter(e=>e.radius_mm_candidate===null).length,2);
});
test('SQLite initializes seven tables with all eight cells UNVERIFIED and unapproved',t=>{const db=setup(t);assert.equal(db.prepare("SELECT count(*) n FROM sqlite_master WHERE type='table'").get().n,7);assert.equal(db.prepare("SELECT count(*) n FROM load_chart_entries WHERE status='UNVERIFIED'").get().n,8);assert.equal(listTables(db).length,2);assert.ok(listTables(db).every(r=>r.approval_status==='UNAPPROVED'));});
test('import preserves corrections and audit history on repeat',t=>{const db=setup(t);review(db,input([item(first)],'REJECTED'));assert.equal(importCandidates(db,source).imported,0);assert.equal(row(db).revision,1);assert.equal(row(db).status,'REJECTED');assert.equal(db.prepare('SELECT count(*) n FROM load_chart_reviews').get().n,1);});
test('explicit confirmation and identity/reason are mandatory',t=>{const db=setup(t);for(const change of [{confirmed:false},{reviewer:''},{reason:''}])assert.throws(()=>review(db,{...input([item(first)]),...change}));assert.equal(row(db).revision,0);});
test('all four review statuses preserve immutable before/after history',t=>{const db=setup(t);const original=row(db).raw_json;const corrected={...candidateValues(source.entries[0]),capacity_kg:10500};for(const [revision,status] of ['VERIFIED','NEEDS_REVIEW','REJECTED','UNVERIFIED'].entries())review(db,input([item(first,revision,corrected)],status));const history=db.prepare('SELECT * FROM load_chart_reviews ORDER BY revision').all();assert.equal(history.length,4);assert.equal(history[0].before_json,null);assert.equal(JSON.parse(history[0].after_json).capacity_kg,10500);assert.equal(history[1].before_json,history[0].after_json);assert.equal(row(db).raw_json,original);assert.throws(()=>db.exec('DELETE FROM load_chart_reviews'));assert.throws(()=>db.exec("UPDATE load_chart_reviews SET reason='changed'"));});
test('batch stale revision rolls back all entries and history',t=>{const db=setup(t);review(db,input([item(first)]));const second=source.entries[4].id;assert.throws(()=>review(db,input([item(second),item(first)])),/版本衝突/);assert.equal(row(db,second).revision,0);assert.equal(db.prepare('SELECT count(*) n FROM load_chart_reviews').get().n,1);});
test('duplicate items and invalid numbers cannot mutate database',t=>{const db=setup(t);assert.throws(()=>review(db,input([item(first),item(first)])));for(const capacity_kg of [0,-1,Infinity,NaN])assert.throws(()=>review(db,input([item(first,0,{...candidateValues(source.entries[0]),capacity_kg})])));assert.equal(row(db).revision,0);});
test('blank stays null and unresolved/prohibited cells cannot be VERIFIED',t=>{const db=setup(t);const blank=source.entries[1];review(db,input([item(blank.id)],'VERIFIED'));assert.equal(JSON.parse(row(db,blank.id).raw_json).capacity_kg_candidate,null);for(const entry of [source.entries[2],source.entries[3]]){assert.throws(()=>review(db,input([item(entry.id)],'VERIFIED')));assert.equal(row(db,entry.id).revision,0);}review(db,input([item(source.entries[3].id)],'NEEDS_REVIEW'));});
test('prohibited cells cannot be made VERIFIED by numeric corrections',t=>{const db=setup(t);assert.throws(()=>review(db,input([item(source.entries[2].id,0,candidateValues(source.entries[0]))],'VERIFIED')));});
test('database prevents raw changes, unaudited updates and deletions',t=>{const db=setup(t);assert.throws(()=>db.exec("UPDATE load_chart_entries SET raw_json='{}'"));assert.throws(()=>db.exec("UPDATE load_chart_entries SET status='VERIFIED'"));assert.throws(()=>db.exec('DELETE FROM load_chart_entries'));});
test('database rejects cross-table configurations and source location mismatches',t=>{const db=setup(t);const e=row(db);const insert=db.prepare('INSERT INTO load_chart_entries(id,table_id,document_id,configuration_id,pdf_page,data_row,data_column,raw_json,priority_json) VALUES (?,?,?,?,?,?,?,?,?)');assert.throws(()=>insert.run('bad',e.table_id,e.document_id,source.entries[4].table_id+'-C1',1,9,1,JSON.stringify({...source.entries[0],data_row:9}),'[]'));assert.throws(()=>insert.run('bad-page',e.table_id,e.document_id,e.configuration_id,2,9,1,JSON.stringify({...source.entries[0],data_row:9,pdf_page:2}),'[]'));});
test('synthetic, wrong configuration/document/radius and VERIFIED remain ineligible',t=>{const db=setup(t);const e=row(db);for(const status of ['UNVERIFIED','VERIFIED','REJECTED','NEEDS_REVIEW']){if(status!=='UNVERIFIED')review(db,input([item(first,row(db).revision)],status));for(const overrides of [{},{configurationId:'wrong'},{documentId:'wrong'},{radiusMm:4001}])assert.equal(formalLookup(db,{entryId:first,configurationId:e.configuration_id,documentId:e.document_id,radiusMm:4000,...overrides}).status,'INSUFFICIENT_DATA');}assert.throws(()=>db.exec("UPDATE chart_documents SET approval_status='APPROVED'"));assert.throws(()=>db.exec("UPDATE load_chart_tables SET approval_status='APPROVED'"));assert.throws(()=>db.exec("UPDATE crane_configurations SET resolution_status='CONFIRMED'"));});
test('pure validator rejects unmarked, approved, invalid, duplicate or misplaced synthetic data',()=>{for(const mutate of [s=>delete s.entries[0].data_class,s=>s.entries[0].approved=true,s=>s.entries[0].capacity_kg_candidate=-1,s=>s.entries[0].table_id='missing',s=>s.entries.push(s.entries[0]),s=>s.entries[1].capacity_kg_candidate=1]){const data=structuredClone(source);mutate(data);assert.throws(()=>validateReviewData(data,{synthetic:true}));}assert.throws(()=>validateReviewData(source));});
test('invalid import is atomic and cannot mix private/synthetic databases',t=>{const db=setup(t);const invalid=structuredClone(source);invalid.entries[0].data_column=99;assert.throws(()=>importCandidates(db,invalid));assert.equal(db.prepare('SELECT count(*) n FROM load_chart_entries').get().n,8);const privateSource=structuredClone(source);privateSource.synthetic=false;privateSource.manifest.source.document_class='PRIVATE';delete privateSource.manifest.source.data_class;privateSource.entries.forEach(e=>delete e.data_class);assert.throws(()=>importCandidates(db,privateSource),/Cannot mix/);});

test('private startup reports missing data without silently falling back to synthetic',t=>{
 const directory=mkdtempSync(join(tmpdir(),'construction-missing-'));t.after(()=>rmSync(directory,{recursive:true,force:true}));
 const result=spawnSync(process.execPath,['server/start-review.mjs'],{cwd:root,env:{...process.env,REVIEW_DATA_MODE:'private',REVIEW_DATA_DIR:directory,REVIEW_PDF_PATH:join(directory,'source.pdf')},encoding:'utf8'});
 assert.equal(result.status,1);assert.match(result.stderr,/MISSING_PRIVATE_DATA/);assert.doesNotMatch(result.stdout,/Review API ready/);
});
test('private startup rejects synthetic fixtures rather than treating them as manufacturer data',()=>{
 const result=spawnSync(process.execPath,['server/start-review.mjs'],{cwd:root,env:{...process.env,REVIEW_DATA_MODE:'private',REVIEW_DATA_DIR:new URL('tests/fixtures/load-chart/',root).pathname},encoding:'utf8'});
 assert.equal(result.status,1);assert.match(result.stderr,/Synthetic data requires explicit synthetic mode/);
});
test('synthetic startup refuses the real working database path before opening it',()=>{
 const result=spawnSync(process.execPath,['server/start-review.mjs'],{cwd:root,env:{...process.env,REVIEW_DATA_MODE:'synthetic',REVIEW_DB_PATH:'.local/load-chart-review.sqlite'},encoding:'utf8'});
 assert.equal(result.status,1);assert.match(result.stderr,/Synthetic mode cannot use the private review database path/);
});
