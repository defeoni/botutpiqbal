const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = (name) => fs.readFileSync(path.join(__dirname, '..', 'aplikasi', name), 'utf8');
const clone = (value) => JSON.parse(JSON.stringify(value));
const P1 = 'proj-alpha-0001', P2 = 'proj-beta-0002';

function withLock(e, task) {
  const lock = e.c.LockService.getScriptLock();
  lock.waitLock();
  try { return task(); } finally { lock.releaseLock(); }
}

function env() {
  const rows = {
    workspaceProjects: [
      { id: P1, code: 'ALPHA', name: 'Alpha' },
      { id: P2, code: 'BETA', name: 'Beta' }
    ],
    workspaceDocuments: [],
    workspaceRpd: [],
    workspaceTasks: [],
    workspaceFinance: [],
    workspaceArchives: [],
    workspacePeople: [],
    workspaceAttendance: [],
    workspaceDocumentTracking: [],
    documentExports: [],
    rpb: [],
    memo: []
  };
  let sequence = 0, copySequence = 0, failNext = false, failHard = false, locked = false;
  const copies = [], folders = [], originals = new Map();
  const original = (id, name) => {
    const file = {
      id, name, mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      getName() { return name; },
      getMimeType() { return this.mime; },
      getUrl() { return 'https://drive.google.com/file/d/' + id + '/view'; },
      makeCopy(copyName, folder) {
        copySequence++;
        const copy = {
          id: 'copy-' + copySequence,
          name: copyName,
          mime: this.mime,
          getId() { return this.id; },
          getName() { return copyName; },
          getMimeType() { return this.mime; },
          getUrl() { return 'https://drive.google.com/file/d/copy-' + copySequence + '/view'; },
          setTrashed(value) { this.trashed = value; }
        };
        copies.push({ source: id, name: copyName, folder, copy });
        return copy;
      },
      setTrashed(value) { this.trashed = value; }
    };
    originals.set(id, file);
    return file;
  };
  original('source-template-1', 'Form Template.docx');
  original('source-template-2', 'Form Lain.docx');

  const context = {
    Date, Intl, console,
    requireAuthorized_(token) { if (token !== 'owner') throw new Error('Unauthorized'); },
    requireDeletePin_(pin) { if (pin !== 'valid') throw new Error('PIN salah'); },
    Utilities: {
      getUuid() { sequence++; return 'uuid-' + String(sequence).padStart(4, '0'); },
      formatDate() { return '2026-10-21'; }
    },
    LockService: {
      getScriptLock() { return { waitLock() { locked = true; }, releaseLock() { locked = false; } }; }
    },
    utpRead_(entity) { return (rows[entity] || []).filter((row) => !row.archived).map(clone); },
    utpGet_(entity, id) {
      const found = (rows[entity] || []).find((row) => row.id === id);
      return found ? clone(found) : null;
    },
    utpWrite_(entity, record, version) {
      assert.equal(locked, true, 'Pusat Dokumen harus menulis di dalam lock');
      const list = rows[entity] || (rows[entity] = []);
      const previous = list.find((row) => row.id === record.id);
      if (previous && previous.version !== Number(version)) throw new Error('Data berubah di sesi lain.');
      if (!previous && Number(version) !== 0) throw new Error('Versi awal tidak valid.');
      record.version = previous ? previous.version + 1 : 1;
      record.createdAt = previous ? previous.createdAt : '2026-10-21T00:00:00Z';
      record.updatedAt = '2026-10-21T00:00:00Z';
      const index = list.findIndex((row) => row.id === record.id);
      if (index < 0) list.push(clone(record)); else list[index] = clone(record);
      const saved = clone(record);
      if (failHard && entity === 'workspaceDocuments') {
        failHard = false;
        throw new Error('Penyimpanan sheet gagal');
      }
      if (failNext && entity === 'workspaceDocuments') {
        failNext = false;
        const error = new Error('Audit tidak tersedia');
        error.recordSaved = true;
        throw error;
      }
      return saved;
    },
    DriveApp: {
      getFileById(id) {
        if (originals.has(id)) return originals.get(id);
        const copy = copies.map((row) => row.copy).find((row) => row.id === id);
        if (copy) return copy;
        throw new Error('File tidak ditemukan: ' + id);
      }
    },
    getArchiveRootFolder_: () => ({}),
    getOrCreateArchiveSubfolder_(parent, name) { folders.push(name); return { name }; },
    getRpbHistory_() { return rows.rpb.map(clone); },
    apiGetMemoHistory() { return rows.memo.map(clone); }
  };
  vm.createContext(context);
  ['Workspace.gs', 'Projects.gs', 'SistemDrive.gs'].forEach((name) => vm.runInContext(source(name), context));
  return {
    c: context, rows, copies, folders, originals,
    failNextWrite() { failNext = true; },
    failHardNextWrite() { failHard = true; }
  };
}

