// Local browser checks for the integrated frontend; never calls Google services.
// Usage: node alat/periksa-frontend-material.cjs <playwright module directory> <browser executable>
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {chromium} = require(process.argv[2] || 'playwright');

(async () => {
  const browser = await chromium.launch({headless:true, ...(process.argv[3] ? {executablePath:process.argv[3]} : {})});
  const page = await browser.newPage({viewport:{width:1440,height:900}});
  const errors = [];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://**/*', route=>route.abort());
  const url = pathToFileURL(path.resolve(__dirname,'../.local/aplikasi.html')).href;
  const assets = path.resolve(__dirname,'../.local/frontend');
  fs.mkdirSync(assets,{recursive:true});
  let count=0;
  function pass(label) {count++; console.log('PASS '+label);}
  try {
    await page.goto(url);
    await page.waitForFunction(()=>Boolean(window.UTPFrontend));
    assert.equal(await page.locator('#applicationShell').isVisible(),true);
    assert.ok(await page.locator('#homeCurrentDate').innerText());
    pass('Explicit preview opens the application and has a current date');
    for (const key of ['CATALOG','APPROVALS','REQUESTS','ARRIVAL','MEMO','RPB','RPD','HOME']) {
      await page.locator('.sidebar-nav [data-main="'+key+'"]').click();
      await page.waitForTimeout(100);
      const material=['CATALOG','APPROVALS','REQUESTS','ARRIVAL'].includes(key);
      assert.equal(await page.locator('#utpApp').isVisible(),material,key);
      if(material) assert.ok((await page.locator('#utpContent').innerText()).length>10);
      if(key==='HOME') assert.equal(await page.locator('#blank-HOME').isVisible(),true);
      pass('Navigation '+key);
    }
    await page.locator('#blank-HOME [data-main="REQUESTS"]').click();
    assert.equal(await page.locator('#utpApp').isVisible(),true);
    pass('Home material action opens workspace');
    for (const viewport of [{width:1440,height:900},{width:390,height:844}]) {
      await page.setViewportSize(viewport);
      for(const key of ['CATALOG','APPROVALS','REQUESTS','ARRIVAL']) {
        await page.evaluate(key=>switchMainPage(key),key);
        await page.waitForTimeout(100);
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,key+' viewport '+viewport.width);
      }
      await page.evaluate(()=>switchMainPage('CATALOG'));
      await page.waitForTimeout(100);
      await page.screenshot({path:path.join(assets,'material-'+viewport.width+'.png'),fullPage:true});
      pass('Material layouts contained at '+viewport.width+'px');
    }
    await page.setViewportSize({width:1440,height:900});
    await page.evaluate(()=>switchMainPage('REQUESTS'));
    await page.locator('[data-action=new-request]').click();
    await page.locator('#utpRequestFields [name=title]').fill('Permintaan uji frontend');
    await page.locator('[data-action=add-master]').click();
    await page.locator('#utpLookupQuery').fill('001');
    await page.locator('[data-action=lookup-select][data-code="001"]').click();
    await page.waitForTimeout(100);
    await page.locator('#utpDialogForm button[type=submit]').click();
    await page.waitForFunction(()=>UTPFrontend.getState().editor.record.items.length===1);
    assert.equal(await page.locator('#utpDialog').isVisible(),false);
    pass('Catalog lookup replaces dialog and applies selected item');
    await page.locator('[data-action=save-request]').click();
    await page.locator('[data-action=submit-request]').click();
    await page.locator('#utpDialogForm button[type=submit]').click();
    await page.waitForFunction(()=>Boolean(UTPFrontend.getState().editor.record.initialSnapshot));
    assert.equal(await page.locator('#utpDialog').isVisible(),false);
    assert.equal(await page.evaluate(()=>UTPFrontend.getState().editor.record.status),'REVIEW');
    pass('Initial submission freezes snapshot without requiring review metadata');
    await page.locator('[data-action=choose-original]').click();
    await page.locator('#utpDialogForm button[type=submit]').click();
    await page.waitForTimeout(100);
    await page.locator('#utpDialogForm [name=party]').selectOption('PM');
    await page.locator('#utpDialogForm [name=decision]').selectOption('APPROVED');
    await page.locator('#utpDialogForm [name=reason]').fill('Sesuai kebutuhan');
    await page.locator('#utpDialogForm button[type=submit]').click();
    await page.waitForFunction(()=>UTPFrontend.getState().editor.record.items[0].decisions.PM.status==='APPROVED');
    await page.locator('[data-action=save-request]').click();
    assert.equal(await page.evaluate(()=>UTPFrontend.getState().editor.record.revision),1);
    pass('Original-item dialog applies review without incrementing revision');
    await page.locator('#utpRequestFields [name=title]').fill('Isian tetap tersedia');
    await page.locator('[data-action=save-request]').click();
    assert.equal(await page.evaluate(()=>UTPFrontend.getState().editor.dirty),true);
    assert.match(await page.locator('#utpEditorError').innerText(),/alasan/);
    await page.locator('[name=reviewParty]').selectOption('PM');
    await page.locator('[name=reviewReason]').fill('Koreksi judul');
    await page.evaluate(()=>document.querySelector('[data-action=simulate-failure]').click());
    await page.locator('[data-action=save-request]').click();
    assert.match(await page.locator('#utpEditorError').innerText(),/gagal simpan/);
    assert.equal(await page.locator('#utpRequestFields [name=title]').inputValue(),'Isian tetap tersedia');
    await page.locator('[data-action=save-request]').click();
    assert.equal(await page.evaluate(()=>UTPFrontend.getState().editor.dirty),false);
    pass('Review reason and failed-save retry preserve input');
    await page.evaluate(()=>document.querySelector('[data-action=simulate-conflict]').click());
    await page.locator('[data-action=save-request]').click();
    assert.match(await page.locator('#utpDialogTitle').innerText(),/Konflik/);
    await page.locator('#utpDialogForm button[type=submit]').click();
    await page.locator('[data-action=save-request]').click();
    assert.equal(await page.evaluate(()=>UTPFrontend.getState().editor.dirty),false);
    pass('Conflict choices can be applied and saved');
    // Exercise a delayed server bootstrap with the production client and a local RPC stub.
    const live = await browser.newPage();
    await live.route('https://**/*',route=>route.abort());
    await live.goto(url);
    const data = await page.evaluate(()=>UTPFrontend.getState().data);
    await live.evaluate(data=>{
      window.__materialData=data;
      window.UTPFrontend.resetSession();
      window.UTP_FRONTEND_PREVIEW=false;
      window.utpRpc=()=>new Promise(resolve=>{window.__resolveMaterial=resolve;});
    },data);
    const client = fs.readFileSync(path.resolve(__dirname,'../aplikasi/UtpClient.html'),'utf8').replace(/^<script>\s*/, '').replace(/<\/script>\s*$/, '');
    await live.addScriptTag({content:client});
    await live.evaluate(()=>switchMainPage('CATALOG'));
    await live.evaluate(()=>{switchMainPage('MEMO');window.__resolveMaterial(window.__materialData);});
    await live.waitForTimeout(100);
    assert.equal(await live.locator('#utpApp').isVisible(),false);
    assert.equal(await live.locator('#common').isVisible(),true);
    await live.close();
    pass('Delayed material bootstrap does not reopen material after Memo navigation');
    assert.deepEqual(errors,[],'No browser runtime errors');
    const staged = fs.readFileSync(path.resolve(__dirname,'../.clasp-src/Index.html'),'utf8');
    assert.equal(staged.includes('UTP_FRONTEND_PREVIEW = true'),false,'No demo activation in production source');
    pass('Production source has no preview activation');
    console.log(count+'/'+count+' navigation/layout checks passed.');
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
