// Port of R/wmo_codes.R (day icons only - the app shows 08:00-20:00)
const codes: Record<number, [string, string]> = {
  0: ['Sunny', '01d'], 1: ['Mainly Sunny', '01d'], 2: ['Partly Cloudy', '02d'], 3: ['Cloudy', '03d'],
  45: ['Foggy', '50d'], 48: ['Rime Fog', '50d'],
  51: ['Light Drizzle', '09d'], 53: ['Drizzle', '09d'], 55: ['Heavy Drizzle', '09d'],
  56: ['Light Freezing Drizzle', '09d'], 57: ['Freezing Drizzle', '09d'],
  61: ['Light Rain', '10d'], 63: ['Rain', '10d'], 65: ['Heavy Rain', '10d'],
  66: ['Light Freezing Rain', '10d'], 67: ['Freezing Rain', '10d'],
  71: ['Light Snow', '13d'], 73: ['Snow', '13d'], 75: ['Heavy Snow', '13d'], 77: ['Snow Grains', '13d'],
  80: ['Light Showers', '09d'], 81: ['Showers', '09d'], 82: ['Heavy Showers', '09d'],
  85: ['Light Snow Showers', '13d'], 86: ['Snow Showers', '13d'],
  95: ['Thunderstorm', '11d'], 96: ['Light Thunderstorms With Hail', '11d'], 99: ['Thunderstorm With Hail', '11d'],
};

export function weatherIcon(code: number | null): { description: string; src: string } | null {
  if (code === null || !(code in codes)) return null;
  const [description, icon] = codes[code];
  return { description, src: `./icons/${icon}@2x.png` };
}
