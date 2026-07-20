/**
 * Chronos Toolbox — Search Bar Component
 * Simple, reliable search with dropdown results.
 */

'use strict';

const SearchBar = (() => {

  /**
   * Create a search bar.
   * @param {HTMLElement|string} container  – wrapper element or CSS selector
   * @param {Object}            options
   * @param {Array}             options.tools       – array of {id,title,description,category,url,tags}
   * @param {string}            options.placeholder  – input placeholder
   * @param {string}            options.accent       – accent colour (CSS color)
   * @param {Function}          options.onNavigate   – called with tool url on submit/select
   */
  function create(container, options = {}) {
    const root = typeof container === 'string' ? document.querySelector(container) : container;
    if (!root) return null;

    const {
      tools = [],
      placeholder = 'Search tools...',
      accent = '#00F0FF',
      onNavigate = null
    } = options;

    // ── Build DOM ──────────────────────────────────────────
    root.classList.add('search-bar');
    root.style.setProperty('--accent', accent);

    root.innerHTML = `
      <div class="search-bar__input-wrap">
        <span class="search-bar__icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="7"></circle>
            <line x1="16.5" y1="16.5" x2="21" y2="21"></line>
          </svg>
        </span>
        <input class="search-bar__input" type="text" placeholder="${placeholder}" autocomplete="off" spellcheck="false" aria-label="Search tools" />
        <button class="search-bar__btn" type="button" aria-label="Search">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="7"></circle>
            <line x1="16.5" y1="16.5" x2="21" y2="21"></line>
          </svg>
        </button>
      </div>
      <div class="search-bar__results"></div>
    `;

    const input   = root.querySelector('.search-bar__input');
    const btn     = root.querySelector('.search-bar__btn');
    const results = root.querySelector('.search-bar__results');

    let activeIdx = -1;   // keyboard-selected item
    let currentResults = [];

    // ── Search logic ───────────────────────────────────────
    function doSearch(query) {
      const q = query.trim().toLowerCase();
      if (q.length < 1) { hide(); return; }

      const scored = [];
      for (const tool of tools) {
        let score = 0;

        // Exact title match → highest
        if (tool.title.toLowerCase().includes(q)) { score = 10; }
        // Tag match
        else if (tool.tags && tool.tags.some(t => t.toLowerCase().includes(q))) { score = 8; }
        // Description match
        else if (tool.description && tool.description.toLowerCase().includes(q)) { score = 5; }
        // Subsequence match in title
        else if (isSubsequence(q, tool.title.toLowerCase())) { score = 3; }

        // Partial word-start bonus: each word in title/desc starting with q
        if (score === 0) {
          const words = tool.title.toLowerCase().split(/\s+/);
          if (words.some(w => w.startsWith(q))) score = 9;
          const descWords = (tool.description || '').toLowerCase().split(/\s+/);
          if (descWords.some(w => w.startsWith(q))) score = 6;
        }

        if (score > 0) scored.push({ tool, score });
      }

      scored.sort((a, b) => b.score - a.score);
      currentResults = scored.map(s => s.tool);
      activeIdx = -1;
      show(currentResults, q);
    }

    function isSubsequence(query, text) {
      let qi = 0;
      for (let ti = 0; ti < text.length && qi < query.length; ti++) {
        if (text[ti] === query[qi]) qi++;
      }
      return qi === query.length;
    }

    // ── Show / Hide ────────────────────────────────────────
    function show(items, query) {
      if (!items.length) {
        results.innerHTML = `<div class="search-bar__empty">No tools match "${escapeHtml(query)}"</div>`;
      } else {
        const maxShow = Math.min(items.length, 12);
        let html = items.slice(0, maxShow).map((tool, i) => {
          const title = highlight(tool.title, query);
          return `
            <a class="search-bar__item${i === activeIdx ? ' active' : ''}" href="${tool.url}" data-idx="${i}" role="option">
              <div class="search-bar__item-icon">${tool.emoji || '🔧'}</div>
              <div class="search-bar__item-body">
                <div class="search-bar__item-title">${title}</div>
                <div class="search-bar__item-desc">${escapeHtml(tool.description || '')}</div>
              </div>
              <span class="search-bar__item-cat">${escapeHtml(tool.category || '')}</span>
              <span class="search-bar__item-arrow">→</span>
            </a>`;
        }).join('');

        if (items.length > maxShow) {
          html += `<div class="search-bar__count">${items.length} tools found — showing top ${maxShow}</div>`;
        }

        results.innerHTML = html;
      }
      results.classList.add('visible');
    }

    function hide() {
      results.classList.remove('visible');
      currentResults = [];
      activeIdx = -1;
    }

    function highlight(text, query) {
      if (!query) return escapeHtml(text);
      const escaped = escapeHtml(text);
      const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
      return escaped.replace(regex, `<strong>$1</strong>`);
    }

    function escapeHtml(str) {
      const d = document.createElement('div');
      d.textContent = str;
      return d.innerHTML;
    }

    // ── Events ─────────────────────────────────────────────
    input.addEventListener('input', () => doSearch(input.value));

    input.addEventListener('keydown', (e) => {
      const items = results.querySelectorAll('.search-bar__item');
      if (!items.length) {
        if (e.key === 'Escape') hide();
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        activeIdx = Math.min(activeIdx + 1, items.length - 1);
        updateActive(items);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        activeIdx = Math.max(activeIdx - 1, 0);
        updateActive(items);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (activeIdx >= 0 && activeIdx < currentResults.length) {
          navigate(currentResults[activeIdx].url);
        } else if (input.value.trim()) {
          // Navigate to first result
          doSearch(input.value);
          if (currentResults.length) navigate(currentResults[0].url);
        }
      } else if (e.key === 'Escape') {
        hide();
        input.blur();
      }
    });

    btn.addEventListener('click', () => {
      if (input.value.trim()) {
        doSearch(input.value);
        if (currentResults.length) navigate(currentResults[0].url);
      } else {
        input.focus();
      }
    });

    // Close on click outside
    document.addEventListener('click', (e) => {
      if (!root.contains(e.target)) hide();
    });

    // ── Helpers ────────────────────────────────────────────
    function updateActive(items) {
      items.forEach((el, i) => {
        el.classList.toggle('active', i === activeIdx);
        if (i === activeIdx) el.scrollIntoView({ block: 'nearest' });
      });
    }

    function navigate(url) {
      hide();
      if (onNavigate) onNavigate(url);
      else window.location.href = url;
    }

    // ── Public API ─────────────────────────────────────────
    return { input, btn, results, hide, destroy: () => root.innerHTML = '' };
  }

  return { create };
})();
