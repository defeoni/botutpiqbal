const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = (name) => fs.readFileSync(path.join(__dirname, '..', 'aplikasi', name), 'utf8');
const clone = (value) => JSON.parse(JSON.stringify(value));
const P1 = 'proj-alpha-0001', P2 = 'proj-beta-0002', MONTH = '2026-10';

function fixture() {
  const rows = {
    workspaceProjects: [
      { id: P1, code: 'ALPHA', name: 'Proyek Alpha' },
      { id: P2, code: 'BETA', name: 'Proyek Beta' }
    ],
    workspaceRpd: [],
    rpb: [],
    workspaceLpd: [],
    workspaceLpdAudit: [],
    workspaceRpbTranches: [],
    workspaceRpdFinance: []
  };
  let sequence = 0, locked = false;
  const context = {
    Date, Intl, console,
    requireAuthorized_(token) { if (token !== 'owner') throw new Error('Unauthorized'); },
    requireDeletePin_(pin) { if (pin !== 'valid') throw new Error('PIN salah'); },
    Utilities: {
      DigestAlgorithm:{SHA_256:'sha256'},
      computeDigest(_algorithm,value){return Array.from(require('node:crypto').createHash('sha256').update(value).digest());},
      base64Encode(value){return Buffer.from(value).toString('base64');},
      getUuid() { sequence++; return 'server-uuid-' + String(sequence).padStart(4, '0'); },
      formatDate() { return '2026-10-21'; }
    },
    LockService: {
      getScriptLock() {
        return { waitLock() { locked = true; }, releaseLock() { locked = false; } };
      }
    },
    utpRead_(entity) {
      return (rows[entity] || []).filter((row) => !row.archived).map(clone);
    },
    utpGet_(entity, id) {
      const found = (rows[entity] || []).find((row) => row.id === id);
      return found ? clone(found) : null;
    },
    utpWrite_(entity, record, version) {
      assert.equal(locked, true, 'setiap tulis LPD harus di dalam lock');
      const list = rows[entity] || (rows[entity] = []);
      const previous = list.find((row) => row.id === record.id);
      if (previous && previous.version !== Number(version)) throw new Error('Data berubah di sesi lain.');
      if (!previous && Number(version) !== 0) throw new Error('Versi awal tidak valid.');
      record.version = previous ? previous.version + 1 : 1;
      record.createdAt = previous ? previous.createdAt : '2026-10-21T00:00:00Z';
      record.updatedAt = '2026-10-21T00:00:00Z';
      const index = list.findIndex((row) => row.id === record.id);
      if (index < 0) list.push(clone(record)); else list[index] = clone(record);
      return clone(record);
    },
    getRpbHistory_(projectId) {
      return rows.rpb.filter((row) => !row.deletedAt && (!projectId || (row.data || {}).projectId === projectId)).map(clone);
    },
    getArchiveRootFolder_: () => ({}),
    getOrCreateArchiveSubfolder_: () => ({}),
    DriveApp: { getFileById: () => ({ moveTo() {} }) },
    utpUpload_(payload) {
      context.uploaded.push(payload);
      return { id: 'drive-file-1', url: 'https://drive.google.com/file/d/drive-file-1', name: payload.name, mime: payload.mime };
    },
    uploaded: []
  };
  vm.createContext(context);
  ['UtpDomain.gs', 'Workspace.gs', 'Projects.gs', 'SistemDrive.gs', 'LPD.gs', 'LpdDocuments.gs'].forEach((name) => {
    vm.runInContext(source(name), context);
  });
  return { c: context, rows };
}

function addRpb(env, id, projectId, m1, m2) {
  env.rows.rpb.push({
    id, number: 'RPB ' + id, revision: 1, status: 'Diajukan',
    requestDate: MONTH + '-10',
    data: {
      projectId,
      requestDate: MONTH + '-10',
      items: [
        { week: 'M1-M2', quantity: 1, unitPrice: m1 },
        { week: 'M3-M4', quantity: 1, unitPrice: m2 }
      ]
    }
  });
}

function addRpd(env, id, projectId, total, purpose) {
  env.rows.workspaceRpd.push({
    id, projectId, purpose, date: MONTH + '-05', total,
    status: 'SUBMITTED', recipient: 'Vendor', archived: false
  });
}

function finance(env, id) {
  return env.rows.workspaceRpdFinance.find((row) => row.id === id);
}

function enroll(env, projectId, id, period) {
  return env.c.apiLpd('rpdEnroll', {
    projectId, rpdId: id, month: MONTH, period: period || 'M1-M2', pin: 'valid'
  }, 'owner');
}

function disburseRpd(env, projectId, id) {
  const row = finance(env, id);
  return env.c.apiLpd('rpdDisburse', {
    projectId, rpdId: id, version: row.version, amount: row.amount, pin: 'valid'
  }, 'owner');
}

