'use strict';
const { PDFDocument, degrees } = PDFLib;
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

const state = { srcBytes: null, pdfLibDoc: null, pdfJsDoc: null, rotations: [], selected: new Set() };

const dropzone    = document.getElementById('dropzone');
const fileInput   = document.getElementById('file-input');
const editorArea  = document.getElementById('editor-area');
const pageGrid    = document.getElementById('page-grid');
const selectHint  = document.getElementById('select-hint');
const btnSelAll   = document.getElementById('btn-select-all');
const btnDesel    = document.getElementById('btn-deselect');
const btnCW       = document.getElementById('btn-cw');
const btn180      = document.getElementById('btn-180');
const btnCCW      = document.getElementById('btn-ccw');
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

btnSelAll.addEventListener('click', () => { state.selected = new Set([...Array(state.rotations.length).keys()]); updateSelection(); });
btnDesel.addEventListener('click',  () => { state.selected.clear(); updateSelection(); });
btnCW.addEventListener('click',  () => rotate(90));
btn180.addEventListener('click', () => rotate(180));
btnCCW.addEventListener('click', () => rotate(270));
btnClear.addEventListener('click', reset);
btnAgain.addEventListener('click', reset);
btnApply.addEventListener('click', apply);

async function loadFile(file) {
  if (!file || file.type !== 'application/pdf') { toast('Please upload a PDF file.', true); return; }
  state.srcBytes  = await file.arrayBuffer();
  state.pdfLibDoc = await PDFDocument.load(state.srcBytes);
  state.pdfJsDoc  = await pdfjsLib.getDocument({ data: state.srcBytes.slice() }).promise;
  const n = state.pdfLibDoc.getPageCount();
  state.rotations = Array(n).fill(0);
  state.selected.clear();
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
    const footer = document.createElement('div');
    footer.className = 'page-thumb__footer';
    footer.innerHTML = `<span class="page-thumb__num">p${i+1}</span><span class="page-thumb__rot" id="rot-${i}">0°</span>`;

    thumb.append(canvas, footer);
    pageGrid.appendChild(thumb);

    const page = await state.pdfJsDoc.getPage(i + 1);
    const vp   = page.getViewport({ scale: 0.4 });
    canvas.width  = vp.width; canvas.height = vp.height;
    page.render({ canvasContext: canvas.getContext('2d'), viewport: vp });

    thumb.addEventListener('click', () => {
      if (state.selected.has(i)) state.selected.delete(i); else state.selected.add(i);
      updateSelection();
    });
  }
}

function updateSelection() {
  document.querySelectorAll('.page-thumb').forEach(t => {
    t.classList.toggle('selected', state.selected.has(+t.dataset.idx));
  });
  const s = state.selected.size;
  selectHint.textContent = `Click thumbnails to select · ${s} selected`;
}

function rotate(deg) {
  state.selected.forEach(i => {
    state.rotations[i] = (state.rotations[i] + deg) % 360;
    const label = document.getElementById(`rot-${i}`);
    if (label) label.textContent = state.rotations[i] === 0 ? '0°' : `+${state.rotations[i]}°`;
    // Visual CSS rotation preview
    const canvas = pageGrid.querySelectorAll('.page-thumb')[i]?.querySelector('canvas');
    if (canvas) canvas.style.transform = `rotate(${state.rotations[i]}deg)`;
  });
}

async function apply() {
  setProgress(10, 'Applying rotations…');
  progressWrap.classList.add('visible'); resultArea.classList.remove('visible'); btnApply.disabled = true;

  try {
    // Apply rotations to each page via pdf-lib
    const pages = state.pdfLibDoc.getPages();
    state.rotations.forEach((rot, i) => {
      if (rot !== 0) {
        const cur = pages[i].getRotation().angle;
        pages[i].setRotation(degrees((cur + rot) % 360));
      }
    });
    setProgress(80, 'Saving…');
    const bytes = await state.pdfLibDoc.save();
    const blob  = new Blob([bytes], { type: 'application/pdf' });
    btnDownload.href = URL.createObjectURL(blob);
    resultMeta.textContent = `${state.rotations.filter(r => r !== 0).length} pages rotated · ${fmt(blob.size)}`;
    setProgress(100, 'Done!');
    await sleep(300);
    progressWrap.classList.remove('visible'); resultArea.classList.add('visible');
    resultArea.scrollIntoView({ behavior: 'smooth', block: 'center' });
  } catch (e) {
    toast('Failed to rotate PDF: ' + e.message, true);
    progressWrap.classList.remove('visible');
    btnApply.disabled = false;
  }
}

function reset() {
  Object.assign(state, { srcBytes:null, pdfLibDoc:null, pdfJsDoc:null, rotations:[], selected:new Set() });
  fileInput.value=''; pageGrid.innerHTML='';
  dropzone.style.display='block'; editorArea.style.display='none';
  actionBar.style.display='none'; progressWrap.classList.remove('visible'); resultArea.classList.remove('visible');
}

function setProgress(pct, label) { progressBar.style.width=pct+'%'; progressText.textContent=label; progressPct.textContent=pct+'%'; }
function fmt(b) { return b<1048576?(b/1024).toFixed(1)+' KB':(b/1048576).toFixed(2)+' MB'; }
function sleep(ms) { return new Promise(r=>setTimeout(r,ms)); }
function toast(msg,err=false) {
  document.querySelector('.ct-toast')?.remove();
  const el=document.createElement('div');
  el.className='ct-toast'+(err?' ct-toast--error':''); el.textContent=msg; document.body.appendChild(el);
  requestAnimationFrame(()=>requestAnimationFrame(()=>el.classList.add('show')));
  setTimeout(()=>{ el.classList.remove('show'); el.addEventListener('transitionend',()=>el.remove(),{once:true}); },3500);
}
