document.addEventListener('DOMContentLoaded', () => {
  const ssidInput = document.getElementById('ssid-input');
  const passwordInput = document.getElementById('password-input');
  const encryptionInput = document.getElementById('encryption-input');
  const hiddenInput = document.getElementById('hidden-input');
  const btnGenerate = document.getElementById('btn-generate');
  const qrPreviewCard = document.getElementById('qr-preview-card');
  const qrContainer = document.getElementById('qr-container');
  const btnDownload = document.getElementById('btn-download');

  // Toggle password visibility / disabled state when open network selected
  encryptionInput.addEventListener('change', () => {
    if (encryptionInput.value === 'nopass') {
      passwordInput.disabled = true;
      passwordInput.value = '';
      passwordInput.placeholder = 'No password required';
    } else {
      passwordInput.disabled = false;
      passwordInput.placeholder = 'WiFi Password (if required)';
    }
  });

  btnGenerate.addEventListener('click', () => {
    const ssid = ssidInput.value.trim();
    const password = passwordInput.value.trim();
    const encryption = encryptionInput.value;
    const isHidden = hiddenInput.checked;

    if (!ssid) {
      alert('Please enter your network name (SSID).');
      return;
    }

    if (encryption !== 'nopass' && !password) {
      alert('Please enter the password for your secured network.');
      return;
    }

    // Escape special characters: backslash, semicolon, comma, colon
    const escapeString = (str) => {
      return str.replace(/\\/g, '\\\\')
                .replace(/;/g, '\\;')
                .replace(/,/g, '\\,')
                .replace(/:/g, '\\:');
    };

    // Construct WiFi string: WIFI:S:SSID;T:SEC;P:PASS;H:HIDDEN;;
    let wifiString = `WIFI:S:${escapeString(ssid)};T:${encryption};`;
    if (encryption !== 'nopass') {
      wifiString += `P:${escapeString(password)};`;
    }
    if (isHidden) {
      wifiString += `H:true;`;
    }
    wifiString += `;`;

    // Clear previous QR code canvas
    qrContainer.innerHTML = '';

    // Create a new canvas element
    const canvas = document.createElement('canvas');
    qrContainer.appendChild(canvas);

    // Generate QR code using the CDN qrcode library
    QRCode.toCanvas(canvas, wifiString, {
      width: 256,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    }, (error) => {
      if (error) {
        console.error(error);
        alert('Failed to generate WiFi QR code.');
        return;
      }

      // Populate download button href
      btnDownload.href = canvas.toDataURL('image/png');
      btnDownload.download = `wifi-${ssid}-qr.png`;
      
      // Make preview card visible
      qrPreviewCard.classList.add('visible');
      qrPreviewCard.scrollIntoView({ behavior: 'smooth' });
    });
  });
});
