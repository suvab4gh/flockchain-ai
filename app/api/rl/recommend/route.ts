import { NextResponse } from 'next/server'
import { redisList } from '@/lib/redis'
import { generateTelemetryWindow } from '@/lib/telemetry'
import type { SensorData, WeatherData } from '@/lib/types'

export const dynamic = 'force-dynamic'

// Leave ML_SERVER_URL unset on Vercel unless the Python ML API is hosted separately.
// Without it, this route uses the serverless ICAR-CARI heuristic immediately.
const PYTHON_ML_URL = process.env.ML_SERVER_URL || null
const ML_TIMEOUT_MS = PYTHON_ML_URL ? 5000 : 0

// ── Fallback approximate PPO policy function (ICAR-CARI heuristics) ──────────
function runRLPolicyFallback(
  sensor: SensorData,
  weather: WeatherData,
  healthIndex: number,
  daysSinceDisease: number,
) {
  const nh3Factor  = Math.min(1.0, sensor.nh3 / 50) * 0.4
  const co2Factor  = Math.min(1.0, Math.max(0, sensor.co2 - 400) / 3000) * 0.2
  const tempFactor = sensor.temperature > 28 ? Math.min(0.2, (sensor.temperature - 28) * 0.05) : 0
  const ventilation_level = Math.min(
    1.0,
    Math.round((0.2 + nh3Factor + co2Factor + tempFactor) * 100) / 100,
  )

  let alert_severity = 0
  if (sensor.nh3 > 50 || sensor.co2 > 3200 || healthIndex < 40) {
    alert_severity = 2 // Critical
  } else if (sensor.nh3 > 25 || sensor.co2 > 2000 || healthIndex < 70) {
    alert_severity = 1 // Warning
  }

  const feed_adjustment_flag  = (sensor.temperature > 31 || weather.outdoorTemp > 34) ? 1 : 0
  const water_treatment_flag  = (sensor.tds > 500 || sensor.nh3 > 30) ? 1 : 0

  const recommendations: string[] = []
  if (ventilation_level > 0.6) {
    recommendations.push(
      `Increase exhaust fan speed to ${(ventilation_level * 100).toFixed(0)}% to clear accumulated NH3 (${sensor.nh3} ppm).`,
    )
  } else if (ventilation_level > 0.3) {
    recommendations.push(
      `Maintain moderate ventilation at ${(ventilation_level * 100).toFixed(0)}% for steady air exchange.`,
    )
  } else {
    recommendations.push(
      `Keep ventilation at minimum eco-mode (${(ventilation_level * 100).toFixed(0)}%) to conserve heating.`,
    )
  }

  if (feed_adjustment_flag === 1) {
    recommendations.push(
      'Adjust feed times to cooler early-morning/late-evening hours to reduce metabolic heat stress.',
    )
  }

  if (water_treatment_flag === 1) {
    if (sensor.tds > 500) {
      recommendations.push(
        `Activate inline water chlorination/TDS filters immediately (current TDS: ${sensor.tds} ppm, BIS 10500 limit: 600 ppm).`,
      )
    } else {
      recommendations.push(
        'Add liquid organic acidifier to water lines to enhance flock immunity against respiratory stress.',
      )
    }
  }

  if (alert_severity === 2) {
    recommendations.push(
      '🚨 CRITICAL: Check gas valves, confirm exhaust fan operation, and notify the local veterinarian.',
    )
  }

  return {
    actions: { ventilation_level, alert_severity, feed_adjustment_flag, water_treatment_flag },
    recommendations,
    state: {
      nh3: sensor.nh3, co2: sensor.co2, temp: sensor.temperature,
      humidity: sensor.humidity, tds: sensor.tds,
      outdoorTemp: weather.outdoorTemp, outdoorHumidity: weather.outdoorHumidity,
      rainForecast: weather.rainForecast, healthIndex, daysSinceDisease,
    },
  }
}

