/**
 * Chronos Toolbox — Doc Converter Hub
 * Handles category filtering and card interactions.
 */

// ── Category filter ───────────────────────────────────────
const filterBtns = document.querySelectorAll('.filter-btn');
const cards      = document.querySelectorAll('.tool-card[data-category]');

filterBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const filter = btn.dataset.filter;

    // Update active state
    filterBtns.forEach(b => {
      b.classList.remove('active');
      b.setAttribute('aria-selected', 'false');
    });
    btn.classList.add('active');
    btn.setAttribute('aria-selected', 'true');

    // Show / hide cards
    cards.forEach(card => {
      const cats = card.dataset.category || '';
      if (filter === 'all' || cats.split(' ').includes(filter)) {
        card.classList.remove('hidden');
      } else {
        card.classList.add('hidden');
      }
    });
  });
});

// ── Scroll-triggered card animation ──────────────────────
const observer = new IntersectionObserver(
  entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.animationPlayState = 'running';
        observer.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.08 }
);

cards.forEach(card => {
  card.style.animationPlayState = 'paused';
  observer.observe(card);
});
