const test = require('node:test');
const assert = require('node:assert/strict');
const domain = require('../aplikasi/UtpDomain.gs');
const copy = value => JSON.parse(JSON.stringify(value));
const ctx = overrides => ({now:'2026-10-19T08:00:00.000Z',party:'PM',reason:'Instruksi tertulis PM',approvals:[{id:'a1',material:'Pipa',brand:'Rucika',status:'APPROVED',authority:'PM',itemCodes:['001'],types:['AW']}],...overrides});
const item = overrides => ({id:'i1',code:'001',name:'Pipa',brand:'Rucika',model:'AW',unit:'batang',quantity:2,group:'',family:'',classification:'BRANDED',isTemporary:false,requiredAuthority:'PM',decisions:{PM:{status:'PENDING'},MK:{status:'PENDING'},HO:{status:'PENDING'}},exceptionReason:'',note:'',finalFileId:'',supplyConfirmed:false,...overrides});
const draft = overrides => ({id:'local-one',version:1,itemContractVersion:1,title:'Pipa lantai 1',number:'',date:'2026-10-19',status:'DRAFT',revision:1,revisions:[],files:[],history:[],note:'',initialSnapshot:null,arrived:false,items:[item()],...overrides});
const submit = record => domain.materialCommand('SUBMIT',null,record,ctx());
const review = (record,party,status='APPROVED') => {const source=copy(record);source.items[0].decisions[party]={status,at:'forged',actor:'forged'};return domain.materialCommand('SAVE',source,record,ctx({party}));};
test('review safely handles opaque item IDs named like object properties',()=>{
  for(const id of ['__proto__','constructor','toString']){
    const record=submit(draft({items:[item({id})]}));
    const result=review(record,'PM');
    assert.equal(result.items[0].id,id);
    assert.equal(result.items[0].decisions.PM.status,'APPROVED');
  }
});

test('submission freezes server state, ignores client snapshot and does not mutate source',()=>{
  const record=draft(), result=domain.materialCommand('SUBMIT',{initialSnapshot:{title:'forged'}},record,ctx());
  assert.equal(result.initialSnapshot.title,record.title);assert.equal(record.initialSnapshot,null);
  assert.equal(result.status,'REVIEW');assert.equal(result.revision,1);
  assert.throws(()=>domain.materialCommand('SUBMIT',null,result,ctx()));
});
test('review metadata and audit are generated server side; snapshot and revision stay immutable',()=>{
  const before=submit(draft()), source=copy(before);source.items[0].decisions.PM={status:'APPROVED',at:'forged'};
  source.initialSnapshot={title:'forged'};source.revision=999;source.history=[{action:'forged'}];
  const result=domain.materialCommand('SAVE',source,before,ctx());
  assert.equal(result.items[0].decisions.PM.at,ctx().now);assert.equal(result.items[0].decisions.PM.actor,'Admin');
  assert.equal(result.initialSnapshot.title,before.title);assert.equal(result.revision,1);
  assert.ok(result.history.at(-1).changes.some(change=>change.field==='decisions'));
  assert.ok(!result.history.some(event=>event.action==='forged'));
});
test('review rejects other-party decisions, skipped authority, deleted items, and inherited new decisions',()=>{
  const before=submit(draft({items:[item({requiredAuthority:'HO'})]}));
  assert.throws(()=>review(before,'HO'),/sebelumnya/);
  let source=copy(before);source.items[0].decisions.MK.status='APPROVED';assert.throws(()=>domain.materialCommand('SAVE',source,before,ctx()),/pihak instruksi/);
  source=copy(before);source.items=[];assert.throws(()=>domain.materialCommand('SAVE',source,before,ctx()));
  source=copy(before);source.items.push(item({id:'i2',decisions:{PM:{status:'APPROVED'},MK:{status:'PENDING'},HO:{status:'PENDING'}}}));assert.throws(()=>domain.materialCommand('SAVE',source,before,ctx()),/tambahan/);
});
test('HO final requires real evidence format and explicit coverage; partial final excludes deferred items',()=>{
  let record=submit(draft({items:[item({requiredAuthority:'HO'}),item({id:'held',requiredAuthority:'PM'})]}));
  for(const party of ['PM','MK','HO'])record=review(record,party);
  assert.throws(()=>domain.materialCommand('FINALIZE',null,record,ctx()),/Belum ada/);
  assert.throws(()=>domain.materialCommand('FINAL_FILE',null,record,ctx({evidence:{fileId:'doc',mime:'text/plain'},coveredItemIds:['i1']})));
  assert.throws(()=>domain.materialCommand('FINAL_FILE',null,record,ctx({evidence:{fileId:'doc',mime:'application/pdf'},coveredItemIds:['held']})));
  record=domain.materialCommand('FINAL_FILE',null,record,ctx({evidence:{fileId:'doc',name:'HO.pdf',mime:'application/pdf',url:'https://drive.google.com/file/d/doc'},coveredItemIds:['i1']}));
  const result=domain.materialCommand('FINALIZE',null,record,ctx({party:'HO'}));
  assert.deepEqual(result.finalItemIds,['i1']);assert.equal(result.finalSnapshot.items.length,1);assert.equal(result.items.length,2);
});
test('owner supply is separate from arrival; arrival requires final and explicit confirmation',()=>{
  let record=submit(draft({items:[item({classification:'OWNER',brand:'',requiredAuthority:''})]}));
  assert.equal(domain.materialReady(record.items[0],record,ctx()),false);
  const source=copy(record);source.items[0].supplyConfirmed=true;record=domain.materialCommand('SAVE',source,record,ctx());
  record=domain.materialCommand('FINALIZE',null,record,ctx());assert.equal(record.arrived,false);
  assert.throws(()=>domain.materialCommand('ARRIVAL',null,record,ctx({confirmed:false})));
  const arrived=domain.materialCommand('ARRIVAL',null,record,ctx({confirmed:true,reason:'Konfirmasi admin gudang'}));
  assert.equal(arrived.arrived,true);assert.equal(arrived.items[0].quantity,2);
  assert.throws(()=>domain.materialCommand('SAVE',source,arrived,ctx()),/datang/);
});
test('ordinary review keeps REV; explicit revision stores complete immutable snapshot',()=>{
  let record=review(submit(draft()),'PM'),source=copy(record);source.items[0].quantity=1;
  record=domain.materialCommand('SAVE',source,record,ctx());assert.equal(record.revision,1);
  const result=domain.materialCommand('REVISION',null,record,ctx());assert.equal(result.revision,2);
  assert.equal(result.revisions[0].snapshot.items[0].quantity,1);assert.equal(result.initialSnapshot.items[0].quantity,2);
  assert.equal(record.revisions.length,0);
});