test('dokumen Drive baru menyalin template, menyimpan fileId, dan tidak menyentuh aslinya', () => {
  const e = env();
  const first = e.c.apiProjectDocument('save', {
    record: {
      projectId: P1, title: 'Surat Izin', templateId: 'template-1',
      templateSourceId: 'source-template-1', clientRequestId: 'req-1', status: 'DRAFT'
    }
  }, 'owner');
  assert.equal(first.record.templateSourceId, 'source-template-1');
  assert.equal(first.record.fileId, 'copy-1');
  assert.equal(e.copies.length, 1);
  assert.equal(e.originals.get('source-template-1').name, 'Form Template.docx');
  assert.equal(e.originals.get('source-template-1').trashed, undefined);
  assert.equal(e.copies[0].name, 'Surat Izin.docx');
  assert.match(e.copies[0].folder.name, /07_LAMPIRAN/);

  const retry = e.c.apiProjectDocument('save', {
    record: {
      projectId: P1, title: 'Surat Izin', templateId: 'template-1',
      templateSourceId: 'source-template-1', clientRequestId: 'req-1', status: 'DRAFT'
    }
  }, 'owner');
  assert.equal(retry.duplicate, true);
  assert.equal(retry.record.id, first.record.id);
  assert.equal(e.copies.length, 1, 'retry tidak boleh membuat salinan kedua');

  const secondProject = e.c.apiProjectDocument('save', {
    record: {
      projectId: P2, title: 'Surat Izin', templateId: 'template-1',
      templateSourceId: 'source-template-1', clientRequestId: 'req-2', status: 'DRAFT'
    }
  }, 'owner');
  assert.equal(secondProject.record.fileId, 'copy-2');
  assert.notEqual(secondProject.record.fileId, first.record.fileId);
  assert.equal(e.copies.length, 2);
  assert.equal(e.originals.get('source-template-1').name, 'Form Template.docx');
});

test('form internal membuat record baru tanpa file atau ID template', () => {
  const e = env();
  const result = e.c.apiProjectDocument('save', {
    record: {
      projectId: P1, title: 'Memo Baru', templateId: 'app-pn',
      templateSourceId: '', clientRequestId: 'req-internal', status: 'DRAFT'
    }
  }, 'owner');
  assert.equal(result.record.id, 'uuid-0001');
  assert.equal(result.record.templateId, 'app-pn');
  assert.equal(result.record.templateSourceId, undefined);
  assert.equal(result.record.fileId, undefined);
  assert.equal(e.copies.length, 0);
});

test('salinan berhasil lalu audit gagal menjadi tersimpan dengan peringatan; retry tidak menduplikasi', () => {
  const e = env();
  e.failNextWrite();
  const result = e.c.apiProjectDocument('save', {
    record: {
      projectId: P1, title: 'Dokumen Audit', templateId: 'template-1',
      templateSourceId: 'source-template-1', clientRequestId: 'req-warning', status: 'DRAFT'
    }
  }, 'owner');
  assert.match(result.warning, /tersimpan dengan peringatan/i);
  assert.equal(result.record.fileId, 'copy-1');
  assert.equal(e.copies.length, 1);
  const retry = e.c.apiProjectDocument('save', {
    record: {
      projectId: P1, title: 'Dokumen Audit', templateId: 'template-1',
      templateSourceId: 'source-template-1', clientRequestId: 'req-warning', status: 'DRAFT'
    }
  }, 'owner');
  assert.equal(retry.duplicate, true);
  assert.equal(retry.record.fileId, 'copy-1');
  assert.equal(e.copies.length, 1);
});

