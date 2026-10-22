import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import wordmark from '../../assets/brand/knet-wordmark.png'
import { useFetch } from '../../hooks/useFetch'
import { TRIAL_END_LABEL } from '../../trial/trial'
import { NotFoundPage } from '../NotFoundPage'
import './investors.css'

const CONTACT_EMAIL = 'support.knet@gmail.com'
export const PURCHASE_PRICE = 10_000
export const WEEKLY_FEE = 1_000

const REPLACES: [string, string, string][] = [
  [
    'Schedules in group texts and emailed PDFs',
    'One live schedule',
    'Daily, weekly and monthly views everyone sees the moment it changes. Block scheduling books a month of shifts (e.g. Oct 5–30, weekdays, 9 to 5) in one step.',
  ],
  [
    'Tasks lost in chat threads',
    'Assigned tasks with owners',
    'Tasks go to a person or a whole department, show on their Staff Hub, flag when overdue and can message them on Slack.',
  ],
  [
    'Contact spreadsheets that are always out of date',
    'A self-updating directory',
    'Crew sign up from a QR code with a verified email. Departments, roles, lodging and emergency contacts in one place, visible only to the roles that need them.',
  ],
  [
    'Paper receipts and reimbursement chasing',
    'Receipts from a phone',
    'Crew upload receipts; managers see each one move from Submitted to Processed and attach it to a paycheck.',
  ],
  [
    'Permits and insurance that lapse unnoticed',
    'Documents with expiry alerts',
    'Permits, insurance, contracts, invoices and vehicle paperwork filed by type, with “expiring soon” warnings.',
  ],
  [
    'Talent travel buried in email',
    'An influencer roster',
    'Each creator’s contacts, agent, needs, flights, hotels and schedule on one profile, in a sortable table.',
  ],
]

// Everything here is covered by the weekly maintenance fee.
const TURNAROUND: [string, string, string][] = [
  ['Bug fixes', '1 week', 'Shipped in the weekly update. Site-breaking issues are fixed the same day.'],
  ['Wording, labels and small layout changes', '1 day', 'Shipped in the weekly update.'],
  ['A new field, filter or column on an existing page', '1–3 days', 'Shipped in the weekly update.'],
  ['A new page or report built on existing data', '1–2 weeks', 'Planned with you, then shipped in weekly updates.'],
  [
    'Large features (live GPS crew tracking, a native phone app, payment processing)',
    '4–8+ weeks',
    'Planned with you and built in stages, shipped in weekly updates.',
  ],
]

// Possible directions, not commitments; the buyer chooses what gets built.
const FUTURE: [string, string][] = [
  ['CrewFinder: live crew tracking', 'See where crew are on a map during the shoot, with opt-in sharing that switches off when a shift ends.'],
  ['Shift handovers', 'A handover log for round-the-clock shoots: what happened, what’s pending and who’s on next, read before every shift.'],
  ['Clock-in / clock-out system for staff', 'Staff clock in and out from their phone, giving payroll accurate hours to work from; turnaround and overtime are tracked and flagged automatically.'],
  ['Call sheets', 'Generate the daily call sheet from the live schedule, locations and directory, and send it to everyone on it.'],
  ['Budget tracking', 'Spending from receipts and invoices measured against each department’s budget as the shoot goes.'],
  ['Payments and payroll exports', 'Pay reimbursements and export hours to payroll providers, instead of re-keying them.'],
  ['Offline mode', 'Schedules, contacts and documents stay readable on remote locations with no signal, and sync when back online.'],
  ['Calendar sync', 'Each person’s shifts appear in Google Calendar or Outlook and update when the schedule changes.'],
  ['Multi-production dashboard', 'A studio-level view across several productions at once, with crew and resources shared between them.'],
]

export const money = (value: number) =>
  value.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
const number = (value: number) => Math.round(value).toLocaleString('en-US')

