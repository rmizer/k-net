import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api'
import type { User } from '../../auth/roles'
import { CalloutBand } from '../../components/CalloutBand'

/** Invites everyone into the K-Net Slack workspace, at the top of the Staff Hub,
 *  until they say they've joined (which also finishes their "Join the K-Net Slack" task). */
export function SlackLink({ url, onJoined }: { url: string; onJoined: (user: User) => void }) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const markJoined = async () => {
    setSaving(true)
    setError('')
    try {
      onJoined(await api<User>('/auth/me/', { method: 'PATCH', body: JSON.stringify({ slack_joined: true }) }))
    } catch {
      setError('Couldn’t save that. Please try again.')
      setSaving(false)
    }
  }

  return (
    <CalloutBand
      id="slack-callout-heading"
      icon={
        <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinejoin="round" d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.6A8 8 0 1 1 21 12Z" />
          <path strokeLinecap="round" d="M8.5 12h.01M12 12h.01M15.5 12h.01" />
        </svg>
      }
      eyebrow="Important · Your first task"
      title="Join the K-Net Slack"
      action={
        <span className="callout__actions">
          <a href={url} target="_blank" rel="noreferrer" className="button callout__button">
            Join Slack <span aria-hidden="true">→</span>
          </a>
          <button type="button" className="callout__secondary" onClick={markJoined} disabled={saving}>
            {saving ? 'Saving…' : 'I’ve joined'}
          </button>
        </span>
      }
    >
      Slack is where the crew talks day to day: quick questions, last-minute changes and updates. Join with the same
      email you use for K-Net so your task messages reach you, then tap “I’ve joined” to check it off.{' '}
      <Link to="/help/join-slack" className="callout__link">
        Step-by-step help
      </Link>
      {error && (
        <span className="callout__error" role="alert">
          {' '}
          {error}
        </span>
      )}
    </CalloutBand>
  )
}
