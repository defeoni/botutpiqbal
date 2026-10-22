/* One private Drive tree for PT. UTP. Moves keep IDs so old links and sheets stay valid. */
var SISTEM_DRIVE_ = {
  root: 'SISTEM PT.UTP',
  templates: '00_TEMPLATE ASLI',
  projects: '01_PROYEK',
  internal: '02_SISTEM INTERNAL',
  legacy: '90_DATA LAMA',
  quarantine: '99_KARANTINA',
  templateSections: ['Memo', 'RPB', 'RPD', 'LPD', 'Dokumen Lain'],
  projectSections: ['01_RPB', '02_RPD', '03_LPD', '04_MEMO', '05_ARSIP', '06_EKSPOR', '07_LAMPIRAN'],
  internalSections: ['Dokumen Privat', 'Unggahan Sementara', 'Data Operasional'],
  legacySections: ['01_RPB', '02_RPD', '03_LPD', '04_MEMO', '05_ARSIP', '06_EKSPOR', '07_LAMPIRAN']
};
var SISTEM_DRIVE_TYPE_PATHS_ = {
  'RPB': '01_RPB', 'rpb': '01_RPB',
  'RPD': '02_RPD', 'rpd': '02_RPD',
  'LPD': '03_LPD', 'lpd': '03_LPD', 'Nota dan Keuangan': '03_LPD/Nota dan Bukti',
  'Memo': '04_MEMO', 'memo': '04_MEMO',
  'Arsip': '05_ARSIP', 'arsip': '05_ARSIP',
  'Ekspor': '06_EKSPOR', 'ekspor': '06_EKSPOR', 'Material': '06_EKSPOR',
  'Dokumen': '07_LAMPIRAN', 'Lampiran': '07_LAMPIRAN', 'lampiran': '07_LAMPIRAN', 'Dokumen Lain': '07_LAMPIRAN'
};
var SISTEM_DRIVE_OLD_SECTIONS_ = {
  'Memo': '04_MEMO', 'RPD': '02_RPD', 'RPB': '01_RPB', 'LPD': '03_LPD', 'Arsip': '05_ARSIP',
  'Ekspor': '06_EKSPOR', 'Dokumen': '07_LAMPIRAN', 'Lampiran': '07_LAMPIRAN', 'Material': '06_EKSPOR'
};
var SISTEM_DRIVE_LIMIT_ = 25;
var SISTEM_DRIVE_BUDGET_MS_ = 20000;

