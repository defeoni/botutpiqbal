const test = require('node:test');
const assert = require('node:assert/strict');
const domain = require('../utp/UtpDomain.gs');

const now = '2026-10-16T08:00:00.000Z';
const approved = { id: 'ap-1', material: 'Pipa PVC', brand: 'Rucika', types: ['AW'], authority: 'PM', status: 'APPROVED' };
const item = (overrides = {}) => ({ id: 'i-1', code: '0010', name: 'Pipa PVC 20 mm', brand: 'Rucika', model: 'AW', unit: 'batang', quantity: 10, status: 'PENDING', ...overrides });
const context = (overrides = {}) => ({ now, actor: 'PM', approvals: [approved], ...overrides });
const request = (overrides = {}) => ({ number: 'REQ-001', title: 'Pipa lantai 1', date: '2026-10-16', authority: 'PM', requiredAuthority: 'PM', status: 'DRAFT', revision: 0, revisions: [], history: [], items: [item()], ...overrides });

test('calendar validation rejects impossible dates and accepts leap day', () => {
  assert.equal(domain.date('2024-02-29', 'Tanggal', true), '2024-02-29');
  for (const value of ['2026-02-29', '2026-04-31', '2026-13-01', '16/10/2026', '']) assert.throws(() => domain.date(value, 'Tanggal', true));
  assert.equal(domain.date('', 'Tanggal', false), '');
});

test('quantities reject coercion, infinity, zero, negative and ambiguous formatted amounts', () => {
  for (const value of ['', null, true, [], {}, '1,000', '1e3', 0, -1, Infinity, NaN]) assert.throws(() => domain.number(value, 'Jumlah', 0, false));
  assert.equal(domain.number('0.25', 'Jumlah', 0, false), 0.25);
  assert.equal(domain.number(0, 'Kapasitas', 0, true), 0);
});

test('approval matches material, exact normalized brand and model, and active status', () => {
  assert.equal(domain.approvalMatches(item({ brand: ' RUCiKA ' }), approved), true);
  assert.equal(domain.approvalMatches(item({ brand: 'Rucika lain' }), approved), false);
  assert.equal(domain.approvalMatches(item({ model: 'D' }), approved), false);
  assert.equal(domain.approvalMatches(item({ name: 'Kabel NYY' }), approved), false);
  assert.equal(domain.approvalMatches(item(), { ...approved, archived: true }), false);
  assert.equal(domain.approvalMatches(item(), { ...approved, status: 'COMPARE' }), false);
  assert.equal(domain.approvalMatches(item(), { ...approved, brand: 'Wavin; Rucika' }), true);
});

test('generic approval has no brand and does not silently approve branded material', () => {
  const generic = domain.validate('approvals', { material: 'Pasir', brand: 'Old Brand', generic: true, status: 'APPROVED' });
  assert.equal(generic.brand, '');
  assert.equal(domain.approvalMatches(item({ name: 'Pasir', brand: '', model: '' }), generic), true);
  assert.equal(domain.approvalMatches(item({ name: 'Pasir', brand: 'Brand', model: '' }), generic), false);
  assert.throws(() => domain.validate('approvals', { material: 'Pipa', brand: '', status: 'approved' }), /Merek/);
});

test('unapproved selections need a reason; OWNER selections are explicitly exempt', () => {
  assert.throws(() => domain.requestItems([item({ brand: 'Other' })], context()), /alasan pengecualian/);
  const withReason = domain.requestItems([item({ brand: 'Other', exceptionReason: 'Usulan pengganti', exceptionApprovedBy: 'HO' })], context())[0];
  assert.match(withReason.approvalWarning, /Belum sesuai/);
  assert.equal(withReason.exceptionApprovedBy, 'HO');
  assert.equal(domain.requestItems([item({ brand: '', status: 'OWNER' })], context())[0].approvalWarning, '');
  assert.equal(domain.requestItems([item()], context())[0].approvalAuthority, 'PM');
});

test('request item identities reject duplicates and accept prototype-shaped opaque IDs', () => {
  assert.throws(() => domain.requestItems([item(), item()], context()), /duplikat/);
  assert.equal(domain.requestItems([item({ id: '__proto__' }), item({ id: 'constructor' })], context()).length, 2);
  assert.throws(() => domain.requestItems([null], context()), /tidak valid/);
});

