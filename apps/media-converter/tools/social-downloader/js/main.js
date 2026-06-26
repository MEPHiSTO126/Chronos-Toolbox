/**
 * Chronos Toolbox — Social Downloader
 * Backend-integrated tool that downloads videos using yt-dlp.
 */

// ── API URL configuration ────────────────────────────────
const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const BASE_URL = isLocal ? 'http://localhost:8000' : 'https://toolbox-backend-76dc.onrender.com';
const API_URL = `${BASE_URL}/media/social-downloader`;

// ── DOM Elements ──────────────────────────────────────────
const urlCard              = document.getElementById('url-card');
const videoUrlInput        = document.getElementById('video-url');
const btnSubmit            = document.getElementById('btn-submit');
const progressWrap         = document.getElementById('progress-wrap');
const progressText         = document.getElementById('progress-text');
const progressPct          = document.getElementById('progress-pct');
const progressBar          = document.getElementById('progress-bar');
const resultArea           = document.getElementById('result-area');
const resultMeta           = document.getElementById('result-meta');
const videoResultPreview   = document.getElementById('video-result-preview');
const btnDownload          = document.getElementById('btn-download');
const btnAgain             = document.getElementById('btn-again');

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

btnAgain.addEventListener('click', resetState);

function resetState() {
  videoUrlInput.value = '';
  videoResultPreview.src = '';
  if (btnDownload.href) {
    URL.revokeObjectURL(btnDownload.href);
    btnDownload.removeAttribute('href');
  }

  urlCard.style.display = 'block';
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
      
      const p1 = fetch(`${BASE_URL}/`, { method: 'GET', mode: 'no-cors', signal: controller.signal });
      const p2 = new Promise(r => setTimeout(r, 400)).then(() => 
        fetch(`${BASE_URL}/`, { method: 'GET', mode: 'no-cors', signal: controller.signal })
      );
      
      await Promise.all([p1, p2]);
      clearTimeout(timeoutId);
      progressText.textContent = 'Fetching and downloading video...';
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

// Preemptive double wake trigger on page load
(async () => {
  try {
    fetch(`${BASE_URL}/`, { method: 'GET', mode: 'no-cors' }).catch(() => {});
    await new Promise(r => setTimeout(r, 500));
    fetch(`${BASE_URL}/`, { method: 'GET', mode: 'no-cors' }).catch(() => {});
  } catch (e) {
    // Ignore error
  }
})();

// ── Download Button Handler ──────────────────────────────────
btnSubmit.addEventListener('click', async () => {
  const urlVal = videoUrlInput.value.trim();
  if (!urlVal) {
    showToast('Please enter a video URL first.', true);
    return;
  }

  urlCard.style.display = 'none';
  progressWrap.classList.add('visible');

  let progress = 0;
  progressBar.style.width = '0%';
  progressPct.textContent = '0%';
  const progressInterval = setInterval(() => {
    progress += (95 - progress) * 0.05;
    progressBar.style.width = `${progress}%`;
    progressPct.textContent = `${Math.round(progress)}%`;
  }, 200);

  try {
    const awake = await ensureBackendAwake();
    if (!awake) {
      throw new Error('Backend server did not wake up in time.');
    }

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: urlVal })
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Server error ${response.status}: ${err}`);
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);

    // Update result card
    videoResultPreview.src = url;
    btnDownload.href = url;
    
    // Resolve extension
    const cd = response.headers.get('Content-Disposition') || '';
    let fname = cd.match(/filename="?([^"]+)"?/)?.[1] || 'downloaded_video.mp4';
    btnDownload.download = fname;
    resultMeta.textContent = `File size: ${formatBytes(blob.size)}`;

    clearInterval(progressInterval);
    progressBar.style.width = '100%';
    progressPct.textContent = '100%';
    await new Promise(r => setTimeout(r, 400));

    progressWrap.classList.remove('visible');
    resultArea.classList.add('visible');
    showToast('Video download successful!');
  } catch (err) {
    console.error(err);
    showToast(err.message || 'Failed to download video.', true);
    clearInterval(progressInterval);
    progressWrap.classList.remove('visible');
    urlCard.style.display = 'block';
  }
});
