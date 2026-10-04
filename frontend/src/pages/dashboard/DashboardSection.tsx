import type { ReactNode } from 'react'

interface DashboardSectionProps {
  title: string
  /** Optional link or button shown beside the heading. */
  action?: ReactNode
  className?: string
  children: ReactNode
}

/** A full-width dashboard row with a heading. */
export function DashboardSection({ title, action, className = '', children }: DashboardSectionProps) {
  const id = `dash-${title.toLowerCase().replace(/[^a-z]+/g, '-')}`
  return (
    <section className={`dash-section ${className}`} aria-labelledby={id}>
      <div className="dash-section__header">
        <h2 id={id}>{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}
