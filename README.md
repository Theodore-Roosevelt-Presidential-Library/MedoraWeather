# MedoraWeather

An embeddable weather **widget** and auto-updating **static images** for Medora, North Dakota, built for the Theodore Roosevelt Presidential Library.

Data comes from the National Weather Service and is cached hourly by a GitHub Action. Only that Action ever calls `api.weather.gov` — the widget and images are served as static files from GitHub Pages, so no amount of visitor traffic touches the government API.

## What it produces

Everything is generated into `site/` and published to GitHub Pages at
`https://weather.labs.trlibrary.com/`.

- `embed.js` — the zero-dependency widget (one `<script>` tag, `data-*` options)
- `data/forecast.json` — the cached, normalized forecast
- `images/*.png` — static images: `badge` (icon + temp + place), `badge-bare` (icon + temp only), `current`, `forecast-3day`, `forecast-5day`, `forecast-7day`, `hourly`, `social` (each also emitted as `.svg`)
- `index.html` — a demo page with a live preview and an embed-code generator

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
| `data-view`  | —       | Force a single view: `mini`, `current`, `hourly`, or `days` |
| `data-link`  | mini only | Wrap the widget in a link. `mini` links to the full forecast page by default; pass a URL to override, or `false` to disable. Use `data-link="true"` to link any other view. |

You can combine them — e.g. `data-days="5" data-hours="12"` shows a five-day
overview above a twelve-hour strip. For multiple widgets on one page, add
`<div data-medora-weather data-view="current"></div>` containers and include
`embed.js` once.

The `mini` view is a compact icon + temperature badge that links through to
`trlibrary.com/weather/` (configurable via `config.json` → `site.fullForecastUrl`):

```html
<script src="https://weather.labs.trlibrary.com/embed.js" data-view="mini"></script>
```

## Using the static images

Hotlink any PNG; it refreshes hourly at the same URL:

```html
<img src="https://weather.labs.trlibrary.com/images/forecast-3day.png"
     alt="3-day forecast for Medora, ND">
```

`images/social.png` is 1200×630 for link previews / email headers.

## How it works

```
NWS API ──(hourly, in CI only)──▶ scripts/build.mjs ──▶ site/  ──▶ GitHub Pages CDN ──▶ widgets + images
```

`scripts/build.mjs`:
1. `src/lib/weather.mjs` fetches + normalizes the forecast → `site/data/forecast.json`
2. assembles `site/embed.js` from `src/lib/brand.mjs` + `src/lib/icons.mjs` + `src/embed-core.js`
3. renders the images with `src/lib/svg-render.mjs` → PNG via `@resvg/resvg-js`, using the brand OTF fonts
4. copies the fonts and demo page

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

The workflow in `.github/workflows/deploy.yml` runs hourly (and on push /
manual trigger), builds `site/`, and deploys it to Pages.

**One-time setup:** in the repo, go to **Settings → Pages → Build and
deployment → Source** and choose **GitHub Actions**.

## Configuration

`config.json` holds the location (Medora), the public base URL, the NWS
`User-Agent` (a contact string NWS requests), and defaults. Change the
coordinates there to point the whole system at a different place.

## Fonts & licensing

The images and widget use the Library's licensed brand fonts (Dharma Gothic E,
ITC Clearface). They're committed under `assets/fonts/` and served from Pages.
Because this repo is public, confirm the font licenses permit web embedding /
redistribution, or swap in a subset or a licensed webfont before going live.

Weather data © NOAA / National Weather Service (public domain).
