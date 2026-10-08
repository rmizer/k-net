import { useEffect, useRef, useState, type FormEvent } from 'react'
import { api, ApiError, fieldErrors } from '../../api'
import { canManageUser, type User } from '../../auth/roles'
import { useAuth } from '../../auth/useAuth'
import { useFetch } from '../../hooks/useFetch'
import type { Department } from '../../types'
import './staff-manager.css'

const errorText = (err: unknown, fallback: string) =>
  fieldErrors(err).name ?? (err instanceof ApiError ? err.message : fallback)

/** Directors, Assistants and Site Managers add, rename and delete departments
 *  and choose who's in each one. */
export function DepartmentsPage() {
  const departments = useFetch<Department[]>('/departments/')
  const people = useFetch<User[]>('/users/')
  const [newName, setNewName] = useState('')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')
  const [renaming, setRenaming] = useState<{ id: number; name: string } | null>(null)
  const [managing, setManaging] = useState<Department | null>(null)

  const reload = () => {
    departments.reload()
    people.reload()
  }

  const members = (id: number | null) => (people.data ?? []).filter((person) => person.department === id)
  const unassigned = members(null)

  const handleAdd = async (event: FormEvent) => {
    event.preventDefault()
    setAdding(true)
    setError('')
    try {
      await api('/departments/', { method: 'POST', body: JSON.stringify({ name: newName }) })
      setNewName('')
      departments.reload()
    } catch (err) {
      setError(errorText(err, 'Could not add the department.'))
    } finally {
      setAdding(false)
    }
  }

  const handleRename = async (event: FormEvent) => {
    event.preventDefault()
    if (!renaming) return
    setError('')
    try {
      await api(`/departments/${renaming.id}/`, { method: 'PATCH', body: JSON.stringify({ name: renaming.name }) })
      setRenaming(null)
      reload()
    } catch (err) {
      setError(errorText(err, 'Could not rename the department.'))
    }
  }

  const handleDelete = async (department: Department) => {
    const count = department.member_count ?? 0
    const warning = count
      ? ` Its ${count} ${count === 1 ? 'member' : 'members'} and its tasks will be left without a department.`
      : ''
    if (!window.confirm(`Delete the ${department.name} department?${warning}`)) return
    setError('')
    try {
      await api(`/departments/${department.id}/`, { method: 'DELETE' })
      reload()
    } catch (err) {
      setError(errorText(err, 'Could not delete the department.'))
    }
  }

  return (
    <section className="staff-manager departments">
      <div className="page-header">
        <div>
          <h1>Departments</h1>
          <p className="subtitle">Add, rename and remove departments, and choose who’s in each</p>
        </div>
      </div>

      <form className="tile departments__add" onSubmit={handleAdd}>
        <label className="form__field">
          <span>New department</span>
          <input
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            placeholder="e.g. Camera, Wardrobe, Catering"
            maxLength={100}
            required
          />
        </label>
        <button type="submit" className="button" disabled={adding || !newName.trim()}>
          {adding ? 'Adding…' : 'Add department'}
        </button>
      </form>

      {error && (
        <p className="form__error" role="alert">
          {error}
        </p>
      )}

      {departments.loading && !departments.data && <p className="loading">Loading departments…</p>}
      {departments.data && departments.data.length === 0 && (
        <p className="muted">No departments yet. Add the first one above.</p>
      )}

      <ul className="departments__list">
        {(departments.data ?? []).map((department) => {
          const list = members(department.id)
          return (
            <li key={department.id} className="tile departments__item">
              {renaming?.id === department.id ? (
                <form className="departments__rename" onSubmit={handleRename}>
                  <label className="form__field">
                    <span>Department name</span>
                    <input
                      value={renaming.name}
                      onChange={(event) => setRenaming({ ...renaming, name: event.target.value })}
                      maxLength={100}
                      autoFocus
                      required
                    />
                  </label>
                  <div className="inline-form__actions">
                    <button type="submit" className="button" disabled={!renaming.name.trim()}>
                      Save
                    </button>
                    <button type="button" className="button button--secondary" onClick={() => setRenaming(null)}>
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <div className="departments__head">
                  <h2>{department.name}</h2>
                  <span className="muted">
                    {list.length} {list.length === 1 ? 'person' : 'people'}
                  </span>
                </div>
              )}
              <p className="departments__members">
                {list.length ? (
                  list.map((person) => `${person.first_name} ${person.last_name}`).join(', ')
                ) : (
                  <span className="muted">No one yet.</span>
                )}
              </p>
              <span className="row-actions departments__actions">
                <button type="button" className="text-button" onClick={() => setManaging(department)}>
                  Members
                </button>
                <button
                  type="button"
                  className="text-button"
                  onClick={() => setRenaming({ id: department.id, name: department.name })}
                >
                  Rename
                </button>
                <button type="button" className="text-button" onClick={() => handleDelete(department)}>
                  Delete
                </button>
              </span>
            </li>
          )
        })}
      </ul>

      {people.data && unassigned.length > 0 && (
        <section className="tile departments__unassigned" aria-labelledby="unassigned-heading">
          <h2 id="unassigned-heading">No department ({unassigned.length})</h2>
          <p className="departments__members">
            {unassigned.map((person) => `${person.first_name} ${person.last_name}`).join(', ')}
          </p>
        </section>
      )}

      {managing && (
        <MembersDialog
          department={managing}
          people={people.data ?? []}
          departments={departments.data ?? []}
          onClose={() => setManaging(null)}
          onSaved={() => {
            setManaging(null)
            reload()
          }}
        />
      )}
    </section>
  )
}

