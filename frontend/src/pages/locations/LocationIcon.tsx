import type { LocationKind } from '../../types'

// 24×24 line icons, one per location type. Kept as markup strings too, so the
// Leaflet map pins (plain HTML) can use the same drawings.
export const LOCATION_ICON_PATHS: Record<LocationKind, string> = {
  lodging: '<path d="M3 20V6M3 16h18v4M21 16v-4a3 3 0 0 0-3-3h-7v7"/><circle cx="7" cy="11" r="2"/>',
  airport:
    '<path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/>',
  shooting:
    '<path d="M4 11v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8z"/><path d="m4 11-.9-3.4a2 2 0 0 1 1.4-2.4L17 1.9a2 2 0 0 1 2.4 1.4l.6 2.3z"/><path d="m7.6 4.4 3.2 4M13.6 2.8l3.2 4"/>',
  production:
    '<path d="M3 21V9l9-6 9 6v12"/><path d="M9 21v-6h6v6"/><path d="M3 21h18"/>',
  other: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/>',
}

export function locationIconSvg(kind: LocationKind, size = 16) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${LOCATION_ICON_PATHS[kind]}</svg>`
}

/** The type's icon in a colored disc, matching its map pin. */
export function LocationIcon({ kind }: { kind: LocationKind }) {
  return (
    <span
      className={`location-icon location-icon--${kind}`}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: locationIconSvg(kind) }}
    />
  )
}