function disburseTranche(env, projectId, rpbId, period, amount, version) {
  const existing = env.rows.workspaceRpbTranches.find((row) => row.rpbId === rpbId && row.period === period);
  return env.c.apiLpd('rpbTrancheDisburse', {
    projectId, rpbId, period, amount,
    version: version == null ? (existing ? existing.version : 0) : version,
    pin: 'valid'
  }, 'owner');
}

function nota(amount, id) {
  return { id: id || 'nota-0001', date: MONTH + '-05', description: 'Nota uji', amount, items: [], attachments: [{name:'Bukti uji',url:'https://drive.google.com/file/d/proof-test',mime:'image/jpeg'}] };
}

function draft(env, projectId, overrides) {
  const record = Object.assign({
    projectId, month: MONTH, period: 'M1-M2', rpbId: '', rpdIds: [], realisasi: [], note: ''
  }, overrides || {});
  return env.c.apiLpd('saveDraft', { projectId, record, actor: 'Penguji' }, 'owner');
}

function detail(env, projectId, id) {
  return env.c.apiLpd('detail', { projectId, id }, 'owner');
}

function send(env, projectId, record) {
  return env.c.apiLpd('send', {
    projectId, id: record.id, version: record.version, pin: 'valid', note: 'Kirim uji'
  }, 'owner');
}

