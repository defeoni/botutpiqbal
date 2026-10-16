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
  const url = pathToFileURL(path.resolve(__dirname,'../pratinjau/aplikasi.html')).href;
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
    assert.deepEqual(errors,[],'No browser runtime errors');
    const staged = fs.readFileSync(path.resolve(__dirname,'../.clasp-src/Index.html'),'utf8');
    assert.equal(staged.includes('UTP_FRONTEND_PREVIEW = true'),false,'No demo activation in production source');
    pass('Production source has no preview activation');
    console.log(count+'/'+count+' navigation/layout checks passed.');
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
