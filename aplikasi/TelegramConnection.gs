// Webhook persists in Telegram; hourly maintenance repairs removed or outdated registration.
const TELEGRAM_DEPLOYMENT_URL = 'https://script.google.com/macros/s/AKfycbwm47vlQG89aLRfH8aBN9yGPx0kBFheK74JuUQa25M27bYIIs4Tt-MdTK6rTy4clO2b/exec';

function telegramDeploymentUrl_() {
  const configured = PropertiesService.getScriptProperties().getProperty('WEB_APP_URL');
  return /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(configured || '') ? configured : TELEGRAM_DEPLOYMENT_URL;
}

function apiEnsureTelegramConnection(token) {
  requireAuthorized_(token);
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty('TELEGRAM_BOT_TOKEN') || !props.getProperty('OWNER_TELEGRAM_ID')) {
    return { configured: false, webhookActive: false, message: 'Token bot atau akun Telegram pemilik belum dikonfigurasi.' };
  }
  // Maintenance becomes independent of browser presence after the first owner login.
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(3000)) return telegramConnectionSnapshot_();
  try {
    const triggers = ScriptApp.getProjectTriggers().filter(item => item.getHandlerFunction() === 'maintainTelegramConnection_');
    const clock = triggers.find(item => item.getEventType() === ScriptApp.EventType.CLOCK);
    triggers.filter(item => item !== clock).forEach(item => ScriptApp.deleteTrigger(item));
    if (!clock) ScriptApp.newTrigger('maintainTelegramConnection_').timeBased().everyHours(1).create();
    props.setProperty('TELEGRAM_AUTO_CONNECT', 'true');
    const previous = telegramConnectionSnapshot_();
    if (props.getProperty('TELEGRAM_TRANSPORT') !== 'POLLING' && /\b(401|403)\b/.test(previous.lastError || '') && Date.now() - Number(props.getProperty('TELEGRAM_LAST_FALLBACK_ATTEMPT') || 0) > 300000) props.deleteProperty('TELEGRAM_CONNECTION_NEXT_CHECK');
  } finally { lock.releaseLock(); }
  return maintainTelegramConnection_();
}

function telegramConnectionSnapshot_() {
  const props = PropertiesService.getScriptProperties(), raw = props.getProperty('TELEGRAM_CONNECTION_STATUS');
  try {
    if (!raw) return { configured: false, webhookActive: false, message: 'Status koneksi belum tersedia.' };
    const result = JSON.parse(raw), checked = Date.parse(result.checkedAt || '');
    result.cached = true;
    result.stale = !Number.isFinite(checked) || Date.now() - checked > 600000;
    if (result.lastError) result.lastError = telegramSafeError_(result.lastError);
    const retry = Number(props.getProperty('TELEGRAM_CONNECTION_NEXT_CHECK') || 0);
    result.message = 'Status tersimpan' + (result.stale ? ' — perlu pemeriksaan ulang' : '') + ': ' + telegramSafeError_(result.message || 'Belum tersedia.');
    if (Number.isFinite(checked)) result.message += ' Diperiksa ' + Utilities.formatDate(new Date(checked), 'Asia/Jakarta', 'dd-MM-yyyy HH:mm') + ' WIB.';
    if (retry > Date.now()) result.message += ' Pemeriksaan berikutnya paling cepat ' + Utilities.formatDate(new Date(retry), 'Asia/Jakarta', 'HH:mm') + ' WIB.';
    return result;
  }
  catch (_) { return { configured: false, webhookActive: false, message: 'Status koneksi belum tersedia.' }; }
}

