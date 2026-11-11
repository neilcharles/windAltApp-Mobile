// Port of get_wind_colour() in R/draw_summary_table.R, which mirrors the
// ggplot scale_colour_gradientn(values = c(0, .25, .7, 1)) used on the chart.

const LIGHTBLUE = [0xad, 0xd8, 0xe6];
const GREEN = [0x00, 0xff, 0x00];
const RED = [0xff, 0x00, 0x00];

// R's rgb(..., maxColorValue = 255) truncates channels; the epsilon guards float error.
const hex = (rgb: number[]) =>
  '#' + rgb.map((c) => Math.floor(c + 1e-9).toString(16).padStart(2, '0')).join('').toUpperCase();

/** Same as R's colorRampPalette(c(a, b))(100)[round(ratio * 99) + 1] */
function ramp(a: number[], b: number[], ratio: number) {
  const t = Math.round(ratio * 99) / 99;
  return hex(a.map((c, i) => c + (b[i] - c) * t));
}

export function windColour(speed: number, maxSpeed: number): string {
  const normalized = Math.min(speed / maxSpeed, 1);
  if (normalized <= 0.25) return hex(LIGHTBLUE);
  if (normalized <= 0.7) return ramp(LIGHTBLUE, GREEN, (normalized - 0.25) / (0.7 - 0.25));
  return ramp(GREEN, RED, (normalized - 0.7) / (1 - 0.7));
}

/**
 * Temperature colour: blue -> amber -> orange over -3..20 °C, squished (the ggplot chart's scale).
 * The light stops are darkened so text reads on white (each stop is at least 4.5:1 on #fff);
 * the dark stops are lightened for the dark background.
 */
export function temperatureColour(t: number, theme: 'light' | 'dark' = 'light'): string {
  const [blue, yellow, orange] = theme === 'light'
    ? [[29, 78, 216], [154, 106, 0], [194, 65, 12]] // #1D4ED8, #9A6A00, #C2410C
    : [[110, 168, 255], [255, 225, 77], [255, 169, 77]];
  const n = Math.max(0, Math.min(1, (t + 3) / 23));
  if (n <= 0.5) return ramp(blue, yellow, n / 0.5);
  return ramp(yellow, orange, (n - 0.5) / 0.5);
}
