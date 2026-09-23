let activeAbortController = null;
/**
 * Chronos Toolbox — Compress Video
 * Backend-integrated tool that compresses video size using FFmpeg H.264 compression.
 */

// ── API URL configuration ────────────────────────────────
const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const BASE_URL = isLocal ? 'http://localhost:8000' : 'https://toolbox-backend-76dc.onrender.com';
const API_URL = `${BASE_URL}/media/compress-video`;

// ── DOM Elements ──────────────────────────────────────────
const dropzone             = document.getElementById('dropzone');
const fileInput            = document.getElementById('file-input');
const fileMetaContainer    = document.getElementById('file-meta-container');
const fileNameEl           = document.getElementById('file-name');
const fileSizeEl           = document.getElementById('file-size');
const btnRemove            = document.getElementById('btn-remove');
const optionsPanel         = document.getElementById('options-panel');
const compressPreset       = document.getElementById('compress-preset');
const actionBar            = document.getElementById('action-bar');
const btnCompress          = document.getElementById('btn-compress');
const progressWrap         = document.getElementById('progress-wrap');
const progressText         = document.getElementById('progress-text');
const progressPct          = document.getElementById('progress-pct');
const progressBar          = document.getElementById('progress-bar');
const resultArea           = document.getElementById('result-area');
const resultMeta           = document.getElementById('result-meta');
const videoResultPreview   = document.getElementById('video-result-preview');
const btnDownload          = document.getElementById('btn-download');
const btnAgain             = document.getElementById('btn-again');

// ── State ─────────────────────────────────────────────────
let selectedFile = null;

// ── Toast Helper ──────────────────────────────────────────
function showToast(message, isError = false) {
  const existingToast = document.querySelector('.ct-toast');
  if (existingToast) existingToast.remove();

  const toast = document.createElement('div');
  toast.className = `ct-toast ${isError ? 'ct-toast--error' : ''}`;
  toast.setAttribute("role", "status");
  toast.setAttribute("aria-live", "polite");
  toast.textContent = message;
  document.body.appendChild(toast);

  toast.offsetHeight;
  toast.classList.add('show');

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 3500);
  }, 3500);
}

// ── Format Helper ─────────────────────────────────────────
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// ── Event Listeners: Drag & Drop ──────────────────────────
['dragenter', 'dragover'].forEach(eventName => {
  dropzone.addEventListener(eventName, (e) => {
    e.preventDefault();
    dropzone.classList.add('drag-over');
  }, false);
});

['dragleave', 'drop'].forEach(eventName => {
  dropzone.addEventListener(eventName, (e) => {
    e.preventDefault();
    dropzone.classList.remove('drag-over');
  }, false);
});

dropzone.addEventListener('drop', (e) => {
  const dt = e.dataTransfer;
  const files = dt.files;
  if (files.length) handleFileSelect(files[0]);
});

fileInput.addEventListener('change', (e) => {
  if (e.target.files.length) handleFileSelect(e.target.files[0]);
});

btnRemove.addEventListener('click', resetState);
btnAgain.addEventListener('click', resetState);

// ── File Selection Handler ──────────────────────────────
function handleFileSelect(file) {
  const isVideo = file && (file.type.startsWith('video/') || /\.(mp4|mov|avi|mkv|webm|flv|wmv|m4v)$/i.test(file.name));
  if (!isVideo) {
    showToast('Please select a valid video file.', true);
    return;
  }

  selectedFile = file;
  fileNameEl.textContent = file.name;
  fileSizeEl.textContent = formatBytes(file.size);

  dropzone.style.display = 'none';
  fileMetaContainer.style.display = 'flex';
  optionsPanel.style.display = 'block';
  actionBar.style.display = 'flex';
  resultArea.classList.remove('visible');
}

function resetState() {
  selectedFile = null;
  fileInput.value = '';
  
  dropzone.style.display = 'flex';
  fileMetaContainer.style.display = 'none';
  optionsPanel.style.display = 'none';
  actionBar.style.display = 'none';
  progressWrap.classList.remove('visible');
  resultArea.classList.remove('visible');
  
  btnRemove.disabled = false;
  btnCompress.disabled = false;
  
  if (currentDownloadUrl) {
    URL.revokeObjectURL(currentDownloadUrl);
    currentDownloadUrl = null;
  }
}

