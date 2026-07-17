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
    ".mw-root{background:" + ROLE.bg + ";color:" + ROLE.text +
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
    ".mw-mini{display:inline-flex;align-items:center;gap:8px;background:" + ROLE.bg +
      ";font-family:" + FONTS.sans.replace(/"/g, "'") + ";line-height:1;}" +
    ".mw-mini svg{display:block;flex:0 0 auto;}" +
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
      '</div>';
  });
  return html + '</div>';
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
      (showRain && c.rainChance ? ' · ' + c.rainChance + '% rain' : '') + '</div>';
}

function renderMini(data, showTitle) {
  var c = data.current;
  return '<span class="mw-mini">' + iconSvg(c.icon, 30) +
    '<span class="mw-mtemp">' + c.temp + '°</span>' +
    (showTitle ? '<span class="mw-mloc">' + esc(data.location.name) + '</span>' : '') +
    '</span>';
}

// Resolve the click-through URL. Mini badge links by default; other views only
// link when data-link is set. data-link="false" disables; "true"/"" uses default.
function resolveLink(el, isMini) {
  var v = el.getAttribute('data-link');
  if (v === null) return isMini ? MW_DEFAULT_LINK : null;
  if (/^(false|0|no|off)$/i.test(v)) return null;
  if (v === '' || /^(true|1|yes|on)$/i.test(v)) return MW_DEFAULT_LINK;
  return v;
}

function renderInto(el, data) {
  var days = intAttr(el.getAttribute('data-days'), 3);
  var hours = intAttr(el.getAttribute('data-hours'), 0);
  var showRain = boolAttr(el.getAttribute('data-rain'), true);
  var showTitle = boolAttr(el.getAttribute('data-title'), true);
  var view = (el.getAttribute('data-view') || '').toLowerCase();
  var isMini = view === 'mini' || view === 'badge';
  var link = resolveLink(el, isMini);

  // Mini badge: compact, no card wrapper.
  if (isMini) {
    el.className = (el.className ? el.className + ' ' : '') + 'mw-wrap';
    var mini = renderMini(data, showTitle);
    el.innerHTML = link ? '<a class="mw-link" href="' + esc(link) + '">' + mini + '</a>' : mini;
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
      '<div class="mw-sub">Updated ' + esc(data.updatedLabel) + ' · weather.gov</div>'
    : '';
  el.className = (el.className ? el.className + ' ' : '') + 'mw-root';
  el.innerHTML = link ? '<a class="mw-link" href="' + esc(link) + '">' + head + body + '</a>' : head + body;
}

function targets() {
  var list = [].slice.call(document.querySelectorAll('[data-medora-weather]'));
  // Script-tag usage: if the script itself carries options, render inline.
  if (SCRIPT && (SCRIPT.hasAttribute('data-days') || SCRIPT.hasAttribute('data-view') ||
      SCRIPT.hasAttribute('data-hours') || SCRIPT.hasAttribute('data-medora-weather'))) {
    var host = document.createElement('div');
    ['data-view', 'data-days', 'data-hours', 'data-rain', 'data-title', 'data-link'].forEach(function (a) {
      if (SCRIPT.hasAttribute(a)) host.setAttribute(a, SCRIPT.getAttribute(a));
    });
    SCRIPT.parentNode.insertBefore(host, SCRIPT.nextSibling);
    list.push(host);
  }
  return list;
}

var DATA_PROMISE = null;
function getData() {
  if (!DATA_PROMISE) {
    DATA_PROMISE = fetch(BASE + '/data/forecast.json')
      .then(function (r) { if (!r.ok) throw new Error('fetch failed'); return r.json(); });
  }
  return DATA_PROMISE;
}
function fail(el) { el.className = (el.className ? el.className + ' ' : '') + 'mw-root'; el.innerHTML = '<div class="mw-err">Weather unavailable right now.</div>'; }

function renderOne(el) {
  injectFontsOnce();
  getData().then(function (data) { try { renderInto(el, data); } catch (e) { fail(el); } }).catch(function () { fail(el); });
}

function start() {
  var els = targets();
  if (!els.length) return;
  injectFontsOnce();
  getData()
    .then(function (data) { els.forEach(function (el) { try { renderInto(el, data); } catch (e) { fail(el); } }); })
    .catch(function () { els.forEach(fail); });
}

// Public hook for dynamic pages (e.g. the demo/config generator).
window.MedoraWeather = {
  render: renderOne,
  reload: function () { DATA_PROMISE = null; start(); }
};

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
else start();
