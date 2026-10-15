const APP = {
  name: 'Administrasi Memo UTP',
  version: '2026.10.16.1',
  timezone: 'Asia/Jakarta',
  types: {
    PN: { label: 'Penambahan Manpower', code: 'MM.PN' },
    PG: { label: 'Penggantian OS', code: 'MM.PG' },
    SP: { label: 'Surplus Manpower', code: 'MM.SP' }
  },
  schemas: {
    PN: [
      ['nama', 'Nama'], ['domisili', 'Domisili'], ['bidang', 'Bidang'],
      ['keahlian', 'Keahlian'], ['tglMulai', 'Tanggal Mulai'], ['areaKerja', 'Plotting Area']
    ],
    PGOut: [
      ['nama', 'Nama'], ['keahlian', 'Keahlian'], ['bidang', 'Bidang'],
      ['foreman', 'Foreman'], ['tglMulai', 'Tanggal Mulai'], ['keterangan', 'Keterangan']
    ],
    PGIn: [
      ['nama', 'Nama Pengganti'], ['keahlian', 'Keahlian'], ['bidang', 'Bidang'],
      ['foreman', 'Foreman'], ['tglMulai', 'Tanggal Mulai'], ['keterangan', 'Keterangan']
    ],
    SP: [
      ['nama', 'Nama'], ['bidang', 'Bidang'], ['keahlian', 'Keahlian'],
      ['tglTerakhir', 'Tanggal Terakhir'], ['tujuan', 'Tujuan Proyek']
    ]
  }
};
const DELETE_PIN = '461999';

function doGet(event) {
  const template = HtmlService.createTemplateFromFile('Index');
  template.initialType = event && event.parameter && APP.types[event.parameter.type]
    ? event.parameter.type
    : 'PN';
  template.appVersion = APP.version;
  return template.evaluate()
    .setTitle(APP.name)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function doPost(event) {
  const props = PropertiesService.getScriptProperties();
  const webhookKey = props.getProperty('BOT_WEBHOOK_KEY');
  if (!webhookKey || !event || !event.parameter || event.parameter.key !== webhookKey) {
    return HtmlService.createHtmlOutput('Forbidden');
  }

  if (!event.postData || !event.postData.contents) {
    console.error('Webhook Telegram tidak memiliki payload.');
    return HtmlService.createHtmlOutput('Bad Request');
  }
  let update;
  try {
    update = JSON.parse(event.postData.contents);
  } catch (error) {
    console.error(`Payload webhook Telegram bukan JSON yang valid: ${error.message}`);
    return HtmlService.createHtmlOutput('Bad Request');
  }
  processTelegramUpdate_(update);
  return HtmlService.createHtmlOutput('OK');
}

function apiCreateSession() {
  const props = PropertiesService.getScriptProperties();
  const token = Utilities.getUuid();
  CacheService.getScriptCache().put('auth_' + token, 'web-user', 21600);
  return {
    token,
    owner: props.getProperty('APP_OWNER_NAME') || 'Pengguna',
    version: APP.version
  };
}

function apiUploadKtpImage(dataUrl, originalName, token) {
  requireAuthorized_(token);
  const match = String(dataUrl || '').match(/^data:(image\/(?:jpeg|png));base64,([a-zA-Z0-9+/=]+)$/);
  if (!match) throw new Error('Foto KTP tidak valid. Pilih gambar JPG atau PNG.');
  const bytes = Utilities.base64Decode(match[2]);
  if (bytes.length > 2 * 1024 * 1024) {
    throw new Error('Ukuran foto asli maksimal 2 MB agar dapat dimasukkan ke Google Sheets tanpa dikompres.');
  }
  const folder = getPendingKtpFolder_(true);
  cleanupPendingKtpFiles_(folder);
  const fileName = safeFileName_(String(originalName || 'Foto-KTP').replace(/\.[^.]+$/, '').slice(0, 90)) || 'Foto-KTP';
  const extension = { 'image/jpeg': 'jpg', 'image/png': 'png' }[match[1]];
  const file = folder.createFile(Utilities.newBlob(bytes, match[1], `${fileName}.${extension}`));
  return { fileId: file.getId(), name: file.getName(), size: bytes.length };
}

function getPendingKtpFolder_(createIfMissing) {
  const props = PropertiesService.getScriptProperties();
  const folderId = props.getProperty('PENDING_KTP_FOLDER_ID');
  if (folderId) return DriveApp.getFolderById(folderId);
  if (!createIfMissing) return null;
  const folder = getArchiveRootFolder_().createFolder('Unggahan KTP Sementara');
  props.setProperty('PENDING_KTP_FOLDER_ID', folder.getId());
  return folder;
}

function cleanupPendingKtpFiles_(folder) {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  const files = folder.getFiles();
  while (files.hasNext()) {
    const file = files.next();
    if (file.getDateCreated().getTime() < cutoff) {
      try { file.setTrashed(true); }
      catch (error) { console.error(`Unggahan KTP sementara ${file.getId()} gagal dibersihkan: ${error.message}`); }
    }
  }
}

function apiGetCounters(token) {
  requireAuthorized_(token);
  return getCounters_();
}

function apiCreateMemo(payload, token, requestId) {
  requireAuthorized_(token);
  const validated = validatePayload_(payload);
  if (!/^[a-zA-Z0-9_-]{12,80}$/.test(String(requestId || ''))) {
    throw new Error('ID permintaan tidak valid. Muat ulang halaman lalu coba lagi.');
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const props = PropertiesService.getScriptProperties();
    const requestKey = 'MEMO_REQUEST_' + requestId;
    const previousRequest = props.getProperty(requestKey);
    if (previousRequest) return JSON.parse(previousRequest).result;

    const documentDate = dateFromIso_(validated.tanggalDoc);
    const period = Utilities.formatDate(documentDate, APP.timezone, 'yyyy_MM');
    const counterKey = `COUNTER_${period}_${validated.typeKey}`;
    const previousCounter = props.getProperty(counterKey);
    const legacyCounter = props.getProperty(`CTR_${period}`);
    const current = previousCounter === null
      ? Number(legacyCounter) || 0
      : Number(previousCounter) || 0;
    const sequence = current + 1;
    const number = formatDocNumber_(validated.projectCode, validated.typeKey, sequence, documentDate);
    const createdFileIds = [];
    let counterCommitted = false;
    let historyRecord = null;
    let manpowerRecord = null;

    try {
      const folder = getArchiveFolder_(validated.projectCode, period);
      const imageFiles = saveKtpImages_(validated, folder, number, createdFileIds);
      const workingSpreadsheet = createSpreadsheet_(validated, number, folder, imageFiles, createdFileIds);
      const sheet = validated.outputs.spreadsheet ? workingSpreadsheet : null;
      const memoSheet = workingSpreadsheet.getSheets()[0];
      const pdf = validated.outputs.pdf
        ? createPdf_(workingSpreadsheet, number, folder, createdFileIds, memoSheet, false)
        : null;
      const ktpSheet = workingSpreadsheet.getSheetByName('Lampiran KTP');
      const ktpPdf = validated.outputs.pdf && ktpSheet
        ? createPdf_(workingSpreadsheet, number, folder, createdFileIds, ktpSheet, true, '-Lampiran-KTP')
        : null;
      if (!sheet) {
        workingSpreadsheet.setTrashed(true);
        createdFileIds.splice(createdFileIds.indexOf(workingSpreadsheet.getId()), 1);
      }

      const result = {
        success: true,
        docNumber: number,
        sheetUrl: sheet ? sheet.getUrl() : '',
        pdfUrl: pdf ? pdf.getUrl() : '',
        ktpPdfUrl: ktpPdf ? ktpPdf.getUrl() : '',
        folderUrl: folder.getUrl(),
        imageNames: imageFiles.map((item) => item.file.getName()),
        counters: Object.assign(getCounters_(period), { [validated.typeKey]: sequence })
      };

      historyRecord = appendMemoHistory_(validated, number, documentDate, sheet, pdf, folder, createdFileIds);
      manpowerRecord = appendManpowerEvents_(validated, number, documentDate);
      props.setProperty(counterKey, String(sequence));
      counterCommitted = true;
      props.setProperty(requestKey, JSON.stringify({ createdAt: Date.now(), result }));
      trimMemoRequests_(props);
      return result;
    } catch (error) {
      let recoveryError = '';
      if (counterCommitted) {
        try {
          if (previousCounter === null) props.deleteProperty(counterKey);
          else props.setProperty(counterKey, previousCounter);
        } catch (rollbackError) {
          console.error(`Gagal mengembalikan counter ${counterKey}: ${rollbackError.message}`);
          recoveryError = ' Status counter perlu diperiksa dari menu Pengaturan.';
        }
      }
      try {
        props.deleteProperty(requestKey);
      } catch (requestError) {
        console.error(`Gagal membersihkan permintaan ${requestKey}: ${requestError.message}`);
        recoveryError += ' Status permintaan perlu diperiksa sebelum mencoba ulang.';
      }
      if (historyRecord) {
        try {
          historyRecord.sheet.deleteRow(historyRecord.row);
        } catch (historyError) {
          console.error(`Gagal membersihkan baris riwayat memo ${number}: ${historyError.message}`);
          recoveryError += ' Riwayat memo perlu diperiksa.';
        }
      }
      if (manpowerRecord) {
        try {
          manpowerRecord.sheet.deleteRows(manpowerRecord.row, manpowerRecord.count);
        } catch (manpowerError) {
          console.error(`Gagal membersihkan catatan manpower memo ${number}: ${manpowerError.message}`);
          recoveryError += ' Data manpower perlu diperiksa.';
        }
      }
      const cleanupErrors = [];
      createdFileIds.forEach((id) => {
        try {
          DriveApp.getFileById(id).setTrashed(true);
        } catch (cleanupError) {
          console.error(`Gagal membersihkan file sementara ${id}: ${cleanupError.message}`);
          cleanupErrors.push(id);
        }
      });
      if (cleanupErrors.length) recoveryError += ` File Drive sementara mungkin masih ada (${cleanupErrors.length} file).`;
      throw new Error(`Memo gagal dibuat.${recoveryError} ${error.message}`);
    }
  } finally {
    lock.releaseLock();
  }
}

function trimMemoRequests_(props) {
  const all = props.getProperties();
  const requests = Object.keys(all)
    .filter((key) => key.indexOf('MEMO_REQUEST_') === 0)
    .map((key) => ({ key, createdAt: Number(JSON.parse(all[key]).createdAt) || 0 }))
    .sort((left, right) => left.createdAt - right.createdAt);
  requests.slice(0, Math.max(0, requests.length - 250)).forEach((request) => props.deleteProperty(request.key));
}

function apiResetCounter(typeKey, token) {
  requireAuthorized_(token);
  const key = String(typeKey || '');
  if (key !== 'ALL' && !APP.types[key]) throw new Error('Jenis memo tidak dikenal.');
  const message = resetCounter_(key);
  return { message };
}

function apiGetMemoHistory(token) {
  requireAuthorized_(token);
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sheet = getMemoHistorySheet_(true);
    if (!sheet || sheet.getLastRow() < 2) return [];
    const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, 10).getValues();
    return values.map((row, index) => ({
      rowIndex: index + 2,
      createdAt: row[0] instanceof Date ? row[0].toISOString() : String(row[0]),
      number: String(row[1]),
      type: String(row[2]),
      project: String(row[3]),
      documentDate: String(row[4]),
      sheetUrl: String(row[5] || ''),
      pdfUrl: String(row[6] || ''),
      folderUrl: String(row[7] || ''),
      files: JSON.parse(String(row[8] || '[]')),
      waDraft: String(row[9] || '')
    })).reverse();
  } finally {
    lock.releaseLock();
  }
}

