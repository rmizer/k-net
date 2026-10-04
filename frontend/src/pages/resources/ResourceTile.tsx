import type { Resource } from '../../types'

interface ResourceTileProps {
  resource: Resource
  onEdit?: () => void
  onRemove?: () => void
}

/** "example.com" from "https://www.example.com/some/page". */
function shortUrl(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

export function ResourceTile({ resource, onEdit, onRemove }: ResourceTileProps) {
  const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(resource.address)}`

  return (
    <li className="tile resource-tile">
      <div className="resource-tile__head">
        <div>
          <h3>{resource.company_name}</h3>
          {resource.contact_name && <p className="resource-tile__contact">{resource.contact_name}</p>}
        </div>
        {(onEdit || onRemove) && (
          <div className="resource-tile__actions">
            {onEdit && (
              <button type="button" className="text-button" onClick={onEdit} aria-label={`Edit ${resource.company_name}`}>
                Edit
              </button>
            )}
            {onRemove && (
              <button
                type="button"
                className="icon-button"
                onClick={onRemove}
                aria-label={`Remove ${resource.company_name}`}
              >
                ×
              </button>
            )}
          </div>
        )}
      </div>

      <ul className="resource-tile__links">
        <li>
          <a className="contact-link" href={`tel:${resource.phone}`}>
            {resource.phone}
          </a>
        </li>
        {resource.email && (
          <li>
            <a className="contact-link" href={`mailto:${resource.email}`}>
              {resource.email}
            </a>
          </li>
        )}
        {resource.website && (
          <li>
            <a className="contact-link" href={resource.website} target="_blank" rel="noopener noreferrer">
              {shortUrl(resource.website)} ↗
            </a>
          </li>
        )}
        {resource.address && (
          <li>
            <a className="contact-link" href={mapUrl} target="_blank" rel="noopener noreferrer">
              {resource.address}
            </a>
          </li>
        )}
      </ul>

      {resource.notes && <p className="resource-tile__notes">{resource.notes}</p>}
    </li>
  )
}
