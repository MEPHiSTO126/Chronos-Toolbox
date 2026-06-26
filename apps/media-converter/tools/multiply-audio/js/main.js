/**
 * Chronos Toolbox — Multiply Audio
 * Performs client-side loop and overlay audio multiplication using the Web Audio API.
 */

// ── DOM Elements ──────────────────────────────────────────
const dropzone             = document.getElementById('dropzone');
const fileInput            = document.getElementById('file-input');
const fileMetaContainer    = document.getElementById('file-meta-container');
const fileNameEl           = document.getElementById('file-name');
const fileSizeEl           = document.getElementById('file-size');
const audioPreview         = document.getElementById('audio-preview');
const btnRemove            = document.getElementById('btn-remove');
const optionsPanel         = document.getElementById('options-panel');
const multiplierMode       = document.getElementById('multiplier-mode');
const multiplierCount      = document.getElementById('multiplier-count');
const offsetGroup          = document.getElementById('offset-group');
const multiplierOffset     = document.getElementById('multiplier-offset');
const actionBar            = document.getElementById('action-bar');
const btnMultiply          = document.getElementById('btn-multiply');
const progressWrap         = document.getElementById('progress-wrap');
const progressText         = document.getElementById('progress-text');
const progressPct          = document.getElementById('progress-pct');
const progressBar          = document.getElementById('progress-bar');
const resultArea           = document.getElementById('result-area');
const resultMeta           = document.getElementById('result-meta');
const audioResultPreview   = document.getElementById('audio-result-preview');
const btnDownload          = document.getElementById('btn-download');
const btnAgain             = document.getElementById('btn-again');

// ── State Variables ───────────────────────────────────────
let selectedFile = null;
let audioBuffer  = null;
let audioContext = null;

