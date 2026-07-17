// Weather icons drawn in a 100x100 coordinate space. Shared by the browser
// widget and the server-side image renderer so there is one source of truth.
import { ROLE } from './brand.mjs';

const R = ROLE;

function cloud(fill, cx = 50, cy = 58, s = 1) {
  return `<g fill="${fill}">
    <circle cx="${cx + (-16) * s}" cy="${cy + 2 * s}" r="${16 * s}"/>
    <circle cx="${cx + 2 * s}" cy="${cy + (-6) * s}" r="${21 * s}"/>
    <circle cx="${cx + 18 * s}" cy="${cy + 4 * s}" r="${14 * s}"/>
    <rect x="${cx + (-24) * s}" y="${cy + 2 * s}" width="${48 * s}" height="${18 * s}" rx="${9 * s}"/>
  </g>`;
}

function sun(cx = 50, cy = 46, r = 17) {
  let rays = '';
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    const x1 = cx + Math.cos(a) * (r + 6);
    const y1 = cy + Math.sin(a) * (r + 6);
    const x2 = cx + Math.cos(a) * (r + 13);
    const y2 = cy + Math.sin(a) * (r + 13);
    rays += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"/>`;
  }
  return `<g stroke="${R.sunEdge}" stroke-width="4.5" stroke-linecap="round">${rays}</g>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="${R.sun}" stroke="${R.sunEdge}" stroke-width="2.5"/>`;
}

function moon(cx = 50, cy = 46, r = 18) {
  return `<path d="M ${cx + r * 0.35} ${cy - r} a ${r} ${r} 0 1 0 ${r * 0.9} ${r * 1.55}
    a ${r * 0.8} ${r * 0.8} 0 1 1 ${-r * 0.9} ${-r * 1.55} z" fill="${R.sun}" stroke="${R.sunEdge}" stroke-width="2"/>`;
}

function drops(color, y0 = 78) {
  const d = (x, y) => `<line x1="${x}" y1="${y}" x2="${x - 4}" y2="${y + 11}" stroke="${color}" stroke-width="4.5" stroke-linecap="round"/>`;
  return `${d(38, y0)}${d(52, y0 + 4)}${d(66, y0)}`;
}

function flakes(color, y0 = 80) {
  const f = (x, y) => `<circle cx="${x}" cy="${y}" r="3.4" fill="${color}"/>`;
  return `${f(36, y0)}${f(50, y0 + 6)}${f(64, y0)}${f(50, y0 - 6)}`;
}

// id -> inner SVG markup (100x100 space). Compositions are balanced around
// x=50 so the icon sits visually centered under centered labels/temps.
export const ICON_BUILDERS = {
  sunny: () => sun(50, 48, 20),
  'clear-night': () => moon(50, 48, 20),
  'partly-sunny': () => `${sun(40, 36, 13)}${cloud(R.cloud, 53, 60, 0.9)}`,
  'partly-cloudy-night': () => `${moon(40, 36, 14)}${cloud(R.cloud, 53, 60, 0.9)}`,
  cloudy: () => `${cloud(R.cloudDark, 43, 47, 0.7)}${cloud(R.cloud, 50, 57, 0.98)}`,
  rain: () => `${cloud(R.cloudDark, 50, 50, 1)}${drops(R.rainDrop)}`,
  showers: () => `${cloud(R.cloudDark, 50, 48, 1)}${drops(R.rainDrop, 74)}${drops(R.rainDrop, 84)}`,
  thunderstorm: () => `${cloud(R.cloudDark, 50, 48, 1)}<polygon points="48,70 40,86 47,86 42,98 60,80 51,80 56,70" fill="${R.storm}" stroke="${R.sunEdge}" stroke-width="1.5"/>`,
  snow: () => `${cloud(R.cloudDark, 50, 50, 1)}${flakes(R.snow)}`,
  sleet: () => `${cloud(R.cloudDark, 50, 50, 1)}${drops(R.rainDrop, 78)}${flakes(R.snow, 84)}`,
  fog: () => `${cloud(R.cloud, 50, 44, 0.95)}<g stroke="${R.fog}" stroke-width="5" stroke-linecap="round"><line x1="28" y1="72" x2="72" y2="72"/><line x1="32" y1="84" x2="68" y2="84"/></g>`,
  wind: () => `<g fill="none" stroke="${R.cloudDark}" stroke-width="5" stroke-linecap="round"><path d="M20 42 h40 a8 8 0 1 0 -8 -8"/><path d="M20 58 h52 a8 8 0 1 1 -8 8"/><path d="M20 74 h30 a7 7 0 1 1 -7 7"/></g>`
};

// Return a full standalone <svg> string.
export function iconSvg(id, size = 64) {
  const inner = (ICON_BUILDERS[id] || ICON_BUILDERS.cloudy)();
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100" role="img" aria-label="${id.replace(/-/g, ' ')}">${inner}</svg>`;
}

// Return inner markup for nesting inside a larger server SVG.
export function iconInner(id) {
  return (ICON_BUILDERS[id] || ICON_BUILDERS.cloudy)();
}

// Map NWS shortForecast text (+ isDaytime) to one of our icon ids.
export function conditionToIcon(shortForecast = '', isDaytime = true) {
  const s = shortForecast.toLowerCase();
  const night = !isDaytime;
  if (/(thunder|t-storm|tstorm)/.test(s)) return 'thunderstorm';
  if (/(freezing|sleet|wintry|ice)/.test(s)) return 'sleet';
  if (/(snow|flurr|blizzard)/.test(s)) return 'snow';
  if (/(showers)/.test(s)) return 'showers';
  if (/(rain|drizzle)/.test(s)) return 'rain';
  if (/(fog|mist|haze|smoke)/.test(s)) return 'fog';
  if (/(wind|breez|gust)/.test(s) && !/cloud|sun|clear/.test(s)) return 'wind';
  if (/(mostly cloudy|overcast|cloudy)/.test(s)) return 'cloudy';
  if (/(partly sunny|partly cloudy|mostly sunny|few clouds|scattered clouds)/.test(s))
    return night ? 'partly-cloudy-night' : 'partly-sunny';
  if (/(sunny|clear|fair|hot)/.test(s)) return night ? 'clear-night' : 'sunny';
  return night ? 'partly-cloudy-night' : 'partly-sunny';
}

export const ICON_IDS = Object.keys(ICON_BUILDERS);

// Short, friendly condition label derived from the icon id — used in the
// compact images and widget columns where the full NWS string is too long.
const LABELS = {
  sunny: 'Sunny', 'clear-night': 'Clear',
  'partly-sunny': 'Partly sunny', 'partly-cloudy-night': 'Partly cloudy',
  cloudy: 'Cloudy', rain: 'Rain', showers: 'Showers',
  thunderstorm: 'Thunderstorms', snow: 'Snow', sleet: 'Wintry mix',
  fog: 'Fog', wind: 'Windy'
};
export function shortLabel(iconId) {
  return LABELS[iconId] || 'Mixed';
}
