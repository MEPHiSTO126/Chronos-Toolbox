/**
 * Chronos Toolbox — Image Converter
 * Processes file uploads on-canvas and outputs PNG, JPG, or WEBP.
 * Packaged with JSZip for bulk downloads.
 */

'use strict';

// ── State ──────────────────────────────────────────────────
const state = {
  files:    [],   // { file, id, name, previewUrl }
  outputs:  [],   // { name, blob, url, ext }
};

// ── DOM refs ───────────────────────────────────────────────
const dropzone         = document.getElementById('dropzone');
const fileInput        = document.getElementById('file-input');
const inputPreviewArea = document.getElementById('input-preview-area');
const inputPreviewGrid = document.getElementById('input-preview-grid');
const inputCountLabel  = document.getElementById('input-count-label');
const optionsPanel     = document.getElementById('options-panel');
const qualityGroup     = document.getElementById('quality-group');
const optQuality       = document.getElementById('opt-quality');
const qualityVal       = document.getElementById('quality-val');
const optFormat        = document.getElementById('opt-format');
const actionBar        = document.getElementById('action-bar');
const btnConvert       = document.getElementById('btn-convert');
const btnClear         = document.getElementById('btn-clear');
const progressWrap     = document.getElementById('progress-wrap');
const progressBar      = document.getElementById('progress-bar');
const progressText     = document.getElementById('progress-text');
const progressPct      = document.getElementById('progress-pct');
const outputArea       = document.getElementById('output-area');
const outputGrid       = document.getElementById('output-grid');
const outputLabel      = document.getElementById('output-label');
const btnDlAll         = document.getElementById('btn-download-all');

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
btnConvert.addEventListener('click', convertAll);
btnDlAll.addEventListener('click', downloadAll);

optFormat.addEventListener('change', () => {
  const fmt = optFormat.value;
  // PNG is lossless, hide quality slider
  qualityGroup.style.opacity = fmt === 'png' ? '0.4' : '1';
  qualityGroup.style.pointerEvents = fmt === 'png' ? 'none' : 'auto';
});

optQuality.addEventListener('input', () => {
  qualityVal.textContent = optQuality.value + '%';
});

// ── File Loading ───────────────────────────────────────────
function addFiles(fileList) {
  if (!fileList.length) return;

  const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/bmp'];

  for (let i = 0; i < fileList.length; i++) {
    const file = fileList[i];

    // Check if it's an image
    if (!file.type.startsWith('image/')) {
      toast(`Skipped "${file.name}" (not an image)`, true);
      continue;
    }

    const previewUrl = URL.createObjectURL(file);
    const id = Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    
    state.files.push({
      file,
      id,
      name: file.name.substring(0, file.name.lastIndexOf('.')) || file.name,
      previewUrl
    });
  }

  renderInputPreviews();
}

function renderInputPreviews() {
  if (!state.files.length) {
    clearAll();
    return;
  }

  inputPreviewGrid.innerHTML = '';
  state.files.forEach((f, idx) => {
    const item = document.createElement('div');
    item.className = 'preview-item';
    item.innerHTML = `
      <span class="preview-item__num">${idx + 1}</span>
      <img src="${f.previewUrl}" alt="Preview" />
      <button class="preview-item__remove" aria-label="Remove item">×</button>
      <div class="preview-item__footer">${f.file.name}</div>
    `;

    // Remove listener
    item.querySelector('.preview-item__remove').addEventListener('click', (e) => {
      e.stopPropagation();
      removeFile(f.id);
    });

    inputPreviewGrid.appendChild(item);
  });

  inputCountLabel.textContent = `Selected Files (${state.files.length})`;
  inputPreviewArea.style.display = 'block';
  optionsPanel.style.display = 'block';
  actionBar.style.display = 'flex';
  outputArea.style.display = 'none';
}

function removeFile(id) {
  const index = state.files.findIndex(f => f.id === id);
  if (index !== -1) {
    URL.revokeObjectURL(state.files[index].previewUrl);
    state.files.splice(index, 1);
  }
  renderInputPreviews();
}

