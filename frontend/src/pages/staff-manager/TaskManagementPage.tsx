import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api, ApiError } from '../../api'
import { SortHeader, useSort } from '../../components/sorting'
import { TaskFormDialog } from '../../components/TaskFormDialog'
import { formatDay } from '../../format'
import { useFetch } from '../../hooks/useFetch'
import type { Department, StaffOverviewRow, Task, TaskStatus } from '../../types'
import { Stat } from '../finance/shared'
import '../finance/finance.css'
import './staff-manager.css'

type Show = 'open' | 'done' | 'all'
type SortKey = 'due' | 'title' | 'who' | 'priority' | 'status'

const PRIORITY_RANK = { high: 0, normal: 1, low: 2 } as const
const STATUS_RANK = { todo: 0, in_progress: 1, done: 2 } as const

export function TaskManagementPage() {
  const tasks = useFetch<Task[]>('/tasks/')
  const people = useFetch<StaffOverviewRow[]>('/staff-manager/staff/')
  const departments = useFetch<Department[]>('/departments/')
  const [params, setParams] = useSearchParams()
  const [show, setShow] = useState<Show>('open')
  const [search, setSearch] = useState('')
  const [department, setDepartment] = useState('')
  const [priority, setPriority] = useState('')
  const [dialog, setDialog] = useState<{ task: Task | null; assignee: number | null } | null>(
    params.get('assign') ? { task: null, assignee: Number(params.get('assign')) } : null,
  )
  const [error, setError] = useState('')
  const sort = useSort<SortKey>('due')

  const person = params.get('person') ?? ''
  const all = useMemo(() => tasks.data ?? [], [tasks.data])
  const query = search.trim().toLowerCase()
  const visible = sort.apply(
    all.filter(
      (t) =>
        (show === 'all' || (show === 'done') === (t.status === 'done')) &&
        (!person || (person === 'none' ? !t.assigned_to : String(t.assigned_to) === person)) &&
        (!department || String(t.department) === department) &&
        (!priority || t.priority === priority) &&
        (!query || `${t.title} ${t.description}`.toLowerCase().includes(query)),
    ),
    (t, key) =>
      ({
        due: t.due_date,
        title: t.title.toLowerCase(),
        who: (t.assigned_to_name ?? t.department_name ?? '').toLowerCase(),
        priority: PRIORITY_RANK[t.priority],
        status: STATUS_RANK[t.status],
      })[key],
  )

  const open = all.filter((t) => t.status !== 'done')
  const stats = {
    open: open.length,
    overdue: open.filter((t) => t.is_overdue).length,
    unassigned: open.filter((t) => !t.assigned_to).length,
    inProgress: open.filter((t) => t.status === 'in_progress').length,
  }

  const setStatus = async (task: Task, status: TaskStatus) => {
    setError('')
    try {
      await api(`/tasks/${task.id}/`, { method: 'PATCH', body: JSON.stringify({ status }) })
      tasks.reload()
      people.reload()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Couldn’t update that task.')
    }
  }

  const setPersonFilter = (value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set('person', value)
    else next.delete('person')
    next.delete('assign')
    setParams(next)
  }

  if (tasks.loading && !tasks.data) return <p className="loading">Loading tasks…</p>
  if (!tasks.data) return <p className="form__error">Couldn’t load tasks.</p>

  const peopleOptions = (people.data ?? []).map((p) => ({ id: p.id, name: p.name, department: p.department }))

  return (
    <section className="finance staff-manager">
      <div className="page-header">
        <div>
          <h1>Task Management</h1>
          <p className="subtitle">Assign tasks to staff; they show up on that person’s Staff Hub</p>
        </div>
        <button
          type="button"
          className="button"
          onClick={() => setDialog({ task: null, assignee: Number(person) || null })}
        >
          + Assign task
        </button>
      </div>

      <dl className="fin-stats">
        <Stat label="Open" value={stats.open} note={`${stats.inProgress} in progress`} />
        <Stat
          label="Overdue"
          value={stats.overdue}
          alert={stats.overdue > 0}
          note={stats.overdue ? 'Past their due date' : 'All on time'}
        />
        <Stat label="No one assigned" value={stats.unassigned} note="Department-only tasks" />
      </dl>

      <div className="fin-toolbar">
        <div className="segmented" role="group" aria-label="Show">
          {(['open', 'done', 'all'] as Show[]).map((option) => (
            <button key={option} type="button" aria-pressed={show === option} onClick={() => setShow(option)}>
              {option === 'open' ? 'Open' : option === 'done' ? 'Done' : 'All'}
            </button>
          ))}
        </div>
      </div>

      <div className="fin-filters sm-filters" role="search">
        <label className="form__field">
          <span>Search</span>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Task or details"
          />
        </label>
        <label className="form__field">
          <span>Person</span>
          <select value={person} onChange={(e) => setPersonFilter(e.target.value)}>
            <option value="">Everyone</option>
            {peopleOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
            <option value="none">No one assigned</option>
          </select>
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
          </select>
        </label>
        <label className="form__field">
          <span>Priority</span>
          <select value={priority} onChange={(e) => setPriority(e.target.value)}>
            <option value="">Any</option>
            <option value="high">High</option>
            <option value="normal">Normal</option>
            <option value="low">Low</option>
          </select>
        </label>
      </div>

      {error && (
        <p className="form__error" role="alert">
          {error}
        </p>
      )}

      <div className="tile">
        {visible.length === 0 ? (
          <p className="muted">No tasks match.</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table fin-table">
              <thead>
                <tr>
                  <SortHeader sort={sort} column="title">
                    Task
                  </SortHeader>
                  <SortHeader sort={sort} column="who">
                    Assigned to
                  </SortHeader>
                  <SortHeader sort={sort} column="due">
                    Due
                  </SortHeader>
                  <SortHeader sort={sort} column="priority">
                    Priority
                  </SortHeader>
                  <SortHeader sort={sort} column="status">
                    Status
                  </SortHeader>
                  <th>
                    <span className="visually-hidden">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.map((task) => (
                  <tr
                    key={task.id}
                    className={task.is_overdue ? 'is-overdue' : task.status === 'done' ? 'is-inactive' : undefined}
                  >
                    <td data-label="Task">
                      <strong className={task.status === 'done' ? 'sm-done' : undefined}>{task.title}</strong>
                      {task.description && <span className="fin-sub">{task.description}</span>}
                    </td>
                    <td data-label="Assigned to">
                      {task.assigned_to ? (
                        <Link to={`/staff-manager/scheduling?person=${task.assigned_to}`}>{task.assigned_to_name}</Link>
                      ) : (
                        <span className="muted">No one</span>
                      )}
                      {task.department_name && <span className="fin-sub">{task.department_name}</span>}
                    </td>
                    <td data-label="Due" className={task.is_overdue ? 'fin-overdue' : undefined}>
                      {task.due_date
                        ? formatDay(task.due_date, { weekday: 'short', month: 'short', day: 'numeric' })
                        : '—'}
                      {task.is_overdue && <span className="fin-sub">Overdue</span>}
                    </td>
                    <td data-label="Priority">
                      {task.priority === 'high' ? (
                        <span className="badge">High</span>
                      ) : task.priority === 'low' ? (
                        <span className="muted">Low</span>
                      ) : (
                        'Normal'
                      )}
                    </td>
                    <td data-label="Status">
                      <select
                        className="sm-status"
                        value={task.status}
                        onChange={(e) => setStatus(task, e.target.value as TaskStatus)}
                        aria-label={`Status of ${task.title}`}
                      >
                        <option value="todo">To do</option>
                        <option value="in_progress">In progress</option>
                        <option value="done">Done</option>
                      </select>
                    </td>
                    <td className="fin-actions">
                      <button type="button" className="text-button" onClick={() => setDialog({ task, assignee: null })}>
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {dialog && (
        <TaskFormDialog
          task={dialog.task}
          people={peopleOptions}
          departments={departments.data ?? []}
          defaultAssignee={dialog.assignee}
          onClose={() => setDialog(null)}
          onSaved={() => {
            setDialog(null)
            tasks.reload()
            people.reload()
          }}
          onDeleted={() => {
            setDialog(null)
            tasks.reload()
            people.reload()
          }}
        />
      )}
    </section>
  )
}
