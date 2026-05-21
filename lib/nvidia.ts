/**
 * FlockChain AI — NVIDIA MiniMax M2.7 Prediction Engine
 * -------------------------------------------------------
 * Uses the NVIDIA NIM API (OpenAI-compatible) to analyse poultry
 * shed telemetry and return a structured disease risk prediction.
 *
 * Activated when NVIDIA_API_KEY is set in environment variables.
 * Falls through to the ICAR rule-based engine when unavailable.
 */

import OpenAI from 'openai'
import type { SensorData, WeatherData, AIPrediction } from './types'

// ── Client (singleton, lazy) ────────────────────────────────────────────────
let _client: OpenAI | null = null

function getClient(): OpenAI | null {
  if (!process.env.NVIDIA_API_KEY) return null
  if (!_client) {
    _client = new OpenAI({
      baseURL: 'https://integrate.api.nvidia.com/v1',
      apiKey:  process.env.NVIDIA_API_KEY,
    })
  }
  return _client
}

// ── Prompt builder ───────────────────────────────────────────────────────────
function buildPrompt(sensor: SensorData, weather: WeatherData): string {
  const thi = (1.8 * sensor.temperature + 32) -
    (0.55 - 0.0055 * sensor.humidity) * (1.8 * sensor.temperature - 26.8)

  return `You are FlockChain AI, an expert poultry biosecurity system trained on ICAR-CARI, DADF, and BIS 10500 Indian poultry health standards.

Analyse the following real-time shed telemetry and return a JSON risk assessment.

## Current Shed Readings
- NH₃ (Ammonia):     ${sensor.nh3} ppm   [Safe: < 20 ppm | Danger: > 35 ppm | ICAR-CARI]
- CO₂ (Carbon Dioxide): ${sensor.co2} ppm [Safe: < 3000 ppm | Alert: > 5000 ppm]
- Temperature (Shed): ${sensor.temperature}°C  [Ideal broiler: 24–28°C]
- Relative Humidity:  ${sensor.humidity}%  [Ideal: 50–70%]
- TDS (Water Quality): ${sensor.tds} ppm  [BIS 10500 limit: 600 ppm]
- Temperature-Humidity Index (THI): ${thi.toFixed(1)}

## Outdoor / Weather Conditions
- Outdoor Temp:    ${weather.outdoorTemp}°C
- Outdoor Humidity: ${weather.outdoorHumidity}%
- Condition:       ${weather.weatherCondition}
- Wind Speed:      ${weather.windSpeed} m/s
- Rain Forecast:   ${weather.rainForecast}

## Context
Farm location: India (tropical climate). Flock: Commercial broiler. Applicable standards: ICAR-CARI 2023, DADF biosecurity guidelines, BIS 10500:2012 water quality.

## Response Format
You MUST respond ONLY with valid JSON. No markdown fences, no explanation text. Exactly this schema:

{
  "riskScore": <integer 0-100>,
  "riskCategory": <"Low"|"Medium"|"High"|"Critical">,
  "riskColor": <"green"|"yellow"|"orange"|"red">,
  "diseases": [<string>, ...],
  "predictions": {
    "next12hours": <string, one sentence forecast>,
    "next24hours": <string, one sentence forecast>,
    "next48hours": <string, one sentence forecast>
  },
  "recommendations": [
    {
      "action": <string, specific action>,
      "priority": <"High"|"Medium"|"Low">,
      "description": <string, 1–2 sentences with ICAR/DADF basis>
    }
  ],
  "weatherImpact": <string, one sentence on outdoor weather impact>,
  "summary": <string, 2–3 sentence clinical summary mentioning specific readings>,
  "diseaseRationale": <string, explain which readings triggered disease flags>
}

Rules:
- riskScore must reflect: NH₃ > 35 ppm (+25 pts), THI > 84 (+15 pts), CO₂ > 3000 ppm (+10 pts), TDS > 500 ppm (+5 pts), temp out of 24-28°C range (+10 pts).
- diseases: list specific diseases from ICAR-CARI — e.g. "Newcastle Disease (Risk: NH₃ 28ppm sustained exposure)", "Coccidiosis (wet litter indicator)", "Infectious Bronchitis", "Avian Influenza H5N1 precondition".
- If all readings are within safe range, riskScore must be < 30 and diseases must be ["None detected — optimal biosecurity"].
- recommendations must include actionable fan/heater/water interventions with numeric targets.
- Respond ONLY with JSON.`
}

