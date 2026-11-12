import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { api, ApiError, fieldErrors } from '../../api'
import { NavIcon } from '../../components/NavIcon'
import { useFetch } from '../../hooks/useFetch'
import {
  CHALLENGE_LOCATIONS,
  CHALLENGE_STATUSES,
  CONTENT_WARNINGS,
  SAFETY_CHECK_OPTIONS,
  SAFETY_CHECKS,
  SUPPLY_CATEGORIES,
  type Challenge,
  type ChallengeLocation,
  type ChallengeStatus,
  type ContentWarning,
  type InfluencerSummary,
  type SafetyCheck,
  type StaffOverviewRow,
  type Show,
  type SupplyCategory,
  type SupplyItem,
} from '../../types'
import '../departments/culinary/culinary.css'
import '../finance/finance.css'
import '../meetings/meetings.css'
import './challenge-planner.css'
import './staff-manager.css'

const PLANNER = '/staff-manager/challenge-planner'

/** A supply line plus a key that stays put while it's unsaved. */
type Row = SupplyItem & { key: string }

interface Form {
  name: string
  date: string
  show: string
  week: string
  description: string
  participants: number[]
  rewards: string
  location: ChallengeLocation
  location_details: string
  cleanup_plan: string
  cleanup_owner: string
  waivers: SafetyCheck
  allergy_check: SafetyCheck
  medic: SafetyCheck
  content_warnings: ContentWarning[]
  other_content_warnings: string
  status: ChallengeStatus
  supplies: Row[]
}

const BLANK: Form = {
  name: '',
  date: '',
  show: '',
  week: '',
  description: '',
  participants: [],
  rewards: '',
  location: '',
  location_details: '',
  cleanup_plan: '',
  cleanup_owner: '',
  waivers: 'todo',
  allergy_check: 'todo',
  medic: 'todo',
  content_warnings: [],
  other_content_warnings: '',
  status: 'planning',
  supplies: [],
}

type ItemDraft = Pick<SupplyItem, 'name' | 'quantity' | 'category' | 'note'>

const EMPTY_ITEM: ItemDraft = { name: '', quantity: '', category: 'other', note: '' }

let nextKey = 0
const newKey = () => `new-${(nextKey += 1)}`

const fromChallenge = (challenge: Challenge): Form => ({
  name: challenge.name,
  date: challenge.date,
  show: challenge.show ? String(challenge.show) : '',
  week: challenge.week ? String(challenge.week) : '',
  description: challenge.description,
  participants: challenge.participants,
  rewards: challenge.rewards,
  location: challenge.location,
  location_details: challenge.location_details,
  cleanup_plan: challenge.cleanup_plan,
  cleanup_owner: challenge.cleanup_owner ? String(challenge.cleanup_owner) : '',
  waivers: challenge.waivers,
  allergy_check: challenge.allergy_check,
  medic: challenge.medic,
  content_warnings: challenge.content_warnings,
  other_content_warnings: challenge.other_content_warnings,
  status: challenge.status,
  supplies: challenge.supplies.map((item) => ({ ...item, key: `id-${item.id}` })),
})

const toPayload = (form: Form) => ({
  ...form,
  show: form.show ? Number(form.show) : null,
  week: form.week ? Number(form.week) : null,
  cleanup_owner: form.cleanup_owner ? Number(form.cleanup_owner) : null,
  supplies: form.supplies.map(({ key: _key, ...item }) => item),
})

const snapshot = (form: Form) => JSON.stringify({ ...toPayload(form), participants: [...form.participants].sort() })

/** Add or edit a challenge (/staff-manager/challenge-planner/new and /:id). */
export function ChallengeFormPage() {
  const { id } = useParams()
  const handedOver = (useLocation().state as { challenge?: Challenge } | null)?.challenge
  return (
    <section className="finance staff-manager">
      <div className="page-header">
        <div>
          <h1>
            <NavIcon name="star" />
            {id ? 'Edit challenge' : 'New challenge'}
          </h1>
          <p className="subtitle">Director Dashboard · Challenge Planner</p>
        </div>
      </div>
      {!id ? (
        <ChallengeForm challenge={null} />
      ) : handedOver && String(handedOver.id) === id ? (
        <ChallengeForm key={id} challenge={handedOver} />
      ) : (
        <LoadChallenge key={id} id={id} />
      )}
    </section>
  )
}

