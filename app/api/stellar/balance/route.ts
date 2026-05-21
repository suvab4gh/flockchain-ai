import { NextResponse } from 'next/server'
import { checkTrustlineAndBalance } from '@/lib/stellar'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const publicKey = searchParams.get('publicKey')
    
    if (!publicKey) {
      return NextResponse.json(
        { error: 'Missing publicKey' },
        { status: 400 }
      )
    }

    const result = await checkTrustlineAndBalance(publicKey)
    
    return NextResponse.json(result)
  } catch (error) {
    console.error('Failed to get Stellar balance:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}

