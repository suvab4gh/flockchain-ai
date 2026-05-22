'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import Link from 'next/link'
import {
  Bird, MapPin, Wifi, WifiOff, Activity, Wind, Leaf, Shield,
  Clock, Menu, X, ShieldCheck, AlertTriangle, CheckCircle,
  ExternalLink, Zap, TrendingUp, RefreshCw
} from 'lucide-react'
import clsx from 'clsx'
import AlertBanner from '@/components/AlertBanner'
import SensorDashboard from '@/components/SensorDashboard'
import RiskPredictor from '@/components/RiskPredictor'
import WeatherPanel from '@/components/WeatherPanel'
import PFSIGauge from '@/components/PFSIGauge'
import StellarPanel from '@/components/StellarPanel'
import RecommendationCard from '@/components/RecommendationCard'
import TelemetryTrendChart from '@/components/TelemetryTrendChart'
import { connectMQTT } from '@/lib/mqtt'
import { calculatePFSI } from '@/lib/pfsi'
import type { SensorData, WeatherData, AIPrediction, PFSIResult, StellarTx } from '@/lib/types'
import type { MQTTStatus } from '@/lib/mqtt'

const RISK_COLORS: Record<string, string> = {
  red: 'text-rose-600', orange: 'text-orange-600',
  yellow: 'text-amber-600', green: 'text-emerald-600',
}
const PFSI_COLORS: Record<string, string> = {
  red: 'text-rose-600', yellow: 'text-amber-600',
  blue: 'text-cyan-600', green: 'text-emerald-600',
}

interface AlertEvent {
  triggeredAt: string
  riskScore: number
  riskCategory: string
  diseases: string[]
  vetPaymentStatus: string
  stellarTxHash?: string
  explorerUrl?: string
}

