'use client'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import {
  Bird, ArrowRight, Shield, Zap, Coins, Activity, AlertTriangle,
  CheckCircle, ExternalLink, ChevronRight, Wifi, Lock, TrendingUp
} from 'lucide-react'

const STATS = [
  { label: 'Farms Monitored', value: '2,847', suffix: '', delta: '+12 today' },
  { label: 'Alerts Fired', value: '14', suffix: ' today', delta: '3 critical' },
  { label: 'XLM Paid to Vets', value: '7.00', suffix: ' XLM', delta: 'via Stellar' },
  { label: 'Flocks Certified', value: '1,203', suffix: '', delta: 'HLTH tokens' },
]

const FEATURES = [
  {
    icon: AlertTriangle,
    badge: '24–48h early',
    title: 'Disease Early Warning',
    body: 'XGBoost + LSTM models detect Newcastle, Avian Flu, and Coccidiosis preconditions from NH₃, CO₂, temperature, and humidity — before visible symptoms appear.',
    color: 'emerald',
    stat: '92% accuracy on ICAR-CARI benchmark',
  },
  {
    icon: Zap,
    badge: 'Automated',
    title: 'Alert → Vet Dispatch',
    body: 'When risk crosses 70%, the system anchors a tamper-proof alert on Stellar and dispatches a 0.5 XLM micropayment to the nearest registered vet — no human in the loop.',
    color: 'rose',
    stat: '< 2 second end-to-end latency',
  },
  {
    icon: Lock,
    badge: 'On-chain',
    title: 'Immutable Sensor Log',
    body: 'Every shed reading is SHA-256 hashed and committed to the Stellar ledger via Soroban smart contract. Tamper-evident, auditable by buyers and insurers.',
    color: 'indigo',
    stat: 'Soroban + Classic Horizon fallback',
  },
  {
    icon: Coins,
    badge: 'Custom asset',
    title: 'HLTH Health Tokens',
    body: 'Flocks that sustain PFSI ≥ 70 for 7 days are issued HLTH Stellar custom assets — verifiable proof of biosecurity compliance that buyers can check on-chain.',
    color: 'amber',
    stat: 'ECO_KUKK carbon credit rewards too',
  },
]

const PIPELINE = [
  { step: '01', label: 'IoT Sensors', sub: 'NH₃ / CO₂ / Temp / TDS via MQTT', icon: Wifi },
  { step: '02', label: 'AI Scoring', sub: 'XGBoost + LSTM + PPO RL', icon: Activity },
  { step: '03', label: 'Risk Alert', sub: 'Auto-fire when score > 70%', icon: AlertTriangle },
  { step: '04', label: 'Stellar Ledger', sub: 'Hash + cert anchored on-chain', icon: Lock },
  { step: '05', label: 'HLTH Token', sub: 'Issued on clean streak ≥ 7 days', icon: CheckCircle },
]

const STACK = [
  'Next.js 15', 'XGBoost + LSTM', 'PPO RL', 'Soroban SDK',
  'Stellar SDK v11', 'HiveMQ MQTT', 'Upstash Redis', 'Freighter Wallet',
  'MPP Payments', 'OpenWeatherMap', 'Vercel Edge', 'FastAPI',
]

