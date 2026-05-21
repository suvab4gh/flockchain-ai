'use client'
import { useState, useEffect, useCallback } from 'react'
import {
  Wallet, ExternalLink, Link2, ShieldCheck, Coins,
  AlertTriangle, CheckCircle, Loader2, Info, QrCode,
  RefreshCw
} from 'lucide-react'
import clsx from 'clsx'
import type { MppPaymentStatus, StellarAnchorResult, StellarTx } from '@/lib/types'

interface Props {
  txHistory: StellarTx[]
  pfsiScore: number
  onHashSensor: () => Promise<any>
  hashLoading: boolean
}

interface Notification {
  type: 'success' | 'error' | 'info' | 'pending'
  title: string
  message: string
  actionUrl?: string
  actionText?: string
}

// ── Freighter v2 API helpers (correct types for v2.0.0) ───────────────────────
// isConnected()  → { isConnected: boolean }
// isAllowed()    → { isAllowed: boolean }   (has user approved this site?)
// requestAccess()→ { address: string }      (prompt user to approve + return address)
// getAddress()   → { address: string }      (only works if already allowed)
// signTransaction(xdr, { networkPassphrase }) → { signedTxXdr: string }

async function freighterIsInstalled(): Promise<boolean> {
  try {
    const api = await import('@stellar/freighter-api')
    const res = await api.isConnected()
    // v2 returns { isConnected: boolean }, v1 returns boolean
    if (typeof res === 'object' && res !== null && 'isConnected' in res) {
      return (res as { isConnected: boolean }).isConnected
    }
    return !!res
  } catch {
    return false
  }
}

async function freighterGetAddress(): Promise<string> {
  const api = await import('@stellar/freighter-api')

  // Try v2 requestAccess first (prompts permission popup if needed)
  if (typeof (api as any).requestAccess === 'function') {
    const result = await (api as any).requestAccess()
    if (result?.address) return result.address
    if (result?.error) throw new Error(result.error)
  }

  // v2 getAddress (works if already allowed)
  if (typeof (api as any).getAddress === 'function') {
    const result = await (api as any).getAddress()
    if (result?.address) return result.address
    if (result?.error) throw new Error(result.error)
    if (typeof result === 'string') return result
  }

  // v1 fallback
  if (typeof (api as any).getPublicKey === 'function') {
    const address = await (api as any).getPublicKey()
    if (address && typeof address === 'string') return address
  }

  throw new Error('Could not retrieve address. Please unlock Freighter and ensure this site has permission.')
}

async function freighterSignTx(xdr: string): Promise<string> {
  const api = await import('@stellar/freighter-api')

  const TESTNET_PASSPHRASE = 'Test SDF Network ; September 2015'

  // v2 API: signTransaction(xdr, opts) → { signedTxXdr }
  if (typeof (api as any).signTransaction === 'function') {
    const result = await (api as any).signTransaction(xdr, {
      networkPassphrase: TESTNET_PASSPHRASE,
      network: 'TESTNET',
    })
    // v2 returns object, v1 returns string
    if (typeof result === 'object' && result?.signedTxXdr) return result.signedTxXdr
    if (typeof result === 'string') return result
    throw new Error('signTransaction returned unexpected format')
  }

  throw new Error('Freighter signTransaction is unavailable in this version.')
}

// ── Demo wallet (always works, no extension needed) ─────────────────────────
const DEMO_WALLET = 'GDEMOFLOCKCHAIN99XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX'