export default function FarmerDashboard() {
  const [sensor, setSensor]               = useState<SensorData | null>(null)
  const [sensorHistory, setSensorHistory] = useState<SensorData[]>([])
  const [weather, setWeather]             = useState<WeatherData | null>(null)
  const [prediction, setPrediction]       = useState<AIPrediction | null>(null)
  const [pfsi, setPfsi]                   = useState<PFSIResult | null>(null)
  const [txHistory, setTxHistory]         = useState<StellarTx[]>([])
  const [alertEvents, setAlertEvents]     = useState<AlertEvent[]>([])
  const [mqttStatus, setMqttStatus]       = useState<MQTTStatus>('connecting')
  const [aiLoading, setAiLoading]         = useState(false)
  const [hashLoading, setHashLoading]     = useState(false)
  const [clock, setClock]                 = useState('')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [activeEngine, setActiveEngine]   = useState<'python-ml' | 'nvidia-minimax' | 'icar-rules' | null>(null)

  const sensorRef  = useRef<SensorData | null>(null)
  const weatherRef = useRef<WeatherData | null>(null)

  useEffect(() => { sensorRef.current = sensor }, [sensor])
  useEffect(() => { weatherRef.current = weather }, [weather])

  // Clock ticker
  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  // MQTT connection — connectMQTT is async, store cleanup in a ref
  useEffect(() => {
    let cleanupFn: (() => void) | null = null
    connectMQTT({
      onData: (data) => {
        setSensor(data)
        setSensorHistory(prev => [data, ...prev].slice(0, 40))
        fetch('/api/sensor', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).catch(() => {})
      },
      onStatus: setMqttStatus,
    }).then(fn => { cleanupFn = fn })
    return () => { cleanupFn?.() }
  }, [])

  // Weather polling
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/weather')
        if (res.ok) setWeather(await res.json())
      } catch { /* silent */ }
    }
    load()
    const id = setInterval(load, 120_000)
    return () => clearInterval(id)
  }, [])

  // PFSI recalculation
  useEffect(() => {
    if (!sensor || !weather) return
    setPfsi(calculatePFSI(sensor, weather))
  }, [sensor, weather])

  const refreshAI = useCallback(async () => {
    const s = sensorRef.current
    const w = weatherRef.current
    if (!s || !w) return
    setAiLoading(true)
    try {
      const res = await fetch('/api/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sensor: s, weather: w }),
      })
      if (res.ok) {
        const data = await res.json()
        // data.prediction = AIPrediction, data.engine = tier label
        const pred = data.prediction ?? data
        const engine = data.engine ?? null
        setPrediction(pred)
        if (engine) setActiveEngine(engine as any)
        // Auto-fire alert if risk ≥ 70
        if (pred.riskScore >= 70) {
          fireAlert(pred)
        }
      }
    } catch { /* silent */ }
    setAiLoading(false)
  }, [])

  const fireAlert = useCallback(async (pred: AIPrediction) => {
    try {
      const res = await fetch('/api/alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          farmId: 'FARM-001',
          riskScore: pred.riskScore,
          riskCategory: pred.riskCategory,
          diseases: pred.diseases,
          sensorData: sensorRef.current,
          source: 'ml',
        }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.triggered) {
          setAlertEvents(prev => [{
            triggeredAt: data.timestamp,
            riskScore: data.riskScore,
            riskCategory: data.riskCategory,
            diseases: data.diseases || [],
            vetPaymentStatus: data.vetPaymentStatus,
            stellarTxHash: data.stellarTxHash,
            explorerUrl: data.explorerUrl,
          }, ...prev].slice(0, 5))
        }
      }
    } catch { /* silent */ }
  }, [])

  const hashSensor = useCallback(async () => {
    const s = sensorRef.current
    if (!s) return null
    setHashLoading(true)
    try {
      const res = await fetch('/api/stellar/hash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sensorData: s }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.stellarTxHash) {
          setTxHistory(prev => [{ hash: data.stellarTxHash, timestamp: data.timestamp, ledger: 0, explorerUrl: data.explorerUrl }, ...prev].slice(0, 10))
          setHashLoading(false)
          return data
        }
      }
    } catch { /* silent */ }
    setHashLoading(false)
    return null
  }, [])

  // Trigger AI refresh when sensor updates
  useEffect(() => {
    if (!sensor) return
    const t = setTimeout(refreshAI, 600)
    return () => clearTimeout(t)
  }, [sensor, refreshAI])

  const riskColor = RISK_COLORS[prediction?.riskColor || ''] || 'text-slate-500'
  const pfsiColor = PFSI_COLORS[pfsi?.color || '']       || 'text-slate-500'
  const nh3Color  = !sensor?.nh3 ? 'text-slate-500' : sensor.nh3 > 50 ? 'text-rose-600' : sensor.nh3 > 25 ? 'text-amber-600' : 'text-emerald-600'

  return (
    <div className="min-h-screen bg-[#F7F6F3] text-slate-900">

      {/* ── Sticky Top Bar ── */}
      <header className="sticky top-0 z-40 bg-[#F7F6F3]/95 backdrop-blur border-b border-[#E2E0DB]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          {/* Brand */}
          <div className="flex items-center gap-2.5 flex-shrink-0">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-600 to-teal-600 flex items-center justify-center">
              <Bird className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="text-sm font-bold text-slate-900 leading-none">FlockChain AI</div>
              <div className="flex items-center gap-1 text-[10px] text-slate-400 mt-0.5">
                <MapPin className="w-2.5 h-2.5" />
                Farm Alpha · Kolkata, IN
              </div>
            </div>
          </div>

          {/* Desktop status pills */}
          <div className="hidden sm:flex items-center gap-3">
            {/* Risk badge */}
            {prediction && (
              <span className={clsx(
                'text-[10px] font-extrabold px-2.5 py-1 rounded-full border uppercase tracking-wider',
                prediction.riskCategory === 'Critical' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                prediction.riskCategory === 'High'     ? 'bg-orange-50 text-orange-700 border-orange-200' :
                prediction.riskCategory === 'Medium'   ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                                          'bg-emerald-50 text-emerald-700 border-emerald-200'
              )}>
                {prediction.riskCategory} Risk · {prediction.riskScore}%
              </span>
            )}
            {/* AI engine badge */}
            {activeEngine && (
              <span className={clsx(
                'text-[10px] font-extrabold px-2.5 py-1 rounded-full border uppercase tracking-wider',
                activeEngine === 'nvidia-minimax' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                activeEngine === 'python-ml'      ? 'bg-cyan-50 text-cyan-700 border-cyan-200' :
                                                    'bg-slate-100 text-slate-600 border-slate-200'
              )}>
                {activeEngine === 'nvidia-minimax' ? '🤖 NVIDIA M2.7' :
                 activeEngine === 'python-ml'      ? '⚙️ XGB+LSTM+PPO' : '📋 ICAR Rules'}
              </span>
            )}
            {/* MQTT */}
            <span className={clsx(
              'flex items-center gap-1.5 text-[10px] font-extrabold px-2.5 py-1 rounded-full border uppercase tracking-wider',
              mqttStatus === 'connected' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
              mqttStatus === 'demo'      ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                          'bg-slate-100 text-slate-500 border-slate-200'
            )}>
              {mqttStatus === 'connected' ? <Wifi className="w-3 h-3 animate-pulse" /> : <WifiOff className="w-3 h-3" />}
              {mqttStatus === 'connected' ? 'MQTT Live' : mqttStatus === 'demo' ? 'Simulation' : 'Connecting…'}
            </span>
            {/* Clock */}
            <span className="text-[10px] font-mono font-bold text-slate-500 bg-white border border-[#E2E0DB] px-2.5 py-1 rounded-full">
              <Clock className="w-3 h-3 inline mr-1" />{clock}
            </span>
            {/* Admin link */}
            <Link href="/admin" className="text-[10px] font-bold text-slate-500 hover:text-slate-900 transition-colors flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" /> Admin
            </Link>
          </div>

          {/* Refresh AI button */}
          <button
            onClick={refreshAI}
            disabled={aiLoading}
            className="hidden sm:flex items-center gap-1.5 text-xs font-bold bg-slate-900 text-white px-3 py-1.5 rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={clsx('w-3 h-3', aiLoading && 'animate-spin')} />
            {aiLoading ? 'Scanning…' : 'Refresh AI'}
          </button>

          {/* Mobile hamburger */}
          <button
            className="sm:hidden p-2 rounded-lg border border-[#E2E0DB] bg-white"
            onClick={() => setMobileMenuOpen(v => !v)}
            aria-label="Toggle navigation"
          >
            {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>

        {/* Mobile drawer */}
        {mobileMenuOpen && (
          <div className="sm:hidden border-t border-[#E2E0DB] bg-white px-4 py-3 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-slate-600">{clock}</span>
              <span className={clsx('text-[10px] font-extrabold px-2 py-0.5 rounded-full border uppercase',
                mqttStatus === 'connected' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'
              )}>
                {mqttStatus === 'connected' ? '● MQTT Live' : '● Simulation'}
              </span>
            </div>
            <button onClick={refreshAI} disabled={aiLoading}
              className="flex items-center justify-center gap-2 bg-slate-900 text-white py-2.5 rounded-xl text-xs font-bold">
              <RefreshCw className={clsx('w-3.5 h-3.5', aiLoading && 'animate-spin')} />
              {aiLoading ? 'Scanning…' : 'Refresh AI Scan'}
            </button>
            <Link href="/admin" onClick={() => setMobileMenuOpen(false)}
              className="flex items-center justify-center gap-2 bg-white border border-[#E2E0DB] text-slate-700 py-2.5 rounded-xl text-xs font-bold">
              <ShieldCheck className="w-3.5 h-3.5" /> Admin Command Center
            </Link>
          </div>
        )}
      </header>

      {/* ── Alert Banner ── */}
      {prediction && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-4">
          <AlertBanner riskCategory={prediction.riskCategory} riskScore={prediction.riskScore} summary={prediction.summary} />
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex flex-col gap-10">

        {/* ── Section 1: Live Telemetry & AI Diagnostics ── */}
        <section className="flex flex-col gap-6">
          <div className="flex items-center gap-2 border-b border-[#E2E0DB] pb-2">
            <Activity className="w-5 h-5 text-indigo-600" />
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-widest">Live Telemetry & AI Diagnostics</h2>
          </div>

          {/* ── KPI Row ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { icon: Shield,    label: 'Disease Risk',    value: prediction ? `${prediction.riskScore}%` : '--', color: riskColor,  sub: prediction?.riskCategory || 'Waiting...' },
            { icon: Leaf,      label: 'PFSI Score',      value: pfsi ? pfsi.score.toFixed(1) : '--',            color: pfsiColor,  sub: pfsi?.label || 'Calculating...' },
            { icon: Wind,      label: 'Ammonia (ppm)',   value: sensor ? sensor.nh3.toFixed(1) : '--',          color: nh3Color,   sub: sensor ? (sensor.nh3 > 25 ? 'Above Safe Limit' : 'Within Range') : 'No Data' },
            { icon: Activity,  label: 'Flock Status',   value: prediction?.riskCategory === 'Critical' ? '🚨' : prediction?.riskCategory === 'High' ? '⚠️' : '✅', color: 'text-slate-700', sub: prediction?.riskCategory === 'Critical' ? 'CRITICAL' : prediction?.riskCategory === 'High' ? 'CAUTION' : 'OPTIMAL' },
          ].map((kpi) => (
            <div key={kpi.label} className="bg-white border border-[#E2E0DB] rounded-2xl p-5 flex flex-col">
              <div className="flex items-center gap-2 mb-3">
                <kpi.icon className="w-4 h-4 text-slate-400" />
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{kpi.label}</span>
              </div>
              <div className={clsx('text-3xl font-black font-mono tracking-tight', kpi.color)}>{kpi.value}</div>
              <div className="text-[10px] font-semibold text-slate-400 mt-1">{kpi.sub}</div>
            </div>
          ))}
        </div>

        {/* ── Main Grid ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">

          {/* Left: Sensors + Weather */}
          <div className="lg:col-span-4 flex flex-col gap-5">
            <SensorDashboard sensor={sensor} />
            <WeatherPanel weather={weather} sensor={sensor} weatherImpact={prediction?.weatherImpact} />
          </div>

          {/* Right: AI + Stellar */}
          <div className="lg:col-span-8 flex flex-col gap-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <RiskPredictor prediction={prediction} loading={aiLoading} onRefresh={refreshAI} />
              <StellarPanel txHistory={txHistory} pfsiScore={pfsi?.score || 0} onHashSensor={hashSensor} hashLoading={hashLoading} />
            </div>
            <RecommendationCard recommendations={prediction?.recommendations || []} />
          </div>
        </div>
        </section>

        {/* ── Section 2: Historical Trends & Scoring ── */}
        <section className="flex flex-col gap-6">
          <div className="flex items-center gap-2 border-b border-[#E2E0DB] pb-2">
            <TrendingUp className="w-5 h-5 text-indigo-600" />
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-widest">Historical Trends & PFSI Scoring</h2>
          </div>

        {/* ── PFSI + Trend Row ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <PFSIGauge pfsi={pfsi} />
          <TelemetryTrendChart history={sensorHistory} />
        </div>
        </section>

        {/* ── Section 3: Stellar Alert Logs ── */}
        <section className="flex flex-col gap-6">
          <div className="flex items-center gap-2 border-b border-[#E2E0DB] pb-2">
            <Zap className="w-5 h-5 text-indigo-600" />
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-widest">Stellar Auto-Response Logs</h2>
          </div>

        {/* ── Alert Event Log ── */}
        {alertEvents.length > 0 && (
          <div className="bg-white border border-rose-200 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Zap className="w-4 h-4 text-rose-600" />
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                Auto-Triggered Stellar Alerts This Session
              </h3>
              <span className="text-[10px] font-extrabold bg-rose-100 text-rose-700 border border-rose-200 px-2 py-0.5 rounded-full">
                {alertEvents.length}
              </span>
            </div>
            <div className="space-y-2">
              {alertEvents.map((ev, i) => (
                <div key={i} className="flex items-center justify-between bg-rose-50/50 border border-rose-100 rounded-xl px-4 py-3">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="w-4 h-4 text-rose-500 flex-shrink-0" />
                    <div>
                      <div className="text-xs font-bold text-rose-800">
                        {ev.riskCategory} Risk · {ev.riskScore}%
                        {ev.diseases?.length ? ` · ${ev.diseases[0]}` : ''}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {new Date(ev.triggeredAt).toLocaleTimeString()} ·{' '}
                        Vet dispatch{' '}
                        <span className={clsx('font-bold', ev.vetPaymentStatus === 'sent' ? 'text-emerald-600' : 'text-amber-600')}>
                          {ev.vetPaymentStatus}
                        </span>
                      </div>
                    </div>
                  </div>
                  {ev.explorerUrl && (
                    <a href={ev.explorerUrl} target="_blank" rel="noopener noreferrer"
                      className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1">
                      <ExternalLink className="w-3 h-3" /> Ledger
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── No alerts yet placeholder ── */}
        {alertEvents.length === 0 && prediction && prediction.riskScore < 70 && (
          <div className="bg-white border border-[#E2E0DB] rounded-2xl p-5 flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0" />
            <div>
              <p className="text-sm font-bold text-slate-700">No auto-alerts fired this session</p>
              <p className="text-xs text-slate-400 mt-0.5">
                Alerts trigger automatically when disease risk ≥ 70%. Current: {prediction.riskScore}%.
              </p>
            </div>
            <a href="https://stellar.expert/explorer/testnet" target="_blank" rel="noopener noreferrer"
              className="ml-auto text-[10px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 flex-shrink-0">
              <TrendingUp className="w-3 h-3" /> Stellar Explorer
            </a>
          </div>
        )}
        </section>

      </main>

    </div>
  )
}
