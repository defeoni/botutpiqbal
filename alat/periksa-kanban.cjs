const assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require(process.argv[2]||'playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.argv[3]});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('https://**/*',r=>r.abort());
  await page.goto(pathToFileURL(path.join(__dirname,'../.local/aplikasi.html')).href);
  await page.locator('.sidebar-nav [data-main="REQUESTS"]').click();
  const card=()=>page.locator('[data-board-id="request-demo"]');
  await card().waitFor();assert.equal(await page.locator('.utp-board-column').count(),6);
  await card().locator('[data-stage="FINAL"]').click();
  await page.locator('#utpDialogForm [name=party]').selectOption('PM');await page.locator('#utpDialogForm [name=reason]').fill('Daftar final parsial hasil review');await page.locator('#utpDialogForm [type=submit]').click();
  await page.locator('[data-board-stage="FINAL"] [data-board-id="request-demo"]').waitFor();
  assert.equal(await page.evaluate(()=>UTPFrontend.getState().data.requests[0].finalSnapshot.items.length),2);
  console.log('PASS review to partial final retains two ready items and returns to board');
  await card().dragTo(page.locator('[data-board-stage="FULFILLMENT"] h3'));
  await page.locator('#utpDialogForm [name=reason]').waitFor();
  assert.equal(await page.locator('[data-board-stage="FINAL"] [data-board-id="request-demo"]').count(),1);
  await page.locator('[data-action=close-dialog]').click();assert.equal(await page.locator('[data-board-stage="FINAL"] [data-board-id="request-demo"]').count(),1);
  console.log('PASS drag opens confirmation; cancel preserves card stage');
  await card().locator('[data-stage="FULFILLMENT"]').click();await page.locator('#utpDialogForm [name=confirmed]').check();await page.locator('#utpDialogForm [name=reason]').fill('Supplier mengonfirmasi penyediaan');await page.locator('#utpDialogForm [type=submit]').click();
  await page.locator('[data-board-stage="FULFILLMENT"] [data-board-id="request-demo"]').waitFor();assert.equal(await page.evaluate(()=>UTPFrontend.getState().data.requests[0].arrived),false);
  console.log('PASS fulfillment requires confirmation and does not imply arrival');
  await card().locator('[data-stage="ARRIVED"]').click();await page.locator('#utpDialogForm [name=arrivalDate]').fill('2026-10-18');await page.locator('#utpDialogForm [name=confirmed]').check();await page.locator('#utpDialogForm [name=note]').fill('Konfirmasi gudang');await page.locator('#utpDialogForm [type=submit]').click();
  await page.locator('[data-board-stage="ARRIVED"] [data-board-id="request-demo"]').waitFor();assert.equal(await page.evaluate(()=>UTPFrontend.getState().data.requests[0].arrivalDate),'2026-10-18');assert.equal(await card().locator('[data-action=kanban-move]').count(),0);
  console.log('PASS arrival stores observed date and completed cards cannot advance');
  await page.locator('[data-action=request-view]').click();await page.locator('[data-action=request-view]').click();await card().waitFor();assert.deepEqual(errors,[]);
  console.log('PASS board/list toggle and no browser JavaScript errors');
  await page.screenshot({path:path.join(__dirname,'../.local/frontend/kanban-1440.png'),fullPage:true});
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

