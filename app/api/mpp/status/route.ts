/**
 * GET /api/mpp/status
 *
 * Returns the current MPP (Machine Payments Protocol) configuration
 * so the frontend StellarPanel can show payment mode status.
 */
import { NextResponse } from 'next/server'
import { MPP_ENABLED, MPP_AMOUNT, MPP_ASSET_CODE, MPP_NETWORK, buildMppPaymentDescriptor } from '@/lib/mpp'
import { POULTRY_LEDGER_CONTRACT_ID } from '@/lib/stellar'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json({
    mppEnabled:        MPP_ENABLED,
    sorobanDeployed:   !!POULTRY_LEDGER_CONTRACT_ID,
    contractId:        POULTRY_LEDGER_CONTRACT_ID,
    network:           MPP_NETWORK,
    paymentDescriptor: MPP_ENABLED ? buildMppPaymentDescriptor() : null,
    pricePerPrediction: MPP_ENABLED ? `${MPP_AMOUNT} ${MPP_ASSET_CODE}` : 'FREE',
    endpoints: {
      predict:    { method: 'POST', path: '/api/predict',              requiresPayment: MPP_ENABLED },
      hash:       { method: 'POST', path: '/api/stellar/hash',         requiresPayment: false },
      cert:       { method: 'POST', path: '/api/stellar/certificate',  requiresPayment: false },
      verifyCert: { method: 'GET',  path: '/api/stellar/verify',       requiresPayment: false },
      reward:     { method: 'POST', path: '/api/stellar/reward',       requiresPayment: false },
    },
    docs: 'https://developers.stellar.org/docs/build/agentic-payments/mpp',
  })
}
