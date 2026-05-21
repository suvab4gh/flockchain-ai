import { NextResponse } from 'next/server'
import { redisList } from '@/lib/redis'
import { fetchWeather } from '@/lib/weather'
import { localRuleBasedPrediction } from '@/lib/prediction'
import { calculatePFSI } from '@/lib/pfsi'
import type { SensorData } from '@/lib/types'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const history = await redisList<SensorData>('sensor_history', 15)
    const currentSensor: SensorData = history[0] || {
      sensor_id: 1,
      nh3: 12.5,
      co2: 780,
      temperature: 24.2,
      humidity: 61,
      tds: 310,
      timestamp: new Date().toISOString(),
    }

    const weather = await fetchWeather()
    const prediction = localRuleBasedPrediction(currentSensor, weather)
    const pfsi = calculatePFSI(currentSensor, weather)

    const mockTxs = history.slice(0, 5).map((h, index) => {
      const mockHash = Array.from({ length: 64 }, (_, idx) =>
        ((h.timestamp.charCodeAt(idx % h.timestamp.length) || 0) + index * 9).toString(16),
      ).join('').slice(0, 64)
      return {
        hash: mockHash,
        timestamp: h.timestamp || new Date().toISOString(),
        ledger: 49581023 + index * 12,
        explorerUrl: `https://stellar.expert/explorer/testnet/tx/${mockHash}`,
      }
    })

    return NextResponse.json({
      success: true,
      farmId: 'FARM-001',
      sensor: currentSensor,
      sensorHistory: history,
      weather,
      prediction,
      pfsi,
      transactions: mockTxs,
    })
  } catch (error) {
    console.error('[dashboard/farmer] error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
