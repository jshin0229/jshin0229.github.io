# jshin0229.github.io

My personal site, built with plain HTML, CSS and JavaScript and hosted on GitHub Pages at https://jshin0229.github.io.

| Page | File |
|---|---|
| Home | `index.html` |
| About | `about.html` |
| Projects | `projects.html` |
| Travel | `travel.html` (add places in `travel.js`) |
| Live Tracker | `tracker.html` + `tracker.js` |

Shared styles are in `style.css` and shared behavior (animations, theme toggle, menu) is in `site.js`.

## Live Tracker

`scripts/build_tracker.py` re-runs the signals from my [signal-backtester](https://github.com/jshin0229/signal-backtester), [systematic-strategy-research](https://github.com/jshin0229/systematic-strategy-research) and [portfolio-risk-report](https://github.com/jshin0229/portfolio-risk-report) projects on fresh prices and writes `data/tracker.json`. A GitHub Actions workflow (`.github/workflows/update-tracker.yml`) runs it every weekday after the US market close. To run it by hand, use **Actions → Update live tracker → Run workflow**.

```bash
pip install -r scripts/requirements.txt
python scripts/build_tracker.py
```

## Adding a travel destination

Open `travel.js`, copy one entry in `PLACES`, and change the name, flag and note. `map` must match the country name on the map (hover a country to see it). The map itself is `world-map.svg`, drawn from public-domain Natural Earth data. Photos go in `images/travel/`.
