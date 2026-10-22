import { useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { addDays, formatDay } from '../../../format'
import { useFetch } from '../../../hooks/useFetch'
import { MEAL_TYPES, type MenuItem } from '../../../types'
import { monthGrid, shiftMonth } from '../../schedule/MonthCalendar'
import '../../schedule/schedule.css'
import { CulinaryShell } from './CulinaryShell'

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MAX_CHIPS = 3

const mealRank = (item: MenuItem) => MEAL_TYPES.findIndex((meal) => meal.value === item.meal)
const byMeal = (a: MenuItem, b: MenuItem) => mealRank(a) - mealRank(b) || a.name.localeCompare(b.name)

/** Monday of the week a day is in. */
const weekStart = (day: string) => addDays(day, -((new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7))

const menuItemHref = (item: MenuItem) => `/departments/culinary/menu/${item.id}`

/** Culinary menus: the month, the week, and one day's meals in full. */
export function MenuPage() {
  return (
    <CulinaryShell
      title="Menus"
      subtitle="Culinary · What’s cooking, day by day"
      actions={({ canEdit, today }) => canEdit && <NewMenuItemLink today={today} />}
    >
      {({ canEdit, today }) => <Menus today={today} canEdit={canEdit} />}
    </CulinaryShell>
  )
}

function NewMenuItemLink({ today }: { today: string }) {
  const [params] = useSearchParams()
  const date = params.get('date')
  return (
    <Link to={`/departments/culinary/menu/new?date=${date && DAY_PATTERN.test(date) ? date : today}`} className="button">
      + Add menu item
    </Link>
  )
}

function Menus({ today, canEdit }: { today: string; canEdit: boolean }) {
  const [params, setParams] = useSearchParams()
  const dayRef = useRef<HTMLElement>(null)
  const dateParam = params.get('date') ?? ''
  const day = DAY_PATTERN.test(dateParam) ? dateParam : today
  const [paged, setPaged] = useState<{ forDay: string; month: string } | null>(null)
  const month = paged?.forDay === day ? paged.month : day.slice(0, 7)

  const grid = monthGrid(month)
  const week = Array.from({ length: 7 }, (_, i) => addDays(weekStart(day), i))
  const first = week[0] < grid[0] ? week[0] : grid[0]
  const last = week[6] > grid[41] ? week[6] : grid[41]
  const menu = useFetch<MenuItem[]>(`/culinary/menu-items/?start=${first}&end=${last}`)

  const byDay = useMemo(() => {
    const days = new Map<string, MenuItem[]>()
    for (const item of menu.data ?? []) days.set(item.date, [...(days.get(item.date) ?? []), item])
    for (const items of days.values()) items.sort(byMeal)
    return days
  }, [menu.data])

  const pick = (next: string, scroll = false) => {
    setParams({ date: next }, { replace: true })
    if (scroll) window.setTimeout(() => dayRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
  }

  return (
    <>
      <section className="department__section" aria-labelledby="menu-month">
        <h2 id="menu-month" className="department__heading">
          Month
        </h2>
        <div className={`month tile${menu.loading ? ' is-loading' : ''}`}>
          <div className="month__toolbar">
            <button
              type="button"
              className="icon-button"
              onClick={() => setPaged({ forDay: day, month: shiftMonth(month, -1) })}
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
              onClick={() => setPaged({ forDay: day, month: shiftMonth(month, 1) })}
              aria-label="Next month"
            >
              ›
            </button>
            {day !== today && (
              <button type="button" className="text-button" onClick={() => pick(today)}>
                Today
              </button>
            )}
          </div>
          <div className="month__grid">
            {WEEKDAYS.map((name, index) => (
              <span key={name} className={`month__weekday${index >= 5 ? ' is-weekend' : ''}`} aria-hidden="true">
                {name}
              </span>
            ))}
            {grid.map((date, index) => {
              const items = byDay.get(date) ?? []
              const classes = [
                'month__day',
                index % 7 >= 5 && 'is-weekend',
                !date.startsWith(month) && 'is-outside',
                date === today && 'is-today',
                date === day && 'is-selected',
              ]
              return (
                <button
                  key={date}
                  type="button"
                  className={classes.filter(Boolean).join(' ')}
                  onClick={() => pick(date)}
                  aria-pressed={date === day}
                  aria-label={`${formatDay(date, { weekday: 'long', month: 'long', day: 'numeric' })}, ${
                    items.length ? `${items.length} menu item${items.length === 1 ? '' : 's'}` : 'nothing planned'
                  }`}
                >
                  <span className="month__date" aria-hidden="true">
                    {Number(date.slice(8))}
                  </span>
                  <span className="month__events" aria-hidden="true">
                    {items.slice(0, MAX_CHIPS).map((item) => (
                      <span key={item.id} className="month__chip menu-chip">
                        <span className="month__chip-time">{item.meal_display}</span>
                        {item.name}
                      </span>
                    ))}
                    {items.length > MAX_CHIPS && <span className="month__more">+{items.length - MAX_CHIPS} more</span>}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </section>

      <section className="department__section" aria-labelledby="menu-week">
        <h2 id="menu-week" className="department__heading">
          Week of {formatDay(week[0], { month: 'long', day: 'numeric' })}
        </h2>
        <div className="menu-week">
          {week.map((date) => {
            const items = byDay.get(date) ?? []
            return (
              <button
                key={date}
                type="button"
                className={`tile menu-week__day${date === day ? ' is-selected' : ''}${date === today ? ' is-today' : ''}`}
                onClick={() => pick(date, true)}
                aria-pressed={date === day}
              >
                <span className="menu-week__date">{formatDay(date, { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                {items.length ? (
                  <span className="menu-week__items">
                    {items.map((item) => (
                      <span key={item.id} className="menu-week__item">
                        <span className="menu-week__meal">{item.meal_display}</span>
                        {item.name}
                      </span>
                    ))}
                  </span>
                ) : (
                  <span className="muted menu-week__empty">Nothing planned</span>
                )}
              </button>
            )
          })}
        </div>
      </section>

      <section ref={dayRef} className="department__section menu-day" aria-labelledby="menu-day">
        <div className="department__tile-header">
          <h2 id="menu-day" className="department__heading">
            {formatDay(day, { weekday: 'long', month: 'long', day: 'numeric' })}
          </h2>
          {canEdit && (
            <Link to={`/departments/culinary/menu/new?date=${day}`} className="text-button">
              + Add to this day
            </Link>
          )}
        </div>
        <DayMenu items={byDay.get(day) ?? []} loading={menu.loading && !menu.data} />
      </section>
    </>
  )
}

function DayMenu({ items, loading }: { items: MenuItem[]; loading: boolean }) {
  if (loading) return <p className="loading">Loading the menu…</p>
  if (!items.length) return <p className="tile muted">Nothing on the menu for this day yet.</p>
  const meals = MEAL_TYPES.map((meal) => ({ ...meal, items: items.filter((item) => item.meal === meal.value) })).filter(
    (meal) => meal.items.length,
  )
  return (
    <div className="menu-day__meals">
      {meals.map((meal) => (
        <section key={meal.value} className="tile menu-meal" aria-label={meal.label}>
          <h3 className="menu-meal__title">{meal.label}</h3>
          <ul className="menu-meal__items">
            {meal.items.map((item) => (
              <li key={item.id}>
                <Link to={menuItemHref(item)} className="menu-meal__name">
                  {item.name}
                </Link>
                {item.notes && <p className="menu-meal__notes">{item.notes}</p>}
                {item.ingredients.length > 0 && (
                  <ul className="menu-meal__ingredients">
                    {item.ingredients.map((ingredient) => (
                      <li key={ingredient.id}>
                        {ingredient.name}
                        {ingredient.quantity && <span className="muted"> · {ingredient.quantity}</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
