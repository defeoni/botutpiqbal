/* Nota identity is shared by inbox and LPD. Usage is derived from persisted LPDs,
   inside the same script lock as saving. No secondary reservation can drift. */
function lpdNotaUsage_(id){
  return utpRead_('workspaceLpd').filter(function(r){return (r.realisasi||[]).some(function(n){return (n.financeId||n.id)===id;});});
}
function lpdWriteNota_(record,version){
  try{return utpWrite_('workspaceFinance',record,version);}catch(e){if(!e.recordSaved)throw e;var saved=utpGet_('workspaceFinance',record.id);if(!saved)throw e;return saved;}
}
function lpdFinanceAction_(action,p){
  var scope=lpdProject_(p.projectId),record=utpGet_('workspaceFinance',lpdSourceId_(p.id,'ID nota'));
  if(!record||record.archived||record.projectId!==scope)throw new Error('Nota tidak tersedia pada proyek ini.');
  if(action==='ocr'&&lpdNotaUsage_(record.id).length)throw new Error('Nota sudah digunakan LPD. Lepaskan dahulu jika ingin mengubah deskripsi.');
  var files=(record.attachments||[]).filter(function(f){return /^https:\/\/(drive|docs)\.google\.com\//.test(f.url||'');});
  if(!files.length)throw new Error('Simpan foto nota terlebih dahulu.');
  function source(f){var id=(f.url.match(/\/d\/([a-zA-Z0-9_-]+)/)||[])[1];if(!id)throw new Error('Tautan file nota tidak valid.');return DriveApp.getFileById(id);}
  if(action==='photoSheet'){
    var book=SpreadsheetApp.create('Foto nota - '+record.name),sheet=book.getSheets()[0],warnings=[];sheet.setName('Foto nota');
    DriveApp.getFileById(book.getId()).moveTo(workspaceProjectFolder_(scope,'Nota dan Keuangan'));
    files.forEach(function(f,i){var file=source(f),blob=file.getBlob();if(!/^image\/(jpeg|png)$/.test(blob.getContentType())||blob.getBytes().length>2*1024*1024){warnings.push(f.name+': unduh file asli; format atau ukuran tidak didukung gambar Spreadsheet.');return;}sheet.insertImage(blob,1,1+i*30);});
    return {url:book.getUrl(),warning:warnings.join(' ')};
  }
  var file=source(files[Number(p.fileIndex)||0]||files[0]),blob=file.getBlob();
  if(!['image/jpeg','image/png','application/pdf'].includes(blob.getContentType())||blob.getBytes().length>5*1024*1024)throw new Error('OCR menerima JPG/PNG/PDF maksimal 5 MB.');
  var boundary='ocr_'+Utilities.getUuid(),folder=sistemDriveInternalFolder_('Unggahan Sementara',true);
  var head='--'+boundary+'\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n'+JSON.stringify({name:'OCR nota '+record.id,mimeType:'application/vnd.google-apps.document',parents:[folder.getId()]})+'\r\n--'+boundary+'\r\nContent-Type: '+blob.getContentType()+'\r\n\r\n';
  var res=UrlFetchApp.fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&ocrLanguage=id&fields=id',{method:'post',contentType:'multipart/related; boundary='+boundary,payload:Utilities.newBlob(head).getBytes().concat(blob.getBytes(),Utilities.newBlob('\r\n--'+boundary+'--\r\n').getBytes()),headers:{Authorization:'Bearer '+ScriptApp.getOAuthToken()},muteHttpExceptions:true});
  if(![200,201].includes(res.getResponseCode()))throw new Error('OCR Google Drive belum tersedia (HTTP '+res.getResponseCode()+'). Isi deskripsi manual.');
  var id=JSON.parse(res.getContentText()).id,output={text:'',warning:''};if(!id)throw new Error('OCR tidak mengembalikan hasil. Isi deskripsi manual.');
  try{output.text=DocumentApp.openById(id).getBody().getText().trim().slice(0,2000);if(!output.text)output.warning='Teks tidak terbaca. Isi deskripsi manual.';}
  finally{try{DriveApp.getFileById(id).setTrashed(true);}catch(e){output.warning+=' Dokumen OCR sementara belum dapat dibersihkan.';}}
  return output;
}
function lpdSyncNotas_(record){
  var seen={};
  // Validate all claims before creating any inbox entries.
  (record.realisasi||[]).forEach(function(n){
    var id=n.financeId||n.id;if(seen[id])throw new Error('Satu nota tidak boleh dipecah atau dimasukkan dua kali.');seen[id]=true;
    if(lpdNotaUsage_(id).some(function(r){return r.id!==record.id;}))throw new Error('Nota '+id+' sudah dipakai LPD lain.');
    var inbox=utpGet_('workspaceFinance',id);
    if(inbox&&(inbox.archived||inbox.projectId!==record.projectId))throw new Error('Nota tidak tersedia pada proyek ini.');
    if(n.financeId&&!inbox)throw new Error('Nota inbox tidak ditemukan.');
    if(inbox&&Number(inbox.fields.amount)!==n.amount&&inbox.source!=='LPD')throw new Error('Nominal nota harus digunakan utuh. Periksa nominal di Nota & Keuangan.');
  });
  return (record.realisasi||[]).map(function(n){
    var id=n.financeId||n.id,inbox=utpGet_('workspaceFinance',id);
    if(inbox&&inbox.source==='LPD'){
      inbox.fields.amount=n.amount;inbox.name=n.description.slice(0,200);inbox.note=n.description;inbox.date=n.date||inbox.date;inbox.attachments=n.attachments;lpdWriteNota_(inbox,inbox.version);
    }else if(!inbox){
      inbox={id:id,projectId:record.projectId,name:n.description.slice(0,200),date:n.date||lpdTodayJakarta_(),status:'Draf',source:'LPD',note:n.description,fields:{reference:'',vendor:'Belum diisi',amount:n.amount,category:'Perlu klasifikasi',proof:n.attachments[0]&&n.attachments[0].url||''},attachments:n.attachments};
      lpdWriteNota_(inbox,0);
    }
    return Object.assign({},n,{financeId:id});
  });
}
function lpdValidateNotaEvidence_(record){
  if(!(record.realisasi||[]).length)throw new Error('LPD harus memiliki nota.');
  record.realisasi.forEach(function(n){if(!n.date||!n.attachments||!n.attachments.length)throw new Error('Lengkapi tanggal dan bukti setiap nota sebelum menerbitkan atau mencatat pengiriman LPD.');});
}
function lpdNotaList_(projectId,lpdId){
  var scope=lpdProject_(projectId);
  return {records:utpRead_('workspaceFinance').filter(function(n){return n.projectId===scope;}).map(function(n){
    var usage=lpdNotaUsage_(n.id);return Object.assign({},n,{lpdUsage:usage.map(function(r){return {id:r.id,status:r.status,month:r.month};}),available:!usage.length||usage.every(function(r){return r.id===lpdId;})});
  })};
}
function lpdDocumentAction_(action,p){
  var scope=lpdProject_(p.projectId);
  if(action==='notaList')return lpdNotaList_(scope,p.lpdId);
  if(action==='templateStatus')return {configured:!!PropertiesService.getScriptProperties().getProperty('LPD_TEMPLATE_FILE_ID')};
  if(action==='artifacts'){
    var doc=lpdRow_('lpd',p.id);lpdAssertProject_(doc,scope,'LPD');
    return {exports:utpRead_('lpdExports').filter(function(r){return r.lpdId===doc.id;}),signed:utpRead_('lpdSignedArchives').filter(function(r){return r.lpdId===doc.id;})};
  }
  var lock=LockService.getScriptLock();lock.waitLock(30000);
  try{
    if(action==='templateUpload'){
      requireDeletePin_(p.pin);
      var bytes=Utilities.base64Decode(p.base64||'');if(bytes.length>5*1024*1024)throw new Error('Template maksimal 5 MB.');
      var digest=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,bytes).map(function(b){return('0'+(b&255).toString(16)).slice(-2);}).join('');
      if(digest!=='55769c3a52cb7246b9f6978d2582f8ac9f9124c53c2dc2e7d6183b1d2d5e7597')throw new Error('Gunakan TEMPLATE-LPD-PT-UTP.xlsx kosong yang disertakan repository.');
      var blob=Utilities.newBlob(bytes,'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','TEMPLATE-LPD-PT-UTP.xlsx');
      var parts=Utilities.unzip(blob.copyBlob().setContentType('application/zip'));
      var xml=parts.find(function(b){return b.getName()==='xl/worksheets/sheet1.xml';});
      if(!xml||parts.filter(function(b){return /^xl\/media\//.test(b.getName());}).length!==1)throw new Error('Pakai template LPD kosong repository, hanya berisi logo tanpa tanda tangan contoh.');
      var root=sistemDriveRoot_(true),folder=sistemDriveSubpath_(root,'00_TEMPLATE ASLI/LPD',true),file=folder.createFile(blob);
      PropertiesService.getScriptProperties().setProperty('LPD_TEMPLATE_FILE_ID',file.getId());return {url:file.getUrl()};
    }
    var record=lpdRow_('lpd',lpdSourceId_(p.id,'ID LPD'));lpdAssertProject_(record,scope,'LPD');
    if(!record||record.version!==Number(p.version))return {conflict:true,record:record};
    if(action==='export')return lpdExport_(record,p.options||{});
    if(action==='signedUpload'){
      var exp=utpGet_('lpdExports',p.exportId);
      if(!exp||exp.lpdId!==record.id||exp.projectId!==scope)throw new Error('Pilih laporan hasil generator yang ditandatangani.');
      if(!['application/pdf','image/jpeg','image/png'].includes(p.mime))throw new Error('Scan memakai PDF/JPG/PNG.');
      var prior=utpGet_('lpdSignedArchives',lpdSourceId_(p.requestId,'ID unggahan'));if(prior){if(prior.exportId!==exp.id)throw new Error('ID unggahan dipakai laporan berbeda.');return {record:prior};}
      var file=utpUpload_({name:p.name,mime:p.mime,base64:p.base64,kind:'LPD_SIGNED',recordId:record.id});
      DriveApp.getFileById(file.id).moveTo(workspaceProjectFolder_(scope,'LPD'));
      var archive={id:p.requestId,lpdId:record.id,projectId:scope,exportId:exp.id,recordVersion:exp.recordVersion,file:file,at:lpdNow_(),note:utpText_(p.note,'Catatan scan',1000,false)};
      try{utpWrite_('lpdSignedArchives',archive,0);}catch(e){if(!e.recordSaved)throw e;return {record:archive,warning:e.message};}return {record:archive};
    }
    throw new Error('Tindakan dokumen LPD tidak dikenal.');
  }finally{lock.releaseLock();}
}
function lpdExportCells_(record,options,calculation,part){
  var project=utpGet_('workspaceProjects',record.projectId),lines=record.realisasi.slice(part*27,(part+1)*27);
  var c={J4:options.transaction,D6:options.rpd,D7:options.receivedDate,D8:calculation.totals.danaTersedia,J5:options.department,J6:options.section,J7:record.month,J8:options.rpm,F11:project.code||'',B47:options.admin,E47:options.pic,H47:options.manager,D48:options.documentDate,F48:options.documentDate,J48:options.documentDate};
  for(var r=11;r<=37;r++){c['B'+r]='';c['D'+r]='';c['G'+r]='';}
  lines.forEach(function(n,i){c['B'+(11+i)]=n.date;c['D'+(11+i)]=n.description;c['G'+(11+i)]=n.amount;});
  c.G38=calculation.totals.realisasi;c.G39=calculation.totals.realisasi;c.G40=calculation.totals.saldo;
  c.B41='Bukti Transfer: '+(options.transferReference||'')+(record.realisasi.length>27?' | Bagian '+(part+1)+'/'+Math.ceil(record.realisasi.length/27)+'; total dan saldo seluruh LPD':'');
  return c;
}
function lpdImportSheet_(blob,folder,name){
  var boundary='lpd_'+Utilities.getUuid(),head='--'+boundary+'\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n'+JSON.stringify({name:name,mimeType:'application/vnd.google-apps.spreadsheet',parents:[folder.getId()]})+'\r\n--'+boundary+'\r\nContent-Type: '+blob.getContentType()+'\r\n\r\n';
  var res=UrlFetchApp.fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id',{method:'post',contentType:'multipart/related; boundary='+boundary,payload:Utilities.newBlob(head).getBytes().concat(blob.getBytes(),Utilities.newBlob('\r\n--'+boundary+'--\r\n').getBytes()),headers:{Authorization:'Bearer '+ScriptApp.getOAuthToken()},muteHttpExceptions:true});
  if(![200,201].includes(res.getResponseCode()))throw new Error('Konversi Spreadsheet gagal (HTTP '+res.getResponseCode()+').');
  return SpreadsheetApp.openById(JSON.parse(res.getContentText()).id);
}
function lpdExport_(record,input){
  lpdValidateNotaEvidence_(record);var calc=lpdCalculate_(record);lpdAssertNoDrift_(calc);
  if(calc.warnings.length)throw new Error(calc.warnings.join(' '));
  if(!record.rpbId&&!(record.rpdIds||[]).length)throw new Error('Pilih sumber dana.');
  var keys=['transaction','rpd','rpm','department','section','receivedDate','documentDate','admin','pic','manager','transferReference'],options={};
  keys.forEach(function(k){options[k]=utpText_(input[k],k,300,['department','section','documentDate','admin','pic'].includes(k));});
  options.documentDate=workspaceDate_(options.documentDate);if(options.receivedDate)options.receivedDate=workspaceDate_(options.receivedDate);
  options.paper=['A4','A3','LETTER','LEGAL'].includes(input.paper)?input.paper:'A4';
  var id=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,JSON.stringify({record:record,options:options})).map(function(b){return ('0'+(b&255).toString(16)).slice(-2);}).join('');
  var prior=utpGet_('lpdExports',id);if(prior&&prior.pdfUrl)return {record:prior};
  var templateId=PropertiesService.getScriptProperties().getProperty('LPD_TEMPLATE_FILE_ID');if(!templateId)throw new Error('Unggah template kosong LPD terlebih dahulu.');
  var template=DriveApp.getFileById(templateId);if(template.isTrashed())throw new Error('Template LPD berada di Sampah.');
  var folder=workspaceProjectFolder_(record.projectId,'LPD'),name='LPD '+record.month+' '+record.id.slice(0,8)+' v'+record.version;
  var exp=prior||{id:id,lpdId:record.id,projectId:record.projectId,recordVersion:record.version,snapshot:JSON.parse(JSON.stringify(record)),options:options,at:lpdNow_()};
  if(!exp.spreadsheetUrl){
    var count=Math.ceil(record.realisasi.length/27),firstCells=lpdExportCells_(record,options,calc,0);
    var blob=documentFillXlsx_(template.getBlob(),firstCells,false,false),book=lpdImportSheet_(blob,folder,name),first=book.getSheets()[0];
    // One report file; additional sheets handle overflow without dropping notes.
    for(var part=0;part<count;part++){
      var sheet=part?first.copyTo(book):first;sheet.setName('LPD '+(part+1));
      var cells=lpdExportCells_(record,options,calc,part);Object.keys(cells).forEach(function(a){var v=cells[a];sheet.getRange(a).setValue(typeof v==='string'&&/^[=+@-]/.test(v)?"'"+v:v);});
      sheet.getRange('D11:E37').setWrap(true);sheet.setHiddenGridlines(true);
      record.realisasi.slice(part*27,(part+1)*27).forEach(function(n,i){sheet.setRowHeight(11+i,Math.max(22,Math.ceil(n.description.length/38)*18));});
      if(sheet.getMaxRows()>48)sheet.hideRows(49,sheet.getMaxRows()-48);if(sheet.getMaxColumns()>10)sheet.hideColumns(11,sheet.getMaxColumns()-10);
    }
    SpreadsheetApp.flush();exp.spreadsheetId=book.getId();exp.spreadsheetUrl=book.getUrl();
    try{utpWrite_('lpdExports',exp,0);}catch(e){if(!e.recordSaved)throw e;}
  }
  var response=UrlFetchApp.fetch('https://docs.google.com/spreadsheets/d/'+exp.spreadsheetId+'/export?format=pdf&size='+options.paper+'&portrait=true&fitw=true&sheetnames=false&printtitle=false&gridlines=false',{headers:{Authorization:'Bearer '+ScriptApp.getOAuthToken()},muteHttpExceptions:true});
  if(response.getResponseCode()!==200||response.getBlob().getDataAsString('ISO-8859-1').slice(0,5)!=='%PDF-')return {record:exp,warning:'Spreadsheet tersimpan. PDF belum tersedia; coba generator kembali atau cetak dari Spreadsheet.'};
  var pdf=folder.createFile(response.getBlob().setName(name+'.pdf'));exp.pdfUrl=pdf.getUrl();exp.pdfId=pdf.getId();
  var saved=utpGet_('lpdExports',id);try{utpWrite_('lpdExports',exp,saved.version);}catch(e){if(!e.recordSaved)throw e;return {record:exp,warning:e.message};}return {record:exp};
}
