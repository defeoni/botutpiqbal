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
      if (!props.getProperty('BOT_WEBHOOK_KEY')) props.setProperty('BOT_WEBHOOK_KEY', Utilities.getUuid() + Utilities.getUuid());
      result = getTelegramStatus_();
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
