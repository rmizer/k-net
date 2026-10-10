import { Link } from 'react-router-dom'
import { ARTICLES } from './articles'
import './help.css'

/** The list of help articles. */
export function HelpPage() {
  return (
    <section className="help">
      <h1>Help</h1>
      <p className="subtitle">How-tos for getting set up and using K-Net</p>

      <ul className="help__list">
        {ARTICLES.map((article) => (
          <li key={article.slug}>
            <Link to={`/help/${article.slug}`} className="tile help__card">
              <h2>{article.title}</h2>
              <p>{article.summary}</p>
            </Link>
          </li>
        ))}
      </ul>

      <p className="help__more">
        Can’t find what you need? <Link to="/contact">Ask for help</Link>.
      </p>
    </section>
  )
}