interface MembersDialogProps {
  department: Department
  people: User[]
  departments: Department[]
  onClose: () => void
  onSaved: () => void
}

/** Check people to put them in the department; uncheck to take them out. */
function MembersDialog({ department, people, departments, onClose, onSaved }: MembersDialogProps) {
  const { user } = useAuth()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [selected, setSelected] = useState(
    () => new Set(people.filter((p) => p.department === department.id).map((p) => p.id)),
  )
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    dialogRef.current?.showModal()
  }, [])

  const departmentName = (id: number | null) => departments.find((d) => d.id === id)?.name
  const canEdit = (person: User) => person.id === user?.id || canManageUser(user, person)
  const query = search.trim().toLowerCase()
  const visible = people.filter((person) =>
    `${person.first_name} ${person.last_name} ${person.department_name ?? ''}`.toLowerCase().includes(query),
  )
  const changes = people.filter((person) => (person.department === department.id) !== selected.has(person.id))

  const toggle = (id: number) => {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelected(next)
  }

  const handleSave = async () => {
    setSaving(true)
    setError('')
    const results = await Promise.allSettled(
      changes.map((person) =>
        api(`/users/${person.id}/`, {
          method: 'PATCH',
          body: JSON.stringify({ department: selected.has(person.id) ? department.id : null }),
        }),
      ),
    )
    if (results.some((result) => result.status === 'rejected')) {
      setError('Some changes couldn’t be saved. Please try again.')
      setSaving(false)
      return
    }
    onSaved()
  }

  return (
    <dialog ref={dialogRef} className="dialog" onClose={onClose} aria-labelledby="members-title">
      <div className="dialog__header">
        <h2 id="members-title">{department.name} members</h2>
        <button type="button" className="icon-button" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>

      <label className="form__field departments__search">
        <span>Search</span>
        <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} autoFocus />
      </label>

      <ul className="departments__picker">
        {visible.map((person) => {
          const current = person.department !== department.id ? departmentName(person.department) : undefined
          return (
            <li key={person.id}>
              <label className="form__check">
                <input
                  type="checkbox"
                  checked={selected.has(person.id)}
                  onChange={() => toggle(person.id)}
                  disabled={!canEdit(person)}
                />
                <span>
                  <strong>
                    {person.first_name} {person.last_name}
                  </strong>
                  <span className="muted">
                    {' '}
                    · {person.role_display}
                    {current ? ` · now in ${current}` : ''}
                    {!canEdit(person) ? ' · you can’t change this person' : ''}
                  </span>
                </span>
              </label>
            </li>
          )
        })}
      </ul>

      {error && (
        <p className="form__error" role="alert">
          {error}
        </p>
      )}
      <div className="inline-form__actions">
        <button type="button" className="button" disabled={saving || changes.length === 0} onClick={handleSave}>
          {saving ? 'Saving…' : 'Save members'}
        </button>
        <button type="button" className="button button--secondary" onClick={onClose}>
          Cancel
        </button>
      </div>
    </dialog>
  )
}
