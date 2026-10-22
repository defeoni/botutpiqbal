const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (name) => fs.readFileSync(path.join(root, 'aplikasi', name), 'utf8');
const generator = require('../alat/buat-sumber-clasp.js');

test('generator clasp memuat empat file LPD tepat sekali dengan nama target yang benar', () => {
  const expected = {
    'LPD.gs': 'aplikasi/LPD.gs',
    'LPDView.html': 'aplikasi/LPDView.html',
    'LPDStyles.html': 'aplikasi/LPDStyles.html',
    'LPDClient.html': 'aplikasi/LPDClient.html'
  };
  for (const [target, source] of Object.entries(expected)) {
    const matches = generator.sourceFiles.filter(([, name]) => name === target);
    assert.equal(matches.length, 1, target + ' harus terdaftar tepat satu kali');
    assert.equal(matches[0][0], source);
    assert.ok(fs.existsSync(path.join(root, source)), source + ' harus ada');
  }
  const targets = generator.sourceFiles.map(([, target]) => target);
  assert.equal(new Set(targets).size, targets.length, 'nama target generator tidak boleh duplikat');
});

test('Index memuat style, view, dan client LPD dengan urutan yang benar', () => {
  const index = read('Index.html');
  const styles = index.indexOf("include('LPDStyles')");
  const view = index.indexOf("include('LPDView')");
  const client = index.indexOf("include('LPDClient')");
  assert.ok(styles >= 0, 'Index harus memuat LPDStyles');
  assert.ok(view >= 0, 'Index harus memuat LPDView');
  assert.ok(client >= 0, 'Index harus memuat LPDClient');
  assert.ok(styles < view, 'LPDStyles harus dimuat sebelum LPDView');
  assert.ok(view < client, 'LPDView harus dimuat sebelum LPDClient');
  assert.ok(index.indexOf("include('ProjectsClient')") < client, 'ProjectWorkspace harus tersedia sebelum LPDClient');
  assert.ok(index.indexOf("include('MemoClient')") < client, 'router dan token harus tersedia sebelum LPDClient');
});

test('router, guard proyek, dan reset sesi memakai LPDWorkspace', () => {
  assert.match(read('MemoClient.html'), /page === 'LPD' && window\.LPDWorkspace[\s\S]*LPDWorkspace\.open\(\)/);
  assert.match(read('ProjectsClient.html'), /window\.LPDWorkspace&&window\.LPDWorkspace\.isBusy\(\)/);
  assert.match(read('ProjectsClient.html'), /window\.LPDWorkspace&&window\.LPDWorkspace\.isDirty\(\)/);
  assert.match(read('WorkspaceClient.html'), /window\.LPDWorkspace&&window\.LPDWorkspace\.reset/);
  assert.match(read('LPDClient.html'), /window\.LPDWorkspace\s*=\s*\{[\s\S]*open: open[\s\S]*isBusy:[\s\S]*isDirty:[\s\S]*reset:/);
});
