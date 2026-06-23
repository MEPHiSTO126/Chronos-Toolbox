/**
 * Chronos Toolbox — Compress Image
 * Calculates file sizes dynamically on a local canvas by varying export qualities.
 */

'use strict';

// ── State ──────────────────────────────────────────────────
const state = {
  file:             null,
  fileName:         'compressed-image',
  originalSize:     0,
  imgElement:       null, // Loaded Image element
  compressedBlob:   null,
  compressedUrl:    null,
  isProcessing:     false,
  needsReRun:       false
};

// ── DOM refs ───────────────────────────────────────────────
const dropzone       = document.getElementById('dropzone');
const fileInput      = document.getElementById('file-input');
const editorSection  = document.getElementById('editor-section');
const previewImg     = document.getElementById('preview-img');

const valOrigSize    = document.getElementById('val-orig-size');
const valCompSize    = document.getElementById('val-comp-size');
const savingsBox     = document.getElementById('savings-box');

const optFormat      = document.getElementById('opt-format');
const optQuality     = document.getElementById('opt-quality');
const qualityVal     = document.getElementById('quality-val');
const btnSave        = document.getElementById('btn-save');
const btnClear       = document.getElementById('btn-clear');

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
btnClear.addEventListener('click', clearAll);
btnSave.addEventListener('click', saveImage);

optQuality.addEventListener('input', () => {
  qualityVal.textContent = optQuality.value + '%';
  scheduleRecalc();
});
optFormat.addEventListener('change', scheduleRecalc);

// ── Loading File ───────────────────────────────────────────
function loadFile(file) {
  if (!file || !file.type.startsWith('image/')) {
    toast('Please upload a valid image file.', true);
    return;
  }
  state.file = file;
  state.fileName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
  state.originalSize = file.size;

  valOrigSize.textContent = formatSize(file.size);

  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      state.imgElement = img;
      dropzone.style.display = 'none';
      editorSection.style.display = 'block';
      scheduleRecalc();
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

// ── Compression Pipeline ───────────────────────────────────
function scheduleRecalc() {
  if (state.isProcessing) {
    state.needsReRun = true;
    return;
  }
  state.isProcessing = true;
  runRecalcLoop();
}

async function runRecalcLoop() {
  do {
    state.needsReRun = false;
    await recalculateCompression();
  } while (state.needsReRun);
  state.isProcessing = false;
}

function recalculateCompression() {
  return new Promise((resolve) => {
    if (!state.imgElement) {
      resolve();
      return;
    }

    const img = state.imgElement;
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);

    const fmt = optFormat.value;
    const mimeType = `image/${fmt}`;
    const quality = parseFloat(optQuality.value) / 100;

    canvas.toBlob((blob) => {
      if (!blob) {
        resolve();
        return;
      }

      state.compressedBlob = blob;
      if (state.compressedUrl) {
        URL.revokeObjectURL(state.compressedUrl);
      }
      state.compressedUrl = URL.createObjectURL(blob);
      previewImg.src = state.compressedUrl;

      // Calculate statistics
      valCompSize.textContent = formatSize(blob.size);
      
      const savedBytes = state.originalSize - blob.size;
      const pct = Math.max(0, Math.round((savedBytes / state.originalSize) * 100));

      if (savedBytes > 0) {
        savingsBox.style.background = 'rgba(114, 196, 152, 0.1)';
        savingsBox.style.borderColor = 'rgba(114, 196, 152, 0.25)';
        savingsBox.style.color = '#72c498';
        savingsBox.textContent = `Saved ${pct}% of original file size! (${formatSize(savedBytes)})`;
      } else {
        // Quality was set too high or format change caused expansion
        savingsBox.style.background = 'rgba(192, 149, 106, 0.1)';
        savingsBox.style.borderColor = 'rgba(192, 149, 106, 0.25)';
        savingsBox.style.color = '#c0956a';
        savingsBox.textContent = `File size increased slightly (+${formatSize(Math.abs(savedBytes))})`;
      }

      resolve();
    }, mimeType, quality);
  });
}

// ── Export / Save ──────────────────────────────────────────
function saveImage() {
  if (!state.compressedBlob) return;

  const fmt = optFormat.value;
  const ext = fmt === 'jpeg' ? 'jpg' : fmt;

  const a = document.createElement('a');
  a.href = state.compressedUrl;
  a.download = `${state.fileName}-compressed.${ext}`;
  a.click();
  toast('Compressed image downloaded!');
}

// ── Clear / Reset ──────────────────────────────────────────
function clearAll() {
  if (state.compressedUrl) {
    URL.revokeObjectURL(state.compressedUrl);
    state.compressedUrl = null;
  }
  state.file = null;
  state.imgElement = null;
  state.compressedBlob = null;
  state.originalSize = 0;
  
  fileInput.value = '';
  dropzone.style.display = 'block';
  editorSection.style.display = 'none';
  previewImg.src = '';

  optQuality.value = 75;
  qualityVal.textContent = '75%';
  optFormat.value = 'jpeg';
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1024 / 1024).toFixed(2) + ' MB';
}

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