test('saving an empty or edited draft does not freeze initial submission or increment revision', () => {
  let draft = domain.validate('requests', request({ items: [] }), null, context());
  draft = domain.recordRequestSave(draft, null, now, 'Operator');
  assert.equal(draft.initialSnapshot, null);
  const changed = domain.validate('requests', { ...draft, items: [item()], revision: 99 }, draft, context());
  domain.recordRequestSave(changed, draft, now, 'Operator');
  assert.equal(changed.revision, 0);
  assert.equal(changed.initialSnapshot, null);
  const submitted = domain.transition(changed, 'PM', context());
  assert.equal(submitted.initialSnapshot.items[0].quantity, 10);
  assert.equal(submitted.initialSnapshot.submittedAt, now);
  submitted.items[0].quantity = 15;
  assert.equal(submitted.initialSnapshot.items[0].quantity, 10);
});

test('per-item history retains old/new values, additions, deletions and stable IDs', () => {
  const before = [item(), item({ id: 'removed', code: '0020' })];
  const after = [item({ quantity: 12, brand: 'Wavin', status: 'APPROVED' }), item({ id: 'new', code: '0030' })];
  const diffs = domain.itemChanges(before, after);
  assert.deepEqual(diffs.find(x => x.itemId === 'i-1' && x.field === 'quantity'), { itemId: 'i-1', code: '0010', field: 'quantity', oldValue: 10, newValue: 12 });
  assert.equal(diffs.find(x => x.field === 'brand').oldValue, 'Rucika');
  assert.equal(diffs.find(x => x.itemId === 'removed').newValue, null);
  assert.equal(diffs.find(x => x.itemId === 'new').oldValue, null);
  assert.equal(domain.itemChanges([item({ id: '__proto__' })], [item({ id: '__proto__', quantity: 11 })])[0].newValue, 11);
});

test('PM-only and MK review scopes can finalize without an invented HO step', () => {
  const pm = request({ status: 'PM', items: [item({ status: 'APPROVED' })] });
  assert.equal(domain.transition(pm, 'FINAL', context()).status, 'FINAL');
  const mk = request({ status: 'MK', authority: 'MK', requiredAuthority: 'MK', items: [item({ status: 'APPROVED' })] });
  assert.equal(domain.transition(mk, 'FINAL', context()).status, 'FINAL');
  assert.throws(() => domain.transition({ ...pm, requiredAuthority: 'MK' }, 'FINAL', context()), /review MK/);
});

test('HO final evidence persists through arrival without being inferred for PM/owner paths', () => {
  const pmOwner = request({ status: 'PM', items: [item({ status: 'OWNER' })] });
  const pmFinal = domain.transition(pmOwner, 'FINAL', context());
  assert.equal(domain.transition(pmFinal, 'ARRIVED', context()).status, 'ARRIVED');
  const hoOwner = request({ status: 'HO', authority: 'HO', items: [item({ status: 'OWNER' })] });
  const hoFinal = domain.transition(hoOwner, 'FINAL', context({ validFinalEvidence: true }));
  assert.throws(() => domain.transition(hoFinal, 'ARRIVED', context()), /bukti/);
  assert.equal(domain.transition(hoFinal, 'ARRIVED', context({ validFinalEvidence: true })).status, 'ARRIVED');
});

test('HO final requires uploaded evidence even after returning to PM; partial approval is retained', () => {
  const ho = request({ status: 'HO', authority: 'HO', requiredAuthority: 'HO', items: [item({ status: 'APPROVED' }), item({ id: 'i-2', status: 'DEFERRED' })] });
  assert.throws(() => domain.transition(ho, 'FINAL', context()), /bukti/);
  const final = domain.transition(ho, 'FINAL', context({ validFinalEvidence: true }));
  assert.equal(final.items.length, 2);
  assert.equal(final.items[1].status, 'DEFERRED');
  let pm = request({ status: 'HO', authority: 'HO', requiredAuthority: 'PM', items: [item({ status: 'APPROVED' })] });
  pm = domain.transition(pm, 'PM', context());
  assert.throws(() => domain.transition(pm, 'FINAL', context()), /bukti/);
});

test('all rejected requests may be cancelled but cannot become a fake final', () => {
  const rejected = request({ status: 'HO', authority: 'HO', items: [item({ status: 'REJECTED' })] });
  assert.throws(() => domain.transition(rejected, 'FINAL', context({ validFinalEvidence: true })), /minimal satu item/);
  assert.equal(domain.transition(rejected, 'CANCELLED', context()).status, 'CANCELLED');
});

