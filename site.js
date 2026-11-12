// Shared behavior for every page: theme toggle, animations, progress bar, card tilt.
(() => {
  const root = document.documentElement;
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // Theme toggle (remembers your choice in this browser)
  const btn = document.getElementById('theme');
  try { const t = localStorage.getItem('theme'); if (t) root.dataset.theme = t; } catch (e) {}
  btn && btn.addEventListener('click', () => {
    const dark = root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    root.dataset.theme = dark ? 'light' : 'dark';
    try { localStorage.setItem('theme', root.dataset.theme); } catch (e) {}
    document.dispatchEvent(new CustomEvent('themechange'));
  });

  // Mark the current page in the nav
  const here = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('nav a[href]').forEach(a => {
    if (a.getAttribute('href') === here) a.setAttribute('aria-current', 'page');
  });

  // Mobile menu
  const menu = document.getElementById('menu');
  menu && menu.addEventListener('click', () => document.body.classList.toggle('nav-open'));

  // Split headline text into letters for the intro animation
  document.querySelectorAll('.split').forEach(el => {
    const text = el.textContent; el.textContent = ''; el.setAttribute('aria-label', text);
    [...text].forEach((ch, i) => {
      const s = document.createElement('span');
      s.className = 'ch'; s.setAttribute('aria-hidden', 'true');
      s.style.setProperty('--i', i); s.textContent = ch === ' ' ? ' ' : ch;
      el.appendChild(s);
    });
  });

  // Scroll reveal: animate in when entering the screen, out when leaving (both directions)
  window.setupReveal = (scope = document) => {
    scope.querySelectorAll('[data-reveal="stagger"]').forEach(g =>
      [...g.children].forEach((c, i) => c.style.setProperty('--i', i)));
    scope.querySelectorAll('[data-reveal]').forEach(el => io.observe(el));
  };
  const io = new IntersectionObserver(entries => entries.forEach(e => {
    e.target.classList.toggle('in', e.isIntersecting);
    if (!e.isIntersecting) e.target.classList.toggle('above', e.boundingClientRect.top < 0);
  }), { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
  setupReveal();

  // Scroll progress bar + background parallax
  const bar = document.querySelector('.progress');
  const onScroll = () => {
    const max = document.documentElement.scrollHeight - innerHeight;
    if (bar) bar.style.transform = `scaleX(${max > 0 ? scrollY / max : 0})`;
    root.style.setProperty('--scroll', scrollY);
  };
  addEventListener('scroll', onScroll, { passive: true }); onScroll();

  // 3D tilt on cards following the mouse
  window.setupTilt = (scope = document) => {
    if (!matchMedia('(hover: hover) and (prefers-reduced-motion: no-preference)').matches) return;
    scope.querySelectorAll('.card').forEach(card => {
      card.addEventListener('pointermove', e => {
        const r = card.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
        card.style.setProperty('--rx', `${-y * 8}deg`); card.style.setProperty('--ry', `${x * 8}deg`);
        card.style.setProperty('--mx', `${(x + 0.5) * 100}%`); card.style.setProperty('--my', `${(y + 0.5) * 100}%`);
      });
      card.addEventListener('pointerleave', () => { card.style.setProperty('--rx', '0deg'); card.style.setProperty('--ry', '0deg'); });
    });
  };
  setupTilt();
})();

// Loads the tracker data: the freshest copy from GitHub, falling back to the copy on this site.
window.loadTracker = async () => {
  const sources = ['https://raw.githubusercontent.com/jshin0229/jshin0229.github.io/main/data/tracker.json', 'data/tracker.json'];
  for (const url of sources) {
    try { const res = await fetch(url, { cache: 'no-cache' }); if (res.ok) return await res.json(); } catch (e) {}
  }
  throw new Error('Tracker data unavailable');
};
window.fmtPct = (x, d = 1, sign = false) => x == null ? '–' : `${sign && x > 0 ? '+' : ''}${(x * 100).toFixed(d)}%`;
