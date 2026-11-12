import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { api, ApiError, fieldErrors } from '../../../api'
import { NavIcon } from '../../../components/NavIcon'
import { SortHeader, useSort } from '../../../components/sorting'
import { addDays, formatDateTime, formatDay } from '../../../format'
import { useFetch } from '../../../hooks/useFetch'
import {
  ITEM_TYPES,
  QUANTITY_UNITS,
  SIZE_UNIT_GROUPS,
  type Department,
  type InventoryItem,
  type ItemType,
  type ProductionSettings,
  type ProjectDocument,
  type QuantityUnit,
  type SizeUnit,
} from '../../../types'
import { DocumentFormDialog } from '../../documents/DocumentFormDialog'
import { money } from '../../documents/DocumentsPage'
import { Stat } from '../../finance/shared'
import '../../documents/documents.css'
import '../../finance/finance.css'
import '../../meetings/meetings.css'
import '../staff-manager.css'
import './inventory.css'

const BASE = '/staff-manager/inventory'

/** Items expiring within this many days are flagged. */
const EXPIRY_SOON_DAYS = 7

/** "2.00" → "2", "1.50" → "1.5". */
const number = (value: string | null) => (value === null ? '' : String(Number(value)))

const SIZE_SHORT = Object.fromEntries(SIZE_UNIT_GROUPS.flatMap((group) => group.units.map((unit) => [unit.value, unit.short])))

const quantityText = (item: InventoryItem) =>
  `${number(item.quantity)}${item.quantity_unit === 'units' ? '' : ` ${item.quantity_unit_display.toLowerCase()}`}`

/** "12 bananas", or "12 pieces" without a label; empty when there's no count. */
const pieceText = (item: Pick<InventoryItem, 'piece_count' | 'piece_label'>) =>
  item.piece_count === null ? '' : `${item.piece_count} ${item.piece_label || (item.piece_count === 1 ? 'piece' : 'pieces')}`

const sizeText = (item: InventoryItem) => (item.size === null ? '' : `${number(item.size)} ${SIZE_SHORT[item.size_unit] ?? ''}`)

type Expiry = 'expired' | 'soon' | 'ok' | 'none'

function expiryOf(item: Pick<InventoryItem, 'expires_on'>, today: string): Expiry {
  if (!item.expires_on) return 'none'
  if (item.expires_on < today) return 'expired'
  if (item.expires_on <= addDays(today, EXPIRY_SOON_DAYS)) return 'soon'
  return 'ok'
}

function Header({ title, subtitle, children }: { title: string; subtitle: string; children?: ReactNode }) {
  return (
    <div className="page-header">
      <div>
        <h1>
          <NavIcon name="clipboard" />
          {title}
        </h1>
        <p className="subtitle">{subtitle}</p>
      </div>
      {children && <span className="inline-form__actions">{children}</span>}
    </div>
  )
}

/** Puts an item in Recently deleted. Returns false if they cancelled or it failed. */
async function deleteItem(item: InventoryItem, onError: (message: string) => void) {
  if (!window.confirm(`Delete “${item.name}”? It moves to Recently deleted, where you can restore it.`)) return false
  try {
    await api(`/inventory-items/${item.id}/`, { method: 'DELETE' })
    return true
  } catch (err) {
    onError(err instanceof ApiError ? err.message : 'Couldn’t delete that item.')
    return false
  }
}

type StockFilter = 'all' | 'in' | 'out'
type ExpiryFilter = 'all' | 'soon' | 'expired'
type SortKey = 'name' | 'department' | 'quantity' | 'location'