test('deadline LPD manual, dapat diubah dan dikosongkan tanpa tenggat otomatis',()=>{
  const e=fixture();let r=draft(e,P1).record;assert.equal(r.deadline.due,'');assert.equal(e.c.lpdDeadlineState_(r).late,false);
  r=e.c.apiLpd('setDeadline',{projectId:P1,id:r.id,version:r.version,deadline:'2026-10-25'},'owner').record;assert.equal(r.deadline.due,'2026-10-25');
  r=e.c.apiLpd('setDeadline',{projectId:P1,id:r.id,version:r.version,deadline:''},'owner').record;assert.equal(r.deadline.due,'');assert.equal(r.deadline.history.length,2);
});
test('LPD khusus RPD tidak wajib RPB dan beberapa LPD diperbolehkan dalam periode yang sama',()=>{
  const e=fixture();for(const id of ['rpd-one-001','rpd-two-002']){addRpd(e,id,P1,100,'Operasional');enroll(e,P1,id);disburseRpd(e,P1,id);}
  const a=draft(e,P1,{rpdIds:['rpd-one-001'],realisasi:[nota(100,'nota-one-001')]});
  const b=draft(e,P1,{rpdIds:['rpd-two-002'],realisasi:[nota(100,'nota-two-002')]});
  assert.notEqual(a.record.id,b.record.id);assert.equal(send(e,P1,a.record).record.status,'SENT');assert.equal(send(e,P1,b.record).record.status,'SENT');
});
test('nota inbox dipakai utuh satu LPD, label usage muncul dan penggunaan kedua ditolak',()=>{
  const e=fixture();e.rows.workspaceFinance=[{id:'inbox-nota-001',projectId:P1,version:1,name:'Nota toko',date:MONTH+'-05',fields:{amount:100},attachments:nota(100).attachments}];
  const line=Object.assign(nota(100),{financeId:'inbox-nota-001'});
  assert.throws(()=>draft(e,P1,{realisasi:[Object.assign({},line,{amount:50})]}),/utuh/);
  const saved=draft(e,P1,{realisasi:[line]});
  assert.equal(e.c.apiWorkspace('list',{module:'finance',projectId:P1},'owner').records[0].lpdUsage[0].id,saved.record.id);
  assert.throws(()=>draft(e,P1,{realisasi:[line]}),/LPD lain/);
  assert.throws(()=>draft(e,P2,{realisasi:[line]}),/LPD lain|proyek/);
  assert.throws(()=>e.c.apiWorkspace('delete',{module:'finance',id:'inbox-nota-001',version:1,pin:'valid'},'owner'),/sudah dipakai/);
  const result=e.c.apiLpd('notaList',{projectId:P1},'owner');assert.equal(result.records[0].available,false);
});
test('unggah dari LPD tercatat pada inbox dan retry create tidak menggandakan laporan',()=>{
  const e=fixture();e.c.workspaceProjectFolder_=()=>({});let saved=draft(e,P1).record;
  const uploaded=e.c.apiLpd('upload',{projectId:P1,lpdId:saved.id,notaId:'nota-upload-001',name:'nota.jpg',mime:'image/jpeg',base64:'eA=='},'owner');
  assert.equal(uploaded.financeId,'nota-upload-001');assert.equal(e.rows.workspaceFinance[0].attachments.length,1);
  const payload={clientRequestId:'request-once-001',projectId:P1,month:MONTH,period:'M1-M2',realisasi:[nota(200,'nota-retry-001')]};
  const a=e.c.apiLpd('saveDraft',{projectId:P1,record:payload},'owner'),b=e.c.apiLpd('saveDraft',{projectId:P1,record:payload},'owner');assert.equal(a.record.id,b.record.id);assert.equal(b.deduplicated,true);
  assert.throws(()=>e.c.apiLpd('saveDraft',{projectId:P1,record:{...payload,note:'different'}},'owner'),/isi berbeda/);
});
test('scan akhir terkait versi ekspor, idempotent dan tidak menghapus laporan sebelumnya',()=>{
  const e=fixture();e.c.workspaceProjectFolder_=()=>({});const r=draft(e,P1).record;
  e.rows.lpdExports=[{id:'export-signed-001',lpdId:r.id,projectId:P1,recordVersion:1}];
  const p={projectId:P1,id:r.id,version:r.version,exportId:'export-signed-001',requestId:'scan-request-001',name:'signed.pdf',mime:'application/pdf',base64:'eA=='};
  e.c.apiLpd('signedUpload',p,'owner');e.c.apiLpd('signedUpload',p,'owner');assert.equal(e.rows.lpdSignedArchives.length,1);assert.equal(e.c.uploaded.length,1);
  assert.equal(e.c.apiLpd('artifacts',{projectId:P1,id:r.id},'owner').signed[0].recordVersion,1);
  assert.throws(()=>e.c.apiLpd('signedUpload',{...p,projectId:P2},'owner'),/proyek/);
});
test('generator membagi 28 nota ke dua lembar dan mempertahankan semua rincian',()=>{
  const e=fixture(),r={projectId:P1,month:MONTH,realisasi:Array.from({length:28},(_,i)=>nota(i+1,'nota-'+String(i).padStart(6,'0')))};
  const options={transaction:'TR-01',rpd:'RPD-01',rpm:'RPM-01',documentDate:'2026-10-22',admin:'Admin',pic:'PM',manager:'HO'};
  const calc={totals:{danaTersedia:500,realisasi:406,saldo:94}};
  const a=e.c.lpdExportCells_(r,options,calc,0),b=e.c.lpdExportCells_(r,options,calc,1);
  assert.equal(a.G11,1);assert.equal(a.G37,27);assert.equal(b.G11,28);assert.equal(b.G12,'');assert.equal(b.G39,406);assert.equal(a.J4,'TR-01');
});
test('generator mempertahankan Spreadsheet jika PDF gagal dan retry tidak membuat laporan ganda',()=>{
  const e=fixture();addRpd(e,'rpd-export-001',P1,100,'Operasional');enroll(e,P1,'rpd-export-001');disburseRpd(e,P1,'rpd-export-001');
  const r=draft(e,P1,{rpdIds:['rpd-export-001'],realisasi:[nota(100,'nota-export-001')]}).record;
  let imports=0,status=500;const blob={getDataAsString:()=>'%PDF-test',setName(){return this;}};
  const range={setValue(){return this;},setWrap(){return this;}};
  const sheet={setName(){},getRange:()=>range,setHiddenGridlines(){},setRowHeight(){},getMaxRows:()=>48,getMaxColumns:()=>10};
  e.c.PropertiesService={getScriptProperties:()=>({getProperty:()=> 'template-empty-001'})};
  e.c.DriveApp={getFileById:()=>({isTrashed:()=>false,getBlob:()=>blob})};e.c.ScriptApp={getOAuthToken:()=> 'private'};
  e.c.workspaceProjectFolder_=()=>({createFile:()=>({getId:()=> 'pdf-001',getUrl:()=> 'https://drive.google.com/file/d/pdf-001'})});
  e.c.documentFillXlsx_=()=>blob;e.c.lpdImportSheet_=()=>{imports++;return {getSheets:()=>[sheet],getId:()=> 'sheet-001',getUrl:()=> 'https://docs.google.com/spreadsheets/d/sheet-001'};};
  e.c.SpreadsheetApp={flush(){}};e.c.UrlFetchApp={fetch:()=>({getResponseCode:()=>status,getBlob:()=>blob})};
  const p={projectId:P1,id:r.id,version:r.version,options:{department:'Project',section:'Lapangan',documentDate:'2026-10-22',admin:'Admin',pic:'PM',paper:'A4'}};
  const first=e.c.apiLpd('export',p,'owner');assert.match(first.warning,/PDF belum tersedia/);assert.ok(first.record.spreadsheetUrl);assert.equal(e.rows.lpdExports.length,1);
  status=200;const second=e.c.apiLpd('export',p,'owner');assert.ok(second.record.pdfUrl);assert.equal(imports,1);assert.equal(e.rows.lpdExports.length,1);
  e.c.apiLpd('export',p,'owner');assert.equal(imports,1);
});

test('deadline pengiriman LPD menggunakan tanggal Asia/Jakarta pada batas tengah malam', () => {
  const { c } = fixture();
  c.Utilities.formatDate = (date, zone, format) => {
    assert.equal(zone, 'Asia/Jakarta');
    assert.equal(format, 'yyyy-MM-dd');
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
    return ['year', 'month', 'day'].map(key => parts.find(part => part.type === key).value).join('-');
  };
  const base = { status: 'SENT', month: MONTH, period: 'M1-M2',deadline:{due:'2026-10-15'} };
  for (const [timestamp, expectedDate, late] of [
    ['2026-10-15T16:59:59.000Z', '2026-10-15', false],
    ['2026-10-15T17:00:00.000Z', '2026-10-16', true],
    ['2026-10-15T18:00:00.000Z', '2026-10-16', true]
  ]) {
    const state = c.lpdDeadlineState_(Object.assign({}, base, { firstSentAt: timestamp }));
    assert.equal(state.basis, expectedDate);
    assert.equal(state.late, late);
  }
});

