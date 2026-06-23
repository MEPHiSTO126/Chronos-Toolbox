/**
 * Chronos Toolbox — Filters & Effects
 * Applies dynamic adjustments (brightness, contrast, saturation, hue, blur),
 * custom filter presets, pixelation, and text watermarks entirely client-side.
 */

'use strict';

// ── Preset Definitions ─────────────────────────────────────
const PRESETS = {
  none:         { label: 'Normal',        filter: 'none' },
  grayscale:    { label: 'Monochrome',    filter: 'grayscale(100%)' },
  sepia:        { label: 'Warm Sepia',    filter: 'sepia(100%) brightness(95%) contrast(95%)' },
  vintage:      { label: 'Vintage',       filter: 'sepia(35%) contrast(115%) brightness(90%) saturate(85%) hue-rotate(340deg)' },
  invert:       { label: 'Inverted',      filter: 'invert(100%)' },
  highcontrast: { label: 'High Contrast',  filter: 'contrast(165%) brightness(105%)' },
  warm:         { label: 'Warm Glow',     filter: 'sepia(15%) saturate(140%) hue-rotate(5deg)' },
  cool:         { label: 'Cool Dusk',     filter: 'saturate(110%) hue-rotate(185deg) brightness(95%)' }
};

// ── State ──────────────────────────────────────────────────
const state = {
  file:       null,
  fileName:   'edited-image',
  imgUrl:     null,
  imgElement: null, // Loaded image element
  activeTab:  'tab-adjust',
  preset:     'none',
  adjust: {
    brightness: 100,
    contrast: 100,
    saturation: 100,
    hue: 0,
    blur: 0,
    pixelate: 1
  },
  watermark: {
    text: '',
    size: 24,
    opacity: 40,
    color: '#ffffff',
    position: 'bottom-right'
  }
};

// ── DOM refs ───────────────────────────────────────────────
const dropzone         = document.getElementById('dropzone');
const fileInput        = document.getElementById('file-input');
const editorSection    = document.getElementById('editor-section');
const canvas           = document.getElementById('preview-canvas');
const ctx              = canvas.getContext('2d');

// Tabs
const tabBtns          = document.querySelectorAll('.tab-btn');
const tabContents      = document.querySelectorAll('.tab-content');

// Adjustment inputs
const adjBrightness    = document.getElementById('adj-brightness');
const adjContrast      = document.getElementById('adj-contrast');
const adjSaturation    = document.getElementById('adj-saturation');
const adjHue           = document.getElementById('adj-hue');
const adjBlur          = document.getElementById('adj-blur');
const adjPixelate      = document.getElementById('adj-pixelate');

// Adjustment value labels
const valBrightness    = document.getElementById('val-brightness');
const valContrast      = document.getElementById('val-contrast');
const valSaturation    = document.getElementById('val-saturation');
const valHue           = document.getElementById('val-hue');
const valBlur          = document.getElementById('val-blur');
const valPixelate      = document.getElementById('val-pixelate');

// Presets container
const presetsContainer = document.getElementById('presets-container');

// Watermark inputs
const wmText           = document.getElementById('wm-text');
const wmSize           = document.getElementById('wm-size');
const wmOpacity        = document.getElementById('wm-opacity');
const wmColor          = document.getElementById('wm-color');
const wmPosition       = document.getElementById('wm-position');

// Watermark labels
const valWmSize        = document.getElementById('val-wm-size');
const valWmOpacity     = document.getElementById('val-wm-opacity');

// Save / Clear
const btnSave          = document.getElementById('btn-save');
const btnClear         = document.getElementById('btn-clear');
const optFormat        = document.getElementById('opt-format');
const optQuality       = document.getElementById('opt-quality');
const qualityGroup     = document.getElementById('quality-group');
const qualityVal       = document.getElementById('quality-val');

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

// Tabs logic
tabBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    tabBtns.forEach(b => b.classList.remove('active'));
    tabContents.forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.tab).classList.add('active');
  });
});

// Adjustments input events
adjBrightness.addEventListener('input', () => { valBrightness.textContent = adjBrightness.value + '%'; state.adjust.brightness = parseInt(adjBrightness.value); render(); });
adjContrast.addEventListener('input', () => { valContrast.textContent = adjContrast.value + '%'; state.adjust.contrast = parseInt(adjContrast.value); render(); });
adjSaturation.addEventListener('input', () => { valSaturation.textContent = adjSaturation.value + '%'; state.adjust.saturation = parseInt(adjSaturation.value); render(); });
adjHue.addEventListener('input', () => { valHue.textContent = adjHue.value + '°'; state.adjust.hue = parseInt(adjHue.value); render(); });
adjBlur.addEventListener('input', () => { valBlur.textContent = adjBlur.value + 'px'; state.adjust.blur = parseInt(adjBlur.value); render(); });
adjPixelate.addEventListener('input', () => { 
  const p = parseInt(adjPixelate.value);
  valPixelate.textContent = p === 1 ? 'Off' : `${p}px`;
  state.adjust.pixelate = p; 
  render(); 
});

// Watermark input events
wmText.addEventListener('input', () => { state.watermark.text = wmText.value; render(); });
wmSize.addEventListener('input', () => { valWmSize.textContent = wmSize.value + 'px'; state.watermark.size = parseInt(wmSize.value); render(); });
wmOpacity.addEventListener('input', () => { valWmOpacity.textContent = wmOpacity.value + '%'; state.watermark.opacity = parseInt(wmOpacity.value); render(); });
wmColor.addEventListener('input', () => { state.watermark.color = wmColor.value; render(); });
wmPosition.addEventListener('change', () => { state.watermark.position = wmPosition.value; render(); });

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

