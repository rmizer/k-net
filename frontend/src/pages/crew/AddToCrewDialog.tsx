import { useEffect, useRef, useState } from 'react'
import { api } from '../../api'
import { canManageUser, type User } from '../../auth/roles'
import { useAuth } from '../../auth/useAuth'
import { useFetch } from '../../hooks/useFetch'

interface AddToCrewDialogProps {
  onClose: () => void
  onAdded: () => void
}

/** Pick people from the Directory to put on the active crew. */
export function AddToCrewDialog({ onClose, onAdded }: AddToCrewDialogProps) {
  const { user } = useAuth()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const people = useFetch<User[]>('/users/')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    dialogRef.current?.showModal()
  }, [])

  // People not on the crew whom this viewer is allowed to update (or themselves).
  const candidates = (people.data ?? []).filter(
    (person) => !person.is_active_crew && (person.id === user?.id || canManageUser(user, person)),
  )
  const query = search.trim().toLowerCase()
  const visible = candidates.filter((person) =>
    `${person.first_name} ${person.last_name} ${person.department_name ?? ''}`.toLowerCase().includes(query),
  )

  const toggle = (id: number) => {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelected(next)
  }

  const handleAdd = async () => {
    setSaving(true)
    setError('')
    try {
      await Promise.all(
        [...selected].map((id) =>
          api(`/users/${id}/`, { method: 'PATCH', body: JSON.stringify({ is_active_crew: true }) }),
        ),
      )
      onAdded()
    } catch {
      setError('Some people couldn’t be added. Please try again.')
      setSaving(false)
    }
  }

  return (
    <dialog ref={dialogRef} className="dialog" onClose={onClose} aria-labelledby="add-crew-title">
      <div className="dialog__header">
        <h2 id="add-crew-title">Add to crew</h2>
        <button type="button" className="icon-button" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>

      <label className="form__field add-crew__search">
        <span>Search</span>
        <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} autoFocus />
      </label>

      {people.loading && !people.data && <p className="loading">Loading…</p>}
      {people.data && candidates.length === 0 && <p className="muted">Everyone is already on the crew.</p>}

      <ul className="add-crew__list">
        {visible.map((person) => (
          <li key={person.id}>
            <label className="form__check">
              <input type="checkbox" checked={selected.has(person.id)} onChange={() => toggle(person.id)} />
              <span>
                <strong>
                  {person.first_name} {person.last_name}
                </strong>
                <span className="muted">
                  {' '}
                  · {person.role_display}
                  {person.department_name ? ` · ${person.department_name}` : ''}
                </span>
              </span>
            </label>
          </li>
        ))}
      </ul>

      {error && (
        <p className="form__error" role="alert">
          {error}
        </p>
      )}
      <div className="inline-form__actions">
        <button type="button" className="button" disabled={saving || selected.size === 0} onClick={handleAdd}>
          {saving ? 'Adding…' : selected.size ? `Add ${selected.size} to crew` : 'Add to crew'}
        </button>
        <button type="button" className="button button--secondary" onClick={onClose}>
          Cancel
        </button>
      </div>
    </dialog>
  )
}
