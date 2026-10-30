import {test} from 'node:test';
import {statSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {artifacts,privatePdfPath,root} from '../server/review-data-source.mjs';

const files=['manifest.json','capacity-candidates.json','notes.json','manual-review.csv','review-baseline.json','review-baseline.csv','priority-review.json','source-pages.json','raw-grid.json'];
function exists(path){try{if(!statSync(path).isFile())throw Error('Private artifact is not a file: '+path);return true;}catch(e){if(e.code==='ENOENT')return false;throw e;}}
const missing=files.filter(name=>!exists(new URL(name,artifacts)));
if(!exists(privatePdfPath))missing.push('source PDF (REVIEW_PDF_PATH)');
if(missing.length){
 test('Private manufacturer integration suite (15 existing tests unrun)',{skip:`MISSING_PRIVATE_DATA: ${missing.join(', ')}`},()=>{});
}else{
 // Preserve every original assertion and its real exit status. Corrupt/inaccessible data fails.
 const result=spawnSync(process.execPath,['server/review.test.mjs'],{cwd:root,stdio:'inherit'});
 process.exitCode=result.status??1;
 if(process.exitCode===0){
  const validation=spawnSync('python3',['scripts/validate-manufacturer.py'],{cwd:root,stdio:'inherit'});
  process.exitCode=validation.status??1;
 }
}
