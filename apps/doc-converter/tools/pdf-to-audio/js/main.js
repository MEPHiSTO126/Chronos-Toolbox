'use strict';
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

const API_URL = typeof window.TOOLBOX_API !== 'undefined' 
  ? window.TOOLBOX_API 
  : 'https://toolbox-backend-76dc.onrender.com';

const state = {
  queue: [],           // array of File objects
  queueIdx: 0,         // which file we're on
  pages: [],           // text pages for current file
  currentPage: 0,
  isPlaying: false,
  utterance: null,
  useEdgeTTS: false,   // Toggle between browser TTS and Edge TTS
  edgeVoices: [],      // Available Edge TTS voices
  audioElement: null,  // For Edge TTS audio playback
  audioBlob: null,     // Last generated Edge TTS blob (for download)
  pageBlobs: {},       // Cache: page index → Blob
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
const ttsModeSelect = document.getElementById('tts-mode');

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
loadEdgeVoices();

function getVoice() {
  const voices = speechSynthesis.getVoices();
  const indices = JSON.parse(voiceSelect.dataset.voiceIndices || '[]');
  return voices[indices[+voiceSelect.value]] || voices[0] || null;
}

// ── Edge TTS Voices ─────────────────────────────────────────────
async function loadEdgeVoices() {
  try {
    const response = await fetch(`${API_URL}/media/tts-voices`);
    if (!response.ok) throw new Error('Failed to load voices');
    const data = await response.json();
    state.edgeVoices = data.voices || [];
  } catch (err) {
    console.warn('Could not load Edge TTS voices:', err);
    state.edgeVoices = [];
  }
}

function populateEdgeVoices() {
  if (!state.edgeVoices.length) return;
  voiceSelect.innerHTML = state.edgeVoices.map((v, i) => 
    `<option value="${i}">${v.name} (${v.gender})</option>`
  ).join('');
}

// ── TTS Mode Toggle ──────────────────────────────────────────────
if (ttsModeSelect) {
  ttsModeSelect.addEventListener('change', () => {
    state.useEdgeTTS = ttsModeSelect.value === 'edge';
    if (state.useEdgeTTS) {
      populateEdgeVoices();
    } else {
      populateVoices();
    }
  });
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
  state.pages = []; state.currentPage = 0;
  dropzone.style.display = 'none';
  playerArea.style.display = 'none';
  extractWrap.classList.add('visible');

  try {
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
  } catch (err) {
    console.error('PDF extraction failed:', err);
    extractWrap.classList.remove('visible');
    dropzone.style.display = 'block';
    toast('Failed to load PDF: ' + err.message, true);
  }
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
btnNewFile.addEventListener('click',  () => { stopSpeech(); fileInput.value=''; playerArea.style.display='none'; dropzone.style.display='block'; });
speedSelect.addEventListener('change',() => { if (state.isPlaying) { stopSpeech(); playCurrent(); } });
voiceSelect.addEventListener('change',() => { if (state.isPlaying) { stopSpeech(); playCurrent(); } });

// Export / Download
const btnExport = document.getElementById('btn-export');
if (btnExport) {
  btnExport.addEventListener('click', async () => {
    if (state.useEdgeTTS) {
      // Edge TTS — download current page's cached blob, or generate it
      const cacheKey = `${state.queueIdx}-${state.currentPage}`;
      let blob = state.pageBlobs[cacheKey];

      if (!blob) {
        // Generate audio for current page first
        const text = state.pages[state.currentPage];
        if (!text) { toast('No text to export', true); return; }
        btnExport.textContent = '⏳ Generating...';
        try {
          const voice = state.edgeVoices[+voiceSelect.value];
          const voiceName = voice ? voice.id : 'en-US-AriaNeural';
          const rate = speedSelect.value >= 1.5 ? '+50%' : speedSelect.value >= 1.2 ? '+20%' : '+0%';
          const response = await fetch(`${API_URL}/media/text-to-speech`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, voice: voiceName, rate })
          });
          if (!response.ok) throw new Error('Export failed');
          blob = await response.blob();
          state.pageBlobs[cacheKey] = blob;
        } catch (err) {
          toast('Export failed: ' + err.message, true);
          btnExport.textContent = '⬇ Export Audio';
          return;
        }
      }

      downloadBlob(blob, `speech-page${state.currentPage + 1}.mp3`);
      btnExport.textContent = '⬇ Export Audio';
      toast('Audio downloaded');

    } else {
      // Browser TTS — generate all pages via Edge TTS for download
      if (!state.pages.length) { toast('No pages to export', true); return; }
      btnExport.textContent = '⏳ Generating all pages...';
      try {
        const voice = state.edgeVoices[0];
        const voiceName = voice ? voice.id : 'en-US-AriaNeural';
        const rate = speedSelect.value >= 1.5 ? '+50%' : speedSelect.value >= 1.2 ? '+20%' : '+0%';
        const blobs = [];

        for (let i = 0; i < state.pages.length; i++) {
          btnExport.textContent = `⏳ Page ${i + 1} of ${state.pages.length}...`;
          const cacheKey = `${state.queueIdx}-${i}`;
          let pageBlob = state.pageBlobs[cacheKey];
          if (!pageBlob) {
            const response = await fetch(`${API_URL}/media/text-to-speech`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ text: state.pages[i], voice: voiceName, rate })
            });
            if (!response.ok) throw new Error(`Page ${i + 1} failed`);
            pageBlob = await response.blob();
            state.pageBlobs[cacheKey] = pageBlob;
          }
          blobs.push(pageBlob);
        }

        // Concatenate all blobs
        const combinedBlob = new Blob(blobs, { type: 'audio/mpeg' });
        const baseName = (state.queue[state.queueIdx]?.name || 'speech').replace(/\.pdf$/i, '');
        downloadBlob(combinedBlob, `${baseName}.mp3`);
        toast('Audio downloaded');
      } catch (err) {
        toast('Export failed: ' + err.message, true);
      }
      btnExport.textContent = '⬇ Export Audio';
    }
  });
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

