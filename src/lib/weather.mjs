// Fetches the National Weather Service forecast for the configured location
// and normalizes it into a small, stable JSON schema. Only this module talks
// to api.weather.gov; the GitHub Action runs it hourly and everything else
// reads the cached JSON it produces.
import { conditionToIcon, shortLabel, severityRank } from './icons.mjs';

async function getJson(url, userAgent, tries = 3) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': userAgent, Accept: 'application/geo+json' }
      });
      if (res.status === 500 || res.status === 503) throw new Error(`NWS ${res.status}`);
      if (!res.ok) throw new Error(`Request failed ${res.status} for ${url}`);
      return await res.json();
    } catch (err) {
      lastErr = err;
      await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
    }
  }
  throw lastErr;
}

function partsInTz(iso, timeZone) {
  const d = new Date(iso);
  const date = new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(d); // YYYY-MM-DD
  const weekday = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'long' }).format(d);
  const weekdayShort = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short' }).format(d);
  const hour = new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', hour12: true }).format(d);
  return { date, weekday, weekdayShort, hour };
}

const rain = (p) => (p && p.probabilityOfPrecipitation && p.probabilityOfPrecipitation.value) || 0;

// Parse an ISO-8601 duration (e.g. "PT6H", "P1DT2H", "PT30M") into hours.
function durationHours(iso) {
  const m = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?)?$/.exec(iso || '');
  if (!m) return 1;
  return (+(m[1] || 0)) * 24 + (+(m[2] || 0)) + (+(m[3] || 0)) / 60;
}

function timeLabel(iso, timeZone) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone, weekday: 'short', hour: 'numeric', minute: '2-digit'
  }).format(new Date(iso));
}
function clockLabel(date, timeZone) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone, hour: 'numeric', minute: '2-digit'
  }).format(date);
}

// Unit helpers (gridpoint is metric: degC, km/h, degrees).
const cToF = (c) => (c == null ? null : Math.round((c * 9) / 5 + 32));
const kmhToMph = (k) => (k == null ? null : Math.round(k * 0.621371));
const CARD = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
const degToCardinal = (d) => (d == null ? '' : CARD[Math.round(d / 22.5) % 16]);

// Value from a gridpoint time-series covering a given epoch-ms instant.
function gridValueAt(series, timeMs) {
  if (!series || !series.values || !series.values.length) return null;
  for (const b of series.values) {
    const [s, dur] = b.validTime.split('/');
    const start = new Date(s).getTime();
    const end = start + durationHours(dur) * 3600000;
    if (timeMs >= start && timeMs < end) return b.value;
  }
  return series.values[0].value;
}

// Sunrise/sunset via the classic "Almanac for Computers" algorithm — computed
// locally so there is no extra API to fail. Returns UTC Date objects or null.
function sunTimes(date, lat, lng) {
  const rad = Math.PI / 180, deg = 180 / Math.PI;
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  const dayOfYear = Math.floor((date.getTime() - start) / 86400000);
  function calc(isRise) {
    const zenith = 90.833, lngHour = lng / 15;
    const t = dayOfYear + ((isRise ? 6 : 18) - lngHour) / 24;
    const M = 0.9856 * t - 3.289;
    let L = M + 1.916 * Math.sin(M * rad) + 0.020 * Math.sin(2 * M * rad) + 282.634;
    L = (L + 360) % 360;
    let RA = deg * Math.atan(0.91764 * Math.tan(L * rad));
    RA = (RA + 360) % 360;
    RA = (RA + (Math.floor(L / 90) * 90 - Math.floor(RA / 90) * 90)) / 15;
    const sinDec = 0.39782 * Math.sin(L * rad);
    const cosDec = Math.cos(Math.asin(sinDec));
    const cosH = (Math.cos(zenith * rad) - sinDec * Math.sin(lat * rad)) / (cosDec * Math.cos(lat * rad));
    if (cosH > 1 || cosH < -1) return null;
    let H = isRise ? 360 - deg * Math.acos(cosH) : deg * Math.acos(cosH);
    H /= 15;
    let UT = (H + RA - 0.06571 * t - 6.622 - lngHour) % 24;
    return (UT + 24) % 24;
  }
  const mk = (ut) => (ut == null ? null : new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) + ut * 3600000));
  return { rise: mk(calc(true)), set: mk(calc(false)) };
}

