import { useMemo, useState } from 'react'
import { api, ApiError } from '../../api'
import { addDays, dayKey, formatDay } from '../../format'
import { useFetch } from '../../hooks/useFetch'
import type { ProductionSettings, Task, TaskPriority, TaskStatus } from '../../types'
import './tasks.css'

type Show = 'open' | 'done'
type Sort = 'due' | 'priority'

const PRIORITY_RANK: Record<TaskPriority, number> = { high: 0, normal: 1, low: 2 }

function byDue(a: Task, b: Task) {
  if (a.due_date !== b.due_date) {
    if (!a.due_date) return 1
    if (!b.due_date) return -1
    return a.due_date.localeCompare(b.due_date)
  }
  return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
}

function byPriority(a: Task, b: Task) {
  return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || byDue(a, b)
}

/** Open tasks grouped by when they're due, relative to the production's today. */
function dueGroups(tasks: Task[], today: string) {
  const tomorrow = addDays(today, 1)
  const weekOut = addDays(today, 7)
  const groups: { title: string; tasks: Task[] }[] = [
    { title: 'Overdue', tasks: [] },
    { title: 'Due today', tasks: [] },
    { title: 'Due tomorrow', tasks: [] },
    { title: 'This week', tasks: [] },
    { title: 'Later', tasks: [] },
    { title: 'No due date', tasks: [] },
  ]
  for (const task of tasks) {
    const due = task.due_date
    const index = !due ? 5 : due < today ? 0 : due === today ? 1 : due === tomorrow ? 2 : due <= weekOut ? 3 : 4
    groups[index].tasks.push(task)
  }
  return groups.filter((group) => group.tasks.length > 0)
}

export function MyTasksPage() {
  const production = useFetch<ProductionSettings>('/production/')
  const tasks = useFetch<Task[]>('/tasks/?mine=1')
  const [show, setShow] = useState<Show>('open')
  const [sort, setSort] = useState<Sort>('due')
  const [saving, setSaving] = useState<number | null>(null)
  const [error, setError] = useState('')
  // Status changes show at once; the server's copy replaces them when it answers.
  const [local, setLocal] = useState<Record<number, Task>>({})

  const all = useMemo(() => (tasks.data ?? []).map((task) => local[task.id] ?? task), [tasks.data, local])
  const open = all.filter((task) => task.status !== 'done')
  const done = all
    .filter((task) => task.status === 'done')
    .sort((a, b) => (b.completed_at ?? '').localeCompare(a.completed_at ?? ''))
  const overdue = open.filter((task) => task.is_overdue).length
  const today = production.data?.today

  const setStatus = async (task: Task, status: TaskStatus) => {
    setSaving(task.id)
    setError('')
    const completedAt = status === 'done' ? new Date().toISOString() : null
    setLocal((prev) => ({ ...prev, [task.id]: { ...task, status, completed_at: completedAt } }))
    try {
      const saved = await api<Task>(`/tasks/${task.id}/`, { method: 'PATCH', body: JSON.stringify({ status }) })
      setLocal((prev) => ({ ...prev, [task.id]: saved }))
    } catch (err) {
      setLocal(({ [task.id]: _undone, ...rest }) => rest)
      setError(err instanceof ApiError ? err.message : 'Couldn’t update that task.')
    } finally {
      setSaving(null)
    }
  }

  if (tasks.loading && !tasks.data) return <p className="loading">Loading your tasks…</p>
  if (!tasks.data) return <p className="form__error">Couldn’t load your tasks.</p>

  const sorted = [...open].sort(sort === 'due' ? byDue : byPriority)
  const groups =
    show === 'done'
      ? [{ title: 'Completed', tasks: done }]
      : sort === 'due' && today
        ? dueGroups(sorted, today)
        : [{ title: 'Open', tasks: sorted }]

  return (
    <section className="my-tasks">
      <div className="page-header">
        <div>
          <h1>My Tasks</h1>
          <p className="subtitle">
            {open.length} open{overdue > 0 ? ` · ${overdue} overdue` : ''} · {done.length} done
          </p>
        </div>
      </div>

      <div className="my-tasks__controls">
        <div className="segmented" role="group" aria-label="Show">
          <button type="button" aria-pressed={show === 'open'} onClick={() => setShow('open')}>
            Open <span className="segmented__count">{open.length}</span>
          </button>
          <button type="button" aria-pressed={show === 'done'} onClick={() => setShow('done')}>
            Completed <span className="segmented__count">{done.length}</span>
          </button>
        </div>
        {show === 'open' && (
          <label className="form__field my-tasks__sort">
            <span>Sort by</span>
            <select value={sort} onChange={(event) => setSort(event.target.value as Sort)}>
              <option value="due">Due date</option>
              <option value="priority">Priority</option>
            </select>
          </label>
        )}
      </div>

      {error && (
        <p className="form__error" role="alert">
          {error}
        </p>
      )}

      {groups.every((group) => group.tasks.length === 0) ? (
        <div className="tile">
          <p className="muted">
            {show === 'open' ? 'You’re all caught up. No open tasks.' : 'No completed tasks yet.'}
          </p>
        </div>
      ) : (
        groups.map((group) => (
          <section
            key={group.title}
            className={`tile my-tasks__group${group.title === 'Overdue' ? ' my-tasks__group--overdue' : ''}`}
            aria-label={group.title}
          >
            <h2>
              {group.title} <span className="my-tasks__group-count">{group.tasks.length}</span>
            </h2>
            <ul className="my-task-list">
              {group.tasks.map((task) => (
                <TaskItem
                  key={task.id}
                  task={task}
                  timeZone={production.data?.time_zone ?? 'UTC'}
                  busy={saving === task.id}
                  onStatus={setStatus}
                />
              ))}
            </ul>
          </section>
        ))
      )}
    </section>
  )
}

