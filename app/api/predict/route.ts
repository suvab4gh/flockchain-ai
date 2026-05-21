import { NextResponse } from 'next/server'
import { localRuleBasedPrediction } from '@/lib/prediction'
import { redisList } from '@/lib/redis'
import { generateTelemetryWindow } from '@/lib/telemetry'
import { MPP_ENABLED, mppPaymentRequired, verifyMppPayment } from '@/lib/mpp'
import { nvidiaPredict } from '@/lib/nvidia'
import type { SensorData, WeatherData, AIPrediction } from '@/lib/types'

export const dynamic = 'force-dynamic'

// ── Prediction tier configuration ─────────────────────────────────────────────
// Tier 1: Python ML server (XGBoost + LSTM + PPO RL)
//         Set ML_SERVER_URL in .env.local for local dev or Colab+ngrok
//         Leave UNSET on Vercel to skip with zero latency penalty
const PYTHON_ML_URL  = process.env.ML_SERVER_URL || null
const ML_TIMEOUT_MS  = PYTHON_ML_URL ? 5000 : 0

// Tier 2: NVIDIA NIM (MiniMax M2.7) — LLM-based biosecurity analysis
//         Set NVIDIA_API_KEY in Vercel env vars to activate
//         Falls through to Tier 3 if key missing or API errors

// Tier 3: ICAR-CARI / DADF / BIS 10500 rule-based engine (zero dependencies)
//         Always available — serverless fallback

export async function POST(req: Request) {
  try {
    // ── MPP Agentic Payment Gate ───────────────────────────────────────────────
    if (MPP_ENABLED) {
      const mppCheck = await verifyMppPayment(req)
      if (!mppCheck.valid) {
        return mppPaymentRequired()
      }
    }

    const { sensor, weather } = await req.json() as { sensor: SensorData; weather: WeatherData }

    if (!sensor || !weather) {
      return NextResponse.json({ error: 'Missing sensor or weather data' }, { status: 400 })
    }

    // ── Tier 1: Python ML server (XGBoost + LSTM + PPO) ─────────────────────
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
          const py = await response.json()
          const healthPct = py.health_score * 100
          const riskScore = Math.round(100 - healthPct)

          const diseases: string[] = []
          if (py.anomaly.is_anomaly)    diseases.push('Statistical Anomaly (Isolation Forest)')
          if (sensor.nh3 > 35)          diseases.push('Chronic Ammonia Exposure (ICAR-CARI)')
          if (sensor.nh3 > 50)          diseases.push('Ammonia Toxicity — Acute (DADF)')
          if (sensor.temperature > 32)  diseases.push('Thermal Stress')
          if (diseases.length === 0)    diseases.push('None detected')

          const recommendations: AIPrediction['recommendations'] = [
            {
              action:
                py.recommended_action === 'fan_high'   ? 'Exhaust Fans: HIGH (100%)' :
                py.recommended_action === 'fan_medium' ? 'Exhaust Fans: MEDIUM (50%)' :
                py.recommended_action === 'fan_low'    ? 'Exhaust Fans: ECO MODE (10%)' :
                py.recommended_action === 'heater_on'  ? 'Auxiliary Heater: ON' :
                py.recommended_action === 'heater_off' ? 'Auxiliary Heater: OFF' :
                'Critical Alert: Manual Inspection',
              priority: (py.risk_class === 'critical' || py.risk_class === 'high') ? 'High' : 'Medium',
              description: `PPO RL agent decision: ${py.recommended_action}. Health score: ${healthPct.toFixed(0)}%.`,
            },
          ]

          if (sensor.nh3 > 20) {
            recommendations.push({
              action: 'Flush Air Ventilation',
              priority: 'High',
              description: `NH3 reached ${sensor.nh3} ppm. Increase ventilation immediately per ICAR-CARI guidelines (target < 20 ppm).`,
            })
          }
          if (sensor.tds > 500) {
            recommendations.push({
              action: 'Flush Water Filters',
              priority: 'High',
              description: `TDS is high at ${sensor.tds} ppm (BIS 10500 limit: 600 ppm). Check bio-filter and chlorination systems.`,
            })
          } else {
            recommendations.push({
              action: 'Eco Operations',
              priority: 'Low',
              description: 'Systems optimal. Maintain standard ICAR environmental baselines.',
            })
          }

          const thi = (1.8 * sensor.temperature + 32) - (0.55 - 0.0055 * sensor.humidity) * (1.8 * sensor.temperature - 26.8)

          const prediction: AIPrediction = {
            riskScore,
            riskCategory:
              py.risk_class === 'critical' ? 'Critical' :
              py.risk_class === 'high'     ? 'High' :
              py.risk_class === 'medium'   ? 'Medium' : 'Low',
            riskColor:
              py.risk_class === 'critical' ? 'red' :
              py.risk_class === 'high'     ? 'orange' :
              py.risk_class === 'medium'   ? 'yellow' : 'green',
            diseases,
            predictions: {
              next12hours: `Health forecast +6h: ${(py.forecast_6h * 100).toFixed(0)}%`,
              next24hours: `Health forecast +12h: ${(py.forecast_12h * 100).toFixed(0)}%`,
              next48hours: `Health forecast +24h: ${(py.forecast_24h * 100).toFixed(0)}%`,
            },
            recommendations,
            weatherImpact: `THI: ${thi.toFixed(1)}. Outdoor-indoor delta: ${(sensor.temperature - weather.outdoorTemp).toFixed(1)}°C. LSTM 24h forecast: ${(py.forecast_24h * 100).toFixed(0)}%.`,
            summary: `[Tier 1 — XGBoost+LSTM+PPO] Health: ${healthPct.toFixed(0)}%. Isolation Forest: ${py.anomaly.severity.toUpperCase()} (score: ${py.anomaly.anomaly_score}). ICAR-CARI/DADF thresholds applied.`,
          }

          return NextResponse.json({ prediction, engine: 'python-ml' })
        }
      } catch (e) {
        console.warn('[predict] Tier 1 (Python ML) offline →', (e as Error).message)
      }
    }

    // ── Tier 2: NVIDIA NIM (MiniMax M2.7) LLM analysis ───────────────────────
    // Activated when NVIDIA_API_KEY is set.
    // Sends structured sensor readings + ICAR-CARI context to MiniMax M2.7.
    // Returns rich JSON including disease names, rationale, and recommendations.
    if (process.env.NVIDIA_API_KEY) {
      try {
        const nvidiaPrediction = await nvidiaPredict(sensor, weather, 12000)
        if (nvidiaPrediction) {
          return NextResponse.json({ prediction: nvidiaPrediction, engine: 'nvidia-minimax' })
        }
      } catch (e) {
        console.warn('[predict] Tier 2 (NVIDIA) failed →', (e as Error).message)
      }
    }

    // ── Tier 3: ICAR-CARI / DADF / BIS 10500 rule-based engine ───────────────
    // Zero external API calls. Always available serverlessly on Vercel.
    console.log('[predict] Using Tier 3 — ICAR rule engine')
    const prediction = localRuleBasedPrediction(sensor, weather)
    return NextResponse.json({ prediction, engine: 'icar-rules' })

  } catch (error) {
    console.error('[predict] Unhandled error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
