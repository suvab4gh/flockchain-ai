import type { WeatherData } from './types'
const DEFAULT: WeatherData = { outdoorTemp:30, outdoorHumidity:72, weatherCondition:'Partly Cloudy', pressure:1012, windSpeed:3.2, rainForecast:'No rain expected', icon:'02d', description:'scattered clouds' }
export async function fetchWeather(): Promise<WeatherData> {
  const apiKey = process.env.OPENWEATHER_API_KEY, loc = process.env.FARM_LOCATION || 'Kolkata,IN'
  if (!apiKey) return DEFAULT
  try {
    const res = await fetch(`https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(loc)}&appid=${apiKey}&units=metric`, { next: { revalidate: 300 } })
    if (!res.ok) return DEFAULT; const d = await res.json()
    let rain = 'No rain expected'
    try { const f = await fetch(`https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(loc)}&appid=${apiKey}&units=metric&cnt=8`,{next:{revalidate:300}}); if(f.ok){const fd=await f.json();if(fd.list?.find((i:{weather:{main:string}[]})=>i.weather.some((w:{main:string})=>w.main==='Rain')))rain='Rain expected in next 24 hours'} } catch {}
    return { outdoorTemp:Math.round(d.main.temp*10)/10, outdoorHumidity:d.main.humidity, weatherCondition:d.weather?.[0]?.main||'Clear', pressure:d.main.pressure, windSpeed:Math.round(d.wind.speed*10)/10, rainForecast:rain, icon:d.weather?.[0]?.icon||'01d', description:d.weather?.[0]?.description||'clear sky' }
  } catch { return DEFAULT }
}
