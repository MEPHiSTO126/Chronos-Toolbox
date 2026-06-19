/**
 * Chronos Toolbox — PDF to JPG
 * Uses PDF.js (loaded via CDN) to render each page to a canvas,
 * then lets the user download individual images or all at once (JSZip).
 */

'use strict';

// ── Configure PDF.js worker ────────────────────────────────
pdfjsLib.GlobalWorkerOptions.workerSrc =
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// ── State ──────────────────────────────────────────────────
const state = {
  pdfDoc:   null,
  fileName: '',
  pages:    [],   // { pageNum, canvas, blob }
};

// ── DOM refs ───────────────────────────────────────────────
const dropzone     = document.getElementById('dropzone');
const fileInput    = document.getElementById('file-input');
const optionsPanel = document.getElementById('options-panel');
const actionBar    = document.getElementById('action-bar');
const btnConvert   = document.getElementById('btn-convert');
const btnClear     = document.getElementById('btn-clear');
const fileInfo     = document.getElementById('file-info');
const progressWrap = document.getElementById('progress-wrap');
const progressBar  = document.getElementById('progress-bar');
const progressText = document.getElementById('progress-text');
const progressPct  = document.getElementById('progress-pct');
const pagesArea    = document.getElementById('pages-area');
const pagesGrid    = document.getElementById('pages-grid');
const pagesLabel   = document.getElementById('pages-label');
const btnDlAll     = document.getElementById('btn-download-all');
const optQuality   = document.getElementById('opt-quality');
const optFormat    = document.getElementById('opt-format');
const optPages     = document.getElementById('opt-pages');
const rangeRow     = document.getElementById('range-row');
const optRange     = document.getElementById('opt-range');

// ── Events ─────────────────────────────────────────────────
dropzone.addEventListener('dragover', e => { e.preventDefault(); dropzone.classList.add('drag-over'); });
dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag-over'));
dropzone.addEventListener('drop', e => {
  e.preventDefault();
  dropzone.classList.remove('drag-over');
  loadFile(e.dataTransfer.files[0]);
});
fileInput.addEventListener('change', () => loadFile(fileInput.files[0]));
btnClear.addEventListener('click', clearAll);
btnConvert.addEventListener('click', convert);
btnDlAll.addEventListener('click', downloadAll);
optPages.addEventListener('change', () => {
  rangeRow.style.display = optPages.value === 'range' ? 'block' : 'none';
});

// ── Load PDF ───────────────────────────────────────────────
async function loadFile(file) {
  if (!file || file.type !== 'application/pdf') {
    toast('Please upload a PDF file.', true); return;
  }
  state.fileName = file.name.replace(/\.pdf$/i, '');
  const arrayBuffer = await file.arrayBuffer();

  try {
    state.pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    fileInfo.textContent = `${state.pdfDoc.numPages} page${state.pdfDoc.numPages !== 1 ? 's' : ''} · ${formatSize(file.size)}`;
    optionsPanel.style.display = 'block';
    actionBar.style.display    = 'flex';
    pagesArea.style.display    = 'none';
    pagesGrid.innerHTML        = '';
    state.pages = [];
  } catch (err) {
    toast('Could not read PDF. Is it password-protected?', true);
  }
}

// ── Parse page range string ────────────────────────────────
function parseRange(str, maxPage) {
  const pages = new Set();
  str.split(',').forEach(part => {
    part = part.trim();
    if (/^\d+$/.test(part)) {
      const n = parseInt(part);
      if (n >= 1 && n <= maxPage) pages.add(n);
    } else if (/^\d+-\d+$/.test(part)) {
      let [a, b] = part.split('-').map(Number);
      a = Math.max(1, a); b = Math.min(maxPage, b);
      for (let i = a; i <= b; i++) pages.add(i);
    }
  });
  return [...pages].sort((a, b) => a - b);
}

