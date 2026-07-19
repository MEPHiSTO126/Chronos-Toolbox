function showToast(message, isError = false) {
  const existingToast = document.querySelector('.ct-toast');
  if (existingToast) existingToast.remove();

  const toast = document.createElement('div');
  toast.className = `ct-toast ${isError ? 'ct-toast--error' : ''}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  toast.offsetHeight;
  toast.classList.add('show');

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 3500);
  }, 5000);
}

document.addEventListener('DOMContentLoaded', () => {
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('file-input');
  const resultTextArea = document.getElementById('result-text-area');
  const decodedContent = document.getElementById('decoded-content');
  const btnCopy = document.getElementById('btn-copy');
  const btnOpenLink = document.getElementById('btn-open-link');

  // Handle Drag & Drop styles
  ['dragenter', 'dragover'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropzone.classList.add('drag-over');
    }, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropzone.classList.remove('drag-over');
    }, false);
  });

  // Handle Drop / File Select
  dropzone.addEventListener('drop', handleDrop, false);
  fileInput.addEventListener('change', handleFileSelect, false);

  function handleDrop(e) {
    const dt = e.dataTransfer;
    const files = dt.files;
    if (files.length > 0) {
      processFile(files[0]);
    }
  }

  function handleFileSelect(e) {
    const files = e.target.files;
    if (files.length > 0) {
      processFile(files[0]);
    }
  }

  function processFile(file) {
    if (!file.type.startsWith('image/')) {
      showToast('Please upload an image file.', true);
      return;
    }

    const reader = new FileReader();
    reader.onload = function(event) {
      const img = new Image();
      img.onload = function() {
        // Draw to a hidden canvas
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);

        try {
          const imageData = ctx.getImageData(0, 0, img.width, img.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height);

          if (code) {
            displayResult(code.data);
          } else {
            showToast('Could not find a valid QR Code in this image. Please make sure the QR code is clear and well-lit.', true);
          }
        } catch (err) {
          console.error(err);
          showToast('Error processing image data.', true);
        }
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  }

  function displayResult(text) {
    decodedContent.textContent = text;
    resultTextArea.classList.add('visible');

    // Check if it's a URL
    if (isValidURL(text)) {
      btnOpenLink.href = text;
      btnOpenLink.style.display = 'inline-flex';
    } else {
      btnOpenLink.style.display = 'none';
    }

    resultTextArea.scrollIntoView({ behavior: 'smooth' });
  }

  function isValidURL(string) {
    try {
      new URL(string);
      return true;
    } catch (_) {
      return false;
    }
  }

  // Copy functionality
  btnCopy.addEventListener('click', () => {
    const text = decodedContent.textContent;
    if (!text) return;

    navigator.clipboard.writeText(text).then(() => {
      const origText = btnCopy.textContent;
      btnCopy.textContent = '✅ Copied!';
      setTimeout(() => {
        btnCopy.textContent = origText;
      }, 1500);
    }).catch(err => {
      console.error('Failed to copy: ', err);
    });
  });
});
