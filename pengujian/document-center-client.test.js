const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const P1 = 'proj-alpha-0001', P2 = 'proj-beta-0002';
const source = fs.readFileSync(path.join(__dirname, '..', 'aplikasi', 'DocumentCenterClient.html'), 'utf8');
const script = source.match(/<script>([\s\S]*?)<\/script>/)[1];
const tick = () => new Promise((resolve) => setImmediate(resolve));

function node(id) {
  const result = {
    id,
    textContent: '',
    value: '',
    hidden: false,
    open: false,
    disabled: false,
    className: '',
    href: '',
    dataset: {},
    options: [],
    children: [],
    modalCount: 0,
    classList: { toggle() {}, add() {}, remove() {} },
    append(...items) { this.children.push(...items); },
    appendChild(item) { this.children.push(item); return item; },
    replaceChildren(...items) { this.children = items; },
    add(option) { this.options.push(option); },
    showModal() { this.open = true; this.modalCount++; },
    close() { this.open = false; },
    focus() { this.focused = true; },
    setAttribute(key, value) { this[key] = value; },
    removeAttribute(key) { delete this[key]; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    closest(selector) { return selector === 'button' ? this : null; }
  };
  return result;
}

function storage() {
  const map = new Map();
  return { map, getItem: (key) => (map.has(key) ? map.get(key) : null), setItem: (key, value) => { map.set(key, String(value)); }, removeItem: (key) => { map.delete(key); } };
}

function fixture(options) {
  const sharedStorage = options && options.storage ? options.storage : storage();
  const nodes = new Map();
  const rootListeners = {}, documentListeners = {};
  const calls = [];
  const opened = [];
  const get = (id) => {
    if (!nodes.has(id)) {
      const created = node(id);
      if (id === 'dcRecordForm') {
        created.elements = { title: node('title'), due: node('due'), note: node('note'), status: node('status') };
      }
      if (id === 'dcNewDraftForm') created.elements = {};
      nodes.set(id, created);
    }
    return nodes.get(id);
  };
  const root = get('documentCenter');
  root.querySelector = (selector) => selector === '.dc-toolbar' ? get('dcToolbar') : null;
  root.addEventListener = (type, handler) => { (rootListeners[type] || (rootListeners[type] = [])).push(handler); };
  const document = {
    readyState: 'complete',
    getElementById: get,
    createElement: (tag) => node('created-' + tag),
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener: (type, handler) => { (documentListeners[type] || (documentListeners[type] = [])).push(handler); },
    dispatchEvent: (event) => (documentListeners[event.type] || []).forEach((handler) => handler(event))
  };
  const project = {
    active: P1,
    getActiveId() { return this.active; },
    getActive() { return { id: this.active, name: 'Proyek', code: 'P' }; },
    getProjects() { return [{ id: P1, name: 'Alpha' }, { id: P2, name: 'Beta' }]; },
    ready() { return Promise.resolve(); }
  };
  const window = {
    ProjectWorkspace: project,
    sessionStorage: sharedStorage,
    UTP_PENDING_DOCUMENT_ID: '',
    UTPDocumentTemplates: [{
      id: 'utp-f-a1-01', code: 'A1-01', title: 'SURAT IZIN LEMBUR', origin: 'UTP',
      cluster: 'A', stage: 'Pelaksanaan', system: 'Administrasi', frequency: 'Berdasarkan kejadian',
      pic: 'Admin Proyek', format: 'XLSX',
      driveUrl: 'https://docs.google.com/spreadsheets/d/1kBMzmNc9fQcQeZ4g3Zf1AgULSpr1w6JW/edit'
    }, {
      id: 'app-pn', code: 'PN', title: 'Memo Penambahan Manpower', origin: 'UTP',
      cluster: 'C', stage: 'Memo dan Surat', system: 'Administrasi', frequency: 'Berdasarkan kejadian',
      pic: 'Admin Proyek', page: 'MEMO', memoType: 'PN', format: 'MODUL'
    }],
    open(url) { opened.push(url); }
  };
  const context = {
    window,
    document,
    accessToken: 'owner',
    Option: function Option(text, value) { this.text = text; this.value = value; },
    CustomEvent: function CustomEvent(type, init) { this.type = type; this.detail = (init || {}).detail; },
    FormData: function FormData() { this.entries = () => []; },
    Intl, Date, console, setTimeout, clearTimeout,
    crypto: { randomUUID: (() => { let id = 0; return () => 'request-' + (++id); })() },
    confirm: () => true,
    showLoginPanel_() { throw new Error('login panel should not open'); },
    switchMainPage(page) { context.pages.push(page); },
    pages: [],
    invokeServer(name, args, resolve, reject) { calls.push({ name, args, resolve, reject }); }
  };
  vm.createContext(context);
  vm.runInContext(script, context);
  return { c: context, get, root, rootListeners, documentListeners, calls, opened, project, window, document, storage: sharedStorage };
}

async function resolveReload(env, index, documents = []) {
  env.calls[index].resolve({ documents, warnings: [] });
  await tick();
}

async function openCenter(env) {
  env.window.DocumentCenter.open();
  await tick();
  const call = env.calls.findIndex((row) => row.name === 'apiProjects');
  if (call >= 0) await resolveReload(env, call);
}

function click(env, id) {
  const target = env.get(id);
  const event = { target, preventDefault() {}, key: 'Enter' };
  for (const handler of env.rootListeners.click || []) handler(event);
}

test('Tambah Dokumen bekerja dari toolbar dan Kanban, tahan klik berulang, dan menutup dialog saat proyek berubah', async () => {
  const env = fixture();
  await openCenter(env);
  const toolbar = env.get('dcToolbar').children.filter((item) => item.id === 'dcNewDraftToolbar');
  assert.equal(toolbar.length, 1);
  assert.equal(env.rootListeners.click.length, 1, 'hanya satu listener klik');

  click(env, 'dcNewDraftToolbar');
  assert.equal(env.get('dcNewDraftDialog').open, true);
  click(env, 'dcNewDraftToolbar');
  assert.equal(env.get('dcNewDraftDialog').modalCount, 1, 'klik kedua tidak membuka dialog baru');
  env.get('dcNewDraftDialog').close();
  env.window.DocumentCenter.reload();
  await tick();
  const reloads = env.calls.filter((row) => row.name === 'apiProjects');
  reloads[reloads.length - 1].resolve({ documents: [], warnings: [] });
  await tick();
  click(env, 'dcNewDraft');
  click(env, 'dcNewDraft');
  assert.equal(env.get('dcNewDraftDialog').open, true);
  assert.equal(env.get('dcNewDraftDialog').modalCount, 2, 'klik Kanban berulang tidak membuka dialog kedua');
  env.get('dcNewDraftDialog').close();

  env.project.active = P2;
  env.document.dispatchEvent(new CustomEvent('utp-project-change'));
  assert.equal(env.get('dcNewDraftDialog').open, false);
  await tick();
  click(env, 'dcNewDraftToolbar');
  assert.equal(env.get('dcNewDraftDialog').open, true);
  env.get('dcNewDraftDialog').close();
  assert.equal(env.get('dcToolbar').children.filter((item) => item.id === 'dcNewDraftToolbar').length, 1, 'tidak ada tombol toolbar ganda');
  assert.equal(env.rootListeners.click.length, 1, 'listener klik tetap tunggal setelah reload dan ganti proyek');
});

async function createDraft(env, templateId, title) {
  click(env, 'dcNewDraftToolbar');
  env.get('dcNewDraftTemplate').value = templateId;
  env.get('dcNewDraftTitle').value = title;
  env.get('dcNewDraftForm').onsubmit({ preventDefault() {}, submitter: node('submit') });
  await tick();
  return env.calls.filter((row) => row.name === 'apiProjectDocument').pop();
}

test('pending dokumen draf bertahan setelah refresh dan dibersihkan setelah record dibuat', async () => {
  const env = fixture();
  await openCenter(env);
  const save = await createDraft(env, 'app-pn', 'Memo Baru');
  assert.ok(save);
  save.resolve({ record: { id: 'doc-pending', projectId: P1, source: 'document', title: 'Memo Baru', page: 'MEMO' } });
  await tick();
  const reload = env.calls.filter((row) => row.name === 'apiProjects').pop();
  reload.resolve({ documents: [], warnings: [] });
  await tick();
  await tick();
  assert.equal(env.window.UTP_PENDING_DOCUMENT_ID, 'doc-pending');
  assert.equal(env.storage.getItem('utp.pendingDocument.' + P1), 'doc-pending');
  assert.ok(env.c.pages.includes('MEMO'));

  const refreshed = fixture({ storage: env.storage });
  assert.equal(refreshed.window.UTP_PENDING_DOCUMENT_ID, 'doc-pending', 'refresh mengembalikan pending dokumen proyek');
  refreshed.window.UtpPendingDocument.clear();
  assert.equal(env.storage.getItem('utp.pendingDocument.' + P1), null, 'record dibuat lalu pending dibersihkan');
  assert.equal(refreshed.window.UTP_PENDING_DOCUMENT_ID, '');
});

test('ganti proyek saat create draf membatalkan route dan tidak menautkan proyek baru', async () => {
  const env = fixture();
  await openCenter(env);
  const save = await createDraft(env, 'app-pn', 'Memo Lama');
  assert.ok(save);
  env.project.active = P2;
  env.document.dispatchEvent(new CustomEvent('utp-project-change'));
  await tick();
  save.resolve({ record: { id: 'doc-old', projectId: P1, source: 'document', title: 'Memo Lama', page: 'MEMO' } });
  await tick();
  assert.equal(env.get('dcNewDraftDialog').open, false);
  assert.equal(env.window.UTP_PENDING_DOCUMENT_ID, '');
  assert.equal(env.storage.getItem('utp.pendingDocument.' + P1), null);
  assert.equal(env.c.pages.filter((page) => page === 'MEMO').length, 0, 'route lama tidak boleh jalan');
});

test('callback reload lama tidak menimpa hasil proyek baru', async () => {
  const env = fixture();
  env.window.DocumentCenter.open();
  await tick();
  const first = env.calls.findIndex((row) => row.name === 'apiProjects');
  assert.ok(first >= 0);
  env.project.active = P2;
  env.document.dispatchEvent(new CustomEvent('utp-project-change'));
  await tick();
  const second = env.calls.map((row, index) => ({ row, index })).filter(({ row }) => row.name === 'apiProjects').map(({ index }) => index).filter((index) => index !== first)[0];
  assert.ok(second != null, 'reload proyek baru dimulai');
  env.calls[first].resolve({ documents: [], warnings: ['STALE'] });
  await tick();
  assert.notEqual(env.get('dcStatus').textContent, 'STALE');
  env.calls[second].resolve({ documents: [], warnings: ['FRESH'] });
  await tick();
  assert.equal(env.get('dcStatus').textContent, 'FRESH');
});

test('simpan draf berhasil dengan warning menampilkan status tersimpan dan mengirim templateSourceId', async () => {
  const env = fixture();
  await openCenter(env);
  click(env, 'dcNewDraftToolbar');
  env.get('dcNewDraftTemplate').value = 'utp-f-a1-01';
  env.get('dcNewDraftTitle').value = 'Salinan Form';
  env.get('dcNewDraftDue').value = '2026-10-30';
  const form = env.get('dcNewDraftForm');
  form.onsubmit({ preventDefault() {}, submitter: node('submit') });
  await tick();
  const save = env.calls.find((row) => row.name === 'apiProjectDocument');
  assert.ok(save);
  assert.equal(save.args[0], 'save');
  assert.equal(save.args[1].record.templateSourceId, '1kBMzmNc9fQcQeZ4g3Zf1AgULSpr1w6JW');
  save.resolve({ record: { id: 'doc-1', projectId: P1, source: 'document', title: 'Salinan Form', fileUrl: 'https://drive.google.com/file/d/copy-1/view' }, warning: 'Tautan audit gagal' });
  await tick();
  const reloadCalls = env.calls.filter((row) => row.name === 'apiProjects');
  reloadCalls[reloadCalls.length - 1].resolve({ documents: [], warnings: ['Audit server lambat'] });
  await tick();
  await tick();
  assert.match(env.get('dcStatus').textContent, /Tersimpan dengan peringatan/, 'warning pascasimpan tidak ditimpa warning reload');
  assert.equal(env.get('dcNewDraftDialog').open, false);
  assert.deepEqual(env.opened, ['https://drive.google.com/file/d/copy-1/view']);
});

test('callback simpan lama dibuang setelah proyek berubah', async () => {
  const env = fixture();
  await openCenter(env);
  click(env, 'dcNewDraftToolbar');
  env.get('dcNewDraftTemplate').value = 'app-pn';
  env.get('dcNewDraftTitle').value = 'Memo Lama';
  env.get('dcNewDraftForm').onsubmit({ preventDefault() {}, submitter: node('submit') });
  await tick();
  const save = env.calls.find((row) => row.name === 'apiProjectDocument');
  assert.ok(save);
  env.project.active = P2;
  env.document.dispatchEvent(new CustomEvent('utp-project-change'));
  await tick();
  save.resolve({ record: { id: 'doc-old', projectId: P1, source: 'document', title: 'Memo Lama' } });
  await tick();
  assert.equal(env.get('dcNewDraftDialog').open, false);
  assert.doesNotMatch(env.get('dcStatus').textContent, /Tersimpan dengan peringatan/);
  assert.equal(env.window.UTP_PENDING_DOCUMENT_ID, '');
});
