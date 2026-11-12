import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { api, ApiError, fieldErrors } from '../../api'
import { canDeleteVehicles, canUseVehicles, isManagerLevel, type User } from '../../auth/roles'
import { useAuth } from '../../auth/useAuth'
import { NavIcon } from '../../components/NavIcon'
import { formatDateTime, formatDay, fromLocalInput, toLocalInput } from '../../format'
import { useFetch } from '../../hooks/useFetch'
import {
  VEHICLE_KINDS,
  VEHICLE_OWNERSHIP,
  VEHICLE_STATUSES,
  type ProjectDocument,
  type Vehicle,
  type VehicleDocument,
  type VehicleKind,
  type VehicleOwnership,
  type VehicleStatus,
} from '../../types'
import { DocumentFormDialog } from '../documents/DocumentFormDialog'
import { money } from '../documents/DocumentsPage'
import { ForbiddenPage } from '../ForbiddenPage'
import { Stat } from '../finance/shared'
import { VehicleIcon } from './VehicleIcon'
import '../departments/departments.css'
import '../documents/documents.css'
import '../finance/finance.css'
import '../meetings/meetings.css'
import '../staff-manager/staff-manager.css'
import './vehicles.css'

/** Rentals due back within this many hours are flagged. */
const DUE_SOON_HOURS = 72

/** The same pages open from the Director Dashboard and the Transportation page;
 *  links stay in whichever section you came from. */
function useSection() {
  const { pathname } = useLocation()
  return pathname.startsWith('/staff-manager')
    ? { base: '/staff-manager/vehicles', label: 'Director Dashboard' }
    : { base: '/departments/transportation/vehicles', label: 'Transportation' }
}

type Due = 'overdue' | 'soon' | 'ok' | 'none'

function dueOf(vehicle: Vehicle, now = Date.now()): Due {
  if (!vehicle.return_by || vehicle.ownership === 'owned' || vehicle.status === 'returned') return 'none'
  const left = new Date(vehicle.return_by).getTime() - now
  if (left < 0) return 'overdue'
  if (left < DUE_SOON_HOURS * 60 * 60 * 1000) return 'soon'
  return 'ok'
}

/** "2022 Ford F-750", from whichever of the year and make/model are filled in. */
const yearMakeModel = (vehicle: Pick<Vehicle, 'year' | 'make_model'>) =>
  [vehicle.year, vehicle.make_model].filter(Boolean).join(' ')

const plateText = (vehicle: Pick<Vehicle, 'license_plate' | 'plate_state'>) =>
  `${vehicle.license_plate}${vehicle.plate_state ? ` · ${vehicle.plate_state}` : ''}`

function Header({ title, children }: { title: string; children?: ReactNode }) {
  const { label } = useSection()
  return (
    <div className="page-header">
      <div>
        <h1>
          <NavIcon name="bus" />
          {title}
        </h1>
        <p className="subtitle">{label} · Vehicles</p>
      </div>
      {children && <span className="inline-form__actions">{children}</span>}
    </div>
  )
}

function DueNote({ vehicle }: { vehicle: Vehicle }) {
  const due = dueOf(vehicle)
  if (due === 'none' || !vehicle.return_by) return null
  return (
    <span className={`vehicle-due is-${due}`}>
      {due === 'overdue' ? 'Overdue: was due ' : 'Due back '}
      {formatDateTime(vehicle.return_by)}
    </span>
  )
}

