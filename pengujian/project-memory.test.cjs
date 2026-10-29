const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function loadServices() {
  const saved = new Map();
  const cache = new Map();
  function load(relative) {
    const file = path.resolve(__dirname, '../cloudflare/frontend/src/services', relative + '.ts');
    if (cache.has(file)) return cache.get(file);
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
    }).outputText;
    const exports = {};
    vm.runInNewContext(code, {
      exports,
      require: name => load(name),
      console,
      localStorage: { getItem: key => saved.get(key) ?? null, setItem: (key, value) => saved.set(key, value) }
    }, { filename: file });
    cache.set(file, exports);
    return exports;
  }
  return { parse: load('parserService').parseDocumentFile, storage: load('storageService').storageService, saved };
}

test('metadata backup round-trip preserves unrelated documents and rejects corrupt imports before writing', () => {
  const { storage, saved } = loadServices();
  const backup = JSON.parse(storage.exportBackup());
  const original = backup.documents[0];
  const extra = { ...original, id: 'migration-extra', files: [], relations: [], activityLog: [] };
  storage.createDocument(extra);
  storage.toggleArchive(original.id);
  assert.notEqual(storage.getDocumentById(original.id).isArchived, original.isArchived);
  assert.equal(storage.importBackup(backup), backup.documents.length);
  assert.equal(storage.getDocumentById(original.id).isArchived, original.isArchived);
  assert.ok(storage.getDocumentById('migration-extra'));
  const before = storage.exportBackup();
  const storedBefore = saved.get('utp_project_memory_docs_v1');
  const corrupt = JSON.parse(before);
  corrupt.documents[0].files = null;
  assert.throws(() => storage.importBackup(corrupt), /tidak valid/);
  assert.equal(saved.get('utp_project_memory_docs_v1'), storedBefore);
  assert.ok(storage.getDocumentById('migration-extra'));
});

test('failed backup storage restores old values and does not publish partial state', () => {
  const { storage, saved } = loadServices();
  const backup = JSON.parse(storage.exportBackup());
  const id = backup.documents[0].id;
  storage.toggleArchive(id);
  const archived = storage.getDocumentById(id).isArchived;
  const before = saved.get('utp_project_memory_docs_v1');
  const originalSet = saved.set.bind(saved);
  let failOnce = true;
  saved.set = (key, value) => {
    if (key === 'utp_project_memory_projects_v1' && failOnce) { failOnce = false; throw new Error('quota'); }
    return originalSet(key, value);
  };
  assert.throws(() => storage.importBackup(backup), /Penyimpanan browser gagal/);
  assert.equal(storage.getDocumentById(id).isArchived, archived);
  assert.equal(saved.get('utp_project_memory_docs_v1'), before);
});

test('filename hints never manufacture document facts, dates, manpower, approvals or relationships', () => {
  const { parse } = loadServices();
  for (const name of ['manpower_Bandung_signed.pdf', 'balasan_MK.pdf', 'nota_HO.jpg', 'approval.docx', 'sop.xlsx']) {
    const result = parse({ file: { name, size: 1024 } }, [
      { id: 'existing', projectId: 'PRJ-BDG', category: 'SURAT_KORESPONDENSI', title: 'Surat lama', documentNumber: '123/UTP/BDG/X/2026' }
    ]);
    assert.equal(result.projectId, 'ALL');
    assert.equal(result.documentNumber, '');
    assert.equal(result.documentDate, '');
    assert.equal(result.summary, '');
    assert.equal(result.nextAction, '');
    assert.equal(result.waitingParty, 'NONE');
    assert.equal(result.isActionable, false);
    for (const key of ['manpowerDetails', 'waitingPersonName', 'requiredApproval', 'deadline', 'followUpDate', 'suggestedRelation']) {
      assert.equal(result[key], undefined, key);
    }
    assert.equal(result.facts.filter(f => f.sourceType === 'DOKUMEN_FAKTA').length, 2);
    assert.ok(result.facts.filter(f => f.sourceType === 'DOKUMEN_FAKTA').every(f => f.pageOrLocation.includes('Metadata berkas')));
    assert.equal(result.facts.find(f => f.key === 'kategori_dugaan').sourceType, 'DUGAAN_SISTEM');
  }
});

test('official number comes only from literal text, with a traceable location', () => {
  const { parse } = loadServices();
  const input = { file: { name: '123/UTP/BDG/X/2026.pdf', size: 0 }, overrideProjectId: 'PRJ-CKR' };
  assert.equal(parse(input, []).documentNumber, '');
  const result = parse({ ...input, extractedText: 'Nomor: 045/utp/ckr/X/2026\nUsulan tenaga kerja.' }, []);
  assert.equal(result.documentNumber, '045/utp/ckr/X/2026');
  assert.ok(result.facts.find(f => f.key === 'nomor_dokumen').pageOrLocation.includes('karakter 7'));
  assert.equal(result.facts.find(f => f.key === 'proyek_dipilih').sourceType, 'KOREKSI_USER');
  assert.equal(result.manpowerDetails, undefined);
});

test('unknown numbers and matching filenames do not merge separate memories', () => {
  const { parse, storage, saved } = loadServices();
  const makeDoc = (id, number = '') => ({
    ...parse({ file: { name: 'scan.pdf', size: 1024 }, overrideProjectId: 'PRJ-CKR' }, []),
    id, documentNumber: number, kanbanStatus: 'AKTIF', files: [{ id: 'file-' + id, fileName: 'scan.pdf' }],
    activityLog: [], relations: [], isArchived: false
  });
  const docs = [makeDoc('new-a'), makeDoc('new-b'), makeDoc('new-c', '045/UTP/CKR/X/2026'), makeDoc('new-d', '045/UTP/CKR/X/2026')];
  docs.forEach(d => storage.createDocument(d));
  docs.forEach(d => assert.equal(storage.getDocumentById(d.id).files.length, 1));
  const persisted = JSON.parse(saved.get('utp_project_memory_docs_v1'));
  assert.equal(persisted.filter(d => d.id.startsWith('new-')).length, 4);
  const revision = { ...docs[0], files: [{ id: 'revision-a', fileName: 'scan.pdf' }] };
  storage.createDocument(revision);
  storage.createDocument(revision);
  assert.equal(storage.getDocumentById('new-a').files.length, 2);
  storage.toggleArchive('new-a');
  assert.ok(!storage.getDocuments('PRJ-CKR').some(d => d.id === 'new-a'));
  storage.toggleArchive('new-a');
  assert.ok(storage.getDocuments('PRJ-CKR').some(d => d.id === 'new-a'));
  const correction = [{ key: 'jumlah', value: '2', sourceType: 'KOREKSI_USER' }];
  storage.updateDocumentFacts('new-a', correction, 'Dikonfirmasi pengguna');
  assert.equal(storage.getDocumentById('new-a').facts[0].sourceType, 'KOREKSI_USER');
  assert.equal(storage.getDocumentById('new-b').documentNumber, '');
});
