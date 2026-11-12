import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { api, ApiError, fieldErrors } from '../../../api'
import { canFileIncidents, canReviewIncidents } from '../../../auth/roles'
import { useAuth } from '../../../auth/useAuth'
import { NavIcon } from '../../../components/NavIcon'
import { formatDateTime, fromLocalInput, toLocalInput } from '../../../format'
import { useFetch } from '../../../hooks/useFetch'
import {
  INCIDENT_CATEGORIES,
  INCIDENT_SEVERITIES,
  INCIDENT_STATUSES,
  type IncidentAttachment,
  type IncidentCategory,
  type IncidentReport,
  type IncidentSeverity,
  type IncidentStatus,
} from '../../../types'
import { ForbiddenPage } from '../../ForbiddenPage'
import '../../meetings/meetings.css'
import '../departments.css'
import './security.css'

const BASE = '/departments/security/incidents'

/** How many reports the Security page shows before "All reports". */
const RECENT_LIMIT = 5

function SeverityBadge({ report }: { report: Pick<IncidentReport, 'severity' | 'severity_display'> }) {
  return <span className={`incident-severity incident-severity--${report.severity}`}>{report.severity_display}</span>
}

function StatusBadge({ report }: { report: Pick<IncidentReport, 'status' | 'status_display'> }) {
  return <span className={`incident-status incident-status--${report.status}`}>{report.status_display}</span>
}

function IncidentRows({ reports }: { reports: IncidentReport[] }) {
  return (
    <ul className="incident-list">
      {reports.map((report) => (
        <li key={report.id} className={`incident-row incident-row--${report.severity}`}>
          <Link to={`${BASE}/${report.id}`} state={{ report }} className="incident-row__title">
            {report.title}
          </Link>
          <span className="incident-row__badges">
            <SeverityBadge report={report} />
            <StatusBadge report={report} />
          </span>
          <span className="incident-row__meta">
            {formatDateTime(report.occurred_at)} · {report.location} · {report.category_display}
            {report.reported_by_name && ` · Filed by ${report.reported_by_name}`}
          </span>
        </li>
      ))}
    </ul>
  )
}

/** The incident reports section on the Security page, for the people who can file them. */
export function IncidentReportsSection() {
  const { user } = useAuth()
  if (!canFileIncidents(user)) return null
  return <IncidentReportsSummary />
}

function IncidentReportsSummary() {
  const reports = useFetch<IncidentReport[]>('/incident-reports/')
  const all = reports.data ?? []
  const unresolved = all.filter((report) => report.status !== 'resolved')
  // Unresolved first, then the most recent incidents.
  const shown = [...unresolved, ...all.filter((report) => report.status === 'resolved')].slice(0, RECENT_LIMIT)

  return (
    <section className="department__section" aria-labelledby="incident-reports">
      <div className="incident-section__head">
        <h2 id="incident-reports" className="department__heading">
          Incident reports
          {unresolved.length > 0 && <span className="department__count">{unresolved.length} open</span>}
        </h2>
        <span className="inline-form__actions">
          {all.length > 0 && (
            <Link to={BASE} className="button button--secondary">
              All reports
            </Link>
          )}
          <Link to={`${BASE}/new`} className="button">
            + Report an incident
          </Link>
        </span>
      </div>
      <div className="tile">
        {reports.loading && !reports.data ? (
          <p className="muted">Loading reports…</p>
        ) : reports.error && !reports.data ? (
          <p className="form__error">Couldn’t load the incident reports.</p>
        ) : shown.length ? (
          <IncidentRows reports={shown} />
        ) : (
          <p className="muted">No incidents reported. If something breaches or threatens security, report it here.</p>
        )}
      </div>
    </section>
  )
}

function SecurityHeader({ title }: { title: string }) {
  return (
    <div className="page-header">
      <div>
        <h1>
          <NavIcon name="guard" />
          {title}
        </h1>
        <p className="subtitle">
          <Link to="/departments/security">Security</Link> · Incident reports
        </p>
      </div>
    </div>
  )
}

