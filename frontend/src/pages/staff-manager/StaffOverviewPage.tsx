import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api'
import { SortHeader, useSort } from '../../components/sorting'
import { TaskFormDialog } from '../../components/TaskFormDialog'
import { dayKey, formatDay, formatTimeRange } from '../../format'
import { useFetch } from '../../hooks/useFetch'
import type { Department, ProductionSettings, StaffOverviewRow, Task } from '../../types'
import { Stat } from '../finance/shared'
import '../finance/finance.css'
import './staff-manager.css'

type SortKey = 'name' | 'department' | 'role' | 'tasks' | 'next' | 'hours'

export function StaffOverviewPage() {
  const people = useFetch<StaffOverviewRow[]>('/staff-manager/staff/')
  const myTasks = useFetch<Task[]>('/tasks/?mine=1')
  const departments = useFetch<Department[]>('/departments/')
  const production = useFetch<ProductionSettings>('/production/')
  const [search, setSearch] = useState('')
  const [department, setDepartment] = useState('')
  const [role, setRole] = useState('')
  const [crewOnly, setCrewOnly] = useState(false)
  const [assigning, setAssigning] = useState<number | null | undefined>(undefined)
  const [saving, setSaving] = useState<number | null>(null)
  const sort = useSort<SortKey>('name')
  const timeZone = production.data?.time_zone ?? 'UTC'
  const today = production.data?.today

  const all = useMemo(() => people.data ?? [], [people.data])
  const roles = [...new Map(all.map((p) => [p.role, p.role_display])).entries()]
  const query = search.trim().toLowerCase()
  const visible = sort.apply(
    all.filter(
      (p) =>
        (!query || `${p.name} ${p.email} ${p.phone} ${p.lodging}`.toLowerCase().includes(query)) &&
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

  const nextUp = (event: StaffOverviewRow['next_event']) => {
    if (!event) return <span className="muted">Nothing scheduled</span>
    const day = dayKey(event.start, timeZone)
    const when = event.all_day ? 'All day' : formatTimeRange(event.start, event.end, timeZone)
    return (
      <>
        {event.title}
        <span className="fin-sub">
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
          <h1>Task Manager</h1>
          <p className="subtitle">Your tasks and the master staff list</p>
        </div>
        <button type="button" className="button" onClick={() => setAssigning(null)}>
          + Assign task
        </button>
      </div>

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
        <h2 id="staff-heading">Master staff list</h2>
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
                    <SortHeader sort={sort} column="department">
                      Department
                    </SortHeader>
                    <th>Contact</th>
                    <SortHeader sort={sort} column="tasks">
                      Tasks
                    </SortHeader>
                    <SortHeader sort={sort} column="next">
                      Next up
                    </SortHeader>
                    <SortHeader sort={sort} column="hours" className="fin-num">
                      Hours this week
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
                      <td data-label="Department">{person.department_name ?? '—'}</td>
                      <td data-label="Contact">
                        {person.phone && (
                          <a className="contact-link" href={`tel:${person.phone}`}>
                            {person.phone}
                          </a>
                        )}
                        <span className="fin-sub">{person.email}</span>
                        {person.lodging && <span className="fin-sub">{person.lodging}</span>}
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
                      <td data-label="Hours this week" className="fin-num">
                        {person.hours_this_week}
                      </td>
                      <td className="fin-actions">
                        <span className="row-actions">
                          <button type="button" className="text-button" onClick={() => setAssigning(person.id)}>
                            Assign task
                          </button>
                          <Link to={`/staff-manager/scheduling?person=${person.id}`} className="text-button">
                            Schedule
                          </Link>
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