function apiGenerateHistoryPdf(number, rowIndex, token) {
  requireAuthorized_(token);
  const cleanNumber = requiredText_(number, 'Nomor memo', 160);
  const targetRow = Number(rowIndex);
  if (!Number.isInteger(targetRow) || targetRow < 2) throw new Error('Posisi memo tidak valid. Muat ulang riwayat.');
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const history = getMemoHistorySheet_(false);
    if (!history || history.getLastRow() < 2) throw new Error('Memo tidak ditemukan di riwayat.');
    if (targetRow > history.getLastRow()) throw new Error('Memo tidak ditemukan. Muat ulang riwayat.');
    const rowNumber = targetRow;
    const row = history.getRange(rowNumber, 1, 1, 10).getValues()[0];
    if (String(row[1]) !== cleanNumber) throw new Error('Riwayat berubah. Muat ulang halaman lalu coba lagi.');
    if (row[6]) return { pdfUrl: String(row[6]), message: 'PDF memo sudah tersedia.' };
    const sheetId = getDriveIdFromUrl_(row[5]);
    if (!sheetId) throw new Error('PDF belum tersedia dan spreadsheet memo tidak ditemukan untuk membuat PDF.');
    const folderId = getDriveIdFromUrl_(row[7]);
    if (!folderId) throw new Error('Folder arsip memo tidak ditemukan.');
    const spreadsheetFile = DriveApp.getFileById(sheetId);
    const memoSpreadsheet = SpreadsheetApp.openById(sheetId);
    const folder = DriveApp.getFolderById(folderId);
    const pdf = createPdf_(spreadsheetFile, cleanNumber, folder, [], memoSpreadsheet.getSheets()[0], false);
    row[6] = pdf.getUrl();
    const files = JSON.parse(String(row[8] || '[]'));
    files.push({ id: pdf.getId(), name: pdf.getName(), url: pdf.getUrl() });
    row[8] = JSON.stringify(files);
    history.getRange(rowNumber, 7, 1, 1).setValue(row[6]);
    history.getRange(rowNumber, 9, 1, 1).setValue(row[8]);
    return { pdfUrl: pdf.getUrl(), message: 'PDF berhasil dibuat.' };
  } finally {
    lock.releaseLock();
  }
}

function apiDeleteMemoHistory(rowIndex, number, pin, token) {
  requireAuthorized_(token);
  requireDeletePin_(pin);
  const targetRow = Number(rowIndex);
  const cleanNumber = requiredText_(number, 'Nomor memo', 160);
  if (!Number.isInteger(targetRow) || targetRow < 2) throw new Error('Posisi memo tidak valid. Muat ulang riwayat.');
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const history = getMemoHistorySheet_(false);
    if (!history || targetRow > history.getLastRow()) throw new Error('Memo tidak ditemukan. Muat ulang riwayat.');
    const row = history.getRange(targetRow, 1, 1, 10).getValues()[0];
    if (String(row[1]) !== cleanNumber) throw new Error('Riwayat berubah. Muat ulang halaman lalu coba lagi.');
    return trashAndDeleteMemoHistoryRows_(history, [{ row: targetRow, values: row }]);
  } finally {
    lock.releaseLock();
  }
}

function apiClearMemoHistory(pin, token) {
  requireAuthorized_(token);
  requireDeletePin_(pin);
  const history = getMemoHistorySheet_(false);
  if (!history || history.getLastRow() < 2) return { message: 'Riwayat memo sudah kosong.' };
  const numbers = history.getRange(2, 2, history.getLastRow() - 1, 1).getDisplayValues().map((row) => row[0]);
  return deleteMemoHistoryRecords_(numbers);
}

function deleteMemoHistoryRecords_(numbers) {
  const uniqueNumbers = Array.from(new Set(numbers.map(String).filter(Boolean)));
  if (!uniqueNumbers.length) return { message: 'Tidak ada riwayat memo untuk dihapus.' };
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const history = getMemoHistorySheet_(false);
    if (!history || history.getLastRow() < 2) return { message: 'Riwayat memo sudah kosong.' };
    const values = history.getRange(2, 1, history.getLastRow() - 1, 10).getValues();
    const targets = values.map((row, index) => ({ row: index + 2, values: row }))
      .filter((item) => uniqueNumbers.includes(String(item.values[1])));
    if (!targets.length) return { message: 'Memo tidak ditemukan di riwayat.' };
    return trashAndDeleteMemoHistoryRows_(history, targets);
  } finally {
    lock.releaseLock();
  }
}

