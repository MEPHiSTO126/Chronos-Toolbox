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

  state.isProcessing = true;
  btnRemove.disabled = true;
  btnRemove.textContent = 'Removing...';
  progressWrap.style.display = 'block';
  statusText.textContent = 'Sending image to Remove.bg...';
  resultArea.style.display = 'none';

  try {
    const formData = new FormData();
    formData.append('image_file', state.file);
    formData.append('size', 'auto');

    // Use free demo API endpoint (rate limited)
    const response = await fetch('https://api.remove.bg/v1.0/removebg', {
      method: 'POST',
      headers: {
        'X-Api-Key': 'demo' // Free demo key (limited usage)
      },
      body: formData
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.errors?.[0]?.title || `API error: ${response.status}`);
    }

    state.resultBlob = await response.blob();
    const resultUrl = URL.createObjectURL(state.resultBlob);
    previewResult.src = resultUrl;
    resultArea.style.display = 'block';
    statusText.textContent = 'Background removed successfully!';

    toast('Background removed!');

  } catch (err) {
    console.error('Background Removal Error:', err);
    
    // Fallback: Use client-side canvas-based removal (basic)
    try {
      statusText.textContent = 'Using fallback removal...';
      const fallbackBlob = await clientSideRemoval(state.file);
      state.resultBlob = fallbackBlob;
      const resultUrl = URL.createObjectURL(fallbackBlob);
      previewResult.src = resultUrl;
      resultArea.style.display = 'block';
      statusText.textContent = 'Background removed (basic mode)!';
      toast('Background removed (basic mode)!');
    } catch (fallbackErr) {
      toast(`Error: ${err.message}`, true);
      statusText.textContent = 'Removal failed';
    }
  } finally {
    state.isProcessing = false;
    btnRemove.disabled = false;
    btnRemove.textContent = 'Remove Background';
    progressWrap.style.display = 'none';
  }
}

// ── Client-side fallback removal ───────────────────────────
async function clientSideRemoval(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      // Simple color-based removal (removes similar colors to corners)
      const bgColor = getBackgroundColor(data, canvas.width, canvas.height);
      const tolerance = 40;

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        
        const distance = Math.sqrt(
          Math.pow(r - bgColor.r, 2) +
          Math.pow(g - bgColor.g, 2) +
          Math.pow(b - bgColor.b, 2)
        );

        if (distance < tolerance) {
          data[i + 3] = 0; // Make transparent
        }
      }

      ctx.putImageData(imageData, 0, 0);
      canvas.toBlob(blob => {
        if (blob) resolve(blob);
        else reject(new Error('Failed to create blob'));
      }, 'image/png');
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
}

// ── Get background color from corners ──────────────────────
function getBackgroundColor(data, width, height) {
  const corners = [
    0, // top-left
    (width - 1) * 4, // top-right
    (height - 1) * width * 4, // bottom-left
    ((height - 1) * width + (width - 1)) * 4 // bottom-right
  ];

  let r = 0, g = 0, b = 0;
  corners.forEach(offset => {
    r += data[offset];
    g += data[offset + 1];
    b += data[offset + 2];
  });

  return {
    r: Math.round(r / 4),
    g: Math.round(g / 4),
    b: Math.round(b / 4)
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
