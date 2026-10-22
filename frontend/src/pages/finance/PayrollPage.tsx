import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useFetch } from '../../hooks/useFetch'
import type { PayrollPerson } from '../../types'
import { money, shortDate, Stat } from './shared'
import { SortHeader, useSort } from '../../components/sorting'
import { NavIcon } from '../../components/NavIcon'
import './finance.css'

type SortKey = 'name' | 'department' | 'rate' | 'next' | 'receipts' | 'paid' | 'last'

const UNIT_SHORT = { day: '/day', hour: '/hr', week: '/wk' } as const

export const rateText = (person: { pay_rate: PayrollPerson['pay_rate'] }) =>
  person.pay_rate ? `${money(person.pay_rate.rate)}${UNIT_SHORT[person.pay_rate.unit]}` : 'Not set'

export function PayrollPage() {
  const people = useFetch<PayrollPerson[]>('/finance/payroll/')
  const [search, setSearch] = useState('')
  const [department, setDepartment] = useState('')
  const [role, setRole] = useState('')
  const [crewOnly, setCrewOnly] = useState(false)
  const sort = useSort<SortKey>('name')
  const [printedOn] = useState(() => new Date().toLocaleDateString('en-US', { dateStyle: 'medium' }))

  const all = useMemo(() => people.data ?? [], [people.data])
  const departments = [...new Set(all.map((p) => p.department_name).filter(Boolean))].sort() as string[]
  const roles = [...new Map(all.map((p) => [p.role, p.role_display])).entries()]

  const query = search.trim().toLowerCase()
  const visible = sort.apply(
    all.filter(
      (p) =>
        (!query || `${p.name} ${p.email}`.toLowerCase().includes(query)) &&
        (!department || (department === 'none' ? !p.department_name : p.department_name === department)) &&
        (!role || p.role === role) &&
        (!crewOnly || p.is_active_crew),
    ),
    (p, key) =>
      ({
        name: p.name,
        department: p.department_name,
        rate: p.pay_rate ? Number(p.pay_rate.rate) : null,
        next: p.next_paycheck?.pay_date,
        receipts: Number(p.unreimbursed.total) || null,
        paid: Number(p.paid_to_date),
        last: p.last_paid_on,
      })[key],
  )

  const totals = {
    next: visible.reduce((sum, p) => sum + Number(p.next_paycheck?.total ?? 0), 0),
    receipts: visible.reduce((sum, p) => sum + Number(p.unreimbursed.total), 0),
    paid: visible.reduce((sum, p) => sum + Number(p.paid_to_date), 0),
  }
  const filters = [
    department && `Department: ${department === 'none' ? 'None' : department}`,
    role && `Role: ${roles.find(([value]) => value === role)?.[1]}`,
    crewOnly && 'Active crew only',
    query && `Search: “${search.trim()}”`,
  ].filter(Boolean)

  if (people.loading && !people.data) return <p className="loading">Loading payroll…</p>
  if (!people.data) return <p className="form__error">Couldn’t load payroll.</p>

  return (
    <section className="finance payroll">
      <div className="page-header">
        <div>
          <h1>
            <NavIcon name="wallet" />
            Payroll
          </h1>
          <p className="subtitle">Staff pay, paychecks and receipt reimbursements</p>
        </div>
        <button type="button" className="button button--secondary no-print" onClick={() => window.print()}>
          Print report
        </button>
      </div>

      {/* Only on paper: what the report covers. */}
      <p className="print-only fin-print-meta">
        Payroll report · {visible.length} {visible.length === 1 ? 'person' : 'people'}
        {filters.length ? ` · ${filters.join(' · ')}` : ''} · Printed{' '}
        {printedOn}
      </p>

      <dl className="fin-stats">
        <Stat label="Next paychecks" value={money(totals.next)} note="Scheduled, including reimbursements" />
        <Stat label="Receipts not yet on a paycheck" value={money(totals.receipts)} />
        <Stat label="Paid to date" value={money(totals.paid)} />
      </dl>

      <div className="fin-filters no-print" role="search">
        <label className="form__field">
          <span>Search</span>
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name or email" />
        </label>
        <label className="form__field">
          <span>Department</span>
          <select value={department} onChange={(e) => setDepartment(e.target.value)}>
            <option value="">All</option>
            {departments.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
            <option value="none">No department</option>
          </select>
        </label>
        <label className="form__field">
          <span>Role</span>
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="">All</option>
            {roles.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="form__check fin-filters__check">
          <input type="checkbox" checked={crewOnly} onChange={(e) => setCrewOnly(e.target.checked)} />
          <span>Active crew only</span>
        </label>
      </div>

      <div className="tile">
        {visible.length === 0 ? (
          <p className="muted">No one matches those filters.</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table fin-table payroll-table">
              <thead>
                <tr>
                  <SortHeader sort={sort} column="name">
                    Name
                  </SortHeader>
                  <SortHeader sort={sort} column="department">
                    Department
                  </SortHeader>
                  <SortHeader sort={sort} column="rate" className="fin-num">
                    Rate
                  </SortHeader>
                  <SortHeader sort={sort} column="next">
                    Next paycheck
                  </SortHeader>
                  <SortHeader sort={sort} column="receipts" className="fin-num">
                    Receipts to add
                  </SortHeader>
                  <SortHeader sort={sort} column="paid" className="fin-num">
                    Paid to date
                  </SortHeader>
                  <SortHeader sort={sort} column="last">
                    Last paid
                  </SortHeader>
                </tr>
              </thead>
              <tbody>
                {visible.map((person) => (
                  <tr key={person.id}>
                    <td data-label="Name">
                      <Link to={`/finance/payroll/${person.id}`} className="fin-person-link">
                        {person.name}
                      </Link>
                      <span className="fin-sub">{person.role_display}</span>
                    </td>
                    <td data-label="Department">{person.department_name ?? '—'}</td>
                    <td data-label="Rate" className={`fin-num${person.pay_rate ? '' : ' fin-missing'}`}>
                      {rateText(person)}
                    </td>
                    <td data-label="Next paycheck">
                      {person.next_paycheck ? (
                        <>
                          {money(person.next_paycheck.total)}
                          <span className="fin-sub">{shortDate(person.next_paycheck.pay_date)}</span>
                        </>
                      ) : (
                        <span className="muted">None scheduled</span>
                      )}
                    </td>
                    <td data-label="Receipts to add" className="fin-num">
                      {person.unreimbursed.count ? (
                        <>
                          {money(person.unreimbursed.total)}
                          <span className="fin-sub">
                            {person.unreimbursed.count} receipt{person.unreimbursed.count === 1 ? '' : 's'}
                          </span>
                        </>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td data-label="Paid to date" className="fin-num">
                      {money(person.paid_to_date)}
                    </td>
                    <td data-label="Last paid">{shortDate(person.last_paid_on)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row" colSpan={3}>
                    Total ({visible.length})
                  </th>
                  <td data-label="Next paychecks">{money(totals.next)}</td>
                  <td data-label="Receipts to add" className="fin-num">
                    {money(totals.receipts)}
                  </td>
                  <td data-label="Paid to date" className="fin-num">
                    {money(totals.paid)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}