function trashAndDeleteMemoHistoryRows_(history, targets) {
  const fileIds = new Set();
  targets.forEach(({ values: row }) => {
    try {
      JSON.parse(String(row[8] || '[]')).forEach((file) => { if (file && file.id) fileIds.add(String(file.id)); });
    } catch (error) {
      console.error(`Lampiran riwayat ${row[1]} tidak dapat dibaca: ${error.message}`);
    }
    [row[5], row[6]].forEach((url) => {
      const id = getDriveIdFromUrl_(url);
      if (id) fileIds.add(id);
    });
  });
  const failures = [];
  const trashed = [];
  fileIds.forEach((id) => {
    try { DriveApp.getFileById(id).setTrashed(true); trashed.push(id); }
    catch (error) { failures.push(id); console.error(`File memo ${id} gagal dipindahkan ke Sampah: ${error.message}`); }
  });
  if (failures.length) {
    const rollbackFailures = [];
    trashed.forEach((id) => {
      try { DriveApp.getFileById(id).setTrashed(false); }
      catch (error) { rollbackFailures.push(id); console.error(`Pemulihan file memo ${id} gagal: ${error.message}`); }
    });
    throw new Error(`Penghapusan dibatalkan karena ${failures.length} file gagal dipindahkan ke Sampah.${rollbackFailures.length ? ` ${rollbackFailures.length} file tidak berhasil dipulihkan.` : ' File yang sempat dipindahkan sudah dipulihkan.'}`);
  }
  targets.map((item) => item.row).sort((a, b) => b - a).forEach((row) => history.deleteRow(row));
  return { message: `${targets.length} riwayat memo dan ${fileIds.size} file terkait dipindahkan ke Sampah Google Drive.` };
}

function apiDeleteManpower(name, project, pin, token) {
  requireAuthorized_(token);
  requireDeletePin_(pin);
  const cleanName = requiredText_(name, 'Nama personel', 160);
  const cleanProject = requiredText_(project, 'Nama proyek', 160);
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sheet = getManpowerSheet_(false);
    if (!sheet || sheet.getLastRow() < 2) throw new Error('Data manpower tidak ditemukan.');
    const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, 15).getDisplayValues();
    const targetKey = normalizePersonKey_(cleanName, cleanProject);
    const rows = [];
    values.forEach((row, index) => {
      if (normalizePersonKey_(row[1], row[3]) === targetKey) rows.push(index + 2);
    });
    if (!rows.length) throw new Error('Data manpower tidak ditemukan.');
    rows.sort((a, b) => b - a).forEach((row) => sheet.deleteRow(row));
    return { message: `Data ${cleanName} dari proyek ${cleanProject} berhasil dihapus.` };
  } finally {
    lock.releaseLock();
  }
}

function requireDeletePin_(pin) {
  if (String(pin || '').trim() !== DELETE_PIN) throw new Error('Kode PIN salah. Data tidak dihapus.');
}

function apiGetManpower(token) {
  requireAuthorized_(token);
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sheet = getManpowerSheet_(false);
    if (!sheet || sheet.getLastRow() < 2) return [];
    const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, 15).getDisplayValues();
    const latest = new Map();
    values.forEach((row) => {
      const key = normalizePersonKey_(row[1], row[3]);
      if (key) latest.set(key, {
        name: row[1],
        status: row[2],
        project: row[3],
        domicile: row[4],
        department: row[5],
        skill: row[6],
        foreman: row[7],
        startDate: row[8],
        endDate: row[9],
        workArea: row[10],
        ktpName: row[11],
        ktpUrl: row[12],
        memoNumber: row[13],
        source: row[14]
      });
    });
    return Array.from(latest.values()).sort((left, right) =>
      String(right.startDate || right.endDate).localeCompare(String(left.startDate || left.endDate)) ||
      left.name.localeCompare(right.name, 'id')
    );
  } finally {
    lock.releaseLock();
  }
}

function apiSaveManpower(person, token) {
  requireAuthorized_(token);
  if (!person || typeof person !== 'object') throw new Error('Data personel tidak valid.');
  const clean = {
    name: requiredText_(person.name, 'Nama personel', 160),
    status: String(person.status || 'AKTIF'),
    project: requiredText_(person.project, 'Nama proyek', 160),
    domicile: String(person.domicile || '').trim(),
    department: String(person.department || '').trim(),
    skill: String(person.skill || '').trim(),
    foreman: String(person.foreman || '').trim(),
    startDate: String(person.startDate || '').trim(),
    endDate: String(person.endDate || '').trim(),
    workArea: String(person.workArea || '').trim()
  };
  if (!['AKTIF', 'NONAKTIF'].includes(clean.status)) throw new Error('Status personel tidak valid.');
  if (clean.status === 'AKTIF' && !clean.startDate) throw new Error('Tanggal mulai wajib diisi untuk personel aktif.');
  if (clean.startDate) dateFromIso_(clean.startDate);
  if (clean.endDate) dateFromIso_(clean.endDate);
  [clean.domicile, clean.department, clean.skill, clean.foreman, clean.workArea].forEach((value) => {
    if (value.length > 160) throw new Error('Salah satu detail personel terlalu panjang.');
  });

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sheet = getManpowerSheet_(true);
    const latest = getLatestManpowerRows_(sheet);
    const previous = latest.get(normalizePersonKey_(clean.name, clean.project)) || {};
    appendManpowerRow_(sheet, {
      name: clean.name,
      status: clean.status,
      project: clean.project,
      domicile: clean.domicile || previous.domicile || '',
      department: clean.department || previous.department || '',
      skill: clean.skill || previous.skill || '',
      foreman: clean.foreman || previous.foreman || '',
      startDate: clean.startDate || previous.startDate || '',
      endDate: clean.status === 'AKTIF' ? '' : clean.endDate || Utilities.formatDate(new Date(), APP.timezone, 'yyyy-MM-dd'),
      workArea: clean.workArea || previous.workArea || '',
      ktpName: previous.ktpName || '',
      ktpUrl: previous.ktpUrl || '',
      memoNumber: '',
      source: 'Input manual'
    });
    return { message: `Data ${clean.name} berhasil disimpan.` };
  } finally {
    lock.releaseLock();
  }
}

function apiHardReset(pin, token) {
  requireAuthorized_(token);
  requireDeletePin_(pin);

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const props = PropertiesService.getScriptProperties();
    const history = getMemoHistorySheet_(false);
    const protectedIds = ['TEMPLATE_PN_ID', 'TEMPLATE_PG_ID', 'TEMPLATE_SP_ID']
      .map((key) => props.getProperty(key))
      .filter(Boolean);
    const historyId = props.getProperty('MEMO_HISTORY_SHEET_ID');
    if (historyId) protectedIds.push(historyId);
    const rootId = props.getProperty('DRIVE_ROOT_FOLDER_ID');
    let trashedFiles = 0;
    if (rootId) {
      const trashResult = trashArchiveFiles_(DriveApp.getFolderById(rootId), protectedIds);
      trashedFiles = trashResult.count;
      if (trashResult.failures.length) {
        throw new Error(`Sebagian file gagal dipindahkan ke Sampah (${trashResult.failures.length}): ${trashResult.failures.slice(0, 10).join(', ')}`);
      }
    }
    if (history && history.getLastRow() > 1) {
      history.deleteRows(2, history.getLastRow() - 1);
    }
    Object.keys(props.getProperties()).forEach((key) => {
      if (key.indexOf('COUNTER_') === 0 || key.indexOf('CTR_') === 0 ||
          key.indexOf('MEMO_REQUEST_') === 0) {
        props.deleteProperty(key);
      }
    });
    return { message: `Hard reset selesai. Semua counter direset, riwayat dikosongkan, dan ${trashedFiles} file arsip dipindahkan ke Sampah Google Drive. File template dan Data Manpower tetap disimpan.` };
  } finally {
    lock.releaseLock();
  }
}

function apiValidateDeletePin(pin, token) {
  requireAuthorized_(token);
  requireDeletePin_(pin);
  return { valid: true };
}

function apiSetWebhook(token) {
  requireAuthorized_(token);
  return setTelegramWebhook_();
}

function apiTelegramStatus(token) {
  requireAuthorized_(token);
  return getTelegramStatus_();
}

function requireAuthorized_(token) {
  if (!token || !CacheService.getScriptCache().get('auth_' + token)) {
    throw new Error('Sesi aplikasi berakhir. Muat ulang halaman untuk melanjutkan.');
  }
}

