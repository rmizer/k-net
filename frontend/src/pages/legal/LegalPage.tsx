import { Link } from 'react-router-dom'
import './legal.css'

const SUPPORT_EMAIL = 'support.knet@gmail.com'

/** Plain-language legal basics for staff: data privacy, confidentiality and
 *  the terms of the trial. Public, so it can be read before signing up. */
export function LegalPage() {
  return (
    <section className="legal-page">
      <h1>Legal</h1>
      <p className="subtitle">The basics every K-Net user should know</p>

      <h2 id="privacy">Data privacy</h2>
      <div className="tile">
        <p>
          What you enter in K-Net is private to the production. It isn’t shared with or sold to any third parties, and
          it isn’t used for advertising.
        </p>
        <p>
          Your name, role, department and work contact details are visible to the rest of the crew so people can reach
          you. Emergency contacts and allergies are visible only to you and to Directors, Assistants and Site Managers
          (the Culinary team also sees food allergies so they can plan meals).
        </p>
        <p>
          Uploaded documents are stored privately and are never public on the web. Only signed-in people who are
          allowed to see a document can open it.
        </p>
        <p>
          You can view and update your own details on your <Link to="/account">Account page</Link>. To have your
          account and information removed, email <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
        </p>
      </div>

      <h2>Cookies</h2>
      <div className="tile">
        <p>
          K-Net uses only the cookies it needs to keep you signed in and to protect forms from misuse. There are no
          advertising or tracking cookies.
        </p>
      </div>

      <h2>Confidentiality</h2>
      <div className="tile">
        <p>
          Schedules, call sheets, locations, talent details, contracts and finances in K-Net are confidential
          production information. Don’t share them, screenshot them or post them outside the production unless a
          Director has said it’s okay. Your production’s own confidentiality or NDA terms still apply.
        </p>
        <p>
          Talent and influencer contact details, lodging and travel plans are especially sensitive. Use them only for
          your work on the production.
        </p>
      </div>

      <h2>Using K-Net responsibly</h2>
      <div className="tile">
        <p>
          Keep your password to yourself and don’t share your account. Only upload documents you have the right to
          share with the production, and only enter other people’s details when your work needs them.
        </p>
        <p>
          Site Managers can remove accounts that are misused. If you think someone has seen information they
          shouldn’t have, tell a Director or email <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> right away.
        </p>
      </div>

      <h2>The trial</h2>
      <div className="tile">
        <p>
          K-Net is in early testing and is provided as is. Features may change or be removed, and there may be bugs.
          Keep your own copies of anything important, such as contracts and receipts. See{' '}
          <Link to="/trial">The K-Net trial</Link> for what the trial includes.
        </p>
        <p>
          K-Net keeps records only. It doesn’t pay anyone or process payroll, so finance figures in K-Net are not
          official accounting or tax records.
        </p>
      </div>

      <h2>Questions</h2>
      <div className="tile">
        <p>
          Email <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> with any questions about your information or
          these terms. This page is a plain-language summary, not legal advice.
        </p>
      </div>
    </section>
  )
}
