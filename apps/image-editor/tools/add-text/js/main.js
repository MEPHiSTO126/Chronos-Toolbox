/**
 * Chronos Toolbox — Add Text to Image
 * Manages multiple draggable text blocks using percentage coordinate mapping,
 * overlaying absolute elements, and rendering them onto high-res canvas exports.
 */

'use strict';

// ── State ──────────────────────────────────────────────────
const state = {
  file:         null,
  fileName:     'text-image',
  imgUrl:       null,
  imgElement:   null, // HTMLImageElement
  textBlocks:   [],   // { id, text, xPercent, yPercent, size, font, color, bold, italic, stroke, strokeColor, shadow, shadowColor }
  selectedId:   null
};

// ── DOM refs ───────────────────────────────────────────────
const dropzone         = document.getElementById('dropzone');
const fileInput        = document.getElementById('file-input');
const editorSection    = document.getElementById('editor-section');
const canvasWrapper    = document.getElementById('canvas-wrapper');
const previewImg       = document.getElementById('preview-img');
const overlayContainer = document.getElementById('overlay-container');

// Sidebar Controls
const txtContent       = document.getElementById('txt-content');
const txtFont          = document.getElementById('txt-font');
const txtColor         = document.getElementById('txt-color');
const txtSize          = document.getElementById('txt-size');
const valTxtSize       = document.getElementById('val-txt-size');
const txtBold          = document.getElementById('txt-bold');
const txtItalic        = document.getElementById('txt-italic');
const txtStrokeEnable  = document.getElementById('txt-stroke-enable');
const txtStrokeColor   = document.getElementById('txt-stroke-color');
const txtShadowEnable  = document.getElementById('txt-shadow-enable');
const txtShadowColor   = document.getElementById('txt-shadow-color');

const btnAddText       = document.getElementById('btn-add-text');
const optFormat        = document.getElementById('opt-format');
const optQuality       = document.getElementById('opt-quality');
const qualityGroup     = document.getElementById('quality-group');
const qualityVal       = document.getElementById('quality-val');
const btnSave          = document.getElementById('btn-save');
const btnClear         = document.getElementById('btn-clear');

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
btnClear.addEventListener('click', clearAll);
btnSave.addEventListener('click', exportImage);
btnAddText.addEventListener('click', () => addTextBlock());

// Sidebar Inputs Events
txtContent.addEventListener('input', () => updateSelectedBlock('text', txtContent.value));
txtFont.addEventListener('change', () => updateSelectedBlock('font', txtFont.value));
txtColor.addEventListener('input', () => updateSelectedBlock('color', txtColor.value));
txtSize.addEventListener('input', () => {
  valTxtSize.textContent = txtSize.value + 'px';
  updateSelectedBlock('size', parseInt(txtSize.value));
});
txtBold.addEventListener('change', () => updateSelectedBlock('bold', txtBold.checked));
txtItalic.addEventListener('change', () => updateSelectedBlock('italic', txtItalic.checked));
txtStrokeEnable.addEventListener('change', () => updateSelectedBlock('stroke', txtStrokeEnable.checked));
txtStrokeColor.addEventListener('input', () => updateSelectedBlock('strokeColor', txtStrokeColor.value));
txtShadowEnable.addEventListener('change', () => updateSelectedBlock('shadow', txtShadowEnable.checked));
txtShadowColor.addEventListener('input', () => updateSelectedBlock('shadowColor', txtShadowColor.value));

// Quality slider label
optQuality.addEventListener('input', () => {
  qualityVal.textContent = optQuality.value + '%';
});

// Quality slider visibility
optFormat.addEventListener('change', () => {
  const fmt = optFormat.value;
  qualityGroup.style.opacity = fmt === 'png' ? '0.4' : '1';
  qualityGroup.style.pointerEvents = fmt === 'png' ? 'none' : 'auto';
});

// Deselect when clicking canvas container background
overlayContainer.addEventListener('mousedown', (e) => {
  if (e.target === overlayContainer) {
    selectBlock(null);
  }
});

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
    dropzone.style.display = 'none';
    editorSection.style.display = 'block';
    previewImg.src = state.imgUrl;
    
    // Add default text block
    addTextBlock('Double-click to edit');
  };
  img.src = state.imgUrl;
}

// ── Add Text Block ─────────────────────────────────────────
function addTextBlock(initialText = 'Type text here') {
  const id = Date.now() + '-' + Math.random().toString(36).substr(2, 9);
  const block = {
    id,
    text: initialText,
    xPercent: 50, // Center
    yPercent: 50,
    size: 28,
    font: 'Outfit',
    color: '#ffffff',
    bold: false,
    italic: false,
    stroke: false,
    strokeColor: '#000000',
    shadow: false,
    shadowColor: '#000000'
  };

  state.textBlocks.push(block);
  renderBlockEl(block);
  selectBlock(id);
}