function LoadChallenge({ id }: { id: string }) {
  const challenge = useFetch<Challenge>(`/challenges/${id}/`)
  if (challenge.loading && !challenge.data) return <p className="loading">Loading the challenge…</p>
  if (!challenge.data) {
    return (
      <p className="form__error">
        Couldn’t find that challenge. <Link to={PLANNER}>Back to the Challenge Planner</Link>
      </p>
    )
  }
  return <ChallengeForm challenge={challenge.data} />
}

function ChallengeForm({ challenge }: { challenge: Challenge | null }) {
  const navigate = useNavigate()
  const influencers = useFetch<InfluencerSummary[]>('/influencers/')
  const shows = useFetch<Show[]>('/shows/')
  const staff = useFetch<StaffOverviewRow[]>('/staff-manager/staff/')
  const [saved, setSaved] = useState<Challenge | null>(challenge)
  const [form, setForm] = useState<Form>(
    challenge ? fromChallenge(challenge) : BLANK,
  )
  const [baseline, setBaseline] = useState(() => snapshot(form))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState('')
  const dirty = snapshot(form) !== baseline

  useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  // With just one show, new challenges are for it (an untouched form stays clean).
  const onlyShow = shows.data?.length === 1 ? String(shows.data[0].id) : ''
  useEffect(() => {
    if (challenge || !onlyShow) return
    setForm((prev) => (prev.show ? prev : { ...prev, show: onlyShow }))
    setBaseline((prev) => {
      const before = JSON.parse(prev) as ReturnType<typeof toPayload>
      return before.show ? prev : JSON.stringify({ ...before, show: Number(onlyShow) })
    })
  }, [challenge, onlyShow])

  const set = <K extends keyof Form>(name: K, value: Form[K]) => setForm((prev) => ({ ...prev, [name]: value }))

  // Active influencers, plus anyone already on this challenge who has since left.
  const people = useMemo(
    () =>
      (influencers.data ?? [])
        .filter((person) => person.is_active || form.participants.includes(person.id))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [influencers.data, form.participants],
  )
  const safetyToDo = SAFETY_CHECKS.filter((check) => form[check.field] === 'todo')
  const toggleWarning = (warning: ContentWarning) =>
    set(
      'content_warnings',
      form.content_warnings.includes(warning)
        ? form.content_warnings.filter((existing) => existing !== warning)
        : [...form.content_warnings, warning],
    )

  const toggleParticipant = (personId: number) =>
    set(
      'participants',
      form.participants.includes(personId)
        ? form.participants.filter((existing) => existing !== personId)
        : [...form.participants, personId],
    )

  /** Saves (creating it the first time) and returns the saved challenge, or null on errors. */
  const save = async (): Promise<Challenge | null> => {
    setSaving(true)
    setErrors({})
    setStatus('')
    try {
      const result = await api<Challenge>(saved ? `/challenges/${saved.id}/` : '/challenges/', {
        method: saved ? 'PATCH' : 'POST',
        body: JSON.stringify({ ...toPayload(form), date: form.date || null }),
      })
      const next = fromChallenge(result)
      setSaved(result)
      setForm(next)
      setBaseline(snapshot(next))
      setStatus('Saved.')
      if (!saved) navigate(`${PLANNER}/${result.id}`, { replace: true, state: { challenge: result } })
      return result
    } catch (err) {
      const fields = fieldErrors(err)
      setErrors(
        Object.keys(fields).length
          ? fields
          : { form: err instanceof ApiError ? err.message : 'Couldn’t save the challenge.' },
      )
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
    if (await save()) navigate(PLANNER)
  }

  const remove = async () => {
    if (!saved || !window.confirm(`Delete the “${saved.name}” challenge and its supply list? This can’t be undone.`)) return
    setSaving(true)
    try {
      await api(`/challenges/${saved.id}/`, { method: 'DELETE' })
      navigate(PLANNER)
    } catch (err) {
      setErrors({ form: err instanceof ApiError ? err.message : 'Couldn’t delete the challenge.' })
      setSaving(false)
    }
  }

  const cancel = () => {
    if (dirty && !window.confirm('Leave without saving your changes?')) return
    navigate(PLANNER)
  }

  /** Checking off a saved item saves at once, like the grocery lists; the rest waits for Save. */
  const toggleSupply = async (row: Row) => {
    const flip = (rows: Row[]) => rows.map((item) => (item.key === row.key ? { ...item, checked: !row.checked } : item))
    setForm((prev) => ({ ...prev, supplies: flip(prev.supplies) }))
    if (!saved || row.id === undefined) return
    try {
      await api(`/challenge-supplies/${row.id}/`, { method: 'PATCH', body: JSON.stringify({ checked: !row.checked }) })
      setBaseline((prev) => {
        const before = JSON.parse(prev) as ReturnType<typeof toPayload>
        before.supplies = before.supplies.map((item) => (item.id === row.id ? { ...item, checked: !row.checked } : item))
        return JSON.stringify(before)
      })
    } catch (err) {
      setForm((prev) => ({
        ...prev,
        supplies: prev.supplies.map((item) => (item.key === row.key ? { ...item, checked: row.checked } : item)),
      }))
      setErrors({ supplies: err instanceof ApiError ? err.message : 'Couldn’t update that item.' })
    }
  }

  const error = (name: string) => errors[name] && <small className="form__field-error">{errors[name]}</small>

  return (
    <form className="tile form challenge-form" onSubmit={submit} noValidate>
      <p className="meetings__breadcrumb">
        <Link to={PLANNER}>← Challenge Planner</Link>
      </p>
      {errors.form && (
        <p className="form__error" role="alert">
          {errors.form}
        </p>
      )}

      <label className="form__field">
        <span>
          Challenge name<span aria-hidden="true"> *</span>
        </span>
        <input
          value={form.name}
          onChange={(e) => set('name', e.target.value)}
          placeholder="e.g. Egg drop"
          aria-invalid={!!errors.name}
          required
        />
        {error('name')}
      </label>

      <div className="form__grid">
        <label className="form__field">
          <span>
            Challenge date<span aria-hidden="true"> *</span>
          </span>
          <input
            type="date"
            value={form.date}
            onChange={(e) => set('date', e.target.value)}
            aria-invalid={!!errors.date}
            required
          />
          {error('date')}
        </label>
        <label className="form__field">
          <span>Status</span>
          <select value={form.status} onChange={(e) => set('status', e.target.value as ChallengeStatus)}>
            {CHALLENGE_STATUSES.map((option) => (
              <option
                key={option.value}
                value={option.value}
                disabled={option.value !== 'planning' && safetyToDo.length > 0 && form.status !== option.value}
              >
                {option.label}
              </option>
            ))}
          </select>
          {safetyToDo.length > 0 && (
            <small className="form__hint">Finish the safety checklist to mark it Planned or Complete.</small>
          )}
          {error('status')}
        </label>
      </div>

      <div className="form__grid">
        <label className="form__field">
          <span>Show</span>
          <select value={form.show} onChange={(e) => set('show', e.target.value)}>
            <option value="">No show</option>
            {(shows.data ?? []).map((show) => (
              <option key={show.id} value={show.id}>
                {show.name}
              </option>
            ))}
          </select>
          {error('show')}
        </label>
        <label className="form__field">
          <span>Week</span>
          <input
            type="number"
            min={1}
            inputMode="numeric"
            value={form.week}
            onChange={(e) => set('week', e.target.value)}
            placeholder="e.g. 2"
            aria-invalid={!!errors.week}
          />
          {error('week')}
        </label>
      </div>

      <label className="form__field">
        <span>
          Challenge description<span aria-hidden="true"> *</span>
        </span>
        <textarea
          rows={5}
          value={form.description}
          onChange={(e) => set('description', e.target.value)}
          placeholder="What happens, the rules, how a winner is picked"
          aria-invalid={!!errors.description}
          required
        />
        {error('description')}
      </label>

      <fieldset className="challenge-form__group">
        <legend>
          Participants (optional)
          {form.participants.length > 0 && <span className="muted"> · {form.participants.length} picked</span>}
        </legend>
        {influencers.loading && !influencers.data ? (
          <p className="muted">Loading influencers…</p>
        ) : people.length ? (
          <div className="event-people challenge-form__people">
            {people.map((person) => (
              <label key={person.id} className="challenge-form__person">
                <input
                  type="checkbox"
                  checked={form.participants.includes(person.id)}
                  onChange={() => toggleParticipant(person.id)}
                />
                {person.name}
              </label>
            ))}
          </div>
        ) : (
          <p className="muted">No active influencers on the roster.</p>
        )}
        {error('participants')}
      </fieldset>

      <label className="form__field">
        <span>Challenge rewards (optional)</span>
        <textarea
          rows={3}
          value={form.rewards}
          onChange={(e) => set('rewards', e.target.value)}
          placeholder="e.g. Immunity for the week, $500 cash prize"
        />
        {error('rewards')}
      </label>

      <div className="form__grid">
        <label className="form__field">
          <span>Where on site</span>
          <select value={form.location} onChange={(e) => set('location', e.target.value as ChallengeLocation)}>
            <option value="">Not decided</option>
            {CHALLENGE_LOCATIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {error('location')}
        </label>
        <label className="form__field">
          <span>Location details</span>
          <input
            value={form.location_details}
            onChange={(e) => set('location_details', e.target.value)}
            placeholder="e.g. On tarps by the pool deck; keep it off the indoor floors"
          />
          {error('location_details')}
        </label>
      </div>

      <fieldset className="challenge-form__group">
        <legend>Clean-up</legend>
        <label className="form__field">
          <span>Clean-up plan</span>
          <textarea
            rows={3}
            value={form.cleanup_plan}
            onChange={(e) => set('cleanup_plan', e.target.value)}
            placeholder="What gets cleaned, how, and by when"
          />
          {error('cleanup_plan')}
        </label>
        <label className="form__field">
          <span>Clean-up owner</span>
          <select value={form.cleanup_owner} onChange={(e) => set('cleanup_owner', e.target.value)}>
            <option value="">No one yet</option>
            {(staff.data ?? []).map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
                {person.department_name ? ` · ${person.department_name}` : ''}
              </option>
            ))}
          </select>
          {error('cleanup_owner')}
        </label>
      </fieldset>

      <fieldset className="challenge-form__group">
        <legend>
          Safety checklist
          {safetyToDo.length > 0 ? (
            <span className="challenge-safety__todo"> · {safetyToDo.length} to do</span>
          ) : (
            <span className="challenge-safety__clear"> · All clear</span>
          )}
        </legend>
        <ul className="challenge-safety">
          {SAFETY_CHECKS.map((check) => (
            <li key={check.field} className={`challenge-safety__row is-${form[check.field]}`}>
              <span className="challenge-safety__label">{check.label}</span>
              <span className="challenge-safety__options" role="radiogroup" aria-label={check.label}>
                {SAFETY_CHECK_OPTIONS.map((option) => (
                  <label key={option.value} className="challenge-safety__option">
                    <input
                      type="radio"
                      name={check.field}
                      value={option.value}
                      checked={form[check.field] === option.value}
                      onChange={() => set(check.field, option.value)}
                    />
                    {option.label}
                  </label>
                ))}
              </span>
              {error(check.field)}
            </li>
          ))}
        </ul>
      </fieldset>

      <fieldset className="challenge-form__group">
        <legend>
          Content warnings for the stream
          {form.content_warnings.length > 0 && <span className="muted"> · {form.content_warnings.length} picked</span>}
        </legend>
        <div className="event-people challenge-form__warnings">
          {CONTENT_WARNINGS.map((warning) => (
            <label key={warning.value} className="challenge-form__person">
              <input
                type="checkbox"
                checked={form.content_warnings.includes(warning.value)}
                onChange={() => toggleWarning(warning.value)}
              />
              {warning.label}
            </label>
          ))}
        </div>
        <label className="form__field">
          <span>Other warnings</span>
          <input
            value={form.other_content_warnings}
            onChange={(e) => set('other_content_warnings', e.target.value)}
            placeholder="e.g. Live spiders"
          />
        </label>
        {error('content_warnings')}
      </fieldset>

      <SupplyList
        rows={form.supplies}
        onChange={(supplies) => set('supplies', supplies)}
        onToggle={toggleSupply}
        error={errors.supplies}
      />

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
          <button type="button" className="text-button" onClick={cancel} disabled={saving}>
            Cancel
          </button>
          {saved && (
            <button type="button" className="text-button text-button--danger" onClick={remove} disabled={saving}>
              Delete
            </button>
          )}
        </span>
      </div>
    </form>
  )
}

