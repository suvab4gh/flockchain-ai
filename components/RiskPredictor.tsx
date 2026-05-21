'use client'
import { Brain, RefreshCw, Shield, Clock, AlertCircle } from 'lucide-react'
import clsx from 'clsx'
import type { AIPrediction } from '@/lib/types'

interface Props { prediction: AIPrediction | null; loading: boolean; onRefresh: () => void }

const colors: Record<string, string> = { 
  green: '#10b981', 
  yellow: '#f59e0b', 
  orange: '#f97316', 
  red: '#f43f5e' 
}

const BADGE_STYLES = {
  green: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  yellow: 'bg-amber-50 text-amber-700 border-amber-200',
  orange: 'bg-orange-50 text-orange-700 border-orange-200',
  red: 'bg-rose-50 text-rose-700 border-rose-200',
} as const

function Gauge({ value, color }: { value: number; color: string }) {
  const r = 58
  const circ = 2 * Math.PI * r
  const arc = circ * 0.75
  const offset = arc - (value / 100) * arc
  const stroke = colors[color] || colors.green
  
  return (
    <svg viewBox="0 0 140 140" className="w-36 h-36 mx-auto">
      <circle cx="70" cy="70" r={r} fill="none" stroke="#e2e8f0" strokeWidth="6" strokeDasharray={arc} strokeDashoffset={0} strokeLinecap="round" transform="rotate(135,70,70)" />
      <circle cx="70" cy="70" r={r} fill="none" stroke={stroke} strokeWidth="6" strokeDasharray={arc} strokeDashoffset={offset} strokeLinecap="round" transform="rotate(135,70,70)" className="gauge-progress transition-all duration-1000 ease-out" style={{ filter: `drop-shadow(0 2px 4px ${stroke}15)` }} />
      <text x="70" y="66" textAnchor="middle" className="fill-slate-800 font-extrabold tracking-tight font-sans" style={{ fontSize: 32 }}>{value}%</text>
      <text x="70" y="86" textAnchor="middle" className="fill-slate-400 font-bold tracking-wider uppercase font-sans" style={{ fontSize: 9 }}>Risk Index</text>
    </svg>
  )
}

export default function RiskPredictor({ prediction: p, loading, onRefresh }: Props) {
  return (
    <div className="glass-card p-6 animate-fade-in flex flex-col h-full justify-between">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-emerald-600" />
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">
            AI Diagnostics
          </h3>
        </div>
        <button 
          onClick={onRefresh} 
          disabled={loading} 
          className="btn-primary !px-3 !py-1.5 !text-xs flex items-center gap-1.5 active:scale-95 transition-transform"
        >
          <RefreshCw className={clsx('w-3.5 h-3.5', loading && 'animate-spin')} />
          {loading ? 'Analyzing…' : 'Refresh AI'}
        </button>
      </div>

      {loading && !p ? (
        <div className="flex-1 flex flex-col items-center justify-center py-8">
          <div className="relative flex items-center justify-center">
            <div className="absolute w-12 h-12 rounded-full border-2 border-emerald-100 border-t-emerald-600 animate-spin" />
            <Brain className="w-6 h-6 text-emerald-600 animate-pulse" />
          </div>
          <span className="text-xs text-slate-500 mt-4 font-semibold font-sans">Evaluating ML Models...</span>
        </div>
      ) : p ? (
        <div className="flex-1 flex flex-col gap-4">
          <div className="relative">
            <Gauge value={p.riskScore} color={p.riskColor} />
          </div>

          <div className="text-center">
            <span className={clsx(
              'inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-extrabold uppercase border tracking-wider', 
              BADGE_STYLES[p.riskColor as keyof typeof BADGE_STYLES] || BADGE_STYLES.green
            )}>
              <AlertCircle className="w-3 h-3" />
              {p.riskCategory} Risk
            </span>
          </div>

          {p.diseases[0] !== 'None detected' && (
            <div className="flex flex-wrap gap-1.5 justify-center">
              {p.diseases.map((d, i) => (
                <span key={i} className="bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 rounded-md text-[9px] font-bold flex items-center gap-1">
                  <Shield className="w-2.5 h-2.5 text-rose-500" />
                  {d}
                </span>
              ))}
            </div>
          )}

          {/* Time horizons redesigned as a timeline */}
          <div className="space-y-2 pt-3 border-t border-slate-100">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Health Trends (LSTM)</span>
            {(['next12hours', 'next24hours', 'next48hours'] as const).map((k, idx) => {
              const label = k === 'next12hours' ? '+6h Outlook' : k === 'next24hours' ? '+12h Outlook' : '+24h Outlook';
              return (
                <div key={k} className="flex items-center justify-between text-xs p-2 rounded-lg bg-slate-50 border border-slate-100">
                  <span className="text-slate-600 flex items-center gap-1.5 font-medium">
                    <Clock className="w-3 h-3 text-emerald-600" />
                    {label}
                  </span>
                  <span className="text-slate-800 font-bold font-mono">
                    {p.predictions[k].replace('Forecast health (6h): ', '').replace('Forecast health (12h): ', '').replace('Forecast health (24h): ', '')}
                  </span>
                </div>
              )
            })}
          </div>

          <p className="text-[10px] text-slate-500 text-center italic leading-relaxed border-t border-slate-100 pt-2 line-clamp-2">
            {p.summary}
          </p>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center py-8 text-center">
          <Brain className="w-8 h-8 text-slate-300 mb-2" />
          <p className="text-xs text-slate-500">Telemetry loaded. Click &quot;Refresh AI&quot; to execute neural diagnostics.</p>
        </div>
      )}
    </div>
  )
}
