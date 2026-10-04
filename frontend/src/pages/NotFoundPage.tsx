import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <section>
      <h1>Page not found</h1>
      <p>We couldn't find that page.</p>
      <p>
        <Link to="/">Back to the dashboard</Link>
      </p>
    </section>
  )
}