function CategorySelect({ value, onChange }: { value: SupplyCategory; onChange: (value: SupplyCategory) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value as SupplyCategory)} aria-label="Section">
      {SUPPLY_CATEGORIES.map((category) => (
        <option key={category.value} value={category.value}>
          {category.label}
        </option>
      ))}
    </select>
  )
}

interface SupplyListProps {
  rows: Row[]
  onChange: (rows: Row[]) => void
  onToggle: (row: Row) => void
  error?: string
}

/** The supply list, laid out like the Culinary shopping lists: by section, with
 *  big check boxes, a progress bar and Hide checked. */
function SupplyList({ rows, onChange, onToggle, error }: SupplyListProps) {
  const [draft, setDraft] = useState<ItemDraft>(EMPTY_ITEM)
  const [editing, setEditing] = useState<string | null>(null)
  const [hideChecked, setHideChecked] = useState(false)
  const draftName = useRef<HTMLInputElement>(null)

  const checked = rows.filter((row) => row.checked).length
  const shown = hideChecked ? rows.filter((row) => !row.checked) : rows
  const sections = SUPPLY_CATEGORIES.map((category) => ({
    ...category,
    rows: shown.filter((row) => row.category === category.value),
  })).filter((section) => section.rows.length)

  const add = () => {
    if (!draft.name.trim()) return
    onChange([
      ...rows,
      { ...draft, name: draft.name.trim(), quantity: draft.quantity.trim(), note: draft.note.trim(), checked: false, key: newKey() },
    ])
    // Keep the section: lists are often entered a section at a time.
    setDraft({ ...EMPTY_ITEM, category: draft.category })
    draftName.current?.focus()
  }
  const addOnEnter = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      add()
    }
  }
  const remove = (row: Row) => {
    if (!window.confirm(`Take “${row.name}” off the supply list?`)) return
    onChange(rows.filter((item) => item.key !== row.key))
  }

  return (
    <fieldset className="challenge-form__group challenge-supplies">
      <legend>Challenge supply list</legend>

      {rows.length > 0 && (
        <div className="shopping__progress-row">
          <div className="shopping-progress" aria-hidden="true">
            <span style={{ width: `${(checked / rows.length) * 100}%` }} />
          </div>
          <span className="shopping__count">
            {checked} of {rows.length} checked off
          </span>
          <label className="shopping__hide">
            <input type="checkbox" checked={hideChecked} onChange={(e) => setHideChecked(e.target.checked)} /> Hide checked
          </label>
        </div>
      )}

      <div className="challenge-supplies__add">
        <h3 className="shopping-section__title">Add an item</h3>
        <div className="shopping-add__row">
          <input
            ref={draftName}
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            onKeyDown={addOnEnter}
            placeholder="Item, e.g. Tarp"
            aria-label="Item"
          />
          <input
            value={draft.quantity}
            onChange={(e) => setDraft({ ...draft, quantity: e.target.value })}
            onKeyDown={addOnEnter}
            placeholder="Qty, e.g. 2"
            aria-label="Quantity"
          />
          <CategorySelect value={draft.category} onChange={(category) => setDraft({ ...draft, category })} />
          <input
            value={draft.note}
            onChange={(e) => setDraft({ ...draft, note: e.target.value })}
            onKeyDown={addOnEnter}
            placeholder="Note, e.g. Home Depot, or who’s bringing it"
            aria-label="Note"
          />
          <button type="button" className="button" onClick={add} disabled={!draft.name.trim()}>
            + Add
          </button>
        </div>
      </div>

      {error && (
        <p className="form__error" role="alert">
          {error}
        </p>
      )}

      {rows.length === 0 ? (
        <p className="muted">Nothing on the supply list yet.</p>
      ) : sections.length === 0 ? (
        <p className="muted">Everything’s checked off.</p>
      ) : (
        sections.map((section) => (
          <section key={section.value} className="challenge-supplies__section" aria-label={section.label}>
            <h3 className="shopping-section__title">
              {section.label} <span className="department__count">{section.rows.length}</span>
            </h3>
            <ul className="shopping-items">
              {section.rows.map((row) =>
                editing === row.key ? (
                  <li key={row.key} className="shopping-item">
                    <ItemEditor
                      row={row}
                      onCancel={() => setEditing(null)}
                      onSave={(changes) => {
                        onChange(rows.map((item) => (item.key === row.key ? { ...item, ...changes } : item)))
                        setEditing(null)
                      }}
                    />
                  </li>
                ) : (
                  <li key={row.key} className={`shopping-item${row.checked ? ' is-checked' : ''}`}>
                    <label className="shopping-item__check">
                      <input type="checkbox" checked={row.checked} onChange={() => onToggle(row)} />
                      <span className="shopping-item__body">
                        <span className="shopping-item__name">
                          {row.name}
                          {row.quantity && <span className="shopping-item__qty">{row.quantity}</span>}
                        </span>
                        {row.note && <span className="shopping-item__meal">{row.note}</span>}
                      </span>
                    </label>
                    <span className="shopping-item__actions">
                      <button type="button" className="text-button" onClick={() => setEditing(row.key)}>
                        Edit
                      </button>
                      <button
                        type="button"
                        className="icon-button shopping-item__remove"
                        onClick={() => remove(row)}
                        aria-label={`Remove ${row.name}`}
                        title="Remove"
                      >
                        −
                      </button>
                    </span>
                  </li>
                ),
              )}
            </ul>
          </section>
        ))
      )}
      <p className="form__hint">Checking an item off saves right away. Other supply list changes are saved with the challenge.</p>
    </fieldset>
  )
}

