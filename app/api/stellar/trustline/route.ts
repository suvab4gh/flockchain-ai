import { NextResponse } from 'next/server'
import { createTrustlineTx, submitSignedTx } from '@/lib/stellar'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { action } = body

    if (action === 'create') {
      const { publicKey } = body
      if (!publicKey) {
        return NextResponse.json({ error: 'Missing publicKey' }, { status: 400 })
      }

      const isMock = publicKey.startsWith('GDEMO')
      if (isMock) {
        return NextResponse.json({
          unsignedXdr: 'AAAAAgAAAAAp49x...',
          isMock: true
        })
      }

      const unsignedXdr = await createTrustlineTx(publicKey)
      return NextResponse.json({ unsignedXdr, isMock: false })
    }

    if (action === 'submit') {
      const { signedXdr, isMock } = body
      if (!signedXdr) {
        return NextResponse.json({ error: 'Missing signedXdr' }, { status: 400 })
      }

      if (isMock) {
        // Return a realistic mock transaction hash
        const mockTxHash = Array.from({ length: 64 }, () =>
          Math.floor(Math.random() * 16).toString(16)
        ).join('')

        return NextResponse.json({
          success: true,
          stellarTxHash: mockTxHash,
          explorerUrl: `https://stellar.expert/explorer/testnet/tx/${mockTxHash}`,
          message: 'Trustline successfully established (Simulation Mode)'
        })
      }

      const txHash = await submitSignedTx(signedXdr)
      return NextResponse.json({
        success: true,
        stellarTxHash: txHash,
        explorerUrl: `https://stellar.expert/explorer/testnet/tx/${txHash}`,
        message: 'Trustline successfully established on Testnet!'
      })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error: any) {
    console.error('Failed in trustline route:', error)
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    )
  }
}
