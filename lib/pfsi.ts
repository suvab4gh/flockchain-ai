import type { SensorData, WeatherData, PFSIResult } from './types'
import pfsiConfig from '@/data/pfsi_config.json'

export function calculatePFSI(sensor: SensorData, weather: WeatherData): PFSIResult {
  const nh3Score = Math.max(0, 100 - (sensor.nh3 / 50) * 100)
  const co2Score = Math.max(0, 100 - ((sensor.co2 - 400) / 2600) * 100)
  const airQuality = (nh3Score + co2Score) / 2
  const waterQuality = sensor.tds <= 500 ? Math.max(0, 100 - (sensor.tds / 500) * 30) : Math.max(0, 70 - ((sensor.tds - 500) / 500) * 70)
  const temperature = Math.max(0, 100 - Math.abs(sensor.temperature - 23) * 10)
  const humidity = Math.max(0, 100 - Math.abs(sensor.humidity - 60) * 2)
  const weatherAdaptation = Math.min(100, Math.max(0, 100 - Math.abs(sensor.temperature - weather.outdoorTemp) * 5))
  
  const w_air = pfsiConfig.w_airQuality !== undefined ? pfsiConfig.w_airQuality : 0.30
  const w_water = pfsiConfig.w_waterQuality !== undefined ? pfsiConfig.w_waterQuality : 0.20
  const w_temp = pfsiConfig.w_temperature !== undefined ? pfsiConfig.w_temperature : 0.15
  const w_humid = pfsiConfig.w_humidity !== undefined ? pfsiConfig.w_humidity : 0.15
  const w_adapt = pfsiConfig.w_weatherAdaptation !== undefined ? pfsiConfig.w_weatherAdaptation : 0.20

  const score = Math.round((airQuality * w_air + waterQuality * w_water + temperature * w_temp + humidity * w_humid + weatherAdaptation * w_adapt) * 10) / 10
  const { label, color, emoji } = score >= 86 ? { label:'Excellent',color:'blue',emoji:'🔵' } : score >= 66 ? { label:'Good',color:'green',emoji:'🟢' } : score >= 41 ? { label:'Moderate',color:'yellow',emoji:'🟡' } : { label:'Poor',color:'red',emoji:'🔴' }
  return { score, label, color, emoji, breakdown: { airQuality: Math.round(airQuality*10)/10, waterQuality: Math.round(waterQuality*10)/10, temperature: Math.round(temperature*10)/10, humidity: Math.round(humidity*10)/10, weatherAdaptation: Math.round(weatherAdaptation*10)/10 } }
}
