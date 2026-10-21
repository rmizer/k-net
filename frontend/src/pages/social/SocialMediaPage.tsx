import './social.css'

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

export function SocialMediaPage() {
  return (
    <section className="social">
      <div className="page-header">
        <div>
          <h1>Social Media</h1>
          <p className="subtitle">The production’s official pages</p>
        </div>
      </div>

      <ul className="social__accounts">
        {ACCOUNTS.map((account) => (
          <li key={account.url} className="tile social__account">
            <p className="social__platform">{account.platform}</p>
            <h3>{account.handle}</h3>
            <a href={account.url} target="_blank" rel="noreferrer">
              Visit <span aria-hidden="true">↗</span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  )
}
