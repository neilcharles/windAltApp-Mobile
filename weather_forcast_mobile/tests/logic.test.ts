import { describe, expect, it } from 'vitest';
import fixture from './fixtures/openmeteo.json';
import { temperatureColour, windColour } from '../src/logic/windColour';
import { spreadLabels } from '../src/logic/labelLayout';
import { clampToDaylight, daylightHours, sunTimesLocal, zoneOffsetMinutes } from '../src/logic/daylight';
import { convert } from '../src/logic/units';
import { parseCsv } from '../src/logic/csv';
import { nearestSites, parseSites } from '../src/logic/sites';
import {
  atLeastWind, chartLevels, findHour, forecastDates, interpolateProfile, parseForecast, stepHour, summaryRows,
  type OpenMeteoResponse,
} from '../src/logic/forecast';
import { forecastUrl } from '../src/api/openMeteo';
import { DEFAULTS, settingsFromQuery, settingsToQuery } from '../src/lib/settings';

describe('windColour matches R get_wind_colour(speed, 25)', () => {
  const expected: [number, string][] = [
    [0, '#ADD8E6'], [5, '#ADD8E6'], [8, '#92DDC3'], [10, '#73E599'],
    [15, '#26F633'], [20, '#55AA00'], [25, '#FF0000'], [30, '#FF0000'],
  ];
  it.each(expected)('%d kph -> %s', (speed, colour) => expect(windColour(speed, 25)).toBe(colour));
});

describe('units match R units_to_selected', () => {
  it('kph -> mph', () => expect(convert(30, 'kph', 'mph')).toBeCloseTo(18.63354, 4));
  it('metres -> feet', () => expect(convert(1000, 'metres', 'feet')).toBe(3280));
  it('null passes through', () => expect(convert(null, 'kph', 'mph')).toBeNull());
});

describe('csv and sites', () => {
  it('handles quotes, commas and blank trailing lines', () => {
    expect(parseCsv('a,b\n"x, ""y""",2\r\n\n')).toEqual([{ a: 'x, "y"', b: '2' }]);
  });
  it('drops excluded sites and sorts', () => {
    const csv = 'takeoff_name,takeoff_lat,takeoff_lon,elevation,exclude\nZed,53,-2,300,\nGone,53,-2,300,TRUE\nAlpha,54,-3,200,\n';
    expect(parseSites(csv).map((s) => s.name)).toEqual(['Alpha', 'Zed']);
  });
  it('finds nearest site', () => {
    const sites = parseSites('takeoff_name,takeoff_lat,takeoff_lon,elevation,exclude\nNear,53.7,-2,300,\nFar,56,-4,300,\n');
    expect(nearestSites(sites, 53.69, -1.98, 1)[0].site.name).toBe('Near');
  });
});

