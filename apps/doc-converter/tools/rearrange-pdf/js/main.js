'use strict';
const { PDFDocument } = PDFLib;
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

const state = { srcBytes: null, pdfLibDoc: null, pdfJsDoc: null, order: [], dragSrcIdx: null };

const dropzone    = document.getElementById('dropzone');
const fileInput   = document.getElementById('file-input');
const editorArea  = document.getElementById('editor-area');
const pageGrid    = document.getElementById('page-grid');
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
btnClear.addEventListener('click', reset);
btnAgain.addEventListener('click', reset);
btnApply.addEventListener('click', apply);

async function loadFile(file) {
  if (!file || file.type !== 'application/pdf') { toast('Please upload a PDF file.', true); return; }
  state.srcBytes  = await file.arrayBuffer();
  state.pdfLibDoc = await PDFDocument.load(state.srcBytes);
  state.pdfJsDoc  = await pdfjsLib.getDocument({ data: state.srcBytes.slice() }).promise;
  const n = state.pdfLibDoc.getPageCount();
  state.order = [...Array(n).keys()]; // [0, 1, 2, ..., n-1]
  dropzone.style.display = 'none';
  fileInfo.textContent = `${file.name} · ${n} pages`;
  await buildGrid();
  editorArea.style.display = 'block';
  actionBar.style.display  = 'flex';
}

async function buildGrid() {
  pageGrid.innerHTML = '';
  for (let i = 0; i < state.order.length; i++) {
    const origIdx = state.order[i];
    const thumb   = makeDraggableThumb(i, origIdx);
    pageGrid.appendChild(thumb);
    // Render
    const page = await state.pdfJsDoc.getPage(origIdx + 1);
    const vp   = page.getViewport({ scale: 0.4 });
    const canvas = thumb.querySelector('canvas');
    canvas.width  = vp.width; canvas.height = vp.height;
    page.render({ canvasContext: canvas.getContext('2d'), viewport: vp });
  }
}

function makeDraggableThumb(position, origPage) {
  const thumb = document.createElement('div');
  thumb.className = 'page-thumb'; thumb.draggable = true; thumb.dataset.pos = position;
  thumb.style.animationDelay = (position * 0.03) + 's';

  const canvas  = document.createElement('canvas');
  const footer  = document.createElement('div');
  footer.className = 'page-thumb__footer';
  footer.innerHTML = `<span class="drag-icon">⠿</span> <span>pg ${origPage + 1}</span>`;

  thumb.append(canvas, footer);

  thumb.addEventListener('dragstart', () => { state.dragSrcIdx = position; setTimeout(() => thumb.classList.add('dragging'), 0); });
  thumb.addEventListener('dragend',   () => thumb.classList.remove('dragging'));
  thumb.addEventListener('dragover',  e => { e.preventDefault(); thumb.classList.add('drag-target'); });
  thumb.addEventListener('dragleave', () => thumb.classList.remove('drag-target'));
  thumb.addEventListener('drop', e => {
    e.preventDefault(); thumb.classList.remove('drag-target');
    const from = state.dragSrcIdx; const to = position;
    if (from === to) return;
    const [moved] = state.order.splice(from, 1);
    state.order.splice(to, 0, moved);
    buildGrid(); // re-render in new order
  });

  return thumb;
}

async function apply() {
  setProgress(10, 'Reordering pages…');
  progressWrap.classList.add('visible');
  resultArea.classList.remove('visible');
  btnApply.disabled = true;

  try {
    const outDoc = await PDFDocument.create();
    const pages  = await outDoc.copyPages(state.pdfLibDoc, state.order);
    pages.forEach(p => outDoc.addPage(p));
    setProgress(85, 'Saving…');
    const bytes = await outDoc.save();
    const blob  = new Blob([bytes], { type: 'application/pdf' });
    btnDownload.href = URL.createObjectURL(blob);
    resultMeta.textContent = `${state.order.length} pages · ${fmt(blob.size)}`;
    setProgress(100, 'Done!');
    await sleep(300);
    progressWrap.classList.remove('visible');
    resultArea.classList.add('visible');
    resultArea.scrollIntoView({ behavior: 'smooth', block: 'center' });
  } catch (e) {
    toast('Failed to rearrange PDF: ' + e.message, true);
    progressWrap.classList.remove('visible');
    btnApply.disabled = false;
  }
}

function reset() {
  Object.assign(state, { srcBytes:null, pdfLibDoc:null, pdfJsDoc:null, order:[], dragSrcIdx:null });
  fileInput.value = ''; pageGrid.innerHTML = '';
  dropzone.style.display='block'; editorArea.style.display='none';
  actionBar.style.display='none'; progressWrap.classList.remove('visible'); resultArea.classList.remove('visible');
}

function setProgress(pct, label) { progressBar.style.width=pct+'%'; progressText.textContent=label; progressPct.textContent=pct+'%'; }
function fmt(b) { return b < 1048576 ? (b/1024).toFixed(1)+' KB' : (b/1048576).toFixed(2)+' MB'; }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function toast(msg, err=false) {
  document.querySelector('.ct-toast')?.remove();
  const el = document.createElement('div');
  el.className='ct-toast'+(err?' ct-toast--error':''); el.textContent=msg; document.body.appendChild(el);
  requestAnimationFrame(()=>requestAnimationFrame(()=>el.classList.add('show')));
  setTimeout(()=>{ el.classList.remove('show'); el.addEventListener('transitionend',()=>el.remove(),{once:true}); },3500);
}
