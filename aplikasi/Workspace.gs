/* Authenticated administrative records. No payment or official approval is implied. */
var WORKSPACE_MODULES_ = {tasks:'workspaceTasks',finance:'workspaceFinance',archives:'workspaceArchives',people:'workspacePeople',attendance:'workspaceAttendance',rpd:'workspaceRpd'};
function workspaceText_(value, max) { var text=String(value==null?'':value).trim();if(text.length>(max||500))throw new Error('Isian terlalu panjang.');return text; }
function workspaceDate_(value, optional) {
  var text=workspaceText_(value,10);if(!text&&optional)return '';
  if(!/^\d{4}-\d{2}-\d{2}$/.test(text))throw new Error('Tanggal wajib YYYY-MM-DD.');
  var y=Number(text.slice(0,4)),m=Number(text.slice(5,7)),d=Number(text.slice(8,10)),leap=y%4===0&&(y%100!==0||y%400===0);
  if(y<1||m<1||m>12||d<1||d>[31,leap?29:28,31,30,31,30,31,31,30,31,30,31][m-1])throw new Error('Tanggal kalender tidak valid.');return text;
}
function workspaceNumber_(value, positive) {if((typeof value!=='number'&&typeof value!=='string')||typeof value==='string'&&!value.trim())throw new Error('Nilai angka wajib diisi.');var n=Number(value);if(!isFinite(n)||n<0||(positive&&n===0)||n>1e15)throw new Error('Nilai angka tidak valid.');return n;}
function workspaceRecord_(module, input) {
  var r={id:workspaceText_(input.id,100)||Utilities.getUuid(),name:workspaceText_(input.name||input.purpose,200),date:workspaceDate_(input.date),note:workspaceText_(input.note,2000),status:workspaceText_(input.status||'Draf',40),fields:{}};
  if(!/^[a-zA-Z0-9-]{8,100}$/.test(r.id)||!r.name)throw new Error('Identitas dan judul wajib valid.');
  var allowed=module==='rpd'?['DRAFT','SUBMITTED']:['Draf','Perlu tindak lanjut','Selesai dicatat'];if(allowed.indexOf(r.status)<0)throw new Error('Status tidak valid.');
  var schemas={tasks:['assignee','priority','due'],finance:['reference','vendor','amount','category','proof'],archives:['reference','category','location','revision'],people:['role','company','phone','start'],attendance:['person','attendance','area','hours']};
  if(module==='rpd') {
    r.purpose=r.name;r.recipient=workspaceText_(input.recipient,200);r.paymentDetails=workspaceText_(input.paymentDetails,500);r.proof=workspaceText_(input.proof,500);
    if(!r.recipient)throw new Error('Penerima dana wajib diisi.');
    if(!Array.isArray(input.items)||!input.items.length||input.items.length>100)throw new Error('Isi 1–100 rincian dana.');
    r.items=input.items.map(function(i){var row={name:workspaceText_(i.name,300),quantity:workspaceNumber_(i.quantity,true),price:workspaceNumber_(i.price,false)};if(!row.name)throw new Error('Uraian rincian wajib diisi.');row.subtotal=Math.round(row.quantity*row.price*100)/100;if(!isFinite(row.subtotal)||row.subtotal>1e15)throw new Error('Subtotal terlalu besar.');return row;});
    r.total=Math.round(r.items.reduce(function(sum,i){return sum+i.subtotal;},0)*100)/100;if(r.total>1e15)throw new Error('Total terlalu besar.');
    if(r.status==='SUBMITTED'&&(!r.proof||!r.paymentDetails))throw new Error('Catatan pengajuan perlu referensi invoice/kwitansi dan detail penerima.');
  } else {
    var fields=input.fields||{};schemas[module].forEach(function(k){r.fields[k]=workspaceText_(fields[k],500);});
    if(module==='tasks'){r.fields.due=workspaceDate_(r.fields.due,true);if(['Normal','Tinggi','Rendah'].indexOf(r.fields.priority)<0)throw new Error('Pilih prioritas tugas.');}
    if(module==='finance'){r.fields.amount=workspaceNumber_(fields.amount,false);if(!r.fields.vendor||!r.fields.category)throw new Error('Penerima dan kategori wajib diisi.');if(/material|bahan bangunan/i.test(r.fields.category))throw new Error('Pembelian material dicatat di administrasi material, bukan dana operasional.');}
    if(module==='archives'&&!r.fields.location)throw new Error('Lokasi atau tautan arsip wajib diisi.');
    if(module==='people')r.fields.start=workspaceDate_(r.fields.start,true);
    if(module==='attendance'){if(!r.fields.person||['Hadir','Izin','Sakit','Alpa','Libur'].indexOf(r.fields.attendance)<0)throw new Error('Personel dan kehadiran wajib diisi.');r.fields.hours=workspaceNumber_(fields.hours,false);if(r.fields.hours>24)throw new Error('Jam kerja maksimum 24.');}
  }
  return r;
}
function apiWorkspace(action,payload,token) {
  requireAuthorized_(token);var p=payload||{},module=p.module,entity=Object.prototype.hasOwnProperty.call(WORKSPACE_MODULES_,module)?WORKSPACE_MODULES_[module]:null;
  if(action==='summary'){var counts={},activities=[];Object.keys(WORKSPACE_MODULES_).forEach(function(k){var rows=utpRead_(WORKSPACE_MODULES_[k]);counts[k]=rows.length;rows.forEach(function(r){activities.push({module:k,id:r.id,name:r.name||r.purpose,status:r.status,updatedAt:r.updatedAt,date:r.updatedAt,text:(r.name||r.purpose)+' · '+r.status});});});activities.sort(function(a,b){return String(b.updatedAt).localeCompare(String(a.updatedAt));});return {counts:counts,activities:activities.slice(0,15)};}
  if(!entity)throw new Error('Modul tidak dikenal.');if(action==='list')return {records:utpRead_(entity)};
  if(['save','delete','upload'].indexOf(action)<0)throw new Error('Tindakan tidak dikenal.');
  var lock=LockService.getScriptLock();lock.waitLock(30000);
  try {
    if(action==='upload'){if(['finance','archives','rpd'].indexOf(module)<0)throw new Error('Modul ini tidak menerima lampiran.');return utpUpload_({name:p.name,mime:p.mime,base64:p.base64,kind:'workspace-'+module,recordId:''});}
    var input=action==='save'?p.record||{}:p,old=input.id?utpGet_(entity,input.id):null,version=Number(input.version||0);
    if(!Number.isInteger(version)||version<0)throw new Error('Versi tidak valid.');
    if(old&&old.archived)throw new Error('Catatan sudah dihapus.');
    if(old?old.version!==version:version!==0)return {conflict:true,record:old};
    var record;
    if(action==='delete'){requireDeletePin_(p.pin);if(!old)throw new Error('Catatan tidak ditemukan.');record=JSON.parse(JSON.stringify(old));record.archived=true;record.deletedAt=new Date().toISOString();}
    else {record=workspaceRecord_(module,input);if(module==='rpd'&&(record.status==='SUBMITTED'||old&&old.status==='SUBMITTED'))requireDeletePin_(p.pin);}
    try{return {record:utpWrite_(entity,record,version)};}catch(error){if(error.recordSaved)return {record:utpGet_(entity,record.id),warning:error.message};throw error;}
  } finally {lock.releaseLock();}
}
