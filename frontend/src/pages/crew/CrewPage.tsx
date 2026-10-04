import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api'
import { canManageUser, isManagerLevel, type User } from '../../auth/roles'
import { useAuth } from '../../auth/useAuth'
import { Avatar } from '../../components/Avatar'
import { useFetch } from '../../hooks/useFetch'
import { AddToCrewDialog } from './AddToCrewDialog'
import './crew.css'

const UNASSIGNED = 'Unassigned'

export function CrewPage() {
  const { user } = useAuth()
  const crew = useFetch<User[]>('/users/crew/')
  const [adding, setAdding] = useState(false)
  const manager = isManagerLevel(user)

  const groups = useMemo(() => {
    const byDepartment = new Map<string, User[]>()
    for (const person of crew.data ?? []) {
      const name = person.department_name ?? UNASSIGNED
      byDepartment.set(name, [...(byDepartment.get(name) ?? []), person])
    }
    return [...byDepartment.entries()].sort(([a], [b]) =>
      a === UNASSIGNED ? 1 : b === UNASSIGNED ? -1 : a.localeCompare(b),
    )
  }, [crew.data])

  const removeFromCrew = async (person: User) => {
    if (!window.confirm(`Take ${person.first_name} ${person.last_name} off the active crew? They stay in the Directory.`))
      return
    await api(`/users/${person.id}/`, { method: 'PATCH', body: JSON.stringify({ is_active_crew: false }) })
    crew.reload()
  }

  return (
    <section className="crew">
      <div className="page-header">
        <div>
          <h1>Staff / Crew</h1>
          <p className="subtitle">Active crew{crew.data ? ` · ${crew.data.length} working` : ''}</p>
        </div>
        <div className="page-header__actions">
          <Link to="/crew/finder" className="button button--secondary">
            Open CrewFinder
          </Link>
          {manager && (
            <button type="button" className="button" onClick={() => setAdding(true)}>
              + Add to crew
            </button>
          )}
        </div>
      </div>

      {crew.loading && !crew.data && <p className="loading">Loading crew…</p>}
      {crew.error && !crew.data && <p className="form__error">Couldn’t load the crew list.</p>}
      {crew.data && crew.data.length === 0 && (
        <div className="tile">
          <p className="muted">No one is on the active crew right now.</p>
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
                  <p className="crew-member__role">{person.role_display}</p>
                  {person.phone && (
                    <a className="contact-link crew-member__phone" href={`tel:${person.phone}`}>
                      {person.phone}
                    </a>
                  )}
                </div>
                {canManageUser(user, person) && (
                  <button
                    type="button"
                    className="icon-button"
                    onClick={() => removeFromCrew(person)}
                    aria-label={`Take ${person.first_name} ${person.last_name} off the crew`}
                  >
                    ×
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}

      {adding && (
        <AddToCrewDialog
          onClose={() => setAdding(false)}
          onAdded={() => {
            setAdding(false)
            crew.reload()
          }}
        />
      )}
    </section>
  )
}
