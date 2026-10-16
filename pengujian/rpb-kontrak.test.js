const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const workspace = path.resolve(__dirname, '..');
const backendSource = fs.readFileSync(path.join(workspace, 'aplikasi', 'rpb', 'RPB.gs'), 'utf8');
const clientSource = fs.readFileSync(path.join(workspace, 'aplikasi', 'rpb', 'RPBClient.html'), 'utf8');

function dateFromIso(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) throw new Error('Format tanggal tidak valid. Pilih tanggal dari kalender.');
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12);
  if (date.getFullYear() !== Number(match[1]) ||
      date.getMonth() !== Number(match[2]) - 1 ||
      date.getDate() !== Number(match[3])) {
    throw new Error('Tanggal tidak valid. Pilih tanggal dari kalender.');
  }
  return date;
}

function createBackendContext() {
  const properties = new Map();
  const masterRow = ['item-1', 'Kebutuhan ATK', 'Kertas', 'rim', 5, 'AKTIF', ''];
  const masterSheet = {
    getLastRow() { return 2; },
    getRange() {
      return { getValues() { return [masterRow]; } };
    }
  };
  const lock = { waitLock() {}, releaseLock() {} };
  const context = {
    APP: { timezone: 'Asia/Jakarta' },
    dateFromIso_: dateFromIso,
    requiredText_(value, label) {
      const result = String(value || '').trim();
      if (!result) throw new Error(`${label} wajib diisi.`);
      return result;
    },
    requireAuthorized_(token) {
      if (token !== 'valid-token') throw new Error('Unauthorized');
    },
    requireDeletePin_(pin) {
      if (pin !== 'valid-pin') throw new Error('PIN required');
    },
    PropertiesService: {
      getScriptProperties() {
        return { getProperty() { return null; } };
      },
      getUserProperties() {
        return {
          getProperty(key) { return properties.has(key) ? properties.get(key) : null; },
          setProperty(key, value) { properties.set(key, String(value)); },
          deleteProperty(key) { properties.delete(key); }
        };
      }
    },
    SpreadsheetApp: {
      openById() {
        return { getSheetByName() { return masterSheet; } };
      }
    },
    LockService: { getScriptLock() { return lock; } },
    properties
  };
  vm.createContext(context);
  vm.runInContext(backendSource, context);
  return context;
}

function validItem(overrides = {}) {
  return {
    itemId: 'item-1',
    quantity: 2,
    unitPrice: 5,
    week: 'M1-M2',
    ...overrides
  };
}

function validSubmission(overrides = {}) {
  return {
    requestDate: '2026-01-15',
    lpdReceivedMonth: '2025-12',
    lpdReceivedConfirmed: true,
    items: [validItem()],
    ...overrides
  };
}

test('RPB backend and client JavaScript parse without syntax errors', () => {
  assert.doesNotThrow(() => new vm.Script(backendSource, { filename: 'RPB.gs' }));
  const script = clientSource.match(/<script>([\s\S]*?)<\/script>/);
  assert.ok(script, 'RPB client script element exists');
  assert.doesNotThrow(() => new vm.Script(script[1], { filename: 'RPBClient.html' }));
});

test('every RPB API begins by requiring an authorized session', () => {
  const apiNames = [...backendSource.matchAll(/^function (api\w+)\([^)]*\) \{/gm)].map((match) => match[1]);
  const guardedApiNames = [...backendSource.matchAll(/^function (api\w+)\([^)]*\) \{\s*requireAuthorized_\(/gm)].map((match) => match[1]);
  assert.ok(apiNames.length > 0, 'RPB API functions exist');
  assert.deepEqual(guardedApiNames, apiNames);
});

test('RPB validates real calendar dates and the previous month across year boundaries', () => {
  const context = createBackendContext();
  assert.doesNotThrow(() => context.validateRpbPayload_(validSubmission(), true));
  assert.throws(
    () => context.validateRpbPayload_(validSubmission({ requestDate: '2025-02-29' }), true),
    /Tanggal tidak valid/
  );
  assert.throws(
    () => context.validateRpbPayload_(validSubmission({ lpdReceivedMonth: '2026-01' }), true),
    /bulan 2025-12/
  );
});

test('RPB rejects non-finite quantity, price, and computed totals', () => {
  const context = createBackendContext();
  assert.throws(
    () => context.validateRpbPayload_(validSubmission({ items: [validItem({ quantity: Infinity })] }), true),
    /jumlah untuk Kertas/
  );
  assert.throws(
    () => context.validateRpbPayload_(validSubmission({ items: [validItem({ quantity: 'NaN' })] }), true),
    /jumlah untuk Kertas/
  );
  assert.throws(
    () => context.validateRpbPayload_(validSubmission({ items: [validItem({ unitPrice: Infinity })] }), true),
    /harga acuan yang valid/
  );
  assert.throws(
    () => context.validateRpbPayload_(validSubmission({ items: [validItem({ quantity: 1e308, unitPrice: 1e308 })] }), true),
    /total yang tidak valid/
  );
});

test('late draft saves cannot overwrite a newer draft', () => {
  const context = createBackendContext();
  const newer = {
    requestDate: '2026-02-15',
    items: [],
    draftVersion: 42
  };
  const stale = {
    requestDate: '2026-01-15',
    items: [],
    draftVersion: 41
  };

  assert.equal(context.apiSaveRpbDraft(newer, 'valid-token').saved, true);
  const staleResult = context.apiSaveRpbDraft(stale, 'valid-token');
  assert.equal(staleResult.saved, false);
  assert.equal(staleResult.stale, true);
  assert.equal(context.properties.get('RPB_DRAFT_REVISION'), '42');
  assert.equal(context.apiLoadRpbDraft('valid-token').requestDate, '2026-02-15');
});

test('tracking updates require an authorized caller and the delete PIN', () => {
  const context = createBackendContext();
  assert.throws(
    () => context.apiUpdateRpbTracking('record-id', 'Diproses', '', '', '', 'valid-token'),
    /PIN required/
  );
});

test('invalid template categories report the spreadsheet row instead of throwing ReferenceError', () => {
  const context = createBackendContext();
  const row = Array(14).fill('');
  row[3] = 'Barang tanpa kategori';
  const sheet = {
    getLastRow() { return 10; },
    getLastColumn() { return 14; },
    getRange() {
      return {
        getValues() { return [row]; }
      };
    }
  };
  const spreadsheet = { getSheetByName() { return sheet; } };

  assert.throws(
    () => context.readRpbItemsFromTemplate_(spreadsheet),
    /baris 10, tidak memiliki kategori template yang dikenali/
  );
});
