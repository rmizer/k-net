import { useId, useState } from 'react'

export interface DualListOption {
  id: number
  label: string
}

interface DualListBoxProps {
  label: string
  availableLabel: string
  chosenLabel: string
  options: DualListOption[]
  /** The saved list. */
  value: number[]
  /** Saves the list; may be async (e.g. straight to the server). */
  onSave?: (ids: number[]) => void | Promise<void>
  /** Inside a larger form: told about every move, and there's no Save button of its own. */
  onChange?: (ids: number[]) => void
  /** Told whenever the list has moves that haven't been saved. */
  onDirtyChange?: (dirty: boolean) => void
  saveLabel?: string
  error?: string
}

const sameIds = (a: number[], b: number[]) => a.length === b.length && a.every((id) => b.includes(id))

/** Two scrolling lists with arrow buttons to move people between them, and a
 *  Save button that commits the chosen list. */
export function DualListBox({
  label,
  availableLabel,
  chosenLabel,
  options,
  value,
  onSave,
  onChange,
  onDirtyChange,
  saveLabel = 'Save list',
  error,
}: DualListBoxProps) {
  const id = useId()
  const [chosen, setChosen] = useState<number[]>(value)
  const [leftPicked, setLeftPicked] = useState<number[]>([])
  const [rightPicked, setRightPicked] = useState<number[]>([])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const known = new Set(options.map((option) => option.id))
  const chosenIds = chosen.filter((optionId) => known.has(optionId))
  const dirty = !sameIds(chosenIds, value.filter((optionId) => known.has(optionId)))
  const available = options.filter((option) => !chosenIds.includes(option.id))
  const chosenOptions = chosenIds
    .map((optionId) => options.find((option) => option.id === optionId))
    .filter((option): option is DualListOption => !!option)

  const update = (next: number[]) => {
    setChosen(next)
    setSaved(false)
    onChange?.(next)
    onDirtyChange?.(!sameIds(next, value))
  }

  const moveRight = () => {
    update([...chosenIds, ...leftPicked.filter((optionId) => !chosenIds.includes(optionId))])
    setLeftPicked([])
  }

  const moveLeft = () => {
    update(chosenIds.filter((optionId) => !rightPicked.includes(optionId)))
    setRightPicked([])
  }

  const save = async () => {
    setSaving(true)
    try {
      await onSave?.(chosenIds)
      setSaved(true)
      onDirtyChange?.(false)
    } finally {
      setSaving(false)
    }
  }

  const picked = (select: HTMLSelectElement) => Array.from(select.selectedOptions, (option) => Number(option.value))

  return (
    <fieldset className="dual-list">
      <legend>{label}</legend>
      <div className="dual-list__columns">
        <label className="dual-list__box" htmlFor={`${id}-available`}>
          <span>
            {availableLabel} ({available.length})
          </span>
          <select
            id={`${id}-available`}
            multiple
            size={7}
            value={leftPicked.map(String)}
            onChange={(event) => setLeftPicked(picked(event.target))}
            onDoubleClick={moveRight}
          >
            {available.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <div className="dual-list__arrows">
          <button
            type="button"
            className="button button--secondary"
            onClick={moveRight}
            disabled={!leftPicked.length}
            aria-label={`Add to ${chosenLabel}`}
            title={`Add to ${chosenLabel}`}
          >
            →
          </button>
          <button
            type="button"
            className="button button--secondary"
            onClick={moveLeft}
            disabled={!rightPicked.length}
            aria-label={`Remove from ${chosenLabel}`}
            title={`Remove from ${chosenLabel}`}
          >
            ←
          </button>
        </div>

        <label className="dual-list__box" htmlFor={`${id}-chosen`}>
          <span>
            {chosenLabel} ({chosenOptions.length})
          </span>
          <select
            id={`${id}-chosen`}
            multiple
            size={7}
            value={rightPicked.map(String)}
            onChange={(event) => setRightPicked(picked(event.target))}
            onDoubleClick={moveLeft}
          >
            {chosenOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {!onChange && (
        <div className="dual-list__footer">
          <button type="button" className="button" onClick={save} disabled={!dirty || saving}>
            {saving ? 'Saving…' : saveLabel}
          </button>
          <span className="dual-list__status" role="status">
            {dirty ? 'Unsaved changes' : saved ? 'Saved' : ''}
          </span>
        </div>
      )}
      {error && <small className="form__field-error">{error}</small>}
    </fieldset>
  )
}
