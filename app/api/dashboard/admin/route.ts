import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const FARMS = [
  { id: 'FARM-001', name: 'Alpha Farm', risk: 22, pfsi: 82, status: 'Low' },
  { id: 'FARM-002', name: 'Beta Farm', risk: 48, pfsi: 61, status: 'Medium' },
  { id: 'FARM-003', name: 'Gamma Farm', risk: 71, pfsi: 45, status: 'High' },
  { id: 'FARM-004', name: 'Delta Farm', risk: 15, pfsi: 91, status: 'Low' },
  { id: 'FARM-005', name: 'Epsilon Farm', risk: 85, pfsi: 32, status: 'Critical' },
]

const PFSI_DISTRIBUTION = [
  { name: 'Excellent (PFSI >= 86)', value: 1, color: '#06b6d4' },
  { name: 'Good (PFSI 66-85)', value: 2, color: '#10b981' },
  { name: 'Moderate (PFSI 41-65)', value: 1, color: '#f59e0b' },
  { name: 'Poor (PFSI <= 40)', value: 1, color: '#f43f5e' },
]

const AUDIT_TRAIL = [
  { farm: 'FARM-001', time: '14:32:10', pfsi: 82, hash: 'a3f8c27948aefb23a9d901...', status: 'Verified' },
  { farm: 'FARM-004', time: '14:28:45', pfsi: 91, hash: 'b7e4a10293da88e2c0af223...', status: 'Verified' },
  { farm: 'FARM-002', time: '14:25:18', pfsi: 61, hash: 'c9d3b51203aa77efc0ae114...', status: 'Pending' },
  { farm: 'FARM-003', time: '14:20:33', pfsi: 45, hash: 'd2f6e80192ea2837bc0a332...', status: 'Verified' },
  { farm: 'FARM-005', time: '14:15:01', pfsi: 32, hash: 'e1a9c79203ee8c2278cb445...', status: 'Alert' },
]

export async function GET() {
  try {
    const totalFarms = FARMS.length
    const highRiskCount = FARMS.filter(f => f.risk >= 50).length
    const averageDistrictPFSI = Math.round(FARMS.reduce((acc, f) => acc + f.pfsi, 0) / totalFarms)
    const totalTxs = AUDIT_TRAIL.length

    return NextResponse.json({
      success: true,
      summary: {
        totalFarms,
        highRiskCount,
        averageDistrictPFSI,
        totalTransactions: totalTxs
      },
      farms: FARMS,
      pfsiDistribution: PFSI_DISTRIBUTION,
      auditTrail: AUDIT_TRAIL
    })
  } catch (error) {
    console.error('Failed to aggregate admin dashboard data:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}
