import { useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { canSee, isInItem, linkPath, NAV_ITEMS, type NavItem } from '../navigation'
import { Avatar } from './Avatar'
import { GearIcon } from './GearIcon'
import { NavIcon } from './NavIcon'

export function Nav() {
  const { user, logout } = useAuth()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  // The mobile menu stays open only on the page where it was opened, so it
  // collapses automatically after navigating.
  const [openOn, setOpenOn] = useState<string | null>(null)
  const open = openOn === pathname
  // Same for a dropdown opened by click or tap: { item path, page it was opened on }.
  const [dropdownOn, setDropdownOn] = useState<{ item: string; page: string } | null>(null)
  const isDropdownOpen = (item: NavItem) => dropdownOn?.item === item.path && dropdownOn.page === pathname

  const items = user ? NAV_ITEMS.filter((item) => canSee(item, user)) : []

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <nav className="site-nav" aria-label="Main">
      <div className="container site-nav__inner">
        <p className="site-nav__greeting">
          {user && <Avatar person={user} size={30} className="site-nav__avatar" />}
          {user ? `Welcome, ${user.first_name || user.email}!` : 'Welcome!'}
        </p>

        <button
          type="button"
          className="site-nav__toggle"
          aria-expanded={open}
          aria-controls="site-nav-menu"
          onClick={() => setOpenOn(open ? null : pathname)}
        >
          <span className="site-nav__toggle-bars" aria-hidden="true" />
          Menu
        </button>

        <div id="site-nav-menu" className={`site-nav__menu${open ? ' is-open' : ''}`}>
          <ul className="site-nav__links">
            {items.map((item) => {
              const active = isInItem(pathname, item)
              if (item.dropdown) {
                const dropdownOpen = isDropdownOpen(item)
                return (
                  <NavDropdown
                    key={item.path}
                    item={item}
                    links={item.children?.filter((child) => canSee(child, user)) ?? []}
                    active={active}
                    open={dropdownOpen}
                    onToggle={() => setDropdownOn(dropdownOpen ? null : { item: item.path, page: pathname })}
                    onClose={() => setDropdownOn(null)}
                  />
                )
              }
              return (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    className={`nav-link${active ? ' is-active' : ''}`}
                    aria-current={active ? 'page' : undefined}
                  >
                    {item.icon && <NavIcon name={item.icon} />}
                    <span className="nav-link__label">{item.label}</span>
                  </Link>
                </li>
              )
            })}
          </ul>

          <div className="site-nav__account">
            {user ? (
              <>
                <NavLink
                  to="/account"
                  className={({ isActive }) => `nav-link nav-link--icon${isActive ? ' is-active' : ''}`}
                  title="Account settings"
                >
                  <GearIcon />
                  <span className="visually-hidden-desktop">Account</span>
                </NavLink>
                <button type="button" className="nav-link nav-link--button" onClick={handleLogout}>
                  Log out
                </button>
              </>
            ) : (
              <Link to="/login" className={`nav-link${pathname === '/login' ? ' is-active' : ''}`}>
                Log in
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}

/** A main nav entry whose pages slide down beneath it: on hover (or keyboard
 *  focus) on desktop, and on tap or click anywhere. */
function NavDropdown({
  item,
  links,
  active,
  open,
  onToggle,
  onClose,
}: {
  item: NavItem
  links: NavItem[]
  active: boolean
  open: boolean
  onToggle: () => void
  onClose: () => void
}) {
  const { user } = useAuth()
  const { pathname } = useLocation()
  const panelId = `nav-dropdown-${item.path.replace(/\W+/g, '')}`

  return (
    <li
      className={`nav-dropdown${open ? ' is-open' : ''}`}
      onKeyDown={(event) => {
        if (event.key === 'Escape') onClose()
      }}
    >
      <button
        type="button"
        className={`nav-link nav-link--button nav-dropdown__toggle${active ? ' is-active' : ''}`}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={onToggle}
      >
        {item.icon && <NavIcon name={item.icon} />}
        <span className="nav-link__label">{item.label}</span>
        <span className="nav-dropdown__caret" aria-hidden="true" />
      </button>
      <div id={panelId} className="nav-dropdown__panel">
        <ul className="nav-dropdown__links">
          {links.map((link) => {
            const current = isInItem(pathname, link)
            return (
              <li key={link.path}>
                <Link
                  to={linkPath(link, user)}
                  className={`nav-dropdown__link${current ? ' is-active' : ''}`}
                  aria-current={current ? 'page' : undefined}
                  onClick={onClose}
                >
                  {link.icon && <NavIcon name={link.icon} />}
                  {link.label}
                </Link>
              </li>
            )
          })}
        </ul>
      </div>
    </li>
  )
}
