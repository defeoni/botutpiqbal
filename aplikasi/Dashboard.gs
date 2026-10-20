function apiDashboard(token,projectId) {
  requireAuthorized_(token);
  projectId=workspaceProjectId_(projectId,true);
  var result = { project: UTP_PROJECT, loadedAt: new Date().toISOString(), warnings: [], activities: [] };
  function part(name, load) { try { result[name] = load(); } catch (e) { result[name] = null; result.warnings.push(name + ': ' + e.message); } }
  part('memo', function () {
    var sheet = getMemoHistorySheet_(false);
    if (!sheet || sheet.getLastRow() < 2) return { count: 0 };
    var rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 10).getValues().filter(function(r){var link=utpGet_('memoProjects',String(r[1]));return workspaceProjectMatches_(link||{},projectId);});
    rows.slice(-5).forEach(function (r) { result.activities.push({ date: r[0] instanceof Date ? r[0].toISOString() : String(r[0]), text: 'Memo · ' + r[1] }); });
    return { count: rows.length, board: rows.map(function(r){return {id:String(r[1]),title:String(r[1]),subtitle:String(r[2])+' · '+String(r[3]),status:'Arsip tersedia',stage:'ARCHIVED',module:'MEMO',date:r[0] instanceof Date?r[0].toISOString():String(r[0]),url:String(r[6]||r[5]||'')};}) };
  });
  part('rpb', function () {
    var rows = getRpbHistory_().filter(function(r){return workspaceProjectMatches_(r.data||{},projectId);});
    rows.slice(0, 5).forEach(function (r) { result.activities.push({ date: r.requestDate, text: 'RPB · ' + r.number + ' · ' + r.status }); });
    return { count: rows.length, board:rows.map(function(r){return {id:r.id,title:r.number,subtitle:'Rencana Pengeluaran Bulanan',status:r.status,stage:['Serah terima selesai','Ditolak'].indexOf(r.status)>=0?'ARCHIVED':'PROCESS',module:'RPB',date:r.requestDate};}), pending: rows.filter(function (r) { return ['Serah terima selesai', 'Ditolak'].indexOf(r.status) < 0; }).length };
  });
  part('material', function () {
    var rows = utpRead_('requests').filter(function(r){return workspaceProjectMatches_(r,projectId);});
    var distribution = { Draf:0, Review:0, 'Menunggu barang':0, Datang:0, Dibatalkan:0 };
    rows.forEach(function(r){ var key = r.arrived || r.status==='ARRIVED' ? 'Datang' : r.status==='DRAFT' ? 'Draf' : r.status==='FINAL' ? 'Menunggu barang' : r.status==='CANCELLED' ? 'Dibatalkan' : 'Review'; distribution[key]++; });
    return { review: rows.filter(function (r) { return r.initialSnapshot && ['FINAL', 'ARRIVED', 'CANCELLED'].indexOf(r.status) < 0; }).length,
      board:rows.map(function(r){return {id:r.id,title:r.title,number:r.number,status:r.status,arrived:r.arrived,fulfillmentConfirmed:r.fulfillmentConfirmed,date:r.date,itemCount:(r.items||[]).length};}),
      distribution: distribution,
      waiting: rows.filter(function (r) { return r.status === 'FINAL' && !r.arrived; }).length,
      arrived: rows.filter(function (r) { return r.arrived || r.status === 'ARRIVED'; }).length,
      recent: rows.sort(function (a,b) { return String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')); }).slice(0,5).map(function (r) { return { number:r.number, title:r.title, status:r.status, arrived:r.arrived }; }) };
  });
  part('rpd',function(){return {board:utpRead_('workspaceRpd').filter(function(r){return workspaceProjectMatches_(r,projectId);}).map(function(r){return {id:r.id,title:r.purpose||r.name||'Pengajuan dana',subtitle:'Rencana Pengeluaran Dana',module:'RPD',status:r.status,stage:r.status==='DRAFT'?'DRAFT':'PROCESS',date:r.date};})};});
  part('workspace', function () { return apiWorkspace('summary', {projectId:projectId}, token); });
  if (result.workspace && result.workspace.activities) result.activities = result.activities.concat(result.workspace.activities.filter(function(r){return r.module==='rpd';}));
  result.activities.sort(function(a,b) { return String(b.date || '').localeCompare(String(a.date || '')); });
  result.activities = result.activities.slice(0, 8);
  return result;
}
function apiResetProject(payload, token) {
  requireAuthorized_(token); payload = payload || {};
  requireDeletePin_(payload.pin);
  if (payload.confirmation !== 'RESET PROYEK') throw new Error('Ketik RESET PROYEK untuk mengonfirmasi cakupan pengarsipan.');
  var lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    var entities = ['approvals','requests','tasks','purchases','receipts','funds','contacts','housing','attendance',
      'workspaceTasks','workspaceFinance','workspaceArchives','workspacePeople','workspaceAttendance'];
    var count = 0, warnings = [];
    entities.forEach(function (entity) {
      utpRead_(entity).forEach(function (record) {
        record.archived = true;
        try { utpWrite_(entity, record, record.version); count++; }
        catch (e) { if (e.recordSaved) count++; warnings.push(entity + ': ' + e.message); }
      });
    });
    return { count: count, warnings: warnings, message: count + ' catatan proyek diarsipkan. Master material, file Drive, Memo, RPB, RPD, login, dan PIN dipertahankan.' };
  } finally { lock.releaseLock(); }
}
