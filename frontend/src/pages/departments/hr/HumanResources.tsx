import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { api, ApiError, fieldErrors } from '../../../api'
import { canUseHr, isManagerLevel, type User } from '../../../auth/roles'
import { useAuth } from '../../../auth/useAuth'
import { NavIcon } from '../../../components/NavIcon'
import { formatDay, timeAgo } from '../../../format'
import { useFetch } from '../../../hooks/useFetch'
import {
  CREDENTIAL_REQUEST_KINDS,
  type AgreementType,
  type CredentialRequest,
  type CredentialRequestKind,
  type DocumentCategory,
  type ProjectDocument,
} from '../../../types'
import { DocumentFormDialog } from '../../documents/DocumentFormDialog'
import './hr.css'

/** The agreements everyone on the crew should have on file, as the checklist's columns. */
const ONBOARDING_AGREEMENTS: { type: AgreementType; label: string }[] = [
  { type: 'nda', label: 'NDA' },
  { type: 'privacy', label: 'Privacy agreement' },
  { type: 'disclaimer', label: 'Legal disclaimer' },
]

const fullName = (person: Pick<User, 'first_name' | 'last_name'>) => `${person.first_name} ${person.last_name}`.trim()
const fileUrl = (doc: ProjectDocument) => `/api/documents/${doc.id}/file/`

type Upload = { category: DocumentCategory; person?: number; agreement_type?: AgreementType }

/** The Human Resources tools on the HR page: onboarding, hiring files, agreements and login help. */
export function HumanResourcesSection() {
  const { user } = useAuth()
  if (!canUseHr(user)) return null
  return <HumanResources />
}

function HumanResources() {
  const { user } = useAuth()
  const manager = isManagerLevel(user)
  const people = useFetch<User[]>('/users/')
  const agreements = useFetch<ProjectDocument[]>('/documents/?category=agreement')
  const hiring = useFetch<ProjectDocument[]>('/documents/?category=hiring')
  // Bumped after a new request so the list reloads.
  const [requestsVersion, setRequestsVersion] = useState(0)
  const [upload, setUpload] = useState<Upload | null>(null)
  const [asking, setAsking] = useState(false)
  const [notice, setNotice] = useState('')

  return (
    <div className="hr">
      <section className="department__section" aria-labelledby="hr-tools">
        <h2 id="hr-tools" className="department__heading">
          HR tools
        </h2>
        <div className="hr-tools">
          <Link to="/schedule/crew/invite" className="tile hr-tool">
            <NavIcon name="plus" size={20} />
            <span>
              <strong>Invite crew</strong>
              <span className="muted">QR code and sign-up link for new crew</span>
            </span>
          </Link>
          <Link to="/directory" className="tile hr-tool">
            <NavIcon name="contacts" size={20} />
            <span>
              <strong>Add or edit staff</strong>
              <span className="muted">Add someone, or update their details in the Directory</span>
            </span>
          </Link>
          <Link to="/staff-manager/departments" className="tile hr-tool">
            <NavIcon name="departments" size={20} />
            <span>
              <strong>Departments</strong>
              <span className="muted">Add, rename or delete a department</span>
            </span>
          </Link>
          {manager && (
            <button type="button" className="tile hr-tool" onClick={() => setAsking(true)}>
              <NavIcon name="shield" size={20} />
              <span>
                <strong>Request login help</strong>
                <span className="muted">New logins, password resets and access changes, from the Site Managers</span>
              </span>
            </button>
          )}
        </div>
        {notice && (
          <p className="notice notice--success" role="status">
            {notice}
          </p>
        )}
      </section>

      <OnboardingChecklist
        people={people.data}
        agreements={agreements.data}
        loading={(people.loading && !people.data) || (agreements.loading && !agreements.data)}
        onAdd={(person, type) => setUpload({ category: 'agreement', person, agreement_type: type })}
      />

      <HiringFiles
        docs={hiring.data}
        loading={hiring.loading && !hiring.data}
        onAdd={() => setUpload({ category: 'hiring' })}
      />

      {manager && (
        <LoginRequests key={requestsVersion} onAsk={() => setAsking(true)} />
      )}

      {upload && (
        <DocumentFormDialog
          document={null}
          initialCategory={upload.category}
          canChooseCategory
          defaults={{
            person: upload.person,
            agreement_type: upload.agreement_type,
            title: upload.agreement_type
              ? `${ONBOARDING_AGREEMENTS.find((item) => item.type === upload.agreement_type)?.label ?? 'Agreement'}${
                  upload.person
                    ? `: ${fullName(people.data?.find((person) => person.id === upload.person) ?? { first_name: '', last_name: '' })}`
                    : ''
                }`
              : '',
          }}
          onClose={() => setUpload(null)}
          onSaved={(saved) => {
            setUpload(null)
            setNotice(`Filed “${saved.title}”.`)
            agreements.reload()
            hiring.reload()
          }}
        />
      )}

      {asking && (
        <LoginRequestDialog
          people={people.data ?? []}
          onClose={() => setAsking(false)}
          onSent={(sent) => {
            setAsking(false)
            setNotice(`Sent to the Site Managers: ${sent.kind_display} for ${sent.who}.`)
            setRequestsVersion((value) => value + 1)
          }}
        />
      )}
    </div>
  )
}

