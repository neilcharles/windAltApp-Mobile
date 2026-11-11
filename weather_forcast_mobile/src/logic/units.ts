// Port of R/unit_conversion.R (same factors, so numbers match the Shiny app)
import type { AltitudeUnits, SpeedUnits } from '../types';

type Units = SpeedUnits | AltitudeUnits;

export function convert(value: number, from: Units, to: Units): number;
export function convert(value: number | null, from: Units, to: Units): number | null;
export function convert(value: number | null, from: Units, to: Units): number | null {
  if (value === null || from === to) return value;
  if (from === 'kph' && to === 'mph') return value / 1.61;
  if (from === 'mph' && to === 'kph') return value * 1.61;
  if (from === 'feet' && to === 'metres') return value / 3.28;
  if (from === 'metres' && to === 'feet') return value * 3.28;
  throw new Error(`Cannot convert ${from} to ${to}`);
}

export function speed(kph: number, units: SpeedUnits): number;
export function speed(kph: number | null, units: SpeedUnits): number | null;
export function speed(kph: number | null, units: SpeedUnits) { return convert(kph, 'kph', units); }

export function altitude(metres: number, units: AltitudeUnits): number;
export function altitude(metres: number | null, units: AltitudeUnits): number | null;
export function altitude(metres: number | null, units: AltitudeUnits) { return convert(metres, 'metres', units); }