/** The investor page. Open to anyone at /for-investors (linked from About the
 *  trial); older share links at /investors/<token> still work while current. */
export function InvestorPage() {
  const { token } = useParams()
  const page = useFetch<{ status: string }>(token ? `/investors/${encodeURIComponent(token)}/` : '/investors/')

  // Ask search engines not to index or follow the page.
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
      <header className="investor__hero">
        <Link to="/trial" className="investor__back">
          <span aria-hidden="true">←</span> About the trial
        </Link>
        <img src={wordmark} alt="K-Net: K Network Project Center" className="investor__logo" width={900} height={286} />
        <h1>Run the whole production from one place</h1>
        <p className="investor__lede">
          K-Net is a production-coordination platform for large film shoots. Scheduling, tasks, crew, documents,
          talent travel and finance records live in one web app that works on any phone, so everyone works from the
          same, current information.
        </p>
        <p className="investor__actions">
          <a className="button" href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('K-Net investment')}`}>
            Talk to us
          </a>
          <a className="button button--secondary" href="#offer">
            See the offer
          </a>
        </p>
      </header>

      <section className="investor__section" aria-labelledby="replaces-heading">
        <h2 id="replaces-heading">What K-Net replaces</h2>
        <ul className="investor__replaces">
          {REPLACES.map(([before, after, detail]) => (
            <li key={after} className="tile">
              <p className="investor__before">{before}</p>
              <h3>{after}</h3>
              <p>{detail}</p>
            </li>
          ))}
        </ul>
      </section>

      <SavingsEstimate />

      <section id="offer" className="investor__section" aria-labelledby="offer-heading">
        <h2 id="offer-heading">The offer</h2>
        <div className="investor__offer">
          <div className="tile investor__price">
            <p className="investor__price-label">Purchase</p>
            <p className="investor__price-value">{money(PURCHASE_PRICE)}</p>
            <p className="investor__price-term">one time</p>
            <ul>
              <li>Full ownership of the K-Net app</li>
              <li>Ownership of every future development made to it</li>
              <li>Your production’s data stays yours</li>
            </ul>
          </div>
          <div className="tile investor__price">
            <p className="investor__price-label">Maintenance</p>
            <p className="investor__price-value">{money(WEEKLY_FEE)}</p>
            <p className="investor__price-term">per week</p>
            <ul>
              <li>Bug fixes once a week, and the same day for anything that breaks the site</li>
              <li>A patch and update to the site once a week</li>
              <li>Hosting billed separately at cost: the server, database and the knetwork.online web address</li>
              <li>New features as your production needs them, at no extra cost</li>
            </ul>
          </div>
        </div>
        <p className="investor__intro">
          <Link to={token ? `/investors/${token}/costs` : '/for-investors/costs'}>
            See what K-Net costs to run each year →
          </Link>
        </p>
      </section>

      <section className="investor__section" aria-labelledby="turnaround-heading">
        <h2 id="turnaround-heading">How long changes take</h2>
        <p className="investor__intro">
          K-Net went from its first line of code to a working alpha trial in under a week (Oct 3 to Oct 9, 2026). These
          are typical times for changes after purchase, and all of them are included in the weekly fee.
        </p>
        <div className="tile">
          <div className="table-wrap">
            <table className="data-table investor__table">
              <thead>
                <tr>
                  <th scope="col">Change</th>
                  <th scope="col">Typical time</th>
                  <th scope="col">How it’s delivered</th>
                </tr>
              </thead>
              <tbody>
                {TURNAROUND.map(([change, time, how]) => (
                  <tr key={change}>
                    <td>{change}</td>
                    <td className="investor__time">{time}</td>
                    <td>{how}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="investor__section" aria-labelledby="today-heading">
        <h2 id="today-heading">Where K-Net is today</h2>
        <div className="investor__today">
          <div className="tile">
            <h3>Working now</h3>
            <p>
              In alpha testing with real crew through {TRIAL_END_LABEL}: dashboard, schedule and block scheduling,
              tasks, directory and departments, influencer roster, locations and resources, documents, finance records,
              email-verified sign-up and Slack notifications.
            </p>
            <p>
              <Link to="/trial">About the trial</Link>
            </p>
          </div>
          <div className="tile">
            <h3>Next</h3>
            <p>
              Live crew tracking on a map (CrewFinder), password reset by email, and feature requests from trial
              feedback.
            </p>
          </div>
          <div className="tile">
            <h3>At launch</h3>
            <p>
              The trial runs on a temporary hosting address. For final deployment K-Net moves to its own web
              address, knetwork.online, with a secure (https) connection and email sent from that domain.
            </p>
          </div>
        </div>
      </section>

      <section className="investor__section" aria-labelledby="future-heading">
        <h2 id="future-heading">Where K-Net could go</h2>
        <p className="investor__intro">
          Possible future developments. None are promised; after purchase you choose what gets built and in what order,
          and it’s all covered by the weekly fee.
        </p>
        <ul className="investor__replaces">
          {FUTURE.map(([title, detail]) => (
            <li key={title} className="tile">
              <h3>{title}</h3>
              <p>{detail}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="investor__section" aria-labelledby="invest-heading">
        <h2 id="invest-heading">Investing in K-Net</h2>
        <div className="tile investor__invest">
          <p>
            Interested in backing K-Net rather than buying it for one production? We’re open to conversations about
            funding its next stage: live crew tracking, a native phone app, and bringing K-Net to more productions.
          </p>
          <p>
            Email <a href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('Investing in K-Net')}`}>{CONTACT_EMAIL}</a>{' '}
            and we’ll share where K-Net stands, results from the trial, and what investment would go toward.
          </p>
        </div>
      </section>

      <section className="tile investor__contact" aria-labelledby="contact-heading">
        <h2 id="contact-heading">Questions, or ready to talk?</h2>
        <p>
          Email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> for a walkthrough of the app or to discuss the
          offer.
        </p>
      </section>
    </main>
  )
}

