/* Owner-only access for a web app that also serves a public Telegram webhook. */
function ownerDigest_(value,salt){return Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,salt+'|'+value,Utilities.Charset.UTF_8));}
function configureOwnerAccess_(){
  var p=PropertiesService.getScriptProperties(),password=p.getProperty('APP_LOGIN_PASSWORD'),pin=p.getProperty('DELETE_PIN');
  if(!password||password.length<24)throw new Error('Isi APP_LOGIN_PASSWORD minimal 24 karakter di Script Properties.');
  if(!/^\d{6}$/.test(pin||''))throw new Error('Isi DELETE_PIN dengan 6 angka baru di Script Properties.');
  var salt=Utilities.getUuid();
  p.setProperties({AUTH_SALT:salt,AUTH_PASSWORD_HASH:ownerDigest_(password,salt),AUTH_PIN_HASH:ownerDigest_(pin,salt)});
  p.deleteProperty('APP_LOGIN_PASSWORD');p.deleteProperty('DELETE_PIN');p.deleteProperty('AUTH_ATTEMPTS');p.deleteProperty('PIN_ATTEMPTS');
}
function ownerCheck_(value,kind){
  var p=PropertiesService.getScriptProperties(),salt=p.getProperty('AUTH_SALT'),hash=p.getProperty(kind==='PIN'?'AUTH_PIN_HASH':'AUTH_PASSWORD_HASH');
  if(!salt||!hash)throw new Error('Akses pemilik belum disiapkan. Jalankan configureOwnerAccess_ di editor Apps Script sesuai panduan konfigurasi.');
  var lock=LockService.getUserLock();lock.waitLock(10000);
  try{
    var key=kind+'_ATTEMPTS',state=JSON.parse(p.getProperty(key)||'{"count":0,"until":0}'),now=Date.now();
    if(state.until>now)throw new Error('Terlalu banyak percobaan. Coba lagi dalam 15 menit.');
    if(state.until&&state.until<=now)state={count:0,until:0};
    var actual=ownerDigest_(String(value||''),salt),different=actual.length^hash.length;
    for(var i=0;i<hash.length;i++)different|=hash.charCodeAt(i)^(actual.charCodeAt(i)||0);
    if(different){state.count++;if(state.count>=3)state.until=now+15*60000;p.setProperty(key,JSON.stringify(state));throw new Error(kind==='PIN'?'PIN tidak cocok.':'Kata sandi tidak cocok.');}
    p.deleteProperty(key);
  }finally{lock.releaseLock();}
}
function ownerSession_(credentials){
  var p=PropertiesService.getScriptProperties();
  ownerCheck_(credentials&&credentials.password,'AUTH');
  var token=Utilities.getUuid()+Utilities.getUuid();
  CacheService.getScriptCache().put('owner_'+token,JSON.stringify({expires:Date.now()+21600000,salt:p.getProperty('AUTH_SALT')}),21600);
  return {token:token,owner:p.getProperty('APP_OWNER_NAME')||'Admin PT. UTP',version:APP.version};
}
function ownerRequireSession_(token){
  var raw=token&&CacheService.getScriptCache().get('owner_'+token),r=raw?JSON.parse(raw):null;
  if(!r||r.expires<Date.now()||r.salt!==PropertiesService.getScriptProperties().getProperty('AUTH_SALT'))throw new Error('Sesi berakhir. Masuk kembali untuk melanjutkan.');
}
function apiLogout(token){requireAuthorized_(token);CacheService.getScriptCache().remove('owner_'+token);return true;}
