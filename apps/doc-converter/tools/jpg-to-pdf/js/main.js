/**
 * Chronos Toolbox — JPG to PDF
 * Uses jsPDF (loaded via CDN) to pack images into a PDF client-side.
 */

'use strict';

// ── State ─────────────────────────────────────────────────
const state = {
  files: [],        // { file: File, dataUrl: string, id: string }
  dragSrcId: null,
};

// ── DOM refs ───────────────────────────────────────────────
const dropzone      = document.getElementById('dropzone');
const fileInput     = document.getElementById('file-input');
const addMoreInput  = document.getElementById('add-more-input');
const btnAddMore    = document.getElementById('btn-add-more');
const previewArea   = document.getElementById('preview-area');
const previewGrid   = document.getElementById('preview-grid');
const previewLabel  = document.getElementById('preview-label');
const optionsPanel  = document.getElementById('options-panel');
const actionBar     = document.getElementById('action-bar');
const btnConvert    = document.getElementById('btn-convert');
const btnClear      = document.getElementById('btn-clear');
const fileCount     = document.getElementById('file-count');
const progressWrap  = document.getElementById('progress-wrap');
const progressBar   = document.getElementById('progress-bar');
const progressText  = document.getElementById('progress-text');
const progressPct   = document.getElementById('progress-pct');
const resultArea    = document.getElementById('result-area');
const resultMeta    = document.getElementById('result-meta');
const btnDownload   = document.getElementById('btn-download');
const btnAgain      = document.getElementById('btn-again');

const optSize   = document.getElementById('opt-size');
const optOrient = document.getElementById('opt-orient');
const optMargin = document.getElementById('opt-margin');

// ── Drag & drop on dropzone ────────────────────────────────
dropzone.addEventListener('dragover', e => { e.preventDefault(); dropzone.classList.add('drag-over'); });
dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag-over'));
dropzone.addEventListener('drop', e => {
  e.preventDefault();
  dropzone.classList.remove('drag-over');
  handleFiles([...e.dataTransfer.files]);
});
fileInput.addEventListener('change', () => handleFiles([...fileInput.files]));
btnAddMore.addEventListener('click', () => addMoreInput.click());
addMoreInput.addEventListener('change', () => handleFiles([...addMoreInput.files]));
btnClear.addEventListener('click', clearAll);
btnConvert.addEventListener('click', convert);
btnAgain.addEventListener('click', clearAll);

// ── File ingestion ─────────────────────────────────────────
function handleFiles(files) {
  const valid = files.filter(f => f.type.startsWith('image/'));
  if (!valid.length) { toast('Please upload image files (JPG, PNG, WebP).', true); return; }

  const readers = valid.map(file => new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = e => resolve({ file, dataUrl: e.target.result, id: crypto.randomUUID() });
    reader.readAsDataURL(file);
  }));

  Promise.all(readers).then(items => {
    state.files.push(...items);
    renderPreviews();
    showWorkspace();
  });
}

// ── Render preview grid ────────────────────────────────────
function renderPreviews() {
  previewGrid.innerHTML = '';

  state.files.forEach((item, idx) => {
    const el = document.createElement('div');
    el.className = 'preview-item';
    el.dataset.id = item.id;
    el.setAttribute('draggable', 'true');
    el.setAttribute('role', 'listitem');
    el.setAttribute('aria-label', `Image ${idx + 1}: ${item.file.name}`);

    el.innerHTML = `
      <span class="preview-item__num">${idx + 1}</span>
      <img src="${item.dataUrl}" alt="${item.file.name}" loading="lazy" />
      <div class="preview-item__footer">${truncate(item.file.name, 18)}</div>
      <button class="preview-item__remove" data-id="${item.id}" title="Remove" aria-label="Remove ${item.file.name}">✕</button>
    `;

    // Drag-to-reorder
    el.addEventListener('dragstart', () => { state.dragSrcId = item.id; el.classList.add('dragging'); });
    el.addEventListener('dragend',   () => el.classList.remove('dragging'));
    el.addEventListener('dragover',  e => { e.preventDefault(); el.classList.add('drag-target'); });
    el.addEventListener('dragleave', () => el.classList.remove('drag-target'));
    el.addEventListener('drop', e => {
      e.preventDefault();
      el.classList.remove('drag-target');
      if (state.dragSrcId === item.id) return;
      const srcIdx = state.files.findIndex(f => f.id === state.dragSrcId);
      const tgtIdx = state.files.findIndex(f => f.id === item.id);
      const [moved] = state.files.splice(srcIdx, 1);
      state.files.splice(tgtIdx, 0, moved);
      renderPreviews();
    });

    previewGrid.appendChild(el);
  });

  // Remove buttons
  previewGrid.querySelectorAll('.preview-item__remove').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      state.files = state.files.filter(f => f.id !== btn.dataset.id);
      if (!state.files.length) { clearAll(); return; }
      renderPreviews();
      updateCounts();
    });
  });

  updateCounts();
}

