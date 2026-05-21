'use client'
import { AlertTriangle, CheckCircle, AlertCircle, XCircle } from 'lucide-react'
import clsx from 'clsx'
interface Props { riskCategory: string; riskScore: number; summary: string }
const cfg: Record<string, { icon: typeof AlertTriangle; bg: string; border: string; text: string; label: string }> = {
  Low:      { icon: CheckCircle,   bg:'bg-emerald-50', border:'border-emerald-200', text:'text-emerald-700', label:'ALL CLEAR' },
  Medium:   { icon: AlertCircle,   bg:'bg-amber-50',   border:'border-amber-200',   text:'text-amber-750',   label:'CAUTION' },
  High:     { icon: AlertTriangle, bg:'bg-orange-50',  border:'border-orange-200',  text:'text-orange-750',  label:'HIGH RISK' },
  Critical: { icon: XCircle,       bg:'bg-rose-50',    border:'border-rose-200',    text:'text-rose-750',    label:'CRITICAL' },
}
export default function AlertBanner({ riskCategory, riskScore, summary }: Props) {
  const c = cfg[riskCategory] || cfg.Low
  return (
    <div className={clsx('rounded-xl border px-5 py-3 flex items-center gap-4 animate-fade-in', c.bg, c.border)}>
      <c.icon className={clsx('w-6 h-6 flex-shrink-0', c.text)} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3">
          <span className={clsx('text-xs font-bold tracking-widest uppercase', c.text)}>{c.label}</span>
          <span className={clsx('text-xs px-2 py-0.5 rounded-full font-semibold border', c.bg, c.text, c.border)}>Risk: {riskScore}/100</span>
        </div>
        <p className="text-sm text-slate-600 mt-0.5 truncate">{summary}</p>
      </div>
    </div>
  )
}