const FILTERS: { value: IncidentStatus | ''; label: string }[] = [{ value: '', label: 'All' }, ...INCIDENT_STATUSES]

/** Every incident report, newest incident first (/departments/security/incidents). */
export function IncidentReportsPage() {
  const { user } = useAuth()
  const [params, setParams] = useSearchParams()
  const status = (params.get('status') ?? '') as IncidentStatus | ''
  const reports = useFetch<IncidentReport[]>(`/incident-reports/${status ? `?status=${status}` : ''}`)
  if (!canFileIncidents(user)) return <ForbiddenPage />

  return (
    <section className="department security">
      <SecurityHeader title="Incident reports" />
      <div className="incident-toolbar">
        <span className="incident-filters" role="group" aria-label="Show">
          {FILTERS.map((filter) => (
            <button
              key={filter.value}
              type="button"
              className={`incident-filter${status === filter.value ? ' is-selected' : ''}`}
              aria-pressed={status === filter.value}
              onClick={() => setParams(filter.value ? { status: filter.value } : {})}
            >
              {filter.label}
            </button>
          ))}
        </span>
        <Link to={`${BASE}/new`} className="button">
          + Report an incident
        </Link>
      </div>
      <div className="tile">
        {reports.loading && !reports.data ? (
          <p className="muted">Loading reports…</p>
        ) : reports.data?.length ? (
          <IncidentRows reports={reports.data} />
        ) : (
          <p className="muted">{status ? 'No reports with that status.' : 'No incidents reported yet.'}</p>
        )}
      </div>
    </section>
  )
}

interface Form {
  title: string
  category: IncidentCategory
  severity: IncidentSeverity
  occurred_at: string
  location: string
  description: string
  people_involved: string
  witnesses: string
  actions_taken: string
  police_called: boolean
  police_report_number: string
  status: IncidentStatus
  resolution: string
}

const fromReport = (report: IncidentReport): Form => ({
  title: report.title,
  category: report.category,
  severity: report.severity,
  occurred_at: toLocalInput(report.occurred_at),
  location: report.location,
  description: report.description,
  people_involved: report.people_involved,
  witnesses: report.witnesses,
  actions_taken: report.actions_taken,
  police_called: report.police_called,
  police_report_number: report.police_report_number,
  status: report.status,
  resolution: report.resolution,
})

/** File a new report or open one (/departments/security/incidents/new and /:id). */
export function IncidentReportFormPage() {
  const { user } = useAuth()
  const { id } = useParams()
  const handedOver = (useLocation().state as { report?: IncidentReport } | null)?.report
  if (!canFileIncidents(user)) return <ForbiddenPage />
  return (
    <section className="department security">
      <SecurityHeader title={id ? 'Incident report' : 'Report an incident'} />
      {!id ? (
        <IncidentForm report={null} />
      ) : handedOver && String(handedOver.id) === id ? (
        <IncidentForm key={id} report={handedOver} />
      ) : (
        <LoadReport key={id} id={id} />
      )}
    </section>
  )
}

function LoadReport({ id }: { id: string }) {
  const report = useFetch<IncidentReport>(`/incident-reports/${id}/`)
  if (report.loading && !report.data) return <p className="loading">Loading the report…</p>
  if (!report.data) {
    return (
      <p className="form__error">
        Couldn’t find that report. <Link to={BASE}>Back to Incident reports</Link>
      </p>
    )
  }
  return <IncidentForm report={report.data} />
}

