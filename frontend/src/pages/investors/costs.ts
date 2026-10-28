// What K-Net costs: the offer's prices, plus hosting billed at cost. Shared by
// the investor page's summary and the full yearly costs page.

export const PURCHASE_PRICE = 15_000
export const WEEKLY_FEE = 500

export const money = (value: number) =>
  value.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

export const WEEKS = 52

/** Hosting, billed to the buyer at cost. Low and high ends of a year, at the
 *  providers' prices in October 2026 (Railway and Netlify bill by usage). */
export const HOSTING: { item: string; provider: string; low: number; high: number; detail: string }[] = [
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
export const DOMAIN = { item: 'Web address', provider: 'knetwork.online', firstYear: 1.2, renewal: 29 }

export const hostingLow = HOSTING.reduce((sum, row) => sum + row.low, 0)
export const hostingHigh = HOSTING.reduce((sum, row) => sum + row.high, 0)
export const maintenance = WEEKLY_FEE * WEEKS

export const dollars = (value: number) =>
  value.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 2 })
export const range = (low: number, high: number) => (low === high ? dollars(low) : `${dollars(low)}–${dollars(high)}`)

/** Low and high totals for the first year (with the purchase) and each year after. */
export const firstYear = [
  PURCHASE_PRICE + maintenance + hostingLow + DOMAIN.firstYear,
  PURCHASE_PRICE + maintenance + hostingHigh + DOMAIN.firstYear,
]
export const laterYears = [maintenance + hostingLow + DOMAIN.renewal, maintenance + hostingHigh + DOMAIN.renewal]
