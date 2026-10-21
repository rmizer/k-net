import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ROLE_LABELS, type Role, type User } from '../../auth/roles'
import battleHouseLogo from '../../assets/brand/battlehouse-logo.png'
import { addDays, clockTime, dayKey, formatDay, timeInZone } from '../../format'
import { useFetch } from '../../hooks/useFetch'
import type { CalendarEvent, CrewDay, CrewMember, ProductionLocation, ProductionSettings, Show, Weather } from '../../types'
import './call-sheet.css'

/** Call sheet sections, in order, and the departments listed under each. Anyone
 *  in another department gets a section of their own after these. */
const SECTIONS: { title: string; departments: string[] }[] = [
  { title: 'Producers & Production', departments: ['Production'] },
  { title: 'Office & Operations', departments: ['Operations'] },
  { title: 'PRIIME Trailer & Technical', departments: ['Tech'] },
  { title: 'Camera', departments: ['Film Crew', 'Camera'] },
  { title: 'Audio', departments: ['Audio'] },
  { title: 'Marketing & Social Media', departments: ['Marketing'] },
  { title: 'Culinary Team', departments: ['Culinary'] },
  { title: 'Transportation', departments: ['Transportation'] },
  { title: 'Security', departments: ['Security'] },
]

const ROLE_ORDER: Role[] = ['director', 'assistant', 'site_manager', 'staff']
const SHOOT_DAY_WINDOW = 120 // days looked back to count shoot days
const BUS = /shuttle|\bbus\b|transpo|travel/i
const LIVE = /^live\b/i