function telegramSafeError_(value) {
  const props = PropertiesService.getScriptProperties();
  let text = String(value || '');
  ['TELEGRAM_BOT_TOKEN', 'BOT_WEBHOOK_KEY'].forEach(key => {
    const secret = props.getProperty(key);
    if (secret) [secret, encodeURIComponent(secret)].forEach(part => { text = text.split(part).join('[DIHAPUS]'); });
  });
  return text.replace(/([?&]key=)[^&\s"'<>]+/gi, '$1[DIHAPUS]').slice(0, 1500);
}

function maintainTelegramConnection_() {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('TELEGRAM_AUTO_CONNECT') !== 'true') return telegramConnectionSnapshot_();
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(3000)) return telegramConnectionSnapshot_();
  try {
    const now = Date.now();
    if (Number(props.getProperty('TELEGRAM_CONNECTION_NEXT_CHECK') || 0) > now) return telegramConnectionSnapshot_();
    let result;
    try {
      if (!props.getProperty('TELEGRAM_BOT_TOKEN') || !props.getProperty('OWNER_TELEGRAM_ID')) throw new Error('Token bot atau akun Telegram pemilik belum dikonfigurasi.');
      if (props.getProperty('TELEGRAM_TRANSPORT') === 'POLLING') {
        ensureTelegramPollTrigger_();
        result = telegramPollingStatus_();
        props.setProperty('TELEGRAM_CONNECTION_STATUS', JSON.stringify(result));
        return result;
      }
      if (!props.getProperty('BOT_WEBHOOK_KEY')) props.setProperty('BOT_WEBHOOK_KEY', Utilities.getUuid() + Utilities.getUuid());
      result = getTelegramStatus_();
      if (result.pendingUpdates > 0 && /\b(401|403)\b/.test(result.lastError || '')) {
        enableTelegramPolling_();
        result = telegramPollingStatus_();
        props.setProperty('TELEGRAM_CONNECTION_STATUS', JSON.stringify(result));
        return result;
      }
      if (!result.webhookActive) {
        setTelegramWebhook_();
        result = getTelegramStatus_();
      }
      if (!result.webhookActive) throw new Error('Registrasi webhook belum aktif.');
      const previous = telegramConnectionSnapshot_();
      const failures = result.lastError ? Math.min(Number(previous.failures || 0) + 1, 6) : 0;
      result = Object.assign(result, { configured: true, checkedAt: new Date(now).toISOString(), failures: failures,
        message: result.lastError ? 'Webhook terdaftar; pengiriman Telegram mengalami kendala. Periksa akses deployment publik.' : 'Webhook terdaftar. Sambungan dipelihara otomatis.' });
      // Registration alone is not proof Telegram successfully delivered an update.
      props.setProperty('TELEGRAM_CONNECTION_NEXT_CHECK', String(now + (failures ? Math.min(3600000, 60000 * Math.pow(2, failures)) : 300000)));
    } catch (_) {
      // Do not store exception URLs: UrlFetch errors can contain the bot token or webhook secret.
      const failures = Math.min(Number(telegramConnectionSnapshot_().failures || 0) + 1, 6);
      result = { configured: Boolean(props.getProperty('TELEGRAM_BOT_TOKEN') && props.getProperty('OWNER_TELEGRAM_ID')),
        webhookActive: false, checkedAt: new Date(now).toISOString(), failures: failures,
        message: 'Koneksi Telegram belum tersedia. Periksa token bot, akun pemilik, izin Google, dan akses deployment publik.' };
      props.setProperty('TELEGRAM_CONNECTION_NEXT_CHECK', String(now + Math.min(3600000, 60000 * Math.pow(2, failures))));
    }
    props.setProperty('TELEGRAM_CONNECTION_STATUS', JSON.stringify(result));
    return result;
  } finally { lock.releaseLock(); }
}

function ensureTelegramPollTrigger_() {
  const triggers = ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'pollTelegramUpdates_');
  const clock = triggers.find(t => t.getEventType() === ScriptApp.EventType.CLOCK);
  if (!clock) ScriptApp.newTrigger('pollTelegramUpdates_').timeBased().everyMinutes(1).create();
  triggers.filter(t => t !== clock).forEach(t => ScriptApp.deleteTrigger(t));
}

