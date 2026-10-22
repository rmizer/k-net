import { useMemo, useState } from 'react'
import { api } from '../../api'
import { isManagerLevel } from '../../auth/roles'
import { useAuth } from '../../auth/useAuth'
import { useFetch } from '../../hooks/useFetch'
import { RESOURCE_CATEGORIES, type Resource, type ResourceCategory } from '../../types'
import { ResourceFormDialog } from './ResourceFormDialog'
import { ResourceTile } from './ResourceTile'
import { NavIcon } from '../../components/NavIcon'
import './resources.css'

export function ResourcesPage() {
  const { user } = useAuth()
  const resources = useFetch<Resource[]>('/resources/')
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<ResourceCategory | ''>('')
  // undefined = closed, null = adding, Resource = editing.
  const [editing, setEditing] = useState<Resource | null | undefined>(undefined)
  const manager = isManagerLevel(user)

  const groups = useMemo(() => {
    const query = search.trim().toLowerCase()
    const matches = (resources.data ?? []).filter((resource) => {
      if (category && resource.category !== category) return false
      if (!query) return true
      return [resource.company_name, resource.contact_name, resource.address, resource.notes, resource.phone]
        .join(' ')
        .toLowerCase()
        .includes(query)
    })
    return RESOURCE_CATEGORIES.map(({ value, label }) => ({
      value,
      label,
      items: matches.filter((resource) => resource.category === value),
    })).filter((group) => group.items.length > 0)
  }, [resources.data, search, category])

  const remove = async (resource: Resource) => {
    if (!window.confirm(`Remove ${resource.company_name} from the Resources Directory?`)) return
    await api(`/resources/${resource.id}/`, { method: 'DELETE' })
    resources.reload()
  }

  const total = resources.data?.length ?? 0
  const shown = groups.reduce((count, group) => count + group.items.length, 0)
  const filtered = search || category

  return (
    <section className="resources">
      <div className="page-header">
        <div>
          <h1>
            <NavIcon name="resources" />
            Resources
          </h1>
          <p className="subtitle">Vendors and services</p>
        </div>
        {manager && (
          <button type="button" className="button" onClick={() => setEditing(null)}>
            + Add resource
          </button>
        )}
      </div>

      <div className="filters filters--two" role="search">
        <label className="form__field filters__search">
          <span>Search</span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Company, contact, address or notes"
          />
        </label>
        <label className="form__field">
          <span>Category</span>
          <select value={category} onChange={(event) => setCategory(event.target.value as ResourceCategory | '')}>
            <option value="">All categories</option>
            {RESOURCE_CATEGORIES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {resources.loading && !resources.data && <p className="loading">Loading resources…</p>}
      {resources.error && !resources.data && <p className="form__error">Couldn’t load resources.</p>}
      {resources.data && (
        <p className="muted resources__count" aria-live="polite">
          {filtered ? `Showing ${shown} of ${total} resources` : `${total} resources`}
        </p>
      )}
      {resources.data && groups.length === 0 && (
        <div className="tile">
          <p className="muted">{filtered ? 'Nothing matches those filters.' : 'No resources yet.'}</p>
        </div>
      )}

      {groups.map((group) => (
        <section key={group.value} className="resources__group" aria-label={group.label}>
          <h2>
            {group.label} <span className="resources__group-count">({group.items.length})</span>
          </h2>
          <ul className="resource-tiles">
            {group.items.map((resource) => (
              <ResourceTile
                key={resource.id}
                resource={resource}
                onEdit={manager ? () => setEditing(resource) : undefined}
                onRemove={manager ? () => remove(resource) : undefined}
              />
            ))}
          </ul>
        </section>
      ))}

      {editing !== undefined && (
        <ResourceFormDialog
          resource={editing}
          onClose={() => setEditing(undefined)}
          onSaved={() => {
            setEditing(undefined)
            resources.reload()
          }}
        />
      )}
    </section>
  )
}
