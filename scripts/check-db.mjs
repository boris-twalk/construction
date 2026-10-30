import {DatabaseSync} from 'node:sqlite';
import assert from 'node:assert/strict';
const db=new DatabaseSync('.local/lift-planning.sqlite');
db.exec('PRAGMA foreign_keys=ON; BEGIN');
try{
 assert.equal(db.prepare("SELECT count(*) AS n FROM sqlite_master WHERE type='table'").get().n,14);
 db.exec("INSERT INTO lift_plans VALUES ('smoke','SMOKE','test',1,'DRAFT',NULL)");
 db.exec("INSERT INTO lift_cases(id,plan_id) VALUES ('case-smoke','smoke')");
 db.exec("UPDATE lift_plans SET status='APPROVED' WHERE id='smoke'");
 assert.throws(()=>db.exec("UPDATE lift_plans SET title='changed' WHERE id='smoke'"));
 assert.throws(()=>db.exec("UPDATE lift_cases SET radius_mm=1000 WHERE id='case-smoke'"));
 assert.throws(()=>db.exec("DELETE FROM lift_cases WHERE id='case-smoke'"));
 assert.throws(()=>db.exec("INSERT INTO rigging_components(id,case_id,description) VALUES ('rig-smoke','case-smoke','test')"));
 assert.throws(()=>db.exec("INSERT INTO lift_cases(id,plan_id) VALUES ('orphan','missing')"));
 console.log('SQLite smoke: 14 tables, foreign keys and approved data protections PASS');
}finally{db.exec('ROLLBACK');db.close();}
