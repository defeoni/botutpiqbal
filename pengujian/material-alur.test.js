// Exercise real material workflow code with local DOM/RPC stubs; no Google calls.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const script = fs.readFileSync(path.join(__dirname,'../aplikasi/material/UtpClient.html'),'utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
function fixture() {
  const nodes = new Map();
  const get = id => {
    if (!nodes.has(id)) nodes.set(id,{hidden:false,open:false,innerHTML:'',textContent:'',classList:{toggle(){}},showModal(){this.open=true;},close(){this.open=false;},scrollIntoView(){}});
    return nodes.get(id);
  };
  const context={window:{UTP_FRONTEND_PREVIEW:true},document:{readyState:'loading',addEventListener(){},getElementById:get},Intl,Date,crypto:undefined,setTimeout(){},clearTimeout(){}};
  vm.createContext(context);
  vm.runInContext(script.replace('  window.UTPFrontend =', '  window.__flow = {seed, newItem, ready, action, storeEditor, publishRevision, showConflict, get state(){return state;}, submit(form){return modal.onSubmit(form);} };\n  window.UTPFrontend ='),context);
  const api=context.window.__flow;
  api.state.data=api.seed(); api.state.page='REQUESTS';
  const r=JSON.parse(JSON.stringify(api.state.data.requests[0]));
  api.state.editor={record:r,base:JSON.parse(JSON.stringify(r)),dirty:false,error:'',party:'',reason:'',pendingHistory:[],failNext:false};
  return {api,get};
}
function form(values) { return {elements:{namedItem:name=>({value:values[name] || ''})}}; }
function approvedItem(api,id,authority='HO') {
  const item=api.newItem({code:id,name:'Item '+id,brand:'X',unit:'buah'});
  item.id=id;item.requiredAuthority=authority;item.exceptionReason='Instruksi penggunaan di luar approval';
  for(const party of ['PM','MK','HO']) item.decisions[party]={status:'APPROVED'};
  return item;
}
function saveBaseline(api) {
  const e=api.state.editor;
  api.state.data.requests[0]=JSON.parse(JSON.stringify(e.record));
  e.base=JSON.parse(JSON.stringify(e.record));
}
test('one HO file covers two items but cannot qualify an uncovered third item',()=>{
  const {api}=fixture(),r=api.state.editor.record;
  r.items=['A','B','C'].map(id=>approvedItem(api,id));
  r.files=[{id:'ho-proof',coveredItemIds:['A','B'],name:'final.pdf'}];
  r.items.forEach(item=>item.finalFileId='ho-proof');
  assert.equal(api.ready(r.items[0],r).ok,true);
  assert.equal(api.ready(r.items[1],r).ok,true);
  assert.equal(api.ready(r.items[2],r).ok,false);
  assert.equal(r.items[2].decisions.HO.status,'APPROVED');
});
test('partial finalization retains rejected/deferred items and initial snapshot',async()=>{
  const {api,get}=fixture(),e=api.state.editor,r=e.record;
  const initial=JSON.stringify(r.initialSnapshot);
  r.items=['A','B','C'].map(id=>approvedItem(api,id,'MK'));
  r.items[1].decisions.PM.status='REJECTED';r.items[2].decisions.MK.status='DEFERRED';
  saveBaseline(api);
  await api.action('finalize-request',{dataset:{}});
  api.submit(form({party:'MK',reason:'Final sebagian'}));
  assert.equal(e.record.status,'FINAL');
  assert.deepEqual(Array.from(e.record.items.filter(item=>api.ready(item,e.record).ok),item=>item.id),['A']);
  assert.equal(e.record.items.length,3);
  assert.equal(JSON.stringify(e.record.initialSnapshot),initial);
  assert.equal(get('utpDialog').open,false);
});
test('Owner/Other require supply confirmation and never imply arrival',()=>{
  const {api}=fixture(),r=api.state.editor.record;
  for(const classification of ['OWNER','OTHER']) {
    const item=api.newItem({name:'Owner item',unit:'unit'});item.classification=classification;item.requiredAuthority='';
    assert.equal(api.ready(item,r).ok,false);
    item.supplyConfirmed=true;assert.equal(api.ready(item,r).ok,true);
    assert.equal(r.arrived,false);assert.equal(item.finalFileId,'');
  }
});
test('failed initial submission restores draft and retains input before retry',async()=>{
  const {api}=fixture(),e=api.state.editor;
  e.record.initialSnapshot=null;e.record.status='DRAFT';saveBaseline(api);e.failNext=true;
  const before=JSON.stringify(e.record);
  await api.action('submit-request',{dataset:{}});
  assert.throws(()=>api.submit(form({})),/gagal simpan/);
  assert.equal(JSON.stringify(e.record),before);
  assert.equal(api.state.data.requests[0].status,'DRAFT');
  api.submit(form({}));assert.equal(e.record.status,'REVIEW');assert.ok(e.record.initialSnapshot);
});
test('failed finalization keeps review status and file coverage',async()=>{
  const {api}=fixture(),e=api.state.editor;
  e.record.items=[approvedItem(api,'A')];e.record.files=[{id:'proof',coveredItemIds:['A']}];e.record.items[0].finalFileId='proof';saveBaseline(api);
  e.failNext=true;
  await api.action('finalize-request',{dataset:{}});
  assert.throws(()=>api.submit(form({party:'HO',reason:'Final'})),/gagal simpan/);
  assert.equal(e.record.status,'REVIEW');assert.equal(api.state.data.requests[0].status,'REVIEW');
  assert.equal(e.record.files[0].coveredItemIds[0],'A');
  api.submit(form({party:'HO',reason:'Final'}));assert.equal(e.record.status,'FINAL');
});
test('revision failure preserves revision and retry publishes one independent snapshot',()=>{
  const {api}=fixture(),e=api.state.editor,initial=JSON.stringify(e.record.initialSnapshot);
  e.failNext=true;api.publishRevision();
  assert.throws(()=>api.submit(form({party:'PM',reason:'Instruksi revisi'})),/gagal terbit/);
  assert.equal(e.record.revision,1);assert.equal(e.record.revisions.length,0);
  api.submit(form({party:'PM',reason:'Instruksi revisi'}));
  assert.equal(e.record.revision,2);assert.equal(e.record.revisions.length,1);
  assert.equal(JSON.stringify(e.record.initialSnapshot),initial);
  const snap=JSON.stringify(e.record.revisions[0].snapshot);e.record.items[0].name='Perubahan berikutnya';
  assert.equal(JSON.stringify(e.record.revisions[0].snapshot),snap);
});
test('revision conflict preserves entered party/reason for retry',()=>{
  const {api,get}=fixture(),e=api.state.editor;
  api.state.data.requests[0].version++;
  api.publishRevision();api.submit(form({party:'HO',reason:'Revisi instruksi HO'}));
  assert.match(get('utpDialogTitle').textContent,/Konflik/);
  assert.equal(e.record.revision,1);
  assert.equal(e.revisionInstruction.party,'HO');assert.equal(e.revisionInstruction.reason,'Revisi instruksi HO');
  api.submit(form({}));
  api.storeEditor('SAVE');
  api.publishRevision();
  assert.match(get('utpDialogBody').innerHTML,/value="HO" selected/);
  assert.match(get('utpDialogBody').innerHTML,/Revisi instruksi HO/);
  api.submit(form({party:'HO',reason:'Revisi instruksi HO'}));
  assert.equal(e.record.revision,2);
  assert.equal(e.record.revisions[0].actor,'HO');
  assert.equal(e.record.revisions[0].reason,'Revisi instruksi HO');
  assert.equal(e.revisionInstruction,undefined);
});
test('blank/null brand stays UNKNOWN and pending even if source claims approval',()=>{
  const {api}=fixture();
  for(const brand of ['',null]) {
    const item=api.newItem({code:'blank',name:'Material',unit:'unit',brand,approved:true,classification:'GENERIC'});
    assert.equal(item.classification,'UNKNOWN');assert.equal(item.decisions.PM.status,'PENDING');
  }
});
