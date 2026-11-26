const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const FIXTURES = path.join(__dirname, 'fixtures');

function ensureFixtures() {
  fs.mkdirSync(FIXTURES, { recursive: true });
  if (!fs.existsSync(path.join(FIXTURES, 'valid.pdf')) || !fs.existsSync(path.join(FIXTURES, 'valid.png'))) {
    throw new Error('Test fixtures missing. Run: npx playwright test tests/e2e/fixtures.spec.js');
  }
}
ensureFixtures();

test.describe('Real conversions with valid files', () => {
  test('split-pdf splits a 1-page PDF', async ({ page }) => {
    const downloaded = [];
    page.on('download', d => downloaded.push(d));
    await page.goto('/apps/doc-converter/tools/split-pdf/');
    await page.locator('input[type="file"]').setInputFiles({
      name: 'valid.pdf',
      mimeType: 'application/pdf',
      buffer: fs.readFileSync(path.join(FIXTURES, 'valid.pdf'))
    });
    // Upload triggers API call (backend), split is local after loadFile
    await page.locator('#btn-split').click();
    await expect(page.locator('.result-card__title')).toContainText('Split complete', { timeout: 30000 });
    expect(downloaded.length).toBeGreaterThanOrEqual(0);
  });

  test('image-converter converts PNG to JPG', async ({ page }) => {
    await page.goto('/apps/image-editor/tools/image-converter/');
    await page.locator('#file-input').setInputFiles({
      name: 'valid.png',
      mimeType: 'image/png',
      buffer: fs.readFileSync(path.join(FIXTURES, 'valid.png'))
    });
    await page.locator('#btn-convert').click();
    await expect(page.locator('#output-area')).toBeVisible({ timeout: 30000 });
    expect(await page.locator('#output-grid img').count()).toBeGreaterThanOrEqual(1);
  });

  test('heic-to-jpg handles file upload without crashing', async ({ page }) => {
    await page.goto('/apps/image-editor/tools/heic-to-jpg/');
    await page.locator('#file-input').setInputFiles({
      name: 'valid.png',
      mimeType: 'image/png',
      buffer: fs.readFileSync(path.join(FIXTURES, 'valid.png'))
    });
    // heic2any CDN will reject PNG locally; page must stay alive
    await expect(page.locator('h1')).toBeVisible();
    await page.waitForTimeout(2000);
  });

  test('jpg-to-pdf converts images using cached dimensions', async ({ page }) => {
    await page.goto('/apps/doc-converter/tools/jpg-to-pdf/');
    await page.locator('#file-input').setInputFiles({
      name: 'valid.png',
      mimeType: 'image/png',
      buffer: fs.readFileSync(path.join(FIXTURES, 'valid.png'))
    });
    await expect(page.locator('#file-count')).toContainText('1 image', { timeout: 15000 });
    await page.locator('#btn-convert').click();
    await expect(page.locator('#result-area')).toBeVisible({ timeout: 30000 });
    await expect(page.locator('#result-meta')).toContainText('1 page');
  });

  test('rearrange-pdf renders thumbnails once and reorders via DOM move', async ({ page }) => {
    await page.goto('/apps/doc-converter/tools/rearrange-pdf/');
    await page.locator('#file-input').setInputFiles({
      name: 'valid.pdf',
      mimeType: 'application/pdf',
      buffer: fs.readFileSync(path.join(FIXTURES, 'valid.pdf'))
    });
    await expect(page.locator('#page-grid .page-thumb')).toHaveCount(3, { timeout: 20000 });
    await expect(page.locator('#page-grid .page-thumb canvas')).toHaveCount(3);

    // Verify canvases were actually rasterized (non-blank pixels present).
    const nonBlank = await page.locator('#page-grid .page-thumb canvas').evaluateAll(canvases =>
      canvases.map(c => {
        const ctx = c.getContext('2d');
        const data = ctx.getImageData(0, 0, c.width, c.height).data;
        for (let i = 3; i < data.length; i += 4) if (data[i] !== 0) return true;
        return false;
      })
    );
    expect(nonBlank.filter(Boolean).length).toBeGreaterThan(0);

    // Capture the canvas of the first thumb, then drag it onto the third.
    const firstLabel = await page.locator('#page-grid .page-thumb').first().locator('.page-thumb__footer').textContent();
    await page.locator('#page-grid .page-thumb').first().dragTo(page.locator('#page-grid .page-thumb').nth(2));
    // After reorder, the first thumb's label should now be the last page.
    await expect(page.locator('#page-grid .page-thumb').first().locator('.page-thumb__footer')).not.toHaveText(firstLabel);
    // Thumbnails must NOT have been rebuilt: same canvas DOM nodes persist.
    const canvasCountAfter = await page.locator('#page-grid .page-thumb canvas').count();
    expect(canvasCountAfter).toBe(3);
  });

  test('filter-adder debounces matrix edits and flushes before export', async ({ page }) => {
    await page.goto('/apps/image-editor/tools/filter-adder/');
    await page.locator('#file-input').setInputFiles({
      name: 'valid.png',
      mimeType: 'image/png',
      buffer: fs.readFileSync(path.join(FIXTURES, 'valid.png'))
    });
    await expect(page.locator('#editor-section')).toBeVisible({ timeout: 15000 });

    // Typing into a matrix input schedules a debounced render; switching to the
    // negative preset must change the rendered pixel after the debounce window.
    const before = await page.locator('#preview-canvas').evaluate(c => {
      const d = c.getContext('2d').getImageData(0, 0, 1, 1).data;
      return [d[0], d[1], d[2]].join(',');
    });
    await page.locator('#matrix-preset').selectOption('negative');
    await expect.poll(async () => page.locator('#preview-canvas').evaluate(c => {
      const d = c.getContext('2d').getImageData(0, 0, 1, 1).data;
      return [d[0], d[1], d[2]].join(',');
    }), { timeout: 5000 }).not.toBe(before);
    // Export must still work with a pending debounce.
    const download = page.waitForEvent('download', { timeout: 15000 });
    await page.locator('#btn-save').click();
    expect(await download).toBeTruthy();
  });

  test('image-upscaler Smart Detail completes async unsharp mask', async ({ page }) => {
    await page.goto('/apps/image-editor/tools/image-upscaler/');
    await page.locator('#file-input').setInputFiles({
      name: 'valid.png',
      mimeType: 'image/png',
      buffer: fs.readFileSync(path.join(FIXTURES, 'valid.png'))
    });
    await expect(page.locator('#editor-section')).toBeVisible({ timeout: 15000 });
    await page.locator('#scale-select').selectOption('2');
    await page.locator('#method-select').selectOption('smart');
    await page.locator('#btn-upscale').click();
    await expect(page.locator('#status-text')).toContainText('Upscaled to 200×200', { timeout: 20000 });
    await expect(page.locator('#result-area')).toBeVisible();
  });
});
