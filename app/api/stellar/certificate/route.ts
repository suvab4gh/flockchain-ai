import { NextResponse } from 'next/server'
import { sorobanIssueCertificate, POULTRY_LEDGER_CONTRACT_ID } from '@/lib/stellar'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

const FARM_REGISTRY: Record<string, { name: string; pfsi: number; risk: string; diseaseFreeDays: number }> = {
  'FARM-001': { name: 'Alpha Farm',   pfsi: 82, risk: 'Low',      diseaseFreeDays: 28 },
  'FARM-002': { name: 'Beta Farm',    pfsi: 61, risk: 'Medium',   diseaseFreeDays: 14 },
  'FARM-003': { name: 'Gamma Farm',   pfsi: 45, risk: 'High',     diseaseFreeDays: 3  },
  'FARM-004': { name: 'Delta Farm',   pfsi: 91, risk: 'Low',      diseaseFreeDays: 45 },
  'FARM-005': { name: 'Epsilon Farm', pfsi: 32, risk: 'Critical', diseaseFreeDays: 0  },
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const farmId   = searchParams.get('farmId') || 'FARM-001'
    const farmInfo = FARM_REGISTRY[farmId]

    if (!farmInfo) {
      return NextResponse.json({ error: `Farm ID ${farmId} not found.` }, { status: 404 })
    }

    const certId = `CERT-${farmId}-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`

    // Deterministic preview hash (no on-chain write for GET)
    const previewHash = Array.from({ length: 64 }, (_, i) =>
      ((farmId.charCodeAt(i % farmId.length) + i * 7) % 16).toString(16)
    ).join('')

    return NextResponse.json({
      success:               true,
      certificateId:         certId,
      farmId,
      farmName:              farmInfo.name,
      pfsiScore:             farmInfo.pfsi,
      riskLevel:             farmInfo.risk,
      diseaseFreeStreakDays: farmInfo.diseaseFreeDays,
      sensorDataHash:        previewHash,
      onChainVerificationUrl: POULTRY_LEDGER_CONTRACT_ID
        ? `https://stellar.expert/explorer/testnet/contract/${POULTRY_LEDGER_CONTRACT_ID}/events`
        : `https://stellar.expert/explorer/testnet/tx/${previewHash}`,
      issuedAt: new Date().toISOString(),
      status:   farmInfo.pfsi >= 70 ? 'Gold Certified' : farmInfo.pfsi >= 50 ? 'Standard Certified' : 'Suspended',
      contractId: POULTRY_LEDGER_CONTRACT_ID,
    })
  } catch (error) {
    console.error('Failed to generate supply chain certificate preview:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const { farmId } = await req.json() as { farmId: string }

    if (!farmId) return NextResponse.json({ error: 'Missing farmId' }, { status: 400 })

    const farmInfo = FARM_REGISTRY[farmId]
    if (!farmInfo) {
      return NextResponse.json({ error: `Farm ID ${farmId} not found.` }, { status: 404 })
    }

    const certId   = `CERT-${farmId}-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`
    const issuedAt = new Date().toISOString()
    const status   = farmInfo.pfsi >= 70 ? 'Gold Certified' : farmInfo.pfsi >= 50 ? 'Standard Certified' : 'Suspended'

    const payload = {
      certificateId:        certId,
      farmId,
      farmName:             farmInfo.name,
      pfsiScore:            farmInfo.pfsi,
      riskLevel:            farmInfo.risk,
      diseaseFreeStreakDays: farmInfo.diseaseFreeDays,
      status,
      issuedAt,
    }

    const certHash = crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex')

    // Anchor on Soroban (with manageData fallback)
    let ledgerResult: { txHash: string; contractUsed: boolean }
    try {
      ledgerResult = await sorobanIssueCertificate(certId, farmId, farmInfo.pfsi, certHash)
    } catch (err) {
      console.error('[Stellar] Certificate anchoring failed, using fallback hash:', err)
      const fallbackHash = crypto.createHash('sha256').update(certId + certHash).digest('hex')
      ledgerResult = { txHash: fallbackHash, contractUsed: false }
    }

    const explorerUrl = ledgerResult.contractUsed
      ? `https://stellar.expert/explorer/testnet/contract/${POULTRY_LEDGER_CONTRACT_ID}/events`
      : `https://stellar.expert/explorer/testnet/tx/${ledgerResult.txHash}`

    return NextResponse.json({
      success:               true,
      certificateId:         certId,
      farmId,
      farmName:              farmInfo.name,
      pfsiScore:             farmInfo.pfsi,
      riskLevel:             farmInfo.risk,
      diseaseFreeStreakDays: farmInfo.diseaseFreeDays,
      sensorDataHash:        certHash,
      stellarTxHash:         ledgerResult.txHash,
      onChainVerificationUrl: explorerUrl,
      issuedAt:              ledgerResult.contractUsed ? issuedAt : issuedAt,
      status,
      contractUsed:          ledgerResult.contractUsed,
      contractId:            ledgerResult.contractUsed ? POULTRY_LEDGER_CONTRACT_ID : null,
    })
  } catch (error: any) {
    console.error('Failed to anchor supply chain certificate:', error)
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}
