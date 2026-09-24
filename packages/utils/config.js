/**
 * Chronos Toolbox - Global Runtime Configuration
 */
(function() {
  'use strict';
  const hostname = window.location.hostname;
  const isLocal = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0';
  
  window.CHRONOS_CONFIG = Object.assign({
    isLocal: isLocal,
    API_BASE: isLocal ? 'http://localhost:8000' : 'https://toolbox-backend-ayd8.onrender.com',
  }, window.CHRONOS_CONFIG || {});
})();
