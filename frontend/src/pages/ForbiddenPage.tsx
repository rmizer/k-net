import { Link } from 'react-router-dom'

export function ForbiddenPage() {
  return (
    <section>
      <h1>Access restricted</h1>
      <p>Your role doesn't have access to this page. If you think it should, contact a Director or Assistant.</p>
      <p>
        <Link to="/">Back to the dashboard</Link>
      </p>
    </section>
  )
}
