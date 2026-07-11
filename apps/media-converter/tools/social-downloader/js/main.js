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
  }, 5000);
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

// ── URL Validation Helper ──────────────────────────────────
function validateUrl(url) {
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

function getPlatformHint(url) {
  const lower = url.toLowerCase();
  if (lower.includes('youtube.com') || lower.includes('youtu.be')) return 'YouTube';
  if (lower.includes('tiktok.com')) return 'TikTok';
  if (lower.includes('instagram.com')) return 'Instagram';
  if (lower.includes('twitter.com') || lower.includes('x.com')) return 'X/Twitter';
  if (lower.includes('facebook.com') || lower.includes('fb.watch')) return 'Facebook';
  return 'Unknown';
}

videoUrlInput.addEventListener('input', () => {
  const url = videoUrlInput.value.trim();
  if (url && !validateUrl(url)) {
    videoUrlInput.setCustomValidity('Please enter a valid URL');
  } else {
    videoUrlInput.setCustomValidity('');
  }
});

// ── Reset State ────────────────────────────────────────────
btnAgain.addEventListener('click', resetState);

function resetState() {
  videoUrlInput.value = '';
  videoResultPreview.src = '';
  if (btnDownload.href) {
    URL.revokeObjectURL(btnDownload.href);
    btnDownload.removeAttribute('href');
  }
  videoUrlInput.setCustomValidity('');

  urlCard.style.display = 'block';
  progressWrap.classList.remove('visible');
  resultArea.classList.remove('visible');
}

// ── Wake-up Helper ──────────────────────────────────────────
// Render free tier can take 60+ seconds to wake up
async function ensureBackendAwake() {
  const origin = typeof BASE_URL !== 'undefined' ? BASE_URL : new URL(API_URL).origin;
  const pText = document.getElementById('progress-text');
  
  if (pText) {
    pText.textContent = 'Waking up the server (this may take up to a minute)...';
  }

  // Increased attempts and wait time for Render cold starts
  for (let attempt = 1; attempt <= 30; attempt++) {
    try {
      const response = await fetch(`${origin}/`, { method: 'GET' });
      
      if (response.ok) {
        if (pText) pText.textContent = 'Server ready. Starting download...';
        return true;
      } else {
        console.warn(`Wake attempt ${attempt} returned status ${response.status}`);
      }
    } catch (e) {
      console.warn(`Wake attempt ${attempt} failed:`, e);
    }
    
    // Exponential backoff: 2s, 3s, 4s... up to max 10s
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

// ── Download Button Handler ──────────────────────────────────
btnSubmit.addEventListener('click', async () => {
  const urlVal = videoUrlInput.value.trim();
  if (!urlVal) {
    showToast('Please enter a video URL first.', true);
    return;
  }
  if (!validateUrl(urlVal)) {
    showToast('Please enter a valid URL (http:// or https://).', true);
    return;
  }

  const platform = getPlatformHint(urlVal);
  if (platform === 'Unknown') {
    showToast('Warning: This platform may not be supported.', false);
  }

  // Facebook share URL warning
  if (urlVal.includes('facebook.com/share/')) {
    showToast('Note: Facebook share links may not work. Try the direct video URL (facebook.com/watch/?v=ID).', false);
  }

  urlCard.style.display = 'none';
  progressWrap.classList.add('visible');

  let progressInterval = null;
  let downloadStartTime = Date.now();

  const __handleProgress = (phase, loaded, total) => {
    const pBar = document.getElementById('progress-bar') || document.querySelector('.progress-bar-fill');
    const pPct = document.getElementById('progress-pct');
    const pTxt = document.getElementById('progress-text');
    if (phase === 'upload') {
      const pct = (loaded / total) * 30; // Upload is quick, only 30% of bar
      if (pBar) pBar.style.width = `${pct}%`;
      if (pPct) pPct.textContent = `${Math.round(pct)}%`;
      if (pTxt) pTxt.textContent = 'Sending request...';
      
      if (loaded === total) {
        if (pTxt) pTxt.textContent = 'Downloading video (this may take a while)...';
        if (progressInterval) clearInterval(progressInterval);
        // Simulate progress for long downloads
        let procPct = 30;
        progressInterval = setInterval(() => {
          const elapsed = (Date.now() - downloadStartTime) / 1000;
          // Gradually increase, slower over time
          procPct += Math.max(0.5, (95 - procPct) * 0.01);
          if (pBar) pBar.style.width = `${Math.min(procPct, 95)}%`;
          if (pPct) pPct.textContent = `${Math.round(Math.min(procPct, 95))}%`;
          if (pTxt) pTxt.textContent = `Downloading... (${elapsed.toFixed(0)}s elapsed)`;
        }, 1000);
      }
    }
  };

  try {
    const awake = await ensureBackendAwake();
    if (!awake) {
      throw new Error('Backend server did not wake up in time. Please try again in a moment.');
    }

    // Get cookies if provided
    const cookiesInput = document.getElementById('cookies-input');
    const cookies = cookiesInput?.value?.trim() || null;

    const response = await doFetchWithProgress(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: urlVal, cookies })
    }, __handleProgress);

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Server error ${response.status}: ${err}`);
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);

    // Update result card
    videoResultPreview.src = url;
    btnDownload.href = url;
    
    // Resolve extension from Content-Disposition
    const cd = response.headers.get('Content-Disposition') || '';
    let fname = cd.match(/filename\*?=([^;]+)/)?.[1]?.replace(/^UTF-8''/, '')?.replace(/^"|"$/g, '')
      || cd.match(/filename="?([^"]+)"?/)?.[1]
      || 'downloaded_video.mp4';
    btnDownload.download = fname;
    resultMeta.textContent = `File size: ${formatBytes(blob.size)}`;

    clearInterval(progressInterval);
    progressBar.style.width = '100%';
    progressPct.textContent = '100%';
    if (progressText) progressText.textContent = 'Download complete!';
    await new Promise(r => setTimeout(r, 400));

    progressWrap.classList.remove('visible');
    resultArea.classList.add('visible');
    showToast('Video download successful!');
  } catch (err) {
    console.error(err);
    let msg = err.message || 'Failed to download video.';
    // Clean up common error messages
    if (msg.includes('Network error')) {
      msg = 'Network error. Check your connection or try again.';
    } else if (msg.includes('did not wake up')) {
      msg = 'Server is taking too long to wake up. Please try again in a minute.';
    } else if (msg.includes('timeout') || msg.includes('timed out')) {
      msg = 'Download timed out. Video may be too large or connection too slow.';
    }
    showToast(msg, true);
    clearInterval(progressInterval);
    progressWrap.classList.remove('visible');
    urlCard.style.display = 'block';
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
    // Increase timeout for large video downloads
    xhr.timeout = 600000; // 10 minutes
    xhr.ontimeout = () => reject(new Error('Request timed out (10 minutes). Video may be too large.'));
    xhr.onload = () => {
      const response = {
        ok: xhr.status >= 200 && xhr.status < 300,
        status: xhr.status,
        text: async () => await xhr.response.text(),
        json: async () => JSON.parse(await xhr.response.text()),
        blob: async () => xhr.response,
        headers: {
          get: (name) => xhr.getResponseHeader(name)
        }
      };
      resolve(response);
    };
    xhr.onerror = () => reject(new Error('Network error'));
    xhr.responseType = 'blob';
    xhr.send(options.body);
  });
}