interface ChecklistProps {
  people?: User[]
  agreements?: ProjectDocument[]
  loading: boolean
  onAdd: (person: number, type: AgreementType) => void
}

/** Everyone on K-Net and which onboarding agreements HR has on file for them. */
function OnboardingChecklist({ people, agreements, loading, onAdd }: ChecklistProps) {
  const [search, setSearch] = useState('')
  const [missingOnly, setMissingOnly] = useState(false)

  const onFile = useMemo(() => {
    const map = new Map<string, ProjectDocument>()
    for (const doc of agreements ?? []) {
      if (doc.person && doc.agreement_type) map.set(`${doc.person}:${doc.agreement_type}`, doc)
    }
    return map
  }, [agreements])

  const all = [...(people ?? [])].sort((a, b) => fullName(a).localeCompare(fullName(b)))
  const complete = (person: User) => ONBOARDING_AGREEMENTS.every((item) => onFile.has(`${person.id}:${item.type}`))
  const query = search.trim().toLowerCase()
  const visible = all.filter(
    (person) =>
      (!query || [fullName(person), person.department_name ?? '', person.title].some((text) => text.toLowerCase().includes(query))) &&
      (!missingOnly || !complete(person)),
  )
  const done = all.filter(complete).length

  return (
    <section className="department__section" aria-labelledby="hr-onboarding">
      <div className="hr-section__head">
        <h2 id="hr-onboarding" className="department__heading">
          Onboarding agreements
          {all.length > 0 && (
            <span className="department__count">
              {done} of {all.length} complete
            </span>
          )}
        </h2>
      </div>
      <div className="tile">
        <div className="form hr-filters">
          <label className="form__field">
            <span>Search</span>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name, department or title"
            />
          </label>
          <label className="hr-filters__check">
            <input type="checkbox" checked={missingOnly} onChange={(e) => setMissingOnly(e.target.checked)} />
            Only people missing something
          </label>
        </div>
        {loading ? (
          <p className="muted">Loading…</p>
        ) : !visible.length ? (
          <p className="muted">{missingOnly ? 'Everyone shown has all three on file.' : 'No one matches.'}</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table hr-table">
              <thead>
                <tr>
                  <th>Person</th>
                  {ONBOARDING_AGREEMENTS.map((item) => (
                    <th key={item.type}>{item.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map((person) => (
                  <tr key={person.id}>
                    <td data-label="Person">
                      <strong>{fullName(person)}</strong>
                      <span className="hr-table__sub">
                        {[person.title, person.department_name].filter(Boolean).join(' · ')}
                      </span>
                    </td>
                    {ONBOARDING_AGREEMENTS.map((item) => {
                      const doc = onFile.get(`${person.id}:${item.type}`)
                      return (
                        <td key={item.type} data-label={item.label}>
                          {doc ? (
                            <a href={fileUrl(doc)} target="_blank" rel="noreferrer" className="hr-on-file">
                              <NavIcon name="check" size={16} />
                              On file
                            </a>
                          ) : (
                            <button type="button" className="text-button hr-missing" onClick={() => onAdd(person.id, item.type)}>
                              + Add
                            </button>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="form__hint hr-hint">
          Upload any other agreement, like an appearance release, with + Add from a row; you can change the agreement
          type in the form. Everything here also shows under Documents.
        </p>
      </div>
    </section>
  )
}

/** Resumes, references and other hiring paperwork, newest first. */
function HiringFiles({ docs, loading, onAdd }: { docs?: ProjectDocument[]; loading: boolean; onAdd: () => void }) {
  return (
    <section className="department__section" aria-labelledby="hr-hiring">
      <div className="hr-section__head">
        <h2 id="hr-hiring" className="department__heading">
          Hiring files
          {docs && docs.length > 0 && <span className="department__count">{docs.length}</span>}
        </h2>
        <button type="button" className="button" onClick={onAdd}>
          + Add a resume or reference
        </button>
      </div>
      <div className="tile">
        {loading ? (
          <p className="muted">Loading…</p>
        ) : !docs?.length ? (
          <p className="muted">No hiring files yet. Add resumes, references, applications and offer letters here.</p>
        ) : (
          <ul className="hr-files">
            {docs.map((doc) => (
              <li key={doc.id}>
                <a href={fileUrl(doc)} target="_blank" rel="noreferrer" className="hr-files__title">
                  {doc.title}
                </a>
                <span className="muted">
                  {doc.person_display}
                  {!doc.person && doc.person_name && ' (candidate)'} · added{' '}
                  {formatDay(doc.created_at.slice(0, 10), { month: 'short', day: 'numeric', year: 'numeric' })}
                  {doc.uploaded_by_name && ` by ${doc.uploaded_by_name}`}
                </span>
                {doc.notes && <span className="hr-files__notes">{doc.notes}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

/** The login help this person has asked the Site Managers for. */
function LoginRequests({ onAsk }: { onAsk: () => void }) {
  const fetched = useFetch<CredentialRequest[]>('/credential-requests/')
  const requests = fetched.data
  const loading = fetched.loading && !fetched.data
  return (
    <section className="department__section" aria-labelledby="hr-requests">
      <div className="hr-section__head">
        <h2 id="hr-requests" className="department__heading">
          Login requests
        </h2>
        <button type="button" className="button button--secondary" onClick={onAsk}>
          Request login help
        </button>
      </div>
      <div className="tile">
        {loading ? (
          <p className="muted">Loading…</p>
        ) : !requests?.length ? (
          <p className="muted">
            Nothing asked yet. Only Site Managers set passwords and create logins; ask them here and they get an email.
          </p>
        ) : (
          <ul className="hr-files">
            {requests.map((request) => (
              <li key={request.id}>
                <span className="hr-files__title">
                  {request.kind_display}: {request.who}
                  <span className={`hr-request-status is-${request.status}`}>{request.status_display}</span>
                </span>
                <span className="muted">
                  Sent {timeAgo(request.created_at)}
                  {request.resolved_by_name && ` · handled by ${request.resolved_by_name}`}
                </span>
                {request.details && <span className="hr-files__notes">{request.details}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

interface RequestDialogProps {
  people: User[]
  onClose: () => void
  onSent: (sent: CredentialRequest) => void
}

/** Ask the Site Managers for a new login, a password reset, a new login email or an access change. */
function LoginRequestDialog({ people, onClose, onSent }: RequestDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [form, setForm] = useState({ kind: 'new_login' as CredentialRequestKind, person: '', name: '', email: '', details: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [sending, setSending] = useState(false)
  const newLogin = form.kind === 'new_login'
  const needsEmail = (newLogin && !form.person) || form.kind === 'email_change'

  useEffect(() => {
    dialogRef.current?.showModal()
  }, [])

  const set = (changes: Partial<typeof form>) => setForm((prev) => ({ ...prev, ...changes }))
  const sorted = [...people].sort((a, b) => fullName(a).localeCompare(fullName(b)))

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    event.stopPropagation()
    setSending(true)
    setErrors({})
    try {
      const sent = await api<CredentialRequest>('/credential-requests/', {
        method: 'POST',
        body: JSON.stringify({
          kind: form.kind,
          person: form.person ? Number(form.person) : null,
          name: form.person ? '' : form.name,
          email: needsEmail ? form.email : '',
          details: form.details,
        }),
      })
      onSent(sent)
    } catch (err) {
      const fields = fieldErrors(err)
      setErrors(Object.keys(fields).length ? fields : { form: err instanceof ApiError ? err.message : 'Couldn’t send it.' })
      setSending(false)
    }
  }

  const error = (name: string) => errors[name] && <small className="form__field-error">{errors[name]}</small>

  return (
    <dialog ref={dialogRef} className="dialog" onClose={onClose} aria-labelledby="login-request-title">
      <form className="form" onSubmit={submit} noValidate>
        <div className="dialog__header">
          <h2 id="login-request-title">Request login help</h2>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <p className="muted">Goes to the Site Managers by email and on their dashboard.</p>
        {errors.form && (
          <p className="form__error" role="alert">
            {errors.form}
          </p>
        )}
        <label className="form__field">
          <span>What’s needed</span>
          <select value={form.kind} onChange={(e) => set({ kind: e.target.value as CredentialRequestKind })}>
            {CREDENTIAL_REQUEST_KINDS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="form__field">
          <span>Who it’s for</span>
          <select value={form.person} onChange={(e) => set({ person: e.target.value })}>
            <option value="">{newLogin ? 'Someone new (not on K-Net yet)' : 'Choose someone'}</option>
            {sorted.map((person) => (
              <option key={person.id} value={person.id}>
                {fullName(person)}
                {person.department_name ? ` · ${person.department_name}` : ''}
              </option>
            ))}
          </select>
          {error('person')}
        </label>
        {newLogin && !form.person && (
          <label className="form__field">
            <span>
              Their name<span aria-hidden="true"> *</span>
            </span>
            <input value={form.name} onChange={(e) => set({ name: e.target.value })} autoComplete="off" />
            {error('name')}
          </label>
        )}
        {needsEmail && (
          <label className="form__field">
            <span>
              {form.kind === 'email_change' ? 'New login email' : 'Email they’ll log in with'}
              <span aria-hidden="true"> *</span>
            </span>
            <input type="email" value={form.email} onChange={(e) => set({ email: e.target.value })} autoComplete="off" />
            {error('email')}
          </label>
        )}
        <label className="form__field">
          <span>Details</span>
          <textarea
            rows={3}
            value={form.details}
            onChange={(e) => set({ details: e.target.value })}
            placeholder={
              form.kind === 'access_change'
                ? 'e.g. Make them an Assistant in Operations'
                : 'e.g. Starts Dec 1 in Culinary; locked out after a phone change'
            }
          />
        </label>
        <div className="inline-form__actions">
          <button type="submit" className="button" disabled={sending}>
            {sending ? 'Sending…' : 'Send to Site Managers'}
          </button>
          <button type="button" className="button button--secondary" onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </dialog>
  )
}
