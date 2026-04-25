import { useState, useEffect } from 'react'
import { MapContainer, TileLayer, Circle, Marker, useMapEvents } from 'react-leaflet'
import { MapPin, Sliders, Save, Loader2 } from 'lucide-react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useProfile, useUpdateProfile } from '@/hooks/useProfile'

delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const RADIUS_OPTIONS = [10, 25, 50, 100, 150, 200, 300]

function MapClickHandler({ onSelect }: { onSelect: (lat: number, lng: number) => void }) {
  useMapEvents({ click: e => onSelect(e.latlng.lat, e.latlng.lng) })
  return null
}

export default function SearchZonePage() {
  const { data: profile } = useProfile()
  const updateProfile = useUpdateProfile()

  const [lat, setLat] = useState<number>(profile?.latitude ?? -23.55)
  const [lng, setLng] = useState<number>(profile?.longitude ?? -46.63)
  const [radius, setRadius] = useState<number>(profile?.search_radius_km ?? 50)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (profile?.latitude) setLat(profile.latitude)
    if (profile?.longitude) setLng(profile.longitude)
    if (profile?.search_radius_km) setRadius(profile.search_radius_km)
  }, [profile])

  const handleSave = async () => {
    await updateProfile.mutateAsync({ latitude: lat, longitude: lng, search_radius_km: radius })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const jobTypeOptions = ['concurso', 'clt', 'pj', 'temporario', 'edtech', 'outro']
  const [selectedTypes, setSelectedTypes] = useState<string[]>(profile?.job_types ?? jobTypeOptions)

  const toggleType = (t: string) =>
    setSelectedTypes(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])

  const typeLabels: Record<string, string> = {
    concurso: 'Concurso Público',
    clt: 'CLT',
    pj: 'PJ',
    temporario: 'Temporário',
    edtech: 'EdTech',
    outro: 'Outro',
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">

      {/* Mapa */}
      <section className="card overflow-hidden">
        <div className="p-5 border-b border-surface-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin size={16} className="text-brand-400" />
            <h2 className="text-white font-semibold text-base">Centro da Zona de Busca</h2>
          </div>
          <p className="text-gray-500 text-xs">Clique no mapa para posicionar o centro</p>
        </div>
        <div className="h-[380px] w-full">
          <MapContainer
            center={[lat, lng]}
            zoom={9}
            style={{ height: '100%', width: '100%' }}
            className="z-0"
          >
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              attribution='&copy; <a href="https://carto.com/">CARTO</a>'
            />
            <MapClickHandler onSelect={(la, ln) => { setLat(la); setLng(ln) }} />
            <Marker position={[lat, lng]} />
            <Circle
              center={[lat, lng]}
              radius={radius * 1000}
              pathOptions={{ color: '#6366f1', fillColor: '#6366f1', fillOpacity: 0.08, weight: 2 }}
            />
          </MapContainer>
        </div>
        <div className="p-4 bg-surface-muted/50 border-t border-surface-border text-xs text-gray-500 flex gap-6">
          <span>Lat: <strong className="text-white">{lat.toFixed(4)}</strong></span>
          <span>Lng: <strong className="text-white">{lng.toFixed(4)}</strong></span>
          <span>Raio: <strong className="text-brand-400">{radius} km</strong></span>
        </div>
      </section>

      {/* Controles */}
      <section className="card p-6 space-y-6">
        <div className="flex items-center gap-2 mb-1">
          <Sliders size={16} className="text-brand-400" />
          <h2 className="text-white font-semibold text-base">Configurações da Busca</h2>
        </div>

        {/* Raio */}
        <div>
          <label className="block text-xs text-gray-400 mb-3">Raio de busca</label>
          <div className="flex gap-2 flex-wrap">
            {RADIUS_OPTIONS.map(r => (
              <button
                key={r}
                onClick={() => setRadius(r)}
                className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
                  radius === r
                    ? 'bg-brand-600 border-brand-600 text-white shadow-glow'
                    : 'bg-surface-muted border-surface-border text-gray-400 hover:text-white hover:border-brand-600/50'
                }`}
              >
                {r} km
              </button>
            ))}
          </div>
        </div>

        {/* Tipos de vaga */}
        <div>
          <label className="block text-xs text-gray-400 mb-3">Tipos de vaga para monitorar</label>
          <div className="flex gap-2 flex-wrap">
            {jobTypeOptions.map(t => (
              <button
                key={t}
                onClick={() => toggleType(t)}
                className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
                  selectedTypes.includes(t)
                    ? 'bg-brand-600/15 border-brand-600/40 text-brand-300'
                    : 'bg-surface-muted border-surface-border text-gray-500'
                }`}
              >
                {typeLabels[t]}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={updateProfile.isPending}
          className={`btn-primary flex items-center gap-2 ${saved ? 'bg-green-600 hover:bg-green-700' : ''}`}
        >
          {updateProfile.isPending
            ? <Loader2 size={16} className="animate-spin" />
            : <Save size={16} />}
          {saved ? 'Salvo!' : 'Salvar zona de busca'}
        </button>
      </section>
    </div>
  )
}
