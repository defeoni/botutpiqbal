const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
function env(){
  const rows={requests:[{id:'r1',version:1,status:'FINAL',arrived:false,title:'Pipa',updatedAt:'2026-10-19'}],workspaceTasks:[{id:'t1',version:1,title:'Tugas'}]};
  const writes=[];let locked=false;
  const c={Date,requireAuthorized_:token=>{if(token!=='owner')throw Error('Unauthorized');},requireDeletePin_:pin=>{if(pin!=='valid')throw Error('PIN');},
    UTP_PROJECT:{name:'Test'},getMemoHistorySheet_:()=>null,getRpbHistory_:()=>[],
    utpRead_:entity=>(rows[entity]||[]).filter(r=>!r.archived),
    utpWrite_:(entity,r)=>{assert.equal(locked,true);writes.push([entity,r.id]);return r;},
    apiWorkspace:()=>({counts:{tasks:1,rpd:0},activities:[]}),
    LockService:{getScriptLock:()=>({waitLock:()=>{locked=true;},releaseLock:()=>{locked=false;}})}};
  vm.createContext(c);vm.runInContext(fs.readFileSync(path.join(__dirname,'../aplikasi/Dashboard.gs'),'utf8'),c);
  return {c,rows,writes};
}
test('dashboard is authenticated and distinguishes waiting from arrivals',()=>{const{c}=env();assert.throws(()=>c.apiDashboard('bad'),/Unauthorized/);const d=c.apiDashboard('owner');assert.equal(d.material.waiting,1);assert.equal(d.material.arrived,0);assert.equal(d.workspace.counts.tasks,1);});
test('dashboard preserves successful sections when one source is unavailable',()=>{const{c}=env();c.getRpbHistory_=()=>{throw Error('No permission');};const d=c.apiDashboard('owner');assert.equal(d.rpb,null);assert.equal(d.memo.count,0);assert.match(d.warnings[0],/No permission/);});
test('project reset requires PIN and exact scope phrase and preserves HO',()=>{const{c,writes,rows}=env();rows.workspaceRpd=[{id:'ho',version:1}];assert.throws(()=>c.apiResetProject({pin:'bad',confirmation:'RESET PROYEK'},'owner'),/PIN/);assert.throws(()=>c.apiResetProject({pin:'valid'},'owner'),/RESET PROYEK/);assert.equal(writes.length,0);const r=c.apiResetProject({pin:'valid',confirmation:'RESET PROYEK'},'owner');assert.equal(r.count,2);assert.equal(rows.workspaceRpd[0].archived,undefined);assert.equal(rows.requests[0].archived,true);});
