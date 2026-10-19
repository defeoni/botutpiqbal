// Browser -> actual Workspace adapter -> in-memory Google services. No production writes.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {pathToFileURL}=require('node:url');
const {chromium}=require(process.argv[2]||'playwright');
const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'pengujian/material-penyimpanan.test.js'),'utf8');
const environment=new Function('require','__dirname',source.slice(0,source.indexOf('\nconst draft ='))+'\nreturn environment;')(require,path.join(root,'pengujian'));
(async()=>{
  const env=environment();vm.runInContext(fs.readFileSync(path.join(root,'aplikasi/Workspace.gs'),'utf8'),env.sandbox);
  const browser=await chromium.launch({headless:true,...(process.argv[3]?{executablePath:process.argv[3]}:{})});
  try{
    const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.exposeFunction('__workspaceBridge',(action,payload)=>env.plain(env.sandbox.apiWorkspace(action,payload,'session')));
    await page.goto(pathToFileURL(path.join(root,'.local/aplikasi.html')).href);
    await page.evaluate(()=>{accessToken='session';window.workspaceRpc=(action,payload)=>window.__workspaceBridge(action,payload);});
    await page.locator('.sidebar-nav [data-project-tool="Tugas"]').click();
    await page.waitForFunction(()=>document.getElementById('projectToolMessage').textContent.includes('dimuat'));
    await page.locator('#projectToolName').fill('Periksa ruang pompa');await page.locator('#projectToolDate').fill('2026-10-19');await page.locator('#tool-assignee').fill('Admin');
    await page.locator('#projectToolForm button[type="submit"], #projectToolForm button:not([type])').first().click();
    await page.waitForFunction(()=>document.getElementById('projectToolMessage').textContent.includes('Tersimpan'));
    assert.match(await page.locator('#projectToolList').innerText(),/Periksa ruang pompa/);
    await page.locator('#projectToolList button').filter({hasText:'Edit'}).click();await page.locator('#projectToolName').fill('Periksa pompa revisi');
    await page.locator('#projectToolForm button[type="submit"], #projectToolForm button:not([type])').first().click();
    await page.waitForFunction(()=>document.getElementById('projectToolMessage').textContent.includes('Tersimpan'));
    const task=env.sandbox.apiWorkspace('list',{module:'tasks'},'session').records[0];assert.equal(task.version,2);assert.equal(task.name,'Periksa pompa revisi');
    for(const name of ['Nota/Keuangan','Arsip Proyek','Absensi']){await page.locator('.sidebar-nav [data-project-tool="'+name+'"]').click();await page.waitForFunction(()=>document.getElementById('projectToolMessage').textContent.includes('dimuat'));assert.equal(await page.locator('#projectToolFields input,#projectToolFields select').count()>0,true);}
    await page.locator('[data-workspace="ho"]').click();
    await page.locator('.sidebar-nav [data-main="RPD"]').click();await page.waitForFunction(()=>document.getElementById('rpdStatus').textContent.includes('dimuat'));
    await page.locator('#rpdPurpose').fill('Sewa mess');await page.locator('#rpdDate').fill('2026-10-25');await page.locator('#rpdRecipient').fill('Pemilik mess');
    const line=page.locator('#rpdLines tr').first();await line.locator('input').nth(0).fill('Sewa bulanan');await line.locator('input').nth(1).fill('2');await line.locator('input').nth(2).fill('500000');
    await page.locator('#rpdForm button[type="submit"],#rpdForm button:not([type])').first().click();await page.waitForFunction(()=>document.getElementById('rpdStatus').textContent.includes('tersimpan'));
    assert.equal(env.sandbox.apiWorkspace('list',{module:'rpd'},'session').records[0].total,1000000);
    assert.deepEqual(errors,[]);console.log('PASS workspace PC: task create/edit, 4 module navigation, RPD server-derived total, no JS errors');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
