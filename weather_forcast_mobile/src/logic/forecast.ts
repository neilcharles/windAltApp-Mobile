// Port of the data shaping in R/get_weather.R and the weather() / weather_selected_units()
// reactives in R/wind_alt_app.R. Values stay in kph / metres; convert at display time.
import type { AltitudeHour, Forecast, GroundHour, Level, ModelForecast, ModelId, Site } from '../types';
import { daylightHours } from './daylight';

export const MODELS: { id: ModelId; api: string; name: string; blurb: string }[] = [
  { id: 'DWD_ICON', api: 'icon_seamless', name: 'DWD ICON', blurb: 'Modern German model' },
  { id: 'MET_OFFICE', api: 'ukmo_seamless', name: 'MET Office', blurb: 'Modern British model' },
  { id: 'NOAA_GFS', api: 'gfs_seamless', name: 'NOAA GFS', blurb: 'Older US model (like XCWeather)' },
];

export const PRESSURE_LEVELS = ['1000hPa', '975hPa', '950hPa', '925hPa', '900hPa', '850hPa', '700hPa', '600hPa'];
export const GROUND_VARS = ['wind_speed_10m', 'wind_direction_10m', 'wind_gusts_10m', 'temperature_2m', 'weather_code'];
export const LEVEL_VARS = ['wind_speed', 'wind_direction', 'geopotential_height', 'temperature', 'cloud_cover'];

/** Default altitude cap when "Show High Altitude" is off (metres). */
export const LOW_ALT_LIMIT_M = 1500;

export interface OpenMeteoResponse {
  hourly: Record<string, (number | string | null)[]> & { time: string[] };
}

export function hourlyVariables(): string[] {
  const levels = PRESSURE_LEVELS.flatMap((p) => LEVEL_VARS.map((v) => `${v}_${p}`));
  return [...GROUND_VARS, ...levels];
}

/** Turn one multi-model Open-Meteo response into per-model forecasts. Nulls stay null. */
export function parseForecast(json: OpenMeteoResponse, fetchedAt = Date.now()): Forecast {
  const times = json.hourly.time;
  const models = {} as Record<ModelId, ModelForecast>;

  for (const model of MODELS) {
    const series = (name: string) => json.hourly[`${name}_${model.api}`] ?? [];
    const num = (name: string, i: number): number | null => {
      const v = series(name)[i];
      return typeof v === 'number' && Number.isFinite(v) ? v : null;
    };

    const ground: GroundHour[] = [];
    const altitude: AltitudeHour[] = [];

    times.forEach((time, i) => {
      const date = time.slice(0, 10);
      const hour = Number(time.slice(11, 13));
      const windspeed = num('wind_speed_10m', i);
      ground.push({
        time, date, hour,
        windspeed,
        winddirection: num('wind_direction_10m', i),
        gusts: atLeastWind(num('wind_gusts_10m', i), windspeed),
        temperature: num('temperature_2m', i),
        weatherCode: num('weather_code', i),
      });
      const levels: Level[] = PRESSURE_LEVELS.map((p) => ({
        pressure: p,
        height: num(`geopotential_height_${p}`, i),
        windspeed: num(`wind_speed_${p}`, i),
        winddirection: num(`wind_direction_${p}`, i),
        temperature: num(`temperature_${p}`, i),
        cloudCover: num(`cloud_cover_${p}`, i),
      }));
      altitude.push({ time, date, hour, levels });
    });

    models[model.id] = { ground, altitude };
  }

  return { fetchedAt, models };
}

/**
 * A gust can't be lower than the mean wind. GFS sometimes reports one (in the raw API data, not
 * introduced by this app or the Shiny one), e.g. a 2.9 kph gust with 4.1 kph wind, so report the
 * gust as the base wind speed instead.
 */
export function atLeastWind(gust: number | null, wind: number | null): number | null {
  if (gust === null || wind === null) return gust;
  return Math.max(gust, wind);
}

type Place = Pick<Site, 'lat' | 'lon'>;

/** Is this hour in the site's flying daylight (sunrise - 30 min to sunset + 30 min)? */
const inDaylight = (h: { date: string; hour: number }, site: Place) => daylightHours(h.date, site.lat, site.lon).includes(h.hour);

/** Ground rows for the summary list: daylight hours only, and drop rows the API left empty. */
export function summaryRows(forecast: ModelForecast, site: Place): GroundHour[] {
  return forecast.ground.filter((g) => g.windspeed !== null && inDaylight(g, site));
}

/** Days with altitude data in daylight hours. */
export function forecastDates(forecast: ModelForecast, site: Place): string[] {
  return [...new Set(forecast.altitude.filter((h) => inDaylight(h, site)).map((h) => h.date))];
}

/**
 * Levels to chart for one hour. Mirrors the Shiny filters: drop levels that are
 * below ground (height < 1) or missing, and cap at 1500 m unless high altitude is on.
 */
export function chartLevels(hour: AltitudeHour | undefined, showHighAlt: boolean): Level[] {
  if (!hour) return [];
  return hour.levels
    .filter((l) => l.height !== null && l.height >= 1 && l.windspeed !== null)
    .filter((l) => showHighAlt || (l.height as number) <= LOW_ALT_LIMIT_M)
    .sort((a, b) => (a.height as number) - (b.height as number));
}

export function findHour(forecast: ModelForecast, date: string, hour: number) {
  return forecast.altitude.find((h) => h.date === date && h.hour === hour);
}

/** Step through daylight hours across days (for swipe / prev-next). */
export function stepHour(dates: string[], date: string, hour: number, delta: 1 | -1, site: Place) {
  const d = dates.indexOf(date);
  if (d < 0) return null;
  const hours = daylightHours(date, site.lat, site.lon);
  const next = delta > 0 ? hours.find((h) => h > hour) : [...hours].reverse().find((h) => h < hour);
  if (next !== undefined) return { date, hour: next };
  const nd = d + delta;
  if (nd < 0 || nd >= dates.length) return null;
  const other = daylightHours(dates[nd], site.lat, site.lon);
  if (!other.length) return null;
  return { date: dates[nd], hour: delta > 0 ? other[0] : other[other.length - 1] };
}

/** Linear interpolation of speed against height, like R's approx(n = 100). */
export function interpolateProfile(levels: Level[], n = 100): { height: number; speed: number }[] {
  const pts = levels.map((l) => ({ height: l.height as number, speed: l.windspeed as number }));
  if (pts.length < 2) return pts;
  const lo = pts[0].height;
  const hi = pts[pts.length - 1].height;
  const out = [];
  for (let i = 0; i < n; i++) {
    const height = lo + ((hi - lo) * i) / (n - 1);
    let j = 0;
    while (j < pts.length - 2 && pts[j + 1].height < height) j++;
    const a = pts[j];
    const b = pts[j + 1];
    const t = b.height === a.height ? 0 : (height - a.height) / (b.height - a.height);
    out.push({ height, speed: a.speed + (b.speed - a.speed) * t });
  }
  return out;
}
