import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { api, ApiError, fieldErrors } from '../../../api'
import { formatDay } from '../../../format'
import { useFetch } from '../../../hooks/useFetch'
import {
  MEAL_TYPES,
  SHOPPING_CATEGORIES,
  type Ingredient,
  type MealType,
  type MenuItem,
  type ShoppingCategory,
  type ShoppingList,
} from '../../../types'
import '../../meetings/meetings.css'
import { CulinaryShell } from './CulinaryShell'

interface Form {
  name: string
  date: string
  meal: MealType
  notes: string
  ingredients: Ingredient[]
}

const fromItem = (item: MenuItem): Form => ({
  name: item.name,
  date: item.date,
  meal: item.meal,
  notes: item.notes,
  ingredients: item.ingredients,
})

const snapshot = (form: Form) =>
  JSON.stringify({ ...form, ingredients: form.ingredients.map(({ on_lists: _lists, ...rest }) => rest) })

const categoryLabel = (value: ShoppingCategory) => SHOPPING_CATEGORIES.find((c) => c.value === value)?.label ?? value

/** Add or edit a menu item (/departments/culinary/menu/new and /:id). */
export function MenuItemFormPage() {
  const { id } = useParams()
  const handedOver = (useLocation().state as { item?: MenuItem } | null)?.item
  return (
    <CulinaryShell title={id ? 'Menu item' : 'New menu item'} subtitle="Culinary · Menus">
      {({ canEdit, today }) =>
        !id ? (
          canEdit ? (
            <MenuItemForm item={null} today={today} />
          ) : (
            <p className="form__error">Only the Culinary head and managers can add menu items.</p>
          )
        ) : handedOver && String(handedOver.id) === id ? (
          <MenuItemForm key={id} item={handedOver} today={today} readOnly={!canEdit} />
        ) : (
          <LoadMenuItem key={id} id={id} today={today} readOnly={!canEdit} />
        )
      }
    </CulinaryShell>
  )
}

function LoadMenuItem({ id, today, readOnly }: { id: string; today: string; readOnly: boolean }) {
  const item = useFetch<MenuItem>(`/culinary/menu-items/${id}/`)
  if (item.loading && !item.data) return <p className="loading">Loading the menu item…</p>
  if (!item.data) {
    return (
      <p className="form__error">
        Couldn’t find that menu item. <Link to="/departments/culinary/menu">Back to Menus</Link>
      </p>
    )
  }
  return <MenuItemForm item={item.data} today={today} readOnly={readOnly} />
}

