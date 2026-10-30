import {createServer} from 'node:http';
import {createReadStream,mkdirSync} from 'node:fs';
import {openStore,importCandidates,review,listTables,readArtifact,root} from './review-store.mjs';
mkdirSync(new URL('.local/',root),{recursive:true});
const db=openStore(new URL(process.env.REVIEW_DB_PATH??'.local/load-chart-review.sqlite',root).pathname);console.log(importCandidates(db));
const send=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
const server=createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://localhost');
 const preview=/^\/api\/review\/pages\/(\d+)\.png$/.exec(url.pathname);
 if(req.method==='GET'&&preview){const manifest=readArtifact('manifest.json');const page=Number(preview[1]);if(!manifest.chart_pages.includes(page))return send(res,404,{error:'無此負載表頁'});res.writeHead(200,{'Content-Type':'image/png','Cache-Control':'private, max-age=3600'});createReadStream(new URL('.local/manufacturer/review-pages/'+manifest.source.sha256+'/page-'+page+'.png',root)).on('error',()=>res.destroy()).pipe(res);return;}
 if(req.method==='GET'&&url.pathname==='/api/review/source.pdf'){res.writeHead(200,{'Content-Type':'application/pdf','Cache-Control':'private, max-age=3600'});createReadStream(new URL('.local/manufacturer/300T-G.pdf',root)).pipe(res);return;}
 if(req.method==='GET'&&url.pathname==='/api/review/tables')return send(res,200,{tables:listTables(db),source:readArtifact('manifest.json').source});
 if(req.method==='GET'&&url.pathname==='/api/review/notes')return send(res,200,readArtifact('notes.json'));
 if(req.method==='GET'&&url.pathname==='/api/review/entries'){
 const table=url.searchParams.get('table');if(!table)return send(res,400,{error:'缺少表格'});
 const where=['table_id=?'];const args=[table];const status=url.searchParams.get('status');if(status&&status!=='ALL'){if(!['UNVERIFIED','VERIFIED','REJECTED','NEEDS_REVIEW'].includes(status))return send(res,400,{error:'無效狀態'});where.push('status=?');args.push(status);}
 if(url.searchParams.get('column')){where.push('data_column=?');args.push(Number(url.searchParams.get('column')));}
 const priority=url.searchParams.get('priority');if(priority&&priority!=='ALL'){where.push('EXISTS (SELECT 1 FROM json_each(priority_json) WHERE value=?)');args.push(priority);}
 const offset=Math.max(0,Math.floor(Number(url.searchParams.get('offset'))||0));const clause=where.join(' AND ');
 const total=db.prepare('SELECT count(*) n FROM load_chart_entries WHERE '+clause).get(...args).n;
 const entries=db.prepare('SELECT * FROM load_chart_entries WHERE '+clause+' ORDER BY data_row,data_column LIMIT 50 OFFSET ?').all(...args,offset).map(e=>({...e,raw:JSON.parse(e.raw_json),corrected:e.corrected_json?JSON.parse(e.corrected_json):null,priorities:JSON.parse(e.priority_json),raw_json:undefined,corrected_json:undefined,priority_json:undefined}));return send(res,200,{entries,total});}
 if(req.method==='GET'&&url.pathname==='/api/review/history'){return send(res,200,db.prepare('SELECT * FROM load_chart_reviews WHERE entry_id=? ORDER BY revision').all(url.searchParams.get('id')??''));}
 if(req.method==='POST'&&url.pathname==='/api/review/changes'){
 // Local review prototype: reject cross-site requests and require the same-origin UI header.
 if(req.headers['x-review-client']!=='local-review-v1'||req.headers['sec-fetch-site']==='cross-site')return send(res,403,{error:'拒絕跨來源寫入'});
 let body='';for await(const chunk of req){body+=chunk;if(body.length>200000)return send(res,413,{error:'批次過大'});}return send(res,200,review(db,JSON.parse(body)));}
 send(res,404,{error:'不存在的API'});
 }catch(e){send(res,400,{error:e instanceof Error?e.message:'請求失敗'});}});
server.listen(Number(process.env.REVIEW_PORT)||3001,'127.0.0.1',()=>console.log('Review API ready on port '+server.address().port));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>{db.close();process.exit(0);}));