// ── Convert ────────────────────────────────────────────────
async function convert() {
  if (!state.pdfDoc) return;

  const scale  = parseFloat(optQuality.value);
  const fmt    = optFormat.value;
  const mimeType = fmt === 'png' ? 'image/png' : 'image/jpeg';
  const ext    = fmt;

  let pageNums;
  if (optPages.value === 'range') {
    pageNums = parseRange(optRange.value, state.pdfDoc.numPages);
    if (!pageNums.length) { toast('No valid pages in that range.', true); return; }
  } else {
    pageNums = Array.from({ length: state.pdfDoc.numPages }, (_, i) => i + 1);
  }

  state.pages = [];
  pagesGrid.innerHTML = '';
  pagesArea.style.display    = 'none';
  progressWrap.classList.add('visible');
  btnConvert.disabled = true;
  setProgress(0, 'Starting…');

  for (let i = 0; i < pageNums.length; i++) {
    const pageNum = pageNums[i];
    const pct = Math.round((i / pageNums.length) * 100);
    setProgress(pct, `Rendering page ${pageNum}…`);

    const page   = await state.pdfDoc.getPage(pageNum);
    const vp     = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width  = vp.width;
    canvas.height = vp.height;
    const ctx = canvas.getContext('2d');

    await page.render({ canvasContext: ctx, viewport: vp }).promise;

    // Convert canvas to blob
    const blob = await new Promise(res => canvas.toBlob(res, mimeType, 0.92));
    const url  = URL.createObjectURL(blob);
    state.pages.push({ pageNum, canvas, blob, url, ext });

    renderPageCard({ pageNum, canvas, url, ext });
    await sleep(5);
  }

  setProgress(100, 'Done!');
  await sleep(250);

  progressWrap.classList.remove('visible');
  pagesLabel.textContent = `${state.pages.length} page${state.pages.length !== 1 ? 's' : ''} extracted`;
  pagesArea.style.display = 'block';
  pagesArea.scrollIntoView({ behavior: 'smooth', block: 'start' });
  btnConvert.disabled = false;
}

// ── Render a single page card ──────────────────────────────
function renderPageCard({ pageNum, canvas, url, ext }) {
  const card = document.createElement('div');
  card.className = 'page-card';
  card.setAttribute('role', 'listitem');
  card.setAttribute('aria-label', `Page ${pageNum}`);

  // Clone canvas for display (smaller)
  const displayCanvas = document.createElement('canvas');
  const maxW = 200;
  const ratio = maxW / canvas.width;
  displayCanvas.width  = maxW;
  displayCanvas.height = Math.round(canvas.height * ratio);
  const ctx2 = displayCanvas.getContext('2d');
  ctx2.drawImage(canvas, 0, 0, displayCanvas.width, displayCanvas.height);

  card.innerHTML = `
    <div class="page-card__footer">
      <span class="page-card__num">Page ${pageNum}</span>
      <a class="page-card__dl" href="${url}" download="${state.fileName}-page-${pageNum}.${ext}">⬇ Save</a>
    </div>
  `;
  card.insertBefore(displayCanvas, card.firstChild);
  pagesGrid.appendChild(card);
}

// ── Download All (sequential anchor clicks) ────────────────
async function downloadAll() {
  for (const p of state.pages) {
    const a = document.createElement('a');
    a.href     = p.url;
    a.download = `${state.fileName}-page-${p.pageNum}.${p.ext}`;
    a.click();
    await sleep(200); // avoid browser throttling
  }
}

// ── Helpers ────────────────────────────────────────────────
function clearAll() {
  state.pdfDoc = null;
  state.pages  = [];
  fileInput.value = '';
  optionsPanel.style.display = 'none';
  actionBar.style.display    = 'none';
  pagesArea.style.display    = 'none';
  progressWrap.classList.remove('visible');
  pagesGrid.innerHTML = '';
  fileInfo.textContent = '';
}

function setProgress(pct, label) {
  progressBar.style.width = pct + '%';
  progressText.textContent = label;
  progressPct.textContent  = pct + '%';
}

function formatSize(bytes) {
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1024 / 1024).toFixed(2) + ' MB';
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function toast(msg, isError = false) {
  document.querySelector('.ct-toast')?.remove();
  const el = document.createElement('div');
  el.className = 'ct-toast' + (isError ? ' ct-toast--error' : '');
  el.setAttribute('role', 'status');
  el.textContent = msg;
  document.body.appendChild(el);
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('show')));
  setTimeout(() => {
    el.classList.remove('show');
    el.addEventListener('transitionend', () => el.remove(), { once: true });
  }, 3500);
}
