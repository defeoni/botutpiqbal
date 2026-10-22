/* Private-owner panel. Entry is guarded by processTelegramUpdate_. */
function telegramPanelDocuments_() {
  const docs=utpRead_('workspaceDocuments').filter(d=>!d.linkedSource).map(d=>Object.assign({source:'document'},d));
  utpRead_('workspaceLpd').forEach(r=>docs.push({id:'lpd:'+r.id,projectId:r.projectId,title:'LPD '+r.month+' · '+r.id.slice(0,8),status:r.status==='COMPLETE'?'SELESAI':r.status==='SENT'?'DIAJUKAN':'DRAFT',due:r.deadline&&r.deadline.due||'',source:'lpd'}));
  [['workspaceRpd','rpd'],['workspaceArchives','archives'],['workspaceFinance','finance'],['workspaceTasks','tasks'],['requests','requests'],['approvals','approvals']].forEach(pair=>{
    utpRead_(pair[0]).forEach(r=>docs.push({id:pair[1]+':'+r.id,projectId:r.projectId||'legacy',title:r.title||r.name||r.purpose||r.number||'Dokumen',status:['Selesai dicatat','APPROVED'].includes(r.status)||r.arrived?'SELESAI':r.status==='REJECTED'?'DITOLAK':['Draf','DRAFT'].includes(r.status)?'DRAFT':'DIPROSES',due:r.fields&&r.fields.due||'',source:pair[1]}));
  });
  getRpbHistory_().forEach(r=>docs.push({id:'rpb:'+r.id,projectId:r.data&&r.data.projectId||'legacy',title:r.number,status:r.status==='Serah terima selesai'?'SELESAI':'DIAJUKAN',source:'rpb'}));
  const memoLinks=utpRead_('memoProjects'),memoSheetId=PropertiesService.getScriptProperties().getProperty('MEMO_HISTORY_SHEET_ID');
  const sheet=memoSheetId?SpreadsheetApp.openById(memoSheetId).getSheets()[0]:null;
  if(sheet&&sheet.getLastRow()>1)sheet.getRange(2,1,sheet.getLastRow()-1,10).getValues().forEach(r=>docs.push({id:'memo:'+r[1],title:String(r[1]),projectId:(memoLinks.find(p=>p.id===String(r[1]))||{}).projectId||'legacy',status:'SELESAI',source:'memo'}));
  const tracking=utpRead_('workspaceDocumentTracking'),follow=utpRead_('telegramDocumentFollowups');
  return docs.map(d=>{
    const t=tracking.find(r=>r.id===d.id),f=follow.find(r=>r.id===d.id);
    return Object.assign({},d,t?Object.assign({status:t.status,due:t.due,hidden:t.hidden},documentMonitorFields_(t)): {},{trackingVersion:t&&t.version||0,follow:f||{}});
  }).filter(d=>!d.archived&&!d.hidden);
}
function telegramDocumentReminder_(){
  const props=PropertiesService.getScriptProperties(),owner=props.getProperty('OWNER_TELEGRAM_ID');
  if(!owner||!props.getProperty('TELEGRAM_BOT_TOKEN'))return;
  const now=new Date(),day=Number(Utilities.formatDate(now,'Asia/Jakarta','u')),hour=Utilities.formatDate(now,'Asia/Jakarta','HH');
  if(day>5||!['08','13','16'].includes(hour))return;
  const slot=Utilities.formatDate(now,'Asia/Jakarta','yyyy-MM-dd')+'-'+hour,lock=LockService.getScriptLock();if(!lock.tryLock(1000))return;
  try{
    if(props.getProperty('TG_REMINDER_SLOT')===slot)return;
    const today=Utilities.formatDate(now,'Asia/Jakarta','yyyy-MM-dd'),cutoff=new Date(today+'T00:00:00Z');cutoff.setUTCDate(cutoff.getUTCDate()+3);
    const count=telegramPanelDocuments_().filter(d=>!['SELESAI','DITOLAK'].includes(d.status)&&((d.follow.state!=='answerPending'&&(d.followUpDate?d.followUpDate<=today:d.follow.state==='waiting'||['DIAJUKAN','DIPROSES','REVISI'].includes(d.status)))||d.due&&d.due<=cutoff.toISOString().slice(0,10))).length;
    if(count)sendTelegramMessage_(owner,'⚠️ Anda punya '+count+' dokumen yang perlu diperhatikan.',{inline_keyboard:[[{text:'Buka monitoring',callback_data:'panel:home'}]]});
    props.setProperty('TG_REMINDER_SLOT',slot);
  }finally{lock.releaseLock();}
}
function telegramPanelSend_(chatId,messageId,text,rows) {
  if(messageId) {
    try{return telegramPollingApi_('editMessageText',{chat_id:chatId,message_id:messageId,text:text,reply_markup:{inline_keyboard:rows}});}
    catch(error){if(String(error.message).includes('HTTP 400'))return sendTelegramMessage_(chatId,text,{inline_keyboard:rows});throw error;}
  }
  return sendTelegramMessage_(chatId,text,{inline_keyboard:rows});
}
function ensureTelegramReminderTrigger_(){
  const triggers=ScriptApp.getProjectTriggers().filter(t=>t.getHandlerFunction()==='telegramDocumentReminder_');
  if(!triggers.length)ScriptApp.newTrigger('telegramDocumentReminder_').timeBased().everyHours(1).create();
  triggers.slice(1).forEach(t=>ScriptApp.deleteTrigger(t));
}
function handleTelegramPanel_(update,chatId,transportLocked) {
  const cb=update.callback_query,text=String(update.message&&update.message.text||'');
  if(cb&&!String(cb.data||'').startsWith('panel:'))return false;
  if(!cb&&!text)return false;
  const lock=transportLocked?null:LockService.getScriptLock();if(lock)lock.waitLock(10000);
  try {
    if(cb)answerTelegramCallback_(cb.id);
    ensureTelegramReminderTrigger_();
    const props=PropertiesService.getScriptProperties(),key='TG_PANEL_'+chatId+(cb?'_'+cb.message.message_id:'');
    const cache=CacheService.getScriptCache();
    let state=JSON.parse(cache.get(key)||'{"project":"all"}');
    const args=cb?cb.data.split(':'):['panel','home'],action=args[1],index=Number(args[2]||0);
    const projects=utpRead_('workspaceProjects').filter(p=>!p.archived&&p.id!=='legacy');
    if(action==='project'){state.project=index<0?'all':projects[index]&&projects[index].id||'all';}
    if(state.project!=='all'&&!projects.some(p=>p.id===state.project))state.project='all';
    const label=state.project==='all'?'Semua Proyek':projects.find(p=>p.id===state.project).name;
    const button=(text,data)=>({text:text,callback_data:'panel:'+data});
    const home=[button('‹ Beranda','home')],url=telegramDeploymentUrl_();
    let rows=[],body='UTP · '+label,view=action;
    if(action==='projects'){
      rows=[[button('Semua proyek','project:-1')]].concat(projects.map((p,i)=>[button(p.name.slice(0,50),'project:'+i)]),[home]);
    }else{
      const docs=telegramPanelDocuments_().filter(d=>state.project==='all'||d.projectId===state.project);
      const today=Utilities.formatDate(new Date(),'Asia/Jakarta','yyyy-MM-dd'),soon=new Date(today+'T00:00:00Z');soon.setUTCDate(soon.getUTCDate()+3);
      const deadline=docs.filter(d=>!['SELESAI','DITOLAK'].includes(d.status)&&d.due&&d.due<=soon.toISOString().slice(0,10)).sort((a,b)=>String(a.due).localeCompare(String(b.due)));
      const follow=docs.filter(d=>!['SELESAI','DITOLAK'].includes(d.status)&&d.follow.state!=='answerPending'&&(d.followUpDate?d.followUpDate<=today:d.follow.state==='waiting'||['DIAJUKAN','DIPROSES','REVISI'].includes(d.status)));
      if(['draft','sent','answer','confirm','status','setstatus','party'].includes(action)){
        const target=state.items&&state.items[index],doc=docs.find(d=>d.id===target);
        if(!doc){body+='\nDokumen berubah. Buka daftar kembali.';rows=[home];}
        else{
          body+='\n'+String(doc.title).slice(0,180);
          if(action==='party')rows=[['PM','MK','HO'].map(p=>button(p,'draft:'+index+':'+p)),[button('‹ Kembali','item:'+index)]];
          if(action==='draft'){
            const party=['PM','MK','HO'].includes(args[3])?args[3]:'PM';
            body+='\n\nYth. Bapak/Ibu '+party+', izin menindaklanjuti dokumen '+doc.title+(doc.number?' ('+doc.number+')':'')+' untuk proyek '+(projects.find(p=>p.id===doc.projectId)||{name:'Data lama'}).name+'. '+(doc.requiredAction?'Mohon '+doc.requiredAction+'. ':'Mohon informasi tanggapan atau arahan selanjutnya. ')+'Terima kasih.';
            rows=[[button('Sudah saya kirim','confirm:'+index+':sent')],[button('‹ Kembali','item:'+index)]];
          }
          if(action==='confirm')rows=[[button('Ya, sudah dikirim','sent:'+index),button('Batal','item:'+index)]];
          if(action==='sent'||action==='answer'){
            const old=utpGet_('telegramDocumentFollowups',doc.id),updateId=String(update.update_id);
            if(!old||old.lastUpdateId!==updateId){const record=Object.assign({},old||{id:doc.id,projectId:doc.projectId},{state:action==='sent'?'waiting':'answerPending',lastUpdateId:updateId,history:(old&&old.history||[]).concat([{at:new Date().toISOString(),action:action}])});utpWrite_('telegramDocumentFollowups',record,old?old.version:0);}
            body+=action==='sent'?'\n✓ Pengiriman dicatat. Menunggu jawaban.':'\n✓ Ada jawaban. Lengkapi keputusan di web.';rows=[home];
          }
          if(action==='status'||action==='setstatus'){
            const labels={DIAJUKAN:'Diajukan',DIPROSES:'Diproses',REVISI:'Direvisi',SELESAI:'Selesai'};
            if(action==='status'){
              state.version=doc.source==='document'?doc.version:doc.trackingVersion;
              body+='\nPilih status tracking administrasi:';
              rows=Object.keys(labels).map(s=>[button(labels[s],'setstatus:'+index+':'+s)]);rows.push([button('‹ Kembali','item:'+index)]);
            }else if(labels[args[3]]){
              const entity=doc.source==='document'?'workspaceDocuments':'workspaceDocumentTracking',old=utpGet_(entity,doc.id);
              if(Number(old&&old.version||0)!==Number(state.version)){body+='\nData berubah. Buka ulang dokumen sebelum mengubah status.';}
              else if(old&&old.archived){body+='\nDokumen sudah diarsipkan.';}
              else{
                const record=Object.assign({},old||{id:doc.id,projectId:doc.projectId,source:doc.source},documentMonitorFields_(doc),{status:args[3],due:doc.due||'',note:'Tracking dikonfirmasi admin melalui Telegram',history:(old&&old.history||[]).concat([{at:new Date().toISOString(),status:args[3],reason:'Tracking dikonfirmasi admin melalui Telegram'}])});
                utpWrite_(entity,record,old?old.version:0);delete state.version;
                body+='\n✓ Tracking: '+labels[args[3]]+'\nKeputusan bisnis sumber tetap dilengkapi di web.';
              }
              rows=[[button('Kembali ke dokumen','item:'+index)],home];
            }else rows=[home];
          }
        }
      }else if(action==='item'){
        const doc=docs.find(d=>d.id===(state.items||[])[index]);
        if(doc){body+='\n'+String(doc.title).slice(0,160)+(doc.due?'\n📅 '+doc.due:'');rows=[[{text:'Detail',url:url+'?tgdoc='+encodeURIComponent(doc.id)+'&tgproject='+encodeURIComponent(doc.projectId)},button('Draf WA','party:'+index)],[button('Sudah dikirim','confirm:'+index+':sent'),button('Ada jawaban','answer:'+index)],[button('Status','status:'+index)],home];}else{body+='\nDokumen tidak tersedia.';rows=[home];}
      }else if(action==='deadline'||action==='follow'){
        const list=action==='deadline'?deadline:follow,page=Math.max(0,index),start=page*6;state.items=list.map(d=>d.id);
        body+='\n'+(action==='deadline'?'📅 Deadline':'↪ Follow-up')+' · '+list.length;
        rows=list.slice(start,start+6).map((d,i)=>[button((d.due?d.due+' · ':'')+String(d.title).slice(0,45),'item:'+(start+i))]);
        if(start+6<list.length)rows.push([button('Berikutnya ›',action+':'+(page+1))]);if(page)rows.push([button('‹ Sebelumnya',action+':'+(page-1))]);rows.push(home);
      }else if(action==='inbox'){
        const notes=utpRead_('workspaceFinance').filter(d=>d.source==='Telegram'&&d.pendingReview&&(state.project==='all'||d.projectId===state.project)).length;
        const archives=utpRead_('workspaceArchives').filter(d=>d.source==='Telegram'&&d.status!=='Selesai dicatat'&&(state.project==='all'||d.projectId===state.project)).length;
        body+='\n🧾 Nota: '+notes+' · 📂 Arsip: '+archives+'\nKirim foto/dokumen, pilih proyek dan tujuan. Lanjutkan pengerjaan di web.';rows=[[{text:'Buka inbox di web',url:url}],home];
      }else{
        body+='\n\n📅 Deadline ≤ 3 hari: '+deadline.length+'\n↪ Follow-up: '+follow.length;
        rows=[[button('Proyek ▾','projects')],[button('Deadline','deadline:0'),button('Follow-up','follow:0')],[button('Inbox','inbox'),{text:'Buka web',url:url}]];
      }
    }
    const sent=telegramPanelSend_(chatId,cb&&cb.message.message_id,body,rows);
    const savedKey=sent&&sent.message_id?'TG_PANEL_'+chatId+'_'+sent.message_id:key;
    cache.put(savedKey,JSON.stringify(state),21600);
    return true;
  }finally{if(lock)lock.releaseLock();}
}
