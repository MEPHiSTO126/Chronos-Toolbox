function showToast(message, isError = false) {
  const existingToast = document.querySelector('.ct-toast');
  if (existingToast) existingToast.remove();

  const toast = document.createElement('div');
  toast.className = `ct-toast ${isError ? 'ct-toast--error' : ''}`;
  toast.setAttribute("role", "status");
  toast.setAttribute("aria-live", "polite");
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

  const btnStartCamera = document.getElementById('btn-start-camera');
  const btnStopCamera = document.getElementById('btn-stop-camera');
  const cameraContainer = document.getElementById('camera-container');
  const cameraPreview = document.getElementById('camera-preview');
  const cameraCanvas = document.getElementById('camera-canvas');
  let cameraStream = null;
  let cameraScanRaf = null;

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

  if (btnStartCamera) {
    btnStartCamera.addEventListener('click', startCameraScanner);
  }
  if (btnStopCamera) {
    btnStopCamera.addEventListener('click', stopCameraScanner);
  }

  async function startCameraScanner() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      showToast('Camera access is not supported by your browser or environment.', true);
      return;
    }

    try {
      cameraStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      cameraPreview.srcObject = cameraStream;
      cameraPreview.setAttribute('playsinline', 'true');
      await cameraPreview.play();

      cameraContainer.style.display = 'block';
      btnStartCamera.style.display = 'none';
      dropzone.style.display = 'none';
      cameraScanRaf = requestAnimationFrame(scanCameraTick);
    } catch (err) {
      console.error('Camera error:', err);
      showToast('Unable to access camera. Please check permissions.', true);
      stopCameraScanner();
    }
  }

  function stopCameraScanner() {
    if (cameraScanRaf) {
      cancelAnimationFrame(cameraScanRaf);
      cameraScanRaf = null;
    }
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      cameraStream = null;
    }
    if (cameraPreview) {
      cameraPreview.srcObject = null;
    }
    if (cameraContainer) {
      cameraContainer.style.display = 'none';
    }
    if (btnStartCamera) {
      btnStartCamera.style.display = 'inline-flex';
    }
    if (dropzone) {
      dropzone.style.display = 'flex';
    }
  }

  function scanCameraTick() {
    if (!cameraStream || !cameraPreview || cameraPreview.readyState !== cameraPreview.HAVE_ENOUGH_DATA) {
      cameraScanRaf = requestAnimationFrame(scanCameraTick);
      return;
    }

    const ctx = cameraCanvas.getContext('2d');
    cameraCanvas.width = cameraPreview.videoWidth;
    cameraCanvas.height = cameraPreview.videoHeight;
    ctx.drawImage(cameraPreview, 0, 0, cameraCanvas.width, cameraCanvas.height);

    try {
      const imageData = ctx.getImageData(0, 0, cameraCanvas.width, cameraCanvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'dontInvert'
      });

      if (code && code.data) {
        stopCameraScanner();
        displayResult(code.data);
        return;
      }
    } catch (err) {
      console.warn('Frame scan error:', err);
    }

    cameraScanRaf = requestAnimationFrame(scanCameraTick);
  }

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

    // Check if it's a safe HTTP/HTTPS URL (prevents javascript: XSS)
    if (isValidHttpURL(text)) {
      btnOpenLink.href = text;
      btnOpenLink.target = '_blank';
      btnOpenLink.rel = 'noopener noreferrer';
      btnOpenLink.style.display = 'inline-flex';
    } else {
      btnOpenLink.removeAttribute('href');
      btnOpenLink.style.display = 'none';
    }

    resultTextArea.scrollIntoView({ behavior: 'smooth' });
  }

  function isValidHttpURL(string) {
    try {
      const parsed = new URL(string);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
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