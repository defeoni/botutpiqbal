const RPB_CONFIG = {
  sourceSpreadsheetId: '1Yc7E2aF1qGWXrATV4yKyNGrbw5eJ6DmGwmgDjFvi5-0',
  masterSheetName: 'Master Barang',
  projectName: 'TerraSentra Soreang, Bandung',
  projectCode: 'TRSM-51D26-D-M',
  projectManager: 'Juhana',
  formPrefix: 'UTP.FM-SP.02/',
  revisionLabel: 'Rev '
};

const RPB_CATEGORIES = [
  'Direksi Kiet',
  'Kebutuhan Proyek',
  'Kebutuhan ATK',
  'Kebutuhan Mess',
  'Lain - Lain',
  'Asset',
  'Perlengkapan'
];

const RPB_STATUSES = [
  'Diajukan',
  'Diproses',
  'Revisi',
  'ACC',
  'Ditolak',
  'Dikirim dari kantor',
  'Diterima di site',
  'Serah terima selesai'
];

const RPB_HISTORY_HEADERS = [
  'ID', 'Nomor Form', 'Revisi', 'Status', 'Tanggal Pengajuan', 'Bulan LPD Diterima',
  'JSON Data', 'URL Spreadsheet', 'URL Excel', 'URL PDF', 'URL Folder', 'ID Versi Induk', 'Diperbarui', 'JSON Tracking'
];

function apiGetRpbData(token) {
  requireAuthorized_(token);
  const sheet = getRpbMasterSheet_();
  return {
    categories: RPB_CATEGORIES.slice(),
    items: getRpbMasterItems_(true),
    statuses: RPB_STATUSES.slice(),
    projectName: RPB_CONFIG.projectName,
    projectCode: RPB_CONFIG.projectCode,
    projectManager: RPB_CONFIG.projectManager,
    masterUrl: sheet.getParent().getUrl() + '#gid=' + sheet.getSheetId(),
    history: getRpbHistory_(),
    nextSequence: getRpbNextSequence_(),
    draftVersion: Number(PropertiesService.getUserProperties().getProperty('RPB_DRAFT_REVISION')) || 0
  };
}

function apiSaveRpbDraft(payload, token) {
  requireAuthorized_(token);
  const clean = validateRpbPayload_(payload, false);
  const draftVersion = Number(payload.draftVersion);
  if (!Number.isSafeInteger(draftVersion) || draftVersion < 0) throw new Error('Versi draf tidak valid. Muat ulang RPB sebelum menyimpan.');
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const props = PropertiesService.getUserProperties();
    const currentVersion = Number(props.getProperty('RPB_DRAFT_REVISION')) || 0;
    if (draftVersion <= currentVersion) return { saved: false, stale: true, draftVersion: currentVersion };
    clean.draftVersion = draftVersion;
    props.setProperty('RPB_DRAFT', JSON.stringify(clean));
    props.setProperty('RPB_DRAFT_REVISION', String(draftVersion));
    return { saved: true, draftVersion, savedAt: new Date().toISOString() };
  } finally {
    lock.releaseLock();
  }
}

function apiLoadRpbDraft(token) {
  requireAuthorized_(token);
  const text = PropertiesService.getUserProperties().getProperty('RPB_DRAFT');
  if (!text) return null;
  try { return JSON.parse(text); } catch (error) { return null; }
}

function apiCreateRpb(payload, token, revisionOf) {
  requireAuthorized_(token);
  const clean = validateRpbPayload_(payload, true);
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  const createdIds = [];
  try {
    const history = getRpbHistorySheet_(true);
    let parent = null;
    let sequence;
    let revision;
    if (revisionOf) {
      parent = getRpbRecordById_(history, String(revisionOf));
      if (!parent) throw new Error('RPB lama untuk revisi tidak ditemukan. Muat ulang riwayat.');
      const prior = JSON.parse(parent.dataJson || '{}');
      sequence = Number(prior.sequence) || getRpbSequenceFromNumber_(parent.number);
      revision = getRpbHighestRevision_(history, sequence) + 1;
      clean.sequence = sequence;
      clean.revision = revision;
      clean.rootId = prior.rootId || parent.id;
      clean.revisionOf = parent.id;
    } else {
      sequence = getRpbNextSequence_();
      revision = 0;
      clean.sequence = sequence;
      clean.revision = revision;
      clean.rootId = '';
      clean.revisionOf = '';
    }
    const number = `${RPB_CONFIG.formPrefix}${String(sequence).padStart(2, '0')} Rev ${String(revision).padStart(2, '0')}`;
    clean.number = number;
    const folder = getRpbArchiveFolder_(clean.requestDate);
    const outputs = createRpbFiles_(clean, number, folder, createdIds);
    const id = Utilities.getUuid();
    if (!clean.rootId) clean.rootId = id;
    appendRpbRecord_(history, {
      id, number, revision, status: 'Diajukan', requestDate: clean.requestDate,
      lpdReceivedMonth: clean.lpdReceivedMonth, data: clean, outputs, parentId: clean.revisionOf
    });
    const userProperties = PropertiesService.getUserProperties();
    const submittedDraftVersion = Number(payload.draftVersion);
    const currentDraftVersion = Number(userProperties.getProperty('RPB_DRAFT_REVISION')) || 0;
    const consumedDraftVersion = Number.isSafeInteger(submittedDraftVersion) && submittedDraftVersion >= 0
      ? Math.max(currentDraftVersion, submittedDraftVersion)
      : currentDraftVersion;
    userProperties.deleteProperty('RPB_DRAFT');
    userProperties.setProperty('RPB_DRAFT_REVISION', String(consumedDraftVersion));
    return {
      id, number, revision, spreadsheetUrl: outputs.spreadsheetUrl, excelUrl: outputs.excelUrl,
      pdfUrl: outputs.pdfUrl, folderUrl: folder.getUrl(), waDraft: buildRpbWhatsAppDraft_(clean, number, outputs)
    };
  } catch (error) {
    const cleanupFailures = [];
    createdIds.forEach((id) => {
      try { DriveApp.getFileById(id).setTrashed(true); } catch (cleanupError) { cleanupFailures.push(cleanupError); }
    });
    if (cleanupFailures.length) {
      const message = error && error.message ? error.message : String(error);
      throw new Error(`${message} Pembersihan gagal untuk ${cleanupFailures.length} file sementara; periksa folder arsip sebelum mengajukan ulang.`);
    }
    throw error;
  } finally {
    lock.releaseLock();
  }
}

