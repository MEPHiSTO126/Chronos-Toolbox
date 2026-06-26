/**
 * Chronos Toolbox — Audio Manipulator
 * Performs client-side volume adjustment, speed shifting, trimming, and fade effects using the Web Audio API.
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
const audioVolume          = document.getElementById('audio-volume');
const volumeVal            = document.getElementById('volume-val');
const audioSpeed           = document.getElementById('audio-speed');
const speedVal             = document.getElementById('speed-val');
const trimStart            = document.getElementById('trim-start');
const trimEnd              = document.getElementById('trim-end');
const fadeIn               = document.getElementById('fade-in');
const fadeInVal            = document.getElementById('fade-in-val');
const fadeOut              = document.getElementById('fade-out');
const fadeOutVal           = document.getElementById('fade-out-val');
const actionBar            = document.getElementById('action-bar');
const btnProcess           = document.getElementById('btn-process');
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

// ── Range Slider Label Updates ────────────────────────────
audioVolume.addEventListener('input', () => {
  const val = parseFloat(audioVolume.value);
  if (val === 0) volumeVal.textContent = 'Muted';
  else if (val === 1) volumeVal.textContent = '1.0x (Normal)';
  else volumeVal.textContent = `${val.toFixed(1)}x`;
});

audioSpeed.addEventListener('input', () => {
  const val = parseFloat(audioSpeed.value);
  if (val === 1) speedVal.textContent = '1.0x (Normal)';
  else speedVal.textContent = `${val.toFixed(2)}x`;
});

fadeIn.addEventListener('input', () => {
  fadeInVal.textContent = `${parseFloat(fadeIn.value).toFixed(1)}s`;
});

fadeOut.addEventListener('input', () => {
  fadeOutVal.textContent = `${parseFloat(fadeOut.value).toFixed(1)}s`;
});

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

  // Reveal UI
  dropzone.style.display = 'none';
  fileMetaContainer.style.display = 'flex';
  optionsPanel.style.display = 'block';
  actionBar.style.display = 'flex';
  resultArea.classList.remove('visible');

  // Decode audio data to obtain buffer
  showToast('Loading and decoding audio...');
  try {
    if (!audioContext) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    const arrayBuffer = await file.arrayBuffer();
    
    audioContext.decodeAudioData(arrayBuffer, (decodedBuffer) => {
      audioBuffer = decodedBuffer;
      showToast('Audio decoded successfully!');

      // Set default trim inputs
      trimStart.value = 0;
      trimStart.max = decodedBuffer.duration;
      trimEnd.value = decodedBuffer.duration.toFixed(1);
      trimEnd.max = decodedBuffer.duration;
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

// ── Apply Manipulations ───────────────────────────────────
btnProcess.addEventListener('click', async () => {
  if (!audioBuffer) {
    showToast('Audio buffer is not ready yet.', true);
    return;
  }

  const gainVal = parseFloat(audioVolume.value);
  const speedVal = parseFloat(audioSpeed.value);
  const startSec = parseFloat(trimStart.value);
  const endSec = parseFloat(trimEnd.value);
  let fadeInSec = parseFloat(fadeIn.value);
  let fadeOutSec = parseFloat(fadeOut.value);

  // Validate inputs
  if (isNaN(startSec) || startSec < 0 || startSec > audioBuffer.duration) {
    showToast('Invalid trim start time.', true);
    return;
  }
  if (isNaN(endSec) || endSec < 0 || endSec > audioBuffer.duration || endSec <= startSec) {
    showToast('Invalid trim end time. End must be greater than start.', true);
    return;
  }

  // Calculate output duration
  const trimDuration = endSec - startSec;
  const outputDuration = trimDuration / speedVal;

  // Cap fades if they overlap the total output duration
  if (fadeInSec + fadeOutSec > outputDuration) {
    const ratio = outputDuration / (fadeInSec + fadeOutSec);
    fadeInSec *= ratio;
    fadeOutSec *= ratio;
  }

  // Disable UI and show progress
  btnProcess.disabled = true;
  btnRemove.disabled = true;
  progressWrap.classList.add('visible');
  progressPct.textContent = '0%';
  progressBar.style.width = '0%';
  progressText.textContent = 'Rendering manipulated audio...';

  const sampleRate = audioBuffer.sampleRate;
  const numOfChan = audioBuffer.numberOfChannels;
  const totalLength = Math.floor(outputDuration * sampleRate);

  try {
    const offlineCtx = new OfflineAudioContext(numOfChan, totalLength, sampleRate);

    // Create source
    const source = offlineCtx.createBufferSource();
    source.buffer = audioBuffer;
    source.playbackRate.value = speedVal;

    // Create gain node
    const gainNode = offlineCtx.createGain();

    // Connect graph: source -> gainNode -> destination
    source.connect(gainNode);
    gainNode.connect(offlineCtx.destination);

    // Apply linear fade transitions
    gainNode.gain.setValueAtTime(0, 0);
    if (fadeInSec > 0) {
      gainNode.gain.linearRampToValueAtTime(gainVal, fadeInSec);
    } else {
      gainNode.gain.setValueAtTime(gainVal, 0);
    }

    if (fadeOutSec > 0) {
      const fadeOutStart = outputDuration - fadeOutSec;
      gainNode.gain.setValueAtTime(gainVal, fadeOutStart);
      gainNode.gain.linearRampToValueAtTime(0, outputDuration);
    } else {
      gainNode.gain.setValueAtTime(gainVal, outputDuration);
    }

    // Start source playback
    source.start(0, startSec, trimDuration);

    // Simulate progress updates
    let pct = 0;
    const progressInterval = setInterval(() => {
      if (pct < 90) {
        pct += 6;
        progressPct.textContent = `${pct}%`;
        progressBar.style.width = `${pct}%`;
      }
    }, 80);

    // Render buffer offline
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
        btnDownload.download = `${selectedFile.name.split('.')[0]}_edited.wav`;
        resultMeta.textContent = `Duration: ${formatDuration(renderedBuffer.duration)} · Channels: ${numOfChan} · Format: 16-bit WAV PCM`;

        // Reveal results
        progressWrap.classList.remove('visible');
        resultArea.classList.add('visible');
        showToast('Manipulations applied successfully!');
      } catch (err) {
        console.error('WAV Encoding Error:', err);
        showToast('Error encoding output WAV file.', true);
      } finally {
        btnProcess.disabled = false;
        btnRemove.disabled = false;
      }
    }, 200);

  } catch (err) {
    console.error('Rendering Error:', err);
    showToast('Failed to apply audio effects.', true);
    btnProcess.disabled = false;
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
