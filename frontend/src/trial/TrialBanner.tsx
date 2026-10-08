import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { countdownParts, TRIAL_ENDS_AT } from './trial'
import './trial.css'

/** A thin countdown to the end of the trial, shown at the very top of every page. */
export function TrialBanner() {
  const { pathname } = useLocation()
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    // Tick on the second so the minute (and, at the end, seconds) change on time.
    let timer: number
    const tick = () => {
      setNow(Date.now())
      timer = window.setTimeout(tick, 1000 - (Date.now() % 1000))
    }
    timer = window.setTimeout(tick, 1000 - (Date.now() % 1000))
    return () => window.clearTimeout(timer)
  }, [])

  // Investors aren't part of the trial.
  if (pathname.startsWith('/investors/')) return null

  const parts = countdownParts(now)
  const finalHour = parts !== null && TRIAL_ENDS_AT - now < 60 * 60 * 1000

  return (
    <aside className="trial-banner" aria-label="Trial period">
      <p className="trial-banner__text">
        {parts === null ? (
          'The K-Net trial period has ended. Thank you for testing!'
        ) : (
          <>
            <span className="trial-banner__label">
              {finalHour ? 'Time left in trial period:' : 'Days left in trial period:'}
            </span>{' '}
            {parts.map(({ value, unit }, index) => (
              <span key={unit.replace(/s$/, '')} className="trial-banner__part">
                <span className="trial-banner__number">
                  {/* A new key on each change replays the roll-in animation. */}
                  <span key={value} className="trial-banner__digits">
                    {value}
                  </span>
                </span>{' '}
                {unit}
                {index < parts.length - 1 ? ', ' : ''}
              </span>
            ))}
          </>
        )}
      </p>
      <Link to="/trial" className="trial-banner__link">
        About the trial
      </Link>
    </aside>
  )
}