test('scope cannot be lowered after submission and ordinary saves cannot change workflow status', () => {
  const submitted = domain.transition(request({ requiredAuthority: 'HO' }), 'PM', context());
  assert.throws(() => domain.validate('requests', { ...submitted, requiredAuthority: 'PM' }, submitted, context()), /tidak boleh diturunkan/);
  assert.throws(() => domain.validate('requests', { ...submitted, status: 'FINAL' }, submitted, context()), /tindakan proses/);
});

test('explicit published revisions require PM/MK/HO actor and note and store independent snapshots', () => {
  const original = request({ items: [item({ status: 'APPROVED' })] });
  assert.throws(() => domain.publishRevision(original, context({ actor: 'Admin', note: 'Perubahan jumlah' })), /Penerbit revisi/);
  assert.throws(() => domain.publishRevision(original, context({ note: '' })), /Alasan revisi/);
  const revised = domain.publishRevision(original, context({ actor: 'MK', note: 'Penyesuaian lapangan' }));
  assert.equal(original.revision, 0);
  assert.equal(revised.revision, 1);
  assert.equal(revised.revisions[0].actor, 'MK');
  revised.items[0].quantity = 99;
  assert.equal(revised.revisions[0].snapshot.items[0].quantity, 10);
  const saved = domain.validate('requests', revised, revised, context());
  assert.equal(saved.revision, 1);
  assert.equal(domain.publishRevision(saved, context({ actor: 'HO', note: 'Revisi akhir' })).revision, 2);
});

test('CSV parser preserves leading zeros, quoted punctuation, quotes and embedded line breaks', () => {
  const parsed = domain.parseCsv('\ufeffcode,name,brand\r\n0010,"Pipa, \"\"AW\"\"\n20 mm",Rucika\r\n');
  assert.deepEqual(parsed.rows[0], ['0010', 'Pipa, "AW"\n20 mm', 'Rucika']);
  assert.throws(() => domain.parseCsv('code,name\n1,"open'), /belum ditutup/);
  assert.throws(() => domain.parseCsv('code,name,name\n1,a,b'), /duplikat/);
});

test('incremental import preserves raw names and omitted fields, and reports changed values', () => {
  const existing = [{ code: '0010', name: 'Old', brand: 'Rucika', unit: 'btg', favorite: true }, { code: '0020', name: 'Other' }];
  const plan = domain.previewImport('code,name\n0010,"  Pipa  PVC  "\n0030,"=SUM(1,2)"', existing);
  assert.equal(plan.invalid.length, 0);
  assert.equal(plan.updated, 1);
  assert.equal(plan.added, 1);
  assert.equal(plan.items[0].code, '0010');
  assert.equal(plan.items[0].name, '  Pipa  PVC  ');
  assert.equal(plan.items[0].brand, 'Rucika');
  assert.equal(plan.items[0].favorite, true);
  assert.equal(plan.items[1].name, '=SUM(1,2)');
  assert.equal(existing[0].name, 'Old');
  assert.equal(plan.sample[0].diffs.find(x => x.field === 'name').oldValue, 'Old');
});

test('CSV codes named __proto__, constructor and toString do not collide with object prototypes', () => {
  const plan = domain.previewImport('code,name\n__proto__,A\nconstructor,B\ntoString,C', []);
  assert.equal(plan.invalid.length, 0);
  assert.equal(plan.added, 3);
  const updated = domain.previewImport('code,name\n__proto__,Changed', plan.items);
  assert.equal(updated.updated, 1);
  assert.equal(updated.items[0].name, 'Changed');
  assert.equal(domain.previewImport('code,name\n1,A\n1,B', []).invalid.length, 1);
});

test('search requires all terms, ranks approved before favorites, filters and caps at 50', () => {
  const rows = Array.from({ length: 65 }, (_, i) => ({ ...item({ code: String(i).padStart(4, '0'), name: 'Pipa PVC 20 mm', brand: i === 50 ? 'Rucika' : 'Other' }), favorite: i === 0 }));
  const result = domain.searchItems(rows, { query: 'pVc 20', limit: 1000 }, [approved]);
  assert.equal(result.total, 65);
  assert.equal(result.items.length, 50);
  assert.equal(result.items[0].code, '0050');
  assert.equal(result.items[1].code, '0000');
  assert.equal(domain.searchItems(rows, { query: 'PVC nonexistent' }, [approved]).total, 0);
  assert.equal(domain.searchItems(rows, { approvedOnly: true }, [approved]).total, 1);
  assert.equal(domain.searchItems(rows, { brand: 'rucika' }, [approved]).total, 1);
});