function sistemDriveName_(value, fallback) {
  var name = String(value == null ? '' : value).replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim();
  if (!name) name = String(fallback || '').trim();
  if (!name) throw new Error('Nama folder kosong.');
  return name.slice(0, 120);
}
function sistemDriveProjectLabel_(project) { return sistemDriveName_('[' + project.code + '] - ' + project.name); }
function sistemDriveTypePath_(type) {
  if (type == null || type === '') return '';
  var key = String(type);
  if (Object.prototype.hasOwnProperty.call(SISTEM_DRIVE_TYPE_PATHS_, key)) return SISTEM_DRIVE_TYPE_PATHS_[key];
  return '07_LAMPIRAN';
}
function sistemDriveProtect_(folder, strict) {
  var access = folder.getSharingAccess ? folder.getSharingAccess() : null;
  if (access !== DriveApp.Access.PRIVATE) folder.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.NONE);
  var shared = folder.getSharingAccess && folder.getSharingAccess() !== DriveApp.Access.PRIVATE;
  if (!shared && folder.getEditors) shared = folder.getEditors().length > 0 || folder.getViewers().length > 0;
  if (!shared) return true;
  if (strict) throw new Error('Folder ' + folder.getName() + ' tidak dapat dijadikan privat.');
  return false;
}
function sistemDriveProtectTree_(folder) {
  sistemDriveProtect_(folder, false);
  var children = folder.getFolders();
  while (children.hasNext()) sistemDriveProtectTree_(children.next());
}
function sistemDriveRoot_(create) {
  var props = PropertiesService.getScriptProperties(), rootId = props.getProperty('SISTEM_DRIVE_ROOT_ID');
  if (rootId) {
    try { return DriveApp.getFolderById(rootId); } catch (error) { rootId = ''; }
  }
  var legacyId = props.getProperty('DRIVE_ROOT_FOLDER_ID');
  if (!create) {
    if (legacyId) {
      try { return DriveApp.getFolderById(legacyId); } catch (error) { /* fall through to name lookup */ }
    }
    var matches = DriveApp.getFoldersByName(SISTEM_DRIVE_.root);
    return matches.hasNext() ? matches.next() : null;
  }
  var root;
  try { root = legacyId ? DriveApp.getFolderById(legacyId) : null; } catch (error) { root = null; }
  if (!root) {
    var existing = DriveApp.getFoldersByName(SISTEM_DRIVE_.root);
    root = existing.hasNext() ? existing.next() : DriveApp.createFolder(SISTEM_DRIVE_.root);
  }
  if (root.getName() !== SISTEM_DRIVE_.root) root.setName(SISTEM_DRIVE_.root);
  props.setProperty('SISTEM_DRIVE_ROOT_ID', root.getId());
  props.setProperty('DRIVE_ROOT_FOLDER_ID', root.getId());
  return root;
}
function sistemDriveChildFolder_(parent, name, create) {
  var safe = sistemDriveName_(name), matches = parent.getFoldersByName(safe);
  if (matches.hasNext()) return matches.next();
  if (!create) return null;
  var folder = parent.createFolder(safe);
  sistemDriveProtect_(folder, true);
  return folder;
}
function sistemDriveSubpath_(base, path, create) {
  var parts = String(path || '').split('/').filter(function (part) { return !!part; }), folder = base;
  for (var i = 0; i < parts.length; i++) folder = sistemDriveChildFolder_(folder, parts[i], create);
  return folder;
}
function sistemDriveEnsureBase_(root, planned) {
  sistemDriveProtect_(root, false);
  planned = planned || {};
  var templates = sistemDriveChildFolder_(root, SISTEM_DRIVE_.templates, true);
  SISTEM_DRIVE_.templateSections.forEach(function (name) { sistemDriveChildFolder_(templates, name, true); });
  sistemDriveChildFolder_(root, SISTEM_DRIVE_.projects, true);
  var internal = sistemDriveChildFolder_(root, SISTEM_DRIVE_.internal, true);
  SISTEM_DRIVE_.internalSections.forEach(function (name) { if (!planned[name]) sistemDriveChildFolder_(internal, name, true); });
  var legacy = sistemDriveChildFolder_(root, SISTEM_DRIVE_.legacy, true);
  SISTEM_DRIVE_.legacySections.forEach(function (name) { sistemDriveChildFolder_(legacy, name, true); });
  sistemDriveChildFolder_(root, SISTEM_DRIVE_.quarantine, true);
  return root;
}
function sistemDriveProjectFolder_(project, create) {
  var root = sistemDriveRoot_(create);
  if (!root) return null;
  var container = sistemDriveChildFolder_(root, SISTEM_DRIVE_.projects, create);
  if (!container) return null;
  var folder = sistemDriveChildFolder_(container, sistemDriveProjectLabel_(project), create);
  if (folder && create) {
    SISTEM_DRIVE_.projectSections.forEach(function (name) { sistemDriveChildFolder_(folder, name, true); });
    sistemDriveChildFolder_(sistemDriveChildFolder_(folder, '03_LPD', true), 'Nota dan Bukti', true);
  }
  return folder;
}
function sistemDriveInternalFolder_(name, create) {
  var root = sistemDriveRoot_(create);
  if (!root) return null;
  var internal = sistemDriveChildFolder_(root, SISTEM_DRIVE_.internal, create);
  if (!internal) return null;
  if (!name) return internal;
  return sistemDriveChildFolder_(internal, name, create);
}
function sistemDriveLegacyFolder_(projectName, create) {
  var root = sistemDriveRoot_(create);
  if (!root) return null;
  var legacy = sistemDriveChildFolder_(root, SISTEM_DRIVE_.legacy, create);
  if (!legacy) return null;
  if (!projectName) return legacy;
  return sistemDriveChildFolder_(legacy, sistemDriveName_(projectName), create);
}
function sistemDriveMatchProject_(name, projects) {
  var raw = String(name || '').replace(/^Project\s+/i, '').trim(), matches = [];
  function add(project) { if (project && matches.indexOf(project) < 0) matches.push(project); }
  var codeAndName = raw.match(/^\[?([A-Za-z0-9._-]+)\]?\s+-\s+(.+)$/);
  if (codeAndName) projects.forEach(function (project) {
    if (String(project.code).toLowerCase() === codeAndName[1].toLowerCase() || sistemDriveProjectLabel_(project) === String(name).trim()) add(project);
  });
  projects.forEach(function (project) {
    if (String(project.name).trim().toLowerCase() === raw.toLowerCase()) add(project);
    if (String(project.code).trim().toLowerCase() === raw.toLowerCase()) add(project);
  });
  if (matches.length === 1) return { project: matches[0] };
  if (matches.length > 1) return { ambiguous: matches };
  return {};
}
function sistemDrivePlanMoves_(plan, root) {
  var projects = utpRead_('workspaceProjects').filter(function (project) { return !project.archived; });
  var props = PropertiesService.getScriptProperties();
  function targetConflict(path, name, sourceId) {
    var parent = sistemDriveSubpath_(root, path, false);
    if (!parent) return false;
    var existing = sistemDriveChildFolder_(parent, name, false);
    return !!existing && existing.getId() !== sourceId;
  }
  function addFolderMove(folder, path, rename, reason) {
    var name = folder.getName(), label = rename || name;
    if (targetConflict(path, label, folder.getId())) {
      plan.moves.push({ key: 'folder:' + folder.getId(), kind: 'folder', sourceId: folder.getId(), sourceName: name, path: [SISTEM_DRIVE_.quarantine], rename: name, action: 'quarantine', reason: reason || 'Bentrok nama pada folder tujuan.' });
      return 'quarantine';
    }
    plan.moves.push({ key: 'folder:' + folder.getId(), kind: 'folder', sourceId: folder.getId(), sourceName: name, path: path, rename: rename || '', reason: reason || '' });
    return 'move';
  }
  function addFileMove(file, path, reason) {
    if (targetConflict(path, file.getName(), file.getId())) {
      plan.moves.push({ key: 'file:' + file.getId(), kind: 'file', sourceId: file.getId(), sourceName: file.getName(), path: [SISTEM_DRIVE_.quarantine], action: 'quarantine', reason: reason || 'Bentrok nama file pada folder tujuan.' });
      return;
    }
    plan.moves.push({ key: 'file:' + file.getId(), kind: 'file', sourceId: file.getId(), sourceName: file.getName(), path: path, reason: reason || '' });
  }
  function planProjectChildren(folder, label) {
    var children = folder.getFolders();
    while (children.hasNext()) {
      var child = children.next(), childName = String(child.getName() || '');
      if (SISTEM_DRIVE_.projectSections.indexOf(childName) >= 0) continue;
      var section = SISTEM_DRIVE_OLD_SECTIONS_[childName];
      if (section) {
        var target = section === '03_LPD' ? ['03_LPD'] : [section];
        addFolderMove(child, [SISTEM_DRIVE_.projects, label].concat(target), section, '');
      } else {
        addFolderMove(child, [SISTEM_DRIVE_.legacy], '', 'Folder ' + childName + ' tidak dikenali; dipindahkan ke data lama.');
      }
    }
    var files = folder.getFiles();
    while (files.hasNext()) addFileMove(files.next(), [SISTEM_DRIVE_.projects, label, '07_LAMPIRAN'], 'Berkas tanpa folder bagian dipindahkan ke lampiran proyek.');
  }
  var specialFolderIds = {};
  ['PENDING_KTP_FOLDER_ID', 'UTP_FILES_FOLDER_ID'].forEach(function (key) {
    var id = props.getProperty(key);
    if (id) specialFolderIds[id] = key;
  });
  var specialTargets = { PENDING_KTP_FOLDER_ID: [SISTEM_DRIVE_.internal, 'Unggahan Sementara'], UTP_FILES_FOLDER_ID: [SISTEM_DRIVE_.internal, 'Dokumen Privat'] };
  Object.keys(specialFolderIds).forEach(function (id) {
    var target = specialTargets[specialFolderIds[id]];
    try {
      var folder = DriveApp.getFolderById(id);
      if (folder.isTrashed && folder.isTrashed()) return;
      var parent = folder.getParents(), already = false, expected = target[target.length - 1];
      while (parent.hasNext()) {
        var parentNode = parent.next();
        if (String(parentNode.getName()) === SISTEM_DRIVE_.internal && String(folder.getName()) === expected) already = true;
      }
      if (!already) addFolderMove(folder, target, expected, 'Folder lama sistem internal.');
    } catch (error) { plan.warnings.push('Folder ' + specialFolderIds[id] + ' tidak dapat dibaca: ' + error.message); }
  });
  var templateIds = {};
  ['TEMPLATE_PN_ID', 'TEMPLATE_PG_ID', 'TEMPLATE_SP_ID'].forEach(function (key) {
    var id = props.getProperty(key);
    if (!id) return;
    templateIds[id] = true;
    try {
      var file = DriveApp.getFileById(id);
      if (file.isTrashed && file.isTrashed()) return;
      var parents = file.getParents(), atTemplate = false;
      while (parents.hasNext()) {
        var parent = parents.next();
        if (String(parent.getName()) !== 'Memo') continue;
        var grand = parent.getParents();
        while (grand.hasNext()) if (String(grand.next().getName()) === SISTEM_DRIVE_.templates) atTemplate = true;
      }
      if (!atTemplate) addFileMove(file, [SISTEM_DRIVE_.templates, 'Memo'], 'Template asli dipindahkan tanpa mengubah ID.');
    } catch (error) { plan.warnings.push('Template ' + key + ' tidak dapat dibaca: ' + error.message); }
  });
  var container = sistemDriveChildFolder_(root, SISTEM_DRIVE_.projects, false);
  if (container) {
    var existing = container.getFolders();
    while (existing.hasNext()) {
      var folder = existing.next(), match = sistemDriveMatchProject_(folder.getName(), projects);
      if (match.ambiguous) {
        addFolderMove(folder, [SISTEM_DRIVE_.quarantine], folder.getName(), 'Nama proyek cocok dengan beberapa proyek.');
        continue;
      }
      if (!match.project) { addFolderMove(folder, [SISTEM_DRIVE_.legacy], folder.getName(), 'Folder proyek tidak dikenali.'); continue; }
      var label = sistemDriveProjectLabel_(match.project);
      if (folder.getName() !== label && addFolderMove(folder, [SISTEM_DRIVE_.projects], label, '') === 'quarantine') continue;
      planProjectChildren(folder, label);
    }
  }
  var rootFolders = root.getFolders();
  while (rootFolders.hasNext()) {
    var folder = rootFolders.next(), name = String(folder.getName() || '');
    if (name === SISTEM_DRIVE_.root || name === SISTEM_DRIVE_.templates || name === SISTEM_DRIVE_.projects || name === SISTEM_DRIVE_.internal || name === SISTEM_DRIVE_.legacy || name === SISTEM_DRIVE_.quarantine) continue;
    if (specialFolderIds[folder.getId()]) continue;
    var match = sistemDriveMatchProject_(name, projects);
    if (match.project) {
      var label = sistemDriveProjectLabel_(match.project);
      if (addFolderMove(folder, [SISTEM_DRIVE_.projects], label, '') === 'quarantine') continue;
      planProjectChildren(folder, label);
    } else if (match.ambiguous) {
      addFolderMove(folder, [SISTEM_DRIVE_.quarantine], name, 'Nama proyek cocok dengan beberapa proyek.');
    } else {
      addFolderMove(folder, [SISTEM_DRIVE_.legacy], '', 'Folder lama tidak dapat dipetakan ke proyek.');
    }
  }
  var rootFiles = root.getFiles();
  while (rootFiles.hasNext()) {
    var file = rootFiles.next();
    if (templateIds[file.getId()]) continue;
    addFileMove(file, [SISTEM_DRIVE_.legacy], 'Berkas di akar lama dipindahkan ke data lama.');
  }
  if (root.getName() !== SISTEM_DRIVE_.root) plan.moves.push({ key: 'root:' + root.getId(), kind: 'folder', sourceId: root.getId(), sourceName: root.getName(), path: [], rename: SISTEM_DRIVE_.root, action: 'rename', reason: 'Akar lama dinamai ulang.' });
  plan.projects = projects.length;
  return plan;
}
function sistemDrivePlan_() {
  var root = sistemDriveRoot_(false);
  var plan = { rootId: root ? root.getId() : '', rootName: root ? root.getName() : '', moves: [], warnings: [], projects: 0 };
  if (!root) { plan.warnings.push('Folder ' + SISTEM_DRIVE_.root + ' belum ada; apply akan membuatnya.'); return plan; }
  return sistemDrivePlanMoves_(plan, root);
}
function sistemDriveState_() { return utpGet_('sistemDrive', 'state'); }
function sistemDriveSaveState_(state) {
  if (state.results && state.results.length > 100) state.results = state.results.slice(-100);
  state.updatedAt = new Date().toISOString();
  if (state.status === 'DONE') state.finishedAt = state.updatedAt;
  var saved = utpWrite_('sistemDrive', state, Number(state.version || 0));
  return saved;
}
function sistemDriveSyncProperties_(root) {
  var props = PropertiesService.getScriptProperties(), internal = sistemDriveChildFolder_(root, SISTEM_DRIVE_.internal, false);
  if (!internal) return [];
  var ktp = sistemDriveChildFolder_(internal, 'Unggahan Sementara', false), files = sistemDriveChildFolder_(internal, 'Dokumen Privat', false), changed = [];
  if (ktp) { props.setProperty('PENDING_KTP_FOLDER_ID', ktp.getId()); changed.push('PENDING_KTP_FOLDER_ID'); }
  if (files) { props.setProperty('UTP_FILES_FOLDER_ID', files.getId()); props.setProperty('UTP_FILES_FOLDER_PRIVATE', 'true'); changed.push('UTP_FILES_FOLDER_ID'); }
  props.setProperty('SISTEM_DRIVE_ROOT_ID', root.getId());
  props.setProperty('DRIVE_ROOT_FOLDER_ID', root.getId());
  props.setProperty('SISTEM_DRIVE_MIGRATED_AT', new Date().toISOString());
  return changed;
}
function sistemDriveExecute_(item, root) {
  if (item.action === 'rename') {
    var target = DriveApp.getFolderById(item.sourceId);
    if (target.getName() !== item.rename) target.setName(item.rename);
    return 'success';
  }
  var path = item.path.slice();
  if (item.kind === 'folder' && item.rename && path.length > 1 && path[path.length - 1] === item.rename) path.pop();
  var folder = sistemDriveSubpath_(root, path.join('/'), true);
  var node = item.kind === 'folder' ? DriveApp.getFolderById(item.sourceId) : DriveApp.getFileById(item.sourceId);
  if (node.isTrashed && node.isTrashed()) return 'skipped';
  var parents = node.getParents(), already = false;
  while (parents.hasNext()) if (parents.next().getId() === folder.getId()) already = true;
  if (!already) node.moveTo(folder);
  if (item.rename && node.getName() !== item.rename) node.setName(item.rename);
  if (item.kind === 'folder') sistemDriveProtectTree_(node);
  return already ? 'skipped' : 'success';
}
function sistemDriveApply_(options) {
  var opts = options || {}, previousRun = sistemDriveState_(), state = opts.fresh ? null : previousRun;
  if (!state || state.status === 'DONE') {
    var version = previousRun ? previousRun.version : 0;
    state = { id: 'state', runId: Utilities.getUuid(), status: 'RUNNING', cursor: 0, plan: sistemDrivePlan_(), counts: { success: 0, failed: 0, skipped: 0, quarantine: 0 }, results: [], startedAt: new Date().toISOString() };
    if (version) state.version = version;
  }
  var root = sistemDriveRoot_(true), planned = {};
  state.plan.moves.forEach(function (move) { if (move.kind === 'folder' && move.rename) planned[move.rename] = true; });
  sistemDriveEnsureBase_(root, planned);
  var limit = Number(opts.limit) > 0 ? Number(opts.limit) : SISTEM_DRIVE_LIMIT_;
  var budget = Number(opts.budgetMs) > 0 ? Number(opts.budgetMs) : SISTEM_DRIVE_BUDGET_MS_;
  var started = Date.now(), processed = 0;
  while (state.cursor < state.plan.moves.length && processed < limit && Date.now() - started < budget) {
    var item = state.plan.moves[state.cursor], result;
    try {
      result = sistemDriveExecute_(item, root);
      state.counts[result] = (state.counts[result] || 0) + 1;
      if (item.action === 'quarantine') state.counts.quarantine += 1;
    } catch (error) {
      result = 'failed';
      if (item.action !== 'rename') {
        try {
          var failedNode = item.kind === 'folder' ? DriveApp.getFolderById(item.sourceId) : DriveApp.getFileById(item.sourceId);
          failedNode.moveTo(sistemDriveSubpath_(root, SISTEM_DRIVE_.quarantine, true));
          result = 'quarantine';
        } catch (quarantineError) { /* keep failed below */ }
      }
      if (result === 'failed') state.counts.failed += 1;
      state.results.push({ key: item.key, status: result, reason: error.message, at: new Date().toISOString() });
    }
    if (result !== 'failed') state.results.push({ key: item.key, status: result, reason: item.reason || '', at: new Date().toISOString() });
    state.cursor += 1;
    processed += 1;
    if (processed % 10 === 0) sistemDriveSaveState_(state);
  }
  state.status = state.cursor >= state.plan.moves.length ? 'DONE' : 'PAUSED';
  state = sistemDriveSaveState_(state);
  if (state.status === 'DONE') sistemDriveSyncProperties_(root);
  return { run: state, remaining: Math.max(0, state.plan.moves.length - state.cursor) };
}
function sistemDriveStatus_() {
  return { run: sistemDriveState_(), plan: sistemDrivePlan_() };
}
function apiSistemDrive(action, payload, token) {
  requireAuthorized_(token);
  var p = payload || {};
  if (action === 'plan') return sistemDrivePlan_();
  if (action === 'status') return sistemDriveStatus_();
  if (action !== 'apply') throw new Error('Tindakan konsolidasi Drive tidak dikenal.');
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try { return sistemDriveApply_({ limit: p.limit, budgetMs: p.budgetMs, fresh: p.fresh === true }); }
  finally { lock.releaseLock(); }
}
