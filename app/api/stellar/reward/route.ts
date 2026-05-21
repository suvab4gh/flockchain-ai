import { NextResponse } from 'next/server'
import * as StellarSdk from '@stellar/stellar-sdk'
import { getOrCreateServerSecretKey, HORIZON_URL } from '@/lib/stellar'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const { publicKey, pfsiScore } = await req.json() as { publicKey: string; pfsiScore: number }
    
    if (!publicKey || pfsiScore === undefined) {
      return NextResponse.json(
        { error: 'Missing publicKey or pfsiScore' },
        { status: 400 }
      )
    }

    if (pfsiScore < 70) {
      return NextResponse.json(
        { eligible: false, message: `PFSI score ${pfsiScore} is below the reward threshold of 70.` },
        { status: 200 }
      )
    }

    const isMock = publicKey.startsWith('GDEMO')
    if (isMock) {
      const mockTxHash = Array.from({ length: 64 }, () =>
        Math.floor(Math.random() * 16).toString(16)
      ).join('')

      return NextResponse.json({
        eligible: true,
        success: true,
        stellarTxHash: mockTxHash,
        explorerUrl: `https://stellar.expert/explorer/testnet/tx/${mockTxHash}`,
        amount: '10.00 ECO_KUKK',
        recipient: publicKey,
        timestamp: new Date().toISOString(),
        message: 'Sustainability reward distributed (Simulation Mode)'
      })
    }

    const secret = getOrCreateServerSecretKey()
    const server = new StellarSdk.Horizon.Server(HORIZON_URL)
    const sourceKp = StellarSdk.Keypair.fromSecret(secret)
    
    let sourceAccount
    try {
      sourceAccount = await server.loadAccount(sourceKp.publicKey())
    } catch {
      console.log(`[Stellar] Funding reward issuer account ${sourceKp.publicKey()} via Friendbot...`)
      await fetch(`https://friendbot.stellar.org?addr=${sourceKp.publicKey()}`)
      await new Promise((r) => setTimeout(r, 2500))
      sourceAccount = await server.loadAccount(sourceKp.publicKey())
    }

    // Create the transaction to issue ECO_KUKK custom assets to the recipient's wallet
    const asset = new StellarSdk.Asset('ECO_KUKK', sourceKp.publicKey())
    const tx = new StellarSdk.TransactionBuilder(sourceAccount, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: StellarSdk.Networks.TESTNET
    })
      .addOperation(StellarSdk.Operation.payment({
        destination: publicKey,
        asset: asset,
        amount: '10.00' // Issue 10 ECO_KUKK carbon credit tokens
      }))
      .addMemo(StellarSdk.Memo.text(`PFSI Reward: ${pfsiScore.toFixed(0)}`))
      .setTimeout(30)
      .build()

    tx.sign(sourceKp)
    const result = await server.submitTransaction(tx)
    const txHash = (result as { hash: string }).hash

    return NextResponse.json({
      eligible: true,
      success: true,
      stellarTxHash: txHash,
      explorerUrl: `https://stellar.expert/explorer/testnet/tx/${txHash}`,
      amount: '10.00 ECO_KUKK',
      recipient: publicKey,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Failed to disburse Stellar reward:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}
