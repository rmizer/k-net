import { Link } from 'react-router-dom'
import { formatDay } from '../../format'
import type { Show } from '../../types'

/** A show's facts and people, on its tile and on its own page. */
export function ShowDetails({ show }: { show: Show }) {
  return (
    <dl className="show-tile__details">
      <div>
        <dt>Starts</dt>
        <dd>{show.start_date ? formatDay(show.start_date, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Not set'}</dd>
      </div>
      <div>
        <dt>Location</dt>
        <dd>{show.shooting_location || 'Not set'}</dd>
      </div>
      <div>
        <dt>Seasons</dt>
        <dd>
          {show.seasons ?? '—'}
          {show.weeks_per_season ? ` × ${show.weeks_per_season} weeks` : ''}
        </dd>
      </div>
      <div>
        <dt>Director</dt>
        <dd>{show.director_name ?? 'Not set'}</dd>
      </div>
      <div>
        <dt>Other directors</dt>
        <dd>{show.other_director_details.map((person) => person.name).join(', ') || 'None'}</dd>
      </div>
      <div>
        <dt>Department heads</dt>
        <dd>
          {show.department_head_details
            .map((person) => `${person.name} (${person.head_of_department_name ?? 'No department listed'})`)
            .join(', ') || 'None'}
        </dd>
      </div>
      <div>
        <dt>Influencers</dt>
        <dd>
          {show.influencer_count ? (
            <Link to={`/influencers?show=${show.id}`}>{show.influencer_count} on the roster</Link>
          ) : (
            'None'
          )}
        </dd>
      </div>
    </dl>
  )
}
