/**
 * Chronos Toolbox — Round / Circle Crop
 * Clips images to a perfect circle outline on the client canvas, supporting transparencies.
 */

'use strict';

// ── State ──────────────────────────────────────────────────
const state = {
  file:       null,
  fileName:   'circle-image',
  imgUrl:     null,
  imgElement: null, // Loaded Image element
  x:          0,    // Center X
  y:          0,    // Center Y
  r:          50    // Radius
};

// ── DOM refs ───────────────────────────────────────────────
const dropzone       = document.getElementById('dropzone');
const fileInput      = document.getElementById('file-input');
const editorSection  = document.getElementById('editor-section');
const canvas         = document.getElementById('preview-canvas');
const ctx            = canvas.getContext('2d');

const inputX         = document.getElementById('center-x');
const valX           = document.getElementById('val-center-x');
const inputY         = document.getElementById('center-y');
const valY           = document.getElementById('val-center-y');
const inputR         = document.getElementById('crop-radius');
const valR           = document.getElementById('val-radius');

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

// Input updates
inputX.addEventListener('input', () => {
  state.x = parseInt(inputX.value);
  valX.textContent = state.x + 'px';
  render();
});
inputY.addEventListener('input', () => {
  state.y = parseInt(inputY.value);
  valY.textContent = state.y + 'px';
  render();
});
inputR.addEventListener('input', () => {
  state.r = parseInt(inputR.value);
  valR.textContent = state.r + 'px';
  render();
});

// Quality slider label
optQuality.addEventListener('input', () => {
  qualityVal.textContent = optQuality.value + '%';
});

// Quality slider visibility
optFormat.addEventListener('change', () => {
  const fmt = optFormat.value;
  qualityGroup.style.opacity = fmt === 'jpeg' ? '1' : '0.4';
  qualityGroup.style.pointerEvents = fmt === 'jpeg' ? 'auto' : 'none';
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

    const w = img.naturalWidth;
    const h = img.naturalHeight;

    // Dynamically set ranges based on image size
    inputX.max = w;
    inputX.value = Math.round(w / 2);
    state.x = Math.round(w / 2);
    valX.textContent = state.x + 'px';

    inputY.max = h;
    inputY.value = Math.round(h / 2);
    state.y = Math.round(h / 2);
    valY.textContent = state.y + 'px';

    const maxRadius = Math.min(w, h) / 2;
    inputR.max = maxRadius;
    inputR.value = Math.round(maxRadius * 0.7);
    state.r = Math.round(maxRadius * 0.7);
    valR.textContent = state.r + 'px';

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

  // Clear
  ctx.clearRect(0, 0, w, h);

  // 1. Draw base original image
  ctx.drawImage(img, 0, 0);

  // 2. Draw semitransparent mask over it
  ctx.fillStyle = 'rgba(14, 29, 33, 0.65)';
  ctx.fillRect(0, 0, w, h);

  // 3. Clear circle crop area (destination-out)
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  ctx.arc(state.x, state.y, state.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // 4. Draw original image under the transparent circle (destination-over)
  ctx.save();
  ctx.globalCompositeOperation = 'destination-over';
  ctx.drawImage(img, 0, 0);
  ctx.restore();

  // 5. Draw highlighted dashed boundary on top (source-over)
  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  ctx.strokeStyle = '#E0B4B2';
  ctx.lineWidth = Math.max(2, Math.round(w / 400));
  ctx.setLineDash([5, 5]);
  ctx.beginPath();
  ctx.arc(state.x, state.y, state.r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

// ── Export / Save ──────────────────────────────────────────
async function saveImage() {
  if (!state.imgElement) return;

  btnSave.disabled = true;
  btnSave.textContent = 'Saving…';

  try {
    const img = state.imgElement;
    const size = state.r * 2;

    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = size;
    exportCanvas.height = size;
    const ctx2 = exportCanvas.getContext('2d');

    const fmt = optFormat.value;
    const mimeType = `image/${fmt}`;
    const ext = fmt === 'jpeg' ? 'jpg' : fmt;
    const quality = parseFloat(optQuality.value) / 100;

    // Fill background for JPG
    if (fmt === 'jpeg') {
      ctx2.fillStyle = '#ffffff';
      ctx2.fillRect(0, 0, size, size);
    }

    ctx2.save();
    // Clip circle
    ctx2.beginPath();
    ctx2.arc(state.r, state.r, state.r, 0, Math.PI * 2);
    ctx2.clip();

    // Draw the segment centered
    ctx2.drawImage(img, state.r - state.x, state.r - state.y);
    ctx2.restore();

    exportCanvas.toBlob((blob) => {
      if (!blob) {
        toast('Failed to generate export file.', true);
        btnSave.disabled = false;
        btnSave.textContent = 'Download Cropped';
        return;
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${state.fileName}-circle.${ext}`;
      a.click();

      setTimeout(() => URL.revokeObjectURL(url), 5000);
      toast('Circular crop downloaded successfully!');
      btnSave.disabled = false;
      btnSave.textContent = 'Download Cropped';
    }, mimeType, fmt === 'jpeg' ? quality : undefined);

  } catch (err) {
    toast('Error exporting image.', true);
    btnSave.disabled = false;
    btnSave.textContent = 'Download Cropped';
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