function apiUpdateRpbTracking(id, status, note, evidenceUrl, pin, token) {
  requireAuthorized_(token);
  requireDeletePin_(pin);
  if (!RPB_STATUSES.includes(String(status))) throw new Error('Pilih status tracking yang tersedia.');
  const evidence = String(evidenceUrl || '').trim();
  if (evidence && !/^https:\/\//i.test(evidence)) throw new Error('Tautan bukti harus diawali https://.');
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sheet = getRpbHistorySheet_(false);
    if (!sheet) throw new Error('Riwayat RPB belum tersedia.');
    const row = findRpbRecordRow_(sheet, id);
    if (!row) throw new Error('Riwayat RPB tidak ditemukan.');
    let tracking = [];
    try { tracking = JSON.parse(sheet.getRange(row, 14).getValue() || '[]'); } catch (error) {}
    tracking.push({ status, note: String(note || '').trim().slice(0, 500), evidenceUrl: evidence.slice(0, 500), at: new Date().toISOString() });
    sheet.getRange(row, 4).setValue(status);
    sheet.getRange(row, 13).setValue(new Date());
    sheet.getRange(row, 14).setValue(JSON.stringify(tracking));
    return { history: getRpbHistory_() };
  } finally {
    lock.releaseLock();
  }
}

function getRpbNextSequence_() {
  const sheet = getRpbHistorySheet_(false);
  let maximum = 0;
  if (sheet && sheet.getLastRow() > 1) {
    sheet.getRange(2, 2, sheet.getLastRow() - 1, 1).getDisplayValues().forEach((row) => {
      maximum = Math.max(maximum, getRpbSequenceFromNumber_(row[0]));
    });
  }
  return maximum + 1;
}

function getRpbSequenceFromNumber_(number) {
  const match = String(number || '').match(/\/(\d+)\s+Rev/i);
  return match ? Number(match[1]) : 0;
}

function getRpbHighestRevision_(sheet, sequence) {
  if (!sheet || sheet.getLastRow() < 2) return -1;
  let highest = -1;
  sheet.getRange(2, 2, sheet.getLastRow() - 1, 2).getDisplayValues().forEach((row) => {
    if (getRpbSequenceFromNumber_(row[0]) !== Number(sequence)) return;
    const match = String(row[0] || '').match(/Rev\s+(\d+)/i);
    if (match) highest = Math.max(highest, Number(match[1]));
  });
  return highest;
}

function getRpbHistorySheet_(create) {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('RPB_HISTORY_SHEET_ID');
  if (id) {
    const sheet = SpreadsheetApp.openById(id).getSheets()[0];
    if (sheet.getRange(1, 14).getValue() !== 'JSON Tracking') {
      sheet.getRange(1, 14).setValue('JSON Tracking').setFontWeight('bold').setBackground('#1e3a8a').setFontColor('#ffffff');
    }
    return sheet;
  }
  if (!create) return null;
  const book = SpreadsheetApp.create('Riwayat RPB UTP');
  DriveApp.getFileById(book.getId()).moveTo(getArchiveRootFolder_());
  const sheet = book.getSheets()[0];
  sheet.setName('Riwayat');
  sheet.getRange(1, 1, 1, RPB_HISTORY_HEADERS.length).setValues([RPB_HISTORY_HEADERS]);
  sheet.getRange(1, 1, 1, RPB_HISTORY_HEADERS.length).setFontWeight('bold').setBackground('#1e3a8a').setFontColor('#ffffff');
  sheet.setFrozenRows(1);
  props.setProperty('RPB_HISTORY_SHEET_ID', book.getId());
  return sheet;
}

