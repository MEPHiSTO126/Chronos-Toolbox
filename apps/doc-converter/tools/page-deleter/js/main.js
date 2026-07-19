'use strict';
const { PDFDocument } = PDFLib;
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

const state = { srcBytes: null, pdfLibDoc: null, pdfJsDoc: null, selected: new Set() };

const dropzone    = document.getElementById('dropzone');
const fileInput   = document.getElementById('file-input');
const editorArea  = document.getElementById('editor-area');
const pageGrid    = document.getElementById('page-grid');
const toolHint    = document.getElementById('tool-hint');
const btnSelectAll= document.getElementById('btn-select-all');
const btnDeselect = document.getElementById('btn-deselect');
const actionBar   = document.getElementById('action-bar');
const btnApply    = document.getElementById('btn-apply');
const btnClear    = document.getElementById('btn-clear');
const fileInfo    = document.getElementById('file-info');
const progressWrap= document.getElementById('progress-wrap');
const progressBar = document.getElementById('progress-bar');
const progressText= document.getElementById('progress-text');
const progressPct = document.getElementById('progress-pct');
const resultArea  = document.getElementById('result-area');
const resultMeta  = document.getElementById('result-meta');
const btnDownload = document.getElementById('btn-download');
const btnAgain    = document.getElementById('btn-again');

dropzone.addEventListener('dragover', e => { e.preventDefault(); dropzone.classList.add('drag-over'); });
dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag-over'));
dropzone.addEventListener('drop', e => { e.preventDefault(); dropzone.classList.remove('drag-over'); loadFile(e.dataTransfer.files[0]); });
fileInput.addEventListener('change', () => loadFile(fileInput.files[0]));
btnSelectAll.addEventListener('click', () => { state.selected = new Set([...Array(state.pdfLibDoc.getPageCount()).keys()]); updateGrid(); });
btnDeselect.addEventListener('click',  () => { state.selected.clear(); updateGrid(); });
btnClear.addEventListener('click', reset);
btnAgain.addEventListener('click', reset);
btnApply.addEventListener('click', apply);

async function loadFile(file) {
  if (!file || file.type !== 'application/pdf') { toast('Please upload a PDF file.', true); return; }
  state.srcBytes   = await file.arrayBuffer();
  state.pdfLibDoc  = await PDFDocument.load(state.srcBytes);
  state.pdfJsDoc   = await pdfjsLib.getDocument({ data: state.srcBytes.slice() }).promise;
  state.selected.clear();
  const n = state.pdfLibDoc.getPageCount();
  dropzone.style.display = 'none';
  fileInfo.textContent = `${file.name} · ${n} pages`;
  await buildGrid(n);
  editorArea.style.display = 'block';
  actionBar.style.display  = 'flex';
}

async function buildGrid(total) {
  pageGrid.innerHTML = '';
  for (let i = 0; i < total; i++) {
    const thumb = document.createElement('div');
    thumb.className = 'page-thumb'; thumb.dataset.idx = i;
    thumb.style.animationDelay = (i * 0.03) + 's';

    const canvas = document.createElement('canvas');
    const overlay = document.createElement('div');
    overlay.className = 'page-thumb__overlay'; overlay.textContent = '🗑';
    const footer = document.createElement('div');
    footer.className = 'page-thumb__footer'; footer.textContent = `Page ${i + 1}`;

    thumb.append(canvas, overlay, footer);
    pageGrid.appendChild(thumb);

    // Render page thumbnail
    const page = await state.pdfJsDoc.getPage(i + 1);
    const vp   = page.getViewport({ scale: 0.4 });
    canvas.width  = vp.width; canvas.height = vp.height;
    page.render({ canvasContext: canvas.getContext('2d'), viewport: vp });

    thumb.addEventListener('click', () => {
      if (state.selected.has(i)) state.selected.delete(i); else state.selected.add(i);
      updateGrid();
    });
  }
}

function updateGrid() {
  const n = state.pdfLibDoc.getPageCount();
  document.querySelectorAll('.page-thumb').forEach(thumb => {
    const idx = +thumb.dataset.idx;
    thumb.classList.toggle('selected', state.selected.has(idx));
  });
  const s = state.selected.size;
  toolHint.textContent = `${s} page${s !== 1 ? 's' : ''} marked for deletion`;
  btnApply.disabled = s === 0 || s === n;
  if (s === n) { toolHint.textContent += ' (cannot delete all pages)'; }
}

async function apply() {
  if (state.selected.size === 0) { toast('Select at least one page to delete.', true); return; }
  setProgress(10, 'Processing…');
  progressWrap.classList.add('visible');
  resultArea.classList.remove('visible');
  btnApply.disabled = true;

  try {
    const outDoc = await PDFDocument.create();
    const total  = state.pdfLibDoc.getPageCount();
    const keepIndices = [...Array(total).keys()].filter(i => !state.selected.has(i));
    const pages  = await outDoc.copyPages(state.pdfLibDoc, keepIndices);
    pages.forEach(p => outDoc.addPage(p));
    setProgress(80, 'Saving…');
    const bytes = await outDoc.save();
    const blob  = new Blob([bytes], { type: 'application/pdf' });
    btnDownload.href = URL.createObjectURL(blob);
    resultMeta.textContent = `${state.selected.size} page${state.selected.size !== 1 ? 's' : ''} removed · ${keepIndices.length} remaining · ${fmt(blob.size)}`;
    setProgress(100, 'Done!');
    await sleep(300);
    progressWrap.classList.remove('visible');
    resultArea.classList.add('visible');
    resultArea.scrollIntoView({ behavior: 'smooth', block: 'center' });
  } catch (e) {
    toast('Failed to delete pages: ' + e.message, true);
    progressWrap.classList.remove('visible');
    btnApply.disabled = false;
  }
}

function reset() {
  Object.assign(state, { srcBytes: null, pdfLibDoc: null, pdfJsDoc: null, selected: new Set() });
  fileInput.value = ''; pageGrid.innerHTML = '';
  dropzone.style.display = 'block'; editorArea.style.display = 'none';
  actionBar.style.display = 'none'; progressWrap.classList.remove('visible'); resultArea.classList.remove('visible');
}

function setProgress(pct, label) { progressBar.style.width = pct + '%'; progressText.textContent = label; progressPct.textContent = pct + '%'; }
function fmt(b) { return b < 1048576 ? (b/1024).toFixed(1)+' KB' : (b/1048576).toFixed(2)+' MB'; }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function toast(msg, err = false) {
  document.querySelector('.ct-toast')?.remove();
  const el = document.createElement('div');
  el.className = 'ct-toast' + (err ? ' ct-toast--error' : '');
  el.textContent = msg; document.body.appendChild(el);
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('show')));
  setTimeout(() => { el.classList.remove('show'); el.addEventListener('transitionend', () => el.remove(), { once: true }); }, 3500);
}