function validatePayload_(payload) {
  if (!payload || !APP.types[payload.typeKey]) throw new Error('Jenis memo tidak valid.');
  const clean = {
    typeKey: payload.typeKey,
    projectName: requiredText_(payload.projectName, 'Nama proyek', 160),
    projectCode: requiredText_(payload.projectCode, 'Kode proyek', 32),
    tanggalDoc: requiredText_(payload.tanggalDoc, 'Tanggal dokumen', 50),
    berlakuEfektif: requiredText_(payload.berlakuEfektif, 'Tanggal efektif', 50),
    ditujukan: requiredText_(payload.ditujukan, 'Penerima memo', 160),
    perihal: APP.types[payload.typeKey].label,
    outputs: {
      spreadsheet: Boolean(payload.outputs && payload.outputs.spreadsheet),
      pdf: Boolean(payload.outputs && payload.outputs.pdf),
      whatsapp: Boolean(payload.outputs && payload.outputs.whatsapp)
    },
    waRecipient: String(payload.waRecipient || 'Pak Juwana (PM)').trim().slice(0, 160) || 'Pak Juwana (PM)',
  };
  if (!clean.outputs.spreadsheet && !clean.outputs.pdf) {
    throw new Error('Pilih minimal satu arsip: Google Sheets atau PDF.');
  }
  if (payload.typeKey === 'PG') {
    clean.workersOut = validatePeople_(payload.workersOut, 'Personel keluar', 'PGOut');
    clean.workersIn = validatePeople_(payload.workersIn, 'Personel pengganti', 'PGIn');
    if (!clean.workersOut.length && !clean.workersIn.length) {
      throw new Error('Isi minimal satu personel keluar atau pengganti.');
    }
  } else {
    clean.workers = validatePeople_(payload.workers, 'Personel', payload.typeKey);
    if (!clean.workers.length) throw new Error('Isi minimal satu baris personel.');
  }
  const allPeople = clean.typeKey === 'PG'
    ? clean.workersOut.concat(clean.workersIn)
    : clean.workers;
  if (allPeople.filter((person) => person.ktpFileId || person.ktpBase64).length > 30) {
    throw new Error('Maksimal 30 foto KTP per memo. Buat memo terpisah untuk lampiran berikutnya.');
  }
  return clean;
}

function validatePeople_(people, label, schemaKey) {
  if (!Array.isArray(people)) throw new Error(`${label} tidak valid.`);
  if (people.length > 100) throw new Error(`Maksimal 100 baris untuk ${label.toLowerCase()}.`);
  const fields = APP.schemas[schemaKey];
  const rows = people.map((person) => {
    const row = {};
    fields.forEach(([key, fieldLabel]) => {
      const value = String(person && person[key] || '').trim();
      if (value.length > 200) throw new Error(`${fieldLabel} terlalu panjang (maksimal 200 karakter).`);
      row[key] = value;
    });
    if (!row.nama) throw new Error('Setiap baris personel harus memiliki nama.');
    row.ktpName = String(person && person.ktpName || row.nama).trim();
    row.ktpFileId = String(person && person.ktpFileId || '').trim();
    row.ktpBase64 = String(person && person.ktpBase64 || '');
    if (row.ktpName.length > 100) throw new Error('Nama lampiran KTP terlalu panjang (maksimal 100 karakter).');
    if (row.ktpFileId && !/^[A-Za-z0-9_-]{10,}$/.test(row.ktpFileId)) throw new Error(`Unggahan KTP untuk ${row.nama} tidak valid. Pilih ulang fotonya.`);
    if (row.ktpBase64.length > 3000000) throw new Error(`Foto KTP untuk ${row.nama} melebihi batas ukuran lampiran.`);
      return row;
    });
    const photoCount = rows.filter((row) => row.ktpFileId || row.ktpBase64).length;
    if (photoCount > 30) throw new Error('Maksimal 30 foto KTP per memo. Buat memo terpisah untuk lampiran berikutnya.');
    return rows;
}

function requiredText_(value, label, maxLength) {
  const result = String(value || '').trim();
  if (!result) throw new Error(`${label} wajib diisi.`);
  if (result.length > maxLength) throw new Error(`${label} terlalu panjang (maksimal ${maxLength} karakter).`);
  return result;
}

function formatDocNumber_(projectCode, typeKey, sequence, date) {
  const month = Number(Utilities.formatDate(date, APP.timezone, 'M'));
  const roman = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'][month - 1];
  const year = Utilities.formatDate(date, APP.timezone, 'yy');
  return `${projectCode}/${APP.types[typeKey].code}/${roman}/${year}/${String(sequence).padStart(2, '0')}`;
}

function getCounters_(requestedPeriod) {
  const period = requestedPeriod || Utilities.formatDate(new Date(), APP.timezone, 'yyyy_MM');
  const props = PropertiesService.getScriptProperties();
  const result = { period };
  Object.keys(APP.types).forEach((type) => {
    result[type] = Number(props.getProperty(`COUNTER_${period}_${type}`)) || 0;
  });
  return result;
}

function getArchiveFolder_(projectCode, period) {
  const root = getArchiveRootFolder_();
  const projectFolders = root.getFoldersByName(safeFileName_(projectCode));
  const project = projectFolders.hasNext() ? projectFolders.next() : root.createFolder(safeFileName_(projectCode));
  const periodName = period.replace('_', '-');
  const periodFolders = project.getFoldersByName(periodName);
  return periodFolders.hasNext() ? periodFolders.next() : project.createFolder(periodName);
}

function getArchiveRootFolder_() {
  const props = PropertiesService.getScriptProperties();
  let rootId = props.getProperty('DRIVE_ROOT_FOLDER_ID');
  if (rootId) {
    return DriveApp.getFolderById(rootId);
  }
  const root = DriveApp.createFolder('Arsip Memo UTP');
  props.setProperty('DRIVE_ROOT_FOLDER_ID', root.getId());
  return root;
}

function getMemoHistorySheet_(createIfMissing) {
  const props = PropertiesService.getScriptProperties();
  const historyId = props.getProperty('MEMO_HISTORY_SHEET_ID');
  if (historyId) {
    const sheet = SpreadsheetApp.openById(historyId).getSheets()[0];
    if (!sheet.getRange(1, 10).getValue()) {
      sheet.getRange(1, 10).setValue('Draf WhatsApp')
        .setFontWeight('bold').setBackground('#1e3a8a').setFontColor('#ffffff');
    }
    migrateExistingMemoRequests_(sheet);
    return sheet;
  }
  if (!createIfMissing) return null;

  const spreadsheet = SpreadsheetApp.create('Riwayat Memo UTP');
  const file = DriveApp.getFileById(spreadsheet.getId());
  file.moveTo(getArchiveRootFolder_());
  const sheet = spreadsheet.getSheets()[0];
  sheet.setName('Riwayat');
  sheet.getRange(1, 1, 1, 10).setValues([[
    'Waktu dibuat', 'Nomor dokumen', 'Jenis', 'Proyek', 'Tanggal dokumen',
    'Google Sheets', 'PDF', 'Folder arsip', 'File arsip (JSON)', 'Draf WhatsApp'
  ]]);
  sheet.getRange(1, 1, 1, 10).setFontWeight('bold').setBackground('#1e3a8a').setFontColor('#ffffff');
  sheet.setFrozenRows(1);
  props.setProperty('MEMO_HISTORY_SHEET_ID', spreadsheet.getId());
  migrateExistingMemoRequests_(sheet);
  return sheet;
}

