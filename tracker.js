// Live Tracker page: renders data/tracker.json (rebuilt every weekday by GitHub Actions).
(() => {
  const css = n => getComputedStyle(document.querySelector('.viz-root')).getPropertyValue(n).trim();
  const STRATS = ['Time-series momentum', 'Risk parity', 'Dual momentum', 'Sector rotation', 'S&P 500', '60/40'];
  const BENCH = new Set(['S&P 500', '60/40']);
  const slot = name => css(`--series-${STRATS.indexOf(name) + 1}`);
  const money = v => '$' + Math.round(v).toLocaleString();
  const charts = {};
  let DATA, range = 'all';

  // Vertical crosshair line under the hovered point
  const crosshair = {
    id: 'crosshair',
    afterDatasetsDraw(chart) {
      const a = chart.tooltip && chart.tooltip.getActiveElements();
      if (!a || !a.length) return;
      const { ctx, chartArea } = chart, x = a[0].element.x;
      ctx.save(); ctx.strokeStyle = css('--grid-strong'); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, chartArea.top); ctx.lineTo(x, chartArea.bottom); ctx.stroke(); ctx.restore();
    },
  };

  function baseOptions({ log = false, yFmt = v => v, xTicks = 6 } = {}) {
    const ink = css('--text-secondary'), grid = css('--grid');
    return {
      responsive: true, maintainAspectRatio: false, animation: { duration: 500 },
      interaction: { mode: 'index', intersect: false },
      elements: { point: { radius: 0, hoverRadius: 5, hoverBorderWidth: 2, hoverBorderColor: css('--surface-1') }, line: { borderWidth: 2, tension: 0 } },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: css('--surface-1'), titleColor: css('--text-primary'), bodyColor: css('--text-secondary'),
          borderColor: css('--grid-strong'), borderWidth: 1, padding: 10, boxPadding: 4, usePointStyle: true,
          itemSort: (a, b) => b.parsed.y - a.parsed.y,
          callbacks: { label: c => ` ${c.dataset.label}: ${yFmt(c.parsed.y)}` },
        },
      },
      scales: {
        x: { grid: { display: false }, border: { color: grid }, ticks: { color: ink, maxTicksLimit: innerWidth < 600 ? Math.min(4, xTicks) : xTicks, autoSkipPadding: 16, maxRotation: 0, font: { size: 11 } } },
        y: { type: log ? 'logarithmic' : 'linear', grid: { color: grid }, border: { display: false },
             ticks: { color: ink, font: { size: 11 }, maxTicksLimit: 6, callback: v => yFmt(v) } },
      },
    };
  }

  function legend(el, items) {
    el.innerHTML = items.map(([label, color, dashed]) =>
      `<span><i class="sw${dashed ? ' dashed' : ''}" style="--c:${color}"></i>${label}</span>`).join('');
  }

  function draw(id, config) {
    if (charts[id]) charts[id].destroy();
    charts[id] = new Chart(document.getElementById(id), { ...config, plugins: [crosshair] });
  }

  function trendChart() {
    const s = DATA.spy_trend.series;
    const items = [['SPY price', css('--ink-series')], ['50-day average', css('--series-1')], ['200-day average', css('--series-2')]];
    legend(document.getElementById('trend-legend'), items);
    draw('trend-chart', {
      type: 'line',
      data: { labels: s.dates, datasets: [
        { label: 'SPY', data: s.price, borderColor: items[0][1], borderWidth: 1.5 },
        { label: '50-day', data: s.sma50, borderColor: items[1][1] },
        { label: '200-day', data: s.sma200, borderColor: items[2][1] },
      ] },
      options: baseOptions({ yFmt: v => '$' + Number(v).toFixed(0) }),
    });
  }

  function perfChart() {
    const st = DATA.strategies;
    let start = 0;
    if (range === '60') start = Math.max(0, st.dates.length - 61);
    if (range === 'ytd') { const y = st.dates[st.dates.length - 1].slice(0, 4); start = Math.max(0, st.dates.findIndex(d => d.startsWith(y)) - 1); }
    const labels = st.dates.slice(start);
    const datasets = STRATS.map(name => {
      const raw = st.equity[name].slice(start), base = raw[0];
      return { label: name, data: raw.map(v => (v / base) * 10000), borderColor: slot(name),
               borderDash: BENCH.has(name) ? [5, 4] : [], borderWidth: BENCH.has(name) ? 1.5 : 2 };
    });
    legend(document.getElementById('perf-legend'), STRATS.map(n => [n, slot(n), BENCH.has(n)]));
    draw('perf-chart', { type: 'line', data: { labels, datasets },
      options: baseOptions({ log: range === 'all', yFmt: money, xTicks: range === 'ytd' ? 12 : 8 }) });
  }

  function riskChart() {
    const s = DATA.risk.series;
    const items = [['Example portfolio', css('--series-1')], ['SPY', css('--ink-series'), true]];
    legend(document.getElementById('risk-legend'), items);
    draw('risk-chart', { type: 'line',
      data: { labels: s.dates, datasets: [
        { label: 'Portfolio', data: s.portfolio, borderColor: items[0][1] },
        { label: 'SPY', data: s.spy, borderColor: items[1][1], borderDash: [5, 4], borderWidth: 1.5 },
      ] },
      options: baseOptions({ yFmt: money }) });
  }

  function tables() {
    const st = DATA.strategies.stats;
    const rows = STRATS.slice().sort((a, b) => st[b].sharpe - st[a].sharpe);
    document.getElementById('perf-table').innerHTML =
      `<caption>Since Jan 2006, ranked by Sharpe ratio</caption>
       <thead><tr><th>Strategy</th><th>CAGR</th><th>Volatility</th><th>Sharpe</th><th>Max drawdown</th><th>This year</th></tr></thead><tbody>` +
      rows.map(n => `<tr><td><i class="sw${BENCH.has(n) ? ' dashed' : ''}" style="--c:${slot(n)}"></i>${n}</td><td>${fmtPct(st[n].cagr)}</td><td>${fmtPct(st[n].vol)}</td>
        <td>${st[n].sharpe.toFixed(2)}</td><td>${fmtPct(st[n].max_dd)}</td><td class="${st[n].ytd >= 0 ? 'up' : 'down'}">${fmtPct(st[n].ytd, 1, true)}</td></tr>`).join('') + '</tbody>';

    const r = DATA.risk;
    const holdings = Object.entries(r.holdings).sort((a, b) => b[1].risk_share - a[1].risk_share);
    document.getElementById('risk-table').innerHTML =
      `<caption>Past 12 months</caption><tbody>
       <tr><td>Return</td><td>${fmtPct(r.return_1y, 1, true)} <span class="muted">vs SPY ${fmtPct(r.spy_return_1y, 1, true)}</span></td></tr>
       <tr><td>Volatility</td><td>${fmtPct(r.vol_1y)} <span class="muted">vs SPY ${fmtPct(r.spy_vol_1y)}</span></td></tr>
       <tr><td>Beta to SPY</td><td>${r.beta_1y.toFixed(2)}</td></tr>
       <tr><td>1-day VaR (95%)</td><td>${fmtPct(r.var95, 2)}</td></tr>
       <tr><td>1-day CVaR (95%)</td><td>${fmtPct(r.cvar95, 2)}</td></tr>
       <tr><td>Drawdown from 1-year high</td><td>${fmtPct(r.drawdown_now)}</td></tr></tbody>`;
    document.getElementById('risk-holdings').innerHTML =
      `<caption>Capital weight vs share of total risk</caption>
       <thead><tr><th>Holding</th><th>Weight</th><th>Risk share</th></tr></thead><tbody>` +
      holdings.map(([t, h]) => `<tr><td>${t}</td><td>${fmtPct(h.weight, 0)}</td><td><strong>${fmtPct(h.risk_share, 0)}</strong></td></tr>`).join('') + '</tbody>';
  }

  function tiles() {
    const t = DATA.spy_trend, p = DATA.strategies.positions, r = DATA.risk;
    const items = [
      ['SPY trend signal', t.signal === 'LONG' ? 'Long SPY' : 'In cash', `50-day avg ${fmtPct(t.gap_pct, 1, true)} vs 200-day · since ${t.since}`, t.signal === 'LONG' ? 'up' : 'down'],
      ['Time-series momentum', p.ts_momentum.holding, `SPY 12-month return ${fmtPct(p.ts_momentum.spy_12_1, 1, true)}`, p.ts_momentum.holding === 'SPY' ? 'up' : 'down'],
      ['Dual momentum', p.dual_momentum.holding, `Winner of SPY vs EFA, if it beats T-bills`, ''],
      ['Example portfolio, 1 year', fmtPct(r.return_1y, 1, true), `SPY ${fmtPct(r.spy_return_1y, 1, true)} · beta ${r.beta_1y.toFixed(2)}`, r.return_1y >= 0 ? 'up' : 'down'],
    ];
    document.getElementById('tiles').innerHTML = items.map(([k, v, sub, cls]) =>
      `<div class="tile"><p class="tile-k">${k}</p><p class="tile-v ${cls}">${v}</p><p class="tile-sub">${sub}</p></div>`).join('');
    document.getElementById('trend-text').textContent =
      `Right now SPY's 50-day average ($${t.sma50}) is ${t.sma50 > t.sma200 ? 'above' : 'below'} its 200-day average ($${t.sma200}), so the signal is ${t.signal === 'LONG' ? 'long' : 'in cash'}.`;
  }

  function holdings() {
    const p = DATA.strategies.positions;
    document.getElementById('decided').textContent = p.decided_at;
    const sec = p.sector_rotation;
    const maxAbs = Math.max(...sec.map(s => Math.abs(s.ret_6m)));
    const rp = Object.entries(p.risk_parity);
    const dm = p.dual_momentum;
    document.getElementById('holdings').innerHTML = `
      <div class="hold-card"><p class="tile-k">Time-series momentum</p><p class="hold-v">${p.ts_momentum.holding}</p>
        <p class="tile-sub">Holds SPY when its 12-month return (skipping the last month) is positive: ${fmtPct(p.ts_momentum.spy_12_1, 1, true)}.</p></div>
      <div class="hold-card"><p class="tile-k">Dual momentum</p><p class="hold-v">${dm.holding}</p>
        <div class="bars">${[['SPY', dm.spy_12m], ['EFA', dm.efa_12m], ['T-bills', dm.tbill_12m]].map(([k, v]) =>
          `<div class="bar-row${k === dm.holding ? ' held' : ''}"><span>${k}</span><div class="bar"><i style="width:${Math.max(2, v / Math.max(dm.spy_12m, dm.efa_12m, dm.tbill_12m) * 100)}%"></i></div><b>${fmtPct(v, 1, true)}</b></div>`).join('')}</div>
        <p class="tile-sub">12-month returns. The stronger of SPY and EFA, if it beat T-bills.</p></div>
      <div class="hold-card wide"><p class="tile-k">Sector rotation: top 3 by 6-month return</p>
        <div class="bars">${sec.map(s => `<div class="bar-row${s.held ? ' held' : ''}"><span>${s.ticker}</span><div class="bar diverging"><i class="${s.ret_6m < 0 ? 'neg' : ''}" style="--w:${Math.abs(s.ret_6m) / maxAbs * 50}%"></i></div><b>${fmtPct(s.ret_6m, 1, true)}</b></div>`).join('')}</div></div>
      <div class="hold-card"><p class="tile-k">Risk parity weights</p>
        <div class="bars">${rp.map(([k, v]) => `<div class="bar-row held"><span>${k}</span><div class="bar"><i style="width:${v * 100}%"></i></div><b>${fmtPct(v, 0)}</b></div>`).join('')}</div>
        <p class="tile-sub">Inverse to each asset's 12-month volatility, so each adds similar risk.</p></div>`;
    setupReveal(document.getElementById('holdings').parentElement);
  }

  function renderCharts() { trendChart(); perfChart(); riskChart(); tables(); }

  document.querySelectorAll('.seg button').forEach(b => b.addEventListener('click', () => {
    document.querySelectorAll('.seg button').forEach(x => x.classList.toggle('active', x === b));
    range = b.dataset.range; perfChart();
  }));
  document.addEventListener('themechange', () => DATA && renderCharts());
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => DATA && renderCharts());

  loadTracker().then(d => {
    DATA = d;
    const when = new Date(d.generated_at.replace('Z', ':00Z'));
    document.getElementById('asof').textContent = `Market data as of ${d.as_of} · updated ${when.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}.`;
    Chart.defaults.font.family = 'Inter, system-ui, sans-serif';
    tiles(); holdings(); renderCharts();
    setupReveal(document.getElementById('tiles').parentElement);
  }).catch(() => {
    document.getElementById('tiles').innerHTML = '<p class="muted">Live data is temporarily unavailable. Please try again later.</p>';
  });
})();
