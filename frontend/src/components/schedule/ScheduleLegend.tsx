import './schedule.css'

/** Explains how event types are drawn on the schedule views. */
export function ScheduleLegend({ showMine = true }: { showMine?: boolean }) {
  return (
    <p className="legend">
      <span className="legend__item legend__item--staff">Production</span>
      <span className="legend__item legend__item--influencer">Influencer</span>
      <span className="legend__item legend__item--support">Support</span>
      {showMine && <span className="legend__item legend__item--mine">Yours</span>}
    </p>
  )
}