test('penyimpanan record gagal total setelah salinan berhasil memakai salinan yang sama saat retry', () => {
  const e = env();
  e.failHardNextWrite();
  const request = {
    record: {
      projectId: P1, title: 'Dokumen Ulang', templateId: 'template-1',
      templateSourceId: 'source-template-1', clientRequestId: 'req-hard', status: 'DRAFT'
    }
  };
  assert.throws(() => e.c.apiProjectDocument('save', request, 'owner'), /salinan yang sama/i);
  assert.equal(e.copies.length, 1);
  assert.equal(e.originals.get('source-template-1').trashed, undefined);
  const retry = e.c.apiProjectDocument('save', request, 'owner');
  assert.equal(retry.record.fileId, 'copy-1');
  assert.equal(retry.record.templateSourceId, 'source-template-1');
  assert.equal(e.copies.length, 1, 'retry tidak boleh membuat salinan kedua');
  assert.equal(e.originals.get('source-template-1').name, 'Form Template.docx');
  assert.equal(e.copies[0].source, 'source-template-1');
});

test('rekonsiliasi mengisi link draf lama dari Memo, RPD, dan RPB sekali saja', () => {
  const e = env();
  e.rows.workspaceDocuments = [
    { id: 'draft-memo', projectId: P1, title: 'Draf Memo', version: 1 },
    { id: 'draft-rpd', projectId: P1, title: 'Draf RPD', version: 1 },
    { id: 'draft-rpb', projectId: P1, title: 'Draf RPB', version: 1 },
    { id: 'draft-beta', projectId: P2, title: 'Draf Beta', version: 1 }
  ];
  e.rows.workspaceRpd = [{ id: 'rpd-recon', projectId: P1, workspaceDocumentId: 'draft-rpd' }];
  e.rows.memo = [{ number: 'MEMO-RECON', projectId: P1, workspaceDocumentId: 'draft-memo' }];
  e.rows.rpb = [{ id: 'rpb-recon', number: 'RPB-RECON', data: { projectId: P1, workspaceDocumentId: 'draft-rpb' } }];
  const first = e.c.apiProjects('documents', { projectId: P1 }, 'owner');
  const draft = (id) => e.rows.workspaceDocuments.find((row) => row.id === id);
  assert.equal(draft('draft-memo').linkedSource.type, 'memo');
  assert.equal(draft('draft-memo').linkedSource.id, 'MEMO-RECON');
  assert.equal(draft('draft-rpd').linkedSource.type, 'rpd');
  assert.equal(draft('draft-rpb').linkedSource.type, 'rpb');
  assert.equal(draft('draft-beta').linkedSource, undefined, 'proyek lain tidak boleh ditautkan');
  for (const id of ['draft-memo', 'draft-rpd', 'draft-rpb']) assert.ok(!first.documents.some((doc) => doc.id === id), id + ' digantikan record sumber');
  const versions = e.rows.workspaceDocuments.map((row) => row.id + ':' + row.version);
  e.c.apiProjects('documents', { projectId: P1 }, 'owner');
  assert.deepEqual(e.rows.workspaceDocuments.map((row) => row.id + ':' + row.version), versions, 'rekonsiliasi kedua tidak menulis ulang');
});

test('rekonsiliasi tidak menimpa draf yang sudah tertaut ke record lain', () => {
  const e = env();
  e.rows.workspaceDocuments = [{ id: 'draft-locked', projectId: P1, linkedSource: { type: 'memo', id: 'MEMO-LAIN' }, version: 1 }];
  e.rows.workspaceRpd = [{ id: 'rpd-locked', projectId: P1, workspaceDocumentId: 'draft-locked' }];
  e.c.apiProjects('documents', { projectId: P1 }, 'owner');
  const draft = e.rows.workspaceDocuments.find((row) => row.id === 'draft-locked');
  assert.equal(draft.linkedSource.type, 'memo');
  assert.equal(draft.linkedSource.id, 'MEMO-LAIN');
  assert.equal(draft.version, 1);
});

