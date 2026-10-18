const test = require('node:test');
const assert = require('node:assert/strict');
const domain = require('../aplikasi/material/UtpDomain.gs');

function draft(overrides = {}) {
  return Object.assign({ itemContractVersion: 1, status: 'DRAFT', initialSnapshot: null,
    revision: 1, revisions: [], files: [], arrived: false, title: 'Material',
    number: '', date: '2026-10-18', note: '', items: [item()] }, overrides);
}
function item(overrides = {}) {
  return Object.assign({ id: 'i-1', code: '', name: 'Pasir', brand: '', model: '', unit: 'm3',
    quantity: 2, group: '', family: '', classification: 'UNKNOWN', isTemporary: true,
    requiredAuthority: 'HO', decisions: { PM: { status: 'PENDING' }, MK: { status: 'PENDING' }, HO: { status: 'PENDING' } },
    exceptionReason: '', note: '', finalFileId: '', supplyConfirmed: false }, overrides);
}
test('unknown brands can save without approval or exception; no legacy approval inherited', () => {
  for (const brand of ['', null, '   ', 'Acme']) {
    const result = domain.validateMaterialDraft(draft({ items: [item({ brand, approvalId: 'stale' })] }));
    assert.equal(result.items[0].classification, 'UNKNOWN');
    assert.equal(result.items[0].exceptionReason, '');
    assert.equal(result.items[0].approvalId, undefined);
  }
});
test('generic must be explicit and unbranded; branded must have a brand', () => {
  assert.equal(domain.validateMaterialDraft(draft({ items: [item({ classification: 'GENERIC' })] })).items[0].classification, 'GENERIC');
  assert.throws(() => domain.validateMaterialDraft(draft({ items: [item({ classification: 'GENERIC', brand: 'Acme' })] })), /Merek/);
  assert.throws(() => domain.validateMaterialDraft(draft({ items: [item({ classification: 'BRANDED' })] })), /Merek/);
  assert.throws(() => domain.validateMaterialDraft(draft({ items: [item({ classification: '' })] })), /Klasifikasi/);
});
test('owner and other require empty approval authority and still no arrival', () => {
  for (const classification of ['OWNER', 'OTHER']) {
    const result = domain.validateMaterialDraft(draft({ items: [item({ classification, requiredAuthority: '' })] }));
    assert.equal(result.items[0].supplyConfirmed, false);
    assert.throws(() => domain.validateMaterialDraft(draft({ items: [item({ classification })] })), /jalur/);
  }
  assert.throws(() => domain.validateMaterialDraft(draft({ items: [item({ requiredAuthority: '' })] })), /Jalur/);
});
test('reject decisions and workflow injection', () => {
  for (const status of ['APPROVED', 'REJECTED', 'DEFERRED', 'OWNER']) {
    const row = item(); row.decisions.HO.status = status;
    assert.throws(() => domain.validateMaterialDraft(draft({ items: [row] })), /PENDING/);
  }
  const row = item(); row.decisions.HO.note = 'Sudah direview';
  assert.throws(() => domain.validateMaterialDraft(draft({ items: [row] })), /PENDING/);
  for (const change of [{ status: 'HO' }, { revision: 2 }, { initialSnapshot: {} }, { revisions: [{}] }, { files: [{}] }, { arrived: true }]) {
    assert.throws(() => domain.validateMaterialDraft(draft(change)));
  }
  for (const change of [{ finalFileId: 'file-1' }, { supplyConfirmed: true }, { status: 'APPROVED' }]) {
    assert.throws(() => domain.validateMaterialDraft(draft({ items: [item(change)] })));
  }
});
test('legacy and already submitted records cannot be updated through draft API', () => {
  for (const existing of [{ status: 'DRAFT' }, draft({ status: 'PM' }), draft({ initialSnapshot: {} })]) {
    assert.throws(() => domain.validateMaterialDraft(draft(), existing), /kontrak item v1/);
  }
});
test('save then reload preserves complete normalized item contract without client history', () => {
  const input = draft({ title: '  Material baru  ', history: [{ action: 'FAKE' }], items: [item({ name: ' Pasir ', quantity: '2.5', note: ' catatan ' })] });
  const saved = domain.validateMaterialDraft(input);
  const reloaded = domain.validateMaterialDraft(JSON.parse(JSON.stringify(saved)), saved);
  assert.deepEqual(reloaded, saved);
  assert.equal(saved.items[0].quantity, 2.5);
  assert.equal(saved.items[0].note, 'catatan');
  assert.equal(saved.history, undefined);
  assert.equal(saved.title, 'Material baru');
  assert.throws(() => domain.validateMaterialDraft(draft({ title: 'x'.repeat(301) })), /terlalu panjang/);
  assert.throws(() => domain.validateMaterialDraft(draft({ items: [] })), /minimal/);
  assert.throws(() => domain.validateMaterialDraft(draft({ date: '2026-02-29' })), /tidak valid/);
  assert.throws(() => domain.validateMaterialDraft(draft({ items: [item(), item()] })), /duplikat/);
});