function VehicleCard({ vehicle, base }: { vehicle: Vehicle; base: string }) {
  const receipts = vehicle.document_details.filter((doc) => doc.category === 'receipt').length
  return (
    <li className={`tile vehicle-card is-${vehicle.status}`}>
      <div className="vehicle-card__head">
        <span className="vehicle-card__icon" title={vehicle.kind_display}>
          <VehicleIcon kind={vehicle.kind} size={24} />
        </span>
        <Link to={`${base}/${vehicle.id}`} state={{ vehicle }} className="vehicle-card__name">
          {vehicle.name}
        </Link>
        {vehicle.status !== 'active' && <span className="vehicle-status">{vehicle.status_display}</span>}
      </div>
      {yearMakeModel(vehicle) && <p className="vehicle-card__model">{yearMakeModel(vehicle)}</p>}
      <p className="vehicle-card__kind">
        {vehicle.kind_display}
        {vehicle.color && ` · ${vehicle.color}`}
        {vehicle.ownership !== 'owned' && ` · ${vehicle.ownership_display}`}
      </p>
      <p className="vehicle-tag" aria-label={`License plate ${plateText(vehicle)}`}>
        <span className="vehicle-tag__label">Tag</span>
        <span className="vehicle-plate">
          {vehicle.license_plate}
          {vehicle.plate_state && <span className="vehicle-plate__state">{vehicle.plate_state}</span>}
        </span>
      </p>
      <dl className="vehicle-card__facts">
        <div>
          <dt>Parked at</dt>
          <dd>{vehicle.storage_location}</dd>
        </div>
        {vehicle.keys_location && (
          <div>
            <dt>Keys</dt>
            <dd>{vehicle.keys_location}</dd>
          </div>
        )}
        {vehicle.rented_from && (
          <div>
            <dt>Rented from</dt>
            <dd>{vehicle.rented_from}</dd>
          </div>
        )}
        {vehicle.return_to && vehicle.status !== 'returned' && (
          <div>
            <dt>Return to</dt>
            <dd>{vehicle.return_to}</dd>
          </div>
        )}
      </dl>
      <p className="vehicle-card__foot">
        <DueNote vehicle={vehicle} />
        {vehicle.document_details.length > 0 && (
          <span className="muted">
            {receipts} receipt{receipts === 1 ? '' : 's'}
            {Number(vehicle.receipt_total) > 0 && ` · ${money.format(Number(vehicle.receipt_total))}`}
          </span>
        )}
      </p>
    </li>
  )
}

/** Active vehicles on the Transportation page, where they're parked and when rentals are due back. */
export function VehiclesSection() {
  const { user } = useAuth()
  if (!canUseVehicles(user)) return null
  return <VehiclesSummary />
}

function VehiclesSummary() {
  const vehicles = useFetch<Vehicle[]>('/vehicles/?status=active')
  const base = '/departments/transportation/vehicles'
  const all = vehicles.data ?? []
  return (
    <section className="department__section" aria-labelledby="transportation-vehicles">
      <div className="vehicles-section__head">
        <h2 id="transportation-vehicles" className="department__heading">
          Vehicles
          {all.length > 0 && <span className="department__count">{all.length} active</span>}
        </h2>
        <span className="inline-form__actions">
          <Link to={base} className="button button--secondary">
            All vehicles
          </Link>
          <Link to={`${base}/new`} className="button">
            + Add a vehicle
          </Link>
        </span>
      </div>
      {vehicles.loading && !vehicles.data ? (
        <p className="tile muted">Loading vehicles…</p>
      ) : all.length ? (
        <ul className="vehicle-grid">
          {all.map((vehicle) => (
            <VehicleCard key={vehicle.id} vehicle={vehicle} base={base} />
          ))}
        </ul>
      ) : (
        <p className="tile muted">No active vehicles. Add the buses, rentals and trucks here so crew know where they are.</p>
      )}
    </section>
  )
}

type StatusFilter = VehicleStatus | 'all'

