/**
 * Chronos Toolbox — Fuzzy Search Utility
 * Provides typo-tolerant search functionality for tools.
 */

'use strict';

const FuzzySearch = (() => {
  // Levenshtein distance for typo tolerance
  const levenshtein = (a, b) => {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;

    const matrix = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(null));

    for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= b.length; j++) matrix[j][0] = j;

    for (let j = 1; j <= b.length; j++) {
      for (let i = 1; i <= a.length; i++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,      // deletion
          matrix[j - 1][i] + 1,      // insertion
          matrix[j - 1][i - 1] + cost // substitution
        );
      }
    }

    return matrix[b.length][a.length];
  };

  // Calculate similarity score (0-1, higher is better)
  const similarity = (a, b) => {
    const maxLen = Math.max(a.length, b.length);
    if (maxLen === 0) return 1;
    const dist = levenshtein(a.toLowerCase(), b.toLowerCase());
    return 1 - dist / maxLen;
  };

  // Check if query matches text with typo tolerance
  const matches = (query, text, threshold = 0.6) => {
    const q = query.toLowerCase().trim();
    const t = text.toLowerCase();

    // Exact match
    if (t.includes(q)) return { match: true, score: 1 };

    // Check each word in text
    const words = t.split(/\s+/);
    for (const word of words) {
      if (word.includes(q) || q.includes(word)) {
        return { match: true, score: 0.9 };
      }
    }

    // Fuzzy match with typo tolerance
    const wordsWithQuery = [...words, q];
    for (const w of wordsWithQuery) {
      const sim = similarity(q, w);
      if (sim >= threshold) {
        return { match: true, score: sim };
      }
    }

    // Check if query is a subsequence of any word
    for (const word of words) {
      let qi = 0;
      for (let wi = 0; wi < word.length && qi < q.length; wi++) {
        if (word[wi] === q[qi]) qi++;
      }
      if (qi === q.length) {
        return { match: true, score: 0.7 };
      }
    }

    return { match: false, score: 0 };
  };

  // Search through tools and return matching results
  const searchTools = (query, tools, options = {}) => {
    const {
      threshold = 0.5,
      maxResults = 10,
      keys = ['title', 'description', 'tags']
    } = options;

    if (!query || !query.trim()) return tools.map(tool => ({ ...tool, score: 1 }));

    const results = [];

    for (const tool of tools) {
      let bestScore = 0;
      let matched = false;

      for (const key of keys) {
        const value = tool[key];
        if (!value) continue;

        const textToSearch = Array.isArray(value) ? value.join(' ') : value;
        const result = matches(query, textToSearch, threshold);

        if (result.match && result.score > bestScore) {
          bestScore = result.score;
          matched = true;
        }
      }

      if (matched) {
        results.push({ ...tool, score: bestScore });
      }
    }

    // Sort by score (highest first)
    results.sort((a, b) => b.score - a.score);

    return results.slice(0, maxResults);
  };

  // Debounce function
  const debounce = (fn, delay) => {
    let timeoutId;
    return (...args) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => fn(...args), delay);
    };
  };

  return {
    levenshtein,
    similarity,
    matches,
    searchTools,
    debounce
  };
})();

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FuzzySearch;
}