function telegramPollingApi_(method, payload) {
  const token = PropertiesService.getScriptProperties().getProperty('TELEGRAM_BOT_TOKEN');
  if (!token) throw new Error('Token Telegram belum dikonfigurasi.');
  const response = UrlFetchApp.fetch('https://api.telegram.org/bot' + token + '/' + method, {
    method: 'post', contentType: 'application/json', payload: JSON.stringify(payload || {}), muteHttpExceptions: true
  });
  const data = JSON.parse(response.getContentText());
  if (!data.ok) throw new Error('Telegram ' + method + ' gagal (HTTP ' + response.getResponseCode() + ').');
  return data.result;
}

function enableTelegramPolling_() {
  const props = PropertiesService.getScriptProperties();
  props.setProperty('TELEGRAM_LAST_FALLBACK_ATTEMPT', String(Date.now()));
  ensureTelegramPollTrigger_();
  // Preserve queued commands; getUpdates and an active webhook cannot run together.
  telegramPollingApi_('deleteWebhook', { drop_pending_updates: false });
  props.setProperty('TELEGRAM_TRANSPORT', 'POLLING');
  props.deleteProperty('TELEGRAM_CONNECTION_NEXT_CHECK');
}

function telegramPollingStatus_() {
  const props = PropertiesService.getScriptProperties(), lastPollAt = props.getProperty('TELEGRAM_LAST_POLL_AT') || '';
  const lastPollError = telegramSafeError_(props.getProperty('TELEGRAM_LAST_POLL_ERROR') || '');
  const checked = Date.parse(lastPollAt);
  const stale = !Number.isFinite(checked) || Date.now() - checked > 180000;
  return { configured: Boolean(props.getProperty('TELEGRAM_BOT_TOKEN') && props.getProperty('OWNER_TELEGRAM_ID')),
    transport: 'POLLING', webhookActive: false, pollingActive: !stale && !lastPollError,
    checkedAt: lastPollAt, stale: stale, lastPollError: lastPollError,
    processedUpdates: Number(props.getProperty('TELEGRAM_PROCESSED_UPDATES') || 0),
    message: lastPollError ? 'Pengambilan pesan Telegram gagal: ' + lastPollError : stale ?
      'Pengambilan pesan otomatis tiap menit disiapkan; menunggu pemeriksaan trigger.' :
      'Pengambilan pesan Telegram berjalan otomatis tiap menit. Tidak memerlukan browser terbuka.' };
}

function pollTelegramUpdates_() {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('TELEGRAM_AUTO_CONNECT') !== 'true' || props.getProperty('TELEGRAM_TRANSPORT') !== 'POLLING') return;
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return;
  try {
    if (!props.getProperty('OWNER_TELEGRAM_ID')) throw new Error('Akun pemilik Telegram belum dikonfigurasi.');
    let offset = Number(props.getProperty('TELEGRAM_UPDATE_OFFSET') || 0);
    if (!Number.isSafeInteger(offset) || offset < 0) throw new Error('Posisi antrean Telegram tidak valid.');
    const updates = telegramPollingApi_('getUpdates', { offset: offset, limit: 20, timeout: 0, allowed_updates: ['message','callback_query'] });
    if (!Array.isArray(updates)) throw new Error('Daftar pesan Telegram tidak valid.');
    const started = Date.now();
    for (const update of updates) {
      if (Date.now() - started > 20000) break;
      if (!Number.isSafeInteger(update.update_id) || update.update_id < offset) continue;
      processTelegramUpdate_(update, true);
      // A failed handler retains its offset for retry instead of losing the command.
      props.setProperty('TELEGRAM_UPDATE_OFFSET', String(update.update_id + 1));
      offset = update.update_id + 1;
      props.setProperty('TELEGRAM_PROCESSED_UPDATES', String(Number(props.getProperty('TELEGRAM_PROCESSED_UPDATES') || 0) + 1));
    }
    props.setProperty('TELEGRAM_LAST_POLL_AT', new Date().toISOString());
    props.deleteProperty('TELEGRAM_LAST_POLL_ERROR');
  } catch (error) {
    props.setProperty('TELEGRAM_LAST_POLL_ERROR', telegramSafeError_(error.message || 'Pengambilan pesan gagal.'));
  } finally { lock.releaseLock(); }
}

