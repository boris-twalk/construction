import { z } from 'zod';
export type CheckStatus = 'PASS' | 'FAIL' | 'INSUFFICIENT_DATA' | 'NOT_APPLICABLE';
export type PlanStatus = 'DRAFT' | 'UNDER_REVIEW' | 'APPROVED' | 'SUPERSEDED';
export const nonnegative = z.number().finite().nonnegative();
export const positive = z.number().finite().positive();
export const configurationSchema = z.object({ modelId:z.string().min(1), counterweightKg:nonnegative, outriggerSpanMm:positive, boomLengthMm:positive, sector:z.enum(['360','FRONT','REAR','SIDE']), attachments:z.string().min(1), support:z.literal('OUTRIGGERS'), craneType:z.enum(['TRUCK','ALL_TERRAIN']) }).strict();
export type Configuration = z.infer<typeof configurationSchema>;
export interface Chart { id:string; configuration:Configuration; documentVersion:string; page:string; source:string; verifiedBy:string; verifiedAt:string; approved:boolean; fictional:boolean; notes:string[]; notesAcknowledged:boolean; manufacturer:boolean; revision:number; entries: {radiusMm:number; capacityKg:number|null; prohibited?:boolean}[] }
export interface Result { status:CheckStatus; reason:string; capacityKg?:number; utilization?:number; chartRevision?:number }
export const tonnesToKg = (n:number) => nonnegative.parse(n)*1000;
export const metresToMm = (n:number) => nonnegative.parse(n)*1000;
export const degreesToRadians = (n:number) => nonnegative.parse(n)*Math.PI/180;
export function totalWeight(values:unknown[]):number { if (!values.length) throw new Error('缺少重量資料'); return nonnegative.parse(values.reduce<number>((sum,v)=>sum+nonnegative.parse(v),0)); }
export function lookup(chart:Chart|undefined, config:unknown, radiusMm:unknown, allowFictional=false):Result {
 const missing = (reason:string):Result=>({status:'INSUFFICIENT_DATA',reason});
 const c=configurationSchema.safeParse(config); const r=positive.safeParse(radiusMm);
 if(!c.success || !r.success) return missing('配置或作業半徑缺漏／無效');
 if(!chart || !chart.approved || !chart.manufacturer || !chart.verifiedBy || !chart.verifiedAt || !chart.documentVersion || !chart.page || !chart.source || !chart.notesAcknowledged) return missing('缺少已核對核准的來源或註記確認');
 if(chart.fictional && !allowFictional) return missing('虛構測試資料不得用於工程判定');
 if(Object.keys(c.data).some(k=>c.data[k as keyof Configuration]!==chart.configuration[k as keyof Configuration])) return missing('配置不符，拒絕能力判定');
 const rows=chart.entries.filter(e=>e.radiusMm===r.data);
 if(rows.length!==1) return missing('無唯一精確半徑資料；禁止猜測或內插');
 const entry=rows[0];
 if(entry.prohibited) return {status:'FAIL',reason:'原廠禁止工況'};
 if(!positive.safeParse(entry.capacityKg).success) return missing('負載表空白或能力無效');
 return {status:'PASS',reason:allowFictional?'虛構測試查詢成功，非工程合格':'精確查詢成功，非計畫核准',capacityKg:entry.capacityKg!,chartRevision:chart.revision};
}
export function calculate(chart:Chart|undefined, config:unknown, radiusMm:unknown, weights:unknown[], deductionsKg:unknown, allowFictional=false):Result {
 const found=lookup(chart,config,radiusMm,allowFictional); if(found.status!=='PASS') return found;
 let weight:number; try { weight=totalWeight(weights); positive.parse(weight); nonnegative.parse(deductionsKg); } catch { return {status:'INSUFFICIENT_DATA',reason:'重量或額定能力扣減資料缺漏／無效'}; }
 const net=found.capacityKg!-(deductionsKg as number); if(net<=0) return {status:'FAIL',reason:'扣減後無可用能力'};
 const utilization=weight/net;
 return {...found,status:utilization>1?'FAIL':'PASS',utilization,capacityKg:net,reason:utilization>1?'超過可用額定能力':'計算符合；不代表工程審查核准'};
}
export function worstCase(results:Result[]):Result { if(!results.length || results.some(r=>r.status==='INSUFFICIENT_DATA')) return {status:'INSUFFICIENT_DATA',reason:'工況資料未完整'}; const failed=results.find(r=>r.status==='FAIL' && r.utilization===undefined); if(failed)return failed; return results.filter(r=>r.utilization!==undefined).sort((a,b)=>b.utilization!-a.utilization!)[0] ?? {status:'NOT_APPLICABLE',reason:'無適用工況'}; }
export interface Plan { id:string; title:string; revision:number; status:PlanStatus; checkedRevision:number|null; chartRevision:number|null; payload:Record<string,unknown> }
export function revise(plan:Plan, payload:Record<string,unknown>):Plan { if(plan.status==='APPROVED'||plan.status==='SUPERSEDED') throw new Error('不可覆寫已核准或已取代版本，請建立新版'); return {...plan,payload:structuredClone(payload),revision:plan.revision+1,checkedRevision:null,chartRevision:null,status:'DRAFT'}; }
export function newRevision(plan:Plan):Plan { return {...structuredClone(plan),id:crypto.randomUUID(),revision:plan.revision+1,status:'DRAFT',checkedRevision:null,chartRevision:null}; }
export function isCheckCurrent(plan:Plan,chart:Chart):boolean { return plan.checkedRevision===plan.revision && plan.chartRevision===chart.revision; }
