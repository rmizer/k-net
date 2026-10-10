import { useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { api, ApiError, fieldErrors } from '../../api'
import { ROLE_LABELS, type Role, type User } from '../../auth/roles'
import { useAuth } from '../../auth/useAuth'
import { NewAccountNotice } from '../../components/NewAccountNotice'
import { SortHeader, useSort } from '../../components/sorting'
import { formatDateTime, timeAgo } from '../../format'
import { useFetch } from '../../hooks/useFetch'
import type { Department, RemovalRequest } from '../../types'
import { StaffFormDialog } from '../directory/StaffFormDialog'
import { Stat } from '../finance/shared'
import '../finance/finance.css'
import '../staff-manager/staff-manager.css'
import './site-manager.css'

type SortKey = 'name' | 'role' | 'department' | 'status' | 'joined' | 'login'

// Highest first, for sorting and the role filter.
const ROLES: Role[] = ['site_manager', 'director', 'assistant', 'staff']

const errorText = (err: unknown, fallback: string) => {
  const fields = Object.values(fieldErrors(err))
  return fields[0] ?? (err instanceof ApiError ? err.message : fallback)
}

/** Accounts, roles and departments for the whole site. Site Managers only. */
export function SiteManagerPage() {
  const { user } = useAuth()
  const people = useFetch<User[]>('/users/')
  const departments = useFetch<Department[]>('/departments/')
  const removals = useFetch<RemovalRequest[]>('/removal-requests/')
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [departmentFilter, setDepartmentFilter] = useState('')
  const [editing, setEditing] = useState<User | null | undefined>(undefined)
  const [created, setCreated] = useState<User | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)
  const [newDepartment, setNewDepartment] = useState('')
  const [addingDepartment, setAddingDepartment] = useState(false)
  const sort = useSort<SortKey>('role')

  const all = useMemo(() => people.data ?? [], [people.data])
  const pending = all.filter((p) => p.email_verified === false)
  const query = search.trim().toLowerCase()
  const visible = sort.apply(
    all.filter(
      (p) =>
        (!query || `${p.first_name} ${p.last_name} ${p.email} ${p.phone}`.toLowerCase().includes(query)) &&
        (!roleFilter || p.role === roleFilter) &&
        (!departmentFilter ||
          (departmentFilter === 'none' ? !p.department : String(p.department) === departmentFilter)),
    ),
    (p, key) =>
      ({
        name: `${p.last_name} ${p.first_name}`.toLowerCase(),
        role: ROLES.indexOf(p.role),
        department: p.department_name,
        status: p.email_verified === false ? 0 : 1,
        joined: p.date_joined,
        login: p.last_login,
      })[key],
  )
  const countOf = (role: Role) => all.filter((p) => p.role === role).length

  const reload = () => {
    people.reload()
    departments.reload()
    removals.reload()
  }

  /** PATCH one field on someone's account, with a busy state and a message either way. */
  const update = async (person: User, changes: Partial<User>, done: string) => {
    setBusyId(person.id)
    setMessage(null)
    try {
      await api(`/users/${person.id}/`, { method: 'PATCH', body: JSON.stringify(changes) })
      setMessage({ kind: 'success', text: done })
      reload()
    } catch (err) {
      setMessage({ kind: 'error', text: errorText(err, `Couldn’t update ${person.first_name}.`) })
    } finally {
      setBusyId(null)
    }
  }

  const changeRole = (person: User, role: Role) => {
    const name = `${person.first_name} ${person.last_name}`
    if (
      (role === 'site_manager' || person.role === 'site_manager') &&
      !window.confirm(
        role === 'site_manager'
          ? `Make ${name} a Site Manager? They’ll have every permission, including this page and the Dev Login.`
          : `Take Site Manager access away from ${name}?`,
      )
    ) {
      return
    }
    update(person, { role }, `${name} is now ${ROLE_LABELS[role] === 'Assistant' ? 'an' : 'a'} ${ROLE_LABELS[role]}.`)
  }

  const verify = async (person: User) => {
    setBusyId(person.id)
    setMessage(null)
    try {
      await api(`/users/${person.id}/verify/`, { method: 'POST' })
      setMessage({ kind: 'success', text: `${person.first_name} ${person.last_name} is verified and can log in now.` })
      people.reload()
    } catch (err) {
      setMessage({ kind: 'error', text: errorText(err, 'Couldn’t verify that account.') })
    } finally {
      setBusyId(null)
    }
  }

  const resend = async (person: User) => {
    setBusyId(person.id)
    setMessage(null)
    try {
      await api('/auth/resend-verification/', { method: 'POST', body: JSON.stringify({ email: person.email }) })
      setMessage({ kind: 'success', text: `Sent a new verification link to ${person.email}.` })
    } catch (err) {
      setMessage({ kind: 'error', text: errorText(err, 'Couldn’t send the email.') })
    } finally {
      setBusyId(null)
    }
  }

  const remove = async (person: User) => {
    const name = `${person.first_name} ${person.last_name}`
    if (
      !window.confirm(
        `Delete ${name}'s account? They won't be able to log in. Their records are kept, and the account can be restored from Dev Login.`,
      )
    )
      return
    setBusyId(person.id)
    setMessage(null)
    try {
      await api(`/users/${person.id}/`, { method: 'DELETE' })
      setMessage({ kind: 'success', text: `${name}'s account was deleted.` })
      reload()
    } catch (err) {
      setMessage({ kind: 'error', text: errorText(err, `Couldn’t delete ${name}.`) })
    } finally {
      setBusyId(null)
    }
  }

  const resolveRemoval = async (removal: RemovalRequest, action: 'approve' | 'dismiss') => {
    if (
      action === 'approve' &&
      !window.confirm(
        `Delete ${removal.person_name}'s account? They won't be able to log in. Their records are kept, and the account can be restored from Dev Login.`,
      )
    )
      return
    setMessage(null)
    try {
      await api(`/removal-requests/${removal.id}/${action}/`, { method: 'POST' })
      setMessage({
        kind: 'success',
        text:
          action === 'approve'
            ? `${removal.person_name}'s account was deleted.`
            : `Dismissed the request to remove ${removal.person_name}.`,
      })
      reload()
    } catch (err) {
      setMessage({ kind: 'error', text: errorText(err, 'Couldn’t update that request.') })
    }
  }

  const edit = async (person: User) => {
    try {
      setEditing(await api<User>(`/users/${person.id}/`))
    } catch {
      setMessage({ kind: 'error', text: `Couldn’t load ${person.first_name}’s details.` })
    }
  }

  const addDepartment = async (event: FormEvent) => {
    event.preventDefault()
    setAddingDepartment(true)
    setMessage(null)
    try {
      await api('/departments/', { method: 'POST', body: JSON.stringify({ name: newDepartment }) })
      setMessage({ kind: 'success', text: `Added the ${newDepartment.trim()} department.` })
      setNewDepartment('')
      departments.reload()
    } catch (err) {
      setMessage({ kind: 'error', text: errorText(err, 'Couldn’t add the department.') })
    } finally {
      setAddingDepartment(false)
    }
  }

  const deleteDepartment = async (department: Department) => {
    const count = department.member_count ?? 0
    const warning = count ? ` Its ${count} ${count === 1 ? 'member' : 'members'} will be left without one.` : ''
    if (!window.confirm(`Delete the ${department.name} department?${warning}`)) return
    setMessage(null)
    try {
      await api(`/departments/${department.id}/`, { method: 'DELETE' })
      reload()
    } catch (err) {
      setMessage({ kind: 'error', text: errorText(err, 'Couldn’t delete the department.') })
    }
  }

  if (people.loading && !people.data) return <p className="loading">Loading accounts…</p>
  if (!people.data) return <p className="form__error">Couldn’t load accounts.</p>

  return (
    <section className="finance staff-manager site-manager">
      <div className="page-header">
        <div>
          <h1>Site Manager Dashboard</h1>
          <p className="subtitle">Accounts, roles and departments for the whole site</p>
        </div>
        <div className="inline-form__actions">
          <button type="button" className="button" onClick={() => setEditing(null)}>
            + Add user
          </button>
          <Link to="/crew/invite" className="button button--secondary">
            Invite crew
          </Link>
        </div>
      </div>

      {created && <NewAccountNotice person={created} onDismiss={() => setCreated(null)} />}
      {message && (
        <p
          className={message.kind === 'error' ? 'form__error' : 'notice notice--success'}
          role={message.kind === 'error' ? 'alert' : 'status'}
        >
          {message.text}
        </p>
      )}

      <dl className="fin-stats">
        <Stat
          label="People"
          value={all.length}
          note={`${countOf('site_manager')} Site Manager · ${countOf('director')} Director · ${countOf('assistant')} Assistant · ${countOf('staff')} Staff`}
        />
        <Stat
          label="Waiting to verify"
          value={pending.length}
          alert={pending.length > 0}
          note={pending.length ? 'Sign-ups who haven’t clicked their email link' : 'Everyone is verified'}
        />
        <Stat
          label="Departments"
          value={departments.data?.length ?? '—'}
          note={`${all.filter((p) => !p.department).length} people without one`}
        />
      </dl>

      {(removals.data ?? []).length > 0 && (
        <section className="tile sm-removals" aria-labelledby="removals-heading">
          <div className="fin-section__head">
            <h2 id="removals-heading">Removal requests</h2>
          </div>
          <p className="muted sm-pending__hint">
            Directors and Assistants asked for these accounts to be removed. Only Site Managers can delete accounts.
          </p>
          <ul className="sm-pending">
            {(removals.data ?? []).map((removal) => (
              <li key={removal.id}>
                <span>
                  <strong>{removal.person_name}</strong>
                  <span className="fin-sub">
                    {removal.person_role_display} · {removal.person_email}
                  </span>
                  <span className="fin-sub">
                    Requested by {removal.requested_by_name ?? 'a former manager'} {timeAgo(removal.created_at)}
                    {removal.reason && <>: “{removal.reason}”</>}
                  </span>
                </span>
                <span className="row-actions">
                  <button type="button" className="text-button" onClick={() => resolveRemoval(removal, 'approve')}>
                    Delete account
                  </button>
                  <button type="button" className="text-button" onClick={() => resolveRemoval(removal, 'dismiss')}>
                    Dismiss
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {pending.length > 0 && (
        <section className="tile" aria-labelledby="pending-heading">
          <div className="fin-section__head">
            <h2 id="pending-heading">Waiting for email verification</h2>
          </div>
          <p className="muted sm-pending__hint">
            They can’t log in until they click the link in their email. Resend it, or verify them yourself if you
            know who they are.
          </p>
          <ul className="sm-pending">
            {pending.map((person) => (
              <li key={person.id}>
                <span>
                  <strong>
                    {person.first_name} {person.last_name}
                  </strong>
                  <span className="fin-sub">
                    {person.email}
                    {person.date_joined && ` · signed up ${timeAgo(person.date_joined)}`}
                  </span>
                </span>
                <span className="row-actions">
                  <button
                    type="button"
                    className="text-button"
                    disabled={busyId === person.id}
                    onClick={() => resend(person)}
                  >
                    Resend email
                  </button>
                  <button
                    type="button"
                    className="text-button"
                    disabled={busyId === person.id}
                    onClick={() => verify(person)}
                  >
                    Mark verified
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="fin-section" aria-labelledby="users-heading">
        <div className="fin-section__head">
          <h2 id="users-heading">Users and roles</h2>
        </div>
        <div className="fin-filters" role="search">
          <label className="form__field">
            <span>Search</span>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name, email or phone"
            />
          </label>
          <label className="form__field">
            <span>Role</span>
            <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
              <option value="">All</option>
              {ROLES.map((role) => (
                <option key={role} value={role}>
                  {ROLE_LABELS[role]}
                </option>
              ))}
            </select>
          </label>
          <label className="form__field">
            <span>Department</span>
            <select value={departmentFilter} onChange={(e) => setDepartmentFilter(e.target.value)}>
              <option value="">All</option>
              {(departments.data ?? []).map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
              <option value="none">No department</option>
            </select>
          </label>
        </div>

        <div className="tile">
          {visible.length === 0 ? (
            <p className="muted">No one matches those filters.</p>
          ) : (
            <div className="table-wrap">
              <table className="data-table fin-table">
                <thead>
                  <tr>
                    <SortHeader sort={sort} column="name">
                      Name
                    </SortHeader>
                    <SortHeader sort={sort} column="role">
                      Role
                    </SortHeader>
                    <SortHeader sort={sort} column="department">
                      Department
                    </SortHeader>
                    <SortHeader sort={sort} column="status">
                      Status
                    </SortHeader>
                    <SortHeader sort={sort} column="joined">
                      Joined
                    </SortHeader>
                    <SortHeader sort={sort} column="login">
                      Last login
                    </SortHeader>
                    <th>
                      <span className="visually-hidden">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((person) => {
                    const self = person.id === user?.id
                    const busy = busyId === person.id
                    const name = `${person.first_name} ${person.last_name}`
                    return (
                      <tr key={person.id}>
                        <td data-label="Name">
                          <strong>{name}</strong>
                          {self && <span className="badge badge--muted">You</span>}
                          <span className="fin-sub">{person.email}</span>
                          {person.phone && <span className="fin-sub">{person.phone}</span>}
                        </td>
                        <td data-label="Role">
                          {self ? (
                            <span title="You can’t change your own role.">{person.role_display}</span>
                          ) : (
                            <select
                              className="sm-status"
                              value={person.role}
                              disabled={busy}
                              onChange={(e) => changeRole(person, e.target.value as Role)}
                              aria-label={`${name}’s role`}
                            >
                              {ROLES.map((role) => (
                                <option key={role} value={role}>
                                  {ROLE_LABELS[role]}
                                </option>
                              ))}
                            </select>
                          )}
                        </td>
                        <td data-label="Department">
                          <select
                            className="sm-status sm-department"
                            value={person.department ?? ''}
                            disabled={busy}
                            onChange={(e) =>
                              update(
                                person,
                                { department: e.target.value ? Number(e.target.value) : null },
                                `Moved ${name} to ${e.target.selectedOptions[0]?.text ?? 'no department'}.`,
                              )
                            }
                            aria-label={`${name}’s department`}
                          >
                            <option value="">No department</option>
                            {(departments.data ?? []).map((d) => (
                              <option key={d.id} value={d.id}>
                                {d.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td data-label="Status">
                          {person.email_verified === false ? (
                            <span className="badge">Not verified</span>
                          ) : (
                            'Verified'
                          )}
                        </td>
                        <td data-label="Joined">
                          {person.date_joined ? formatDateTime(person.date_joined).split(',')[0] : '—'}
                        </td>
                        <td data-label="Last login">
                          {person.last_login ? timeAgo(person.last_login) : <span className="muted">Never</span>}
                        </td>
                        <td className="fin-actions">
                          <span className="row-actions">
                            <button type="button" className="text-button" onClick={() => edit(person)}>
                              Edit
                            </button>
                            {!self && (
                              <button
                                type="button"
                                className="text-button"
                                disabled={busy}
                                onClick={() => remove(person)}
                              >
                                Delete
                              </button>
                            )}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <section className="fin-section" aria-labelledby="departments-heading">
        <div className="fin-section__head">
          <h2 id="departments-heading">Departments</h2>
          <Link to="/staff-manager/departments">Rename or choose members</Link>
        </div>
        <div className="tile">
          <form className="departments__add sm-department-add" onSubmit={addDepartment}>
            <label className="form__field">
              <span>New department</span>
              <input
                value={newDepartment}
                onChange={(e) => setNewDepartment(e.target.value)}
                placeholder="e.g. Camera, Wardrobe, Catering"
                maxLength={100}
                required
              />
            </label>
            <button type="submit" className="button" disabled={addingDepartment || !newDepartment.trim()}>
              {addingDepartment ? 'Adding…' : 'Add department'}
            </button>
          </form>
          {departments.data && departments.data.length === 0 ? (
            <p className="muted">No departments yet. Add the first one above.</p>
          ) : (
            <ul className="sm-department-list">
              {(departments.data ?? []).map((department) => (
                <li key={department.id}>
                  <span>
                    <strong>{department.name}</strong>
                    <span className="muted">
                      {' '}
                      · {department.member_count ?? 0} {department.member_count === 1 ? 'person' : 'people'}
                    </span>
                  </span>
                  <button type="button" className="text-button" onClick={() => deleteDepartment(department)}>
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="fin-section" aria-labelledby="tools-heading">
        <div className="fin-section__head">
          <h2 id="tools-heading">Site tools</h2>
        </div>
        <ul className="sm-tools">
          <li className="tile">
            <a href="/admin/">Dev Login</a>
            <span className="fin-sub">The Django admin: every record, contact messages, production settings.</span>
          </li>
          <li className="tile">
            <Link to="/for-investors">Investor page</Link>
            <span className="fin-sub">Public; linked from About the trial.</span>
          </li>
          <li className="tile">
            <Link to="/staff-manager">Director’s Dashboard</Link>
            <span className="fin-sub">Schedules, tasks and the master staff list.</span>
          </li>
        </ul>
      </section>

      {editing !== undefined && (
        <StaffFormDialog
          person={editing}
          departments={departments.data ?? []}
          assignableRoles={user?.assignable_roles ?? []}
          onClose={() => setEditing(undefined)}
          onSaved={(saved) => {
            setEditing(undefined)
            if (saved.temporary_password) setCreated(saved)
            reload()
          }}
        />
      )}
    </section>
  )
}
