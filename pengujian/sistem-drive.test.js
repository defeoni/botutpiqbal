const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = (name) => fs.readFileSync(path.join(__dirname, '..', 'aplikasi', name), 'utf8');
const clone = (value) => JSON.parse(JSON.stringify(value));

function makeDrive() {
  let sequence = 0;
  const nodes = new Map();
  const sharing = [];
  const make = (kind, name, parent) => {
    const node = {
      id: (kind === 'folder' ? 'f-' : 'file-') + String(++sequence).padStart(12, '0'),
      kind, name, parent, children: [], trashed: false, access: 'ANYONE_WITH_LINK', editors: [], viewers: []
    };
    nodes.set(node.id, node);
    if (parent) parent.children.push(node);
    return node;
  };
  const folderApi = (node) => ({
    getId: () => node.id,
    getName: () => node.name,
    setName(name) { node.name = name; },
    getUrl: () => 'https://drive.google.com/drive/folders/' + node.id,
    isTrashed: () => node.trashed,
    getSharingAccess: () => node.access,
    getEditors: () => node.editors.slice(),
    getViewers: () => node.viewers.slice(),
    setSharing(access, permission) { node.access = access; node.permission = permission; sharing.push({ id: node.id, access, permission }); },
    createFolder(name) { return wrapFolder(make('folder', name, node)); },
    getFoldersByName(name) { return iterator(node.children.filter((child) => child.kind === 'folder' && child.name === name).map(wrapFolder)); },
    getFolders() { return iterator(node.children.filter((child) => child.kind === 'folder').map(wrapFolder)); },
    getFiles() { return iterator(node.children.filter((child) => child.kind === 'file').map(wrapFile)); },
    getParents() { return iterator(node.parent && node.parent.kind === 'folder' ? [wrapFolder(node.parent)] : []); },
    moveTo(target) { move(node, target); }
  });
  const fileApi = (node) => ({
    getId: () => node.id,
    getName: () => node.name,
    setName(name) { node.name = name; },
    getUrl: () => 'https://drive.google.com/file/d/' + node.id + '/view',
    getMimeType: () => 'application/pdf',
    isTrashed: () => node.trashed,
    getParents() { return iterator(node.parent && node.parent.kind === 'folder' ? [wrapFolder(node.parent)] : []); },
    moveTo(target) { move(node, target); },
    makeCopy(name, target) { return wrapFile(make('file', name, target.__node)); }
  });
  function move(node, target) {
    if (node.failMove) { node.failMove -= 1; throw new Error('Drive menolak pemindahan ' + node.name); }
    if (!target || target.__node.kind !== 'folder') throw new Error('Tujuan bukan folder.');
    if (node.parent) node.parent.children = node.parent.children.filter((child) => child.id !== node.id);
    node.parent = target.__node;
    target.__node.children.push(node);
  }
  const wrapFolder = (node) => {
    const api = folderApi(node);
    Object.defineProperty(api, '__node', { value: node });
    return api;
  };
  const wrapFile = (node) => {
    const api = fileApi(node);
    Object.defineProperty(api, '__node', { value: node });
    return api;
  };
  const driveApi = {
    Access: { PRIVATE: 'PRIVATE', ANYONE: 'ANYONE' },
    Permission: { NONE: 'NONE' },
    getFoldersByName(name) { return iterator([...nodes.values()].filter((node) => node.kind === 'folder' && node.name === name).map(wrapFolder)); },
    createFolder(name) { return wrapFolder(make('folder', name, null)); },
    getFolderById(id) {
      const node = nodes.get(id);
      if (!node || node.kind !== 'folder') throw new Error('Folder tidak ditemukan: ' + id);
      return wrapFolder(node);
    },
    getFileById(id) {
      const node = nodes.get(id);
      if (!node || node.kind !== 'file') throw new Error('File tidak ditemukan: ' + id);
      return wrapFile(node);
    }
  };
  return {
    drive: driveApi, nodes, sharing,
    folder(name, parent) { return wrapFolder(make('folder', name, parent || null)); },
    file(name, parent) { return wrapFile(make('file', name, parent || null)); },
    snapshot() { return [...nodes.values()].map((node) => [node.id, node.name, node.parent ? node.parent.id : null]).sort(); },
    byId(id) { return nodes.get(id); },
    folderChild(parentId, name) {
      const parent = nodes.get(parentId);
      const found = parent ? parent.children.find((child) => child.kind === 'folder' && child.name === name) : null;
      return found || null;
    }
  };
}
function iterator(items) {
  let index = 0;
  return { hasNext: () => index < items.length, next() { if (index >= items.length) throw new Error('Habis'); return items[index++]; } };
}

