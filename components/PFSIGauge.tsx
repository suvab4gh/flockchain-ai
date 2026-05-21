'use client'
import { Leaf, ShieldCheck, AlertCircle } from 'lucide-react'
import clsx from 'clsx'
import type { PFSIResult } from '@/lib/types'

interface Props {
  pfsi: PFSIResult | null
}

const colorMap: Record<string, string> = {
  blue: '#06b6d4',
  green: '#10b981',
  yellow: '#f59e0b',
  red: '#f43f5e',
}

const BADGE_STYLES = {
  blue: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  green: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  yellow: 'bg-amber-50 text-amber-700 border-amber-200',
  red: 'bg-rose-50 text-rose-700 border-rose-200',
} as const

function GaugeSVG({ score, color }: { score: number; color: string }) {
  const r = 62
  const circ = 2 * Math.PI * r
  const arc = circ * 0.75
  const offset = arc - (score / 100) * arc
  const stroke = colorMap[color] || colorMap.green

  return (
    <svg viewBox="0 0 150 150" className="w-40 h-40 mx-auto drop-shadow-xs">
      <circle cx="75" cy="75" r={r} fill="none" stroke="#e2e8f0" strokeWidth="8"
        strokeDasharray={arc} strokeDashoffset={0} strokeLinecap="round"
        transform="rotate(135,75,75)" />
      <circle cx="75" cy="75" r={r} fill="none" stroke={stroke} strokeWidth="8"
        strokeDasharray={arc} strokeDashoffset={offset} strokeLinecap="round"
        transform="rotate(135,75,75)" className="gauge-progress transition-all duration-1000 ease-out"
        style={{ filter: `drop-shadow(0 0 8px ${stroke}25)` }} />
      <text x="75" y="70" textAnchor="middle" className="fill-slate-800 font-extrabold tracking-tight" style={{ fontSize: 34 }}>
        {score.toFixed(1)}
      </text>
      <text x="75" y="90" textAnchor="middle" className="fill-slate-450 font-bold uppercase tracking-widest" style={{ fontSize: 9 }}>
        PFSI Index
      </text>
    </svg>
  )
}

const breakdownItems = [
  { key: 'airQuality' as const, label: 'Air Quality Level', weight: '30%', color: 'bg-gradient-to-r from-emerald-500 to-teal-500' },
  { key: 'waterQuality' as const, label: 'Water Quality (TDS)', weight: '20%', color: 'bg-gradient-to-r from-cyan-500 to-blue-500' },
  { key: 'temperature' as const, label: 'Thermal Envelope', weight: '15%', color: 'bg-gradient-to-r from-amber-500 to-orange-500' },
  { key: 'humidity' as const, label: 'Humidity Envelope', weight: '15%', color: 'bg-gradient-to-r from-blue-500 to-indigo-500' },
  { key: 'weatherAdaptation' as const, label: 'Atmospheric Adapt', weight: '20%', color: 'bg-gradient-to-r from-violet-500 to-fuchsia-500' },
]

export default function PFSIGauge({ pfsi }: Props) {
  return (
    <div className="glass-card p-6 border border-slate-200/50 bg-white/60 backdrop-blur-md rounded-2xl animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Leaf className="w-4 h-4 text-emerald-600" />
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
            Poultry Farm Sustainability Index (PFSI)
          </h3>
        </div>
        <span className="text-[10px] text-slate-400 font-semibold tracking-wider uppercase">On-chain Audit Weight</span>
      </div>

      {pfsi ? (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
          {/* Left: Gauge */}
          <div className="md:col-span-5 flex flex-col items-center">
            <GaugeSVG score={pfsi.score} color={pfsi.color} />
            <div className="text-center mt-3 space-y-2">
              <span className={clsx(
                'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-extrabold uppercase border tracking-wider',
                BADGE_STYLES[pfsi.color as keyof typeof BADGE_STYLES] || BADGE_STYLES.green
              )}>
                <span>{pfsi.emoji}</span>
                <span>{pfsi.label}</span>
              </span>
              {pfsi.score >= 70 ? (
                <div className="flex items-center justify-center gap-1 text-[9px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-0.5 rounded-full font-bold uppercase tracking-wider">
                  <ShieldCheck className="w-3 h-3" />
                  Eco Reward Eligible
                </div>
              ) : (
                <div className="flex items-center justify-center gap-1 text-[9px] bg-amber-50 text-amber-700 border border-amber-200 px-3 py-0.5 rounded-full font-bold uppercase tracking-wider">
                  <AlertCircle className="w-3 h-3" />
                  Target: &ge;70 for Rewards
                </div>
              )}
            </div>
          </div>

          {/* Right: Breakdown bars */}
          <div className="md:col-span-7 space-y-3.5 border-t md:border-t-0 md:border-l border-slate-200/50 pt-6 md:pt-0 md:pl-8">
            <span className="text-[9.5px] font-extrabold text-slate-400 uppercase tracking-widest block mb-2">Metrics Weight Breakdown</span>
            {breakdownItems.map((item) => (
              <div key={item.key} className="space-y-1">
                <div className="flex justify-between items-baseline text-xs">
                  <span className="text-slate-600 font-medium">
                    {item.label} <span className="text-[9px] text-slate-400 font-bold ml-1">({item.weight})</span>
                  </span>
                  <span className="text-slate-800 font-extrabold font-mono">
                    {pfsi.breakdown[item.key].toFixed(0)}<span className="text-[9px] text-slate-400 font-normal">/100</span>
                  </span>
                </div>
                <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={clsx('h-full rounded-full transition-all duration-1000 ease-out', item.color)}
                    style={{ width: `${pfsi.breakdown[item.key]}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center py-4">
          <div className="md:col-span-5 flex flex-col items-center">
            <div className="skeleton h-36 w-36 rounded-full" />
            <div className="skeleton h-5 w-24 mt-4" />
          </div>
          <div className="md:col-span-7 space-y-4 md:pl-8">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="space-y-2">
                <div className="skeleton h-3 w-1/3" />
                <div className="skeleton h-1.5 w-full" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