interface TaskItemProps {
  task: Task
  timeZone: string
  busy: boolean
  onStatus: (task: Task, status: TaskStatus) => void
}

function TaskItem({ task, timeZone, busy, onStatus }: TaskItemProps) {
  const isDone = task.status === 'done'
  const details = [
    task.department_name,
    task.created_by_name && `Assigned by ${task.created_by_name}`,
  ].filter(Boolean)

  return (
    <li className={`my-task${isDone ? ' is-done' : ''}${task.priority === 'high' && !isDone ? ' is-high' : ''}`}>
      <input
        type="checkbox"
        className="my-task__check"
        checked={isDone}
        disabled={busy}
        onChange={() => onStatus(task, isDone ? 'todo' : 'done')}
        aria-label={isDone ? `Reopen “${task.title}”` : `Mark “${task.title}” done`}
      />
      <div className="my-task__body">
        <div className="my-task__head">
          <span className="my-task__title">{task.title}</span>
          {task.status === 'in_progress' && <span className="badge badge--muted">In progress</span>}
          {task.priority === 'high' && !isDone && <span className="badge">High priority</span>}
          {task.priority === 'low' && !isDone && <span className="badge badge--muted">Low priority</span>}
        </div>
        {task.description && <p className="my-task__description">{task.description}</p>}
        <p className="my-task__meta">
          {isDone && task.completed_at ? (
            <span>Done {formatDay(dayKey(task.completed_at, timeZone), { month: 'short', day: 'numeric' })}</span>
          ) : (
            task.due_date && (
              <span className={task.is_overdue ? 'my-task__due is-overdue' : 'my-task__due'}>
                {task.is_overdue ? 'Overdue · was due ' : 'Due '}
                {formatDay(task.due_date, { weekday: 'short', month: 'short', day: 'numeric' })}
              </span>
            )
          )}
          {details.map((detail) => (
            <span key={detail as string}>{detail}</span>
          ))}
        </p>
      </div>
      {!isDone && (
        <button
          type="button"
          className="text-button my-task__action"
          disabled={busy}
          onClick={() => onStatus(task, task.status === 'todo' ? 'in_progress' : 'todo')}
        >
          {task.status === 'todo' ? 'Start' : 'Not started'}
        </button>
      )}
    </li>
  )
}