// Called only after processTelegramUpdate_ has verified the private owner chat.
// The source message ID is the stable key, so retries cannot create duplicate notes.
function handleTelegramWorkspaceMedia_(update, chatId, transportLocked) {
  const message=update.message,callback=update.callback_query;
  const parts=callback&&String(callback.data||'').match(/^tg(proj|dest):(\d+):([a-zA-Z0-9-]+)$/);
  const photo=message&&Array.isArray(message.photo)&&message.photo.length?message.photo[message.photo.length-1]:null;
  if(!parts&&!(message&&(photo||message.document)))return false;
  const messageId=parts?parts[2]:String(message.message_id),id='tg-'+chatId+'-'+messageId;
  // Polling already holds the shared storage lock. Webhook delivery acquires it here.
  const lock=transportLocked?null:LockService.getScriptLock();if(lock)lock.waitLock(10000);
  try {
    if(callback)answerTelegramCallback_(callback.id);
    let pending=utpGet_('telegramInbox',id);
    if(pending&&pending.completed){
      sendTelegramMessage_(chatId,'Lampiran ini sudah masuk ke '+(pending.destination==='finance'?'Nota & Keuangan':'Arsip Proyek')+'. Buka Web App untuk melengkapi catatan.');
      return true;
    }
    if(!parts){
      const file=photo||message.document,mime=photo?'image/jpeg':String(file.mime_type||'');
      const allowed=['application/pdf','image/jpeg','image/png','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
      if(allowed.indexOf(mime)<0||Number(file.file_size||0)>5*1024*1024){sendTelegramMessage_(chatId,'Gunakan foto JPG/PNG, PDF, Word, atau Excel maksimal 5 MB.');return true;}
      if(!pending){
        pending={id:id,chatId:String(chatId),messageId:messageId,fileId:file.file_id,name:photo?'Foto Telegram '+messageId+'.jpg':String(file.file_name||'Lampiran Telegram '+messageId),mime:mime,caption:String(message.caption||'').slice(0,2000),receivedAt:new Date().toISOString(),completed:false};
        utpWrite_('telegramInbox',pending,null);
      }
      const projects=utpRead_('workspaceProjects').filter(project=>project.id!=='legacy');
      const buttons=projects.map(project=>[{text:String(project.name||project.code||'Proyek').slice(0,60),callback_data:'tgproj:'+messageId+':'+project.id}]);
      buttons.push([{text:'Data awal / belum dipetakan',callback_data:'tgproj:'+messageId+':legacy'}]);
      sendTelegramMessage_(chatId,'📁 Pilih proyek untuk '+pending.name+':',{inline_keyboard:buttons});
      return true;
    }
    if(!pending||pending.chatId!==String(chatId)){sendTelegramMessage_(chatId,'Lampiran tidak ditemukan. Kirim ulang foto atau dokumennya.');return true;}
    if(parts[1]==='proj'){
      const projectId=parts[3],project=projectId==='legacy'?{id:'legacy',name:'Data awal / belum dipetakan'}:utpGet_('workspaceProjects',projectId);
      if(!project||project.archived){sendTelegramMessage_(chatId,'Proyek tidak tersedia. Kirim ulang lampiran dan pilih proyek aktif.');return true;}
      pending.projectId=projectId;pending.projectName=project.name;utpWrite_('telegramInbox',pending,pending.version);
      sendTelegramMessage_(chatId,'Simpan '+pending.name+' di '+project.name+' sebagai:',{inline_keyboard:[[{text:'🧾 Nota & Keuangan',callback_data:'tgdest:'+messageId+':finance'},{text:'📂 Arsip Proyek',callback_data:'tgdest:'+messageId+':archives'}]]});
      return true;
    }
    const destination=parts[3];if(['finance','archives'].indexOf(destination)<0||!pending.projectId){sendTelegramMessage_(chatId,'Pilih proyek dahulu dengan mengirim ulang lampiran.');return true;}
    if(pending.projectId!=='legacy'){const project=utpGet_('workspaceProjects',pending.projectId);if(!project||project.archived){sendTelegramMessage_(chatId,'Proyek sudah tidak aktif. Kirim ulang lampiran.');return true;}}
    // One destination per incoming message, including repeated callback deliveries.
    const entity=destination==='finance'?'workspaceFinance':'workspaceArchives';
    const other=utpGet_(destination==='finance'?'workspaceArchives':'workspaceFinance',id),existing=utpGet_(entity,id);
    if(other){sendTelegramMessage_(chatId,'Lampiran sudah tersimpan pada tujuan lain. Kelola catatan melalui Web App.');return true;}
    if(!existing){
      const metadata=telegramPollingApi_('getFile',{file_id:pending.fileId});
      if(!metadata||!metadata.file_path||Number(metadata.file_size||0)>5*1024*1024)throw new Error('Berkas Telegram tidak tersedia atau melebihi 5 MB.');
      const token=PropertiesService.getScriptProperties().getProperty('TELEGRAM_BOT_TOKEN');
      const path=String(metadata.file_path);if(!/^[a-zA-Z0-9_./-]+$/.test(path)||path.indexOf('..')!==-1)throw new Error('Lokasi berkas Telegram tidak valid.');
      const response=UrlFetchApp.fetch('https://api.telegram.org/file/bot'+token+'/'+path,{muteHttpExceptions:true});
      if(response.getResponseCode()!==200)throw new Error('Foto Telegram belum dapat diunduh. Coba tombol tujuan kembali.');
      const uploaded=utpUpload_({name:pending.name,mime:pending.mime,base64:Utilities.base64Encode(response.getBlob().getBytes()),kind:'telegram-workspace',recordId:id});
      DriveApp.getFileById(uploaded.id).moveTo(workspaceProjectFolder_(pending.projectId,destination==='finance'?'Nota dan Keuangan':'Arsip'));
      const fields=destination==='finance'?{reference:'Telegram '+messageId,vendor:'Belum diisi',amount:0,category:'Perlu klasifikasi',proof:uploaded.url}:{reference:'Telegram '+messageId,category:'Lampiran Telegram',location:uploaded.url,revision:''};
      const record={id:id,projectId:pending.projectId,name:pending.caption?pending.caption.slice(0,200):pending.name,date:Utilities.formatDate(new Date(pending.receivedAt),APP.timezone,'yyyy-MM-dd'),status:'Draf',note:pending.caption,fields:fields,source:'Telegram',pendingReview:true,attachments:[{name:uploaded.name,url:uploaded.url,mime:uploaded.mime,fileId:uploaded.id}],telegramMessageId:messageId,history:[{at:new Date().toISOString(),status:'Draf',reason:'Diterima melalui Telegram; menunggu verifikasi pemilik.'}]};
      utpWrite_(entity,record,null);
    }
    pending=utpGet_('telegramInbox',id);pending.completed=true;pending.destination=destination;utpWrite_('telegramInbox',pending,pending.version);
    sendTelegramMessage_(chatId,'✅ Lampiran masuk ke '+(destination==='finance'?'Nota & Keuangan':'Arsip Proyek')+' · '+pending.projectName+'. Buka catatan di Web App untuk melengkapi tanggal, nominal, dan keterangan.');
    return true;
  } finally {if(lock)lock.releaseLock();}
}
