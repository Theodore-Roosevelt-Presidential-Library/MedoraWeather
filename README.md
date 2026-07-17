# MedoraWeather

An embeddable weather **widget** and auto-updating **static images** for Medora, North Dakota, built for the Theodore Roosevelt Presidential Library.

Data comes from the National Weather Service and is cached and refreshed about every 15 minutes by a GitHub Action. Only that Action ever calls `api.weather.gov` — the widget and images are served as static files from GitHub Pages, so no amount of visitor traffic touches the government API.

## What it produces

Everything is generated into `site/` and published to GitHub Pages at
`https://weather.labs.trlibrary.com/`.

- `embed.js` — the zero-dependency widget (one `<script>` tag, `data-*` options)
- `data/forecast.json` — the cached, normalized forecast: `current` (temp, feels-like, wind/gusts, humidity, condition), `days`, `hourly` (each with rain chance + snowfall), `alerts`, `air` (AQI), `sun` (sunrise/sunset), plus a `stale` flag and `nwsUrl`
- `images/*.png` — static images: `badge` (icon + temp + place), `badge-bare` (icon + temp only), `current`, `forecast-3day`, `forecast-5day`, `forecast-7day`, `hourly`, `alert` (active alerts / all-clear), `social` (each also emitted as `.svg`)
- `index.html` — a demo page with copy-paste embed codes, live previews, and a builder

## Embedding the widget

Drop one line where the widget should appear:

```html
<script src="https://weather.labs.trlibrary.com/embed.js"
        data-days="3" data-rain="true"></script>
```

Options (all optional):

| Attribute    | Default | Meaning |
|--------------|---------|---------|
| `data-days`  | `3`     | Number of forecast days shown with a condition icon (0 hides the row) |
| `data-hours` | `0`     | Number of hourly columns with condition icons (0 hides the strip) |
| `data-rain`  | `true`  | Show chance of rain |
| `data-title` | `true`  | Show the "Medora, North Dakota" heading |
| `data-view`  | —       | Force a single view: `mini`, `current`, `hourly`, `days`, or `alerts` |
| `data-link`  | on      | Every embed links to the full forecast page by default. Pass a URL to override the destination, or `false` to make it non-clickable. |
| `data-alerts`| `true`  | Show the active-alert banner at the top when NWS has an alert for Medora. `false` hides it. |
| `data-refresh` | `15`  | Auto-refresh interval in minutes. The widget re-checks for fresh data on this cadence (and when a hidden tab becomes visible again), and automatically polls every 5 minutes while an alert is active. `0` disables it. |

You can combine them — e.g. `data-days="5" data-hours="12"` shows a five-day
overview above a twelve-hour strip. For multiple widgets on one page, add
`<div data-medora-weather data-view="current"></div>` containers and include
`embed.js` once.

The current view (widget and `current.png`) also carries feels-like temperature,
wind + gusts, humidity, sunrise/sunset (computed locally), and air quality. AQI
is fetched from Open-Meteo (US AQI, no key) and shown with a color scale and a
plain-language line so the number is understandable, not just a bare number.

The widgets render on a transparent background so they inherit the host page's
background; the static images always render on white. If the NWS API is ever
unreachable, the build falls back to the last published forecast, flags it stale,
and the UI shows a subtle "data delayed" note instead of going blank.

Active weather alerts (Heat Advisory, Red Flag Warning, Winter Storm Warning,
etc.) come from the NWS `/alerts/active` endpoint for Medora's point. When one is
in effect, every widget view shows a colored banner across the top (severity-tinted),
the `mini` badge shows a small colored dot, and the `current`/daily images gain a
banner. The `alerts` view and `alert.png` show the full detail — event, timing, and
safety instructions — with a calm "no active alerts" state otherwise.

Snowfall appears automatically on the daily cards and hourly strip whenever the
forecast calls for accumulation — a snowflake with the expected inches — and is
hidden otherwise. The amount comes from the NWS gridpoint `snowfallAmount` field
(one extra API call per build), summed per day/hour and converted to inches.

The `mini` view is a compact icon + temperature badge that links through to
`trlibrary.com/weather/` (configurable via `config.json` → `site.fullForecastUrl`):

```html
<script src="https://weather.labs.trlibrary.com/embed.js" data-view="mini"></script>
```

## Using the static images

