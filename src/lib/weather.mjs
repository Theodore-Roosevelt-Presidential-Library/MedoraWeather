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

  // ---- Active alerts (Heat Advisory, Winter Storm Warning, etc.)
  const alerts = await fetchAlerts(latitude, longitude, timezone, ua);

  // ---- Current conditions (best available "now")
  const now = hourly.properties.periods[0];
  const current = {
    temp: now.temperature,
    condition: now.shortForecast,
    label: shortLabel(conditionToIcon(now.shortForecast, now.isDaytime)),
    icon: conditionToIcon(now.shortForecast, now.isDaytime),
    rainChance: rain(now),
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
    current,
    days,
    hourly: hours,
    alerts
  };
}
