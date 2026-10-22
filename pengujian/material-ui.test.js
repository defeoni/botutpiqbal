const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function fixture() {
  class Element extends EventTarget {
    constructor(tag) { super(); this.tagName = tag; this.children = []; this.style = {}; this.open = false; this.isConnected = true; }
    append(...nodes) { nodes.forEach(node => this.appendChild(node)); }
    appendChild(node) { this.children.push(node); return node; }
    insertBefore(node, target) { this.children.splice(this.children.indexOf(target), 0, node); }
    setAttribute(key, value) { this[key] = value; }
    showModal() { this.open = true; }
    close() { this.open = false; this.dispatchEvent(new Event('close')); }
    remove() { this.isConnected = false; }
  }
  const document = { body: new Element('body'), createElement: tag => new Element(tag) };
  const calls = [];
  const context = { document, window: {}, Event, accessToken: 'owner', Intl, Promise, Date,
    invokeServer(name, args) { calls.push({ name, args }); } };
  const source = fs.readFileSync(path.join(__dirname, '../aplikasi/DocumentExportsClient.html'), 'utf8');
  vm.runInNewContext(source.match(/<script>([\s\S]*?)<\/script>/)[1], context);
  const record = { id: 'request-1', version: 1, status: 'DRAFT', items: [], date: '2026-10-01', initialSnapshot: { items: [] } };
  const actions = context.window.DocumentExports.material(record, {});
  const popup = () => document.body.children.at(-1);
  return { calls, actions, popup };
}

test('popup ekspor: × dan Tutup menutup tanpa ekspor; busy cancel tetap dihormati', () => {
  const f = fixture();
  const initial = f.actions.children.find(node => node.textContent === 'Ekspor permintaan awal');
  assert.ok(initial, 'aksi ekspor awal tersedia');
  initial.onclick();
  const dialog = f.popup();
  const cross = dialog.children[0].children[1];
  const close = dialog.children[1].children.find(node => node.textContent === 'Tutup');
  assert.equal(cross.type, 'button');
  assert.equal(close.type, 'button');
  assert.equal(cross['aria-label'], 'Tutup dialog');
  let busy = true;
  dialog.addEventListener('cancel', event => { if (busy) event.preventDefault(); });
  cross.onclick();
  assert.equal(dialog.open, true, 'tidak menutup saat proses tidak boleh dibatalkan');
  busy = false;
  cross.onclick();
  assert.equal(dialog.open, false);
  assert.equal(dialog.isConnected, false);
  assert.equal(f.calls.length, 0, 'tutup tidak membuat ekspor');
  initial.onclick();
  const next = f.popup();
  next.children[1].children.find(node => node.textContent === 'Tutup').onclick();
  assert.equal(next.open, false);
  assert.equal(f.calls.length, 0);
});

test('popup arsip menutup tanpa membuat ekspor baru', () => {
  const f = fixture();
  f.actions.children.find(node => node.textContent === 'Arsip ekspor').onclick();
  const dialog = f.popup();
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0].name, 'apiDocumentExportHistory');
  dialog.children[0].children[1].onclick();
  assert.equal(dialog.open, false);
  assert.equal(f.calls.length, 1);
});