export default function StellarPanel({ txHistory, pfsiScore, onHashSensor, hashLoading }: Props) {
  const [walletKey, setWalletKey]         = useState<string | null>(null)
  const [balance, setBalance]             = useState<string>('0.00')
  const [hasTrustline, setHasTrustline]   = useState<boolean | null>(null)
  const [issuerKey, setIssuerKey]         = useState<string | null>(null)
  const [connecting, setConnecting]       = useState(false)
  const [claiming, setClaiming]           = useState(false)
  const [authorizing, setAuthorizing]     = useState(false)
  const [isFreighterInstalled, setIsFreighterInstalled] = useState<boolean | null>(null)
  const [isSimulationMode, setIsSimulationMode]         = useState(false)
  const [notification, setNotification]   = useState<Notification | null>(null)
  const [mppStatus, setMppStatus]         = useState<MppPaymentStatus | null>(null)
  const [lastAnchorMode, setLastAnchorMode] = useState<'soroban' | 'manageData' | 'mock' | null>(null)
  const [freighterError, setFreighterError] = useState<string | null>(null)

  // Detect Freighter on mount
  useEffect(() => {
    freighterIsInstalled()
      .then(ok => setIsFreighterInstalled(ok))
      .catch(() => setIsFreighterInstalled(false))
  }, [])

  useEffect(() => {
    fetch('/api/mpp/status')
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setMppStatus(data) })
      .catch(() => {})
  }, [])

  const fetchBalanceAndTrustline = useCallback(async (address: string) => {
    try {
      const res = await fetch(`/api/stellar/balance?publicKey=${address}`)
      const data = await res.json()
      setBalance(data.balance || '0.00')
      setHasTrustline(!!data.hasTrustline)
      setIssuerKey(data.issuerPublicKey || null)
    } catch {
      setBalance('0.00')
      setHasTrustline(false)
    }
  }, [])

  // ── Connect real Freighter wallet ──────────────────────────────────────────
  async function connectWallet() {
    setConnecting(true)
    setFreighterError(null)
    setNotification({
      type: 'pending',
      title: 'Connecting Freighter',
      message: 'Check the Freighter extension — approve the connection request.',
    })
    try {
      const address = await freighterGetAddress()
      if (!address) throw new Error('Empty address returned from Freighter.')

      setWalletKey(address)
      setIsSimulationMode(false)
      await fetchBalanceAndTrustline(address)
      setNotification({
        type: 'success',
        title: 'Wallet Connected ✓',
        message: `Freighter linked: ${address.slice(0, 6)}...${address.slice(-6)} on Stellar Testnet.`,
      })
    } catch (e: any) {
      const msg: string = e?.message || 'Unknown error'
      setFreighterError(msg)
      setNotification({
        type: 'error',
        title: 'Connection Failed',
        message: buildFreighterErrorMessage(msg),
      })
    }
    setConnecting(false)
  }

  // ── Demo sandbox mode (no Freighter needed) ──────────────────────────────
  async function connectDemoMode() {
    setConnecting(true)
    setFreighterError(null)
    setNotification({ type: 'pending', title: 'Activating Demo Mode', message: 'Loading sandbox wallet...' })
    await new Promise(r => setTimeout(r, 800))
    setWalletKey(DEMO_WALLET)
    setIsSimulationMode(true)
    await fetchBalanceAndTrustline(DEMO_WALLET)
    setNotification({
      type: 'success',
      title: 'Demo Mode Active',
      message: 'Using sandbox wallet. All Stellar transactions are simulated with realistic mock data.',
    })
    setConnecting(false)
  }

  // ── Trustline ─────────────────────────────────────────────────────────────
  async function authorizeToken() {
    if (!walletKey) return
    setAuthorizing(true)
    setNotification({ type: 'pending', title: 'Authorizing Trustline', message: 'Requesting ECO_KUKK trustline signature from Freighter...' })
    try {
      const res = await fetch('/api/stellar/trustline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', publicKey: walletKey }),
      })
      const data = await res.json()

      let signedXdr = ''
      if (data.isMock || isSimulationMode) {
        await new Promise(r => setTimeout(r, 1500))
        signedXdr = 'mock_signed_xdr'
      } else {
        signedXdr = await freighterSignTx(data.unsignedXdr)
      }

      setNotification({ type: 'pending', title: 'Submitting to Ledger', message: 'Submitting changeTrust envelope to Stellar Testnet Horizon...' })

      const submitRes = await fetch('/api/stellar/trustline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'submit', signedXdr, isMock: data.isMock || isSimulationMode }),
      })
      const submitData = await submitRes.json()

      if (submitData.success) {
        setHasTrustline(true)
        await fetchBalanceAndTrustline(walletKey)
        setNotification({
          type: 'success',
          title: 'Trustline Authorized!',
          message: 'ECO_KUKK trustline established. You can now receive carbon credit rewards.',
          actionUrl: submitData.explorerUrl,
          actionText: 'Verify on Ledger',
        })
      } else {
        throw new Error(submitData.error || 'Ledger rejected the changeTrust transaction.')
      }
    } catch (e: any) {
      setNotification({ type: 'error', title: 'Authorization Failed', message: e.message || 'Signing or submission error.' })
    }
    setAuthorizing(false)
  }

  // ── Claim reward ──────────────────────────────────────────────────────────
  async function claimReward() {
    if (!walletKey || pfsiScore < 70) return
    setClaiming(true)
    setNotification({ type: 'pending', title: 'Minting Reward', message: 'Issuing 10 ECO_KUKK carbon credits to your wallet...' })
    try {
      const res = await fetch('/api/stellar/reward', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publicKey: walletKey, pfsiScore }),
      })
      const data = await res.json()
      if (data.success) {
        setBalance(prev => (parseFloat(prev) + 10).toFixed(2))
        setNotification({
          type: 'success',
          title: '10 ECO_KUKK Minted!',
          message: 'Carbon credits transferred to your wallet. Blockchain-verified biosecurity reward.',
          actionUrl: data.explorerUrl,
          actionText: 'View Transaction',
        })
      } else {
        throw new Error(data.message || 'Reward claim failed.')
      }
    } catch (e: any) {
      setNotification({ type: 'error', title: 'Claim Failed', message: e.message })
    }
    setClaiming(false)
  }

  // ── Hash telemetry ────────────────────────────────────────────────────────
  async function handleHashTelemetry() {
    setNotification({ type: 'pending', title: 'Anchoring Telemetry', message: 'SHA-256 hashing live sensor batch and recording on Stellar...' })
    try {
      const res = await onHashSensor() as StellarAnchorResult | null
      if (res?.stellarTxHash) {
        setLastAnchorMode(res.isMock ? 'mock' : res.contractUsed ? 'soroban' : 'manageData')
        setNotification({
          type: 'success',
          title: 'Telemetry Anchored!',
          message: res.contractUsed
            ? 'Recorded via Soroban smart contract.'
            : res.isMock ? 'Demo mode — mock hash generated.'
            : 'Recorded via Classic Horizon manageData.',
          actionUrl: res.explorerUrl,
          actionText: 'Verify on Ledger',
        })
      } else {
        throw new Error('Record submission failed — no tx hash returned.')
      }
    } catch (e: any) {
      setNotification({ type: 'error', title: 'Anchoring Failed', message: e.message })
    }
  }

  const truncate = (key: string) => key.length > 12 ? `${key.slice(0, 6)}...${key.slice(-6)}` : key
  const todayCertId = `CERT-FARM-001-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`
  const verifyUrl = `/api/stellar/verify?certId=${todayCertId}`

  return (
    <div className="bg-white border border-[#E2E0DB] rounded-2xl p-5 flex flex-col h-full relative overflow-hidden">

      {/* ── Notification overlay ── */}
      {notification && (
        <div className="absolute inset-0 bg-white/97 backdrop-blur-sm rounded-2xl flex flex-col items-center justify-center p-6 text-center z-20">
          <div className="w-14 h-14 rounded-full flex items-center justify-center mb-4 bg-slate-50 border border-[#E2E0DB]">
            {notification.type === 'success' && <CheckCircle className="w-7 h-7 text-emerald-600" />}
            {notification.type === 'error'   && <AlertTriangle className="w-7 h-7 text-rose-600 animate-pulse" />}
            {notification.type === 'pending' && <Loader2 className="w-7 h-7 text-indigo-600 animate-spin" />}
            {notification.type === 'info'    && <ShieldCheck className="w-7 h-7 text-cyan-600" />}
          </div>
          <h4 className="text-sm font-bold text-slate-900 mb-2">{notification.title}</h4>
          <p className="text-xs text-slate-500 leading-relaxed max-w-[240px] mb-5">{notification.message}</p>
          <div className="flex flex-col gap-2 w-full max-w-xs">
            {notification.actionUrl && (
              <a href={notification.actionUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 bg-indigo-600 text-white text-xs font-bold py-2.5 rounded-xl hover:bg-indigo-700 transition-colors">
                <ExternalLink className="w-3.5 h-3.5" />
                {notification.actionText || 'View on Stellar'}
              </a>
            )}
            {notification.type !== 'pending' && (
              <button onClick={() => setNotification(null)}
                className="text-xs font-bold text-slate-500 border border-[#E2E0DB] py-2.5 rounded-xl hover:bg-slate-50 transition-colors">
                Dismiss
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Link2 className="w-4 h-4 text-indigo-600" />
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Stellar Trust Layer</h3>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={clsx(
            'text-[10px] font-extrabold px-2 py-0.5 rounded-full border uppercase tracking-wider',
            isSimulationMode
              ? 'bg-amber-50 text-amber-700 border-amber-200'
              : 'bg-indigo-50 text-indigo-700 border-indigo-200'
          )}>
            {isSimulationMode ? 'Demo Mode' : 'Testnet'}
          </span>
          <span className={clsx(
            'text-[10px] font-extrabold px-2 py-0.5 rounded-full border uppercase tracking-wider',
            mppStatus?.mppEnabled
              ? 'bg-amber-50 text-amber-700 border-amber-200'
              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
          )}>
            {mppStatus?.mppEnabled ? `MPP ${mppStatus.pricePerPrediction}` : 'Free'}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-3 flex-1">

        {/* ── Freighter not installed ── */}
        {isFreighterInstalled === false && !walletKey && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center space-y-3">
            <Info className="w-5 h-5 text-amber-600 mx-auto" />
            <div>
              <p className="text-xs font-bold text-amber-900">Freighter Extension Not Found</p>
              <p className="text-[10px] text-amber-700 mt-1 leading-relaxed">
                Install the Freighter Chrome extension to use real Stellar transactions, or use Demo Mode to explore all features.
              </p>
            </div>
            <div className="flex gap-2">
              <a href="https://www.freighter.app/" target="_blank" rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-1 bg-indigo-600 text-white text-[10px] font-bold py-2 rounded-lg hover:bg-indigo-700 transition-colors">
                Install Freighter
              </a>
              <button onClick={connectDemoMode} disabled={connecting}
                className="flex-1 text-[10px] font-bold text-amber-800 bg-amber-100 border border-amber-300 py-2 rounded-lg hover:bg-amber-200 transition-colors">
                Use Demo Mode
              </button>
            </div>
          </div>
        )}

        {/* ── Freighter connection error detail ── */}
        {freighterError && !walletKey && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 space-y-2">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-rose-800">Connection Error</p>
                <p className="text-[10px] text-rose-700 mt-1 leading-relaxed">{buildFreighterErrorMessage(freighterError)}</p>
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={connectWallet} disabled={connecting}
                className="flex-1 flex items-center justify-center gap-1 text-[10px] font-bold bg-white border border-rose-300 text-rose-700 py-2 rounded-lg hover:bg-rose-50 transition-colors">
                <RefreshCw className={clsx('w-3 h-3', connecting && 'animate-spin')} /> Retry
              </button>
              <button onClick={connectDemoMode} disabled={connecting}
                className="flex-1 text-[10px] font-bold text-slate-700 bg-slate-100 border border-slate-200 py-2 rounded-lg hover:bg-slate-200 transition-colors">
                Demo Mode
              </button>
            </div>
          </div>
        )}

        {/* ── Connect button (when Freighter detected, not yet connected) ── */}
        {!walletKey && isFreighterInstalled !== false && (
          <div className="space-y-2">
            <button onClick={connectWallet} disabled={connecting}
              className="w-full flex items-center justify-center gap-2 bg-slate-900 text-white text-xs font-bold py-3 rounded-xl hover:bg-slate-800 active:scale-[0.98] transition-all disabled:opacity-50">
              {connecting
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Connecting…</>
                : <><Wallet className="w-4 h-4" /> Connect Freighter Wallet</>
              }
            </button>

            {/* Setup checklist */}
            {isFreighterInstalled === null && (
              <p className="text-[10px] text-slate-400 text-center">Checking for Freighter extension…</p>
            )}
            {isFreighterInstalled === true && !connecting && (
              <div className="bg-[#F7F6F3] border border-[#E2E0DB] rounded-xl p-3 space-y-1.5">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Before connecting — check:</p>
                {[
                  'Freighter extension is unlocked',
                  'Freighter is set to Testnet (not Mainnet)',
                  'You have at least 1 funded testnet account',
                ].map(tip => (
                  <div key={tip} className="flex items-center gap-2 text-[10px] text-slate-600">
                    <CheckCircle className="w-3 h-3 text-emerald-500 flex-shrink-0" />
                    {tip}
                  </div>
                ))}
                <div className="border-t border-[#E2E0DB] pt-2 mt-2">
                  <button onClick={connectDemoMode}
                    className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 transition-colors">
                    → Or use Demo Mode (no wallet needed)
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Connected wallet card ── */}
        {walletKey && (
          <div className="space-y-3">
            <div className="bg-[#F7F6F3] border border-[#E2E0DB] rounded-xl p-3.5">
              <div className="flex items-center justify-between mb-2">
                <span className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  <Wallet className="w-3.5 h-3.5 text-indigo-600" /> Account
                </span>
                <div className="flex items-center gap-1.5">
                  <span className={clsx(
                    'text-[10px] font-extrabold px-1.5 py-0.5 rounded-md border uppercase',
                    isSimulationMode
                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                      : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  )}>
                    {isSimulationMode ? 'Demo' : 'Freighter ✓'}
                  </span>
                  <button onClick={() => { setWalletKey(null); setBalance('0.00'); setHasTrustline(null); setFreighterError(null) }}
                    className="text-[9px] text-slate-400 hover:text-rose-500 transition-colors font-bold">
                    Disconnect
                  </button>
                </div>
              </div>
              <div className="text-[10px] font-mono font-bold text-indigo-700 break-all mb-3">{walletKey}</div>
              <div className="flex items-center justify-between border-t border-[#E2E0DB] pt-2.5">
                <span className="text-[10px] text-slate-400 font-bold uppercase">ECO_KUKK Balance</span>
                <div className="flex items-center gap-1.5">
                  <Coins className="w-4 h-4 text-amber-500" />
                  <span className="text-base font-black text-amber-600 font-mono">{balance}</span>
                </div>
              </div>
            </div>

            {/* Trustline needed */}
            {hasTrustline === false && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 space-y-2.5">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold text-amber-900">Trustline Required</p>
                    <p className="text-[10px] text-amber-700 mt-0.5 leading-relaxed">
                      Your wallet needs an ECO_KUKK trustline to receive carbon credit rewards.
                    </p>
                  </div>
                </div>
                <button onClick={authorizeToken} disabled={authorizing}
                  className="w-full flex items-center justify-center gap-2 bg-amber-600 text-white text-xs font-bold py-2.5 rounded-xl hover:bg-amber-700 transition-colors disabled:opacity-50">
                  {authorizing
                    ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Authorizing…</>
                    : <><CheckCircle className="w-3.5 h-3.5" /> Authorize ECO_KUKK Trustline</>
                  }
                </button>
              </div>
            )}

            {/* PFSI reward */}
            {hasTrustline === true && (
              pfsiScore >= 70 ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span className="text-xs font-bold text-emerald-800">PFSI Reward Eligible — Score: {pfsiScore.toFixed(1)}</span>
                  </div>
                  <button onClick={claimReward} disabled={claiming}
                    className="w-full flex items-center justify-center gap-2 bg-emerald-600 text-white text-xs font-bold py-3 rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-50">
                    {claiming
                      ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Minting…</>
                      : <><Coins className="w-3.5 h-3.5" /> Claim +10 ECO_KUKK Carbon Credits</>
                    }
                  </button>
                </div>
              ) : (
                <div className="bg-slate-50 border border-[#E2E0DB] rounded-xl px-3 py-2.5 text-center">
                  <p className="text-[10px] text-slate-500 font-semibold">
                    🌱 Raise PFSI to <span className="text-emerald-600 font-bold">≥ 70</span> to claim rewards
                    <span className="text-slate-400"> (Current: {pfsiScore.toFixed(1)})</span>
                  </p>
                </div>
              )
            )}
          </div>
        )}

        {/* ── Anchor sensor hash ── */}
        <button onClick={handleHashTelemetry} disabled={hashLoading}
          className="w-full flex items-center justify-center gap-2 bg-white border border-[#E2E0DB] text-slate-700 text-xs font-bold py-2.5 rounded-xl hover:border-slate-400 transition-colors disabled:opacity-50">
          {hashLoading
            ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Anchoring…</>
            : <><Link2 className="w-3.5 h-3.5" /> Anchor Sensor Hash to Ledger</>
          }
        </button>

        {/* ── Contract mode + Verify cert ── */}
        <div className="grid grid-cols-2 gap-2">
          <div className={clsx(
            'rounded-xl border px-3 py-2 text-center',
            lastAnchorMode === 'soroban' ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-slate-50 border-[#E2E0DB] text-slate-500'
          )}>
            <div className="text-[9px] font-extrabold uppercase tracking-widest">Contract Mode</div>
            <div className="text-[10px] font-bold mt-0.5">
              {lastAnchorMode === 'soroban' ? '✓ Soroban'
                : lastAnchorMode === 'manageData' ? 'manageData'
                : lastAnchorMode === 'mock' ? 'Demo Mock'
                : mppStatus?.sorobanDeployed ? 'Soroban Ready' : 'Classic'}
            </div>
          </div>
          <a href={verifyUrl} target="_blank" rel="noopener noreferrer"
            className="rounded-xl border border-cyan-200 bg-cyan-50 px-3 py-2 text-center hover:bg-cyan-100 transition-colors">
            <div className="flex items-center justify-center gap-1 text-[9px] font-extrabold text-cyan-700 uppercase tracking-widest">
              <QrCode className="w-3 h-3" /> Verify
            </div>
            <div className="text-[10px] font-bold text-cyan-700 mt-0.5">Farm Cert</div>
          </a>
        </div>
      </div>

      {/* ── Tx history ── */}
      {txHistory.length > 0 && (
        <div className="mt-4 border-t border-[#E2E0DB] pt-4">
          <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-2">Ledger Audit Trail</div>
          <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
            {txHistory.slice(0, 4).map((tx, i) => (
              <a key={i} href={tx.explorerUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-between bg-[#F7F6F3] border border-[#E2E0DB] rounded-xl px-3.5 py-2 hover:border-slate-300 transition-colors group">
                <div>
                  <div className="text-[10px] font-mono font-bold text-indigo-600">{truncate(tx.hash)}</div>
                  <div className="text-[9px] text-slate-400 mt-0.5">{new Date(tx.timestamp).toLocaleTimeString()}</div>
                </div>
                <ExternalLink className="w-3 h-3 text-slate-300 group-hover:text-indigo-600 transition-colors" />
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Human-readable error messages ────────────────────────────────────────────
function buildFreighterErrorMessage(raw: string): string {
  const r = raw.toLowerCase()
  if (r.includes('rejected') || r.includes('denied') || r.includes('user refused'))
    return 'You declined the connection request in Freighter. Click Connect again and approve.'
  if (r.includes('not allowed') || r.includes('not authorized') || r.includes('permission'))
    return 'This site needs permission. Open Freighter → Settings → Trusted Sites → Add this URL.'
  if (r.includes('testnet') || r.includes('network') || r.includes('passphrase'))
    return 'Network mismatch. Open Freighter → Network → Switch to Testnet.'
  if (r.includes('locked') || r.includes('unlock'))
    return 'Freighter is locked. Click the extension icon and enter your password.'
  if (r.includes('no account') || r.includes('empty address'))
    return 'No account found. Create a Stellar Testnet account in Freighter first.'
  if (r.includes('could not retrieve') || r.includes('undefined'))
    return 'Freighter returned no address. Ensure it is set to Testnet, unlocked, and has at least one account.'
  return `${raw} — Check Freighter is unlocked, set to Testnet, and this site is trusted.`
}