test('draf tersimpan saat reservasi RPD gagal mengembalikan identitas dan dapat disimpan ulang', () => {
  const env = fixture();
  addRpd(env, 'rpd-retry-0001', P1, 100, 'Nota uji');
  enroll(env, P1, 'rpd-retry-0001');
  const write = env.c.utpWrite_;
  let fail = true;
  env.c.utpWrite_ = (entity, record, version) => {
    if (fail && entity === 'workspaceRpdFinance' && record.lpdId) throw new Error('Storage unavailable');
    return write(entity, record, version);
  };
  const partial = draft(env, P1, { rpdIds: ['rpd-retry-0001'] });
  assert.equal(partial.reservationPending, true);
  assert.equal(partial.record.version, 1);
  assert.match(partial.warnings.join(' '), /Storage unavailable/);
  assert.equal(env.rows.workspaceLpd.length, 1);
  fail = false;
  const retry = draft(env, P1, partial.record);
  assert.equal(retry.record.id, partial.record.id);
  assert.equal(retry.record.version, 2);
  assert.equal(retry.reservationPending, undefined);
  assert.equal(finance(env, 'rpd-retry-0001').lpdId, partial.record.id);
  assert.equal(env.rows.workspaceLpd.length, 1);
});

test('klien mempertahankan ID draf gagal parsial dan retry mengirim ID serta versi yang tersimpan', async () => {
  const text = source('LPDClient.html');
  const saveSource = text.slice(text.indexOf('  function saveDraft()'), text.indexOf('  function sendLpd()'));
  assert.ok(saveSource.includes('reservationPending'));
  const calls = [], messages = [];
  const record = { id: 'saved-lpd-001', version: 1, month: MONTH, period: 'M1-M2', rpbId: 'rpb-001' };
  const values = { lpdRpbSelect: 'rpb-001', lpdEditorMonth: MONTH, lpdEditorPeriod: 'M1-M2', lpdNote: '', lpdDeadline: '', lpdDeadlineReason: '' };
  let pending;
  const c = {
    uuid:()=> 'client-request-test-001',
    state: { busy: false, projectId: P1, notas: [{}], scopeTicket: 1, selectedRpdIds: [], record: null },
    get: id => ({ value: values[id] || '' }), notePayload: () => [],
    run: (label, task) => { pending = task(); },
    rpc: (action, payload) => { calls.push(clone(payload)); return Promise.resolve({ record, calculation: null, reservationPending: true, warnings: ['Reservasi belum berhasil'] }); },
    applyRecord: saved => { c.state.record = saved; c.state.dirty = false; },
    renderActionState: () => {},
    setStatus: (message, kind) => messages.push({ message, kind }),
    loadList: () => { throw new Error('Partial save must not be presented as a fully completed save'); }
  };
  vm.createContext(c);
  vm.runInContext(saveSource, c);
  c.saveDraft(); await pending;
  assert.equal(c.state.record.id, record.id);
  assert.equal(c.state.dirty, true);
  assert.equal(messages[0].kind, 'error');
  c.saveDraft(); await pending;
  assert.equal(calls[1].record.id, record.id);
  assert.equal(calls[1].record.version, 1);
});

test('LPD backend dan skrip halaman LPD dapat diparse tanpa error sintaks', () => {
  assert.doesNotThrow(() => new vm.Script(source('LPD.gs'), { filename: 'LPD.gs' }));
  const script = source('LPDClient.html').match(/<script>([\s\S]*?)<\/script>/);
  assert.ok(script, 'LPDClient memiliki elemen script');
  assert.doesNotThrow(() => new vm.Script(script[1], { filename: 'LPDClient.html' }));
  assert.match(source('LPDView.html'), /id="blank-LPD"/);
});