// US EPA AQI bands: category, recognizable color, and a plain-language line so
// people don't have to decode the number.
function aqiInfo(a) {
  if (a <= 50) return { index: 0, category: 'Good', color: '#4E9A51', blurb: 'Air quality is healthy — a great day to be outside.' };
  if (a <= 100) return { index: 1, category: 'Moderate', color: '#D6A400', blurb: 'Air quality is acceptable; very sensitive people may want to take it easy.' };
  if (a <= 150) return { index: 2, category: 'Unhealthy for sensitive groups', color: '#E8850C', blurb: 'Kids, older adults, and people with heart or lung issues should limit long outdoor exertion.' };
  if (a <= 200) return { index: 3, category: 'Unhealthy', color: '#D64545', blurb: 'Everyone may start to feel effects; limit prolonged time outdoors.' };
  if (a <= 300) return { index: 4, category: 'Very unhealthy', color: '#8E5BA6', blurb: 'Health alert — avoid outdoor exertion.' };
  return { index: 5, category: 'Hazardous', color: '#7E2B2B', blurb: 'Emergency conditions — stay indoors.' };
}

async function fetchAqi(lat, lng) {
  try {
    const j = await (await fetch(
      `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lng}&current=us_aqi`
    )).json();
    const aqi = j.current && j.current.us_aqi;
    if (aqi == null) return null;
    const rounded = Math.round(aqi);
    return { aqi: rounded, ...aqiInfo(rounded) };
  } catch (e) {
    return null; // best-effort
  }
}

async function fetchAlerts(latitude, longitude, timezone, ua) {
  try {
    const res = await getJson(
      `https://api.weather.gov/alerts/active?point=${latitude},${longitude}`, ua
    );
    return (res.features || [])
      .map((f) => {
        const a = f.properties;
        const onset = a.onset || a.effective || a.sent;
        const ends = a.ends || a.expires;
        return {
          id: a.id,
          event: a.event,
          severity: a.severity,
          urgency: a.urgency,
          headline: a.headline || '',
          description: (a.description || '').trim(),
          instruction: (a.instruction || '').trim(),
          onset,
          ends,
          startsLabel: onset ? timeLabel(onset, timezone) : '',
          endsLabel: ends ? timeLabel(ends, timezone) : ''
        };
      })
      .sort((x, y) => severityRank(y.severity) - severityRank(x.severity) ||
        new Date(x.onset || 0) - new Date(y.onset || 0));
  } catch (e) {
    return []; // alerts are best-effort; never fail the whole build over them
  }
}

