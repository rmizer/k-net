import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'
import { NotFoundPage } from '../NotFoundPage'
import { ARTICLES } from './articles'
import './help.css'

/** One help article, at /help/<slug>. */
export function HelpArticlePage() {
  const { slug } = useParams()
  const { user } = useAuth()
  const article = ARTICLES.find((a) => a.slug === slug)
  if (!article || !user) return <NotFoundPage />

  return (
    <article className="help help-article">
      <p className="help-article__back">
        <Link to="/help">← Help</Link>
      </p>
      <h1>{article.title}</h1>
      <p className="subtitle">{article.summary}</p>
      <div className="tile help-article__body">{article.body(user)}</div>
    </article>
  )
}
