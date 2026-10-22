const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (name) => fs.readFileSync(path.join(root, 'aplikasi', name), 'utf8');
const generator = require('../alat/buat-sumber-clasp.js');

const pages = [
  { page: 'HOME', file: 'HomeView.html', marker: 'id="blank-HOME"' },
  { page: 'HO', file: 'HoHomeView.html', marker: 'id="blank-HO"' },
  { page: 'KANBAN', file: 'KanbanView.html', marker: 'id="blank-KANBAN"' },
  { page: 'NOTIFIKASI', file: 'NotifikasiView.html', marker: 'id="blank-NOTIFIKASI"' },
  { page: 'DOCUMENTS', file: 'DocumentCenter.html', marker: 'id="documentCenter"' },
  { page: 'MEMO', file: 'Index.html', marker: 'id="memoPageHeader"' },
  { page: 'RPB', file: 'RPBView.html', marker: 'id="blank-RPB"' },
  { page: 'RPD', file: 'RPD.html', marker: 'id="blank-RPD"' },
  { page: 'LPD', file: 'LPDView.html', marker: 'id="blank-LPD"' },
  { page: 'SPEC', file: 'SpekView.html', marker: 'id="blank-SPEC"' },
  { page: 'TOOLS', file: 'ProjectTools.html', marker: 'id="blank-TOOLS"' },
  { page: 'MANPOWER', file: 'Index.html', marker: 'id="section-DIRECTORY"' },
  { page: 'PROJECT_SETTINGS', file: 'Index.html', marker: 'id="projectSettingsPage"' },
  { page: 'SETTINGS', file: 'Index.html', marker: 'id="settingsPage"' }
];

