import { expect, test } from '@playwright/test';

for (const width of [1366, 1920]) {
  test(`desktop ${width}: rendered hero, animation control and working navigation`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/');
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme)).toBe('light');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Setiap progres.Satu kendali.');
    await expect(page.locator('.project-stat')).toHaveCount(4);
    await expect(page.locator('.construction-scene')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const truck = page.locator('.site-truck-route');
    await expect.poll(() => truck.evaluate(el => getComputedStyle(el).animationPlayState)).toBe('running');
    const before = await truck.evaluate(el => getComputedStyle(el).transform);
    await expect.poll(() => truck.evaluate(el => getComputedStyle(el).transform), { timeout: 6000 }).not.toBe(before);
    await page.getByRole('button', { name: 'Jeda animasi konstruksi' }).click();
    await expect(page.getByRole('button', { name: 'Putar animasi konstruksi' })).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(() => truck.evaluate(el => getComputedStyle(el).animationPlayState)).toBe('paused');
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: `.local/utp-workspace-${width}.png`, fullPage: true });
    const geometry = await page.locator('.construction-scene').evaluate(el => {
      const svg = el as SVGSVGElement;
      const box = svg.getBBox();
      const view = svg.viewBox.baseVal;
      return { contained: box.x >= view.x && box.y >= view.y && box.x + box.width <= view.x + view.width && box.y + box.height <= view.y + view.height, width: svg.getBoundingClientRect().width };
    });
    expect(geometry.contained).toBe(true);
    expect(geometry.width).toBeGreaterThan(width * .54);
    await page.getByRole('button', { name: 'Perbesar miniatur konstruksi' }).click();
    const sceneDialog = page.getByRole('dialog', { name: 'Membangun hari esok.' });
    await expect(sceneDialog).toBeVisible();
    const largeTruck = sceneDialog.locator('.site-truck-route');
    await expect.poll(() => largeTruck.evaluate(el => getComputedStyle(el).animationPlayState)).toBe('paused');
    await page.screenshot({ path: `.local/utp-miniatur-besar-${width}.png` });
    await page.getByRole('button', { name: 'Putar animasi miniatur besar' }).click();
    await expect.poll(() => largeTruck.evaluate(el => getComputedStyle(el).animationPlayState)).toBe('running');
    await page.getByRole('button', { name: 'Jeda animasi miniatur besar' }).click();
    await page.keyboard.press('Escape');
    await expect(sceneDialog).not.toBeVisible();
    await expect(page.getByRole('button', { name: 'Perbesar miniatur konstruksi' })).toBeFocused();
    await page.getByRole('button', { name: 'Putar animasi konstruksi' }).click();
    await expect.poll(() => truck.evaluate(el => getComputedStyle(el).animationPlayState)).toBe('running');
    await page.getByRole('button', { name: 'Buka meja kerja' }).click();
    const boardTop = await page.locator('#meja-kerja').evaluate(el => el.getBoundingClientRect().top);
    expect(boardTop).toBeGreaterThanOrEqual(130);
    await page.getByRole('button', { name: 'Jelajahi memori' }).click();
    await expect(page.getByRole('heading', { name: 'Pusat Memori Dokumen Proyek' })).toBeVisible();
    await page.screenshot({ path: `.local/utp-memori-${width}.png`, fullPage: true });
    await page.getByRole('button', { name: 'Meja kerja', exact: true }).click();
    await page.getByRole('button', { name: 'Unggah berkas', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Tinjau Metadata Berkas' })).toBeDisabled();
    await page.screenshot({ path: `.local/utp-unggah-${width}.png` });
    await page.getByRole('button', { name: 'Tutup', exact: true }).click();
    await page.getByRole('combobox', { name: 'Pilih Proyek Aktif' }).selectOption('PRJ-CKR');
    await expect(page.locator('.hero-context')).toContainText('Cikarang');
    const counts = await page.evaluate(() => {
      const docs = JSON.parse(localStorage.getItem('utp_project_memory_docs_v1') || '[]');
      return docs.filter((d: { projectId: string; isArchived: boolean; category: string }) =>
        !d.isArchived && (d.projectId === 'PRJ-CKR' || (d.projectId === 'PRJ-HO' && d.category === 'REFERENSI_STANDAR'))).length;
    });
    await expect(page.locator('.stat-value').first()).toHaveText(String(counts).padStart(2, '0'));
    await page.locator('#meja-kerja [role="button"]').first().focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog')).toBeVisible();
    expect(errors).toEqual([]);
  });
}

test('reduced motion stops scene animation and compact layout does not overflow', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'dark' });
  await page.setViewportSize({ width: 960, height: 900 });
  await page.goto('/');
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme)).toBe('light');
  await expect(page.getByRole('button', { name: 'Putar animasi konstruksi' })).toHaveAttribute('aria-pressed', 'true');
  expect(await page.locator('.site-truck-route').evaluate(el => getComputedStyle(el).animationName)).toBe('none');
  const overflow = await page.evaluate(() => ({
    width: document.documentElement.scrollWidth,
    viewport: innerWidth,
    elements: Array.from(document.querySelectorAll('body *')).filter(el => el.getBoundingClientRect().right > innerWidth + 1).slice(0, 12).map(el => ({ tag: el.tagName, className: el.getAttribute('class'), right: el.getBoundingClientRect().right }))
  }));
  await page.screenshot({ path: '.local/utp-workspace-960.png', fullPage: true });
  expect(overflow.width, JSON.stringify(overflow)).toBeLessThanOrEqual(overflow.viewport);
  await page.getByRole('button', { name: 'Perbesar miniatur konstruksi' }).click();
  const dialog = page.getByRole('dialog', { name: 'Membangun hari esok.' });
  await expect(dialog).toBeVisible();
  expect(await dialog.locator('.crane-cable').evaluate(el => getComputedStyle(el).animationName)).toBe('none');
  await page.getByRole('button', { name: 'Tutup miniatur besar' }).click();
  await expect(dialog).not.toBeVisible();
});