test('dana tersedia hanya dari tranche RPB cair dan RPD cair; RPD belum cair, validasi, dan konflik versi', () => {
  const env = fixture();
  addRpb(env, 'rpb-alpha-0001', P1, 1000, 500);
  addRpd(env, 'rpd-alpha-0001', P1, 700, 'Sewa alat');
  addRpd(env, 'rpd-alpha-0002', P1, 300, 'Transport');
  enroll(env, P1, 'rpd-alpha-0001');
  enroll(env, P1, 'rpd-alpha-0002');
  disburseRpd(env, P1, 'rpd-alpha-0002');

  let result = draft(env, P1, {
    rpbId: 'rpb-alpha-0001',
    rpdIds: ['rpd-alpha-0001', 'rpd-alpha-0002']
  });
  assert.equal(result.calculation.totals.trancheCair, 0);
  assert.equal(result.calculation.totals.rpdCair, 300);
  assert.equal(result.calculation.totals.danaTersedia, 300);
  assert.equal(result.calculation.rpdBelumCair.amount, 700);
  assert.equal(result.calculation.totals.saldo, 300);

  disburseTranche(env, P1, 'rpb-alpha-0001', 'M1-M2', 1000);
  result = detail(env, P1, result.record.id);
  assert.equal(result.calculation.totals.trancheCair, 1000);
  assert.equal(result.calculation.totals.rpdCair, 300);
  assert.equal(result.calculation.totals.danaTersedia, 1300);

  const updated = draft(env, P1, {
    id: result.record.id, version: result.record.version,
    rpbId: 'rpb-alpha-0001', rpdIds: ['rpd-alpha-0002'],
    realisasi: [nota(1100)]
  });
  assert.equal(updated.calculation.totals.danaTersedia, 1300);
  assert.equal(updated.calculation.totals.saldo, 200);
  assert.equal(finance(env, 'rpd-alpha-0001').lpdId, '');

  const before = detail(env, P1, updated.record.id);
  assert.throws(() => draft(env, P1, {
    id: before.record.id, version: before.record.version,
    rpbId: 'rpb-alpha-0001', month: '2026-13'
  }), /Bulan/);
  assert.throws(() => draft(env, P1, {
    id: before.record.id, version: before.record.version, period: 'M2-M3'
  }), /Periode/);
  assert.throws(() => draft(env, P1, {
    id: before.record.id, version: before.record.version,
    realisasi: [nota(1100, 'nota-0002')].map((row) => Object.assign(row, {
      attachments: Array.from({ length: 11 }, (_, index) => ({
        name: 'bukti-' + index + '.jpg', url: 'https://drive.google.com/file/d/x' + index, mime: 'image/jpeg'
      }))
    }))
  }), /10/);

  const conflict = send(env, P1, { id: before.record.id, version: before.record.version - 1 });
  assert.equal(conflict.conflict, true);
  assert.equal(detail(env, P1, before.record.id).record.status, 'DRAFT');
  assert.equal(detail(env, P1, before.record.id).record.version, before.record.version);
});

test('satu RPD tidak dapat direferensikan dua LPD', () => {
  const env = fixture();
  addRpb(env, 'rpb-alpha-0001', P1, 1000, 500);
  addRpd(env, 'rpd-alpha-0001', P1, 500, 'Sewa alat');
  enroll(env, P1, 'rpd-alpha-0001');
  const first = draft(env, P1, { rpbId: 'rpb-alpha-0001', rpdIds: ['rpd-alpha-0001'] });
  assert.equal(finance(env, 'rpd-alpha-0001').lpdId, first.record.id);

  assert.throws(() => draft(env, P1, {
    rpbId: 'rpb-alpha-0001', rpdIds: ['rpd-alpha-0001']
  }), /sudah digunakan/);
  assert.equal(finance(env, 'rpd-alpha-0001').lpdId, first.record.id);

  assert.throws(() => env.c.lpdReserveRpds_({
    id: 'lpd-other-0001', rpdIds: ['rpd-alpha-0001']
  }, 'Penguji'), /sudah direferensikan/);
  assert.equal(finance(env, 'rpd-alpha-0001').lpdId, first.record.id);
  assert.equal(env.rows.workspaceLpd.length, 1);
});

test('tranche M3-M4 diblokir sampai LPD M1-M2 pernah dikirim', () => {
  const env = fixture();
  addRpb(env, 'rpb-alpha-0001', P1, 1000, 500);
  disburseTranche(env, P1, 'rpb-alpha-0001', 'M1-M2', 1000);
  assert.throws(() => disburseTranche(env, P1, 'rpb-alpha-0001', 'M3-M4', 500), /M1-M2/);

  const saved = draft(env, P1, {
    rpbId: 'rpb-alpha-0001', period: 'M1-M2', realisasi: [nota(1000)]
  });
  send(env, P1, saved.record);
  const m3 = disburseTranche(env, P1, 'rpb-alpha-0001', 'M3-M4', 500);
  assert.equal(m3.record.status, 'DICAIRKAN');
  assert.equal(m3.record.amount, 500);
});

