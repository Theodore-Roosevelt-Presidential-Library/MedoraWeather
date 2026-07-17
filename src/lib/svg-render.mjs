// Builds full SVG documents for the static images. Text uses the brand font
// family names ('Dharma Gothic E' display caps, 'Clearface Std' serif); the
// image generator loads those OTF files into resvg so they render everywhere.
import { ROLE, COLORS, FONTS } from './brand.mjs';
import { iconInner, alertColor, alertTriangle, AQI_BANDS } from './icons.mjs';

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

function snowLabel(inches) {
  return (Number.isInteger(inches) ? String(inches) : inches.toFixed(1)) + ' in';
}

function miniFlake(cx, cy, color, r = 6) {
  let s = '';
  for (let i = 0; i < 3; i++) {
    const a = (i * Math.PI) / 3;
    const dx = Math.cos(a) * r, dy = Math.sin(a) * r;
    s += `<line x1="${(cx - dx).toFixed(1)}" y1="${(cy - dy).toFixed(1)}" x2="${(cx + dx).toFixed(1)}" y2="${(cy + dy).toFixed(1)}"/>`;
  }
  return `<g stroke="${color}" stroke-width="1.6" stroke-linecap="round">${s}</g>`;
}

// Centered "flake N in" around cx.
function snowTag(cx, y, inches, size = 15) {
  if (!inches) return '';
  return `${miniFlake(cx - 26, y - 5, ROLE.rainDrop)}
    <text x="${cx - 16}" y="${y + 2}" font-family="${FONTS.sans}" font-size="${size}" fill="${ROLE.rainDrop}" text-anchor="start">${snowLabel(inches)}</text>`;
}

function frame(w, h) {
  return `<rect x="0" y="0" width="${w}" height="${h}" fill="${ROLE.bg}"/>`;
}

const BANNER_H = 48;
// A slim alert banner drawn at the very top: colored left bar, warning
// triangle, event name (Dark Gray), and end time. Content below is offset.
function alertBanner(w, a, padX) {
  const col = alertColor(a.severity);
  return `
    <rect x="0" y="0" width="6" height="${BANNER_H}" fill="${col}"/>
    <svg x="${padX}" y="11" width="26" height="26" viewBox="0 0 100 100">${alertTriangle(col)}</svg>
    <text x="${padX + 38}" y="31" font-family="${DISPLAY}" font-weight="700" font-size="19" letter-spacing="0.4" fill="${ROLE.text}">${esc((a.event || '').toUpperCase())}</text>
    ${a.endsLabel ? `<text x="${w - padX}" y="31" font-family="${FONTS.sans}" font-size="14" fill="${ROLE.textMuted}" text-anchor="end">until ${esc(a.endsLabel)}</text>` : ''}
    <line x1="0" y1="${BANNER_H}" x2="${w}" y2="${BANNER_H}" stroke="${ROLE.hairline}" stroke-width="1"/>`;
}
function alertOffset(data) {
  return (data.alerts && data.alerts.length) ? BANNER_H : 0;
}

function title(x, y, text, size = 34, color = ROLE.text, anchor = 'start') {
  return `<text x="${x}" y="${y}" font-family="${DISPLAY}" font-weight="700" font-size="${size}"
    letter-spacing="0.5" fill="${color}" text-anchor="${anchor}">${esc(text.toUpperCase())}</text>`;
}

function updated(x, y, data, anchor = 'start', color = ROLE.textMuted) {
  const stale = data.stale ? ' · data delayed' : '';
  return `<text x="${x}" y="${y}" font-family="${FONTS.sans}" font-size="13" fill="${color}" text-anchor="${anchor}">Updated ${esc(data.updatedLabel)} · weather.gov${stale}</text>`;
}