function getRpbHistory_() {
  const sheet = getRpbHistorySheet_(false);
  if (!sheet || sheet.getLastRow() < 2) return [];
  return sheet.getRange(2, 1, sheet.getLastRow() - 1, RPB_HISTORY_HEADERS.length).getValues().reverse().map((row) => {
    let data = {};
    try { data = JSON.parse(row[6] || '{}'); } catch (error) {}
    let tracking = [];
    try { tracking = JSON.parse(row[13] || '[]'); } catch (error) {}
    if (!tracking.length && Array.isArray(data.tracking)) tracking = data.tracking;
    return { id: String(row[0]), number: String(row[1]), revision: Number(row[2]) || 0, status: String(row[3]), requestDate: row[4] instanceof Date ? Utilities.formatDate(row[4], APP.timezone, 'yyyy-MM-dd') : String(row[4]), lpdReceivedMonth: String(row[5] || ''), data, tracking, spreadsheetUrl: String(row[7] || ''), excelUrl: String(row[8] || ''), pdfUrl: String(row[9] || ''), folderUrl: String(row[10] || ''), parentId: String(row[11] || '') };
  });
}

function getRpbRecordById_(sheet, id) {
  const row = findRpbRecordRow_(sheet, id);
  if (!row) return null;
  const v = sheet.getRange(row, 1, 1, RPB_HISTORY_HEADERS.length).getValues()[0];
  return { id: String(v[0]), number: String(v[1]), revision: Number(v[2]) || 0, dataJson: String(v[6] || '') };
}

function findRpbRecordRow_(sheet, id) {
  if (!sheet || sheet.getLastRow() < 2) return 0;
  const found = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).createTextFinder(String(id)).matchEntireCell(true).findNext();
  return found ? found.getRow() : 0;
}

function appendRpbRecord_(sheet, record) {
  const row = sheet.getLastRow() + 1;
  sheet.getRange(row, 1, 1, RPB_HISTORY_HEADERS.length).setValues([[
    record.id, record.number, record.revision, record.status, record.requestDate,
    record.lpdReceivedMonth, JSON.stringify(record.data), record.outputs.spreadsheetUrl,
    record.outputs.excelUrl, record.outputs.pdfUrl, record.outputs.folderUrl, record.parentId, new Date(), '[]'
  ]]);
}

function validateRpbPayload_(payload, requireLpd) {
  if (!payload || !Array.isArray(payload.items)) throw new Error('Pilih barang untuk RPB.');
  const requestDate = requiredText_(payload.requestDate, 'Tanggal pengajuan', 20);
  dateFromIso_(requestDate);
  const lpdReceivedMonth = String(payload.lpdReceivedMonth || '').trim();
  if (requireLpd) {
    if (payload.lpdReceivedConfirmed !== true) throw new Error('Konfirmasi bahwa LPD bulan sebelumnya telah diterima Project HO terlebih dahulu.');
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(lpdReceivedMonth)) throw new Error('LPD bulan sebelumnya harus dicatat sudah diterima sebelum RPB diajukan.');
    const dateParts = requestDate.match(/^(\d{4})-(\d{2})-\d{2}$/);
    let expectedYear = Number(dateParts[1]);
    let expectedMonthNumber = Number(dateParts[2]) - 1;
    if (expectedMonthNumber === 0) {
      expectedYear -= 1;
      expectedMonthNumber = 12;
    }
    const expectedMonth = `${String(expectedYear).padStart(4, '0')}-${String(expectedMonthNumber).padStart(2, '0')}`;
    if (lpdReceivedMonth !== expectedMonth) throw new Error(`LPD bulan sebelumnya yang diterima harus bulan ${expectedMonth}.`);
  }
  const activeMaster = new Map(getRpbMasterItems_(!requireLpd).map((item) => [item.id, item]));
  const items = payload.items.map((item) => {
    const master = activeMaster.get(String(item.itemId));
    if (!master) throw new Error('Ada barang yang sudah tidak aktif atau hilang dari master. Muat ulang pilihan barang.');
    const quantity = Number(item.quantity);
    if (!RPB_CATEGORIES.includes(master.category)) throw new Error(`Kategori barang ${master.name} (${master.category || 'kosong'}) tidak dikenali oleh template RPB. Periksa master barang sebelum membuat arsip.`);
    const rawPrice = item.unitPrice == null || item.unitPrice === '' ? master.price : item.unitPrice;
    const unitPrice = rawPrice === '' || rawPrice == null ? 0 : Number(rawPrice);
    if (!Number.isFinite(quantity) || quantity <= 0) throw new Error(`Isi jumlah untuk ${master.name}.`);
    if (!Number.isFinite(unitPrice) || unitPrice < 0) throw new Error(`Isi harga acuan yang valid untuk ${master.name}.`);
    const total = quantity * unitPrice;
    if (!Number.isFinite(total)) throw new Error(`Jumlah dan harga untuk ${master.name} menghasilkan total yang tidak valid.`);
    const week = String(item.week || 'M1-M2');
    if (!['M1-M2', 'M3-M4'].includes(week)) throw new Error('Pilih periode M1-M2 atau M3-M4.');
    return { itemId: master.id, category: master.category, name: master.name, unit: master.unit, quantity, unitPrice, total, week };
  });
  if (requireLpd && !items.length) throw new Error('Tambahkan minimal satu barang.');
  return { projectName: RPB_CONFIG.projectName, projectCode: RPB_CONFIG.projectCode, projectManager: RPB_CONFIG.projectManager, requestDate, lpdReceivedMonth, lpdReceivedConfirmed: payload.lpdReceivedConfirmed === true, items, sequence: Number(payload.sequence) || 0, revision: Number(payload.revision) || 0, rootId: String(payload.rootId || ''), revisionOf: String(payload.revisionOf || ''), tracking: Array.isArray(payload.tracking) ? payload.tracking : [] };
}

