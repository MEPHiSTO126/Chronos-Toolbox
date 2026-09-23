/**
 * Chronos Toolbox — Background Remover
 * Remove image backgrounds using Remove.bg API.
 */

'use strict';

// ── State ──────────────────────────────────────────────────
const state = {
  file: null,
  fileName: 'no-background',
  imgUrl: null,
  imgElement: null,
  resultBlob: null,
  resultUrl: null,
  isProcessing: false
};

// ── DOM refs ───────────────────────────────────────────────
const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('file-input');
const editorSection = document.getElementById('editor-section');
const previewOriginal = document.getElementById('preview-original');
const previewResult = document.getElementById('preview-result');
const btnRemove = document.getElementById('btn-remove');
const btnClear = document.getElementById('btn-clear');
const btnDownload = document.getElementById('btn-download');
const statusText = document.getElementById('status-text');
const progressWrap = document.getElementById('progress-wrap');
const resultArea = document.getElementById('result-area');
const toleranceSlider = document.getElementById('tolerance-slider');
const toleranceVal = document.getElementById('tolerance-val');
const apiKeyInput = document.getElementById('api-key-input');

if (toleranceSlider && toleranceVal) {
  toleranceSlider.addEventListener('input', () => {
    toleranceVal.textContent = toleranceSlider.value;
  });
}

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

btnRemove.addEventListener('click', removeBackground);
btnClear.addEventListener('click', clearAll);
btnDownload.addEventListener('click', downloadResult);

// ── Loading File ───────────────────────────────────────────
function loadFile(file) {
  if (!file || !file.type.startsWith('image/')) {
    toast('Please upload a valid image file.', true);
    return;
  }

  // Check file size (max 12MB for Remove.bg API)
  if (file.size > 12 * 1024 * 1024) {
    toast('Image must be under 12MB for background removal.', true);
    return;
  }

  state.file = file;
  state.fileName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
  if (state.imgUrl) URL.revokeObjectURL(state.imgUrl);
  state.imgUrl = URL.createObjectURL(file);
  if (state.resultUrl) { URL.revokeObjectURL(state.resultUrl); state.resultUrl = null; }

  const img = new Image();
  img.onload = () => {
    state.imgElement = img;
    previewOriginal.src = state.imgUrl;
    previewResult.src = '';
    dropzone.style.display = 'none';
    editorSection.style.display = 'block';
    resultArea.style.display = 'none';
    state.resultBlob = null;
  };
  img.src = state.imgUrl;
}

// ── Background Removal ─────────────────────────────────────
async function removeBackground() {
  if (!state.file || state.isProcessing) return;

  const apiKey = apiKeyInput?.value?.trim();
  const tolerance = parseInt(toleranceSlider?.value || '40', 10);

  state.isProcessing = true;
  btnRemove.disabled = true;
  btnRemove.textContent = 'Removing...';
  progressWrap.style.display = 'block';
  resultArea.style.display = 'none';

  try {
    if (apiKey) {
      statusText.textContent = 'Sending image to Remove.bg API...';
      const formData = new FormData();
      formData.append('image_file', state.file);
      formData.append('size', 'auto');

      const response = await fetch('https://api.remove.bg/v1.0/removebg', {
        method: 'POST',
        headers: { 'X-Api-Key': apiKey },
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.errors?.[0]?.title || `API error: ${response.status}`);
      }

      state.resultBlob = await response.blob();
      if (state.resultUrl) URL.revokeObjectURL(state.resultUrl);
      state.resultUrl = URL.createObjectURL(state.resultBlob);
      previewResult.src = state.resultUrl;
      resultArea.style.display = 'block';
      statusText.textContent = 'Background removed successfully (Remove.bg AI)!';
      toast('Background removed!');
    } else {
      statusText.textContent = 'Removing background...';
      const fallbackBlob = await clientSideRemoval(state.file, tolerance);
      state.resultBlob = fallbackBlob;
      if (state.resultUrl) URL.revokeObjectURL(state.resultUrl);
      state.resultUrl = URL.createObjectURL(fallbackBlob);
      previewResult.src = state.resultUrl;
      resultArea.style.display = 'block';
      statusText.textContent = 'Background removed!';
      toast('Background removed!');
    }
  } catch (err) {
    console.error('Background Removal Error:', err);
    toast(`Error: ${err.message}`, true);
    statusText.textContent = 'Removal failed';
  } finally {
    state.isProcessing = false;
    btnRemove.disabled = false;
    btnRemove.textContent = 'Remove Background';
    progressWrap.style.display = 'none';
  }
}

