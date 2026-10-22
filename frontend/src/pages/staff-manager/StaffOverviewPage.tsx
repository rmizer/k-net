import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api'
import type { User } from '../../auth/roles'
import { useAuth } from '../../auth/useAuth'
import { NewAccountNotice } from '../../components/NewAccountNotice'
import { RequestRemovalDialog } from '../../components/RequestRemovalDialog'
import { BlockScheduleDialog } from '../../components/schedule/BlockScheduleDialog'
import { SortHeader, useSort } from '../../components/sorting'
import { TaskFormDialog } from '../../components/TaskFormDialog'
import { dayKey, formatDay, formatTimeRange, lodgingLabel } from '../../format'
import { useFetch } from '../../hooks/useFetch'
import { StaffFormDialog } from '../directory/StaffFormDialog'
import type { Department, ProductionSettings, StaffOverviewRow, Task } from '../../types'
import { Stat } from '../finance/shared'
import { NewDepartmentDialog } from './NewDepartmentDialog'
import { NavIcon } from '../../components/NavIcon'
import '../finance/finance.css'
import './staff-manager.css'

type SortKey = 'name' | 'department' | 'role' | 'tasks' | 'next' | 'hours'

export function StaffOverviewPage() {
  const { user } = useAuth()
  const people = useFetch<StaffOverviewRow[]>('/staff-manager/staff/')
  const myTasks = useFetch<Task[]>('/tasks/?mine=1')
  const departments = useFetch<Department[]>('/departments/')
  const production = useFetch<ProductionSettings>('/production/')
  const [search, setSearch] = useState('')
  const [department, setDepartment] = useState('')
  const [role, setRole] = useState('')
  const [crewOnly, setCrewOnly] = useState(false)
  const [assigning, setAssigning] = useState<number | null | undefined>(undefined)
  // Who a new block is for (null for no one in particular), or undefined when closed.
  const [blocking, setBlocking] = useState<number | null | undefined>(undefined)
  const [notice, setNotice] = useState('')
  const [created, setCreated] = useState<User | null>(null)
  const [requesting, setRequesting] = useState<StaffOverviewRow | null>(null)
  const [saving, setSaving] = useState<number | null>(null)
  // The person being edited (null to add someone new), or undefined when the dialog is closed.
  const [editing, setEditing] = useState<User | null | undefined>(undefined)
  const [movingId, setMovingId] = useState<number | null>(null)
  const [addingDepartment, setAddingDepartment] = useState(false)
  const [rowError, setRowError] = useState('')
  const sort = useSort<SortKey>('name')
  const timeZone = production.data?.time_zone ?? 'UTC'
  const today = production.data?.today

  const all = useMemo(() => people.data ?? [], [people.data])
  const roles = [...new Map(all.map((p) => [p.role, p.role_display])).entries()]
  const query = search.trim().toLowerCase()
  const visible = sort.apply(
    all.filter(
      (p) =>
        (!query || `${p.name} ${p.email} ${p.phone} ${p.lodging} ${p.room_number}`.toLowerCase().includes(query)) &&
        (!department || (department === 'none' ? !p.department : String(p.department) === department)) &&
        (!role || p.role === role) &&
        (!crewOnly || p.is_active_crew),
    ),
    (p, key) =>
      ({
        name: p.name.toLowerCase(),
        department: p.department_name,
        role: p.role_display,
        tasks: p.tasks.overdue * 1000 + p.tasks.open || null,
        next: p.next_event?.start,
        hours: p.hours_this_week,
      })[key],
  )

  const openMine = (myTasks.data ?? []).filter((t) => t.status !== 'done')
  const crew = all.filter((p) => p.is_active_crew)
  const totals = {
    open: all.reduce((sum, p) => sum + p.tasks.open, 0),
    overdue: all.reduce((sum, p) => sum + p.tasks.overdue, 0),
    hours: Math.round(crew.reduce((sum, p) => sum + p.hours_this_week, 0)),
  }

  const complete = async (task: Task) => {
    setSaving(task.id)
    try {
      await api(`/tasks/${task.id}/`, { method: 'PATCH', body: JSON.stringify({ status: 'done' }) })
      myTasks.reload()
      people.reload()
    } finally {
      setSaving(null)
    }
  }

  // Directors and Assistants can edit people at their own level or below, and themselves.
  const canEdit = (person: StaffOverviewRow) =>
    person.id === user?.id || !!user?.assignable_roles?.includes(person.role)

  // Only Site Managers delete accounts; Directors and Assistants request removal.
  const canRemove = (person: StaffOverviewRow) =>
    person.id !== user?.id && !!user?.assignable_roles?.includes(person.role)

  const remove = async (person: StaffOverviewRow) => {
    if (
      !window.confirm(
        `Delete ${person.name}'s account? They won't be able to log in. Their records are kept, and the account can be restored from Dev Login.`,
      )
    )
      return
    setRowError('')
    try {
      await api(`/users/${person.id}/`, { method: 'DELETE' })
      setNotice(`${person.name}'s account was deleted.`)
      people.reload()
    } catch {
      setRowError(`Couldn’t delete ${person.name}.`)
    }
  }

  const edit = async (person: StaffOverviewRow) => {
    setRowError('')
    try {
      setEditing(await api<User>(`/users/${person.id}/`))
    } catch {
      setRowError(`Couldn’t load ${person.name}’s details.`)
    }
  }

  const moveToDepartment = async (person: StaffOverviewRow, value: string) => {
    setMovingId(person.id)
    setRowError('')
    try {
      await api(`/users/${person.id}/`, {
        method: 'PATCH',
        body: JSON.stringify({ department: value ? Number(value) : null }),
      })
      people.reload()
    } catch {
      setRowError(`Couldn’t change ${person.name}’s department.`)
    } finally {
      setMovingId(null)
    }
  }

  const nextUp = (event: StaffOverviewRow['next_event']) => {
    if (!event) return <span className="muted">Nothing scheduled</span>
    const day = dayKey(event.start, timeZone)
    const when = event.all_day ? 'All day' : formatTimeRange(event.start, event.end, timeZone)
    return (
      <>
        {event.title}
        <span className="fin-sub staff-overview-table__when">
          {day === today ? 'Today' : formatDay(day, { weekday: 'short', month: 'short', day: 'numeric' })} · {when}
        </span>
      </>
    )
  }

  if (people.loading && !people.data) return <p className="loading">Loading staff…</p>
  if (!people.data) return <p className="form__error">Couldn’t load staff.</p>

  return (
    <section className="finance staff-manager">
      <div className="page-header">
        <div>
          <h1>
            <NavIcon name="clipboard" />
            Director Dashboard
          </h1>
          <p className="subtitle">Staff, departments, schedules and tasks in one place</p>
        </div>
        {/* Three groups: scheduling and tasks, people, shows. */}
        <div className="sm-actions">
          <div className="sm-actions__group">
            <button type="button" className="button" onClick={() => setBlocking(null)} disabled={!today}>
              + Schedule a block
            </button>
            <button type="button" className="button button--secondary" onClick={() => setAssigning(null)}>
              + Assign task
            </button>
          </div>
          <div className="sm-actions__group">
            <button type="button" className="button button--secondary" onClick={() => setAddingDepartment(true)}>
              + New department
            </button>
            <button type="button" className="button button--secondary" onClick={() => setEditing(null)}>
              + Add staff
            </button>
            <Link to="/crew/invite" className="button button--secondary">
              + Invite crew
            </Link>
          </div>
          <div className="sm-actions__group">
            <Link to="/staff-manager/shows" className="button button--secondary">
              Show control hub
            </Link>
          </div>
        </div>
      </div>

      {created && <NewAccountNotice person={created} onDismiss={() => setCreated(null)} />}

      <dl className="fin-stats">
        <Stat label="Active crew" value={crew.length} note={`${all.length} people in all`} />
        <Stat
          label="Open staff tasks"
          value={totals.open}
          note={<Link to="/staff-manager/tasks">Task Management</Link>}
        />
        <Stat
          label="Overdue"
          value={totals.overdue}
          alert={totals.overdue > 0}
          note={totals.overdue ? 'Needs follow-up' : 'All on time'}
        />
        <Stat
          label="Crew hours this week"
          value={totals.hours}
          note={<Link to="/staff-manager/scheduling">Scheduling</Link>}
        />
      </dl>

      <section className="tile" aria-labelledby="my-tasks-heading">
        <div className="fin-section__head">
          <h2 id="my-tasks-heading">Your task list</h2>
          <Link to="/schedule/tasks">All my tasks</Link>
        </div>
        {openMine.length === 0 ? (
          <p className="muted">You’re all caught up.</p>
        ) : (
          <ul className="sm-my-tasks">
            {openMine.map((task) => (
              <li key={task.id}>
                <input
                  type="checkbox"
                  disabled={saving === task.id}
                  onChange={() => complete(task)}
                  aria-label={`Mark “${task.title}” done`}
                />
                <span className="sm-my-tasks__title">
                  {task.title}
                  {task.created_by_name && <span className="fin-sub">From {task.created_by_name}</span>}
                </span>
                {task.priority === 'high' && <span className="badge">High</span>}
                {task.status === 'in_progress' && <span className="badge badge--muted">In progress</span>}
                <span className={task.is_overdue ? 'fin-overdue' : 'muted'}>
                  {task.due_date
                    ? `${task.is_overdue ? 'Overdue · ' : 'Due '}${formatDay(task.due_date, { month: 'short', day: 'numeric' })}`
                    : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="fin-section" aria-labelledby="staff-heading">
        <div className="fin-section__head">
          <h2 id="staff-heading">Master staff list</h2>
          <Link to="/staff-manager/departments">Manage departments</Link>
        </div>
        <div className="fin-filters" role="search">
          <label className="form__field">
            <span>Search</span>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name, email, phone, lodging"
            />
          </label>
          <label className="form__field">
            <span>Department</span>
            <select value={department} onChange={(e) => setDepartment(e.target.value)}>
              <option value="">All</option>
              {(departments.data ?? []).map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
              <option value="none">No department</option>
            </select>
          </label>
          <label className="form__field">
            <span>Role</span>
            <select value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="">All</option>
              {roles.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="form__check fin-filters__check">
            <input type="checkbox" checked={crewOnly} onChange={(e) => setCrewOnly(e.target.checked)} />
            <span>Active crew only</span>
          </label>
        </div>

        {notice && (
          <p className="notice notice--success" role="status">
            {notice}
          </p>
        )}
        {rowError && (
          <p className="form__error" role="alert">
            {rowError}
          </p>
        )}
        <div className="tile">
          {visible.length === 0 ? (
            <p className="muted">No one matches those filters.</p>
          ) : (
            <div className="table-wrap">
              <table className="data-table fin-table staff-overview-table">
                <thead>
                  <tr>
                    <SortHeader sort={sort} column="name">
                      Name
                    </SortHeader>
                    <SortHeader sort={sort} column="department">
                      Department
                    </SortHeader>
                    <th>Contact</th>
                    <SortHeader sort={sort} column="tasks">
                      Tasks
                    </SortHeader>
                    <SortHeader sort={sort} column="next" className="staff-overview-table__next">
                      Next up
                    </SortHeader>
                    <SortHeader sort={sort} column="hours" className="fin-num">
                      <span className="staff-overview-table__hours">
                        Hrs this
                        <br />
                        week
                      </span>
                    </SortHeader>
                    <th>
                      <span className="visually-hidden">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((person) => (
                    <tr key={person.id}>
                      <td data-label="Name">
                        <Link to={`/staff-manager/scheduling?person=${person.id}`} className="fin-person-link">
                          {person.name}
                        </Link>
                        <span className="fin-sub">
                          {person.role_display}
                          {person.is_active_crew ? ' · Active crew' : ''}
                        </span>
                      </td>
                      <td data-label="Department">
                        {canEdit(person) ? (
                          <select
                            className="sm-status sm-department"
                            value={person.department ?? ''}
                            disabled={movingId === person.id}
                            onChange={(e) => moveToDepartment(person, e.target.value)}
                            aria-label={`${person.name}’s department`}
                          >
                            <option value="">No department</option>
                            {(departments.data ?? []).map((d) => (
                              <option key={d.id} value={d.id}>
                                {d.name}
                              </option>
                            ))}
                          </select>
                        ) : (
                          (person.department_name ?? '—')
                        )}
                      </td>
                      <td data-label="Contact">
                        {person.phone && (
                          <a className="contact-link" href={`tel:${person.phone}`}>
                            {person.phone}
                          </a>
                        )}
                        <span className="fin-sub">{person.email}</span>
                        {person.lodging || person.room_number ? (
                          <span className="fin-sub">{lodgingLabel(person.lodging, person.room_number)}</span>
                        ) : null}
                      </td>
                      <td data-label="Tasks">
                        {person.tasks.open ? (
                          <Link to={`/staff-manager/tasks?person=${person.id}`}>{person.tasks.open} open</Link>
                        ) : (
                          <span className="muted">None open</span>
                        )}
                        {person.tasks.overdue > 0 && (
                          <span className="fin-sub fin-overdue">{person.tasks.overdue} overdue</span>
                        )}
                      </td>
                      <td data-label="Next up">{nextUp(person.next_event)}</td>
                      <td data-label="Hrs this week" className="fin-num">
                        {person.hours_this_week}
                      </td>
                      <td className="fin-actions">
                        <span className="row-actions">
                          {canEdit(person) && (
                            <button type="button" className="text-button" onClick={() => edit(person)}>
                              Edit
                            </button>
                          )}
                          <button type="button" className="text-button" onClick={() => setAssigning(person.id)}>
                            Assign task
                          </button>
                          <Link to={`/staff-manager/scheduling?person=${person.id}`} className="text-button">
                            Schedule
                          </Link>
                          <button
                            type="button"
                            className="text-button"
                            onClick={() => setBlocking(person.id)}
                            disabled={!today}
                          >
                            Block
                          </button>
                          {canRemove(person) &&
                            (user?.role === 'site_manager' ? (
                              <button type="button" className="text-button" onClick={() => remove(person)}>
                                Delete
                              </button>
                            ) : (
                              <button type="button" className="text-button" onClick={() => setRequesting(person)}>
                                Request removal
                              </button>
                            ))}
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

      {editing !== undefined && (
        <StaffFormDialog
          person={editing}
          departments={departments.data ?? []}
          assignableRoles={user?.assignable_roles ?? []}
          onClose={() => setEditing(undefined)}
          onSaved={(saved) => {
            setEditing(undefined)
            if (saved.temporary_password) setCreated(saved)
            people.reload()
            departments.reload()
          }}
        />
      )}

      {blocking !== undefined && today && (
        <BlockScheduleDialog
          defaultDay={today}
          defaultAttendees={blocking === null ? [] : [blocking]}
          people={all.map((p) => ({ id: p.id, name: p.name }))}
          departments={departments.data ?? []}
          timeZone={timeZone}
          onClose={() => setBlocking(undefined)}
          onSaved={(count) => {
            setBlocking(undefined)
            setNotice(`Added ${count} ${count === 1 ? 'day' : 'days'} to the schedule.`)
            people.reload()
          }}
        />
      )}

      {addingDepartment && (
        <NewDepartmentDialog
          onClose={() => setAddingDepartment(false)}
          onCreated={(created) => {
            setAddingDepartment(false)
            departments.reload()
            setNotice(`Added the ${created.name} department.`)
          }}
        />
      )}

      {requesting && (
        <RequestRemovalDialog
          person={requesting}
          onClose={() => setRequesting(null)}
          onSent={(message) => {
            setRequesting(null)
            setNotice(message)
          }}
        />
      )}

      {assigning !== undefined && (
        <TaskFormDialog
          task={null}
          people={all.map((p) => ({ id: p.id, name: p.name, department: p.department }))}
          departments={departments.data ?? []}
          defaultAssignee={assigning}
          onClose={() => setAssigning(undefined)}
          onSaved={() => {
            setAssigning(undefined)
            people.reload()
            myTasks.reload()
          }}
        />
      )}
    </section>
  )
}
