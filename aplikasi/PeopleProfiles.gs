/* Optional personal details. Employment records remain in the manpower directory. */
function peopleProfileKey_(name, project) {
  var key=normalizePersonKey_(name,project);
  return 'profile-'+Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,key)).replace(/=+$/,'');
}
function peopleProfileComplete_(record) {
  return !!(record.phone&&record.address&&record.emergency);
}
function apiPeopleProfiles(action, payload, token) {
  requireAuthorized_(token);
  var p=payload||{},entity='workspaceProfiles';
  if(action==='list')return utpRead_(entity).map(function(r){return {name:r.name,project:r.project,complete:peopleProfileComplete_(r)};});
  var name=workspaceText_(p.name,200),project=workspaceText_(p.project,200);
  if(!name||!project)throw new Error('Nama dan proyek personel wajib tersedia dari direktori.');
  var id=peopleProfileKey_(name,project);
  if(action==='get')return {record:utpGet_(entity,id)};
  if(action!=='save')throw new Error('Tindakan profil tidak dikenal.');
  var version=Number(p.version);
  if(!Number.isSafeInteger(version)||version<0)throw new Error('Versi profil tidak valid. Muat ulang profil.');
  var source=p.record||{},custom=source.custom||[];
  if(!Array.isArray(custom)||custom.length>12)throw new Error('Maksimal 12 kolom tambahan.');
  var record={id:id,name:name,project:project,phone:workspaceText_(source.phone,100),address:workspaceText_(source.address,500),emergency:workspaceText_(source.emergency,300),note:workspaceText_(source.note,1000),custom:custom.map(function(field){
    if(!field||typeof field!=='object')throw new Error('Kolom tambahan tidak valid.');
    return {label:workspaceText_(field.label,80),value:workspaceText_(field.value,500)};
  }).filter(function(field){return field.label||field.value;})};
  if(record.custom.some(function(field){return !field.label;}))throw new Error('Isi nama untuk setiap kolom tambahan.');
  var lock=LockService.getScriptLock();lock.waitLock(30000);
  try {
    var old=utpGet_(entity,id);
    if(old?old.version!==version:version!==0)return {conflict:true};
    try{return {record:utpWrite_(entity,record,version),complete:peopleProfileComplete_(record)};}
    catch(error){if(error.recordSaved)return {record:utpGet_(entity,id),complete:peopleProfileComplete_(record),warning:error.message};throw error;}
  } finally {lock.releaseLock();}
}