test('purchases validate order/receipt chronology', () => {
  assert.throws(() => domain.validate('purchases', { item: 'Pasir', quantity: 5, unit: 'm3', orderDate: '2026-10-16', receivedDate: '2026-10-15' }), /sebelum/);
});

test('forecast needs three distinct order days and describes ordering rather than actual use', () => {
  const rows = [{ item: 'Pasir', unit: 'm3', quantity: 10, orderDate: '2026-10-01' }, { item: 'Pasir', unit: 'm3', quantity: 20, orderDate: '2026-10-01' }, { item: 'Pasir', unit: 'm3', quantity: 20, orderDate: '2026-10-08' }];
  const insufficient = domain.forecast(rows)[0];
  assert.equal(insufficient.sampleCount, 2);
  assert.equal(insufficient.confidence, 'INSUFFICIENT');
  assert.equal(insufficient.nextOrderDate, '');
  const forecast = domain.forecast([...rows, { item: 'Pasir', unit: 'm3', quantity: 25, orderDate: '2026-10-15' }])[0];
  assert.equal(forecast.basis, 'ORDERING');
  assert.equal(forecast.averageIntervalDays, 7);
  assert.equal(forecast.medianIntervalDays, 7);
  assert.equal(forecast.nextOrderDate, '2026-10-22');
  assert.equal(forecast.projectedQuantity, 25);
  assert.deepEqual(forecast.quantityRange, [20, 30]);
  assert.match(forecast.warning, /bukan interval kepercayaan/);
});

test('irregular order intervals downgrade confidence and different units do not merge', () => {
  const rows = ['2026-01-01', '2026-01-02', '2026-01-03', '2026-01-04', '2026-04-01'].map(orderDate => ({ item: 'Pasir', unit: 'm3', quantity: 10, orderDate }));
  const forecast = domain.forecast(rows)[0];
  assert.equal(forecast.confidence, 'LOW');
  assert.match(forecast.warning, /tidak teratur/);
  assert.equal(domain.forecast([...rows, { ...rows[0], unit: 'sak' }]).length, 2);
});

test('finance excludes unconfirmed, archived and unlinked receipts and all material categories', () => {
  const funds = [{ id: 'f-1', amount: 1000 }, { id: 'archived', amount: 500, archived: true }];
  const receipts = [{ total: 100, status: 'CONFIRMED', fundId: 'f-1' }, { total: 100, status: 'REVIEW', fundId: 'f-1' }, { total: 100, status: 'CONFIRMED', fundId: 'f-1', archived: true }, { total: 100, status: 'CONFIRMED', fundId: '__proto__' }, { total: 100, status: 'CONFIRMED', fundId: 'archived' }];
  assert.deepEqual(domain.finance(funds, receipts), { funds: 1000, spent: 100, balance: 900 });
  assert.throws(() => domain.validate('receipts', { date: '2026-10-16', vendor: 'Toko', total: 100, category: 'Pembelian material', status: 'REVIEW' }), /material/);
  assert.throws(() => domain.validate('receipts', { date: '2026-10-16', vendor: 'Warung', total: 100, category: 'Konsumsi', status: 'CONFIRMED' }), /Sumber dana/);
});

test('uploaded document identity and trusted metadata cannot be spoofed through the edit form', () => {
  const old = { name: 'Evidence.docx', fileId: 'file-1', mime: 'application/msword', url: 'https://drive.google.com/file-1', uploadedByUtp: true, digest: 'digest', size: 100 };
  assert.throws(() => domain.validate('documents', { ...old, fileId: 'other' }, old), /tidak boleh diganti/);
  const updated = domain.validate('documents', { ...old, mime: 'application/pdf', url: 'https://evil.example', digest: 'changed' }, old);
  assert.equal(updated.mime, old.mime);
  assert.equal(updated.url, old.url);
  assert.equal(updated.digest, old.digest);
  assert.equal(domain.validate('documents', { ...old }, null).uploadedByUtp, false);
});