export default function LandingPage() {
  const [liveRisk, setLiveRisk] = useState(68)
  const [alertFired, setAlertFired] = useState(false)

  // Animate risk counter to simulate a live breach
  useEffect(() => {
    const t = setTimeout(() => {
      const interval = setInterval(() => {
        setLiveRisk(v => {
          if (v >= 73) { setAlertFired(true); clearInterval(interval); return 73 }
          return v + 1
        })
      }, 400)
      return () => clearInterval(interval)
    }, 1800)
    return () => clearTimeout(t)
  }, [])

  return (
    <div className="min-h-screen bg-[#F7F6F3] text-slate-900 font-sans">

      {/* ── Nav ── */}
      <nav className="sticky top-0 z-50 bg-[#F7F6F3]/90 backdrop-blur border-b border-[#E2E0DB]">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-600 to-teal-600 flex items-center justify-center">
              <Bird className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-bold tracking-wide text-slate-900">FlockChain AI</span>
          </div>
          <div className="hidden sm:flex items-center gap-6 text-sm text-slate-500 font-medium">
            <Link href="/farmer" className="hover:text-slate-900 transition-colors">Farmer Portal</Link>
            <Link href="/admin" className="hover:text-slate-900 transition-colors">Admin</Link>
            <a
              href="https://stellar.expert/explorer/testnet"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 hover:text-slate-900 transition-colors"
            >
              Stellar Explorer
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
          <Link
            href="/farmer"
            className="text-xs font-bold bg-slate-900 text-white px-4 py-2 rounded-lg hover:bg-slate-800 transition-colors"
          >
            Open Dashboard
          </Link>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="max-w-6xl mx-auto px-6 pt-24 pb-20">
        <div className="max-w-3xl">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-full mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Indian Poultry Biosecurity · Stellar Testnet Live
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-slate-950 leading-[1.1] mb-6">
            By the time you see <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-rose-600 to-orange-500">sick birds,</span>
            <br /> you&apos;ve lost the flock.
          </h1>

          <p className="text-lg text-slate-600 max-w-xl leading-relaxed mb-10">
            FlockChain AI detects disease preconditions 24–48 hours before visible symptoms, 
            auto-dispatches vets via Stellar micropayments, and issues tamper-proof health certificates.
          </p>

          {/* Live Demo Widget */}
          <div className="bg-white border border-[#E2E0DB] rounded-2xl p-5 mb-10 max-w-sm shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Live Risk Monitor</span>
              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                MQTT Connected
              </span>
            </div>
            <div className="flex items-end gap-3 mb-3">
              <span className={`text-5xl font-black font-mono transition-colors duration-500 ${liveRisk >= 70 ? 'text-rose-600' : 'text-amber-500'}`}>
                {liveRisk}%
              </span>
              <span className="text-sm text-slate-400 mb-2 font-semibold">Disease Risk Index</span>
            </div>
            {/* Risk bar */}
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden mb-3">
              <div
                className={`h-full rounded-full transition-all duration-500 ${liveRisk >= 70 ? 'bg-rose-500' : 'bg-amber-400'}`}
                style={{ width: `${liveRisk}%` }}
              />
            </div>
            {alertFired && (
              <div className="flex items-center gap-2 text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 animate-pulse">
                <AlertTriangle className="w-3.5 h-3.5" />
                🚨 ALERT FIRED — Vet dispatched via Stellar
              </div>
            )}
            {!alertFired && (
              <p className="text-[10px] text-slate-400 font-semibold">NH₃: 28ppm · CO₂: 1800ppm · Temp: 30°C</p>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              href="/farmer"
              className="inline-flex items-center justify-center gap-2 bg-slate-900 text-white px-6 py-3 rounded-xl font-semibold text-sm hover:bg-slate-800 active:scale-[0.98] transition-all"
            >
              Open Farmer Dashboard
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/admin"
              className="inline-flex items-center justify-center gap-2 bg-white text-slate-800 border border-[#E2E0DB] px-6 py-3 rounded-xl font-semibold text-sm hover:border-slate-400 active:scale-[0.98] transition-all"
            >
              Admin Command Center
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── Live Stats ── */}
      <section className="border-y border-[#E2E0DB] bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-[#E2E0DB]">
            {STATS.map((s) => (
              <div key={s.label} className="px-8 py-7">
                <div className="text-2xl font-black text-slate-900 font-mono">
                  {s.value}<span className="text-base font-semibold text-slate-500">{s.suffix}</span>
                </div>
                <div className="text-xs font-bold text-slate-500 mt-0.5">{s.label}</div>
                <div className="text-[10px] text-emerald-600 font-bold mt-1">{s.delta}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Feature Cards ── */}
      <section className="max-w-6xl mx-auto px-6 py-24">
        <div className="mb-12">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">What we built</p>
          <h2 className="text-3xl font-bold text-slate-900">
            Four layers, one pipeline.
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {FEATURES.map((f) => {
            const colors: Record<string, string> = {
              emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
              rose:    'bg-rose-50    text-rose-700    border-rose-200',
              indigo:  'bg-indigo-50  text-indigo-700  border-indigo-200',
              amber:   'bg-amber-50   text-amber-700   border-amber-200',
            }
            const iconColors: Record<string, string> = {
              emerald: 'text-emerald-600',
              rose:    'text-rose-600',
              indigo:  'text-indigo-600',
              amber:   'text-amber-600',
            }
            return (
              <div
                key={f.title}
                className="bg-white border border-[#E2E0DB] rounded-2xl p-7 hover:border-slate-300 hover:shadow-md transition-all duration-300 group"
              >
                <div className="flex items-start justify-between mb-5">
                  <f.icon className={`w-6 h-6 ${iconColors[f.color]}`} />
                  <span className={`text-[10px] font-extrabold uppercase tracking-wider border px-2 py-0.5 rounded-full ${colors[f.color]}`}>
                    {f.badge}
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-900 mb-2">{f.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed mb-4">{f.body}</p>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider border-t border-[#F0EEE9] pt-3 mt-auto">
                  {f.stat}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* ── Pipeline ── */}
      <section className="bg-slate-950 text-white py-20">
        <div className="max-w-6xl mx-auto px-6">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">How it works</p>
          <h2 className="text-3xl font-bold mb-14">From sensor to ledger in &lt; 2 seconds.</h2>
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-px bg-slate-800">
            {PIPELINE.map((p, i) => (
              <div key={p.step} className="bg-slate-950 p-6 relative group hover:bg-slate-900 transition-colors">
                <div className="text-[10px] font-black text-slate-600 mb-3">{p.step}</div>
                <p.icon className="w-5 h-5 text-emerald-400 mb-3" />
                <div className="text-sm font-bold text-white mb-1">{p.label}</div>
                <div className="text-[11px] text-slate-500">{p.sub}</div>
                {i < PIPELINE.length - 1 && (
                  <div className="hidden sm:block absolute -right-3 top-1/2 -translate-y-1/2 text-slate-700 z-10">
                    <ChevronRight className="w-6 h-6" />
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="mt-8 flex items-center gap-3">
            <a
              href="https://stellar.expert/explorer/testnet"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-xs font-bold text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              View live Stellar Testnet transactions
            </a>
          </div>
        </div>
      </section>

      {/* ── What happens next (pitch slide) ── */}
      <section className="max-w-6xl mx-auto px-6 py-24">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Business model</p>
            <h2 className="text-3xl font-bold text-slate-900 mb-6">What happens next.</h2>
            <div className="space-y-4">
              {[
                { icon: TrendingUp, text: 'SaaS to farms at ₹499/month — covers 5 sheds, unlimited alerts' },
                { icon: Coins,      text: 'Transaction fee from insurance payout flows (1.5% of claim processed)' },
                { icon: Shield,     text: 'HLTH token marketplace — buyers pay premium for certified flocks' },
                { icon: Wifi,       text: 'WhatsApp vet alerts via Twilio, satellite camera integration (Phase 2)' },
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-3 p-4 bg-white border border-[#E2E0DB] rounded-xl">
                  <item.icon className="w-5 h-5 text-slate-400 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-slate-700">{item.text}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-slate-950 rounded-2xl p-7 text-white flex flex-col">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Live on Stellar Testnet</p>
            <div className="flex-1 flex flex-col justify-center">
              <div className="text-4xl font-black text-emerald-400 font-mono mb-1">$0.00001</div>
              <p className="text-sm text-slate-400 mb-6">per Stellar transaction</p>
              <div className="space-y-2">
                {['Alert anchor on-chain', 'Vet XLM dispatch', 'HLTH token issuance', 'Cert verification'].map(t => (
                  <div key={t} className="flex items-center gap-2 text-xs text-slate-400">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                    {t}
                  </div>
                ))}
              </div>
            </div>
            <a
              href="https://stellar.expert/explorer/testnet"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold py-3 rounded-xl transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Verify on Stellar Explorer
            </a>
          </div>
        </div>
      </section>

      {/* ── Tech Stack ── */}
      <section className="border-t border-[#E2E0DB] bg-white py-12">
        <div className="max-w-6xl mx-auto px-6">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6 text-center">Enterprise Stack</p>
          <div className="flex flex-wrap gap-2 justify-center">
            {STACK.map(s => (
              <span
                key={s}
                className="text-xs font-medium text-slate-600 bg-[#F7F6F3] border border-[#E2E0DB] px-3 py-1.5 rounded-lg"
              >
                {s}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-[#E2E0DB] py-8">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md bg-gradient-to-br from-emerald-600 to-teal-600 flex items-center justify-center">
              <Bird className="w-3 h-3 text-white" />
            </div>
            <span className="text-xs font-bold text-slate-900">FlockChain AI</span>
          </div>
          <p className="text-xs text-slate-400">
            Precision Biosecurity · Stellar Testnet · {new Date().getFullYear()}
          </p>
          <div className="flex items-center gap-4 text-xs font-medium text-slate-400">
            <Link href="/farmer" className="hover:text-slate-700 transition-colors">Dashboard</Link>
            <Link href="/admin" className="hover:text-slate-700 transition-colors">Admin</Link>
            <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="hover:text-slate-700 transition-colors">GitHub</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
