import { NextResponse } from 'next/server'
import { calculatePFSI } from '@/lib/pfsi'
import { redisList } from '@/lib/redis'
import type { SensorData, WeatherData } from '@/lib/types'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const { sensor, weather } = await req.json() as { sensor: SensorData; weather: WeatherData }
    
    if (!sensor || !weather) {
      return NextResponse.json(
        { error: 'Missing sensor or weather data' },
        { status: 400 }
      )
    }

    const result = calculatePFSI(sensor, weather)
    return NextResponse.json(result)
  } catch (error) {
    console.error('Failed to calculate PFSI:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    const history = await redisList<SensorData>('sensor_history', 1)
    const sensor = history[0] || { sensor_id: 1, nh3: 12, co2: 800, temperature: 24, humidity: 60, tds: 320, timestamp: new Date().toISOString() }
    
    const weather: WeatherData = {
      outdoorTemp: 30,
      outdoorHumidity: 70,
      weatherCondition: 'Clear',
      pressure: 1012,
      windSpeed: 3.0,
      rainForecast: 'No rain expected',
      icon: '01d',
      description: 'clear sky'
    }

    const result = calculatePFSI(sensor, weather)
    return NextResponse.json(result)
  } catch (error) {
    console.error('Failed to calculate PFSI via GET:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}
