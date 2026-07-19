'use strict';

const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const BASE_URL = isLocal ? 'http://localhost:8000' : 'https://toolbox-backend-76dc.onrender.com';
const API_URL = `${BASE_URL}/convert/compress-pdf`;

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

function validateFiles(files, acceptedExtensions) {
  const valid = [];
  const rejected = [];
  for (const f of files) {
    const ext = '.' + f.name.split('.').pop().toLowerCase();
    if (acceptedExtensions.includes(ext)) {
      valid.push(f);
    } else {
      rejected.push(f.name);
    }
  }
  if (rejected.length > 0) {
    toast(`Rejected: ${rejected.join(', ')}. Only ${acceptedExtensions.join(', ')} files are supported.`, true);
  }
  return valid;
}

function addFiles(files) {
  if (!files.length) return;
  const validFiles = validateFiles(files, ['.pdf']);
  if (!validFiles.length) return;
  selectedFiles = validFiles;
  dropzone.style.display = 'none';
  actionBar.style.display = 'flex';
  fileInfo.textContent = `${validFiles.length} file${validFiles.length !== 1 ? 's' : ''} selected`;
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
  const pText = document.getElementById('progress-text');
  
  if (pText) {
    pText.textContent = 'Waking up the server (this may take up to a minute)...';
  }

  for (let attempt = 1; attempt <= 30; attempt++) {
    try {
      const response = await fetch(`${origin}/`, { method: 'GET' });
      
      if (response.ok) {
        if (pText) pText.textContent = 'Server ready. Starting conversion...';
        return true;
      }
    } catch (e) {
      console.warn(`Wake attempt ${attempt} failed:`, e);
    }
    
    const waitTime = Math.min(2000 + attempt * 200, 10000);
    await new Promise(r => setTimeout(r, waitTime));
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

  let progressInterval = null;
  const __handleProgress = (phase, loaded, total) => {
    const pBar = document.getElementById('progress-bar') || document.querySelector('.progress-bar-fill');
    const pPct = document.getElementById('progress-pct');
    const pTxt = document.getElementById('progress-text');
    if (phase === 'upload') {
      const pct = (loaded / total) * 50;
      if (pBar) pBar.style.width = `${pct}%`;
      if (pPct) pPct.textContent = `${Math.round(pct)}%`;
      if (pTxt) pTxt.textContent = 'Uploading...';
      
      if (loaded === total) {
        let procPct = 50;
        if (pTxt) pTxt.textContent = 'Processing on server (depends on file size)...';
        if (progressInterval) clearInterval(progressInterval);
        progressInterval = setInterval(() => {
          procPct += (95 - procPct) * 0.05;
          if (pBar) pBar.style.width = `${procPct}%`;
          if (pPct) pPct.textContent = `${Math.round(procPct)}%`;
        }, 300);
      }
    }
  };

  const formData = new FormData();
  selectedFiles.forEach(f => formData.append('files', f));

  try {
    const awake = await ensureBackendAwake();
    if (!awake) {
      throw new Error('Backend server did not wake up in time.');
    }

    const response = await doFetchWithProgress(API_URL, { method: 'POST', body: formData }, __handleProgress);
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
        ? selectedFiles[0].name.replace(/\.pdf$/i, '_compressed.pdf')
        : 'compressed_pdfs.zip';
    }

    btnDownload.href = url;
    btnDownload.download = fname;
    btnDownload.textContent = `⬇ Download ${selectedFiles.length > 1 ? 'ZIP' : 'Compressed PDF File'}`;
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

// ── XHR Progress Wrapper ───────────────────────────────────────
async function doFetchWithProgress(url, options, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(options.method || 'GET', url);
    if (options.headers) {
      for (const [k, v] of Object.entries(options.headers)) xhr.setRequestHeader(k, v);
    }
    xhr.upload.onprogress = e => {
      if (e.lengthComputable) onProgress('upload', e.loaded, e.total);
    };
    xhr.onload = () => {
      const response = {
        ok: xhr.status >= 200 && xhr.status < 300,
        status: xhr.status,
        text: async () => await xhr.response.text(),
        json: async () => JSON.parse(await xhr.response.text()),
        blob: async () => xhr.response,
        headers: { get: (name) => xhr.getResponseHeader(name) }
      };
      resolve(response);
    };
    xhr.onerror = () => reject(new Error('Network error'));
    xhr.responseType = 'blob';
    xhr.send(options.body);
  });
}
