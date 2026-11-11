export type ModelId = 'DWD_ICON' | 'MET_OFFICE' | 'NOAA_GFS';
export type SpeedUnits = 'kph' | 'mph';
export type AltitudeUnits = 'feet' | 'metres';

export interface Site {
  name: string;
  lat: number;
  lon: number;
  /** takeoff elevation in metres */
  elevation: number;
}

/** Ground-level (10 m) hourly forecast. Speeds in kph. */
export interface GroundHour {
  time: string;
  date: string;
  hour: number;
  windspeed: number | null;
  winddirection: number | null;
  gusts: number | null;
  temperature: number | null;
  weatherCode: number | null;
}

/** One pressure level. Heights in metres AMSL, speeds in kph. */
export interface Level {
  pressure: string;
  height: number | null;
  windspeed: number | null;
  winddirection: number | null;
  temperature: number | null;
  cloudCover: number | null;
}

export interface AltitudeHour {
  time: string;
  date: string;
  hour: number;
  levels: Level[];
}

export interface ModelForecast {
  ground: GroundHour[];
  altitude: AltitudeHour[];
}

export interface Forecast {
  fetchedAt: number;
  models: Record<ModelId, ModelForecast>;
}

export interface Settings {
  site: string;
  model: ModelId;
  altitudeUnits: AltitudeUnits;
  speedUnits: SpeedUnits;
  /** red colour limit, always stored in kph (as in the Shiny app) */
  colourRedKph: number;
  showHighAlt: boolean;
  favourites: string[];
}
