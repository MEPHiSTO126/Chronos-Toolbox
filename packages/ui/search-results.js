/**
 * Chronos Toolbox — Search Results Dropdown Component
 * Displays search results in a dropdown below the search input.
 */

'use strict';

const SearchResults = (() => {
  class SearchResultsDropdown {
    constructor(container, options = {}) {
      this.container = typeof container === 'string' ? document.querySelector(container) : container;
      if (!this.container) throw new Error('SearchResults: Container not found');

      this.options = {
        onSelect: null,
        maxResults: 8,
        highlightColor: null,
        ...options
      };

      this.results = [];
      this.selectedIndex = -1;
      this.visible = false;

      this.init();
    }

    init() {
      this.render();
      this.bindEvents();
    }

    render() {
      this.dropdown = document.createElement('div');
      this.dropdown.className = 'search-results';
      this.dropdown.setAttribute('role', 'listbox');
      this.container.appendChild(this.dropdown);
    }

    show(results, query) {
      this.results = results;
      this.selectedIndex = -1;
      this.query = query;

      if (results.length === 0) {
        this.dropdown.innerHTML = `
          <div class="search-results__empty">
            No tools found for "${this.escapeHtml(query)}"
          </div>
        `;
      } else {
        this.dropdown.innerHTML = results.map((result, index) => `
          <a class="search-results__item" href="${result.url || '#'}" role="option" data-index="${index}">
            <div class="search-results__item-icon">
              ${result.icon ? `<img src="${result.icon}" alt="" />` : (result.emoji || '🔧')}
            </div>
            <div class="search-results__item-content">
              <div class="search-results__item-title">${this.highlightMatch(result.title, query)}</div>
              <div class="search-results__item-desc">${result.description || ''}</div>
            </div>
            ${result.category ? `<span class="search-results__item-category">${result.category}</span>` : ''}
            <span class="search-results__item-arrow">→</span>
          </a>
        `).join('');
      }

      this.dropdown.classList.add('visible');
      this.visible = true;
    }

    hide() {
      this.dropdown.classList.remove('visible');
      this.visible = false;
      this.results = [];
      this.selectedIndex = -1;
    }

    highlightMatch(text, query) {
      if (!query) return this.escapeHtml(text);
      
      const escaped = this.escapeHtml(text);
      const color = this.options.highlightColor || 'var(--c-rose, #FF7E9F)';
      const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
      return escaped.replace(regex, `<strong style="color: ${color};">$1</strong>`);
    }

    escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    bindEvents() {
      // Click on result
      this.dropdown.addEventListener('click', (e) => {
        const item = e.target.closest('.search-results__item');
        if (item) {
          e.preventDefault();
          const index = parseInt(item.dataset.index);
          const result = this.results[index];
          if (result && this.options.onSelect) {
            this.options.onSelect(result);
          }
          this.hide();
        }
      });

      // Keyboard navigation
      document.addEventListener('keydown', (e) => {
        if (!this.visible) return;

        if (e.key === 'ArrowDown') {
          e.preventDefault();
          this.selectedIndex = Math.min(this.selectedIndex + 1, this.results.length - 1);
          this.updateSelection();
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
          this.updateSelection();
        } else if (e.key === 'Enter' && this.selectedIndex >= 0) {
          e.preventDefault();
          const result = this.results[this.selectedIndex];
          if (result && this.options.onSelect) {
            this.options.onSelect(result);
          }
          this.hide();
        } else if (e.key === 'Escape') {
          this.hide();
        }
      });

      // Close on click outside
      document.addEventListener('click', (e) => {
        if (!this.dropdown.contains(e.target) && !e.target.closest('.curved-input')) {
          this.hide();
        }
      });
    }

    updateSelection() {
      const items = this.dropdown.querySelectorAll('.search-results__item');
      items.forEach((item, index) => {
        if (index === this.selectedIndex) {
          item.style.background = 'rgba(255,126,159,0.1)';
          item.scrollIntoView({ block: 'nearest' });
        } else {
          item.style.background = '';
        }
      });
    }
  }

  return SearchResultsDropdown;
})();

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SearchResults;
}