function renderBlockEl(block) {
  const el = document.createElement('div');
  el.className = 'draggable-text';
  el.id = `block-${block.id}`;
  el.setAttribute('tabindex', '0');
  
  // Set percentage coordinates
  el.style.left = `${block.xPercent}%`;
  el.style.top = `${block.yPercent}%`;
  
  const span = document.createElement('span');
  span.textContent = block.text;
  el.appendChild(span);

  // Delete button
  const delBtn = document.createElement('button');
  delBtn.className = 'draggable-text__delete';
  delBtn.textContent = '×';
  delBtn.title = 'Delete block';
  delBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    deleteBlock(block.id);
  });
  el.appendChild(delBtn);

  applyStylesToEl(el, block);

  // Click to select
  el.addEventListener('mousedown', (e) => {
    e.stopPropagation();
    selectBlock(block.id);
    startDrag(e, el, block);
  });

  // Double click to edit inline
  el.addEventListener('dblclick', (e) => {
    e.stopPropagation();
    span.contentEditable = 'true';
    span.focus();
    el.style.cursor = 'text';

    // Select all text
    const range = document.createRange();
    range.selectNodeContents(span);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  });

  span.addEventListener('input', () => {
    block.text = span.textContent;
    txtContent.value = block.text;
  });

  span.addEventListener('blur', () => {
    span.contentEditable = 'false';
    el.style.cursor = 'move';
    if (!span.textContent.trim()) {
      deleteBlock(block.id);
    }
  });

  overlayContainer.appendChild(el);
}

function applyStylesToEl(el, block) {
  const span = el.querySelector('span');
  span.style.fontFamily = block.font;
  span.style.fontSize = `${block.size}px`;
  span.style.color = block.color;
  span.style.fontWeight = block.bold ? 'bold' : '500';
  span.style.fontStyle = block.italic ? 'italic' : 'normal';

  // Outline (stroke) using css text-shadow trick for clean render
  let textShadows = [];
  if (block.stroke) {
    const c = block.strokeColor;
    textShadows.push(`-1px -1px 0 ${c}, 1px -1px 0 ${c}, -1px 1px 0 ${c}, 1px 1px 0 ${c}`);
  }
  if (block.shadow) {
    textShadows.push(`3px 3px 5px ${block.shadowColor}`);
  }

  span.style.textShadow = textShadows.join(', ') || 'none';
}

// ── Drag Logic ─────────────────────────────────────────────
function startDrag(e, el, block) {
  e.preventDefault();
  const rect = overlayContainer.getBoundingClientRect();
  
  // Keep track of pointer offsets
  const startX = e.clientX;
  const startY = e.clientY;
  const startLeft = el.offsetLeft;
  const startTop = el.offsetTop;

  function onPointerMove(moveEvent) {
    const dx = moveEvent.clientX - startX;
    const dy = moveEvent.clientY - startY;

    let newX = startLeft + dx;
    let newY = startTop + dy;

    // Convert coordinates to percentages of container size
    const pctX = (newX / rect.width) * 100;
    const pctY = (newY / rect.height) * 100;

    // Clamp between 0 and 100
    block.xPercent = Math.max(0, Math.min(100, pctX));
    block.yPercent = Math.max(0, Math.min(100, pctY));

    el.style.left = `${block.xPercent}%`;
    el.style.top = `${block.yPercent}%`;
  }

  function onPointerUp() {
    window.removeEventListener('mousemove', onPointerMove);
    window.removeEventListener('mouseup', onPointerUp);
  }

  window.addEventListener('mousemove', onPointerMove);
  window.addEventListener('mouseup', onPointerUp);
}

// ── State updates ──────────────────────────────────────────
function selectBlock(id) {
  state.selectedId = id;
  
  // CSS styling classes
  document.querySelectorAll('.draggable-text').forEach(el => {
    el.classList.remove('selected');
  });

  if (id === null) {
    // Disable inputs
    txtContent.value = '';
    txtContent.disabled = true;
    txtFont.disabled = true;
    txtColor.disabled = true;
    txtSize.disabled = true;
    txtBold.disabled = true;
    txtItalic.disabled = true;
    txtStrokeEnable.disabled = true;
    txtStrokeColor.disabled = true;
    txtShadowEnable.disabled = true;
    txtShadowColor.disabled = true;
    return;
  }

  const el = document.getElementById(`block-${id}`);
  if (el) el.classList.add('selected');

  const block = state.textBlocks.find(b => b.id === id);
  if (block) {
    txtContent.disabled = false;
    txtFont.disabled = false;
    txtColor.disabled = false;
    txtSize.disabled = false;
    txtBold.disabled = false;
    txtItalic.disabled = false;
    txtStrokeEnable.disabled = false;
    txtStrokeColor.disabled = false;
    txtShadowEnable.disabled = false;
    txtShadowColor.disabled = false;

    // Set panel values
    txtContent.value = block.text;
    txtFont.value = block.font;
    txtColor.value = block.color;
    txtSize.value = block.size;
    valTxtSize.textContent = block.size + 'px';
    txtBold.checked = block.bold;
    txtItalic.checked = block.italic;
    txtStrokeEnable.checked = block.stroke;
    txtStrokeColor.value = block.strokeColor;
    txtShadowEnable.checked = block.shadow;
    txtShadowColor.value = block.shadowColor;
  }
}