function env(options) {
  const config = options || {};
  const d = makeDrive();
  const props = new Map();
  const rows = {
    workspaceProjects: [
      { id: 'p1', code: 'ALPHA', name: 'Alpha' },
      { id: 'p2', code: 'BETA', name: 'Beta' }
    ].concat(config.extraProjects || []),
    sistemDrive: []
  };
  const root = d.folder('Arsip UTP');
  const alpha = d.folder('Project Alpha', d.byId(root.getId()));
  const memo = d.folder('Memo', d.byId(alpha.getId()));
  const month = d.folder('Oktober 2026', d.byId(memo.getId()));
  const memoFile = d.file('001 - Memo.pdf', d.byId(month.getId()));
  const rpd = d.folder('RPD', d.byId(alpha.getId()));
  const rpdFile = d.file('RPD Oktober.pdf', d.byId(rpd.getId()));
  const mystery = d.folder('Catatan Lama', d.byId(alpha.getId()));
  const beta = d.folder('Project BETA - Beta', d.byId(root.getId()));
  const ktp = d.folder('Unggahan KTP Sementara', d.byId(root.getId()));
  const files = d.folder('Administrasi Terrasentra · Dokumen');
  const template = d.file('Form Memo.docx');
  const loose = d.file('catatan-lama.pdf', d.byId(root.getId()));
  props.set('DRIVE_ROOT_FOLDER_ID', root.getId());
  props.set('PENDING_KTP_FOLDER_ID', ktp.getId());
  props.set('UTP_FILES_FOLDER_ID', files.getId());
  props.set('TEMPLATE_PN_ID', template.getId());

  let sequence = 0;
  const properties = {
    getProperty: (key) => (props.has(key) ? props.get(key) : null),
    setProperty: (key, value) => { props.set(key, String(value)); }
  };
  const sandbox = {
    Date, console,
    Utilities: { getUuid() { sequence += 1; return 'uuid-' + String(sequence).padStart(4, '0'); } },
    PropertiesService: { getScriptProperties: () => properties },
    DriveApp: d.drive,
    utpRead_(entity) { return (rows[entity] || []).filter((row) => !row.archived).map(clone); },
    utpGet_(entity, id) {
      const found = (rows[entity] || []).find((row) => row.id === id);
      return found ? clone(found) : null;
    },
    utpWrite_(entity, record, version) {
      const list = rows[entity] || (rows[entity] = []);
      const previous = list.find((row) => row.id === record.id);
      if (previous && previous.version !== Number(version)) throw new Error('Data berubah.');
      record.version = previous ? previous.version + 1 : 1;
      const index = list.findIndex((row) => row.id === record.id);
      if (index < 0) list.push(clone(record)); else list[index] = clone(record);
      return clone(record);
    },
    requireAuthorized_(token) { if (token !== 'owner') throw new Error('Unauthorized'); },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    workspaceText_(value, max) { return String(value == null ? '' : value).trim().slice(0, max || 500); },
    getArchiveRootFolder_: () => d.drive.getFolderById(root.getId()),
    getOrCreateArchiveSubfolder_(parent, name) {
      const api = parent.getFoldersByName(name);
      return api.hasNext() ? api.next() : parent.createFolder(name);
    }
  };
  vm.createContext(sandbox);
  ['SistemDrive.gs', 'Projects.gs'].forEach((name) => vm.runInContext(source(name), sandbox, { filename: name }));
  return {
    c: sandbox, d, props, rows,
    ids: { root: root.getId(), alpha: alpha.getId(), memo: memo.getId(), month: month.getId(), memoFile: memoFile.getId(), rpd: rpd.getId(), rpdFile: rpdFile.getId(), mystery: mystery.getId(), beta: beta.getId(), ktp: ktp.getId(), files: files.getId(), template: template.getId(), loose: loose.getId() }
  };
}

test('mode plan tidak mengubah Drive maupun Script Properties', () => {
  const e = env();
  const before = e.d.snapshot(), propsBefore = [...e.props.entries()].sort();
  const plan = e.c.sistemDrivePlan_();
  assert.ok(plan.moves.length >= 5, 'rencana harus berisi perpindahan');
  assert.deepEqual(e.d.snapshot(), before, 'plan tidak boleh memindahkan atau membuat folder');
  assert.deepEqual([...e.props.entries()].sort(), propsBefore, 'plan tidak boleh menulis properti');
  assert.equal(e.d.sharing.length, 0);
});

