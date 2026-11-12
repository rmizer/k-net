import { Link } from 'react-router-dom'
import { ARTICLES } from './articles'
import { CalloutBand } from '../../components/CalloutBand'
import { NavIcon } from '../../components/NavIcon'
import './help.css'

/** The list of help articles. */
export function HelpPage() {
  return (
    <section className="help">
      <h1>
        <NavIcon name="help" />
        Help
      </h1>
      <p className="subtitle">How-tos for getting set up and using K-Net</p>

      <CalloutBand
        id="help-contact-heading"
        icon={<NavIcon name="mail" />}
        eyebrow="Need a hand?"
        title="Contact K-Net Support"
        action={
          <Link to="/contact" className="button callout__button">
            Go to the Contact page
          </Link>
        }
      >
        Report a bug, ask a question or request a feature, and the K-Net team will get back to you.
      </CalloutBand>

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
        Can’t find what you need? <Link to="/contact">Contact K-Net Support</Link>.
      </p>
    </section>
  )
}