const DEFAULTS = {
  crew: 45,
  managers: 5,
  weeks: 6,
  days: 7,
  crewMinutes: 20,
  managerHours: 10,
  crewRate: 35,
  managerRate: 55,
}

type Inputs = typeof DEFAULTS

const FIELDS: { name: keyof Inputs; label: string; hint: string; max: number; step?: number }[] = [
  { name: 'crew', label: 'Crew and staff', hint: 'People on the production', max: 2000 },
  { name: 'managers', label: 'Managers', hint: 'Directors, assistants, coordinators', max: 200 },
  { name: 'weeks', label: 'Shoot length (weeks)', hint: 'Weeks K-Net is in use', max: 104 },
  { name: 'days', label: 'Working days per week', hint: '', max: 7 },
  {
    name: 'crewMinutes',
    label: 'Minutes saved per crew member, per day',
    hint: 'Not hunting for call times, places, contacts, and what changed since their last shift',
    max: 240,
  },
  {
    name: 'managerHours',
    label: 'Hours saved per manager, per week',
    hint: 'Not rebuilding and re-sending schedules, briefing each shift, chasing tasks, receipts and paperwork',
    max: 60,
    step: 0.5,
  },
  { name: 'crewRate', label: 'Crew cost per hour ($)', hint: 'Average, loaded', max: 1000 },
  { name: 'managerRate', label: 'Manager cost per hour ($)', hint: 'Average, loaded', max: 1000 },
]