function migrateExistingMemoRequests_(sheet) {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('MEMO_HISTORY_MIGRATED') === 'true') return;
  const knownNumbers = new Set();
  if (sheet.getLastRow() > 1) {
    sheet.getRange(2, 2, sheet.getLastRow() - 1, 1).getDisplayValues()
      .forEach((row) => knownNumbers.add(row[0]));
  }
  const requests = Object.keys(props.getProperties())
    .filter((key) => key.indexOf('MEMO_REQUEST_') === 0)
    .map((key) => {
      try {
        const value = JSON.parse(props.getProperty(key));
        if (!value || typeof value !== 'object') throw new Error('Format permintaan lama tidak valid.');
        return { key, value };
      } catch (error) {
        console.error(`Riwayat lama ${key} tidak dapat dibaca: ${error.message}`);
        return null;
      }
    })
    .filter(Boolean)
    .sort((left, right) => Number(left.value.createdAt) - Number(right.value.createdAt));

  requests.forEach(({ key, value }) => {
    const result = value.result || {};
    const number = String(result.docNumber || '');
    if (!number || knownNumbers.has(number)) return;
    const sheetId = getDriveIdFromUrl_(result.sheetUrl);
    const pdfId = getDriveIdFromUrl_(result.pdfUrl);
    const folderId = getDriveIdFromUrl_(result.folderUrl);
    let project = '';
    let documentDate = '';
    let memoType = '';
    if (sheetId) {
      try {
        const spreadsheet = SpreadsheetApp.openById(sheetId);
        const memoSheet = spreadsheet.getSheets()[0];
        project = memoSheet.getRange('J3').getDisplayValue() ||
          memoSheet.getRange('E9').getDisplayValue() ||
          memoSheet.getRange('B4').getDisplayValue();
        const rawDate = memoSheet.getRange('E8').getValue() || memoSheet.getRange('B6').getValue();
        if (rawDate instanceof Date) {
          documentDate = Utilities.formatDate(rawDate, APP.timezone, 'yyyy-MM-dd');
        } else if (/^\d{4}-\d{2}-\d{2}$/.test(String(rawDate))) {
          documentDate = String(rawDate);
        }
        memoType = memoSheet.getRange('E12').getDisplayValue() ||
          memoSheet.getRange('B3').getDisplayValue();
      } catch (error) {
        console.error(`Detail memo lama ${number} tidak dapat dibaca dari spreadsheet ${sheetId}: ${error.message}`);
      }
    }
    if (!project && folderId) {
      try {
        const folder = DriveApp.getFolderById(folderId);
        const parents = folder.getParents();
        if (parents.hasNext()) project = parents.next().getName();
      } catch (error) {
        console.error(`Folder memo lama ${number} tidak dapat dibaca (${folderId}): ${error.message}`);
      }
    }
    const type = inferMemoType_(number, memoType);
    const files = [];
    [result.sheetUrl, result.pdfUrl, result.ktpPdfUrl].forEach((url) => {
      const id = getDriveIdFromUrl_(url);
      if (id) {
        try {
          const file = DriveApp.getFileById(id);
          files.push({ id, name: file.getName(), url: file.getUrl() });
        } catch (error) {
          console.error(`File memo lama ${id} tidak dapat dibaca: ${error.message}`);
        }
      }
    });
    if (folderId && Array.isArray(result.imageNames)) {
      try {
        const folder = DriveApp.getFolderById(folderId);
        const names = new Set(result.imageNames);
        const folderFiles = folder.getFiles();
        while (folderFiles.hasNext()) {
          const file = folderFiles.next();
          if (names.has(file.getName())) files.push({ id: file.getId(), name: file.getName(), url: file.getUrl() });
        }
      } catch (error) {
        console.error(`Lampiran memo lama ${number} tidak dapat dibaca: ${error.message}`);
      }
    }
    const createdAt = Number(value.createdAt);
    sheet.appendRow([
      Number.isFinite(createdAt) && createdAt ? new Date(createdAt) : new Date(),
      number,
      type,
      project,
      documentDate,
      result.sheetUrl || '',
      result.pdfUrl || '',
      result.folderUrl || '',
      JSON.stringify(files),
      ''
    ]);
    knownNumbers.add(number);
    console.log(`Riwayat memo lama dipulihkan dari ${key}.`);
  });
  props.setProperty('MEMO_HISTORY_MIGRATED', 'true');
}

