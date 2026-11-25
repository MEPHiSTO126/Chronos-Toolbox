const { test } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const FIXTURES = path.join(__dirname, 'fixtures');
fs.mkdirSync(FIXTURES, { recursive: true });

test('generate valid.pdf and valid.png fixtures', async ({ page }) => {
  await page.goto('/apps/home/');

  const pdfBase64 = await page.evaluate(async () => {
    const mod = await import('https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/+esm');
    const pdfDoc = await mod.PDFDocument.create();
    pdfDoc.addPage([612, 792]);
    pdfDoc.setTitle('Chronos Test PDF');
    const bytes = await pdfDoc.save();
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  });
  fs.writeFileSync(path.join(FIXTURES, 'valid.pdf'), Buffer.from(pdfBase64, 'base64'));

  const pngBase64 = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 100;
    canvas.height = 100;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#4A90E2';
    ctx.fillRect(0, 0, 100, 100);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '20px sans-serif';
    ctx.fillText('TEST', 25, 55);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  fs.writeFileSync(path.join(FIXTURES, 'valid.png'), Buffer.from(pngBase64, 'base64'));
});
