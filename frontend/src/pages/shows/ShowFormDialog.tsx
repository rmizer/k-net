import { useEffect, useRef, useState, type FormEvent } from 'react'
import { api, ApiError, fieldErrors } from '../../api'
import type { User } from '../../auth/roles'
import { DualListBox } from '../../components/DualListBox'
import { SHOW_STATUSES, type Show, type ShowStatus } from '../../types'

interface ShowFormDialogProps {
  /** The show being edited, or null to create a new one. */
  show: Show | null
  /** Everyone, to pick directors and department heads from. */
  people: User[]
  viewer: User
  onSaved: (saved: Show) => void
  onClose: () => void
}

type FormState = {
  name: string
  description: string
  start_date: string
  shooting_location: string
  status: ShowStatus
  seasons: string
  weeks_per_season: string
  director: string
}

type ListField = 'other_directors' | 'department_heads'

const fullName = (person: User) => `${person.first_name} ${person.last_name}`.trim()

export function ShowFormDialog({ show, people, viewer, onSaved, onClose }: ShowFormDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [form, setForm] = useState<FormState>(() => ({
    name: show?.name ?? '',
    description: show?.description ?? '',
    start_date: show?.start_date ?? '',
    shooting_location: show?.shooting_location ?? '',
    status: show?.status ?? '',
    seasons: show?.seasons != null ? String(show.seasons) : '',
    weeks_per_season: show?.weeks_per_season != null ? String(show.weeks_per_season) : '',
    // The director who creates a show is listed as its director by default.
    director: show ? (show.director != null ? String(show.director) : '') : viewer.role === 'director' ? String(viewer.id) : '',
  }))
  const [lists, setLists] = useState<Record<ListField, number[]>>({
    other_directors: show?.other_directors ?? [],
    department_heads: show?.department_heads ?? [],
  })
  const [dirtyLists, setDirtyLists] = useState<Record<ListField, boolean>>({
    other_directors: false,
    department_heads: false,
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    dialogRef.current?.showModal()
  }, [])

  const set = <K extends keyof FormState>(field: K, value: FormState[K]) => setForm({ ...form, [field]: value })

  const directors = people.filter((person) => person.role === 'director')
  const otherDirectorOptions = directors
    .filter((person) => String(person.id) !== form.director)
    .map((person) => ({ id: person.id, label: fullName(person) }))
  const departmentHeadOptions = people
    .filter((person) => person.is_department_head)
    .map((person) => ({
      id: person.id,
      label: `${fullName(person)} · ${person.head_of_department_name ?? 'No department listed'}`,
    }))

  const numberError = (value: string) => (value && !/^\d+$/.test(value) ? 'Enter a whole number.' : '')

  /** On a new show, Save just locks the list in; on an existing one it saves it right away. */
  const saveList = (field: ListField) => async (ids: number[]) => {
    setErrors((current) => ({ ...current, [field]: '' }))
    if (show) {
      try {
        const saved = await api<Show>(`/shows/${show.id}/`, { method: 'PATCH', body: JSON.stringify({ [field]: ids }) })
        setLists((current) => ({ ...current, [field]: saved[field] }))
        onSaved(saved)
      } catch (err) {
        setErrors((current) => ({ ...current, [field]: fieldErrors(err)[field] ?? 'Could not save the list.' }))
        throw err
      }
    } else {
      setLists((current) => ({ ...current, [field]: ids }))
    }
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    const clientErrors: Record<string, string> = {}
    if (!form.name.trim()) clientErrors.name = 'Enter the show name.'
    if (!form.description.trim()) clientErrors.description = 'Enter a description.'
    if (numberError(form.seasons)) clientErrors.seasons = numberError(form.seasons)
    if (numberError(form.weeks_per_season)) clientErrors.weeks_per_season = numberError(form.weeks_per_season)
    if (!show && dirtyLists.other_directors) clientErrors.other_directors = 'Save or undo your changes to this list first.'
    if (!show && dirtyLists.department_heads)
      clientErrors.department_heads = 'Save or undo your changes to this list first.'
    if (Object.keys(clientErrors).length) {
      setErrors(clientErrors)
      return
    }

    setSaving(true)
    setErrors({})
    const body = {
      ...form,
      start_date: form.start_date || null,
      seasons: form.seasons ? Number(form.seasons) : null,
      weeks_per_season: form.weeks_per_season ? Number(form.weeks_per_season) : null,
      director: form.director ? Number(form.director) : null,
      // Existing shows save their lists with each list's own Save button.
      ...(show ? {} : lists),
    }
    try {
      const saved = await api<Show>(show ? `/shows/${show.id}/` : '/shows/', {
        method: show ? 'PATCH' : 'POST',
        body: JSON.stringify(body),
      })
      onSaved(saved)
      onClose()
    } catch (err) {
      const fields = fieldErrors(err)
      setErrors(Object.keys(fields).length ? fields : { form: err instanceof ApiError ? err.message : 'Could not save.' })
      setSaving(false)
    }
  }

  const fieldError = (name: string) => errors[name] && <small className="form__field-error">{errors[name]}</small>

  return (
    <dialog ref={dialogRef} className="dialog show-dialog" onClose={onClose} aria-labelledby="show-form-title">
      <form className="form" onSubmit={handleSubmit} noValidate>
        <div className="dialog__header">
          <h2 id="show-form-title">{show ? `Edit ${show.name}` : 'Create new show'}</h2>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        {errors.form && (
          <p className="form__error" role="alert">
            {errors.form}
          </p>
        )}

        <fieldset className="form__fieldset">
          <legend>The show</legend>
          <div className="form__grid">
            <label className="form__field form__span">
              <span>
                Show name<span aria-hidden="true"> *</span>
              </span>
              <input
                value={form.name}
                onChange={(event) => set('name', event.target.value)}
                aria-invalid={!!errors.name}
                maxLength={150}
                required
                autoComplete="off"
              />
              {fieldError('name')}
            </label>
            <label className="form__field form__span">
              <span>
                Show description<span aria-hidden="true"> *</span>
              </span>
              <textarea
                rows={3}
                value={form.description}
                onChange={(event) => set('description', event.target.value)}
                aria-invalid={!!errors.description}
                required
              />
              {fieldError('description')}
            </label>
            <label className="form__field">
              <span>Production start date</span>
              <input type="date" value={form.start_date} onChange={(event) => set('start_date', event.target.value)} />
              {fieldError('start_date')}
            </label>
            <label className="form__field">
              <span>Shooting location</span>
              <input
                value={form.shooting_location}
                onChange={(event) => set('shooting_location', event.target.value)}
                placeholder="City, State"
                maxLength={150}
                autoComplete="off"
              />
              {fieldError('shooting_location')}
            </label>
            <label className="form__field">
              <span>Show status</span>
              <select value={form.status} onChange={(event) => set('status', event.target.value as ShowStatus)}>
                <option value="">Not set</option>
                {SHOW_STATUSES.map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="show-dialog__numbers">
              <label className="form__field">
                <span>Number of seasons</span>
                <input
                  className="show-dialog__number"
                  inputMode="numeric"
                  value={form.seasons}
                  onChange={(event) => set('seasons', event.target.value.trim())}
                  aria-invalid={!!errors.seasons}
                  maxLength={3}
                />
                {fieldError('seasons')}
              </label>
              <label className="form__field">
                <span>Weeks per season</span>
                <input
                  className="show-dialog__number"
                  inputMode="numeric"
                  value={form.weeks_per_season}
                  onChange={(event) => set('weeks_per_season', event.target.value.trim())}
                  aria-invalid={!!errors.weeks_per_season}
                  maxLength={3}
                />
                {fieldError('weeks_per_season')}
              </label>
            </div>
          </div>
        </fieldset>

        <fieldset className="form__fieldset">
          <legend>People</legend>
          <label className="form__field">
            <span>Director</span>
            <select value={form.director} onChange={(event) => set('director', event.target.value)}>
              <option value="">Not set</option>
              {directors.map((person) => (
                <option key={person.id} value={person.id}>
                  {fullName(person)}
                </option>
              ))}
            </select>
            {fieldError('director')}
          </label>

          <DualListBox
            label="Other directors"
            availableLabel="Directors"
            chosenLabel="On this show"
            options={otherDirectorOptions}
            value={lists.other_directors}
            onSave={saveList('other_directors')}
            onDirtyChange={(dirty) => setDirtyLists((current) => ({ ...current, other_directors: dirty }))}
            error={errors.other_directors}
          />

          <DualListBox
            label="Department heads"
            availableLabel="Department heads"
            chosenLabel="On this show"
            options={departmentHeadOptions}
            value={lists.department_heads}
            onSave={saveList('department_heads')}
            onDirtyChange={(dirty) => setDirtyLists((current) => ({ ...current, department_heads: dirty }))}
            error={errors.department_heads}
          />
          {departmentHeadOptions.length === 0 && (
            <p className="form__hint">
              No one is marked as a department head yet. Mark people as department heads when you edit them in the
              Directory.
            </p>
          )}
        </fieldset>

        <div className="inline-form__actions">
          <button type="submit" className="button" disabled={saving}>
            {saving ? 'Saving…' : show ? 'Save changes' : 'Create show'}
          </button>
          <button type="button" className="button button--secondary" onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </dialog>
  )
}
