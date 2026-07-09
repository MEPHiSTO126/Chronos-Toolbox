'use strict';

const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const BASE_URL = isLocal ? 'http://localhost:8000' : 'https://toolbox-backend-76dc.onrender.com';
const API_URL = `${BASE_URL}/convert/compress-word`;

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

// Drag & Drop
dropzone.addEventListener('dragover', e => { e.preventDefault(); dropzone.classList.add('drag-over'); });
dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag-over'));
dropzone.addEventListener('drop', e => {
  e.preventDefault(); dropzone.classList.remove('drag-over');
  addFiles([...e.dataTransfer.files]);
});
fileInput.addEventListener('change', () => addFiles([...fileInput.files]));

function addFiles(files) {
  if (!files.length) return;
  selectedFiles = files;
  dropzone.style.display = 'none';
  actionBar.style.display = 'flex';
  const docCount = files.filter(f => {
    const name = f.name.toLowerCase();
    return name.endsWith('.docx') || name.endsWith('.doc');
  }).length;
  const otherCount = files.length - docCount;
  let label = `${files.length} file${files.length !== 1 ? 's' : ''} selected`;
  if (otherCount > 0) label += ` · ${otherCount} non-Word will be skipped or returned as-is`;
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

// Wake-up Helper
async function ensureBackendAwake() {
  const origin = typeof BASE_URL !== 'undefined' ? BASE_URL : new URL(API_URL).origin;
  const progressText = document.getElementById('progress-text');
  
  if (progressText) {
    progressText.textContent = 'Waking up the server (this may take up to a minute)...';
  }

  for (let attempt = 1; attempt <= 15; attempt++) {
    try {
      // Allow fetch to take as long as needed (no short abort timeout)
      // Removed mode: 'no-cors' so we can accurately read the HTTP status
      const response = await fetch(`${origin}/`, { method: 'GET' });
      
      if (response.ok) {
        if (progressText) progressText.textContent = 'Uploading and processing...';
        return true;
      } else {
        console.warn(`Wake attempt ${attempt} returned status ${response.status}`);
      }
    } catch (e) {
      console.warn(`Wake attempt ${attempt} failed:`, e);
    }
    await new Promise(r => setTimeout(r, 3000));
  }
  return false;
}

// Initial preemptive wake trigger on page load
(async () => {
  try {
    const origin = typeof BASE_URL !== 'undefined' ? BASE_URL : new URL(API_URL).origin;
    await fetch(`${origin}/`, { method: 'GET' });
  } catch (e) {}
})();

// Convert
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
    const awake = await ensureBackendAwake();
    if (!awake) {
      throw new Error('Backend server did not wake up in time.');
    }

    const response = await fetch(API_URL, { method: 'POST', body: formData });
    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Server error ${response.status}: ${err}`);
    }

    const blob = await response.blob();
    const url  = URL.createObjectURL(blob);

    const cd  = response.headers.get('Content-Disposition') || '';
    let fname = cd.match(/filename="?([^"]+)"?/)?.[1];
    if (!fname) {
      fname = selectedFiles.length === 1
        ? selectedFiles[0].name.replace(/\.(docx|doc)$/i, '_compressed.$1')
        : 'compressed_documents.zip';
    }

    btnDownload.href = url;
    btnDownload.download = fname;
    btnDownload.textContent = `⬇ Download ${selectedFiles.length > 1 ? 'ZIP' : 'Compressed Word File'}`;
    resultMeta.textContent = `${selectedFiles.length} file${selectedFiles.length !== 1 ? 's' : ''} compressed · ${fmt(blob.size)}`;
    
    clearInterval(progressInterval);
    document.getElementById('progress-bar').style.width = '100%';
    document.getElementById('progress-pct').textContent = '100%';
    await new Promise(r => setTimeout(r, 400));
    
    progressWrap.classList.remove('visible');
    resultArea.classList.add('visible');
    resultArea.scrollIntoView({ behavior: 'smooth', block: 'center' });
  } catch (err) {
    console.error(err);
    toast('Compression failed. Make sure the backend server is running.', true);
    clearInterval(progressInterval);
    progressWrap.classList.remove('visible');
    actionBar.style.display = 'flex';
  }
});

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
