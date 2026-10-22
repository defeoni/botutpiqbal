/* Single-user project storage. Only locator IDs and secrets belong in Properties. */
var UTP_MASTER_REFERENCE_ID = '1QwxMjbawlF1tZ_hVu0XVnRKIS1NtADFGy8RC8syRjYU';
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
function utpMasterSheet_() {
  var local = utpSheet_('master', false);
  if (local && local.getLastRow() > 1) return local;
  var id = PropertiesService.getScriptProperties().getProperty('UTP_MASTER_SOURCE_ID') || UTP_MASTER_REFERENCE_ID;
  if (!id) return local;
  var source = SpreadsheetApp.openById(id).getSheetByName('master');
  if (!source) throw new Error('Tab master pada sumber material tidak ditemukan.');
  var headers = source.getRange(1,1,1,UTP_MASTER_FIELDS.length).getDisplayValues()[0];
  if (headers.some(function(value,index){return value!==UTP_MASTER_FIELDS[index];})) throw new Error('Kolom master material tidak sesuai.');
  return source;
}
function utpMaster_() {
  var sheet = utpMasterSheet_(); if (!sheet || sheet.getLastRow()<2) return [];
  var favorites = (utpGet_('config','settings') || {}).favorites || [];
  return utpMasterRows_(sheet).map(function(row){
    var r={}; UTP_MASTER_FIELDS.forEach(function(k,i){r[k]=row[i];}); r.favorite=favorites.indexOf(r.code)>=0; return r;
  });
}
function utpMasterRows_(sheet){
  // Cache only shared catalog text. Favorites and project approvals remain live.
  var cache,key,count=sheet.getLastRow()-1;
  try{
    cache=CacheService.getScriptCache();
    var fileId=sheet.getParent().getId(),modified=DriveApp.getFileById(fileId).getLastUpdated().getTime();
    var epoch=PropertiesService.getScriptProperties().getProperty('UTP_MASTER_CACHE_REVISION')||'0';
    key='utp.master.v1.'+fileId+'.'+sheet.getSheetId()+'.'+modified+'.'+count+'.'+epoch;
    var manifest=JSON.parse(cache.get(key)||'null');
    if(manifest&&manifest.chunks>0&&manifest.chunks<=24){
      var keys=Array.from({length:manifest.chunks},function(_,i){return key+'.'+i;}),parts=cache.getAll(keys);
      if(keys.every(function(k){return typeof parts[k]==='string';})){
        var rows=JSON.parse(Utilities.ungzip(Utilities.newBlob(Utilities.base64Decode(keys.map(function(k){return parts[k];}).join('')),'application/gzip')).getDataAsString());
        if(Array.isArray(rows)&&rows.length===count&&rows.every(function(r){return Array.isArray(r)&&r.length===UTP_MASTER_FIELDS.length;}))return rows;
      }
    }
  }catch(ignored){/* Missing/evicted cache must never block material entry. */}
  var rows=sheet.getRange(2,1,count,UTP_MASTER_FIELDS.length).getDisplayValues();
  if(cache&&key)try{
    var packed=Utilities.base64Encode(Utilities.gzip(Utilities.newBlob(JSON.stringify(rows))).getBytes()),chunks=Math.ceil(packed.length/80000);
    if(chunks>0&&chunks<=24){var data={};for(var i=0;i<chunks;i++)data[key+'.'+i]=packed.slice(i*80000,(i+1)*80000);cache.putAll(data,120);cache.put(key,JSON.stringify({chunks:chunks}),120);}
  }catch(ignored){/* Sheets remains the authoritative fallback. */}
  return rows;
}
function utpDocument_(id) { return utpRead_('documents').find(function(d){return d.fileId===id && d.uploadedByUtp;}); }
function utpFinalEvidence_(id) {
  var document = id && utpDocument_(id);
  return document && /^(application\/pdf|image\/(jpeg|png))$/.test(document.mime) ? document : null;
}
function utpFilesFolder_() {
  var props = PropertiesService.getScriptProperties(), folderId = props.getProperty('UTP_FILES_FOLDER_ID'), folder = null;
  if (folderId) { try { folder = DriveApp.getFolderById(folderId); } catch (error) { folder = null; } }
  if (folder && folder.getSharingAccess() === DriveApp.Access.PRIVATE && !(folder.getEditors && folder.getEditors().length) && !(folder.getViewers && folder.getViewers().length)) return folder;
  folder = sistemDriveInternalFolder_('Dokumen Privat', true);
  sistemDriveProtect_(folder, true);
  props.setProperty('UTP_FILES_FOLDER_ID', folder.getId());
  props.setProperty('UTP_FILES_FOLDER_PRIVATE', 'true');
  return folder;
}
function utpMaterialDraftsEnabled_() { return PropertiesService.getScriptProperties().getProperty('UTP_MATERIAL_DRAFTS_ENABLED') !== 'false'; }
function utpBootstrap_() {
  var out={project:UTP_PROJECT, settings:utpGet_('config','settings')||{},dataInitialized:!!utpDb_(false),capabilities:{materialDrafts:utpMaterialDraftsEnabled_(),materialWorkflow:utpMaterialDraftsEnabled_()}};
  UTP_ENTITIES.forEach(function(e){out[e]=utpRead_(e);});
  var sheet=utpMasterSheet_(); out.masterCount=sheet?Math.max(0,sheet.getLastRow()-1):0;
  out.forecasts=utpForecast_(out.purchases);out.finance=utpFinance_(out.funds,out.receipts);return out;
}
function apiUtp(action, payload, token) {
  requireAuthorized_(token); var p=payload||{};
  if(action==='bootstrap') return utpBootstrap_();
  if(action==='list') return {records:utpRead_(utpEntity_(p.entity),p.includeArchived)};
  if(action==='detail') return {record:utpGet_(utpEntity_(p.entity),p.id)};
  if(action==='searchItems'){var scope=workspaceProjectId_(p.projectId,true);return utpSearchItems_(utpMaster_(),p,utpRead_('approvals').filter(function(r){return workspaceProjectMatches_(r,scope);}));}
  if(action==='importPreview') {var plan=utpPreviewImport_(p.csv,utpMaster_());delete plan.items;delete plan.rows;return plan;}
  var lock=LockService.getScriptLock();lock.waitLock(30000);
  try {return utpMutate_(action,p,utpContext_());} finally {lock.releaseLock();}
}
function utpMutate_(action,p,ctx) {
  var r,old,entity;
  if(action==='materialCommand') {
    if(!utpMaterialDraftsEnabled_())throw new Error('Workflow Material dinonaktifkan.');
    old=utpGet_('requests',p.id);
    if(!old||old.archived)throw new Error('Permintaan tidak ditemukan.');
    if(old.version!==Number(p.version))return {conflict:true,record:old};
    if(utpProtected_('requests',old)||['FINALIZE','REVISION','ARRIVAL','FULFILLMENT'].indexOf(p.operation)>=0)requireDeletePin_(p.pin);
    ctx.party=p.party;ctx.reason=p.reason;ctx.confirmed=p.confirmed;ctx.coveredItemIds=p.coveredItemIds;ctx.arrivalDate=p.arrivalDate;
    if(p.operation==='FINAL_FILE') {
      ctx.evidence=utpFinalEvidence_(p.fileId);
      if(!ctx.evidence||ctx.evidence.recordId!==old.id||ctx.evidence.kind!=='MATERIAL_FINAL_HO')throw new Error('Bukti HO harus diunggah untuk permintaan ini.');
      var evidenceFile=DriveApp.getFileById(ctx.evidence.fileId);
      if(evidenceFile.isTrashed()||evidenceFile.getMimeType()!==ctx.evidence.mime)throw new Error('File bukti HO tidak tersedia atau format berubah.');
    }
    r=utpMaterialCommand_(p.operation,p.record,old,ctx);r.projectId=old.projectId||'legacy';
    if(p.operation==='FINALIZE')r.items.filter(function(item){return r.finalItemIds.indexOf(item.id)>=0&&item.requiredAuthority==='HO';}).forEach(function(item){
      var finalDocument=utpFinalEvidence_(item.finalFileId);
      if(!finalDocument||finalDocument.recordId!==r.id||finalDocument.kind!=='MATERIAL_FINAL_HO')throw new Error('Bukti final HO belum terdaftar untuk dokumen ini.');
      var finalFile=DriveApp.getFileById(item.finalFileId);if(finalFile.isTrashed()||finalFile.getMimeType()!==finalDocument.mime)throw new Error('Bukti final HO sudah tidak tersedia.');
    });
    try{return {record:utpWrite_('requests',r,old.version),warnings:[]};}
    catch(error){if(!error.recordSaved)throw error;return {record:utpGet_('requests',old.id),warnings:[error.message],recordSaved:true};}
  }
  if(action==='saveMaterialDraft') {
    if(!utpMaterialDraftsEnabled_())throw new Error('Penyimpanan draf Material belum diaktifkan.');
    var source=p.record;
    if(!source || typeof source!=='object' || Array.isArray(source))throw new Error('Draf Material tidak valid.');
    if(typeof source.id!=='string' || source.id.length>160 || !/^local-[a-z0-9][a-z0-9-]*$/i.test(source.id))throw new Error('ID draf lokal harus valid dan stabil.');
    if(!Number.isInteger(source.version) || source.version<0)throw new Error('Versi draf tidak valid.');
    old=utpGet_('requests',source.id);
    if(old && (old.archived || old.itemContractVersion!==1 || old.status!=='DRAFT' || old.initialSnapshot))throw new Error('Hanya draf Material per item aktif yang dapat diubah.');
    if(old && old.version!==source.version)return {conflict:true,record:old};
    if(!old && source.version!==0)throw new Error('Draf tidak ditemukan. Data tidak dibuat ulang.');
    r=utpValidateMaterialDraft_(source,old,ctx);r.id=source.id;r.projectId=workspaceProjectId_(old&&old.projectId||source.projectId||'legacy',false);r.workspaceDocumentId=old&&old.workspaceDocumentId||workspaceDocumentId_(source.workspaceDocumentId,r.projectId);
    r=utpRecordRequestSave_(r,old,ctx.now,p.actor||'Admin');
    try {return {record:utpWrite_('requests',r,source.version),warnings:[]};}
    catch(error) {
      if(!error.recordSaved)throw error;
      var saved=utpGet_('requests',source.id);
      if(!saved)throw error;
      return {record:saved,warnings:[error.message],recordSaved:true};
    }
  }
  if(action==='save') {
    entity=utpEntity_(p.entity);old=p.record.id?utpRequireRecord_(entity,p.record):null;
    if(entity==='requests' && (old && old.itemContractVersion===1 || p.record.itemContractVersion===1))throw new Error('Draf Material per item harus memakai penyimpanan khusus.');
    if(utpProtected_(entity,old))requireDeletePin_(p.pin);
    r=utpValidateRecord_(entity,p.record,old,ctx); r.id=old?old.id:Utilities.getUuid();r.projectId=workspaceProjectId_(old&&old.projectId||p.record.projectId||'legacy',false);if(['requests','approvals'].indexOf(entity)>=0)r.workspaceDocumentId=old&&old.workspaceDocumentId||workspaceDocumentId_(p.record.workspaceDocumentId,r.projectId);
    if(entity==='approvals') {
      if(r.status==='APPROVED'&&(!old||old.status!=='APPROVED'))requireDeletePin_(p.pin);
      if(r.brochureId&&!utpDocument_(r.brochureId))throw new Error('Brosur harus diunggah melalui aplikasi.');
    }
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
    if(r.itemContractVersion===1)throw new Error('Workflow Material per item belum diaktifkan.');
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
    PropertiesService.getScriptProperties().setProperty('UTP_MASTER_CACHE_REVISION',Utilities.getUuid());
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
  var allowed=['application/pdf','image/jpeg','image/png','application/msword','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
  if(allowed.indexOf(p.mime)<0)throw new Error('Gunakan PDF, JPG, PNG, Word, atau Excel.');
  if(typeof p.base64!=='string'||p.base64.length>7e6)throw new Error('Ukuran file maksimal 5 MB.');
  var bytes=Utilities.base64Decode(p.base64);if(!bytes.length||bytes.length>5*1024*1024)throw new Error('File kosong atau terlalu besar.');
  var name=utpText_(p.name,'Nama file',200,true).replace(/[\\/]/g,'_'),folder=utpFilesFolder_();
  var digest=Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,bytes));
  var duplicate=utpRead_('documents').find(function(d){return d.digest===digest&&d.recordId===(p.recordId||'')&&d.kind===(p.kind||'');});if(duplicate)return {id:duplicate.fileId,url:duplicate.url,name:duplicate.name,mime:duplicate.mime,duplicate:true};
  var file=folder.createFile(Utilities.newBlob(bytes,p.mime,name));
  try {utpWrite_('documents',{id:Utilities.getUuid(),fileId:file.getId(),name:name,mime:p.mime,size:bytes.length,url:file.getUrl(),kind:utpText_(p.kind,'Jenis',100,false),recordId:utpText_(p.recordId,'Referensi',160,false),digest:digest,uploadedByUtp:true},null);}
  catch(error){if(!error.recordSaved)file.setTrashed(true);throw error;}
  return {id:file.getId(),url:file.getUrl(),name:name,mime:p.mime,size:bytes.length};
}
