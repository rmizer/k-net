import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { canSee, isInSection, NAV_ITEMS } from '../navigation'

/** Section submenu under the main nav. The current page is underlined (and not clickable when you're on it). */
export function SubNav() {
  const { user } = useAuth()
  const { pathname } = useLocation()

  const section = NAV_ITEMS.find(
    (item) => item.children && canSee(item, user?.role) && isInSection(pathname, item.path),
  )
  if (!section?.children) return null
  // The deepest matching page, so /finance/payroll/5 highlights Payroll (not Overview).
  const current = section.children
    .filter((child) => isInSection(pathname, child.path))
    .sort((a, b) => b.path.length - a.path.length)[0]

  return (
    <nav className="sub-nav" aria-label={`${section.label} pages`}>
      <ul className="container sub-nav__links">
        {section.children.map((child) => (
          <li key={child.path}>
            {pathname === child.path ? (
              <span className="sub-nav__link is-active" aria-current="page">
                {child.label}
              </span>
            ) : (
              <Link to={child.path} className={`sub-nav__link${child === current ? ' is-active' : ''}`}>
                {child.label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </nav>
  )
}
