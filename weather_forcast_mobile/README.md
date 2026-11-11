# Flyable (mobile)

A rewrite of the flyable.uk Shiny app (`../weather_forecast`) in Svelte and TypeScript, packaged for Android with Capacitor.
The phone calls Open-Meteo directly, so no backend is needed.

## Develop

    npm install
    npm run dev        # http://localhost:5173
    npm test           # logic tests (ported from the R code, checked against R output)
    npm run check      # type check

## Android

Needs Android Studio (which includes the Android SDK) and JDK 17 or later.

    npm run android:sync   # build the web app and copy it into android/
    npm run android:open   # open in Android Studio -> Run, or Build > Generate Signed Bundle

App id: `uk.flyable.app`.

### Icons

`assets/mark.svg` is a vector redraw of the cloud mark from the logo. To regenerate every launcher icon, the splash screens,
and `assets/play-store-icon-512.png` from it:

    inkscape "$PWD/assets/mark.svg" --export-type=png --export-filename="$PWD/assets/mark-2048.png" --export-width=2048
    python3 scripts/make-icons.py "$PWD"

## Web

`npm run build` produces a static site in `dist/` that you can host anywhere, for example Firebase Hosting or GitHub Pages.
It reads and writes the same `?_inputs_&uiSitePicker="..."` URL format as the Shiny app, so existing bookmarks still work.
Set `VITE_GA_ID` at build time to turn on Google Analytics. It is enabled for the web build only.

## Map of R -> TS

| R | TS |
|---|----|
| `get_weather.R` (7 requests per site) | `src/api/openMeteo.ts` (1 multi-model request), `src/logic/forecast.ts` |
| RDS cache, 1 h | `src/lib/cache.ts` (IndexedDB, 1 h, stale entries still used offline) |
| `draw_summary_table.R` | `src/components/SummaryList.svelte`, `src/logic/windColour.ts` |
| `draw_wind_alt.R` | `src/components/WindAltChart.svelte` (SVG) |
| `unit_conversion.R`, `wmo_codes.R` | `src/logic/units.ts`, `src/logic/wmoCodes.ts` |
| URL bookmarking | `src/lib/settings.ts` (device storage, plus the URL on the web) |

`get_site_altitudes.R` is not ported because no output in the Shiny app uses it.