function getRpbArchiveFolder_(requestDate) {
  const date = dateFromIso_(requestDate);
  const month = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'][date.getMonth()];
  const root = getArchiveRootFolder_();
  const project = getOrCreateArchiveSubfolder_(root, 'Project TerraSentra Soreang, Bandung');
  const type = getOrCreateArchiveSubfolder_(project, 'RPB');
  const category = getOrCreateArchiveSubfolder_(type, 'Rencana Pengeluaran Bulanan');
  return getOrCreateArchiveSubfolder_(category, `${month} ${date.getFullYear()}`);
}

function createRpbFiles_(data, number, folder, createdIds) {
  const source = SpreadsheetApp.openById(RPB_CONFIG.sourceSpreadsheetId);
  const copy = DriveApp.getFileById(source.getId()).makeCopy(`${number} - ${RPB_CONFIG.projectName}`, folder);
  createdIds.push(copy.getId());
  const book = SpreadsheetApp.openById(copy.getId());
  let master = book.getSheetByName('Master Barang');
  if (!master) {
    const sourceMaster = getRpbMasterSheet_();
    master = sourceMaster.copyTo(book).setName('Master Barang');
  }
  master.hideSheet();
  buildRpbTemplate_(book, data, number);
  SpreadsheetApp.flush();
  const excelUrl = `https://www.googleapis.com/drive/v3/files/${copy.getId()}/export?mimeType=application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`;
  const response = UrlFetchApp.fetch(excelUrl, { headers: { Authorization: `Bearer ${ScriptApp.getOAuthToken()}` }, muteHttpExceptions: true });
  if (response.getResponseCode() !== 200) throw new Error(`Pembuatan file Excel gagal (HTTP ${response.getResponseCode()}).`);
  const xlsx = folder.createFile(response.getBlob().setName(`${number}.xlsx`));
  createdIds.push(xlsx.getId());
  const recap = book.getSheetByName('Rekap ') || book.getSheetByName('Rekap');
  const pdfUrl = `https://docs.google.com/spreadsheets/d/${copy.getId()}/export?format=pdf&size=A5&portrait=true&fitw=true&scale=4&sheetnames=false&printtitle=false&pagenumbers=false&gridlines=false&horizontal_alignment=CENTER&vertical_alignment=CENTER&top_margin=0.2&bottom_margin=0.2&left_margin=0.2&right_margin=0.2&gid=${recap.getSheetId()}`;
  const pdfResponse = UrlFetchApp.fetch(pdfUrl, { headers: { Authorization: `Bearer ${ScriptApp.getOAuthToken()}` }, muteHttpExceptions: true });
  if (pdfResponse.getResponseCode() !== 200) throw new Error(`Pembuatan PDF gagal (HTTP ${pdfResponse.getResponseCode()}).`);
  const pdf = folder.createFile(pdfResponse.getBlob().setName(`${number}.pdf`));
  createdIds.push(pdf.getId());
  return {
    spreadsheetUrl: copy.getUrl(),
    excelUrl: `https://drive.google.com/uc?export=download&id=${xlsx.getId()}`,
    pdfUrl: `https://drive.google.com/uc?export=download&id=${pdf.getId()}`,
    folderUrl: folder.getUrl()
  };
}

