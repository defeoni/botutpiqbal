// Tes tanggal kalender & WIB untuk frontend Material (aplikasi/UtpClient.html).
// Memuat kode JavaScript NYATA dari UtpClient.html ke dalam sandbox vm — bukan salinan implementasi.
// Pola mengikuti pengujian/rpb-kontrak.test.js (node:test + node:assert/strict + node:vm).
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const workspace = path.resolve(__dirname, '..');
const clientSource = fs.readFileSync(path.join(workspace, 'aplikasi', 'UtpClient.html'), 'utf8');
const scriptMatch = clientSource.match(/<script>([\s\S]*?)<\/script>/);
assert.ok(scriptMatch, 'Elemen <script> pada UtpClient.html harus ada');
const clientScript = scriptMatch[1];

// Subclass Date bawaan Node supaya TZ proses dibaca ulang setiap panggilan
// (meniru browser yang berjalan pada timezone device berbeda; tanpa dependency baru).
const NativeDate = Date;
class ShimDate extends NativeDate {}

function loadClient({ preview = true, fixedNow } = {}) {
  const sandboxDate = fixedNow
    ? class extends NativeDate {
        constructor(...args) { if (args.length === 0) super(fixedNow.getTime()); else super(...args); }
        static now() { return fixedNow.getTime(); }
      }
    : ShimDate;
  const context = {
    Intl,
    Date: sandboxDate,
    console,
    JSON, Math, Number, String, Object, Array, RegExp, Error, Boolean, Symbol,
    isNaN, parseFloat, parseInt,
    setTimeout: () => 0, clearTimeout: () => {}, Promise,
    document: { readyState: 'complete', getElementById() { return null; }, addEventListener() {} },
  };
  context.window = { UTP_FRONTEND_PREVIEW: preview, crypto: undefined, utpRpc: undefined, addEventListener() {} };
  vm.createContext(context);
  vm.runInContext(clientScript, context, { filename: 'UtpClient.html' });
  return context;
}

function clone(value) { return JSON.parse(JSON.stringify(value)); }

const validRecord = date => ({
  title: 'uji',
  date,
  items: [{ name: 'Pipa', unit: 'batang', quantity: 1, classification: 'BRANDED', brand: 'X' }],
});

test('client script parses without syntax errors', () => {
  assert.doesNotThrow(() => new vm.Script(clientScript, { filename: 'UtpClient.html' }));
});

test('impossible calendar dates are rejected by the real validateRequest code', () => {
  const api = loadClient().window.UTP_TEST__;
  assert.ok(api, 'hook uji preview harus tersedia');
  for (const date of ['2026-02-29', '2026-04-31', '2026-02-30', '2025-13-01', '2025-00-10', '2025-01-00', '2025-01-32']) {
    assert.equal(api.isValidDocumentDate(date), false, `${date} harus ditolak`);
    assert.throws(
      () => api.validateRequest(clone(validRecord(date))),
      /Tanggal permintaan wajib berupa tanggal kalender yang valid/,
      `validateRequest harus menolak ${date}`,
    );
  }
  for (const bad of ['', '29-02-2026', '2026-2-9', '20260229', '2026-02-29T00:00:00', 'besok']) {
    assert.equal(api.isValidDocumentDate(bad), false, `${JSON.stringify(bad)} bukan tanggal dokumen YYYY-MM-DD`);
  }
});

test('valid calendar dates are accepted, including leap day 2028-02-29', () => {
  const api = loadClient().window.UTP_TEST__;
  for (const good of ['2028-02-29', '2026-02-28', '2026-04-30', '2026-12-31', '2024-02-29', '2100-02-28', '2000-02-29']) {
    assert.equal(api.isValidDocumentDate(good), true, `${good} valid`);
    assert.doesNotThrow(() => api.validateRequest(clone(validRecord(good))), `${good} harus lolos validateRequest`);
  }
});

