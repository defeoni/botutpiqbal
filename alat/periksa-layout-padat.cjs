// Local preview only: layout and navigation proof, without production calls.
const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require(process.argv[2] || 'playwright');

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.argv[3] });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('dialog', dialog => dialog.accept());
    await page.route('https://**/*', route => route.abort());
    await page.goto(process.env.UTP_PREVIEW_URL || 'http://127.0.0.1:8766/aplikasi.html');
    assert.equal(await page.locator('[data-dc-view="board"]').getAttribute('class'), 'dc-tab active');
    assert.equal(await page.locator('#dcBoardView').isVisible(), true);
    assert.equal(await page.locator('#dcListView').isVisible(), false);
    console.log('PASS Pusat Dokumen defaults to Kanban; list remains optional');
    await page.evaluate(async () => {
      invokeServer = (name, args, resolve, reject) => {
        if (name === 'apiProjects' && args[0] === 'list') resolve({ projects: [{ id: 'layout-project', name: 'Proyek contoh', code: 'DEMO' }] });
        else if (name === 'apiProjects' && args[0] === 'documents') resolve({ documents: [], warnings: [] });
        else reject(new Error('Local layout fixture: ' + name));
      };
      await ProjectWorkspace.ready();
      DocumentCenter.reload();
      document.getElementById('projectScopeStatus').textContent = 'Pratinjau lokal · tanpa data produksi';
      document.getElementById('userIdentity').textContent = 'Pratinjau lokal';
      document.getElementById('appStatus').textContent = 'Data contoh, bukan server produksi.';
    });

    for (const width of [1366, 1440, 1920]) {
      await page.setViewportSize({ width, height: 768 });
      const positions = await page.evaluate(() => {
        const brand = document.querySelector('.sidebar-brand');
        const project = document.querySelector('.project-scope');
        const menu = document.getElementById('mainMenu');
        const top = brand.getBoundingClientRect().top;
        menu.scrollTop = menu.scrollHeight;
        return { brandTop: top, brandAfter: brand.getBoundingClientRect().top,
          projectTop: project.getBoundingClientRect().top,
          brandBottom: brand.getBoundingClientRect().bottom,
          menuScroll: menu.scrollTop, fits: document.documentElement.scrollWidth <= innerWidth };
      });
      assert.equal(positions.brandTop, positions.brandAfter);
      assert.ok(positions.projectTop >= positions.brandBottom);
      assert.ok(positions.menuScroll > 0, 'navigation should scroll independently');
      assert.equal(positions.fits, true);
    }
    console.log('PASS fixed brand/project context and independent menu scroll at 1366/1440/1920');
    await page.evaluate(() => { document.getElementById('mainMenu').scrollTop = 0; });

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.locator('[data-dc-view="list"]').click();
    const heights = await page.locator('#dcList .dc-form-card').evaluateAll(cards => cards.map(card => card.getBoundingClientRect().height));
    assert.ok(heights.length > 0);
    assert.ok(heights.every(height => height < 140), 'template rows must not retain the 226px minimum');
    await page.screenshot({ path: path.join(__dirname, '../.local/compact-forms.png') });
    console.log('PASS compact template rows:', Math.max(...heights), 'px maximum');

    await page.evaluate(() => {
      invokeServer = (name, args, resolve, reject) => name === 'apiProjects' && args[0] === 'documents'
        ? resolve({ documents: [], warnings: [] }) : reject(new Error('Read-only layout fixture: ' + name));
      switchMainPage('KANBAN');
    });
    const emptyHeights = await page.locator('#kgBoard .dc-board-column').evaluateAll(columns => columns.map(column => column.getBoundingClientRect().height));
    assert.equal(emptyHeights.length, 7, 'all process stages must remain available');
    assert.ok(emptyHeights.every(height => height < 110));
    assert.ok((await page.locator('#kgBoard').boundingBox()).height < 130);
    await page.screenshot({ path: path.join(__dirname, '../.local/compact-kanban.png') });
    console.log('PASS empty Kanban keeps all stages without tall empty columns');
    await page.evaluate(() => {
      const rows = [
        { id: 'demo-1', title: 'Pengajuan material lantai dasar', status: 'DRAFT', source: 'requests' },
        { id: 'demo-2', title: 'Rencana pengeluaran bulanan', status: 'DIAJUKAN', source: 'rpb' },
        { id: 'demo-3', title: 'Approval spesifikasi material', status: 'DIPROSES', source: 'approvals' },
        { id: 'demo-4', title: 'Laporan pekerjaan lapangan', status: 'SELESAI', source: 'document' }
      ].map(row => Object.assign(row, { projectId: 'layout-project' }));
      invokeServer = (name, args, resolve, reject) => name === 'apiProjects' && args[0] === 'documents'
        ? resolve({ documents: rows, warnings: [] }) : reject(new Error('Local layout fixture: ' + name));
    });
    await page.locator('#kgReload').click();
    assert.equal(await page.locator('#kgBoard .dc-board-card').count(), 4);
    await page.screenshot({ path: path.join(__dirname, '../.local/compact-kanban-filled.png') });
    console.log('PASS populated Kanban keeps cards and empty destinations visible');

    for (const target of ['HOME', 'CATALOG', 'APPROVALS', 'REQUESTS', 'ARRIVAL', 'MEMO', 'RPB', 'RPD', 'HO', 'LPD', 'DOCUMENTS', 'KANBAN']) {
      await page.evaluate(target => switchMainPage(target), target);
      const tiny = await page.evaluate(() => {
        const walker = document.createTreeWalker(document.getElementById('applicationShell'), NodeFilter.SHOW_TEXT);
        const result = [];
        while (walker.nextNode()) {
          const text = walker.currentNode;
          const element = text.parentElement;
          if (!text.textContent.trim() || !element || ['SCRIPT', 'STYLE', 'OPTION'].includes(element.tagName)) continue;
          const style = getComputedStyle(element);
          if (!element.getClientRects().length || style.visibility === 'hidden') continue;
          if (parseFloat(style.fontSize) < 10) result.push(text.textContent.trim().slice(0, 60));
        }
        return result;
      });
      assert.deepEqual(tiny, [], target + ': text smaller than 10px');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, target + ': horizontal page overflow');
    }
    assert.deepEqual(errors, []);
    console.log('PASS 12 page surfaces: no visible text below 10px, page overflow, or JavaScript errors');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
