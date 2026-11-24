/**
 * Chronos Toolbox — Home Hub
 * Cards are plain anchor links now, so no JS filtering needed here.
 * This file handles any future interactivity (keyboard nav, analytics hooks, etc.)
 */

// Smooth scroll for in-page anchor links
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
document.querySelectorAll('a[href^="#"]').forEach(a => {
  const href = a.getAttribute('href');
  if (!href || href.length < 2) return;
  let target = null;
  try { target = document.querySelector(href); } catch (e) { return; }
  if (!target) return;
  a.addEventListener('click', e => {
    e.preventDefault();
    target.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'start' });
    if (target.hasAttribute('tabindex') === false) target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
  });
});

// ── Search Functionality ──────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  if (typeof SearchBar === 'undefined' || typeof ToolSearch === 'undefined') return;
  SearchBar.create('#search-container', {
    tools: ToolSearch.allTools,
    placeholder: 'Search all tools...',
    accent: '#7DD8E0'
  });
});
