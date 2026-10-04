import { useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { canSee, isInSection, NAV_ITEMS } from '../navigation'
import { GearIcon } from './GearIcon'

export function Nav() {
  const { user, logout } = useAuth()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  // The mobile menu stays open only on the page where it was opened, so it
  // collapses automatically after navigating.
  const [openOn, setOpenOn] = useState<string | null>(null)
  const open = openOn === pathname

  const items = user ? NAV_ITEMS.filter((item) => canSee(item, user.role)) : []

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <nav className="site-nav" aria-label="Main">
      <div className="container site-nav__inner">
        <p className="site-nav__greeting">
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
              const active = isInSection(pathname, item.path)
              return (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    className={`nav-link${active ? ' is-active' : ''}`}
                    aria-current={active ? 'page' : undefined}
                  >
                    {item.label}
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
