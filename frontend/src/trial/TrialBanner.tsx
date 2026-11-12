import { Link, useLocation } from 'react-router-dom'
import { NavIcon } from '../components/NavIcon'
import './trial.css'

/** A thin band at the very top of every page saying the app is in its trial version. */
export function TrialBanner() {
  const { pathname } = useLocation()

  // Investors aren't part of the trial.
  if (pathname.startsWith('/investors/') || pathname.startsWith('/for-investors')) return null

  return (
    <aside className="trial-banner" aria-label="Trial version">
      <p className="trial-banner__text">This app is in its trial version.</p>
      <Link to="/trial" className="trial-banner__link">
        <NavIcon name="help" size={14} />
        About the trial
      </Link>
      <Link to="/for-investors" className="trial-banner__link">
        <NavIcon name="trend" size={14} />
        Investors click here
      </Link>
    </aside>
  )
}
