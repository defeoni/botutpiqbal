/* Project folders and document worklists. Existing records are never reassigned implicitly. */
function workspaceProjectId_(value, allowAll) {
  var id=workspaceText_(value,100);
  if (allowAll && (!id || id==='all')) return 'all';
  if (id==='legacy') return id;
  var project=id&&utpGet_('workspaceProjects',id);
  if (!project || project.archived) throw new Error('Pilih proyek yang sudah disimpan.');
  return id;
}
function workspaceDocumentId_(value,projectId) {
  var id=workspaceText_(value,100);
  if(!id)return '';
  var document=utpGet_('workspaceDocuments',id);
  if(!document||document.archived||(document.projectId||'legacy')!==projectId)throw new Error('Referensi draf Pusat Dokumen tidak valid untuk proyek ini.');
  return id;
}
function workspaceProjectMatches_(record,id) {
  return id==='all' || (record.projectId||'legacy')===id;
}
function workspaceDocumentSameSource_(link,type,id) {
  return !!link&&String(link.type||'')===String(type||'')&&String(link.id||'')===String(id||'');
}
function workspaceDocumentLink_(documentId,projectId,sourceType,sourceId,details) {
  var id=workspaceText_(documentId,100);
  if(!id)return {warning:''};
  var scope=workspaceProjectId_(projectId,false),type=workspaceText_(sourceType,40),key=workspaceText_(sourceId,100);
  if(!type||!key)return {warning:'Jenis atau ID record sumber kosong; kartu draf belum tertaut.'};
  var doc=utpGet_('workspaceDocuments',id);
  if(!doc||doc.archived)return {warning:'Kartu draf Pusat Dokumen tidak ditemukan; tautan belum dicatat.'};
  if((doc.projectId||'legacy')!==scope)return {warning:'Kartu draf bukan milik proyek ini; tautan belum dicatat.'};
  if(doc.linkedSource){
    if(workspaceDocumentSameSource_(doc.linkedSource,type,key))return {record:doc,warning:''};
    return {warning:'Kartu draf sudah tertaut ke '+String(doc.linkedSource.type||'record')+' '+String(doc.linkedSource.id||'')+'; tautan baru tidak menimpa.'};
  }
  var updated=JSON.parse(JSON.stringify(doc));
  updated.linkedSource={type:type,id:key,at:new Date().toISOString()};
  if(details&&details.url)updated.linkedSource.url=workspaceText_(details.url,1000);
  try{return {record:utpWrite_('workspaceDocuments',updated,doc.version),warning:''};}
  catch(error){
    if(error.recordSaved)return {record:utpGet_('workspaceDocuments',updated.id),warning:'Tautan draf tersimpan tetapi audit gagal: '+error.message};
    return {warning:'Tautan draf gagal dicatat: '+error.message};
  }
}
function workspaceDocumentPendingCopy_(projectId,requestId) {
  if(!requestId)return null;
  return (utpRead_('documentCopies')||[]).filter(function(row){return !row.archived&&row.clientRequestId===requestId&&(row.projectId||'legacy')===projectId;})[0]||null;
}
function workspaceDocumentRememberCopy_(projectId,requestId,fields) {
  var existing=workspaceDocumentPendingCopy_(projectId,requestId),record=existing||{id:Utilities.getUuid(),projectId:projectId,clientRequestId:requestId};
  ['templateSourceId','fileId','fileUrl','fileName','fileMimeType'].forEach(function(key){if(fields[key]!=null)record[key]=fields[key];});
  try{return utpWrite_('documentCopies',record,existing?existing.version:0);}
  catch(error){if(error.recordSaved)return utpGet_('documentCopies',record.id);throw error;}
}
function workspaceDocumentClearPendingCopy_(projectId,requestId) {
  var existing=workspaceDocumentPendingCopy_(projectId,requestId);
  if(!existing)return;
  existing.archived=true;
  try{utpWrite_('documentCopies',existing,existing.version);}
  catch(error){console.error('Penanda salinan dokumen gagal dibersihkan: '+error.message);}
}
function workspaceDocumentTemplateCopy_(projectId,templateSourceId,title) {
  var sourceId=workspaceText_(templateSourceId,100);
  if(!sourceId)return null;
  if(!/^[a-zA-Z0-9_-]{10,100}$/.test(sourceId))throw new Error('ID template Drive tidak valid.');
  var source=DriveApp.getFileById(sourceId),mime=source.getMimeType?String(source.getMimeType()):'';
  if(/folder/i.test(mime))throw new Error('Template berupa folder tidak dapat disalin sebagai dokumen.');
  var sourceName=String(source.getName()||''),dot=sourceName.lastIndexOf('.'),extension=dot>0?sourceName.slice(dot):'';
  var name=title+(extension&&title.slice(-extension.length).toLowerCase()!==extension.toLowerCase()?extension:'');
  var copy=source.makeCopy(name,workspaceProjectFolder_(projectId,'Dokumen'));
  return {templateSourceId:sourceId,fileId:copy.getId(),fileUrl:copy.getUrl(),fileName:copy.getName(),fileMimeType:copy.getMimeType?copy.getMimeType():mime};
}
function sistemDriveSubpathFrom_(base,path) {
  var parts=String(path||'').split('/').filter(function(part){return !!part;}),folder=base;
  for(var i=0;i<parts.length;i++)folder=getOrCreateArchiveSubfolder_(folder,parts[i]);
  return folder;
}
function workspaceProjectBase_(project) {
  var root=getArchiveRootFolder_();
  if(!project)return getOrCreateArchiveSubfolder_(root,SISTEM_DRIVE_.legacy);
  var container=getOrCreateArchiveSubfolder_(root,SISTEM_DRIVE_.projects),base=getOrCreateArchiveSubfolder_(container,sistemDriveProjectLabel_(project));
  SISTEM_DRIVE_.projectSections.forEach(function(name){getOrCreateArchiveSubfolder_(base,name);});
  return base;
}
function workspaceProjectFolder_(projectId,type) {
  var id=workspaceProjectId_(projectId,false),project=id==='legacy'?null:utpGet_('workspaceProjects',id);
  var base=workspaceProjectBase_(project);
  return type?sistemDriveSubpathFrom_(base,sistemDriveTypePath_(type)):base;
}
function workspaceProjectFolderByName_(projectName,type) {
  var projects=utpRead_('workspaceProjects').filter(function(project){return !project.archived;}),match=sistemDriveMatchProject_(projectName,projects);
  var base=workspaceProjectBase_(match.project||null);
  return type?sistemDriveSubpathFrom_(base,sistemDriveTypePath_(type)):base;
}
function apiProjects(action,payload,token) {
  requireAuthorized_(token);
  var p=payload||{};
  if(action==='list') return {projects:utpRead_('workspaceProjects'),pinDeferred:developmentPinDeferred_()};
  if(action==='documents') {
    var documentScope=workspaceProjectId_(p.projectId,true),reconcile=workspaceDocumentReconcile_(documentScope,token),index=projectDocumentIndex_(documentScope,token);
    index.warnings=(index.warnings||[]).concat(reconcile.warnings||[]);
    return index;
  }
  if(action!=='save') throw new Error('Tindakan proyek tidak dikenal.');
  var lock=LockService.getScriptLock();lock.waitLock(30000);
  try {
    var input=p.record||{},old=input.id?utpGet_('workspaceProjects',input.id):null;
    if(old?old.version!==Number(input.version):Number(input.version||0)!==0) return {conflict:true,record:old};
    var record={id:old?old.id:Utilities.getUuid()};
    ['name','code','pm','mk','owner','location','start','end','note'].forEach(function(k){record[k]=workspaceText_(input[k],k==='note'?2000:200);});
    if(!record.name||!record.code)throw new Error('Nama dan kode proyek wajib diisi.');
    if(record.start)workspaceDate_(record.start);if(record.end)workspaceDate_(record.end);
    if(record.start&&record.end&&record.end<record.start)throw new Error('Tanggal akhir mendahului tanggal mulai.');
    if(utpRead_('workspaceProjects').some(function(r){return r.id!==record.id&&r.code.toLowerCase()===record.code.toLowerCase();}))throw new Error('Kode proyek sudah digunakan.');
    try{return {record:utpWrite_('workspaceProjects',record,old?old.version:0)};}catch(e){if(e.recordSaved)return {record:utpGet_('workspaceProjects',record.id),warning:e.message};throw e;}
  } finally {lock.releaseLock();}
}
function workspaceDocumentReconcile_(projectId,token) {
  var result={changed:0,warnings:[]};
  if(!projectId||projectId==='all')return result;
  var lock=LockService.getScriptLock();
  try{lock.waitLock(5000);}
  catch(lockError){result.warnings.push('Rekonsiliasi draf ditunda: lock sibuk.');return result;}
  try{
    var drafts=utpRead_('workspaceDocuments').filter(function(d){return !d.archived&&!d.linkedSource&&(d.projectId||'legacy')===projectId;});
    if(!drafts.length)return result;
    var byId={};drafts.forEach(function(d){byId[d.id]=d;});
    var sources=[];
    utpRead_('workspaceRpd').forEach(function(r){sources.push({type:'rpd',id:r.id,documentId:r.workspaceDocumentId,projectId:r.projectId||'legacy'});});
    try{apiGetMemoHistory(token).forEach(function(r){sources.push({type:'memo',id:r.number,documentId:r.workspaceDocumentId,projectId:r.projectId||'legacy'});});}
    catch(memoError){result.warnings.push('Riwayat Memo tidak dapat direkonsiliasi: '+memoError.message);}
    try{getRpbHistory_().forEach(function(r){sources.push({type:'rpb',id:r.id,documentId:r.data&&r.data.workspaceDocumentId,projectId:(r.data&&r.data.projectId)||'legacy'});});}
    catch(rpbError){result.warnings.push('Riwayat RPB tidak dapat direkonsiliasi: '+rpbError.message);}
    sources.forEach(function(source){
      if(!source.documentId||(source.projectId||'legacy')!==projectId)return;
      var draft=byId[source.documentId];
      if(!draft||draft.linkedSource)return;
      var updated=JSON.parse(JSON.stringify(draft));
      updated.linkedSource={type:source.type,id:source.id,at:new Date().toISOString()};
      try{utpWrite_('workspaceDocuments',updated,draft.version);draft.linkedSource=updated.linkedSource;result.changed+=1;}
      catch(linkError){result.warnings.push('Rekonsiliasi draf '+draft.id+' gagal: '+linkError.message);}
    });
  }finally{lock.releaseLock();}
  return result;
}
function projectDocumentIndex_(projectId,token) {
  var documents=[],warnings=[];
  function add(source,load){try{load().forEach(function(r){if(workspaceProjectMatches_(r,projectId))documents.push(r);});}catch(e){warnings.push(source+': '+e.message);}}
  add('Dokumen',function(){return utpRead_('workspaceDocuments').map(function(r){return Object.assign({source:'document'},r);});});
  add('LPD',function(){return utpRead_('workspaceLpd').map(function(r){return {id:'lpd:'+r.id,source:'lpd',sourceId:r.id,projectId:r.projectId,title:'LPD '+r.month+' · '+r.id.slice(0,8),status:r.status==='COMPLETE'?'SELESAI':r.status==='SENT'?'DIAJUKAN':'DRAFT',due:r.deadline&&r.deadline.due||'',record:r};});});
  ['rpd','archives','finance','tasks'].forEach(function(module){add(module,function(){return utpRead_(WORKSPACE_MODULES_[module]).map(function(r){return {id:module+':'+r.id,source:module,sourceId:r.id,projectId:r.projectId||'legacy',workspaceDocumentId:r.workspaceDocumentId||'',title:r.name||r.purpose,status:r.status==='DRAFT'||r.status==='Draf'?'DRAFT':r.status==='Selesai dicatat'?'SELESAI':'DIAJUKAN',date:r.date,due:module==='rpd'?r.date:r.fields&&r.fields.due||'',url:r.proof||r.fields&&(r.fields.location||r.fields.proof||r.fields.documentUrl)||'',record:r};});});});
  add('RPB',function(){return getRpbHistory_().map(function(r){return {id:'rpb:'+r.id,source:'rpb',sourceId:r.id,projectId:r.data&&r.data.projectId||'legacy',workspaceDocumentId:r.data&&r.data.workspaceDocumentId||'',title:r.number,status:r.status==='Serah terima selesai'?'SELESAI':r.status==='Ditolak'?'DITOLAK':'DIAJUKAN',date:r.requestDate,url:r.spreadsheetUrl||r.excelUrl,record:r};});});
  ['requests','approvals'].forEach(function(entity){add(entity,function(){return utpRead_(entity).map(function(r){return {id:entity+':'+r.id,source:entity,sourceId:r.id,projectId:r.projectId||'legacy',workspaceDocumentId:r.workspaceDocumentId||'',title:r.title||r.material||r.number||'Material',status:r.status==='DRAFT'?'DRAFT':r.status==='REJECTED'?'DITOLAK':r.status==='APPROVED'||r.arrived?'SELESAI':'DIPROSES',date:r.date||'',due:'',record:r};});});});
  // Exports belong to their source document; they never create another Kanban card.
  add('Memo',function(){return apiGetMemoHistory(token).map(function(r){return {id:'memo:'+r.number,source:'memo',sourceId:r.number,projectId:r.projectId||'legacy',workspaceDocumentId:r.workspaceDocumentId||'',title:r.number+' · '+(r.perihal||r.projectName||'Memo'),status:'SELESAI',date:r.documentDate||r.createdAt||'',url:r.sheetUrl||r.pdfUrl||'',record:r};});});
  var linked={},sourceKeys={};
  documents.forEach(function(d){
    if(d.source!=='document'){
      var draft=documents.find(function(r){return r.source==='document'&&r.projectId===d.projectId&&(r.id===d.workspaceDocumentId||workspaceDocumentSameSource_(r.linkedSource,d.source,d.sourceId));});
      if(draft){d.workspaceDocumentId=draft.id;Object.assign(d,documentMonitorFields_(draft));d.origin=draft.origin||'UTP';if(!d.due)d.due=draft.due;}
      sourceKeys[d.source+':'+d.sourceId]=true;
      if(d.workspaceDocumentId)linked[d.workspaceDocumentId]=true;
    }
  });
  documents=documents.filter(function(d){
    if(d.source!=='document')return true;
    if(linked[d.id])return false;
    return !(d.linkedSource&&sourceKeys[String(d.linkedSource.type||'')+':'+String(d.linkedSource.id||'')]);
  });
  var tracking=utpRead_('workspaceDocumentTracking');
  documents=documents.filter(function(d){var tracked=tracking.find(function(t){return t.id===d.id;});if(!tracked)return true;if(tracked.hidden)return false;d.status=tracked.status;d.due=tracked.due;d.note=tracked.note;d.history=tracked.history;d.trackingVersion=tracked.version;Object.assign(d,documentMonitorFields_(tracked));return true;});
  var followups=utpRead_('telegramDocumentFollowups');
  documents.forEach(function(d){var follow=followups.find(function(f){return f.id===d.id;});if(follow)d.telegramFollowup={state:follow.state,history:follow.history||[]};});
  return {documents:documents,warnings:warnings,ownerTemplates:projectId==='all'?[]:utpRead_('ownerDocumentTemplates').filter(function(t){return t.projectId===projectId;})};
}
function apiProjectDocument(action,payload,token) {
  requireAuthorized_(token);var p=payload||{};
  if(action==='track'||action==='hide'){
    var trackedInput=p.record||{},scope=workspaceProjectId_(trackedInput.projectId,false),source=projectDocumentIndex_(scope,token).documents.find(function(d){return d.id===trackedInput.id&&d.source!=='document';});
    if(!source)throw new Error('Dokumen sumber tidak ditemukan pada proyek ini.');
    var trackingLock=LockService.getScriptLock();trackingLock.waitLock(30000);
    try{var prior=utpGet_('workspaceDocumentTracking',source.id);if(Number(trackedInput.trackingVersion||0)!==Number(prior&&prior.version||0))return {conflict:true};
      var status=workspaceText_(trackedInput.status,30),reason=workspaceText_(trackedInput.note,2000);
      if(['DRAFT','DIAJUKAN','DIPROSES','REVISI','DITOLAK','DITERIMA','SELESAI'].indexOf(status)<0)throw new Error('Status tracking tidak valid.');
      if(action==='track'&&!reason)throw new Error('Isi penjelasan tracking dokumen.');
      var tracked={id:source.id,projectId:scope,sourceId:source.sourceId,source:source.source,status:status,due:workspaceDate_(trackedInput.due,true),note:reason,hidden:action==='hide',history:(prior&&prior.history||[]).concat([{at:new Date().toISOString(),status:status,reason:reason||'Kartu disembunyikan dari kanban'}])};
      Object.assign(tracked,documentMonitorFields_(trackedInput,prior));
      tracked.history[tracked.history.length-1].monitor=documentMonitorFields_(tracked);
      try{return {record:utpWrite_('workspaceDocumentTracking',tracked,prior?prior.version:0)};}catch(e){if(e.recordSaved)return {record:utpGet_('workspaceDocumentTracking',tracked.id),warning:e.message};throw e;}
    }finally{trackingLock.releaseLock();}
  }
  var lock=LockService.getScriptLock();lock.waitLock(30000);
  try {
    var input=p.record||{},old=input.id?utpGet_('workspaceDocuments',input.id):null;
    if(old&&input.projectId&&input.projectId!==old.projectId)throw new Error('Proyek dokumen tidak sesuai.');
    if(old&&old.archived)throw new Error('Dokumen sudah dihapus dari daftar aktif.');
    if(action==='delete') {if(!old)throw new Error('Dokumen tidak ditemukan.');if(old.version!==Number(input.version))return {conflict:true};old.archived=true;try{return {record:utpWrite_('workspaceDocuments',old,old.version)};}catch(e){if(e.recordSaved)return {record:utpGet_('workspaceDocuments',old.id),warning:e.message};throw e;}}
    if(action!=='save')throw new Error('Tindakan dokumen tidak dikenal.');
    if(old?old.version!==Number(input.version):Number(input.version||0)!==0)return {conflict:true};
    var projectId=workspaceProjectId_(input.projectId,false),requestId=workspaceText_(input.clientRequestId,120);
    if(!old&&requestId){
      var duplicate=utpRead_('workspaceDocuments').filter(function(r){return !r.archived&&r.clientRequestId===requestId&&(r.projectId||'legacy')===projectId;})[0];
      if(duplicate)return {record:duplicate,duplicate:true};
    }
    var record={id:old?old.id:Utilities.getUuid(),projectId:projectId,title:workspaceText_(input.title,300),templateId:workspaceText_(input.templateId,100),page:workspaceText_(input.page,30),memoType:workspaceText_(input.memoType,10),status:workspaceText_(input.status||'DRAFT',30),due:workspaceDate_(input.due,true),note:workspaceText_(input.note,2000),source:'document'};
    Object.assign(record,documentMonitorFields_(input,old));record.origin=old&&old.origin||'UTP';
    if(!old&&input.ownerTemplateId){var ownerTemplate=utpGet_('ownerDocumentTemplates',workspaceText_(input.ownerTemplateId,100));if(!ownerTemplate||ownerTemplate.archived||ownerTemplate.projectId!==projectId)throw new Error('Template owner bukan milik proyek ini.');record.ownerTemplateId=ownerTemplate.id;record.origin='OWNER';input=Object.assign({},input,{templateSourceId:ownerTemplate.fileId});}
    if(old&&old.ownerTemplateId)record.ownerTemplateId=old.ownerTemplateId;
    if(!record.title)throw new Error('Judul dokumen wajib diisi.');
    if(['DRAFT','DIAJUKAN','DIPROSES','REVISI','DITOLAK','DITERIMA','SELESAI'].indexOf(record.status)<0)throw new Error('Status dokumen tidak valid.');
    if(old&&old.projectId!==record.projectId)throw new Error('Proyek dokumen tidak boleh berpindah lewat edit biasa.');
    if(old&&old.status!==record.status&&!record.note)throw new Error('Isi alasan perubahan status.');
    if(!old){
      if(requestId)record.clientRequestId=requestId;
      var pendingCopy=requestId?workspaceDocumentPendingCopy_(record.projectId,requestId):null;
      if(pendingCopy)['templateSourceId','fileId','fileUrl','fileName','fileMimeType'].forEach(function(key){if(pendingCopy[key]!=null)record[key]=pendingCopy[key];});
      else if(input.templateSourceId)Object.assign(record,workspaceDocumentTemplateCopy_(record.projectId,input.templateSourceId,record.title));
    }else{
      ['clientRequestId','templateSourceId','fileId','fileUrl','fileName','fileMimeType','linkedSource'].forEach(function(key){if(old[key]!=null)record[key]=old[key];});
    }
    record.history=(old&&old.history||[]).slice();
    if(!old||JSON.stringify(documentMonitorFields_(old))!==JSON.stringify(documentMonitorFields_(record))||old.status!==record.status||old.due!==record.due)record.history.push({at:new Date().toISOString(),reason:record.note||'Informasi monitoring diperbarui',status:record.status,due:record.due,monitor:documentMonitorFields_(record)});
    try{
      var savedDocument=utpWrite_('workspaceDocuments',record,old?old.version:0);
      if(!old&&record.fileId&&requestId)workspaceDocumentClearPendingCopy_(record.projectId,requestId);
      return {record:savedDocument};
    }
    catch(e){
      if(e.recordSaved){
        if(!old&&record.fileId&&requestId)workspaceDocumentClearPendingCopy_(record.projectId,requestId);
        return {record:utpGet_('workspaceDocuments',record.id),warning:'Dokumen tersimpan dengan peringatan: '+e.message};
      }
      if(record.fileId&&!old){
        if(requestId){
          try{workspaceDocumentRememberCopy_(record.projectId,requestId,record);}
          catch(rememberError){throw new Error(e.message+' Salinan template '+record.fileId+' sudah dibuat tetapi belum dapat dicatat; periksa folder proyek sebelum mencoba lagi.');}
          throw new Error(e.message+' Salinan template sudah dibuat ('+record.fileId+') tetapi dokumen belum tersimpan. Simpan ulang akan memakai salinan yang sama.');
        }
        try{DriveApp.getFileById(record.fileId).setTrashed(true);}
        catch(cleanupError){throw new Error(e.message+' Salinan template '+record.fileId+' gagal dibersihkan; periksa folder proyek sebelum mencoba lagi.');}
      }
      throw e;
    }
  } finally {lock.releaseLock();}
}
// Development switch: owner session remains mandatory; set UTP_DEVELOPMENT_PIN_DEFERRED=false to restore action PINs.
function documentMonitorFields_(input,prior){
  input=input||{};prior=prior||{};var out={};
  ['number','documentType','recipient','requiredAction','periodLabel'].forEach(function(k){out[k]=workspaceText_(input[k]==null?prior[k]:input[k],200);});
  ['documentDate','sentDate','followUpDate'].forEach(function(k){out[k]=workspaceDate_(input[k]==null?prior[k]:input[k],true);});
  return out;
}
function documentSave_(entity,record,version){
  try{return {record:utpWrite_(entity,record,version)};}catch(e){if(!e.recordSaved)throw e;return {record:utpGet_(entity,record.id),warning:e.message};}
}
function documentFiles_(doc){
  var files=utpRead_('workspaceDocumentFiles').filter(function(f){return (f.documentId===doc.id||f.documentId===doc.workspaceDocumentId)&&f.projectId===doc.projectId;});
  function add(url,name,role,version){if(/^https:\/\/(docs|drive)\.google\.com\//.test(url||'')&&!files.some(function(f){return f.url===url;}))files.push({url:url,name:name,role:role,sourceVersion:version||'',at:''});}
  var r=doc.record||doc;add(doc.fileUrl||doc.url,'Berkas utama','working',r.version);
  var draft=doc.workspaceDocumentId&&utpGet_('workspaceDocuments',doc.workspaceDocumentId);if(draft)add(draft.fileUrl,'Salinan kerja awal','working',draft.version);
  (r.attachments||[]).forEach(function(f){add(f.url,f.name,'evidence');});
  utpRead_('documentExports').filter(function(e){return e.entity===doc.source&&e.recordId===doc.sourceId;}).forEach(function(e){var o=e.outputs||{};add(o.editableUrl||o.excelUrl,'Spreadsheet v'+e.recordVersion,'generated',e.recordVersion);add(o.pdfUrl,'PDF v'+e.recordVersion,'generated',e.recordVersion);(o.files||[]).forEach(function(f){add(f.excelUrl,f.name,'generated',e.recordVersion);add(f.pdfUrl,f.name+' PDF','generated',e.recordVersion);});});
  if(doc.source==='lpd'){
    utpRead_('lpdExports').filter(function(e){return e.lpdId===doc.sourceId;}).forEach(function(e){add(e.spreadsheetUrl,'Spreadsheet LPD','generated',e.recordVersion);add(e.pdfUrl,'PDF LPD','generated',e.recordVersion);});
    utpRead_('lpdSignedArchives').filter(function(e){return e.lpdId===doc.sourceId;}).forEach(function(e){add(e.file.url,'Scan LPD bertanda tangan','signed',e.recordVersion);});
  }
  ['spreadsheetUrl','sheetUrl','excelUrl','pdfUrl'].forEach(function(k){add(r[k],k,'generated',r.version);});
  return files;
}
function apiDocumentWorkspace(action,payload,token){
  requireAuthorized_(token);var p=payload||{},scope=workspaceProjectId_(p.projectId,action==='templates');
  if(action==='templates')return {templates:scope==='all'?[]:utpRead_('ownerDocumentTemplates').filter(function(t){return t.projectId===scope;})};
  if(scope==='legacy'||scope==='all')throw new Error('Pilih proyek aktif yang sudah disimpan.');
  var doc;
  if(['files','attach'].includes(action)){
    doc=projectDocumentIndex_(scope,token).documents.find(function(d){return d.id===p.documentId||d.workspaceDocumentId===p.documentId;});
    if(!doc)throw new Error('Dokumen tidak ditemukan pada proyek ini.');
    if(action==='files')return {files:documentFiles_(doc)};
  }
  var lock=LockService.getScriptLock();lock.waitLock(30000);
  try{
    workspaceProjectId_(scope,false);
    if(action==='uploadTemplate'){
      var id=workspaceText_(p.requestId,100);if(!/^[a-zA-Z0-9-]{8,100}$/.test(id))throw new Error('ID unggahan tidak valid.');
      var old=utpGet_('ownerDocumentTemplates',id);if(old){if(old.projectId!==scope)throw new Error('ID unggahan sudah digunakan proyek lain.');return {record:old};}
      var uploaded=utpUpload_({name:p.name,mime:p.mime,base64:p.base64,kind:'OWNER_TEMPLATE',recordId:scope});
      var same=utpRead_('ownerDocumentTemplates').find(function(t){return t.projectId===scope&&t.fileId===uploaded.id;});if(same)return {record:same,duplicate:true};
      DriveApp.getFileById(uploaded.id).moveTo(sistemDriveSubpathFrom_(workspaceProjectFolder_(scope,'Arsip'),'Template Owner'));
      var record={id:id,projectId:scope,origin:'OWNER',title:workspaceText_(p.title||p.name,300),code:workspaceText_(p.code||'OWNER',80),cluster:['A','B','C'].includes(p.cluster)?p.cluster:'C',stage:workspaceText_(p.stage||'Dokumen Owner',100),system:workspaceText_(p.system||'Administrasi',100),frequency:['Harian','Mingguan','Bulanan','Berdasarkan kejadian'].includes(p.frequency)?p.frequency:'Berdasarkan kejadian',pic:'Admin Proyek',kind:p.kind==='reference'?'reference':'template',format:workspaceText_(p.mime,100),fileId:uploaded.id,templateSourceId:uploaded.id,driveUrl:uploaded.url,classification:'MANUAL'};
      return documentSave_('ownerDocumentTemplates',record,0);
    }
    if(action==='saveTemplate'){
      var t=utpGet_('ownerDocumentTemplates',p.id);if(!t||t.archived||t.projectId!==scope)throw new Error('Template tidak tersedia pada proyek ini.');
      if(t.version!==Number(p.version))return {conflict:true,record:t};
      ['title','code','stage','system'].forEach(function(k){if(p[k]!=null)t[k]=workspaceText_(p[k],200);});
      if(!t.title)throw new Error('Nama template wajib diisi.');
      if(p.frequency!=null){if(!['Harian','Mingguan','Bulanan','Berdasarkan kejadian'].includes(p.frequency))throw new Error('Frekuensi tidak valid.');t.frequency=p.frequency;}
      if(p.cluster!=null){if(!['A','B','C'].includes(p.cluster))throw new Error('Kluster tidak valid.');t.cluster=p.cluster;}
      return documentSave_('ownerDocumentTemplates',t,t.version);
    }
    if(action==='attach'){
      var role=workspaceText_(p.role,30);if(!['working','revision','reply','signed','evidence'].includes(role))throw new Error('Jenis berkas tidak valid.');
      var fileKey=workspaceText_(p.requestId,100);if(!/^[a-zA-Z0-9-]{8,100}$/.test(fileKey))throw new Error('ID unggahan tidak valid.');
      var prior=utpGet_('workspaceDocumentFiles',fileKey);if(prior){if(prior.documentId!==doc.id||prior.projectId!==scope||prior.role!==role)throw new Error('ID unggahan telah digunakan dokumen lain.');return {record:prior};}
      if(doc.source==='document'){var current=utpGet_('workspaceDocuments',doc.id);if(!current||current.archived||current.projectId!==scope)throw new Error('Dokumen sudah tidak tersedia.');}
      var file=utpUpload_({name:p.name,mime:p.mime,base64:p.base64,kind:'DOCUMENT_VERSION',recordId:doc.id});
      DriveApp.getFileById(file.id).moveTo(workspaceProjectFolder_(scope,'Arsip'));
      return documentSave_('workspaceDocumentFiles',{id:fileKey,documentId:doc.id,projectId:scope,name:file.name,url:file.url,fileId:file.id,mime:file.mime,role:role,note:workspaceText_(p.note,1000),sourceVersion:doc.version||doc.record&&doc.record.version||0,at:new Date().toISOString()},0);
    }
    throw new Error('Tindakan workspace dokumen tidak dikenal.');
  }finally{lock.releaseLock();}
}
function developmentPinDeferred_(){return PropertiesService.getScriptProperties().getProperty('UTP_DEVELOPMENT_PIN_DEFERRED')!=='false';}