// ── Backend Wake-up Checker ─────────────────────────────────
async function ensureBackendAwake(options = {}) {
  if (window.CHRONOS_API?.ensureBackendAwake) {
    return await window.CHRONOS_API.ensureBackendAwake(Object.assign({ url: API_URL, maxAttempts: 15 }, options));
  }
  const origin = typeof BASE_URL !== 'undefined' ? BASE_URL : new URL(API_URL).origin;
  const pText = document.getElementById('progress-text');
  if (pText) pText.textContent = 'Connecting to server (waking up if sleeping)...';

  for (let attempt = 1; attempt <= 15; attempt++) {
    if (options.signal?.aborted) throw new DOMException('Operation aborted by user', 'AbortError');
    try {
      const response = await fetch(`${origin}/`, { method: 'GET', signal: options.signal });
      if (response.ok) {
        if (pText) pText.textContent = 'Server ready. Processing...';
        return true;
      }
    } catch (e) {
      if (e.name === 'AbortError') throw e;
    }
    const waitTime = Math.min(1500 + attempt * 200, 3500);
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

// ── Compress Button Handler ──────────────────────────────────
btnCompress.addEventListener('click', async () => {
  if (activeAbortController) activeAbortController.abort();
  activeAbortController = new AbortController();
  const cancelBtn = document.getElementById('btn-cancel');
  if (cancelBtn) {
    cancelBtn.onclick = () => {
      if (activeAbortController) activeAbortController.abort();
    };
  }
  if (!selectedFile) return;

  const crfVal = compressPreset.value;

  actionBar.style.display = 'none';
  btnRemove.disabled = true;
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
  formData.append('file', selectedFile);

  try {
    const awake = await ensureBackendAwake({ signal: activeAbortController?.signal });
    if (!awake) {
      throw new Error('Backend server did not wake up in time.');
    }

    const requestUrl = `${API_URL}?crf=${crfVal}`;
    const response = await doFetchWithProgress(requestUrl, { method: 'POST', body: formData , signal: activeAbortController?.signal }, __handleProgress);
    if (!response.ok) {
      const errMsg = window.CHRONOS_API?.parseErrorResponse ? await window.CHRONOS_API.parseErrorResponse(response) : await response.text();
      throw new Error(errMsg);
    }

    const blob = await response.blob();
    if (btnDownload.href) { URL.revokeObjectURL(btnDownload.href); btnDownload.removeAttribute('href'); }
    const url = URL.createObjectURL(blob);

    // Update result card
    videoResultPreview.src = url;
    btnDownload.href = url;
    btnDownload.download = selectedFile.name.replace(/\.[^/.]+$/, "") + "_compressed.mp4";
    
    // Show original vs compressed percentage savings
    const diffPct = Math.round((1 - (blob.size / selectedFile.size)) * 100);
    const savingsLabel = diffPct > 0 ? ` · Saved ${diffPct}%` : '';
    resultMeta.textContent = `Original: ${formatBytes(selectedFile.size)} · Compressed: ${formatBytes(blob.size)}${savingsLabel}`;

    clearInterval(progressInterval);
    progressBar.style.width = '100%';
    progressPct.textContent = '100%';
    await new Promise(r => setTimeout(r, 400));

    progressWrap.classList.remove('visible');
    resultArea.classList.add('visible');
    showToast('Video compression successful!');
  } catch (err) {
    if (err.name === 'AbortError') {
      const toastFn = typeof toast === 'function' ? toast : (typeof showToast === 'function' ? showToast : alert);
      toastFn('Operation cancelled.', false);
      if (typeof progressInterval !== 'undefined' && progressInterval) clearInterval(progressInterval);
      progressWrap.classList.remove('visible');
      if (typeof actionBar !== 'undefined' && actionBar) actionBar.style.display = 'flex';
      if (typeof urlCard !== 'undefined' && urlCard) urlCard.style.display = 'block';
      return;
    }
    console.error(err);
    showToast(err.message || 'Failed to compress video.', true);
    clearInterval(progressInterval);
    progressWrap.classList.remove('visible');
    actionBar.style.display = 'flex';
  } finally {
    btnRemove.disabled = false;
  }
});

// ── XHR Progress Wrapper ───────────────────────────────────────
async function doFetchWithProgress(url, options, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    if (options.signal) {
      if (options.signal.aborted) {
        return reject(new DOMException('Operation aborted by user', 'AbortError'));
      }
      options.signal.addEventListener('abort', () => {
        xhr.abort();
        reject(new DOMException('Operation aborted by user', 'AbortError'));
      }, { once: true });
    }
    xhr.open(options.method || 'GET', url);
    if (options.headers) {
      for (const [k, v] of Object.entries(options.headers)) xhr.setRequestHeader(k, v);
    }
    xhr.upload.onprogress = e => {
      if (e.lengthComputable && onProgress) onProgress('upload', e.loaded, e.total);
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
    xhr.onabort = () => reject(new DOMException('Operation aborted by user', 'AbortError'));
    xhr.responseType = 'blob';
    xhr.send(options.body);
  });
}