import { NextResponse } from 'next/server'
import { redisPush } from '@/lib/redis'
import type { SensorData } from '@/lib/types'

export async function POST(req: Request) {
  try {
    const data: SensorData = await req.json()
    // Enrich with a timestamp if not present
    if (!data.timestamp) {
      data.timestamp = new Date().toISOString()
    }
    
    // Save to rolling historical list in Redis
    await redisPush('sensor_history', data, 50)
    
    return NextResponse.json({ success: true, logged: data.timestamp })
  } catch (error) {
    console.error('Failed to log sensor data:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}
