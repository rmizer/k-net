import { Link } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { isSiteManager } from '../auth/roles'

const YEAR = new Date().getFullYear()

export function Footer() {
  const { user } = useAuth()

  return (
    <footer className="site-footer">
      <div className="container site-footer__inner">
        <p>&copy; {YEAR} K-Net. All rights reserved.</p>
        <ul className="site-footer__links">
          {/* Contact sends bug / tech reports to the Site Managers, so they don't need it. */}
          {!isSiteManager(user) && (
            <li>
              <Link to="/contact" className="nav-link">
                Contact
              </Link>
            </li>
          )}
          <li>
            {/* Django admin; only Site Manager accounts can sign in there. */}
            <a href="/admin/" className="site-footer__admin">
              Admin sign-in
            </a>
          </li>
        </ul>
      </div>
    </footer>
  )
}
