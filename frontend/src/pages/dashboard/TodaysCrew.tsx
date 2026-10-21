import { Link } from 'react-router-dom'
import type { CrewGroup } from '../../types'
import { DashboardSection } from './DashboardSection'

export function TodaysCrew({ groups }: { groups: CrewGroup[] }) {
  return (
    <DashboardSection title="Today’s Crew" action={<Link to="/crew">Full crew list</Link>}>
      {groups.length === 0 ? (
        <div className="tile">
          <p className="muted">No one is on the schedule today.</p>
        </div>
      ) : (
        <ul className="crew-tiles">
          {groups.map((group) => (
            <li key={group.department} className="tile crew-tile">
              <h3>{group.department}</h3>
              <p>{group.members.map((member) => member.first_name).join(', ')}</p>
            </li>
          ))}
        </ul>
      )}
    </DashboardSection>
  )
}
