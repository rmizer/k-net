import type { User } from '../auth/roles'
import { initials } from '../format'

type Person = Pick<User, 'first_name' | 'last_name' | 'profile_picture'>

/** Profile picture, or initials on dark red when there isn't one. */
export function Avatar({ person, size = 48 }: { person: Person; size?: number }) {
  const style = { width: size, height: size, fontSize: size * 0.38 }
  if (person.profile_picture) {
    return <img src={person.profile_picture} alt="" className="avatar" style={style} />
  }
  return (
    <span className="avatar avatar--initials" style={style} aria-hidden="true">
      {initials(person.first_name, person.last_name)}
    </span>
  )
}
