import { useState } from 'react'
import './marketing.css'

interface SocialAccount {
  platform: string
  handle: string
  url: string
}

// The production's official website and pages. Add new platforms here.
const ACCOUNTS: SocialAccount[] = [
  { platform: 'Website', handle: 'battlehouselive.com', url: 'https://battlehouselive.com/' },
  { platform: 'Instagram', handle: '@battlehouselive', url: 'https://www.instagram.com/battlehouselive/' },
]

/** Site Managers, Directors, Assistants and the Marketing department. */
export function MarketingPage() {
  return (
    <section className="marketing">
      <div className="page-header">
        <div>
          <h1>Marketing</h1>
          <p className="subtitle">The production’s official website and social media</p>
        </div>
      </div>

      <ul className="marketing__accounts">
        {ACCOUNTS.map((account) => (
          <li key={account.url} className="tile marketing__account">
            <p className="marketing__platform">{account.platform}</p>
            <h3>{account.handle}</h3>
            <p className="marketing__url">{account.url}</p>
            <span className="marketing__actions">
              <a href={account.url} target="_blank" rel="noreferrer" className="button button--secondary">
                Visit <span aria-hidden="true">↗</span>
              </a>
              <CopyButton url={account.url} label={account.handle} />
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

function CopyButton({ url, label }: { url: string; label: string }) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2500)
    } catch {
      window.prompt('Copy this link:', url)
    }
  }

  return (
    <button type="button" className="button" onClick={copy} aria-label={`Copy the link to ${label}`} aria-live="polite">
      {copied ? 'Copied ✓' : 'Copy link'}
    </button>
  )
}
