import { Link } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { CalloutBand } from '../components/CalloutBand'
import { NavIcon, type NavIconName } from '../components/NavIcon'
import { TRIAL_END_LABEL } from './trial'

const SUPPORT_EMAIL = 'support.knet@gmail.com'

const FEATURES: [string, string, NavIconName][] = [
  ['Staff Hub', 'Weather, a QR code to invite teammates, announcements, alerts and the latest call sheet, your tasks, the daily rundown, the week ahead and today’s crew.', 'home'],
  ['Schedule', 'Daily, weekly and monthly views with staff, department and influencer filters, the Master Timeline, and Staff / Crew: who’s called each day.', 'calendar'],
  ['Tasks', 'Directors, Assistants and department heads assign tasks to people or departments; they show up in My Tasks and on each person’s Staff Hub.', 'tasks'],
  ['Departments', 'A page for each department with its schedule, crew, tasks and department heads. Culinary adds menus, shopping lists and food allergies; Finance holds the money pages.', 'departments'],
  ['Influencer Roster', 'Profiles for each creator: contacts, agents, notes, needs, schedules, travel, and their show, season and week.', 'star'],
  ['Directory, Locations and Resources', 'Contact details and roles for everyone, lodging and shooting locations on a map, and the vendors and services the production uses.', 'pin'],
  ['Paperwork', 'Everyone sends in receipts and documents, gets a confirmation, and follows each one in their own history until it’s handled.', 'receipt'],
  ['Documents', 'For Directors and Assistants: permits, insurance, contracts, invoices and receipts, stored privately, with expiry alerts.', 'document'],
  ['Finance', 'Its own department, open only to the Finance team, Directors and Assistants: payroll, money in and out, invoices and a finance calendar.', 'dollar'],
  ['Director Dashboard', 'For Directors and Assistants: departments, staff, block scheduling, call sheets, task management, shows and meeting notes.', 'clipboard'],
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
      <h1>The K-Net trial</h1>
      <p className="subtitle">Alpha testing runs through {TRIAL_END_LABEL}</p>

      <div className="tile trial-page__intro">
        <p>
          K-Net is a production-coordination platform for large film shoots. It brings scheduling, logistics, staff
          management, communication and documents into one place, so the whole crew works from the same information.
        </p>
        <p>
          During the trial you’re using an early version of the app. Things may change, and you may find rough edges;
          that’s what the trial is for. Your feedback decides what gets fixed and built next.
        </p>
        {!user && (
          <p className="trial-page__actions">
            <Link to="/signup" className="button">
              Get started
            </Link>
          </p>
        )}
      </div>

      <CalloutBand
        id="trial-investors-heading"
        icon={<NavIcon name="trend" size={26} />}
        eyebrow="For investors"
        title="Interested in investing in K-Net?"
        action={
          <Link to="/for-investors" className="button callout__button">
            Investors click here <span aria-hidden="true">→</span>
          </Link>
        }
      >
        See the offer, what K-Net could save a production, and how to get in touch.
      </CalloutBand>

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
