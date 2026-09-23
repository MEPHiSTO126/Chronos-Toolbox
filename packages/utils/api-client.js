/**
 * Chronos Toolbox - Shared API Client Utilities
 */
(function() {
  'use strict';

  /**
   * Parses an HTTP error response or response-like object to extract a human-readable error message.
   * Handles JSON responses ({ detail, message }), HTML error pages, and plain text.
   * @param {Object} response
   * @returns {Promise<string>}
   */
  async function parseErrorResponse(response) {
    try {
      let text = '';
      if (typeof response.text === 'function') {
        text = await response.text();
      } else if (typeof response.body === 'string') {
        text = response.body;
      }

      if (text) {
        try {
          const data = JSON.parse(text);
          if (typeof data.detail === 'string') return data.detail;
          if (Array.isArray(data.detail)) {
            return data.detail.map(d => d.msg || JSON.stringify(d)).join(', ');
          }
          if (typeof data.detail === 'object' && data.detail !== null) {
            return JSON.stringify(data.detail);
          }
          if (data.message) return data.message;
        } catch {
          // not JSON
        }

        if (text.trim().startsWith('<')) {
          return `Server error (${response.status || 'unknown'}): ${response.statusText || 'Unexpected server response'}`;
        }
        return text;
      }
      return response.statusText || `Server error (${response.status || 'unknown'})`;
    } catch {
      return response.statusText || `Server error (${response.status || 'unknown'})`;
    }
  }

  /**
   * Attempts to wake up or check readiness of the backend with a bounded number of attempts
   * and support for AbortSignal to allow user cancellation.
   * @param {Object} options
   * @param {string} [options.url]
   * @param {number} [options.maxAttempts=15]
   * @param {AbortSignal} [options.signal]
   * @param {Function} [options.onStatusChange]
   * @returns {Promise<boolean>}
   */
  async function ensureBackendAwake(options = {}) {
    const config = window.CHRONOS_CONFIG || {};
    const defaultBase = config.API_BASE || 'https://toolbox-backend-76dc.onrender.com';
    const baseUrl = options.url || (typeof BASE_URL !== 'undefined' ? BASE_URL : defaultBase);
    const origin = new URL(baseUrl, window.location.href).origin;
    const maxAttempts = options.maxAttempts || 15;
    const signal = options.signal;
    const onStatusChange = options.onStatusChange || ((msg) => {
      const el = document.getElementById('progress-text');
      if (el) el.textContent = msg;
    });

    onStatusChange('Connecting to server (waking up if sleeping)...');

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      if (signal && signal.aborted) {
        throw new DOMException('Operation aborted by user', 'AbortError');
      }

      try {
        const fetchOptions = { method: 'GET', cache: 'no-store' };
        if (signal) fetchOptions.signal = signal;
        const res = await fetch(`${origin}/`, fetchOptions);
        if (res.ok) {
          onStatusChange('Server ready. Uploading and processing...');
          return true;
        }
      } catch (e) {
        if (e.name === 'AbortError') throw e;
        console.warn(`Wake attempt ${attempt}/${maxAttempts} failed:`, e.message || e);
      }

      if (attempt < maxAttempts) {
        const waitTime = Math.min(1500 + attempt * 200, 3500);
        await new Promise((resolve, reject) => {
          const timer = setTimeout(resolve, waitTime);
          if (signal) {
            signal.addEventListener('abort', () => {
              clearTimeout(timer);
              reject(new DOMException('Operation aborted by user', 'AbortError'));
            }, { once: true });
          }
        });
      }
    }

    return false;
  }

  /**
   * Helper that wires up a cancel button (id="btn-cancel") to abort ongoing conversion/upload
   * @param {Object} context
   * @param {AbortController} context.controller
   * @param {Function} context.onCancel
   */
  function bindCancelButton(controller, onCancel) {
    const cancelBtn = document.getElementById('btn-cancel');
    if (!cancelBtn) return;
    const handler = () => {
      try { controller.abort(); } catch (e) {}
      if (typeof onCancel === 'function') onCancel();
    };
    cancelBtn.onclick = handler;
  }

  window.CHRONOS_API = {
    parseErrorResponse,
    ensureBackendAwake,
    bindCancelButton
  };
})();