// ── Conversion ─────────────────────────────────────────────
async function convertAll() {
  if (!state.files.length) return;

  const targetFormat = optFormat.value;
  const quality = parseFloat(optQuality.value) / 100;
  const mimeType = `image/${targetFormat}`;
  const ext = targetFormat === 'jpeg' ? 'jpg' : targetFormat;

  state.outputs.forEach(out => URL.revokeObjectURL(out.url));
  state.outputs = [];
  outputGrid.innerHTML = '';
  outputArea.style.display = 'none';

  progressWrap.style.display = 'block';
  btnConvert.disabled = true;
  setProgress(0, 'Preparing…');

  for (let i = 0; i < state.files.length; i++) {
    const item = state.files[i];
    const pct = Math.round((i / state.files.length) * 100);
    setProgress(pct, `Converting: ${item.file.name}…`);

    try {
      const img = await loadImageAsync(item.previewUrl);
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);

      // WebGL/Canvas toBlob
      const blob = await new Promise(res => {
        canvas.toBlob(res, mimeType, targetFormat === 'png' ? undefined : quality);
      });

      const url = URL.createObjectURL(blob);
      const outputName = `${item.name}.${ext}`;

      state.outputs.push({
        name: outputName,
        blob,
        url,
        ext,
        width: canvas.width,
        height: canvas.height
      });

      renderOutputCard(outputName, url, blob.size, canvas.width, canvas.height);
      await sleep(10);
    } catch (err) {
      toast(`Failed to convert ${item.file.name}`, true);
    }
  }

  setProgress(100, 'Conversion complete!');
  await sleep(300);
  progressWrap.style.display = 'none';
  btnConvert.disabled = false;

  outputLabel.textContent = `Converted Files (${state.outputs.length})`;
  outputArea.style.display = 'block';
  btnDlAll.textContent = state.outputs.length === 1 ? '⬇ Download File' : '⬇ Download ZIP';
  outputArea.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderOutputCard(name, url, bytes, w, h) {
  const card = document.createElement('div');
  card.className = 'preview-item';
  card.style.cursor = 'default';
  card.innerHTML = `
    <img src="${url}" alt="Converted" />
    <a class="preview-item__remove" href="${url}" download="${name}" title="Download individual file" style="background:var(--c-rose); color:var(--c-bg); display:flex; align-items:center; justify-content:center; text-decoration:none; font-weight:bold; font-size:1.1rem;">⬇</a>
    <div class="preview-item__footer" style="line-height: 1.3; height:auto; padding: 0.5rem;">
      <div style="font-weight:600; text-overflow:ellipsis; overflow:hidden; white-space:nowrap;">${name}</div>
      <div style="font-size:0.65rem; opacity:0.75;">${w}×${h} · ${formatSize(bytes)}</div>
    </div>
  `;
  outputGrid.appendChild(card);
}

// ── Download Handling ──────────────────────────────────────
async function downloadAll() {
  if (!state.outputs.length) return;

  if (state.outputs.length === 1) {
    // Single file download
    const out = state.outputs[0];
    const a = document.createElement('a');
    a.href = out.url;
    a.download = out.name;
    a.click();
    return;
  }

  // Multi file ZIP download
  const zip = new JSZip();
  state.outputs.forEach(out => {
    zip.file(out.name, out.blob);
  });

  setProgress(0, 'Generating ZIP…');
  progressWrap.style.display = 'block';
  btnDlAll.disabled = true;

  try {
    const content = await zip.generateAsync({ type: 'blob' }, (metadata) => {
      setProgress(Math.round(metadata.percent), 'Zipping files…');
    });

    const zipUrl = URL.createObjectURL(content);
    const a = document.createElement('a');
    a.href = zipUrl;
    a.download = 'chronos-converted-images.zip';
    a.click();

    setTimeout(() => URL.revokeObjectURL(zipUrl), 10000);
  } catch (err) {
    toast('Error creating ZIP archive', true);
  } finally {
    progressWrap.style.display = 'none';
    btnDlAll.disabled = false;
  }
}

// ── Helper Utilities ───────────────────────────────────────
function clearAll() {
  state.files.forEach(f => URL.revokeObjectURL(f.previewUrl));
  state.outputs.forEach(out => URL.revokeObjectURL(out.url));
  state.files = [];
  state.outputs = [];

  fileInput.value = '';
  inputPreviewGrid.innerHTML = '';
  outputGrid.innerHTML = '';
  inputPreviewArea.style.display = 'none';
  optionsPanel.style.display = 'none';
  actionBar.style.display = 'none';
  progressWrap.style.display = 'none';
  outputArea.style.display = 'none';
}

function setProgress(pct, label) {
  progressBar.style.width = pct + '%';
  progressText.textContent = label;
  progressPct.textContent  = pct + '%';
}

function loadImageAsync(url) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = url;
  });
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1024 / 1024).toFixed(2) + ' MB';
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

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
