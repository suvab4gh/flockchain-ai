/**
 * lib/prediction.ts
 *
 * Local heuristic prediction engine -- replaces Claude AI entirely.
 *
 * Prediction priority chain:
 *   1. Python ML Server (XGBoost + LSTM + PPO) at http://127.0.0.1:8000/predict
 *   2. This rule-based fallback derived from:
 *        - Government of India DADF poultry disease thresholds
 *        - ICAR-CARI poultry management standards
 *        - BIS 10500 drinking water quality standards
 *        - Open-Meteo / IMD weather correlation rules for Indian climate
 *        - Regional disease surveillance data (tropical breeds)
 *
 * No external AI API calls. No ANTHROPIC_API_KEY required.
 */

import type { SensorData, WeatherData, AIPrediction } from './types'

// Thresholds -- ICAR-CARI / DADF India guidelines
const NH3_WARN      = 20    // ppm chronic exposure limit
const NH3_HIGH      = 35    // ppm acute respiratory irritation
const NH3_CRIT      = 50    // ppm acute toxicity
const CO2_WARN      = 2000  // ppm comfort ceiling
const CO2_HIGH      = 3000  // ppm immune suppression
const TEMP_LOW      = 18    // degC cold stress onset (tropical breeds)
const TEMP_HIGH     = 30    // degC heat stress onset (India summer)
const HUMIDITY_HIGH = 80    // % fungal / mycoplasma risk
const TDS_WARN      = 400   // ppm BIS 10500 concern level
const TDS_HIGH      = 600   // ppm BIS 10500 rejection threshold

/** Temperature Humidity Index (tropical poultry research benchmark) */
function calcTHI(tempC: number, rh: number): number {
  return (1.8 * tempC + 32) - (0.55 - 0.0055 * rh) * (1.8 * tempC - 26.8)
}

function detectRegionalDiseaseRisks(
  sensor: SensorData,
  weather: WeatherData,
  thi: number,
): string[] {
  const risks: string[] = []

  // Ammonia chain
  if (sensor.nh3 > NH3_CRIT)        risks.push('Ammonia Toxicity (acute)')
  else if (sensor.nh3 > NH3_HIGH)   risks.push('Chronic Ammonia Exposure')
  else if (sensor.nh3 > NH3_WARN)   risks.push('Respiratory Mucosal Irritation')

  // CO2 chain
  if (sensor.co2 > CO2_HIGH)        risks.push('Hypercapnia / Immune Suppression')
  else if (sensor.co2 > CO2_WARN)   risks.push('Elevated CO2 -- Ventilation Needed')

  // Heat stress (common India: March-June)
  if (thi > 84)       risks.push('Critical Heat Stress (THI > 84)')
  else if (thi > 79)  risks.push('Severe Heat Stress (THI 79-84)')
  else if (thi > 72)  risks.push('Mild Heat Stress (THI 72-79)')

  // Humidity-driven fungal / bacterial risks
  if (sensor.humidity > HUMIDITY_HIGH && sensor.temperature > 26)
    risks.push('Mycoplasma / Aspergillosis Risk (hot+humid)')

  // Cold stress (north India / hill regions)
  if (sensor.temperature < TEMP_LOW)
    risks.push('Cold Stress -- Chick Mortality Risk')

  // Water quality
  if (sensor.tds > TDS_HIGH)        risks.push('Contaminated Water (TDS > 600 ppm, BIS 10500)')
  else if (sensor.tds > TDS_WARN)   risks.push('Elevated TDS -- Water Quality Alert')

  // Monsoon litter moisture => coccidiosis (India-specific)
  if (weather.rainForecast.toLowerCase().includes('rain') && sensor.humidity > 75)
    risks.push('Coccidiosis Risk (rain + litter moisture)')

  // Extreme outdoor heat => viral susceptibility
  if (weather.outdoorTemp > 38)
    risks.push('Viral Stress Susceptibility (extreme outdoor heat)')

  return risks.length > 0 ? risks : ['No significant risks detected']
}

