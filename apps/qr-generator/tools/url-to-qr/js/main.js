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
  const textInput = document.getElementById('text-input');
  const btnGenerate = document.getElementById('btn-generate');
  const qrPreviewCard = document.getElementById('qr-preview-card');
  const qrContainer = document.getElementById('qr-container');
  const btnDownload = document.getElementById('btn-download');

  btnGenerate.addEventListener('click', () => {
    const text = textInput.value.trim();
    if (!text) {
      showToast('Please enter some text or a URL.', true);
      return;
    }

    // Clear previous QR code canvas
    qrContainer.innerHTML = '';

    // Create a new canvas element
    const canvas = document.createElement('canvas');
    qrContainer.appendChild(canvas);

    // Generate QR code using the CDN qrcode library
    QRCode.toCanvas(canvas, text, {
      width: 256,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    }, (error) => {
      if (error) {
        console.error(error);
        showToast('Failed to generate QR code.', true);
        return;
      }

      // Populate download button href
      btnDownload.href = canvas.toDataURL('image/png');
      
      // Make preview card visible
      qrPreviewCard.classList.add('visible');
      qrPreviewCard.scrollIntoView({ behavior: 'smooth' });
    });
  });
});
