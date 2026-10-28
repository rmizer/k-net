import type { ReactNode } from 'react'

export type NavIconName =
  | 'shield'
  | 'home'
  | 'contacts'
  | 'crew'
  | 'resources'
  | 'star'
  | 'calendar'
  | 'document'
  | 'pin'
  | 'dollar'
  | 'clipboard'
  | 'trend'
  | 'mail'
  | 'tasks'
  | 'briefcase'
  | 'help'
  | 'megaphone'
  | 'departments'
  | 'clapper'
  | 'bus'
  | 'utensils'
  | 'monitor'
  | 'video'
  | 'guard'
  | 'user'
  | 'userPlus'
  | 'sheet'
  | 'locate'
  | 'incoming'
  | 'outgoing'
  | 'receipt'
  | 'card'
  | 'wallet'
  | 'notes'
  | 'timeline'
  | 'tv'
  | 'clock'
  | 'bug'
  | 'pencil'
  | 'plus'
  | 'layers'
  | 'rocket'
  | 'check'
  | 'globe'
  | 'wifiOff'

// 24×24 line icons, drawn with the current text color.
const PATHS: Record<NavIconName, ReactNode> = {
  shield: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />,
  home: (
    <>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h5v-6h4v6h5V9.5" />
    </>
  ),
  contacts: (
    <>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <circle cx="12" cy="10" r="3" />
      <path d="M7.5 17.5a5 5 0 0 1 9 0" />
    </>
  ),
  crew: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
      <path d="M16 4.6a3.5 3.5 0 0 1 0 6.8" />
      <path d="M18 14.2a6.5 6.5 0 0 1 3.5 5.8" />
    </>
  ),
  resources: (
    <>
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M3 13h18" />
    </>
  ),
  star: <path d="m12 2.8 2.8 5.8 6.4.9-4.6 4.5 1.1 6.3L12 17.3l-5.7 3 1.1-6.3-4.6-4.5 6.4-.9z" />,
  calendar: (
    <>
      <rect x="3" y="4.5" width="18" height="16.5" rx="2" />
      <path d="M3 10h18M8 2.5v4M16 2.5v4" />
    </>
  ),
  document: (
    <>
      <path d="M14 2.5H6.5a2 2 0 0 0-2 2v15a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V8z" />
      <path d="M14 2.5V8h5.5M8.5 13h7M8.5 17h7" />
    </>
  ),
  pin: (
    <>
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z" />
      <circle cx="12" cy="10" r="3" />
    </>
  ),
  dollar: <path d="M12 2v20M17 5.5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />,
  clipboard: (
    <>
      <rect x="5" y="4" width="14" height="18" rx="2" />
      <path d="M9 2.5h6v3H9z" />
      <path d="m9 13 2 2 4-4" />
    </>
  ),
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </>
  ),
  trend: (
    <>
      <path d="m3 17 6-6 4 4 8-8" />
      <path d="M15 7h6v6" />
    </>
  ),
  briefcase: (
    <>
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
      <path d="M3 13h18" />
    </>
  ),
  help: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6" />
      <path d="M12 17h.01" />
    </>
  ),
  megaphone: (
    <>
      <path d="M3 10v4a1 1 0 0 0 1 1h3l6 4V5L7 9H4a1 1 0 0 0-1 1z" />
      <path d="M16.5 8.5a5 5 0 0 1 0 7" />
      <path d="M19 6a8.5 8.5 0 0 1 0 12" />
    </>
  ),
  departments: (
    <>
      <rect x="3" y="3" width="7.5" height="7.5" rx="1.5" />
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5" />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5" />
      <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5" />
    </>
  ),
  tasks: (
    <>
      <path d="m3.5 6 1.5 1.5 3-3" />
      <path d="m3.5 13 1.5 1.5 3-3" />
      <path d="M11 6h10M11 13h10M11 20h10" />
      <circle cx="5.25" cy="20" r="1.25" />
    </>
  ),
  // Departments
  clapper: (
    <>
      <path d="M20.2 6 3 11l-.9-2.4c-.3-1.1.3-2.2 1.3-2.5l13.5-4c1.1-.3 2.2.3 2.5 1.3z" />
      <path d="m6.2 5.3 3.1 3.9M12.4 3.4l3.1 4" />
      <path d="M3 11h18v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </>
  ),
  bus: (
    <>
      <rect x="4" y="3" width="16" height="15" rx="2" />
      <path d="M4 11h16M7 18v3M17 18v3M8 14.5h.01M16 14.5h.01" />
    </>
  ),
  utensils: (
    <>
      <path d="M3 2v7a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V2M7 2v20" />
      <path d="M21 15V2a5 5 0 0 0-5 5v6a2 2 0 0 0 2 2h3zm0 0v7" />
    </>
  ),
  monitor: (
    <>
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </>
  ),
  video: (
    <>
      <rect x="2" y="6" width="14" height="12" rx="2" />
      <path d="m16 10.5 6-3.5v10l-6-3.5" />
    </>
  ),
  guard: (
    <>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  // Page headings
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </>
  ),
  userPlus: (
    <>
      <circle cx="10" cy="8" r="4" />
      <path d="M2 21a8 8 0 0 1 13.3-6M19 14v6M16 17h6" />
    </>
  ),
  sheet: (
    <>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M4 8h16M4 12.5h16M4 17h16M10 8v13" />
    </>
  ),
  locate: (
    <>
      <circle cx="12" cy="12" r="7" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
    </>
  ),
  incoming: (
    <>
      <path d="M12 3v11M7.5 9.5 12 14l4.5-4.5" />
      <path d="M3 15v4a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-4" />
    </>
  ),
  outgoing: (
    <>
      <path d="M12 14V3M7.5 7.5 12 3l4.5 4.5" />
      <path d="M3 15v4a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-4" />
    </>
  ),
  receipt: (
    <>
      <path d="M5 2.5h14V21l-2.3-1.5-2.4 1.5-2.3-1.5-2.3 1.5-2.4-1.5L5 21z" />
      <path d="M9 7h6M9 11h6M9 15h4" />
    </>
  ),
  card: (
    <>
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M2 10h20M6 15h4" />
    </>
  ),
  wallet: (
    <>
      <rect x="3" y="6" width="18" height="14" rx="2" />
      <path d="m6 6 10-3 1 3M21 11h-4a2 2 0 0 0 0 4h4" />
    </>
  ),
  notes: (
    <>
      <rect x="5" y="4" width="14" height="18" rx="2" />
      <path d="M9 2v4M15 2v4M9 11h6M9 15h6M9 19h3" />
    </>
  ),
  timeline: <path d="M3 3v18M7 6h7M10 12h10M6 18h6" />,
  tv: (
    <>
      <rect x="2" y="7" width="20" height="14" rx="2" />
      <path d="m8 2 4 5 4-5" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  bug: (
    <>
      <rect x="7" y="7" width="10" height="13" rx="5" />
      <path d="M9 7.5a3 3 0 0 1 6 0M12 11v9M3 13h4M17 13h4M4 8l3 2M20 8l-3 2M4 19l3-2M20 19l-3-2" />
    </>
  ),
  pencil: (
    <>
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
      <path d="m14.5 5.5 3 3" />
    </>
  ),
  plus: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M12 8v8M8 12h8" />
    </>
  ),
  layers: (
    <>
      <path d="m12 3 9 5-9 5-9-5z" />
      <path d="m3 13 9 5 9-5" />
    </>
  ),
  rocket: (
    <>
      <path d="M12 15l-3-3c1.5-5 5-8.5 11-9-.5 6-4 9.5-9 11z" />
      <path d="M9 12H5l2.5-3.5H11M12 15v4l3.5-2.5V13" />
      <path d="M6.5 16.5C5 17 4.5 19.5 4.5 19.5S7 19 7.5 17.5" />
    </>
  ),
  check: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12.5 2.5 2.5L16 9.5" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.5 3.5 5.5 3.5 9s-1 6.5-3.5 9c-2.5-2.5-3.5-5.5-3.5-9s1-6.5 3.5-9z" />
    </>
  ),
  wifiOff: (
    <>
      <path d="M2 8.5a15 15 0 0 1 4-2.5M10 5.1A15 15 0 0 1 22 8.5M5 12a10 10 0 0 1 4-2.2M15 10a10 10 0 0 1 4 2M8.5 15.5a5 5 0 0 1 7 0" />
      <path d="M12 19h.01M3 3l18 18" />
    </>
  ),
}

export function NavIcon({ name, size = 16 }: { name: NavIconName; size?: number }) {
  return (
    <svg
      className="nav-icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  )
}
