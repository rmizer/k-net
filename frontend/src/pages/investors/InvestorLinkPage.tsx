import { useState } from 'react'
import { api } from '../../api'
import { useFetch } from '../../hooks/useFetch'
import './investors.css'

const pageUrl = (token: string) => `${window.location.origin}/investors/${token}`

/** Site Managers only: the private investor page's share link. */
export function InvestorLinkPage() {
  const link = useFetch<{ token: string }>('/investor-link/')
  const [token, setToken] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [replacing, setReplacing] = useState(false)
  const current = token ?? link.data?.token

  const copy = async () => {
    if (!current) return
    await navigator.clipboard.writeText(pageUrl(current))
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  const replace = async () => {
    if (!window.confirm('Make a new investor link? Anyone using the current link will lose access.')) return
    setReplacing(true)
    try {
      setToken((await api<{ token: string }>('/investor-link/', { method: 'POST' })).token)
    } finally {
      setReplacing(false)
    }
  }

  return (
    <section className="investor-link">
      <h1>Investor page</h1>
      <p className="subtitle">Only Site Managers see this. Share the link with investors.</p>

      <div className="tile investor-link__card">
        {link.error && !current && <p className="form__error">Couldn’t load the investor link.</p>}
        {!current && !link.error && <p className="loading">Loading…</p>}
        {current && (
          <>
            <p className="investor-link__url">{pageUrl(current)}</p>
            <div className="inline-form__actions">
              <button type="button" className="button" onClick={copy}>
                {copied ? 'Copied!' : 'Copy link'}
              </button>
              <a href={pageUrl(current)} target="_blank" rel="noreferrer" className="button button--secondary">
                Open page
              </a>
              <button type="button" className="button button--secondary" onClick={replace} disabled={replacing}>
                {replacing ? 'Replacing…' : 'Replace link'}
              </button>
            </div>
          </>
        )}
        <ul className="investor-link__notes">
          <li>Anyone with the link can view the page without an account, so share it only with investors.</li>
          <li>The page isn’t linked anywhere else on the site and asks search engines not to list it.</li>
          <li>If a link gets passed around, use Replace link. The old one stops working right away.</li>
        </ul>
      </div>
    </section>
  )
}