// ---------------------------------------------------------------- Multi-day
export function dayCardSvg(data, { days = 3 } = {}) {
  const list = data.days.slice(0, days);
  const col = 190, padX = 48, padTop = 108;
  const w = padX * 2 + col * list.length;
  const hasSnow = list.some((d) => d.snowfall > 0);
  const contentH = hasSnow ? 394 : 360;
  const off = alertOffset(data);
  const h = contentH + off;
  let cols = '';
  list.forEach((d, i) => {
    const cx = padX + col * i + col / 2;
    cols += `
      ${title(cx, padTop + 6, d.short, 26, ROLE.text, 'middle')}
      ${icon(d.icon, cx - 44, padTop + 22, 88)}
      <text x="${cx}" y="${padTop + 158}" font-family="${DISPLAY}" font-weight="700" font-size="52" fill="${ROLE.text}" text-anchor="middle">${d.high != null ? d.high : '–'}&#176;</text>
      <text x="${cx}" y="${padTop + 186}" font-family="${SERIF}" font-size="22" fill="${ROLE.textMuted}" text-anchor="middle">${d.low != null ? d.low : '–'}&#176;</text>
      <text x="${cx}" y="${padTop + 214}" font-family="${FONTS.sans}" font-size="14" fill="${ROLE.textMuted}" text-anchor="middle">${esc(d.label || '')}</text>
      ${rainTag(cx, padTop + 242, d.rainChance)}
      ${snowTag(cx, padTop + 270, d.snowfall)}`;
    if (i > 0) cols += `<line x1="${padX + col * i}" y1="${padTop}" x2="${padX + col * i}" y2="${contentH - 40}" stroke="${ROLE.hairline}" stroke-width="1"/>`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${days}-day forecast for Medora, North Dakota">
    ${frame(w, h)}
    ${off ? alertBanner(w, data.alerts[0], padX) : ''}
    <g transform="translate(0,${off})">
      ${title(padX, 58, 'Medora, North Dakota', 36)}
      ${updated(padX, 82, data)}
      ${cols}
    </g>
  </svg>`;
}

// ------------------------------------------------------------------- Hourly
export function hourlyStripSvg(data, { hours = 12 } = {}) {
  const list = data.hourly.slice(0, hours);
  const col = 78, padX = 40, padTop = 96;
  const w = padX * 2 + col * list.length;
  const hasSnow = list.some((hn) => hn.snowfall > 0);
  const h = hasSnow ? 276 : 250;
  let cols = '';
  list.forEach((hn, i) => {
    const cx = padX + col * i + col / 2;
    cols += `
      <text x="${cx}" y="${padTop}" font-family="${FONTS.sans}" font-size="14" fill="${ROLE.textMuted}" text-anchor="middle">${esc(hn.label)}</text>
      ${icon(hn.icon, cx - 22, padTop + 8, 44)}
      <text x="${cx}" y="${padTop + 82}" font-family="${DISPLAY}" font-weight="700" font-size="30" fill="${ROLE.text}" text-anchor="middle">${hn.temp}&#176;</text>
      ${hn.rainChance ? `<text x="${cx}" y="${padTop + 104}" font-family="${FONTS.sans}" font-size="13" fill="${ROLE.rainDrop}" text-anchor="middle">${hn.rainChance}%</text>` : ''}
      ${hn.snowfall > 0 ? `${miniFlake(cx - 22, padTop + 118, ROLE.rainDrop, 5)}<text x="${cx - 13}" y="${padTop + 122}" font-family="${FONTS.sans}" font-size="12" fill="${ROLE.rainDrop}" text-anchor="start">${snowLabel(hn.snowfall)}</text>` : ''}`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="Hourly forecast for Medora, North Dakota">
    ${frame(w, h)}
    ${title(padX, 50, 'Medora · Next hours', 30)}
    ${updated(padX, 72, data)}
    ${cols}
  </svg>`;
}

// -------------------------------------------------------------- Mini badge
// Small "icon + temperature" chip. Intended to link to the full forecast.
export function badgeSvg(data, { bare = false } = {}) {
  const c = data.current;
  const w = bare ? 168 : 268, h = 92;
  const labels = bare ? '' : `
    <text x="164" y="42" font-family="${DISPLAY}" font-weight="700" font-size="18" letter-spacing="0.5" fill="${ROLE.text}">MEDORA</text>
    <text x="164" y="62" font-family="${FONTS.sans}" font-size="13" fill="${ROLE.textMuted}">${esc(c.label || '')}</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="Current temperature in Medora, North Dakota">
    ${frame(w, h)}
    ${icon(c.icon, 6, 16, 60)}
    <text x="76" y="58" font-family="${DISPLAY}" font-weight="700" font-size="46" fill="${ROLE.text}">${c.temp}&#176;</text>${labels}
  </svg>`;
}

// ------------------------------------------------------------------ Current
function metricText(x, y, k, v) {
  return `<text x="${x}" y="${y}" font-family="${FONTS.sans}" font-size="15"><tspan fill="${ROLE.textMuted}">${esc(k)} </tspan><tspan fill="${ROLE.text}">${esc(v)}</tspan></text>`;
}

export function currentSvg(data) {
  const w = 520, c = data.current, off = alertOffset(data);

  // Build the metric rows (feels-like, wind, humidity, sunrise/sunset).
  const metrics = [];
  if (c.feelsLike != null && Math.abs(c.feelsLike - c.temp) >= 1) metrics.push(['Feels like', c.feelsLike + '°']);
  if (c.wind && c.wind.speed != null) {
    let wv = (c.wind.dir ? c.wind.dir + ' ' : '') + c.wind.speed + ' mph';
    if (c.wind.gust != null && c.wind.gust >= c.wind.speed + 5) wv += ', gusts ' + c.wind.gust;
    metrics.push(['Wind', wv]);
  }
  if (c.humidity != null) metrics.push(['Humidity', c.humidity + '%']);
  if (data.sun && data.sun.riseLabel) metrics.push(['Sunrise', data.sun.riseLabel]);
  if (data.sun && data.sun.setLabel) metrics.push(['Sunset', data.sun.setLabel]);

  let mrows = '';
  metrics.forEach((m, i) => {
    mrows += metricText(i % 2 === 0 ? 40 : 290, 314 + Math.floor(i / 2) * 30, m[0], m[1]);
  });
  let y = 314 + Math.ceil(metrics.length / 2) * 30 - 12;

  // Air quality: dot + number/category, a 6-band scale, and a plain-language line.
  let aqi = '';
  if (data.air && data.air.aqi != null) {
    const a = data.air, headY = y + 30, segW = 46, gap = 4, x0 = 40, scaleY = headY + 14;
    let segs = '';
    for (let i = 0; i < AQI_BANDS.length; i++) {
      const sx = x0 + i * (segW + gap), on = i === a.index;
      segs += `<rect x="${sx}" y="${scaleY}" width="${segW}" height="8" rx="3" fill="${AQI_BANDS[i]}" opacity="${on ? 1 : 0.3}"/>`;
      if (on) segs += `<rect x="${sx - 2}" y="${scaleY - 2}" width="${segW + 4}" height="12" rx="4" fill="none" stroke="${AQI_BANDS[i]}" stroke-width="2"/>`;
    }
    const wt = wrapText(a.blurb, 40, scaleY + 34, 76, 18, FONTS.sans, 13, ROLE.textMuted);
    aqi = `<circle cx="46" cy="${headY - 5}" r="6" fill="${a.color}"/>
      <text x="60" y="${headY}" font-family="${FONTS.sans}" font-size="15" fill="${ROLE.text}">Air quality <tspan font-weight="700">${a.aqi}</tspan> · ${esc(a.category)}</text>
      ${segs}${wt.svg}`;
    y = scaleY + 34 + (wt.lines - 1) * 18;
  }

  const contentH = Math.max(320, y + 22);
  const h = contentH + off;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="Current conditions in Medora, North Dakota">
    ${frame(w, h)}
    ${off ? alertBanner(w, data.alerts[0], 40) : ''}
    <g transform="translate(0,${off})">
      ${title(40, 56, 'Medora, North Dakota', 30)}
      ${updated(40, 78, data)}
      ${icon(c.icon, 32, 92, 104)}
      <text x="166" y="182" font-family="${DISPLAY}" font-weight="700" font-size="96" fill="${ROLE.text}">${c.temp}&#176;</text>
      <text x="40" y="234" font-family="${SERIF}" font-size="24" fill="${ROLE.text}">${esc(c.label || c.condition || '')}</text>
      <text x="40" y="262" font-family="${FONTS.sans}" font-size="15" fill="${ROLE.textMuted}">High ${c.high != null ? c.high + '°' : '–'} · Low ${c.low != null ? c.low + '°' : '–'}${c.rainChance ? ' · ' + c.rainChance + '% rain' : ''}</text>
      <line x1="40" y1="284" x2="${w - 40}" y2="284" stroke="${ROLE.hairline}" stroke-width="1"/>
      ${mrows}
      ${aqi}
    </g>
  </svg>`;
}

// ----------------------------------------------------------- Alerts image
function wrapText(text, x, y, maxChars, lineH, family, size, fill) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let cur = '';
  for (const wd of words) {
    if ((cur + ' ' + wd).trim().length > maxChars) { if (cur) lines.push(cur); cur = wd; }
    else cur = (cur ? cur + ' ' : '') + wd;
  }
  if (cur) lines.push(cur);
  const tspans = lines.map((ln, i) => `<tspan x="${x}" dy="${i === 0 ? 0 : lineH}">${esc(ln)}</tspan>`).join('');
  return { svg: `<text x="${x}" y="${y}" font-family="${family}" font-size="${size}" fill="${fill}">${tspans}</text>`, lines: lines.length };
}

export function alertsSvg(data) {
  const w = 700, padX = 40;
  const al = data.alerts || [];
  if (!al.length) {
    const h = 172;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="No active weather alerts for Medora">
      ${frame(w, h)}
      ${title(padX, 62, 'Weather alerts · Medora', 30)}
      <svg x="${padX}" y="94" width="28" height="28" viewBox="0 0 24 24"><path d="M20 6 L9 17 L4 12" fill="none" stroke="${ROLE.good}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
      <text x="${padX + 42}" y="116" font-family="${DISPLAY}" font-weight="700" font-size="22" letter-spacing="0.4" fill="${ROLE.text}">NO ACTIVE WEATHER ALERTS</text>
      <text x="${padX + 42}" y="140" font-family="${FONTS.sans}" font-size="14" fill="${ROLE.textMuted}">${esc(data.location.name + ', ' + data.location.region)} · updated ${esc(data.updatedLabel)}</text>
    </svg>`;
  }
  let y = 100, body = '';
  for (const a of al.slice(0, 3)) {
    const col = alertColor(a.severity);
    const top = y;
    body += `<svg x="${padX + 12}" y="${y - 4}" width="22" height="22" viewBox="0 0 100 100">${alertTriangle(col)}</svg>`;
    body += `<text x="${padX + 42}" y="${y + 14}" font-family="${DISPLAY}" font-weight="700" font-size="20" letter-spacing="0.4" fill="${ROLE.text}">${esc((a.event || '').toUpperCase())}</text>`;
    let yy = y + 40;
    if (a.headline) { const wt = wrapText(a.headline, padX + 12, yy, 84, 20, SERIF, 15, ROLE.text); body += wt.svg; yy += (wt.lines - 1) * 20 + 24; }
    if (a.endsLabel) { body += `<text x="${padX + 12}" y="${yy}" font-family="${FONTS.sans}" font-size="13" fill="${ROLE.textMuted}">In effect until ${esc(a.endsLabel)}</text>`; yy += 22; }
    body += `<rect x="${padX}" y="${top - 6}" width="4" height="${yy - top}" fill="${col}"/>`;
    y = yy + 22;
  }
  const h = y + 6;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="Active weather alerts for Medora">
    ${frame(w, h)}
    ${title(padX, 62, 'Weather alerts · Medora', 30)}
    ${body}
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

export const RENDERERS = { dayCardSvg, hourlyStripSvg, currentSvg, badgeSvg, alertsSvg, ogSvg };
export { COLORS };
