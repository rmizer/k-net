import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import wordmark from '../../assets/brand/knet-wordmark.png'
import { useFetch } from '../../hooks/useFetch'
import { NotFoundPage } from '../NotFoundPage'
import './investors.css'

/** The private investor page, opened from the share link. No sign-in needed;
 *  the server checks the token in the address. */
export function InvestorPage() {
  const { token = '' } = useParams()
  const page = useFetch<{ status: string }>(`/investors/${encodeURIComponent(token)}/`)

  // Ask search engines not to index or follow the private page.
  useEffect(() => {
    const meta = document.createElement('meta')
    meta.name = 'robots'
    meta.content = 'noindex, nofollow'
    document.head.appendChild(meta)
    const title = document.title
    document.title = 'K-Net · Investors'
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
    <main className="investor">
      <img src={wordmark} alt="K-Net: K Network Project Center" className="investor__logo" width={900} height={286} />
      <div className="tile investor__construction">
        <p className="investor__icon" aria-hidden="true">
          🚧
        </p>
        <h1>Under construction</h1>
        <p>This page for K-Net investors is being put together. Please check back soon.</p>
      </div>
    </main>
  )
}