function buildRpbTemplate_(book, data, number) {
  const recap = book.getSheetByName('Rekap ') || book.getSheetByName('Rekap');
  const detail = book.getSheetByName('Detail Budget');
  const assets = book.getSheetByName('Asset & Perlengkapan');
  if (!recap || !detail || !assets) throw new Error('Template RPB harus memiliki sheet Rekap, Detail Budget, dan Asset & Perlengkapan.');
  const date = dateFromIso_(data.requestDate);
  const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const monthLabel = `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
  recap.getRange('C2').setValue(new Date(date.getFullYear(), date.getMonth(), 1, 12));
  recap.getRange('C3').setValue(RPB_CONFIG.projectName);
  recap.getRange('C4').setValue(RPB_CONFIG.projectCode);
  recap.getRange('B8:B14').setValues(RPB_CATEGORIES.map((category) => [category]));
  detail.getRange('D1').setValue(`BUDGET BULANAN\n${number}`);
  detail.getRange('K3').setValue(date);
  detail.getRange('K4').setValue(RPB_CONFIG.projectName);
  detail.getRange('K5').setValue(RPB_CONFIG.projectCode);
  detail.getRange('K6').setValue(monthLabel);
  assets.getRange('D1').setValue(`BUDGET BULANAN\n${number}`);
  assets.getRange('K4').setValue(RPB_CONFIG.projectName);
  assets.getRange('K5').setValue(RPB_CONFIG.projectCode);

  const detailItems = data.items.filter((item) => !['Asset', 'Perlengkapan'].includes(item.category));
  const assetItems = data.items.filter((item) => ['Asset', 'Perlengkapan'].includes(item.category));
  const detailCategories = RPB_CATEGORIES.slice(0, 5);
  const assetCategories = RPB_CATEGORIES.slice(5);
  clearRpbGroupedInputRows_(detail, detailCategories, 10, 136);
  clearRpbGroupedInputRows_(assets, assetCategories, 9, 39);
  const detailLastRow = writeRpbGroupedItems_(detail, detailCategories, detailItems, 10, 136);
  const assetLastRow = writeRpbGroupedItems_(assets, assetCategories, assetItems, 9, 39);
  setRpbRecapFormulas_(recap, detailLastRow + 1, assetLastRow + 1);
}

function getRpbCategorySections_(sheet, categories, startRow, endRow) {
  const values = sheet.getRange(startRow, 2, endRow - startRow + 1, 2).getDisplayValues();
  const sections = [];
  values.forEach((row, offset) => {
    const category = normalizeRpbCategory_(row[1]);
    if (category && categories.includes(category)) sections.push({ category, row: startRow + offset });
  });
  return sections;
}

function clearRpbGroupedInputRows_(sheet, categories, startRow, endRow) {
  const sections = getRpbCategorySections_(sheet, categories, startRow, endRow);
  if (sections.length !== categories.length) throw new Error(`Template ${sheet.getName()} tidak memiliki seluruh bagian kategori yang diperlukan.`);
  sections.forEach((section, index) => {
    const last = index + 1 < sections.length ? sections[index + 1].row - 1 : endRow;
    if (last >= section.row + 1) clearRpbInputRows_(sheet, section.row + 1, last);
  });
}

function writeRpbGroupedItems_(sheet, categories, items, startRow, endRow) {
  categories.forEach((category) => {
    const selected = items.filter((item) => item.category === category);
    if (!selected.length) return;
    let sections = getRpbCategorySections_(sheet, categories, startRow, endRow);
    const sectionIndex = sections.findIndex((section) => section.category === category);
    if (sectionIndex < 0) throw new Error(`Bagian kategori ${category} tidak ditemukan pada sheet ${sheet.getName()}.`);
    let section = sections[sectionIndex];
    let last = sectionIndex + 1 < sections.length ? sections[sectionIndex + 1].row - 1 : endRow;
    const capacity = last - section.row;
    if (selected.length > capacity) {
      const extra = selected.length - capacity;
      const insertBefore = sectionIndex + 1 < sections.length ? sections[sectionIndex + 1].row : endRow;
      const formatSource = insertBefore - 1;
      sheet.insertRowsBefore(insertBefore, extra);
      for (let offset = 0; offset < extra; offset += 1) {
        const row = insertBefore + offset;
        sheet.getRange(formatSource, 1, 1, sheet.getMaxColumns()).copyTo(
          sheet.getRange(row, 1, 1, sheet.getMaxColumns()), SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
        sheet.getRange(row, 6).setFormula(`=E${row}&K${row}`);
        sheet.getRange(row, 10).setFormula(`=G${row}*H${row}`);
      }
      endRow += extra;
      sections = getRpbCategorySections_(sheet, categories, startRow, endRow);
      section = sections.find((entry) => entry.category === category);
    }
    writeRpbTemplateItems_(sheet, section.row + 1, selected);
  });
  const sections = getRpbCategorySections_(sheet, categories, startRow, endRow);
  const expected = new Map();
  const missingFormulas = [];
  items.forEach((item) => {
    const key = `${item.category}\u0000${item.name}`;
    expected.set(key, (expected.get(key) || 0) + 1);
  });
  sections.forEach((section, index) => {
    const last = index + 1 < sections.length ? sections[index + 1].row - 1 : endRow;
    if (last < section.row + 1) return;
    const count = last - section.row;
    const values = sheet.getRange(section.row + 1, 4, count, 7).getDisplayValues();
    const formulas = sheet.getRange(section.row + 1, 4, count, 7).getFormulas();
    values.forEach((row, offset) => {
      const name = String(row[0] || '').trim();
      const category = normalizeRpbCategory_(row[1]);
      if (!name || !category) return;
      const key = `${category}\u0000${name}`;
      if (expected.has(key) && expected.get(key) > 0) {
        expected.set(key, expected.get(key) - 1);
        if (!formulas[offset][2] || !formulas[offset][6]) missingFormulas.push(name);
      }
    });
  });
  const missing = Array.from(expected.entries()).filter(([, count]) => count > 0);
  if (missing.length) throw new Error(`Tidak semua barang berhasil ditulis ke sheet ${sheet.getName()}: ${missing.map(([key, count]) => `${key.split('\u0000')[1]} (${count})`).join(', ')}.`);
  if (missingFormulas.length) throw new Error(`Rumus kode barang atau total tidak berhasil ditulis pada sheet ${sheet.getName()} untuk: ${missingFormulas.join(', ')}.`);
  return endRow;
}

function setRpbRecapFormulas_(sheet, detailLastRow, assetLastRow) {
  const recapName = `'${sheet.getName().replace(/'/g, "''")}'`;
  for (let row = 8; row <= 12; row += 1) {
    sheet.getRange(row, 5).setFormula(`=SUMIF('Detail Budget'!$F$11:$F$${detailLastRow};${recapName}!B${row}&${recapName}!$E$7;'Detail Budget'!$J$11:$J$${detailLastRow})`);
    sheet.getRange(row, 6).setFormula(`=SUMIF('Detail Budget'!$F$11:$F$${detailLastRow};${recapName}!B${row}&${recapName}!$F$7;'Detail Budget'!$J$11:$J$${detailLastRow})`);
    sheet.getRange(row, 7).setFormula(`=E${row}+F${row}`);
  }
  for (let row = 13; row <= 14; row += 1) {
    sheet.getRange(row, 5).setFormula(`=SUMIF('Asset & Perlengkapan'!$F$10:$F$${assetLastRow};${recapName}!B${row}&${recapName}!$E$7;'Asset & Perlengkapan'!$J$10:$J$${assetLastRow})`);
    sheet.getRange(row, 6).setFormula(`=SUMIF('Asset & Perlengkapan'!$F$10:$F$${assetLastRow};${recapName}!B${row}&${recapName}!$F$7;'Asset & Perlengkapan'!$J$10:$J$${assetLastRow})`);
    sheet.getRange(row, 7).setFormula(`=E${row}+F${row}`);
  }
  sheet.getRange('E15').setFormula('=SUM(E8:E14)');
  sheet.getRange('F15').setFormula('=SUM(F8:F14)');
  sheet.getRange('G15').setFormula('=SUM(G8:G14)');
}

