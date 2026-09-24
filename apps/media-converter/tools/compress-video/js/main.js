let activeAbortController = null;
/**
 * Chronos Toolbox — Compress Video
 * Backend-integrated tool that compresses video size using FFmpeg H.264 compression.
 */

// ── API URL configuration ────────────────────────────────
const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const BASE_URL = isLocal ? 'http://localhost:8000' : 'https://toolbox-backend-ayd8.onrender.com';
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
let currentDownloadUrl = null;
// Must stay in sync with the backend MAX_FILE_SIZE (100 MB in main.py).
// Files above it are split in the browser and compressed piece by piece.
const MAX_FILE_SIZE = 100 * 1024 * 1024;
// Hard ceiling for the segmented path (browser memory limit).
const ABSOLUTE_MAX_FILE_SIZE = 1024 * 1024 * 1024;

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

  if (file.size > ABSOLUTE_MAX_FILE_SIZE) {
    showToast(`File is too large (${formatBytes(file.size)}). Files up to ${formatBytes(ABSOLUTE_MAX_FILE_SIZE)} are supported.`, true);
    return;
  }

  if (file.size > MAX_FILE_SIZE) {
    showToast(`Large file (${formatBytes(file.size)}): it will be split in your browser and compressed piece by piece, then reassembled. This takes longer and needs a one-time engine download.`, false);
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
  if (pText) pText.textContent = 'Connecting to server...';

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

  try {
    const awake = await ensureBackendAwake({ signal: activeAbortController?.signal });
    if (!awake) {
      throw new Error('Backend server did not wake up in time.');
    }

    // Small files go straight to the server. Large files are split in the
    // browser (ffmpeg.wasm, lossless copy), compressed piece by piece, then
    // reassembled — the backend never receives more than MAX_FILE_SIZE at once.
    let blob, segmentNote = '';
    if (selectedFile.size <= MAX_FILE_SIZE) {
      const formData = new FormData();
      formData.append('file', selectedFile);
      blob = await uploadAndCompress(formData, crfVal, __handleProgress);
    } else {
      if (progressInterval) clearInterval(progressInterval);
      const out = await compressSegmented(selectedFile, crfVal);
      blob = out.blob;
      segmentNote = ` · ${out.segments} segments`;
    }
    if (currentDownloadUrl) { URL.revokeObjectURL(currentDownloadUrl); currentDownloadUrl = null; }
    if (btnDownload.href) { btnDownload.removeAttribute('href'); }
    currentDownloadUrl = URL.createObjectURL(blob);
    const url = currentDownloadUrl;

    // Update result card
    videoResultPreview.src = url;
    btnDownload.href = url;
    btnDownload.download = selectedFile.name.replace(/\.[^/.]+$/, "") + "_compressed.mp4";
    
    // Show original vs compressed percentage savings
    const diffPct = Math.round((1 - (blob.size / selectedFile.size)) * 100);
    const savingsLabel = diffPct > 0 ? ` · Saved ${diffPct}%` : '';
    resultMeta.textContent = `Original: ${formatBytes(selectedFile.size)} · Compressed: ${formatBytes(blob.size)}${savingsLabel}${segmentNote}`;

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

// ── Shared upload helper (single request, 6-min client timeout) ──
async function uploadAndCompress(formData, crfVal, onProgress) {
  const requestUrl = `${API_URL}?crf=${crfVal}`;
  // 6-minute client timeout: video transcodes are slow, and the free-tier
  // server/proxy can take minutes or drop the connection. ontimeout/status-0
  // handlers in doFetchWithProgress turn that into a helpful message.
  const response = await doFetchWithProgress(requestUrl, { method: 'POST', body: formData, signal: activeAbortController?.signal, timeout: 360000 }, onProgress);
  if (!response.ok) {
    const errMsg = window.CHRONOS_API?.parseErrorResponse ? await window.CHRONOS_API.parseErrorResponse(response) : await response.text();
    throw new Error(errMsg);
  }
  return response.blob();
}

// ── Determinate progress (segmented flow) ────────────────────
function setProgress(pct, msg) {
  const pBar = document.getElementById('progress-bar') || document.querySelector('.progress-bar-fill');
  const pPct = document.getElementById('progress-pct');
  const pTxt = document.getElementById('progress-text');
  if (pBar) pBar.style.width = `${pct}%`;
  if (pPct) pPct.textContent = `${Math.round(pct)}%`;
  if (pTxt) pTxt.textContent = msg;
}

function throwIfAborted() {
  if (activeAbortController?.signal.aborted) throw new DOMException('Operation aborted by user', 'AbortError');
}

// ── In-browser engine (ffmpeg.wasm) for splitting large files ─
let ffmpegEngine = null;

function loadScriptOnce(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[data-ffsrc="${src}"]`)) return resolve();
    const s = document.createElement('script');
    s.src = src;
    s.dataset.ffsrc = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(s);
  });
}

// Single-thread core needs no cross-origin-isolation headers, so this works
// on plain static hosting. jsdelivr mirrors unpkg if it is unreachable.
const FFMPEG_CDNS = [
  {
    name: 'unpkg',
    ffmpeg: 'https://unpkg.com/@ffmpeg/ffmpeg@0.12.15/dist/umd/ffmpeg.js',
    core: 'https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm/ffmpeg-core.js',
    wasm: 'https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm/ffmpeg-core.wasm'
  },
  {
    name: 'jsdelivr',
    ffmpeg: 'https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.15/dist/umd/ffmpeg.js',
    core: 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm/ffmpeg-core.js',
    wasm: 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm/ffmpeg-core.wasm'
  }
];

async function getFFmpegEngine(onMsg) {
  if (ffmpegEngine) return ffmpegEngine;
  for (const cdn of FFMPEG_CDNS) {
    try {
      if (onMsg) onMsg(`Loading in-browser video engine via ${cdn.name} (one-time download, ~30 MB)...`);
      await loadScriptOnce(cdn.ffmpeg);
      const NS = window.FFmpegWASM || window.FFmpeg;
      const FFmpegClass = (NS && (NS.FFmpeg || NS.default)) || NS;
      if (typeof FFmpegClass !== 'function') throw new Error('engine init failed');
      const ff = new FFmpegClass();
      await ff.load({ coreURL: cdn.core, wasmURL: cdn.wasm });
      ffmpegEngine = ff;
      return ff;
    } catch (e) {
      console.warn(`ffmpeg engine load via ${cdn.name} failed:`, e);
    }
  }
  throw new Error('Could not load the in-browser video engine. Check your connection and try again. (Files under 100 MB do not need it.)');
}

function getVideoDuration(file) {
  return new Promise((resolve, reject) => {
    const v = document.createElement('video');
    v.preload = 'metadata';
    const done = (fn) => { URL.revokeObjectURL(v.src); fn(); };
    v.onloadedmetadata = () => done(() => resolve(v.duration));
    v.onerror = () => done(() => reject(new Error('unreadable')));
    v.src = URL.createObjectURL(file);
    setTimeout(() => reject(new Error('timeout')), 15000);
  });
}

// ── Segmented compression for files over MAX_FILE_SIZE ───────
async function compressSegmented(file, crfVal) {
  const ff = await getFFmpegEngine((m) => setProgress(3, m));
  throwIfAborted();

  const ext = ((file.name.match(/\.[^/.]+$/) || ['.mp4'])[0]).toLowerCase();
  const inName = 'input' + ext;
  setProgress(5, 'Reading video into the browser engine...');
  await ff.writeFile(inName, new Uint8Array(await file.arrayBuffer()));

  let duration = 0;
  try { duration = await getVideoDuration(file); } catch (e) { /* handled below */ }
  if (!duration || !isFinite(duration) || duration <= 0) {
    try { await ff.deleteFile(inName); } catch (e) {}
    throw new Error('Could not read this video\u2019s duration, so it cannot be split. Try a file under 100 MB.');
  }

  // Aim for ~70 MB pieces (safely under the 100 MB request cap).
  const TARGET_SEG = 70 * 1024 * 1024;
  const MAX_PARTS = 12;
  let segTime = Math.max(10, Math.floor(TARGET_SEG / (file.size / duration)));
  let parts = Math.ceil(duration / segTime);
  if (parts > MAX_PARTS) {
    segTime = Math.ceil(duration / MAX_PARTS);
    parts = Math.ceil(duration / segTime);
  }

  setProgress(8, `Splitting into ${parts} pieces (lossless, no quality loss)...`);
  const splitCode = await ff.exec(['-i', inName, '-c', 'copy', '-map', '0', '-f', 'segment', '-segment_time', String(segTime), '-reset_timestamps', '1', 'seg%03d.mp4']);
  try { await ff.deleteFile(inName); } catch (e) {}
  if (splitCode !== 0) throw new Error('Splitting the video failed. Try a file under 100 MB.');
  throwIfAborted();

  const entries = await ff.listDir('/');
  const segNames = entries.map(e => e.name).filter(n => /^seg\d+\.mp4$/.test(n)).sort();
  if (!segNames.length) throw new Error('Splitting produced no pieces. Try a file under 100 MB.');

  const compressedNames = [];
  try {
    for (let i = 0; i < segNames.length; i++) {
      throwIfAborted();
      const name = segNames[i];
      const base = 12 + (i / segNames.length) * 70;
      setProgress(base, `Compressing piece ${i + 1} of ${segNames.length} on the server...`);
      const data = await ff.readFile(name);
      if (data.length > MAX_FILE_SIZE) {
        throw new Error(`Piece ${i + 1} is still over 100 MB — this video\u2019s bitrate is too high to split safely. Try a shorter clip.`);
      }
      const fd = new FormData();
      fd.append('file', new Blob([data], { type: 'video/mp4' }), name);
      const segBlob = await uploadAndCompress(fd, crfVal, (phase, loaded, total) => {
        if (phase === 'upload' && total) {
          const frac = loaded / total;
          setProgress(base + frac * (70 / segNames.length) * 0.6, `Uploading piece ${i + 1} of ${segNames.length}...`);
        }
      });
      const cName = 'c_' + name;
      await ff.writeFile(cName, new Uint8Array(await segBlob.arrayBuffer()));
      try { await ff.deleteFile(name); } catch (e) {}
      compressedNames.push(cName);
      setProgress(12 + ((i + 1) / segNames.length) * 70, `Piece ${i + 1} of ${segNames.length} compressed.`);
    }

    throwIfAborted();
    setProgress(86, 'Reassembling compressed pieces...');
    const listText = compressedNames.map(n => `file '${n}'`).join('\n');
    await ff.writeFile('list.txt', new TextEncoder().encode(listText));
    const concatCode = await ff.exec(['-f', 'concat', '-safe', '0', '-i', 'list.txt', '-c', 'copy', 'final.mp4']);
    if (concatCode !== 0) throw new Error('Reassembly failed after compression.');
    const out = await ff.readFile('final.mp4');
    setProgress(96, 'Done.');
    return { blob: new Blob([out], { type: 'video/mp4' }), segments: segNames.length };
  } finally {
    for (const n of [...segNames, ...compressedNames, 'list.txt', 'final.mp4']) {
      try { await ff.deleteFile(n); } catch (e) {}
    }
  }
}

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
      // status 0 = connection died before any HTTP response (proxy kill,
      // server sleep, offline). Surface a helpful message, not a bare code.
      if (xhr.status === 0) {
        reject(new Error('Connection to the server was lost. The file may be too large or the server timed out — try a smaller/shorter video and try again.'));
        return;
      }
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
    xhr.onerror = () => reject(new Error('Connection to the server was lost. The file may be too large or the server timed out — try a smaller/shorter video and try again.'));
    xhr.onabort = () => reject(new DOMException('Operation aborted by user', 'AbortError'));
    xhr.ontimeout = () => reject(new Error('The server took too long to respond (timed out). Try a smaller/shorter video and try again.'));
    if (options.timeout) xhr.timeout = options.timeout;
    xhr.responseType = 'blob';
    xhr.send(options.body);
  });
}

