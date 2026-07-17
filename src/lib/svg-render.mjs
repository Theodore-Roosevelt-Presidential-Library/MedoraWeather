// Builds full SVG documents for the static images. Text uses the brand font
// family names ('Dharma Gothic E' display caps, 'Clearface Std' serif); the
// image generator loads those OTF files into resvg so they render everywhere.
import { ROLE, COLORS, FONTS } from './brand.mjs';
import { iconInner } from './icons.mjs';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const DISPLAY = "'Dharma Gothic E'";
const SERIF = "'ITC Clearface Std'";

function icon(id, x, y, size) {
  return `<svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="0 0 100 100">${iconInner(id)}</svg>`;
}

function miniDrop(x, y, color) {
  return `<path d="M ${x} ${y} c -4 5 -6 8 -6 11 a 6 6 0 0 0 12 0 c 0 -3 -2 -6 -6 -11 z" fill="${color}"/>`;
}

// Centered "drop NN%" around cx.
function rainTag(cx, y, pct) {
  if (!pct) return '';
  return `${miniDrop(cx - 24, y - 9, ROLE.rainDrop)}
    <text x="${cx - 6}" y="${y + 2}" font-family="${FONTS.sans}" font-size="15" fill="${ROLE.rainDrop}" text-anchor="start">${pct}%</text>`;
}

function frame(w, h) {
  return `<rect x="0" y="0" width="${w}" height="${h}" fill="${ROLE.bg}"/>`;
}

function title(x, y, text, size = 34, color = ROLE.text, anchor = 'start') {
  return `<text x="${x}" y="${y}" font-family="${DISPLAY}" font-weight="700" font-size="${size}"
    letter-spacing="0.5" fill="${color}" text-anchor="${anchor}">${esc(text.toUpperCase())}</text>`;
}

function updated(x, y, data, anchor = 'start', color = ROLE.textMuted) {
  return `<text x="${x}" y="${y}" font-family="${FONTS.sans}" font-size="13" fill="${color}" text-anchor="${anchor}">Updated ${esc(data.updatedLabel)} · weather.gov</text>`;
}