test('today() follows Asia/Jakarta even when device timezone differs', () => {
  // Satu momen UTC yang sama; tanggal perangkat berbeda-beda tetapi hasil harus tanggal WIB.
  // 2026-03-20T18:00:00Z -> UTC masih 20 Maret, New York 20 Maret (13:00), Kiritimati sudah 21 Maret,
  // sedangkan WIB sudah lewat tengah malam menjadi 21 Maret (01:00).
  const fixedNow = new NativeDate('2026-03-20T18:00:00Z');
  const previousTz = process.env.TZ;
  try {
    for (const tz of ['UTC', 'America/New_York', 'Pacific/Kiritimati', 'Asia/Tokyo']) {
      process.env.TZ = tz;
      const api = loadClient({ fixedNow }).window.UTP_TEST__;
      assert.equal(api.today(), '2026-03-21', `today() pada device ${tz} harus mengikuti Asia/Jakarta`);
    }
  } finally {
    if (previousTz === undefined) delete process.env.TZ; else process.env.TZ = previousTz;
  }
});

test('cross-timezone consistency: identical WIB result from three device zones', () => {
  const previousTz = process.env.TZ;
  try {
    const results = [];
    for (const tz of ['UTC', 'America/Los_Angeles', 'Asia/Tokyo']) {
      process.env.TZ = tz;
      results.push(loadClient().window.UTP_TEST__.today());
    }
    assert.equal(results[0], results[1]);
    assert.equal(results[1], results[2]);
    assert.match(results[0], /^\d{4}-\d{2}-\d{2}$/);
  } finally {
    if (previousTz === undefined) delete process.env.TZ; else process.env.TZ = previousTz;
  }
});

test('document date string never shifts a day through validation on any device timezone', () => {
  const previousTz = process.env.TZ;
  try {
    for (const tz of ['UTC', 'America/New_York', 'Asia/Tokyo']) {
      process.env.TZ = tz;
      const api = loadClient().window.UTP_TEST__;
      const record = {
        title: 'uji', date: '2026-04-30',
        items: [{ name: 'Pasir', unit: 'm³', quantity: 2, classification: 'GENERIC', brand: '' }],
      };
      assert.doesNotThrow(() => api.validateRequest(record));
      assert.equal(record.date, '2026-04-30', `tanggal dokumen tidak boleh bergeser pada TZ ${tz}`);
    }
  } finally {
    if (previousTz === undefined) delete process.env.TZ; else process.env.TZ = previousTz;
  }
});

test('timestamps display in WIB while audit values stay ISO UTC', () => {
  const previousTz = process.env.TZ;
  try {
    process.env.TZ = 'America/New_York'; // zona device jauh dari WIB untuk membuktikan tampilan tetap WIB
    const api = loadClient().window.UTP_TEST__;
    // 2026-05-17T09:30:00Z = 16:30 WIB (hari tetap 17), tapi hanya 05:30 pagi di New York.
    const rendered = api.dateText('2026-05-17T09:30:00Z');
    assert.match(rendered, /17/, `tanggal tampilan harus 17, ternyata: ${rendered}`);
    assert.match(rendered, /(16\.30|16:30)/, `jam tampilan harus 16.30 WIB, ternyata: ${rendered}`);
    // Pergantian hari UTC -> WIB: 2026-03-20T18:00:00Z (UTC masih 20 Maret) tampil 21 Maret di WIB.
    const rollover = api.dateText('2026-03-20T18:00:00Z');
    assert.match(rollover, /21/, `harus terbit tanggal 21 di WIB, ternyata: ${rollover}`);
    // Nilai audit tetap ISO UTC dan tidak berubah oleh tampilan.
    assert.match(api.now(), /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/, 'audit memakai ISO UTC');
    assert.equal(new NativeDate('2026-05-17T09:30:00Z').toISOString(), '2026-05-17T09:30:00.000Z');
  } finally {
    if (previousTz === undefined) delete process.env.TZ; else process.env.TZ = previousTz;
  }
});

test('test hook is not exposed when preview mode is off (live GAS mode)', () => {
  const liveScript = clientScript.replace('window.UTP_FRONTEND_PREVIEW === true', 'false');
  const context = {
    Intl, Date: ShimDate, console, JSON, Math, Number, String, Object, Array, RegExp, Error,
    Boolean, Symbol, isNaN, parseFloat, parseInt,
    setTimeout: () => 0, clearTimeout: () => {}, Promise,
    document: { readyState: 'complete', getElementById() { return null; }, addEventListener() {} },
  };
  context.window = { crypto: undefined, utpRpc: undefined, addEventListener() {} };
  vm.createContext(context);
  vm.runInContext(liveScript, context, { filename: 'UtpClient.html' });
  assert.equal(context.window.UTP_TEST__, undefined, 'hook uji tidak boleh aktif di mode live');
});