/** "st" for 21, "th" for 11, and so on. */
const suffix = (n: number) => (n % 100 >= 11 && n % 100 <= 13 ? 'th' : (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'))

const eventsPath = (first: string, last: string) =>
  `/events/?start=${addDays(first, -1)}T00:00:00Z&end=${addDays(last, 2)}T00:00:00Z`

/** Text a Director can click and change before printing. Edits stay on this
 *  page only; changing the date starts a fresh sheet. */
function Editable({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={`cs-edit${className ? ` ${className}` : ''}`} contentEditable suppressContentEditableWarning>
      {children}
    </span>
  )
}

export function CallSheetPage() {
  const production = useFetch<ProductionSettings>('/production/')
  if (!production.data) {
    if (production.loading) return <p className="loading">Loading…</p>
    return <p className="form__error">Couldn’t load the production settings.</p>
  }
  return <CallSheetGenerator today={production.data.today} timeZone={production.data.time_zone} />
}

function CallSheetGenerator({ today, timeZone }: { today: string; timeZone: string }) {
  const [day, setDay] = useState(today)
  const [showId, setShowId] = useState('')
  const [season, setSeason] = useState('1')
  const [shootDay, setShootDay] = useState<{ forDay: string; value: string } | null>(null)

  const shows = useFetch<Show[]>('/shows/')
  const people = useFetch<User[]>('/users/')
  const crew = useFetch<CrewDay>(`/users/crew/?date=${day}`)
  const events = useFetch<CalendarEvent[]>(eventsPath(day, day))
  const history = useFetch<CalendarEvent[]>(eventsPath(addDays(day, -SHOOT_DAY_WINDOW), day))
  const locations = useFetch<ProductionLocation[]>('/locations/')
  const weather = useFetch<Weather>('/weather/')

  const show = shows.data?.find((s) => String(s.id) === showId) ?? shows.data?.find((s) => s.status === 'production') ?? shows.data?.[0]

  const dayEvents = useMemo(
    () =>
      (events.data ?? [])
        .filter((e) => e.event_type !== 'support' && dayKey(e.start, timeZone) === day)
        // The LIVE banner leads anything else starting at the same time.
        .sort(
          (a, b) =>
            a.start.localeCompare(b.start) ||
            Number(LIVE.test(b.title)) - Number(LIVE.test(a.title)) ||
            a.end.localeCompare(b.end),
        ),
    [events.data, day, timeZone],
  )

  // Shoot day: how many days up to this one have a shoot schedule (items with a
  // talent / crew label) since the run of shoot days began.
  const countedShootDay = useMemo(() => {
    const days = new Set(
      (history.data ?? []).filter((e) => e.talent_crew).map((e) => dayKey(e.start, timeZone)).filter((d) => d <= day),
    )
    return days.has(day) ? days.size : null
  }, [history.data, day, timeZone])
  const shootDayValue = shootDay?.forDay === day ? shootDay.value : String(countedShootDay ?? '')

  const crewDay = crew.data?.date === day ? crew.data.crew : undefined
  const loading = !crewDay || !people.data || !events.data
  const sheetKey = `${day}-${show?.id}-${season}-${shootDayValue}-${loading}`

  return (
    <section className="call-sheet-page">
      <div className="page-header no-print">
        <div>
          <h1>Call Sheet Generator</h1>
          <p className="subtitle">
            Built from the <Link to="/schedule">schedule</Link> and the <Link to="/directory">directory</Link>. Click
            any text on the sheet to change it before printing.
          </p>
        </div>
        <button type="button" className="button" onClick={() => window.print()} disabled={loading}>
          Print / save as PDF
        </button>
      </div>

      <div className="filters cs-controls no-print">
        <label className="form__field">
          <span>Date</span>
          <input type="date" value={day} onChange={(e) => e.target.value && setDay(e.target.value)} />
        </label>
        <label className="form__field">
          <span>Show</span>
          <select value={show ? String(show.id) : ''} onChange={(e) => setShowId(e.target.value)}>
            {(shows.data ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="form__field">
          <span>Season</span>
          <input type="number" min={1} value={season} onChange={(e) => setSeason(e.target.value)} />
        </label>
        <label className="form__field">
          <span>Shoot day</span>
          <input
            type="number"
            min={1}
            value={shootDayValue}
            placeholder="Not a shoot day"
            onChange={(e) => setShootDay({ forDay: day, value: e.target.value })}
          />
        </label>
      </div>

      {loading ? (
        <p className="loading">Building the call sheet…</p>
      ) : (
        <CallSheet
          key={sheetKey}
          day={day}
          today={today}
          timeZone={timeZone}
          season={season}
          shootDay={shootDayValue}
          crew={crewDay}
          people={people.data ?? []}
          events={dayEvents}
          locations={locations.data ?? []}
          weather={weather.data}
        />
      )}
    </section>
  )
}

interface SheetRow {
  person: User
  call: CrewMember['call'] | null
}

interface CallSheetProps {
  day: string
  today: string
  timeZone: string
  season: string
  shootDay: string
  crew: CrewMember[]
  people: User[]
  events: CalendarEvent[]
  locations: ProductionLocation[]
  weather: Weather | undefined
}

function CallSheet(props: CallSheetProps) {
  const { day, timeZone, crew, people, events } = props
  const calls = new Map(crew.map((member) => [member.id, member.call]))

  // Everyone called that day, plus the rest of the production crew (anyone
  // with a title) as not called.
  const rows: SheetRow[] = people
    .filter((person) => calls.has(person.id) || person.title)
    .map((person) => ({ person, call: calls.get(person.id) ?? null }))

  const sections = SECTIONS.map(({ title, departments }) => ({
    title,
    rows: rows.filter((row) => departments.includes(row.person.department_name ?? '')),
  }))
  const listed = new Set(SECTIONS.flatMap((section) => section.departments))
  const others = new Map<string, SheetRow[]>()
  for (const row of rows) {
    const name = row.person.department_name ?? 'Other'
    if (!listed.has(name)) others.set(name, [...(others.get(name) ?? []), row])
  }
  const allSections = [...sections, ...[...others].map(([title, list]) => ({ title, rows: list }))]
    .filter((section) => section.rows.length)
    .map((section) => ({
      ...section,
      rows: [...section.rows].sort(
        (a, b) =>
          ROLE_ORDER.indexOf(a.person.role) - ROLE_ORDER.indexOf(b.person.role) ||
          (a.call?.time ?? '99').localeCompare(b.call?.time ?? '99') ||
          `${a.person.last_name} ${a.person.first_name}`.localeCompare(`${b.person.last_name} ${b.person.first_name}`),
      ),
    }))

  const date = new Date(`${day}T12:00:00Z`)
  const dateLine = `${formatDay(day, { weekday: 'long' })}, ${formatDay(day, { month: 'long' })} ${date.getUTCDate()}${suffix(date.getUTCDate())}`
  const subtitle = props.shootDay ? `${dateLine} - Shoot Day ${props.shootDay}` : dateLine

  const header = <SheetHeader {...props} />

  return (
    <div className="cs-sheets">
      <article className="cs-sheet" aria-label="Call sheet, page 1">
        {header}
        <div className="cs-band">
          <h2>
            <Editable>Call Sheet - Season {props.season}</Editable>
          </h2>
          <p>
            <Editable>{subtitle}</Editable>
          </p>
        </div>
        <table className="cs-table cs-crew">
          <thead>
            <tr>
              <th>Name</th>
              <th>Position</th>
              <th>Email Address</th>
              <th>Phone Number</th>
              <th>Location</th>
              <th>Call Time</th>
            </tr>
          </thead>
          {allSections.map((section) => (
            <tbody key={section.title}>
              <tr className="cs-section">
                <th colSpan={6}>{section.title}</th>
              </tr>
              {section.rows.map(({ person, call }) => (
                <tr key={person.id}>
                  <td>
                    <Editable>{`${person.first_name} ${person.last_name}`.trim()}</Editable>
                  </td>
                  <td>
                    <Editable>{person.title || ROLE_LABELS[person.role]}</Editable>
                  </td>
                  <td>
                    <Editable>{person.email.endsWith('@example.com') ? '' : person.email}</Editable>
                  </td>
                  <td>
                    <Editable>{person.phone}</Editable>
                  </td>
                  <td>
                    <Editable>{call ? call.location || 'TBD' : 'N/C'}</Editable>
                  </td>
                  <td>
                    <Editable>{call ? (call.time ? clockTime(call.time) : 'All day') : 'N/C'}</Editable>
                  </td>
                </tr>
              ))}
            </tbody>
          ))}
        </table>
        {allSections.length === 0 && <p className="cs-empty">No one is on the schedule this day.</p>}
      </article>

      <article className="cs-sheet" aria-label="Call sheet, page 2: shoot schedule">
        {header}
        <div className="cs-band">
          <h2>
            <Editable>Shoot Schedule</Editable>
          </h2>
          <p>
            <Editable>{subtitle}</Editable>
          </p>
        </div>
        <table className="cs-table cs-schedule">
          <thead>
            <tr>
              <th>Time</th>
              <th>Talent / Crew</th>
              <th>Segment</th>
              <th>Location</th>
            </tr>
          </thead>
          <tbody>
            {events.map((event) =>
              LIVE.test(event.title) ? (
                <tr key={event.id} className="cs-live">
                  <td colSpan={4}>
                    <Editable>
                      {Array.from({ length: 6 }, () => `LIVE @ ${clockTime(timeInZone(event.start, timeZone))}`).join(
                        '  ',
                      )}
                    </Editable>
                  </td>
                </tr>
              ) : (
                <tr key={event.id} className={`cs-type-${event.event_type}`}>
                  <td>
                    <Editable>{scheduleTime(event, timeZone)}</Editable>
                  </td>
                  <td>
                    <Editable>{event.talent_crew}</Editable>
                  </td>
                  <td>
                    <Editable>
                      {event.title}
                      {event.description && <span className="cs-detail">{event.description}</span>}
                    </Editable>
                  </td>
                  <td>
                    <Editable>{event.location}</Editable>
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
        {events.length === 0 && <p className="cs-empty">Nothing on the schedule this day.</p>}
      </article>
    </div>
  )
}

/** "8:30 AM", or "10:00 AM - 11:00 AM" for anything longer than 15 minutes. */
function scheduleTime(event: CalendarEvent, timeZone: string) {
  if (event.all_day) return 'All day'
  const start = clockTime(timeInZone(event.start, timeZone))
  const minutes = (Date.parse(event.end) - Date.parse(event.start)) / 60000
  return minutes > 15 ? `${start} - ${clockTime(timeInZone(event.end, timeZone))}` : start
}

/** Locations on the left, the show's logo in the middle, weather and buses on the right. */
function SheetHeader({ day, today, timeZone, crew, events, locations, weather }: CallSheetProps) {
  // Locations used that day: in the schedule, or where the called crew stay.
  const used = [...events.map((e) => e.location), ...crew.map((m) => m.lodging)].join(' | ').toLowerCase()
  const places = locations
    .filter((place) => used.includes(place.name.toLowerCase()))
    .sort((a, b) => (a.kind === 'lodging' ? -1 : b.kind === 'lodging' ? 1 : a.name.localeCompare(b.name)))
  let shootingNumber = 0

  const forecast = weather?.configured ? weather.daily.find((d) => d.date === day) : undefined
  const buses = events.filter((e) => BUS.test(`${e.title} ${e.location}`))

  return (
    <header className="cs-header">
      <div className="cs-header__side">
        <p className="cs-label">Locations:</p>
        {places.length === 0 && <Editable>Add locations on the Locations page</Editable>}
        {places.map((place) => {
          const label = place.kind === 'lodging' ? 'Crew Hotel' : `Location #${++shootingNumber}: ${place.name}`
          return (
            <div key={place.id} className="cs-place">
              <p className="cs-underline">
                <Editable>{label}:</Editable>
              </p>
              <Editable className="cs-block">
                {place.kind === 'lodging' && <>{place.name}<br /></>}
                {place.address.split(/,\s*/).slice(0, 1).join('')}
                <br />
                {place.address.split(/,\s*/).slice(1).join(', ')}
              </Editable>
            </div>
          )
        })}
      </div>

      <div className="cs-header__logo">
        <img src={battleHouseLogo} alt="Battle House Live" />
      </div>

      <div className="cs-header__side cs-header__side--right">
        <p className="cs-label">Weather Report &amp; Bus Schedule:</p>
        <p className="cs-underline">Weather Report:</p>
        <Editable className="cs-block">
          {forecast ? (
            <>
              Temperature: {Math.round(forecast.low)}° - {Math.round(forecast.high)}°
              {weather?.configured && weather.temperature_unit.replace('°', '')}
              <br />
              {forecast.description}
              {forecast.precipitation_chance != null && (
                <>
                  <br />
                  Precipitation: {forecast.precipitation_chance}%
                </>
              )}
              {day === today && weather?.configured && (
                <>
                  <br />
                  Wind: {Math.round(weather.current.wind_speed)} {weather.wind_unit}
                </>
              )}
            </>
          ) : (
            'Forecast not available for this date'
          )}
        </Editable>
        <p className="cs-underline">Bus Schedule:</p>
        <Editable className="cs-block">
          {buses.length === 0
            ? 'No buses scheduled'
            : buses.map((bus, i) => (
                <span key={bus.id}>
                  {i > 0 && <br />}
                  {bus.title}
                  {bus.location && ` (${bus.location})`} - {clockTime(timeInZone(bus.start, timeZone))}
                </span>
              ))}
        </Editable>
      </div>
    </header>
  )
}
