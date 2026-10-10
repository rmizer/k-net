import type { ReactNode } from 'react'

interface CalloutBandProps {
  /** Ties the heading to the band for screen readers; must be unique on the page. */
  id: string
  icon: ReactNode
  eyebrow: string
  title: string
  children: ReactNode
  /** The call to action, usually a link with the `button callout__button` classes. */
  action: ReactNode
}

/** A bold black-and-red band for the one thing on a page people shouldn't miss. */
export function CalloutBand({ id, icon, eyebrow, title, children, action }: CalloutBandProps) {
  return (
    <aside className="callout" aria-labelledby={id}>
      <span className="callout__icon" aria-hidden="true">
        {icon}
      </span>
      <div className="callout__text">
        <p className="callout__eyebrow">{eyebrow}</p>
        <h2 id={id}>{title}</h2>
        <p>{children}</p>
      </div>
      {action}
    </aside>
  )
}
