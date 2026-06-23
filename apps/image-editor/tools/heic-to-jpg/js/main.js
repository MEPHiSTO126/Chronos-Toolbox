/**
 * Chronos Toolbox — HEIC to JPG
 * Decodes Apple HEIC/HEIF format files using heic2any on-the-fly in the browser.
 */

'use strict';

// ── State ──────────────────────────────────────────────────
const state = {
  files:    [],   // { file, id, name }
  outputs:  [],   // { name, blob, url }
};

// ── DOM refs ───────────────────────────────────────────────
const dropzone         = document.getElementById('dropzone');
const fileInput        = document.getElementById('file-input');
const inputPreviewArea = document.getElementById('input-preview-area');
const inputPreviewGrid = document.getElementById('input-preview-grid');
const inputCountLabel  = document.getElementById('input-count-label');
const optionsPanel     = document.getElementById('options-panel');
const optQuality       = document.getElementById('opt-quality');
const qualityVal       = document.getElementById('quality-val');
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

optQuality.addEventListener('input', () => {
  qualityVal.textContent = optQuality.value + '%';
});

// ── File Loading ───────────────────────────────────────────
function addFiles(fileList) {
  if (!fileList.length) return;

  for (let i = 0; i < fileList.length; i++) {
    const file = fileList[i];
    const nameLower = file.name.toLowerCase();

    // Verify file extension
    if (!nameLower.endsWith('.heic') && !nameLower.endsWith('.heif')) {
      toast(`Skipped "${file.name}" (not a HEIC/HEIF file)`, true);
      continue;
    }

    const id = Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    
    state.files.push({
      file,
      id,
      name: file.name.substring(0, file.name.lastIndexOf('.')) || file.name,
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
      <div style="flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; background:#1b3840; border-bottom:1px solid var(--clr-border);">
        <span style="font-size:2rem; margin-bottom:0.25rem;">📱</span>
        <span style="font-size:0.6rem; font-weight:700; background:var(--badge-heic); color:#fff; border-radius:3px; padding:0.1rem 0.35rem; text-transform:uppercase;">HEIC</span>
      </div>
      <button class="preview-item__remove" aria-label="Remove item">×</button>
      <div class="preview-item__footer">${f.file.name}</div>
    `;

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
    state.files.splice(index, 1);
  }
  renderInputPreviews();
}

// ── Conversion ─────────────────────────────────────────────
async function convertAll() {
  if (!state.files.length) return;

  const quality = parseFloat(optQuality.value) / 100;

  state.outputs.forEach(out => URL.revokeObjectURL(out.url));
  state.outputs = [];
  outputGrid.innerHTML = '';
  outputArea.style.display = 'none';

  progressWrap.style.display = 'block';
  btnConvert.disabled = true;
  setProgress(0, 'Initializing HEIC decoder…');

  for (let i = 0; i < state.files.length; i++) {
    const item = state.files[i];
    const pct = Math.round((i / state.files.length) * 100);
    setProgress(pct, `Converting HEIC: ${item.file.name}…`);

    try {
      // Decode HEIC blob to JPEG blob client side
      const jpegBlob = await heic2any({
        blob: item.file,
        toType: 'image/jpeg',
        quality: quality
      });

      // heic2any can return an array of blobs if container has multiple images
      const singleBlob = Array.isArray(jpegBlob) ? jpegBlob[0] : jpegBlob;
      const url = URL.createObjectURL(singleBlob);
      const outputName = `${item.name}.jpg`;

      // Get dimensions by loading image object
      const img = await loadImageAsync(url);

      state.outputs.push({
        name: outputName,
        blob: singleBlob,
        url,
        width: img.naturalWidth,
        height: img.naturalHeight
      });

      renderOutputCard(outputName, url, singleBlob.size, img.naturalWidth, img.naturalHeight);
      await sleep(10);
    } catch (err) {
      console.error(err);
      toast(`Failed to convert ${item.file.name}. Ensure it's a valid HEIC photo.`, true);
    }
  }

  setProgress(100, 'Conversion complete!');
  await sleep(300);
  progressWrap.style.display = 'none';
  btnConvert.disabled = false;

  outputLabel.textContent = `Converted Files (${state.outputs.length})`;
  outputArea.style.display = 'block';
  btnDlAll.textContent = state.outputs.length === 1 ? '⬇ Download JPG' : '⬇ Download ZIP';
  outputArea.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderOutputCard(name, url, bytes, w, h) {
  const card = document.createElement('div');
  card.className = 'preview-item';
  card.style.cursor = 'default';
  card.innerHTML = `
    <img src="${url}" alt="Converted" />
    <a class="preview-item__remove" href="${url}" download="${name}" title="Download JPG file" style="background:var(--c-rose); color:var(--c-bg); display:flex; align-items:center; justify-content:center; text-decoration:none; font-weight:bold; font-size:1.1rem;">⬇</a>
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
    const out = state.outputs[0];
    const a = document.createElement('a');
    a.href = out.url;
    a.download = out.name;
    a.click();
    return;
  }

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
    a.download = 'chronos-heic-converted.zip';
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
  state.files = [];
  state.outputs.forEach(out => URL.revokeObjectURL(out.url));
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