/** Every vehicle, as cards (/staff-manager/vehicles and /departments/transportation/vehicles). */
export function VehiclesPage() {
  const { user } = useAuth()
  const { base } = useSection()
  const vehicles = useFetch<Vehicle[]>('/vehicles/')
  const [status, setStatus] = useState<StatusFilter>('active')
  const [kind, setKind] = useState<VehicleKind | ''>('')
  const [search, setSearch] = useState('')
  if (!canUseVehicles(user)) return <ForbiddenPage />

  const all = vehicles.data ?? []
  const query = search.trim().toLowerCase()
  const visible = all.filter(
    (vehicle) =>
      (status === 'all' || vehicle.status === status) &&
      (!kind || vehicle.kind === kind) &&
      (!query ||
        [vehicle.name, vehicle.license_plate, vehicle.make_model, vehicle.rented_from, vehicle.storage_location].some(
          (text) => text.toLowerCase().includes(query),
        )),
  )
  const active = all.filter((vehicle) => vehicle.status === 'active')
  const overdue = all.filter((vehicle) => dueOf(vehicle) === 'overdue').length
  const soon = all.filter((vehicle) => dueOf(vehicle) === 'soon').length
  const count = (value: StatusFilter) =>
    value === 'all' ? all.length : all.filter((vehicle) => vehicle.status === value).length

  return (
    <section className="finance staff-manager department vehicles">
      <Header title="Vehicles">
        <Link to={`${base}/new`} className="button">
          + Add a vehicle
        </Link>
      </Header>

      <dl className="fin-stats">
        <Stat label="Active vehicles" value={active.length} />
        <Stat label="Rentals due back soon" value={soon} note={`Within ${DUE_SOON_HOURS / 24} days`} alert={soon > 0} />
        <Stat label="Overdue rentals" value={overdue} alert={overdue > 0} />
      </dl>

      <div className="tile vehicles__toolbar">
        <span className="vehicles__tabs" role="group" aria-label="Show">
          {[...VEHICLE_STATUSES, { value: 'all', label: 'All' } as const].map((option) => (
            <button
              key={option.value}
              type="button"
              className={`vehicles__tab${status === option.value ? ' is-selected' : ''}`}
              aria-pressed={status === option.value}
              onClick={() => setStatus(option.value)}
            >
              {option.label} <span className="vehicles__tab-count">{count(option.value)}</span>
            </button>
          ))}
        </span>
        <div className="form vehicles__filters">
          <label className="form__field">
            <span>Search</span>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name, plate, make, rental company or where it’s parked"
            />
          </label>
          <label className="form__field">
            <span>Type</span>
            <select value={kind} onChange={(e) => setKind(e.target.value as VehicleKind | '')}>
              <option value="">All types</option>
              {VEHICLE_KINDS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {vehicles.loading && !vehicles.data ? (
        <p className="tile muted">Loading vehicles…</p>
      ) : !all.length ? (
        <p className="tile muted">No vehicles yet. Add the party bus, shuttle bus, rentals and trucks with + Add a vehicle.</p>
      ) : !visible.length ? (
        <p className="tile muted">No vehicles match.</p>
      ) : (
        <ul className="vehicle-grid">
          {visible.map((vehicle) => (
            <VehicleCard key={vehicle.id} vehicle={vehicle} base={base} />
          ))}
        </ul>
      )}
    </section>
  )
}

interface Form {
  name: string
  kind: VehicleKind
  description: string
  make_model: string
  year: string
  color: string
  vin: string
  license_plate: string
  plate_state: string
  ownership: VehicleOwnership
  rented_from: string
  rental_reference: string
  rented_on: string
  return_by: string
  return_to: string
  storage_location: string
  keys_location: string
  driver: string
  status: VehicleStatus
  documents: number[]
}

const BLANK: Form = {
  name: '',
  kind: 'shuttle_bus',
  description: '',
  make_model: '',
  year: '',
  color: '',
  vin: '',
  license_plate: '',
  plate_state: '',
  ownership: 'rented',
  rented_from: '',
  rental_reference: '',
  rented_on: '',
  return_by: '',
  return_to: '',
  storage_location: '',
  keys_location: '',
  driver: '',
  status: 'active',
  documents: [],
}

const fromVehicle = (vehicle: Vehicle): Form => ({
  name: vehicle.name,
  kind: vehicle.kind,
  description: vehicle.description,
  make_model: vehicle.make_model,
  year: vehicle.year ? String(vehicle.year) : '',
  color: vehicle.color,
  vin: vehicle.vin,
  license_plate: vehicle.license_plate,
  plate_state: vehicle.plate_state,
  ownership: vehicle.ownership,
  rented_from: vehicle.rented_from,
  rental_reference: vehicle.rental_reference,
  rented_on: vehicle.rented_on ?? '',
  return_by: toLocalInput(vehicle.return_by),
  return_to: vehicle.return_to,
  storage_location: vehicle.storage_location,
  keys_location: vehicle.keys_location,
  driver: vehicle.driver ? String(vehicle.driver) : '',
  status: vehicle.status,
  documents: vehicle.documents,
})

/** Add or edit a vehicle (…/vehicles/new and …/vehicles/:id). */
export function VehicleFormPage() {
  const { user } = useAuth()
  const { id } = useParams()
  const handedOver = (useLocation().state as { vehicle?: Vehicle } | null)?.vehicle
  if (!canUseVehicles(user)) return <ForbiddenPage />
  return (
    <section className="finance staff-manager vehicles">
      <Header title={id ? 'Vehicle' : 'Add a vehicle'} />
      {!id ? (
        <VehicleForm vehicle={null} />
      ) : handedOver && String(handedOver.id) === id ? (
        <VehicleForm key={id} vehicle={handedOver} />
      ) : (
        <LoadVehicle key={id} id={id} />
      )}
    </section>
  )
}

function LoadVehicle({ id }: { id: string }) {
  const { base } = useSection()
  const vehicle = useFetch<Vehicle>(`/vehicles/${id}/`)
  if (vehicle.loading && !vehicle.data) return <p className="loading">Loading the vehicle…</p>
  if (!vehicle.data) {
    return (
      <p className="form__error">
        Couldn’t find that vehicle. <Link to={base}>Back to Vehicles</Link>
      </p>
    )
  }
  return <VehicleForm vehicle={vehicle.data} />
}

const documentLabel = (doc: Pick<ProjectDocument, 'title' | 'vendor' | 'purchase_date' | 'amount'>) =>
  [
    doc.title,
    doc.vendor && doc.vendor !== doc.title ? doc.vendor : '',
    doc.purchase_date ? formatDay(doc.purchase_date, { month: 'short', day: 'numeric' }) : '',
    doc.amount ? money.format(Number(doc.amount)) : '',
  ]
    .filter(Boolean)
    .join(' · ')

function VehicleForm({ vehicle }: { vehicle: Vehicle | null }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { base } = useSection()
  const people = useFetch<User[]>('/users/')
  // Managers see every document; everyone else, the ones they uploaded.
  const library = useFetch<ProjectDocument[]>('/documents/')
  const [saved, setSaved] = useState<Vehicle | null>(vehicle)
  const [form, setForm] = useState<Form>(vehicle ? fromVehicle(vehicle) : BLANK)
  const [baseline, setBaseline] = useState(() => JSON.stringify(form))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState('')
  const [uploading, setUploading] = useState(false)
  const [linking, setLinking] = useState('')
  // Documents uploaded or picked here, until the vehicle is saved and sends its own copy back.
  const [extra, setExtra] = useState<VehicleDocument[]>([])
  const dirty = JSON.stringify(form) !== baseline
  const manager = isManagerLevel(user)

  useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const set = <K extends keyof Form>(name: K, value: Form[K]) => setForm((prev) => ({ ...prev, [name]: value }))

  const known = useMemo(() => {
    const map = new Map<number, VehicleDocument | ProjectDocument>()
    for (const doc of library.data ?? []) map.set(doc.id, doc)
    for (const doc of [...(saved?.document_details ?? []), ...extra]) map.set(doc.id, doc)
    return map
  }, [library.data, saved, extra])
  const linked = form.documents.map((docId) => known.get(docId)).filter((doc) => doc !== undefined)
  const receipts = linked.filter((doc) => doc.category === 'receipt')
  const receiptTotal = receipts.reduce((sum, doc) => sum + (doc.amount ? Number(doc.amount) : 0), 0)
  const linkable = (library.data ?? [])
    .filter((doc) => !form.documents.includes(doc.id))
    .sort((a, b) => (b.purchase_date ?? b.created_at).localeCompare(a.purchase_date ?? a.created_at))
  const linkableGroups = [
    { label: 'Receipts', docs: linkable.filter((doc) => doc.category === 'receipt') },
    { label: 'Vehicle documents', docs: linkable.filter((doc) => doc.category === 'vehicle') },
    { label: 'Other documents', docs: linkable.filter((doc) => doc.category !== 'receipt' && doc.category !== 'vehicle') },
  ].filter((group) => group.docs.length)

  /** A saved vehicle's own link (works for the whole team); before that, the document's. */
  const fileUrl = (doc: VehicleDocument | ProjectDocument) =>
    saved?.documents.includes(doc.id)
      ? `/api/vehicles/${saved.id}/documents/${doc.id}/file/`
      : 'url' in doc
        ? doc.url
        : `/api/documents/${doc.id}/file/`

  const link = (value: string) => {
    if (!value) return
    set('documents', [...form.documents, Number(value)])
    setLinking('')
  }

  const unlink = (doc: { id: number; title: string }) => {
    if (!window.confirm(`Unlink “${doc.title}” from this vehicle? It stays in Documents.`)) return
    set(
      'documents',
      form.documents.filter((existing) => existing !== doc.id),
    )
  }

  /** Saves (adding it the first time) and returns the saved vehicle, or null on errors. */
  const save = async (): Promise<Vehicle | null> => {
    setSaving(true)
    setErrors({})
    setStatus('')
    try {
      const result = await api<Vehicle>(saved ? `/vehicles/${saved.id}/` : '/vehicles/', {
        method: saved ? 'PATCH' : 'POST',
        body: JSON.stringify({
          ...form,
          year: form.year ? Number(form.year) : null,
          rented_on: form.rented_on || null,
          return_by: fromLocalInput(form.return_by),
          driver: form.driver ? Number(form.driver) : null,
        }),
      })
      const next = fromVehicle(result)
      setSaved(result)
      setExtra([])
      setForm(next)
      setBaseline(JSON.stringify(next))
      setStatus('Saved.')
      if (!saved) navigate(`${base}/${result.id}`, { replace: true, state: { vehicle: result } })
      return result
    } catch (err) {
      const fields = fieldErrors(err)
      setErrors(Object.keys(fields).length ? fields : { form: err instanceof ApiError ? err.message : 'Couldn’t save the vehicle.' })
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
    if (await save()) navigate(base)
  }

  const cancel = () => {
    if (dirty && !window.confirm('Leave without saving your changes?')) return
    navigate(base)
  }

  const remove = async () => {
    if (!saved) return
    if (!window.confirm(`Delete “${saved.name}”? This can’t be undone. Its receipts stay in Documents.`)) return
    setSaving(true)
    try {
      await api(`/vehicles/${saved.id}/`, { method: 'DELETE' })
      navigate(base)
    } catch (err) {
      setErrors({ form: err instanceof ApiError ? err.message : 'Couldn’t delete the vehicle.' })
      setSaving(false)
    }
  }

  const error = (name: string) => errors[name] && <small className="form__field-error">{errors[name]}</small>
  const rented = form.ownership !== 'owned'
  const peopleList = [...(people.data ?? [])].sort((a, b) => `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`))

  return (
    <>
      <form className="tile form vehicle-form" onSubmit={submit} noValidate>
        <p className="meetings__breadcrumb">
          <Link to={base}>← Vehicles</Link>
        </p>
        {errors.form && (
          <p className="form__error" role="alert">
            {errors.form}
          </p>
        )}
        {saved && (
          <p className="vehicle-form__summary">
            <span className="vehicle-card__icon" title={saved.kind_display}>
              <VehicleIcon kind={saved.kind} size={26} />
            </span>
            {yearMakeModel(saved) && <span className="vehicle-form__model">{yearMakeModel(saved)}</span>}
            <span className="vehicle-tag" aria-label={`License plate ${plateText(saved)}`}>
              <span className="vehicle-tag__label">Tag</span>
              <span className="vehicle-plate">
                {saved.license_plate}
                {saved.plate_state && <span className="vehicle-plate__state">{saved.plate_state}</span>}
              </span>
            </span>
            <DueNote vehicle={saved} />
          </p>
        )}

        <fieldset className="vehicle-form__group">
          <legend>The vehicle</legend>
          <div className="form__grid">
            <label className="form__field">
              <span>
                Name<span aria-hidden="true"> *</span>
              </span>
              <input
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                placeholder="e.g. Party bus, or U-Haul #2"
                aria-invalid={!!errors.name}
                required
              />
              {error('name')}
            </label>
            <label className="form__field">
              <span>Type</span>
              <select value={form.kind} onChange={(e) => set('kind', e.target.value as VehicleKind)}>
                {VEHICLE_KINDS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="form__field">
            <span>
              Description<span aria-hidden="true"> *</span>
            </span>
            <textarea
              rows={3}
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              placeholder="What it looks like and what it’s for, e.g. Black 30-passenger party bus with the K-Net wrap; takes the hosts to events."
              aria-invalid={!!errors.description}
              required
            />
            {error('description')}
          </label>
          <div className="vehicle-form__row">
            <label className="form__field">
              <span>Make and model</span>
              <input value={form.make_model} onChange={(e) => set('make_model', e.target.value)} placeholder="e.g. Ford E-450" />
            </label>
            <label className="form__field">
              <span>Year</span>
              <input
                type="number"
                inputMode="numeric"
                min={1950}
                max={2100}
                value={form.year}
                onChange={(e) => set('year', e.target.value)}
                aria-invalid={!!errors.year}
              />
              {error('year')}
            </label>
            <label className="form__field">
              <span>Color</span>
              <input value={form.color} onChange={(e) => set('color', e.target.value)} />
            </label>
          </div>
          <div className="form__grid">
            <label className="form__field">
              <span>
                License plate<span aria-hidden="true"> *</span>
              </span>
              <input
                value={form.license_plate}
                onChange={(e) => set('license_plate', e.target.value.toUpperCase())}
                className="vehicle-form__plate"
                aria-invalid={!!errors.license_plate}
                required
              />
              {error('license_plate')}
            </label>
            <label className="form__field">
              <span>Plate state</span>
              <input value={form.plate_state} onChange={(e) => set('plate_state', e.target.value)} placeholder="e.g. FL" />
            </label>
          </div>
          <label className="form__field">
            <span>VIN</span>
            <input
              value={form.vin}
              onChange={(e) => set('vin', e.target.value.toUpperCase())}
              className="vehicle-form__plate"
              maxLength={20}
              autoComplete="off"
              spellCheck={false}
              placeholder="17 characters, on the dashboard by the windshield or the driver’s door frame"
              aria-invalid={!!errors.vin}
            />
            {error('vin')}
          </label>
        </fieldset>

        <fieldset className="vehicle-form__group">
          <legend>Where it is</legend>
          <label className="form__field">
            <span>
              Storage location<span aria-hidden="true"> *</span>
            </span>
            <input
              value={form.storage_location}
              onChange={(e) => set('storage_location', e.target.value)}
              placeholder="Where it’s parked when it isn’t in use, e.g. Hotel back lot, row C"
              aria-invalid={!!errors.storage_location}
              required
            />
            {error('storage_location')}
          </label>
          <div className="form__grid">
            <label className="form__field">
              <span>Where the keys are</span>
              <input
                value={form.keys_location}
                onChange={(e) => set('keys_location', e.target.value)}
                placeholder="e.g. Lockbox in the production office"
              />
            </label>
            <label className="form__field">
              <span>Main driver</span>
              <select value={form.driver} onChange={(e) => set('driver', e.target.value)}>
                <option value="">No one assigned</option>
                {peopleList.map((person) => (
                  <option key={person.id} value={person.id}>
                    {`${person.first_name} ${person.last_name}`.trim()}
                    {person.department_name ? ` · ${person.department_name}` : ''}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="form__field">
            <span>Status</span>
            <select value={form.status} onChange={(e) => set('status', e.target.value as VehicleStatus)}>
              {VEHICLE_STATUSES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <small className="form__hint">Mark a rental Returned once it’s back with the rental company.</small>
          </label>
        </fieldset>

        <fieldset className="vehicle-form__group">
          <legend>Rental</legend>
          <div className="vehicle-form__ownership" role="radiogroup" aria-label="Owned or rented">
            {VEHICLE_OWNERSHIP.map((option) => (
              <label key={option.value} className="vehicle-form__option">
                <input
                  type="radio"
                  name="ownership"
                  value={option.value}
                  checked={form.ownership === option.value}
                  onChange={() => set('ownership', option.value)}
                />
                {option.label}
              </label>
            ))}
          </div>
          {rented ? (
            <>
              <div className="form__grid">
                <label className="form__field">
                  <span>Rented from</span>
                  <input
                    value={form.rented_from}
                    onChange={(e) => set('rented_from', e.target.value)}
                    placeholder="Company and pickup location, e.g. U-Haul of Doral, 8400 NW 36th St"
                  />
                </label>
                <label className="form__field">
                  <span>Rental agreement / reservation #</span>
                  <input value={form.rental_reference} onChange={(e) => set('rental_reference', e.target.value)} />
                </label>
              </div>
              <div className="form__grid">
                <label className="form__field">
                  <span>Picked up on</span>
                  <input type="date" value={form.rented_on} onChange={(e) => set('rented_on', e.target.value)} />
                </label>
                <label className="form__field">
                  <span>Due back</span>
                  <input
                    type="datetime-local"
                    value={form.return_by}
                    onChange={(e) => set('return_by', e.target.value)}
                    aria-invalid={!!errors.return_by}
                  />
                  {error('return_by')}
                </label>
              </div>
              <label className="form__field">
                <span>Return location</span>
                <input
                  value={form.return_to}
                  onChange={(e) => set('return_to', e.target.value)}
                  placeholder="Where it goes back, if not where it came from"
                />
              </label>
            </>
          ) : (
            <p className="muted">Owned vehicles don’t have rental details.</p>
          )}
        </fieldset>

        <fieldset className="vehicle-form__group">
          <legend>
            Receipts and paperwork
            {receipts.length > 0 && (
              <span className="muted">
                {' '}
                · {receipts.length} receipt{receipts.length === 1 ? '' : 's'}, {money.format(receiptTotal)}
              </span>
            )}
          </legend>
          {linked.length ? (
            <ul className="vehicle-docs">
              {linked.map((doc) => (
                <li key={doc.id}>
                  <a href={fileUrl(doc)} target="_blank" rel="noreferrer" className="vehicle-docs__title">
                    {doc.title}
                  </a>
                  <span className="muted vehicle-docs__meta">
                    {[
                      doc.category_display,
                      doc.vendor && doc.vendor !== doc.title ? doc.vendor : '',
                      doc.purchase_date ? formatDay(doc.purchase_date, { month: 'short', day: 'numeric', year: 'numeric' }) : '',
                      doc.uploaded_by_name ? `from ${doc.uploaded_by_name}` : '',
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                  <span className="vehicle-docs__amount">{doc.amount ? money.format(Number(doc.amount)) : ''}</span>
                  <button type="button" className="text-button text-button--danger" onClick={() => unlink(doc)}>
                    Unlink
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">No receipts or paperwork linked yet: rental charges, gas, tolls, registration, insurance.</p>
          )}
          {errors.documents && <small className="form__field-error">{errors.documents}</small>}
          <div className="vehicle-docs__add">
            <select value={linking} onChange={(e) => link(e.target.value)} aria-label="Link a document">
              <option value="">{manager ? 'Link a receipt or document…' : 'Link one of your receipts…'}</option>
              {linkableGroups.map((group) => (
                <optgroup key={group.label} label={group.label}>
                  {group.docs.map((doc) => (
                    <option key={doc.id} value={doc.id}>
                      {documentLabel(doc)}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <button type="button" className="button button--secondary" onClick={() => setUploading(true)}>
              Upload a receipt
            </button>
          </div>
          <small className="form__hint">Linked documents stay in Documents too. Changes here save with the vehicle.</small>
        </fieldset>

        {saved && (
          <p className="muted vehicle-form__meta">
            Added {formatDateTime(saved.created_at)}
            {saved.created_by_name && ` by ${saved.created_by_name}`} · Last changed {formatDateTime(saved.updated_at)}
          </p>
        )}

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
            {saved && canDeleteVehicles(user) && (
              <button type="button" className="text-button text-button--danger" onClick={remove} disabled={saving}>
                Delete
              </button>
            )}
            <button type="button" className="text-button" onClick={cancel} disabled={saving}>
              Cancel
            </button>
          </span>
        </div>
      </form>

      {uploading && (
        <DocumentFormDialog
          document={null}
          initialCategory="receipt"
          canChooseCategory={manager}
          defaults={{ title: form.name ? `${form.name} receipt` : '' }}
          onClose={() => setUploading(false)}
          onSaved={(doc) => {
            setUploading(false)
            library.reload()
            setExtra((prev) => [...prev, { ...doc, url: `/api/documents/${doc.id}/file/` }])
            setForm((prev) => ({ ...prev, documents: [...prev.documents, doc.id] }))
          }}
        />
      )}
    </>
  )
}
