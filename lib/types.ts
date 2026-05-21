export interface SensorData {
  sensor_id: number; nh3: number; co2: number; temperature: number; humidity: number; tds: number; timestamp: string
}
export interface WeatherData {
  outdoorTemp: number; outdoorHumidity: number; weatherCondition: string; pressure: number; windSpeed: number; rainForecast: string; icon: string; description: string
}
export interface AIPrediction {
  riskScore: number; riskCategory: 'Low'|'Medium'|'High'|'Critical'; riskColor: 'green'|'yellow'|'orange'|'red'
  diseases: string[]; predictions: { next12hours: string; next24hours: string; next48hours: string }
  recommendations: { action: string; priority: 'High'|'Medium'|'Low'; description: string }[]
  weatherImpact: string; summary: string
}
export interface PFSIResult {
  score: number; label: string; color: string; emoji: string
  breakdown: { airQuality: number; waterQuality: number; temperature: number; humidity: number; weatherAdaptation: number }
}
export interface StellarTx { hash: string; timestamp: string; ledger: number; explorerUrl: string }
export interface StellarAnchorResult {
  hash?: string
  stellarTxHash: string
  explorerUrl: string
  timestamp: string
  contractUsed?: boolean
  contractId?: string | null
  farmId?: string
  isMock?: boolean
}
export interface MppPaymentStatus {
  mppEnabled: boolean
  sorobanDeployed: boolean
  contractId: string | null
  network: 'testnet' | 'mainnet'
  pricePerPrediction: string
  paymentDescriptor: {
    mpp_version: string
    network: 'testnet' | 'mainnet'
    asset: { code: string; issuer: string }
    amount: string
    description: string
    destination: string
  } | null
}
export interface SorobanCertRecord {
  certId: string
  farmId: string
  farmName?: string
  pfsiScore: string | number
  status: string
  risk?: string
  certHash?: string
  issuedAt: string
  issuer?: string
}
export const DEMO_SCENARIOS: SensorData[] = [
  { sensor_id:1, nh3:8,  co2:600,  temperature:24, humidity:62, tds:280, timestamp:'' },
  { sensor_id:1, nh3:28, co2:1800, temperature:30, humidity:75, tds:420, timestamp:'' },
  { sensor_id:1, nh3:45, co2:2800, temperature:33, humidity:82, tds:510, timestamp:'' },
  { sensor_id:1, nh3:65, co2:3500, temperature:35, humidity:88, tds:650, timestamp:'' },
]
