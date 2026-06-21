'use strict';
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

const state = {
  queue: [],          // array of File objects
  queueIdx: 0,        // which file we're on
  pages: [],          // text pages for current file
  currentPage: 0,
  isPlaying: false,
  utterance: null,
};

const dropzone    = document.getElementById('dropzone');
const fileInput   = document.getElementById('file-input');
const extractWrap = document.getElementById('extract-wrap');
const extractBar  = document.getElementById('extract-bar');
const extractText = document.getElementById('extract-text');
const extractPct  = document.getElementById('extract-pct');
const playerArea  = document.getElementById('player-area');
const playerTitle = document.getElementById('player-title');
const playerInfo  = document.getElementById('player-page-info');
const playerBar   = document.getElementById('player-bar');
const queueInfo   = document.getElementById('queue-info');
const btnPlay     = document.getElementById('btn-play');
const btnStop     = document.getElementById('btn-stop');
const btnPrev     = document.getElementById('btn-prev');
const btnNext     = document.getElementById('btn-next');
const btnNextFile = document.getElementById('btn-next-file');
const btnNewFile  = document.getElementById('btn-new-file');
const voiceSelect = document.getElementById('opt-voice');
const speedSelect = document.getElementById('opt-speed');

// ── Voices ───────────────────────────────────────────────────────
function populateVoices() {
  const voices = speechSynthesis.getVoices().filter(v => v.lang.startsWith('en'));
  if (!voices.length) return;
  voiceSelect.innerHTML = voices.map((v, i) => `<option value="${i}">${v.name} (${v.lang})</option>`).join('');
}
speechSynthesis.addEventListener('voiceschanged', populateVoices);
populateVoices();
function getVoice() { return speechSynthesis.getVoices().filter(v => v.lang.startsWith('en'))[+voiceSelect.value] || null; }

// ── File loading ─────────────────────────────────────────────────
dropzone.addEventListener('dragover', e => { e.preventDefault(); dropzone.classList.add('drag-over'); });
dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag-over'));
dropzone.addEventListener('drop', e => { e.preventDefault(); dropzone.classList.remove('drag-over'); startQueue([...e.dataTransfer.files]); });
fileInput.addEventListener('change', () => startQueue([...fileInput.files]));

function startQueue(files) {
  const pdfs = files.filter(f => f.type === 'application/pdf');
  if (!pdfs.length) { toast('Please upload at least one PDF.', true); return; }
  state.queue = pdfs; state.queueIdx = 0;
  loadFileAtIndex(0);
}

async function loadFileAtIndex(idx) {
  const file = state.queue[idx];
  if (!file) return;
  stopSpeech();
  state.pages = []; state.currentPage = 0;
  dropzone.style.display = 'none';
  playerArea.style.display = 'none';
  extractWrap.classList.add('visible');

  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  const total = pdf.numPages;

  for (let i = 1; i <= total; i++) {
    setExtractProgress(Math.round((i / total) * 100), `Extracting page ${i} of ${total} — ${file.name}`);
    const page    = await pdf.getPage(i);
    const content = await page.getTextContent();
    state.pages.push(content.items.map(item => item.str).join(' ').trim() || '[No readable text on this page]');
    await sleep(2);
  }

  extractWrap.classList.remove('visible');
  playerTitle.textContent = file.name;
  state.currentPage = 0;
  updateUI();
  playerArea.style.display = 'block';
}

// ── Controls ─────────────────────────────────────────────────────
btnPlay.addEventListener('click',     () => state.isPlaying ? pauseSpeech() : playCurrent());
btnStop.addEventListener('click',     () => stopSpeech());
btnPrev.addEventListener('click',     () => { if (state.currentPage > 0) { stopSpeech(); state.currentPage--; updateUI(); } });
btnNext.addEventListener('click',     () => { if (state.currentPage < state.pages.length - 1) { stopSpeech(); state.currentPage++; updateUI(); } });
btnNextFile.addEventListener('click', () => advanceQueue());
btnNewFile.addEventListener('click',  () => { stopSpeech(); fileInput.value=''; playerArea.style.display='none'; dropzone.style.display='block'; });
speedSelect.addEventListener('change',() => { if (state.isPlaying) { stopSpeech(); playCurrent(); } });
voiceSelect.addEventListener('change',() => { if (state.isPlaying) { stopSpeech(); playCurrent(); } });

function playCurrent() {
  const text = state.pages[state.currentPage];
  if (!text) return;
  state.utterance = new SpeechSynthesisUtterance(text);
  state.utterance.rate  = parseFloat(speedSelect.value);
  state.utterance.voice = getVoice();
  state.utterance.onend = () => {
    if (state.currentPage < state.pages.length - 1) {
      state.currentPage++; updateUI(); playCurrent();
    } else {
      // Last page of this file — auto-advance if queue has more
      state.isPlaying = false; updateUI();
      if (state.queueIdx < state.queue.length - 1) advanceQueue();
    }
  };
  state.utterance.onerror = () => { state.isPlaying = false; updateUI(); };
  speechSynthesis.speak(state.utterance);
  state.isPlaying = true; updateUI();
}

function pauseSpeech()  { speechSynthesis.pause(); state.isPlaying = false; updateUI(); }
function stopSpeech()   { speechSynthesis.cancel(); state.isPlaying = false; state.utterance = null; updateUI(); }
function advanceQueue() { stopSpeech(); state.queueIdx++; loadFileAtIndex(state.queueIdx); }

function updateUI() {
  const n = state.pages.length; const i = state.currentPage;
  playerInfo.textContent = `Page ${i+1} of ${n}`;
  playerBar.style.width  = n > 1 ? ((i / (n-1)) * 100) + '%' : '0%';
  btnPlay.textContent    = state.isPlaying ? '⏸' : '▶';
  btnPrev.disabled       = i === 0;
  btnNext.disabled       = i === n - 1;
  // Queue display
  const q = state.queue.length;
  if (queueInfo) {
    queueInfo.textContent  = q > 1 ? `File ${state.queueIdx + 1} of ${q}` : '';
    queueInfo.style.display = q > 1 ? 'block' : 'none';
  }
  if (btnNextFile) {
    btnNextFile.style.display = (state.queueIdx < q - 1) ? 'inline-block' : 'none';
  }
}

function setExtractProgress(pct, label) {
  extractBar.style.width = pct + '%'; extractText.textContent = label; extractPct.textContent = pct + '%';
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function toast(msg, err = false) {
  document.querySelector('.ct-toast')?.remove();
  const el = document.createElement('div');
  el.className = 'ct-toast' + (err ? ' ct-toast--error' : ''); el.textContent = msg; document.body.appendChild(el);
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('show')));
  setTimeout(() => { el.classList.remove('show'); el.addEventListener('transitionend', () => el.remove(), { once: true }); }, 3500);
}
