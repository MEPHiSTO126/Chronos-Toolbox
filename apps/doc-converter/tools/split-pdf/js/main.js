'use strict';
const { PDFDocument } = PDFLib;

const state = { file: null, srcDoc: null };

const dropzone     = document.getElementById('dropzone');
const fileInput    = document.getElementById('file-input');
const optionsPanel = document.getElementById('options-panel');
const optMode      = document.getElementById('opt-mode');
const rangeGroup   = document.getElementById('range-group');
const optRange     = document.getElementById('opt-range');
const actionBar    = document.getElementById('action-bar');
const btnSplit     = document.getElementById('btn-split');
const btnClear     = document.getElementById('btn-clear');
const fileInfo     = document.getElementById('file-info');
const progressWrap = document.getElementById('progress-wrap');
const progressBar  = document.getElementById('progress-bar');
const progressText = document.getElementById('progress-text');
const progressPct  = document.getElementById('progress-pct');
const resultArea   = document.getElementById('result-area');
const resultMeta   = document.getElementById('result-meta');
const btnDownload  = document.getElementById('btn-download');
const btnAgain     = document.getElementById('btn-again');

dropzone.addEventListener('dragover', e => { e.preventDefault(); dropzone.classList.add('drag-over'); });
dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag-over'));
dropzone.addEventListener('drop', e => { e.preventDefault(); dropzone.classList.remove('drag-over'); loadFile(e.dataTransfer.files[0]); });
fileInput.addEventListener('change', () => loadFile(fileInput.files[0]));
optMode.addEventListener('change', () => { rangeGroup.style.display = optMode.value === 'range' ? 'flex' : 'none'; });
btnClear.addEventListener('click', reset);
btnSplit.addEventListener('click', split);
btnAgain.addEventListener('click', reset);

async function loadFile(file) {
  if (!file || file.type !== 'application/pdf') { toast('Please upload a PDF file.', true); return; }
  state.file = file;
  const buf = await file.arrayBuffer();
  state.srcDoc = await PDFDocument.load(buf);
  const n = state.srcDoc.getPageCount();
  dropzone.style.display = 'none';
  optionsPanel.style.display = 'block';
  actionBar.style.display = 'flex';
  fileInfo.textContent = `${file.name} · ${n} page${n !== 1 ? 's' : ''}`;
}

// Parse "1-3, 5, 7-9" → 0-indexed sorted array
function parseRange(str, total) {
  const indices = new Set();
  for (const part of str.split(',').map(p => p.trim())) {
    if (!part) continue;
    if (part.includes('-')) {
      let [a, b] = part.split('-').map(Number);
      a = Math.max(1, a); b = Math.min(total, b);
      for (let i = a; i <= b; i++) indices.add(i - 1);
    } else {
      const n = Number(part);
      if (n >= 1 && n <= total) indices.add(n - 1);
    }
  }
  return [...indices].sort((a, b) => a - b);
}

async function split() {
  const srcDoc = state.srcDoc;
  const total  = srcDoc.getPageCount();
  const mode   = optMode.value;
  let pageSets = [];

  if (mode === 'all') {
    for (let i = 0; i < total; i++) pageSets.push({ name: `page_${String(i + 1).padStart(3, '0')}.pdf`, indices: [i] });
  } else {
    const indices = parseRange(optRange.value, total);
    if (!indices.length) { toast('No valid pages in that range.', true); return; }
    pageSets.push({ name: `extracted.pdf`, indices });
  }

  btnSplit.disabled = true;
  progressWrap.classList.add('visible');
  resultArea.classList.remove('visible');

  if (pageSets.length === 1) {
    // Single output → return PDF directly
    setProgress(30, 'Extracting pages…');
    const outDoc = await PDFDocument.create();
    const pages  = await outDoc.copyPages(srcDoc, pageSets[0].indices);
    pages.forEach(p => outDoc.addPage(p));
    setProgress(80, 'Saving…');
    const bytes = await outDoc.save();
    const blob  = new Blob([bytes], { type: 'application/pdf' });
    btnDownload.href = URL.createObjectURL(blob);
    btnDownload.download = pageSets[0].name;
    btnDownload.textContent = '⬇ Download PDF';
    resultMeta.textContent = `${pageSets[0].indices.length} page${pageSets[0].indices.length !== 1 ? 's' : ''} · ${fmt(blob.size)}`;
  } else {
    // Multiple pages → ZIP
    const zip = new JSZip();
    for (let i = 0; i < pageSets.length; i++) {
      setProgress(Math.round((i / pageSets.length) * 88), `Creating page ${i + 1} of ${pageSets.length}…`);
      const outDoc = await PDFDocument.create();
      const [pg]   = await outDoc.copyPages(srcDoc, pageSets[i].indices);
      outDoc.addPage(pg);
      const bytes  = await outDoc.save();
      zip.file(pageSets[i].name, bytes);
      await sleep(1);
    }
    setProgress(95, 'Zipping…');
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    btnDownload.href = URL.createObjectURL(zipBlob);
    btnDownload.download = `${state.file.name.replace('.pdf', '')}_pages.zip`;
    btnDownload.textContent = '⬇ Download ZIP';
    resultMeta.textContent = `${pageSets.length} pages · ${fmt(zipBlob.size)}`;
  }

  setProgress(100, 'Done!');
  await sleep(300);
  progressWrap.classList.remove('visible');
  resultArea.classList.add('visible');
  resultArea.scrollIntoView({ behavior: 'smooth', block: 'center' });
  btnSplit.disabled = false;
}

function reset() {
  state.file = null; state.srcDoc = null;
  fileInput.value = '';
  dropzone.style.display = 'block';
  optionsPanel.style.display = 'none';
  actionBar.style.display = 'none';
  progressWrap.classList.remove('visible');
  resultArea.classList.remove('visible');
}

function setProgress(pct, label) {
  progressBar.style.width = pct + '%';
  progressText.textContent = label;
  progressPct.textContent  = pct + '%';
}
function fmt(bytes) { return bytes < 1048576 ? (bytes / 1024).toFixed(1) + ' KB' : (bytes / 1048576).toFixed(2) + ' MB'; }
function sleep(ms)  { return new Promise(r => setTimeout(r, ms)); }
function toast(msg, err = false) {
  document.querySelector('.ct-toast')?.remove();
  const el = document.createElement('div');
  el.className = 'ct-toast' + (err ? ' ct-toast--error' : '');
  el.textContent = msg;
  document.body.appendChild(el);
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('show')));
  setTimeout(() => { el.classList.remove('show'); el.addEventListener('transitionend', () => el.remove(), { once: true }); }, 3500);
}
