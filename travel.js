// Travel page data. To add a place, copy one entry and change it.
// "map" must match the country's name on the map (hover a country on the page to see it),
// e.g. "Japan", "France", "United Kingdom", "United States of America".
// photo (optional): put an image in images/travel/ and write its path, e.g. "images/travel/seoul.jpg".
const PLACES = [
  // ---- Places I've lived ----
  { type: "lived", name: "Korea", map: "South Korea", city: "", flag: "🇰🇷", note: "" },
  { type: "lived", name: "China", map: "China", city: "", flag: "🇨🇳", note: "" },
  { type: "lived", name: "Germany", map: "Germany", city: "", flag: "🇩🇪", note: "" },
  { type: "lived", name: "Turkey", map: "Turkey", city: "", flag: "🇹🇷", note: "" },
  { type: "lived", name: "United States", map: "United States of America", city: "Atlanta, GA", flag: "🇺🇸", note: "Studying at Emory University." },

  // ---- Places I've visited ----
  // Example: { type: "visited", name: "Japan", map: "Japan", city: "Tokyo", flag: "🇯🇵", note: "Spring 2025", photo: "" },
];

(() => {
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const label = p => p.city ? `${p.city}, ${p.name}` : p.name;
  const cardHTML = p => `
    <article class="card trip ${p.type}">
      <div class="trip-top" ${p.photo ? `style="background-image:url('${esc(p.photo)}')"` : ''}><span class="trip-flag">${p.flag || '📍'}</span></div>
      <p class="kind">${p.type === 'lived' ? 'Lived' : 'Visited'}</p>
      <h3>${esc(label(p))}</h3>
      ${p.note ? `<p>${esc(p.note)}</p>` : ''}
    </article>`;
  const lived = PLACES.filter(p => p.type === 'lived'), visited = PLACES.filter(p => p.type === 'visited');
  document.getElementById('lived').innerHTML = lived.map(cardHTML).join('');
  document.getElementById('visited').innerHTML = visited.length ? visited.map(cardHTML).join('')
    : '<p class="muted">Coming soon: trips I\'ve taken.</p>';
  setupReveal(document.querySelector('main')); setupTilt(document.querySelector('main'));

  // The map is a plain SVG file on this site; countries are colored by matching their names.
  const box = document.getElementById('map');
  fetch('world-map.svg').then(r => r.text()).then(svg => {
    box.innerHTML = svg;
    PLACES.forEach(p => {
      const el = box.querySelector(`path[data-name="${CSS.escape(p.map || p.name)}"]`);
      if (!el) return console.warn(`Travel map: no country named "${p.map || p.name}"`);
      if (!el.classList.contains('lived')) el.classList.add(p.type);   // "lived" wins over "visited"
      el.querySelector('title').textContent = `${label(p)} (${p.type === 'lived' ? 'lived' : 'visited'})`;
    });
  }).catch(() => { box.innerHTML = '<p class="muted">The map could not load.</p>'; });
})();
