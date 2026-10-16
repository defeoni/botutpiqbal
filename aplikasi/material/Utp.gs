/* Single-user project storage. Only locator IDs and secrets belong in Properties. */
function utpDb_(create) {
  var props = PropertiesService.getScriptProperties(), id = props.getProperty('UTP_DATABASE_ID');
  if (id) return SpreadsheetApp.openById(id);
  if (!create) return null;
  var book = SpreadsheetApp.create('UTP · Terrasentra · Administrasi');
  props.setProperty('UTP_DATABASE_ID', book.getId());
  return book;
}
function utpSheet_(name, create) {
  var db = utpDb_(create); if (!db) return null;
  var sheet = db.getSheetByName(name);
  if (!sheet && create) { sheet = db.insertSheet(name); sheet.appendRow(['ID', 'Version', 'Data JSON', 'Updated']); sheet.setFrozenRows(1); }
  return sheet;
}
function utpRead_(entity, archived) {
  var sheet = utpSheet_(entity, false); if (!sheet || sheet.getLastRow() < 2) return [];
  return sheet.getRange(2, 3, sheet.getLastRow() - 1, 1).getValues().map(function (row) { return JSON.parse(row[0]); }).filter(function (r) { return archived || !r.archived; });
}
function utpGet_(entity, id) { return utpRead_(entity, true).find(function (r) { return r.id === id; }) || null; }
function utpAuditPayload_(entity, record, previous) {
  var changes = {};
  Object.keys(record).forEach(function (key) {
    if (key === 'history') return;
    var before = previous && Object.prototype.hasOwnProperty.call(previous, key) ? previous[key] : null;
    if (!previous || JSON.stringify(before) !== JSON.stringify(record[key])) changes[key] = { before: before, after: record[key] };
  });
  Object.keys(previous || {}).forEach(function (key) {
    if (key !== 'history' && !Object.prototype.hasOwnProperty.call(record, key)) changes[key] = { before: previous[key], after: null };
  });
  return { entity: entity, id: record.id, version: record.version, changes: changes };
}
function utpWrite_(entity, record, version) {
  var sheet = utpSheet_(entity, true), previous = utpGet_(entity, record.id), now = new Date().toISOString();
  if (previous && previous.version !== Number(version)) throw new Error('Data berubah di sesi lain. Muat ulang sebelum menyimpan.');
  record.id = record.id || Utilities.getUuid(); record.version = previous ? previous.version + 1 : 1;
  record.createdAt = previous ? previous.createdAt : now; record.updatedAt = now;
  var json = JSON.stringify(record), auditJson = JSON.stringify(utpAuditPayload_(entity, record, previous));
  if (json.length > 45000) throw new Error('Riwayat dokumen terlalu besar. Arsipkan sebelum menambahkan perubahan.');
  if (auditJson.length > 45000) throw new Error('Perubahan terlalu besar untuk dicatat audit; data belum disimpan. Kurangi perubahan lalu coba lagi.');
  var audit = utpSheet_('audit', true);
  var found = sheet.getLastRow() > 1 ? sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).createTextFinder(record.id).matchEntireCell(true).findNext() : null;
  sheet.getRange(found ? found.getRow() : sheet.getLastRow() + 1, 1, 1, 4).setValues([[record.id, record.version, json, now]]);
  try { audit.appendRow([Utilities.getUuid(), record.version, auditJson, now]); }
  catch (error) {
    var auditError = new Error('Data tersimpan pada versi ' + record.version + ', tetapi pencatatan audit gagal: ' + error.message);
    auditError.recordSaved = true;
    throw auditError;
  }
  return record;
}
function utpContext_() { return {approvals:utpRead_('approvals'),newId:function(){return Utilities.getUuid();},now:new Date().toISOString()}; }
function utpRequireRecord_(entity, payload) {
  var r = utpGet_(entity, payload.id);
  if (!r || r.archived) throw new Error('Data tidak ditemukan atau sudah diarsipkan.');
  if (r.version !== Number(payload.version)) throw new Error('Data telah berubah. Muat ulang.');
  return r;
}
function utpProtected_(entity, record) {
  return !!record && ((entity === 'requests' && ['FINAL','ARRIVED'].indexOf(record.status)>=0) ||
    (entity === 'approvals' && record.status === 'APPROVED') || (entity === 'receipts' && record.status === 'CONFIRMED') || entity === 'funds');
}
function utpMaster_() {
  var sheet = utpSheet_('master', false); if (!sheet || sheet.getLastRow()<2) return [];
  var favorites = (utpGet_('config','settings') || {}).favorites || [];
  return sheet.getRange(2,1,sheet.getLastRow()-1,UTP_MASTER_FIELDS.length).getDisplayValues().map(function(row){
    var r={}; UTP_MASTER_FIELDS.forEach(function(k,i){r[k]=row[i];}); r.favorite=favorites.indexOf(r.code)>=0; return r;
  });
}
function utpDocument_(id) { return utpRead_('documents').find(function(d){return d.fileId===id && d.uploadedByUtp;}); }
function utpFinalEvidence_(id) {
  var document = id && utpDocument_(id);
  return document && /^(application\/pdf|image\/(jpeg|png))$/.test(document.mime) ? document : null;
}
function utpFilesFolder_() {
  var props = PropertiesService.getScriptProperties(), folderId = props.getProperty('UTP_FILES_FOLDER_ID');
  var folder = folderId && props.getProperty('UTP_FILES_FOLDER_PRIVATE') === 'true' ? DriveApp.getFolderById(folderId) : null;
  if (folder && folder.getSharingAccess() === DriveApp.Access.PRIVATE) return folder;
  folder = DriveApp.createFolder('Administrasi Terrasentra · Dokumen');
  if (folder.getSharingAccess() !== DriveApp.Access.PRIVATE) throw new Error('Folder dokumen baru tidak privat.');
  props.setProperty('UTP_FILES_FOLDER_ID', folder.getId());
  props.setProperty('UTP_FILES_FOLDER_PRIVATE', 'true');
  return folder;
}
function utpBootstrap_() {
  var out={project:UTP_PROJECT, settings:utpGet_('config','settings')||{},dataInitialized:!!utpDb_(false)};
  UTP_ENTITIES.forEach(function(e){out[e]=utpRead_(e);});
  var sheet=utpSheet_('master',false); out.masterCount=sheet?Math.max(0,sheet.getLastRow()-1):0;
  out.forecasts=utpForecast_(out.purchases);out.finance=utpFinance_(out.funds,out.receipts);return out;
}
function apiUtp(action, payload, token) {
  requireAuthorized_(token); var p=payload||{};
  if(action==='bootstrap') return utpBootstrap_();
  if(action==='list') return {records:utpRead_(utpEntity_(p.entity),p.includeArchived)};
  if(action==='detail') return {record:utpGet_(utpEntity_(p.entity),p.id)};
  if(action==='searchItems') return utpSearchItems_(utpMaster_(),p,utpRead_('approvals'));
  if(action==='importPreview') {var plan=utpPreviewImport_(p.csv,utpMaster_());delete plan.items;delete plan.rows;return plan;}
  var lock=LockService.getScriptLock();lock.waitLock(30000);
  try {return utpMutate_(action,p,utpContext_());} finally {lock.releaseLock();}
}
function utpMutate_(action,p,ctx) {
  var r,old,entity;
  if(action==='save') {
    entity=utpEntity_(p.entity);old=p.record.id?utpRequireRecord_(entity,p.record):null;
    if(utpProtected_(entity,old))requireDeletePin_(p.pin);
    r=utpValidateRecord_(entity,p.record,old,ctx); r.id=old?old.id:Utilities.getUuid();
    if(entity==='receipts' && r.status==='CONFIRMED') {
      if(!utpGet_('funds',r.fundId)||utpGet_('funds',r.fundId).archived)throw new Error('Pilih sumber dana aktif.');
      if(!utpDocument_(r.fileId))throw new Error('Unggah foto nota sebelum konfirmasi.');
    }
    if(entity==='requests') {
      r=utpRecordRequestSave_(r,old,ctx.now,p.actor||'Admin');
      if(r.finalFileId&&!utpFinalEvidence_(r.finalFileId))throw new Error('Bukti final harus berupa PDF/JPG/PNG terdaftar melalui aplikasi.');
      if(old&&['FINAL','ARRIVED'].indexOf(old.status)>=0&&utpRequestReachedHo_(old)&&!utpFinalEvidence_(r.finalFileId))throw new Error('Bukti final HO tidak boleh dihapus atau diganti dengan file yang tidak sesuai.');
    }
    return {record:utpWrite_(entity,r,old?old.version:null),warnings:[]};
  }
  if(action==='archive') {
    entity=utpEntity_(p.entity);r=utpRequireRecord_(entity,p);
    if(!(entity==='requests'&&r.status==='DRAFT'))requireDeletePin_(p.pin);
    if(entity==='funds'&&utpRead_('receipts').some(function(x){return x.fundId===r.id;}))throw new Error('Dana masih digunakan oleh nota.');
    r.archived=true;return {record:utpWrite_(entity,r,p.version)};
  }
  if(action==='requestTransition'||action==='publishRevision') {
    r=utpRequireRecord_('requests',p);if(utpProtected_('requests',r))requireDeletePin_(p.pin);
    ctx.actor=p.actor||'Admin';ctx.note=p.note;
    if(action==='publishRevision')r=utpPublishRevision_(r,ctx);
    else {ctx.validFinalEvidence=!!utpFinalEvidence_(r.finalFileId);r=utpTransitionRequest_(r,p.status,ctx);}
    return {record:utpWrite_('requests',r,p.version)};
  }
  if(action==='taskComplete'||action==='taskReopen') {
    r=utpRequireRecord_('tasks',p);
    if(action==='taskReopen')requireDeletePin_(p.pin);
    r.status=action==='taskComplete'?'DONE':'OPEN';r.completedAt=r.status==='DONE'?ctx.now:'';
    if(p.evidenceId){if(!utpDocument_(p.evidenceId))throw new Error('Bukti tidak ditemukan.');r.evidenceId=p.evidenceId;}
    r.note=utpText_(p.note||r.note,'Catatan',5000,false);return {record:utpWrite_('tasks',r,p.version)};
  }
  if(action==='upload') return utpUpload_(p);
  if(action==='favorite') {
    var settings=utpGet_('config','settings')||{id:'settings',favorites:[]};
    var code=utpText_(p.code,'Kode',160,true), list=settings.favorites||[];
    settings.favorites=list.indexOf(code)>=0?list.filter(function(x){return x!==code;}):list.concat([code]);
    utpWrite_('config',settings,settings.version);return {favorite:settings.favorites.indexOf(code)>=0};
  }
  if(action==='settings') {
    requireDeletePin_(p.pin);
    if(!p.settings||typeof p.settings!=='object'||Array.isArray(p.settings))throw new Error('Pengaturan tidak valid.');
    var allowedSettings=['favorites'];
    Object.keys(p.settings).forEach(function(key){if(allowedSettings.indexOf(key)<0)throw new Error('Pengaturan tidak diizinkan: '+key+'.');});
    var savedSettings=utpGet_('config','settings')||{id:'settings',favorites:[]};
    if(Object.prototype.hasOwnProperty.call(p.settings,'favorites')) {
      if(!Array.isArray(p.settings.favorites))throw new Error('Daftar favorit tidak valid.');
      var seenFavorites=Object.create(null);
      savedSettings.favorites=p.settings.favorites.map(function(value){
        var favorite=utpText_(value,'Kode favorit',160,true);
        if(seenFavorites[favorite])throw new Error('Kode favorit duplikat.');
        seenFavorites[favorite]=true;return favorite;
      });
    }
    return {settings:utpWrite_('config',savedSettings,savedSettings.version)};
  }
  if(action==='importCommit') {
    requireDeletePin_(p.pin);var current=utpMaster_(), plan=utpPreviewImport_(p.csv,current);
    if(plan.invalid.length)throw new Error('Perbaiki baris impor yang tidak valid sebelum menerapkan.');
    var byCode=new Map(current.map(function(x){return[x.code,x];}));
    plan.items.forEach(function(item){byCode.set(item.code,item);});
    var all=Array.from(byCode.values()), sheet=utpSheet_('master',true);
    // One batched write; no removal of omitted official codes. Plain text preserves zero prefixes and prevents formulas.
    var values=[UTP_MASTER_FIELDS].concat(all.map(function(x){return UTP_MASTER_FIELDS.map(function(k){var v=String(x[k]||'');return /^[=+\-@]/.test(v)?"'"+v:v;});}));
    if(sheet.getMaxRows()<values.length)sheet.insertRowsAfter(sheet.getMaxRows(),values.length-sheet.getMaxRows());
    sheet.getRange(1,1,values.length,UTP_MASTER_FIELDS.length).setNumberFormat('@').setValues(values);
    utpWrite_('imports',{id:Utilities.getUuid(),added:plan.added,updated:plan.updated,total:all.length},null);
    return {imported:all.length,added:plan.added,updated:plan.updated};
  }
  if(action==='draftEmail') {
    r=utpRequireRecord_('requests',p);var finalDoc=utpFinalEvidence_(r.finalFileId);
    if(!finalDoc)throw new Error('Lampirkan dokumen final sebelum menyiapkan email.');
    var ids=[r.finalFileId];(p.attachmentIds||[]).forEach(function(id){if(!utpDocument_(id))throw new Error('Lampiran tidak terdaftar.');if(ids.indexOf(id)<0)ids.push(id);});
    var subject='['+UTP_PROJECT.code+'] '+(r.number||'Permintaan material')+' — '+r.title;
    var body='Yth. Project Engineering,\n\nMohon diproses permintaan '+r.title+' untuk proyek '+UTP_PROJECT.name+'.\nNomor: '+(r.number||'Belum ditetapkan')+' / REV '+String(r.revision||0).padStart(3,'0')+'\n\nDokumen pendukung terlampir.\n\nTerima kasih.';
    var draft=GmailApp.createDraft('project.engineering@unicorn.co.id',subject,body,{cc:'Yuni.lestari@unicorn.co.id',attachments:ids.map(function(id){return DriveApp.getFileById(id).getBlob();})});
    return {id:draft.getId(),url:'https://mail.google.com/mail/u/0/#drafts',subject:subject};
  }
  throw new Error('Tindakan UTP belum didukung: '+action);
}
function utpUpload_(p) {
  var allowed=['application/pdf','image/jpeg','image/png','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
  if(allowed.indexOf(p.mime)<0)throw new Error('Gunakan PDF, JPG, PNG, Word, atau Excel.');
  if(typeof p.base64!=='string'||p.base64.length>7e6)throw new Error('Ukuran file maksimal 5 MB.');
  var bytes=Utilities.base64Decode(p.base64);if(!bytes.length||bytes.length>5*1024*1024)throw new Error('File kosong atau terlalu besar.');
  var name=utpText_(p.name,'Nama file',200,true).replace(/[\\/]/g,'_'),folder=utpFilesFolder_();
  var digest=Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,bytes));
  var duplicate=utpRead_('documents').find(function(d){return d.digest===digest;});if(duplicate)return {id:duplicate.fileId,url:duplicate.url,name:duplicate.name,mime:duplicate.mime,duplicate:true};
  var file=folder.createFile(Utilities.newBlob(bytes,p.mime,name));
  try {utpWrite_('documents',{id:Utilities.getUuid(),fileId:file.getId(),name:name,mime:p.mime,size:bytes.length,url:file.getUrl(),kind:utpText_(p.kind,'Jenis',100,false),recordId:utpText_(p.recordId,'Referensi',160,false),digest:digest,uploadedByUtp:true},null);}
  catch(error){if(!error.recordSaved)file.setTrashed(true);throw error;}
  return {id:file.getId(),url:file.getUrl(),name:name,mime:p.mime,size:bytes.length};
}
