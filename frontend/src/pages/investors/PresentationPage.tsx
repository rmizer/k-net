import { useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import wordmark from '../../assets/brand/knet-wordmark.png'
import { useFetch } from '../../hooks/useFetch'
import { NotFoundPage } from '../NotFoundPage'
import './investors.css'

// Served from frontend/public, so it is also the file's own address.
export const PRESENTATION_URL = '/K-Network_Presentation.pdf'

/** The investor presentation (PDF), shown in the browser's own PDF viewer.
 *  Linked from the investor page, with the same access. */
export function PresentationPage() {
  const { token } = useParams()
  const page = useFetch<{ status: string }>(token ? `/investors/${encodeURIComponent(token)}/` : '/investors/')
  const investorPage = token ? `/investors/${token}` : '/for-investors'

  useEffect(() => {
    const meta = document.createElement('meta')
    meta.name = 'robots'
    meta.content = 'noindex, nofollow'
    document.head.appendChild(meta)
    const title = document.title
    document.title = 'K-Net · Investor presentation'
    return () => {
      meta.remove()
      document.title = title
    }
  }, [])

  if (page.loading && !page.data) return <p className="loading investor__loading">Loading…</p>
  if (!page.data)
    return (
      <main className="investor">
        <NotFoundPage />
      </main>
    )

  return (
    <main className="investor investor--presentation">
      <header className="investor__hero">
        <Link to={investorPage} className="investor__back">
          <span aria-hidden="true">←</span> Investor information
        </Link>
        <img src={wordmark} alt="K-Net: K Network Project Center" className="investor__logo" width={900} height={286} />
        <h1>The K-Net investor presentation</h1>
        <p className="investor__actions">
          <a className="button" href={PRESENTATION_URL} target="_blank" rel="noopener">
            Open full screen
          </a>
          <a className="button button--secondary" href={PRESENTATION_URL} download>
            Download PDF
          </a>
        </p>
      </header>

      <div className="tile investor__viewer">
        <iframe src={`${PRESENTATION_URL}#view=FitH`} title="K-Net investor presentation" />
      </div>
      <p className="investor__viewer-note">
        If the slides don’t show above (some phones can’t display a PDF inside a page), use{' '}
        <a href={PRESENTATION_URL} target="_blank" rel="noopener">
          Open full screen
        </a>
        .
      </p>

      <p className="investor__actions">
        <Link className="button button--secondary" to={investorPage}>
          Back to investor information
        </Link>
      </p>
    </main>
  )
}