/** An adjustable estimate of the time K-Net saves against what it costs. */
function SavingsEstimate() {
  const [inputs, setInputs] = useState<Inputs>(DEFAULTS)
  const { crew, managers, weeks, days, crewMinutes, managerHours, crewRate, managerRate } = inputs

  const crewHours = (crew * crewMinutes * days * weeks) / 60
  const managerTotal = managers * managerHours * weeks
  const hours = crewHours + managerTotal
  const value = crewHours * crewRate + managerTotal * managerRate
  const cost = PURCHASE_PRICE + WEEKLY_FEE * weeks
  const net = value - cost
  const weeklyGain = value / Math.max(weeks, 1) - WEEKLY_FEE
  const breakEven = weeklyGain > 0 ? PURCHASE_PRICE / weeklyGain : null

  const set = (name: keyof Inputs, raw: string, max: number) => {
    const parsed = Number(raw)
    setInputs({ ...inputs, [name]: Number.isFinite(parsed) ? Math.min(Math.max(parsed, 0), max) : 0 })
  }

  return (
    <section className="investor__section" aria-labelledby="estimate-heading">
      <h2 id="estimate-heading">What it could save a production</h2>
      <p className="investor__intro">
        An estimate, not a measured result: K-Net is still in its alpha trial. Change any number to match your
        production; the defaults are a six-week shoot filming around the clock, seven days a week, with a rotating
        staff of about 50.
      </p>

      <div className="investor__estimate">
        <form className="tile investor__inputs" onSubmit={(e) => e.preventDefault()}>
          {FIELDS.map((field) => (
            <label key={field.name} className="form__field">
              <span>{field.label}</span>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                max={field.max}
                step={field.step ?? 1}
                value={inputs[field.name]}
                onChange={(e) => set(field.name, e.target.value, field.max)}
              />
              {field.hint && <small className="form__hint">{field.hint}</small>}
            </label>
          ))}
          <button type="button" className="text-button" onClick={() => setInputs(DEFAULTS)}>
            Reset to the defaults
          </button>
        </form>

        <div className="investor__results" aria-live="polite">
          <div className="tile investor__hero-figure">
            <p className="investor__figure-label">Value of time saved over the shoot</p>
            <p className="investor__figure-value">{money(value)}</p>
            <p className="investor__figure-note">
              {number(hours)} working hours ({number(hours / 10)} ten-hour days) given back to the crew
            </p>
          </div>
          <dl className="investor__stats">
            <div className="tile">
              <dt>K-Net cost for this shoot</dt>
              <dd>{money(cost)}</dd>
              <dd className="investor__stat-note">
                {money(PURCHASE_PRICE)} + {weeks} {weeks === 1 ? 'week' : 'weeks'} × {money(WEEKLY_FEE)}
              </dd>
            </div>
            <div className="tile">
              <dt>Savings minus cost</dt>
              <dd className={net < 0 ? 'investor__negative' : undefined}>
                {net < 0 ? '−' : ''}
                {money(Math.abs(net))}
              </dd>
              <dd className="investor__stat-note">For this shoot alone</dd>
            </div>
            <div className="tile">
              <dt>Purchase pays for itself in</dt>
              <dd>{breakEven === null ? '—' : `${breakEven < 10 ? breakEven.toFixed(1) : Math.round(breakEven)} weeks`}</dd>
              <dd className="investor__stat-note">
                {breakEven === null ? 'Weekly savings don’t cover the weekly fee' : 'Then saves money every week after'}
              </dd>
            </div>
          </dl>
          <div className="tile investor__how">
            <h3>How it’s worked out</h3>
            <ul>
              <li>
                Crew: {number(crew)} people × {crewMinutes} min × {days} days × {weeks} weeks ={' '}
                <strong>{number(crewHours)} hours</strong> at {money(crewRate)}/hr
              </li>
              <li>
                Managers: {number(managers)} people × {managerHours} hr × {weeks} weeks ={' '}
                <strong>{number(managerTotal)} hours</strong> at {money(managerRate)}/hr
              </li>
              <li>
                Not counted: fewer missed calls and no-shows from outdated schedules, lapsed permits caught in time,
                faster onboarding, and one clean record at wrap.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  )
}
