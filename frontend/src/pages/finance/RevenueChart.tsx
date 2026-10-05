import { useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { formatDay } from '../../format'
import type { Deposit } from '../../types'
import { money } from './shared'

interface RevenueChartProps {
  deposits: Deposit[]
  /** "YYYY-MM-DD": when the production began, and today. */
  start: string
  end: string
}

const HEIGHT = 260
const MARGIN = { top: 18, right: 96, bottom: 30, left: 64 }
const DAY_MS = 86_400_000

const dayNumber = (day: string) => Date.parse(`${day}T00:00:00Z`) / DAY_MS
const fromDayNumber = (n: number) => new Date(n * DAY_MS).toISOString().slice(0, 10)

/** Round axis steps: 1, 2, 2.5 or 5 times a power of ten. */
function niceTicks(max: number, count = 4) {
  if (max <= 0) return [0]
  const rough = max / count
  const power = 10 ** Math.floor(Math.log10(rough))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * power).find((s) => s >= rough) ?? 10 * power
  return Array.from({ length: Math.ceil(max / step) + 1 }, (_, i) => i * step)
}

const compactMoney = (value: number) =>
  value === 0
    ? '$0'
    : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact' }).format(value)

/** Cumulative money received, as a step line from the start of production to today. */
export function RevenueChart({ deposits, start, end }: RevenueChartProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(800)
  const [hoverDay, setHoverDay] = useState<string | null>(null)

  useLayoutEffect(() => {
    const node = wrapRef.current
    if (!node) return
    setWidth(Math.max(320, node.clientWidth)) // Measure before the first paint.
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(320, entry.contentRect.width)))
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  // One step per day with deposits, in date order, with the running total after that day.
  const steps = useMemo(() => {
    const byDay = new Map<string, Deposit[]>()
    for (const deposit of deposits) {
      if (deposit.received_on > end) continue
      byDay.set(deposit.received_on, [...(byDay.get(deposit.received_on) ?? []), deposit])
    }
    return [...byDay.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .reduce<{ day: string; items: Deposit[]; total: number }[]>((result, [day, items]) => {
        const total = (result.at(-1)?.total ?? 0) + items.reduce((sum, d) => sum + Number(d.amount), 0)
        return [...result, { day, items, total }]
      }, [])
  }, [deposits, end])

  const first = steps.length && steps[0].day < start ? steps[0].day : start
  const total = steps.at(-1)?.total ?? 0
  const ticks = niceTicks(total, 5)
  const yMax = ticks.at(-1) || 1
  const plotWidth = width - MARGIN.left - MARGIN.right
  const plotHeight = HEIGHT - MARGIN.top - MARGIN.bottom
  const span = Math.max(1, dayNumber(end) - dayNumber(first))
  const x = (day: string) => MARGIN.left + ((dayNumber(day) - dayNumber(first)) / span) * plotWidth
  const y = (value: number) => MARGIN.top + plotHeight - (value / yMax) * plotHeight
  const baseline = y(0)

  // Step-after path: flat until a deposit day, then straight up.
  let line = `M${x(first)},${baseline}`
  for (const step of steps) line += ` H${x(step.day)} V${y(step.total)}`
  line += ` H${x(end)}`
  const area = `${line} V${baseline} H${x(first)} Z`

  // Month starts inside the range label the x-axis; the first month is labeled only with room.
  const months: string[] = []
  for (let n = dayNumber(first); n <= dayNumber(end); n++) {
    const day = fromDayNumber(n)
    if (day.endsWith('-01')) months.push(day)
  }
  if (!months.length || x(months[0]) - x(first) >= 56) months.unshift(first)

  // What the hover/focus readout shows: the running total on that day, and any deposits that day.
  const readout = useMemo(() => {
    if (!hoverDay) return null
    const before = steps.filter((s) => s.day <= hoverDay)
    return {
      day: hoverDay,
      total: before.at(-1)?.total ?? 0,
      items: steps.find((s) => s.day === hoverDay)?.items ?? [],
    }
  }, [hoverDay, steps])

  const dayAt = (clientX: number, rect: DOMRect) => {
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left - MARGIN.left) / plotWidth))
    const day = fromDayNumber(Math.round(dayNumber(first) + ratio * span))
    // Snap to a deposit day when the pointer is within a few pixels of one.
    const near = steps.find((s) => Math.abs(x(s.day) - (clientX - rect.left)) <= 8)
    return near?.day ?? day
  }

  const onPointerMove = (event: PointerEvent<SVGRectElement>) =>
    setHoverDay(dayAt(event.clientX, event.currentTarget.ownerSVGElement!.getBoundingClientRect()))

  // Keyboard: arrow keys step between deposit days.
  const onKeyDown = (event: KeyboardEvent<SVGSVGElement>) => {
    if (!steps.length || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const index = steps.findIndex((s) => s.day === hoverDay)
    const next =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? steps.length - 1
          : index < 0
            ? steps.length - 1
            : Math.min(steps.length - 1, Math.max(0, index + (event.key === 'ArrowRight' ? 1 : -1)))
    setHoverDay(steps[next].day)
  }

  const hoverX = readout ? x(readout.day) : 0
  const tipOnLeft = hoverX > width - 220

  return (
    <div className="revenue-chart" ref={wrapRef}>
      <svg
        width={width}
        height={HEIGHT}
        viewBox={`0 0 ${width} ${HEIGHT}`}
        role="img"
        aria-label={`Revenue received from ${formatDay(first, { month: 'long', day: 'numeric' })} to ${formatDay(end, {
          month: 'long',
          day: 'numeric',
        })}: ${money(total)} across ${deposits.length} deposits. Use the arrow keys to step through deposits.`}
        tabIndex={0}
        onKeyDown={onKeyDown}
        onFocus={() => !hoverDay && steps.length && setHoverDay(steps.at(-1)!.day)}
        onBlur={() => setHoverDay(null)}
      >
        {/* Gridlines and y-axis labels */}
        {ticks.map((tick) => (
          <g key={tick}>
            <line
              className="revenue-chart__grid"
              x1={MARGIN.left}
              x2={width - MARGIN.right}
              y1={y(tick)}
              y2={y(tick)}
            />
            <text className="revenue-chart__axis" x={MARGIN.left - 10} y={y(tick)} dy="0.32em" textAnchor="end">
              {compactMoney(tick)}
            </text>
          </g>
        ))}
        {months.map((month) => (
          <text key={month} className="revenue-chart__axis" x={x(month)} y={HEIGHT - 8} textAnchor="start">
            {formatDay(month, month.endsWith('-01') ? { month: 'short' } : { month: 'short', day: 'numeric' })}
          </text>
        ))}

        <path className="revenue-chart__area" d={area} />
        <path className="revenue-chart__line" d={line} />
        {steps.map((step) => (
          <circle
            key={step.day}
            className={`revenue-chart__dot${readout?.day === step.day ? ' is-active' : ''}`}
            cx={x(step.day)}
            cy={y(step.total)}
            r={readout?.day === step.day ? 6 : 4.5}
          />
        ))}

        {/* Today's total, labeled at the end of the line. */}
        <circle className="revenue-chart__dot" cx={x(end)} cy={y(total)} r={4.5} />
        <text className="revenue-chart__end" x={x(end) + 10} y={y(total)} dy="0.32em">
          {money(total).replace('.00', '')}
        </text>
        <text className="revenue-chart__axis" x={x(end) + 10} y={y(total) + 16} dy="0.32em">
          today
        </text>

        {readout && <line className="revenue-chart__crosshair" x1={hoverX} x2={hoverX} y1={MARGIN.top} y2={baseline} />}
        {/* Hit area: the whole plot, so the pointer only has to find the date. */}
        <rect
          className="revenue-chart__hit"
          x={MARGIN.left}
          y={MARGIN.top}
          width={plotWidth}
          height={plotHeight}
          onPointerMove={onPointerMove}
          onPointerLeave={() => setHoverDay(null)}
        />
      </svg>

      {readout && (
        <div
          className="revenue-chart__tip"
          style={{
            left: tipOnLeft ? undefined : hoverX + 12,
            right: tipOnLeft ? width - hoverX + 12 : undefined,
            top: MARGIN.top,
          }}
          role="status"
        >
          <strong>{money(readout.total)}</strong>
          <span className="revenue-chart__tip-label">
            received by {formatDay(readout.day, { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
          {readout.items.map((deposit) => (
            <span key={deposit.id} className="revenue-chart__tip-row">
              <span className="revenue-chart__key" aria-hidden="true" />+{money(deposit.amount)} from {deposit.source}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
