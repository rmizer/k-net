import { useEffect, useRef, useState, type FormEvent } from 'react'
import { api, ApiError, fieldErrors } from '../api'
import type { Department, Task, TaskPriority, TaskStatus } from '../types'

interface Person {
  id: number
  name: string
  department: number | null
}

interface TaskFormDialogProps {
  /** The task being edited, or null to assign a new one. */
  task: Task | null
  people: Person[]
  departments: Department[]
  /** Pre-select someone for a new task. */
  defaultAssignee?: number | null
  onSaved: (saved: Task) => void
  onDeleted?: () => void
  onClose: () => void
}

export function TaskFormDialog(props: TaskFormDialogProps) {
  const { task, people, departments, defaultAssignee = null, onSaved, onDeleted, onClose } = props
  const dialogRef = useRef<HTMLDialogElement>(null)
  const defaultPerson = people.find((p) => p.id === defaultAssignee)
  const [form, setForm] = useState({
    title: task?.title ?? '',
    description: task?.description ?? '',
    assigned_to: task ? (task.assigned_to?.toString() ?? '') : (defaultAssignee?.toString() ?? ''),
    department: task ? (task.department?.toString() ?? '') : (defaultPerson?.department?.toString() ?? ''),
    due_date: task?.due_date ?? '',
    priority: (task?.priority ?? 'normal') as TaskPriority,
    status: (task?.status ?? 'todo') as TaskStatus,
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    dialogRef.current?.showModal()
  }, [])

  const set = (name: keyof typeof form, value: string) => setForm({ ...form, [name]: value })

  // Picking a person fills in their department (it can still be changed).
  const choosePerson = (value: string) => {
    const person = people.find((p) => String(p.id) === value)
    setForm({
      ...form,
      assigned_to: value,
      department: person?.department ? String(person.department) : form.department,
    })
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setErrors({})
    try {
      const saved = await api<Task>(task ? `/tasks/${task.id}/` : '/tasks/', {
        method: task ? 'PATCH' : 'POST',
        body: JSON.stringify({
          ...form,
          assigned_to: form.assigned_to ? Number(form.assigned_to) : null,
          department: form.department ? Number(form.department) : null,
          due_date: form.due_date || null,
        }),
      })
      onSaved(saved)
    } catch (err) {
      const fields = fieldErrors(err)
      setErrors(
        Object.keys(fields).length ? fields : { form: err instanceof ApiError ? err.message : 'Could not save.' },
      )
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!task || !window.confirm(`Delete “${task.title}”? It will disappear from everyone’s task list.`)) return
    await api(`/tasks/${task.id}/`, { method: 'DELETE' })
    onDeleted?.()
  }

  const error = (name: string) => errors[name] && <small className="form__field-error">{errors[name]}</small>

  return (
    <dialog ref={dialogRef} className="dialog" onClose={onClose} aria-labelledby="task-form-title">
      <form className="form" onSubmit={submit} noValidate>
        <div className="dialog__header">
          <h2 id="task-form-title">{task ? 'Edit task' : 'Assign a task'}</h2>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        {errors.form && (
          <p className="form__error" role="alert">
            {errors.form}
          </p>
        )}

        <label className="form__field">
          <span>
            Task<span aria-hidden="true"> *</span>
          </span>
          <input
            value={form.title}
            onChange={(e) => set('title', e.target.value)}
            placeholder="e.g. Label cable runs for Stage B"
            aria-invalid={!!errors.title}
            autoComplete="off"
            required
          />
          {error('title')}
        </label>

        <div className="form__grid">
          <label className="form__field">
            <span>Assign to</span>
            <select
              value={form.assigned_to}
              onChange={(e) => choosePerson(e.target.value)}
              aria-invalid={!!errors.assigned_to}
            >
              <option value="">No one person</option>
              {people.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name}
                </option>
              ))}
            </select>
            {error('assigned_to')}
          </label>
          <label className="form__field">
            <span>Department</span>
            <select value={form.department} onChange={(e) => set('department', e.target.value)}>
              <option value="">None</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </select>
          </label>
          <label className="form__field">
            <span>Due</span>
            <input type="date" value={form.due_date} onChange={(e) => set('due_date', e.target.value)} />
            {error('due_date')}
          </label>
          <label className="form__field">
            <span>Priority</span>
            <select value={form.priority} onChange={(e) => set('priority', e.target.value)}>
              <option value="high">High</option>
              <option value="normal">Normal</option>
              <option value="low">Low</option>
            </select>
          </label>
          {task && (
            <label className="form__field">
              <span>Status</span>
              <select value={form.status} onChange={(e) => set('status', e.target.value)}>
                <option value="todo">To do</option>
                <option value="in_progress">In progress</option>
                <option value="done">Done</option>
              </select>
            </label>
          )}
        </div>

        <label className="form__field">
          <span>Details</span>
          <textarea rows={3} value={form.description} onChange={(e) => set('description', e.target.value)} />
        </label>
        <p className="form__hint">
          Tasks assigned to a person show on their Staff Hub and in My Tasks. Department-only tasks stay here in Task
          Management until someone is assigned.
        </p>

        <div className="inline-form__actions">
          <button type="submit" className="button" disabled={saving}>
            {saving ? 'Saving…' : task ? 'Save changes' : 'Assign task'}
          </button>
          <button type="button" className="button button--secondary" onClick={onClose}>
            Cancel
          </button>
          {task && onDeleted && (
            <button type="button" className="text-button text-button--danger" onClick={remove}>
              Delete task
            </button>
          )}
        </div>
      </form>
    </dialog>
  )
}
