import { useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, ApiError, fieldErrors } from '../../../api'
import { useAuth } from '../../../auth/useAuth'
import { useFetch } from '../../../hooks/useFetch'
import { SHOPPING_CATEGORIES, type ShoppingCategory, type ShoppingItem, type ShoppingList } from '../../../types'
import { CulinaryShell } from './CulinaryShell'
import { ReceiptButton } from './ReceiptButton'
import { shopBy } from './shared'

interface ItemForm {
  name: string
  quantity: string
  category: ShoppingCategory
  meal: string
}

const EMPTY: ItemForm = { name: '', quantity: '', category: 'other', meal: '' }

/** One shopping list, by store section, to check off while shopping (made for phones). */
export function ShoppingListPage() {
  const { id = '' } = useParams()
  return (
    <CulinaryShell title="Shopping list" subtitle="Culinary · Shopping lists">
      {({ canEdit }) => <ListView key={id} id={id} canEdit={canEdit} />}
    </CulinaryShell>
  )
}

function ListView({ id, canEdit }: { id: string; canEdit: boolean }) {
  const { user } = useAuth()
  const list = useFetch<ShoppingList>(`/culinary/shopping-lists/${id}/`)
  // Check-offs show at once; the server's copy replaces them when it answers.
  const [local, setLocal] = useState<Record<number, ShoppingItem>>({})
  const [hideChecked, setHideChecked] = useState(false)
  const [editing, setEditing] = useState<number | null>(null)
  const [editingDetails, setEditingDetails] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const canCheck = canEdit || user?.department_page === 'culinary'

  if (list.loading && !list.data) return <p className="loading">Loading the list…</p>
  if (!list.data) {
    return (
      <p className="form__error">
        Couldn’t find that list. <Link to="/departments/culinary/shopping">Back to Shopping lists</Link>
      </p>
    )
  }
  const data = list.data
  const items = (data.items ?? []).map((item) => local[item.id] ?? item)
  const checked = items.filter((item) => item.checked).length
  const shown = hideChecked ? items.filter((item) => !item.checked) : items
  const sections = SHOPPING_CATEGORIES.map((category) => ({
    ...category,
    items: shown.filter((item) => item.category === category.value),
  })).filter((section) => section.items.length)

  const reload = () => {
    setLocal({})
    list.reload()
  }

  const toggle = async (item: ShoppingItem) => {
    setError('')
    setLocal((prev) => ({ ...prev, [item.id]: { ...item, checked: !item.checked } }))
    try {
      const saved = await api<ShoppingItem>(`/culinary/shopping-items/${item.id}/`, {
        method: 'PATCH',
        body: JSON.stringify({ checked: !item.checked }),
      })
      setLocal((prev) => ({ ...prev, [item.id]: saved }))
    } catch (err) {
      setLocal(({ [item.id]: _undone, ...rest }) => rest)
      setError(err instanceof ApiError ? err.message : 'Couldn’t update that item.')
    }
  }

  const removeItem = async (item: ShoppingItem) => {
    if (!window.confirm(`Take “${item.name}” off the list?`)) return
    await api(`/culinary/shopping-items/${item.id}/`, { method: 'DELETE' })
    reload()
  }

  return (
    <div className="shopping">
      <p className="meetings__breadcrumb no-print">
        <Link to="/departments/culinary/shopping">← Shopping lists</Link>
      </p>

      <header className="tile shopping__header">
        {editingDetails ? (
          <DetailsForm
            list={data}
            onCancel={() => setEditingDetails(false)}
            onSaved={() => {
              setEditingDetails(false)
              reload()
            }}
          />
        ) : (
          <>
            <div>
              <h2 className="shopping__store">{data.store}</h2>
              <p className="shopping__when">{shopBy(data)}</p>
              {data.notes && <p className="shopping__notes">{data.notes}</p>}
            </div>
            <div className="shopping__tools no-print">
              {canEdit && (
                <button type="button" className="text-button" onClick={() => setEditingDetails(true)}>
                  Edit details
                </button>
              )}
              <button type="button" className="text-button" onClick={() => window.print()}>
                Print / save PDF
              </button>
            </div>
          </>
        )}
        <div className="shopping__progress-row">
          <div className="shopping-progress" aria-hidden="true">
            <span style={{ width: `${items.length ? (checked / items.length) * 100 : 0}%` }} />
          </div>
          <span className="shopping__count">
            {checked} of {items.length} checked off
          </span>
          {items.length > 0 && (
            <label className="shopping__hide no-print">
              <input type="checkbox" checked={hideChecked} onChange={(e) => setHideChecked(e.target.checked)} /> Hide
              checked
            </label>
          )}
        </div>
      </header>

      {error && (
        <p className="form__error" role="alert">
          {error}
        </p>
      )}

      {canEdit && <AddItemForm listId={data.id} onAdded={reload} />}

      {items.length === 0 ? (
        <p className="tile muted">
          Nothing on this list yet.{canEdit && ' Add items above, or from a menu item’s ingredients.'}
        </p>
      ) : sections.length === 0 ? (
        <p className="tile muted">Everything’s checked off.</p>
      ) : (
        sections.map((section) => (
          <section key={section.value} className="tile shopping-section" aria-label={section.label}>
            <h3 className="shopping-section__title">
              {section.label} <span className="department__count">{section.items.length}</span>
            </h3>
            <ul className="shopping-items">
              {section.items.map((item) =>
                editing === item.id ? (
                  <li key={item.id} className="shopping-item">
                    <ItemEditor
                      item={item}
                      onCancel={() => setEditing(null)}
                      onSaved={() => {
                        setEditing(null)
                        reload()
                      }}
                    />
                  </li>
                ) : (
                  <li key={item.id} className={`shopping-item${item.checked ? ' is-checked' : ''}`}>
                    <label className="shopping-item__check">
                      <input
                        type="checkbox"
                        checked={item.checked}
                        disabled={!canCheck}
                        onChange={() => toggle(item)}
                      />
                      <span className="shopping-item__body">
                        <span className="shopping-item__name">
                          {item.name}
                          {item.quantity && <span className="shopping-item__qty">{item.quantity}</span>}
                        </span>
                        {item.meal && <span className="shopping-item__meal">For {item.meal}</span>}
                      </span>
                    </label>
                    {canEdit && (
                      <span className="shopping-item__actions no-print">
                        <button type="button" className="text-button" onClick={() => setEditing(item.id)}>
                          Edit
                        </button>
                        <button
                          type="button"
                          className="icon-button shopping-item__remove"
                          onClick={() => removeItem(item)}
                          aria-label={`Remove ${item.name}`}
                          title="Remove"
                        >
                          −
                        </button>
                      </span>
                    )}
                  </li>
                ),
              )}
            </ul>
          </section>
        ))
      )}

      <div className="shopping__receipt no-print">
        <ReceiptButton
          label="Submit receipt"
          defaults={{ title: `${data.store} receipt`, vendor: data.store }}
          onSent={setNotice}
        />
        {notice && (
          <p className="notice notice--success" role="status">
            {notice}
          </p>
        )}
      </div>
    </div>
  )
}