/** Every supply and item the company owns (/staff-manager/inventory). */
export function InventoryPage() {
  const items = useFetch<InventoryItem[]>('/inventory-items/')
  const deleted = useFetch<InventoryItem[]>('/inventory-items/?deleted=1')
  const departments = useFetch<Department[]>('/departments/')
  const production = useFetch<ProductionSettings>('/production/')
  const today = production.data?.today ?? new Date().toISOString().slice(0, 10)
  const [search, setSearch] = useState('')
  const [department, setDepartment] = useState('')
  const [itemType, setItemType] = useState<ItemType | ''>('')
  const [stock, setStock] = useState<StockFilter>('all')
  const [expiry, setExpiry] = useState<ExpiryFilter>('all')
  const [error, setError] = useState('')
  const [undo, setUndo] = useState<InventoryItem | null>(null)
  const sort = useSort<SortKey>('name')

  const all = useMemo(() => items.data ?? [], [items.data])
  const query = search.trim().toLowerCase()
  const visible = sort.apply(
    all.filter(
      (item) =>
        (!query ||
          [item.name, item.storage_location, item.details, item.brand, item.model_number, item.serial_numbers, item.asset_tag].some(
            (text) => text.toLowerCase().includes(query),
          )) &&
        (!department || (department === 'other' ? item.department === null : String(item.department) === department)) &&
        (!itemType || item.item_type === itemType) &&
        (stock === 'all' || (stock === 'in' ? item.in_stock : !item.in_stock)) &&
        (expiry === 'all' ||
          (expiry === 'expired'
            ? expiryOf(item, today) === 'expired'
            : ['soon', 'expired'].includes(expiryOf(item, today)))),
    ),
    (item, key) =>
      ({
        name: item.name.toLowerCase(),
        department: item.department_name.toLowerCase(),
        quantity: Number(item.quantity),
        location: item.storage_location.toLowerCase(),
      })[key],
  )
  const stats = {
    out: all.filter((item) => !item.in_stock).length,
    soon: all.filter((item) => expiryOf(item, today) === 'soon').length,
    expired: all.filter((item) => expiryOf(item, today) === 'expired').length,
  }
  const filtered = !!(query || department || itemType || stock !== 'all' || expiry !== 'all')

  const remove = async (item: InventoryItem) => {
    setError('')
    if (await deleteItem(item, setError)) {
      setUndo(item)
      items.reload()
      deleted.reload()
    }
  }

  const restore = async (item: InventoryItem) => {
    try {
      await api(`/inventory-items/${item.id}/restore/`, { method: 'POST' })
      setUndo(null)
      items.reload()
      deleted.reload()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Couldn’t restore that item.')
    }
  }

  return (
    <section className="finance staff-manager inventory">
      <Header title="Inventory" subtitle="Everything the company owns, by department">
        <Link to={`${BASE}/deleted`} className="button button--secondary">
          Recently deleted{deleted.data?.length ? ` (${deleted.data.length})` : ''}
        </Link>
        <Link to={`${BASE}/new`} className="button">
          + Add item
        </Link>
      </Header>

      <dl className="fin-stats">
        <Stat label="Items" value={all.length} />
        <Stat label="Out of stock" value={stats.out} alert={stats.out > 0} />
        <Stat label="Expiring soon" value={stats.soon} note={`Within ${EXPIRY_SOON_DAYS} days`} alert={stats.soon > 0} />
        <Stat label="Expired" value={stats.expired} alert={stats.expired > 0} />
      </dl>

      {undo && (
        <p className="notice notice--success inventory__undo" role="status">
          “{undo.name}” moved to Recently deleted.
          <button type="button" className="text-button" onClick={() => restore(undo)}>
            Undo
          </button>
        </p>
      )}
      {error && (
        <p className="form__error" role="alert">
          {error}
        </p>
      )}

      <div className="tile">
        <div className="form inventory__filters">
          <label className="form__field">
            <span>Search</span>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Item, storage, details, model, serial or asset tag"
            />
          </label>
          <label className="form__field">
            <span>Department</span>
            <select value={department} onChange={(e) => setDepartment(e.target.value)}>
              <option value="">All departments</option>
              {(departments.data ?? []).map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
              <option value="other">Other</option>
            </select>
          </label>
          <label className="form__field">
            <span>Item type</span>
            <select value={itemType} onChange={(e) => setItemType(e.target.value as ItemType | '')}>
              <option value="">All types</option>
              {ITEM_TYPES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="form__field">
            <span>Stock</span>
            <select value={stock} onChange={(e) => setStock(e.target.value as StockFilter)}>
              <option value="all">All items</option>
              <option value="in">In stock</option>
              <option value="out">Out of stock</option>
            </select>
          </label>
          <label className="form__field">
            <span>Expiration</span>
            <select value={expiry} onChange={(e) => setExpiry(e.target.value as ExpiryFilter)}>
              <option value="all">Any</option>
              <option value="soon">Expiring soon or expired</option>
              <option value="expired">Expired</option>
            </select>
          </label>
        </div>

        {items.loading && !items.data ? (
          <p className="muted">Loading the inventory…</p>
        ) : !all.length ? (
          <p className="muted">Nothing in inventory yet. Add the first item with + Add item.</p>
        ) : !visible.length ? (
          <p className="muted">No items match those filters.</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table inventory-table">
              <thead>
                <tr>
                  <SortHeader sort={sort} column="name">
                    Item
                  </SortHeader>
                  <SortHeader sort={sort} column="department">
                    Department
                  </SortHeader>
                  <SortHeader sort={sort} column="quantity">
                    Qty
                  </SortHeader>
                  <th>Size</th>
                  <SortHeader sort={sort} column="location" className="inventory-table__storage">
                    Storage
                  </SortHeader>
                  <th>
                    <span className="visually-hidden">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.map((item) => {
                  const expires = expiryOf(item, today)
                  return (
                    <tr key={item.id} className={item.in_stock ? '' : 'is-out-of-stock'}>
                      <td data-label="Item">
                        <Link to={`${BASE}/${item.id}`} state={{ item }} className="inventory-table__name">
                          {item.name}
                        </Link>
                        {!item.in_stock && <span className="inventory-badge">Out of stock</span>}
                        {expires === 'expired' && <span className="inventory-badge inventory-badge--alert">Expired</span>}
                        {expires === 'soon' && <span className="inventory-badge inventory-badge--alert">Expires soon</span>}
                        {(item.brand || item.model_number || item.asset_tag) && (
                          <span className="inventory-table__equipment">
                            {[
                              [item.brand, item.model_number].filter(Boolean).join(' '),
                              item.asset_tag && `Tag ${item.asset_tag}`,
                              item.serial_numbers &&
                                (serialCount(item.serial_numbers) > 1
                                  ? `${serialCount(item.serial_numbers)} serials`
                                  : `S/N ${item.serial_numbers}`),
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </span>
                        )}
                        {item.details && <span className="inventory-table__details">{item.details}</span>}
                      </td>
                      <td data-label="Department">
                        {item.department_name}
                        <span className="inventory-table__type">{item.item_type_display}</span>
                      </td>
                      <td data-label="Qty" className="inventory-table__qty">
                        {quantityText(item)}
                        {item.piece_count !== null && <span className="inventory-table__pieces">{pieceText(item)}</span>}
                      </td>
                      <td data-label="Size">{sizeText(item) || '—'}</td>
                      <td data-label="Storage" className="inventory-table__storage">
                        {item.storage_location}
                      </td>
                      <td>
                        <span className="row-actions">
                          <Link to={`${BASE}/${item.id}`} state={{ item }} className="text-button">
                            Edit
                          </Link>
                          <button type="button" className="text-button text-button--danger" onClick={() => remove(item)}>
                            Delete
                          </button>
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        {filtered && visible.length > 0 && (
          <p className="muted inventory__count">
            Showing {visible.length} of {all.length} items
          </p>
        )}
      </div>
    </section>
  )
}

/** Deleted items, newest first, to restore or remove for good (/staff-manager/inventory/deleted). */
export function DeletedInventoryPage() {
  const items = useFetch<InventoryItem[]>('/inventory-items/?deleted=1')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const restore = async (item: InventoryItem) => {
    setError('')
    try {
      await api(`/inventory-items/${item.id}/restore/`, { method: 'POST' })
      setNotice(`“${item.name}” is back in the inventory.`)
      items.reload()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Couldn’t restore that item.')
    }
  }

  const purge = async (item: InventoryItem) => {
    if (!window.confirm(`Delete “${item.name}” for good? This can’t be undone.`)) return
    setError('')
    try {
      await api(`/inventory-items/${item.id}/purge/`, { method: 'DELETE' })
      setNotice(`“${item.name}” was deleted for good.`)
      items.reload()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Couldn’t delete that item.')
    }
  }

  return (
    <section className="finance staff-manager inventory">
      <Header title="Recently deleted" subtitle="Director Dashboard · Inventory">
        <Link to={BASE} className="button button--secondary">
          ← Inventory
        </Link>
      </Header>
      {notice && (
        <p className="notice notice--success" role="status">
          {notice}
        </p>
      )}
      {error && (
        <p className="form__error" role="alert">
          {error}
        </p>
      )}
      <div className="tile">
        {items.loading && !items.data ? (
          <p className="muted">Loading…</p>
        ) : !items.data?.length ? (
          <p className="muted">Nothing deleted. Items you delete from the inventory show up here until you restore them.</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table inventory-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Department</th>
                  <th>Qty</th>
                  <th>Storage</th>
                  <th>Deleted</th>
                  <th>
                    <span className="visually-hidden">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.data.map((item) => (
                  <tr key={item.id}>
                    <td data-label="Item">
                      <Link to={`${BASE}/${item.id}`} className="inventory-table__name">
                        {item.name}
                      </Link>
                    </td>
                    <td data-label="Department">{item.department_name}</td>
                    <td data-label="Qty">{quantityText(item)}</td>
                    <td data-label="Storage">{item.storage_location}</td>
                    <td data-label="Deleted">
                      {item.deleted_at && formatDateTime(item.deleted_at)}
                      {item.deleted_by_name && <span className="muted"> · {item.deleted_by_name}</span>}
                    </td>
                    <td>
                      <span className="row-actions">
                        <button type="button" className="button button--secondary" onClick={() => restore(item)}>
                          Restore
                        </button>
                        <button type="button" className="text-button text-button--danger" onClick={() => purge(item)}>
                          Delete for good
                        </button>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}

interface Form {
  name: string
  department: string
  item_type: ItemType | ''
  purchased_on: string
  expires_on: string
  receipt: string
  quantity: string
  quantity_unit: QuantityUnit
  piece_count: string
  piece_label: string
  size: string
  size_unit: SizeUnit | ''
  storage_location: string
  details: string
  brand: string
  model_number: string
  serial_numbers: string
  asset_tag: string
  warranty_expires: string
}

const BLANK: Form = {
  name: '',
  department: '',
  item_type: '',
  purchased_on: '',
  expires_on: '',
  receipt: '',
  quantity: '1',
  quantity_unit: 'units',
  piece_count: '',
  piece_label: '',
  size: '',
  size_unit: '',
  storage_location: '',
  details: '',
  brand: '',
  model_number: '',
  serial_numbers: '',
  asset_tag: '',
  warranty_expires: '',
}

/** Department "" is unchosen and "other" is no department. */
const fromItem = (item: InventoryItem): Form => ({
  name: item.name,
  department: item.department === null ? 'other' : String(item.department),
  item_type: item.item_type,
  purchased_on: item.purchased_on ?? '',
  expires_on: item.expires_on ?? '',
  receipt: item.receipt === null ? '' : String(item.receipt),
  quantity: number(item.quantity),
  quantity_unit: item.quantity_unit,
  piece_count: item.piece_count === null ? '' : String(item.piece_count),
  piece_label: item.piece_label,
  size: number(item.size),
  size_unit: item.size_unit,
  storage_location: item.storage_location,
  details: item.details,
  brand: item.brand,
  model_number: item.model_number,
  serial_numbers: item.serial_numbers,
  asset_tag: item.asset_tag,
  warranty_expires: item.warranty_expires ?? '',
})

const hasEquipment = (form: Form) =>
  !!(form.brand || form.model_number || form.serial_numbers || form.asset_tag || form.warranty_expires)

const serialCount = (serials: string) => serials.split('\n').filter((line) => line.trim()).length

/** Add or edit an item (/staff-manager/inventory/new and /:id). */
export function InventoryItemFormPage() {
  const { id } = useParams()
  const handedOver = (useLocation().state as { item?: InventoryItem } | null)?.item
  return (
    <section className="finance staff-manager inventory">
      <Header title={id ? 'Inventory item' : 'Add an inventory item'} subtitle="Director Dashboard · Inventory" />
      {!id ? (
        <ItemForm item={null} />
      ) : handedOver && String(handedOver.id) === id ? (
        <ItemForm key={id} item={handedOver} />
      ) : (
        <LoadItem key={id} id={id} />
      )}
    </section>
  )
}

function LoadItem({ id }: { id: string }) {
  const item = useFetch<InventoryItem>(`/inventory-items/${id}/`)
  if (item.loading && !item.data) return <p className="loading">Loading the item…</p>
  if (!item.data) {
    return (
      <p className="form__error">
        Couldn’t find that item. <Link to={BASE}>Back to Inventory</Link>
      </p>
    )
  }
  return <ItemForm item={item.data} />
}

const receiptLabel = (receipt: ProjectDocument) =>
  [
    receipt.vendor || receipt.title,
    receipt.purchase_date ? formatDay(receipt.purchase_date, { month: 'short', day: 'numeric' }) : '',
    receipt.amount ? money.format(Number(receipt.amount)) : '',
  ]
    .filter(Boolean)
    .join(' · ')

function ItemForm({ item }: { item: InventoryItem | null }) {
  const navigate = useNavigate()
  const departments = useFetch<Department[]>('/departments/')
  const receipts = useFetch<ProjectDocument[]>('/documents/?category=receipt')
  const [saved, setSaved] = useState<InventoryItem | null>(item)
  const [form, setForm] = useState<Form>(item ? fromItem(item) : BLANK)
  const [baseline, setBaseline] = useState(() => JSON.stringify(form))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState('')
  const [uploading, setUploading] = useState(false)
  // Food always has an expiration field; other things only when someone adds one.
  const [addingExpiry, setAddingExpiry] = useState(false)
  // Starts open when the item already has equipment details.
  const [equipmentOpen, setEquipmentOpen] = useState(() => hasEquipment(form))
  const dirty = JSON.stringify(form) !== baseline

  useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const set = <K extends keyof Form>(name: K, value: Form[K]) => setForm((prev) => ({ ...prev, [name]: value }))
  const receiptList = useMemo(
    () => [...(receipts.data ?? [])].sort((a, b) => (b.purchase_date ?? b.created_at).localeCompare(a.purchase_date ?? a.created_at)),
    [receipts.data],
  )
  const chosenReceipt = receiptList.find((receipt) => String(receipt.id) === form.receipt) ?? null

  const chooseReceipt = (value: string) => {
    const receipt = receiptList.find((option) => String(option.id) === value)
    // The receipt's purchase date fills in Purchased on if it's blank.
    setForm((prev) => ({
      ...prev,
      receipt: value,
      purchased_on: prev.purchased_on || receipt?.purchase_date || '',
    }))
  }

  /** Saves (adding it the first time) and returns the saved item, or null on errors. */
  const save = async (): Promise<InventoryItem | null> => {
    const missing: Record<string, string> = {}
    if (!form.department) missing.department = 'Pick a department, or Other.'
    if (!form.item_type) missing.item_type = 'Pick what kind of item it is.'
    if (form.quantity === '') missing.quantity = 'Enter how many (0 if you’re out).'
    if (Object.keys(missing).length) {
      setErrors(missing)
      return null
    }
    setSaving(true)
    setErrors({})
    setStatus('')
    try {
      const result = await api<InventoryItem>(saved ? `/inventory-items/${saved.id}/` : '/inventory-items/', {
        method: saved ? 'PATCH' : 'POST',
        body: JSON.stringify({
          ...form,
          department: form.department === 'other' ? null : Number(form.department),
          purchased_on: form.purchased_on || null,
          expires_on: form.expires_on || null,
          receipt: form.receipt ? Number(form.receipt) : null,
          size: form.size === '' ? null : form.size,
          piece_count: form.piece_count === '' ? null : Number(form.piece_count),
          warranty_expires: form.warranty_expires || null,
        }),
      })
      const next = fromItem(result)
      setSaved(result)
      setForm(next)
      setBaseline(JSON.stringify(next))
      setStatus('Saved.')
      if (!saved) navigate(`${BASE}/${result.id}`, { replace: true, state: { item: result } })
      return result
    } catch (err) {
      const fields = fieldErrors(err)
      setErrors(Object.keys(fields).length ? fields : { form: err instanceof ApiError ? err.message : 'Couldn’t save the item.' })
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
    if (await save()) navigate(BASE)
  }

  const cancel = () => {
    if (dirty && !window.confirm('Leave without saving your changes?')) return
    navigate(BASE)
  }

  const remove = async () => {
    if (saved && (await deleteItem(saved, (message) => setErrors({ form: message })))) navigate(BASE)
  }

  const restore = async () => {
    if (!saved) return
    try {
      const result = await api<InventoryItem>(`/inventory-items/${saved.id}/restore/`, { method: 'POST' })
      setSaved(result)
      setStatus('Restored to the inventory.')
    } catch (err) {
      setErrors({ form: err instanceof ApiError ? err.message : 'Couldn’t restore the item.' })
    }
  }

  const error = (name: string) => errors[name] && <small className="form__field-error">{errors[name]}</small>
  const showExpiration = form.item_type === 'food' || !!form.expires_on || addingExpiry
  const deleted = !!saved?.deleted_at
  const outOfStock = form.quantity !== '' && Number(form.quantity) === 0

  return (
    <>
      <form className={`tile form inventory-form${outOfStock ? ' is-out-of-stock' : ''}`} onSubmit={submit} noValidate>
        <p className="meetings__breadcrumb">
          <Link to={deleted ? `${BASE}/deleted` : BASE}>← {deleted ? 'Recently deleted' : 'Inventory'}</Link>
        </p>
        {deleted && (
          <p className="notice inventory__deleted-note" role="status">
            This item is in Recently deleted
            {saved?.deleted_by_name && ` (deleted by ${saved.deleted_by_name})`}. Restore it to make changes.
            <button type="button" className="button" onClick={restore}>
              Restore
            </button>
          </p>
        )}
        {errors.form && (
          <p className="form__error" role="alert">
            {errors.form}
          </p>
        )}

        <fieldset className="inventory-form__fields" disabled={deleted}>
          <div className="form__grid">
            <label className="form__field">
              <span>
                Item name<span aria-hidden="true"> *</span>
              </span>
              <input
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                placeholder="e.g. Great Value shredded cheddar"
                aria-invalid={!!errors.name}
                required
              />
              {error('name')}
            </label>
            <label className="form__field">
              <span>
                Department<span aria-hidden="true"> *</span>
              </span>
              <select
                value={form.department}
                onChange={(e) => set('department', e.target.value)}
                aria-invalid={!!errors.department}
                required
              >
                <option value="" disabled>
                  Choose a department
                </option>
                {(departments.data ?? []).map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
                <option value="other">Other</option>
              </select>
              {error('department')}
            </label>
          </div>

          <label className="form__field">
            <span>
              Item type<span aria-hidden="true"> *</span>
            </span>
            <select
              value={form.item_type}
              onChange={(e) => set('item_type', e.target.value as ItemType)}
              aria-invalid={!!errors.item_type}
              required
            >
              <option value="" disabled>
                Choose a type
              </option>
              {ITEM_TYPES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <small className="form__hint">
              Keeps food apart from cookware, cleaning supplies and gear in the same department.
            </small>
            {error('item_type')}
          </label>

          <div className="form__grid">
            <label className="form__field">
              <span>Purchased on</span>
              <input type="date" value={form.purchased_on} onChange={(e) => set('purchased_on', e.target.value)} />
              {error('purchased_on')}
            </label>
            {showExpiration ? (
              <label className="form__field">
                <span>Expiration</span>
                <input type="date" value={form.expires_on} onChange={(e) => set('expires_on', e.target.value)} />
                {error('expires_on')}
              </label>
            ) : (
              <div className="form__field inventory-form__add-expiry">
                <button type="button" className="text-button" onClick={() => setAddingExpiry(true)}>
                  + Add an expiration date
                </button>
              </div>
            )}
          </div>

          <div className="form__field">
            <label htmlFor="inventory-receipt">Receipt</label>
            <div className="inventory-form__receipt">
              <select id="inventory-receipt" value={form.receipt} onChange={(e) => chooseReceipt(e.target.value)}>
                <option value="">No receipt</option>
                {receiptList.map((receipt) => (
                  <option key={receipt.id} value={receipt.id}>
                    {receiptLabel(receipt)}
                  </option>
                ))}
              </select>
              <button type="button" className="button button--secondary" onClick={() => setUploading(true)}>
                Upload a receipt
              </button>
            </div>
            {chosenReceipt ? (
              <small className="form__hint">
                <a href={`/api/documents/${chosenReceipt.id}/file/`} target="_blank" rel="noreferrer">
                  View receipt: {chosenReceipt.title}
                </a>
                {chosenReceipt.notes && ` · ${chosenReceipt.notes}`}
              </small>
            ) : (
              <small className="form__hint">Receipts come from Documents. Upload one here if it isn’t there yet.</small>
            )}
            {error('receipt')}
          </div>

          <div className="form__grid">
            <div className="form__field">
              <label htmlFor="inventory-qty">
                Item quantity<span aria-hidden="true"> *</span>
              </label>
              <div className="inventory-form__pair">
                <span className="inventory-stepper">
                  <button
                    type="button"
                    className="icon-button"
                    onClick={() => set('quantity', String(Math.max(0, Number(form.quantity || 0) - 1)))}
                    aria-label="One fewer"
                    disabled={Number(form.quantity || 0) <= 0}
                  >
                    −
                  </button>
                  <input
                    id="inventory-qty"
                    type="number"
                    min={0}
                    step="any"
                    inputMode="decimal"
                    value={form.quantity}
                    onChange={(e) => set('quantity', e.target.value)}
                    aria-invalid={!!errors.quantity}
                  />
                  <button
                    type="button"
                    className="icon-button"
                    onClick={() => set('quantity', String(Number(form.quantity || 0) + 1))}
                    aria-label="One more"
                  >
                    +
                  </button>
                </span>
                <select
                  value={form.quantity_unit}
                  onChange={(e) => set('quantity_unit', e.target.value as QuantityUnit)}
                  aria-label="Quantity unit"
                >
                  {QUANTITY_UNITS.map((unit) => (
                    <option key={unit.value} value={unit.value}>
                      {unit.label}
                    </option>
                  ))}
                </select>
              </div>
              {outOfStock && <small className="form__hint">At 0 the item shows as out of stock (grayed out).</small>}
              {error('quantity')}
              <span className="inventory-form__pieces">
                <label htmlFor="inventory-pieces" className="inventory-form__pieces-label">
                  Individual count (optional)
                </label>
                <span className="inventory-form__pair">
                  <input
                    id="inventory-pieces"
                    type="number"
                    min={0}
                    step={1}
                    inputMode="numeric"
                    value={form.piece_count}
                    onChange={(e) => set('piece_count', e.target.value)}
                    placeholder="e.g. 12"
                    aria-invalid={!!errors.piece_count}
                  />
                  <input
                    value={form.piece_label}
                    onChange={(e) => set('piece_label', e.target.value)}
                    placeholder="e.g. bananas"
                    aria-label="What the individual items are"
                  />
                </span>
                <small className="form__hint">
                  For groups of things, e.g. 2 bunches = 12 bananas, or 3 packs = 36 batteries.
                </small>
                {error('piece_count')}
              </span>
            </div>
            <div className="form__field">
              <label htmlFor="inventory-size">Item size</label>
              <div className="inventory-form__pair">
                <input
                  id="inventory-size"
                  type="number"
                  min={0}
                  step="any"
                  inputMode="decimal"
                  value={form.size}
                  onChange={(e) => set('size', e.target.value)}
                  placeholder="e.g. 32"
                  aria-invalid={!!errors.size}
                />
                <select
                  value={form.size_unit}
                  onChange={(e) => set('size_unit', e.target.value as SizeUnit | '')}
                  aria-label="Size unit"
                  aria-invalid={!!errors.size_unit}
                >
                  <option value="">Unit</option>
                  {SIZE_UNIT_GROUPS.map((group) => (
                    <optgroup key={group.label} label={group.label}>
                      {group.units.map((unit) => (
                        <option key={unit.value} value={unit.value}>
                          {unit.label}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
              {error('size') || error('size_unit')}
            </div>
          </div>

          <label className="form__field">
            <span>
              Item storage location<span aria-hidden="true"> *</span>
            </span>
            <input
              value={form.storage_location}
              onChange={(e) => set('storage_location', e.target.value)}
              placeholder="e.g. Filming location kitchen, or 2 rolls with each crew"
              aria-invalid={!!errors.storage_location}
              required
            />
            {error('storage_location')}
          </label>

          <label className="form__field">
            <span>Additional details</span>
            <textarea
              rows={3}
              value={form.details}
              onChange={(e) => set('details', e.target.value)}
              placeholder="e.g. Not open yet. Bought for chili night and omelets."
            />
          </label>

          <details
            className="inventory-form__equipment"
            open={equipmentOpen}
            onToggle={(e) => setEquipmentOpen(e.currentTarget.open)}
          >
            <summary>
              Equipment details (optional)
              <span className="muted"> · for cameras, computers, drives and other gear</span>
            </summary>
            <div className="inventory-form__equipment-body">
              <div className="form__grid">
                <label className="form__field">
                  <span>Brand / manufacturer</span>
                  <input value={form.brand} onChange={(e) => set('brand', e.target.value)} placeholder="e.g. Sony" />
                  {error('brand')}
                </label>
                <label className="form__field">
                  <span>Model number</span>
                  <input
                    value={form.model_number}
                    onChange={(e) => set('model_number', e.target.value)}
                    placeholder="e.g. ILME-FX6V"
                  />
                  {error('model_number')}
                </label>
              </div>
              <label className="form__field">
                <span>
                  Serial number{serialCount(form.serial_numbers) > 1 ? `s (${serialCount(form.serial_numbers)})` : '(s)'}
                </span>
                <textarea
                  rows={Math.min(6, Math.max(2, serialCount(form.serial_numbers) + 1))}
                  value={form.serial_numbers}
                  onChange={(e) => set('serial_numbers', e.target.value)}
                  placeholder="One per line, e.g. one for each camera body"
                  className="inventory-form__serials"
                />
                {Number(form.quantity) > 1 && serialCount(form.serial_numbers) > 0 &&
                  serialCount(form.serial_numbers) !== Number(form.quantity) && (
                    <small className="form__hint">
                      {serialCount(form.serial_numbers)} serial number{serialCount(form.serial_numbers) === 1 ? '' : 's'} for{' '}
                      {number(form.quantity)} items.
                    </small>
                  )}
                {error('serial_numbers')}
              </label>
              <div className="form__grid">
                <label className="form__field">
                  <span>Asset tag</span>
                  <input
                    value={form.asset_tag}
                    onChange={(e) => set('asset_tag', e.target.value)}
                    placeholder="The company label, e.g. KN-CAM-001"
                  />
                  {error('asset_tag')}
                </label>
                <label className="form__field">
                  <span>Warranty expires</span>
                  <input
                    type="date"
                    value={form.warranty_expires}
                    onChange={(e) => set('warranty_expires', e.target.value)}
                  />
                  {error('warranty_expires')}
                </label>
              </div>
            </div>
          </details>
        </fieldset>

        {saved && (
          <p className="muted inventory-form__meta">
            Added {formatDateTime(saved.created_at)}
            {saved.created_by_name && ` by ${saved.created_by_name}`} · Last changed {formatDateTime(saved.updated_at)}
          </p>
        )}

        <div className="meeting-form__footer">
          <span className="meeting-form__status" role="status">
            {saving ? 'Saving…' : dirty ? 'Unsaved changes' : status}
          </span>
          {!deleted && (
            <span className="inline-form__actions">
              <button type="submit" className="button button--secondary" disabled={saving}>
                Save
              </button>
              <button type="button" className="button" onClick={saveAndClose} disabled={saving}>
                Save and close
              </button>
              {saved && (
                <button type="button" className="text-button text-button--danger" onClick={remove} disabled={saving}>
                  Delete
                </button>
              )}
              <button type="button" className="text-button" onClick={cancel} disabled={saving}>
                Cancel
              </button>
            </span>
          )}
        </div>
      </form>

      {uploading && (
        <DocumentFormDialog
          document={null}
          initialCategory="receipt"
          canChooseCategory={false}
          defaults={{ title: form.name ? `${form.name} receipt` : '' }}
          onClose={() => setUploading(false)}
          onSaved={(receipt) => {
            setUploading(false)
            receipts.reload()
            setForm((prev) => ({
              ...prev,
              receipt: String(receipt.id),
              purchased_on: prev.purchased_on || receipt.purchase_date || '',
            }))
          }}
        />
      )}
    </>
  )
}
