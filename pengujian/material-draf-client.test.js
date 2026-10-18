const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const script = fs.readFileSync(path.join(__dirname, '../aplikasi/UtpClient.html'), 'utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
const copy = value => JSON.parse(JSON.stringify(value));
function fixture(enabled = true) {
  const nodes = new Map(), controls = [{ disabled: false }, { disabled: false }], calls = [];
  const get = id => {
    if (!nodes.has(id)) nodes.set(id, { hidden: false, open: false, innerHTML: '', textContent: '', classList: { toggle() {} }, querySelectorAll: () => controls, showModal() { this.open = true; }, close() { this.open = false; }, scrollIntoView() {} });
    return nodes.get(id);
  };
  const context = { window: { utpRpc(action, payload) { return new Promise((resolve, reject) => calls.push({ action, payload, resolve, reject })); } }, document: { readyState: 'loading', addEventListener() {}, getElementById: get }, Intl, Date, setTimeout() {}, clearTimeout() {} };
  vm.createContext(context);
  vm.runInContext(script.replace('  window.UTPFrontend =', '  window.__draft = {createEditor,newItem,saveLiveDraft,openRequest,action,flat,showConflict,get state(){return state;},submit(form){return modal.onSubmit(form);}};\n  window.UTPFrontend ='), context);
  const api = context.window.__draft;
  api.state.data = { capabilities: { materialDrafts: enabled }, requests: [], approvals: [], catalog: [] };
  api.state.page = 'REQUESTS';
  api.createEditor();
  Object.assign(api.state.editor.record, { title: 'Draf asli', date: '2026-10-18', items: [api.newItem({ name: 'Pasir', unit: 'm3' })] });
  return { api, calls, get, controls, frontend: context.window.UTPFrontend };
}
function response(call, version = 1) { return { record: Object.assign(copy(call.payload.record), { version, history: [], updatedAt: '2026-10-18T00:00:00Z' }), warnings: [] }; }
test('live capability defaults off and blocks draft mutations', async () => {
  const { api, calls } = fixture(false);
  await api.action('save-request', { dataset: {} });
  assert.equal(calls.length, 0);
  await assert.rejects(api.saveLiveDraft(), /belum aktif/);
  api.state.data.capabilities = {};
  await api.action('new-request', { dataset: {} });
  assert.equal(api.state.editor.record.title, 'Draf asli');
});
test('live draft save/open roundtrip uses stable id and dedicated RPC', async () => {
  const { api, calls, get } = fixture();
  const id = api.state.editor.record.id;
  const pending = api.saveLiveDraft();
  assert.equal(calls[0].action, 'saveMaterialDraft');
  assert.equal(calls[0].payload.record.version, 0);
  assert.equal(calls[0].payload.record.itemContractVersion, 1);
  calls[0].resolve(response(calls[0]));
  assert.equal(await pending, true);
  assert.equal(api.state.editor.record.id, id);
  assert.equal(api.state.editor.dirty, false);
  assert.match(get('utpToast').textContent, /tersimpan di server/);
  assert.doesNotMatch(get('utpContent').innerHTML, /Simulasi kendala/);
  api.state.editor = null;
  const opening = api.openRequest(id);
  assert.equal(calls[1].action, 'detail');
  calls[1].resolve({ record: response(calls[0]).record });
  await opening;
  assert.equal(api.state.editor.record.id, id);
  assert.equal(api.state.editor.record.version, 1);
});
test('save failure preserves fields and retry keeps original stable id', async () => {
  const { api, calls } = fixture();
  const before = JSON.stringify(api.state.editor.record);
  const pending = api.saveLiveDraft(); calls[0].reject(new Error('Jaringan putus'));
  assert.equal(await pending, false);
  assert.equal(JSON.stringify(api.state.editor.record), before);
  assert.match(api.state.editor.error, /Jaringan putus/);
  const retry = api.saveLiveDraft();
  assert.equal(calls[1].payload.record.id, calls[0].payload.record.id);
  calls[1].resolve(response(calls[1])); await retry;
});
test('busy save blocks duplicate RPC and draft edits with native controls locked', async () => {
  const { api, calls, controls } = fixture();
  const pending = api.saveLiveDraft();
  assert.equal(controls.every(control => control.disabled), true);
  assert.equal(await api.saveLiveDraft(), false);
  await api.action('remove-item', { dataset: { id: api.state.editor.record.items[0].id } });
  assert.equal(api.state.editor.record.items.length, 1);
  assert.equal(calls.length, 1);
  calls[0].resolve(response(calls[0])); await pending;
});
test('late save result cannot overwrite reset session or another editor', async () => {
  for (const reset of [true, false]) {
    const { api, calls, frontend } = fixture();
    const pending = api.saveLiveDraft();
    if (reset) frontend.resetSession(); else { api.createEditor(); api.state.editor.record.title = 'Editor baru'; }
    calls[0].resolve(response(calls[0])); await pending;
    if (reset) assert.equal(api.state.data, null); else assert.equal(api.state.editor.record.title, 'Editor baru');
  }
});
test('conflict retains local input and compares only editable draft fields', async () => {
  const { api, calls, get } = fixture();
  const pending = api.saveLiveDraft(), current = response(calls[0], 2).record;
  current.title = 'Judul server';
  calls[0].resolve({ conflict: true, record: current });
  assert.equal(await pending, false);
  assert.equal(api.state.editor.record.title, 'Draf asli');
  assert.equal(get('utpDialog').open, true);
  const hostile = copy(current); hostile.status = 'FINAL'; hostile.revision = 9; hostile.items[0].decisions.HO.status = 'APPROVED';
  assert.equal('status' in api.flat(hostile), false);
  assert.equal('revision' in api.flat(hostile), false);
  assert.equal(Object.keys(api.flat(hostile)).some(key => key.endsWith(':decisions')), false);
  api.submit({ elements: { namedItem: () => ({ value: 'local' }) } });
  assert.equal(api.state.editor.record.title, 'Draf asli');
  assert.equal(api.state.editor.record.version, 2);
  assert.equal(api.state.editor.record.status, 'DRAFT');
  assert.equal(api.state.editor.record.revision, 1);
});
test('legacy and non-draft records stay read-only; live workflow actions stay disabled', async () => {
  const { api, calls, get } = fixture();
  api.state.editor.dirty = false;
  const record = copy(api.state.editor.record); delete record.itemContractVersion;
  const opening = api.openRequest(record.id); calls[0].resolve({ record }); await opening;
  assert.match(get('utpDialogTitle').textContent, /hanya baca/);
  for (const action of ['submit-request', 'publish-revision', 'finalize-request', 'add-final-file', 'confirm-arrival']) await api.action(action, { dataset: {} });
  assert.equal(calls.length, 1);
});
test('late detail cannot discard edits started while request was loading', async () => {
  const { api, calls } = fixture(); api.state.editor.dirty = false;
  const old = api.state.editor, opening = api.openRequest('other');
  old.record.title = 'Baru diketik'; old.dirty = true;
  calls[0].resolve({ record: Object.assign(copy(old.record), { id: 'other' }) }); await opening;
  assert.equal(api.state.editor, old); assert.equal(old.record.title, 'Baru diketik');
});

test('save responses after navigation never replace the current material page', async () => {
  for (const conflict of [false,true]) {
    const {api,calls,get,frontend}=fixture();
    const pending=api.saveLiveDraft();
    frontend.open('CATALOG');
    const content=get('utpContent').innerHTML;
    calls[0].resolve({...response(calls[0],2),conflict});await pending;
    assert.equal(get('utpContent').innerHTML,content);
    assert.equal(get('utpDialog').open,false);
    assert.equal(api.state.editor.busy,false);
    if(conflict) assert.match(api.state.editor.error,/Konflik/);
  }
});
test('conflict explicitly preserves item deletion or retains complete item', () => {
  for (const chosen of ['local','server']) {
    const {api}=fixture(),e=api.state.editor;
    const base=copy(e.record),server=copy(base);server.version=2;server.title='Server title';
    e.base=base;e.record.items=[];api.state.data.requests=[server];api.showConflict(server);
    api.submit({elements:{namedItem:()=>({value:chosen})}});
    assert.equal(e.record.items.length,chosen==='local'?0:1);
    if(chosen==='server') assert.equal(e.record.items[0].name,'Pasir');
  }
});
test('conflict can discard a local-only item or keep a server-only item without null fields', () => {
  for(const localOnly of [true,false]) {
    const {api}=fixture(),e=api.state.editor,base=copy(e.record),server=copy(base);
    base.items=[];e.base=base;server.version=2;
    if(localOnly)server.items=[];else e.record.items=[];
    api.state.data.requests=[server];api.showConflict(server);
    api.submit({elements:{namedItem:()=>({value:'server'})}});
    assert.equal(e.record.items.length,localOnly?0:1);
    if(!localOnly) assert.equal(e.record.items[0].name,'Pasir');
  }
});
