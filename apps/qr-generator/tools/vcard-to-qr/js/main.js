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
  const firstNameInput = document.getElementById('first-name');
  const lastNameInput = document.getElementById('last-name');
  const phoneInput = document.getElementById('phone');
  const emailInput = document.getElementById('email');
  const companyInput = document.getElementById('company');
  const jobTitleInput = document.getElementById('job-title');
  const websiteInput = document.getElementById('website');
  const btnGenerate = document.getElementById('btn-generate');
  const qrPreviewCard = document.getElementById('qr-preview-card');
  const qrContainer = document.getElementById('qr-container');
  const btnDownload = document.getElementById('btn-download');

  btnGenerate.addEventListener('click', () => {
    const firstName = firstNameInput.value.trim();
    const lastName = lastNameInput.value.trim();
    const phone = phoneInput.value.trim();
    const email = emailInput.value.trim();
    const company = companyInput.value.trim();
    const jobTitle = jobTitleInput.value.trim();
    const website = websiteInput.value.trim();

    if (!firstName || !lastName) {
      showToast('Please enter both First and Last Name.', true);
      return;
    }

    if (!phone) {
      showToast('Please enter a Phone Number.', true);
      return;
    }

    // Escape vCard value fields helper (escaping backslashes, semicolons, commas, newlines)
    const escapeVCard = (val) => {
      return val.replace(/\\/g, '\\\\')
                .replace(/;/g, '\\;')
                .replace(/,/g, '\\,')
                .replace(/\n/g, '\\n');
    };

    // Construct vCard string
    let vcard = 'BEGIN:VCARD\n';
    vcard += 'VERSION:3.0\n';
    vcard += `N:${escapeVCard(lastName)};${escapeVCard(firstName)};;;\n`;
    vcard += `FN:${escapeVCard(firstName)} ${escapeVCard(lastName)}\n`;
    
    if (company) {
      vcard += `ORG:${escapeVCard(company)}\n`;
    }
    if (jobTitle) {
      vcard += `TITLE:${escapeVCard(jobTitle)}\n`;
    }
    if (phone) {
      vcard += `TEL;TYPE=CELL:${escapeVCard(phone)}\n`;
    }
    if (email) {
      vcard += `EMAIL;TYPE=PREF,INTERNET:${escapeVCard(email)}\n`;
    }
    if (website) {
      vcard += `URL:${escapeVCard(website)}\n`;
    }
    vcard += 'END:VCARD';

    // Clear previous QR code canvas
    qrContainer.innerHTML = '';

    // Create a new canvas element
    const canvas = document.createElement('canvas');
    qrContainer.appendChild(canvas);

    // Generate QR code using the CDN qrcode library
    QRCode.toCanvas(canvas, vcard, {
      width: 256,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    }, (error) => {
      if (error) {
        console.error(error);
        showToast('Failed to generate vCard QR code.', true);
        return;
      }

      // Populate download button href
      btnDownload.href = canvas.toDataURL('image/png');
      btnDownload.download = `${firstName}_${lastName}_vcard.png`;
      
      // Make preview card visible
      qrPreviewCard.classList.add('visible');
      qrPreviewCard.scrollIntoView({ behavior: 'smooth' });
    });
  });
});