function getDriveIdFromUrl_(url) {
  const match = String(url || '').match(/\/(?:d|folders)\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : '';
}

function inferMemoType_(number, label) {
  const value = `${number} ${label}`.toLowerCase();
  if (value.indexOf('penggantian') >= 0 || /\/mm\.pg\//i.test(number)) return 'PG';
  if (value.indexOf('surplus') >= 0 || /\/mm\.sp\//i.test(number)) return 'SP';
  if (value.indexOf('penambahan') >= 0 || /\/mm\.pn\//i.test(number)) return 'PN';
  return 'PN';
}

function appendMemoHistory_(data, number, documentDate, sheetFile, pdfFile, folder, createdFileIds) {
  const sheet = getMemoHistorySheet_(true);
  const files = createdFileIds.map((id) => {
    const file = DriveApp.getFileById(id);
    return { id, name: file.getName(), url: file.getUrl() };
  });
  const row = sheet.getLastRow() + 1;
  sheet.getRange(row, 1, 1, 10).setValues([[
    new Date(),
    number,
    data.typeKey,
    data.projectName,
    Utilities.formatDate(documentDate, APP.timezone, 'yyyy-MM-dd'),
    sheetFile ? sheetFile.getUrl() : '',
    pdfFile ? pdfFile.getUrl() : '',
    folder.getUrl(),
    JSON.stringify(files),
    buildMemoWhatsAppDraft_(data, number, documentDate, sheetFile, pdfFile, folder)
  ]]);
  return { sheet, row };
}

function buildMemoWhatsAppDraft_(data, number, documentDate, sheetFile, pdfFile, folder) {
  const recipient = data.waRecipient || 'Pak Juwana (PM)';
  let count = '';
  if (data.typeKey === 'PN') count = `\nJumlah tambahan: ${data.workers.length} orang`;
  if (data.typeKey === 'PG') count = `\nJumlah keluar: ${data.workersOut.length} orang\nJumlah pengganti masuk: ${data.workersIn.length} orang`;
  if (data.typeKey === 'SP') count = `\nJumlah surplus: ${data.workers.length} orang`;
  const dateText = Utilities.formatDate(documentDate, APP.timezone, 'dd MMM yyyy');
  let draft = `Yth. ${recipient},\n\nBerikut kami sampaikan memo internal proyek:\n\nPT. UNICORN TOSAN PERKASA\nNo. Dokumen: ${number}\nProyek: ${data.projectName}\nPerihal: ${APP.types[data.typeKey].label}\nTanggal: ${dateText}${count}`;
  if (sheetFile) draft += `\n\nLink Spreadsheet:\n${sheetFile.getUrl()}`;
  if (pdfFile) draft += `\n\nLink PDF:\n${pdfFile.getUrl()}`;
  draft += `\n\nFolder Arsip:\n${folder.getUrl()}`;
  return draft + '\n\nMohon ditinjau dan ditindaklanjuti. Terima kasih.';
}

function getManpowerSheet_(createIfMissing) {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('MANPOWER_SHEET_ID');
  if (id) return SpreadsheetApp.openById(id).getSheets()[0];
  if (!createIfMissing) return null;

  const spreadsheet = SpreadsheetApp.create('Data Manpower UTP');
  const sheet = spreadsheet.getSheets()[0];
  sheet.setName('Manpower');
  sheet.getRange(1, 1, 1, 15).setValues([[
    'Waktu dicatat', 'Nama', 'Status', 'Proyek', 'Domisili', 'Bidang',
    'Keahlian', 'Foreman', 'Tanggal mulai', 'Tanggal selesai', 'Area kerja',
    'Nama lampiran KTP', 'File KTP', 'Nomor memo', 'Sumber'
  ]]);
  sheet.getRange(1, 1, 1, 15).setFontWeight('bold').setBackground('#1e3a8a').setFontColor('#ffffff');
  sheet.setFrozenRows(1);
  props.setProperty('MANPOWER_SHEET_ID', spreadsheet.getId());
  return sheet;
}

function getLatestManpowerRows_(sheet) {
  const latest = new Map();
  if (sheet.getLastRow() < 2) return latest;
  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, 15).getDisplayValues();
  values.forEach((row) => {
    const key = normalizePersonKey_(row[1], row[3]);
    if (key) latest.set(key, {
      name: row[1], status: row[2], project: row[3], domicile: row[4],
      department: row[5], skill: row[6], foreman: row[7], startDate: row[8],
      endDate: row[9], workArea: row[10], ktpName: row[11], ktpUrl: row[12],
      memoNumber: row[13], source: row[14]
    });
  });
  return latest;
}

function normalizePersonName_(name) {
  return String(name || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('id');
}

function normalizePersonKey_(name, project) {
  return `${normalizePersonName_(name)}|${normalizePersonName_(project)}`;
}

function appendManpowerRow_(sheet, person) {
  sheet.appendRow([
    new Date(), person.name, person.status, person.project, person.domicile,
    person.department, person.skill, person.foreman, person.startDate,
    person.endDate, person.workArea, person.ktpName, person.ktpUrl,
    person.memoNumber, person.source
  ]);
}

function appendManpowerEvents_(data, number, documentDate) {
  const sheet = getManpowerSheet_(true);
  const latest = getLatestManpowerRows_(sheet);
  const events = [];
  const add = (person, status, endDate, source) => {
    const key = normalizePersonKey_(person.nama, data.projectName);
    const previous = latest.get(key) || {};
    const ktpFile = person.ktpFile || null;
    const current = {
      name: person.nama,
      status,
      project: data.projectName,
      domicile: person.domisili || previous.domicile || '',
      department: person.bidang || previous.department || '',
      skill: person.keahlian || previous.skill || '',
      foreman: person.foreman || previous.foreman || '',
      startDate: person.tglMulai || previous.startDate || '',
      endDate: status === 'AKTIF' ? '' : endDate || previous.endDate || '',
      workArea: person.areaKerja || person.tujuan || previous.workArea || '',
      ktpName: ktpFile ? person.ktpName : previous.ktpName || '',
      ktpUrl: ktpFile ? ktpFile.getUrl() : previous.ktpUrl || '',
      memoNumber: number,
      source
    };
    events.push(current);
    latest.set(key, current);
  };

  if (data.typeKey === 'PN') {
    data.workers.forEach((person) => add(person, 'AKTIF', '', 'Memo PN'));
  } else if (data.typeKey === 'PG') {
    const effectiveDate = data.berlakuEfektif || Utilities.formatDate(documentDate, APP.timezone, 'yyyy-MM-dd');
    data.workersOut.forEach((person) => add(person, 'NONAKTIF', effectiveDate, 'Memo PG - keluar'));
    data.workersIn.forEach((person) => add(person, 'AKTIF', '', 'Memo PG - masuk'));
  } else {
    data.workers.forEach((person) => add(person, 'NONAKTIF', person.tglTerakhir || Utilities.formatDate(documentDate, APP.timezone, 'yyyy-MM-dd'), 'Memo SP'));
  }
  const firstRow = sheet.getLastRow() + 1;
  sheet.getRange(firstRow, 1, events.length, 15).setValues(events.map((person) => [
    new Date(), person.name, person.status, person.project, person.domicile,
    person.department, person.skill, person.foreman, person.startDate,
    person.endDate, person.workArea, person.ktpName, person.ktpUrl,
    person.memoNumber, person.source
  ]));
  return { sheet, row: firstRow, count: events.length };
}

function trashArchiveFiles_(folder, protectedIds) {
  const protectedSet = new Set(protectedIds);
  const failures = [];
  let count = 0;
  const files = folder.getFiles();
  while (files.hasNext()) {
    const file = files.next();
    if (protectedSet.has(file.getId())) continue;
    try {
      file.setTrashed(true);
      count += 1;
    } catch (error) {
      console.error(`Gagal memindahkan arsip ${file.getId()} ke Sampah: ${error.message}`);
      failures.push(file.getName());
    }
  }
  const folders = folder.getFolders();
  while (folders.hasNext()) {
    const result = trashArchiveFiles_(folders.next(), protectedIds);
    count += result.count;
    failures.push(...result.failures);
  }
  return { count, failures };
}

function saveKtpImages_(data, folder, number, createdFileIds) {
  const people = data.typeKey === 'PG'
    ? data.workersOut.concat(data.workersIn)
    : data.workers;
  return people.filter((person) => person.ktpFileId || person.ktpBase64).map((person, index) => {
    const label = safeFileName_(String(person.ktpName || person.nama || `KTP-${index + 1}`).slice(0, 60));
    let file;
    if (person.ktpFileId) {
      file = DriveApp.getFileById(person.ktpFileId);
      const pending = getPendingKtpFolder_(false);
      let belongsToPendingFolder = false;
      if (pending) {
        const parents = file.getParents();
        while (parents.hasNext()) if (parents.next().getId() === pending.getId()) belongsToPendingFolder = true;
      }
      if (!belongsToPendingFolder) throw new Error(`Foto KTP untuk ${person.nama} tidak ditemukan. Pilih ulang fotonya.`);
      if (!/^image\/(jpeg|png)$/.test(file.getMimeType()) || file.getSize() > 2 * 1024 * 1024) {
        throw new Error(`Foto KTP untuk ${person.nama} tidak valid atau melebihi 2 MB.`);
      }
      const extension = { 'image/jpeg': 'jpg', 'image/png': 'png' }[file.getMimeType()];
      file.setName(`${number}-${label}.${extension}`);
      file.moveTo(folder);
    } else {
      const match = person.ktpBase64.match(/^data:(image\/(?:jpeg|png));base64,([a-zA-Z0-9+/=]+)$/);
      if (!match) throw new Error(`Foto KTP untuk ${person.nama} tidak valid. Pilih ulang file JPG atau PNG.`);
      const bytes = Utilities.base64Decode(match[2]);
      if (bytes.length > 2 * 1024 * 1024) throw new Error(`Foto KTP asli untuk ${person.nama} maksimal 2 MB.`);
      const extension = { 'image/jpeg': 'jpg', 'image/png': 'png' }[match[1]];
      file = folder.createFile(Utilities.newBlob(bytes, match[1], `${number}-${label}.${extension}`));
    }
    createdFileIds.push(file.getId());
    person.ktpFile = file;
    return { file, name: person.ktpName || person.nama, personName: person.nama };
  });
}

function createSpreadsheet_(data, number, folder, imageFiles, createdFileIds) {
  const propertyName = `TEMPLATE_${data.typeKey}_ID`;
  const templateId = PropertiesService.getScriptProperties().getProperty(propertyName);
  if (!templateId) {
    throw new Error(`Template ${data.typeKey} belum diatur. Isi Script Property ${propertyName} dengan ID Google Sheets template ${data.typeKey}.`);
  }
  const templateFile = DriveApp.getFileById(templateId);
  if (templateFile.getMimeType() !== MimeType.GOOGLE_SHEETS) {
    throw new Error(`File pada ${propertyName} bukan Google Sheets. Buka file Excel template di Google Sheets, simpan sebagai Google Sheets, lalu gunakan ID file hasil konversi.`);
  }
  const file = templateFile.makeCopy(`${number} - ${data.perihal}`, folder);
  createdFileIds.push(file.getId());
  const spreadsheet = SpreadsheetApp.openById(file.getId());
  const sheet = spreadsheet.getSheets()[0];
  if (data.typeKey === 'PG') {
    populateReplacementTemplate_(sheet, data);
  } else {
    populatePeopleTemplate_(sheet, data);
  }
  if (imageFiles.length) addKtpAttachmentSheet_(spreadsheet, imageFiles);
  sheet.getRange('J2').setValue(number);
  sheet.getRange('J3').setValue(data.projectName);
  sheet.getRange('J5').setValue(dateFromIso_(data.berlakuEfektif));
  sheet.getRange('E8').setValue(dateFromIso_(data.tanggalDoc));
  sheet.getRange('E9').setValue(data.projectName);
  sheet.getRange('E11').setValue(data.ditujukan);
  sheet.getRange('E12').setValue(data.perihal);
  sheet.getDataRange().setFontSize(12);
  trimMemoToColumnK_(sheet);
  replaceTemplateLogoWithColor_(sheet);
  return file;
}

function trimMemoToColumnK_(sheet) {
  const columns = sheet.getMaxColumns();
  if (columns > 11) sheet.deleteColumns(12, columns - 11);
}

function replaceTemplateLogoWithColor_(sheet) {
  try {
    const response = UrlFetchApp.fetch('https://www.unicorn.co.id/utility/images/Logo-Unicorn180x82px.jpg', { muteHttpExceptions: true });
    if (response.getResponseCode() !== 200) return;
    const candidates = sheet.getImages().filter((image) => {
      const anchor = image.getAnchorCell();
      return anchor.getRow() <= 6 && anchor.getColumn() <= 5;
    });
    if (candidates.length) candidates[0].replace(response.getBlob().setName('Logo UTP berwarna.jpg'));
  } catch (error) {
    console.error(`Logo template tidak dapat diganti: ${error.message}`);
  }
}

function addKtpAttachmentSheet_(spreadsheet, imageFiles) {
  const sheet = spreadsheet.insertSheet('Lampiran KTP');
  spreadsheet.setActiveSheet(sheet);
  spreadsheet.moveActiveSheet(2);
  sheet.setColumnWidths(1, 11, 58);
  sheet.setColumnWidth(6, 18);
  sheet.getRange('A1:K1').merge().setValue('LAMPIRAN FOTO KTP').setFontWeight('bold').setFontSize(14).setHorizontalAlignment('center').setVerticalAlignment('middle');
  sheet.setRowHeight(1, 36);
  imageFiles.forEach((item, index) => {
    const column = index % 2 === 0 ? 1 : 7;
    const cardRow = 3 + Math.floor(index / 2) * 15;
    const card = sheet.getRange(cardRow, column, 13, 5);
    card.setBorder(true, true, true, true, true, true).setHorizontalAlignment('center').setVerticalAlignment('middle');
    sheet.setRowHeights(cardRow, 9, 30);
    const image = sheet.insertImage(item.file.getBlob(), column, cardRow + 1);
    const scale = Math.min(250 / image.getWidth(), 250 / image.getHeight(), 1);
    image.setWidth(Math.max(1, Math.round(image.getWidth() * scale)))
      .setHeight(Math.max(1, Math.round(image.getHeight() * scale)));
    image.setAnchorCellXOffset(Math.max(0, Math.round((290 - image.getWidth()) / 2)));
    image.setAnchorCellYOffset(8);
    sheet.getRange(cardRow + 10, column, 1, 5).merge()
      .setValue(item.name)
      .setFontWeight('bold')
      .setFontSize(11).setHorizontalAlignment('center');
    sheet.getRange(cardRow + 11, column, 1, 5).merge()
      .setValue(`Nama personel: ${item.personName}`)
      .setFontSize(10).setHorizontalAlignment('center');
  });
}

function populatePeopleTemplate_(sheet, data) {
  const isAddition = data.typeKey === 'PN';
  const people = data.workers;
  const dataStart = 19;
  const templateCount = isAddition ? 5 : 2;
  resizeTemplateRows_(sheet, dataStart, templateCount, people.length, 19);
  const values = people.map((person, index) => [
    index + 1,
    person.nama,
    isAddition ? person.domisili : person.bidang,
    isAddition ? person.bidang : person.keahlian,
    isAddition ? person.keahlian : formatLongDate_(person.tglTerakhir),
    isAddition ? formatShortDate_(person.tglMulai) : person.tujuan,
    ...(isAddition ? [person.areaKerja] : [])
  ]);
  sheet.getRange(dataStart, 4, values.length, values[0].length).setValues(values);
  const bodyText = sheet.getRange('D16').getDisplayValue();
  sheet.getRange('D16').setValue(replaceTemplateProject_(bodyText, data.projectName));
}

function populateReplacementTemplate_(sheet, data) {
  const outStart = 20;
  const inStart = 26;
  const outDelta = resizeTemplateRows_(sheet, outStart, 1, data.workersOut.length, 20);
  const inStartAfterOut = inStart + outDelta;
  resizeTemplateRows_(sheet, inStartAfterOut, 1, data.workersIn.length, inStartAfterOut);

  setTemplatePeople_(sheet, outStart, data.workersOut, 'PGOut');
  setTemplatePeople_(sheet, inStartAfterOut, data.workersIn, 'PGIn');
  const existingSubject = sheet.getRange('E16').getDisplayValue();
  const subjectWithoutParentheses = existingSubject.replace(/\s*\([^)]*\)/g, '');
  sheet.getRange('E16').setValue(replaceTemplateProject_(subjectWithoutParentheses, data.projectName));
  sheet.getRange(23 + outDelta, 4).setValue('Dan berikut data os penggantinya :');
}

function replaceTemplateProject_(text, projectName) {
  const value = String(text || '');
  const projectIndex = value.search(/Proyek\s+/i);
  if (projectIndex < 0) return value;
  return `${value.slice(0, projectIndex)}Proyek ${projectName}`;
}

function setTemplatePeople_(sheet, startRow, people, schemaKey) {
  if (!people.length) return;
  const schema = APP.schemas[schemaKey];
  const rows = people.map((person, index) => [
    index + 1,
    person.nama,
    person.keahlian,
    person.bidang,
    person.foreman,
    formatLongDate_(person.tglMulai),
    person.keterangan
  ]);
  sheet.getRange(startRow, 4, rows.length, schema.length + 1).setValues(rows);
}

function resizeTemplateRows_(sheet, dataStart, templateCount, desiredCount, formatSourceRow) {
  const difference = desiredCount - templateCount;
  if (difference > 0) {
    const afterRow = dataStart + templateCount - 1;
    sheet.insertRowsAfter(afterRow, difference);
    const lastColumn = sheet.getMaxColumns();
    for (let index = 0; index < difference; index += 1) {
      const newRow = afterRow + index + 1;
      sheet.getRange(formatSourceRow, 1, 1, lastColumn).copyTo(
        sheet.getRange(newRow, 1, 1, lastColumn),
        SpreadsheetApp.CopyPasteType.PASTE_FORMAT,
        false
      );
      sheet.setRowHeight(newRow, sheet.getRowHeight(formatSourceRow));
    }
  } else if (difference < 0) {
    sheet.deleteRows(dataStart + desiredCount, -difference);
  }
  return difference;
}

function dateFromIso_(value) {
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

function formatShortDate_(value) {
  if (!value) return '';
  const date = dateFromIso_(value);
  const month = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'][date.getMonth()];
  return `${String(date.getDate()).padStart(2, '0')}-${month}-${String(date.getFullYear()).slice(-2)}`;
}

function formatLongDate_(value) {
  if (!value) return '';
  const date = dateFromIso_(value);
  const month = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'][date.getMonth()];
  return `${date.getDate()} ${month} ${date.getFullYear()}`;
}

function createPdf_(spreadsheetFile, number, folder, createdFileIds, sheet, portrait, suffix) {
  const spreadsheet = SpreadsheetApp.openById(spreadsheetFile.getId());
  const pageOrientation = portrait ? 'true' : 'false';
  const url = `https://docs.google.com/spreadsheets/d/${spreadsheet.getId()}/export?format=pdf&size=A4&portrait=${pageOrientation}&fitw=true&scale=4&sheetnames=false&printtitle=false&pagenumbers=false&gridlines=false&horizontal_alignment=CENTER&vertical_alignment=CENTER&top_margin=0.35&bottom_margin=0.35&left_margin=0.35&right_margin=0.35&gid=${sheet.getSheetId()}`;
  const response = UrlFetchApp.fetch(url, {
    headers: { Authorization: `Bearer ${ScriptApp.getOAuthToken()}` }
  });
  if (response.getResponseCode() !== 200) {
    throw new Error(`Ekspor template ke PDF gagal (HTTP ${response.getResponseCode()}).`);
  }
  const pdf = folder.createFile(response.getBlob().setName(`${number}${suffix || ''}.pdf`));
  if (createdFileIds) createdFileIds.push(pdf.getId());
  return pdf;
}

function checkMemoTemplates() {
  const props = PropertiesService.getScriptProperties();
  const types = ['PN', 'PG', 'SP'];
  const results = types.map((type) => {
    const propertyName = `TEMPLATE_${type}_ID`;
    const id = props.getProperty(propertyName);
    if (!id) throw new Error(`Script Property ${propertyName} belum diisi.`);
    const file = DriveApp.getFileById(id);
    if (file.getMimeType() !== MimeType.GOOGLE_SHEETS) {
      throw new Error(`${propertyName} harus berisi ID file template yang sudah dikonversi ke Google Sheets.`);
    }
    const spreadsheet = SpreadsheetApp.openById(id);
    if (!spreadsheet.getSheets().length) throw new Error(`Template ${type} tidak memiliki sheet.`);
    return `${type}: ${spreadsheet.getName()} siap digunakan`;
  });
  return results.join('\n');
}

function safeFileName_(value) {
  return String(value || 'Memo').replace(/[\\/:*?"<>|#%{}~&]/g, '-').trim().slice(0, 100) || 'Memo';
}

function processTelegramUpdate_(update) {
  const message = update.message;
  const callback = update.callback_query;
  const from = message ? message.from : callback && callback.from;
  const chatId = message ? message.chat.id : callback && callback.message.chat.id;
  if (!from || !chatId) return;
  const chatType = message ? message.chat.type : callback && callback.message.chat.type;
  if (chatType !== 'private') return;

  const props = PropertiesService.getScriptProperties();
  const ownerId = props.getProperty('OWNER_TELEGRAM_ID');
  if (!ownerId) {
    const text = String(message && message.text || '').trim().split(/\s+/)[0].split('@')[0].toLowerCase();
    if (message && (text === '/id' || text === '/start' || text === '/help')) {
      sendTelegramMessage_(chatId,
        `Bot sudah menerima pesan Anda.\nTelegram user ID: ${from.id}\n\nMasukkan angka tersebut pada Script Properties OWNER_TELEGRAM_ID, simpan, lalu kirim /start lagi.`);
    }
    return;
  }
  if (String(from.id) !== String(ownerId)) {
    if (message && /^\/(start|help|id)(@\w+)?$/i.test(String(message.text || '').trim())) {
      sendTelegramMessage_(chatId, 'Bot merespons, tetapi akun Telegram ini bukan akun pemilik yang terdaftar.');
    }
    return;
  }

  if (callback) {
    answerTelegramCallback_(callback.id);
    if (callback.data === 'status') {
      const counters = getCounters_();
      sendTelegramMessage_(chatId, `📊 STATUS NOMOR MEMO\nPeriode: ${counters.period}\nPN: ${counters.PN}\nPG: ${counters.PG}\nSP: ${counters.SP}`);
    } else {
      sendTelegramMessage_(chatId, 'Buka dashboard Web untuk mengelola memo. Penghapusan memerlukan kode konfirmasi.');
    }
    return;
  }

  const text = String(message.text || '').trim();
  const command = text.split(/\s+/)[0].split('@')[0].toLowerCase();
  if (command === '/start' || command === '/help') {
    const webUrl = getWebAppUrl_();
    const menu = {
      inline_keyboard: [
        [{ text: '🌐 Buka Dashboard Website', url: webUrl }],
        [{ text: '➕ Buat Memo', web_app: { url: getWebAppUrl_() } }],
        [
          { text: '📄 Penambahan', web_app: { url: getWebAppUrl_('PN') } },
          { text: '🔁 Penggantian', web_app: { url: getWebAppUrl_('PG') } },
          { text: '📉 Surplus', web_app: { url: getWebAppUrl_('SP') } }
        ],
        [{ text: '📊 Cek Nomor Memo', callback_data: 'status' }]
      ]
    };
    sendTelegramMessage_(chatId,
      `🏢 ADMINISTRASI MEMO UTP\n\nSelamat datang, ${props.getProperty('APP_OWNER_NAME') || 'Pemilik'}!\n\nGunakan tombol di bawah untuk membuka website, membuat memo, atau mengecek nomor dokumen. Website dan bot terhubung ke aplikasi memo yang sama.\n\nPerintah: /new, /pn, /pg, /sp, /status, /help`, menu);
  } else if (command === '/new' || command === '/pn' || command === '/pg' || command === '/sp') {
    const type = command === '/pn' ? 'PN' : command === '/pg' ? 'PG' : command === '/sp' ? 'SP' : '';
    sendTelegramMessage_(chatId, 'Buka formulir memo:', { inline_keyboard: [[{
      text: type ? `Buat ${APP.types[type].label}` : 'Buka formulir memo',
      web_app: { url: getWebAppUrl_(type) }
    }]] });
  } else if (command === '/status') {
    const counters = getCounters_();
    sendTelegramMessage_(chatId, `Periode ${counters.period}\nPN: ${counters.PN}\nPG: ${counters.PG}\nSP: ${counters.SP}`);
  } else if (command === '/reset') {
    sendTelegramMessage_(chatId, 'Buka website lalu pilih menu Pengaturan. Penghapusan arsip atau riwayat dan Hard Reset memerlukan kode konfirmasi.');
  } else if (command === '/setwebhook') {
    sendTelegramMessage_(chatId, setTelegramWebhook_());
  } else {
    sendTelegramMessage_(chatId, 'Perintah tidak dikenal. Kirim /help untuk daftar perintah.');
  }
}

function resetCounter_(type) {
  if (type !== 'ALL' && !APP.types[type]) throw new Error('Jenis memo tidak dikenal.');
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const period = Utilities.formatDate(new Date(), APP.timezone, 'yyyy_MM');
    const props = PropertiesService.getScriptProperties();
    Object.keys(APP.types).forEach((key) => {
      if (type === 'ALL' || key === type) props.setProperty(`COUNTER_${period}_${key}`, '0');
    });
    return `Counter ${type === 'ALL' ? 'semua jenis' : type} periode ${period} berhasil direset.`;
  } finally {
    lock.releaseLock();
  }
}

function getTelegramSetupInfo() {
  const status = getTelegramStatus_();
  return [
    `Bot: @${status.botUsername}`,
    `Webhook aktif: ${status.webhookActive ? 'Ya' : 'Tidak'}`,
    `OWNER_TELEGRAM_ID terisi: ${status.ownerConfigured ? 'Ya' : 'Tidak'}`,
    `Update menunggu: ${status.pendingUpdates}`,
    status.lastError ? `Pesan error Telegram: ${status.lastError}` : 'Tidak ada error webhook terbaru.'
  ].join('\n');
}

function getWebAppUrl_(type) {
  const base = PropertiesService.getScriptProperties().getProperty('WEB_APP_URL') || ScriptApp.getService().getUrl();
  return type ? `${base}?type=${encodeURIComponent(type)}` : base;
}

function setTelegramWebhook_() {
  const props = PropertiesService.getScriptProperties();
  const token = props.getProperty('TELEGRAM_BOT_TOKEN');
  const secret = props.getProperty('BOT_WEBHOOK_KEY');
  const url = ScriptApp.getService().getUrl();
  if (!token || !secret || !url) throw new Error('Isi TELEGRAM_BOT_TOKEN dan BOT_WEBHOOK_KEY, lalu deploy sebagai Web App.');
  props.setProperty('WEB_APP_URL', url);
  const response = UrlFetchApp.fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: 'post',
    payload: { url: `${url}?key=${encodeURIComponent(secret)}` },
    muteHttpExceptions: true
  });
  const result = JSON.parse(response.getContentText());
  if (!result.ok) throw new Error(`Telegram menolak pemasangan webhook: ${result.description}`);
  const status = getTelegramStatus_();
  if (!status.webhookActive) throw new Error('Telegram menerima pemasangan, tetapi URL webhook yang aktif tidak cocok dengan deployment ini. Periksa deployment Web App.');
  return `URL webhook terdaftar untuk @${status.botUsername}. Kirim /start, lalu cek Diagnostik Telegram untuk memastikan Telegram menerima respons aplikasi.`;
}

function getTelegramStatus_() {
  const props = PropertiesService.getScriptProperties();
  const token = props.getProperty('TELEGRAM_BOT_TOKEN');
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN belum diatur di Script Properties.');
  const bot = telegramApiGet_(token, 'getMe');
  const webhook = telegramApiGet_(token, 'getWebhookInfo');
  const expectedUrl = ScriptApp.getService().getUrl();
  const activeUrl = String(webhook.url || '');
  const activeBaseUrl = activeUrl.split('?')[0];
  const lastErrorDate = Number(webhook.last_error_date || 0);
  return {
    botUsername: bot.username || '',
    webhookActive: Boolean(activeUrl && activeBaseUrl === expectedUrl),
    pendingUpdates: Number(webhook.pending_update_count || 0),
    lastError: webhook.last_error_message
      ? `${webhook.last_error_message}${lastErrorDate ? ` (${Utilities.formatDate(new Date(lastErrorDate * 1000), APP.timezone, 'yyyy-MM-dd HH:mm:ss')})` : ''}`
      : '',
    ownerConfigured: Boolean(props.getProperty('OWNER_TELEGRAM_ID')),
    ownerName: props.getProperty('APP_OWNER_NAME') || 'Pemilik'
  };
}

function telegramApiGet_(token, method) {
  const response = UrlFetchApp.fetch(`https://api.telegram.org/bot${token}/${method}`, {
    muteHttpExceptions: true
  });
  const result = JSON.parse(response.getContentText());
  if (!result.ok) throw new Error(`Telegram ${method} gagal: ${result.description}`);
  return result.result;
}

function sendTelegramMessage_(chatId, text, replyMarkup) {
  const token = PropertiesService.getScriptProperties().getProperty('TELEGRAM_BOT_TOKEN');
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN belum diatur.');
  const payload = { chat_id: chatId, text };
  if (replyMarkup) payload.reply_markup = JSON.stringify(replyMarkup);
  const response = UrlFetchApp.fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
  const result = JSON.parse(response.getContentText());
  if (!result.ok) throw new Error(`Telegram gagal mengirim pesan: ${result.description}`);
}

function answerTelegramCallback_(callbackId) {
  const token = PropertiesService.getScriptProperties().getProperty('TELEGRAM_BOT_TOKEN');
  const response = UrlFetchApp.fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({ callback_query_id: callbackId }),
    muteHttpExceptions: true
  });
  const result = JSON.parse(response.getContentText());
  if (!result.ok) throw new Error(`Telegram gagal mengonfirmasi tombol: ${result.description}`);
}
