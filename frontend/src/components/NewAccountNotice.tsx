import type { User } from '../auth/roles'

/** Shown once after adding someone without choosing a password for them. */
export function NewAccountNotice({ person, onDismiss }: { person: User; onDismiss: () => void }) {
  return (
    <div className="notice notice--success notice--with-action" role="status">
      <p>
        <strong>
          {person.first_name} {person.last_name}
        </strong>{' '}
        was added. Their temporary password is <code className="temp-password">{person.temporary_password}</code>.
        Share it with them now; it won’t be shown again.
      </p>
      <button type="button" className="icon-button" onClick={onDismiss} aria-label="Dismiss">
        ×
      </button>
    </div>
  )
}
