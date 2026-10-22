import { useMemo, useState, type ReactNode } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { api, ApiError } from '../../api'
import { canSeeDepartmentPage, DEPARTMENT_PAGES, isManagerLevel } from '../../auth/roles'
import { useAuth } from '../../auth/useAuth'
import { Avatar } from '../../components/Avatar'
import { eventWhen } from '../../components/schedule/GanttChart'
import { TaskFormDialog } from '../../components/TaskFormDialog'
import { addDays, eventDays, formatDay } from '../../format'
import { useFetch } from '../../hooks/useFetch'
import type { CalendarEvent, DepartmentPageData, PagePerson, ProductionSettings, Task } from '../../types'
import { ForbiddenPage } from '../ForbiddenPage'
import { MarketingLinks } from '../marketing/MarketingLinks'
import { MonthCalendar, monthGrid } from '../schedule/MonthCalendar'
import { CulinaryNav } from './culinary/CulinaryNav'
import './departments.css'

/** Events API path for whole days on one department page (padded a day each side,
 *  since days are in the production's time zone). */
function departmentEventsPath(slug: string, first: string, last: string) {
  return `/events/?department_page=${slug}&start=${addDays(first, -1)}T00:00:00Z&end=${addDays(last, 2)}T00:00:00Z`
}

const byStart = (a: CalendarEvent, b: CalendarEvent) =>
  a.all_day !== b.all_day ? (a.all_day ? -1 : 1) : a.start.localeCompare(b.start) || a.title.localeCompare(b.title)

/** A department's page (Departments menu): its heads, schedule, crew and tasks. */
export function DepartmentPage() {
  const { slug = '' } = useParams()
  const { user } = useAuth()
  const production = useFetch<ProductionSettings>('/production/')
  const page = DEPARTMENT_PAGES.find((candidate) => candidate.slug === slug)

  if (!page) {
    return (
      <section>
        <h1>Department not found</h1>
        <Link to="/departments">Back to Departments</Link>
      </section>
    )
  }
  if (!canSeeDepartmentPage(user, slug)) return <ForbiddenPage />
  if (!production.data) {
    if (production.loading) return <p className="loading">Loading…</p>
    return <p className="form__error">Couldn’t load the page.</p>
  }
  return (
    <DepartmentView key={slug} slug={slug} today={production.data.today} timeZone={production.data.time_zone} />
  )
}

/** /departments: your own department's page, or the first one you can see. */
export function DepartmentsIndex() {
  const { user } = useAuth()
  const own = DEPARTMENT_PAGES.find((page) => page.slug === user?.department_page && canSeeDepartmentPage(user, page.slug))
  const first = own ?? DEPARTMENT_PAGES.find((page) => canSeeDepartmentPage(user, page.slug))
  if (!first) return <ForbiddenPage />
  return <Navigate to={`/departments/${first.slug}`} replace />
}

interface ViewProps {
  slug: string
  today: string
  timeZone: string
}

