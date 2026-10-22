import { useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import wordmark from '../../assets/brand/knet-wordmark.png'
import { useFetch } from '../../hooks/useFetch'
import { NotFoundPage } from '../NotFoundPage'
import { money, PURCHASE_PRICE, WEEKLY_FEE } from './InvestorPage'
import './investors.css'

const WEEKS = 52

/** Hosting, billed to the buyer at cost. Low and high ends of a year, at the
 *  providers' prices in October 2026 (Railway and Netlify bill by usage). */
const HOSTING: { item: string; provider: string; low: number; high: number; detail: string }[] = [
  {
    item: 'App server and database',
    provider: 'Railway (Hobby plan)',
    low: 60,
    high: 120,
    detail: '$5 a month, which includes $5 of usage. K-Net uses about $4–7 a month today; budgeted up to $10 for growth.',
  },
  {
    item: 'Website hosting',
    provider: 'Netlify (Personal plan)',
    low: 108,
    high: 108,
    detail: '$9 a month. Covers the site’s weekly updates and visitor traffic.',
  },
]
const DOMAIN = { item: 'Web address', provider: 'knetwork.online', firstYear: 1.2, renewal: 29 }

const hostingLow = HOSTING.reduce((sum, row) => sum + row.low, 0)
const hostingHigh = HOSTING.reduce((sum, row) => sum + row.high, 0)
const maintenance = WEEKLY_FEE * WEEKS

const dollars = (value: number) =>
  value.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 2 })
const range = (low: number, high: number) => (low === high ? dollars(low) : `${dollars(low)}–${dollars(high)}`)

/** What K-Net costs to run each year: the maintenance fee, plus hosting billed
 *  at cost. Linked from the investor page, with the same access. */
export function CostSummaryPage() {
  const { token } = useParams()
  const page = useFetch<{ status: string }>(token ? `/investors/${encodeURIComponent(token)}/` : '/investors/')
  const investorPage = token ? `/investors/${token}` : '/for-investors'

  useEffect(() => {
    const meta = document.createElement('meta')
    meta.name = 'robots'
    meta.content = 'noindex, nofollow'
    document.head.appendChild(meta)
    const title = document.title
    document.title = 'K-Net · Yearly costs'
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

  const firstYear = [PURCHASE_PRICE + maintenance + hostingLow + DOMAIN.firstYear, PURCHASE_PRICE + maintenance + hostingHigh + DOMAIN.firstYear]
  const laterYears = [maintenance + hostingLow + DOMAIN.renewal, maintenance + hostingHigh + DOMAIN.renewal]

  return (
    <main className="investor">
      <header className="investor__hero">
        <Link to={investorPage} className="investor__back">
          <span aria-hidden="true">←</span> Investor information
        </Link>
        <img src={wordmark} alt="K-Net: K Network Project Center" className="investor__logo" width={900} height={286} />
        <h1>What K-Net costs to run each year</h1>
        <p className="investor__lede">
          The weekly maintenance fee, plus hosting billed at cost. Hosting is a small share of the total: about{' '}
          {range(hostingLow + DOMAIN.renewal, hostingHigh + DOMAIN.renewal)} a year.
        </p>
      </header>

      <section className="investor__section" aria-labelledby="totals-heading">
        <h2 id="totals-heading">The totals</h2>
        <div className="investor__offer">
          <div className="tile investor__price">
            <p className="investor__price-label">First year</p>
            <p className="investor__price-value">{money(firstYear[0])}</p>
            <p className="investor__price-term">to {money(firstYear[1])}</p>
            <ul>
              <li>{money(PURCHASE_PRICE)} purchase, one time</li>
              <li>{money(maintenance)} maintenance</li>
              <li>{range(hostingLow + DOMAIN.firstYear, hostingHigh + DOMAIN.firstYear)} hosting</li>
            </ul>
          </div>
          <div className="tile investor__price">
            <p className="investor__price-label">Each year after</p>
            <p className="investor__price-value">{money(laterYears[0])}</p>
            <p className="investor__price-term">to {money(laterYears[1])}</p>
            <ul>
              <li>{money(maintenance)} maintenance</li>
              <li>{range(hostingLow + DOMAIN.renewal, hostingHigh + DOMAIN.renewal)} hosting</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="investor__section" aria-labelledby="breakdown-heading">
        <h2 id="breakdown-heading">The breakdown</h2>
        <div className="tile">
          <div className="table-wrap">
            <table className="data-table investor__table">
              <thead>
                <tr>
                  <th scope="col">Cost</th>
                  <th scope="col">Per year</th>
                  <th scope="col">Details</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <strong>Maintenance</strong>
                  </td>
                  <td className="investor__time">{money(maintenance)}</td>
                  <td>
                    {money(WEEKLY_FEE)} a week for {WEEKS} weeks: weekly bug fixes, patches and updates, and new
                    features as your production needs them.
                  </td>
                </tr>
                {HOSTING.map((row) => (
                  <tr key={row.item}>
                    <td>
                      <strong>{row.item}</strong>
                      <br />
                      <span className="muted">{row.provider}</span>
                    </td>
                    <td className="investor__time">{range(row.low, row.high)}</td>
                    <td>{row.detail}</td>
                  </tr>
                ))}
                <tr>
                  <td>
                    <strong>{DOMAIN.item}</strong>
                    <br />
                    <span className="muted">{DOMAIN.provider}</span>
                  </td>
                  <td className="investor__time">
                    {dollars(DOMAIN.firstYear)}, then ~{dollars(DOMAIN.renewal)}
                  </td>
                  <td>A first-year sale price, then the registrar’s standard yearly renewal.</td>
                </tr>
                <tr>
                  <td>
                    <strong>Purchase</strong>
                  </td>
                  <td className="investor__time">{money(PURCHASE_PRICE)}</td>
                  <td>Once, in the first year: full ownership of the app and every future development to it.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="investor__section" aria-labelledby="notes-heading">
        <h2 id="notes-heading">Good to know</h2>
        <ul className="investor__notes">
          <li>
            Hosting is billed at cost, with no markup. Railway and Netlify charge by usage, so a much larger production
            (more crew, more uploads, more traffic) costs more; you’ll see it on each bill before it grows.
          </li>
          <li>Email (through K-Net’s support account) and Slack notifications run on free plans today.</li>
          <li>
            Prices are the providers’ published rates as of October 2026. Services K-Net might add later, such as a
            licensed weather feed or a dedicated email service, would be quoted before they’re added.
          </li>
        </ul>
      </section>

      <p className="investor__actions">
        <Link className="button button--secondary" to={investorPage}>
          Back to investor information
        </Link>
      </p>
    </main>
  )
}
