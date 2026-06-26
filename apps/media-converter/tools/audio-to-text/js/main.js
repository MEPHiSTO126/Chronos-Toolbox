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
  const maxAttempts = 25;
  const delayMs = 3000;
  progressText.textContent = 'Waking up the server (this may take up to a minute)...';

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);
      await fetch(`${BASE_URL}/`, { method: 'GET', mode: 'no-cors', signal: controller.signal });
      clearTimeout(timeoutId);
      progressText.textContent = 'Uploading and transcribing speech...';
      return true;
    } catch (e) {
      console.warn(`Wake attempt ${attempt} failed:`, e);
    }
    if (attempt < maxAttempts) {
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
  return false;
}

// Preemptive wake trigger on page load
(async () => {
  try {
    await fetch(`${BASE_URL}/`, { method: 'GET', mode: 'no-cors' });
  } catch (e) {
    // Ignore error
  }
})();

// ── Transcribe Button Handler ────────────────────────────────
btnTranscribe.addEventListener('click', async () => {
  if (!selectedFile) return;

  actionBar.style.display = 'none';
  btnRemove.disabled = true;
  progressWrap.classList.add('visible');

  let progress = 0;
  progressBar.style.width = '0%';
  progressPct.textContent = '0%';
  const progressInterval = setInterval(() => {
    progress += (95 - progress) * 0.05;
    progressBar.style.width = `${progress}%`;
    progressPct.textContent = `${Math.round(progress)}%`;
  }, 200);

  const formData = new FormData();
  formData.append('file', selectedFile);

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
