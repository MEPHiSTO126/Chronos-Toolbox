/**
 * Chronos Toolbox — Crop & Resize
 * Employs CropperJS to enable drag-and-crop editing, combined with canvas scaling for resizing.
 */

'use strict';

// ── State ──────────────────────────────────────────────────
let cropper     = null;
let originalImg = null; // HTMLImageElement
let fileBlobUrl = null;
let fileName    = 'edited-image';
let isSyncing   = false;

// ── DOM refs ───────────────────────────────────────────────
const dropzone       = document.getElementById('dropzone');
const fileInput      = document.getElementById('file-input');
const editorSection  = document.getElementById('editor-section');
const imgToEdit      = document.getElementById('image-to-edit');
const ratioBtns      = document.querySelectorAll('[data-ratio]');
const resizeW        = document.getElementById('resize-w');
const resizeH        = document.getElementById('resize-h');
const resizeAspect   = document.getElementById('resize-aspect');
const optFormat      = document.getElementById('opt-format');
const qualityGroup   = document.getElementById('quality-group');
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
btnSave.addEventListener('click', exportImage);

// Ratio buttons
ratioBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    ratioBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    const ratio = parseFloat(btn.dataset.ratio);
    if (cropper) {
      cropper.setAspectRatio(isNaN(ratio) ? NaN : ratio);
    }
  });
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

// Sync resize inputs
resizeW.addEventListener('input', () => {
  if (isSyncing || !cropper) return;
  syncDimension('w');
});
resizeH.addEventListener('input', () => {
  if (isSyncing || !cropper) return;
  syncDimension('h');
});

// ── Loading File ───────────────────────────────────────────
function loadFile(file) {
  if (!file || !file.type.startsWith('image/')) {
    toast('Please upload a valid image file.', true);
    return;
  }

  fileName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
  if (fileBlobUrl) URL.revokeObjectURL(fileBlobUrl);
  fileBlobUrl = URL.createObjectURL(file);

  dropzone.style.display = 'none';
  editorSection.style.display = 'block';

  imgToEdit.src = fileBlobUrl;
  imgToEdit.onload = () => {
    initCropper();
  };
}

// ── Init CropperJS ─────────────────────────────────────────
function initCropper() {
  if (cropper) {
    cropper.destroy();
  }

  cropper = new Cropper(imgToEdit, {
    viewMode: 1,
    dragMode: 'move',
    autoCropArea: 0.9,
    restore: false,
    modal: true,
    guides: true,
    highlight: false,
    cropBoxMovable: true,
    cropBoxResizable: true,
    toggleDragModeOnDblclick: false,
    crop(event) {
      // Sync cropper dimensions to inputs
      if (isSyncing) return;
      isSyncing = true;
      resizeW.value = Math.round(event.detail.width);
      resizeH.value = Math.round(event.detail.height);
      isSyncing = false;
    }
  });
}

function syncDimension(changed) {
  isSyncing = true;
  const w = parseFloat(resizeW.value) || 0;
  const h = parseFloat(resizeH.value) || 0;

  const data = cropper.getData();
  const originalAspect = data.width / data.height;

  if (resizeAspect.checked) {
    if (changed === 'w') {
      const newH = Math.round(w / originalAspect);
      resizeH.value = newH;
    } else {
      const newW = Math.round(h * originalAspect);
      resizeW.value = newW;
    }
  }

  // Update cropper cropbox coordinates if width/height changed manually
  const updatedW = parseFloat(resizeW.value) || data.width;
  const updatedH = parseFloat(resizeH.value) || data.height;

  cropper.setData({
    width: updatedW,
    height: updatedH
  });

  isSyncing = false;
}

// ── Exporting ──────────────────────────────────────────────
async function exportImage() {
  if (!cropper) return;

  btnSave.disabled = true;
  btnSave.textContent = 'Exporting…';

  try {
    // Get cropped canvas
    const croppedCanvas = cropper.getCroppedCanvas({
      imageSmoothingEnabled: true,
      imageSmoothingQuality: 'high',
    });

    if (!croppedCanvas) {
      throw new Error('Canvas generation failed');
    }

    const finalW = parseInt(resizeW.value) || croppedCanvas.width;
    const finalH = parseInt(resizeH.value) || croppedCanvas.height;

    // Scale canvas to user's final dimensions
    const outputCanvas = document.createElement('canvas');
    outputCanvas.width = finalW;
    outputCanvas.height = finalH;
    const ctx = outputCanvas.getContext('2d');
    
    // Draw cropped region onto scaled target canvas
    ctx.drawImage(croppedCanvas, 0, 0, finalW, finalH);

    const fmt = optFormat.value;
    const mimeType = `image/${fmt}`;
    const ext = fmt === 'jpeg' ? 'jpg' : fmt;
    const quality = parseFloat(optQuality.value) / 100;

    outputCanvas.toBlob((blob) => {
      if (!blob) {
        toast('Failed to render export file.', true);
        btnSave.disabled = false;
        btnSave.textContent = 'Export & Download';
        return;
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${fileName}-resized.${ext}`;
      a.click();

      setTimeout(() => URL.revokeObjectURL(url), 5000);
      toast('Image exported successfully!');
      
      btnSave.disabled = false;
      btnSave.textContent = 'Export & Download';
    }, mimeType, fmt === 'png' ? undefined : quality);

  } catch (err) {
    console.error(err);
    toast('Error exporting image.', true);
    btnSave.disabled = false;
    btnSave.textContent = 'Export & Download';
  }
}

// ── Clear / Reset ──────────────────────────────────────────
function clearAll() {
  if (cropper) {
    cropper.destroy();
    cropper = null;
  }
  if (fileBlobUrl) {
    URL.revokeObjectURL(fileBlobUrl);
    fileBlobUrl = null;
  }
  
  fileInput.value = '';
  dropzone.style.display = 'block';
  editorSection.style.display = 'none';
  imgToEdit.src = '';
  
  ratioBtns.forEach(b => b.classList.remove('active'));
  document.getElementById('ratio-free').classList.add('active');

  resizeW.value = '';
  resizeH.value = '';
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