// ── Client-side removal (Boundary Flood-Fill + Alpha Feathering) ──
async function clientSideRemoval(file, tolerance = 40) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const width = img.width;
      const height = img.height;
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, width, height);
      const data = imageData.data;

      // Sample border pixels to establish true background color
      const bgColor = getBackgroundColor(data, width, height);
      const bgR = bgColor.r, bgG = bgColor.g, bgB = bgColor.b;

      // Distance calculation helper
      function colorDist(idx) {
        const dr = data[idx] - bgR;
        const dg = data[idx + 1] - bgG;
        const db = data[idx + 2] - bgB;
        return Math.sqrt(dr * dr + dg * dg + db * db);
      }

      // 2D visited map for flood fill starting strictly from borders
      const visited = new Uint8Array(width * height);
      const queue = new Int32Array(width * height);
      let head = 0;
      let tail = 0;

      function enqueue(x, y) {
        const pIndex = y * width + x;
        if (visited[pIndex]) return;
        const d = colorDist(pIndex * 4);
        if (d <= tolerance * 1.35) {
          visited[pIndex] = 1;
          queue[tail++] = pIndex;
        }
      }

      // Seed all 4 borders (top, bottom, left, right)
      for (let x = 0; x < width; x++) {
        enqueue(x, 0);
        enqueue(x, height - 1);
      }
      for (let y = 0; y < height; y++) {
        enqueue(0, y);
        enqueue(width - 1, y);
      }

      // Flood fill outward from borders (4-way connectivity)
      const dx = [1, -1, 0, 0];
      const dy = [0, 0, 1, -1];

      while (head < tail) {
        const pIndex = queue[head++];
        const px = pIndex % width;
        const py = Math.floor(pIndex / width);
        const d = colorDist(pIndex * 4);

        // Alpha calculation: transparent for core background, feathered on borders
        if (d <= tolerance) {
          data[pIndex * 4 + 3] = 0;
        } else {
          // Feathered alpha transition between tolerance and tolerance * 1.35
          const factor = (d - tolerance) / (tolerance * 0.35);
          data[pIndex * 4 + 3] = Math.round(Math.min(255, Math.max(0, factor * 255)));
        }

        // Traverse neighbors
        for (let i = 0; i < 4; i++) {
          const nx = px + dx[i];
          const ny = py + dy[i];
          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            enqueue(nx, ny);
          }
        }
      }

      ctx.putImageData(imageData, 0, 0);
      canvas.toBlob(blob => {
        if (blob) resolve(blob);
        else reject(new Error('Failed to create blob'));
      }, 'image/png');
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = state.imgUrl;
  });
}

// ── Get background color from border samples ────────────────
function getBackgroundColor(data, width, height) {
  let r = 0, g = 0, b = 0, count = 0;
  const sampleStep = Math.max(1, Math.floor(width / 20));

  for (let x = 0; x < width; x += sampleStep) {
    const topIdx = x * 4;
    const botIdx = ((height - 1) * width + x) * 4;
    r += data[topIdx] + data[botIdx];
    g += data[topIdx + 1] + data[botIdx + 1];
    b += data[topIdx + 2] + data[botIdx + 2];
    count += 2;
  }

  return {
    r: Math.round(r / count),
    g: Math.round(g / count),
    b: Math.round(b / count)
  };
}

// ── Download Result ────────────────────────────────────────
function downloadResult() {
  if (!state.resultBlob) return;

  const url = URL.createObjectURL(state.resultBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${state.fileName}-no-bg.png`;
  a.click();

  setTimeout(() => URL.revokeObjectURL(url), 5000);
  toast('Downloaded!');
}

// ── Clear / Reset ──────────────────────────────────────────
function clearAll() {
  if (state.imgUrl) {
    URL.revokeObjectURL(state.imgUrl);
    state.imgUrl = null;
  }
  if (state.resultBlob) {
    state.resultBlob = null;
  }
  if (state.resultUrl) {
    URL.revokeObjectURL(state.resultUrl);
    state.resultUrl = null;
  }
  state.file = null;
  state.imgElement = null;

  fileInput.value = '';
  statusText.textContent = 'Ready to remove background';
  dropzone.style.display = 'block';
  editorSection.style.display = 'none';
  resultArea.style.display = 'none';
  progressWrap.style.display = 'none';
}

// ── Toast Helper ───────────────────────────────────────────
function toast(msg, isError = false) {
  document.querySelector('.ct-toast')?.remove();
  const el = document.createElement('div');
  el.setAttribute("role", "status");
  el.setAttribute("aria-live", "polite");
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