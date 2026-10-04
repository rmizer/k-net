interface PlaceholderPageProps {
  title: string
  subtitle?: string
  /** Planned sections for this page, from the site plan. */
  planned: string[]
}

/** Stand-in for pages that haven't been built yet. */
export function PlaceholderPage({ title, subtitle, planned }: PlaceholderPageProps) {
  return (
    <section>
      <h1>{title}</h1>
      {subtitle && <p className="subtitle">{subtitle}</p>}
      <div className="tile placeholder">
        <p className="placeholder__badge">In development</p>
        <ul>
          {planned.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
    </section>
  )
}