test('mode apply memindahkan aset ke struktur baru tanpa mengganti ID', () => {
  const e = env();
  const result = e.c.apiSistemDrive('apply', {}, 'owner');
  assert.equal(result.run.status, 'DONE');
  const root = e.d.byId(e.ids.root);
  assert.equal(root.name, 'SISTEM PT.UTP');
  const projects = e.d.folderChild(root.id, '01_PROYEK');
  const alpha = e.d.byId(e.ids.alpha);
  assert.equal(alpha.parent.id, projects.id, 'folder proyek lama harus dipindah, bukan disalin');
  assert.equal(alpha.name, '[ALPHA] - Alpha');
  assert.equal(e.d.byId(e.ids.memo).name, '04_MEMO');
  assert.equal(e.d.byId(e.ids.memo).parent.id, alpha.id);
  assert.equal(e.d.byId(e.ids.memoFile).parent.id, e.d.byId(e.ids.month).id, 'isi folder lama tetap utuh');
  assert.equal(e.d.byId(e.ids.rpd).name, '02_RPD');
  assert.equal(e.d.byId(e.ids.rpdFile).parent.id, e.d.byId(e.ids.rpd).id);
  const legacy = e.d.folderChild(root.id, '90_DATA LAMA');
  assert.equal(e.d.byId(e.ids.mystery).parent.id, legacy.id, 'folder tak dikenal masuk data lama');
  assert.equal(e.d.byId(e.ids.loose).parent.id, legacy.id);
  const internal = e.d.folderChild(root.id, '02_SISTEM INTERNAL');
  assert.equal(e.d.folderChild(internal.id, 'Unggahan Sementara').id, e.ids.ktp);
  assert.equal(e.d.folderChild(internal.id, 'Dokumen Privat').id, e.ids.files);
  const templates = e.d.folderChild(root.id, '00_TEMPLATE ASLI');
  assert.equal(e.d.byId(e.ids.template).parent.id, e.d.folderChild(templates.id, 'Memo').id);
  assert.equal(e.d.byId(e.ids.template).name, 'Form Memo.docx');
  assert.equal(e.props.get('SISTEM_DRIVE_ROOT_ID'), root.id);
  assert.equal(e.props.get('PENDING_KTP_FOLDER_ID'), e.ids.ktp);
  assert.equal(e.props.get('UTP_FILES_FOLDER_ID'), e.ids.files);
  assert.equal(e.props.get('UTP_FILES_FOLDER_PRIVATE'), 'true');
  assert.equal(e.rows.sistemDrive[0].counts.failed, 0);
  assert.ok(e.rows.sistemDrive[0].results.every((item) => item.status !== 'failed'));
});

test('apply idempoten: menjalankan ulang tidak membuat folder atau salinan ganda', () => {
  const e = env();
  e.c.sistemDriveApply_({});
  const afterFirst = e.d.snapshot();
  const second = e.c.sistemDriveApply_({});
  assert.equal(second.run.status, 'DONE');
  assert.deepEqual(e.d.snapshot(), afterFirst, 'tidak ada node baru atau perpindahan ulang');
  assert.equal(e.c.sistemDrivePlan_().moves.length, 0);
  const names = new Map();
  for (const [id, name, parent] of afterFirst) {
    const key = parent + '/' + name;
    assert.ok(!names.has(key), 'nama folder ganda: ' + key);
    names.set(key, id);
  }
});

test('checkpoint menyimpan cursor dan melanjutkan tanpa mengulang item', () => {
  const e = env();
  const first = e.c.sistemDriveApply_({ limit: 1 });
  assert.equal(first.run.status, 'PAUSED');
  assert.equal(first.run.cursor, 1);
  assert.equal(first.remaining > 0, true);
  let calls = 0, run = first;
  while (run.run.status !== 'DONE' && calls < 40) {
    const progress = run.run.cursor;
    run = e.c.sistemDriveApply_({ limit: 1 });
    assert.equal(run.run.cursor, progress + 1, 'setiap panggilan hanya memajukan satu item');
    calls += 1;
  }
  assert.equal(run.run.status, 'DONE');
  assert.equal(e.rows.sistemDrive[0].status, 'DONE');
  assert.equal(e.d.byId(e.ids.alpha).parent.id, e.d.folderChild(e.ids.root, '01_PROYEK').id);
  const keys = e.rows.sistemDrive[0].results.map((item) => item.key);
  assert.equal(new Set(keys.filter((key) => !key.startsWith('root:'))).size, keys.filter((key) => !key.startsWith('root:')).length, 'item tidak diproses dua kali');
});