test('firstSentAt tetap, pengembalian penuh, pembayaran ganda dicegah, koreksi mempertahankan pembayaran', () => {
  const env = fixture();
  addRpb(env, 'rpb-alpha-0001', P1, 1000, 500);
  disburseTranche(env, P1, 'rpb-alpha-0001', 'M1-M2', 1000);
  let saved = draft(env, P1, { rpbId: 'rpb-alpha-0001', realisasi: [nota(800)] });
  saved = send(env, P1, saved.record);
  const firstSentAt = saved.record.firstSentAt;
  assert.ok(firstSentAt);

  assert.throws(() => env.c.apiLpd('recordRepayment', {
    projectId: P1, id: saved.record.id, version: saved.record.version, amount: 150, pin: 'valid'
  }, 'owner'), /penuh/);
  const repaid = env.c.apiLpd('recordRepayment', {
    projectId: P1, id: saved.record.id, version: saved.record.version, amount: 200, pin: 'valid'
  }, 'owner');
  assert.equal(repaid.record.repayment.status, 'LUNAS');
  assert.equal(repaid.record.repayment.amount, 200);
  assert.throws(() => env.c.apiLpd('recordRepayment', {
    projectId: P1, id: repaid.record.id, version: repaid.record.version, amount: 200, pin: 'valid'
  }, 'owner'), /Tidak ada pengembalian|sudah tercatat/);
  assert.throws(() => env.c.apiLpd('payCompanyObligation', {
    projectId: P1, id: repaid.record.id, version: repaid.record.version, amount: 1, pin: 'valid'
  }, 'owner'), /Tidak ada kewajiban/);

  const completed = env.c.apiLpd('complete', {
    projectId: P1, id: repaid.record.id, version: repaid.record.version, pin: 'valid'
  }, 'owner');
  assert.equal(completed.record.status, 'COMPLETE');
  assert.equal(completed.calculation.settlement.saldoAkhir, 0);

  const corrected = env.c.apiLpd('correct', {
    projectId: P1, id: completed.record.id, version: completed.record.version,
    pin: 'valid', reason: 'Realisasi dikoreksi'
  }, 'owner');
  assert.equal(corrected.record.status, 'DRAFT');
  assert.equal(corrected.record.repayment.amount, 200);
  assert.equal(corrected.record.firstSentAt, firstSentAt);

  saved = draft(env, P1, {
    id: corrected.record.id, version: corrected.record.version,
    rpbId: 'rpb-alpha-0001', realisasi: [nota(700)]
  });
  assert.equal(saved.record.repayment.amount, 200);
  assert.equal(saved.record.firstSentAt, firstSentAt);
  assert.equal(saved.calculation.settlement.pengembalianTerbuka, 100);

  const resent = send(env, P1, saved.record);
  assert.equal(resent.record.firstSentAt, firstSentAt);
  assert.ok(resent.record.sentAt);
  assert.throws(() => env.c.apiLpd('recordRepayment', {
    projectId: P1, id: resent.record.id, version: resent.record.version, amount: 100, pin: 'valid'
  }, 'owner'), /sudah tercatat/);
  assert.throws(() => env.c.apiLpd('complete', {
    projectId: P1, id: resent.record.id, version: resent.record.version, pin: 'valid'
  }, 'owner'), /pengembalian masih terbuka/);
});

test('RPD ditolak memindahkan kekurangan ke kewajiban perusahaan; pembayaran penuh dan penutupan LPD', () => {
  const env = fixture();
  addRpb(env, 'rpb-alpha-0001', P1, 1000, 500);
  addRpd(env, 'rpd-alpha-0001', P1, 400, 'Sewa alat');
  addRpd(env, 'rpd-alpha-0002', P1, 50, 'Parkir');
  disburseTranche(env, P1, 'rpb-alpha-0001', 'M1-M2', 1000);
  enroll(env, P1, 'rpd-alpha-0001');
  enroll(env, P1, 'rpd-alpha-0002');
  let saved = draft(env, P1, {
    rpbId: 'rpb-alpha-0001',
    rpdIds: ['rpd-alpha-0001', 'rpd-alpha-0002'],
    realisasi: [nota(1500)]
  });
  assert.equal(saved.calculation.reimbursement.total, 450);
  assert.equal(saved.calculation.reimbursement.companyObligation, 50);
  saved = send(env, P1, saved.record);

  const rejected = env.c.apiLpd('rpdSetStatus', {
    projectId: P1, rpdId: 'rpd-alpha-0002', version: finance(env, 'rpd-alpha-0002').version,
    status: 'DITOLAK', reason: 'Bukti parkir tidak sah', pin: 'valid'
  }, 'owner');
  assert.equal(rejected.record.status, 'DITOLAK');
  const afterReject = detail(env, P1, saved.record.id).calculation;
  assert.equal(afterReject.reimbursement.total, 400);
  assert.equal(afterReject.reimbursement.companyObligation, 100);
  assert.equal(afterReject.settlement.kewajibanPerusahaanTerbuka, 100);

  assert.throws(() => env.c.apiLpd('payCompanyObligation', {
    projectId: P1, id: saved.record.id, version: detail(env, P1, saved.record.id).record.version,
    amount: 50, pin: 'valid'
  }, 'owner'), /penuh/);
  const current = detail(env, P1, saved.record.id);
  const paid = env.c.apiLpd('payCompanyObligation', {
    projectId: P1, id: current.record.id, version: current.record.version, amount: 100, pin: 'valid'
  }, 'owner');
  assert.equal(paid.record.companyObligationPayment.amount, 100);
  assert.equal(paid.calculation.reimbursement.companyObligationOpen, 0);
  assert.throws(() => env.c.apiLpd('payCompanyObligation', {
    projectId: P1, id: paid.record.id, version: paid.record.version, amount: 100, pin: 'valid'
  }, 'owner'), /sudah dibayar/);

  disburseRpd(env, P1, 'rpd-alpha-0001');
  const ready = detail(env, P1, paid.record.id);
  assert.equal(ready.calculation.settlement.kewajibanPerusahaanTerbuka, 0);
  assert.equal(ready.calculation.settlement.saldoAkhir, 0);
  const completed = env.c.apiLpd('complete', {
    projectId: P1, id: ready.record.id, version: ready.record.version, pin: 'valid'
  }, 'owner');
  assert.equal(completed.record.status, 'COMPLETE');
  assert.equal(finance(env, 'rpd-alpha-0001').status, 'DITUTUP');
  assert.equal(finance(env, 'rpd-alpha-0001').closedByLpdId, completed.record.id);
});