function clearRpbInputRows_(sheet, start, end) {
  const count = end - start + 1;
  [[4, 2], [7, 3], [11, 1]].forEach(([column, width]) => sheet.getRange(start, column, count, width).clearContent());
}

function writeRpbTemplateItems_(sheet, start, items) {
  if (!items.length) return;
  const names = [], categories = [], prices = [], quantities = [], units = [], weeks = [];
  items.forEach((item) => {
    names.push([item.name]); categories.push([item.category]); prices.push([item.unitPrice]);
    quantities.push([item.quantity]); units.push([item.unit]); weeks.push([item.week]);
  });
  sheet.getRange(start, 4, items.length, 1).setValues(names);
  sheet.getRange(start, 5, items.length, 1).setValues(categories);
  sheet.getRange(start, 7, items.length, 1).setValues(prices);
  sheet.getRange(start, 8, items.length, 1).setValues(quantities);
  sheet.getRange(start, 9, items.length, 1).setValues(units);
  sheet.getRange(start, 11, items.length, 1).setValues(weeks);
  for (let offset = 0; offset < items.length; offset += 1) {
    const row = start + offset;
    sheet.getRange(row, 6).setFormula(`=E${row}&K${row}`);
    sheet.getRange(row, 10).setFormula(`=G${row}*H${row}`);
  }
}

function buildRpbWhatsAppDraft_(data, number, outputs) {
  const lines = data.items.map((item) => `• ${item.name}: ${item.quantity} ${item.unit} — ${item.week}`);
  return `Yth. Pa Juhana (PM),\n\nBerikut pengajuan RPB proyek ${RPB_CONFIG.projectName}.\nNo. Form: ${number}\nTanggal pengajuan: ${data.requestDate}\nLPD bulan sebelumnya: diterima (${data.lpdReceivedMonth})\n\nBarang yang diajukan:\n${lines.join('\n')}\n\nMohon ditinjau dan ditindaklanjuti. Terima kasih.\nExcel: ${outputs.excelUrl}\nPDF: ${outputs.pdfUrl}`;
}

function apiGetRpbMaster(token) {
  requireAuthorized_(token);
  return {
    categories: RPB_CATEGORIES.slice(),
    items: getRpbMasterItems_(true),
    projectName: RPB_CONFIG.projectName,
    projectCode: RPB_CONFIG.projectCode,
    projectManager: RPB_CONFIG.projectManager
  };
}