test('nama proyek ambigu masuk karantina dengan alasan', () => {
  const e = env({ extraProjects: [{ id: 'p3', code: 'ALPHA2', name: 'Alpha' }] });
  e.c.sistemDriveApply_({});
  const root = e.d.byId(e.ids.root);
  const quarantine = e.d.folderChild(root.id, '99_KARANTINA');
  assert.equal(e.d.byId(e.ids.alpha).parent.id, quarantine.id);
  const result = e.rows.sistemDrive[0].results.find((item) => item.key === 'folder:' + e.ids.alpha);
  assert.match(result.reason, /beberapa proyek/);
  assert.equal(e.d.byId(e.ids.alpha).name, 'Project Alpha', 'nama folder karantina dipertahankan');
});

test('semua folder sistem privat dan hanya folder baru yang dibagikan ulang', () => {
  const e = env();
  e.c.sistemDriveApply_({});
  const root = e.d.byId(e.ids.root);
  const folders = [...e.d.nodes.values()].filter((node) => node.kind === 'folder');
  for (const folder of folders) {
    assert.equal(folder.access, 'PRIVATE', folder.name + ' harus privat');
    assert.equal(folder.editors.length, 0);
    assert.equal(folder.viewers.length, 0);
  }
  assert.ok(e.d.sharing.length > 0, 'folder baru wajib dipanggil setSharing privat');
  assert.ok(e.d.sharing.every((call) => call.access === 'PRIVATE' && call.permission === 'NONE'));
  assert.equal(root.access, 'PRIVATE');
});

test('aset yang gagal dipindahkan masuk karantina dengan alasan', () => {
  const e = env();
  e.d.byId(e.ids.loose).failMove = 1;
  const result = e.c.sistemDriveApply_({});
  assert.equal(result.run.status, 'DONE');
  const quarantine = e.d.folderChild(e.ids.root, '99_KARANTINA');
  assert.equal(e.d.byId(e.ids.loose).parent.id, quarantine.id);
  const item = e.rows.sistemDrive[0].results.find((entry) => entry.key === 'file:' + e.ids.loose);
  assert.equal(item.status, 'quarantine');
  assert.match(item.reason, /menolak pemindahan/);
  assert.equal(e.d.byId(e.ids.alpha).parent.id, e.d.folderChild(e.ids.root, '01_PROYEK').id);
});

test('generator clasp memuat layanan konsolidasi Drive tepat sekali', () => {
  const { sourceFiles } = require('../alat/buat-sumber-clasp');
  const targets = sourceFiles.filter(([, target]) => target === 'SistemDrive.gs');
  assert.equal(targets.length, 1);
  assert.equal(targets[0][0], 'aplikasi/SistemDrive.gs');
  const scope = JSON.parse(source('appsscript.json')).oauthScopes;
  assert.ok(scope.includes('https://www.googleapis.com/auth/drive'));
});

test('API konsolidasi menolak pemanggil tanpa sesi pemilik', () => {
  const e = env();
  const before = e.d.snapshot();
  assert.throws(() => e.c.apiSistemDrive('apply', {}, 'penyusup'), /Unauthorized/);
  assert.throws(() => e.c.apiSistemDrive('plan', {}, ''), /Unauthorized/);
  assert.deepEqual(e.d.snapshot(), before);
});

test('template asli tidak berubah dan dua dokumen baru memakai salinan berbeda', () => {
  const e = env();
  const original = e.d.byId(e.ids.template);
  const before = [original.name, original.parent ? original.parent.id : null, original.id, original.trashed];
  const first = e.c.workspaceDocumentTemplateCopy_('p1', e.ids.template, 'Dokumen Satu');
  const second = e.c.workspaceDocumentTemplateCopy_('p1', e.ids.template, 'Dokumen Dua');
  assert.notEqual(first.fileId, second.fileId);
  assert.equal(original.id, e.ids.template);
  assert.deepEqual([original.name, original.parent ? original.parent.id : null, original.id, original.trashed], before);
  const lampiran = e.d.folderChild(e.d.folderChild(e.ids.root, '01_PROYEK').id, '[ALPHA] - Alpha');
  assert.equal(e.d.byId(first.fileId).parent.id, e.d.folderChild(lampiran.id, '07_LAMPIRAN').id);
  assert.equal(e.d.byId(second.fileId).parent.id, e.d.folderChild(lampiran.id, '07_LAMPIRAN').id);
});
