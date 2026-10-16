const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');

// In-memory Google services: these checks never contact Drive, Sheets, Gmail or Telegram.
function environment() {
  const state = { props: new Map(), books: new Map(), files: new Map(), folders: new Map(), writes: [], drafts: [], locks: 0, next: 0 };
  const uid = () => `test-${++state.next}`;
  class Range {
    constructor(sheet, row, col, rows = 1, cols = 1) { Object.assign(this, { sheet, row, col, rows, cols }); }
    getValues() { return Array.from({ length: this.rows }, (_, r) => Array.from({ length: this.cols }, (_, c) => this.sheet.rows[this.row + r - 1]?.[this.col + c - 1] ?? '')); }
    getDisplayValues() { return this.getValues().map(row => row.map(value => String(value).replace(/^'/, ''))); }
    setValues(values) {
      for (const row of values) for (const value of row) if (String(value).length > 50000) throw new Error('Google Sheets cell exceeds 50000 characters');
      state.writes.push({ sheet: this.sheet.name, row: this.row, col: this.col, values: JSON.parse(JSON.stringify(values)), format: this.format });
      values.forEach((row, r) => row.forEach((value, c) => { const target = this.sheet.rows[this.row + r - 1] ||= []; target[this.col + c - 1] = value; }));
      return this;
    }
    setValue(value) { return this.setValues([[value]]); }
    getValue() { return this.getValues()[0][0]; }
    setNumberFormat(format) { this.format = format; return this; }
    createTextFinder(value) {
      const range = this;
      return { matchEntireCell() { return this; }, findNext() { const index = range.getValues().findIndex(row => row.some(cell => String(cell) === String(value))); return index < 0 ? null : { getRow: () => range.row + index }; } };
    }
  }
  class Sheet {
    constructor(name) { this.name = name; this.rows = []; this.maxRows = 1000; }
    getRange(...args) { return new Range(this, ...args); }
    getLastRow() { return this.rows.length; }
    getLastColumn() { return Math.max(0, ...this.rows.map(row => row.length)); }
    getMaxRows() { return this.maxRows; }
    getMaxColumns() { return 26; }
    insertRowsAfter(after, count) { this.maxRows += count; }
    setFrozenRows() { return this; }
    appendRow(row) { this.getRange(this.rows.length + 1, 1, 1, row.length).setValues([row]); return this; }
  }
  function folder(id, access = 'PRIVATE') {
    const result = {
      id, access, getId() { return id; }, getSharingAccess() { return this.access; },
      setSharing(access) { this.access = access; return this; },
      createFolder() { const child = folder(uid(), this.access); state.folders.set(child.id, child); return child; },
      createFile(blob) {
        const fileId = uid();
        const file = { id: fileId, access: this.access, trashed: false, getId: () => fileId, getUrl: () => `https://drive.google.com/file/d/${fileId}/view`, getBlob: () => blob, getMimeType: () => blob.mime, getName: () => blob.name, getSize: () => blob.bytes.length, getSharingAccess() { return this.access; }, setSharing(access) { this.access = access; return this; }, setTrashed(value) { this.trashed = value; return this; } };
        state.files.set(fileId, file); return file;
      }
    };
    return result;
  }
  const sharedArchive = folder('shared-archive', 'ANYONE');
  const sandbox = {
    console,
    PropertiesService: { getScriptProperties: () => ({ getProperty: key => state.props.get(key) || null, setProperty: (key, value) => state.props.set(key, value) }) },
    SpreadsheetApp: { create: () => { const id = uid(), sheets = new Map(); const book = { getId: () => id, getSheetByName: name => sheets.get(name) || null, insertSheet: name => { const sheet = new Sheet(name); sheets.set(name, sheet); return sheet; } }; state.books.set(id, book); return book; }, openById: id => { if (!state.books.has(id)) throw new Error('Spreadsheet not found'); return state.books.get(id); } },
    Utilities: { getUuid: uid, base64Decode: value => Array.from(Buffer.from(value, 'base64')), base64Encode: bytes => Buffer.from(bytes).toString('base64'), DigestAlgorithm: { SHA_256: 'sha256' }, computeDigest: (algorithm, bytes) => Array.from(crypto.createHash('sha256').update(Buffer.from(bytes)).digest()), newBlob: (bytes, mime, name) => ({ bytes, mime, name }) },
    DriveApp: { Access: { PRIVATE: 'PRIVATE', ANYONE: 'ANYONE' }, Permission: { NONE: 'NONE', VIEW: 'VIEW' }, createFolder: () => { const created = folder(uid()); state.folders.set(created.id, created); return created; }, getFolderById: id => state.folders.get(id), getFileById: id => { if (!state.files.has(id)) throw new Error('File not found'); return state.files.get(id); } },
    GmailApp: { createDraft: (to, subject, body, options) => { const draft = { id: uid(), to, subject, body, options }; state.drafts.push(draft); return { getId: () => draft.id }; }, sendEmail: () => { throw new Error('Sending email is forbidden'); } },
    UrlFetchApp: { fetch: () => { throw new Error('Network calls are forbidden in storage tests'); } },
    LockService: { getScriptLock: () => ({ waitLock: () => { state.locks++; }, releaseLock: () => { state.locks--; } }) },
    requireAuthorized_: token => { if (token !== 'session') throw new Error('Unauthorized'); },
    requireDeletePin_: pin => { if (pin !== '123456') throw new Error('PIN salah'); },
    getArchiveRootFolder_: () => sharedArchive
  };
  vm.createContext(sandbox);
  for (const name of ['UtpDomain.gs', 'Utp.gs']) vm.runInContext(fs.readFileSync(path.join(__dirname, '../utp', name), 'utf8'), sandbox, { filename: name });
  const call = (action, payload = {}, token = 'session') => sandbox.apiUtp(action, payload, token);
  const plain = value => JSON.parse(JSON.stringify(value));
  return { state, sandbox, call, plain };
}
const draft = (overrides = {}) => ({ title: 'Bahan lantai 1', date: '2026-10-16', authority: 'PM', requiredAuthority: 'PM', status: 'DRAFT', items: [{ id: 'item-1', name: 'Pasir', unit: 'm3', quantity: 10, status: 'OWNER' }], ...overrides });

test('authentication gates every endpoint and empty bootstrap causes no cloud mutations', () => {
  const env = environment();
  assert.throws(() => env.call('bootstrap', {}, 'bad-token'), /Unauthorized/);
  const result = env.call('bootstrap');
  assert.equal(result.dataInitialized, false);
  assert.equal(result.masterCount, 0);
  assert.equal(result.project.pm, 'Juhana');
  assert.equal(env.state.books.size, 0);
  assert.equal(env.state.writes.length, 0);
});

test('record updates enforce optimistic versions and always release locks after an error', () => {
  const env = environment();
  const created = env.call('save', { entity: 'requests', record: draft() }).record;
  assert.equal(created.version, 1);
  const updated = env.call('save', { entity: 'requests', record: { ...created, title: 'Perubahan judul' } }).record;
  assert.equal(updated.version, 2);
  assert.equal(updated.createdAt, created.createdAt);
  assert.throws(() => env.call('save', { entity: 'requests', record: { ...created, title: 'Stale tab' } }), /berubah/);
  assert.equal(env.call('detail', { entity: 'requests', id: created.id }).record.title, 'Perubahan judul');
  assert.equal(env.state.locks, 0);
});

test('approved decisions require PIN to edit and all archive operations preserve history', () => {
  const env = environment();
  const created = env.call('save', { entity: 'approvals', record: { material: 'Pasir', generic: true, status: 'APPROVED', authority: 'PM' } }).record;
  assert.throws(() => env.call('save', { entity: 'approvals', record: { ...created, note: 'Changed' } }), /PIN/);
  const archived = env.call('archive', { entity: 'approvals', id: created.id, version: created.version, pin: '123456' }).record;
  assert.equal(archived.archived, true);
  assert.equal(env.call('list', { entity: 'approvals' }).records.length, 0);
  assert.equal(env.call('list', { entity: 'approvals', includeArchived: true }).records.length, 1);
  assert.throws(() => env.call('save', { entity: 'approvals', record: archived, pin: '123456' }), /diarsipkan/);
});

test('complete/reopen task uses PIN and rejects stale versions', () => {
  const env = environment();
  const created = env.call('save', { entity: 'tasks', record: { title: 'Periksa pompa', dueDate: '2026-10-18' } }).record;
  const done = env.call('taskComplete', { id: created.id, version: created.version, note: 'Sudah diperiksa' }).record;
  assert.equal(done.status, 'DONE');
  assert.ok(done.completedAt);
  assert.throws(() => env.call('taskReopen', { id: done.id, version: done.version }), /PIN/);
  const open = env.call('taskReopen', { id: done.id, version: done.version, pin: '123456' }).record;
  assert.equal(open.status, 'OPEN');
  assert.equal(open.completedAt, '');
  assert.throws(() => env.call('taskComplete', { id: created.id, version: created.version }), /berubah/);
});

test('master CSV upsert preserves leading zeros, original names, omitted records and omitted fields', () => {
  const env = environment();
  const first = 'code,name,brand,unit\n0001,"  Pipa  PVC  ",Rucika,batang\n0002,Pasir,,m3';
  assert.equal(env.call('importPreview', { csv: first }).added, 2);
  env.call('importCommit', { csv: first, pin: '123456' });
  env.call('importCommit', { csv: 'code,name\n0001,"Pipa baru"\n0003,"=SUM(1,2)"', pin: '123456' });
  const rows = env.call('searchItems', { limit: 50 }).items;
  assert.equal(rows.length, 3);
  assert.equal(rows.find(r => r.code === '0001').brand, 'Rucika');
  assert.equal(rows.find(r => r.code === '0001').unit, 'batang');
  assert.equal(rows.find(r => r.code === '0002').name, 'Pasir');
  assert.equal(rows.find(r => r.code === '0003').name, '=SUM(1,2)');
  const masterWrites = env.state.writes.filter(w => w.sheet === 'master' && w.values.length > 1);
  assert.equal(masterWrites[0].values[1][1], '  Pipa  PVC  ');
  for (const write of masterWrites) {
    assert.equal(write.format, '@');
    for (const row of write.values.slice(1)) for (const value of row) assert.equal(/^[=+\-@]/.test(value), false, `unescaped formula: ${value}`);
  }
  assert.equal(env.call('bootstrap').masterCount, 3);
});

test('invalid import is atomic and does not delete or partly replace the master', () => {
  const env = environment();
  env.call('importCommit', { csv: 'code,name\n0001,Original', pin: '123456' });
  assert.throws(() => env.call('importCommit', { csv: 'code,name\n0001,Changed\n0001,Duplicate', pin: '123456' }), /tidak valid/);
  assert.equal(env.call('searchItems', {}).items[0].name, 'Original');
});

test('a confirmed receipt requires an active fund and an uploaded receipt file before affecting balance', () => {
  const env = environment();
  const fund = env.call('save', { entity: 'funds', record: { type: 'RPB', amount: 100000, receivedDate: '2026-10-16', recipient: 'Admin' } }).record;
  const record = { vendor: 'Warung', date: '2026-10-16', category: 'Konsumsi', total: 25000, status: 'CONFIRMED', fundId: fund.id };
  assert.throws(() => env.call('save', { entity: 'receipts', record }), /foto nota/);
  const file = env.call('upload', { name: 'nota.png', mime: 'image/png', base64: Buffer.from([137,80,78,71,13,10,26,10,1]).toString('base64'), kind: 'receipt' });
  env.call('save', { entity: 'receipts', record: { ...record, fileId: file.id } });
  assert.equal(env.call('bootstrap').finance.balance, 75000);
  assert.throws(() => env.call('archive', { entity: 'funds', id: fund.id, version: fund.version, pin: '123456' }), /nota/);
});

test('uploaded files stay private even when an older archive root is public', () => {
  const env = environment();
  const result = env.call('upload', { name: 'persetujuan.pdf', mime: 'application/pdf', base64: Buffer.from('%PDF-1.7\nfixture').toString('base64'), kind: 'final' });
  assert.equal(env.state.files.get(result.id).getSharingAccess(), 'PRIVATE');
  const stored = env.call('list', { entity: 'documents' }).records[0];
  assert.equal(stored.uploadedByUtp, true);
  assert.equal(stored.mime, 'application/pdf');
});

test('HO final cannot lose its mandatory evidence through a later protected save', () => {
  const env = environment();
  const file = env.call('upload', { name: 'HO.pdf', mime: 'application/pdf', base64: Buffer.from('%PDF-1.7\nHO evidence').toString('base64') });
  let record = env.call('save', { entity: 'requests', record: draft({ requiredAuthority: 'HO', finalFileId: file.id }) }).record;
  record = env.call('requestTransition', { id: record.id, version: record.version, status: 'HO' }).record;
  record = env.call('requestTransition', { id: record.id, version: record.version, status: 'FINAL' }).record;
  assert.throws(() => env.call('save', { entity: 'requests', record: { ...record, finalFileId: '' }, pin: '123456' }), /bukti|Bukti/);
});

test('email drafting creates a draft with registered attachments and never sends', () => {
  const env = environment();
  const file = env.call('upload', { name: 'Final.pdf', mime: 'application/pdf', base64: Buffer.from('%PDF-1.7\nfinal').toString('base64') });
  const record = env.call('save', { entity: 'requests', record: draft({ finalFileId: file.id }) }).record;
  const result = env.call('draftEmail', { id: record.id, version: record.version });
  assert.equal(env.state.drafts.length, 1);
  assert.equal(env.state.drafts[0].options.attachments.length, 1);
  assert.ok(result.id);
  assert.match(env.state.drafts[0].subject, /TRSM-51D26-D-M/);
});

test('persistent settings use Sheets and require PIN', () => {
  const env = environment();
  assert.throws(() => env.call('settings', { settings: { defaultEmailTo: 'person@example.com' } }), /PIN/);
  env.call('settings', { settings: { defaultEmailTo: 'person@example.com' }, pin: '123456' });
  assert.equal(env.call('bootstrap').settings.defaultEmailTo, 'person@example.com');
  assert.equal(Array.from(env.state.props.values()).some(value => String(value).includes('person@example.com')), false);
});

test('large valid request updates do not fail after writing because of an oversized audit cell', () => {
  const env = environment();
  const items = Array.from({ length: 7 }, (_, i) => ({ id: `item-${i}`, name: `Material ${i}`, unit: 'unit', quantity: 1, status: 'OWNER', note: 'x'.repeat(1800) }));
  const created = env.call('save', { entity: 'requests', record: draft({ items }) }).record;
  assert.ok(JSON.stringify(created).length > 25000);
  const saved = env.call('save', { entity: 'requests', record: { ...created, title: 'Revisi judul' } }).record;
  assert.equal(saved.version, 2);
  assert.equal(env.call('detail', { entity: 'requests', id: saved.id }).record.title, 'Revisi judul');
});
