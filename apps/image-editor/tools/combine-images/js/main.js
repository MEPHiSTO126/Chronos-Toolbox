/**
 * Chronos Toolbox — Combine Images
 * Merges multiple photos into horizontal strips, vertical stacks, or grid collages.
 * Supports drag-and-drop thumbnail sorting using native HTML5 drag events.
 */

'use strict';

// ── State ──────────────────────────────────────────────────
const state = {
  files:     [], // { id, name, previewUrl, imgElement }
  layout:    'grid', // grid, horizontal, vertical
  gap:       10,
  bgColor:   '#0e1d21'
};

// ── DOM refs ───────────────────────────────────────────────
const dropzone         = document.getElementById('dropzone');
const fileInput        = document.getElementById('file-input');
const inputPreviewArea = document.getElementById('input-preview-area');
const inputPreviewGrid = document.getElementById('input-preview-grid');
const editorSection    = document.getElementById('editor-section');
const canvas           = document.getElementById('preview-canvas');
const ctx              = canvas.getContext('2d');

// Layout selections
const layoutBtns       = document.querySelectorAll('[data-layout]');
const layoutGap        = document.getElementById('layout-gap');
const valGap           = document.getElementById('val-gap');
const bgColor          = document.getElementById('bg-color');

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
  addFiles(e.dataTransfer.files);
});
fileInput.addEventListener('change', () => addFiles(fileInput.files));
btnClear.addEventListener('click', clearAll);
btnSave.addEventListener('click', saveCollage);

// Layout button switches
layoutBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    layoutBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.layout = btn.dataset.layout;
    render();
  });
});

layoutGap.addEventListener('input', () => {
  state.gap = parseInt(layoutGap.value);
  valGap.textContent = state.gap + 'px';
  render();
});

