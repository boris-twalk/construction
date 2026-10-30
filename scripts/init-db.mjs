import {DatabaseSync} from 'node:sqlite';
import {mkdirSync,readFileSync} from 'node:fs';
mkdirSync('.local',{recursive:true});
const db=new DatabaseSync('.local/lift-planning.sqlite');
db.exec(readFileSync('database/schema.sql','utf8'));
// Protect approved child data, including indirect rigging/check rows.
for(const table of ['lift_cases','review_records','attachments','rigging_components','lift_checks']) {
 const indirect=['rigging_components','lift_checks'].includes(table);
 const owner=(ref)=>indirect?`SELECT p.status FROM lift_plans p JOIN lift_cases c ON c.plan_id=p.id WHERE c.id=${ref}.case_id`:`SELECT status FROM lift_plans WHERE id=${ref}.plan_id`;
 for(const event of ['INSERT','UPDATE','DELETE']) {
 const refs=event==='INSERT'?['NEW']:event==='DELETE'?['OLD']:['OLD','NEW'];
 const condition=refs.map(ref=>`(${owner(ref)}) IN ('APPROVED','SUPERSEDED')`).join(' OR ');
 db.exec(`CREATE TRIGGER IF NOT EXISTS immutable_${table}_${event} BEFORE ${event} ON ${table} WHEN ${condition} BEGIN SELECT RAISE(ABORT,'immutable approved plan data'); END;`);
 }
}
console.log('SQLite schema ready:',db.prepare("SELECT count(*) AS count FROM sqlite_master WHERE type='table'").get());
db.close();
