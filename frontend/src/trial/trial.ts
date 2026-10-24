// The alpha trial runs until 11:59pm on November 7, 2026, Tampa (Eastern) time.
export const TRIAL_ENDS_AT = Date.parse('2026-11-07T23:59:00-05:00')

export const TRIAL_END_LABEL = 'Saturday, November 7, 2026 at 11:59 PM Eastern'

const SECOND = 1000
const MINUTE = 60 * SECOND
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

export interface CountdownPart {
  value: number
  unit: string
}

/** What's left of the trial, as the parts the banner shows. Seconds only
 *  appear in the final hour; null once the trial is over. */
export function countdownParts(now: number): CountdownPart[] | null {
  const left = TRIAL_ENDS_AT - now
  if (left <= 0) return null
  const part = (value: number, unit: string) => ({ value, unit: value === 1 ? unit : `${unit}s` })
  if (left < HOUR) {
    return [part(0, 'hour'), part(Math.floor(left / MINUTE), 'minute'), part(Math.floor((left % MINUTE) / SECOND), 'second')]
  }
  return [
    part(Math.floor(left / DAY), 'day'),
    part(Math.floor((left % DAY) / HOUR), 'hour'),
    part(Math.floor((left % HOUR) / MINUTE), 'minute'),
  ]
}
