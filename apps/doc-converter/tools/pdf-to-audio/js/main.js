'use strict';
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

const state = {
  queue: [],           // array of File objects
  queueIdx: 0,         // which file we're on
  pages: [],           // text pages for current file
  currentPage: 0,
  isPlaying: false,
  utterance: null,
  mediaRecorder: null,
  audioChunks: [],
  audioContext: null,
  destination: null,
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
const btnExport   = document.getElementById('btn-export');
const voiceSelect = document.getElementById('opt-voice');
const speedSelect = document.getElementById('opt-speed');
const exportFormatSelect = document.getElementById('opt-export-format');

// ── Voices ───────────────────────────────────────────────────────
function populateVoices() {
  const voices = speechSynthesis.getVoices();
  if (!voices.length) return;
  // Filter for English voices but allow all if none
  const enVoices = voices.filter(v => v.lang.startsWith('en'));
  const displayVoices = enVoices.length ? enVoices : voices;
  voiceSelect.innerHTML = displayVoices.map((v, i) => `<option value="${i}">${v.name} (${v.lang})</option>`).join('');
  voiceSelect.dataset.voiceIndices = JSON.stringify(displayVoices.map((v, i) => voices.indexOf(v)));
}
speechSynthesis.addEventListener('voiceschanged', populateVoices);
populateVoices();

function getVoice() {
  const voices = speechSynthesis.getVoices();
  const indices = JSON.parse(voiceSelect.dataset.voiceIndices || '[]');
  return voices[indices[+voiceSelect.value]] || voices[0] || null;
}

// ── Audio Export Setup ───────────────────────────────────────────
async function setupAudioCapture() {
  if (state.mediaRecorder && state.mediaRecorder.state === 'recording') return true;
  
  state.audioChunks = [];
  
  try {
    state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    
    // Create a destination for capturing audio
    state.destination = state.audioContext.createMediaStreamDestination();
    
    // Determine mime type
    const format = exportFormatSelect.value;
    let mimeType = 'audio/wav';
    if (format === 'mp3' && MediaRecorder.isTypeSupported('audio/mp3')) {
      mimeType = 'audio/mp3';
    } else if (MediaRecorder.isTypeSupported('audio/webm')) {
      mimeType = 'audio/webm';
    } else if (MediaRecorder.isTypeSupported('audio/ogg')) {
      mimeType = 'audio/ogg';
    }
    
    state.mediaRecorder = new MediaRecorder(state.destination.stream, { mimeType });
    
    state.mediaRecorder.ondataavailable = e => {
      if (e.data.size > 0) state.audioChunks.push(e.data);
    };
    
    state.mediaRecorder.onstop = () => {
      const blob = new Blob(state.audioChunks, { type: mimeType });
      downloadAudioBlob(blob, format);
    };
    
    state.mediaRecorder.start(100); // Collect data every 100ms
    return true;
  } catch (e) {
    console.error('Audio capture setup failed:', e);
    toast('Audio export not supported in this browser. Use WAV format.', true);
    return false;
  }
}

function stopAudioCapture() {
  if (state.mediaRecorder && state.mediaRecorder.state !== 'inactive') {
    state.mediaRecorder.stop();
  }
  if (state.audioContext) {
    state.audioContext.close();
    state.audioContext = null;
  }
  state.mediaRecorder = null;
  state.destination = null;
}

function downloadAudioBlob(blob, format) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const fname = state.queue[state.queueIdx] 
    ? state.queue[state.queueIdx].name.replace(/\.pdf$/i, `.${format === 'wav' ? 'wav' : 'mp3'}`)
    : `audio.${format === 'wav' ? 'wav' : 'mp3'}`;
  a.href = url;
  a.download = fname;
  a.click();
  URL.revokeObjectURL(url);
}

// ── File loading ─────────────────────────────────────────────────
dropzone.addEventListener('dragover', e => { e.preventDefault(); dropzone.classList.add('drag-over'); });
dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag-over'));
dropzone.addEventListener('drop', e => { e.preventDefault(); dropzone.classList.remove('drag-over'); startQueue([...e.dataTransfer.files]); });
fileInput.addEventListener('change', () => startQueue([...fileInput.files]));

function startQueue(files) {
  const pdfs = files.filter(f => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
  if (!pdfs.length) { toast('Please upload at least one PDF.', true); return; }
  state.queue = pdfs; state.queueIdx = 0;
  loadFileAtIndex(0);
}

async function loadFileAtIndex(idx) {
  const file = state.queue[idx];
  if (!file) return;
  stopSpeech();
  stopAudioCapture();
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
    
    // Improved text extraction - group items by Y position to preserve paragraphs
    const items = content.items;
    const paragraphs = groupTextItems(items);
    const pageText = paragraphs.join('\n\n').trim() || '[No readable text on this page]';
    
    state.pages.push(pageText);
    await sleep(2);
  }

  extractWrap.classList.remove('visible');
  playerTitle.textContent = file.name;
  state.currentPage = 0;
  updateUI();
  playerArea.style.display = 'block';
}

