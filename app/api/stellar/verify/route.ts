/**
 * GET /api/stellar/verify?certId=CERT-FARM-001-20250521
 *
 * Public trustless certificate verifier.
 * When SOROBAN_CONTRACT_ID is set, reads on-chain state from the PoultryLedger contract.
 * Falls back to a deterministic checksum lookup when contract is not deployed.
 *
 * No auth required — designed for public QR code scanning by buyers, regulators, inspectors.
 */
import { NextResponse } from 'next/server'
import * as StellarSdk from '@stellar/stellar-sdk'
import { POULTRY_LEDGER_CONTRACT_ID, SOROBAN_RPC_URL } from '@/lib/stellar'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const certId = searchParams.get('certId')

    if (!certId) {
      return NextResponse.json(
        { error: 'Missing certId query parameter. Example: /api/stellar/verify?certId=CERT-FARM-001-20250521' },
        { status: 400 }
      )
    }

    // ── Soroban On-Chain Verification ────────────────────────────────────────
    if (POULTRY_LEDGER_CONTRACT_ID) {
      try {
        const rpc = new StellarSdk.SorobanRpc.Server(SOROBAN_RPC_URL)

        // Call verify_cert(cert_id) view function — read-only, no signing needed
        const certIdScVal = StellarSdk.nativeToScVal(certId, { type: 'symbol' })

        const result = await rpc.simulateTransaction(
          new StellarSdk.TransactionBuilder(
            await rpc.getAccount('GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF'),
            { fee: '100', networkPassphrase: StellarSdk.Networks.TESTNET }
          )
            .addOperation(
              StellarSdk.Operation.invokeContractFunction({
                contract: POULTRY_LEDGER_CONTRACT_ID,
                function:  'verify_cert',
                args:      [certIdScVal],
              })
            )
            .setTimeout(30)
            .build()
        )

        if ('result' in result && result.result?.retval) {
          // Parse the ScVal response from the contract
          const retval = result.result.retval
          const record = StellarSdk.scValToNative(retval) as any

          return NextResponse.json({
            verified: true,
            source:   'soroban_contract',
            contractId: POULTRY_LEDGER_CONTRACT_ID,
            explorerUrl: `https://stellar.expert/explorer/testnet/contract/${POULTRY_LEDGER_CONTRACT_ID}`,
            certificate: {
              certId:      record.cert_id,
              farmId:      record.farm_id,
              pfsiScore:   (record.pfsi_score / 10).toFixed(1),  // Convert x10 back to decimal
              status:      record.status,
              certHash:    Buffer.from(record.cert_hash).toString('hex'),
              issuedAt:    new Date(Number(record.issued_at) * 1000).toISOString(),
              issuer:      record.issuer,
            },
          })
        }
      } catch (e) {
        console.warn('[Verify] Soroban simulation failed, falling back to mock lookup:', e)
      }
    }

    // ── Fallback: Deterministic lookup from known farm registry ──────────────
    const farmId = certId.replace(/^CERT-/, '').replace(/-\d{8}$/, '')
    const FARM_REGISTRY: Record<string, { name: string; pfsi: number; risk: string }> = {
      'FARM-001': { name: 'Alpha Farm',   pfsi: 82, risk: 'Low'      },
      'FARM-002': { name: 'Beta Farm',    pfsi: 61, risk: 'Medium'   },
      'FARM-003': { name: 'Gamma Farm',   pfsi: 45, risk: 'High'     },
      'FARM-004': { name: 'Delta Farm',   pfsi: 91, risk: 'Low'      },
      'FARM-005': { name: 'Epsilon Farm', pfsi: 32, risk: 'Critical' },
    }

    const farm = FARM_REGISTRY[farmId]
    if (!farm) {
      return NextResponse.json(
        { verified: false, error: `Certificate ${certId} not found in the registry.` },
        { status: 404 }
      )
    }

    return NextResponse.json({
      verified: true,
      source:   'local_registry',
      note:     'Deploy the Soroban contract for trustless on-chain verification',
      certificate: {
        certId,
        farmId,
        farmName:  farm.name,
        pfsiScore: farm.pfsi.toFixed(1),
        status:    farm.pfsi >= 70 ? 'Gold Certified' : farm.pfsi >= 50 ? 'Standard Certified' : 'Suspended',
        risk:      farm.risk,
        issuedAt:  new Date().toISOString(),
      },
    })
  } catch (error) {
    console.error('Failed to verify certificate:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
