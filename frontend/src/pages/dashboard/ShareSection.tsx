import { useState } from 'react'
import { Link } from 'react-router-dom'
import qrCode from '../../assets/brand/knet-qr-code.png'

const SIGNUP_URL = `${window.location.origin}/signup`

/** Always at the top of the Staff Hub: the K-Net QR code, so anyone can bring a
 *  teammate in by letting them scan it with a phone camera. */
export function ShareSection() {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(SIGNUP_URL)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2500)
    } catch {
      window.prompt('Copy this link:', SIGNUP_URL)
    }
  }

  return (
    <aside className="callout callout--share" aria-labelledby="share-heading">
      <span className="callout__qr">
        <img src={qrCode} alt="QR code that opens K-Net" width={387} height={377} />
      </span>
      <div className="callout__text">
        <p className="callout__eyebrow">Share K-Net · Scan me</p>
        <h2 id="share-heading">Bring your team onto K-Net</h2>
        <p>
          Have a teammate point their phone camera at this code. It opens K-Net, where they tap{' '}
          <strong>Create an account</strong> and sign up with their own email.
        </p>
      </div>
      <span className="callout__actions callout__actions--stack">
        <Link to="/crew/invite" className="button callout__button">
          Invite someone
        </Link>
        <a href={qrCode} download="K-Net-QR-code.png" className="button callout__button">
          Download QR code
        </a>
        <button type="button" className="button callout__button" onClick={copy} aria-live="polite">
          {copied ? 'Link copied ✓' : 'Copy sign-up link'}
        </button>
      </span>
    </aside>
  )
}
