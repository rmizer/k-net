import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useEffect, useRef } from 'react'
import type { ProductionLocation } from '../../types'
import { locationIconSvg } from './LocationIcon'

interface LocationsMapProps {
  locations: ProductionLocation[]
  selectedId: number | null
  onSelect: (id: number) => void
}

export const directionsUrl = (place: ProductionLocation) => {
  const destination = place.latitude ? `${place.latitude},${place.longitude}` : place.address
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`
}

// Built with DOM nodes (not HTML strings) so names and notes can't inject markup.
function popupContent(place: ProductionLocation) {
  const root = document.createElement('div')
  root.className = 'map-popup'
  const add = (tag: string, text: string, className?: string) => {
    const node = document.createElement(tag)
    node.textContent = text
    if (className) node.className = className
    root.appendChild(node)
    return node
  }
  add('strong', place.name)
  add('span', place.type_label, 'map-popup__meta')
  if (place.address) add('span', place.address)
  const link = add('a', 'Directions ↗') as HTMLAnchorElement
  link.href = directionsUrl(place)
  link.target = '_blank'
  link.rel = 'noopener noreferrer'
  return root
}

const located = (place: ProductionLocation) => place.latitude != null && place.longitude != null

export function LocationsMap({ locations, selectedId, onSelect }: LocationsMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const layerRef = useRef<L.LayerGroup | null>(null)
  const markersRef = useRef(new Map<number, L.Marker>())

  // Create the map once.
  useEffect(() => {
    if (!containerRef.current) return
    const map = L.map(containerRef.current, { scrollWheelZoom: false })
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map)
    map.setView([39.5, -98.35], 4) // Continental US until there are places to show.
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

  // Redraw pins and frame them whenever the list (or filter) changes.
  useEffect(() => {
    const map = mapRef.current
    const layer = layerRef.current
    if (!map || !layer) return
    layer.clearLayers()
    markersRef.current.clear()

    const placed = locations.filter(located)
    for (const place of placed) {
      const icon = L.divIcon({
        className: '',
        // Only fixed markup here; the place's own text goes in the popup via textContent.
        html: `<span class="location-pin location-icon--${place.kind}">${locationIconSvg(place.kind, 16)}</span>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
        popupAnchor: [0, -18],
      })
      const marker = L.marker([Number(place.latitude), Number(place.longitude)], {
        icon,
        title: place.name,
        alt: place.name,
      })
        .bindPopup(() => popupContent(place))
        .on('click', () => onSelect(place.id))
        .addTo(layer)
      markersRef.current.set(place.id, marker)
    }

    if (placed.length) {
      const bounds = L.latLngBounds(placed.map((p) => [Number(p.latitude), Number(p.longitude)]))
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 })
    }
  }, [locations, onSelect])

  // Center on and open the selected place.
  useEffect(() => {
    if (selectedId === null) return
    const marker = markersRef.current.get(selectedId)
    if (!marker || !mapRef.current) return
    mapRef.current.setView(marker.getLatLng(), Math.max(mapRef.current.getZoom(), 14))
    marker.openPopup()
  }, [selectedId, locations])

  return <div ref={containerRef} className="locations-map" role="region" aria-label="Map of production locations" />
}
