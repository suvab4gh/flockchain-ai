import { NextResponse } from 'next/server'
import { hashToStellar, sorobanRecordSensorHash, POULTRY_LEDGER_CONTRACT_ID } from '@/lib/stellar'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { sensorData, farmId } = body

    if (!sensorData) {
      return NextResponse.json({ error: 'Missing sensorData' }, { status: 400 })
    }

    // Always compute the SHA-256 hash for the data
    const dataHash = crypto
      .createHash('sha256')
      .update(JSON.stringify({ ...sensorData, recorded_at: new Date().toISOString() }))
      .digest('hex')

    const fId = farmId || 'FARM-UNKNOWN'

    // Try Soroban contract first, fallback to Classic manageData automatically
    let stellarTxHash: string
    let contractUsed = false
    let explorerUrl: string

    try {
      const sorobanResult = await sorobanRecordSensorHash(fId, dataHash)
      stellarTxHash = sorobanResult.txHash
      contractUsed  = sorobanResult.contractUsed
      explorerUrl   = contractUsed
        ? `https://stellar.expert/explorer/testnet/contract/${POULTRY_LEDGER_CONTRACT_ID}/events`
        : `https://stellar.expert/explorer/testnet/tx/${stellarTxHash}`
    } catch (err) {
      console.error('[Stellar] Hash anchoring failed, using mock:', err)
      // Fallback mock for resilience
      const mockTxHash = Array.from({ length: 64 }, () =>
        Math.floor(Math.random() * 16).toString(16)
      ).join('')
      return NextResponse.json({
        hash: dataHash,
        stellarTxHash: mockTxHash,
        explorerUrl: `https://stellar.expert/explorer/testnet/tx/${mockTxHash}`,
        timestamp: new Date().toISOString(),
        contractUsed: false,
        isMock: true,
      })
    }

    return NextResponse.json({
      hash: dataHash,
      stellarTxHash,
      explorerUrl,
      timestamp: new Date().toISOString(),
      contractUsed,
      contractId: contractUsed ? POULTRY_LEDGER_CONTRACT_ID : null,
      farmId: fId,
    })
  } catch (error) {
    console.error('Failed to hash sensor data to Stellar:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
