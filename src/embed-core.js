/* Medora Weather — zero-dependency embeddable widget.
 * This file is the widget logic. The build step (scripts/build.mjs) prepends
 * the shared brand tokens + icon builders and wraps everything in an IIFE to
 * produce the single site/embed.js that sites load. It reads the cached
 * forecast JSON from GitHub Pages, so visitor traffic never hits weather.gov.
 *
 * Injected before this code by the build:
 *   COLORS, ROLE, FONTS            (from src/lib/brand.mjs)
 *   ICON_BUILDERS, iconSvg, ...    (from src/lib/icons.mjs)
 *   MW_DEFAULT_BASE                (from config.json site.baseUrl)
 */

var SCRIPT = document.currentScript;

function computeBase(el) {
  try {
    if (el && el.src) return el.src.replace(/\/[^/]*$/, '');
  } catch (e) {}
  return MW_DEFAULT_BASE;
}
var BASE = computeBase(SCRIPT);

var boolAttr = function (v, dflt) {
  if (v == null || v === '') return dflt;
  return !/^(false|0|no|off)$/i.test(v);
};
var intAttr = function (v, dflt) {
  var n = parseInt(v, 10);
  return isNaN(n) ? dflt : n;
};

function injectFontsOnce() {
  if (document.getElementById('mw-fonts')) return;
  var css =
    "@font-face{font-family:'Dharma Gothic E';src:url('" + BASE + "/fonts/DharmaGothicE-Bold.otf') format('opentype');font-weight:700;font-display:swap;}" +
    "@font-face{font-family:'ITC Clearface Std';src:url('" + BASE + "/fonts/ClearfaceStd-Regular.otf') format('opentype');font-weight:400;font-display:swap;}" +
    "@font-face{font-family:'ITC Clearface Std';src:url('" + BASE + "/fonts/ClearfaceStd-Bold.otf') format('opentype');font-weight:700;font-display:swap;}" +
    ".mw-root *{box-sizing:border-box;margin:0;padding:0;}" +
    ".mw-root{background:transparent;color:" + ROLE.text +
      ";display:inline-block;max-width:100%;font-family:" + FONTS.sans.replace(/"/g, "'") + ";}" +
    ".mw-title{font-family:" + DISPLAY + ";font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:" + ROLE.text + ";font-size:26px;line-height:1;}" +
    ".mw-sub{font-size:12px;color:" + ROLE.textMuted + ";margin-top:6px;}" +
    ".mw-row{display:flex;gap:6px;align-items:flex-start;}" +
    ".mw-days{display:flex;gap:4px;margin-top:16px;}" +
    ".mw-day{flex:1;min-width:78px;text-align:center;padding:6px 8px;}" +
    ".mw-day + .mw-day{border-left:1px solid " + ROLE.hairline + ";}" +
    ".mw-dname{font-family:" + DISPLAY + ";text-transform:uppercase;font-weight:700;font-size:18px;color:" + ROLE.text + ";}" +
    ".mw-hi{font-family:" + DISPLAY + ";font-weight:700;font-size:34px;line-height:1;color:" + ROLE.text + ";}" +
    ".mw-lo{font-family:" + SERIF + ";font-size:17px;color:" + ROLE.textMuted + ";}" +
    ".mw-cond{font-size:12px;color:" + ROLE.textMuted + ";margin-top:3px;min-height:15px;}" +
    ".mw-rain{font-size:12px;color:" + ROLE.rainDrop + ";margin-top:3px;display:flex;gap:3px;align-items:center;justify-content:center;}" +
    ".mw-snow{font-size:12px;color:" + ROLE.rainDrop + ";margin-top:2px;display:flex;gap:3px;align-items:center;justify-content:center;}" +
    ".mw-strip{display:flex;gap:2px;margin-top:16px;overflow-x:auto;}" +
    ".mw-hour{flex:0 0 auto;width:64px;text-align:center;padding:4px 2px;}" +
    ".mw-hlabel{font-size:12px;color:" + ROLE.textMuted + ";}" +
    ".mw-htemp{font-family:" + DISPLAY + ";font-weight:700;font-size:22px;color:" + ROLE.text + ";}" +
    ".mw-now{display:flex;align-items:center;gap:14px;margin-top:12px;}" +
    ".mw-nowtemp{font-family:" + DISPLAY + ";font-weight:700;font-size:72px;line-height:.9;color:" + ROLE.text + ";}" +
    ".mw-nowcond{font-family:" + SERIF + ";font-size:20px;color:" + ROLE.text + ";}" +
    ".mw-nowmeta{font-size:14px;color:" + ROLE.textMuted + ";margin-top:4px;}" +
    ".mw-ico{display:block;margin:6px auto;}" +
    ".mw-link{text-decoration:none;color:inherit;display:inline-block;max-width:100%;cursor:pointer;transition:opacity .15s;}" +
    ".mw-link:hover{opacity:.72;}" +
    ".mw-mini{position:relative;display:inline-flex;align-items:center;gap:8px;background:transparent" +
      ";font-family:" + FONTS.sans.replace(/"/g, "'") + ";line-height:1;}" +
    ".mw-mini svg{display:block;flex:0 0 auto;}" +
    ".mw-dot{position:absolute;top:-3px;right:-3px;width:11px;height:11px;border-radius:50%;border:2px solid " + ROLE.bg + ";}" +
    ".mw-alert{display:flex;align-items:center;gap:10px;padding:9px 12px;border:1px solid " + ROLE.hairline + ";border-left-width:4px;background:transparent;text-decoration:none;color:" + ROLE.text + ";margin-bottom:12px;max-width:100%;}" +
    ".mw-alert:hover{background:" + ROLE.panel + ";}" +
    ".mw-metrics{display:flex;flex-wrap:wrap;gap:6px 20px;margin-top:14px;}" +
    ".mw-metric{display:flex;flex-direction:column;gap:1px;}" +
    ".mw-mk{font-size:11px;text-transform:uppercase;letter-spacing:.4px;color:" + ROLE.textMuted + ";}" +
    ".mw-mv{font-size:15px;color:" + ROLE.text + ";}" +
    ".mw-aqi{margin-top:14px;}" +
    ".mw-aqi-h{display:flex;align-items:center;gap:8px;font-size:14px;color:" + ROLE.text + ";}" +
    ".mw-aqi-dot{width:12px;height:12px;border-radius:50%;flex:0 0 auto;}" +
    ".mw-aqi-scale{display:flex;gap:2px;margin-top:6px;max-width:280px;}" +
    ".mw-aqi-seg{height:6px;flex:1;border-radius:2px;}" +
    ".mw-aqi-b{font-size:12px;color:" + ROLE.textMuted + ";margin-top:5px;max-width:340px;line-height:1.45;}" +
    ".mw-alert-ev{font-family:" + DISPLAY + ";text-transform:uppercase;font-weight:700;font-size:15px;letter-spacing:.3px;color:" + ROLE.text + ";}" +
    ".mw-alert-tm{font-size:12px;color:" + ROLE.textMuted + ";}" +
    ".mw-alert-more{margin-left:auto;font-size:12px;color:" + ROLE.textMuted + ";white-space:nowrap;}" +
    ".mw-alert-ico{flex:0 0 auto;line-height:0;}" +
    ".mw-al{border:1px solid " + ROLE.hairline + ";border-left-width:4px;padding:12px 14px;margin-bottom:10px;}" +
    ".mw-al-ev{font-family:" + DISPLAY + ";text-transform:uppercase;font-weight:700;font-size:18px;letter-spacing:.3px;color:" + ROLE.text + ";display:flex;align-items:center;gap:8px;}" +
    ".mw-al-hl{font-family:" + SERIF + ";font-size:15px;color:" + ROLE.text + ";margin-top:4px;}" +
    ".mw-al-tm{font-size:12px;color:" + ROLE.textMuted + ";margin-top:4px;}" +
    ".mw-al-inst{font-size:13px;color:" + ROLE.text + ";margin-top:8px;line-height:1.5;}" +
    ".mw-allclear{display:flex;align-items:center;gap:12px;padding:14px 4px;}" +
    ".mw-ac-t{font-family:" + DISPLAY + ";text-transform:uppercase;font-weight:700;font-size:18px;color:" + ROLE.text + ";}" +
    ".mw-ac-s{font-size:13px;color:" + ROLE.textMuted + ";margin-top:2px;}" +
    ".mw-mtemp{font-family:" + DISPLAY + ";font-weight:700;font-size:26px;color:" + ROLE.text + ";}" +
    ".mw-mloc{font-size:12px;color:" + ROLE.textMuted + ";letter-spacing:.3px;text-transform:uppercase;font-family:" + DISPLAY + ";}" +
    ".mw-err{font-size:13px;color:" + ROLE.textMuted + ";}";
  var st = document.createElement('style');
  st.id = 'mw-fonts';
  st.textContent = css;
  document.head.appendChild(st);
}
var DISPLAY = "'Dharma Gothic E','Oswald','Arial Narrow',sans-serif";
var SERIF = "'ITC Clearface Std',Georgia,serif";

function drop(size) {
  return '<svg class="mw-ico" width="' + size + '" height="' + size + '" viewBox="0 0 24 24" style="display:inline-block;vertical-align:-2px;margin:0" aria-hidden="true">' +
    '<path d="M12 3 C8 9 6 12 6 15 a6 6 0 0 0 12 0 C18 12 16 9 12 3 z" fill="' + ROLE.rainDrop + '"/></svg>';
}

function rainLine(pct, showRain) {
  if (!showRain || !pct) return '';
  return '<div class="mw-rain">' + drop(12) + '<span>' + pct + '%</span></div>';
}

function flake(size) {
  var s = '', cx = size / 2, r = size * 0.42;
  for (var i = 0; i < 3; i++) {
    var a = (i * Math.PI) / 3, dx = Math.cos(a) * r, dy = Math.sin(a) * r;
    s += '<line x1="' + (cx - dx).toFixed(1) + '" y1="' + (cx - dy).toFixed(1) + '" x2="' + (cx + dx).toFixed(1) + '" y2="' + (cx + dy).toFixed(1) + '"/>';
  }
  return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '" style="display:inline-block;vertical-align:-1px" aria-hidden="true"><g stroke="' + ROLE.rainDrop + '" stroke-width="1.4" stroke-linecap="round">' + s + '</g></svg>';
}

function snowStr(inches) {
  return (inches % 1 === 0 ? String(inches) : inches.toFixed(1)) + ' in';
}

function snowLine(inches, showRain) {
  if (!showRain || !(inches > 0)) return '';
  return '<div class="mw-snow">' + flake(12) + '<span>' + snowStr(inches) + '</span></div>';
}

function esc(s) { return String(s == null ? '' : s).replace(/[<>&]/g, function (c) { return { '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]; }); }

function renderDays(data, days, showRain) {
  var list = data.days.slice(0, days);
  var html = '<div class="mw-days">';
  list.forEach(function (d) {
    html += '<div class="mw-day">' +
      '<div class="mw-dname">' + esc(d.short) + '</div>' +
      '<div class="mw-ico">' + iconSvg(d.icon, 60) + '</div>' +
      '<div class="mw-hi">' + (d.high != null ? d.high : '–') + '°</div>' +
      '<div class="mw-lo">' + (d.low != null ? d.low : '–') + '°</div>' +
      '<div class="mw-cond">' + esc(d.label || d.condition || '') + '</div>' +
      rainLine(d.rainChance, showRain) +
      snowLine(d.snowfall, showRain) +
      '</div>';
  });
  return html + '</div>';
}

function renderHourly(data, hours, showRain) {
  var list = data.hourly.slice(0, hours);
  var html = '<div class="mw-strip">';
  list.forEach(function (h) {
    html += '<div class="mw-hour">' +
      '<div class="mw-hlabel">' + esc(h.label) + '</div>' +
      '<div class="mw-ico">' + iconSvg(h.icon, 40) + '</div>' +
      '<div class="mw-htemp">' + h.temp + '°</div>' +
      (showRain && h.rainChance ? '<div class="mw-rain">' + h.rainChance + '%</div>' : '') +
      snowLine(h.snowfall, showRain) +
      '</div>';
  });
  return html + '</div>';
}

function metric(k, v) {
  return '<div class="mw-metric"><span class="mw-mk">' + k + '</span><span class="mw-mv">' + v + '</span></div>';
}
function renderMetrics(data) {
  var c = data.current, m = '';
  if (c.feelsLike != null && Math.abs(c.feelsLike - c.temp) >= 1) m += metric('Feels like', c.feelsLike + '°');
  if (c.wind && c.wind.speed != null) {
    var wv = (c.wind.dir ? c.wind.dir + ' ' : '') + c.wind.speed + ' mph';
    if (c.wind.gust != null && c.wind.gust >= c.wind.speed + 5) wv += ', gusts ' + c.wind.gust;
    m += metric('Wind', wv);
  }
  if (c.humidity != null) m += metric('Humidity', c.humidity + '%');
  if (data.sun && data.sun.riseLabel) m += metric('Sunrise', data.sun.riseLabel);
  if (data.sun && data.sun.setLabel) m += metric('Sunset', data.sun.setLabel);
  return m ? '<div class="mw-metrics">' + m + '</div>' : '';
}
// Air quality: a colored dot + number/category, a 6-band scale showing where it
// sits, and a plain-language line so the number actually means something.
function renderAqi(data) {
  var a = data.air;
  if (!a || a.aqi == null) return '';
  var segs = '';
  for (var i = 0; i < AQI_BANDS.length; i++) {
    var on = i === a.index;
    segs += '<div class="mw-aqi-seg" style="background:' + AQI_BANDS[i] + ';opacity:' + (on ? '1' : '0.28') + (on ? ';box-shadow:0 0 0 2px ' + AQI_BANDS[i] : '') + '"></div>';
  }
  return '<div class="mw-aqi">' +
    '<div class="mw-aqi-h"><span class="mw-aqi-dot" style="background:' + a.color + '"></span>' +
    '<span>Air quality <strong>' + a.aqi + '</strong> · ' + esc(a.category) + '</span></div>' +
    '<div class="mw-aqi-scale">' + segs + '</div>' +
    '<div class="mw-aqi-b">' + esc(a.blurb) + '</div></div>';
}

function renderCurrent(data, showRain) {
  var c = data.current;
  return '<div class="mw-now">' +
    '<div>' + iconSvg(c.icon, 96) + '</div>' +
    '<div><div class="mw-nowtemp">' + c.temp + '°</div></div>' +
    '</div>' +
    '<div class="mw-nowcond">' + esc(c.condition || '') + '</div>' +
    '<div class="mw-nowmeta">High ' + (c.high != null ? c.high + '°' : '–') +
      ' · Low ' + (c.low != null ? c.low + '°' : '–') +
      (showRain && c.rainChance ? ' · ' + c.rainChance + '% rain' : '') + '</div>' +
    renderMetrics(data) +
    renderAqi(data);
}

function triSvg(color, size) {
  return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 100 100" style="display:inline-block;vertical-align:-3px" aria-hidden="true">' + alertTriangle(color) + '</svg>';
}
function checkSvg(size) {
  return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" style="display:inline-block;vertical-align:-4px" aria-hidden="true"><path d="M20 6 L9 17 L4 12" fill="none" stroke="' + ROLE.good + '" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
}

function renderMini(data, showTitle) {
  var c = data.current;
  var al = data.alerts || [];
  var dot = al.length ? '<span class="mw-dot" style="background:' + alertColor(al[0].severity) + '"></span>' : '';
  return '<span class="mw-mini">' + dot + iconSvg(c.icon, 30) +
    '<span class="mw-mtemp">' + c.temp + '°</span>' +
    (showTitle ? '<span class="mw-mloc">' + esc(data.location.name) + '</span>' : '') +
    '</span>';
}

// Slim alert banner for the top of full views (links to the forecast page).
function renderAlertBanner(data) {
  var al = data.alerts || [];
  if (!al.length) return '';
  var a = al[0], col = alertColor(a.severity);
  var more = al.length > 1 ? '<span class="mw-alert-more">+' + (al.length - 1) + ' more</span>' : '';
  var tm = a.endsLabel ? ' <span class="mw-alert-tm">until ' + esc(a.endsLabel) + '</span>' : '';
  return '<a class="mw-alert" style="border-left-color:' + col + '" href="' + esc(MW_DEFAULT_LINK) + '">' +
    '<span class="mw-alert-ico">' + triSvg(col, 22) + '</span>' +
    '<span><span class="mw-alert-ev">' + esc(a.event) + '</span>' + tm + '</span>' + more + '</a>';
}

// Detailed alerts view (data-view="alerts") with an all-clear fallback.
function renderAlerts(data) {
  var al = data.alerts || [];
  if (!al.length) {
    return '<div class="mw-allclear">' + checkSvg(24) +
      '<div><div class="mw-ac-t">No active weather alerts</div>' +
      '<div class="mw-ac-s">' + esc(data.location.name + ', ' + data.location.region) + ' · updated ' + esc(data.updatedLabel) + '</div></div></div>';
  }
  var html = '';
  al.forEach(function (a) {
    var col = alertColor(a.severity);
    html += '<div class="mw-al" style="border-left-color:' + col + '">' +
      '<div class="mw-al-ev">' + triSvg(col, 20) + '<span>' + esc(a.event) + '</span></div>' +
      (a.headline ? '<div class="mw-al-hl">' + esc(a.headline) + '</div>' : '') +
      (a.endsLabel ? '<div class="mw-al-tm">In effect until ' + esc(a.endsLabel) + '</div>' : '') +
      (a.instruction ? '<div class="mw-al-inst">' + esc(a.instruction) + '</div>' : '') +
      '</div>';
  });
  return html;
}

// Resolve the click-through URL. Every forecast view links to the full
// forecast page by default; data-link="false" disables, a URL overrides.
function resolveLink(el) {
  var v = el.getAttribute('data-link');
  if (v === null || v === '' || /^(true|1|yes|on)$/i.test(v)) return MW_DEFAULT_LINK;
  if (/^(false|0|no|off)$/i.test(v)) return null;
  return v;
}

function renderInto(el, data) {
  var days = intAttr(el.getAttribute('data-days'), 3);
  var hours = intAttr(el.getAttribute('data-hours'), 0);
  var showRain = boolAttr(el.getAttribute('data-rain'), true);
  var showTitle = boolAttr(el.getAttribute('data-title'), true);
  var showAlerts = boolAttr(el.getAttribute('data-alerts'), true);
  var view = (el.getAttribute('data-view') || '').toLowerCase();
  var isMini = view === 'mini' || view === 'badge';
  var link = resolveLink(el);

  // Mini badge: compact, no card wrapper. Alert shows as a colored dot.
  if (isMini) {
    el.className = (el.className ? el.className + ' ' : '') + 'mw-wrap';
    var mini = renderMini(data, showTitle);
    el.innerHTML = link ? '<a class="mw-link" href="' + esc(link) + '">' + mini + '</a>' : mini;
    return;
  }

  // Dedicated alerts detail view (not link-wrapped; it is the detail).
  if (view === 'alerts' || view === 'alert') {
    var ahead = showTitle
      ? '<div class="mw-title">Weather alerts</div><div class="mw-sub">' + esc(data.location.name + ', ' + data.location.region) + '</div>'
      : '';
    el.className = (el.className ? el.className + ' ' : '') + 'mw-root';
    el.innerHTML = ahead + renderAlerts(data);
    return;
  }

  var body = '';
  if (view === 'current') {
    body = renderCurrent(data, showRain);
  } else if (view === 'hourly') {
    body = renderHourly(data, hours || 12, showRain);
  } else {
    if (days > 0) body += renderDays(data, days, showRain);
    if (hours > 0) body += renderHourly(data, hours, showRain);
    if (days <= 0 && hours <= 0) body = renderCurrent(data, showRain);
  }

  var head = showTitle
    ? '<div class="mw-title">' + esc(data.location.name + ', ' + data.location.region) + '</div>' +
      '<div class="mw-sub">Updated ' + esc(data.updatedLabel) + ' · weather.gov' + (data.stale ? ' · data delayed' : '') + '</div>'
    : '';
  // Alert banner is a sibling of the link wrap (never nest anchors).
  var banner = showAlerts ? renderAlertBanner(data) : '';
  var inner = link ? '<a class="mw-link" href="' + esc(link) + '">' + head + body + '</a>' : head + body;
  el.className = (el.className ? el.className + ' ' : '') + 'mw-root';
  el.innerHTML = banner + inner;
}

function targets() {
  var list = [].slice.call(document.querySelectorAll('[data-medora-weather]'));
  // Script-tag usage: if the script itself carries options, render inline.
  if (SCRIPT && (SCRIPT.hasAttribute('data-days') || SCRIPT.hasAttribute('data-view') ||
      SCRIPT.hasAttribute('data-hours') || SCRIPT.hasAttribute('data-medora-weather'))) {
    var host = document.createElement('div');
    ['data-view', 'data-days', 'data-hours', 'data-rain', 'data-title', 'data-link', 'data-refresh', 'data-alerts'].forEach(function (a) {
      if (SCRIPT.hasAttribute(a)) host.setAttribute(a, SCRIPT.getAttribute(a));
    });
    SCRIPT.parentNode.insertBefore(host, SCRIPT.nextSibling);
    list.push(host);
  }
  return list;
}

var DATA_PROMISE = null;
var MANAGED = [];        // elements we keep in sync
var TIMER = null;
var LAST_FETCH = 0;

// How often to re-check for fresh data. Data is cached hourly upstream, so a
// 15-minute poll keeps a long-open page current without hammering the CDN.
// Override with data-refresh (minutes) on the script tag; 0 disables.
function refreshMinutes() {
  var v = SCRIPT && SCRIPT.getAttribute && SCRIPT.getAttribute('data-refresh');
  var n = v == null ? NaN : parseFloat(v);
  return isNaN(n) ? 15 : n;
}

function getData(force) {
  if (force || !DATA_PROMISE) {
    // cache:'no-cache' -> conditional request; the CDN answers 304 when the
    // hourly file is unchanged, so refreshes are nearly free.
    DATA_PROMISE = fetch(BASE + '/data/forecast.json', force ? { cache: 'no-cache' } : {})
      .then(function (r) { if (!r.ok) throw new Error('fetch failed'); LAST_FETCH = Date.now(); return r.json(); });
  }
  return DATA_PROMISE;
}
function fail(el) { el.className = (el.className ? el.className + ' ' : '') + 'mw-root'; el.innerHTML = '<div class="mw-err">Weather unavailable right now.</div>'; }

function track(el) { if (MANAGED.indexOf(el) === -1) MANAGED.push(el); }

function renderOne(el) {
  injectFontsOnce();
  track(el);
  getData().then(function (data) { try { renderInto(el, data); } catch (e) { fail(el); } }).catch(function () { fail(el); });
  scheduleRefresh();
}

// Re-fetch and re-render every managed element still on the page. Keeps the
// old content on a failed fetch rather than blanking the widget.
function refreshAll() {
  MANAGED = MANAGED.filter(function (el) { return el && (el.isConnected == null || el.isConnected); });
  if (!MANAGED.length) return;
  getData(true)
    .then(function (data) { MANAGED.forEach(function (el) { try { renderInto(el, data); } catch (e) {} }); })
    .catch(function () {});
}

function scheduleRefresh() {
  var mins = refreshMinutes();
  if (!mins || mins <= 0 || TIMER) return;
  TIMER = setInterval(refreshAll, mins * 60 * 1000);
  // Also catch up when a backgrounded tab comes back after the interval.
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden && Date.now() - LAST_FETCH > mins * 60 * 1000) refreshAll();
  });
}

function start() {
  var els = targets();
  if (!els.length) return;
  injectFontsOnce();
  els.forEach(track);
  getData()
    .then(function (data) { els.forEach(function (el) { try { renderInto(el, data); } catch (e) { fail(el); } }); })
    .catch(function () { els.forEach(fail); });
  scheduleRefresh();
}

// Public hook for dynamic pages (e.g. the demo/config generator).
window.MedoraWeather = {
  render: renderOne,
  refresh: function () { refreshAll(); },
  reload: function () { DATA_PROMISE = null; start(); }
};

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
else start();