function playCurrent() {
  const text = state.pages[state.currentPage];
  if (!text) return;
  
  if (state.useEdgeTTS) {
    playWithEdgeTTS(text);
  } else {
    playWithBrowserTTS(text);
  }
}

function playWithBrowserTTS(text) {
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

async function playWithEdgeTTS(text) {
  try {
    // Stop any current playback
    if (state.audioElement) {
      state.audioElement.pause();
      state.audioElement = null;
    }
    
    // Check cache first
    const cacheKey = `${state.queueIdx}-${state.currentPage}`;
    if (state.pageBlobs[cacheKey]) {
      const blob = state.pageBlobs[cacheKey];
      const audioUrl = URL.createObjectURL(blob);
      state.audioElement = new Audio(audioUrl);
      state.audioElement.onended = () => {
        URL.revokeObjectURL(audioUrl);
        if (state.currentPage < state.pages.length - 1) {
          state.currentPage++; updateUI(); playCurrent();
        } else {
          state.isPlaying = false; updateUI();
          if (state.queueIdx < state.queue.length - 1) advanceQueue();
        }
      };
      await state.audioElement.play();
      state.isPlaying = true; updateUI();
      return;
    }
    
    const voice = state.edgeVoices[+voiceSelect.value];
    const voiceName = voice ? voice.id : 'en-US-AriaNeural';
    const rate = speedSelect.value >= 1.5 ? '+50%' : speedSelect.value >= 1.2 ? '+20%' : '+0%';
    
    // Show loading state
    btnPlay.textContent = '⏳';
    playerInfo.textContent = 'Generating audio...';
    
    const response = await fetch(`${API_URL}/media/text-to-speech`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voice: voiceName, rate })
    });
    
    if (!response.ok) {
      throw new Error('TTS request failed');
    }
    
    const blob = await response.blob();
    state.audioBlob = blob;
    state.pageBlobs[cacheKey] = blob;
    const audioUrl = URL.createObjectURL(blob);
    
    state.audioElement = new Audio(audioUrl);
    state.audioElement.onended = () => {
      URL.revokeObjectURL(audioUrl);
      if (state.currentPage < state.pages.length - 1) {
        state.currentPage++; updateUI(); playCurrent();
      } else {
        state.isPlaying = false; updateUI();
        if (state.queueIdx < state.queue.length - 1) advanceQueue();
      }
    };
    state.audioElement.onerror = () => {
      URL.revokeObjectURL(audioUrl);
      state.isPlaying = false; updateUI();
      toast('Audio playback failed', true);
    };
    
    await state.audioElement.play();
    state.isPlaying = true; updateUI();
    
  } catch (err) {
    console.error('Edge TTS error:', err);
    toast('Edge TTS failed, falling back to browser TTS', true);
    // Fallback to browser TTS
    state.useEdgeTTS = false;
    if (ttsModeSelect) ttsModeSelect.value = 'browser';
    playWithBrowserTTS(text);
  }
}

function pauseSpeech() {
  if (state.useEdgeTTS && state.audioElement) {
    state.audioElement.pause();
  } else {
    speechSynthesis.pause();
  }
  state.isPlaying = false; 
  updateUI();
}

function stopSpeech() {
  if (state.useEdgeTTS && state.audioElement) {
    state.audioElement.pause();
    state.audioElement.currentTime = 0;
    state.audioElement = null;
  } else {
    speechSynthesis.cancel();
  }
  state.isPlaying = false; 
  state.utterance = null; 
  updateUI();
}

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