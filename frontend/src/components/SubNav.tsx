import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { canSee, isInItem, linkPath, NAV_ITEMS, type NavItem } from '../navigation'

/** The deepest of `items` the page is in, so /finance/payroll/5 highlights Payroll (not Overview). */
const currentOf = (items: NavItem[], pathname: string) =>
  items.filter((item) => isInItem(pathname, item)).sort((a, b) => b.path.length - a.path.length)[0]

/** Section submenu under the main nav. The current page is underlined (and not
 *  clickable when you're on it). A page with its own pages (Finance, inside
 *  Operations) gets a second row. */
export function SubNav() {
  const { user } = useAuth()
  const { pathname } = useLocation()

  const section = NAV_ITEMS.find((item) => item.children && canSee(item, user) && isInItem(pathname, item))
  if (!section?.children) return null

  const rows: { label: string; items: NavItem[] }[] = []
  let items: NavItem[] | undefined = section.children
  let label = section.label
  while (items) {
    const visible = items.filter((item) => canSee(item, user))
    rows.push({ label, items: visible })
    const current = currentOf(visible, pathname)
    items = current?.children
    label = current?.label ?? ''
  }

  return (
    <>
      {rows.map((row, depth) => {
        const current = currentOf(row.items, pathname)
        return (
          <nav
            key={row.label}
            className={`sub-nav${depth ? ' sub-nav--nested' : ''}`}
            aria-label={`${row.label} pages`}
          >
            <ul className="container sub-nav__links">
              {row.items.map((child) => (
                <li key={child.path}>
                  {pathname === linkPath(child, user) ? (
                    <span className="sub-nav__link is-active" aria-current="page">
                      {child.label}
                    </span>
                  ) : (
                    <Link to={linkPath(child, user)} className={`sub-nav__link${child === current ? ' is-active' : ''}`}>
                      {child.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </nav>
        )
      })}
    </>
  )
}