function MenuItemForm({ item, today, readOnly = false }: { item: MenuItem | null; today: string; readOnly?: boolean }) {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [saved, setSaved] = useState<MenuItem | null>(item)
  const [form, setForm] = useState<Form>(
    item
      ? fromItem(item)
      : { name: '', date: params.get('date') || today, meal: 'dinner', notes: '', ingredients: [] },
  )
  const [baseline, setBaseline] = useState(() => snapshot(form))
  const [draft, setDraft] = useState<Ingredient>({ name: '', quantity: '', category: 'other' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState('')
  const [listing, setListing] = useState(false)
  const draftName = useRef<HTMLInputElement>(null)
  const dirty = snapshot(form) !== baseline

  useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const set = <K extends keyof Form>(name: K, value: Form[K]) => setForm((prev) => ({ ...prev, [name]: value }))
  const setIngredient = (index: number, changes: Partial<Ingredient>) =>
    set(
      'ingredients',
      form.ingredients.map((row, i) => (i === index ? { ...row, ...changes } : row)),
    )

  const addDraft = () => {
    if (!draft.name.trim()) return
    set('ingredients', [...form.ingredients, { ...draft, name: draft.name.trim(), quantity: draft.quantity.trim() }])
    setDraft({ name: '', quantity: '', category: draft.category })
    draftName.current?.focus()
  }
  const draftKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      addDraft()
    }
  }

  /** Saves (creating it the first time) and returns the saved item, or null on errors. */
  const save = async (): Promise<MenuItem | null> => {
    setSaving(true)
    setErrors({})
    setStatus('')
    // An ingredient typed but not yet added with + is kept too.
    const ingredients = draft.name.trim() ? [...form.ingredients, draft] : form.ingredients
    try {
      const result = await api<MenuItem>(saved ? `/culinary/menu-items/${saved.id}/` : '/culinary/menu-items/', {
        method: saved ? 'PATCH' : 'POST',
        body: JSON.stringify({ ...form, ingredients }),
      })
      const next = fromItem(result)
      setSaved(result)
      setForm(next)
      setBaseline(snapshot(next))
      setDraft({ name: '', quantity: '', category: draft.category })
      setStatus('Saved.')
      if (!saved) navigate(`/departments/culinary/menu/${result.id}`, { replace: true, state: { item: result } })
      return result
    } catch (err) {
      const fields = fieldErrors(err)
      setErrors(Object.keys(fields).length ? fields : { form: err instanceof ApiError ? err.message : 'Couldn’t save.' })
      return null
    } finally {
      setSaving(false)
    }
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    await save()
  }

  const saveAndClose = async () => {
    const result = await save()
    if (result) navigate(`/departments/culinary/menu?date=${result.date}`)
  }

  const remove = async () => {
    if (!saved || !window.confirm(`Delete “${saved.name}” from the menu? Its ingredients come off any shopping lists that haven’t bought them yet.`))
      return
    await api(`/culinary/menu-items/${saved.id}/`, { method: 'DELETE' })
    navigate(`/departments/culinary/menu?date=${saved.date}`)
  }

  if (readOnly && saved) return <MenuItemView item={saved} />

  const error = (name: string) => errors[name] && <small className="form__field-error">{errors[name]}</small>

  return (
    <>
      <form className="tile form menu-form" onSubmit={submit} noValidate>
        <p className="meetings__breadcrumb">
          <Link to={`/departments/culinary/menu?date=${form.date}`}>← Menus</Link>
        </p>
        {errors.form && (
          <p className="form__error" role="alert">
            {errors.form}
          </p>
        )}
        <label className="form__field">
          <span>
            Item name<span aria-hidden="true"> *</span>
          </span>
          <input
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder="e.g. Beef chili"
            aria-invalid={!!errors.name}
            required
          />
          {error('name')}
        </label>
        <div className="form__grid">
          <label className="form__field">
            <span>Date</span>
            <input type="date" value={form.date} onChange={(e) => set('date', e.target.value)} required />
            {error('date')}
          </label>
          <label className="form__field">
            <span>Meal / item type</span>
            <select value={form.meal} onChange={(e) => set('meal', e.target.value as MealType)}>
              {MEAL_TYPES.map((meal) => (
                <option key={meal.value} value={meal.value}>
                  {meal.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <fieldset className="menu-form__ingredients">
          <legend>Ingredients (optional)</legend>
          {form.ingredients.length > 0 && (
            <ul className="ingredient-rows">
              {form.ingredients.map((row, index) => (
                <li key={row.id ?? `new-${index}`} className="ingredient-row">
                  <input
                    value={row.name}
                    onChange={(e) => setIngredient(index, { name: e.target.value })}
                    aria-label="Ingredient"
                  />
                  <input
                    value={row.quantity}
                    onChange={(e) => setIngredient(index, { quantity: e.target.value })}
                    aria-label={`Quantity of ${row.name}`}
                    placeholder="Qty"
                  />
                  <select
                    value={row.category}
                    onChange={(e) => setIngredient(index, { category: e.target.value as ShoppingCategory })}
                    aria-label={`Shopping section for ${row.name}`}
                  >
                    {SHOPPING_CATEGORIES.map((category) => (
                      <option key={category.value} value={category.value}>
                        {category.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="icon-button ingredient-row__remove"
                    onClick={() => set('ingredients', form.ingredients.filter((_, i) => i !== index))}
                    aria-label={`Remove ${row.name}`}
                    title="Remove"
                  >
                    −
                  </button>
                  {!!row.on_lists?.length && <span className="ingredient-row__listed">On a shopping list</span>}
                </li>
              ))}
            </ul>
          )}
          <div className="ingredient-row ingredient-row--new">
            <input
              ref={draftName}
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              onKeyDown={draftKey}
              placeholder="Add an ingredient"
              aria-label="New ingredient"
            />
            <input
              value={draft.quantity}
              onChange={(e) => setDraft({ ...draft, quantity: e.target.value })}
              onKeyDown={draftKey}
              placeholder="Qty, e.g. 5 lb"
              aria-label="New ingredient quantity"
            />
            <select
              value={draft.category}
              onChange={(e) => setDraft({ ...draft, category: e.target.value as ShoppingCategory })}
              aria-label="New ingredient shopping section"
            >
              {SHOPPING_CATEGORIES.map((category) => (
                <option key={category.value} value={category.value}>
                  {category.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="icon-button ingredient-row__add"
              onClick={addDraft}
              disabled={!draft.name.trim()}
              aria-label="Add ingredient"
              title="Add ingredient"
            >
              +
            </button>
          </div>
          <p className="form__hint">
            Editing an ingredient here updates it on every shopping list it’s on. Removing one takes it off lists, unless
            it’s already been checked off.
          </p>
          <button
            type="button"
            className="button button--secondary menu-form__to-list"
            onClick={() => setListing(true)}
            disabled={saving || (!form.ingredients.length && !draft.name.trim())}
          >
            Add ingredients to shopping list
          </button>
        </fieldset>

        <label className="form__field">
          <span>Notes</span>
          <textarea rows={3} value={form.notes} onChange={(e) => set('notes', e.target.value)} />
        </label>

        <div className="meeting-form__footer">
          <span className="meeting-form__status" role="status">
            {saving ? 'Saving…' : dirty ? 'Unsaved changes' : status}
          </span>
          <span className="inline-form__actions">
            <button type="submit" className="button button--secondary" disabled={saving}>
              Save
            </button>
            <button type="button" className="button" onClick={saveAndClose} disabled={saving}>
              Save and close
            </button>
            {saved && (
              <button type="button" className="text-button text-button--danger" onClick={remove}>
                Delete
              </button>
            )}
          </span>
        </div>
      </form>

      {listing && (
        <AddToListDialog
          save={save}
          onClose={() => setListing(false)}
          onDone={(message) => {
            setListing(false)
            setStatus(message)
          }}
        />
      )}
    </>
  )
}

function MenuItemView({ item }: { item: MenuItem }) {
  return (
    <article className="tile menu-form">
      <p className="meetings__breadcrumb">
        <Link to={`/departments/culinary/menu?date=${item.date}`}>← Menus</Link>
      </p>
      <h2 className="menu-view__name">{item.name}</h2>
      <p className="muted">
        {item.meal_display} · {formatDay(item.date, { weekday: 'long', month: 'long', day: 'numeric' })}
      </p>
      {item.ingredients.length ? (
        <ul className="menu-meal__ingredients">
          {item.ingredients.map((ingredient) => (
            <li key={ingredient.id}>
              {ingredient.name}
              {ingredient.quantity && <span className="muted"> · {ingredient.quantity}</span>}
              <span className="muted"> · {categoryLabel(ingredient.category)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">No ingredients listed.</p>
      )}
      {item.notes && <p className="meeting-note__notes">{item.notes}</p>}
    </article>
  )
}

interface AddToListDialogProps {
  save: () => Promise<MenuItem | null>
  onClose: () => void
  onDone: (message: string) => void
}

/** Pick a shopping list (or start one) for this menu item's ingredients. Saves the item first. */
function AddToListDialog({ save, onClose, onDone }: AddToListDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const lists = useFetch<ShoppingList[]>('/culinary/shopping-lists/')
  const [choice, setChoice] = useState('')
  const [store, setStore] = useState('')
  const [neededBy, setNeededBy] = useState('')
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)
  const creating = choice === 'new' || (lists.data?.length === 0 && choice === '')

  useEffect(() => {
    dialogRef.current?.showModal()
  }, [])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    event.stopPropagation()
    setSending(true)
    setError('')
    const item = await save()
    if (!item) {
      setError('Fix the menu item first, then try again.')
      setSending(false)
      return
    }
    try {
      const result = await api<{ added: number; shopping_list: ShoppingList }>(
        `/culinary/menu-items/${item.id}/add-to-list/`,
        {
          method: 'POST',
          body: JSON.stringify(creating ? { store, needed_by: neededBy || null } : { shopping_list: Number(choice) }),
        },
      )
      const { added, shopping_list: list } = result
      onDone(
        added
          ? `Added ${added} item${added === 1 ? '' : 's'} to the ${list.store} list.`
          : `Everything was already on the ${list.store} list.`,
      )
    } catch (err) {
      setError(fieldErrors(err).store ?? (err instanceof ApiError ? err.message : 'Couldn’t add to the list.'))
      setSending(false)
    }
  }

  return (
    <dialog ref={dialogRef} className="dialog" onClose={onClose} aria-labelledby="to-list-title">
      <form className="form" onSubmit={submit}>
        <div className="dialog__header">
          <h2 id="to-list-title">Add to a shopping list</h2>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        {error && (
          <p className="form__error" role="alert">
            {error}
          </p>
        )}
        {lists.data && lists.data.length > 0 && (
          <label className="form__field">
            <span>Shopping list</span>
            <select value={choice} onChange={(e) => setChoice(e.target.value)} required>
              <option value="" disabled>
                Choose a list
              </option>
              {lists.data.map((list) => (
                <option key={list.id} value={list.id}>
                  {list.store}
                  {list.needed_by ? ` · by ${formatDay(list.needed_by, { month: 'short', day: 'numeric' })}` : ''}
                </option>
              ))}
              <option value="new">+ Start a new list</option>
            </select>
          </label>
        )}
        {creating && (
          <div className="form__grid">
            <label className="form__field">
              <span>
                Store<span aria-hidden="true"> *</span>
              </span>
              <input value={store} onChange={(e) => setStore(e.target.value)} placeholder="e.g. Publix" required autoFocus />
            </label>
            <label className="form__field">
              <span>Shop by</span>
              <input type="date" value={neededBy} onChange={(e) => setNeededBy(e.target.value)} />
            </label>
          </div>
        )}
        <div className="inline-form__actions">
          <button type="submit" className="button" disabled={sending || (!creating && !choice) || (creating && !store.trim())}>
            {sending ? 'Adding…' : 'Add ingredients'}
          </button>
          <button type="button" className="button button--secondary" onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </dialog>
  )
}
