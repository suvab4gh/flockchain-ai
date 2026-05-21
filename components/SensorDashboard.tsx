'use client'
import { Wind, Thermometer, Droplets, FlaskConical } from 'lucide-react'
import clsx from 'clsx'
import type { SensorData } from '@/lib/types'

interface Props { sensor: SensorData | null }

const gauges = [
  { label: 'Ammonia (NH₃)', key: 'nh3' as const, unit: 'ppm', icon: Wind, max: 80, warnAt: 25, critAt: 50 },
  { label: 'Carbon Dioxide (CO₂)', key: 'co2' as const, unit: 'ppm', icon: Wind, max: 4000, warnAt: 2000, critAt: 3000 },
  { label: 'Temperature', key: 'temperature' as const, unit: '°C', icon: Thermometer, max: 45, warnAt: 30, critAt: 35 },
  { label: 'Humidity', key: 'humidity' as const, unit: '%RH', icon: Droplets, max: 100, warnAt: 70, critAt: 85 },
  { label: 'Water TDS', key: 'tds' as const, unit: 'ppm', icon: FlaskConical, max: 800, warnAt: 500, critAt: 650 },
]

const TEXT_COLORS = {
  rose: 'text-rose-600',
  amber: 'text-amber-600',
  emerald: 'text-emerald-600',
} as const

const BG_COLORS = {
  rose: 'bg-gradient-to-r from-rose-500 to-red-500',
  amber: 'bg-gradient-to-r from-amber-500 to-orange-500',
  emerald: 'bg-gradient-to-r from-emerald-500 to-teal-500',
} as const

const BORDER_COLORS = {
  rose: 'border-rose-100 bg-rose-50/50',
  amber: 'border-amber-100 bg-amber-50/50',
  emerald: 'border-emerald-100 bg-emerald-50/50',
} as const

export default function SensorDashboard({ sensor }: Props) {
  return (
    <div className="glass-card p-6 animate-fade-in flex flex-col h-full">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">
          Live Sensor Telemetry
        </h3>
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Real-time Stream</span>
        </span>
      </div>

      <div className="space-y-4 flex-1 flex flex-col justify-between">
        {gauges.map(g => {
          const v = sensor ? Number(sensor[g.key]) : 0
          const st = v >= g.critAt ? 'rose' : v >= g.warnAt ? 'amber' : 'emerald'
          const pct = Math.min(100, (v / g.max) * 100)
          
          return (
            <div key={g.key} className={clsx("p-3 rounded-xl border transition-all duration-300", BORDER_COLORS[st])}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                  <g.icon className="w-3.5 h-3.5 text-slate-400" />
                  {g.label}
                </span>
                <span className={clsx('text-base font-extrabold tabular-nums', TEXT_COLORS[st])}>
                  {sensor ? (g.key === 'co2' || g.key === 'tds' ? v.toFixed(0) : v.toFixed(1)) : '--'}
                  <span className="text-[10px] font-normal text-slate-450 ml-1">{g.unit}</span>
                </span>
              </div>
              <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className={clsx('h-full rounded-full transition-all duration-1000 ease-out', BG_COLORS[st])} 
                  style={{ width: `${sensor ? pct : 0}%` }} 
                />
              </div>
              <div className="text-[9px] mt-1 flex justify-between items-center">
                <span className={clsx('font-bold uppercase tracking-wide', TEXT_COLORS[st])}>
                  {v >= g.critAt ? 'Critical' : v >= g.warnAt ? 'Warning' : 'Normal'}
                </span>
                <span className="text-slate-400 font-bold">Safe Limit: &lt;{g.warnAt} {g.unit}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
