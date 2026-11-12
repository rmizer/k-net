import type { ReactNode } from 'react'
import type { VehicleKind } from '../../types'

// Line icons in the same style as NavIcon (24 × 24, 2px rounded strokes), side views facing right.
const wheels = (back: number, front: number, y = 17) => (
  <>
    <circle cx={back} cy={y} r="2" />
    <circle cx={front} cy={y} r="2" />
  </>
)

const SHAPES: Record<VehicleKind, ReactNode> = {
  party_bus: (
    <>
      <rect x="4" y="3" width="16" height="15" rx="2" />
      <path d="M4 11h16M7 18v3M17 18v3M8 14.5h.01M16 14.5h.01" />
    </>
  ),
  shuttle_bus: (
    <>
      <rect x="4" y="3" width="16" height="15" rx="2" />
      <path d="M4 11h16M7 18v3M17 18v3M8 14.5h.01M16 14.5h.01" />
    </>
  ),
  van: (
    <>
      <path d="M4 17H2.5V8a2 2 0 0 1 2-2h10.5l5 5v6H19" />
      <path d="M8 17h7M15 6v5h5M2.5 11H15" />
      {wheels(6, 17)}
    </>
  ),
  moving_truck: (
    <>
      <path d="M4 17H2V4h12v13M8 17h6" />
      <path d="M14 8h4l3.5 4v5H19" />
      {wheels(6, 17)}
    </>
  ),
  box_truck: (
    <>
      <path d="M4 17H2V4h12v13M8 17h6" />
      <path d="M14 8h4l3.5 4v5H19" />
      {wheels(6, 17)}
    </>
  ),
  pickup: (
    <>
      <path d="M4 17H2v-4h9V7h5l3.5 5H22v5h-3M8 17h7" />
      <path d="M11 12h8.5" />
      {wheels(6, 17)}
    </>
  ),
  car: (
    <>
      <path d="M4.5 17H3v-4l2-5a2 2 0 0 1 1.9-1.3h8.6a2 2 0 0 1 1.6.8L20 12h.5a1.5 1.5 0 0 1 1.5 1.5V17h-2.5" />
      <path d="M9 17h6M3.5 12H20" />
      {wheels(7, 17.5, 17)}
    </>
  ),
  trailer: (
    <>
      <rect x="2" y="5" width="15" height="10" rx="1" />
      <path d="M17 13h5" />
      <circle cx="9.5" cy="17.5" r="2" />
    </>
  ),
  cart: (
    <>
      <path d="M5 4h11M6 4v7M15 4v7" />
      <path d="M4.5 17H3v-6h13l3 3v3h-1" />
      {wheels(6.5, 16, 17)}
    </>
  ),
  other: (
    <>
      <path d="M4.5 17H3v-4l2-5a2 2 0 0 1 1.9-1.3h8.6a2 2 0 0 1 1.6.8L20 12h.5a1.5 1.5 0 0 1 1.5 1.5V17h-2.5" />
      <path d="M9 17h6M3.5 12H20" />
      {wheels(7, 17.5, 17)}
    </>
  ),
}

/** A small picture of the vehicle's type: bus, van, truck, pickup, car, trailer or cart. */
export function VehicleIcon({ kind, size = 22 }: { kind: VehicleKind; size?: number }) {
  return (
    <svg
      className="vehicle-icon"
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
      {SHAPES[kind] ?? SHAPES.other}
    </svg>
  )
}
