import {mkdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {openStore,importCandidates} from './review-store.mjs';
import {loadPrivateSource,loadSyntheticSource,root} from './review-data-source.mjs';
import {createReviewServer} from './index.mjs';

const mode=process.env.REVIEW_DATA_MODE??'private';
if(!['private','synthetic'].includes(mode))throw Error('REVIEW_DATA_MODE must be private or synthetic');
try {
 const source=mode==='synthetic'?loadSyntheticSource():loadPrivateSource();
 const path=resolve(fileURLToPath(root),process.env.REVIEW_DB_PATH??(source.synthetic?'.local/synthetic-review.sqlite':'.local/load-chart-review.sqlite'));
 if(source.synthetic&&path===resolve(fileURLToPath(root),'.local/load-chart-review.sqlite'))throw Error('Synthetic mode cannot use the private review database path');
 mkdirSync(dirname(path),{recursive:true});
 const db=openStore(path);
 try{console.log(importCandidates(db,source));}catch(e){db.close();throw e;}
 const server=createReviewServer({db,source});
 server.listen(Number(process.env.REVIEW_PORT)||3001,'127.0.0.1',()=>console.log(`Review API ready (${mode}) on port ${server.address().port}; NOT FOR ENGINEERING USE`));
 for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>{db.close();process.exit(0);}));
}catch(e){console.error(e.message);process.exitCode=1;}
