import {readFileSync} from 'node:fs';
import {resolve,sep} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {validateReviewData} from './review-data-validation.mjs';

export const root=new URL('../',import.meta.url);
export const artifacts=pathToFileURL(resolve(process.env.REVIEW_DATA_DIR??fileURLToPath(new URL('docs/manufacturer/ltm1300-6-3/',root)))+sep);
export const privatePdfPath=resolve(process.env.REVIEW_PDF_PATH??fileURLToPath(new URL('.local/manufacturer/300T-G.pdf',root)));
const names=new Set(['manifest.json','capacity-candidates.json','notes.json','manual-review.csv','review-baseline.json','review-baseline.csv','priority-review.json','source-pages.json','raw-grid.json']);
export function readArtifact(name){
 if(!names.has(name)||name.endsWith('.csv'))throw Error('Unsupported JSON artifact');
 return JSON.parse(readFileSync(new URL(name,artifacts),'utf8'));
}
export class MissingPrivateDataError extends Error {
 constructor(path){super(`MISSING_PRIVATE_DATA: ${path}; restore authorized private data as documented in README.md`);this.code='MISSING_PRIVATE_DATA';}
}
function readJson(path,privateData){
 try{return JSON.parse(readFileSync(path,'utf8'));}catch(e){if(privateData&&e.code==='ENOENT')throw new MissingPrivateDataError(String(path));throw e;}
}
export function loadPrivateSource(){
 const data=validateReviewData({manifest:readJson(new URL('manifest.json',artifacts),true),entries:readJson(new URL('capacity-candidates.json',artifacts),true),notes:readJson(new URL('notes.json',artifacts),true)});
 let pdf;
 try{pdf=readFileSync(privatePdfPath);}catch(e){if(e.code==='ENOENT')throw new MissingPrivateDataError(privatePdfPath);throw e;}
 if(createHash('sha256').update(pdf).digest('hex')!==data.manifest.source.sha256)throw Error('PDF source hash mismatch');
 return {...data,synthetic:false,pdfPath:privatePdfPath,previewDirectory:fileURLToPath(new URL('.local/manufacturer/review-pages/'+data.manifest.source.sha256+'/',root))};
}
export function loadSyntheticSource(){
 const directory=new URL('../tests/fixtures/load-chart/',import.meta.url);
 return {...validateReviewData({manifest:readJson(new URL('manifest.json',directory)),entries:readJson(new URL('capacity-candidates.json',directory)),notes:readJson(new URL('notes.json',directory))},{synthetic:true}),synthetic:true,pdfPath:null,previewDirectory:null};
}
// Synthetic data must use its own SQLite file; never import it into a private review DB.
export function assertSourceDatabase(db,source){
 const classes=db.prepare('SELECT document_class FROM chart_documents').all();
 if(classes.some(r=>(r.document_class==='SYNTHETIC_TEST_DATA')!==source.synthetic))throw Error('Cannot mix synthetic and private review databases');
}
