'use strict';

pdfjsLib.GlobalWorkerOptions.workerSrc =
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// ── State ────────────────────────────────────────────────────────
const state = {
  pages: [],        // array of strings, one per PDF page
  currentPage: 0,
  isPlaying: false,
  utterance: null,
};

// ── Elements ─────────────────────────────────────────────────────
const dropzone     = document.getElementById('dropzone');
const fileInput    = document.getElementById('file-input');
const extractWrap  = document.getElementById('extract-wrap');
const extractBar   = document.getElementById('extract-bar');
const extractText  = document.getElementById('extract-text');
const extractPct   = document.getElementById('extract-pct');
const playerArea   = document.getElementById('player-area');
const playerTitle  = document.getElementById('player-title');
const playerInfo   = document.getElementById('player-page-info');
const playerBar    = document.getElementById('player-bar');
const btnPlay      = document.getElementById('btn-play');
const btnStop      = document.getElementById('btn-stop');
const btnPrev      = document.getElementById('btn-prev');
const btnNext      = document.getElementById('btn-next');
const btnNewFile   = document.getElementById('btn-new-file');
const voiceSelect  = document.getElementById('opt-voice');
const speedSelect  = document.getElementById('opt-speed');

// ── Drag & Drop ──────────────────────────────────────────────────
dropzone.addEventListener('dragover', e => { e.preventDefault(); dropzone.classList.add('drag-over'); });
dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag-over'));
dropzone.addEventListener('drop', e => { e.preventDefault(); dropzone.classList.remove('drag-over'); loadFile(e.dataTransfer.files[0]); });
fileInput.addEventListener('change', () => loadFile(fileInput.files[0]));

// ── Voice Population ─────────────────────────────────────────────
function populateVoices() {
  const voices = speechSynthesis.getVoices().filter(v => v.lang.startsWith('en'));
  if (!voices.length) return;
  voiceSelect.innerHTML = voices.map((v, i) =>
    `<option value="${i}">${v.name} (${v.lang})</option>`
  ).join('');
}
speechSynthesis.addEventListener('voiceschanged', populateVoices);
populateVoices(); // may fire immediately in some browsers

function getVoice() {
  const voices = speechSynthesis.getVoices().filter(v => v.lang.startsWith('en'));
  return voices[+voiceSelect.value] || null;
}

// ── Load & Extract ───────────────────────────────────────────────
async function loadFile(file) {
  if (!file || file.type !== 'application/pdf') { toast('Please upload a PDF file.', true); return; }
  stopSpeech();
  state.pages = [];
  dropzone.style.display = 'none';
  playerArea.style.display = 'none';
  extractWrap.classList.add('visible');

  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  const total = pdf.numPages;

  for (let i = 1; i <= total; i++) {
    setExtractProgress(Math.round((i / total) * 100), `Extracting page ${i} of ${total}…`);
    const page    = await pdf.getPage(i);
    const content = await page.getTextContent();
    const text    = content.items.map(item => item.str).join(' ').trim();
    state.pages.push(text || '[No readable text on this page]');
    await sleep(2);
  }

  extractWrap.classList.remove('visible');
  playerTitle.textContent = file.name;
  state.currentPage = 0;
  updateUI();
  playerArea.style.display = 'block';
}

// ── Controls ─────────────────────────────────────────────────────
btnPlay.addEventListener('click', () => {
  if (state.isPlaying) { pauseSpeech(); } else { playCurrent(); }
});
btnStop.addEventListener('click', () => { stopSpeech(); });
btnPrev.addEventListener('click', () => {
  if (state.currentPage > 0) { stopSpeech(); state.currentPage--; updateUI(); }
});
btnNext.addEventListener('click', () => {
  if (state.currentPage < state.pages.length - 1) { stopSpeech(); state.currentPage++; updateUI(); }
});
btnNewFile.addEventListener('click', () => {
  stopSpeech();
  fileInput.value = '';
  playerArea.style.display = 'none';
  dropzone.style.display = 'block';
});
speedSelect.addEventListener('change', () => { if (state.isPlaying) { stopSpeech(); playCurrent(); } });
voiceSelect.addEventListener('change', () => { if (state.isPlaying) { stopSpeech(); playCurrent(); } });

function playCurrent() {
  if (!state.pages.length) return;
  const text = state.pages[state.currentPage];
  if (!text) return;

  state.utterance = new SpeechSynthesisUtterance(text);
  state.utterance.rate  = parseFloat(speedSelect.value);
  state.utterance.voice = getVoice();
  state.utterance.onend = () => {
    // Auto-advance to next page
    if (state.currentPage < state.pages.length - 1) {
      state.currentPage++;
      updateUI();
      playCurrent();
    } else {
      state.isPlaying = false;
      updateUI();
    }
  };
  state.utterance.onerror = () => { state.isPlaying = false; updateUI(); };
  speechSynthesis.speak(state.utterance);
  state.isPlaying = true;
  updateUI();
}

function pauseSpeech() {
  speechSynthesis.pause();
  state.isPlaying = false;
  updateUI();
}

function stopSpeech() {
  speechSynthesis.cancel();
  state.isPlaying = false;
  if (state.utterance) state.utterance = null;
  updateUI();
}

function updateUI() {
  const n = state.pages.length;
  const i = state.currentPage;
  playerInfo.textContent  = `Page ${i + 1} of ${n}`;
  playerBar.style.width   = n > 0 ? ((i / (n - 1 || 1)) * 100) + '%' : '0%';
  btnPlay.textContent     = state.isPlaying ? '⏸' : '▶';
  btnPrev.disabled        = i === 0;
  btnNext.disabled        = i === n - 1;
}

// ── Helpers ──────────────────────────────────────────────────────
function setExtractProgress(pct, label) {
  extractBar.style.width   = pct + '%';
  extractText.textContent  = label;
  extractPct.textContent   = pct + '%';
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function toast(msg, err = false) {
  document.querySelector('.ct-toast')?.remove();
  const el = document.createElement('div');
  el.className = 'ct-toast' + (err ? ' ct-toast--error' : '');
  el.textContent = msg;
  document.body.appendChild(el);
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('show')));
  setTimeout(() => { el.classList.remove('show'); el.addEventListener('transitionend', () => el.remove(), { once: true }); }, 3500);
}
