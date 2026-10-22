// Actual frontend and document handlers; Google storage is simulated, no production writes.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.argv[2]||'playwright'),root=path.resolve(__dirname,'..');
const fixtureSource=fs.readFileSync(path.join(root,'pengujian/document-center.test.js'),'utf8');
const make=new Function('require','__dirname',fixtureSource.slice(0,fixtureSource.indexOf("test('template owner terisolasi"))+'\nreturn ownerEnv;')(require,path.join(root,'pengujian'));
(async()=>{
  const e=make();e.c.PropertiesService={getScriptProperties:()=>({getProperty:()=>null})};
  const browser=await chromium.launch({headless:true,executablePath:process.argv[3]});
  try{
    const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.route('https://**/*',route=>route.abort());
    await page.exposeFunction('__documentsBridge',(name,args)=>{if(['apiProjects','apiProjectDocument','apiDocumentWorkspace'].includes(name))return e.c[name](...args);if(name==='apiDashboard')return {warnings:[],activities:[]};if(name==='apiWorkspace')return {records:[]};throw new Error('Unexpected endpoint '+name);});
    await page.goto(process.env.UTP_PREVIEW_URL||'http://127.0.0.1:8765/aplikasi.html');
    await page.evaluate(async()=>{accessToken='owner';invokeServer=(name,args,ok,fail)=>window.__documentsBridge(name,args).then(ok,fail);await ProjectWorkspace.ready();ProjectWorkspace.select('proj-alpha-0001');switchMainPage('DOCUMENTS');});
    await page.waitForFunction(()=>document.getElementById('dcSummary').textContent.includes('Data server'));
    await page.locator('#dcOwnerUpload').click();await page.locator('#dcOwnerFiles').setInputFiles({name:'Laporan harian.docx',mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',buffer:Buffer.from('Owner fixture')});
    await page.locator('#dcOwnerFrequency').selectOption('Harian');await page.locator('#dcOwnerSave').click();await page.waitForFunction(()=>!document.getElementById('dcOwnerDialog').open);
    await page.locator('#dcOrigin').selectOption('OWNER');assert.equal(await page.locator('#dcList .dc-form-card').count(),1);
    await page.locator('#dcList button').filter({hasText:'Gunakan template'}).click();await page.locator('#dcNewDraftTitle').fill('Laporan harian 22 Oktober');
    await page.locator('#dcNewDraftForm button[value=confirm]').click();await page.waitForFunction(()=>!document.getElementById('dcNewDraftDialog').open);
    assert.equal(e.copies.length,1);assert.equal(await page.locator('#dcBoard .dc-board-card').count(),1);
    await page.locator('#dcBoard .dc-board-card button').click();await page.locator('#dcMonitorFields input[name=recipient]').fill('MK');await page.locator('#dcMonitorFields input[name=requiredAction]').fill('Tanda tangan laporan');await page.locator('#dcMonitorFields input[name=followUpDate]').fill('2026-10-25');await page.locator('#dcRecordSave').click();await page.waitForFunction(()=>!document.getElementById('dcRecordDialog').open);
    assert.match(await page.locator('#dcBoard').innerText(),/MK/);
    await page.locator('#dcBoard .dc-board-card button').click();await page.locator('#dcFileInput').setInputFiles({name:'scan-final.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-fixture')});await page.locator('#dcRecordDialog details').first().locator('summary').click();await page.locator('#dcFileRole').selectOption('signed');await page.locator('#dcFileSave').click();await page.waitForFunction(()=>document.getElementById('dcRecordMessage').textContent.includes('Berkas ditambahkan'));
    await page.locator('#dcRecordForm select[name=status]').selectOption('SELESAI');await page.locator('#dcRecordForm textarea[name=note]').fill('Scan bertanda tangan diterima');await page.locator('#dcRecordSave').click();await page.waitForFunction(()=>!document.getElementById('dcRecordDialog').open);
    assert.equal(await page.locator('#dcBoard .dc-board-card').count(),0);await page.locator('[data-dc-space=archive]').click();assert.equal(await page.locator('#dcBoard .dc-board-card').count(),1);
    await page.evaluate(()=>ProjectWorkspace.select('proj-beta-0002'));await page.waitForFunction(()=>document.getElementById('dcSummary').textContent.includes('Data server'));
    await page.locator('[data-dc-space=templates]').click();assert.equal(await page.locator('#dcList .dc-form-card').count(),0);await page.locator('#dcOrigin').selectOption('UTP');assert.ok(await page.locator('#dcList .dc-form-card').count()>0);
    assert.deepEqual(errors,[]);console.log('PASS owner documents: project upload/reuse, monitoring, signed attachment, archive, isolation and shared UTP forms');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
