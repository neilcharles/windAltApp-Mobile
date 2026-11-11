// Settings persist on the device. On the web build they are also mirrored to the
// URL in the same format Shiny bookmarking used (?_inputs_&uiSitePicker="X"...),
// so existing flyable.uk bookmarks keep working.
import type { ModelId, Settings } from '../types';

const STORAGE_KEY = 'flyable.settings';

export const DEFAULTS: Settings = {
  site: '',
  model: 'DWD_ICON',
  altitudeUnits: 'feet',
  speedUnits: 'kph',
  colourRedKph: 25,
  showHighAlt: false,
  favourites: [],
};

const MODEL_IDS: ModelId[] = ['DWD_ICON', 'MET_OFFICE', 'NOAA_GFS'];

/** Map Shiny input ids to settings, with validation. */
const URL_KEYS: { input: string; apply: (s: Settings, v: unknown) => void; read: (s: Settings) => unknown }[] = [
  { input: 'uiSitePicker', apply: (s, v) => { if (typeof v === 'string') s.site = v; }, read: (s) => s.site },
  { input: 'uiForecastModel', apply: (s, v) => { if (MODEL_IDS.includes(v as ModelId)) s.model = v as ModelId; }, read: (s) => s.model },
  { input: 'uiAltitudeUnits', apply: (s, v) => { if (v === 'feet' || v === 'metres') s.altitudeUnits = v; }, read: (s) => s.altitudeUnits },
  { input: 'uiSpeedUnits', apply: (s, v) => { if (v === 'kph' || v === 'mph') s.speedUnits = v; }, read: (s) => s.speedUnits },
  { input: 'uiColourRed', apply: (s, v) => { const n = Number(v); if (n >= 15 && n <= 40) s.colourRedKph = n; }, read: (s) => s.colourRedKph },
  { input: 'uiShowHighAlt', apply: (s, v) => { if (typeof v === 'boolean') s.showHighAlt = v; }, read: (s) => s.showHighAlt },
];

export function settingsFromQuery(search: string, base: Settings): Settings {
  const s = { ...base, favourites: [...base.favourites] };
  const params = new URLSearchParams(search);
  for (const k of URL_KEYS) {
    const raw = params.get(k.input);
    if (raw === null) continue;
    let value: unknown = raw;
    try { value = JSON.parse(raw); } catch { /* plain string */ }
    k.apply(s, value);
  }
  return s;
}

export function settingsToQuery(s: Settings): string {
  const parts = URL_KEYS.map((k) => `${k.input}=${encodeURIComponent(JSON.stringify(k.read(s)))}`);
  return `?_inputs_&${parts.join('&')}`;
}

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return { ...DEFAULTS };
}

export function saveSettings(s: Settings) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch { /* ignore */ }
}
