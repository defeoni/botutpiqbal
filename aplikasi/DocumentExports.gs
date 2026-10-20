/* Fill the user's original XLSX package. Media, styles, merges and print setup stay intact. */
var DOCUMENT_TEMPLATE_SOURCES_ = {
  approvalRecap: {id:'1AvsaZoLwyolQggvIDQZJKk7fjcAMtolK',name:'F.A1-03A REKAP APPROVAL MATERIAL.xlsx',capacity:10},
  requests: {id:'1IMTQzXV3z-_h4TmlqLzhHjKa9deB4XXO',name:'012. Reques Material JO Santo Yusup.xlsx',capacity:60},
  approvals: {id:'11Onzz9pqzuXnYR2lc6Cv915ybQhjaH74',name:'F.A1-03B APPROVAL MATERIAL PER ITEM.xlsx',capacity:5},
  rpd: {id:'1Xxba44YKsEb3cELC28ta6qn4PhpzjeNX',name:'Contoh RPD.xlsx',capacity:9}
};
function apiDocumentExport(entity,id,version,kind,token,options) {
  requireAuthorized_(token);
  if(!Object.prototype.hasOwnProperty.call(DOCUMENT_TEMPLATE_SOURCES_,entity))throw new Error('Template ekspor untuk modul ini belum tersedia.');
  if(entity==='requests'&&['initial','final'].indexOf(kind)<0||entity!=='requests'&&kind!=='draft')throw new Error('Jenis dokumen tidak valid.');
  var lock=LockService.getScriptLock();lock.waitLock(30000);
  try {
    if(entity==='approvalRecap'){id='all';version=0;}
    var record=entity==='approvalRecap'?{id:'all',version:0,title:'Rekap Approval Material',items:utpRead_('approvals').filter(function(row){return !row.archived;}).sort(function(a,b){return String(a.id).localeCompare(String(b.id));})}:utpRequireRecord_(entity==='rpd'?'workspaceRpd':entity==='approvals'?'approvals':'requests',{id:id,version:version});
    var snapshot=entity!=='requests'?record:kind==='initial'?record.initialSnapshot:record.finalSnapshot;
    if(!snapshot)throw new Error(kind==='final'?'Tetapkan daftar final dahulu.':'Simpan dan ajukan permintaan dahulu.');
    if(entity==='requests'&&kind==='final'&&record.status!=='FINAL'&&!record.arrived)throw new Error('Daftar final sudah berubah. Tetapkan final kembali.');
    var data=JSON.parse(JSON.stringify(snapshot));data.projectId=record.projectId||data.projectId||'legacy';
    var meta=documentExportOptions_(entity,data,options||{});
    if(entity==='approvalRecap')data.date=meta.documentDate;
    if(entity==='approvals'){data.items=[{name:data.material}];data.title=data.material;data.date=meta.documentDate;}
    if(!Array.isArray(data.items)||!data.items.length)throw new Error(entity==='approvalRecap'?'Belum ada approval aktif untuk direkap.':'Dokumen tidak memiliki rincian.');
    var source=DOCUMENT_TEMPLATE_SOURCES_[entity];
    var identity=JSON.stringify({entity:entity,id:id,kind:kind,snapshot:data,options:meta});
    var key=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,identity).map(function(b){return('0'+(b&255).toString(16)).slice(-2);}).join('');
    var old=utpGet_('documentExports',key);if(old&&!old.archived){(old.fileIds||[old.fileId]).forEach(function(fileId){if(DriveApp.getFileById(fileId).isTrashed())throw new Error('File ekspor lama sudah dihapus. Pulihkan dari Sampah Google Drive.');});return old.outputs;}
    var original=DriveApp.getFileById(source.id);
    if(original.isTrashed()||original.getMimeType()!=='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')throw new Error('Sumber template XLSX asli tidak tersedia.');
    var originals=[];
    if(entity==='requests'&&kind==='final') {
      var ids=[];data.items.forEach(function(item){if(item.finalFileId&&ids.indexOf(item.finalFileId)<0)ids.push(item.finalFileId);});
      ids.forEach(function(fileId){var evidence=utpFinalEvidence_(fileId);if(!evidence||evidence.recordId!==record.id)throw new Error('Bukti final tidak terkait dengan permintaan ini.');var sourceFile=DriveApp.getFileById(fileId);if(sourceFile.isTrashed()||sourceFile.getMimeType()!==evidence.mime)throw new Error('Bukti final tidak tersedia.');originals.push({name:sourceFile.getName(),url:sourceFile.getUrl(),mime:evidence.mime});});
    }
    var folder=documentArchiveFolder_(entity,data.date,kind,meta.project,meta.projectId||data.projectId),name=safeFileName_((entity==='rpd'?meta.number:data.number||data.title)+' - '+(entity==='approvalRecap'?'Rekap':entity==='rpd'?'RPD':entity==='approvals'?'Draf Approval Material':kind==='initial'?'Permintaan Awal':'Daftar Final')+' - v'+version);
    var created=[],files=[],count=Math.ceil(data.items.length/source.capacity),started=Date.now(),originalBlob=original.getBlob(),recapPages=entity==='approvalRecap'?buildApprovalRecapPages(data.items,meta.project):null;
    try {
      for(var part=0;part<count;part++){
        var section=JSON.parse(JSON.stringify(data)),partOptions=JSON.parse(JSON.stringify(meta));section.items=data.items.slice(part*source.capacity,(part+1)*source.capacity);partOptions.items=meta.items.slice(part*source.capacity,(part+1)*source.capacity);
        var cells=recapPages?recapPages[part].cells:entity==='rpd'?documentRpdCells_(section,partOptions):entity==='approvals'?{D4:meta.project,D5:section.material,D6:meta.location,C7:documentDateText_(meta.documentDate)}:documentMaterialCells_(section,partOptions,kind);
        var packageBlob=documentFillXlsx_(originalBlob,cells,entity==='requests',entity==='rpd');
        var file=folder.createFile(packageBlob.setName(name+(count>1?' - Bagian '+(part+1)+' dari '+count:'')+'.xlsx'));created.push(file.getId());
        var output={name:file.getName(),excelUrl:file.getUrl(),downloadUrl:'https://drive.google.com/uc?export=download&id='+file.getId(),part:part+1,itemCount:section.items.length};
        try{if(Date.now()-started>200000)throw new Error('Waktu konversi batch hampir habis; seluruh rincian tetap diarsipkan dalam Excel.');var converted=documentNativePdf_(packageBlob,folder,file.getName().replace(/\.xlsx$/,''),entity,cells,created);output.editableUrl=converted.editableUrl;output.pdfUrl=converted.pdfUrl;output.warning='PDF mengikuti parameter cetak sumber; tampilan live belum diverifikasi.';}catch(pdfError){output.warning='Excel tersimpan utuh; PDF tidak diterbitkan: '+pdfError.message;}
        files.push(output);
      }
      var manifest=folder.createFile(Utilities.newBlob(JSON.stringify({entity:entity,recordId:id,recordVersion:record.version,kind:kind,snapshot:data,options:meta,templateId:source.id,parts:files},null,2),'application/json',name+' - Data versi.json'));created.push(manifest.getId());
      var outputs={excelUrl:files[0].excelUrl,downloadUrl:files[0].downloadUrl,files:files,partCount:count,itemCount:data.items.length,folderUrl:folder.getUrl(),templateUrl:original.getUrl(),templateName:source.name,pdfUrl:files[0].pdfUrl||'',editableUrl:files[0].editableUrl||files[0].excelUrl,originals:originals,warning:(count>1?'Seluruh '+data.items.length+' rincian dibagi '+count+' file sesuai kapasitas template asli. Nomor bisnis tetap sama. '+(entity==='rpd'?'Nominal RPD pada tiap bagian merupakan subtotal bagian tersebut. ':''):'')+(entity==='rpd'?'Logo asli dipertahankan; tanda tangan admin pada contoh dikosongkan untuk penandatanganan baru. ':'')+files.map(function(part){return (count>1?'Bagian '+part.part+': ':'')+part.warning;}).join(' ')};
      var registration={id:key,entity:entity,recordId:id,recordVersion:record.version,projectId:data.projectId,kind:kind,snapshotDigest:key,snapshotFileId:manifest.getId(),templateId:source.id,fileIds:created.slice(),outputs:outputs};
      try{utpWrite_('documentExports',registration,null);}catch(error){if(!error.recordSaved)throw error;outputs.warning+=' '+error.message;}
      return outputs;
    } catch(error) {
      var failures=[];created.forEach(function(fileId){try{DriveApp.getFileById(fileId).setTrashed(true);}catch(cleanup){failures.push(fileId);}});
      if(failures.length)throw new Error(error.message+' Pembersihan '+failures.length+' file sementara gagal; periksa folder arsip.');throw error;
    }
  } finally {lock.releaseLock();}
}
function buildApprovalRecapPages(records, projectName) {
  var active=(Array.isArray(records)?records:[]).filter(function(row){return row&&!row.archived;}),pages=[],count=Math.ceil(active.length/10);
  for(var part=0;part<count;part++){
    var cells={E2:String(projectName||'')};
    for(var row=16;row<=35;row++)'ABCDEFGHIJKLMN'.split('').forEach(function(col){cells[col+row]='';});
    active.slice(part*10,(part+1)*10).forEach(function(rec,index){
      var r=16+index*2,brand=String(rec.brand==null?'':rec.brand).trim(),types=Array.isArray(rec.types)?rec.types.filter(Boolean):[],authority=String(rec.authority||''),validAuthority=['PM','MK','HO'].indexOf(authority)>=0;
      cells['A'+r]=part*10+index+1;
      cells['C'+r]=String(rec.material||'');
      cells['G'+r]=(brand?'Merek: '+brand:rec.generic===true?'Generik terkonfirmasi':'Merek belum diketahui')+(types.length?'; Tipe: '+types.join(', '):'');
      cells['I'+r]=rec.brochureId?'Ref.':'';
      if(validAuthority&&rec.status==='APPROVED')cells['L'+r]='✓';
      if(validAuthority&&rec.status==='REJECTED')cells['M'+r]='✓';
      var notes=['Status sistem: '+String(rec.status||'Belum dicatat'),'Otoritas tercatat: '+(validAuthority?authority:'Belum valid')];
      if(rec.note)notes.push(String(rec.note));
      if(rec.brochureId)notes.push('Referensi brosur: '+String(rec.brochureId)+' (bukan bukti persetujuan)');
      if(rec.status==='APPROVED'&&authority!=='HO')notes.push('Bukan otomatis persetujuan HO');
      if(rec.generic===true&&brand)notes.push('Klasifikasi generik dan merek perlu diperiksa');
      cells['N'+r]=notes.join('. ');
    });
    pages.push({part:part+1,partCount:count,cells:cells});
  }
  return pages;
}
function documentExportOptions_(entity,data,input) {
  var projectId=data.projectId||'legacy',project=projectId==='legacy'?null:utpGet_('workspaceProjects',projectId);
  if(projectId!=='legacy'&&(!project||project.archived))throw new Error('Proyek dokumen tidak tersedia. Periksa identitas proyek sebelum mengekspor.');
  var result={projectId:projectId,project:project?project.name:data.projectName||'Data lama - belum dipetakan',projectCode:project?project.code:data.projectCode||'LEGACY'};
  if(entity==='approvalRecap')return {project:utpText_(input.project,'Nama proyek',200,true),documentDate:utpDate_(input.documentDate,'Tanggal arsip',true),items:data.items.map(function(){return {};})};
  if(entity==='approvals')return {project:utpText_(input.project,'Nama proyek',200,true),location:utpText_(input.location,'Lokasi pemasangan',200,true),documentDate:utpDate_(input.documentDate,'Tanggal dokumen',true),items:[{}]};
  if(entity==='requests'){result.items=data.items.map(function(item,index){var row=input.items&&input.items[index]||{};return {jo:utpText_(row.jo,'Kode JO',100,false),stage:utpText_(row.stage,'Tahap',80,false),line:utpText_(row.line,'Baris JO',80,false),spp:utpText_(row.spp,'SPP',120,false)};});return result;}
  result.number=utpText_(input.number,'Nomor dokumen resmi',120,true);
  result.revision=utpText_(input.revision,'Revisi dokumen resmi',20,true);
  result.documentDate=utpDate_(input.documentDate,'Tanggal dokumen',true);
  result.transaction=utpText_(input.transaction,'Nomor transaksi',120,false);
  result.admin=utpText_(input.admin,'Nama pembuat',150,true);
  if(!Array.isArray(input.items)||input.items.length!==data.items.length)throw new Error('Lengkapi rincian pengajuan sesuai template asli.');
  result.items=input.items.map(function(row){var method=utpText_(row.method,'Metode pembayaran',20,true);if(['Tunai','Transfer'].indexOf(method)<0)throw new Error('Pilih Tunai atau Transfer.');return {account:utpText_(row.account,'Kode akun',40,true),pic:utpText_(row.pic,'PIC',150,true),method:method,time:utpText_(row.time,'Waktu kebutuhan',30,false),bank:utpText_(row.bank,'Bank / rekening tujuan',500,method==='Transfer')};});
  return result;
}
function documentMaterialCells_(data,meta,kind) {
  var cells={A1:data.title,B2:data.date};
  for(var row=5;row<=64;row++)'ABCDEFGHIJ'.split('').forEach(function(col){cells[col+row]='';});
  data.items.forEach(function(item,index){var row=index+5,details=meta.items[index];cells['A'+row]=index+1;cells['B'+row]=String(item.code||'');cells['C'+row]=item.name;cells['D'+row]=Number(item.quantity);cells['E'+row]=item.unit;cells['F'+row]=details.jo;cells['G'+row]=details.stage;cells['H'+row]=details.line;cells['J'+row]=details.spp;cells['I'+row]=[item.note||'',item.brand||'',item.model||''].filter(Boolean).join(' · ');});
  return cells;
}
function documentRpdCells_(data,meta) {
  var dateText=documentDateText_(meta.documentDate),cells={N2:meta.number,N3:meta.revision,N4:dateText,N5:meta.transaction,D6:Math.round((Date.parse(meta.documentDate+'T00:00:00Z')-Date.UTC(1899,11,30))/86400000),N6:meta.project,I10:meta.projectCode,B31:'Admin/ tanggal :'+meta.admin+' / '+dateText,G31:'Manager Dept/ tanggal:',I31:'Direksi/ tanggal :',L31:'Finance/ tanggal :'};
  var cash=0,transfer=0,accounts=Object.create(null);
  for(var row=10;row<=18;row++)['B','D','E','F','G','J','K','L','N'].forEach(function(col){cells[col+row]='';});
  for(var recap=22;recap<=25;recap++)['C','E','G','H','I','J'].forEach(function(col){cells[col+recap]='';});
  data.items.forEach(function(item,index){var row=index+10,details=meta.items[index],amount=Math.round(Number(item.quantity)*Number(item.price)*100)/100;if(!isFinite(amount))throw new Error('Nominal tidak valid.');cells['B'+row]=['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'][new Date(data.date+'T12:00:00+07:00').getUTCDay()];cells['D'+row]=documentDateText_(data.date);cells['E'+row]=details.time;cells['F'+row]=details.account;cells['G'+row]=item.name;cells['J'+row]=details.pic;cells['K'+row]=details.method;cells['L'+row]=amount;cells['N'+row]=details.bank;accounts[details.account]=(accounts[details.account]||0)+amount;if(details.method==='Tunai')cash+=amount;else transfer+=amount;});
  var columns=[['C','E'],['G','H'],['I','J']];
  Object.keys(accounts).forEach(function(account,index){var pair=columns[Math.floor(index/4)],row=22+index%4;cells[pair[0]+row]=account;cells[pair[1]+row]=accounts[account];});
  cells.F19={cached:cash};cells.F20=transfer;cells.L19={cached:cash+transfer};cells.L22={cached:cash+transfer};
  return cells;
}
function documentArchiveFolder_(entity,date,kind,projectName,projectId) {
  var props=PropertiesService.getScriptProperties(),rootId=props.getProperty('DRIVE_ROOT_FOLDER_ID');
  var root=rootId?DriveApp.getFolderById(rootId):getArchiveRootFolder_();
  if(root.getSharingAccess()!==DriveApp.Access.PRIVATE||root.getEditors().length||root.getViewers().length){var privateId=props.getProperty('DOCUMENT_PRIVATE_ROOT_ID');root=privateId?DriveApp.getFolderById(privateId):DriveApp.createFolder('Arsip UTP - Dokumen Privat');if(!privateId)props.setProperty('DOCUMENT_PRIVATE_ROOT_ID',root.getId());if(root.getSharingAccess()!==DriveApp.Access.PRIVATE||root.getEditors().length||root.getViewers().length)throw new Error('Folder arsip dokumen privat telah dibagikan. Atur folder privat dahulu.');}
  var record=projectId&&projectId!=='legacy'?utpGet_('workspaceProjects',projectId):null;
  if(projectId&&projectId!=='legacy'&&(!record||record.archived))throw new Error('Proyek arsip tidak tersedia.');
  var project=getOrCreateArchiveSubfolder_(root,record?'Project '+record.code+' - '+record.name:projectId==='legacy'?'Data lama - belum dipetakan':'Project '+(projectName||'Belum dipetakan'));
  var section=getOrCreateArchiveSubfolder_(project,entity==='rpd'?'RPD':'Material');
  var subtype=getOrCreateArchiveSubfolder_(section,entity==='approvalRecap'?'Rekap Approval':entity==='rpd'?'Rencana Pengeluaran Dana':entity==='approvals'?'Approval Material':kind==='initial'?'Permintaan Awal':'Daftar Final');
  var parts=utpDate_(date,'Tanggal arsip',true).split('-'),months=['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
  var folder=getOrCreateArchiveSubfolder_(subtype,months[Number(parts[1])-1]+' '+parts[0]);
  [project,section,subtype,folder].forEach(function(parent){if(parent.getSharingAccess()!==DriveApp.Access.PRIVATE||parent.getEditors().length||parent.getViewers().length)throw new Error('Folder '+parent.getName()+' telah dibagikan. Ekspor dihentikan agar dokumen tidak terbuka.');});return folder;
}
function documentXmlEscape_(value) {return String(value==null?'':value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,'');}
function documentDateText_(date) {var parts=date.split('-');return parts[2]+'-'+['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sept','Okt','Nov','Des'][Number(parts[1])-1]+'-'+parts[0].slice(-2);}
function apiDocumentExportHistory(entity,id,token) {
  requireAuthorized_(token);
  if(!Object.prototype.hasOwnProperty.call(DOCUMENT_TEMPLATE_SOURCES_,entity))throw new Error('Modul tidak dikenal.');
  if(entity==='approvalRecap')id='all';
  else {var record=utpGet_(entity==='rpd'?'workspaceRpd':entity==='approvals'?'approvals':'requests',id);if(!record||record.archived)throw new Error('Catatan tidak tersedia.');}
  return utpRead_('documentExports').filter(function(row){return !row.archived&&row.entity===entity&&row.recordId===id;}).sort(function(a,b){return String(b.createdAt).localeCompare(String(a.createdAt));}).map(function(row){return {kind:row.kind,version:row.recordVersion,createdAt:row.createdAt,outputs:row.outputs};});
}
function documentFillXlsx_(source,cells,clearFilter,removeSignature) {
  var blobs=Utilities.unzip(source.copyBlob().setContentType('application/zip')),found=false;
  if(removeSignature)blobs=documentRemoveSampleSignature_(blobs);
  blobs=blobs.map(function(blob){if(blob.getName()!=='xl/worksheets/sheet1.xml')return blob;found=true;var xml=blob.getDataAsString('UTF-8');
    if(clearFilter)xml=xml.replace(/(<row\b[^>]*?)\s+hidden="1"/g,'$1').replace(/<autoFilter\b[^>]*(?:\/>|>[\s\S]*?<\/autoFilter>)/g,'');
    Object.keys(cells).forEach(function(address){var value=cells[address],pattern=new RegExp('<c\\b([^>]*\\br="'+address+'"[^>]*?)(?:/>|>[\\s\\S]*?</c>)'),match=xml.match(pattern);
      if(value&&typeof value==='object'&&Object.prototype.hasOwnProperty.call(value,'cached')){if(!match||!/<f\b/.test(match[0]))throw new Error('Rumus template '+address+' berubah; ekspor dihentikan.');var updated=match[0].replace(/<v\b[^>]*>[\s\S]*?<\/v>/,'<v>'+value.cached+'</v>');xml=xml.replace(pattern,function(){return updated;});return;}
      var attrs=match?match[1].replace(/\s+t="[^"]*"/g,''):' r="'+address+'"';
      var replacement='<c'+attrs+(typeof value==='number'?'><v>'+value+'</v></c>':' t="inlineStr"><is><t xml:space="preserve">'+documentXmlEscape_(value)+'</t></is></c>');
      if(match){xml=xml.replace(pattern,function(){return replacement;});return;}
      var row=address.match(/\d+$/)[0],rowPattern=new RegExp('(<row\\b[^>]*\\br="'+row+'"[^>]*>)([\\s\\S]*?)(</row>)');
      if(!rowPattern.test(xml))throw new Error('Baris template '+row+' tidak tersedia; ekspor dihentikan.');
      xml=xml.replace(rowPattern,function(all,start,body,end){var column=address.replace(/\d/g,''),placed=false;body=body.replace(/<c\b[^>]*\br="([A-Z]+)\d+"[^>]*?(?:\/>|>[\s\S]*?<\/c>)/g,function(cell,next){if(!placed&&(next.length>column.length||next.length===column.length&&next>column)){placed=true;return replacement+cell;}return cell;});return start+body+(placed?'':replacement)+end;});
    });return Utilities.newBlob(xml,'application/xml',blob.getName());
  });
  if(!found)throw new Error('Sheet pertama template tidak tersedia.');
  return Utilities.zip(blobs).setContentType('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
}
function documentRemoveSampleSignature_(blobs) {
  var drawing=blobs.find(function(blob){return blob.getName()==='xl/drawings/drawing1.xml';});
  if(!drawing||!drawing.getDataAsString().includes('name="image2.jpg"'))throw new Error('Struktur gambar RPD berubah. Ekspor dihentikan agar tanda tangan contoh tidak tersalin.');
  return blobs.filter(function(blob){return blob.getName()!=='xl/media/image2.jpg';}).map(function(blob){
    var name=blob.getName(),text;
    if(name==='xl/drawings/drawing1.xml'){text=blob.getDataAsString().replace(/<xdr:oneCellAnchor\b[^>]*>[\s\S]*?<\/xdr:oneCellAnchor>/g,function(anchor){return /name="image2\.jpg"/.test(anchor)?'':anchor;});return Utilities.newBlob(text,'application/xml',name);}
    if(name==='xl/drawings/_rels/drawing1.xml.rels'){text=blob.getDataAsString().replace(/<Relationship\b[^>]*Target="[^"]*image2\.jpg"[^>]*\/>/g,'');return Utilities.newBlob(text,'application/xml',name);}
    return blob;
  });
}
function documentNativePdf_(blob,folder,name,entity,cells,created) {
  if(entity==='approvalRecap')throw new Error('PDF rekap belum diterbitkan: skala cetak asli 75% perlu verifikasi konversi. Gunakan Excel asli.');
  var boundary='utp_'+Utilities.getUuid().replace(/-/g,''),mime='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  var metadata={name:name,mimeType:'application/vnd.google-apps.spreadsheet',parents:[folder.getId()]};
  var head='--'+boundary+'\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n'+JSON.stringify(metadata)+'\r\n--'+boundary+'\r\nContent-Type: '+mime+'\r\n\r\n';
  var bytes=Utilities.newBlob(head).getBytes().concat(blob.getBytes(),Utilities.newBlob('\r\n--'+boundary+'--\r\n').getBytes());
  var response=UrlFetchApp.fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,mimeType',{method:'post',contentType:'multipart/related; boundary='+boundary,payload:bytes,headers:{Authorization:'Bearer '+ScriptApp.getOAuthToken()},muteHttpExceptions:true});
  if(response.getResponseCode()!==200&&response.getResponseCode()!==201)throw new Error('Konversi Google Sheets gagal (HTTP '+response.getResponseCode()+').');
  var converted=JSON.parse(response.getContentText());if(!converted.id)throw new Error('Konversi tidak mengembalikan ID.');created.push(converted.id);
  try {
    var book=SpreadsheetApp.openById(converted.id),sheet=book.getSheets()[0],approval=entity==='approvals',columns=entity==='rpd'?15:approval?5:10,maxRows=entity==='rpd'?32:approval?31:64;
    if(book.getSheets().length!==1||sheet.getName()!==(entity==='rpd'?'RPD':approval?'APPROV 2':'12'))throw new Error('Susunan sheet berubah saat konversi.');
    var sourceXml=Utilities.unzip(blob.copyBlob().setContentType('application/zip')).find(function(part){return part.getName()==='xl/worksheets/sheet1.xml';}).getDataAsString(),root=XmlService.parse(sourceXml).getRootElement(),ns=root.getNamespace(),mergeNode=root.getChild('mergeCells',ns);
    var expected=mergeNode?mergeNode.getChildren('mergeCell',ns).map(function(m){return m.getAttribute('ref').getValue();}).sort():[];
    var actual=sheet.getRange(1,1,entity==='rpd'?95:approval?32:64,columns).getMergedRanges().map(function(range){return range.getA1Notation();}).sort();
    if(JSON.stringify(expected)!==JSON.stringify(actual))throw new Error('Gabungan sel template berubah saat konversi.');
    var images=sheet.getImages();if(images.length!==(entity==='rpd'?1:0))throw new Error('Jumlah logo/gambar berubah saat konversi.');
    if(entity==='rpd'&&(images[0].getAnchorCell().getA1Notation()!=='B2'||Math.abs(images[0].getWidth()-80)>2||Math.abs(images[0].getHeight()-61)>2))throw new Error('Posisi atau ukuran logo berubah saat konversi.');
    
    root.getChild('sheetData',ns).getChildren('row',ns).forEach(function(row){var height=row.getAttribute('ht'),r=Number(row.getAttribute('r').getValue());if(height&&r<=maxRows&&Math.abs(sheet.getRowHeight(r)-Number(height.getValue())*96/72)>2)throw new Error('Tinggi baris '+r+' berubah saat konversi.');});
    var nativeValues=sheet.getRange(1,1,Math.max(sheet.getLastRow(),maxRows),columns).getValues();
    Object.keys(cells).forEach(function(address){var value=cells[address];if(value&&typeof value==='object')return;var coordinate=address.match(/^([A-Z]+)(\d+)$/),column=0;coordinate[1].split('').forEach(function(c){column=column*26+c.charCodeAt(0)-64;});var actual=nativeValues[Number(coordinate[2])-1][column-1];if(typeof value==='number'){if(actual instanceof Date){var expected=Utilities.formatDate(new Date(Date.UTC(1899,11,30)+value*86400000),'UTC','yyyy-MM-dd');if(Utilities.formatDate(actual,book.getSpreadsheetTimeZone(),'yyyy-MM-dd')!==expected)throw new Error('Tanggal '+address+' berubah saat konversi.');}else if(Number(actual)!==value)throw new Error('Nilai '+address+' berubah saat konversi.');}else if(String(actual)!==String(value))throw new Error('Teks '+address+' berubah saat konversi.');});
    SpreadsheetApp.flush();
    var setup=root.getChild('pageSetup',ns),margins=root.getChild('pageMargins',ns),params={format:'pdf',gid:sheet.getSheetId(),portrait:!setup||!setup.getAttribute('orientation')||setup.getAttribute('orientation').getValue()!=='landscape',sheetnames:false,printtitle:false,pagenumbers:false,gridlines:false,r1:entity==='rpd'?1:approval?2:0,c1:entity==='rpd'||approval?1:0,r2:maxRows,c2:columns};
    if(entity==='rpd'||approval){params.size='A4';params.fitw=true;params.scale=2;}else params.scale=1;
    ['top','bottom','left','right'].forEach(function(side){var attribute=margins&&margins.getAttribute(side);if(attribute)params[side+'_margin']=attribute.getValue();});
    var query=Object.keys(params).map(function(k){return k+'='+encodeURIComponent(params[k]);}).join('&');
    var pdfResponse=UrlFetchApp.fetch('https://docs.google.com/spreadsheets/d/'+book.getId()+'/export?'+query,{headers:{Authorization:'Bearer '+ScriptApp.getOAuthToken()},muteHttpExceptions:true});
    if(pdfResponse.getResponseCode()!==200||pdfResponse.getBlob().getDataAsString('ISO-8859-1').slice(0,5)!=='%PDF-')throw new Error('PDF tidak valid (HTTP '+pdfResponse.getResponseCode()+').');
    var pdf=folder.createFile(pdfResponse.getBlob().setName(name+'.pdf'));created.push(pdf.getId());return {pdfUrl:pdf.getUrl(),editableUrl:book.getUrl()};
  }catch(error){try{DriveApp.getFileById(converted.id).setTrashed(true);created.splice(created.indexOf(converted.id),1);}catch(cleanup){throw new Error(error.message+' Salinan konversi sementara belum terhapus.');}throw error;}
}