// ── File Loading ───────────────────────────────────────────
async function loadFile(file) {
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
    
    // Draw initial preset previews
    initPresetCards();
    render();
  };
  img.src = state.imgUrl;
}

// ── Render dynamic preset filter list ──────────────────────
function initPresetCards() {
  presetsContainer.innerHTML = '';
  Object.keys(PRESETS).forEach(key => {
    const p = PRESETS[key];
    const btn = document.createElement('button');
    btn.className = 'filter-preset-btn' + (state.preset === key ? ' active' : '');
    btn.setAttribute('type', 'button');
    
    // Create miniature preview canvas/thumbnail style
    const thumb = document.createElement('div');
    thumb.className = 'filter-preset-btn__thumb';
    thumb.style.backgroundImage = `url(${state.imgUrl})`;
    thumb.style.filter = p.filter;

    const name = document.createElement('span');
    name.className = 'filter-preset-btn__name';
    name.textContent = p.label;

    btn.appendChild(thumb);
    btn.appendChild(name);

    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-preset-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.preset = key;
      render();
    });

    presetsContainer.appendChild(btn);
  });
}

// ── Render on Canvas ────────────────────────────────────────
function render() {
  if (!state.imgElement) return;

  const img = state.imgElement;
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;

  // Clear
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // 1. Apply presets and adjustments filter
  const presetFilter = PRESETS[state.preset].filter;
  const adjFilter = `brightness(${state.adjust.brightness}%) contrast(${state.adjust.contrast}%) saturate(${state.adjust.saturation}%) hue-rotate(${state.adjust.hue}deg) blur(${state.adjust.blur}px)`;
  
  ctx.filter = presetFilter === 'none' ? adjFilter : `${presetFilter} ${adjFilter}`;
  
  // Draw base image with filters
  ctx.drawImage(img, 0, 0);
  ctx.filter = 'none'; // Reset filter

  // 2. Apply Pixelate if active (> 1)
  if (state.adjust.pixelate > 1) {
    const block = state.adjust.pixelate;
    const w = canvas.width;
    const h = canvas.height;
    
    // Save current canvas
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = w;
    tempCanvas.height = h;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(canvas, 0, 0);

    ctx.clearRect(0, 0, w, h);
    ctx.imageSmoothingEnabled = false;

    // Draw downscaled, then upscale it back
    const scale = 1 / block;
    const smallW = Math.max(1, Math.round(w * scale));
    const smallH = Math.max(1, Math.round(h * scale));
    
    const smallCanvas = document.createElement('canvas');
    smallCanvas.width = smallW;
    smallCanvas.height = smallH;
    const smallCtx = smallCanvas.getContext('2d');
    smallCtx.drawImage(tempCanvas, 0, 0, smallW, smallH);

    ctx.drawImage(smallCanvas, 0, 0, smallW, smallH, 0, 0, w, h);
    ctx.imageSmoothingEnabled = true;
  }

  // 3. Apply Watermark Overlay
  if (state.watermark.text.trim()) {
    const wm = state.watermark;
    ctx.save();
    
    // Size relative to image width to keep it consistent
    const scaleFactor = canvas.width / 800; 
    const finalSize = Math.max(10, Math.round(wm.size * scaleFactor));
    ctx.font = `600 ${finalSize}px Outfit, sans-serif`;
    
    // Color with opacity
    ctx.fillStyle = hexToRgba(wm.color, wm.opacity / 100);
    ctx.textBaseline = 'middle';

    const margin = finalSize * 0.8;
    const metrics = ctx.measureText(wm.text);
    const textW = metrics.width;
    const textH = finalSize;

    let x, y;

    switch (wm.position) {
      case 'top-left':
        ctx.textAlign = 'left';
        x = margin;
        y = margin + textH / 2;
        break;
      case 'top-right':
        ctx.textAlign = 'right';
        x = canvas.width - margin;
        y = margin + textH / 2;
        break;
      case 'bottom-left':
        ctx.textAlign = 'left';
        x = margin;
        y = canvas.height - margin - textH / 2;
        break;
      case 'bottom-right':
        ctx.textAlign = 'right';
        x = canvas.width - margin;
        y = canvas.height - margin - textH / 2;
        break;
      case 'center':
      default:
        ctx.textAlign = 'center';
        x = canvas.width / 2;
        y = canvas.height / 2;
        break;
    }

    ctx.fillText(wm.text, x, y);
    ctx.restore();
  }
}

// Helper: Hex color to RGBA
function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
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
      a.download = `${state.fileName}-filtered.${ext}`;
      a.click();

      setTimeout(() => URL.revokeObjectURL(url), 5000);
      toast('Filtered image downloaded!');
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
  state.preset = 'none';
  
  // Reset sliders
  adjBrightness.value = 100; valBrightness.textContent = '100%';
  adjContrast.value = 100; valContrast.textContent = '100%';
  adjSaturation.value = 100; valSaturation.textContent = '100%';
  adjHue.value = 0; valHue.textContent = '0°';
  adjBlur.value = 0; valBlur.textContent = '0px';
  adjPixelate.value = 1; valPixelate.textContent = 'Off';

  state.adjust = { brightness: 100, contrast: 100, saturation: 100, hue: 0, blur: 0, pixelate: 1 };

  // Reset watermark
  wmText.value = '';
  wmSize.value = 24; valWmSize.textContent = '24px';
  wmOpacity.value = 40; valWmOpacity.textContent = '40%';
  wmColor.value = '#ffffff';
  wmPosition.value = 'bottom-right';

  state.watermark = { text: '', size: 24, opacity: 40, color: '#ffffff', position: 'bottom-right' };

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

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
