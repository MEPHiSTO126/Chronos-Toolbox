/**
 * Chronos Toolbox — OCR Image to Text
 * Extract text from images using OCR.Space free API.
 */

'use strict';

// ── State ──────────────────────────────────────────────────
const state = {
  file: null,
  fileName: 'extracted-text',
  imgUrl: null,
  imgElement: null,
  isProcessing: false
};

// ── DOM refs ───────────────────────────────────────────────
const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('file-input');
const editorSection = document.getElementById('editor-section');
const previewImg = document.getElementById('preview-img');
const btnExtract = document.getElementById('btn-extract');
const btnClear = document.getElementById('btn-clear');
const btnCopy = document.getElementById('btn-copy');
const resultArea = document.getElementById('result-area');
const extractedText = document.getElementById('extracted-text');
const langSelect = document.getElementById('lang-select');
const statusText = document.getElementById('status-text');
const progressWrap = document.getElementById('progress-wrap');

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

btnExtract.addEventListener('click', extractText);
btnClear.addEventListener('click', clearAll);
btnCopy.addEventListener('click', copyText);

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
    previewImg.src = state.imgUrl;
    dropzone.style.display = 'none';
    editorSection.style.display = 'block';
    resultArea.style.display = 'none';
    extractedText.value = '';
  };
  img.src = state.imgUrl;
}

// ── OCR Extraction ─────────────────────────────────────────
async function extractText() {
  if (!state.file || state.isProcessing) return;

  state.isProcessing = true;
  btnExtract.disabled = true;
  btnExtract.textContent = 'Extracting...';
  progressWrap.style.display = 'block';
  statusText.textContent = 'Sending image to OCR engine...';
  resultArea.style.display = 'none';

  try {
    const formData = new FormData();
    formData.append('file', state.file);
    formData.append('apikey', 'helloworld'); // Free tier key
    formData.append('language', langSelect.value);
    formData.append('isOverlayRequired', 'false');
    formData.append('OCREngine', '2'); // Engine 2 is better for most images

    statusText.textContent = 'Processing with OCR engine...';

    const response = await fetch('https://api.ocr.space/parse/image', {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      throw new Error(`OCR API error: ${response.status}`);
    }

    const data = await response.json();

    if (data.IsErroredOnProcessing) {
      throw new Error(data.ErrorMessage?.[0] || 'OCR processing failed');
    }

    const parsedResults = data.ParsedResults;
    if (!parsedResults || parsedResults.length === 0) {
      throw new Error('No text found in image');
    }

    // Combine all parsed results
    const fullText = parsedResults.map(r => r.ParsedText).join('\n\n');
    extractedText.value = fullText;
    resultArea.style.display = 'block';
    statusText.textContent = `Extracted ${fullText.length} characters`;

    toast('Text extracted successfully!');

  } catch (err) {
    console.error('OCR Error:', err);
    toast(`Error: ${err.message}`, true);
    statusText.textContent = 'Extraction failed';
  } finally {
    state.isProcessing = false;
    btnExtract.disabled = false;
    btnExtract.textContent = 'Extract Text';
    progressWrap.style.display = 'none';
  }
}

// ── Copy Text ──────────────────────────────────────────────
function copyText() {
  if (!extractedText.value) return;

  navigator.clipboard.writeText(extractedText.value).then(() => {
    toast('Text copied to clipboard!');
  }).catch(() => {
    // Fallback for older browsers
    extractedText.select();
    document.execCommand('copy');
    toast('Text copied to clipboard!');
  });
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
  extractedText.value = '';
  langSelect.value = 'eng';
  statusText.textContent = '';
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
