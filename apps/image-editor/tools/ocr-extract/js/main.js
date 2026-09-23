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
const btnDownloadTxt = document.getElementById('btn-download-txt');
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
btnDownloadTxt.addEventListener('click', downloadText);

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
  statusText.textContent = 'Initializing OCR engine...';
  resultArea.style.display = 'none';

  const langMap = {
    eng: 'eng', ara: 'ara', bul: 'bul', chs: 'chi_sim', cht: 'chi_tra',
    hrv: 'hrv', cze: 'ces', dan: 'dan', dut: 'nld', fin: 'fin',
    fre: 'fra', ger: 'deu', gre: 'ell', hun: 'hun', kor: 'kor',
    ita: 'ita', jpn: 'jpn', pol: 'pol', por: 'por', rus: 'rus',
    slk: 'slk', spa: 'spa', swe: 'swe', tha: 'tha', tur: 'tur',
    ukr: 'ukr', vie: 'vie'
  };

  try {
    if (typeof Tesseract !== 'undefined') {
      const tesseractLang = langMap[langSelect.value] || 'eng';
      statusText.textContent = 'Loading OCR models...';

      const result = await Tesseract.recognize(
        state.file,
        tesseractLang,
        {
          logger: m => {
            if (m.status === 'recognizing text' && m.progress != null) {
              statusText.textContent = `Recognizing text: ${Math.round(m.progress * 100)}%`;
            } else if (m.status) {
              statusText.textContent = m.status.replace(/_/g, ' ') + '...';
            }
          }
        }
      );

      const fullText = (result && result.data && result.data.text) ? result.data.text.trim() : '';
      if (!fullText) {
        throw new Error('No text found in image');
      }

      extractedText.value = fullText;
      resultArea.style.display = 'block';
      statusText.textContent = `Extracted ${fullText.length} characters (100% locally)`;
      toast('Text extracted successfully!');
    } else {
      throw new Error('OCR engine failed to load. Please check your internet connection.');
    }

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

// ── Download Text as .txt ─────────────────────────────────
function downloadText() {
  if (!extractedText.value) return;

  const blob = new Blob([extractedText.value], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${state.fileName || 'extracted-text'}.txt`;
  a.click();
  URL.revokeObjectURL(url);
  toast('Text downloaded!');
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