function CategorySelect({ value, onChange }: { value: ShoppingCategory; onChange: (value: ShoppingCategory) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value as ShoppingCategory)} aria-label="Section">
      {SHOPPING_CATEGORIES.map((category) => (
        <option key={category.value} value={category.value}>
          {category.label}
        </option>
      ))}
    </select>
  )
}

function AddItemForm({ listId, onAdded }: { listId: number; onAdded: () => void }) {
  const [form, setForm] = useState<ItemForm>(EMPTY)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      await api('/culinary/shopping-items/', {
        method: 'POST',
        body: JSON.stringify({ ...form, shopping_list: listId }),
      })
      // Keep the section and meal: lists are often entered a meal at a time.
      setForm({ ...EMPTY, category: form.category, meal: form.meal })
      onAdded()
    } catch (err) {
      setError(fieldErrors(err).name ?? (err instanceof ApiError ? err.message : 'Couldn’t add that item.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="tile shopping-add no-print" onSubmit={submit}>
      <h3 className="shopping-section__title">Add an item</h3>
      <div className="shopping-add__row">
        <input
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="Item, e.g. Ground beef"
          aria-label="Item"
          required
        />
        <input
          value={form.quantity}
          onChange={(e) => setForm({ ...form, quantity: e.target.value })}
          placeholder="Qty, e.g. 5 lb"
          aria-label="Quantity"
        />
        <CategorySelect value={form.category} onChange={(category) => setForm({ ...form, category })} />
        <input
          value={form.meal}
          onChange={(e) => setForm({ ...form, meal: e.target.value })}
          placeholder="For which meal? e.g. Chili night"
          aria-label="For which meal"
        />
        <button type="submit" className="button" disabled={saving || !form.name.trim()}>
          + Add
        </button>
      </div>
      {error && <small className="form__field-error">{error}</small>}
    </form>
  )
}

function ItemEditor({ item, onCancel, onSaved }: { item: ShoppingItem; onCancel: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<ItemForm>({
    name: item.name,
    quantity: item.quantity,
    category: item.category,
    meal: item.meal,
  })
  const [error, setError] = useState('')

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    try {
      await api(`/culinary/shopping-items/${item.id}/`, { method: 'PATCH', body: JSON.stringify(form) })
      onSaved()
    } catch (err) {
      setError(fieldErrors(err).name ?? (err instanceof ApiError ? err.message : 'Couldn’t save.'))
    }
  }

  return (
    <form className="shopping-add__row shopping-item__editor" onSubmit={submit}>
      <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} aria-label="Item" required />
      <input
        value={form.quantity}
        onChange={(e) => setForm({ ...form, quantity: e.target.value })}
        aria-label="Quantity"
        placeholder="Qty"
      />
      <CategorySelect value={form.category} onChange={(category) => setForm({ ...form, category })} />
      <input
        value={form.meal}
        onChange={(e) => setForm({ ...form, meal: e.target.value })}
        aria-label="For which meal"
        placeholder="For which meal?"
      />
      <span className="inline-form__actions">
        <button type="submit" className="button">
          Save
        </button>
        <button type="button" className="button button--secondary" onClick={onCancel}>
          Cancel
        </button>
      </span>
      {item.ingredient && (
        <small className="form__hint">From a menu item: editing the menu updates this line.</small>
      )}
      {error && <small className="form__field-error">{error}</small>}
    </form>
  )
}

function DetailsForm({ list, onCancel, onSaved }: { list: ShoppingList; onCancel: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ store: list.store, needed_by: list.needed_by ?? '', notes: list.notes })
  const [error, setError] = useState('')

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    try {
      await api(`/culinary/shopping-lists/${list.id}/`, {
        method: 'PATCH',
        body: JSON.stringify({ ...form, needed_by: form.needed_by || null }),
      })
      onSaved()
    } catch (err) {
      setError(fieldErrors(err).store ?? (err instanceof ApiError ? err.message : 'Couldn’t save.'))
    }
  }

  return (
    <form className="form shopping__details" onSubmit={submit}>
      <div className="form__grid">
        <label className="form__field">
          <span>Store</span>
          <input value={form.store} onChange={(e) => setForm({ ...form, store: e.target.value })} required />
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
      {error && <small className="form__field-error">{error}</small>}
      <span className="inline-form__actions">
        <button type="submit" className="button">
          Save
        </button>
        <button type="button" className="button button--secondary" onClick={onCancel}>
          Cancel
        </button>
      </span>
    </form>
  )
}
