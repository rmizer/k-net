import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api'
import { formatDay } from '../../format'
import type { StaffTaskSummary, Task } from '../../types'
import { DashboardSection } from './DashboardSection'

function DueDate({ task }: { task: Task }) {
  if (!task.due_date) return null
  return (
    <span className={`task__due${task.is_overdue ? ' is-overdue' : ''}`}>
      {task.is_overdue ? 'Overdue · ' : 'Due '}
      {formatDay(task.due_date, { month: 'short', day: 'numeric' })}
    </span>
  )
}

function PriorityBadge({ task }: { task: Task }) {
  if (task.priority !== 'high') return null
  return <span className="badge">High priority</span>
}

export function YourTasks({ tasks, onChange }: { tasks: Task[]; onChange: () => void }) {
  const [saving, setSaving] = useState<number | null>(null)

  const complete = async (task: Task) => {
    setSaving(task.id)
    try {
      await api(`/tasks/${task.id}/`, { method: 'PATCH', body: JSON.stringify({ status: 'done' }) })
      onChange()
    } finally {
      setSaving(null)
    }
  }

  return (
    <DashboardSection title="Your Tasks" action={<Link to="/schedule/tasks">All my tasks</Link>}>
      <div className="tile">
        {tasks.length === 0 ? (
          <p className="muted">You're all caught up.</p>
        ) : (
          <ul className="task-list">
            {tasks.map((task) => (
              <li key={task.id} className="task">
                <label className="task__check">
                  <input
                    type="checkbox"
                    disabled={saving === task.id}
                    onChange={() => complete(task)}
                    aria-label={`Mark “${task.title}” done`}
                  />
                  <span className="task__title">{task.title}</span>
                </label>
                <span className="task__meta">
                  {task.status === 'in_progress' && <span className="badge badge--muted">In progress</span>}
                  <PriorityBadge task={task} />
                  <DueDate task={task} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </DashboardSection>
  )
}

export function StaffTasks({ summary }: { summary: StaffTaskSummary }) {
  const stats = [
    { label: 'To do', value: summary.counts.todo },
    { label: 'In progress', value: summary.counts.in_progress },
    { label: 'Overdue', value: summary.counts.overdue, alert: summary.counts.overdue > 0 },
    { label: 'Done', value: summary.counts.done },
  ]

  return (
    <DashboardSection title="Staff Tasks" action={<Link to="/staff-manager/tasks">Manage tasks</Link>}>
      <div className="tile">
        <dl className="stats">
          {stats.map((stat) => (
            <div key={stat.label} className={`stat${stat.alert ? ' stat--alert' : ''}`}>
              <dt>{stat.label}</dt>
              <dd>{stat.value}</dd>
            </div>
          ))}
        </dl>
        {summary.open.length > 0 && (
          <>
            <h3 className="tile__subheading">Open tasks</h3>
            <ul className="task-list">
              {summary.open.map((task) => (
                <li key={task.id} className="task">
                  <span className="task__title">{task.title}</span>
                  <span className="task__meta">
                    <span className="task__who">
                      {task.assigned_to_name || 'Unassigned'}
                      {task.department_name ? ` · ${task.department_name}` : ''}
                    </span>
                    <PriorityBadge task={task} />
                    <DueDate task={task} />
                  </span>
                </li>
              ))}
            </ul>
            {summary.open_total > summary.open.length && (
              <p className="muted tile__footnote">
                Showing {summary.open.length} of {summary.open_total} open tasks.
              </p>
            )}
          </>
        )}
      </div>
    </DashboardSection>
  )
}
