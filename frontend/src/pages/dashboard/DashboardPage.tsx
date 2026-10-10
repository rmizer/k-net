import { useAuth } from '../../auth/useAuth'
import { isManagerLevel } from '../../auth/roles'
import { formatDay } from '../../format'
import { useFetch } from '../../hooks/useFetch'
import type { Dashboard } from '../../types'
import { AnnouncementsSection } from './AnnouncementsSection'
import { DailyRundown } from './DailyRundown'
import { SlackLink } from './SlackLink'
import { StaffTasks, YourTasks } from './TaskSections'
import { TodaysCrew } from './TodaysCrew'
import { WeatherSection } from './WeatherSection'
import { WeekPreview } from './WeekPreview'
import './dashboard.css'

export function DashboardPage() {
  const { user, setUser } = useAuth()
  const { data, error, loading, reload } = useFetch<Dashboard>('/dashboard/')
  const manager = isManagerLevel(user)

  if (loading && !data) return <p className="loading">Loading the Staff Hub…</p>
  if (!data) return <p className="form__error">Couldn’t load the Staff Hub. {error?.message}</p>

  const { production } = data
  const timeZone = production.time_zone

  return (
    <div className="dashboard">
      <header className="dashboard__header">
        <h1>Staff Hub</h1>
        <p className="subtitle">
          {formatDay(production.today, { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
      </header>

      {user?.slack_invite_url && !user.slack_joined && (
        <SlackLink
          url={user.slack_invite_url}
          onJoined={(updated) => {
            setUser(updated)
            reload() // Their "Join the K-Net Slack" task is now done.
          }}
        />
      )}
      <WeatherSection canEdit={manager} onLocationChange={reload} />
      <AnnouncementsSection
        announcements={data.announcements}
        alerts={data.alerts}
        timeZone={timeZone}
        canEdit={manager}
        onChange={reload}
      />
      <DailyRundown events={data.daily_rundown} today={production.today} timeZone={timeZone} />
      <YourTasks tasks={data.my_tasks} onChange={reload} />
      {data.staff_tasks && <StaffTasks summary={data.staff_tasks} />}
      <WeekPreview
        events={data.week_events}
        weekStart={production.week_start}
        today={production.today}
        timeZone={timeZone}
        ownScheduleOnly={!manager}
      />
      <TodaysCrew groups={data.todays_crew} />
    </div>
  )
}