bgColor.addEventListener('input', () => {
  state.bgColor = bgColor.value;
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

// ── File Loading ───────────────────────────────────────────
async function addFiles(fileList) {
  if (!fileList.length) return;

  toast('Loading images…');

  for (let i = 0; i < fileList.length; i++) {
    const file = fileList[i];

    if (!file.type.startsWith('image/')) {
      toast(`Skipped "${file.name}" (not an image)`, true);
      continue;
    }

    const previewUrl = URL.createObjectURL(file);
    const id = Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    
    try {
      const imgElement = await loadImageAsync(previewUrl);
      state.files.push({
        id,
        name: file.name,
        previewUrl,
        imgElement
      });
    } catch (err) {
      toast(`Failed to load ${file.name}`, true);
    }
  }

  dropzone.style.display = 'none';
  editorSection.style.display = 'block';
  renderInputPreviews();
  render();
}

// ── Drag & Drop Reordering ─────────────────────────────────
function renderInputPreviews() {
  if (!state.files.length) {
    clearAll();
    return;
  }

  inputPreviewGrid.innerHTML = '';
  state.files.forEach((f, idx) => {
    const item = document.createElement('div');
    item.className = 'preview-item';
    item.setAttribute('draggable', 'true');
    item.id = `thumb-${f.id}`;
    item.innerHTML = `
      <span class="preview-item__num">${idx + 1}</span>
      <img src="${f.previewUrl}" alt="Thumbnail" draggable="false" />
      <button class="preview-item__remove" aria-label="Remove item">×</button>
      <div class="preview-item__footer">${f.name}</div>
    `;

    // Hook remove listener
    item.querySelector('.preview-item__remove').addEventListener('click', (e) => {
      e.stopPropagation();
      removeFile(f.id);
    });

    // Native Drag events
    item.addEventListener('dragstart', (e) => {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', f.id);
      item.classList.add('dragging');
    });

    item.addEventListener('dragend', () => {
      item.classList.remove('dragging');
      document.querySelectorAll('.preview-item').forEach(el => el.classList.remove('drag-over'));
    });

    item.addEventListener('dragover', (e) => {
      e.preventDefault();
      item.classList.add('drag-over');
    });

    item.addEventListener('dragleave', () => {
      item.classList.remove('drag-over');
    });

    item.addEventListener('drop', (e) => {
      e.preventDefault();
      item.classList.remove('drag-over');
      const sourceId = e.dataTransfer.getData('text/plain');
      if (sourceId !== f.id) {
        reorderFiles(sourceId, f.id);
      }
    });

    inputPreviewGrid.appendChild(item);
  });

  inputPreviewArea.style.display = 'block';
}

function reorderFiles(sourceId, targetId) {
  const sourceIndex = state.files.findIndex(f => f.id === sourceId);
  const targetIndex = state.files.findIndex(f => f.id === targetId);

  if (sourceIndex !== -1 && targetIndex !== -1) {
    const [moved] = state.files.splice(sourceIndex, 1);
    state.files.splice(targetIndex, 0, moved);
    renderInputPreviews();
    render();
  }
}

function removeFile(id) {
  const idx = state.files.findIndex(f => f.id === id);
  if (idx !== -1) {
    URL.revokeObjectURL(state.files[idx].previewUrl);
    state.files.splice(idx, 1);
  }
  renderInputPreviews();
  render();
}

// ── Rendering Collage Layout ───────────────────────────────
function render() {
  if (!state.files.length) return;

  const N = state.files.length;
  const gap = state.gap;

  if (state.layout === 'horizontal') {
    // 1. Uniform target height
    const targetHeight = 600;
    let totalWidth = 0;
    const dims = [];

    state.files.forEach(f => {
      const img = f.imgElement;
      const aspect = img.naturalWidth / img.naturalHeight;
      const w = Math.round(targetHeight * aspect);
      dims.push({ w, h: targetHeight });
      totalWidth += w;
    });

    totalWidth += gap * (N - 1);
    canvas.width = totalWidth;
    canvas.height = targetHeight;

    // Fill Background
    ctx.fillStyle = state.bgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw
    let currentX = 0;
    state.files.forEach((f, idx) => {
      const d = dims[idx];
      ctx.drawImage(f.imgElement, currentX, 0, d.w, d.h);
      currentX += d.w + gap;
    });

  } else if (state.layout === 'vertical') {
    // 2. Uniform target width
    const targetWidth = 800;
    let totalHeight = 0;
    const dims = [];

    state.files.forEach(f => {
      const img = f.imgElement;
      const aspect = img.naturalWidth / img.naturalHeight;
      const h = Math.round(targetWidth / aspect);
      dims.push({ w: targetWidth, h });
      totalHeight += h;
    });

    totalHeight += gap * (N - 1);
    canvas.width = targetWidth;
    canvas.height = totalHeight;

    // Fill Background
    ctx.fillStyle = state.bgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw
    let currentY = 0;
    state.files.forEach((f, idx) => {
      const d = dims[idx];
      ctx.drawImage(f.imgElement, 0, currentY, d.w, d.h);
      currentY += d.h + gap;
    });

  } else if (state.layout === 'grid') {
    // 3. Grid Mode (Uniform Cells of 400x400)
    const cellSize = 400;
    const cols = Math.ceil(Math.sqrt(N));
    const rows = Math.ceil(N / cols);

    canvas.width = cols * cellSize + (cols - 1) * gap;
    canvas.height = rows * cellSize + (rows - 1) * gap;

    // Fill Background
    ctx.fillStyle = state.bgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw grid cover tiles
    state.files.forEach((f, idx) => {
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      
      const x = col * (cellSize + gap);
      const y = row * (cellSize + gap);

      drawImageCover(ctx, f.imgElement, x, y, cellSize, cellSize);
    });
  }
}

// Helper: Custom Object-fit Cover drawer on Canvas
function drawImageCover(ctx, img, x, y, w, h) {
  const imgAspect = img.naturalWidth / img.naturalHeight;
  const targetAspect = w / h;
  let sx, sy, sw, sh;

  if (imgAspect > targetAspect) {
    sh = img.naturalHeight;
    sw = sh * targetAspect;
    sx = (img.naturalWidth - sw) / 2;
    sy = 0;
  } else {
    sw = img.naturalWidth;
    sh = sw / targetAspect;
    sx = 0;
    sy = (img.naturalHeight - sh) / 2;
  }

  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

// ── Export / Save ──────────────────────────────────────────
async function saveCollage() {
  if (!state.files.length) return;

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
        btnSave.textContent = 'Export Collage';
        return;
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `combined-collage.${ext}`;
      a.click();

      setTimeout(() => URL.revokeObjectURL(url), 5000);
      toast('Collage exported successfully!');
      btnSave.disabled = false;
      btnSave.textContent = 'Export Collage';
    }, mimeType, fmt === 'png' ? undefined : quality);
  } catch (err) {
    toast('Error exporting collage.', true);
    btnSave.disabled = false;
    btnSave.textContent = 'Export Collage';
  }
}

// ── Clear / Reset ──────────────────────────────────────────
function clearAll() {
  state.files.forEach(f => URL.revokeObjectURL(f.previewUrl));
  state.files = [];

  fileInput.value = '';
  inputPreviewGrid.innerHTML = '';
  inputPreviewArea.style.display = 'none';
  dropzone.style.display = 'block';
  editorSection.style.display = 'none';

  layoutBtns.forEach(b => b.classList.remove('active'));
  document.getElementById('layout-grid').classList.add('active');
  state.layout = 'grid';
  layoutGap.value = 10;
  valGap.textContent = '10px';
  state.gap = 10;
  bgColor.value = '#0e1d21';
  state.bgColor = '#0e1d21';
}

function loadImageAsync(url) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = url;
  });
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
