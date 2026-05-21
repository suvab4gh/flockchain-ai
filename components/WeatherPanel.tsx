'use client'
import { CloudSun, Thermometer, Droplets, Wind, Gauge, Sparkles } from 'lucide-react'
import clsx from 'clsx'
import type { WeatherData, SensorData } from '@/lib/types'

interface Props { weather: WeatherData | null; sensor: SensorData | null; weatherImpact?: string }

export default function WeatherPanel({ weather: w, sensor, weatherImpact }: Props) {
  if (!w) {
    return (
      <div className="glass-card p-6 animate-fade-in">
        <div className="skeleton h-48 w-full" />
      </div>
    )
  }

  const iconUrl = `https://openweathermap.org/img/wn/${w.icon}@2x.png`
  const inTempOk = sensor ? sensor.temperature >= 18 && sensor.temperature <= 28 : true
  const inHumidOk = sensor ? sensor.humidity >= 50 && sensor.humidity <= 70 : true

  return (
    <div className="glass-card p-6 animate-fade-in flex flex-col h-full justify-between">
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <CloudSun className="w-4 h-4 text-amber-500" />
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">
              Weather Correlation
            </h3>
          </div>
          <span className={clsx(
            'text-[9px] font-extrabold px-2 py-0.5 rounded-full border tracking-wide uppercase',
            w.rainForecast.toLowerCase().includes('rain') ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-emerald-50 text-emerald-700 border-emerald-250'
          )}>
            {w.rainForecast}
          </span>
        </div>

        {/* Current Weather Summary */}
        <div className="flex items-center gap-4 bg-slate-50 border border-slate-100 rounded-xl p-3.5 mb-4">
          <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center border border-slate-200/60 flex-shrink-0">
            <img src={iconUrl} alt={w.description} className="w-12 h-12" />
          </div>
          <div>
            <div className="text-sm font-bold text-slate-700">{w.weatherCondition}</div>
            <div className="text-xs text-slate-450 capitalize font-medium">{w.description}</div>
          </div>
        </div>

        {/* Indoor vs Outdoor metrics grid */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          {/* Temperature card */}
          <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
            <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-2">
              <span className="flex items-center gap-1"><Thermometer className="w-3 h-3 text-red-500" />Temp</span>
              <span>18-28°C</span>
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between items-baseline">
                <span className="text-[10px] text-slate-450 font-medium">Indoor</span>
                <span className={clsx('text-xs font-extrabold', inTempOk ? 'text-emerald-600' : 'text-amber-600')}>
                  {sensor?.temperature.toFixed(1) || '--'}°C
                </span>
              </div>
              <div className="flex justify-between items-baseline border-t border-slate-200/50 pt-1.5">
                <span className="text-[10px] text-slate-450 font-medium">Outdoor</span>
                <span className="text-xs font-bold text-sky-600">{w.outdoorTemp.toFixed(1)}°C</span>
              </div>
            </div>
          </div>

          {/* Humidity card */}
          <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
            <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-2">
              <span className="flex items-center gap-1"><Droplets className="w-3 h-3 text-sky-500" />Humid</span>
              <span>50-70%</span>
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between items-baseline">
                <span className="text-[10px] text-slate-450 font-medium">Indoor</span>
                <span className={clsx('text-xs font-extrabold', inHumidOk ? 'text-emerald-600' : 'text-amber-600')}>
                  {sensor?.humidity.toFixed(1) || '--'}%
                </span>
              </div>
              <div className="flex justify-between items-baseline border-t border-slate-200/50 pt-1.5">
                <span className="text-[10px] text-slate-450 font-medium">Outdoor</span>
                <span className="text-xs font-bold text-sky-600">{w.outdoorHumidity}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Secondary Weather details */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          <div className="bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 flex items-center gap-2">
            <Gauge className="w-3.5 h-3.5 text-slate-400" />
            <div>
              <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Pressure</div>
              <div className="text-xs font-bold text-slate-700">{w.pressure} hPa</div>
            </div>
          </div>
          <div className="bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 flex items-center gap-2">
            <Wind className="w-3.5 h-3.5 text-slate-400" />
            <div>
              <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Wind Speed</div>
              <div className="text-xs font-bold text-slate-700">{w.windSpeed} m/s</div>
            </div>
          </div>
        </div>
      </div>

      {/* AI Insight Box */}
      {weatherImpact && (
        <div className="text-[10px] text-slate-600 bg-emerald-50/50 border border-emerald-100 rounded-xl p-3 flex gap-2">
          <Sparkles className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <span className="text-emerald-700 font-extrabold">AI Insight: </span>
            {weatherImpact}
          </div>
        </div>
      )}
    </div>
  )
}
