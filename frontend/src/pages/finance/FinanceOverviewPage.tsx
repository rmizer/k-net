import { Link } from 'react-router-dom'
import { useFetch } from '../../hooks/useFetch'
import type { FinanceOverview, Paycheck } from '../../types'
import { ReceiptProgress } from '../documents/DocumentsPage'
import { FinanceCalendar } from './FinanceCalendar'
import { InvoiceStatusBadge } from './InvoicesPage'
import { money, shortDate, Stat } from './shared'
import './finance.css'

/** Scheduled paychecks grouped by pay date. */
function paydays(paychecks: Paycheck[]) {
  const groups = new Map<string, Paycheck[]>()
  for (const paycheck of paychecks) groups.set(paycheck.pay_date, [...(groups.get(paycheck.pay_date) ?? []), paycheck])
  return [...groups.entries()]
}

export function FinanceOverviewPage() {
  const overview = useFetch<FinanceOverview>('/finance/overview/')

  if (overview.loading && !overview.data) return <p className="loading">Loading finance…</p>
  if (!overview.data) return <p className="form__error">Couldn’t load finance.</p>
  const data = overview.data

  const overdue = data.invoices_due.filter((i) => i.is_overdue)
  const receiptsTotal = data.receipts.reduce((sum, r) => sum + Number(r.amount ?? 0), 0)
  const newReceipts = data.receipts.filter((r) => r.status === 'submitted').length

  return (
    <section className="finance">
      <div className="page-header">
        <div>
          <h1>Finance</h1>
          <p className="subtitle">Money due, scheduled and received</p>
        </div>
      </div>

      <dl className="fin-stats">
        <Stat
          label="Vendor payments due this week"
          value={money(data.due_this_week)}
          note={overdue.length ? `${overdue.length} overdue` : `${data.invoices_due.length} open invoices`}
          alert={overdue.length > 0}
        />
        <Stat
          label="Next payroll"
          value={data.next_payroll ? money(data.next_payroll.total) : '—'}
          note={
            data.next_payroll
              ? `${shortDate(data.next_payroll.pay_date)} · ${data.next_payroll.count} ${data.next_payroll.count === 1 ? 'person' : 'people'}`
              : 'Nothing scheduled'
          }
        />
        <Stat
          label="Receipts waiting"
          value={money(receiptsTotal)}
          note={`${data.receipts.length} receipts${newReceipts ? ` · ${newReceipts} new` : ''}`}
        />
        <Stat
          label="This month"
          value={
            <span className="fin-inout">
              <span className="fin-in">+{money(data.month.incoming)}</span>
              <span className="fin-out">−{money(data.month.outgoing)}</span>
            </span>
          }
          note="In and out so far"
        />
      </dl>

      <div className="fin-grid">
        <section className="tile" aria-labelledby="due-heading">
          <div className="fin-section__head">
            <h2 id="due-heading">Vendor payments due</h2>
            <Link to="/finance/invoices">Invoices</Link>
          </div>
          {data.invoices_due.length === 0 ? (
            <p className="muted">All invoices are paid.</p>
          ) : (
            <ul className="fin-list">
              {data.invoices_due.map((invoice) => (
                <li key={invoice.id}>
                  <span className="fin-list__main">
                    <strong>{invoice.vendor}</strong>
                    <span className="fin-sub">
                      {invoice.due_on ? `Due ${shortDate(invoice.due_on)}` : 'No due date'}
                      {invoice.number ? ` · #${invoice.number}` : ''}
                    </span>
                  </span>
                  <InvoiceStatusBadge invoice={invoice} />
                  <span className="fin-num">{money(invoice.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="tile" aria-labelledby="paychecks-heading">
          <div className="fin-section__head">
            <h2 id="paychecks-heading">Staff paychecks due</h2>
            <Link to="/finance/payroll">Payroll</Link>
          </div>
          {data.upcoming_paychecks.length === 0 ? (
            <p className="muted">No paychecks scheduled.</p>
          ) : (
            paydays(data.upcoming_paychecks).map(([payDate, checks]) => (
              <div key={payDate} className="fin-payday">
                <h3>
                  {shortDate(payDate)}
                  <span>
                    {checks.length} {checks.length === 1 ? 'paycheck' : 'paychecks'} ·{' '}
                    {money(checks.reduce((sum, p) => sum + Number(p.total), 0))}
                  </span>
                </h3>
                <ul className="fin-list fin-list--compact">
                  {checks.map((paycheck) => (
                    <li key={paycheck.id}>
                      <Link to={`/finance/payroll/${paycheck.person}`} className="fin-list__main">
                        {paycheck.person_name}
                      </Link>
                      {paycheck.receipts.length > 0 && <span className="fin-sub">+ receipts</span>}
                      <span className="fin-num">{money(paycheck.total)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </section>

        <section className="tile" aria-labelledby="receipts-heading">
          <div className="fin-section__head">
            <h2 id="receipts-heading">New receipts</h2>
            <Link to="/documents?type=receipt">All receipts</Link>
          </div>
          {data.receipts.length === 0 ? (
            <p className="muted">No receipts waiting.</p>
          ) : (
            <ul className="fin-list">
              {data.receipts.map((receipt) => (
                <li key={receipt.id}>
                  <span className="fin-list__main">
                    <a href={`/api/documents/${receipt.id}/file/`} target="_blank" rel="noopener noreferrer">
                      {receipt.title}
                    </a>
                    <span className="fin-sub">
                      {receipt.person_id ? (
                        <Link to={`/finance/payroll/${receipt.person_id}`}>{receipt.person}</Link>
                      ) : (
                        receipt.person
                      )}{' '}
                      · {shortDate(receipt.submitted_on)}
                    </span>
                  </span>
                  <ReceiptProgress status={receipt.status} />
                  <span className="fin-num">{money(receipt.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="tile" aria-labelledby="drafts-heading">
          <div className="fin-section__head">
            <h2 id="drafts-heading">Scheduled auto drafts</h2>
            <Link to="/finance/outgoing">Outgoing</Link>
          </div>
          {data.auto_drafts.length === 0 ? (
            <p className="muted">No auto drafts.</p>
          ) : (
            <ul className="fin-list">
              {data.auto_drafts.map((draft) => (
                <li key={draft.id}>
                  <span className="fin-list__main">
                    <strong>{draft.payee}</strong>
                    <span className="fin-sub">
                      {shortDate(draft.next_on)} · {draft.frequency_display}
                      {draft.payment_method_label ? ` · ${draft.payment_method_label}` : ''}
                    </span>
                  </span>
                  <span className="fin-num">{money(draft.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="fin-section" aria-labelledby="calendar-heading">
        <h2 id="calendar-heading">Finance calendar</h2>
        <FinanceCalendar today={data.today} />
      </section>
    </section>
  )
}
