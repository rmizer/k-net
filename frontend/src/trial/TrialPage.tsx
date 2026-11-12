import { Link } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { CalloutBand } from '../components/CalloutBand'
import { NavIcon, type NavIconName } from '../components/NavIcon'

const SUPPORT_EMAIL = 'support.knet@gmail.com'

const FEATURES: [string, string, NavIconName][] = [
  ['Staff Hub', 'Weather, a QR code to invite teammates, announcements, alerts and the latest call sheet, your tasks, the daily rundown, the week ahead and today’s crew.', 'home'],
  ['Schedule', 'Daily, weekly and monthly views with staff, department and influencer filters, the Master Timeline, and Staff / Crew: who’s called each day.', 'calendar'],
  ['Tasks', 'Directors, Assistants and department heads assign tasks to people or departments; they show up in My Tasks and on each person’s Staff Hub.', 'tasks'],
  ['Departments', 'A page for each department with its schedule, crew, tasks and department heads. Culinary adds menus, shopping lists and food allergies; Security adds incident reports; Finance holds the money pages.', 'departments'],
  ['Security incident reports', 'The Security team reports breaches, trespassers, threats and other incidents, with photos and videos. High and Critical reports alert managers by Slack and email, and any report prints for insurance or the police.', 'guard'],
  ['Influencer Roster', 'Profiles for each creator: contacts, agents, notes, needs, schedules, travel, and their show, season and week.', 'star'],
  ['Directory, Locations and Resources', 'Contact details and roles for everyone, lodging and shooting locations on a map, and the vendors and services the production uses.', 'pin'],
  ['Paperwork', 'Everyone sends in receipts and documents, gets a confirmation, and follows each one in their own history until it’s handled.', 'receipt'],
  ['Documents', 'For Directors and Assistants: permits, insurance, contracts, invoices and receipts, stored privately, with expiry alerts.', 'document'],
  ['Finance', 'Its own department, open only to the Finance team, Directors and Assistants: payroll, money in and out, invoices and a finance calendar.', 'dollar'],
  ['Director Dashboard', 'For Directors and Assistants: departments, staff, block scheduling, call sheets, task management, shows, the Challenge Planner and Inventory.', 'clipboard'],
  ['Challenge Planner', 'Plan each week’s challenges: participants, rewards, where on site, a check-off supply list, a safety checklist, a clean-up plan and content warnings for the stream. Challenges move from In Planning to Planned to Completed.', 'star'],
  ['Inventory', 'Everything the company owns, by department: quantities, sizes, storage spots, expiration dates and linked receipts, plus model and serial numbers for gear. Out-of-stock items gray out, and deleted items can be restored.', 'layers'],
]

const NOT_INCLUDED: [string, string][] = [
  ['Live crew tracking', 'CrewFinder’s real-time map needs location trackers, which aren’t set up yet. It’s shown as a preview.'],
  ['Moving money', 'Finance keeps records only. K-Net doesn’t pay anyone, process payroll or connect to bank accounts.'],
  ['A mobile app', 'K-Net runs in your phone’s web browser; there’s no App Store or Google Play app yet.'],
  ['Password reset by email', `If you forget your password, email ${SUPPORT_EMAIL} and we’ll reset it for you.`],
]

export function TrialPage() {
  const { user } = useAuth()

  return (
    <section className="trial-page">
      <header className="trial-page__header">
        <h1>The K-Net trial</h1>
        <p className="subtitle trial-page__subtitle">
          K-Net is currently in <span className="trial-page__beta">beta</span> testing
        </p>
      </header>

      <div className="trial-page__top">
        <section className="callout trial-intro" aria-labelledby="trial-intro-heading">
          <span className="callout__icon" aria-hidden="true">
            <NavIcon name="clapper" size={26} />
          </span>
          <div className="callout__text trial-intro__text">
            <p className="callout__eyebrow">About K-Net · Beta</p>
            <h2 id="trial-intro-heading">One place for the whole production</h2>
            <p>
              K-Net is a production-coordination platform for large film shoots. It brings scheduling, logistics, staff
              management, communication and documents into one place, so the whole crew works from the same
              information.
            </p>
            <p>
              During the trial you’re using an early version of the app. Things may change, and you may find rough
              edges; that’s what the trial is for. Your feedback decides what gets fixed and built next.
            </p>
          </div>
          <p className="trial-page__actions trial-intro__actions">
            <Link to="/for-investors/presentation" className="button callout__button">
              <NavIcon name="document" size={18} />
              View the presentation
            </Link>
            {!user && (
              <Link to="/signup" className="button trial-intro__outline">
                Get started
              </Link>
            )}
          </p>
        </section>

        <CalloutBand
          id="trial-investors-heading"
          icon={<NavIcon name="trend" size={26} />}
          eyebrow="For investors"
          title="Interested in investing in K-Net?"
          action={
            <Link to="/for-investors" className="button callout__button">
              Investors click here
            </Link>
          }
        >
          See the offer, what K-Net could save a production, and how to get in touch.
        </CalloutBand>
      </div>

      <h2>What you can do</h2>
      <dl className="trial-page__list">
        {FEATURES.map(([name, text, icon]) => (
          <div key={name} className="tile">
            <dt>
              <span className="trial-page__icon" aria-hidden="true">
                <NavIcon name={icon} size={20} />
              </span>
              {name}
            </dt>
            <dd>{text}</dd>
          </div>
        ))}
      </dl>

      <h2>What the trial doesn’t include</h2>
      <dl className="trial-page__list trial-page__list--muted">
        {NOT_INCLUDED.map(([name, text]) => (
          <div key={name} className="tile">
            <dt>{name}</dt>
            <dd>{text}</dd>
          </div>
        ))}
      </dl>

      <h2>Feedback and help</h2>
      <div className="tile">
        <p>
          {user ? (
            <>
              Use the <Link to="/contact">Contact page</Link> to report a bug, request a feature, ask for help or send
              feedback, or email
            </>
          ) : (
            'Email'
          )}{' '}
          <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
          {user ? '.' : ' with questions, bugs or ideas.'}
        </p>
        {user?.slack_invite_url && (
          <p>
            Join the conversation in the{' '}
            <a href={user.slack_invite_url} target="_blank" rel="noreferrer">
              K-Net Slack workspace
            </a>
            .
          </p>
        )}
      </div>
    </section>
  )
}
