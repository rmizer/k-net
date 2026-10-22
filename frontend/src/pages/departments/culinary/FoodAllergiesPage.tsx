import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useFetch } from '../../../hooks/useFetch'
import type { FoodAllergies, FoodAllergyPerson } from '../../../types'
import { CulinaryShell } from './CulinaryShell'

/** Everyone on the project with a food allergy: staff and crew from the
 *  Directory, and influencers. People add their own on their Account page;
 *  managers add them in the Directory and on influencer profiles. */
export function FoodAllergiesPage() {
  return (
    <CulinaryShell
      title="Food allergies"
      subtitle="Culinary · Staff, crew and influencers"
      actions={() => (
        <button type="button" className="button button--secondary" onClick={() => window.print()}>
          Print
        </button>
      )}
    >
      {() => <AllergyList />}
    </CulinaryShell>
  )
}

/** Who they are: their job and department, or the show for an influencer. */
function describe(person: FoodAllergyPerson) {
  if (person.kind === 'influencer') return ['Influencer', person.show_name].filter(Boolean).join(' · ')
  return [person.title || person.role_display, person.department_name, person.is_active_crew ? 'Crew' : null]
    .filter(Boolean)
    .join(' · ')
}

function AllergyList() {
  const allergies = useFetch<FoodAllergies>('/culinary/food-allergies/')
  const [search, setSearch] = useState('')

  if (allergies.loading && !allergies.data) return <p className="loading">Loading food allergies…</p>
  if (!allergies.data) return <p className="form__error">Couldn’t load the food allergies.</p>

  const { people, total } = allergies.data
  const query = search.trim().toLowerCase()
  const shown = query
    ? people.filter((person) =>
        [person.name, describe(person), person.food_allergies].some((text) => text.toLowerCase().includes(query)),
      )
    : people

  return (
    <section className="department__section">
      <p className="muted">
        {people.length} of {total} {total === 1 ? 'person lists' : 'people list'} a food allergy.
      </p>

      {people.length > 0 && (
        <label className="form__field no-print">
          <span>Search</span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Name, department or allergy (e.g. peanut)"
          />
        </label>
      )}

      {people.length === 0 ? (
        <p className="tile muted">No food allergies listed yet.</p>
      ) : shown.length === 0 ? (
        <p className="tile muted">No one matches “{search.trim()}”.</p>
      ) : (
        <div className="tile table-wrap">
          <table className="data-table food-allergies">
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Who</th>
                <th scope="col">Food allergies</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((person) => (
                <tr key={`${person.kind}-${person.id}`}>
                  <td>
                    {person.kind === 'influencer' ? (
                      <Link to={`/influencers/${person.id}`}>
                        <strong>{person.name}</strong>
                      </Link>
                    ) : (
                      <strong>{person.name}</strong>
                    )}
                  </td>
                  <td>{describe(person)}</td>
                  <td className="food-allergies__list">{person.food_allergies}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