function updateSelectedBlock(key, val) {
  if (state.selectedId === null) return;
  const block = state.textBlocks.find(b => b.id === state.selectedId);
  if (block) {
    block[key] = val;
    const el = document.getElementById(`block-${block.id}`);
    if (el) {
      el.querySelector('span').textContent = block.text;
      applyStylesToEl(el, block);
    }
  }
}

function deleteBlock(id) {
  const idx = state.textBlocks.findIndex(b => b.id === id);
  if (idx !== -1) {
    state.textBlocks.splice(idx, 1);
  }
  document.getElementById(`block-${id}`)?.remove();
  if (state.selectedId === id) {
    selectBlock(null);
  }
}

// ── Export / Render ────────────────────────────────────────
async function exportImage() {
  if (!state.imgElement) return;

  btnSave.disabled = true;
  btnSave.textContent = 'Saving…';

  try {
    const img = state.imgElement;
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = img.naturalWidth;
    exportCanvas.height = img.naturalHeight;
    const ctx2 = exportCanvas.getContext('2d');

    // Draw base image
    ctx2.drawImage(img, 0, 0);

    // Calculate scale factor relative to container wrapper bounds
    const wrapperRect = previewImg.getBoundingClientRect();
    const scaleRatio = img.naturalWidth / wrapperRect.width;

    // Draw text overlays
    state.textBlocks.forEach(block => {
      ctx2.save();
      
      // Calculate coordinates from percentages
      const x = (block.xPercent / 100) * img.naturalWidth;
      const y = (block.yPercent / 100) * img.naturalHeight;

      // Scale font size
      const scaledSize = block.size * scaleRatio;
      
      let fontStr = '';
      if (block.italic) fontStr += 'italic ';
      fontStr += block.bold ? 'bold ' : '500 ';
      fontStr += `${Math.round(scaledSize)}px ${block.font}`;
      
      ctx2.font = fontStr;
      ctx2.fillStyle = block.color;
      
      // Set alignment and baseline relative to translation
      ctx2.textAlign = 'center';
      ctx2.textBaseline = 'middle';

      // Drop Shadow
      if (block.shadow) {
        ctx2.shadowColor = block.shadowColor;
        ctx2.shadowBlur = 6 * scaleRatio;
        ctx2.shadowOffsetX = 3 * scaleRatio;
        ctx2.shadowOffsetY = 3 * scaleRatio;
      }

      // Stroke (outline)
      if (block.stroke) {
        ctx2.strokeStyle = block.strokeColor;
        ctx2.lineWidth = 3 * scaleRatio;
        ctx2.lineJoin = 'miter';
        ctx2.miterLimit = 2;
        ctx2.strokeText(block.text, x, y);
      }

      // Fill text
      ctx2.fillText(block.text, x, y);
      ctx2.restore();
    });

    const fmt = optFormat.value;
    const mimeType = `image/${fmt}`;
    const ext = fmt === 'jpeg' ? 'jpg' : fmt;
    const quality = parseFloat(optQuality.value) / 100;

    exportCanvas.toBlob((blob) => {
      if (!blob) {
        toast('Failed to render output.', true);
        btnSave.disabled = false;
        btnSave.textContent = 'Download Image';
        return;
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${state.fileName}-texted.${ext}`;
      a.click();

      setTimeout(() => URL.revokeObjectURL(url), 5000);
      toast('Text image downloaded successfully!');
      
      btnSave.disabled = false;
      btnSave.textContent = 'Download Image';
    }, mimeType, fmt === 'png' ? undefined : quality);

  } catch (err) {
    console.error(err);
    toast('Error exporting image.', true);
    btnSave.disabled = false;
    btnSave.textContent = 'Download Image';
  }
}

// ── Clear / Reset ──────────────────────────────────────────
function clearAll() {
  if (state.imgUrl) {
    URL.revokeObjectURL(state.imgUrl);
    state.imgUrl = null;
  }
  state.file = null;
  state.imgElement = null;
  state.textBlocks = [];
  state.selectedId = null;

  overlayContainer.innerHTML = '';
  fileInput.value = '';
  dropzone.style.display = 'block';
  editorSection.style.display = 'none';
  previewImg.src = '';
  selectBlock(null);
}

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