function IncidentForm({ report }: { report: IncidentReport | null }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const reviewer = canReviewIncidents(user)
  const [saved, setSaved] = useState<IncidentReport | null>(report)
  const [form, setForm] = useState<Form>(
    report
      ? fromReport(report)
      : {
          title: '',
          category: 'other',
          severity: 'medium',
          occurred_at: toLocalInput(new Date().toISOString()),
          location: '',
          description: '',
          people_involved: '',
          witnesses: '',
          actions_taken: '',
          police_called: false,
          police_report_number: '',
          status: 'open',
          resolution: '',
        },
  )
  const [baseline, setBaseline] = useState(() => JSON.stringify(form))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState('')
  // Files picked before the report is filed; they upload right after.
  const [queued, setQueued] = useState<QueuedFile[]>([])
  const dirty = JSON.stringify(form) !== baseline || queued.length > 0

  useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  if (saved && !saved.can_edit) return <IncidentView report={saved} />

  const set = <K extends keyof Form>(name: K, value: Form[K]) => setForm((prev) => ({ ...prev, [name]: value }))

  /** Saves (filing it the first time) and returns the saved report, or null on errors. */
  const save = async (): Promise<IncidentReport | null> => {
    setSaving(true)
    setErrors({})
    setStatus('')
    const { status: reportStatus, resolution, ...details } = form
    try {
      const result = await api<IncidentReport>(saved ? `/incident-reports/${saved.id}/` : '/incident-reports/', {
        method: saved ? 'PATCH' : 'POST',
        body: JSON.stringify({
          ...details,
          occurred_at: fromLocalInput(form.occurred_at),
          // Only reviewers set these; everyone else leaves them alone.
          ...(reviewer ? { status: reportStatus, resolution } : {}),
        }),
      })
      const failed: string[] = []
      let latest = result
      if (!saved && queued.length) {
        const uploaded: IncidentAttachment[] = []
        for (const item of queued) {
          try {
            uploaded.push(await uploadAttachment(result.id, item.file, item.caption))
          } catch (err) {
            failed.push(
              `${item.file.name}: ${err instanceof ApiError ? (fieldErrors(err).file ?? err.message) : 'didn’t upload'}`,
            )
          }
        }
        latest = {
          ...result,
          attachments: [...result.attachments, ...uploaded],
        }
        setQueued([])
      }
      const next = fromReport(latest)
      const newlyAlerted = latest.alerted && !saved?.alerted
      setSaved(latest)
      setForm(next)
      setBaseline(JSON.stringify(next))
      setStatus(
        [saved ? 'Saved.' : 'Report filed.', newlyAlerted ? 'Managers and the Security head were alerted.' : '']
          .filter(Boolean)
          .join(' '),
      )
      if (failed.length)
        setErrors({
          attachments: `Some files didn’t upload. ${failed.join('; ')}`,
        })
      if (!saved)
        navigate(`${BASE}/${latest.id}`, {
          replace: true,
          state: { report: latest },
        })
      return latest
    } catch (err) {
      const fields = fieldErrors(err)
      setErrors(
        Object.keys(fields).length
          ? fields
          : {
              form: err instanceof ApiError ? err.message : 'Couldn’t save the report.',
            },
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
    if (await save()) navigate('/departments/security')
  }

  const cancel = () => {
    if (dirty && !window.confirm('Leave without saving your changes?')) return
    navigate('/departments/security')
  }

  const remove = async () => {
    if (!saved || !window.confirm(`Delete the report “${saved.title}”? This can’t be undone.`)) return
    setSaving(true)
    try {
      await api(`/incident-reports/${saved.id}/`, { method: 'DELETE' })
      navigate(BASE)
    } catch (err) {
      setErrors({
        form: err instanceof ApiError ? err.message : 'Couldn’t delete the report.',
      })
      setSaving(false)
    }
  }

  const error = (name: string) => errors[name] && <small className="form__field-error">{errors[name]}</small>

  return (
    <>
      <form className="tile form incident-form no-print" onSubmit={submit} noValidate>
        <p className="meetings__breadcrumb">
          <Link to="/departments/security">← Security</Link>
        </p>
        {!saved && (
          <p className="incident-form__urgent" role="note">
            If someone is in danger right now, call 911 first, then file the report.
          </p>
        )}
        {(form.severity === 'high' || form.severity === 'critical') && !saved?.alerted && (
          <p className="incident-form__alert-note" role="note">
            Filing this as {form.severity === 'critical' ? 'Critical' : 'High'} alerts the Site Managers, Directors,
            Assistants and Security head by Slack and email.
          </p>
        )}
        {saved && (
          <p className="incident-form__filed">
            <SeverityBadge report={saved} />
            <StatusBadge report={saved} />
            Filed {formatDateTime(saved.created_at)}
            {saved.reported_by_name && ` by ${saved.reported_by_name}`}
            {saved.alerted && <span className="incident-form__alerted"> · Managers alerted</span>}
            <PrintButton dirty={dirty} />
          </p>
        )}
        {errors.form && (
          <p className="form__error" role="alert">
            {errors.form}
          </p>
        )}

        <label className="form__field">
          <span>
            Summary<span aria-hidden="true"> *</span>
          </span>
          <input
            value={form.title}
            onChange={(e) => set('title', e.target.value)}
            placeholder="e.g. Fan climbed the back fence during the stream"
            aria-invalid={!!errors.title}
            required
          />
          {error('title')}
        </label>

        <div className="form__grid">
          <label className="form__field">
            <span>Type of incident</span>
            <select value={form.category} onChange={(e) => set('category', e.target.value as IncidentCategory)}>
              {INCIDENT_CATEGORIES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {error('category')}
          </label>
          <fieldset className="form__field incident-form__severity">
            <legend>Severity</legend>
            <span className="incident-form__options">
              {INCIDENT_SEVERITIES.map((option) => (
                <label key={option.value} className={`incident-form__option is-${option.value}`}>
                  <input
                    type="radio"
                    name="severity"
                    value={option.value}
                    checked={form.severity === option.value}
                    onChange={() => set('severity', option.value)}
                  />
                  {option.label}
                </label>
              ))}
            </span>
          </fieldset>
        </div>

        <div className="form__grid">
          <label className="form__field">
            <span>
              When it happened<span aria-hidden="true"> *</span>
            </span>
            <input
              type="datetime-local"
              value={form.occurred_at}
              onChange={(e) => set('occurred_at', e.target.value)}
              aria-invalid={!!errors.occurred_at}
              required
            />
            {error('occurred_at')}
          </label>
          <label className="form__field">
            <span>
              Where<span aria-hidden="true"> *</span>
            </span>
            <input
              value={form.location}
              onChange={(e) => set('location', e.target.value)}
              placeholder="e.g. Back fence by the pool"
              aria-invalid={!!errors.location}
              required
            />
            {error('location')}
          </label>
        </div>

        <label className="form__field">
          <span>
            What happened<span aria-hidden="true"> *</span>
          </span>
          <textarea
            rows={6}
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
            placeholder="In order: what you saw, what was said, how it ended"
            aria-invalid={!!errors.description}
            required
          />
          {error('description')}
        </label>

        <div className="form__grid">
          <label className="form__field">
            <span>People involved</span>
            <textarea
              rows={3}
              value={form.people_involved}
              onChange={(e) => set('people_involved', e.target.value)}
              placeholder="Names, or descriptions if unknown (clothing, vehicle, plates)"
            />
          </label>
          <label className="form__field">
            <span>Witnesses</span>
            <textarea rows={3} value={form.witnesses} onChange={(e) => set('witnesses', e.target.value)} />
          </label>
        </div>

        <label className="form__field">
          <span>Actions taken</span>
          <textarea
            rows={3}
            value={form.actions_taken}
            onChange={(e) => set('actions_taken', e.target.value)}
            placeholder="e.g. Escorted off the property, stream cut to break, gate locked"
          />
        </label>

        <div className="form__grid incident-form__police">
          <label className="incident-form__check">
            <input
              type="checkbox"
              checked={form.police_called}
              onChange={(e) => set('police_called', e.target.checked)}
            />
            Police were called
          </label>
          {form.police_called && (
            <label className="form__field">
              <span>Police report number</span>
              <input value={form.police_report_number} onChange={(e) => set('police_report_number', e.target.value)} />
            </label>
          )}
        </div>

        <AttachmentsPanel
          report={saved}
          canChange
          queued={queued}
          onQueue={setQueued}
          onChange={(attachments) => saved && setSaved({ ...saved, attachments })}
          error={errors.attachments}
        />

        {reviewer ? (
          <fieldset className="incident-form__review">
            <legend>Review (Security head and managers)</legend>
            <label className="form__field">
              <span>Status</span>
              <select value={form.status} onChange={(e) => set('status', e.target.value as IncidentStatus)}>
                {INCIDENT_STATUSES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="form__field">
              <span>Resolution and follow-up</span>
              <textarea
                rows={3}
                value={form.resolution}
                onChange={(e) => set('resolution', e.target.value)}
                placeholder="What was done afterward, and anything that changes going forward"
              />
            </label>
          </fieldset>
        ) : (
          saved && (
            <p className="form__hint">
              You can fix this report while it’s Open. Once the Security head starts on it, only they and managers can
              change it.
            </p>
          )
        )}

        <div className="meeting-form__footer">
          <span className="meeting-form__status" role="status">
            {saving ? 'Saving…' : dirty ? 'Unsaved changes' : status}
          </span>
          <span className="inline-form__actions">
            <button type="submit" className="button button--secondary" disabled={saving}>
              {saved ? 'Save' : 'File report'}
            </button>
            <button type="button" className="button" onClick={saveAndClose} disabled={saving}>
              {saved ? 'Save and close' : 'File and close'}
            </button>
            <button type="button" className="text-button" onClick={cancel} disabled={saving}>
              Cancel
            </button>
            {saved && reviewer && (
              <button type="button" className="text-button text-button--danger" onClick={remove} disabled={saving}>
                Delete
              </button>
            )}
          </span>
        </div>
      </form>
      {saved && <PrintableReport report={saved} />}
    </>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  if (!value) return null
  return (
    <div className="incident-view__detail">
      <h3>{label}</h3>
      <p>{value}</p>
    </div>
  )
}

/** A report the viewer can read but no longer change. */
function IncidentView({ report }: { report: IncidentReport }) {
  return (
    <>
      <article className="tile incident-form no-print">
        <p className="meetings__breadcrumb">
          <Link to="/departments/security">← Security</Link>
        </p>
        <h2 className="incident-view__title">
          {report.title}
          <PrintButton dirty={false} />
        </h2>
        <p className="incident-form__filed">
          <SeverityBadge report={report} />
          <StatusBadge report={report} />
          {report.category_display} · {formatDateTime(report.occurred_at)} · {report.location}
        </p>
        <p className="muted">
          Filed {formatDateTime(report.created_at)}
          {report.reported_by_name && ` by ${report.reported_by_name}`}
        </p>
        <Detail label="What happened" value={report.description} />
        <Detail label="People involved" value={report.people_involved} />
        <Detail label="Witnesses" value={report.witnesses} />
        <Detail label="Actions taken" value={report.actions_taken} />
        <Detail
          label="Police"
          value={
            report.police_called
              ? `Called${report.police_report_number ? ` · Report #${report.police_report_number}` : ''}`
              : ''
          }
        />
        <Detail label="Resolution and follow-up" value={report.resolution} />
        <AttachmentsPanel report={report} canChange={false} queued={[]} onQueue={() => {}} onChange={() => {}} />
      </article>
      <PrintableReport report={report} />
    </>
  )
}

interface QueuedFile {
  key: number
  file: File
  caption: string
}

const ACCEPT = 'image/*,video/mp4,video/quicktime,video/webm,.mov,.m4v,.heic,application/pdf'

/** Matches the server's limit (security/models.py). */
const MAX_MB = 200

async function uploadAttachment(reportId: number, file: File, caption: string) {
  const body = new FormData()
  body.append('file', file)
  body.append('caption', caption)
  return api<IncidentAttachment>(`/incident-reports/${reportId}/attachments/`, {
    method: 'POST',
    body,
  })
}

const fileSize = (bytes: number | null) =>
  bytes === null
    ? ''
    : bytes >= 1024 * 1024
      ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
      : `${Math.max(1, Math.round(bytes / 1024))} KB`

let nextQueueKey = 0

interface AttachmentsPanelProps {
  report: IncidentReport | null
  canChange: boolean
  queued: QueuedFile[]
  onQueue: (files: QueuedFile[]) => void
  onChange: (attachments: IncidentAttachment[]) => void
  error?: string
}

/** Photos, videos and PDFs. On a saved report they upload as soon as they're picked;
 *  on a new one they wait and upload when it's filed. */
function AttachmentsPanel({ report, canChange, queued, onQueue, onChange, error }: AttachmentsPanelProps) {
  const input = useRef<HTMLInputElement>(null)
  const [caption, setCaption] = useState('')
  const [uploading, setUploading] = useState('')
  const [problem, setProblem] = useState('')
  const attachments = report?.attachments ?? []
  if (!canChange && !attachments.length) return null

  const pick = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ''
    setProblem('')
    const tooBig = files.filter((file) => file.size > MAX_MB * 1024 * 1024)
    const ok = files.filter((file) => file.size <= MAX_MB * 1024 * 1024)
    const notes = tooBig.length
      ? [
          `${tooBig.map((file) => file.name).join(', ')} ${tooBig.length === 1 ? 'is' : 'are'} over ${MAX_MB} MB. Trim it and try again.`,
        ]
      : []
    if (!report) {
      onQueue([...queued, ...ok.map((file) => ({ key: (nextQueueKey += 1), file, caption }))])
      setCaption('')
      setProblem(notes.join(' '))
      return
    }
    const added: IncidentAttachment[] = []
    for (const file of ok) {
      setUploading(file.name)
      try {
        added.push(await uploadAttachment(report.id, file, caption))
      } catch (err) {
        notes.push(
          `${file.name}: ${err instanceof ApiError ? (fieldErrors(err).file ?? err.message) : 'didn’t upload.'}`,
        )
      }
    }
    setUploading('')
    setCaption('')
    setProblem(notes.join(' '))
    if (added.length) onChange([...attachments, ...added])
  }

  const remove = async (attachment: IncidentAttachment) => {
    if (!window.confirm(`Remove ${attachment.file_name} from the report?`)) return
    try {
      await api(`/incident-attachments/${attachment.id}/`, {
        method: 'DELETE',
      })
      onChange(attachments.filter((existing) => existing.id !== attachment.id))
    } catch (err) {
      setProblem(err instanceof ApiError ? err.message : 'Couldn’t remove it.')
    }
  }

  return (
    <fieldset className="incident-attachments">
      <legend>
        Photos and videos
        {attachments.length + queued.length > 0 && (
          <span className="muted"> · {attachments.length + queued.length}</span>
        )}
      </legend>

      {attachments.length > 0 && (
        <ul className="incident-attachments__grid">
          {attachments.map((attachment) => (
            <li key={attachment.id} className="incident-attachment">
              <a href={attachment.url} target="_blank" rel="noreferrer" className="incident-attachment__preview">
                {attachment.kind === 'image' ? (
                  <img src={attachment.url} alt={attachment.caption || attachment.file_name} loading="lazy" />
                ) : attachment.kind === 'video' ? (
                  <video src={attachment.url} preload="metadata" muted playsInline />
                ) : (
                  <span className="incident-attachment__file">PDF</span>
                )}
              </a>
              <span className="incident-attachment__caption">{attachment.caption || attachment.file_name}</span>
              <span className="incident-attachment__meta">
                {attachment.kind === 'video' ? 'Video' : attachment.kind === 'image' ? 'Photo' : 'PDF'}
                {attachment.size !== null && ` · ${fileSize(attachment.size)}`}
                {attachment.uploaded_by_name && ` · ${attachment.uploaded_by_name}`}
              </span>
              <span className="incident-attachment__actions">
                <a href={`${attachment.url}?download=1`} className="text-button">
                  Download
                </a>
                {canChange && (
                  <button type="button" className="text-button text-button--danger" onClick={() => remove(attachment)}>
                    Remove
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}

      {queued.length > 0 && (
        <ul className="incident-attachments__queued">
          {queued.map((item) => (
            <li key={item.key}>
              <span>
                {item.file.name} <span className="muted">· {fileSize(item.file.size)} · uploads when you file</span>
                {item.caption && <span className="muted"> · “{item.caption}”</span>}
              </span>
              <button
                type="button"
                className="text-button text-button--danger"
                onClick={() => onQueue(queued.filter((other) => other.key !== item.key))}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      {canChange && (
        <div className="incident-attachments__add">
          <input
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Caption (optional), e.g. Footprints by the fence"
            aria-label="Caption for the next file"
          />
          <button
            type="button"
            className="button button--secondary"
            onClick={() => input.current?.click()}
            disabled={!!uploading}
          >
            {uploading ? `Uploading ${uploading}…` : '+ Add photos or videos'}
          </button>
          <input ref={input} type="file" accept={ACCEPT} multiple hidden onChange={pick} />
        </div>
      )}
      {canChange && (
        <small className="form__hint">Photos, videos (MP4, MOV, WebM) and PDFs, up to {MAX_MB} MB each.</small>
      )}
      {(problem || error) && (
        <p className="form__error" role="alert">
          {problem || error}
        </p>
      )}
    </fieldset>
  )
}

function PrintButton({ dirty }: { dirty: boolean }) {
  const print = () => {
    if (dirty && !window.confirm('Printing shows the last saved version. Print anyway?')) return
    window.print()
  }
  return (
    <button type="button" className="text-button incident-print-button" onClick={print}>
      Print / save PDF
    </button>
  )
}

/** The report laid out for paper (insurance, police): hidden on screen. */
function PrintableReport({ report }: { report: IncidentReport }) {
  const photos = report.attachments.filter((attachment) => attachment.kind === 'image')
  const others = report.attachments.filter((attachment) => attachment.kind !== 'image')
  const rows: [string, string][] = [
    ['Report #', String(report.id)],
    ['Type', report.category_display],
    ['Severity', report.severity_display],
    ['Status', report.status_display],
    ['When it happened', formatDateTime(report.occurred_at)],
    ['Where', report.location],
    ['Filed', `${formatDateTime(report.created_at)}${report.reported_by_name ? ` by ${report.reported_by_name}` : ''}`],
    [
      'Police',
      report.police_called
        ? `Called${report.police_report_number ? ` · Report #${report.police_report_number}` : ''}`
        : 'Not called',
    ],
  ]
  return (
    <article className="incident-print" aria-hidden="true">
      <header className="incident-print__header">
        <p className="incident-print__org">K-Net · Security incident report</p>
        <h1>{report.title}</h1>
      </header>
      <table className="incident-print__facts">
        <tbody>
          {rows.map(([label, value]) => (
            <tr key={label}>
              <th scope="row">{label}</th>
              <td>{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <Detail label="What happened" value={report.description} />
      <Detail label="People involved" value={report.people_involved} />
      <Detail label="Witnesses" value={report.witnesses} />
      <Detail label="Actions taken" value={report.actions_taken} />
      <Detail label="Resolution and follow-up" value={report.resolution} />
      {photos.length > 0 && (
        <section className="incident-print__photos">
          <h3>Photos</h3>
          {photos.map((attachment) => (
            <figure key={attachment.id}>
              <img src={attachment.url} alt={attachment.caption || attachment.file_name} />
              <figcaption>{attachment.caption || attachment.file_name}</figcaption>
            </figure>
          ))}
        </section>
      )}
      {others.length > 0 && (
        <Detail
          label="Other attachments (in K-Net)"
          value={others
            .map((attachment) => `${attachment.file_name}${attachment.caption ? ` (${attachment.caption})` : ''}`)
            .join('\n')}
        />
      )}
      <p className="incident-print__footer">Printed {formatDateTime(new Date().toISOString())} · Confidential</p>
    </article>
  )
}
