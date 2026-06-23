/**
 * Chronos Toolbox — Custom Filter Adder
 * Performs real-time pixel color-matrix transformations on the canvas element.
 */

'use strict';

// ── Matrix Presets ─────────────────────────────────────────
const PRESETS = {
  identity: [
    1, 0, 0, 0, 0,
    0, 1, 0, 0, 0,
    0, 0, 1, 0, 0,
    0, 0, 0, 1, 0
  ],
  sepia: [
    0.393, 0.769, 0.189, 0, 0,
    0.349, 0.686, 0.168, 0, 0,
    0.272, 0.534, 0.131, 0, 0,
    0, 0, 0, 1, 0
  ],
  polaroid: [
    1.438, -0.062, -0.062, 0, -0.05,
    -0.122, 1.378, -0.122, 0, -0.05,
    -0.016, -0.016, 1.483, 0, -0.05,
    0, 0, 0, 1, 0
  ],
  technicolor: [
    1.913, -0.543, -0.370, 0, 0,
    -0.369, 2.038, -0.669, 0, 0,
    -0.169, -0.578, 1.747, 0, 0,
    0, 0, 0, 1, 0
  ],
  kodachrome: [
    1.120, 0, 0, 0, -0.05,
    0, 1.120, 0, 0, -0.05,
    0, 0, 1.120, 0, -0.05,
    0, 0, 0, 1.000, 0
  ],
  negative: [
    -1, 0, 0, 0, 1,
    0, -1, 0, 0, 1,
    0, 0, -1, 0, 1,
    0, 0, 0, 1, 0
  ],
  warm: [
    1.2, 0, 0, 0, 0.05,
    0, 1.05, 0, 0, 0,
    0, 0, 0.8, 0, -0.05,
    0, 0, 0, 1, 0
  ],
  cool: [
    0.8, 0, 0, 0, -0.05,
    0, 0.9, 0, 0, 0,
    0, 0, 1.2, 0, 0.05,
    0, 0, 0, 1, 0
  ],
  monochrome: [
    0.2126, 0.7152, 0.0722, 0, 0,
    0.2126, 0.7152, 0.0722, 0, 0,
    0.2126, 0.7152, 0.0722, 0, 0,
    0, 0, 0, 1, 0
  ]
};

// ── State ──────────────────────────────────────────────────
const state = {
  file:       null,
  fileName:   'matrix-filtered-image',
  imgUrl:     null,
  imgElement: null, // Loaded Image element
  matrix:     [...PRESETS.identity]
};

// ── DOM refs ───────────────────────────────────────────────
const dropzone       = document.getElementById('dropzone');
const fileInput      = document.getElementById('file-input');
const editorSection  = document.getElementById('editor-section');
const canvas         = document.getElementById('preview-canvas');
const ctx            = canvas.getContext('2d');
const matrixGrid     = document.getElementById('matrix-grid');
const matrixPreset   = document.getElementById('matrix-preset');

const optFormat      = document.getElementById('opt-format');
const optQuality     = document.getElementById('opt-quality');
const qualityGroup   = document.getElementById('quality-group');
const qualityVal     = document.getElementById('quality-val');
const btnSave        = document.getElementById('btn-save');
const btnClear       = document.getElementById('btn-clear');

// ── Initialize Matrix Grid Inputs ──────────────────────────
function initMatrixInputs() {
  matrixGrid.innerHTML = '';
  for (let i = 0; i < 20; i++) {
    const input = document.createElement('input');
    input.type = 'number';
    input.step = '0.01';
    input.className = 'matrix-input';
    input.value = state.matrix[i].toFixed(2);
    input.dataset.index = i;

    input.addEventListener('input', () => {
      const val = parseFloat(input.value);
      state.matrix[i] = isNaN(val) ? 0 : val;
      render();
    });

    matrixGrid.appendChild(input);
  }
}

// Populate grid on select change
matrixPreset.addEventListener('change', () => {
  const key = matrixPreset.value;
  state.matrix = [...PRESETS[key]];
  
  const inputs = matrixGrid.querySelectorAll('.matrix-input');
  inputs.forEach((input, i) => {
    input.value = state.matrix[i].toFixed(2);
  });
  render();
});

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

// Quality slider label
optQuality.addEventListener('input', () => {
  qualityVal.textContent = optQuality.value + '%';
});

// Quality slider visibility
optFormat.addEventListener('change', () => {
  const fmt = optFormat.value;
  qualityGroup.style.opacity = fmt === 'png' ? '0.4' : '1';
  qualityGroup.style.pointerEvents = fmt === 'png' ? 'none' : 'auto';
});

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
    dropzone.style.display = 'none';
    editorSection.style.display = 'block';
    
    initMatrixInputs();
    render();
  };
  img.src = state.imgUrl;
}

// ── Rendering ──────────────────────────────────────────────
function render() {
  if (!state.imgElement) return;

  const img = state.imgElement;
  const w = img.naturalWidth;
  const h = img.naturalHeight;

  canvas.width = w;
  canvas.height = h;

  // Clear & Draw base original image
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0);

  // 1. Get raw pixel buffer
  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;
  const m = state.matrix;

  // 2. Loop pixels and apply matrix calculations
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i+1];
    const b = data[i+2];
    const a = data[i+3];

    // Matrix Math
    const nr = r * m[0] + g * m[1] + b * m[2] + a * m[3] + m[4] * 255;
    const ng = r * m[5] + g * m[6] + b * m[7] + a * m[8] + m[9] * 255;
    const nb = r * m[10] + g * m[11] + b * m[12] + a * m[13] + m[14] * 255;
    const na = r * m[15] + g * m[16] + b * m[17] + a * m[18] + m[19] * 255;

    // Clamp results to [0, 255]
    data[i]   = Math.max(0, Math.min(255, nr));
    data[i+1] = Math.max(0, Math.min(255, ng));
    data[i+2] = Math.max(0, Math.min(255, nb));
    data[i+3] = Math.max(0, Math.min(255, na));
  }

  // 3. Write modified pixels back to Canvas
  ctx.putImageData(imgData, 0, 0);
}

// ── Export / Save ──────────────────────────────────────────
async function saveImage() {
  if (!state.imgElement) return;

  btnSave.disabled = true;
  btnSave.textContent = 'Saving…';

  try {
    const fmt = optFormat.value;
    const mimeType = `image/${fmt}`;
    const ext = fmt === 'jpeg' ? 'jpg' : fmt;
    const quality = parseFloat(optQuality.value) / 100;

    canvas.toBlob((blob) => {
      if (!blob) {
        toast('Failed to generate export file.', true);
        btnSave.disabled = false;
        btnSave.textContent = 'Download Image';
        return;
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${state.fileName}-matrix.${ext}`;
      a.click();

      setTimeout(() => URL.revokeObjectURL(url), 5000);
      toast('Custom matrix filter image downloaded!');
      btnSave.disabled = false;
      btnSave.textContent = 'Download Image';
    }, mimeType, fmt === 'png' ? undefined : quality);
  } catch (err) {
    toast('Error exporting image.', true);
    btnSave.disabled = false;
    btnSave.textContent = 'Download Image';
  }
}

// ── Clear / Reset ──────────────────────────────────────────
function clearAll() {
  if (state.imgUrl) {
    URL.revokeObjectURL(state.imgUrl);
    state.imgUrl = null;
  }
  state.file = null;
  state.imgElement = null;

  matrixPreset.value = 'identity';
  state.matrix = [...PRESETS.identity];

  fileInput.value = '';
  dropzone.style.display = 'block';
  editorSection.style.display = 'none';
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
