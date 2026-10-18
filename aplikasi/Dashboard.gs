function apiDashboard(token) {
  requireAuthorized_(token);
  var result = { project: UTP_PROJECT, loadedAt: new Date().toISOString(), warnings: [], activities: [] };
  function part(name, load) { try { result[name] = load(); } catch (e) { result[name] = null; result.warnings.push(name + ': ' + e.message); } }
  part('memo', function () {
    var sheet = getMemoHistorySheet_(false);
    if (!sheet || sheet.getLastRow() < 2) return { count: 0 };
    var rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 10).getValues();
    rows.slice(-5).forEach(function (r) { result.activities.push({ date: r[0] instanceof Date ? r[0].toISOString() : String(r[0]), text: 'Memo · ' + r[1] }); });
    return { count: rows.length };
  });
  part('rpb', function () {
    var rows = getRpbHistory_();
    rows.slice(0, 5).forEach(function (r) { result.activities.push({ date: r.requestDate, text: 'RPB · ' + r.number + ' · ' + r.status }); });
    return { count: rows.length, pending: rows.filter(function (r) { return ['Serah terima selesai', 'Ditolak'].indexOf(r.status) < 0; }).length };
  });
  part('material', function () {
    var rows = utpRead_('requests');
    var distribution = { Draf:0, Review:0, 'Menunggu barang':0, Datang:0, Dibatalkan:0 };
    rows.forEach(function(r){ var key = r.arrived || r.status==='ARRIVED' ? 'Datang' : r.status==='DRAFT' ? 'Draf' : r.status==='FINAL' ? 'Menunggu barang' : r.status==='CANCELLED' ? 'Dibatalkan' : 'Review'; distribution[key]++; });
    return { review: rows.filter(function (r) { return r.initialSnapshot && ['FINAL', 'ARRIVED', 'CANCELLED'].indexOf(r.status) < 0; }).length,
      distribution: distribution,
      waiting: rows.filter(function (r) { return r.status === 'FINAL' && !r.arrived; }).length,
      arrived: rows.filter(function (r) { return r.arrived || r.status === 'ARRIVED'; }).length,
      recent: rows.sort(function (a,b) { return String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')); }).slice(0,5).map(function (r) { return { number:r.number, title:r.title, status:r.status, arrived:r.arrived }; }) };
  });
  part('workspace', function () { return apiWorkspace('summary', {}, token); });
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
