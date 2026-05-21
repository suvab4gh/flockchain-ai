import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'FlockChain AI — Smart Poultry Health Monitoring',
  description: 'AI-powered poultry farm health monitoring with real-time IoT sensors, disease prediction, sustainability scoring, and Stellar blockchain carbon credit rewards.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="light" suppressHydrationWarning>
      <body className="animated-bg min-h-screen" suppressHydrationWarning>{children}</body>
    </html>
  )
}
