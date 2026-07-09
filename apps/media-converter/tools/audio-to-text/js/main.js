/**
 * Chronos Toolbox — Audio to Text
 * Backend-integrated tool that transcribes speech using SpeechRecognition.
 */

// ── API URL configuration ────────────────────────────────
const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const BASE_URL = isLocal ? 'http://localhost:8000' : 'https://toolbox-backend-76dc.onrender.com';
const API_URL = `${BASE_URL}/media/audio-to-text`;

// ── DOM Elements ──────────────────────────────────────────
const dropzone             = document.getElementById('dropzone');
const fileInput            = document.getElementById('file-input');
const fileMetaContainer    = document.getElementById('file-meta-container');
const fileNameEl           = document.getElementById('file-name');
const fileSizeEl           = document.getElementById('file-size');
const audioPreview         = document.getElementById('audio-preview');
const btnRemove            = document.getElementById('btn-remove');
const actionBar            = document.getElementById('action-bar');
const btnTranscribe        = document.getElementById('btn-transcribe');
const progressWrap         = document.getElementById('progress-wrap');
const progressText         = document.getElementById('progress-text');
const progressPct          = document.getElementById('progress-pct');
const progressBar          = document.getElementById('progress-bar');
const resultArea           = document.getElementById('result-area');
const resultMeta           = document.getElementById('result-meta');
const transcriptContent    = document.getElementById('transcript-content');
const btnCopy              = document.getElementById('btn-copy');
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
  if (!file.type.startsWith('audio/')) {
    showToast('Please select a valid audio file.', true);
    return;
  }

  selectedFile = file;
  fileNameEl.textContent = file.name;
  fileSizeEl.textContent = formatBytes(file.size);
  audioPreview.src = URL.createObjectURL(file);

  dropzone.style.display = 'none';
  fileMetaContainer.style.display = 'flex';
  actionBar.style.display = 'flex';
  resultArea.classList.remove('visible');
}

function resetState() {
  selectedFile = null;
  fileInput.value = '';
  audioPreview.src = '';
  transcriptContent.value = '';
  if (btnDownload.href) {
    URL.revokeObjectURL(btnDownload.href);
    btnDownload.removeAttribute('href');
  }

  dropzone.style.display = 'block';
  fileMetaContainer.style.display = 'none';
  actionBar.style.display = 'none';
  progressWrap.classList.remove('visible');
  resultArea.classList.remove('visible');
}

// ── Wake-up Helper ──────────────────────────────────────────
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

// ── Transcribe Button Handler ────────────────────────────────
btnTranscribe.addEventListener('click', async () => {
  if (!selectedFile) return;

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
    const awake = await ensureBackendAwake();
    if (!awake) {
      throw new Error('Backend server did not wake up in time.');
    }

    const response = await doFetchWithProgress(API_URL, { method: 'POST', body: formData }, __handleProgress);
    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Server error ${response.status}: ${err}`);
    }

    const json = await response.json();
    const text = json.text || '';

    // Populate result
    transcriptContent.value = text;
    
    // Word count
    const words = text.split(/\s+/).filter(Boolean).length;
    resultMeta.textContent = `Word count: ${words} · Characters: ${text.length}`;

    // Set up TXT download
    const textBlob = new Blob([text], { type: 'text/plain' });
    const textUrl = URL.createObjectURL(textBlob);
    btnDownload.href = textUrl;
    btnDownload.download = selectedFile.name.replace(/\.[^/.]+$/, "") + "_transcript.txt";

    clearInterval(progressInterval);
    progressBar.style.width = '100%';
    progressPct.textContent = '100%';
    await new Promise(r => setTimeout(r, 400));

    progressWrap.classList.remove('visible');
    resultArea.classList.add('visible');
    showToast('Transcription successful!');
  } catch (err) {
    console.error(err);
    showToast(err.message || 'Failed to generate transcript.', true);
    clearInterval(progressInterval);
    progressWrap.classList.remove('visible');
    actionBar.style.display = 'flex';
  } finally {
    btnRemove.disabled = false;
  }
});

// ── Copy Text Event ──────────────────────────────────────────
btnCopy.addEventListener('click', async () => {
  const text = transcriptContent.value;
  if (!text) return;

  try {
    await navigator.clipboard.writeText(text);
    showToast('Transcript copied to clipboard!');
  } catch (err) {
    showToast('Failed to copy text. Please select and copy manually.', true);
  }
});

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
        blob: async () => xhr.response
      };
      resolve(response);
    };
    xhr.onerror = () => reject(new Error('Network error'));
    xhr.responseType = 'blob';
    xhr.send(options.body);
  });
}