// ---------------------------------------------------------------- Multi-day
export function dayCardSvg(data, { days = 3 } = {}) {
  const list = data.days.slice(0, days);
  const col = 190, padX = 48, padTop = 108;
  const w = padX * 2 + col * list.length;
  const h = 360;
  let cols = '';
  list.forEach((d, i) => {
    const cx = padX + col * i + col / 2;
    cols += `
      ${title(cx, padTop + 6, d.short, 26, ROLE.text, 'middle')}
      ${icon(d.icon, cx - 44, padTop + 22, 88)}
      <text x="${cx}" y="${padTop + 158}" font-family="${DISPLAY}" font-weight="700" font-size="52" fill="${ROLE.text}" text-anchor="middle">${d.high != null ? d.high : '–'}&#176;</text>
      <text x="${cx}" y="${padTop + 186}" font-family="${SERIF}" font-size="22" fill="${ROLE.textMuted}" text-anchor="middle">${d.low != null ? d.low : '–'}&#176;</text>
      <text x="${cx}" y="${padTop + 214}" font-family="${FONTS.sans}" font-size="14" fill="${ROLE.textMuted}" text-anchor="middle">${esc(d.label || '')}</text>
      ${rainTag(cx, padTop + 242, d.rainChance)}`;
    if (i > 0) cols += `<line x1="${padX + col * i}" y1="${padTop}" x2="${padX + col * i}" y2="${h - 40}" stroke="${ROLE.hairline}" stroke-width="1"/>`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${days}-day forecast for Medora, North Dakota">
    ${frame(w, h)}
    ${title(padX, 58, 'Medora, North Dakota', 36)}
    ${updated(padX, 82, data)}
    ${cols}
  </svg>`;
}

// ------------------------------------------------------------------- Hourly
export function hourlyStripSvg(data, { hours = 12 } = {}) {
  const list = data.hourly.slice(0, hours);
  const col = 78, padX = 40, padTop = 96;
  const w = padX * 2 + col * list.length;
  const h = 250;
  let cols = '';
  list.forEach((hn, i) => {
    const cx = padX + col * i + col / 2;
    cols += `
      <text x="${cx}" y="${padTop}" font-family="${FONTS.sans}" font-size="14" fill="${ROLE.textMuted}" text-anchor="middle">${esc(hn.label)}</text>
      ${icon(hn.icon, cx - 22, padTop + 8, 44)}
      <text x="${cx}" y="${padTop + 82}" font-family="${DISPLAY}" font-weight="700" font-size="30" fill="${ROLE.text}" text-anchor="middle">${hn.temp}&#176;</text>
      ${hn.rainChance ? `<text x="${cx}" y="${padTop + 104}" font-family="${FONTS.sans}" font-size="13" fill="${ROLE.rainDrop}" text-anchor="middle">${hn.rainChance}%</text>` : ''}`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="Hourly forecast for Medora, North Dakota">
    ${frame(w, h)}
    ${title(padX, 50, 'Medora · Next hours', 30)}
    ${updated(padX, 72, data)}
    ${cols}
  </svg>`;
}

// ------------------------------------------------------------------ Current
export function currentSvg(data) {
  const w = 480, h = 300, c = data.current;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="Current conditions in Medora, North Dakota">
    ${frame(w, h)}
    ${title(40, 56, 'Medora, North Dakota', 30)}
    ${updated(40, 78, data)}
    ${icon(c.icon, 36, 104, 128)}
    <text x="182" y="188" font-family="${DISPLAY}" font-weight="700" font-size="104" fill="${ROLE.text}">${c.temp}&#176;</text>
    <text x="40" y="236" font-family="${SERIF}" font-size="24" fill="${ROLE.text}">${esc(c.label || c.condition || '')}</text>
    <text x="40" y="268" font-family="${FONTS.sans}" font-size="16" fill="${ROLE.textMuted}">High ${c.high != null ? c.high + '°' : '–'} · Low ${c.low != null ? c.low + '°' : '–'}</text>
    ${c.rainChance ? `${miniDrop(292, 259, ROLE.rainDrop)}<text x="308" y="268" font-family="${FONTS.sans}" font-size="16" fill="${ROLE.rainDrop}">${c.rainChance}% chance of rain</text>` : ''}
  </svg>`;
}

// ----------------------------------------------------------- Social / OG
export function ogSvg(data, { days = 3 } = {}) {
  const w = 1200, h = 630, c = data.current;
  const list = data.days.slice(0, days);
  const rightX = 620, col = (w - rightX - 60) / list.length;
  let cols = '';
  list.forEach((d, i) => {
    const cx = rightX + col * i + col / 2;
    cols += `
      ${title(cx, 300, d.short, 30, ROLE.text, 'middle')}
      ${icon(d.icon, cx - 45, 316, 90)}
      <text x="${cx}" y="452" font-family="${DISPLAY}" font-weight="700" font-size="52" fill="${ROLE.text}" text-anchor="middle">${d.high != null ? d.high : '–'}&#176;</text>
      <text x="${cx}" y="482" font-family="${SERIF}" font-size="24" fill="${ROLE.textMuted}" text-anchor="middle">${d.low != null ? d.low : '–'}&#176;</text>
      ${d.rainChance ? `<text x="${cx}" y="512" font-family="${FONTS.sans}" font-size="16" fill="${ROLE.rainDrop}" text-anchor="middle">${d.rainChance}%</text>` : ''}`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="Weather in Medora, North Dakota">
    ${frame(w, h)}
    ${title(80, 120, 'Medora, North Dakota', 64)}
    <text x="80" y="158" font-family="${FONTS.sans}" font-size="20" fill="${ROLE.textMuted}">Updated ${esc(data.updatedLabel)} · National Weather Service</text>
    ${icon(c.icon, 74, 214, 200)}
    <text x="300" y="410" font-family="${DISPLAY}" font-weight="700" font-size="200" fill="${ROLE.text}">${c.temp}&#176;</text>
    <text x="80" y="500" font-family="${SERIF}" font-size="40" fill="${ROLE.text}">${esc(c.label || c.condition || '')}</text>
    <text x="80" y="548" font-family="${FONTS.sans}" font-size="24" fill="${ROLE.textMuted}">High ${c.high != null ? c.high + '°' : '–'} · Low ${c.low != null ? c.low + '°' : '–'}${c.rainChance ? ' · ' + c.rainChance + '% rain' : ''}</text>
    <line x1="590" y1="240" x2="590" y2="540" stroke="${ROLE.hairline}" stroke-width="1"/>
    ${cols}
  </svg>`;
}

export const RENDERERS = { dayCardSvg, hourlyStripSvg, currentSvg, ogSvg };
export { COLORS };
