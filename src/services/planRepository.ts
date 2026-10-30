import type { Plan } from '../domain/engineering';
// Phase 1 browser adapter. Replace with HTTP API backed by database/schema.sql.
export interface PlanRepository { list():Promise<Plan[]>; save(plan:Plan):Promise<void> }
export class MemoryPlanRepository implements PlanRepository {
 private plans=new Map<string,Plan>();
 async list(){return structuredClone([...this.plans.values()]);}
 async save(plan:Plan){ const existing=this.plans.get(plan.id); if(existing?.status==='APPROVED'||existing?.status==='SUPERSEDED')throw new Error('已核准版本不可覆寫'); this.plans.set(plan.id,structuredClone(plan)); }
}
