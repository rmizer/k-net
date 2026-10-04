type Kind = 'clear' | 'partly' | 'cloudy' | 'fog' | 'rain' | 'snow' | 'storm'

// Groups WMO weather codes into a handful of icons.
function kindFor(code: number): Kind {
  if (code === 0 || code === 1) return 'clear'
  if (code === 2) return 'partly'
  if (code === 3) return 'cloudy'
  if (code === 45 || code === 48) return 'fog'
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow'
  if (code >= 95) return 'storm'
  return 'rain'
}

const sun = (
  <g>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </g>
)
const cloud = <path d="M17.5 19H8a5 5 0 1 1 1.1-9.9A6 6 0 0 1 20.6 11 4 4 0 0 1 17.5 19z" />

export function WeatherIcon({ code, size = 32 }: { code: number; size?: number }) {
  const kind = kindFor(code)
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`weather-icon weather-icon--${kind}`}
    >
      {kind === 'clear' && sun}
      {kind === 'partly' && (
        <>
          <g transform="translate(-4 -4) scale(0.75)">{sun}</g>
          <g transform="translate(3 3) scale(0.85)">{cloud}</g>
        </>
      )}
      {kind === 'cloudy' && cloud}
      {kind === 'fog' && <path d="M3 9h18M5 13h14M3 17h18" />}
      {kind === 'rain' && (
        <>
          <g transform="translate(0 -3)">{cloud}</g>
          <path d="M8 19l-1 2M12 19l-1 2M16 19l-1 2" />
        </>
      )}
      {kind === 'snow' && (
        <>
          <g transform="translate(0 -3)">{cloud}</g>
          <path d="M8 20h.01M12 21h.01M16 20h.01" strokeWidth="3" />
        </>
      )}
      {kind === 'storm' && (
        <>
          <g transform="translate(0 -3)">{cloud}</g>
          <path d="M13 16l-2 3h3l-2 3" />
        </>
      )}
    </svg>
  )
}