function updateCounts() {
  const n = state.files.length;
  previewLabel.textContent = `${n} image${n !== 1 ? 's' : ''} · drag to reorder`;
  fileCount.textContent = `${n} image${n !== 1 ? 's' : ''} selected`;
  btnConvert.disabled = n === 0;
}

function showWorkspace() {
  previewArea.style.display = 'block';
  optionsPanel.style.display = 'block';
  actionBar.style.display = 'flex';
}

function clearAll() {
  state.files = [];
  fileInput.value = '';
  addMoreInput.value = '';
  previewGrid.innerHTML = '';
  previewArea.style.display = 'none';
  optionsPanel.style.display = 'none';
  actionBar.style.display = 'none';
  progressWrap.classList.remove('visible');
  resultArea.classList.remove('visible');
  btnConvert.disabled = true;
}

// ── Conversion ─────────────────────────────────────────────
async function convert() {
  if (!state.files.length) return;

  const { jsPDF } = window.jspdf;
  const margin   = parseInt(optMargin.value, 10);
  const pageSize = optSize.value;
  const orient   = optOrient.value;

  btnConvert.disabled = true;
  progressWrap.classList.add('visible');
  resultArea.classList.remove('visible');
  setProgress(0, 'Preparing…');

  // Small delay so UI paints before heavy work
  await sleep(60);

  let pdf = null;

  for (let i = 0; i < state.files.length; i++) {
    const { dataUrl, file } = state.files[i];
    const pct = Math.round(((i) / state.files.length) * 95);
    setProgress(pct, `Processing image ${i + 1} of ${state.files.length}…`);

    // Get natural image dimensions
    const dims = await getImageDimensions(dataUrl);

    let pageOrient = orient;
    if (orient === 'auto') {
      pageOrient = dims.width > dims.height ? 'landscape' : 'portrait';
    }

    let pageFormat = pageSize === 'fit' ? [dims.width * 0.264583, dims.height * 0.264583] : pageSize; // px→mm approx

    if (i === 0) {
      pdf = new jsPDF({ orientation: pageOrient, unit: 'mm', format: pageFormat });
    } else {
      pdf.addPage(pageFormat, pageOrient);
    }

    const pw = pdf.internal.pageSize.getWidth();
    const ph = pdf.internal.pageSize.getHeight();
    const usableW = pw - margin * 2;
    const usableH = ph - margin * 2;

    // Scale image to fit within usable area, preserving aspect ratio
    const imgAr = dims.width / dims.height;
    const boxAr = usableW / usableH;
    let drawW, drawH;
    if (imgAr > boxAr) { drawW = usableW; drawH = usableW / imgAr; }
    else                { drawH = usableH; drawW = usableH * imgAr; }

    const x = margin + (usableW - drawW) / 2;
    const y = margin + (usableH - drawH) / 2;

    const fmt = file.type === 'image/png' ? 'PNG' : 'JPEG';
    pdf.addImage(dataUrl, fmt, x, y, drawW, drawH);

    await sleep(10); // allow UI update between heavy iterations
  }

  setProgress(100, 'Done!');
  await sleep(300);

  const pdfBlob = pdf.output('blob');
  const url = URL.createObjectURL(pdfBlob);
  const sizeMb = (pdfBlob.size / 1024 / 1024).toFixed(2);

  btnDownload.href = url;
  btnDownload.download = 'chronos-converted.pdf';
  resultMeta.textContent = `${state.files.length} page${state.files.length !== 1 ? 's' : ''} · ${sizeMb} MB`;

  progressWrap.classList.remove('visible');
  resultArea.classList.add('visible');
  resultArea.scrollIntoView({ behavior: 'smooth', block: 'center' });
  btnConvert.disabled = false;
}

// ── Helpers ────────────────────────────────────────────────
function getImageDimensions(dataUrl) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.src = dataUrl;
  });
}

function setProgress(pct, label) {
  progressBar.style.width = pct + '%';
  progressText.textContent = label;
  progressPct.textContent = pct + '%';
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function truncate(str, n) { return str.length > n ? str.slice(0, n - 1) + '…' : str; }

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