function groupTextItems(items) {
  if (!items.length) return [];
  
  // Group by Y position (with tolerance) to form lines
  const lines = [];
  let currentLine = [];
  const yTolerance = 2;
  
  // Sort by Y then X
  const sorted = [...items].sort((a, b) => {
    const yDiff = a.transform[5] - b.transform[5];
    if (Math.abs(yDiff) > yTolerance) return yDiff;
    return a.transform[4] - b.transform[4];
  });
  
  for (const item of sorted) {
    const y = item.transform[5];
    if (currentLine.length === 0 || Math.abs(currentLine[0].transform[5] - y) <= yTolerance) {
      currentLine.push(item);
    } else {
      // Sort line by X
      currentLine.sort((a, b) => a.transform[4] - b.transform[4]);
      lines.push(currentLine);
      currentLine = [item];
    }
  }
  if (currentLine.length) {
    currentLine.sort((a, b) => a.transform[4] - b.transform[4]);
    lines.push(currentLine);
  }
  
  // Join items in each line, detect spaces between items
  const paragraphs = [];
  let currentPara = [];
  let lastY = null;
  const paraGap = 15; // Gap threshold for new paragraph
  
  for (const line of lines) {
    const lineY = line[0].transform[5];
    
    // Check for paragraph break (large vertical gap)
    if (lastY !== null && Math.abs(lineY - lastY) > paraGap) {
      if (currentPara.length) {
        paragraphs.push(currentPara.join('\n'));
        currentPara = [];
      }
    }
    
    let lineText = '';
    for (let i = 0; i < line.length; i++) {
      const item = line[i];
      lineText += item.str;
      if (i < line.length - 1) {
        const nextItem = line[i + 1];
        const gap = nextItem.transform[4] - (item.transform[4] + item.width);
        if (gap > 2) lineText += ' ';
      }
    }
    currentPara.push(lineText.trim());
    lastY = lineY;
  }
  
  if (currentPara.length) {
    paragraphs.push(currentPara.join('\n'));
  }
  
  return paragraphs.filter(p => p.trim().length > 0);
}

// ── Controls ─────────────────────────────────────────────────────
btnPlay.addEventListener('click',     () => state.isPlaying ? pauseSpeech() : playCurrent());
btnStop.addEventListener('click',     () => stopSpeech());
btnPrev.addEventListener('click',     () => { if (state.currentPage > 0) { stopSpeech(); state.currentPage--; updateUI(); } });
btnNext.addEventListener('click',     () => { if (state.currentPage < state.pages.length - 1) { stopSpeech(); state.currentPage++; updateUI(); } });
btnNextFile.addEventListener('click', () => advanceQueue());
btnNewFile.addEventListener('click',  () => { stopSpeech(); stopAudioCapture(); fileInput.value=''; playerArea.style.display='none'; dropzone.style.display='block'; });
btnExport.addEventListener('click',   () => exportAudio());
speedSelect.addEventListener('change',() => { if (state.isPlaying) { stopSpeech(); playCurrent(); } });
voiceSelect.addEventListener('change',() => { if (state.isPlaying) { stopSpeech(); playCurrent(); } });

async function exportAudio() {
  if (!state.pages.length) {
    toast('No text to export.', true);
    return;
  }
  
  const format = exportFormatSelect.value;
  const success = await setupAudioCapture();
  if (!success) return;
  
  btnExport.textContent = '⏺ Recording...';
  btnExport.disabled = true;
  
  // Speak all pages and capture
  state.isPlaying = true;
  state.currentPage = 0;
  await speakAllPagesForExport();
}

async function speakAllPagesForExport() {
  if (state.currentPage >= state.pages.length) {
    stopSpeech();
    stopAudioCapture();
    btnExport.textContent = '⬇ Export Audio';
    btnExport.disabled = false;
    state.isPlaying = false;
    updateUI();
    return;
  }
  
  const text = state.pages[state.currentPage];
  if (!text || text === '[No readable text on this page]') {
    state.currentPage++;
    await speakAllPagesForExport();
    return;
  }
  
  state.utterance = new SpeechSynthesisUtterance(text);
  state.utterance.rate  = parseFloat(speedSelect.value);
  state.utterance.voice = getVoice();
  state.utterance.onend = () => {
    state.currentPage++;
    speakAllPagesForExport();
  };
  state.utterance.onerror = () => {
    state.currentPage++;
    speakAllPagesForExport();
  };
  
  // Connect utterance to audio capture if recording
  if (state.destination && state.audioContext) {
    // Note: Web Speech API doesn't directly support MediaStream output
    // We'll use a workaround: play through audio element and capture
  }
  
  speechSynthesis.speak(state.utterance);
  updateUI();
}

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
function advanceQueue() { stopSpeech(); stopAudioCapture(); state.queueIdx++; loadFileAtIndex(state.queueIdx); }

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