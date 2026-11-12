// Travel page data. To add a place, copy one entry and change it.
// lat/lng: right-click the spot in Google Maps and click the numbers to copy them.
// photo (optional): put an image in images/travel/ and write its path, e.g. "images/travel/seoul.jpg".
const PLACES = [
  // ---- Places I've lived ----
  // Pins sit at each country's center. Change "city", "lat" and "lng" to the exact city if you like.
  { type: "lived", name: "Korea", city: "", flag: "🇰🇷", lat: 36.5, lng: 127.9, note: "" },
  { type: "lived", name: "China", city: "", flag: "🇨🇳", lat: 35.0, lng: 104.0, note: "" },
  { type: "lived", name: "Germany", city: "", flag: "🇩🇪", lat: 51.2, lng: 10.4, note: "" },
  { type: "lived", name: "Turkey", city: "", flag: "🇹🇷", lat: 39.0, lng: 35.2, note: "" },
  { type: "lived", name: "United States", city: "Atlanta, GA", flag: "🇺🇸", lat: 33.79, lng: -84.32, note: "Studying at Emory University." },

  // ---- Places I've visited ----
  // Example: { type: "visited", name: "Japan", city: "Tokyo", flag: "🇯🇵", lat: 35.68, lng: 139.69, note: "Spring 2025", photo: "" },
];

(() => {
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const cardHTML = p => `
    <article class="card trip ${p.type}">
      <div class="trip-top" ${p.photo ? `style="background-image:url('${esc(p.photo)}')"` : ''}><span class="trip-flag">${p.flag || '📍'}</span></div>
      <p class="kind">${p.type === 'lived' ? 'Lived' : 'Visited'}</p>
      <h3>${esc(p.city ? `${p.city}, ${p.name}` : p.name)}</h3>
      ${p.note ? `<p>${esc(p.note)}</p>` : ''}
    </article>`;
  const lived = PLACES.filter(p => p.type === 'lived'), visited = PLACES.filter(p => p.type === 'visited');
  document.getElementById('lived').innerHTML = lived.map(cardHTML).join('');
  document.getElementById('visited').innerHTML = visited.length ? visited.map(cardHTML).join('')
    : '<p class="muted">Coming soon: trips I\'ve taken.</p>';
  setupReveal(document.querySelector('main')); setupTilt(document.querySelector('main'));

  if (typeof L === 'undefined') { document.getElementById('map').innerHTML = '<p class="muted">The map could not load.</p>'; return; }
  const map = L.map('map', { scrollWheelZoom: false, worldCopyJump: true, zoomSnap: 0.25 });
  const isDark = () => document.documentElement.dataset.theme === 'dark' ||
    (!document.documentElement.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches);
  let tiles;
  const setTiles = () => {
    if (tiles) map.removeLayer(tiles);
    tiles = L.tileLayer(`https://{s}.basemaps.cartocdn.com/${isDark() ? 'dark_all' : 'light_all'}/{z}/{x}/{y}{r}.png`, {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd', maxZoom: 18 }).addTo(map);
  };
  setTiles();
  document.addEventListener('themechange', setTiles);
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', setTiles);

  const markers = PLACES.map(p => L.marker([p.lat, p.lng], {
      icon: L.divIcon({ className: '', html: `<span class="map-pin ${p.type}">${p.flag || ''}</span>`, iconSize: [34, 34], iconAnchor: [17, 17] }),
      title: p.name, keyboard: true })
    .bindPopup(`<strong>${esc(p.city ? `${p.city}, ${p.name}` : p.name)}</strong><br>${p.type === 'lived' ? 'Lived' : 'Visited'}${p.note ? `<br>${esc(p.note)}` : ''}`)
    .addTo(map));
  map.fitBounds(L.featureGroup(markers).getBounds().pad(0.25));
})();
