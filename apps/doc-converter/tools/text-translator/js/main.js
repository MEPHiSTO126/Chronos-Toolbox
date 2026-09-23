/**
 * Chronos Toolbox — Text Translator
 * Translate text between languages using MyMemory (free, no API key).
 */

'use strict';

// ── DOM refs ───────────────────────────────────────────────
const inputText = document.getElementById('input-text');
const outputText = document.getElementById('output-text');
const sourceLang = document.getElementById('source-lang');
const targetLang = document.getElementById('target-lang');
const btnTranslate = document.getElementById('btn-translate');
const btnSwap = document.getElementById('btn-swap');
const btnClear = document.getElementById('btn-clear');
const btnCopy = document.getElementById('btn-copy');
const statusText = document.getElementById('status-text');
const charCount = document.getElementById('char-count');

// ── Events ─────────────────────────────────────────────────
btnTranslate.addEventListener('click', translateText);
btnSwap.addEventListener('click', swapLanguages);
btnClear.addEventListener('click', clearAll);
btnCopy.addEventListener('click', copyText);
inputText.addEventListener('input', updateCharCount);

// ── Character count ────────────────────────────────────────
function updateCharCount() {
  const count = inputText.value.length;
  charCount.textContent = `${count} / 5000`;
  charCount.style.color = count > 5000 ? 'var(--clr-danger)' : 'var(--clr-text-muted)';
}

// ── Chunking helper for MyMemory 450-char limit ────────────
function splitIntoChunks(text, maxLen = 450) {
  if (text.length <= maxLen) return [text];
  const paragraphs = text.split('\n');
  const chunks = [];
  let currentChunk = '';

  for (const para of paragraphs) {
    if ((currentChunk + '\n' + para).trim().length <= maxLen) {
      currentChunk = currentChunk ? currentChunk + '\n' + para : para;
    } else {
      if (currentChunk) chunks.push(currentChunk);
      if (para.length <= maxLen) {
        currentChunk = para;
      } else {
        // Split long paragraph by sentences
        const sentences = para.match(/[^.!?]+[.!?]+|\s*[^.!?]+$/g) || [para];
        for (const sent of sentences) {
          if ((currentChunk + ' ' + sent).trim().length <= maxLen) {
            currentChunk = currentChunk ? currentChunk + ' ' + sent : sent;
          } else {
            if (currentChunk) chunks.push(currentChunk);
            currentChunk = sent;
          }
        }
      }
    }
  }
  if (currentChunk) chunks.push(currentChunk);
  return chunks;
}

