const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
function setup(){
  const props=new Map([['OWNER_TELEGRAM_ID','100'],['TELEGRAM_BOT_TOKEN','private']]),messages=[],triggers=[];
  const data={workspaceProjects:[{id:'project-1',name:'Proyek Satu'}],workspaceDocuments:[{id:'document-1',projectId:'project-1',title:'Dokumen TTD',status:'DIPROSES',due:'2026-10-22',version:1}],workspaceDocumentTracking:[],telegramDocumentFollowups:[]};
  let messageId=10;
  const c=vm.createContext({PropertiesService:{getScriptProperties:()=>({getProperty:k=>props.get(k)||null,setProperty:(k,v)=>props.set(k,v)})},LockService:{getScriptLock:()=>({waitLock(){},tryLock:()=>true,releaseLock(){}})},ScriptApp:{getProjectTriggers:()=>triggers,newTrigger:name=>({timeBased(){return this;},everyHours(){return this;},create(){triggers.push({getHandlerFunction:()=>name});}}),deleteTrigger:t=>triggers.splice(triggers.indexOf(t),1)},Utilities:{formatDate:(_date,_tz,format)=>format==='u'?'4':format==='HH'?'08':'2026-10-22'},utpRead_:entity=>data[entity]||[],utpGet_:(entity,id)=>(data[entity]||[]).find(r=>r.id===id)||null,utpWrite_:(entity,r,version)=>{data[entity]??=[];const old=data[entity].find(x=>x.id===r.id);assert.equal(old?.version||0,version);const saved={...r,version:version+1};data[entity]=data[entity].filter(x=>x.id!==r.id).concat(saved);return saved;},getRpbHistory_:()=>[],getMemoHistorySheet_:()=>null,telegramDeploymentUrl_:()=> 'https://example.com/exec',answerTelegramCallback_(){},sendTelegramMessage_:(chat,text,markup)=>{messages.push({chat,text,rows:markup.inline_keyboard});return {message_id:++messageId};},telegramPollingApi_:(method,payload)=>{messages.push({chat:payload.chat_id,text:payload.text,rows:payload.reply_markup.inline_keyboard});return {message_id:payload.message_id};}});
  const cache=new Map();c.CacheService={getScriptCache:()=>({get:k=>cache.get(k)||null,put:(k,v)=>cache.set(k,v)})};
  for(const file of ['Workspace.gs','Projects.gs'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../aplikasi',file),'utf8'),c);
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../aplikasi/TelegramPanel.gs'),'utf8'),c);
  const callback=(data,id=11,updateId=22)=>c.handleTelegramPanel_({update_id:updateId,callback_query:{id:'cb',data,message:{message_id:id}}},100,false);
  return {c,data,props,messages,triggers,callback};
}
test('arbitrary text opens compact home; buttons filter project and preserve independent message context',()=>{
  const e=setup();for(const text of ['p','.','halo','/start'])assert.equal(e.c.handleTelegramPanel_({message:{text}},100,false),true);
  assert.match(e.messages[0].text,/Semua Proyek/);assert.equal(e.triggers.length,1);
  e.callback('panel:projects');assert.equal(e.messages.at(-1).rows[1][0].text,'Proyek Satu');
  e.callback('panel:project:0');assert.match(e.messages.at(-1).text,/Proyek Satu/);
  e.callback('panel:home',12);assert.match(e.messages.at(-1).text,/Semua Proyek/);
});
test('deadline -> document -> recipient draft -> confirmed follow-up -> answer leaves business decision unchanged',()=>{
  const e=setup();e.c.handleTelegramPanel_({message:{text:'.'}},100,false);e.callback('panel:deadline:0');e.callback('panel:item:0');
  assert.match(e.messages.at(-1).rows[0][0].url,/tgdoc=document-1/);
  e.callback('panel:party:0');e.callback('panel:draft:0:MK');assert.match(e.messages.at(-1).text,/Bapak\/Ibu MK/);assert.match(e.messages.at(-1).text,/Dokumen TTD/);
  e.callback('panel:confirm:0:sent');assert.equal(e.data.telegramDocumentFollowups.length,0);
  e.callback('panel:sent:0',11,23);assert.equal(e.data.telegramDocumentFollowups[0].state,'waiting');
  e.callback('panel:sent:0',11,23);assert.equal(e.data.telegramDocumentFollowups[0].history.length,1);
  e.callback('panel:answer:0',11,24);assert.equal(e.data.telegramDocumentFollowups[0].state,'answerPending');assert.equal(e.data.workspaceDocuments[0].status,'DIPROSES');
});
test('tracking detects stale versions; successful change records audit',()=>{
  const e=setup();e.c.handleTelegramPanel_({message:{text:'p'}},100,false);e.callback('panel:deadline:0');e.callback('panel:status:0');e.data.workspaceDocuments[0].version++;
  e.callback('panel:setstatus:0:SELESAI');assert.match(e.messages.at(-1).text,/Data berubah/);assert.equal(e.data.workspaceDocuments[0].status,'DIPROSES');
  e.callback('panel:status:0');e.callback('panel:setstatus:0:SELESAI');assert.equal(e.data.workspaceDocuments[0].status,'SELESAI');assert.equal(e.data.workspaceDocuments[0].history.length,1);
});
test('alarm is short and deduplicated per scheduled WIB slot',()=>{
  const e=setup();e.c.telegramDocumentReminder_();e.c.telegramDocumentReminder_();assert.equal(e.messages.length,1);assert.match(e.messages[0].text,/1 dokumen/);assert.equal(e.messages[0].rows[0][0].callback_data,'panel:home');
});
test('follow-up respects explicit date and WA draft includes document reference and requested action',()=>{
  const e=setup(),doc=e.data.workspaceDocuments[0];doc.due='';doc.followUpDate='2099-12-31';doc.number='SK-01';doc.requiredAction='tanda tangan laporan';
  e.c.handleTelegramPanel_({message:{text:'.'}},100,false);e.callback('panel:follow:0');assert.match(e.messages.at(-1).text,/Follow-up · 0/);
  doc.followUpDate='2026-10-22';e.callback('panel:follow:0');assert.match(e.messages.at(-1).text,/Follow-up · 1/);
  e.callback('panel:draft:0:MK');assert.match(e.messages.at(-1).text,/SK-01/);assert.match(e.messages.at(-1).text,/tanda tangan laporan/);
});
