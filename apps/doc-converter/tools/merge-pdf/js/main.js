'use strict';
const { PDFDocument } = PDFLib;

const state = { files: [], dragSrcIdx: null };

const dropzone    = document.getElementById('dropzone');
const fileInput   = document.getElementById('file-input');
const addMoreInput= document.getElementById('add-more-input');
const btnAddMore  = document.getElementById('btn-add-more');
const previewArea = document.getElementById('preview-area');
const fileList    = document.getElementById('pdf-file-list');
const previewLabel= document.getElementById('preview-label');
const actionBar   = document.getElementById('action-bar');
const btnMerge    = document.getElementById('btn-merge');
const btnClear    = document.getElementById('btn-clear');
const fileCount   = document.getElementById('file-count');
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
dropzone.addEventListener('drop', e => { e.preventDefault(); dropzone.classList.remove('drag-over'); addFiles([...e.dataTransfer.files]); });
fileInput.addEventListener('change', () => addFiles([...fileInput.files]));
btnAddMore.addEventListener('click', () => addMoreInput.click());
addMoreInput.addEventListener('change', () => addFiles([...addMoreInput.files]));
btnClear.addEventListener('click', clearAll);
btnMerge.addEventListener('click', merge);
btnAgain.addEventListener('click', clearAll);

function addFiles(files) {
  const pdfs = files.filter(f => f.type === 'application/pdf');
  if (!pdfs.length) { toast('Please upload PDF files only.', true); return; }
  state.files.push(...pdfs);
  render();
  previewArea.style.display = 'block';
  actionBar.style.display = 'flex';
}

function render() {
  fileList.innerHTML = '';
  state.files.forEach((file, i) => {
    const item = document.createElement('div');
    item.className = 'pdf-file-item';
    item.draggable = true;
    item.dataset.idx = i;
    item.innerHTML = `
      <span class="pdf-file-item__drag" aria-hidden="true">⠿</span>
      <span class="pdf-file-item__num">${i + 1}</span>
      <span class="pdf-file-item__name" title="${file.name}">${file.name}</span>
      <span class="pdf-file-item__size">${fmt(file.size)}</span>
      <button class="pdf-file-item__remove" data-idx="${i}" title="Remove" aria-label="Remove ${file.name}">✕</button>
    `;
    item.addEventListener('dragstart', () => { state.dragSrcIdx = i; item.classList.add('dragging'); });
    item.addEventListener('dragend',   () => item.classList.remove('dragging'));
    item.addEventListener('dragover',  e => { e.preventDefault(); item.classList.add('drag-target'); });
    item.addEventListener('dragleave', () => item.classList.remove('drag-target'));
    item.addEventListener('drop', e => {
      e.preventDefault(); item.classList.remove('drag-target');
      if (state.dragSrcIdx === i) return;
      const [moved] = state.files.splice(state.dragSrcIdx, 1);
      state.files.splice(i, 0, moved);
      render();
    });
    fileList.appendChild(item);
  });
  fileList.querySelectorAll('.pdf-file-item__remove').forEach(btn => {
    btn.addEventListener('click', () => {
      state.files.splice(+btn.dataset.idx, 1);
      if (!state.files.length) { clearAll(); return; }
      render();
    });
  });
  const n = state.files.length;
  previewLabel.textContent = `${n} file${n !== 1 ? 's' : ''} · drag to reorder`;
  fileCount.textContent = `${n} PDF${n !== 1 ? 's' : ''} selected`;
  btnMerge.disabled = n < 2;
}

async function merge() {
  if (state.files.length < 2) return;
  btnMerge.disabled = true;
  progressWrap.classList.add('visible');
  resultArea.classList.remove('visible');
  setProgress(0, 'Starting…');
  await sleep(50);

  const merged = await PDFDocument.create();

  for (let i = 0; i < state.files.length; i++) {
    setProgress(Math.round((i / state.files.length) * 90), `Adding "${state.files[i].name}"…`);
    const buf = await state.files[i].arrayBuffer();
    const src = await PDFDocument.load(buf);
    const pages = await merged.copyPages(src, src.getPageIndices());
    pages.forEach(p => merged.addPage(p));
    await sleep(10);
  }

  setProgress(95, 'Saving PDF…');
  const bytes = await merged.save();
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url  = URL.createObjectURL(blob);
  btnDownload.href = url;
  btnDownload.download = 'merged.pdf';
  resultMeta.textContent = `${merged.getPageCount()} pages · ${fmt(blob.size)}`;
  setProgress(100, 'Done!');
  await sleep(300);
  progressWrap.classList.remove('visible');
  resultArea.classList.add('visible');
  resultArea.scrollIntoView({ behavior: 'smooth', block: 'center' });
  btnMerge.disabled = false;
}

function clearAll() {
  state.files = [];
  fileInput.value = ''; addMoreInput.value = '';
  fileList.innerHTML = '';
  previewArea.style.display = 'none';
  actionBar.style.display = 'none';
  progressWrap.classList.remove('visible');
  resultArea.classList.remove('visible');
}

function setProgress(pct, label) {
  progressBar.style.width = pct + '%';
  progressText.textContent = label;
  progressPct.textContent  = pct + '%';
}

function fmt(bytes) {
  return bytes < 1048576 ? (bytes / 1024).toFixed(1) + ' KB' : (bytes / 1048576).toFixed(2) + ' MB';
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function toast(msg, err = false) {
  document.querySelector('.ct-toast')?.remove();
  const el = document.createElement('div');
  el.className = 'ct-toast' + (err ? ' ct-toast--error' : '');
  el.textContent = msg;
  document.body.appendChild(el);
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('show')));
  setTimeout(() => { el.classList.remove('show'); el.addEventListener('transitionend', () => el.remove(), { once: true }); }, 3500);
}
