/**
 * Chronos Toolbox — Add Watermark
 * Places text or graphic watermark layers with rotation, scaling, and drag positioning.
 */

'use strict';

// ── State ──────────────────────────────────────────────────
const state = {
  file:             null,
  fileName:         'watermarked-image',
  imgUrl:           null,
  imgElement:       null, // Main image
  wmType:           'text', // text, image
  wmText:           '© Chronos Toolbox',
  wmFont:           'Outfit',
  wmColor:          '#ffffff',
  wmSize:           32,    // Font size or logo scale width
  wmOpacity:        50,
  wmRotation:       0,
  xPercent:         50,
  yPercent:         50,
  wmImageElement:   null,  // Logo image element
  wmImageUrl:       null
};

// ── DOM refs ───────────────────────────────────────────────
const dropzone         = document.getElementById('dropzone');
const fileInput        = document.getElementById('file-input');
const editorSection    = document.getElementById('editor-section');
const canvasWrapper    = document.getElementById('canvas-wrapper');
const previewImg       = document.getElementById('preview-img');
const overlayContainer = document.getElementById('overlay-container');
const watermarkBlock   = document.getElementById('watermark-block');
const wmTextNode       = document.getElementById('wm-text-node');
const wmImageNode      = document.getElementById('wm-image-node');

// Sidebar Options
const typeText         = document.getElementById('type-text');
const typeImage        = document.getElementById('type-image');
const controlsText     = document.getElementById('controls-text');
const controlsImage    = document.getElementById('controls-image');

const wmTextInput      = document.getElementById('wm-text');
const wmFontSelect     = document.getElementById('wm-font');
const wmColorInput     = document.getElementById('wm-color');
const wmFileInput      = document.getElementById('wm-file-input');

const wmSizeSlider     = document.getElementById('wm-size');
const valWmSize        = document.getElementById('val-wm-size');
const wmOpacitySlider  = document.getElementById('wm-opacity');
const valWmOpacity     = document.getElementById('val-wm-opacity');
const wmRotationSlider = document.getElementById('wm-rotation');
const valWmRotation    = document.getElementById('val-wm-rotation');

const optFormat        = document.getElementById('opt-format');
const optQuality       = document.getElementById('opt-quality');
const qualityGroup     = document.getElementById('quality-group');
const qualityVal       = document.getElementById('quality-val');
const btnSave          = document.getElementById('btn-save');
const btnClear         = document.getElementById('btn-clear');

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

// Type selection
typeText.addEventListener('click', () => toggleType('text'));
typeImage.addEventListener('click', () => toggleType('image'));

// Watermark inputs
wmTextInput.addEventListener('input', () => { state.wmText = wmTextInput.value; updateOverlay(); });
wmFontSelect.addEventListener('change', () => { state.wmFont = wmFontSelect.value; updateOverlay(); });
wmColorInput.addEventListener('input', () => { state.wmColor = wmColorInput.value; updateOverlay(); });
wmFileInput.addEventListener('change', loadWatermarkLogo);

wmSizeSlider.addEventListener('input', () => {
  state.wmSize = parseInt(wmSizeSlider.value);
  valWmSize.textContent = state.wmSize + 'px';
  updateOverlay();
});
wmOpacitySlider.addEventListener('input', () => {
  state.wmOpacity = parseInt(wmOpacitySlider.value);
  valWmOpacity.textContent = state.wmOpacity + '%';
  updateOverlay();
});
wmRotationSlider.addEventListener('input', () => {
  state.wmRotation = parseInt(wmRotationSlider.value);
  valWmRotation.textContent = state.wmRotation + '°';
  updateOverlay();
});

// Dragging action on watermark node
watermarkBlock.addEventListener('mousedown', startDrag);

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
    previewImg.src = state.imgUrl;
    updateOverlay();
  };
  img.src = state.imgUrl;
}

function loadWatermarkLogo() {
  const file = wmFileInput.files[0];
  if (!file || !file.type.startsWith('image/')) {
    toast('Please upload a valid watermark image.', true);
    return;
  }

  if (state.wmImageUrl) URL.revokeObjectURL(state.wmImageUrl);
  state.wmImageUrl = URL.createObjectURL(file);

  const img = new Image();
  img.onload = () => {
    state.wmImageElement = img;
    wmImageNode.src = state.wmImageUrl;
    updateOverlay();
  };
  img.src = state.wmImageUrl;
}

// ── Toggle Text/Image ──────────────────────────────────────
function toggleType(type) {
  state.wmType = type;
  typeText.classList.toggle('active', type === 'text');
  typeImage.classList.toggle('active', type === 'image');
  controlsText.style.display = type === 'text' ? 'block' : 'none';
  controlsImage.style.display = type === 'image' ? 'block' : 'none';

  wmTextNode.style.display = type === 'text' ? 'inline-block' : 'none';
  wmImageNode.style.display = type === 'image' ? 'block' : 'none';

  if (type === 'image' && !state.wmImageElement) {
    toast('Please upload a watermark logo image.');
  }

  updateOverlay();
}

// ── Update CSS Overlay ─────────────────────────────────────
function updateOverlay() {
  if (!state.imgElement) return;

  watermarkBlock.style.left = `${state.xPercent}%`;
  watermarkBlock.style.top = `${state.yPercent}%`;
  watermarkBlock.style.opacity = state.wmOpacity / 100;
  watermarkBlock.style.transform = `translate(-50%, -50%) rotate(${state.wmRotation}deg)`;

  if (state.wmType === 'text') {
    wmTextNode.textContent = state.wmText;
    wmTextNode.style.fontFamily = state.wmFont;
    wmTextNode.style.fontSize = `${state.wmSize}px`;
    wmTextNode.style.color = state.wmColor;
  } else {
    // Resize image logo box
    wmImageNode.style.width = `${state.wmSize}px`;
    wmImageNode.style.height = 'auto';
  }
}