test('RPD dibatalkan juga memindahkan kekurangan ke kewajiban perusahaan', () => {
  const env = fixture();
  addRpb(env, 'rpb-alpha-0001', P1, 1000, 500);
  addRpd(env, 'rpd-alpha-0001', P1, 200, 'BBM');
  disburseTranche(env, P1, 'rpb-alpha-0001', 'M1-M2', 1000);
  enroll(env, P1, 'rpd-alpha-0001');
  let saved = draft(env, P1, {
    rpbId: 'rpb-alpha-0001', rpdIds: ['rpd-alpha-0001'], realisasi: [nota(1200)]
  });
  assert.equal(saved.calculation.reimbursement.total, 200);
  assert.equal(saved.calculation.reimbursement.companyObligation, 0);
  saved = send(env, P1, saved.record);

  const cancelled = env.c.apiLpd('rpdSetStatus', {
    projectId: P1, rpdId: 'rpd-alpha-0001', version: finance(env, 'rpd-alpha-0001').version,
    status: 'DIBATALKAN', reason: 'RPD dibatalkan', pin: 'valid'
  }, 'owner');
  assert.equal(cancelled.record.status, 'DIBATALKAN');
  const after = detail(env, P1, saved.record.id).calculation;
  assert.equal(after.reimbursement.total, 0);
  assert.equal(after.reimbursement.companyObligation, 200);
  assert.equal(after.settlement.kewajibanPerusahaanTerbuka, 200);
});

test('semua endpoint LPD berbasis ID menolak record dari proyek lain', () => {
  const env = fixture();
  addRpb(env, 'rpb-alpha-0001', P1, 1000, 500);
  addRpd(env, 'rpd-alpha-0001', P1, 500, 'Sewa alat');
  enroll(env, P1, 'rpd-alpha-0001');
  const saved = draft(env, P1, { rpbId: 'rpb-alpha-0001', rpdIds: ['rpd-alpha-0001'] });
  const foreign = { projectId: P2, id: saved.record.id, version: saved.record.version, pin: 'valid' };

  for (const [action, payload] of [
    ['detail', foreign],
    ['calculate', foreign],
    ['audit', { projectId: P2, lpdId: saved.record.id }],
    ['send', foreign],
    ['correct', Object.assign({}, foreign, { reason: 'Pindah proyek' })],
    ['complete', foreign],
    ['recordRepayment', Object.assign({}, foreign, { amount: 1 })],
    ['payCompanyObligation', Object.assign({}, foreign, { amount: 1 })],
    ['setDeadline', Object.assign({}, foreign, { deadline: MONTH + '-15' })],
    ['upload', { projectId: P2, lpdId: saved.record.id, name: 'nota.pdf', mime: 'application/pdf', base64: 'eA==' }]
  ]) {
    assert.throws(() => env.c.apiLpd(action, payload, 'owner'), /bukan milik proyek/, action);
  }
  assert.throws(() => draft(env, P2, {
    id: saved.record.id, version: saved.record.version, rpbId: 'rpb-alpha-0001'
  }), /bukan milik proyek/);
  assert.throws(() => env.c.apiLpd('saveDraft', {
    record: { id: saved.record.id, version: saved.record.version }
  }, 'owner'), /Proyek/);
  assert.equal(env.c.uploaded.length, 0);

  const stored = detail(env, P1, saved.record.id);
  assert.equal(stored.record.status, 'DRAFT');
  assert.equal(stored.record.version, saved.record.version);
  assert.equal(finance(env, 'rpd-alpha-0001').lpdId, saved.record.id);

  for (const [action, payload] of [
    ['rpdSetAmount', { projectId: P2, rpdId: 'rpd-alpha-0001', version: finance(env, 'rpd-alpha-0001').version, amount: 1 }],
    ['rpdDisburse', { projectId: P2, rpdId: 'rpd-alpha-0001', version: finance(env, 'rpd-alpha-0001').version, amount: 500 }],
    ['rpdSetStatus', { projectId: P2, rpdId: 'rpd-alpha-0001', version: finance(env, 'rpd-alpha-0001').version, status: 'DITOLAK', reason: 'Uji' }],
    ['rpbTrancheSave', { projectId: P2, rpbId: 'rpb-alpha-0001', period: 'M1-M2', plannedAmount: 1 }],
    ['rpbTrancheDisburse', { projectId: P2, rpbId: 'rpb-alpha-0001', period: 'M1-M2', amount: 1000, version: 0 }],
    ['rpdEnroll', { projectId: P2, rpdId: 'rpd-alpha-0001', month: MONTH, period: 'M1-M2' }]
  ]) {
    assert.throws(() => env.c.apiLpd(action, Object.assign({ pin: 'valid' }, payload), 'owner'), /bukan milik proyek/, action);
  }
  assert.equal(finance(env, 'rpd-alpha-0001').status, 'DIAJUKAN');
  assert.equal(finance(env, 'rpd-alpha-0001').amount, 500);
  assert.equal(env.rows.workspaceRpbTranches.length, 1);
});

