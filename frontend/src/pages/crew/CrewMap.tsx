import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useEffect, useRef } from 'react'
import { initials } from '../../format'
import type { CrewFinderEntry } from '../../types'

export interface MapPoint {
  entry: CrewFinderEntry
  stale: boolean
  lastSeen: string
}

interface CrewMapProps {
  points: MapPoint[]
  selectedId: number | null
  onSelect: (trackerId: number) => void
}


// Built with DOM nodes (not HTML strings) so names and notes can't inject markup.
function popupContent({ entry, lastSeen }: MapPoint) {
  const root = document.createElement('div')
  root.className = 'map-popup'
  const add = (tag: string, text: string, className?: string) => {
    const node = document.createElement(tag)
    node.textContent = text
    if (className) node.className = className
    root.appendChild(node)
  }
  add('strong', `${entry.person.first_name} ${entry.person.last_name}`)
  add('span', [entry.person.role_display, entry.person.department_name].filter(Boolean).join(' · '), 'map-popup__meta')
  if (entry.location?.note) add('span', entry.location.note)
  add('span', `Seen ${lastSeen}`, 'map-popup__meta')
  return root
}

export function CrewMap({ points, selectedId, onSelect }: CrewMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const layerRef = useRef<L.LayerGroup | null>(null)
  const markersRef = useRef(new Map<number, L.Marker>())
  const fittedRef = useRef(false)

  // Create the map once.
  useEffect(() => {
    if (!containerRef.current) return
    const map = L.map(containerRef.current, { scrollWheelZoom: false })
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map)
    map.setView([39.5, -98.35], 4) // Continental US until there are points to show.
    mapRef.current = map
    layerRef.current = L.layerGroup().addTo(map)
    const markers = markersRef.current
    // Leaflet measures its container once; re-measure when the layout changes size.
    const observer = new ResizeObserver(() => map.invalidateSize())
    observer.observe(containerRef.current)
    return () => {
      observer.disconnect()
      map.remove()
      mapRef.current = null
      markers.clear()
    }
  }, [])

  // Redraw markers whenever the data changes.
  useEffect(() => {
    const map = mapRef.current
    const layer = layerRef.current
    if (!map || !layer) return
    layer.clearLayers()
    markersRef.current.clear()

    for (const point of points) {
      const { entry, stale } = point
      if (!entry.location) continue
      const icon = L.divIcon({
        className: '',
        html: `<span class="map-pin${stale ? ' map-pin--stale' : ''}">${initials(entry.person.first_name, entry.person.last_name)}</span>`,
        iconSize: [34, 34],
        iconAnchor: [17, 17],
        popupAnchor: [0, -18],
      })
      const marker = L.marker([Number(entry.location.latitude), Number(entry.location.longitude)], {
        icon,
        title: `${entry.person.first_name} ${entry.person.last_name}`,
        alt: `${entry.person.first_name} ${entry.person.last_name}`,
      })
        .bindPopup(() => popupContent(point))
        .on('click', () => onSelect(entry.tracker_id))
        .addTo(layer)
      markersRef.current.set(entry.tracker_id, marker)
    }

    // Frame everyone the first time locations arrive; after that, leave the view alone.
    const located = points.filter((point) => point.entry.location)
    if (!fittedRef.current && located.length) {
      const bounds = L.latLngBounds(
        located.map(({ entry }) => [Number(entry.location!.latitude), Number(entry.location!.longitude)]),
      )
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 })
      fittedRef.current = true
    }
  }, [points, onSelect])

  // Center on and open the selected person.
  useEffect(() => {
    if (selectedId === null) return
    const marker = markersRef.current.get(selectedId)
    if (!marker || !mapRef.current) return
    mapRef.current.setView(marker.getLatLng(), Math.max(mapRef.current.getZoom(), 16))
    marker.openPopup()
  }, [selectedId, points])

  return <div ref={containerRef} className="crew-map" role="region" aria-label="Crew locations map" />
}
