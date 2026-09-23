/**
 * Chronos Toolbox - Shared UI & Toast Utilities
 */
(function() {
  'use strict';

  function showToast(message, isError = false) {
    const existing = document.querySelector('.ct-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `ct-toast ${isError ? 'ct-toast--error' : ''}`;
    toast.setAttribute('role', isError ? 'alert' : 'status');
    toast.setAttribute('aria-live', isError ? 'assertive' : 'polite');
    toast.textContent = message;
    document.body.appendChild(toast);

    toast.offsetHeight; // trigger reflow
    toast.classList.add('show');

    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 350);
    }, 3500);
  }

  function setupKeyboardAccessibleDropzone(dropzoneEl, fileInputEl) {
    if (!dropzoneEl || !fileInputEl) return;
    if (!dropzoneEl.hasAttribute('tabindex')) {
      dropzoneEl.setAttribute('tabindex', '0');
    }
    if (!dropzoneEl.hasAttribute('role')) {
      dropzoneEl.setAttribute('role', 'button');
    }
    dropzoneEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        fileInputEl.click();
      }
    });
  }

  window.CHRONOS_UI = {
    showToast,
    setupKeyboardAccessibleDropzone
  };
})();
