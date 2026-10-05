import { useState } from 'react'
import { Link } from 'react-router-dom'
import { formatDay } from '../../format'
import { useFetch } from '../../hooks/useFetch'
import type { FinanceCalendarItem, FinanceCalendarKind } from '../../types'
import { monthGrid, shiftMonth } from '../schedule/MonthCalendar'
import '../schedule/schedule.css'
import { money } from './shared'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MAX_CHIPS = 3

export const KIND_LABELS: Record<FinanceCalendarKind, string> = {
  invoice: 'Invoice due',
  payroll: 'Payroll',
  draft: 'Auto draft',
  deposit: 'Money in',
}

/** The finance calendar: what's due, scheduled and received, separate from the crew schedule. */
export function FinanceCalendar({ today }: { today: string }) {
  const [month, setMonth] = useState(today.slice(0, 7))
  const [selected, setSelected] = useState(today)
  const days = monthGrid(month)
  // The API allows 62 days; the six-week grid is 42.
  const items = useFetch<FinanceCalendarItem[]>(`/finance/calendar/?start=${days[0]}&end=${days[days.length - 1]}`)

  const byDay = new Map<string, FinanceCalendarItem[]>()
  for (const item of items.data ?? []) byDay.set(item.date, [...(byDay.get(item.date) ?? []), item])
  const selectedItems = byDay.get(selected) ?? []

  const choose = (day: string) => {
    setSelected(day)
    if (!day.startsWith(month)) setMonth(day.slice(0, 7))
  }

  return (
    <div className="fin-calendar">
      <div className={`month tile${items.loading && items.data ? ' is-loading' : ''}`}>
        <div className="month__toolbar">
          <button
            type="button"
            className="icon-button"
            onClick={() => setMonth(shiftMonth(month, -1))}
            aria-label="Previous month"
          >
            ‹
          </button>
          <h3 className="month__title" aria-live="polite">
            {formatDay(`${month}-01`, { month: 'long', year: 'numeric' })}
          </h3>
          <button
            type="button"
            className="icon-button"
            onClick={() => setMonth(shiftMonth(month, 1))}
            aria-label="Next month"
          >
            ›
          </button>
          {month !== today.slice(0, 7) && (
            <button type="button" className="text-button" onClick={() => choose(today)}>
              Today
            </button>
          )}
        </div>
        <div className="month__grid">
          {WEEKDAYS.map((name) => (
            <span key={name} className="month__weekday" aria-hidden="true">
              {name}
            </span>
          ))}
          {days.map((day) => {
            const dayItems = byDay.get(day) ?? []
            const classes = [
              'month__day',
              !day.startsWith(month) && 'is-outside',
              day === today && 'is-today',
              day === selected && 'is-selected',
            ]
            const label = `${formatDay(day, { weekday: 'long', month: 'long', day: 'numeric' })}, ${
              dayItems.length ? `${dayItems.length} item${dayItems.length === 1 ? '' : 's'}` : 'nothing scheduled'
            }`
            return (
              <button
                key={day}
                type="button"
                className={classes.filter(Boolean).join(' ')}
                onClick={() => choose(day)}
                aria-pressed={day === selected}
                aria-label={label}
              >
                <span className="month__date" aria-hidden="true">
                  {Number(day.slice(8))}
                </span>
                <span className="month__events" aria-hidden="true">
                  {dayItems.slice(0, MAX_CHIPS).map((item, i) => (
                    <span
                      key={i}
                      className={`month__chip fin-chip fin-chip--${item.kind}${item.done ? ' is-done' : ''}`}
                    >
                      <span className="month__chip-time">{money(item.amount).replace('.00', '')}</span>
                      {item.title}
                    </span>
                  ))}
                  {dayItems.length > MAX_CHIPS && (
                    <span className="month__more">+{dayItems.length - MAX_CHIPS} more</span>
                  )}
                </span>
                {dayItems.length > 0 && (
                  <span className="month__count" aria-hidden="true">
                    {dayItems.length}
                  </span>
                )}
              </button>
            )
          })}
        </div>
        <p className="legend fin-legend">
          <span className="legend__item fin-legend--invoice">Invoice due</span>
          <span className="legend__item fin-legend--payroll">Payroll</span>
          <span className="legend__item fin-legend--draft">Auto draft</span>
          <span className="legend__item fin-legend--deposit">Money in</span>
          <span className="legend__item fin-legend--done">Done (faded)</span>
        </p>
      </div>

      <section className="tile fin-calendar__day" aria-live="polite" aria-labelledby="fin-day-heading">
        <h3 id="fin-day-heading">{formatDay(selected, { weekday: 'long', month: 'long', day: 'numeric' })}</h3>
        {selectedItems.length === 0 ? (
          <p className="muted">Nothing due or scheduled.</p>
        ) : (
          <ul className="fin-list">
            {selectedItems.map((item, i) => (
              <li key={i} className={item.done ? 'is-done' : undefined}>
                <span className={`fin-dot fin-chip--${item.kind}`} aria-hidden="true" />
                <span className="fin-list__main">
                  <Link to={item.link}>{item.title}</Link>
                  <span className="fin-sub">
                    {KIND_LABELS[item.kind]}
                    {item.done ? ' · Done' : ''}
                  </span>
                </span>
                <span className="fin-num">{money(item.amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
