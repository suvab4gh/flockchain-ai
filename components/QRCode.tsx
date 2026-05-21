'use client'
import { useEffect, useRef } from 'react'
import QRCodeLib from 'qrcode'

interface Props {
  url: string
  size?: number
  label?: string
}

export default function QRCode({ url, size = 120, label }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!canvasRef.current || !url) return
    QRCodeLib.toCanvas(canvasRef.current, url, {
      width: size,
      margin: 2,
      color: { dark: '#0f172a', light: '#ffffff' },
      errorCorrectionLevel: 'M',
    }).catch(console.error)
  }, [url, size])

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="p-2 bg-white rounded-xl border border-[#E2E0DB] shadow-sm">
        <canvas ref={canvasRef} width={size} height={size} className="block rounded-lg" />
      </div>
      {label && (
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center max-w-[120px] leading-tight">
          {label}
        </p>
      )}
    </div>
  )
}