// ── Pointer Drag Listener ──────────────────────────────────
function startDrag(e) {
  e.preventDefault();
  const rect = overlayContainer.getBoundingClientRect();
  
  const startX = e.clientX;
  const startY = e.clientY;
  const startLeft = watermarkBlock.offsetLeft;
  const startTop = watermarkBlock.offsetTop;

  function onPointerMove(moveEvent) {
    const dx = moveEvent.clientX - startX;
    const dy = moveEvent.clientY - startY;

    const newX = startLeft + dx;
    const newY = startTop + dy;

    state.xPercent = Math.max(0, Math.min(100, (newX / rect.width) * 100));
    state.yPercent = Math.max(0, Math.min(100, (newY / rect.height) * 100));

    watermarkBlock.style.left = `${state.xPercent}%`;
    watermarkBlock.style.top = `${state.yPercent}%`;
  }

  function onPointerUp() {
    window.removeEventListener('mousemove', onPointerMove);
    window.removeEventListener('mouseup', onPointerUp);
  }

  window.addEventListener('mousemove', onPointerMove);
  window.addEventListener('mouseup', onPointerUp);
}

// ── Export / Render ────────────────────────────────────────
async function exportImage() {
  if (!state.imgElement) return;

  if (state.wmType === 'image' && !state.wmImageElement) {
    toast('Please upload a watermark logo image first.', true);
    return;
  }

  btnSave.disabled = true;
  btnSave.textContent = 'Saving…';

  try {
    const img = state.imgElement;
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = img.naturalWidth;
    exportCanvas.height = img.naturalHeight;
    const ctx2 = exportCanvas.getContext('2d');

    // Draw main image
    ctx2.drawImage(img, 0, 0);

    const wrapperRect = previewImg.getBoundingClientRect();
    const scaleRatio = img.naturalWidth / wrapperRect.width;

    ctx2.save();
    
    // Position watermark origin
    const x = (state.xPercent / 100) * img.naturalWidth;
    const y = (state.yPercent / 100) * img.naturalHeight;
    ctx2.translate(x, y);

    // Rotate
    ctx2.rotate((state.wmRotation * Math.PI) / 180);

    // Opacity
    ctx2.globalAlpha = state.wmOpacity / 100;

    if (state.wmType === 'text') {
      const scaledSize = state.wmSize * scaleRatio;
      ctx2.font = `600 ${Math.round(scaledSize)}px ${state.wmFont}`;
      ctx2.fillStyle = state.wmColor;
      ctx2.textAlign = 'center';
      ctx2.textBaseline = 'middle';
      ctx2.fillText(state.wmText, 0, 0);
    } else {
      const scaledW = state.wmSize * scaleRatio;
      const logoAspect = state.wmImageElement.naturalWidth / state.wmImageElement.naturalHeight;
      const scaledH = scaledW / logoAspect;
      
      // Draw logo centered on translation origin
      ctx2.drawImage(state.wmImageElement, -scaledW / 2, -scaledH / 2, scaledW, scaledH);
    }

    ctx2.restore();

    const fmt = optFormat.value;
    const mimeType = `image/${fmt}`;
    const ext = fmt === 'jpeg' ? 'jpg' : fmt;
    const quality = parseFloat(optQuality.value) / 100;

    exportCanvas.toBlob((blob) => {
      if (!blob) {
        toast('Failed to render output image.', true);
        btnSave.disabled = false;
        btnSave.textContent = 'Download Watermarked';
        return;
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${state.fileName}-watermarked.${ext}`;
      a.click();

      setTimeout(() => URL.revokeObjectURL(url), 5000);
      toast('Watermarked image downloaded successfully!');
      
      btnSave.disabled = false;
      btnSave.textContent = 'Download Watermarked';
    }, mimeType, fmt === 'png' ? undefined : quality);

  } catch (err) {
    console.error(err);
    toast('Error exporting image.', true);
    btnSave.disabled = false;
    btnSave.textContent = 'Download Watermarked';
  }
}

// ── Clear / Reset ──────────────────────────────────────────
function clearAll() {
  if (state.imgUrl) {
    URL.revokeObjectURL(state.imgUrl);
    state.imgUrl = null;
  }
  if (state.wmImageUrl) {
    URL.revokeObjectURL(state.wmImageUrl);
    state.wmImageUrl = null;
  }
  state.file = null;
  state.imgElement = null;
  state.wmImageElement = null;

  wmFileInput.value = '';
  fileInput.value = '';
  dropzone.style.display = 'block';
  editorSection.style.display = 'none';
  previewImg.src = '';
  wmImageNode.src = '';

  state.xPercent = 50;
  state.yPercent = 50;
  state.wmRotation = 0;
  wmRotationSlider.value = 0;
  valWmRotation.textContent = '0°';
  state.wmOpacity = 50;
  wmOpacitySlider.value = 50;
  valWmOpacity.textContent = '50%';
  state.wmSize = 32;
  wmSizeSlider.value = 32;
  valWmSize.textContent = '32px';
  state.wmText = '© Chronos Toolbox';
  wmTextInput.value = '© Chronos Toolbox';
  
  toggleType('text');
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