export async function fetchWeather(config) {
  const { latitude, longitude, timezone } = config.location;
  const ua = config.site.userAgent;

  const points = await getJson(
    `https://api.weather.gov/points/${latitude},${longitude}`, ua
  );
  const p = points.properties;
  const [forecast, hourly, grid] = await Promise.all([
    getJson(p.forecast, ua),
    getJson(p.forecastHourly, ua),
    getJson(p.forecastGridData, ua)
  ]);

  // ---- Snowfall: the raw gridpoint dataset reports snowfallAmount (mm) in
  // irregular time buckets. Spread each bucket evenly across the hours it
  // covers, then total by day and by hour, and convert mm -> inches.
  const snowByDate = new Map();
  const snowByEpochHour = new Map();
  const snowVals = (grid.properties.snowfallAmount && grid.properties.snowfallAmount.values) || [];
  for (const b of snowVals) {
    if (!b.value) continue;
    const [startIso, durIso] = b.validTime.split('/');
    const start = new Date(startIso);
    const hrs = Math.max(1, Math.round(durationHours(durIso)));
    const perHour = b.value / hrs;
    for (let i = 0; i < hrs; i++) {
      const t = new Date(start.getTime() + i * 3600000);
      const eh = Math.floor(t.getTime() / 3600000);
      snowByEpochHour.set(eh, (snowByEpochHour.get(eh) || 0) + perHour);
      const { date } = partsInTz(t.toISOString(), timezone);
      snowByDate.set(date, (snowByDate.get(date) || 0) + perHour);
    }
  }
  const mmToIn = (mm) => Math.round((mm / 25.4) * 10) / 10;

  // ---- Daily: fold the alternating day/night periods into per-date objects.
  const byDate = new Map();
  for (const period of forecast.properties.periods) {
    const { date, weekday, weekdayShort } = partsInTz(period.startTime, timezone);
    if (!byDate.has(date)) {
      byDate.set(date, {
        date, name: weekday, short: weekdayShort,
        high: null, low: null, icon: null, condition: null, rainChance: 0
      });
    }
    const day = byDate.get(date);
    if (period.isDaytime) {
      day.high = period.temperature;
      day.condition = period.shortForecast;
      day.icon = conditionToIcon(period.shortForecast, true);
      day.rainChance = Math.max(day.rainChance, rain(period));
    } else {
      day.low = period.temperature;
      day.rainChance = Math.max(day.rainChance, rain(period));
      if (!day.condition) {
        day.condition = period.shortForecast;
        day.icon = conditionToIcon(period.shortForecast, false);
      }
    }
  }
  const days = [...byDate.values()]
    .filter((d) => d.high !== null || d.low !== null)
    .map((d) => ({ ...d, label: shortLabel(d.icon), snowfall: mmToIn(snowByDate.get(d.date) || 0) }));

  // ---- Hourly
  const hours = hourly.properties.periods.map((h) => {
    const { hour } = partsInTz(h.startTime, timezone);
    const eh = Math.floor(new Date(h.startTime).getTime() / 3600000);
    return {
      time: h.startTime,
      label: hour.replace(' ', '').toLowerCase(), // e.g. "2pm"
      temp: h.temperature,
      condition: h.shortForecast,
      icon: conditionToIcon(h.shortForecast, h.isDaytime),
      rainChance: rain(h),
      snowfall: mmToIn(snowByEpochHour.get(eh) || 0),
      isDaytime: h.isDaytime
    };
  });

  // ---- Extra "now" metrics from the gridpoint (feels-like, wind, humidity).
  const gp = grid.properties;
  const nowMs = Date.now();
  const feelsLike = cToF(gridValueAt(gp.apparentTemperature, nowMs));
  const rh = gridValueAt(gp.relativeHumidity, nowMs);
  const wind = {
    speed: kmhToMph(gridValueAt(gp.windSpeed, nowMs)),
    gust: kmhToMph(gridValueAt(gp.windGust, nowMs)),
    dir: degToCardinal(gridValueAt(gp.windDirection, nowMs))
  };

  // ---- Sunrise/sunset (local calc) + air quality (best-effort).
  const st = sunTimes(new Date(), latitude, longitude);
  const sun = {
    riseLabel: st.rise ? clockLabel(st.rise, timezone) : '',
    setLabel: st.set ? clockLabel(st.set, timezone) : ''
  };
  const air = await fetchAqi(latitude, longitude);

  // ---- Active alerts (Heat Advisory, Winter Storm Warning, etc.)
  const alerts = await fetchAlerts(latitude, longitude, timezone, ua);

  // ---- Current conditions (best available "now")
  const now = hourly.properties.periods[0];
  const current = {
    temp: now.temperature,
    feelsLike,
    condition: now.shortForecast,
    label: shortLabel(conditionToIcon(now.shortForecast, now.isDaytime)),
    icon: conditionToIcon(now.shortForecast, now.isDaytime),
    rainChance: rain(now),
    humidity: rh == null ? null : Math.round(rh),
    wind,
    isDaytime: now.isDaytime,
    high: days[0] ? days[0].high : null,
    low: days[0] ? days[0].low : null
  };

  return {
    schema: 1,
    location: {
      name: config.location.name,
      region: config.location.region,
      shortName: config.location.shortName,
      timezone
    },
    generatedAt: new Date().toISOString(),
    updatedLabel: new Intl.DateTimeFormat('en-US', {
      timeZone: timezone, weekday: 'short', hour: 'numeric', minute: '2-digit'
    }).format(new Date()),
    units: 'F',
    stale: false,
    current,
    days,
    hourly: hours,
    alerts,
    sun,
    air
  };
}

// Graceful degradation: if the live NWS fetch fails, reuse the last forecast
// we published so the site never goes blank, flagged stale so the UI can say so.
export async function fetchWeatherWithFallback(config) {
  try {
    return await fetchWeather(config);
  } catch (err) {
    try {
      const res = await fetch(`${config.site.baseUrl}/data/forecast.json`, {
        headers: { 'User-Agent': config.site.userAgent },
        cache: 'no-store'
      });
      if (!res.ok) throw new Error('no last-good data');
      const data = await res.json();
      data.stale = true;
      data.staleReason = 'Live weather service was unreachable; showing the last available forecast.';
      data.checkedAt = new Date().toISOString();
      return data;
    } catch (e2) {
      throw err; // nothing to fall back to — let the deploy keep the previous site
    }
  }
}