describe('forecast parsing (real Open-Meteo fixture)', () => {
  const f = parseForecast(fixture as unknown as OpenMeteoResponse, 0);

  it('splits all three models', () => {
    for (const m of ['DWD_ICON', 'MET_OFFICE', 'NOAA_GFS'] as const) {
      expect(f.models[m].ground).toHaveLength(168);
      expect(f.models[m].altitude[0].levels).toHaveLength(8);
    }
  });

  it('reads the values Open-Meteo returned', () => {
    const g = f.models.MET_OFFICE.ground[12];
    expect(g.time).toBe('2026-11-10T12:00');
    expect(g.hour).toBe(12);
    expect(g.windspeed).toBe(15.8);
    expect(g.gusts).toBe(32.4);
    expect(g.weatherCode).toBe(3);
    expect(f.models.MET_OFFICE.altitude[12].levels[0]).toMatchObject({ pressure: '1000hPa', height: 99 });
  });

  const site = { lat: 53.69, lon: -1.98 }; // where the fixture was fetched

  it('summary keeps daylight hours only', () => {
    const rows = summaryRows(f.models.DWD_ICON, site);
    expect(rows.every((r) => daylightHours(r.date, site.lat, site.lon).includes(r.hour))).toBe(true);
    // mid-November in the Pennines: roughly 07:00-16:00, so ~10 hours a day, never the old 08-20
    const perDay = new Set(rows.map((r) => r.date)).size;
    expect(rows.length / perDay).toBeGreaterThanOrEqual(9);
    expect(rows.length / perDay).toBeLessThanOrEqual(10);
    expect(rows.some((r) => r.hour >= 18)).toBe(false);
  });

  it('summary drops null wind rows (Met Office returns nulls past its horizon)', () => {
    const m = structuredClone(f.models.MET_OFFICE);
    m.ground[12].windspeed = null;
    expect(summaryRows(m, site).some((r) => r.time === '2026-11-10T12:00')).toBe(false);
  });

  it('chart levels are capped at 1500 m unless high altitude is on', () => {
    const hour = findHour(f.models.DWD_ICON, '2026-11-10', 12);
    const low = chartLevels(hour, false);
    const high = chartLevels(hour, true);
    expect(low.every((l) => (l.height as number) <= 1500 && (l.height as number) >= 1)).toBe(true);
    expect(high.length).toBeGreaterThan(low.length);
    expect(high.map((l) => l.height)).toEqual([...high.map((l) => l.height)].sort((a, b) => a! - b!));
  });

  it('steps through daylight hours across days', () => {
    const dates = forecastDates(f.models.DWD_ICON, site);
    const d0 = daylightHours(dates[0], site.lat, site.lon);
    const d1 = daylightHours(dates[1], site.lat, site.lon);
    expect(stepHour(dates, dates[0], 12, 1, site)).toEqual({ date: dates[0], hour: 13 });
    expect(stepHour(dates, dates[0], d0[d0.length - 1], 1, site)).toEqual({ date: dates[1], hour: d1[0] });
    expect(stepHour(dates, dates[1], d1[0], -1, site)).toEqual({ date: dates[0], hour: d0[d0.length - 1] });
    expect(stepHour(dates, dates[0], d0[0], -1, site)).toBeNull();
  });
});

describe('interpolateProfile', () => {
  it('interpolates linearly between levels', () => {
    const levels = [
      { pressure: 'a', height: 0, windspeed: 10, winddirection: 0, temperature: 0, cloudCover: 0 },
      { pressure: 'b', height: 100, windspeed: 20, winddirection: 0, temperature: 0, cloudCover: 0 },
    ];
    const p = interpolateProfile(levels, 3);
    expect(p).toEqual([{ height: 0, speed: 10 }, { height: 50, speed: 15 }, { height: 100, speed: 20 }]);
  });
});

describe('api url', () => {
  it('requests all models in one call', () => {
    const u = new URL(forecastUrl({ lat: 53.7, lon: -2 }));
    expect(u.searchParams.get('models')).toBe('icon_seamless,ukmo_seamless,gfs_seamless');
    expect(u.searchParams.get('hourly')!.split(',')).toHaveLength(45);
  });
});

describe('Shiny-compatible URL settings', () => {
  it('reads an existing flyable.uk bookmark', () => {
    const s = settingsFromQuery('?_inputs_&uiSitePicker=%22Aberfoyle%22&uiSpeedUnits=%22mph%22&uiColourRed=30&uiShowHighAlt=true&uiForecastModel=%22MET_OFFICE%22', DEFAULTS);
    expect(s).toMatchObject({ site: 'Aberfoyle', speedUnits: 'mph', colourRedKph: 30, showHighAlt: true, model: 'MET_OFFICE' });
  });
  it('ignores junk values', () => {
    const s = settingsFromQuery('?uiForecastModel=%22NOPE%22&uiColourRed=999', DEFAULTS);
    expect(s.model).toBe('DWD_ICON');
    expect(s.colourRedKph).toBe(25);
  });
  it('round-trips', () => {
    const s = { ...DEFAULTS, site: 'Pule Hill', altitudeUnits: 'metres' as const };
    expect(settingsFromQuery(settingsToQuery(s), DEFAULTS)).toMatchObject({ site: 'Pule Hill', altitudeUnits: 'metres' });
  });
});

