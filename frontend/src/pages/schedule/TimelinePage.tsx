import { useState, type CSSProperties } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../../api'
import { isManagerLevel } from '../../auth/roles'
import { useAuth } from '../../auth/useAuth'
import { addDays, formatDay } from '../../format'
import { useFetch } from '../../hooks/useFetch'
import type { ProductionSettings, TimelineItem } from '../../types'
import { TimelineFormDialog } from './TimelineFormDialog'
import { NavIcon } from '../../components/NavIcon'
import '../../components/schedule/schedule.css'
import './timeline.css'

const DAY_MS = 24 * 60 * 60 * 1000

/** Days since the epoch for a "YYYY-MM-DD" date. */
function dayNumber(day: string) {
  return Date.parse(`${day}T00:00:00Z`) / DAY_MS
}

function weekday(day: string) {
  return (new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7 // Monday = 0
}

const isMilestone = (item: TimelineItem) => item.start_date === item.end_date

function itemDates(item: TimelineItem) {
  if (isMilestone(item)) return formatDay(item.start_date, { weekday: 'short', month: 'short', day: 'numeric' })
  const days = dayNumber(item.end_date) - dayNumber(item.start_date) + 1
  const start = formatDay(item.start_date, { month: 'short', day: 'numeric' })
  const end = formatDay(item.end_date, { month: 'short', day: 'numeric' })
  return `${start} – ${end} · ${days} days`
}

function itemState(item: TimelineItem, today: string) {
  if (item.end_date < today) return 'done'
  if (item.start_date <= today) return 'current'
  return 'upcoming'
}

export function TimelinePage() {
  const production = useFetch<ProductionSettings>('/production/')
  const timeline = useFetch<TimelineItem[]>('/timeline/')
  const { user } = useAuth()
  const manager = isManagerLevel(user)
  const [params, setParams] = useSearchParams()
  const [dialog, setDialog] = useState<TimelineItem | null | undefined>(undefined)

  if ((timeline.loading && !timeline.data) || (production.loading && !production.data)) {
    return <p className="loading">Loading timeline…</p>
  }
  if (!timeline.data || !production.data) return <p className="form__error">Couldn’t load the timeline.</p>

  const today = production.data.today
  const items = timeline.data
  const selectedId = Number(params.get('item')) || null
  const selected = items.find((item) => item.id === selectedId)
  const itemHref = (item: TimelineItem) => (item.id === selectedId ? '?' : `?item=${item.id}`)

  // Whole weeks (Monday to Monday) covering every item and today.
  const firstDay = items.reduce((min, item) => (item.start_date < min ? item.start_date : min), today)
  const lastDay = items.reduce((max, item) => (item.end_date > max ? item.end_date : max), today)
  const rangeStart = addDays(firstDay, -weekday(firstDay))
  const rangeEnd = addDays(lastDay, 7 - weekday(lastDay)) // The Monday after the last day.
  const totalDays = dayNumber(rangeEnd) - dayNumber(rangeStart)
  const position = (day: string) => ((dayNumber(day) - dayNumber(rangeStart)) / totalDays) * 100
  const halfDay = 50 / totalDays

  const weeks = Array.from({ length: totalDays / 7 }, (_, i) => addDays(rangeStart, i * 7))
  // Month labels at each 1st; the first, partial month is labeled only if there's room.
  const months: string[] = []
  for (let day = `${rangeStart.slice(0, 8)}01`; ; ) {
    const [year, month] = day.split('-').map(Number)
    day = new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10)
    if (day >= rangeEnd) break
    months.push(day)
  }
  if (!months.length || dayNumber(months[0]) - dayNumber(rangeStart) >= 14) months.unshift(rangeStart)

  const remove = async (item: TimelineItem) => {
    if (!window.confirm(`Remove “${item.name}” from the timeline?`)) return
    await api(`/timeline/${item.id}/`, { method: 'DELETE' })
    setParams({})
    timeline.reload()
  }

  return (
    <section className="timeline-page">
      <div className="page-header">
        <div>
          <h1>
            <NavIcon name="timeline" />
            Master Timeline
          </h1>
          <p className="subtitle">
            {items.length
              ? `${formatDay(firstDay, { month: 'short', day: 'numeric' })} – ${formatDay(lastDay, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })} · ${items.length} items`
              : 'The whole project at a glance'}
          </p>
        </div>
        {manager && (
          <button type="button" className="button" onClick={() => setDialog(null)}>
            + Add to timeline
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="tile">
          <p className="muted">
            Nothing on the timeline yet.{manager ? ' Add the project’s phases and milestones to get started.' : ''}
          </p>
        </div>
      ) : (
        <div className="tile">
          <div
            className="timeline"
            style={{ '--timeline-today': `${position(today) + halfDay}%` } as CSSProperties}
          >
            <div className="timeline__row timeline__row--axis" aria-hidden="true">
              <span />
              <div className="timeline__track">
                {months.map((month) => (
                  <span key={month} className="timeline__month" style={{ left: `${position(month)}%` }}>
                    {formatDay(month, month.endsWith('-01') ? { month: 'short' } : { month: 'short', day: 'numeric' })}
                  </span>
                ))}
                {weeks.map((week) => (
                  <span key={week} className="timeline__week" style={{ left: `${position(week)}%` }}>
                    {Number(week.slice(8))}
                  </span>
                ))}
                <span className="timeline__today timeline__today--label">Today</span>
              </div>
            </div>

            <ul className="timeline__rows">
              {items.map((item) => {
                const state = itemState(item, today)
                const classes = [
                  'timeline__row',
                  `is-${state}`,
                  isMilestone(item) && 'is-milestone',
                  item.id === selectedId && 'is-selected',
                ]
                return (
                  <li key={item.id} className={classes.filter(Boolean).join(' ')}>
                    <div className="timeline__label">
                      <Link to={itemHref(item)} className="timeline__name">
                        {item.name}
                      </Link>
                      <span className="timeline__dates">{itemDates(item)}</span>
                    </div>
                    <div className="timeline__track">
                      {weeks.map((week) => (
                        <span key={week} className="timeline__grid" style={{ left: `${position(week)}%` }} />
                      ))}
                      <span className="timeline__today" aria-hidden="true" />
                      <Link
                        to={itemHref(item)}
                        tabIndex={-1}
                        aria-label={`${item.name}, ${itemDates(item)}`}
                        className={isMilestone(item) ? 'timeline__milestone' : 'timeline__bar'}
                        style={
                          isMilestone(item)
                            ? { left: `${position(item.start_date) + halfDay}%` }
                            : {
                                left: `${position(item.start_date)}%`,
                                width: `${position(addDays(item.end_date, 1)) - position(item.start_date)}%`,
                              }
                        }
                      >
                        <span className="timeline__tip" role="tooltip">
                          <strong>{item.name}</strong>
                          <span>{itemDates(item)}</span>
                        </span>
                      </Link>
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>

          <p className="legend">
            <span className="legend__item timeline-legend--phase">Phase</span>
            <span className="legend__item timeline-legend--done">Finished</span>
            <span className="legend__item timeline-legend--milestone">Milestone</span>
            <span className="legend__item timeline-legend--today">Today</span>
          </p>
        </div>
      )}

      {selected && (
        <article className="tile timeline-details" aria-labelledby="timeline-details-title">
          <div className="timeline-details__head">
            <div>
              <h2 id="timeline-details-title">{selected.name}</h2>
              <p className="timeline-details__dates">
                {isMilestone(selected) ? 'Milestone · ' : ''}
                {itemDates(selected)}
                {' · '}
                {{ done: 'Finished', current: 'In progress', upcoming: 'Upcoming' }[itemState(selected, today)]}
              </p>
            </div>
            <Link to="?" className="icon-button" aria-label="Close details">
              ×
            </Link>
          </div>
          {selected.description ? (
            <p className="timeline-details__description">{selected.description}</p>
          ) : (
            <p className="muted">No description.</p>
          )}
          {selected.created_by_name && <p className="muted">Added by {selected.created_by_name}</p>}
          {manager && (
            <div className="inline-form__actions">
              <button type="button" className="button" onClick={() => setDialog(selected)}>
                Edit
              </button>
              <button type="button" className="text-button" onClick={() => remove(selected)}>
                Remove from timeline
              </button>
            </div>
          )}
        </article>
      )}

      {dialog !== undefined && (
        <TimelineFormDialog
          item={dialog}
          defaultDate={today}
          onClose={() => setDialog(undefined)}
          onSaved={(saved) => {
            setDialog(undefined)
            setParams({ item: String(saved.id) })
            timeline.reload()
          }}
        />
      )}
    </section>
  )
}
