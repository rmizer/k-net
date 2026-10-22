import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ReceiptButton } from './ReceiptButton'

const TABS = [
  { label: 'Overview', path: '/departments/culinary' },
  { label: 'Menus', path: '/departments/culinary/menu' },
  { label: 'Shopping lists', path: '/departments/culinary/shopping' },
  { label: 'Food allergies', path: '/departments/culinary/allergies' },
]

/** The Culinary tools: overview, menus, shopping lists and food allergies, plus Upload receipt. */
export function CulinaryNav() {
  const { pathname } = useLocation()
  const [notice, setNotice] = useState('')
  const current = [...TABS].sort((a, b) => b.path.length - a.path.length).find((tab) => pathname.startsWith(tab.path))

  return (
    <>
      <nav className="culinary-nav no-print" aria-label="Culinary">
        <span className="culinary-nav__tabs">
          {TABS.map((tab) =>
            tab === current && pathname === tab.path ? (
              <span key={tab.path} aria-current="page">
                {tab.label}
              </span>
            ) : (
              <Link key={tab.path} to={tab.path}>
                {tab.label}
              </Link>
            ),
          )}
        </span>
        <ReceiptButton onSent={setNotice} />
      </nav>
      {notice && (
        <p className="notice notice--success no-print" role="status">
          {notice}
        </p>
      )}
    </>
  )
}
