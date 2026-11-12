import { Link } from 'react-router-dom'
import { NavIcon } from '../../components/NavIcon'
import { formatDay } from '../../format'
import { useFetch } from '../../hooks/useFetch'
import type { Challenge, ChallengeStatus } from '../../types'
import '../finance/finance.css'
import './staff-manager.css'
import './challenge-planner.css'

const PLANNER = '/staff-manager/challenge-planner'

/** Each column shows this many of its most recently changed challenges. */
const RECENT_LIMIT = 7

const COLUMNS: { status: ChallengeStatus; title: string; empty: string }[] = [
  { status: 'planning', title: 'In Planning', empty: 'No challenges in planning.' },
  { status: 'planned', title: 'Planned', empty: 'No planned challenges yet.' },
  { status: 'complete', title: 'Completed', empty: 'No completed challenges yet.' },
]

/** The Challenge Planner landing page: drafts, planned and completed challenges side by side. */
export function ChallengePlannerPage() {
  // The server sends the most recently changed first.
  const challenges = useFetch<Challenge[]>('/challenges/')
  const all = challenges.data ?? []

  return (
    <section className="finance staff-manager">
      <div className="page-header">
        <div>
          <h1>
            <NavIcon name="star" />
            Challenge Planner
          </h1>
          <p className="subtitle">Plan each week's challenges</p>
        </div>
        <Link to={`${PLANNER}/new`} className="button">
          + New challenge
        </Link>
      </div>

      {challenges.error && !challenges.data && <p className="form__error">Couldn’t load the challenges.</p>}

      <div className="cp-columns">
        {COLUMNS.map((column) => {
          const inColumn = all.filter((challenge) => challenge.status === column.status)
          const recent = inColumn.slice(0, RECENT_LIMIT)
          return (
            <section key={column.status} className={`tile cp-column cp-column--${column.status}`}>
              <header className="cp-column__head">
                <h2>
                  {column.title} <span className="department__count">{inColumn.length}</span>
                </h2>
                <p className="muted">Last {RECENT_LIMIT} changed</p>
              </header>
              {challenges.loading && !challenges.data ? (
                <p className="muted cp-column__empty">Loading…</p>
              ) : recent.length ? (
                <ul className="cp-list">
                  {recent.map((challenge) => (
                    <li key={challenge.id}>
                      <Link to={`${PLANNER}/${challenge.id}`} state={{ challenge }} className="cp-list__title">
                        {challenge.name}
                      </Link>
                      <span className="muted">
                        {challenge.week && `Week ${challenge.week} · `}
                        {formatDay(challenge.date, { weekday: 'short', month: 'short', day: 'numeric' })}
                        {challenge.supplies.length > 0 &&
                          ` · ${challenge.supplies.filter((item) => item.checked).length}/${challenge.supplies.length} supplies`}
                      </span>
                      {challenge.safety_to_do.length > 0 && (
                        <span className="cp-list__safety">Safety: {challenge.safety_to_do.length} to do</span>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted cp-column__empty">{column.empty}</p>
              )}
            </section>
          )
        })}
      </div>
    </section>
  )
}