function ItemEditor({ row, onCancel, onSave }: { row: Row; onCancel: () => void; onSave: (changes: ItemDraft) => void }) {
  const [form, setForm] = useState<ItemDraft>({
    name: row.name,
    quantity: row.quantity,
    category: row.category,
    note: row.note,
  })
  const apply = () => {
    if (!form.name.trim()) return
    onSave({ ...form, name: form.name.trim(), quantity: form.quantity.trim(), note: form.note.trim() })
  }
  const applyOnEnter = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      apply()
    }
  }

  return (
    <div className="shopping-add__row shopping-item__editor">
      <input
        value={form.name}
        onChange={(e) => setForm({ ...form, name: e.target.value })}
        onKeyDown={applyOnEnter}
        aria-label="Item"
        autoFocus
      />
      <input
        value={form.quantity}
        onChange={(e) => setForm({ ...form, quantity: e.target.value })}
        onKeyDown={applyOnEnter}
        aria-label="Quantity"
        placeholder="Qty"
      />
      <CategorySelect value={form.category} onChange={(category) => setForm({ ...form, category })} />
      <input
        value={form.note}
        onChange={(e) => setForm({ ...form, note: e.target.value })}
        onKeyDown={applyOnEnter}
        aria-label="Note"
        placeholder="Note"
      />
      <span className="inline-form__actions">
        <button type="button" className="button" onClick={apply} disabled={!form.name.trim()}>
          Done
        </button>
        <button type="button" className="button button--secondary" onClick={onCancel}>
          Cancel
        </button>
      </span>
    </div>
  )
}
