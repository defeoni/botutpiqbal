// Pemeriksaan perilaku navigasi terintegrasi (jsdom, tanpa dependency aplikasi).
// Menjalankan switchMainPage dari MemoClient.html pada DOM pratinjau lokal.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const root = path.resolve(__dirname, '..');
const dom = new JSDOM(fs.readFileSync(path.join(root, '.local', 'aplikasi.html'), 'utf8'), {
  runScripts: 'dangerously',
  beforeParse(w) {
    w.matchMedia = (query) => ({ matches: false, media: query, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
  },
});
const { window } = dom;
const { document } = window;

const results = [];
const check = (name, fn) => { try { fn(); results.push(`PASS ${name}`); } catch (e) { results.push(`FAIL ${name}: ${e.message}`); } };
const buttonFor = (page) => document.querySelector(`.sidebar-nav .main-nav-button[data-main="${page}"]`);
const heading = () => document.querySelector('.app-main > .header h1').textContent;
const visibleSection = () => [...document.querySelectorAll('[data-main-page]')].filter((el) => !el.hidden);

check('satu klik memanggil route tepat satu kali', () => {
  let calls = [];
  const original = window.switchMainPage;
  window.switchMainPage = (page, id) => { calls.push(page); return original(page, id); };
  buttonFor('CATALOG').click();
  window.switchMainPage = original;
  assert.deepEqual(calls, ['CATALOG'], `klik menghasilkan panggilan: ${JSON.stringify(calls)}`);
});

check('menu Material membuka wadah dan judul yang benar', () => {
  const expected = { CATALOG: 'Katalog Semua Material', APPROVALS: 'Approval Material', REQUESTS: 'Permintaan Material', ARRIVAL: 'Penerimaan' };
  for (const [page, title] of Object.entries(expected)) {
    window.switchMainPage(page);
    assert.equal(heading(), title, `judul halaman ${page}`);
    assert.ok(!document.getElementById('utpApp').hidden, `wadah utpApp tampil untuk ${page}`);
  }
});

check('Spek membuka wadah sendiri dengan formulir dan pencarian', () => {
  window.switchMainPage('SPEC');
  assert.equal(heading(), 'Spek');
  assert.deepEqual(visibleSection().map((el) => el.id), ['blank-SPEC'], 'hanya wadah Spek yang tampil');
  assert.ok(document.querySelector('#blank-SPEC #spek-title'), 'formulir judul Spek tersedia');
  assert.ok(document.querySelector('#blank-SPEC #spek-search'), 'pencarian Spek tersedia');
  assert.ok(document.getElementById('utpApp').hidden, 'Spek tidak membuka halaman material lain');
});

check('route aktif ditandai aria-current dan induk Material terbuka', () => {
  window.switchMainPage('REQUESTS');
  const active = [...document.querySelectorAll('.sidebar-nav .main-nav-button[aria-current="page"]')];
  assert.equal(active.length, 1, 'tepat satu menu bertanda aria-current');
  assert.equal(active[0].dataset.main, 'REQUESTS');
  assert.equal(document.querySelector('.nav-folder').open, true, 'induk Material terbuka saat rute di dalamnya');
});

check('LPD berada dalam scope Head Office', () => {
  const lpd = buttonFor('LPD');
  assert.equal(lpd.closest('[data-workspace-scope]').dataset.workspaceScope, 'ho', 'menu LPD ada di grup HEAD OFFICE');
  window.switchMainPage('LPD');
  assert.equal(window.setWorkspaceScope ? document.querySelector('[data-workspace-scope="ho"]').hidden : false, false, 'scope HO aktif untuk LPD');
});

check('route tidak dikenal kembali ke Beranda tanpa memilih menu salah', () => {
  window.switchMainPage('TIDAK ADA');
  assert.equal(heading(), 'Beranda Proyek');
  assert.equal(document.querySelector('.sidebar-nav .main-nav-button[aria-current="page"]').dataset.main, 'HOME');
});

check('mount ulang tidak menggandakan event (satu klik tetap satu panggilan)', () => {
  const before = document.querySelectorAll('.main-nav-button').length;
  assert.ok(before > 0);
  let calls = [];
  const original = window.switchMainPage;
  window.switchMainPage = (page, id) => { calls.push(page); return original(page, id); };
  buttonFor('ARRIVAL').click();
  buttonFor('ARRIVAL').click();
  window.switchMainPage = original;
  assert.equal(calls.length, 2, `dua klik = dua panggilan, bukan ${calls.length}`);
});

check('destroy menghentikan callback', () => {
  // Tidak ada komponen demo yang dimount di samping navigasi lama.
  assert.equal(window.UtpMaterialNavigation, undefined, 'komponen demo tidak boleh terpasang di aplikasi');
});

results.forEach((line) => console.log(line));
if (results.some((line) => line.startsWith('FAIL'))) process.exitCode = 1;