function buildRecommendations(
  sensor: SensorData,
  weather: WeatherData,
  thi: number,
  risks: string[],
): AIPrediction['recommendations'] {
  const recs: AIPrediction['recommendations'] = []

  if (sensor.nh3 > NH3_HIGH || sensor.co2 > CO2_HIGH) {
    recs.push({
      action: 'Emergency Ventilation',
      priority: 'High',
      description: `NH3 at ${sensor.nh3} ppm / CO2 at ${sensor.co2} ppm. Activate all exhaust fans immediately. Target NH3 < 20 ppm per ICAR-CARI guidelines.`,
    })
  } else if (sensor.nh3 > NH3_WARN || sensor.co2 > CO2_WARN) {
    recs.push({
      action: 'Increase Ventilation Rate',
      priority: 'Medium',
      description: `Gas levels elevated (NH3: ${sensor.nh3} ppm, CO2: ${sensor.co2} ppm). Increase fan duty cycle by 20-30% and check litter moisture.`,
    })
  }

  if (thi > 79) {
    recs.push({
      action: 'Heat Stress Intervention',
      priority: 'High',
      description: `THI is ${thi.toFixed(1)} -- severe stress zone. Install evaporative coolers, reduce stocking density 10%, shift feeding to 05:00-07:00 and 18:00-20:00 hrs.`,
    })
  } else if (thi > 72) {
    recs.push({
      action: 'Heat Management Protocol',
      priority: 'Medium',
      description: `THI is ${thi.toFixed(1)}. Provide chilled water with electrolytes (Vitamin C + NaHCO3). Increase ventilation.`,
    })
  }

  if (sensor.tds > TDS_HIGH) {
    recs.push({
      action: 'Water Line Treatment -- Immediate',
      priority: 'High',
      description: `TDS is ${sensor.tds} ppm -- exceeds BIS 10500 limit (600 ppm). Flush lines and activate inline RO/chlorination. Test for coliforms.`,
    })
  } else if (sensor.tds > TDS_WARN) {
    recs.push({
      action: 'Monitor Water Quality',
      priority: 'Medium',
      description: `TDS at ${sensor.tds} ppm approaching BIS threshold. Add organic acidifier to water lines. Retest in 24 hours.`,
    })
  }

  if (risks.some(r => r.includes('Coccidiosis'))) {
    recs.push({
      action: 'Litter Management -- Monsoon Protocol',
      priority: 'High',
      description: 'Rain detected + high humidity. Stir and aerate litter, add hydrated lime at 1 kg/10 sqm. Review coccidiostat dosing in feed per ICAR guidelines.',
    })
  }

  if (recs.length < 2) {
    recs.push({
      action: 'Routine Biosecurity Check',
      priority: 'Low',
      description: 'Conditions within normal range. Maintain ICAR-standard litter depth (5-8 cm), footbath hygiene, and scheduled vaccination schedule.',
    })
  }

  recs.push({
    action: 'Feed Timing Optimisation',
    priority: sensor.temperature > TEMP_HIGH ? 'Medium' : 'Low',
    description: sensor.temperature > TEMP_HIGH
      ? `High indoor temp (${sensor.temperature}C). Restrict feeding during peak heat (11:00-15:00). Offer high-energy feed at dawn and dusk.`
      : `Maintain standard feed schedule. Indoor temp (${sensor.temperature}C) within acceptable range.`,
  })

  return recs
}

/**
 * Primary local prediction function.
 * Called when the Python ML server is offline.
 * Implements ICAR-CARI / DADF India disease risk thresholds.
 */
export function localRuleBasedPrediction(
  sensor: SensorData,
  weather: WeatherData,
): AIPrediction {
  let score = 15  // conservative baseline
  const thi = calcTHI(sensor.temperature, sensor.humidity)

  if (sensor.nh3 > NH3_CRIT)       score += 40
  else if (sensor.nh3 > NH3_HIGH)  score += 28
  else if (sensor.nh3 > NH3_WARN)  score += 14

  if (sensor.co2 > CO2_HIGH)       score += 20
  else if (sensor.co2 > CO2_WARN)  score += 10

  if (thi > 84)       score += 22
  else if (thi > 79)  score += 14
  else if (thi > 72)  score +=  6

  if (sensor.humidity > HUMIDITY_HIGH) score += 8
  if (sensor.temperature < TEMP_LOW)   score += 10
  if (sensor.tds > TDS_HIGH)           score += 12
  else if (sensor.tds > TDS_WARN)      score +=  5

  if (weather.outdoorTemp > 38)        score += 5
  if (weather.rainForecast.toLowerCase().includes('rain') && sensor.humidity > 75) score += 6

  score = Math.min(100, score)

  const riskCategory: AIPrediction['riskCategory'] =
    score >= 75 ? 'Critical' : score >= 50 ? 'High' : score >= 30 ? 'Medium' : 'Low'
  const riskColor: AIPrediction['riskColor'] =
    score >= 75 ? 'red' : score >= 50 ? 'orange' : score >= 30 ? 'yellow' : 'green'

  const risks = detectRegionalDiseaseRisks(sensor, weather, thi)
  const recommendations = buildRecommendations(sensor, weather, thi, risks)
  const thiLevel = thi > 84 ? 'CRITICAL' : thi > 79 ? 'SEVERE' : thi > 72 ? 'MILD' : 'NORMAL'
  const tempDelta = (sensor.temperature - weather.outdoorTemp).toFixed(1)

  return {
    riskScore: score,
    riskCategory,
    riskColor,
    diseases: risks,
    predictions: {
      next12hours: score > 50
        ? 'Deterioration likely without immediate intervention'
        : 'Stable if current conditions maintained',
      next24hours: score > 50
        ? 'High-risk window -- escalation possible'
        : 'Monitor; no immediate concern',
      next48hours: weather.rainForecast.toLowerCase().includes('rain')
        ? 'Humidity spike expected -- monitor for litter moisture and coccidiosis'
        : score > 30
          ? 'Conditions may stabilise with corrective action'
          : 'Low risk maintained',
    },
    recommendations,
    weatherImpact: `THI: ${thi.toFixed(1)} (${thiLevel}). Indoor-outdoor delta: ${tempDelta}C. Outdoor: ${weather.outdoorTemp}C / ${weather.outdoorHumidity}% RH. ${weather.rainForecast}. Wind: ${weather.windSpeed} m/s.`,
    summary: `Local engine (ICAR-CARI/DADF thresholds): Risk ${riskCategory} (score ${score}/100). ${
      risks[0] !== 'No significant risks detected'
        ? `Primary concern: ${risks[0]}.`
        : 'All key parameters within recommended range.'
    }`,
  }
}

/** Legacy alias -- existing imports of fallbackPrediction resolve here */
export { localRuleBasedPrediction as fallbackPrediction }