function apiAddRpbMasterItem(payload, token) {
  requireAuthorized_(token);
  const clean = validateRpbMasterItem_(payload);
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sheet = getRpbMasterSheet_();
    const existing = getRpbMasterItems_(false);
    const key = rpbItemKey_(clean.category, clean.name, clean.unit);
    if (existing.some((item) => rpbItemKey_(item.category, item.name, item.unit) === key)) {
      throw new Error('Barang dengan kategori, nama, dan satuan yang sama sudah ada di master.');
    }
    const row = sheet.getLastRow() + 1;
    const id = Utilities.getUuid().replace(/-/g, '').slice(0, 16);
    sheet.getRange(row, 1, 1, 7).setValues([[
      id, clean.category, clean.name, clean.unit, clean.price, 'AKTIF', clean.note
    ]]);
    styleRpbMasterRow_(sheet, row, clean.price);
    return { message: 'Barang baru berhasil ditambahkan ke master.', item: rpbMasterItemFromRow_([id, clean.category, clean.name, clean.unit, clean.price, 'AKTIF', clean.note], row) };
  } finally {
    lock.releaseLock();
  }
}

function apiSaveRpbMasterPrice(itemId, priceValue, pin, token) {
  requireAuthorized_(token);
  const id = requiredText_(itemId, 'ID barang', 40);
  const raw = String(priceValue == null ? '' : priceValue).trim();
  const price = raw === '' ? 0 : Number(raw.replace(/[^\d,.-]/g, '').replace(',', '.'));
  if (!Number.isFinite(price) || price < 0) throw new Error('Harga harus berupa angka nol atau lebih.');
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sheet = getRpbMasterSheet_();
    const row = findRpbMasterRow_(sheet, id);
    if (!row) throw new Error('Barang tidak ditemukan di master. Muat ulang daftar barang.');
    const current = sheet.getRange(row, 5).getValue();
    const missingCurrent = current === '' || current == null;
    const currentText = missingCurrent ? '0' : String(Number(current));
    const nextText = String(Number(price));
    if (currentText !== nextText && currentText !== '') requireDeletePin_(pin);
    if (currentText === nextText && !missingCurrent) return { message: 'Harga tidak berubah.', items: getRpbMasterItems_(true) };
    sheet.getRange(row, 5).setValue(price);
    styleRpbMasterRow_(sheet, row, price);
    return { message: 'Harga acuan berhasil disimpan.', items: getRpbMasterItems_(true) };
  } finally {
    lock.releaseLock();
  }
}

function apiDeleteRpbMasterItem(itemId, pin, token) {
  requireAuthorized_(token);
  requireDeletePin_(pin);
  const id = requiredText_(itemId, 'ID barang', 40);
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sheet = getRpbMasterSheet_();
    const row = findRpbMasterRow_(sheet, id);
    if (!row) throw new Error('Barang tidak ditemukan di master. Muat ulang daftar barang.');
    sheet.getRange(row, 6).setValue('NONAKTIF');
    return { message: 'Barang dinonaktifkan. Data master dan RPB lama tetap tersimpan.', items: getRpbMasterItems_(true) };
  } finally {
    lock.releaseLock();
  }
}

function apiSetRpbMasterItemActive(itemId, active, pin, token) {
  requireAuthorized_(token);
  const id = requiredText_(itemId, 'ID barang', 40);
  if (!active) requireDeletePin_(pin);
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sheet = getRpbMasterSheet_();
    const row = findRpbMasterRow_(sheet, id);
    if (!row) throw new Error('Barang tidak ditemukan di master. Muat ulang daftar barang.');
    sheet.getRange(row, 6).setValue(active ? 'AKTIF' : 'NONAKTIF');
    return { message: active ? 'Barang diaktifkan kembali.' : 'Barang dinonaktifkan.', items: getRpbMasterItems_(true) };
  } finally {
    lock.releaseLock();
  }
}

function getRpbMasterSpreadsheet_() {
  const propertyId = PropertiesService.getScriptProperties().getProperty('RPB_MASTER_SPREADSHEET_ID');
  return SpreadsheetApp.openById(propertyId || RPB_CONFIG.sourceSpreadsheetId);
}

