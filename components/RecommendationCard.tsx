'use client'
import { Lightbulb, AlertTriangle, Info, CheckCircle2 } from 'lucide-react'
import clsx from 'clsx'

interface Recommendation {
  action: string
  priority: 'High' | 'Medium' | 'Low'
  description: string
}

interface Props {
  recommendations: Recommendation[]
}

const PRIORITY_STYLES = {
  High: {
    icon: AlertTriangle,
    badge: 'bg-rose-50 text-rose-700 border-rose-200',
    border: 'border-rose-100 bg-rose-50/50',
    indicator: 'bg-rose-500'
  },
  Medium: {
    icon: Info,
    badge: 'bg-amber-50 text-amber-700 border-amber-200',
    border: 'border-amber-100 bg-amber-50/50',
    indicator: 'bg-amber-500'
  },
  Low: {
    icon: CheckCircle2,
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    border: 'border-emerald-100 bg-emerald-50/50',
    indicator: 'bg-emerald-500'
  }
} as const

export default function RecommendationCard({ recommendations }: Props) {
  return (
    <div className="glass-card p-6 animate-fade-in flex flex-col h-full justify-between">
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-amber-500" />
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">
              Actuator Controls &amp; Alerts
            </h3>
          </div>
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">AI Copilot</span>
        </div>

        {recommendations.length === 0 ? (
          <div className="bg-slate-50 border border-dashed border-slate-200 rounded-xl p-6 text-center">
            <p className="text-xs text-slate-500 font-medium">No active directives. Trigger an AI Diagnostics scan first.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {recommendations.map((rec, i) => {
              const cfg = PRIORITY_STYLES[rec.priority] || PRIORITY_STYLES.Low
              return (
                <div key={i}
                  className={clsx(
                    "rounded-xl p-3.5 border transition-all duration-300 hover:-translate-y-0.5",
                    cfg.border
                  )}>
                  <div className="flex items-start gap-3">
                    <div className={clsx('w-2 h-2 rounded-full mt-1.5 flex-shrink-0 animate-pulse', cfg.indicator)} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className="text-xs font-extrabold text-slate-800">{rec.action}</span>
                        <span className={clsx(
                          'text-[9px] font-extrabold uppercase px-2.5 py-0.5 rounded-full border tracking-wide',
                          cfg.badge
                        )}>
                          {rec.priority} Priority
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 leading-relaxed font-semibold">{rec.description}</p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="mt-4 border-t border-slate-100 pt-3">
        <p className="text-[10px] text-slate-400 text-center font-bold leading-relaxed">
          ⚡ Reinforcement Learning (PPO) optimizes fan power and temperature actuators every 10 seconds.
        </p>
      </div>
    </div>
  )
}
