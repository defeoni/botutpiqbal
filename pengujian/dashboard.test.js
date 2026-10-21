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
    utpGet_:(entity,id)=>(rows[entity]||[]).find(r=>r.id===id)||null,
    utpWrite_:(entity,r)=>{assert.equal(locked,true);writes.push([entity,r.id]);return r;},
    apiWorkspace:()=>({counts:{tasks:1,rpd:0},activities:[]}),
    LockService:{getScriptLock:()=>({waitLock:()=>{locked=true;},releaseLock:()=>{locked=false;}})}};
  vm.createContext(c);for(const name of ['Workspace.gs','Projects.gs','Dashboard.gs'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../aplikasi',name),'utf8'),c);
  return {c,rows,writes};
}
test('dashboard is authenticated and distinguishes waiting from arrivals',()=>{const{c}=env();assert.throws(()=>c.apiDashboard('bad'),/Unauthorized/);const d=c.apiDashboard('owner');assert.equal(d.material.waiting,1);assert.equal(d.material.arrived,0);assert.equal(d.workspace.counts.tasks,1);});
test('dashboard preserves successful sections when one source is unavailable',()=>{const{c}=env();c.getRpbHistory_=()=>{throw Error('No permission');};const d=c.apiDashboard('owner');assert.equal(d.rpb,null);assert.equal(d.memo.count,0);assert.match(d.warnings[0],/No permission/);});
test('project reset requires PIN and exact scope phrase and preserves HO',()=>{const{c,writes,rows}=env();rows.workspaceRpd=[{id:'ho',version:1}];assert.throws(()=>c.apiResetProject({pin:'bad',confirmation:'RESET PROYEK'},'owner'),/PIN/);assert.throws(()=>c.apiResetProject({pin:'valid'},'owner'),/RESET PROYEK/);assert.equal(writes.length,0);const r=c.apiResetProject({pin:'valid',confirmation:'RESET PROYEK'},'owner');assert.equal(r.count,2);assert.equal(rows.workspaceRpd[0].archived,undefined);assert.equal(rows.requests[0].archived,true);});


test('project home board retains all requests beyond the recent list and distinguishes fulfillment',()=>{const {c,rows}=env();rows.requests=Array.from({length:20},(_,i)=>({id:'r'+i,title:'Permintaan '+i,status:'FINAL',fulfillmentConfirmed:i%2===0,date:'2026-10-19',items:[{id:'i'}]}));const d=c.apiDashboard('owner');assert.equal(d.material.board.length,20);assert.equal(d.material.recent.length,5);assert.equal(d.material.board[0].fulfillmentConfirmed,true);assert.equal(d.material.board[0].itemCount,1);});
test('HO board preserves actual memo, RPB and RPD lifecycle states',()=>{const {c,rows}=env();c.getMemoHistorySheet_=()=>({getLastRow:()=>2,getRange:()=>({getValues:()=>[[new Date('2026-10-19T00:00:00Z'),'MEMO-01','PN','Proyek','2026-10-19','https://docs.google.com/sheet','https://drive.google.com/pdf','','','']]})});c.getRpbHistory_=()=>[{id:'rpb1',number:'RPB-01',status:'Diajukan',requestDate:'2026-10-19'},{id:'rpb2',number:'RPB-02',status:'Ditolak',requestDate:'2026-10-19'}];rows.workspaceRpd=[{id:'rpd1',purpose:'Sewa mess',status:'DRAFT',date:'2026-10-19'}];const d=c.apiDashboard('owner');assert.equal(d.memo.board[0].stage,'ARCHIVED');assert.equal(d.rpb.board[0].stage,'PROCESS');assert.equal(d.rpb.board[1].status,'Ditolak');assert.equal(d.rpd.board[0].stage,'DRAFT');assert.equal(d.rpd.board[0].title,'Sewa mess');});
