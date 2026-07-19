/**
 * Chronos Toolbox — Image Upscaler
 * Upscale images using client-side canvas-based algorithms.
 */

'use strict';

// ── State ──────────────────────────────────────────────────
const state = {
  file: null,
  fileName: 'upscaled-image',
  imgUrl: null,
  imgElement: null,
  isProcessing: false
};

// ── DOM refs ───────────────────────────────────────────────
const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('file-input');
const editorSection = document.getElementById('editor-section');
const previewOriginal = document.getElementById('preview-original');
const previewResult = document.getElementById('preview-result');
const originalSize = document.getElementById('original-size');
const resultSize = document.getElementById('result-size');
const btnUpscale = document.getElementById('btn-upscale');
const btnClear = document.getElementById('btn-clear');
const btnDownload = document.getElementById('btn-download');
const scaleSelect = document.getElementById('scale-select');
const methodSelect = document.getElementById('method-select');
const statusText = document.getElementById('status-text');
const progressWrap = document.getElementById('progress-wrap');
const resultArea = document.getElementById('result-area');

// ── Events ─────────────────────────────────────────────────
dropzone.addEventListener('dragover', e => { e.preventDefault(); dropzone.classList.add('drag-over'); });
dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag-over'));
dropzone.addEventListener('drop', e => {
  e.preventDefault();
  dropzone.classList.remove('drag-over');
  if (e.dataTransfer.files.length) loadFile(e.dataTransfer.files[0]);
});
fileInput.addEventListener('change', () => {
  if (fileInput.files.length) loadFile(fileInput.files[0]);
});

btnUpscale.addEventListener('click', upscaleImage);
btnClear.addEventListener('click', clearAll);
btnDownload.addEventListener('click', downloadResult);

// ── Loading File ───────────────────────────────────────────
function loadFile(file) {
  if (!file || !file.type.startsWith('image/')) {
    toast('Please upload a valid image file.', true);
    return;
  }

  state.file = file;
  state.fileName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
  if (state.imgUrl) URL.revokeObjectURL(state.imgUrl);
  state.imgUrl = URL.createObjectURL(file);

  const img = new Image();
  img.onload = () => {
    state.imgElement = img;
    previewOriginal.src = state.imgUrl;
    previewResult.src = '';
    originalSize.textContent = `${img.naturalWidth} × ${img.naturalHeight}`;
    resultSize.textContent = '—';
    dropzone.style.display = 'none';
    editorSection.style.display = 'block';
    resultArea.style.display = 'none';
    updatePreviewScale();
  };
  img.src = state.imgUrl;
}

// ── Update preview based on scale ──────────────────────────
function updatePreviewScale() {
  if (!state.imgElement) return;
  const scale = parseInt(scaleSelect.value);
  const newWidth = state.imgElement.naturalWidth * scale;
  const newHeight = state.imgElement.naturalHeight * scale;
  resultSize.textContent = `${newWidth} × ${newHeight}`;
}

scaleSelect.addEventListener('change', updatePreviewScale);

// ── Upscale Image ──────────────────────────────────────────
async function upscaleImage() {
  if (!state.imgElement || state.isProcessing) return;

  state.isProcessing = true;
  btnUpscale.disabled = true;
  btnUpscale.textContent = 'Upscaling...';
  progressWrap.style.display = 'block';
  statusText.textContent = 'Processing image...';
  resultArea.style.display = 'none';

  try {
    const scale = parseInt(scaleSelect.value);
    const method = methodSelect.value;
    const newWidth = state.imgElement.naturalWidth * scale;
    const newHeight = state.imgElement.naturalHeight * scale;

    // Check maximum size
    if (newWidth > 4096 || newHeight > 4096) {
      throw new Error('Maximum output size is 4096×4096 pixels');
    }

    statusText.textContent = `Upscaling to ${newWidth}×${newHeight}...`;

    const canvas = document.createElement('canvas');
    canvas.width = newWidth;
    canvas.height = newHeight;
    const ctx = canvas.getContext('2d');

    // Apply upscaling method
    if (method === 'neighbor') {
      // Nearest neighbor (pixelated)
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(state.imgElement, 0, 0, newWidth, newHeight);
    } else if (method === 'bilinear') {
      // Bilinear (smoother)
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'low';
      ctx.drawImage(state.imgElement, 0, 0, newWidth, newHeight);
    } else if (method === 'bicubic') {
      // Bicubic (sharper)
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(state.imgElement, 0, 0, newWidth, newHeight);
    }

    // Convert to blob and display
    canvas.toBlob(blob => {
      if (blob) {
        const resultUrl = URL.createObjectURL(blob);
        previewResult.src = resultUrl;
        resultArea.style.display = 'block';
        statusText.textContent = `Upscaled to ${newWidth}×${newHeight}`;
        state.resultBlob = blob;
        toast('Image upscaled!');
      }
    }, 'image/png');

  } catch (err) {
    console.error('Upscale Error:', err);
    toast(`Error: ${err.message}`, true);
    statusText.textContent = 'Upscale failed';
  } finally {
    state.isProcessing = false;
    btnUpscale.disabled = false;
    btnUpscale.textContent = 'Upscale Image';
    progressWrap.style.display = 'none';
  }
}

// ── Download Result ────────────────────────────────────────
function downloadResult() {
  if (!state.resultBlob) return;

  const url = URL.createObjectURL(state.resultBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${state.fileName}-upscaled.png`;
  a.click();

  setTimeout(() => URL.revokeObjectURL(url), 5000);
  toast('Downloaded!');
}

// ── Clear / Reset ──────────────────────────────────────────
function clearAll() {
  if (state.imgUrl) {
    URL.revokeObjectURL(state.imgUrl);
    state.imgUrl = null;
  }
  state.file = null;
  state.imgElement = null;
  state.resultBlob = null;

  fileInput.value = '';
  originalSize.textContent = '—';
  resultSize.textContent = '—';
  statusText.textContent = 'Ready to upscale';
  dropzone.style.display = 'block';
  editorSection.style.display = 'none';
  resultArea.style.display = 'none';
  progressWrap.style.display = 'none';
}

// ── Toast Helper ───────────────────────────────────────────
function toast(msg, isError = false) {
  document.querySelector('.ct-toast')?.remove();
  const el = document.createElement('div');
  el.className = 'ct-toast' + (isError ? ' ct-toast--error' : '');
  el.setAttribute('role', 'status');
  el.textContent = msg;
  document.body.appendChild(el);
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('show')));
  setTimeout(() => {
    el.classList.remove('show');
    el.addEventListener('transitionend', () => el.remove(), { once: true });
  }, 3500);
}
