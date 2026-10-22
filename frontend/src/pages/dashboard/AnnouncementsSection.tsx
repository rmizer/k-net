import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { api, ApiError } from '../../api'
import type { Alert, AlertLevel, Announcement, CallSheetSummary } from '../../types'

interface AnnouncementsSectionProps {
  announcements: Announcement[]
  /** Linked at the top of Announcements. */
  latestCallSheet: CallSheetSummary | null
  alerts: Alert[]
  timeZone: string
  canEdit: boolean
  onChange: () => void
}

const LEVEL_LABELS: Record<AlertLevel, string> = { urgent: 'Urgent', warning: 'Warning', info: 'Info' }
const LEVEL_RANK: Record<AlertLevel, number> = { urgent: 0, warning: 1, info: 2 }

/** Announcements (about 75% width) beside Alerts (about 25%). */
export function AnnouncementsSection({
  announcements,
  latestCallSheet,
  alerts,
  timeZone,
  canEdit,
  onChange,
}: AnnouncementsSectionProps) {
  const [adding, setAdding] = useState<'announcement' | 'alert' | null>(null)
  const sortedAlerts = [...alerts].sort((a, b) => LEVEL_RANK[a.level] - LEVEL_RANK[b.level])

  const remove = async (path: string, what: string) => {
    if (!window.confirm(`Remove this ${what}?`)) return
    await api(path, { method: 'DELETE' })
    onChange()
  }

  const saved = () => {
    setAdding(null)
    onChange()
  }

  const postedOn = (iso: string) =>
    new Intl.DateTimeFormat('en-US', { timeZone, month: 'short', day: 'numeric' }).format(new Date(iso))

  return (
    <div className="dash-split">
      <section className="dash-section" aria-labelledby="dash-announcements">
        <div className="dash-section__header">
          <h2 id="dash-announcements">Announcements</h2>
          {canEdit && adding !== 'announcement' && (
            <button type="button" className="text-button" onClick={() => setAdding('announcement')}>
              + Post
            </button>
          )}
        </div>
        <div className="tile tile--fill">
          {adding === 'announcement' && <AnnouncementForm onSaved={saved} onCancel={() => setAdding(null)} />}
          {announcements.length === 0 && !latestCallSheet && adding !== 'announcement' && (
            <p className="muted">No announcements.</p>
          )}
          <ul className="announcements">
            {latestCallSheet && (
              <li className="announcement announcement--call-sheet">
                <div className="announcement__head">
                  <h3>
                    <span className="badge">Call sheet</span>
                    <Link to={`/call-sheets/${latestCallSheet.id}`}>{latestCallSheet.title}</Link>
                  </h3>
                </div>
                <p className="announcement__meta">
                  {latestCallSheet.published_by_name ? `${latestCallSheet.published_by_name} · ` : ''}
                  {postedOn(latestCallSheet.published_at)}
                </p>
              </li>
            )}
            {announcements.map((item) => (
              <li key={item.id} className="announcement">
                <div className="announcement__head">
                  <h3>
                    {item.pinned && <span className="badge">Pinned</span>}
                    {item.title}
                  </h3>
                  {canEdit && (
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={`Remove announcement: ${item.title}`}
                      onClick={() => remove(`/announcements/${item.id}/`, 'announcement')}
                    >
                      ×
                    </button>
                  )}
                </div>
                {item.body && <p>{item.body}</p>}
                <p className="announcement__meta">
                  {item.created_by_name ? `${item.created_by_name} · ` : ''}
                  {postedOn(item.created_at)}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="dash-section" aria-labelledby="dash-alerts">
        <div className="dash-section__header">
          <h2 id="dash-alerts">Alerts</h2>
          {canEdit && adding !== 'alert' && (
            <button type="button" className="text-button" onClick={() => setAdding('alert')}>
              + Add
            </button>
          )}
        </div>
        <div className="tile tile--fill">
          {adding === 'alert' && <AlertForm onSaved={saved} onCancel={() => setAdding(null)} />}
          {alerts.length === 0 && adding !== 'alert' && <p className="muted">No active alerts.</p>}
          <ul className="alerts">
            {sortedAlerts.map((alert) => (
              <li key={alert.id} className={`alert alert--${alert.level}`}>
                <span className="alert__level">{LEVEL_LABELS[alert.level]}</span>
                <span className="alert__message">{alert.message}</span>
                {canEdit && (
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Remove alert: ${alert.message}`}
                    onClick={() => remove(`/alerts/${alert.id}/`, 'alert')}
                  >
                    ×
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  )
}

function useSubmit(path: string, onSaved: () => void) {
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async (body: object) => {
    setSaving(true)
    setError('')
    try {
      await api(path, { method: 'POST', body: JSON.stringify(body) })
      onSaved()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save.')
      setSaving(false)
    }
  }
  return { error, saving, submit }
}

function FormActions({ saving, label, onCancel }: { saving: boolean; label: string; onCancel: () => void }) {
  return (
    <div className="inline-form__actions">
      <button type="submit" className="button" disabled={saving}>
        {saving ? 'Saving…' : label}
      </button>
      <button type="button" className="button button--secondary" onClick={onCancel}>
        Cancel
      </button>
    </div>
  )
}

function AnnouncementForm({ onSaved, onCancel }: { onSaved: () => void; onCancel: () => void }) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [pinned, setPinned] = useState(false)
  const { error, saving, submit } = useSubmit('/announcements/', onSaved)

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    submit({ title, body, pinned })
  }

  return (
    <form className="inline-form" onSubmit={handleSubmit}>
      <label className="form__field">
        <span>Title</span>
        <input value={title} onChange={(event) => setTitle(event.target.value)} required maxLength={200} />
      </label>
      <label className="form__field">
        <span>Details</span>
        <textarea value={body} onChange={(event) => setBody(event.target.value)} rows={3} />
      </label>
      <label className="form__check">
        <input type="checkbox" checked={pinned} onChange={(event) => setPinned(event.target.checked)} />
        Pin to top
      </label>
      {error && (
        <p className="form__error" role="alert">
          {error}
        </p>
      )}
      <FormActions saving={saving} label="Post" onCancel={onCancel} />
    </form>
  )
}

function AlertForm({ onSaved, onCancel }: { onSaved: () => void; onCancel: () => void }) {
  const [message, setMessage] = useState('')
  const [level, setLevel] = useState<AlertLevel>('info')
  const { error, saving, submit } = useSubmit('/alerts/', onSaved)

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    submit({ message, level })
  }

  return (
    <form className="inline-form" onSubmit={handleSubmit}>
      <label className="form__field">
        <span>Message</span>
        <input value={message} onChange={(event) => setMessage(event.target.value)} required maxLength={255} />
      </label>
      <label className="form__field">
        <span>Level</span>
        <select value={level} onChange={(event) => setLevel(event.target.value as AlertLevel)}>
          <option value="info">Info</option>
          <option value="warning">Warning</option>
          <option value="urgent">Urgent</option>
        </select>
      </label>
      {error && (
        <p className="form__error" role="alert">
          {error}
        </p>
      )}
      <FormActions saving={saving} label="Add alert" onCancel={onCancel} />
    </form>
  )
}
