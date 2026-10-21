import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { isManagerLevel } from '../../auth/roles'
import { useAuth } from '../../auth/useAuth'
import { Avatar } from '../../components/Avatar'
import { addDays, clockTime, formatDay } from '../../format'
import { useFetch } from '../../hooks/useFetch'
import type { CrewDay, CrewMember, ProductionSettings } from '../../types'
import './crew.css'

const UNASSIGNED = 'Unassigned'
const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/

export function CrewPage() {
  const production = useFetch<ProductionSettings>('/production/')
  if (!production.data) {
    if (production.loading) return <p className="loading">Loading crew…</p>
    return <p className="form__error">Couldn’t load the crew list.</p>
  }
  return <Crew today={production.data.today} />
}

/** Who's working, by the schedule: everyone with a call that day. */
function Crew({ today }: { today: string }) {
  const { user } = useAuth()
  const [params] = useSearchParams()
  const dateParam = params.get('date') ?? ''
  const day = DAY_PATTERN.test(dateParam) ? dateParam : today
  const crew = useFetch<CrewDay>(`/users/crew/?date=${day}`)
  const people = crew.data?.date === day ? crew.data.crew : undefined

  const groups = useMemo(() => {
    const byDepartment = new Map<string, CrewMember[]>()
    for (const person of people ?? []) {
      const name = person.department_name ?? UNASSIGNED
      byDepartment.set(name, [...(byDepartment.get(name) ?? []), person])
    }
    return [...byDepartment.entries()].sort(([a], [b]) =>
      a === UNASSIGNED ? 1 : b === UNASSIGNED ? -1 : a.localeCompare(b),
    )
  }, [people])

  const dayHref = (target: string) => (target === today ? '/crew' : `/crew?date=${target}`)

  return (
    <section className="crew">
      <div className="page-header">
        <div>
          <h1>Staff / Crew</h1>
          <p className="subtitle">
            Who’s working, from the schedule{people ? ` · ${people.length} called` : ''}
          </p>
        </div>
        <div className="page-header__actions">
          <Link to="/crew/finder" className="button button--secondary">
            Open CrewFinder
          </Link>
          {isManagerLevel(user) && (
            <Link to="/staff-manager/scheduling" className="button">
              Edit the schedule
            </Link>
          )}
        </div>
      </div>

      <div className="crew__day">
        <Link to={dayHref(addDays(day, -1))} className="icon-button" aria-label="Previous day">
          ‹
        </Link>
        <h2>{formatDay(day, { weekday: 'long', month: 'long', day: 'numeric' })}</h2>
        <Link to={dayHref(addDays(day, 1))} className="icon-button" aria-label="Next day">
          ›
        </Link>
        {day !== today && (
          <Link to={dayHref(today)} className="text-button">
            Today
          </Link>
        )}
      </div>

      {!people && crew.loading && <p className="loading">Loading crew…</p>}
      {!people && crew.error && <p className="form__error">Couldn’t load the crew list.</p>}
      {people && people.length === 0 && (
        <div className="tile crew__group">
          <p className="muted">No one is on the schedule {day === today ? 'today' : 'this day'}.</p>
        </div>
      )}

      {groups.map(([department, members]) => (
        <section key={department} className="crew__group" aria-label={department}>
          <h2>
            {department} <span className="crew__group-count">({members.length})</span>
          </h2>
          <ul className="crew-member-tiles">
            {members.map((person) => (
              <li key={person.id} className="tile crew-member">
                <Avatar person={person} size={40} />
                <div className="crew-member__text">
                  <p className="crew-member__name">
                    {person.first_name} {person.last_name}
                  </p>
                  <p className="crew-member__role">{person.title || person.role_display}</p>
                  <p className="crew-member__call">
                    Call <strong>{person.call.time ? clockTime(person.call.time) : 'all day'}</strong>
                    {person.call.location && ` · ${person.call.location}`}
                  </p>
                  {person.phone && (
                    <a className="contact-link crew-member__phone" href={`tel:${person.phone}`}>
                      {person.phone}
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </section>
  )
}