// ── Toast Helper ──────────────────────────────────────────
function showToast(message, isError = false) {
  const existingToast = document.querySelector('.ct-toast');
  if (existingToast) existingToast.remove();

  const toast = document.createElement('div');
  toast.className = `ct-toast ${isError ? 'ct-toast--error' : ''}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  // Trigger Reflow
  toast.offsetHeight;
  toast.classList.add('show');

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
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

function formatDuration(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
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

// ── File Selection Handler ──────────────────────────────
async function handleFileSelect(file) {
  if (!file.type.startsWith('audio/')) {
    showToast('Please select a valid audio file.', true);
    return;
  }

  selectedFile = file;
  fileNameEl.textContent = file.name;
  fileSizeEl.textContent = formatBytes(file.size);

  // Set up preview
  const fileUrl = URL.createObjectURL(file);
  audioPreview.src = fileUrl;

  // Show status
  dropzone.style.display = 'none';
  fileMetaContainer.style.display = 'flex';
  optionsPanel.style.display = 'block';
  actionBar.style.display = 'flex';
  resultArea.classList.remove('visible');

  // Decode audio data to obtain buffer and length
  showToast('Loading and decoding audio...');
  try {
    if (!audioContext) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    const arrayBuffer = await file.arrayBuffer();
    
    // Decode audio data (promise-based)
    audioContext.decodeAudioData(arrayBuffer, (decodedBuffer) => {
      audioBuffer = decodedBuffer;
      showToast('Audio decoded successfully!');
    }, (error) => {
      console.error('Decode error:', error);
      showToast('Failed to decode audio file. It might be corrupt or unsupported.', true);
      resetState();
    });
  } catch (err) {
    console.error('File load error:', err);
    showToast('Error reading file data.', true);
    resetState();
  }
}

// ── Mode Switch options ───────────────────────────────────
multiplierMode.addEventListener('change', () => {
  if (multiplierMode.value === 'overlay') {
    offsetGroup.classList.remove('option-group--hidden');
  } else {
    offsetGroup.classList.add('option-group--hidden');
  }
});

// ── Remove File Button ────────────────────────────────────
btnRemove.addEventListener('click', resetState);

function resetState() {
  selectedFile = null;
  audioBuffer = null;
  audioPreview.src = '';
  audioResultPreview.src = '';
  if (btnDownload.href) {
    URL.revokeObjectURL(btnDownload.href);
    btnDownload.removeAttribute('href');
  }
  fileInput.value = '';
  
  dropzone.style.display = 'block';
  fileMetaContainer.style.display = 'none';
  optionsPanel.style.display = 'none';
  actionBar.style.display = 'none';
  progressWrap.classList.remove('visible');
  resultArea.classList.remove('visible');
}

// ── Multiply Processing ──────────────────────────────────
btnMultiply.addEventListener('click', async () => {
  if (!audioBuffer) {
    showToast('Audio buffer is not ready yet.', true);
    return;
  }

  const N = parseInt(multiplierCount.value, 10);
  if (isNaN(N) || N < 2 || N > 50) {
    showToast('Multiplier must be a number between 2 and 50.', true);
    return;
  }

  const mode = multiplierMode.value;
  const offsetSec = parseFloat(multiplierOffset.value);
  if (mode === 'overlay' && (isNaN(offsetSec) || offsetSec < 0 || offsetSec > 30)) {
    showToast('Layer offset must be between 0 and 30 seconds.', true);
    return;
  }

  // Disable UI and show progress
  btnMultiply.disabled = true;
  btnRemove.disabled = true;
  progressWrap.classList.add('visible');
  progressPct.textContent = '0%';
  progressBar.style.width = '0%';
  progressText.textContent = 'Rendering multiplied audio tracks...';

  // Calculate length and sample rate
  const sampleRate = audioBuffer.sampleRate;
  const numOfChan = audioBuffer.numberOfChannels;
  let totalLength = 0;

  if (mode === 'loop') {
    totalLength = audioBuffer.length * N;
  } else {
    // overlay mode
    const offsetSamples = Math.floor(offsetSec * sampleRate);
    totalLength = audioBuffer.length + (N - 1) * offsetSamples;
  }

  // Initialize OfflineAudioContext
  try {
    const offlineCtx = new OfflineAudioContext(numOfChan, totalLength, sampleRate);

    // Schedule sources
    for (let i = 0; i < N; i++) {
      const source = offlineCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(offlineCtx.destination);

      let startTime = 0;
      if (mode === 'loop') {
        startTime = i * audioBuffer.duration;
      } else {
        startTime = i * offsetSec;
      }
      source.start(startTime);
    }

    // Simulate progress updates since offlineCtx.startRendering() doesn't have an intermediate callback
    let pct = 0;
    const progressInterval = setInterval(() => {
      if (pct < 90) {
        pct += 5;
        progressPct.textContent = `${pct}%`;
        progressBar.style.width = `${pct}%`;
      }
    }, 100);

    // Perform offline render
    const renderedBuffer = await offlineCtx.startRendering();
    clearInterval(progressInterval);
    
    progressPct.textContent = '95%';
    progressBar.style.width = '95%';
    progressText.textContent = 'Encoding resulting WAV file...';

    // Encode to WAV Blob
    setTimeout(() => {
      try {
        const wavBlob = bufferToWav(renderedBuffer);
        const wavUrl = URL.createObjectURL(wavBlob);

        // Update results card
        audioResultPreview.src = wavUrl;
        btnDownload.href = wavUrl;
        btnDownload.download = `${selectedFile.name.split('.')[0]}_x${N}_${mode}.wav`;
        resultMeta.textContent = `Duration: ${formatDuration(renderedBuffer.duration)} · Channels: ${numOfChan} · Format: 16-bit WAV PCM`;

        // Reveal results
        progressWrap.classList.remove('visible');
        resultArea.classList.add('visible');
        showToast('Processing complete!');
      } catch (err) {
        console.error('WAV Encoding Error:', err);
        showToast('Error encoding output WAV file.', true);
      } finally {
        btnMultiply.disabled = false;
        btnRemove.disabled = false;
      }
    }, 200);

  } catch (err) {
    console.error('Rendering Error:', err);
    showToast('Failed to render audio on OfflineContext.', true);
    btnMultiply.disabled = false;
    btnRemove.disabled = false;
    progressWrap.classList.remove('visible');
  }
});

btnAgain.addEventListener('click', resetState);

// ── WAV Encoder Helper ───────────────────────────────────
function bufferToWav(buffer) {
  const numOfChan = buffer.numberOfChannels;
  const length = buffer.length * numOfChan * 2 + 44;
  const bufferArr = new ArrayBuffer(length);
  const view = new DataView(bufferArr);
  const channels = [];
  let i;
  let sample;
  let offset = 0;
  let pos = 0;

  // write WAVE header
  setUint32(0x46464952); // "RIFF"
  setUint32(length - 8); // file length - 8
  setUint32(0x45564157); // "WAVE"
  setUint32(0x20746d66); // "fmt " chunk
  setUint32(16);         // chunk length
  setUint16(1);          // sample format (raw PCM)
  setUint16(numOfChan);
  setUint32(buffer.sampleRate);
  setUint32(buffer.sampleRate * 2 * numOfChan); // byte rate
  setUint16(numOfChan * 2);                     // block align
  setUint16(16);                                // bits per sample
  setUint32(0x61746164); // "data" chunk
  setUint32(length - pos - 4);

  // write interleaved channels
  for (i = 0; i < buffer.numberOfChannels; i++) {
    channels.push(buffer.getChannelData(i));
  }

  while (pos < length) {
    for (i = 0; i < numOfChan; i++) {
      sample = Math.max(-1, Math.min(1, channels[i][offset]));
      // convert to 16-bit signed PCM
      sample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
      view.setInt16(pos, sample, true);
      pos += 2;
    }
    offset++;
  }

  return new Blob([bufferArr], { type: 'audio/wav' });

  function setUint16(data) {
    view.setUint16(pos, data, true);
    pos += 2;
  }

  function setUint32(data) {
    view.setUint32(pos, data, true);
    pos += 4;
  }
}