describe('temperatureColour', () => {
  it('uses darkened stops in light mode, squished at the ends', () => {
    expect(temperatureColour(-10)).toBe('#1D4ED8');
    expect(temperatureColour(8.5)).toBe('#9A6A00');
    expect(temperatureColour(30)).toBe('#C2410C');
  });
  it('every light-mode colour has at least 4.5:1 contrast on white', () => {
    const lum = (hex: string) => {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
        .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    for (let t = -3; t <= 20; t += 0.5) expect(1.05 / (lum(temperatureColour(t)) + 0.05)).toBeGreaterThanOrEqual(4.5);
  });
  it('uses lighter stops in dark mode', () => {
    expect(temperatureColour(-10, 'dark')).toBe('#6EA8FF');
  });
});

describe('spreadLabels', () => {
  it('leaves well-spaced labels alone', () => {
    expect(spreadLabels([0, 50, 100], 20)).toEqual([0, 50, 100]);
  });
  it('spreads a collision symmetrically around the mean', () => {
    expect(spreadLabels([100, 104], 20)).toEqual([92, 112]);
  });
  it('keeps the input order and the minimum gap', () => {
    const out = spreadLabels([300, 310, 100, 305, 320], 20);
    const sorted = [...out].sort((a, b) => a - b);
    sorted.slice(1).forEach((v, i) => expect(v - sorted[i]).toBeGreaterThanOrEqual(20 - 1e-9));
    expect(out[2]).toBe(100);
    expect(out[0]).toBeLessThan(out[1]);
  });
  it('respects bounds', () => {
    const out = spreadLabels([495, 498, 500], 20, 0, 500);
    expect(Math.max(...out)).toBe(500);
    expect(out).toEqual([460, 480, 500]);
  });
});

describe('gusts are never below the base wind', () => {
  it('atLeastWind', () => {
    expect(atLeastWind(2.9, 4.1)).toBe(4.1);
    expect(atLeastWind(13, 9.7)).toBe(13);
    expect(atLeastWind(null, 4)).toBeNull();
    expect(atLeastWind(5, null)).toBe(5);
  });
  it('parseForecast applies it (GFS at Waystone Edge, 2026-11-11 17:00)', () => {
    const json = { hourly: { time: ['2026-11-11T17:00'], wind_speed_10m_gfs_seamless: [4.1], wind_gusts_10m_gfs_seamless: [2.9] } };
    const g = parseForecast(json as unknown as OpenMeteoResponse).models.NOAA_GFS.ground[0];
    expect(g.windspeed).toBe(4.1);
    expect(g.gusts).toBe(4.1);
  });
});

describe('daylight', () => {
  const london = { lat: 51.5074, lon: -0.1278 };
  const hm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(Math.round(m % 60)).padStart(2, '0')}`;

  it.each([
    // published London times (they shift by under a minute between years)
    ['2026-06-21', '04:43', '21:21'],
    ['2026-12-21', '08:04', '15:53'],
    ['2026-03-20', '06:03', '18:14'],
  ])('London sun times on %s match published %s / %s within 3 min', (date, rise, set) => {
    const t = sunTimesLocal(date, london.lat, london.lon)!;
    const toMin = (s: string) => +s.slice(0, 2) * 60 + +s.slice(3);
    expect(Math.abs(t.sunrise - toMin(rise)), `sunrise ${hm(t.sunrise)}`).toBeLessThanOrEqual(3);
    expect(Math.abs(t.sunset - toMin(set)), `sunset ${hm(t.sunset)}`).toBeLessThanOrEqual(3);
  });

  it('knows GMT from BST', () => {
    expect(zoneOffsetMinutes(Date.UTC(2026, 0, 15, 12))).toBe(0);
    expect(zoneOffsetMinutes(Date.UTC(2026, 6, 15, 12))).toBe(60);
  });

  it('pads 30 minutes either side', () => {
    // Dec: 08:04-15:53 -> 07:34-16:23 -> 08:00..16:00
    expect(daylightHours('2026-12-21', london.lat, london.lon)).toEqual([8, 9, 10, 11, 12, 13, 14, 15, 16]);
    // Jun: 04:43-21:21 -> 04:13-21:51 -> 05:00..21:00
    const jun = daylightHours('2026-06-21', london.lat, london.lon);
    expect([jun[0], jun[jun.length - 1]]).toEqual([5, 21]);
  });

  it('northern Scotland gets longer summer days than London', () => {
    const shetland = daylightHours('2026-06-21', 60.15, -1.15);
    expect(shetland.length).toBeGreaterThan(daylightHours('2026-06-21', london.lat, london.lon).length);
  });

  it('clamps a selected hour into daylight', () => {
    expect(clampToDaylight([8, 9, 10, 15, 16], 18)).toBe(16);
    expect(clampToDaylight([8, 9, 10], 6)).toBe(8);
    expect(clampToDaylight([8, 9, 10], 9)).toBe(9);
  });
});
