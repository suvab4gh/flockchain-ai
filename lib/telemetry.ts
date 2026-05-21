/**
 * lib/telemetry.ts
 *
 * Shared telemetry window builder.
 * Generates a 36-point rolling history window suitable for the Python ML server
 * (feature_engineering.py requires at least 36 rows for rolling averages).
 *
 * Imported by:
 *   - app/api/predict/route.ts
 *   - app/api/rl/recommend/route.ts
 *
 * Padding strategy: smooth backward random walk with diurnal correction so
 * the rolling-average features never encounter NaN on a cold start.
 */

import type { SensorData, WeatherData } from './types'

export const TELEMETRY_WINDOW_SIZE = 36

export function generateTelemetryWindow(
  currentSensor: SensorData,
  currentWeather: WeatherData,
  redisHistory: SensorData[],
): object[] {
  const historyItems = [...redisHistory].reverse()

  // Ensure current reading is included at the tail
  if (
    historyItems.length === 0 ||
    historyItems[historyItems.length - 1].timestamp !== currentSensor.timestamp
  ) {
    historyItems.push(currentSensor)
  }

  const baseTime = new Date(currentSensor.timestamp || new Date().toISOString())

  // Pad backwards with a smooth sinusoidal random walk
  while (historyItems.length < TELEMETRY_WINDOW_SIZE) {
    const offsetHours = TELEMETRY_WINDOW_SIZE - historyItems.length
    const pastTime = new Date(baseTime.getTime() - offsetHours * 60 * 60 * 1000)
    const factor = Math.sin(offsetHours * 0.5)
    historyItems.unshift({
      sensor_id: currentSensor.sensor_id,
      nh3:        Math.max(2,   currentSensor.nh3         + factor * 2    + (Math.random() - 0.5) * 1.5),
      co2:        Math.max(400, currentSensor.co2         + factor * 40   + (Math.random() - 0.5) * 30),
      temperature: currentSensor.temperature              + factor * 1.0  + (Math.random() - 0.5) * 0.3,
      humidity:   Math.max(20, Math.min(100,
                    currentSensor.humidity                + factor * 3    + (Math.random() - 0.5) * 1.5)),
      tds:        Math.max(50, currentSensor.tds          + (Math.random() - 0.5) * 5),
      timestamp:  pastTime.toISOString(),
    })
  }

  return historyItems.slice(-TELEMETRY_WINDOW_SIZE).map((item) => {
    const hour = new Date(item.timestamp).getHours()
    // Diurnal temperature swing: peaks at ~14:00, troughs at ~02:00
    const diurnalOffset = Math.sin((hour - 8) * Math.PI / 12) * 3.5
    return {
      timestamp:        item.timestamp,
      nh3:              item.nh3,
      co2:              item.co2,
      temperature:      item.temperature,
      humidity:         item.humidity,
      outdoor_temp:     Number((currentWeather.outdoorTemp     + diurnalOffset).toFixed(1)),
      outdoor_humidity: Math.max(20, Math.min(100,
                          Number((currentWeather.outdoorHumidity - diurnalOffset * 2).toFixed(1)))),
      // H2S estimated from TDS correlation (proxy for litter decomposition gas)
      h2s:              Number((0.1 + item.tds * 0.002 + Math.random() * 0.03).toFixed(3)),
      // Feed / weight / mortality synthetic fillers (replaced by real data when available)
      feed_intake:      Number((120.0 + (Math.random() - 0.5) * 4.0).toFixed(1)),
      weight_gain:      Number((50.0  + (Math.random() - 0.5) * 1.5).toFixed(1)),
      mortality_count:  (item.nh3 > 45 || item.temperature > 33)
                          ? (Math.random() < 0.08 ? 1 : 0)
                          : 0,
    }
  })
}
