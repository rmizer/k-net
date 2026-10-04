import { useMemo, useState } from 'react'
import { api } from '../../api'
import { canManageUser, isManagerLevel, ROLE_LABELS, type Role, type User } from '../../auth/roles'
import { useAuth } from '../../auth/useAuth'
import { useFetch } from '../../hooks/useFetch'
import type { Department } from '../../types'
import { StaffFormDialog } from './StaffFormDialog'
import { StaffTile } from './StaffTile'
import './directory.css'

const UNASSIGNED = 'Unassigned'

export function DirectoryPage() {
  const { user } = useAuth()
  const people = useFetch<User[]>('/users/')
  const departments = useFetch<Department[]>('/departments/')
  const [search, setSearch] = useState('')
  const [departmentFilter, setDepartmentFilter] = useState('')
  const [roleFilter, setRoleFilter] = useState<Role | ''>('')
  // undefined = dialog closed, null = adding someone new, User = editing.
  const [editing, setEditing] = useState<User | null | undefined>(undefined)
  const [created, setCreated] = useState<User | null>(null)

  const manager = isManagerLevel(user)
  const assignableRoles = user?.assignable_roles ?? []

  const groups = useMemo(() => {
    const query = search.trim().toLowerCase()
    const matches = (people.data ?? []).filter((person) => {
      if (departmentFilter && String(person.department ?? '') !== departmentFilter) return false
      if (roleFilter && person.role !== roleFilter) return false
      if (!query) return true
      return [person.first_name, person.last_name, person.email, person.phone, person.lodging]
        .join(' ')
        .toLowerCase()
        .includes(query)
    })
    const byDepartment = new Map<string, User[]>()
    for (const person of matches) {
      const name = person.department_name ?? UNASSIGNED
      byDepartment.set(name, [...(byDepartment.get(name) ?? []), person])
    }
    // Alphabetical, with people who have no department last.
    return [...byDepartment.entries()].sort(([a], [b]) =>
      a === UNASSIGNED ? 1 : b === UNASSIGNED ? -1 : a.localeCompare(b),
    )
  }, [people.data, search, departmentFilter, roleFilter])

  const handleSaved = (saved: User) => {
    setEditing(undefined)
    if (saved.temporary_password) setCreated(saved)
    people.reload()
    departments.reload()
  }

  const handleRemove = async (person: User) => {
    const name = `${person.first_name} ${person.last_name}`
    if (!window.confirm(`Remove ${name} from the directory? Their account will be deactivated.`)) return
    await api(`/users/${person.id}/`, { method: 'DELETE' })
    people.reload()
  }

  const total = people.data?.length ?? 0
  const shown = groups.reduce((count, [, members]) => count + members.length, 0)
  const filtered = search || departmentFilter || roleFilter

  return (
    <section className="directory">
      <div className="page-header">
        <div>
          <h1>Directory</h1>
          <p className="subtitle">All staff and crew</p>
        </div>
        {manager && assignableRoles.length > 0 && (
          <button type="button" className="button" onClick={() => setEditing(null)}>
            + Add staff member
          </button>
        )}
      </div>

      {created && (
        <div className="notice notice--success notice--with-action" role="status">
          <p>
            <strong>
              {created.first_name} {created.last_name}
            </strong>{' '}
            was added. Their temporary password is <code className="temp-password">{created.temporary_password}</code>
            . Share it with them now; it won’t be shown again.
          </p>
          <button type="button" className="icon-button" onClick={() => setCreated(null)} aria-label="Dismiss">
            ×
          </button>
        </div>
      )}

      <div className="filters" role="search">
        <label className="form__field filters__search">
          <span>Search</span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Name, email, phone or lodging"
          />
        </label>
        <label className="form__field">
          <span>Department</span>
          <select value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)}>
            <option value="">All departments</option>
            {(departments.data ?? []).map((dept) => (
              <option key={dept.id} value={dept.id}>
                {dept.name}
              </option>
            ))}
          </select>
        </label>
        <label className="form__field">
          <span>Role</span>
          <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value as Role | '')}>
            <option value="">All roles</option>
            {(Object.keys(ROLE_LABELS) as Role[]).map((role) => (
              <option key={role} value={role}>
                {ROLE_LABELS[role]}
              </option>
            ))}
          </select>
        </label>
      </div>

      {people.loading && !people.data && <p className="loading">Loading directory…</p>}
      {people.error && !people.data && <p className="form__error">Couldn’t load the directory.</p>}

      {people.data && (
        <p className="muted directory__count" aria-live="polite">
          {filtered ? `Showing ${shown} of ${total} people` : `${total} people`}
        </p>
      )}

      {people.data && groups.length === 0 && (
        <div className="tile">
          <p className="muted">{filtered ? 'No one matches those filters.' : 'No one has been added yet.'}</p>
        </div>
      )}

      {groups.map(([department, members]) => (
        <section key={department} className="directory__group" aria-label={department}>
          <h2>
            {department} <span className="directory__group-count">({members.length})</span>
          </h2>
          <ul className="staff-tiles">
            {members.map((person) => {
              const manageable = canManageUser(user, person)
              return (
                <StaffTile
                  key={person.id}
                  person={person}
                  onEdit={manageable ? () => setEditing(person) : undefined}
                  onRemove={manageable ? () => handleRemove(person) : undefined}
                />
              )
            })}
          </ul>
        </section>
      ))}

      {editing !== undefined && (
        <StaffFormDialog
          person={editing}
          departments={departments.data ?? []}
          assignableRoles={assignableRoles}
          onSaved={handleSaved}
          onClose={() => setEditing(undefined)}
        />
      )}
    </section>
  )
}
