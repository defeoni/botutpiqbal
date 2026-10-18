// Browser UI -> real UTP adapter/domain -> in-memory Google services. No network or deployment.
// Usage: node alat/periksa-draf-material.cjs <playwright directory> <Chrome executable>
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require(process.argv[2] || 'playwright');
const root=path.resolve(__dirname,'..');
const storage=fs.readFileSync(path.join(root,'pengujian/material-penyimpanan.test.js'),'utf8');
const prelude=storage.slice(0,storage.indexOf('\nconst draft ='));
assert.ok(prelude.length>1000,'Storage service fixture must exist');
const environment=new Function('require','__dirname',prelude+'\nreturn environment;')(require,path.join(root,'pengujian'));
(async()=>{
 const env=environment();
 assert.equal(env.call('bootstrap').capabilities.materialDrafts,true);
 env.state.props.set('UTP_MATERIAL_DRAFTS_ENABLED','false');
 assert.equal(env.call('bootstrap').capabilities.materialDrafts,false);
 env.state.props.set('UTP_MATERIAL_DRAFTS_ENABLED','true');
 const browser=await chromium.launch({headless:true,...(process.argv[3]?{executablePath:process.argv[3]}:{})});
 const output=path.join(root,'.local/frontend/draft-contract.html');fs.mkdirSync(path.dirname(output),{recursive:true});
 const html=fs.readFileSync(path.join(root,'.local/aplikasi.html'),'utf8');
 assert.ok(html.includes('window.UTP_FRONTEND_PREVIEW = true;'));
 fs.writeFileSync(output,html.replace('window.UTP_FRONTEND_PREVIEW = true;','window.UTP_FRONTEND_PREVIEW = false;'));
 const url=pathToFileURL(output).href;
 const errors=[];
 async function connect(page){
  await page.goto(url);
  await page.evaluate(()=>{window.utpRpc=(action,payload)=>window.__draftBridge(action,payload);switchMainPage('REQUESTS');});
  await page.waitForFunction(()=>UTPFrontend.getState().data?.capabilities?.materialDrafts===true);
 }
 async function newPage(){
  const page=await browser.newPage({viewport:{width:390,height:844}});
  page.on('pageerror',e=>errors.push(e.message));await page.route('https://**/*',route=>route.abort());
  await page.exposeFunction('__draftBridge',(action,payload)=>env.plain(env.call(action,payload)));
  await connect(page);return page;
 }
 try{
  const a=await newPage();
  await a.locator('[data-action=new-request]').click();
  await a.locator('#utpRequestFields [name=title]').fill('Draf tersimpan antar sesi');
  await a.locator('[data-action=add-temporary]').click();
  await a.locator('#utpDialogForm [name=name]').fill('Material merek belum diketahui');
  await a.locator('#utpDialogForm [name=unit]').fill('buah');
  await a.locator('#utpDialogForm [name=requiredAuthority]').selectOption('HO');
  await a.locator('#utpDialogForm button[type=submit]').click();
  await a.locator('[data-action=save-request]').click();
  await a.waitForFunction(()=>UTPFrontend.getState().editor?.base?.version===1);
  const record=await a.evaluate(()=>UTPFrontend.getState().editor.record);
  assert.equal(record.items[0].classification,'UNKNOWN');assert.equal(record.items[0].requiredAuthority,'HO');
  assert.equal(env.call('detail',{entity:'requests',id:record.id}).record.items[0].decisions.HO.status,'PENDING');
  console.log('PASS UI save reaches real adapter with per-item fields');
  await connect(a);
  await a.locator('[data-action=open-request][data-id="'+record.id+'"]').click();
  await a.waitForFunction(()=>UTPFrontend.getState().editor?.base?.version===1);
  assert.equal(await a.locator('#utpRequestFields [name=title]').inputValue(),record.title);
  assert.equal(await a.evaluate(()=>UTPFrontend.getState().editor.record.items[0].requiredAuthority),'HO');
  assert.equal(await a.locator('[data-action=submit-request]').isDisabled(),false);
  console.log('PASS reload and reopen preserve data; live submit is available');
  const b=await newPage();await b.locator('[data-action=open-request][data-id="'+record.id+'"]').click();
  await b.waitForFunction(()=>UTPFrontend.getState().editor?.base?.version===1);
  await a.locator('#utpRequestFields [name=title]').fill('Versi sesi A');await a.locator('[data-action=save-request]').click();
  await a.waitForFunction(()=>UTPFrontend.getState().editor?.base?.version===2);
  await b.locator('#utpRequestFields [name=title]').fill('Isian sesi B tetap ada');await b.locator('[data-action=save-request]').click();
  await b.waitForFunction(()=>document.getElementById('utpDialog').open);
  assert.match(await b.locator('#utpDialogTitle').innerText(),/Konflik/);
  assert.equal(env.call('detail',{entity:'requests',id:record.id}).record.title,'Versi sesi A');
  assert.equal(await b.evaluate(()=>UTPFrontend.getState().editor.record.title),'Isian sesi B tetap ada');
  console.log('PASS two browser sessions cannot overwrite stale drafts');
  await b.locator('#utpDialogForm button[type=submit]').click();
  await b.locator('[data-action=save-request]').click();
  await b.waitForFunction(()=>UTPFrontend.getState().editor?.base?.version===3);
  assert.equal(env.call('detail',{entity:'requests',id:record.id}).record.title,'Isian sesi B tetap ada');
  console.log('PASS selected conflict values save on the latest server version');
  assert.deepEqual(errors,[]);
  console.log('4/4 draft integration checks passed (mock Google services).');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
