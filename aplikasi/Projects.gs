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
function workspaceProjectFolder_(projectId,type) {
  var id=workspaceProjectId_(projectId,false),project=id==='legacy'?null:utpGet_('workspaceProjects',id),root=getArchiveRootFolder_();
  var folder=getOrCreateArchiveSubfolder_(root,project?'Project '+project.code+' - '+project.name:'Data lama - belum dipetakan');
  return type?getOrCreateArchiveSubfolder_(folder,type):folder;
}
function apiProjects(action,payload,token) {
  requireAuthorized_(token);
  var p=payload||{};
  if(action==='list') return {projects:utpRead_('workspaceProjects'),pinDeferred:developmentPinDeferred_()};
  if(action==='documents') return projectDocumentIndex_(workspaceProjectId_(p.projectId,true),token);
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
function projectDocumentIndex_(projectId,token) {
  var documents=[],warnings=[];
  function add(source,load){try{load().forEach(function(r){if(workspaceProjectMatches_(r,projectId))documents.push(r);});}catch(e){warnings.push(source+': '+e.message);}}
  add('Dokumen',function(){return utpRead_('workspaceDocuments');});
  ['rpd','archives','finance','tasks'].forEach(function(module){add(module,function(){return utpRead_(WORKSPACE_MODULES_[module]).map(function(r){return {id:module+':'+r.id,source:module,sourceId:r.id,projectId:r.projectId||'legacy',workspaceDocumentId:r.workspaceDocumentId||'',title:r.name||r.purpose,status:r.status==='DRAFT'||r.status==='Draf'?'DRAFT':r.status==='Selesai dicatat'?'SELESAI':'DIAJUKAN',date:r.date,due:module==='rpd'?r.date:r.fields&&r.fields.due||'',url:r.proof||r.fields&&(r.fields.location||r.fields.proof||r.fields.documentUrl)||'',record:r};});});});
  add('RPB',function(){return getRpbHistory_().map(function(r){return {id:'rpb:'+r.id,source:'rpb',sourceId:r.id,projectId:r.data&&r.data.projectId||'legacy',workspaceDocumentId:r.data&&r.data.workspaceDocumentId||'',title:r.number,status:r.status==='Serah terima selesai'?'SELESAI':r.status==='Ditolak'?'DITOLAK':'DIAJUKAN',date:r.requestDate,url:r.spreadsheetUrl||r.excelUrl,record:r};});});
  ['requests','approvals'].forEach(function(entity){add(entity,function(){return utpRead_(entity).map(function(r){return {id:entity+':'+r.id,source:entity,sourceId:r.id,projectId:r.projectId||'legacy',workspaceDocumentId:r.workspaceDocumentId||'',title:r.title||r.material||r.number||'Material',status:r.status==='DRAFT'?'DRAFT':r.status==='REJECTED'?'DITOLAK':r.status==='APPROVED'||r.arrived?'SELESAI':'DIPROSES',date:r.date||'',due:'',record:r};});});});
  add('Ekspor',function(){return utpRead_('documentExports').map(function(r){var original=utpGet_(r.entity==='rpd'?'workspaceRpd':r.entity==='approvals'?'approvals':'requests',r.recordId),out=r.outputs||{};return {id:'export:'+r.id,source:'export',sourceId:r.recordId,projectId:original&&original.projectId||'legacy',title:(original&&(original.name||original.title||original.purpose)||r.entity)+' · ekspor v'+r.recordVersion,status:'SELESAI',url:out.editableUrl||out.excelUrl,date:r.createdAt,record:out};});});
  add('Memo',function(){return apiGetMemoHistory(token).map(function(r){return {id:'memo:'+r.number,source:'memo',sourceId:r.number,projectId:r.projectId||'legacy',workspaceDocumentId:r.workspaceDocumentId||'',title:r.number+' · '+(r.perihal||r.projectName||'Memo'),status:'SELESAI',date:r.documentDate||r.createdAt||'',url:r.sheetUrl||r.pdfUrl||'',record:r};});});
  var linked={};documents.forEach(function(d){if(d.source!=='document'&&d.workspaceDocumentId)linked[d.workspaceDocumentId]=true;});documents=documents.filter(function(d){return d.source!=='document'||!linked[d.id];});
  var tracking=utpRead_('workspaceDocumentTracking');
  documents=documents.filter(function(d){var tracked=tracking.find(function(t){return t.id===d.id;});if(!tracked)return true;if(tracked.hidden)return false;d.status=tracked.status;d.due=tracked.due;d.note=tracked.note;d.history=tracked.history;d.trackingVersion=tracked.version;return true;});
  return {documents:documents,warnings:warnings};
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
      try{return {record:utpWrite_('workspaceDocumentTracking',tracked,prior?prior.version:0)};}catch(e){if(e.recordSaved)return {record:utpGet_('workspaceDocumentTracking',tracked.id),warning:e.message};throw e;}
    }finally{trackingLock.releaseLock();}
  }
  var lock=LockService.getScriptLock();lock.waitLock(30000);
  try {
    var input=p.record||{},old=input.id?utpGet_('workspaceDocuments',input.id):null;
    if(old&&old.archived)throw new Error('Dokumen sudah dihapus dari daftar aktif.');
    if(action==='delete') {if(!old)throw new Error('Dokumen tidak ditemukan.');if(old.version!==Number(input.version))return {conflict:true};old.archived=true;try{return {record:utpWrite_('workspaceDocuments',old,old.version)};}catch(e){if(e.recordSaved)return {record:utpGet_('workspaceDocuments',old.id),warning:e.message};throw e;}}
    if(action!=='save')throw new Error('Tindakan dokumen tidak dikenal.');
    if(old?old.version!==Number(input.version):Number(input.version||0)!==0)return {conflict:true};
    var record={id:old?old.id:Utilities.getUuid(),projectId:workspaceProjectId_(input.projectId,false),title:workspaceText_(input.title,300),templateId:workspaceText_(input.templateId,100),page:workspaceText_(input.page,30),memoType:workspaceText_(input.memoType,10),status:workspaceText_(input.status||'DRAFT',30),due:workspaceDate_(input.due,true),note:workspaceText_(input.note,2000),source:'document'};
    if(!record.title)throw new Error('Judul dokumen wajib diisi.');
    if(['DRAFT','DIAJUKAN','DIPROSES','REVISI','DITOLAK','DITERIMA','SELESAI'].indexOf(record.status)<0)throw new Error('Status dokumen tidak valid.');
    if(old&&old.projectId!==record.projectId)throw new Error('Proyek dokumen tidak boleh berpindah lewat edit biasa.');
    if(old&&old.status!==record.status&&!record.note)throw new Error('Isi alasan perubahan status.');
    record.history=(old&&old.history||[]).slice();
    if(old&&(old.status!==record.status||old.due!==record.due))record.history.push({at:new Date().toISOString(),reason:record.note,status:record.status,due:record.due});
    try{return {record:utpWrite_('workspaceDocuments',record,old?old.version:0)};}catch(e){if(e.recordSaved)return {record:utpGet_('workspaceDocuments',record.id),warning:e.message};throw e;}
  } finally {lock.releaseLock();}
}
// Development switch: owner session remains mandatory; set UTP_DEVELOPMENT_PIN_DEFERRED=false to restore action PINs.
function developmentPinDeferred_(){return PropertiesService.getScriptProperties().getProperty('UTP_DEVELOPMENT_PIN_DEFERRED')!=='false';}
