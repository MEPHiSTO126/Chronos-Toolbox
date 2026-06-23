/**
 * Chronos Toolbox — Rotate & Flip
 * Operates translation, rotation, and mirror scaling transformations on a canvas.
 */

'use strict';

// ── State ──────────────────────────────────────────────────
const state = {
  file:       null,
  fileName:   'transformed-image',
  imgUrl:     null,
  imgElement: null, // Loaded image element
  angle:      0,    // 0, 90, 180, 270
  flipH:      false,
  flipV:      false
};

// ── DOM refs ───────────────────────────────────────────────
const dropzone       = document.getElementById('dropzone');
const fileInput      = document.getElementById('file-input');
const editorSection  = document.getElementById('editor-section');
const canvas         = document.getElementById('preview-canvas');
const ctx            = canvas.getContext('2d');

const btnRotLeft     = document.getElementById('btn-rot-left');
const btnRotRight    = document.getElementById('btn-rot-right');
const btnFlipH       = document.getElementById('btn-flip-h');
const btnFlipV       = document.getElementById('btn-flip-v');
const btnReset       = document.getElementById('btn-reset');

const optFormat      = document.getElementById('opt-format');
const optQuality     = document.getElementById('opt-quality');
const qualityGroup   = document.getElementById('quality-group');
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

// Transform Buttons
btnRotLeft.addEventListener('click', () => {
  state.angle = (state.angle - 90 + 360) % 360;
  render();
});
btnRotRight.addEventListener('click', () => {
  state.angle = (state.angle + 90) % 360;
  render();
});
btnFlipH.addEventListener('click', () => {
  state.flipH = !state.flipH;
  btnFlipH.classList.toggle('active', state.flipH);
  render();
});
btnFlipV.addEventListener('click', () => {
  state.flipV = !state.flipV;
  btnFlipV.classList.toggle('active', state.flipV);
  render();
});
btnReset.addEventListener('click', () => {
  state.angle = 0;
  state.flipH = false;
  state.flipV = false;
  btnFlipH.classList.remove('active');
  btnFlipV.classList.remove('active');
  render();
});

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
    render();
  };
  img.src = state.imgUrl;
}

// ── Canvas Rendering ───────────────────────────────────────
function render() {
  if (!state.imgElement) return;

  const img = state.imgElement;
  const isSwapped = (state.angle === 90 || state.angle === 270);
  
  canvas.width = isSwapped ? img.naturalHeight : img.naturalWidth;
  canvas.height = isSwapped ? img.naturalWidth : img.naturalHeight;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  // Move context origin to center of canvas
  ctx.translate(canvas.width / 2, canvas.height / 2);
  
  // Apply rotation angle
  ctx.rotate((state.angle * Math.PI) / 180);
  
  // Apply scale mirrors
  ctx.scale(state.flipH ? -1 : 1, state.flipV ? -1 : 1);
  
  // Draw image offset by negative half width/height to center it
  ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
  ctx.restore();
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
      a.download = `${state.fileName}-transformed.${ext}`;
      a.click();

      setTimeout(() => URL.revokeObjectURL(url), 5000);
      toast('Transformed image downloaded!');
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
  
  state.angle = 0;
  state.flipH = false;
  state.flipV = false;

  btnFlipH.classList.remove('active');
  btnFlipV.classList.remove('active');

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
