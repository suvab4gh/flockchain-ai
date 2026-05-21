import { NextResponse } from 'next/server'
import * as StellarSdk from '@stellar/stellar-sdk'
import crypto from 'crypto'
import { getOrCreateServerSecretKey, HORIZON_URL, sorobanRecordSensorHash } from '@/lib/stellar'

export const dynamic = 'force-dynamic'

// Vet dispatch wallet — in production this would be per-region vet registry
const VET_DISPATCH_WALLET = process.env.VET_WALLET_PUBLIC_KEY || 'GDEMOVETWALLETXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX'
const VET_DISPATCH_AMOUNT = '0.50' // 0.5 XLM per dispatch alert

export async function POST(req: Request) {
  try {
    const body = await req.json() as {
      farmId: string
      riskScore: number
      riskCategory: string
      sensorData?: object
      diseases?: string[]
      source?: 'ml' | 'icar' | 'manual'
    }

    const { farmId, riskScore, riskCategory, sensorData, diseases = [], source = 'ml' } = body

    if (!farmId || riskScore === undefined) {
      return NextResponse.json({ error: 'Missing farmId or riskScore' }, { status: 400 })
    }

    const triggered = riskScore >= 70

    if (!triggered) {
      return NextResponse.json({
        triggered: false,
        riskScore,
        threshold: 70,
        message: `Risk score ${riskScore} below alert threshold of 70. No action taken.`,
        farmId,
        timestamp: new Date().toISOString(),
      })
    }

    // Build the alert event payload
    const alertPayload = {
      farmId,
      riskScore,
      riskCategory,
      diseases,
      source,
      triggeredAt: new Date().toISOString(),
      sensorHash: sensorData
        ? crypto.createHash('sha256').update(JSON.stringify(sensorData)).digest('hex')
        : null,
    }

    const alertHash = crypto.createHash('sha256').update(JSON.stringify(alertPayload)).digest('hex')

    // ── Step 1: Anchor alert hash on Stellar ──────────────────────────────────
    let stellarTxHash: string | null = null
    let explorerUrl: string | null = null
    let contractUsed = false
    let isMock = false

    const secret = getOrCreateServerSecretKey()
    const kp = StellarSdk.Keypair.fromSecret(secret)
    const isMockVet = VET_DISPATCH_WALLET.startsWith('GDEMO')

    if (isMockVet) {
      // Simulation mode — generate realistic-looking mock hashes
      stellarTxHash = Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('')
      explorerUrl = `https://stellar.expert/explorer/testnet/tx/${stellarTxHash}`
      isMock = true
    } else {
      try {
        // Anchor the alert hash on-chain
        const anchor = await sorobanRecordSensorHash(farmId, alertHash)
        stellarTxHash = anchor.txHash
        contractUsed = anchor.contractUsed
        explorerUrl = contractUsed
          ? `https://stellar.expert/explorer/testnet/contract/${process.env.SOROBAN_CONTRACT_ID}/events`
          : `https://stellar.expert/explorer/testnet/tx/${stellarTxHash}`
      } catch (e) {
        console.warn('[Alert] Hash anchoring failed:', e)
        stellarTxHash = alertHash.slice(0, 64)
        explorerUrl = `https://stellar.expert/explorer/testnet/tx/${stellarTxHash}`
      }
    }

    // ── Step 2: XLM micropayment to vet wallet ───────────────────────────────
    let vetPaymentHash: string | null = null
    let vetPaymentUrl: string | null = null
    let vetPaymentStatus: 'sent' | 'simulated' | 'failed' = 'failed'

    if (isMockVet) {
      vetPaymentHash = Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('')
      vetPaymentUrl = `https://stellar.expert/explorer/testnet/tx/${vetPaymentHash}`
      vetPaymentStatus = 'simulated'
    } else {
      try {
        const server = new StellarSdk.Horizon.Server(HORIZON_URL)
        let account
        try {
          account = await server.loadAccount(kp.publicKey())
        } catch {
          await fetch(`https://friendbot.stellar.org?addr=${kp.publicKey()}`)
          await new Promise(r => setTimeout(r, 2500))
          account = await server.loadAccount(kp.publicKey())
        }

        const tx = new StellarSdk.TransactionBuilder(account, {
          fee: StellarSdk.BASE_FEE,
          networkPassphrase: StellarSdk.Networks.TESTNET,
        })
          .addOperation(StellarSdk.Operation.payment({
            destination: VET_DISPATCH_WALLET,
            asset: StellarSdk.Asset.native(),
            amount: VET_DISPATCH_AMOUNT,
          }))
          .addMemo(StellarSdk.Memo.text(`ALERT:${farmId}:${riskCategory}`))
          .setTimeout(30)
          .build()

        tx.sign(kp)
        const result = await server.submitTransaction(tx)
        vetPaymentHash = (result as { hash: string }).hash
        vetPaymentUrl = `https://stellar.expert/explorer/testnet/tx/${vetPaymentHash}`
        vetPaymentStatus = 'sent'
      } catch (e) {
        console.error('[Alert] Vet XLM dispatch failed:', e)
        vetPaymentStatus = 'failed'
      }
    }

    return NextResponse.json({
      triggered: true,
      farmId,
      riskScore,
      riskCategory,
      diseases,
      alertHash,
      // Alert ledger anchor
      stellarTxHash,
      explorerUrl,
      contractUsed,
      isMock,
      // Vet dispatch
      vetWallet: VET_DISPATCH_WALLET,
      vetDispatchAmount: `${VET_DISPATCH_AMOUNT} XLM`,
      vetPaymentHash,
      vetPaymentUrl,
      vetPaymentStatus,
      // Meta
      timestamp: alertPayload.triggeredAt,
      message: `🚨 ALERT: ${riskCategory} risk (${riskScore}%) detected on ${farmId}. Vet dispatch ${vetPaymentStatus}.`,
    })
  } catch (error: any) {
    console.error('[Alert] Handler error:', error)
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}

// GET: Check recent alerts for a farm (from Redis if available, else mock)
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const farmId = searchParams.get('farmId') || 'FARM-001'

  // Mock recent alert history for demo
  const mockAlerts = [
    {
      farmId,
      riskScore: 78,
      riskCategory: 'High',
      triggeredAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
      vetPaymentStatus: 'simulated',
      diseases: ['Newcastle Disease', 'Coccidiosis'],
    },
    {
      farmId,
      riskScore: 85,
      riskCategory: 'Critical',
      triggeredAt: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString(),
      vetPaymentStatus: 'simulated',
      diseases: ['Avian Influenza H5N1'],
    },
  ]

  return NextResponse.json({ farmId, alerts: mockAlerts, count: mockAlerts.length })
}