function DepartmentView({ slug, today, timeZone }: ViewProps) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const data = useFetch<DepartmentPageData>(`/department-pages/${slug}/`)
  const [month, setMonth] = useState(today.slice(0, 7))
  const grid = monthGrid(month)
  const monthEvents = useFetch<CalendarEvent[]>(departmentEventsPath(slug, grid[0], grid[grid.length - 1]))
  const weekEvents = useFetch<CalendarEvent[]>(departmentEventsPath(slug, today, addDays(today, 6)))
  // A new task (null) or one being edited; undefined while the dialog is closed.
  const [editing, setEditing] = useState<{ task: Task | null; person: number | null } | undefined>(undefined)
  const [error, setError] = useState('')

  if (data.loading && !data.data) return <p className="loading">Loading the department…</p>
  if (!data.data) {
    if (data.error instanceof ApiError && data.error.status === 403) return <ForbiddenPage />
    return <p className="form__error">Couldn’t load this department.</p>
  }
  const page = data.data
  const manager = isManagerLevel(user)

  /** Heads manage their department's staff tasks, and the tasks they gave themselves. */
  const canManage = (task: Task) =>
    manager || (page.can_edit && (task.assigned_to !== user?.id || task.created_by === user?.id))
  const canCheck = (task: Task) =>
    canManage(task) || task.assigned_to === user?.id || (task.assigned_to === null && page.departments.some((d) => d.id === user?.department))

  const toggle = async (task: Task) => {
    setError('')
    try {
      await api(`/tasks/${task.id}/`, {
        method: 'PATCH',
        body: JSON.stringify({ status: task.status === 'done' ? 'todo' : 'done' }),
      })
      data.reload()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Couldn’t update that task.')
    }
  }

  const people = page.crew.map((person) => ({ id: person.id, name: person.name, department: person.department }))

  return (
    <section className="department">
      <div className="page-header">
        <div>
          <h1>{page.label}</h1>
          <p className="subtitle">
            {page.departments.length > 1 ? page.departments.map((d) => d.name).join(' & ') : 'Department page'}
            {page.can_edit ? '' : ' · View only'}
          </p>
        </div>
      </div>

      {slug === 'culinary' && <CulinaryNav />}

      <HeadBanners heads={page.heads} />

      <section className="department__section" aria-labelledby="department-calendar">
        <h2 id="department-calendar" className="department__heading">
          {page.label} schedule
        </h2>
        <MonthCalendar
          month={month}
          events={monthEvents.data ?? []}
          today={today}
          selectedDay={today}
          timeZone={timeZone}
          loading={monthEvents.loading}
          onSelectDay={(day) => navigate(`/schedule?date=${day}`)}
          onMonthChange={setMonth}
        />
        <p className="form__hint">Pick a day to open it in the Master Schedule.</p>
      </section>

      {error && (
        <p className="form__error" role="alert">
          {error}
        </p>
      )}

      {page.head_tasks && (
        <section className="tile department__head-tasks" aria-labelledby="head-tasks">
          <div className="department__tile-header">
            <h2 id="head-tasks">{page.is_head && !manager ? 'Your department head tasks' : 'Department head tasks'}</h2>
            {(manager || page.is_head) && (
              <button
                type="button"
                className="text-button"
                onClick={() =>
                  setEditing({ task: null, person: page.is_head && !manager ? (user?.id ?? null) : (page.heads[0]?.id ?? null) })
                }
                disabled={!page.heads.length}
              >
                + Add task
              </button>
            )}
          </div>
          <p className="muted department__private">Only the department head{manager ? 's and managers' : ''} can see these.</p>
          <TaskGroups
            tasks={page.head_tasks}
            people={page.heads}
            showPeople={manager && page.heads.length > 1}
            empty={page.heads.length ? 'No head tasks right now.' : 'This department has no head yet.'}
            canManage={canManage}
            canCheck={canCheck}
            onToggle={toggle}
            onEdit={(task) => setEditing({ task, person: null })}
          />
        </section>
      )}

      <div className="department__tiles">
        <section className="tile department__tile" aria-labelledby="department-crew">
          <div className="department__tile-header">
            <h2 id="department-crew">Crew</h2>
            <span className="department__count">{page.crew.length}</span>
          </div>
          <CrewList crew={page.crew} />
        </section>

        <section className="tile department__tile" aria-labelledby="department-week">
          <div className="department__tile-header">
            <h2 id="department-week">Next 7 days</h2>
            <Link to="/schedule" className="text-button">
              Master Schedule
            </Link>
          </div>
          <WeekSchedule events={weekEvents.data} today={today} timeZone={timeZone} />
        </section>

        <section className="tile department__tile" aria-labelledby="department-tasks">
          <div className="department__tile-header">
            <h2 id="department-tasks">Staff tasks</h2>
            {page.can_edit && (
              <button type="button" className="text-button" onClick={() => setEditing({ task: null, person: null })}>
                + Assign task
              </button>
            )}
          </div>
          <TaskGroups
            tasks={page.staff_tasks}
            people={page.crew.filter((person) => !person.is_head)}
            showPeople
            empty="No staff tasks right now."
            canManage={canManage}
            canCheck={canCheck}
            onToggle={toggle}
            onEdit={(task) => setEditing({ task, person: null })}
          />
        </section>
      </div>

      {slug === 'marketing' && (
        <section className="department__section" aria-labelledby="marketing-links">
          <h2 id="marketing-links" className="department__heading">
            Website and social media
          </h2>
          <MarketingLinks />
        </section>
      )}

      {editing && (
        <TaskFormDialog
          task={editing.task}
          people={people}
          departments={page.departments}
          defaultAssignee={editing.person}
          onClose={() => setEditing(undefined)}
          onSaved={() => {
            setEditing(undefined)
            data.reload()
          }}
          onDeleted={() => {
            setEditing(undefined)
            data.reload()
          }}
        />
      )}
    </section>
  )
}

function HeadBanners({ heads }: { heads: PagePerson[] }) {
  if (!heads.length) return null
  return (
    <div className="department__heads">
      {heads.map((head) => (
        <article key={head.id} className="department-head" aria-label={`Department head: ${head.name}`}>
          <Avatar person={head} size={64} />
          <div className="department-head__who">
            <p className="department-head__eyebrow">Department head</p>
            <h2 className="department-head__name">{head.name}</h2>
            {head.title && <p className="department-head__title">{head.title}</p>}
          </div>
          <div className="department-head__contact">
            {head.phone && (
              <a href={`tel:${head.phone}`} className="department-head__link">
                {head.phone}
              </a>
            )}
            {head.email && !head.email.endsWith('@example.com') && (
              <a href={`mailto:${head.email}`} className="department-head__link">
                {head.email}
              </a>
            )}
          </div>
        </article>
      ))}
    </div>
  )
}

