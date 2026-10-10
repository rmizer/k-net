import type { User } from '../../auth/roles'
import { Avatar } from '../../components/Avatar'
import { lodgingLabel } from '../../format'

interface StaffTileProps {
  person: User
  /** Edit / remove controls, only for people the viewer may manage. */
  onEdit?: () => void
  onRemove?: () => void
}

export function StaffTile({ person, onEdit, onRemove }: StaffTileProps) {
  const name = `${person.first_name} ${person.last_name}`.trim()
  // The API only includes emergency contact fields for Directors, Assistants and
  // Site Managers (and the person themselves).
  const showEmergency = person.emergency_contact_name !== undefined

  return (
    <li className="tile staff-tile">
      <div className="staff-tile__head">
        <Avatar person={person} />
        <div className="staff-tile__name">
          <h3>{name}</h3>
          <p className="staff-tile__role">
            {person.role_display}
            {person.department_name ? ` · ${person.department_name}` : ''}
          </p>
        </div>
        {(onEdit || onRemove) && (
          <div className="staff-tile__actions">
            {onEdit && (
              <button type="button" className="text-button" onClick={onEdit} aria-label={`Edit ${name}`}>
                Edit
              </button>
            )}
            {onRemove && (
              <button type="button" className="icon-button" onClick={onRemove} aria-label={`Remove ${name}`}>
                ×
              </button>
            )}
          </div>
        )}
      </div>

      <dl className="staff-tile__details">
        <div>
          <dt>Email</dt>
          <dd>
            <a className="contact-link" href={`mailto:${person.email}`}>
              {person.email}
            </a>
          </dd>
        </div>
        <div>
          <dt>Phone</dt>
          <dd>
            {person.phone ? (
              <a className="contact-link" href={`tel:${person.phone}`}>
                {person.phone}
              </a>
            ) : (
              <span className="muted">—</span>
            )}
          </dd>
        </div>
        <div>
          <dt>Lodging</dt>
          <dd>{lodgingLabel(person.lodging, person.room_number) || <span className="muted">—</span>}</dd>
        </div>
        {showEmergency && (
          <div className="staff-tile__emergency">
            <dt>Emergency contact</dt>
            <dd>
              {person.emergency_contact_name || person.emergency_contact_phone ? (
                <>
                  {person.emergency_contact_name}
                  {person.emergency_contact_phone && (
                    <>
                      {person.emergency_contact_name ? ' · ' : ''}
                      <a className="contact-link" href={`tel:${person.emergency_contact_phone}`}>
                        {person.emergency_contact_phone}
                      </a>
                    </>
                  )}
                </>
              ) : (
                <span className="muted">—</span>
              )}
            </dd>
          </div>
        )}
      </dl>
    </li>
  )
}