function getRpbMasterSheet_() {
  const spreadsheet = getRpbMasterSpreadsheet_();
  let sheet = spreadsheet.getSheetByName(RPB_CONFIG.masterSheetName);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(RPB_CONFIG.masterSheetName);
    const catalog = readRpbItemsFromTemplate_(spreadsheet);
    sheet.getRange(1, 1, 1, 7).setValues([[
      'ID Barang', 'Kategori', 'Nama Barang', 'Satuan', 'Harga Acuan', 'Status', 'Keterangan'
    ]]);
    if (catalog.length) sheet.getRange(2, 1, catalog.length, 7).setValues(catalog);
    sheet.setFrozenRows(1);
    sheet.setColumnWidths(1, 7, 145);
    sheet.setColumnWidth(3, 360);
    sheet.setColumnWidth(7, 300);
    sheet.getRange(1, 1, 1, 7).setFontWeight('bold').setBackground('#1e3a8a').setFontColor('#ffffff');
    sheet.getRange('E:E').setNumberFormat('"Rp" #,##0');
    sheet.getRange(1, 1, Math.max(1, sheet.getMaxRows()), 7).createFilter();
    for (let index = 0; index < catalog.length; index += 1) {
      styleRpbMasterRow_(sheet, index + 2, catalog[index][4]);
    }
  } else if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, 7).setValues([[
      'ID Barang', 'Kategori', 'Nama Barang', 'Satuan', 'Harga Acuan', 'Status', 'Keterangan'
    ]]);
    sheet.getRange(1, 1, 1, 7).setFontWeight('bold').setBackground('#1e3a8a').setFontColor('#ffffff');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function readRpbItemsFromTemplate_(spreadsheet) {
  const groups = new Map();
  ['Detail Budget', 'Asset & Perlengkapan'].forEach((sheetName) => {
    const sheet = spreadsheet.getSheetByName(sheetName);
    if (!sheet || sheet.getLastRow() < 10) return;
    const values = sheet.getRange(10, 1, sheet.getLastRow() - 9, Math.max(14, sheet.getLastColumn())).getValues();
    let sectionCategory = '';
    values.forEach((row, offset) => {
      sectionCategory = normalizeRpbCategory_(row[2]) || sectionCategory;
      const name = String(row[3] || '').trim();
      const category = normalizeRpbCategory_(row[4]) || sectionCategory;
      if (!name) return;
      if (!category) throw new Error(`Barang "${name}" pada sheet ${sheetName}, baris ${offset + 10}, tidak memiliki kategori template yang dikenali. Periksa kategori sebelum membuat master.`);
      const unit = String(row[8] || '').trim();
      const key = rpbItemKey_(category, name, unit);
      const price = typeof row[6] === 'number' && Number.isFinite(row[6]) ? row[6] : 0;
      const note = String(row[13] || '').trim();
      if (!groups.has(key)) {
        groups.set(key, [Utilities.getUuid().replace(/-/g, '').slice(0, 16), category, name, unit, price, 'AKTIF', note]);
      } else {
        const current = groups.get(key);
        if ((current[4] === '' || current[4] == null) && price !== '') current[4] = price;
        if (!current[6] && note) current[6] = note;
      }
    });
  });
  return Array.from(groups.values()).sort((left, right) => {
    const categoryOrder = RPB_CATEGORIES.indexOf(left[1]) - RPB_CATEGORIES.indexOf(right[1]);
    return categoryOrder || left[2].localeCompare(right[2], 'id');
  });
}

function normalizeRpbCategory_(value) {
  const canonicalize = (text) => String(text || '').trim().toLocaleLowerCase('id')
    .replace(/[‐‑‒–—−]/g, '-')
    .replace(/\s*-\s*/g, ' - ')
    .replace(/\s+/g, ' ');
  const normalized = canonicalize(value);
  return RPB_CATEGORIES.find((category) => canonicalize(category) === normalized) || '';
}

function getRpbMasterItems_(includeInactive) {
  const sheet = getRpbMasterSheet_();
  if (sheet.getLastRow() < 2) return [];
  return sheet.getRange(2, 1, sheet.getLastRow() - 1, 7).getValues()
    .map((row, index) => rpbMasterItemFromRow_(row, index + 2))
    .filter((item) => item.id && (includeInactive || item.active));
}

function rpbMasterItemFromRow_(row, rowNumber) {
  return {
    id: String(row[0] || ''),     category: normalizeRpbCategory_(row[1]) || String(row[1] || '').trim(), name: String(row[2] || ''),
    unit: String(row[3] || ''), price: row[4] === '' || row[4] == null ? 0 : Number(row[4]) || 0,
    active: String(row[5] || 'AKTIF').toUpperCase() !== 'NONAKTIF',
    note: String(row[6] || ''), row: Number(rowNumber) || 0
  };
}

function validateRpbMasterItem_(payload) {
  if (!payload || !RPB_CATEGORIES.includes(String(payload.category || '').trim())) throw new Error('Pilih kategori barang yang tersedia.');
  const name = requiredText_(payload.name, 'Nama barang', 160);
  const unit = requiredText_(payload.unit, 'Satuan', 40);
  const rawPrice = String(payload.price == null ? '' : payload.price).trim();
  const price = rawPrice === '' ? 0 : Number(rawPrice.replace(/[^\d,.-]/g, '').replace(',', '.'));
  if (price !== '' && (!Number.isFinite(price) || price < 0)) throw new Error('Harga harus berupa angka nol atau lebih.');
  return { category: normalizeRpbCategory_(payload.category), name, unit, price, note: String(payload.note || '').trim().slice(0, 300) };
}

function rpbItemKey_(category, name, unit) {
  return [category, name, unit].map((value) => String(value || '').trim().toLocaleLowerCase('id')).join('|');
}

function findRpbMasterRow_(sheet, id) {
  if (sheet.getLastRow() < 2) return 0;
  const found = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1)
    .createTextFinder(String(id)).matchEntireCell(true).findNext();
  return found ? found.getRow() : 0;
}

function styleRpbMasterRow_(sheet, row, price) {
  sheet.getRange(row, 1, 1, 7).setVerticalAlignment('middle');
  sheet.getRange(row, 5).setNumberFormat('"Rp" #,##0');
  sheet.getRange(row, 5).setBackground(price === '' || price == null ? '#ffffff' : '#fff2cc');
}
