'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Bird, ShieldCheck, BarChart3, Link2, FileCheck, ArrowLeft,
  ExternalLink, Download, Users, AlertTriangle, Cpu, Globe,
  Loader2, Menu, X, CheckCircle, TrendingUp, Zap, QrCode
} from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import clsx from 'clsx'
import dynamic from 'next/dynamic'

const QRCode = dynamic(() => import('@/components/QRCode'), { ssr: false })

type FarmRow  = { id: string; name: string; risk: number; pfsi: number; status: string }
type PfsiSlice = { name: string; value: number; color: string }
type AuditRow  = { farm: string; time: string; pfsi: number; hash: string; status: string }

const fallbackFarms: FarmRow[] = [
  { id: 'FARM-001', name: 'Alpha Farm',   risk: 22, pfsi: 82, status: 'Low' },
  { id: 'FARM-002', name: 'Beta Farm',    risk: 48, pfsi: 61, status: 'Medium' },
  { id: 'FARM-003', name: 'Gamma Farm',   risk: 71, pfsi: 45, status: 'High' },
  { id: 'FARM-004', name: 'Delta Farm',   risk: 15, pfsi: 91, status: 'Low' },
  { id: 'FARM-005', name: 'Epsilon Farm', risk: 85, pfsi: 32, status: 'Critical' },
]
const fallbackPfsiDist: PfsiSlice[] = [
  { name: 'Excellent', value: 1, color: '#0891b2' },
  { name: 'Good',      value: 2, color: '#10b981' },
  { name: 'Moderate',  value: 1, color: '#f59e0b' },
  { name: 'Poor',      value: 1, color: '#f43f5e' },
]
const fallbackAuditTrail: AuditRow[] = [
  { farm: 'FARM-001', time: '14:32:10', pfsi: 82, hash: 'a3f8c2...d901', status: 'Verified' },
  { farm: 'FARM-004', time: '14:28:45', pfsi: 91, hash: 'b7e4a1...f223', status: 'Verified' },
  { farm: 'FARM-002', time: '14:25:18', pfsi: 61, hash: 'c9d3b5...e114', status: 'Pending' },
  { farm: 'FARM-003', time: '14:20:33', pfsi: 45, hash: 'd2f6e8...a332', status: 'Verified' },
  { farm: 'FARM-005', time: '14:15:01', pfsi: 32, hash: 'e1a9c7...b445', status: 'Alert' },
  { farm: 'FARM-001', time: '14:02:55', pfsi: 79, hash: 'f4b2d6...c556', status: 'Verified' },
]

const STATUS_BADGE: Record<string, string> = {
  Verified: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Pending:  'bg-amber-50   text-amber-700   border-amber-200',
  Alert:    'bg-rose-50    text-rose-700    border-rose-200',
  Low:      'bg-emerald-50 text-emerald-700 border-emerald-200',
  Medium:   'bg-amber-50   text-amber-700   border-amber-200',
  High:     'bg-orange-50  text-orange-700  border-orange-200',
  Critical: 'bg-rose-50    text-rose-700    border-rose-200',
}

const EXPLORER_URL = 'https://stellar.expert/explorer/testnet'

