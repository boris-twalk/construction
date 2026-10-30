import {describe,it,expect} from 'vitest';
import {totalWeight,tonnesToKg,metresToMm,degreesToRadians,lookup,calculate,worstCase,revise,newRevision,isCheckCurrent} from './engineering';
import {configuration as c,demoChart as chart,demoPlan} from '../data/demo';
import {MemoryPlanRepository} from '../services/planRepository';
describe('重量與單位',()=>{
 it('加總與換算',()=>{expect(totalWeight([8000,500,500])).toBe(9000);expect(tonnesToKg(1.5)).toBe(1500);expect(metresToMm(10)).toBe(10000);expect(degreesToRadians(180)).toBeCloseTo(Math.PI);});
 it('零重量合法，但全零工況無法判定',()=>{expect(totalWeight([0,1])).toBe(1);expect(calculate(chart,c,10000,[0],0,true).status).toBe('INSUFFICIENT_DATA');});
 it.each([-1,NaN,Infinity,'5',null,undefined])('拒絕無效重量 %s',v=>expect(()=>totalWeight([v])).toThrow());
 it('重量總和溢位拒絕',()=>expect(()=>totalWeight([Number.MAX_VALUE,Number.MAX_VALUE])).toThrow());
 it('空重量清單拒絕',()=>expect(()=>totalWeight([])).toThrow());
});
describe('精確查表',()=>{
 it('完全符合配置',()=>expect(lookup(chart,c,10000,true).capacityKg).toBe(12000));
 it('配重不符',()=>expect(lookup(chart,{...c,counterweightKg:0},10000,true).status).toBe('INSUFFICIENT_DATA'));
 it('支腿不符',()=>expect(lookup(chart,{...c,outriggerSpanMm:6000},10000,true).status).toBe('INSUFFICIENT_DATA'));
 it.each([undefined,9000,0,-1,NaN])('無精確半徑 %s',r=>expect(lookup(chart,c,r,true).status).toBe('INSUFFICIENT_DATA'));
 it('禁止工況不得 PASS',()=>expect(lookup(chart,c,16000,true).status).toBe('FAIL'));
 it('空白不當零',()=>expect(lookup(chart,c,14000,true).status).toBe('INSUFFICIENT_DATA'));
 it('缺原廠資料',()=>expect(lookup(undefined,c,10000).status).toBe('INSUFFICIENT_DATA'));
 it('虛構表預設拒絕',()=>expect(lookup(chart,c,10000).status).toBe('INSUFFICIENT_DATA'));
 it.each(['modelId','boomLengthMm','sector','attachments','support','craneType'] as const)('拒絕不符配置 %s',key=>expect(lookup(chart,{...c,[key]:'other'},10000,true).status).toBe('INSUFFICIENT_DATA'));
 it('未核准或未確認註記拒絕',()=>{expect(lookup({...chart,approved:false},c,10000,true).status).toBe('INSUFFICIENT_DATA');expect(lookup({...chart,notesAcknowledged:false},c,10000,true).status).toBe('INSUFFICIENT_DATA');});
 it('超載 FAIL 與扣減',()=>{expect(calculate(chart,c,10000,[13000],0,true).status).toBe('FAIL');expect(calculate(chart,c,10000,[11000],2000,true).status).toBe('FAIL');});
 it('缺扣減值不可猜零',()=>expect(calculate(chart,c,10000,[1000],undefined,true).status).toBe('INSUFFICIENT_DATA'));
 it('最不利使用率',()=>{const cases=[calculate(chart,c,8000,[9000],0,true),calculate(chart,c,12000,[9000],0,true)];expect(worstCase(cases).utilization).toBe(1);expect(worstCase([...cases,{status:'INSUFFICIENT_DATA',reason:'缺資料'}]).status).toBe('INSUFFICIENT_DATA');});
});
describe('版次與核准保護',()=>{
 it('異動使檢核失效',()=>{const p={...demoPlan,checkedRevision:1,chartRevision:1};expect(isCheckCurrent(p,chart)).toBe(true);expect(isCheckCurrent(revise(p,{weight:10}),chart)).toBe(false);expect(isCheckCurrent(p,{...chart,revision:2})).toBe(false);});
 it('核准不可覆寫，可以建立新版本',()=>{const p={...demoPlan,status:'APPROVED' as const};expect(()=>revise(p,{})).toThrow();expect(newRevision(p).status).toBe('DRAFT');expect(p.revision).toBe(1);});
 it('repository 拒絕核准版覆寫',async()=>{const repo=new MemoryPlanRepository();await repo.save({...demoPlan,status:'APPROVED'});await expect(repo.save(demoPlan)).rejects.toThrow();});
});
