'use strict';
const API_URL = 'https://toolbox-backend-76dc.onrender.com/convert/pptx-to-pdf';

const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('file-input');
const actionBar = document.getElementById('action-bar');
const fileInfo = document.getElementById('file-info');
const btnConvert = document.getElementById('btn-convert');
const progressWrap = document.getElementById('progress-wrap');
const resultArea = document.getElementById('result-area');
const btnDownload = document.getElementById('btn-download');
const btnAgain = document.getElementById('btn-again');
const resultMeta = document.getElementById('result-meta');

let selectedFiles = [];

dropzone.addEventListener('dragover', e => { e.preventDefault(); dropzone.classList.add('drag-over'); });
dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag-over'));
dropzone.addEventListener('drop', e => { e.preventDefault(); dropzone.classList.remove('drag-over'); addFiles([...e.dataTransfer.files]); });
fileInput.addEventListener('change', () => addFiles([...fileInput.files]));
btnAgain.addEventListener('click', reset);

function addFiles(files) {
  if (!files.length) return;
  selectedFiles = files;
  dropzone.style.display = 'none';
  actionBar.style.display = 'flex';
  const validCount = files.filter(f => /\.(ppt|pptx)$/i.test(f.name)).length;
  const otherCount = files.length - validCount;
  let label = `${files.length} file${files.length !== 1 ? 's' : ''} selected`;
  if (otherCount > 0) label += ` · ${otherCount} non-PowerPoint will be returned as-is`;
  fileInfo.textContent = label;
}

btnConvert.addEventListener('click', async () => {
  if (!selectedFiles.length) return;
  actionBar.style.display = 'none';
  progressWrap.classList.add('visible');

  let progress = 0;
  document.getElementById('progress-bar').style.width = '0%';
  document.getElementById('progress-pct').textContent = '0%';
  const progressInterval = setInterval(() => {
    progress += (95 - progress) * 0.05;
    document.getElementById('progress-bar').style.width = `${progress}%`;
    document.getElementById('progress-pct').textContent = `${Math.round(progress)}%`;
  }, 200);

  const formData = new FormData();
  selectedFiles.forEach(f => formData.append('files', f));
  try {
    const res = await fetch(API_URL, { method: 'POST', body: formData });
    if (!res.ok) throw new Error(await res.text());
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const cd = res.headers.get('Content-Disposition') || '';
    let fname = cd.match(/filename="?([^"]+)"?/)?.[1];
    if (!fname) fname = selectedFiles.length === 1 ? selectedFiles[0].name.replace(/\.pptx?$/i, '.pdf') : 'converted_presentations.zip';
    btnDownload.href = url; btnDownload.download = fname;
    btnDownload.textContent = `⬇ Download ${selectedFiles.length > 1 ? 'ZIP' : 'PDF'}`;
    resultMeta.textContent = `${selectedFiles.length} file${selectedFiles.length !== 1 ? 's' : ''} processed · ${fmt(blob.size)}`;
    
    clearInterval(progressInterval);
    document.getElementById('progress-bar').style.width = '100%';
    document.getElementById('progress-pct').textContent = '100%';
    await new Promise(r => setTimeout(r, 400));
    
    progressWrap.classList.remove('visible');
    resultArea.classList.add('visible');
    resultArea.scrollIntoView({ behavior: 'smooth', block: 'center' });
  } catch (err) {
    console.error(err);
    toast('Conversion failed. Ensure the backend is running.', true);
    clearInterval(progressInterval);
    progressWrap.classList.remove('visible');
    actionBar.style.display = 'flex';
  }
});

function reset() {
  selectedFiles = []; fileInput.value = '';
  dropzone.style.display = 'block'; actionBar.style.display = 'none';
  resultArea.classList.remove('visible'); progressWrap.classList.remove('visible');
}
function fmt(b) { return b < 1048576 ? (b/1024).toFixed(1)+' KB' : (b/1048576).toFixed(2)+' MB'; }
function toast(msg, err = false) {
  document.querySelector('.ct-toast')?.remove();
  const el = document.createElement('div');
  el.className = 'ct-toast' + (err ? ' ct-toast--error' : '');
  el.textContent = msg; document.body.appendChild(el);
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('show')));
  setTimeout(() => { el.classList.remove('show'); el.addEventListener('transitionend', () => el.remove(), { once: true }); }, 3500);
}