test('link Memo, RPD, dan RPB tersimpan dan tetap tersembunyi setelah muat ulang', () => {
  const e = env();
  e.rows.workspaceDocuments = [
    { id: 'draft-m', projectId: P1, title: 'Draf Memo', version: 1 },
    { id: 'draft-d', projectId: P1, title: 'Draf RPD', version: 1 },
    { id: 'draft-b', projectId: P1, title: 'Draf RPB', version: 1 }
  ];
  e.rows.memo = [{ number: 'MEMO-LINK', projectId: P1, workspaceDocumentId: 'draft-m' }];
  e.rows.workspaceRpd = [{ id: 'rpd-link', projectId: P1, workspaceDocumentId: 'draft-d' }];
  e.rows.rpb = [{ id: 'rpb-link', number: 'RPB-LINK', data: { projectId: P1, workspaceDocumentId: 'draft-b' } }];
  withLock(e, () => e.c.workspaceDocumentLink_('draft-m', P1, 'memo', 'MEMO-LINK'));
  withLock(e, () => e.c.workspaceDocumentLink_('draft-d', P1, 'rpd', 'rpd-link'));
  withLock(e, () => e.c.workspaceDocumentLink_('draft-b', P1, 'rpb', 'rpb-link'));
  const rows = e.rows.workspaceDocuments;
  assert.equal(rows.find((row) => row.id === 'draft-m').linkedSource.type, 'memo');
  assert.equal(rows.find((row) => row.id === 'draft-d').linkedSource.type, 'rpd');
  assert.equal(rows.find((row) => row.id === 'draft-b').linkedSource.type, 'rpb');
  for (const pass of [0, 1]) {
    const index = e.c.projectDocumentIndex_(P1, 'owner');
    const ids = index.documents.map((doc) => doc.id);
    for (const id of ['draft-m', 'draft-d', 'draft-b']) assert.ok(!ids.includes(id), id + ' tidak boleh tampil sebagai kartu terpisah');
    assert.ok(ids.includes('memo:MEMO-LINK'));
    assert.ok(ids.includes('rpd:rpd-link'));
    assert.ok(ids.includes('rpb:rpb-link'));
  }
});

test('RPD tersimpan tetapi tautan draf gagal menghasilkan peringatan', () => {
  const e = env();
  const draft = e.c.apiProjectDocument('save', {
    record: { projectId: P1, title: 'Draf RPD Peringatan', templateId: 'module-rpd', status: 'DRAFT' }
  }, 'owner').record;
  e.failNextWrite();
  const saved = e.c.apiWorkspace('save', {
    module: 'rpd',
    record: {
      id: 'rpd-warn-01', version: 0, projectId: P1, workspaceDocumentId: draft.id,
      purpose: 'Air minum', date: '2026-10-20', recipient: 'Vendor',
      paymentDetails: 'Rekening', proof: 'Invoice', status: 'DRAFT',
      items: [{ name: 'Galon', quantity: 1, price: 20000 }]
    }
  }, 'owner');
  assert.match(saved.warning, /Tautan draf|audit/i);
  assert.equal(e.rows.workspaceRpd[0].id, 'rpd-warn-01');
  assert.equal(saved.record.id, 'rpd-warn-01');
});

test('kartu draf dapat ditautkan ke Memo, RPD, dan RPB tanpa menimpa tautan lain', () => {
  const e = env();
  const draft = e.c.apiProjectDocument('save', {
    record: { projectId: P1, title: 'Draf Memo', templateId: 'app-pn', status: 'DRAFT' }
  }, 'owner').record;
  const linked = withLock(e, () => e.c.workspaceDocumentLink_(draft.id, P1, 'memo', 'MEMO-01'));
  assert.equal(linked.record.linkedSource.type, 'memo');
  assert.equal(linked.record.linkedSource.id, 'MEMO-01');
  const again = withLock(e, () => e.c.workspaceDocumentLink_(draft.id, P1, 'memo', 'MEMO-01'));
  assert.equal(again.warning, '');
  const other = withLock(e, () => e.c.workspaceDocumentLink_(draft.id, P1, 'rpd', 'RPD-01'));
  assert.match(other.warning, /sudah tertaut/);
  assert.equal(e.rows.workspaceDocuments[0].linkedSource.type, 'memo');
});