function CrewList({ crew }: { crew: PagePerson[] }) {
  if (!crew.length) return <p className="muted">No one is in this department yet.</p>
  return (
    <ul className="department-crew">
      {crew.map((person) => (
        <li key={person.id} className="department-crew__person">
          <Avatar person={person} size={36} />
          <span className="department-crew__who">
            <span className="department-crew__name">
              {person.name}
              {person.is_head && <span className="badge">Head</span>}
            </span>
            <span className="department-crew__meta">{person.title || person.role_display}</span>
            {person.phone && (
              <a href={`tel:${person.phone}`} className="department-crew__meta">
                {person.phone}
              </a>
            )}
          </span>
        </li>
      ))}
    </ul>
  )
}

function WeekSchedule({ events, today, timeZone }: { events?: CalendarEvent[]; today: string; timeZone: string }) {
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(today, i)), [today])
  if (!events) return <p className="loading">Loading…</p>
  const byDay = days.map((day) => ({
    day,
    events: events.filter((event) => eventDays(event.start, event.end, timeZone).includes(day)).sort(byStart),
  }))
  if (byDay.every((entry) => !entry.events.length)) return <p className="muted">Nothing scheduled this week.</p>
  return (
    <ol className="department-week">
      {byDay.map(({ day, events: dayEvents }) => (
        <li key={day} className="department-week__day">
          <h3>{day === today ? 'Today' : formatDay(day, { weekday: 'long', month: 'short', day: 'numeric' })}</h3>
          {dayEvents.length ? (
            <ul>
              {dayEvents.map((event) => (
                <li key={event.id}>
                  <span className="department-week__time">{eventWhen(event, timeZone)}</span>
                  <Link to={`/schedule?date=${day}&event=${event.id}`}>{event.title}</Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">Nothing scheduled</p>
          )}
        </li>
      ))}
    </ol>
  )
}

interface TaskGroupsProps {
  tasks: Task[]
  people: PagePerson[]
  /** Group by person (with a "Whole department" group for tasks without one). */
  showPeople: boolean
  empty: string
  canManage: (task: Task) => boolean
  canCheck: (task: Task) => boolean
  onToggle: (task: Task) => void
  onEdit: (task: Task) => void
}

function TaskGroups({ tasks, people, showPeople, empty, ...rowProps }: TaskGroupsProps) {
  if (!tasks.length) return <p className="muted">{empty}</p>
  if (!showPeople) return <TaskRows tasks={tasks} {...rowProps} />
  const groups: { key: string; label: ReactNode; tasks: Task[] }[] = people
    .map((person) => ({
      key: String(person.id),
      label: person.name,
      tasks: tasks.filter((task) => task.assigned_to === person.id),
    }))
    .filter((group) => group.tasks.length)
  const known = new Set(people.map((person) => person.id))
  const whole = tasks.filter((task) => task.assigned_to === null)
  const others = tasks.filter((task) => task.assigned_to !== null && !known.has(task.assigned_to))
  if (whole.length) groups.push({ key: 'whole', label: 'Whole department', tasks: whole })
  if (others.length) groups.push({ key: 'others', label: 'Others', tasks: others })
  return (
    <div className="department-tasks">
      {groups.map((group) => (
        <div key={group.key} className="department-tasks__group">
          <h3>
            {group.label} <span className="department__count">{group.tasks.length}</span>
          </h3>
          <TaskRows tasks={group.tasks} {...rowProps} />
        </div>
      ))}
    </div>
  )
}

type TaskRowsProps = Pick<TaskGroupsProps, 'tasks' | 'canManage' | 'canCheck' | 'onToggle' | 'onEdit'>

function TaskRows({ tasks, canManage, canCheck, onToggle, onEdit }: TaskRowsProps) {
  return (
    <ul className="department-task-list">
      {tasks.map((task) => {
        const done = task.status === 'done'
        return (
          <li key={task.id} className={`department-task${done ? ' is-done' : ''}`}>
            {canCheck(task) ? (
              <input
                type="checkbox"
                checked={done}
                onChange={() => onToggle(task)}
                aria-label={done ? `Reopen “${task.title}”` : `Mark “${task.title}” done`}
              />
            ) : (
              <span className="department-task__dot" aria-hidden="true" />
            )}
            <span className="department-task__body">
              <span className="department-task__title">
                {task.title}
                {task.priority === 'high' && !done && <span className="badge">High</span>}
                {task.status === 'in_progress' && <span className="badge badge--muted">In progress</span>}
              </span>
              {(task.due_date || task.created_by_name) && (
                <span className={`department-task__meta${task.is_overdue ? ' is-overdue' : ''}`}>
                  {[
                    task.due_date &&
                      `${task.is_overdue ? 'Overdue · ' : 'Due '}${formatDay(task.due_date, { month: 'short', day: 'numeric' })}`,
                    task.created_by_name && `from ${task.created_by_name}`,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              )}
            </span>
            {canManage(task) && (
              <button type="button" className="text-button department-task__edit" onClick={() => onEdit(task)}>
                Edit
              </button>
            )}
          </li>
        )
      })}
    </ul>
  )
}

