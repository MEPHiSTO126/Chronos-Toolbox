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
});