test('indeks menampilkan record sumber dan menyembunyikan draf yang tertaut meski sumber tidak membawa workspaceDocumentId', () => {
  const e = env();
  e.rows.workspaceDocuments = [
    { id: 'doc-rpd', projectId: P1, title: 'Draf RPD', status: 'DRAFT' },
    { id: 'doc-rpb', projectId: P1, title: 'Draf RPB', status: 'DRAFT' },
    { id: 'doc-memo', projectId: P1, title: 'Draf Memo', status: 'DRAFT' },
    { id: 'doc-linked', projectId: P1, title: 'Draf tertaut', status: 'DRAFT', linkedSource: { type: 'memo', id: 'MEMO-02' } }
  ];
  e.rows.workspaceRpd = [{ id: 'rpd-1', projectId: P1, purpose: 'Sewa', workspaceDocumentId: 'doc-rpd' }];
  e.rows.rpb = [{ id: 'rpb-1', number: 'RPB-01', status: 'Diajukan', requestDate: '2026-10-10', data: { projectId: P1, workspaceDocumentId: 'doc-rpb' } }];
  e.rows.memo = [
    { number: 'MEMO-01', projectId: P1, workspaceDocumentId: 'doc-memo', perihal: 'Memo' },
    { number: 'MEMO-02', projectId: P1, perihal: 'Memo tertaut' }
  ];
  const index = e.c.projectDocumentIndex_(P1, 'owner');
  const ids = index.documents.map((doc) => doc.id);
  assert.ok(ids.includes('rpd:rpd-1'));
  assert.ok(ids.includes('rpb:rpb-1'));
  assert.ok(ids.includes('memo:MEMO-01'));
  assert.ok(ids.includes('memo:MEMO-02'));
  for (const draft of ['doc-rpd', 'doc-rpb', 'doc-memo', 'doc-linked']) assert.ok(!ids.includes(draft), draft + ' harus digantikan sumbernya');
});

test('RPD yang menyimpan workspaceDocumentId menautkan kartu drafnya', () => {
  const e = env();
  const draft = e.c.apiProjectDocument('save', {
    record: { projectId: P1, title: 'Draf RPD', templateId: 'module-rpd', status: 'DRAFT' }
  }, 'owner').record;
  const saved = e.c.apiWorkspace('save', {
    module: 'rpd',
    record: {
      id: 'rpd-00000001', version: 0, projectId: P1, workspaceDocumentId: draft.id,
      purpose: 'Air minum', date: '2026-10-20', recipient: 'Vendor',
      paymentDetails: 'Rekening', proof: 'Invoice', status: 'DRAFT',
      items: [{ name: 'Galon', quantity: 2, price: 15000 }]
    }
  }, 'owner');
  assert.equal(saved.record.workspaceDocumentId, draft.id);
  assert.equal(saved.record.id, 'rpd-00000001');
  const linked = e.rows.workspaceDocuments.find((doc) => doc.id === draft.id);
  assert.equal(linked.linkedSource.type, 'rpd');
  assert.equal(linked.linkedSource.id, saved.record.id);
});

test('Memo, RPB, dan RPD memanggil penautan draf dengan jenis sumber yang benar', () => {
  assert.match(source('Memo.gs'), /workspaceDocumentLink_\(validated\.workspaceDocumentId[\s\S]*?'memo',number\)/);
  assert.match(source('RPB.gs'), /workspaceDocumentLink_\(clean\.workspaceDocumentId[\s\S]*?'rpb',id\)/);
  assert.match(source('Workspace.gs'), /workspaceDocumentLink_\(saved\.workspaceDocumentId[\s\S]*?'rpd',saved\.id\)/);
  assert.match(source('MemoClient.html'), /workspaceDocumentId: window\.UTP_PENDING_DOCUMENT_ID/);
  assert.match(source('RPBClient.html'), /workspaceDocumentId:\s*rpbWorkspaceDocumentId_[\s\S]{0,30}UTP_PENDING_DOCUMENT_ID/);
  assert.match(source('MemoClient.html'), /UtpPendingDocument\.clear/);
  assert.match(source('RPBClient.html'), /UtpPendingDocument\.clear/);
});

test('kegagalan audit saat menautkan draf hanya menjadi warning', () => {
  const e = env();
  const draft = e.c.apiProjectDocument('save', {
    record: { projectId: P1, title: 'Draf Audit', templateId: 'app-pn', status: 'DRAFT' }
  }, 'owner').record;
  e.failNextWrite();
  const result = withLock(e, () => e.c.workspaceDocumentLink_(draft.id, P1, 'rpb', 'RPB-01'));
  assert.match(result.warning, /audit gagal/i);
  assert.equal(e.rows.workspaceDocuments.find((doc) => doc.id === draft.id).linkedSource.id, 'RPB-01');
});