function titles() {
  const source = read('MemoClient.html');
  const block = source.match(/const titles = \{([^}]+)\};/);
  assert.ok(block, 'peta judul halaman harus tersedia');
  return Object.fromEntries([...block[1].matchAll(/([A-Z_]+)\s*:\s*'/g)].map((match) => [match[1], true]));
}

test('seluruh target halaman memiliki wadah dan empty state', () => {
  pages.forEach(({ page, file, marker }) => {
    const source = read(file);
    assert.ok(source.includes(marker), `${page} membutuhkan ${marker} pada ${file}`);
    assert.match(source, /Belum|Tidak ada form yang cocok/, `${page} membutuhkan empty state yang jelas`);
    if (page !== 'TOOLS') assert.ok(titles()[page], `${page} membutuhkan judul halaman`);
  });
  assert.match(read('UtpView.html'), /id="utpApp"/, 'halaman material memakai wadah utpApp');
  ['CATALOG', 'APPROVALS', 'REQUESTS', 'ARRIVAL'].forEach((page) => {
    assert.ok(titles()[page], `${page} membutuhkan judul halaman`);
    assert.match(read('UtpClient.html'), new RegExp(page), `${page} dirender oleh UtpClient`);
  });
});

test('seluruh menu utama memiliki tujuan yang valid', () => {
  const index = read('Index.html');
  const navigation = index.slice(index.indexOf('<nav class="sidebar-nav"'), index.indexOf('</nav>'));
  const targets = [...navigation.matchAll(/data-main="([A-Z_]+)"/g)].map((match) => match[1]);
  assert.ok(targets.length >= 12, 'menu utama harus memuat seluruh wadah');
  assert.equal(new Set(targets).size, targets.length, 'tujuan menu tidak boleh ganda');
  const known = titles();
  targets.forEach((target) => assert.ok(known[target], `tujuan menu ${target} tidak punya halaman`));
  ['KANBAN', 'NOTIFIKASI', 'LPD', 'DOCUMENTS', 'PROJECT_SETTINGS'].forEach((target) => {
    assert.ok(targets.includes(target), `menu ${target} harus tersedia`);
  });
  assert.ok(index.includes("include('KanbanView')"), 'Index memuat wadah Kanban Global');
  assert.ok(index.includes("include('NotifikasiView')"), 'Index memuat wadah Notifikasi');
});

test('struktur menu Material dan Head Office sesuai spesifikasi', () => {
  const index = read('Index.html');
  const navigation = index.slice(index.indexOf('<nav class="sidebar-nav"'), index.indexOf('</nav>'));
  const projectSection = navigation.slice(navigation.indexOf('data-workspace-scope="project"'), navigation.indexOf('data-workspace-scope="ho"'));
  const hoSection = navigation.slice(navigation.indexOf('data-workspace-scope="ho"'));
  const folder = projectSection.match(/<details class="nav-folder"[^>]*>([\s\S]*?)<\/details>/);
  assert.match(projectSection, /<h2 id="menuProject">PROYEK<\/h2>/, 'heading tingkat satu grup proyek tertulis PROYEK');
  assert.ok(folder, 'grup Material memakai details.nav-folder');
  assert.match(folder[0], /<summary>[\s\S]*?<span>Material<\/span>/, 'level dua grup bernama Material');
  assert.deepEqual(
    [...folder[1].matchAll(/data-main="([A-Z_]+)"[^>]*>([^<]+)</g)].map((m) => [m[1], m[2]]),
    [['CATALOG', 'Katalog Semua Material'], ['SPEC', 'Spek'], ['APPROVALS', 'Approval'], ['REQUESTS', 'Permintaan'], ['ARRIVAL', 'Penerimaan']],
    'level tiga Material berurutan sesuai spesifikasi'
  );
  assert.ok(!/data-main="LPD"/.test(projectSection), 'LPD bukan menu ruang proyek');
  assert.ok(/data-main="LPD"[^>]*>LPD</.test(hoSection), 'menu LPD berada di bawah HEAD OFFICE');
});

test('wadah baru terdaftar pada generator clasp dan pratinjau', () => {
  ['KanbanView.html', 'NotifikasiView.html'].forEach((target) => {
    const matches = generator.sourceFiles.filter(([, name]) => name === target);
    assert.equal(matches.length, 1, `${target} terdaftar tepat satu kali`);
    assert.ok(fs.existsSync(path.join(root, matches[0][0])), `${matches[0][0]} harus ada`);
  });
  const preview = fs.readFileSync(path.join(root, 'alat', 'buat-pratinjau.py'), 'utf8');
  ['KanbanView', 'NotifikasiView'].forEach((name) => {
    assert.ok(preview.includes(`"${name}":`), `${name} tersedia pada pratinjau lokal`);
  });
});

test('tidak ada ID penting ganda pada wadah halaman', () => {
  const files = ['Index.html', 'HomeView.html', 'HoHomeView.html', 'KanbanView.html', 'NotifikasiView.html', 'DocumentCenter.html', 'ProjectTools.html', 'RPD.html', 'RPBView.html', 'LPDView.html', 'ProjectsClient.html'];
  const seen = new Map();
  files.forEach((file) => {
    [...read(file).matchAll(/\bid="([^"]+)"/g)].forEach((match) => {
      const id = match[1];
      assert.ok(!seen.has(id), `ID ${id} ganda antara ${seen.get(id)} dan ${file}`);
      seen.set(id, file);
    });
  });
});

test('Pusat Dokumen hanya mempunyai satu tombol Tambah Dokumen', () => {
  const view = read('DocumentCenter.html');
  const client = read('DocumentCenterClient.html');
  assert.equal([...view.matchAll(/id="dcNewDraft"/g)].length, 1, 'tepat satu tombol tambah tersedia');
  assert.equal([...client.matchAll(/id='dcNewDraftToolbar'/g)].length, 0, 'klien tidak membuat tombol tambah kedua');
  assert.equal([...client.matchAll(/b\.id==='dcNewDraft'/g)].length, 1, 'satu jalur event tambah');
  assert.ok(client.includes("get('dcNewDraftForm').onsubmit"), 'dialog tambah tetap memiliki form');
  assert.equal([...view.matchAll(/id="dcReload"/g)].length, 1, 'satu tombol muat ulang tersedia');
  assert.ok(view.includes('data-dc-view="map"') && view.includes('data-dc-view="list"') && view.includes('data-dc-view="board"'), 'tab Peta, Daftar, dan Kanban tersedia');
});

test('halaman Notifikasi belum menjalankan integrasi eksternal', () => {
  const source = read('NotifikasiView.html');
  assert.match(source, /Belum diaktifkan/);
  assert.ok(!/<script/i.test(source), 'wadah Notifikasi tidak menjalankan skrip integrasi');
  [/telegram/i, /UrlFetchApp/, /setTrigger/, /apiEnsureTelegramConnection/, /\bfetch\(/].forEach((pattern) => {
    assert.ok(!pattern.test(source), `Notifikasi tidak boleh memakai ${pattern}`);
  });
});
