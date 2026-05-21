'use client'
import type { SensorData } from './types'
import { DEMO_SCENARIOS } from './types'
export type MQTTStatus = 'connecting' | 'connected' | 'demo' | 'error'
export interface MQTTCallbacks { onData: (data: SensorData) => void; onStatus: (status: MQTTStatus) => void }
let demoTimer: ReturnType<typeof setInterval> | null = null
let demoIdx = 0
export function startDemoMode(cb: MQTTCallbacks) {
  cb.onStatus('demo'); demoIdx = 0
  const tick = () => {
    const s = { ...DEMO_SCENARIOS[demoIdx % DEMO_SCENARIOS.length] }
    s.nh3 = +(s.nh3 + (Math.random()-0.5)*2).toFixed(1); s.co2 = Math.round(s.co2 + (Math.random()-0.5)*50)
    s.temperature = +(s.temperature + (Math.random()-0.5)*0.5).toFixed(1); s.humidity = +(s.humidity + (Math.random()-0.5)*2).toFixed(1)
    s.tds = Math.round(s.tds + (Math.random()-0.5)*20); s.timestamp = new Date().toISOString()
    cb.onData(s); demoIdx++
  }
  tick(); demoTimer = setInterval(tick, 10000)
}
export async function connectMQTT(cb: MQTTCallbacks): Promise<() => void> {
  const host = process.env.NEXT_PUBLIC_HIVEMQ_HOST, port = process.env.NEXT_PUBLIC_HIVEMQ_PORT || '8884'
  const username = process.env.NEXT_PUBLIC_HIVEMQ_USERNAME, password = process.env.NEXT_PUBLIC_HIVEMQ_PASSWORD
  if (!host || !username || !password) { startDemoMode(cb); return () => { if(demoTimer) clearInterval(demoTimer) } }
  cb.onStatus('connecting')
  try {
    const mqtt = await import('mqtt')
    const client = mqtt.connect(`wss://${host}:${port}/mqtt`, { username, password, protocol: 'wss', reconnectPeriod: 5000 })
    client.on('connect', () => { cb.onStatus('connected'); client.subscribe('sensors/all') })
    client.on('message', (_: string, msg: Buffer) => { try { const d = JSON.parse(msg.toString()) as SensorData; d.timestamp = d.timestamp || new Date().toISOString(); cb.onData(d) } catch {} })
    client.on('error', () => { cb.onStatus('demo'); startDemoMode(cb) })
    return () => { client.end(); if(demoTimer) clearInterval(demoTimer) }
  } catch { startDemoMode(cb); return () => { if(demoTimer) clearInterval(demoTimer) } }
}