export default function AdminDashboard() {
  const [certFarm, setCertFarm]           = useState('')
  const [certGenerated, setCertGenerated] = useState(false)
  const [generatingCert, setGeneratingCert] = useState(false)
  const [certData, setCertData]           = useState<any>(null)
  const [farms, setFarms]                 = useState<FarmRow[]>(fallbackFarms)
  const [pfsiDist, setPfsiDist]           = useState<PfsiSlice[]>(fallbackPfsiDist)
  const [auditTrail, setAuditTrail]       = useState<AuditRow[]>(fallbackAuditTrail)
  const [dataSource, setDataSource]       = useState<'api' | 'fallback'>('fallback')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [showQR, setShowQR]               = useState(false)

  useEffect(() => {
    let active = true
    fetch('/api/dashboard/admin')
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => {
        if (!active || !data.success) return
        setFarms(data.farms || fallbackFarms)
        setPfsiDist((data.pfsiDistribution || fallbackPfsiDist).map((item: PfsiSlice) => ({
          ...item, name: item.name.replace(/\s*\(.*\)$/, ''),
        })))
        setAuditTrail(data.auditTrail || fallbackAuditTrail)
        setDataSource('api')
      })
      .catch(() => setDataSource('fallback'))
    return () => { active = false }
  }, [])

  const handleGenerateCertificate = async () => {
    if (!certFarm) return
    setGeneratingCert(true)
    setCertGenerated(false)
    setCertData(null)
    try {
      const res = await fetch('/api/stellar/certificate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ farmId: certFarm }),
      })
      const data = await res.json()
      if (data.success) { setCertData(data); setCertGenerated(true) }
    } catch { /* silent */ }
    setGeneratingCert(false)
  }

  const totalFarms = farms.length
  const highRisk   = farms.filter(f => f.risk >= 50).length
  const avgPfsi    = Math.round(farms.reduce((s, f) => s + f.pfsi, 0) / farms.length)
  const certified  = farms.filter(f => f.pfsi >= 70).length

  return (
    <div className="min-h-screen bg-[#F7F6F3] text-slate-900">

      {/* ── Sticky Header ── */}
      <header className="sticky top-0 z-40 bg-[#F7F6F3]/95 backdrop-blur border-b border-[#E2E0DB]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center">
                <Bird className="w-4 h-4 text-white" />
              </div>
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-[#F7F6F3]" />
            </div>
            <div>
              <div className="text-sm font-bold text-slate-900 leading-none">District Command</div>
              <div className="text-[10px] text-slate-400 mt-0.5 font-medium">FlockChain AI · Admin</div>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-3">
            <span className={clsx('text-[10px] font-extrabold px-2 py-1 rounded-full border uppercase tracking-wider',
              dataSource === 'api' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'
            )}>
              {dataSource === 'api' ? 'API Live' : 'Fallback Data'}
            </span>
            <button
              onClick={() => setShowQR(v => !v)}
              className="flex items-center gap-1.5 text-[10px] font-bold text-slate-600 border border-[#E2E0DB] bg-white px-2.5 py-1.5 rounded-lg hover:border-slate-400 transition-colors"
            >
              <QrCode className="w-3.5 h-3.5" /> Stellar QR
            </button>
            <Link href="/farmer" className="text-[10px] font-bold text-slate-500 hover:text-slate-900 flex items-center gap-1">
              <ArrowLeft className="w-3 h-3" /> Farmer
            </Link>
            <Link href="/" className="text-[10px] font-bold text-slate-500 hover:text-slate-900 flex items-center gap-1">
              <ArrowLeft className="w-3 h-3" /> Home
            </Link>
          </div>

          <button className="sm:hidden p-2 rounded-lg border border-[#E2E0DB] bg-white"
            onClick={() => setMobileMenuOpen(v => !v)}>
            {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="sm:hidden border-t border-[#E2E0DB] bg-white px-4 py-3 flex flex-col gap-2">
            <Link href="/farmer" onClick={() => setMobileMenuOpen(false)}
              className="flex items-center justify-center gap-2 border border-[#E2E0DB] py-2.5 rounded-xl text-xs font-bold">
              <ArrowLeft className="w-3.5 h-3.5" /> Farmer Dashboard
            </Link>
            <Link href="/" onClick={() => setMobileMenuOpen(false)}
              className="flex items-center justify-center gap-2 border border-[#E2E0DB] py-2.5 rounded-xl text-xs font-bold">
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Home
            </Link>
          </div>
        )}
      </header>

      {/* ── QR Drawer ── */}
      {showQR && (
        <div className="bg-white border-b border-[#E2E0DB] py-4">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center gap-8 flex-wrap">
            <QRCode url={EXPLORER_URL} size={96} label="Stellar Testnet Explorer" />
            <div>
              <p className="text-sm font-bold text-slate-900 mb-1">Verify on Stellar Ledger</p>
              <p className="text-xs text-slate-500 mb-3 max-w-sm">
                Scan to see all FlockChain AI disease alerts, health certificates, and ECO_KUKK reward transactions anchored on the Stellar testnet.
              </p>
              <a href={EXPLORER_URL} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-800">
                <ExternalLink className="w-3.5 h-3.5" /> {EXPLORER_URL}
              </a>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex flex-col gap-10">

        {/* ── Section 1: District Overview & Analytics ── */}
        <section className="flex flex-col gap-6">
          <div className="flex items-center gap-2 border-b border-[#E2E0DB] pb-2">
            <Globe className="w-5 h-5 text-indigo-600" />
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-widest">District Overview & Analytics</h2>
          </div>

        {/* ── Summary KPIs ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { icon: Globe,         label: 'Total Farms',       value: totalFarms, sub: 'registered',             color: 'text-indigo-600' },
            { icon: AlertTriangle, label: 'High Risk Farms',   value: highRisk,   sub: 'risk ≥ 50%',             color: 'text-rose-600'   },
            { icon: TrendingUp,    label: 'Avg PFSI Score',    value: avgPfsi,    sub: 'district average',       color: 'text-emerald-600' },
            { icon: ShieldCheck,   label: 'HLTH Eligible',     value: certified,  sub: 'PFSI ≥ 70',              color: 'text-amber-600'  },
          ].map((k) => (
            <div key={k.label} className="bg-white border border-[#E2E0DB] rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <k.icon className="w-4 h-4 text-slate-400" />
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{k.label}</span>
              </div>
              <div className={clsx('text-3xl font-black font-mono', k.color)}>{k.value}</div>
              <div className="text-[10px] text-slate-400 font-semibold mt-1">{k.sub}</div>
            </div>
          ))}
        </div>

        {/* ── Charts Row ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* PFSI Bar Chart */}
          <div className="lg:col-span-2 bg-white border border-[#E2E0DB] rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-5">
              <BarChart3 className="w-4 h-4 text-slate-400" />
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Farm Risk vs. PFSI Score</h3>
            </div>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={farms} margin={{ top: 0, right: 0, left: -25, bottom: 0 }} barSize={16}>
                  <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false}
                    tickFormatter={(v: string) => v.split(' ')[0]} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: '#fff', border: '1px solid #E2E0DB', borderRadius: 12, fontSize: 12 }}
                    cursor={{ fill: '#f1f5f9' }}
                  />
                  <Bar dataKey="risk" name="Risk %" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="pfsi" name="PFSI"  fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* PFSI Distribution Pie */}
          <div className="bg-white border border-[#E2E0DB] rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-5">
              <Cpu className="w-4 h-4 text-slate-400" />
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">PFSI Distribution</h3>
            </div>
            <div className="h-36">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pfsiDist} dataKey="value" cx="50%" cy="50%" innerRadius={32} outerRadius={58} paddingAngle={3}>
                    {pfsiDist.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: '#fff', border: '1px solid #E2E0DB', borderRadius: 12, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1.5 mt-2">
              {pfsiDist.map(d => (
                <div key={d.name} className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
                  <span className="text-[10px] text-slate-500 font-semibold">{d.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        </section>

        {/* ── Section 2: Farm Registry ── */}
        <section className="flex flex-col gap-6">
          <div className="flex items-center gap-2 border-b border-[#E2E0DB] pb-2">
            <Users className="w-5 h-5 text-indigo-600" />
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-widest">Farm Registry</h2>
          </div>

        {/* ── Farm Registry Table ── */}
        <div className="bg-white border border-[#E2E0DB] rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E0DB]">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-slate-400" />
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">District Farm Registry</h3>
            </div>
            <a href={EXPLORER_URL} target="_blank" rel="noopener noreferrer"
              className="text-[10px] font-bold text-indigo-600 flex items-center gap-1 hover:text-indigo-800">
              <ExternalLink className="w-3 h-3" /> View on Stellar
            </a>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#F0EEE9]">
                  {['Farm ID', 'Name', 'Risk Score', 'PFSI', 'Status', 'Action'].map(h => (
                    <th key={h} className="px-6 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F7F6F3]">
                {farms.map((farm) => (
                  <tr key={farm.id} className="hover:bg-[#F7F6F3] transition-colors group">
                    <td className="px-6 py-4 text-xs font-mono font-bold text-slate-600">{farm.id}</td>
                    <td className="px-6 py-4 text-sm font-semibold text-slate-800">{farm.name}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${farm.risk}%`,
                              backgroundColor: farm.risk >= 70 ? '#f43f5e' : farm.risk >= 50 ? '#f97316' : '#10b981'
                            }}
                          />
                        </div>
                        <span className="text-xs font-bold text-slate-600">{farm.risk}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs font-bold text-slate-700">{farm.pfsi}</span>
                      {farm.pfsi >= 70 && <span className="ml-1.5 text-[9px] font-extrabold text-amber-600">HLTH✓</span>}
                    </td>
                    <td className="px-6 py-4">
                      <span className={clsx('text-[10px] font-extrabold px-2 py-0.5 rounded-full border', STATUS_BADGE[farm.status])}>
                        {farm.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => { setCertFarm(farm.id); setCertGenerated(false); setCertData(null) }}
                        className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                      >
                        <FileCheck className="w-3 h-3" /> Issue Cert
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        </section>

        {/* ── Section 3: Stellar Proofs & Ledger Audit ── */}
        <section className="flex flex-col gap-6">
          <div className="flex items-center gap-2 border-b border-[#E2E0DB] pb-2">
            <Link2 className="w-5 h-5 text-indigo-600" />
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-widest">Stellar Proofs & Ledger Audit</h2>
          </div>

        {/* ── Certificate Generator + Ledger Audit Row ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* Certificate generator */}
          <div className="bg-white border border-[#E2E0DB] rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-5">
              <ShieldCheck className="w-4 h-4 text-slate-400" />
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Issue HLTH Certificate</h3>
            </div>
            <div className="space-y-3">
              <select
                value={certFarm}
                onChange={e => { setCertFarm(e.target.value); setCertGenerated(false); setCertData(null) }}
                className="w-full border border-[#E2E0DB] rounded-xl px-4 py-3 text-sm bg-white text-slate-700 font-medium focus:outline-none focus:border-indigo-400 transition-colors"
              >
                <option value="">Select a farm…</option>
                {farms.map(f => (
                  <option key={f.id} value={f.id}>
                    {f.id} — {f.name} (PFSI: {f.pfsi})
                  </option>
                ))}
              </select>
              <button
                onClick={handleGenerateCertificate}
                disabled={!certFarm || generatingCert}
                className="w-full flex items-center justify-center gap-2 bg-slate-900 text-white py-3 rounded-xl text-sm font-bold disabled:opacity-50 hover:bg-slate-800 transition-colors"
              >
                {generatingCert
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Anchoring on Stellar…</>
                  : <><ShieldCheck className="w-4 h-4" /> Generate HLTH Certificate</>
                }
              </button>

              {certGenerated && certData && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-3 animate-fade-in">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                    <span className="text-sm font-bold text-emerald-800">Certificate Anchored!</span>
                    <span className={clsx('text-[10px] font-extrabold px-2 py-0.5 rounded-full border ml-auto',
                      certData.contractUsed ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-slate-50 text-slate-600 border-slate-200'
                    )}>
                      {certData.contractUsed ? 'Soroban' : 'Classic Horizon'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div><span className="text-slate-400">Cert ID</span><br /><span className="font-mono font-bold text-slate-700 text-[10px]">{certData.certificateId}</span></div>
                    <div><span className="text-slate-400">PFSI</span><br /><span className="font-bold text-emerald-700">{certData.pfsiScore}</span></div>
                    <div><span className="text-slate-400">Status</span><br /><span className="font-bold text-slate-700">{certData.status}</span></div>
                    <div><span className="text-slate-400">Disease-Free</span><br /><span className="font-bold text-slate-700">{certData.diseaseFreeStreakDays} days</span></div>
                  </div>
                  {certData.stellarTxHash && (
                    <a href={certData.onChainVerificationUrl} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-[10px] font-bold text-indigo-600 hover:text-indigo-800 break-all">
                      <ExternalLink className="w-3 h-3 flex-shrink-0" />
                      {certData.stellarTxHash?.slice(0, 32)}…
                    </a>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        const blob = new Blob([JSON.stringify(certData, null, 2)], { type: 'application/json' })
                        const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
                        a.download = `${certData.certificateId}.json`; a.click()
                      }}
                      className="flex-1 flex items-center justify-center gap-1.5 border border-[#E2E0DB] text-slate-700 py-2 rounded-lg text-xs font-bold hover:bg-slate-50 transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" /> Export JSON
                    </button>
                    {certData.onChainVerificationUrl && (
                      <div className="flex-shrink-0">
                        <QRCode url={certData.onChainVerificationUrl} size={64} />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Audit trail */}
          <div className="bg-white border border-[#E2E0DB] rounded-2xl p-6">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <Link2 className="w-4 h-4 text-slate-400" />
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Ledger Audit Trail</h3>
              </div>
              <a href={EXPLORER_URL} target="_blank" rel="noopener noreferrer"
                className="text-[10px] font-bold text-indigo-600 flex items-center gap-1">
                <ExternalLink className="w-3 h-3" /> Explorer
              </a>
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {auditTrail.map((row, i) => (
                <div key={i} className="flex items-center justify-between bg-[#F7F6F3] rounded-xl px-4 py-3">
                  <div className="flex items-center gap-3">
                    {row.status === 'Alert'
                      ? <AlertTriangle className="w-4 h-4 text-rose-500 flex-shrink-0" />
                      : row.status === 'Verified'
                        ? <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                        : <Loader2 className="w-4 h-4 text-amber-500 flex-shrink-0 animate-spin" />
                    }
                    <div>
                      <div className="text-xs font-bold text-slate-700">{row.farm}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{row.hash}</div>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className={clsx('text-[10px] font-extrabold px-2 py-0.5 rounded-full border', STATUS_BADGE[row.status])}>
                      {row.status}
                    </div>
                    <div className="text-[9px] text-slate-400 mt-0.5">{row.time}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Insurance Claim Status ── */}
        <div className="bg-white border border-[#E2E0DB] rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-5">
            <Zap className="w-4 h-4 text-slate-400" />
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Auto-Triggered Stellar Alerts & Vet Dispatch</h3>
            <span className="text-[10px] font-extrabold bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 rounded-full">Risk ≥ 70% threshold</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { farm: 'FARM-005', risk: 85, riskCat: 'Critical', vetPaid: '0.50 XLM', time: '14:15:01', hash: 'e1a9c7...b445' },
              { farm: 'FARM-003', risk: 71, riskCat: 'High',     vetPaid: '0.50 XLM', time: '14:20:33', hash: 'd2f6e8...a332' },
            ].map((alert, i) => (
              <div key={i} className="border border-rose-200 bg-rose-50/50 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-700">{alert.farm}</span>
                  <span className="text-[10px] font-extrabold bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded-md">{alert.riskCat}</span>
                </div>
                <div className="text-2xl font-black font-mono text-rose-600 mb-1">{alert.risk}%</div>
                <div className="text-[10px] text-slate-500 mb-2">Vet dispatched: <span className="font-bold text-emerald-600">{alert.vetPaid}</span></div>
                <div className="text-[10px] font-mono text-slate-400">{alert.hash}</div>
                <div className="text-[9px] text-slate-400 mt-1">{alert.time}</div>
              </div>
            ))}
            <div className="border border-dashed border-[#E2E0DB] rounded-xl p-4 flex flex-col items-center justify-center text-center gap-2">
              <CheckCircle className="w-6 h-6 text-emerald-400" />
              <p className="text-xs font-bold text-slate-600">3 farms in safe zone</p>
              <p className="text-[10px] text-slate-400">No dispatch needed for FARM-001, -002, -004</p>
            </div>
          </div>
        </div>
        </section>

      </main>
    </div>
  )
}