// ── JSON parser (tolerant) ────────────────────────────────────────────────────
function parseNvidiaResponse(raw: string): AIPrediction | null {
  try {
    // Strip any accidental markdown fences
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const parsed = JSON.parse(cleaned)

    // Validate required fields
    if (
      typeof parsed.riskScore !== 'number' ||
      !parsed.riskCategory ||
      !Array.isArray(parsed.diseases) ||
      !Array.isArray(parsed.recommendations)
    ) {
      console.warn('[NVIDIA] Response missing required fields:', Object.keys(parsed))
      return null
    }

    // Clamp riskScore
    parsed.riskScore = Math.max(0, Math.min(100, Math.round(parsed.riskScore)))

    // Ensure riskColor is consistent with riskCategory
    if (!parsed.riskColor) {
      parsed.riskColor =
        parsed.riskCategory === 'Critical' ? 'red'    :
        parsed.riskCategory === 'High'     ? 'orange' :
        parsed.riskCategory === 'Medium'   ? 'yellow' : 'green'
    }

    // Ensure recommendations have all required fields
    parsed.recommendations = (parsed.recommendations as any[]).map((r: any) => ({
      action:      r.action      || 'Review shed conditions',
      priority:    r.priority    || 'Medium',
      description: r.description || '',
    }))

    // Add source tag to summary
    parsed.summary = `[NVIDIA MiniMax M2.7] ${parsed.summary || ''}`

    return parsed as AIPrediction
  } catch (e) {
    console.error('[NVIDIA] JSON parse failed:', e, '\nRaw:', raw.slice(0, 500))
    return null
  }
}

// ── Main export ───────────────────────────────────────────────────────────────
/**
 * Run NVIDIA MiniMax M2.7 disease risk prediction.
 * Returns null if API key is not set or the call fails (caller handles fallback).
 */
export async function nvidiaPredict(
  sensor: SensorData,
  weather: WeatherData,
  timeoutMs = 12000,
): Promise<AIPrediction | null> {
  const client = getClient()
  if (!client) {
    console.log('[NVIDIA] API key not set — skipping NVIDIA tier.')
    return null
  }

  const prompt = buildPrompt(sensor, weather)

  try {
    const controller = new AbortController()
    const tid = setTimeout(() => controller.abort(), timeoutMs)

    // Non-streaming call for server-side use
    const completion = await client.chat.completions.create(
      {
        model:       'minimaxai/minimax-m2.7',  // MiniMax M2.7 on NVIDIA NIM
        messages:    [{ role: 'user', content: prompt }],
        temperature: 0.2,   // Low temp for deterministic JSON
        top_p:       0.9,
        max_tokens:  2048,  // Enough for full JSON with recommendations
        stream:      false,
      },
      { signal: controller.signal }
    )

    clearTimeout(tid)

    const raw = completion.choices?.[0]?.message?.content || ''
    if (!raw) {
      console.warn('[NVIDIA] Empty response from API')
      return null
    }

    const prediction = parseNvidiaResponse(raw)
    if (prediction) {
      console.log(`[NVIDIA] ✅ Prediction: ${prediction.riskCategory} (${prediction.riskScore}%)`)
    }
    return prediction

  } catch (e: any) {
    if (e?.name === 'AbortError') {
      console.warn(`[NVIDIA] Request timed out after ${timeoutMs}ms`)
    } else {
      console.error('[NVIDIA] API error:', e?.message || e)
    }
    return null
  }
}
