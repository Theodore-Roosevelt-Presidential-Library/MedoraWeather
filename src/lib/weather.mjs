// Fetches the National Weather Service forecast for the configured location
// and normalizes it into a small, stable JSON schema. Only this module talks
// to api.weather.gov; the GitHub Action runs it hourly and everything else
// reads the cached JSON it produces.
import { conditionToIcon, shortLabel } from './icons.mjs';

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

export async function fetchWeather(config) {
  const { latitude, longitude, timezone } = config.location;
  const ua = config.site.userAgent;

  const points = await getJson(
    `https://api.weather.gov/points/${latitude},${longitude}`, ua
  );
  const p = points.properties;
  const [forecast, hourly] = await Promise.all([
    getJson(p.forecast, ua),
    getJson(p.forecastHourly, ua)
  ]);

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
    .map((d) => ({ ...d, label: shortLabel(d.icon) }));

  // ---- Hourly
  const hours = hourly.properties.periods.map((h) => {
    const { hour } = partsInTz(h.startTime, timezone);
    return {
      time: h.startTime,
      label: hour.replace(' ', '').toLowerCase(), // e.g. "2pm"
      temp: h.temperature,
      condition: h.shortForecast,
      icon: conditionToIcon(h.shortForecast, h.isDaytime),
      rainChance: rain(h),
      isDaytime: h.isDaytime
    };
  });

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
    hourly: hours
  };
}
