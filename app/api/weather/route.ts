import { NextResponse } from 'next/server'
import { fetchWeather } from '@/lib/weather'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const data = await fetchWeather()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Failed to fetch weather:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}
