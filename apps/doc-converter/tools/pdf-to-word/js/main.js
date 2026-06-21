'use strict';

// Change to your deployed backend URL in production
const API_URL = 'https://chronos-toolbox.onrender.com/convert/pdf-to-word';

const dropzone    = document.getElementById('dropzone');
const fileInput   = document.getElementById('file-input');
const actionBar   = document.getElementById('action-bar');
const fileInfo    = document.getElementById('file-info');
const btnConvert  = document.getElementById('btn-convert');
const progressWrap= document.getElementById('progress-wrap');
const resultArea  = document.getElementById('result-area');
const btnDownload = document.getElementById('btn-download');
const btnAgain    = document.getElementById('btn-again');
const resultMeta  = document.getElementById('result-meta');

let selectedFiles = [];

// ── Drag & Drop ─────────────────────────────────────────────────
dropzone.addEventListener('dragover', e => { e.preventDefault(); dropzone.classList.add('drag-over'); });
dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag-over'));
dropzone.addEventListener('drop', e => {
  e.preventDefault(); dropzone.classList.remove('drag-over');
  addFiles([...e.dataTransfer.files]);
});
fileInput.addEventListener('change', () => addFiles([...fileInput.files]));

function addFiles(files) {
  if (!files.length) return;
  selectedFiles = files; // replace selection each time
  dropzone.style.display = 'none';
  actionBar.style.display = 'flex';
  const pdfCount  = files.filter(f => f.name.toLowerCase().endsWith('.pdf')).length;
  const otherCount = files.length - pdfCount;
  let label = `${files.length} file${files.length !== 1 ? 's' : ''} selected`;
  if (otherCount > 0) label += ` · ${otherCount} non-PDF will be returned as-is`;
  fileInfo.textContent = label;
}

btnAgain.addEventListener('click', reset);

function reset() {
  selectedFiles = [];
  fileInput.value = '';
  dropzone.style.display = 'block';
  actionBar.style.display = 'none';
  resultArea.classList.remove('visible');
  progressWrap.classList.remove('visible');
}

// ── Convert ─────────────────────────────────────────────────────
btnConvert.addEventListener('click', async () => {
  if (!selectedFiles.length) return;

  actionBar.style.display = 'none';
  progressWrap.classList.add('visible');

  const formData = new FormData();
  selectedFiles.forEach(f => formData.append('files', f));

  try {
    const response = await fetch(API_URL, { method: 'POST', body: formData });
    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Server error ${response.status}: ${err}`);
    }

    const blob = await response.blob();
    const url  = URL.createObjectURL(blob);

    // Determine filename from Content-Disposition or fallback
    const cd  = response.headers.get('Content-Disposition') || '';
    let fname = cd.match(/filename="?([^"]+)"?/)?.[1];
    if (!fname) {
      fname = selectedFiles.length === 1
        ? selectedFiles[0].name.replace(/\.pdf$/i, '.docx')
        : 'converted_to_word.zip';
    }

    btnDownload.href = url;
    btnDownload.download = fname;
    btnDownload.textContent = `⬇ Download ${selectedFiles.length > 1 ? 'ZIP' : 'Word File'}`;
    resultMeta.textContent = `${selectedFiles.length} file${selectedFiles.length !== 1 ? 's' : ''} processed · ${fmt(blob.size)}`;
    progressWrap.classList.remove('visible');
    resultArea.classList.add('visible');
    resultArea.scrollIntoView({ behavior: 'smooth', block: 'center' });
  } catch (err) {
    console.error(err);
    toast('Conversion failed. Make sure the backend server is running.', true);
    progressWrap.classList.remove('visible');
    actionBar.style.display = 'flex';
  }
});

// ── Utils ────────────────────────────────────────────────────────
function fmt(bytes) {
  return bytes < 1048576 ? (bytes / 1024).toFixed(1) + ' KB' : (bytes / 1048576).toFixed(2) + ' MB';
}
function toast(msg, err = false) {
  document.querySelector('.ct-toast')?.remove();
  const el = document.createElement('div');
  el.className = 'ct-toast' + (err ? ' ct-toast--error' : '');
  el.textContent = msg;
  document.body.appendChild(el);
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('show')));
  setTimeout(() => { el.classList.remove('show'); el.addEventListener('transitionend', () => el.remove(), { once: true }); }, 3500);
}