Hotlink any PNG; it refreshes at the same URL about every 15 minutes and always
renders on a white background (unlike the widgets, which are transparent):

```html
<img src="https://weather.labs.trlibrary.com/images/forecast-3day.png"
     alt="3-day forecast for Medora, ND">
```

Available images (each also emitted as `.svg`):

| File | What it shows |
|------|---------------|
| `badge.png` | Icon + temperature + "MEDORA" — a compact chip |
| `badge-bare.png` | Icon + temperature only |
| `current.png` | Current conditions with feels-like, wind, humidity, sunrise/sunset, and AQI |
| `forecast-3day.png` / `-5day` / `-7day` | Multi-day outlook with condition icons, highs/lows, rain, and snowfall |
| `hourly.png` | Next 12 hours |
| `alert.png` | Active NWS alerts, or a calm "no active alerts" state |
| `social.png` | 1200×630 for link previews / email headers |

To make an image clickable, wrap it in a link (the `current` and daily images
also gain an alert banner automatically when a warning is active):

```html
<a href="https://trlibrary.com/weather/">
  <img src="https://weather.labs.trlibrary.com/images/badge.png" alt="Weather in Medora, ND">
</a>
```

## How it works

```
NWS API + Open-Meteo ──(every ~15 min, CI only)──▶ scripts/build.mjs ──▶ site/ ──▶ GitHub Pages CDN ──▶ widgets + images
```

Only the GitHub Action calls the upstream APIs; everything the public loads is a
static file from the Pages CDN.

`scripts/build.mjs`:
1. `src/lib/weather.mjs` fetches + normalizes everything into `site/data/forecast.json`:
   the NWS point forecast, hourly forecast, and gridpoint (snowfall, feels-like,
   wind, humidity), active alerts, air quality (Open-Meteo), and locally-computed
   sunrise/sunset. If NWS is unreachable it falls back to the last published file
   and flags it `stale`. Every extra source is best-effort — one failing never
   breaks the build.
2. assembles `site/embed.js` from `src/lib/brand.mjs` + `src/lib/icons.mjs` + `src/embed-core.js`
3. renders the images with `src/lib/svg-render.mjs` → PNG via `@resvg/resvg-js`, using the brand OTF fonts
4. copies the fonts, demo page, and `CNAME`

Brand colors, fonts, and weather icons live in `src/lib/` and are the single
source of truth shared by both the widget and the images.

## Local development

```bash
npm install
npm run build     # fetch + render everything into site/
npm run serve     # preview at http://localhost:8080
```

`npm run fetch` rebuilds data + widget only (skips image rendering).

## Deployment

The workflow in `.github/workflows/deploy.yml` runs about every 15 minutes (and on push /
manual trigger), builds `site/`, and deploys it to Pages. Scheduled runs can drift
a few minutes under GitHub load, so treat the cadence as best-effort — this is an
ambient display, not a life-safety alerting channel.

**One-time setup:**
1. **Settings → Pages → Build and deployment → Source** → choose **GitHub Actions**.
2. **Custom domain:** the build writes a `CNAME` (`weather.labs.trlibrary.com`) into
   every deploy. Add the matching DNS `CNAME` record and enter the domain under
   **Settings → Pages → Custom domain**, then enable **Enforce HTTPS** so GitHub
   provisions the certificate.

## Configuration

Everything location-specific lives in `config.json`:

- `location` — name, region, latitude/longitude, and timezone. Change these to point the whole system at a different place.
- `site.baseUrl` / `site.customDomain` — the public URL and the `CNAME` value.
- `site.fullForecastUrl` — where widgets link on click (default `https://trlibrary.com/weather/`).
- `site.userAgent` — a contact string the NWS API asks callers to send.
- `cache.refreshMinutes` and `defaults` — cadence hint and default view options.

## Fonts & licensing

The images and widget use the Library's licensed brand fonts (Dharma Gothic E,
ITC Clearface). They're committed under `assets/fonts/` and served from Pages.
Because this repo is public, confirm the font licenses permit web embedding /
redistribution, or swap in a subset or a licensed webfont before going live.

## Attribution

- Weather, forecast, and alert data © NOAA / National Weather Service (public domain).
- Air quality (US AQI) from [Open-Meteo](https://open-meteo.com/) (CC BY 4.0).
