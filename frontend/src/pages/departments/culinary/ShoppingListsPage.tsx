import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, ApiError, fieldErrors } from '../../../api'
import { useFetch } from '../../../hooks/useFetch'
import type { ShoppingList } from '../../../types'
import { CulinaryShell } from './CulinaryShell'
import { shopBy } from './shared'

/** Every Culinary shopping list. The head(s) and managers start and delete them. */
export function ShoppingListsPage() {
  return (
    <CulinaryShell
      title="Shopping lists"
      subtitle="Culinary · Groceries and supplies"
      actions={({ canEdit }) =>
        canEdit && (
          <Link to="/departments/culinary/shopping/new" className="button">
            + New list
          </Link>
        )
      }
    >
      {({ canEdit, today }) => <Lists canEdit={canEdit} today={today} />}
    </CulinaryShell>
  )
}

function Lists({ canEdit, today }: { canEdit: boolean; today: string }) {
  const lists = useFetch<ShoppingList[]>('/culinary/shopping-lists/')
  const [error, setError] = useState('')

  const remove = async (list: ShoppingList) => {
    const count = list.item_count
    const message = `Delete the ${list.store} shopping list${count ? ` and its ${count} item${count === 1 ? '' : 's'}` : ''}? This can’t be undone.`
    if (!window.confirm(message)) return
    setError('')
    try {
      await api(`/culinary/shopping-lists/${list.id}/`, { method: 'DELETE' })
      lists.reload()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Couldn’t delete that list.')
    }
  }

  if (lists.loading && !lists.data) return <p className="loading">Loading shopping lists…</p>
  if (!lists.data) return <p className="form__error">Couldn’t load the shopping lists.</p>

  return (
    <section className="department__section">
      {error && (
        <p className="form__error" role="alert">
          {error}
        </p>
      )}
      {lists.data.length === 0 ? (
        <p className="tile muted">
          No shopping lists yet.{canEdit && ' Start one with + New list, or from a menu item’s ingredients.'}
        </p>
      ) : (
        <ul className="shopping-lists">
          {lists.data.map((list) => {
            const done = list.item_count > 0 && list.checked_count === list.item_count
            const late = !done && !!list.needed_by && list.needed_by < today
            return (
              <li key={list.id} className={`tile shopping-card${done ? ' is-done' : ''}`}>
                <Link to={`/departments/culinary/shopping/${list.id}`} className="shopping-card__store">
                  {list.store}
                </Link>
                <p className={`shopping-card__when${late ? ' is-late' : ''}`}>
                  {shopBy(list)}
                  {late && ' · Past due'}
                </p>
                <div className="shopping-progress" aria-hidden="true">
                  <span style={{ width: `${list.item_count ? (list.checked_count / list.item_count) * 100 : 0}%` }} />
                </div>
                <p className="shopping-card__count">
                  {list.item_count
                    ? `${list.checked_count} of ${list.item_count} item${list.item_count === 1 ? '' : 's'} checked off`
                    : 'No items yet'}
                </p>
                <span className="shopping-card__actions">
                  <Link to={`/departments/culinary/shopping/${list.id}`} className="button button--secondary">
                    Open
                  </Link>
                  {canEdit && (
                    <button type="button" className="text-button text-button--danger" onClick={() => remove(list)}>
                      Delete
                    </button>
                  )}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

/** Start a list: which store and when it's needed by. Items go on next. */
export function NewShoppingListPage() {
  return (
    <CulinaryShell title="New shopping list" subtitle="Culinary · Shopping lists">
      {({ canEdit }) =>
        canEdit ? <NewListForm /> : <p className="form__error">Only the Culinary head and managers can start lists.</p>
      }
    </CulinaryShell>
  )
}

function NewListForm() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ store: '', needed_by: '', notes: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setErrors({})
    try {
      const list = await api<ShoppingList>('/culinary/shopping-lists/', {
        method: 'POST',
        body: JSON.stringify({ ...form, needed_by: form.needed_by || null }),
      })
      navigate(`/departments/culinary/shopping/${list.id}`, { replace: true })
    } catch (err) {
      const fields = fieldErrors(err)
      setErrors(Object.keys(fields).length ? fields : { form: err instanceof ApiError ? err.message : 'Couldn’t save.' })
      setSaving(false)
    }
  }

  return (
    <form className="tile form shopping-new" onSubmit={submit} noValidate>
      {errors.form && (
        <p className="form__error" role="alert">
          {errors.form}
        </p>
      )}
      <div className="form__grid">
        <label className="form__field">
          <span>
            Store<span aria-hidden="true"> *</span>
          </span>
          <input
            value={form.store}
            onChange={(e) => setForm({ ...form, store: e.target.value })}
            placeholder="e.g. Publix, Costco, Restaurant Depot"
            aria-invalid={!!errors.store}
            required
            autoFocus
          />
          {errors.store && <small className="form__field-error">{errors.store}</small>}
        </label>
        <label className="form__field">
          <span>Shop by</span>
          <input type="date" value={form.needed_by} onChange={(e) => setForm({ ...form, needed_by: e.target.value })} />
        </label>
      </div>
      <label className="form__field">
        <span>Notes</span>
        <textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
      </label>
      <div className="inline-form__actions">
        <button type="submit" className="button" disabled={saving || !form.store.trim()}>
          {saving ? 'Creating…' : 'Create list and add items'}
        </button>
        <Link to="/departments/culinary/shopping" className="button button--secondary">
          Cancel
        </Link>
      </div>
    </form>
  )
}
