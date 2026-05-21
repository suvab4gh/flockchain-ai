'use client'
import { Activity } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import type { SensorData } from '@/lib/types'

interface Props {
  history: SensorData[]
}

export default function TelemetryTrendChart({ history }: Props) {
  const data = history
    .slice()
    .reverse()
    .map((item) => ({
      time: item.timestamp ? new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--',
      nh3: Number(item.nh3.toFixed(1)),
      temp: Number(item.temperature.toFixed(1)),
      humidity: Number(item.humidity.toFixed(1)),
      tds: item.tds,
    }))

  return (
    <section className="glass-card p-6 animate-fade-in">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-cyan-600" />
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">
            Live Telemetry Trend
          </h3>
        </div>
        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
          Last {data.length} readings
        </span>
      </div>

      {data.length < 2 ? (
        <div className="h-[220px] flex items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50">
          <p className="text-xs text-slate-400 font-semibold">Waiting for more telemetry samples...</p>
        </div>
      ) : (
        <div className="h-[240px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <XAxis dataKey="time" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: 12,
                  color: '#1e293b',
                  fontSize: 12,
                }}
              />
              <Legend wrapperStyle={{ fontSize: 11, fontWeight: 700 }} />
              <Line type="monotone" dataKey="nh3" name="NH3 ppm" stroke="#dc2626" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="temp" name="Temp C" stroke="#0891b2" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="humidity" name="Humidity %" stroke="#10b981" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="tds" name="TDS ppm" stroke="#7c3aed" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  )
}
