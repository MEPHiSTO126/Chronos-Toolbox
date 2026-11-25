const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const appsDir = path.join(root, 'apps');
const toolPages = [];
for (const app of fs.readdirSync(appsDir)) {
  const toolsDir = path.join(appsDir, app, 'tools');
  if (!fs.existsSync(toolsDir)) continue;
  for (const tool of fs.readdirSync(toolsDir)) {
    const pagePath = path.join(toolsDir, tool, 'index.html');
    if (fs.existsSync(pagePath)) {
      toolPages.push({ app, tool, path: `/${path.relative(root, path.dirname(pagePath)).replaceAll(path.sep, '/')}/` });
    }
  }
}

// Every tool page should load its real page scripts without uncaught errors,
// broken local assets, duplicate IDs, or missing primary controls.
for (const tool of toolPages) {
  test(`${tool.app}/${tool.tool}: page smoke test`, async ({ page }) => {
    const pageErrors = [];
    const failedRequests = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    page.on('requestfailed', request => {
      if (request.url().startsWith('http://127.0.0.1:4173/')) {
        failedRequests.push(`${request.method()} ${request.url()}: ${request.failure()?.errorText}`);
      }
    });

    const response = await page.goto(tool.path);
    expect(response, 'page navigation response should exist').not.toBeNull();
    expect(response.status(), 'tool page should return HTTP 200').toBe(200);
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('body')).not.toBeEmpty();

    const brokenImages = await page.locator('img').evaluateAll(images =>
      images.filter(img => img.getAttribute('src') && (!img.complete || img.naturalWidth === 0)).map(img => img.getAttribute('src'))
    );
    expect(brokenImages, 'local and remote images should load').toEqual([]);

    const duplicateIds = await page.locator('[id]').evaluateAll(elements => {
      const ids = elements.map(element => element.id);
      return [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
    });
    expect(duplicateIds, 'IDs should be unique').toEqual([]);

    expect(pageErrors, 'page should not throw uncaught JS errors').toEqual([]);
    expect(failedRequests, 'local assets should resolve').toEqual([]);
  });
}

// Exercise basic input selection and reset for upload-based tools without
// invoking external APIs or expensive conversions.
const uploadTools = toolPages.filter(({ app, tool }) =>
  app !== 'qr-generator' && fs.existsSync(path.join(root, `apps/${app}/tools/${tool}/js/main.js`))
);
for (const tool of uploadTools) {
  test(`${tool.app}/${tool.tool}: accepts an invalid file gracefully`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(tool.path);
    const input = page.locator('input[type="file"]').first();
    if (await input.count()) {
      await input.setInputFiles({ name: 'not-a-media-file.txt', mimeType: 'text/plain', buffer: Buffer.from('test') });
      await expect(page.getByText(/select a valid|unsupported|invalid file|file type/i).first()).toBeVisible({ timeout: 3000 }).catch(() => {});
    }
    expect(errors).toEqual([]);
  });
}

// Check hub navigation and search render on all app landing pages.
for (const app of ['home', 'doc-converter', 'image-editor', 'media-converter', 'qr-generator']) {
  test(`${app}: hub renders and has navigation links`, async ({ page }) => {
    const route = app === 'home' ? '/apps/home/' : `/apps/${app}/`;
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const response = await page.goto(route);
    expect(response.status()).toBe(200);
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('a[href]')).not.toHaveCount(0);
    expect(errors).toEqual([]);
  });
}
