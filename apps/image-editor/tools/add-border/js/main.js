/**
 * Chronos Toolbox — Add Border / Frame
 * Creates solid borders, inset frames, drop-shadow margins, and rounded corner cuts.
 */

'use strict';

// ── State ──────────────────────────────────────────────────
const state = {
  file:       null,
  fileName:   'framed-image',
  imgUrl:     null,
  imgElement: null // Loaded Image element
};

// ── DOM refs ───────────────────────────────────────────────
const dropzone       = document.getElementById('dropzone');
const fileInput      = document.getElementById('file-input');
const editorSection  = document.getElementById('editor-section');
const canvas         = document.getElementById('preview-canvas');
const ctx            = canvas.getContext('2d');

const borderType     = document.getElementById('border-type');
const borderWidth    = document.getElementById('border-width');
const valBorderWidth = document.getElementById('val-border-width');
const borderColor    = document.getElementById('border-color');
const borderRadius   = document.getElementById('border-radius');
const valBorderRad   = document.getElementById('val-border-radius');

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
borderType.addEventListener('change', () => {
  const type = borderType.value;
  // If shadow is selected, border-color acts as shadow color
  document.getElementById('row-width').style.display = 'block';
  document.getElementById('row-color').style.display = 'block';
  render();
});

borderWidth.addEventListener('input', () => {
  valBorderWidth.textContent = borderWidth.value + 'px';
  render();
});

borderColor.addEventListener('input', render);

borderRadius.addEventListener('input', () => {
  valBorderRad.textContent = borderRadius.value + 'px';
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

// ── Rendering ──────────────────────────────────────────────
function render() {
  if (!state.imgElement) return;

  const img = state.imgElement;
  const type = borderType.value;
  const wVal = parseInt(borderWidth.value);
  const color = borderColor.value;
  const radVal = parseInt(borderRadius.value);

  // 1. Calculate Canvas size
  if (type === 'solid') {
    canvas.width = img.naturalWidth + 2 * wVal;
    canvas.height = img.naturalHeight + 2 * wVal;
  } else if (type === 'inset') {
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
  } else if (type === 'shadow') {
    // Padded to fit drop shadow spread blur
    canvas.width = img.naturalWidth + wVal * 2;
    canvas.height = img.naturalHeight + wVal * 2;
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 2. Draw border style
  if (type === 'solid') {
    // Fill background with border color
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    // Clip rounded image inside
    if (radVal > 0) {
      drawRoundRectPath(ctx, wVal, wVal, img.naturalWidth, img.naturalHeight, radVal);
      ctx.clip();
    }
    ctx.drawImage(img, wVal, wVal);
    ctx.restore();

  } else if (type === 'inset') {
    ctx.save();
    // Clip corner roundness of the entire base image
    if (radVal > 0) {
      drawRoundRectPath(ctx, 0, 0, canvas.width, canvas.height, radVal);
      ctx.clip();
    }
    ctx.drawImage(img, 0, 0);
    ctx.restore();

    // Draw inset outline
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = wVal;
    
    if (radVal > 0) {
      // Offset path slightly inside by half-line width to keep line sharp
      drawRoundRectPath(ctx, wVal/2, wVal/2, canvas.width - wVal, canvas.height - wVal, Math.max(0, radVal - wVal/2));
      ctx.stroke();
    } else {
      ctx.strokeRect(wVal/2, wVal/2, canvas.width - wVal, canvas.height - wVal);
    }
    ctx.restore();

  } else if (type === 'shadow') {
    ctx.save();
    
    // Configure shadow options
    ctx.shadowColor = color;
    ctx.shadowBlur = wVal;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = wVal / 3;

    // Clip rounded path of the image inside
    const x = wVal;
    const y = wVal;
    const w = img.naturalWidth;
    const h = img.naturalHeight;

    if (radVal > 0) {
      drawRoundRectPath(ctx, x, y, w, h, radVal);
      ctx.clip();
    }
    ctx.drawImage(img, x, y);
    ctx.restore();
  }
}

// Helper: Custom rounded rectangle path generator
function drawRoundRectPath(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2); // Prevent radius overlapping bounds
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
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
        btnSave.textContent = 'Download Framed';
        return;
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${state.fileName}-framed.${ext}`;
      a.click();

      setTimeout(() => URL.revokeObjectURL(url), 5000);
      toast('Framed image downloaded!');
      btnSave.disabled = false;
      btnSave.textContent = 'Download Framed';
    }, mimeType, fmt === 'png' ? undefined : quality);
  } catch (err) {
    toast('Error exporting image.', true);
    btnSave.disabled = false;
    btnSave.textContent = 'Download Framed';
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

  borderType.value = 'solid';
  borderWidth.value = 20;
  valBorderWidth.textContent = '20px';
  borderColor.value = '#ffffff';
  borderRadius.value = 0;
  valBorderRad.textContent = '0px';

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
