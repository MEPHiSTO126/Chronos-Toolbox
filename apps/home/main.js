/**
 * Chronos Toolbox — Home Hub
 * Cards are plain anchor links now, so no JS filtering needed here.
 * This file handles any future interactivity (keyboard nav, analytics hooks, etc.)
 */

// Smooth scroll for in-page anchor links
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const target = document.querySelector(a.getAttribute('href'));
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
});

// ── Search Functionality ──────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Initialize search with all tools
  ToolSearch.initSearch('curved-search', ToolSearch.allTools, {
    placeholder: 'Search all tools...',
    buttonColor: '#00F0FF'
  });
});
