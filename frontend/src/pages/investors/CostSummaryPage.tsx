import { useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import wordmark from '../../assets/brand/knet-wordmark.png'
import { useFetch } from '../../hooks/useFetch'
import { NotFoundPage } from '../NotFoundPage'
import {
  DOMAIN,
  dollars,
  firstYear,
  HOSTING,
  hostingHigh,
  hostingLow,
  laterYears,
  maintenance,
  money,
  PURCHASE_PRICE,
  range,
  WEEKLY_FEE,
  WEEKS,
} from './costs'
import './investors.css'

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

      <p className="investor__actions">
        <Link className="button button--secondary" to={investorPage}>
          Back to investor information
        </Link>
      </p>
    </main>
  )
}
