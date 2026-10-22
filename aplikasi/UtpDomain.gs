/* Pure UTP rules. Keep Apps Script services in Utp.gs so these rules run in Node. */
var UTP_PROJECT = { name: 'Terrasentra Bandung', code: 'TRSM-51D26-D-M', pm: 'Juhana' };
var UTP_ENTITIES = ['approvals', 'requests', 'tasks', 'purchases', 'receipts', 'funds', 'documents', 'contacts', 'housing', 'attendance'];
var UTP_REQUEST_STATUSES = ['DRAFT', 'PM', 'MK', 'HO', 'FINAL', 'ARRIVED', 'CANCELLED'];
var UTP_ITEM_STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'DEFERRED', 'OWNER'];
var UTP_MASTER_FIELDS = ['code', 'name', 'brand', 'brandCandidate', 'brandStatus', 'model', 'unit', 'group', 'family'];

function utpClone_(value) { return JSON.parse(JSON.stringify(value)); }
function utpText_(value, label, max, required) {
  var text = value == null ? '' : String(value).trim();
  if (required && !text) throw new Error(label + ' wajib diisi.');
  if (text.length > (max || 500)) throw new Error(label + ' terlalu panjang (maksimal ' + (max || 500) + ' karakter).');
  return text;
}
function utpNorm_(value) { return String(value == null ? '' : value).normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim(); }
function utpEnum_(value, choices, label, fallback) {
  var result = utpText_(value || fallback, label, 40, true).toUpperCase();
  if (choices.indexOf(result) < 0) throw new Error(label + ' tidak valid: ' + result + '.');
  return result;
}
function utpNumber_(value, label, minimum, allowZero) {
  if (typeof value !== 'number' && (typeof value !== 'string' || !/^\d+(?:\.\d+)?$/.test(value.trim()))) throw new Error(label + ' harus berupa angka biasa, tanpa pemisah ribuan.');
  var number = Number(value);
  if (!Number.isFinite(number) || number > 1e12 || (allowZero ? number < minimum : number <= minimum)) throw new Error(label + ' harus ' + (allowZero ? 'minimal ' : 'lebih dari ') + minimum + ' dan maksimal 1 triliun.');
  return number;
}
function utpDate_(value, label, required) {
  var text = utpText_(value, label, 10, required);
  if (!text && !required) return '';
  var match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!match) throw new Error(label + ' harus menggunakan YYYY-MM-DD.');
  var year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
  var date = new Date(Date.UTC(year, month - 1, day));
  if (year < 1900 || year > 2200 || date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) throw new Error(label + ' tidak valid.');
  return text;
}
function utpEntity_(entity) {
  if (UTP_ENTITIES.indexOf(entity) < 0) throw new Error('Jenis data UTP tidak dikenal.');
  return entity;
}
function utpArray_(value, label, max) {
  if (!Array.isArray(value)) throw new Error(label + ' harus berupa daftar.');
  if (value.length > max) throw new Error(label + ' maksimal ' + max + ' baris.');
  return value;
}
function utpStrings_(value, label, max) {
  var values = Array.isArray(value) ? value : String(value || '').split(/[,\n]/);
  return utpArray_(values, label, max).map(function (x) { return utpText_(x, label, 160, false); }).filter(Boolean);
}
function utpFinanceCategory_(value) {
  var category = utpText_(value, 'Kategori biaya', 100, true);
  if (/material/i.test(category)) throw new Error('Biaya material tidak masuk keuangan operasional. Gunakan pencatatan pembelian material.');
  return category;
}
function utpItemClassification_(item) {
  if (item.status === 'OWNER') return 'OWNER';
  var explicit = String(item.classification || '').trim().toUpperCase();
  if (explicit) return ['BRANDED', 'GENERIC', 'UNKNOWN', 'OWNER', 'OTHER'].indexOf(explicit) >= 0 ? explicit : 'UNKNOWN';
  var brandStatus = String(item.brandStatus || '').trim().toUpperCase();
  if (brandStatus === 'GENERIC' || brandStatus === 'UNKNOWN') return brandStatus;
  return utpNorm_(item.brand) ? 'BRANDED' : 'UNKNOWN';
}
function utpApprovalMatches_(item, approval) {
  if (!approval || approval.archived || approval.status !== 'APPROVED') return false;
  var classification = utpItemClassification_(item);
  if (classification !== 'BRANDED' && classification !== 'GENERIC') return false;
  if (classification === 'GENERIC' ? !approval.generic || !!utpNorm_(item.brand) : approval.generic || !utpNorm_(item.brand)) return false;
  var codes = approval.itemCodes || [];
  if (codes.length && codes.indexOf(String(item.code || '')) < 0) return false;
  if (!codes.length) {
    var material = utpNorm_(approval.material);
    var haystack = utpNorm_([item.name, item.family, item.group].join(' '));
    if (material && !material.split(' ').every(function (word) { return haystack.indexOf(word) >= 0; })) return false;
  }
  if (approval.generic && utpNorm_(item.brand)) return false;
  if (!approval.generic && !String(approval.brand || '').split(/[,;\n]/).some(function(b){return utpNorm_(b)===utpNorm_(item.brand);})) return false;
  var types = approval.types || [];
  if (types.length && !types.some(function (type) { return utpNorm_(type) === utpNorm_(item.model); })) return false;
  return true;
}
function utpFindApproval_(item, approvals) {
  var candidates = approvals || [];
  if (item.approvalId) candidates = candidates.filter(function (a) { return a.id === item.approvalId; });
  return candidates.find(function (a) { return utpApprovalMatches_(item, a); }) || null;
}
function utpProjectApprovalContext_(context, projectId) {
  var ctx=Object.assign({},context||{}),id=projectId||ctx.projectId||'legacy';
  ctx.projectId=id;
  ctx.approvals=(ctx.approvals||[]).filter(function(approval){return (approval.projectId||'legacy')===id;});
  return ctx;
}
function utpRequestItems_(items, context) {
  var seen = Object.create(null);
  context = utpProjectApprovalContext_(context);
  return utpArray_(items || [], 'Item permintaan', 150).map(function (source, index) {
    if (!source || typeof source !== 'object' || Array.isArray(source)) throw new Error('Data item ' + (index + 1) + ' tidak valid.');
    var item = {};
    ['id', 'code', 'name', 'brand', 'model', 'unit', 'group', 'family', 'approvalId', 'exceptionApprovedBy'].forEach(function (key) {
      item[key] = utpText_(source[key], 'Item ' + (index + 1) + ': ' + key, key === 'name' ? 500 : 160, ['name', 'unit'].indexOf(key) >= 0);
    });
    item.id = item.id || (context.newId ? context.newId() : 'item-' + (index + 1));
    if (seen[item.id]) throw new Error('ID item permintaan duplikat.');
    seen[item.id] = true;
    item.quantity = utpNumber_(source.quantity, 'Jumlah item ' + (index + 1), 0, false);
    item.status = utpEnum_(source.status, UTP_ITEM_STATUSES, 'Status item', 'PENDING');
    item.note = utpText_(source.note, 'Catatan item', 2000, false);
    item.exceptionReason = utpText_(source.exceptionReason, 'Alasan pengecualian', 2000, false);
    item.classification = utpItemClassification_(Object.assign({}, source, item));
    var approval = utpFindApproval_(item, context.approvals);
    item.approvalId = approval ? approval.id : '';
    item.approvalAuthority = approval ? approval.authority : '';
    item.approvalWarning = '';
    if (!approval && item.status !== 'OWNER') {
      if (!item.exceptionReason) throw new Error('Item ' + item.name + ' belum sesuai approval merek/tipe. Isi alasan pengecualian.');
      item.approvalWarning = 'Belum sesuai approval aktif; alasan pengecualian tercatat.';
    }
    return item;
  });
}
function utpValidateMaterialDraft_(source, existing, context) {
  if (!source || typeof source !== 'object' || Array.isArray(source)) throw new Error('Data draf tidak valid.');
  if (existing && (existing.itemContractVersion !== 1 || existing.status !== 'DRAFT' || existing.initialSnapshot != null)) throw new Error('Hanya draf kontrak item v1 yang dapat diperbarui.');
  if (source.itemContractVersion !== 1 || source.status !== 'DRAFT' || source.initialSnapshot != null || source.revision !== 1 || source.arrived !== false) throw new Error('Alur draf Material tidak valid.');
  if (!Array.isArray(source.revisions) || source.revisions.length || !Array.isArray(source.files) || source.files.length) throw new Error('Draf belum boleh memiliki revisi atau bukti final.');
  var record = { itemContractVersion: 1, status: 'DRAFT', initialSnapshot: null, revision: 1, revisions: [], files: [], arrived: false, workspaceDocumentId: utpText_(source.workspaceDocumentId, 'Referensi Pusat Dokumen', 100, false) };
  record.title = utpText_(source.title, 'Judul permintaan', 300, true);
  record.number = utpText_(source.number, 'Nomor permintaan', 160, false);
  record.date = utpDate_(source.date, 'Tanggal permintaan', true);
  record.note = utpText_(source.note, 'Catatan', 5000, false);
  var seen = Object.create(null);
  record.items = utpArray_(source.items, 'Item permintaan', 150).map(function (input, index) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Data item tidak valid.');
    var item = {};
    ['id', 'code', 'name', 'brand', 'model', 'unit', 'group', 'family'].forEach(function (key) {
      item[key] = utpText_(input[key], 'Item ' + (index + 1) + ': ' + key, key === 'name' ? 500 : 160, ['id', 'name', 'unit'].indexOf(key) >= 0);
    });
    if (seen[item.id]) throw new Error('ID item permintaan duplikat.');
    seen[item.id] = true;
    item.quantity = utpNumber_(input.quantity, 'Jumlah item', 0, false);
    item.classification = utpEnum_(input.classification, ['BRANDED', 'GENERIC', 'UNKNOWN', 'OWNER', 'OTHER'], 'Klasifikasi item');
    if (item.classification === 'BRANDED' && !item.brand || item.classification === 'GENERIC' && item.brand) throw new Error('Merek tidak sesuai klasifikasi item.');
    if (typeof input.isTemporary !== 'boolean') throw new Error('Penanda item sementara tidak valid.');
    item.isTemporary = input.isTemporary;
    item.requiredAuthority = utpText_(input.requiredAuthority, 'Jalur persetujuan', 40, false).toUpperCase();
    if (item.classification === 'OWNER' || item.classification === 'OTHER') {
      if (item.requiredAuthority) throw new Error('By Owner/Other tidak memerlukan jalur persetujuan.');
    } else if (['PM', 'MK', 'HO'].indexOf(item.requiredAuthority) < 0) throw new Error('Jalur persetujuan wajib PM/MK/HO.');
    if (input.finalFileId !== '' || input.supplyConfirmed !== false || input.status != null && input.status !== 'PENDING') throw new Error('Draf belum boleh memiliki hasil final atau kedatangan.');
    if (!input.decisions || typeof input.decisions !== 'object' || Array.isArray(input.decisions) || Object.keys(input.decisions).some(function (key) { return ['PM', 'MK', 'HO'].indexOf(key) < 0; })) throw new Error('Keputusan draf tidak valid.');
    item.decisions = {};
    ['PM', 'MK', 'HO'].forEach(function (authority) {
      var decision = input.decisions[authority];
      if (!decision || decision.status !== 'PENDING' || Object.keys(decision).some(function (key) { return key !== 'status' && decision[key] !== '' && decision[key] != null; })) throw new Error('Keputusan draf harus PENDING tanpa metadata review.');
      item.decisions[authority] = { status: 'PENDING' };
    });
    item.exceptionReason = utpText_(input.exceptionReason, 'Alasan pengecualian', 2000, false);
    item.note = utpText_(input.note, 'Catatan item', 2000, false);
    item.finalFileId = ''; item.supplyConfirmed = false;
    return item;
  });
  if (!record.items.length) throw new Error('Tambahkan minimal satu item.');
  return record;
}
function utpMaterialReady_(item, record, context) {
  if (!record.initialSnapshot) return false;
  if (['OWNER','OTHER'].indexOf(item.classification) >= 0) return item.supplyConfirmed === true;
  var parties = ['PM','MK','HO'], stop = parties.indexOf(item.requiredAuthority);
  if (stop < 0 || parties.slice(0, stop + 1).some(function(p){return !item.decisions[p] || item.decisions[p].status !== 'APPROVED';})) return false;
  if (!utpFindApproval_(item, utpProjectApprovalContext_(context,record.projectId||'legacy').approvals) && !item.exceptionReason) return false;
  return item.requiredAuthority !== 'HO' || (record.files || []).some(function(file){return file.id === item.finalFileId && file.coveredItemIds.indexOf(item.id) >= 0;});
}
function utpMaterialCommand_(operation, source, existing, context) {
  var ctx=utpProjectApprovalContext_(context,existing&&existing.projectId||'legacy'), parties=['PM','MK','HO'], now=ctx.now||new Date().toISOString();
  if (!existing || existing.itemContractVersion!==1 || existing.archived) throw new Error('Permintaan Material per item tidak ditemukan.');
  if (existing.arrived) throw new Error('Permintaan sudah dicatat datang; riwayat tetap terlindungi.');
  var next=utpClone_(existing), party=utpText_(ctx.party,'Pihak instruksi',20,false), reason=utpText_(ctx.reason,'Alasan instruksi',2000,false), changes=[];
  if (operation==='SAVE') {
    if (!existing.initialSnapshot) throw new Error('Gunakan penyimpanan draf sebelum pengajuan.');
    if (parties.indexOf(party)<0 || !reason) throw new Error('Pihak PM/MK/HO dan alasan instruksi wajib diisi.');
    var clean=utpClone_(source); clean.status='DRAFT';clean.itemContractVersion=1;clean.revision=1;clean.revisions=[];clean.files=[];clean.initialSnapshot=null;clean.arrived=false;
    clean.items=(clean.items||[]).map(function(item){item.decisions={PM:{status:'PENDING'},MK:{status:'PENDING'},HO:{status:'PENDING'}};item.finalFileId='';item.supplyConfirmed=false;delete item.status;return item;});
    var normalized=utpValidateMaterialDraft_(clean,null,ctx), oldItems=Object.create(null);
    existing.items.forEach(function(item){oldItems[item.id]=item;});
    if(existing.items.some(function(item){return !normalized.items.some(function(candidate){return candidate.id===item.id;});}))throw new Error('Item review tidak boleh dihapus; catat ditolak atau ditunda.');
    ['title','number','date','note'].forEach(function(key){if(next[key]!==normalized[key])changes.push({field:key,before:next[key],after:normalized[key]});next[key]=normalized[key];});
    next.items=normalized.items.map(function(item){
      var before=oldItems[item.id], input=source.items.find(function(x){return x.id===item.id;});
      item.decisions=before?utpClone_(before.decisions):{PM:{status:'PENDING'},MK:{status:'PENDING'},HO:{status:'PENDING'}};
      if(before && parties.indexOf(item.requiredAuthority)<parties.indexOf(before.requiredAuthority) && ['OWNER','OTHER'].indexOf(item.classification)<0)throw new Error('Jalur persetujuan tidak boleh diturunkan setelah pengajuan.');
      parties.forEach(function(p){
        var status=utpEnum_(input.decisions&&input.decisions[p]&&input.decisions[p].status,['PENDING','APPROVED','REJECTED','DEFERRED'],'Keputusan '+p,'PENDING');
        if(before && status!==before.decisions[p].status){
          if(p!==party)throw new Error('Simpan keputusan sesuai pihak instruksi yang dipilih.');
          if(['OWNER','OTHER'].indexOf(item.classification)>=0)throw new Error('By Owner/Other tidak memakai keputusan approval.');
          if(status!=='PENDING' && parties.slice(0,parties.indexOf(p)).some(function(previous){return item.decisions[previous].status!=='APPROVED';}))throw new Error('Catat persetujuan pihak sebelumnya lebih dahulu.');
          item.decisions[p]={status:status,at:now,reason:reason,actor:'Admin'};
        } else if(!before && status!=='PENDING')throw new Error('Item tambahan harus mulai PENDING.');
      });
      item.supplyConfirmed=['OWNER','OTHER'].indexOf(item.classification)>=0 && input.supplyConfirmed===true;
      item.finalFileId=utpText_(input.finalFileId,'Bukti final',160,false);
      if(item.finalFileId && (item.requiredAuthority!=='HO' || !(next.files||[]).some(function(file){return file.id===item.finalFileId&&file.coveredItemIds.indexOf(item.id)>=0;})))throw new Error('Bukti final tidak mencakup item HO ini.');
      return item;
    });
    changes=changes.concat(utpItemChanges_(existing.items,next.items));
    next.status='REVIEW';next.finalItemIds=[];next.finalSnapshot=null;
  } else if(operation==='SUBMIT') {
    if(existing.status!=='DRAFT'||existing.initialSnapshot)throw new Error('Hanya draf baru dapat diajukan.');
    next.initialSnapshot=utpRequestSnapshot_(existing);next.initialSnapshot.submittedAt=now;next.status='REVIEW';
    changes=[{field:'status',before:existing.status,after:'REVIEW'}];party='Admin';
  } else if(operation==='FINAL_FILE') {
    if(!existing.initialSnapshot)throw new Error('Ajukan permintaan sebelum pemberkasan.');
    var evidence=ctx.evidence;
    if(!evidence || !/^(application\/pdf|image\/(jpeg|png))$/.test(evidence.mime))throw new Error('Bukti final harus unggahan PDF/JPG/PNG terdaftar.');
    var coverage=utpStrings_(ctx.coveredItemIds,'Cakupan item',150);
    if(!coverage.length||coverage.some(function(id){return !next.items.some(function(item){return item.id===id&&item.requiredAuthority==='HO'&&['OWNER','OTHER'].indexOf(item.classification)<0;});}))throw new Error('Cakupan harus menunjuk item HO pada dokumen ini.');
    var metadata={id:evidence.fileId,name:evidence.name,mime:evidence.mime,url:evidence.url,coveredItemIds:coverage,at:now};
    next.files=next.files.filter(function(file){return file.id!==metadata.id;}).concat([metadata]);
    next.items.forEach(function(item){if(coverage.indexOf(item.id)>=0)item.finalFileId=metadata.id;else if(item.finalFileId===metadata.id)item.finalFileId='';});
    next.status='REVIEW';next.finalItemIds=[];next.finalSnapshot=null;
    party='HO';reason=utpText_(ctx.reason,'Catatan pemberkasan',2000,true);changes=[{field:'files',before:existing.files,after:next.files}];
  } else if(operation==='FINALIZE'||operation==='REVISION') {
    if(!next.initialSnapshot || parties.indexOf(party)<0 || !reason)throw new Error('Permintaan diajukan, pihak, dan alasan diperlukan.');
    if(operation==='FINALIZE') {
      next.finalItemIds=next.items.filter(function(item){return utpMaterialReady_(item,next,ctx);}).map(function(item){return item.id;});
      if(!next.finalItemIds.length)throw new Error('Belum ada item memenuhi jalur persetujuan dan bukti.');
      next.status='FINAL';next.finalSnapshot=utpRequestSnapshot_(next);next.finalSnapshot.items=next.finalSnapshot.items.filter(function(item){return next.finalItemIds.indexOf(item.id)>=0;});
      changes=[{field:'status',before:existing.status,after:'FINAL'},{field:'finalItemIds',before:existing.finalItemIds||[],after:next.finalItemIds}];
    } else {
      next.revision=(existing.revision||1)+1;next.revisions=(next.revisions||[]).concat([{revision:next.revision,publishedAt:now,actor:party,reason:reason,snapshot:utpRequestSnapshot_(next)}]);
      changes=[{field:'revision',before:existing.revision,after:next.revision}];
    }
  } else if(operation==='FULFILLMENT') {
    if(next.status!=='FINAL'||!next.finalSnapshot||ctx.confirmed!==true)throw new Error('Konfirmasi penyediaan memerlukan daftar final dan pernyataan eksplisit.');
    if(next.fulfillmentConfirmed)throw new Error('Penyediaan sudah dikonfirmasi; muat ulang daftar.');
    next.fulfillmentConfirmed=true;next.fulfillmentAt=now;next.fulfillmentNote=utpText_(ctx.reason,'Sumber konfirmasi penyediaan',2000,true);party='Admin';reason=next.fulfillmentNote;
    changes=[{field:'fulfillmentConfirmed',before:false,after:true}];
  } else if(operation==='ARRIVAL') {
    if(next.status!=='FINAL'||ctx.confirmed!==true)throw new Error('Konfirmasi kedatangan hanya untuk permintaan final.');
    next.arrived=true;next.arrivedAt=now;next.arrivalNote=utpText_(ctx.reason,'Sumber pengamatan',2000,true);party='Admin';reason=next.arrivalNote;
    if(ctx.arrivalDate)next.arrivalDate=utpDate_(ctx.arrivalDate,'Tanggal kedatangan',true);
    changes=[{field:'arrived',before:false,after:true}];
  } else throw new Error('Tindakan Material tidak dikenal.');
  if(['SAVE','FINAL_FILE','FINALIZE'].indexOf(operation)>=0&&existing.fulfillmentConfirmed){next.fulfillmentConfirmed=false;next.fulfillmentAt='';next.fulfillmentNote='';changes.push({field:'fulfillmentConfirmed',before:true,after:false});}
  next.history=(existing.history||[]).concat([{at:now,actor:party||'Admin',action:operation,reason:reason,changes:changes}]);
  return next;
}
function utpValidateRecord_(entity, source, existing, context) {
  utpEntity_(entity);
  if (!source || typeof source !== 'object' || Array.isArray(source)) throw new Error('Data rekaman tidak valid.');
  var record = {}, ctx = utpProjectApprovalContext_(context,existing&&existing.projectId||source.projectId||'legacy');
  function text(key, label, max, required) { record[key] = utpText_(source[key], label, max, required); }
  function date(key, label, required) { record[key] = utpDate_(source[key], label, required); }
  text('note', 'Catatan', 5000, false);
  if (entity === 'approvals') {
    record.generic = source.generic === true;
    record.status = utpEnum_(source.status, ['COMPARE', 'APPROVED', 'REJECTED', 'OWNER'], 'Status approval', 'COMPARE');
    text('material', 'Material', 300, true); text('brand', 'Merek', 160, !record.generic && record.status === 'APPROVED');
    if (record.generic) record.brand = '';
    record.types = utpStrings_(source.types, 'Tipe', 100);
    record.itemCodes = utpStrings_(source.itemCodes, 'Kode item', 300);
    record.authority = utpEnum_(source.authority, ['PM', 'MK', 'HO'], 'Pemberi approval', 'PM');
    text('brochureId', 'ID brosur', 160, false);
  } else if (entity === 'requests') {
    text('number', 'Nomor permintaan', 160, false); text('title', 'Judul permintaan', 300, true);
    date('date', 'Tanggal permintaan', true);
    record.authority = utpEnum_(source.authority, ['PM', 'MK', 'HO'], 'Otoritas review', existing ? existing.authority : 'PM');
    record.requiredAuthority = utpEnum_(source.requiredAuthority, ['PM', 'MK', 'HO'], 'Otoritas final yang dibutuhkan', existing ? existing.requiredAuthority || existing.authority : record.authority);
    if (existing && existing.initialSnapshot && ['PM', 'MK', 'HO'].indexOf(record.requiredAuthority) < ['PM', 'MK', 'HO'].indexOf(existing.requiredAuthority || existing.authority)) throw new Error('Otoritas final tidak boleh diturunkan setelah permintaan diajukan.');
    record.status = utpEnum_(source.status, UTP_REQUEST_STATUSES, 'Status permintaan', existing ? existing.status : 'DRAFT');
    if ((!existing && record.status !== 'DRAFT') || (existing && record.status !== existing.status)) throw new Error('Ubah status melalui tindakan proses permintaan.');
    record.items = utpRequestItems_(source.items, ctx);
    record.revision = existing ? existing.revision || 0 : 0;
    record.revisions = existing ? existing.revisions || [] : [];
    record.history = existing ? existing.history || [] : [];
    record.initialSnapshot = existing ? existing.initialSnapshot : null;
    text('finalFileId', 'ID bukti final HO', 160, false);
  } else if (entity === 'tasks') {
    text('title', 'Tugas', 300, true); date('dueDate', 'Tenggat', false);
    record.status = existing ? existing.status : 'OPEN';
    if (source.status && source.status !== record.status) throw new Error('Gunakan tindakan selesai/buka kembali untuk status tugas.');
    text('evidenceId', 'ID bukti tugas', 160, false);
    record.completedAt = existing ? existing.completedAt || '' : '';
    record.history = existing ? existing.history || [] : [];
  } else if (entity === 'purchases') {
    text('item', 'Nama material', 500, true); text('code', 'Kode item', 160, false);
    text('brand', 'Merek', 160, false); text('unit', 'Satuan', 80, true); text('category', 'Kelompok material', 100, false);
    record.quantity = utpNumber_(source.quantity, 'Jumlah pemesanan', 0, false);
    date('orderDate', 'Tanggal pemesanan', true); date('receivedDate', 'Tanggal diterima', false);
    if (record.receivedDate && record.receivedDate < record.orderDate) throw new Error('Tanggal diterima tidak boleh sebelum tanggal pemesanan.');
    text('requestId', 'ID permintaan', 160, false);
  } else if (entity === 'receipts') {
    date('date', 'Tanggal nota', true); text('vendor', 'Penjual', 300, true);
    record.total = utpNumber_(source.total, 'Total nota', 0, false);
    record.category = utpFinanceCategory_(source.category);
    record.status = utpEnum_(source.status, ['REVIEW', 'CONFIRMED'], 'Status nota', 'REVIEW');
    text('fundId', 'Sumber dana', 160, record.status === 'CONFIRMED');
    text('fileId', 'ID foto nota', 160, false); text('ocrText', 'Teks hasil OCR', 20000, false);
  } else if (entity === 'funds') {
    record.type = utpEnum_(source.type, ['RPB', 'RPD'], 'Jenis dana', 'RPB');
    record.amount = utpNumber_(source.amount, 'Dana diterima', 0, false);
    date('receivedDate', 'Tanggal dana diterima', true); text('recipient', 'Penerima dana', 300, true);
  } else if (entity === 'documents') {
    text('name', 'Nama dokumen', 300, true); text('fileId', 'ID file', 160, false);
    text('kind', 'Jenis dokumen', 100, false); text('recordId', 'Referensi rekaman', 160, false);
    text('mime', 'Tipe file', 100, false); text('url', 'URL dokumen', 1000, false);
    // Trust file metadata only when written by the upload adapter.
    record.uploadedByUtp = existing ? existing.uploadedByUtp === true : false;
    record.size = existing ? existing.size || 0 : 0;
    if (existing && existing.uploadedByUtp && record.fileId !== existing.fileId) throw new Error('File dokumen unggahan tidak boleh diganti melalui form.');
    if (existing && existing.uploadedByUtp) {
      record.mime = existing.mime; record.url = existing.url; record.digest = existing.digest || '';
    }
  } else if (entity === 'contacts') {
    text('name', 'Nama kontak', 300, true); text('role', 'Jabatan', 160, false);
    text('company', 'Perusahaan', 300, false); text('phone', 'Telepon', 80, false); text('email', 'Email', 300, false);
    if (record.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(record.email)) throw new Error('Alamat email kontak tidak valid.');
  } else if (entity === 'housing') {
    text('name', 'Nama mess', 300, true); text('address', 'Alamat mess', 2000, false);
    record.capacity = source.capacity === '' || source.capacity == null ? 0 : utpNumber_(source.capacity, 'Kapasitas', 0, true);
    if (!Number.isInteger(record.capacity)) throw new Error('Kapasitas harus bilangan bulat.');
    record.occupants = utpStrings_(source.occupants, 'Penghuni', 300);
    if (record.capacity && record.occupants.length > record.capacity) throw new Error('Penghuni melebihi kapasitas mess.');
  } else if (entity === 'attendance') {
    date('date', 'Tanggal absensi', true); text('person', 'Nama', 300, true);
    record.status = utpEnum_(source.status, ['PRESENT', 'ABSENT', 'LEAVE', 'SICK'], 'Kehadiran', 'PRESENT');
  }
  return record;
}
function utpItemChanges_(before, after) {
  var changes = [], oldMap = Object.create(null), newMap = Object.create(null);
  (before || []).forEach(function (item) { oldMap[item.id] = item; });
  (after || []).forEach(function (item) { newMap[item.id] = item; });
  var fields = ['code', 'name', 'brand', 'model', 'unit', 'quantity', 'status', 'approvalId', 'exceptionReason', 'exceptionApprovedBy', 'note', 'classification', 'requiredAuthority', 'decisions', 'finalFileId', 'supplyConfirmed', 'isTemporary'];
  Object.keys(oldMap).forEach(function (id) { if (!newMap[id]) changes.push({ itemId: id, code: oldMap[id].code, field: 'item', oldValue: utpClone_(oldMap[id]), newValue: null }); });
  Object.keys(newMap).forEach(function (id) {
    var oldItem = oldMap[id], newItem = newMap[id];
    if (!oldItem) changes.push({ itemId: id, code: newItem.code, field: 'item', oldValue: null, newValue: utpClone_(newItem) });
    else fields.forEach(function (field) {
      if (JSON.stringify(oldItem[field] == null ? '' : oldItem[field]) !== JSON.stringify(newItem[field] == null ? '' : newItem[field])) changes.push({ itemId: id, code: newItem.code, field: field, oldValue: oldItem[field] == null ? '' : oldItem[field], newValue: newItem[field] == null ? '' : newItem[field] });
    });
  });
  return changes;
}
function utpRequestSnapshot_(record) {
  return { projectId:record.projectId||'legacy', number: record.number, date: record.date, title: record.title, note: record.note || '', revision: record.revision, authority: record.authority, requiredAuthority: record.requiredAuthority || record.authority, status: record.status, items: utpClone_(record.items || []), files: utpClone_(record.files || []), finalFileId: record.finalFileId || '' };
}
function utpRequestReachedHo_(record) {
  return !!record && (record.status === 'HO' || (record.history || []).some(function (event) {
    return (event.changes || []).some(function (change) { return change.field === 'status' && (change.oldValue === 'HO' || change.newValue === 'HO'); });
  }));
}
function utpRecordRequestSave_(record, previous, now, actor) {
  var changes = utpItemChanges_(previous ? previous.items : [], record.items);
  if (previous) ['title', 'number', 'date', 'authority', 'requiredAuthority', 'finalFileId', 'note'].forEach(function (field) {
    if ((previous[field] || '') !== (record[field] || '')) changes.push({ field: field, oldValue: previous[field] || '', newValue: record[field] || '' });
  });
  record.history = utpClone_(previous ? previous.history || [] : []);
  if (changes.length || !previous) record.history.push({ at: now, action: previous ? 'EDIT' : 'CREATE', actor: actor || 'Operator', note: '', changes: changes });
  record.initialSnapshot = previous && previous.initialSnapshot ? utpClone_(previous.initialSnapshot) : null;
  return record;
}
function utpTransitionRequest_(record, status, context) {
  var next = utpClone_(record), ctx = utpProjectApprovalContext_(context,record.projectId||'legacy');
  var target = utpEnum_(status, UTP_REQUEST_STATUSES, 'Status permintaan', 'DRAFT');
  var allowed = { DRAFT: ['PM', 'MK', 'HO', 'CANCELLED'], PM: ['DRAFT', 'MK', 'HO', 'FINAL', 'CANCELLED'], MK: ['PM', 'HO', 'FINAL', 'CANCELLED'], HO: ['PM', 'MK', 'FINAL', 'CANCELLED'], FINAL: ['PM', 'MK', 'HO', 'ARRIVED', 'CANCELLED'], ARRIVED: ['PM', 'MK', 'HO'], CANCELLED: ['DRAFT'] };
  if ((allowed[record.status] || []).indexOf(target) < 0) throw new Error('Perubahan status ' + record.status + ' ke ' + target + ' tidak diperbolehkan.');
  if (target !== 'DRAFT' && target !== 'CANCELLED' && !next.items.length) throw new Error('Permintaan belum memiliki item.');
  if ((target === 'FINAL' || target === 'ARRIVED') && utpRequestReachedHo_(record) && !ctx.validFinalEvidence) throw new Error('Final jalur HO memerlukan PDF/foto bukti persetujuan HO yang diunggah melalui aplikasi.');
  if (target === 'FINAL') {
    var required = record.requiredAuthority || record.authority || 'PM';
    if (['PM', 'MK', 'HO'].indexOf(record.status) < ['PM', 'MK', 'HO'].indexOf(required)) throw new Error('Permintaan masih memerlukan review ' + required + ' sebelum final.');
    if (!next.items.some(function (item) { return item.status === 'APPROVED' || item.status === 'OWNER'; })) throw new Error('Final memerlukan minimal satu item disetujui atau disediakan owner. Item lain boleh ditolak/ditunda.');
    next.items.forEach(function(item){if(item.status==='APPROVED'&&!item.exceptionReason&&!utpFindApproval_(item,ctx.approvals))throw new Error('Approval aktif untuk item '+item.name+' tidak tersedia pada proyek permintaan. Tinjau ulang atau catat alasan pengecualian.');});
  }
  if (!next.initialSnapshot && record.status === 'DRAFT' && ['PM', 'MK', 'HO'].indexOf(target) >= 0) {
    next.initialSnapshot = utpRequestSnapshot_(record);
    next.initialSnapshot.submittedAt = ctx.now;
  }
  next.status = target;
  if (['PM', 'MK', 'HO'].indexOf(target) >= 0) next.authority = target;
  next.history = next.history || [];
  next.history.push({ at: ctx.now, action: 'STATUS', actor: ctx.actor || 'Operator', note: utpText_(ctx.note, 'Catatan perubahan', 2000, false), changes: [{ field: 'status', oldValue: record.status, newValue: target }] });
  return next;
}
function utpPublishRevision_(record, context) {
  if (record.archived) throw new Error('Permintaan diarsipkan.');
  var result = utpClone_(record), ctx = context || {};
  var actor = utpEnum_(ctx.actor, ['PM', 'MK', 'HO'], 'Penerbit revisi');
  if (!(record.items || []).length) throw new Error('Revisi memerlukan minimal satu item.');
  result.revision = (result.revision || 0) + 1;
  result.revisions = result.revisions || [];
  result.revisions.push({ revision: result.revision, publishedAt: ctx.now, actor: actor, note: utpText_(ctx.note, 'Alasan revisi', 2000, true), snapshot: utpRequestSnapshot_(result) });
  result.history = result.history || [];
  result.history.push({ at: ctx.now, action: 'PUBLISH_REVISION', actor: actor, note: ctx.note, changes: [{ field: 'revision', oldValue: record.revision || 0, newValue: result.revision }] });
  return result;
}
// One edit for alphabetic words >=5 characters; codes/specifications stay exact.
function utpSearchWord_(term, word) {
  if (word.indexOf(term) >= 0) return true;
  if (!/^[a-z]{5,40}$/.test(term) || !/^[a-z]+$/.test(word) || Math.abs(term.length-word.length)>1) return false;
  var i=0,j=0,edits=0;
  while(i<term.length&&j<word.length){if(term[i]===word[j]){i++;j++;continue;}if(++edits>1)return false;if(term.length<=word.length)j++;if(term.length>=word.length)i++;}
  return edits+(i<term.length||j<word.length?1:0)<=1;
}
function utpSearchItems_(items, filters, approvals) {
  var options = filters || {}, terms = utpNorm_(options.query).split(' ').filter(Boolean);
  var brandClass = String(options.brandClass || options.classification || 'ALL').toUpperCase();
  if (['ALL', 'BRANDED', 'GENERIC', 'UNKNOWN'].indexOf(brandClass) < 0) throw new Error('Filter jenis merek tidak valid.');
  var selectedClasses = options.brandClasses || [];
  if (!Array.isArray(selectedClasses) || selectedClasses.some(function(value){return ['BRANDED','GENERIC','UNKNOWN'].indexOf(value)<0;})) throw new Error('Filter jenis merek tidak valid.');
  var typeQuery = utpNorm_(options.typeQuery || options.model);
  if (typeQuery.length > 160) throw new Error('Filter tipe/spesifikasi terlalu panjang.');
  var limit = Math.max(1, Math.min(50, Number(options.limit) || 50));
  var offset = options.offset == null ? 0 : Number(options.offset);
  if (!Number.isSafeInteger(offset) || offset < 0) throw new Error('Posisi halaman pencarian tidak valid.');
  // Index approval candidates once; preserve their original order and exact matcher.
  var byBrand=Object.create(null),generic=[];
  (approvals||[]).forEach(function(a){if(a.archived||a.status!=='APPROVED')return;if(a.generic){generic.push(a);return;}var seen=Object.create(null);String(a.brand||'').split(/[,;\n]/).forEach(function(b){var key=utpNorm_(b);if(key&&!seen[key]){seen[key]=true;(byBrand[key]||(byBrand[key]=[])).push(a);}});});
  var matches = (items || []).filter(function (item) {
    if (item.archived || (options.favoriteOnly && !item.favorite)) return false;
    if (brandClass !== 'ALL' && utpItemClassification_(item) !== brandClass) return false;
    if (selectedClasses.length && selectedClasses.indexOf(utpItemClassification_(item)) < 0) return false;
    if (options.brand && utpNorm_(item.brand) !== utpNorm_(options.brand)) return false;
    if (typeQuery && utpNorm_(item.model).indexOf(typeQuery) < 0) return false;
    if (options.group && utpNorm_(item.group) !== utpNorm_(options.group)) return false;
    if(!terms.length)return true;
    var text = utpNorm_(UTP_MASTER_FIELDS.map(function (key) { return item[key] || ''; }).concat(item.note || '').join(' '));
    var words;
    return terms.every(function (term) { if(text.indexOf(term)>=0)return true;if(!options.fuzzy)return false;words=words||utpNorm_(item.name).split(/[^a-z0-9]+/);return words.some(function(word){return utpSearchWord_(term,word);}); });
  }).map(function (item) {
    var classification=utpItemClassification_(item),candidates=classification==='GENERIC'?generic:classification==='BRANDED'?byBrand[utpNorm_(item.brand)]||[]:[];
    return {item:item,approval:utpFindApproval_(item,candidates)};
  }).filter(function (row) { return !options.approvedOnly || row.approval; });
  var sortBy=String(options.sortBy||''),direction=options.sortDirection==='desc'?-1:1;
  if(sortBy&&['code','name','brand','model','group','unit','approved'].indexOf(sortBy)<0)throw new Error('Kolom pengurutan tidak valid.');
  matches.sort(function (x, y) {var a=x.item,b=y.item;return sortBy?direction*(sortBy==='approved'?Number(!!x.approval)-Number(!!y.approval):String(a[sortBy]||'').localeCompare(String(b[sortBy]||''),'id',{numeric:true}))||String(a.code).localeCompare(String(b.code)):Number(!!y.approval)-Number(!!x.approval)||Number(!!b.favorite)-Number(!!a.favorite)||String(a.name).localeCompare(String(b.name),'id')||String(a.code).localeCompare(String(b.code));});
  offset = matches.length ? Math.min(offset, Math.floor((matches.length - 1) / limit) * limit) : 0;
  return { items: matches.slice(offset, offset + limit).map(function(row){var copy=utpClone_(row.item),a=row.approval;copy.approved=!!a;copy.approvalId=a?a.id:'';copy.approvalAuthority=a?a.authority:'';return copy;}), total: matches.length, offset: offset, limit: limit, hasMore: offset + limit < matches.length,brands:Array.from(new Set((items||[]).filter(function(r){return !r.archived&&r.brand;}).map(function(r){return r.brand;}))).sort() };
}
function utpParseCsv_(source) {
  var csv = String(source || '').replace(/^\uFEFF/, ''), rows = [], row = [], value = '', quoted = false, afterQuote = false;
  if (csv.length > 8000000) throw new Error('CSV maksimal 8 MB. Bagi impor menjadi beberapa berkas.');
  // RFC 4180 quoting: preserve item codes and embedded commas/newlines exactly.
  for (var i = 0; i < csv.length; i++) {
    var c = csv[i];
    if (quoted) {
      if (c === '"' && csv[i + 1] === '"') { value += '"'; i++; }
      else if (c === '"') { quoted = false; afterQuote = true; }
      else value += c;
    } else if (c === '"') {
      if (value || afterQuote) throw new Error('CSV memiliki tanda kutip yang tidak valid pada baris ' + (rows.length + 1) + '.');
      quoted = true;
    } else if (c === ',' || c === '\n' || c === '\r') {
      row.push(value); value = ''; afterQuote = false;
      if (c !== ',') { if (row.some(function (x) { return x !== ''; })) rows.push(row); row = []; if (c === '\r' && csv[i + 1] === '\n') i++; }
    } else {
      if (afterQuote && c.trim()) throw new Error('CSV memiliki karakter setelah tanda kutip penutup.');
      if (!afterQuote) value += c;
    }
  }
  if (quoted) throw new Error('CSV memiliki kutip yang belum ditutup.');
  row.push(value); if (row.some(function (x) { return x !== ''; })) rows.push(row);
  if (!rows.length) throw new Error('CSV kosong.');
  var headers = rows.shift().map(function (x) { return x.trim(); });
  if (new Set(headers).size !== headers.length) throw new Error('Header CSV duplikat.');
  if (headers.indexOf('code') < 0 || headers.indexOf('name') < 0) throw new Error('CSV wajib memiliki kolom code dan name.');
  if (rows.length > 30000) throw new Error('Satu impor maksimal 30.000 item.');
  return { headers: headers, rows: rows };
}
function utpPreviewImport_(csv, existingItems) {
  var parsed = utpParseCsv_(csv), existing = Object.create(null), seen = Object.create(null), plan = { total: parsed.rows.length, added: 0, updated: 0, unchanged: 0, invalid: [], sample: [], items: [] };
  (existingItems || []).forEach(function (item) { existing[item.code] = item; });
  parsed.rows.forEach(function (cells, index) {
    try {
      if (cells.length !== parsed.headers.length) throw new Error('Jumlah kolom tidak sesuai header.');
      var incoming = {};
      parsed.headers.forEach(function (key, column) { if (UTP_MASTER_FIELDS.indexOf(key) >= 0 || key === 'favorite') incoming[key] = cells[column]; });
      var code = utpText_(incoming.code, 'Kode', 160, true);
      if (seen[code]) throw new Error('Kode duplikat dalam CSV: ' + code + '.');
      seen[code] = true;
      var old = existing[code], item = old ? utpClone_(old) : {};
      UTP_MASTER_FIELDS.forEach(function (field) {
        if (Object.prototype.hasOwnProperty.call(incoming, field)) {
          utpText_(incoming[field], field, field === 'name' ? 500 : 200, field === 'code' || field === 'name');
          item[field] = field === 'code' ? code : incoming[field];
        }
        else if (item[field] == null) item[field] = '';
      });
      item.favorite = Object.prototype.hasOwnProperty.call(incoming, 'favorite') ? /^(1|true|yes|ya)$/i.test(incoming.favorite.trim()) : !!item.favorite;
      var diffs = UTP_MASTER_FIELDS.concat(['favorite']).filter(function (field) { return !old || (old[field] || '') !== (item[field] || ''); }).map(function (field) { return { field: field, oldValue: old ? old[field] || '' : '', newValue: item[field] }; });
      var change = !old ? 'added' : diffs.length ? 'updated' : 'unchanged';
      plan[change]++;
      if (plan.sample.length < 20 && change !== 'unchanged') plan.sample.push({ row: index + 2, code: code, name: item.name, change: change, diffs: diffs });
      plan.items.push(item);
    } catch (error) { plan.invalid.push({ row: index + 2, message: error.message }); }
  });
  return plan;
}
function utpMedian_(numbers) {
  var sorted = numbers.slice().sort(function (a, b) { return a - b; }), mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
function utpForecast_(purchases) {
  var groups = Object.create(null);
  (purchases || []).filter(function (row) { return !row.archived; }).forEach(function (row) {
    var key = utpNorm_(row.code || row.item) + '|' + utpNorm_(row.brand) + '|' + utpNorm_(row.unit);
    if (!groups[key]) groups[key] = [];
    groups[key].push(row);
  });
  return Object.keys(groups).map(function (key) {
    var rows = groups[key].slice().sort(function (a, b) { return a.orderDate.localeCompare(b.orderDate); });
    // Several order lines on the same day are one ordering event.
    var events = Object.create(null);
    rows.forEach(function (row) { events[row.orderDate] = (events[row.orderDate] || 0) + Number(row.quantity); });
    var dates = Object.keys(events).sort(), last = rows[rows.length - 1];
    var result = { item: last.item, code: last.code || '', brand: last.brand || '', unit: last.unit, sampleCount: dates.length, basis: 'ORDERING', confidence: 'INSUFFICIENT', averageIntervalDays: null, medianIntervalDays: null, nextOrderDate: '', projectedQuantity: null, quantityRange: [], warning: 'Data kurang dari 3 tanggal pemesanan. Belum cukup untuk prediksi. Angka ini pola pemesanan, bukan pemakaian aktual.' };
    if (dates.length < 3) return result;
    var intervals = dates.slice(1).map(function (date, i) { return (Date.parse(date + 'T00:00:00Z') - Date.parse(dates[i] + 'T00:00:00Z')) / 86400000; });
    var quantities = dates.map(function (date) { return events[date]; }), mean = intervals.reduce(function (a, b) { return a + b; }, 0) / intervals.length;
    var variance = intervals.reduce(function (sum, interval) { return sum + Math.pow(interval - mean, 2); }, 0) / intervals.length;
    var irregular = Math.sqrt(variance) / mean > 0.5;
    result.averageIntervalDays = Math.round(mean * 10) / 10;
    result.medianIntervalDays = utpMedian_(intervals);
    result.nextOrderDate = new Date(Date.parse(dates[dates.length - 1] + 'T00:00:00Z') + Math.round(result.medianIntervalDays) * 86400000).toISOString().slice(0, 10);
    result.projectedQuantity = Math.round(utpMedian_(quantities) * 100) / 100;
    result.quantityRange = [Math.min.apply(null, quantities), Math.max.apply(null, quantities)];
    result.confidence = dates.length >= 5 && !irregular ? 'MODERATE' : 'LOW';
    result.warning = (irregular ? 'Jarak pemesanan tidak teratur; perkiraan berisiko meleset. ' : 'Perkiraan sederhana dari riwayat pemesanan; bukan kebutuhan pasti. ') + 'Rentang jumlah adalah rentang historis, bukan interval kepercayaan. Bukan pemakaian aktual atau saldo gudang.';
    return result;
  });
}
function utpFinance_(funds, receipts) {
  var activeFunds = (funds || []).filter(function (x) { return !x.archived; }), ids = Object.create(null);
  var total = activeFunds.reduce(function (sum, fund) { ids[fund.id] = true; return sum + Number(fund.amount); }, 0);
  var spent = (receipts || []).filter(function (receipt) { return !receipt.archived && receipt.status === 'CONFIRMED' && ids[receipt.fundId]; }).reduce(function (sum, receipt) { return sum + Number(receipt.total); }, 0);
  return { funds: Math.round(total * 100) / 100, spent: Math.round(spent * 100) / 100, balance: Math.round((total - spent) * 100) / 100 };
}

if (typeof module !== 'undefined' && module.exports) module.exports = { project: UTP_PROJECT, materialCommand: utpMaterialCommand_, materialReady: utpMaterialReady_, validateMaterialDraft: utpValidateMaterialDraft_, validate: utpValidateRecord_, date: utpDate_, number: utpNumber_, approvalMatches: utpApprovalMatches_, requestItems: utpRequestItems_, itemChanges: utpItemChanges_, recordRequestSave: utpRecordRequestSave_, transition: utpTransitionRequest_, publishRevision: utpPublishRevision_, searchItems: utpSearchItems_, parseCsv: utpParseCsv_, previewImport: utpPreviewImport_, forecast: utpForecast_, finance: utpFinance_ };
