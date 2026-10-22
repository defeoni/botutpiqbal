// Browser exercises real LPD/Workspace handlers against in-memory Google services.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{chromium}=require(process.argv[2]||'playwright');
const root=path.resolve(__dirname,'..'),testSource=fs.readFileSync(path.join(root,'pengujian/lpd.test.js'),'utf8');
const {fixture,addRpd,enroll,disburseRpd}=new Function('require','__dirname',testSource.slice(0,testSource.indexOf("test('deadline LPD manual"))+'\nreturn {fixture,addRpd,enroll,disburseRpd};')(require,path.join(root,'pengujian'));
(async()=>{
  const env=fixture(),projectId='proj-alpha-0001';env.c.PropertiesService={getScriptProperties:()=>({getProperty:()=>null})};
  addRpd(env,'rpd-browser-001',projectId,100000,'Operasional');enroll(env,projectId,'rpd-browser-001');disburseRpd(env,projectId,'rpd-browser-001');
  env.rows.workspaceFinance=[{id:'nota-browser-001',projectId,version:1,name:'Nota toko',date:'2026-10-05',status:'Draf',note:'Galon dan konsumsi',source:'Telegram',fields:{amount:100000,vendor:'Toko',category:'Operasional',proof:'https://drive.google.com/file/d/proof-browser/view'},attachments:[{name:'nota.jpg',url:'https://drive.google.com/file/d/proof-browser/view',mime:'image/jpeg'}]}];
  const browser=await chromium.launch({headless:true,executablePath:process.argv[3]});
  try{
    const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.exposeFunction('__lpdBridge',(name,args)=>{if(name==='apiProjects')return env.c.apiProjects(...args);if(name==='apiLpd')return env.c.apiLpd(...args);if(name==='apiWorkspace')return env.c.apiWorkspace(...args);if(name==='apiDashboard')return {warnings:[],activities:[]};throw new Error('Unexpected endpoint '+name);});
    await page.goto(process.env.UTP_PREVIEW_URL||pathToFileURL(path.join(root,'.local/aplikasi.html')).href);
    await page.evaluate(async()=>{accessToken='owner';invokeServer=(name,args,ok,fail)=>window.__lpdBridge(name,args).then(ok,fail);await ProjectWorkspace.ready();ProjectWorkspace.select('proj-alpha-0001');switchMainPage('LPD');});
    await page.waitForFunction(()=>document.getElementById('lpdMessage').textContent.includes('Belum ada LPD'));
    await page.locator('#lpdNew').click();await page.waitForFunction(()=>document.querySelector('#lpdRpdRows input[type=checkbox]'));
    await page.locator('#lpdRpdRows input[type=checkbox]').first().check();
    await page.locator('#lpdInboxLoad').click();await page.waitForFunction(()=>document.getElementById('lpdInboxSelect').options.length===1);await page.locator('#lpdInboxAdd').click();
    await page.locator('#lpdSaveDraft').click();await page.waitForFunction(()=>document.getElementById('lpdMessage').textContent.includes('Draf LPD tersimpan'));
    assert.equal(env.rows.workspaceLpd.length,1);assert.equal(env.rows.workspaceLpd[0].rpbId,'');assert.equal(env.rows.workspaceLpd[0].realisasi[0].financeId,'nota-browser-001');
    await page.locator('#lpdDeadline').fill('2026-10-28');await page.locator('#lpdSaveDeadline').click();await page.waitForFunction(()=>document.getElementById('lpdMessage').textContent.includes('Deadline'));
    assert.equal(env.rows.workspaceLpd[0].deadline.due,'2026-10-28');
    await page.locator('.sidebar-nav [data-project-tool="Nota/Keuangan"]').click();await page.waitForFunction(()=>document.getElementById('projectToolMessage').textContent.includes('dimuat'));
    assert.match(await page.locator('#projectToolList').innerText(),/Dipakai di LPD/);assert.equal(await page.locator('#projectToolList button').filter({hasText:'✎ Edit'}).isDisabled(),true);
    await page.locator('#projectToolList button').filter({hasText:'Buka LPD terkait'}).click();await page.waitForFunction(()=>document.getElementById('lpdMessage').textContent==='LPD dimuat.');
    assert.equal(await page.locator('#lpdDeadline').inputValue(),'2026-10-28');
    assert.deepEqual(errors,[]);console.log('PASS LPD browser: inbox -> RPD-only draft, manual deadline, used-note label/lock, no JS errors');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