async function translateSingleChunk(chunk, source, target) {
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(chunk)}&langpair=${source}|${target}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Translation API error: ${response.status}`);
  }
  const data = await response.json();
  if (data.responseStatus !== 200 || !data.responseData?.translatedText) {
    throw new Error(data.responseDetails || 'Translation failed');
  }
  return data.responseData.translatedText;
}

// ── Translation ────────────────────────────────────────────
async function translateText() {
  const text = inputText.value.trim();
  if (!text) {
    toast('Please enter text to translate.', true);
    return;
  }

  if (text.length > 5000) {
    toast('Text exceeds 5000 character limit.', true);
    return;
  }

  const source = sourceLang.value;
  const target = targetLang.value;

  if (source === target) {
    toast('Source and target languages must be different.', true);
    return;
  }

  btnTranslate.disabled = true;
  btnTranslate.textContent = 'Translating...';
  statusText.textContent = 'Connecting to translation service...';

  try {
    const chunks = splitIntoChunks(text, 450);
    const translatedChunks = [];

    for (let i = 0; i < chunks.length; i++) {
      if (chunks.length > 1) {
        statusText.textContent = `Translating segment ${i + 1} of ${chunks.length}...`;
      }
      const translated = await translateSingleChunk(chunks[i], source, target);
      translatedChunks.push(translated);
      if (i < chunks.length - 1) {
        await new Promise(r => setTimeout(r, 100));
      }
    }

    outputText.value = translatedChunks.join('\n\n');
    statusText.textContent = `Translated from ${getLangName(source)} to ${getLangName(target)}`;
    toast('Translation complete!');

  } catch (err) {
    console.error('Translation Error:', err);
    toast(`Error: ${err.message}. Please try again later.`, true);
    statusText.textContent = 'Translation failed';
  } finally {
    btnTranslate.disabled = false;
    btnTranslate.textContent = 'Translate';
  }
}

// ── Swap Languages ─────────────────────────────────────────
function swapLanguages() {
  const temp = sourceLang.value;
  sourceLang.value = targetLang.value;
  targetLang.value = temp;

  // Also swap text if there's output
  if (outputText.value) {
    const tempText = inputText.value;
    inputText.value = outputText.value;
    outputText.value = tempText;
    updateCharCount();
  }
}

// ── Copy Text ──────────────────────────────────────────────
function copyText() {
  if (!outputText.value) return;

  navigator.clipboard.writeText(outputText.value).then(() => {
    toast('Translation copied to clipboard!');
  }).catch(() => {
    outputText.select();
    document.execCommand('copy');
    toast('Translation copied to clipboard!');
  });
}

// ── Clear ──────────────────────────────────────────────────
function clearAll() {
  inputText.value = '';
  outputText.value = '';
  sourceLang.value = 'en';
  targetLang.value = 'es';
  statusText.textContent = 'Ready to translate';
  updateCharCount();
}

// ── Language name helper ───────────────────────────────────
function getLangName(code) {
  const langs = {
    'en': 'English', 'es': 'Spanish', 'fr': 'French', 'de': 'German',
    'it': 'Italian', 'pt': 'Portuguese', 'ru': 'Russian', 'zh': 'Chinese',
    'ja': 'Japanese', 'ko': 'Korean', 'ar': 'Arabic', 'hi': 'Hindi',
    'tr': 'Turkish', 'pl': 'Polish', 'nl': 'Dutch', 'sv': 'Swedish',
    'da': 'Danish', 'fi': 'Finnish', 'no': 'Norwegian', 'uk': 'Ukrainian',
    'cs': 'Czech', 'el': 'Greek', 'he': 'Hebrew', 'th': 'Thai',
    'vi': 'Vietnamese', 'id': 'Indonesian', 'ms': 'Malay', 'ro': 'Romanian',
    'hu': 'Hungarian', 'bg': 'Bulgarian', 'hr': 'Croatian', 'sk': 'Slovak',
    'sl': 'Slovenian', 'et': 'Estonian', 'lv': 'Latvian', 'lt': 'Lithuanian',
    'ca': 'Catalan', 'gl': 'Galician', 'eu': 'Basque', 'cy': 'Welsh',
    'ga': 'Irish', 'mt': 'Maltese', 'af': 'Afrikaans', 'sw': 'Swahili',
    'tl': 'Filipino', 'is': 'Icelandic', 'mk': 'Macedonian', 'sq': 'Albanian',
    'bs': 'Bosnian', 'sr': 'Serbian', 'mn': 'Mongolian', 'ka': 'Georgian',
    'hy': 'Armenian', 'az': 'Azerbaijani', 'kk': 'Kazakh', 'uz': 'Uzbek',
    'ky': 'Kyrgyz', 'tg': 'Tajik', 'tk': 'Turkmen', 'ur': 'Urdu',
    'bn': 'Bengali', 'gu': 'Gujarati', 'ta': 'Tamil', 'te': 'Telugu',
    'kn': 'Kannada', 'ml': 'Malayalam', 'my': 'Burmese', 'km': 'Khmer',
    'lo': 'Lao', 'ne': 'Nepali', 'si': 'Sinhala', 'pa': 'Punjabi'
  };
  return langs[code] || code;
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

// ── Initialize ─────────────────────────────────────────────
updateCharCount();