export async function POST(req: Request) {
  try {
    const { sensor, weather, healthIndex = 80, daysSinceDisease = 14 } = await req.json()
    if (!sensor || !weather) {
      return NextResponse.json({ error: 'Missing sensor or weather data' }, { status: 400 })
    }

    // ── Primary path: Python ML PPO agent ──────────────────────────────────
    if (PYTHON_ML_URL) {
      try {
        const history = await redisList<SensorData>('sensor_history', 40)
        const telemetryWindow = generateTelemetryWindow(sensor, weather, history)

        const response = await fetch(PYTHON_ML_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ window: telemetryWindow }),
          signal: AbortSignal.timeout(ML_TIMEOUT_MS),
        })

        if (response.ok) {
          const pythonResult = await response.json()
          const recommendedAction = pythonResult.recommended_action

          let ventilation_level = 0.3
          let alert_severity = 0
          let feed_adjustment_flag = 0
          const water_treatment_flag = (sensor.tds > 500 || sensor.nh3 > 30) ? 1 : 0

          const recommendations: string[] = []

          if (recommendedAction === 'fan_high') {
            ventilation_level = 1.0
            recommendations.push(`PPO RL: High ammonia/temperature detected. Main exhaust fans set to 100% (HIGH) for maximum clearance.`)
          } else if (recommendedAction === 'fan_medium') {
            ventilation_level = 0.5
            recommendations.push(`PPO RL: Optimal flow range. Maintaining moderate exhaust fans at 50% for standard gas exchange.`)
          } else if (recommendedAction === 'fan_low') {
            ventilation_level = 0.1
            recommendations.push(`PPO RL: Eco mode active. Exhaust fans at 10% to conserve heat energy inside the shed.`)
          } else if (recommendedAction === 'heater_on') {
            ventilation_level = 0.2
            feed_adjustment_flag = sensor.temperature > 31 ? 1 : 0
            recommendations.push(`PPO RL: Low temperature. Active auxiliary heating turned ON to stabilize thermal comfort.`)
          } else if (recommendedAction === 'heater_off') {
            ventilation_level = 0.2
            recommendations.push(`PPO RL: Temperature stabilized. Auxiliary heating shut OFF to optimize power footprint.`)
          } else if (recommendedAction === 'alert_farmer') {
            alert_severity = 2
            recommendations.push(`🚨 PPO RL CRITICAL ALARM: Significant environmental drift! Immediate operator manual verification required.`)
          }

          if (water_treatment_flag === 1) {
            recommendations.push(
              sensor.tds > 500
                ? `Filter Alert: Heavy sediment (TDS: ${sensor.tds} ppm). Inline filtration active.`
                : `Immune Support: Dosing water lines with organic acidifiers for biological protection.`,
            )
          }

          return NextResponse.json({
            actions: { ventilation_level, alert_severity, feed_adjustment_flag, water_treatment_flag },
            recommendations,
            state: {
              nh3: sensor.nh3, co2: sensor.co2, temp: sensor.temperature,
              humidity: sensor.humidity, tds: sensor.tds,
              outdoorTemp: weather.outdoorTemp, outdoorHumidity: weather.outdoorHumidity,
              rainForecast: weather.rainForecast,
              healthIndex: Math.round(pythonResult.health_score * 100),
              daysSinceDisease,
              python_active: true,
              recommended_action: recommendedAction,
            },
          })
        }
      } catch (e) {
        console.warn('[rl/recommend] Python ML connection failed, using ICAR heuristic fallback:', e)
      }
    }

    // ── Fallback: heuristic PPO policy (ICAR-CARI / DADF guidelines) ────────
    const policyResult = runRLPolicyFallback(sensor, weather, healthIndex, daysSinceDisease)
    return NextResponse.json(policyResult)

  } catch (error) {
    console.error('[rl/recommend] Unhandled error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function GET() {
  try {
    const history = await redisList<SensorData>('sensor_history', 1)
    const sensor = history[0] || {
      sensor_id: 1, nh3: 12, co2: 800, temperature: 24,
      humidity: 60, tds: 320, timestamp: new Date().toISOString(),
    }

    const mockWeather: WeatherData = {
      outdoorTemp: 31, outdoorHumidity: 75,
      weatherCondition: 'Humid', pressure: 1010, windSpeed: 2.8,
      rainForecast: 'Rain expected in next 24 hours', icon: '09d', description: 'light rain',
    }

    const policyResult = runRLPolicyFallback(sensor, mockWeather, 85, 20)
    return NextResponse.json(policyResult)
  } catch (error) {
    console.error('[rl/recommend GET] Unhandled error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