test('validasi tranche, lampiran, versi simpan, dan kewajiban projectId pada pendaftaran RPD', () => {
  const env = fixture();
  addRpb(env, 'rpb-alpha-0001', P1, 1000, 500);
  addRpd(env, 'rpd-alpha-0001', P1, 500, 'Sewa alat');
  assert.throws(() => env.c.apiLpd('rpdEnroll', {
    rpdId: 'rpd-alpha-0001', month: MONTH, period: 'M1-M2', pin: 'valid'
  }, 'owner'), /Proyek/);
  enroll(env, P1, 'rpd-alpha-0001');

  assert.throws(() => env.c.apiLpd('rpbTrancheSave', {
    projectId: P1, rpbId: 'rpb-alpha-0001', period: 'M1-M2', month: '2026-11',
    plannedAmount: 1000, pin: 'valid'
  }, 'owner'), /Bulan tranche/);

  const saved = draft(env, P1, { rpbId: 'rpb-alpha-0001', rpdIds: ['rpd-alpha-0001'] });
  let conflict = draft(env, P1, {
    id: saved.record.id, version: 0, rpbId: 'rpb-alpha-0001'
  });
  assert.equal(conflict.conflict, true);
  assert.equal(detail(env, P1, saved.record.id).record.version, saved.record.version);

  assert.throws(() => draft(env, P1, {
    id: saved.record.id, version: saved.record.version,
    realisasi: [nota(100, 'nota-0003')].map((row) => Object.assign(row, {
      attachments: Array.from({ length: 11 }, (_, index) => ({
        name: 'lampiran-' + index + '.pdf', url: 'https://drive.google.com/file/d/y' + index, mime: 'application/pdf'
      }))
    }))
  }), /10/);
  assert.equal(detail(env, P1, saved.record.id).record.version, saved.record.version);

  conflict = env.c.apiLpd('rpdSetAmount', {
    projectId: P1, rpdId: 'rpd-alpha-0001', version: 0, amount: 450, pin: 'valid'
  }, 'owner');
  assert.equal(conflict.conflict, true);
  assert.equal(finance(env, 'rpd-alpha-0001').amount, 500);
});

function projectClient() {
  const nodes = new Map();
  const events = [];
  const get = (id) => {
    if (!nodes.has(id)) {
      nodes.set(id, { textContent: '', value: '', hidden: false, replaceChildren() {}, add() {} });
    }
    return nodes.get(id);
  };
  const context = {
    window: {},
    document: {
      getElementById: get,
      querySelectorAll: () => [],
      addEventListener() {},
      dispatchEvent(event) { events.push(event); }
    },
    Option: function Option(text, value) { this.text = text; this.value = value; },
    CustomEvent: function CustomEvent(type, init) { this.type = type; this.detail = (init || {}).detail; },
    accessToken: '',
    invokeServer() {},
    confirm: () => true,
    console
  };
  vm.createContext(context);
  const script = source('ProjectsClient.html').match(/<script>([\s\S]*?)<\/script>/);
  assert.ok(script, 'ProjectsClient memiliki elemen script');
  vm.runInContext(script[1], context);
  return { c: context, get, events };
}

test('guard klien menolak pindah proyek saat LPD busy atau dirty', () => {
  const client = projectClient();
  const project = client.c.window.ProjectWorkspace;

  client.c.window.LPDWorkspace = { isBusy: () => true, isDirty: () => false };
  project.select(P2);
  assert.equal(project.getActiveId(), 'all');
  assert.match(client.get('projectScopeStatus').textContent, /Tunggu penyimpanan/);
  assert.equal(client.events.length, 0);

  client.c.window.LPDWorkspace = { isBusy: () => false, isDirty: () => true };
  client.c.confirm = () => false;
  project.select(P2);
  assert.equal(project.getActiveId(), 'all');
  assert.equal(client.events.length, 0);

  client.c.confirm = () => true;
  project.select(P2);
  assert.equal(project.getActiveId(), P2);
  assert.equal(client.events.length, 1);
  assert.equal(client.events[0].detail.projectId, P2);
});
