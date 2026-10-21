import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import './invite.css'

// The QR code always points at this site's own sign-up page, so it's right on
// whichever address K-Net is running at.
const SIGNUP_URL = `${window.location.origin}/signup`

/** A QR code and link anyone on the crew can show or send to new staff. */
export function InvitePage() {
  const [qr, setQr] = useState('')
  const [copied, setCopied] = useState(false)
  const canShare = typeof navigator.share === 'function'

  useEffect(() => {
    QRCode.toDataURL(SIGNUP_URL, { width: 1024, margin: 2, errorCorrectionLevel: 'M' }).then(setQr)
  }, [])

  const copy = async () => {
    await navigator.clipboard.writeText(SIGNUP_URL)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  const share = () =>
    navigator
      .share({ title: 'Join K-Net', text: 'Sign up for K-Net, the production’s coordination app:', url: SIGNUP_URL })
      .catch(() => {}) // Closing the share sheet isn't an error.

  return (
    <section className="invite">
      <h1>Invite crew</h1>
      <p className="subtitle">New staff scan this code with their phone camera to sign up</p>

      <div className="tile invite__card">
        {qr ? (
          <img src={qr} alt={`QR code for ${SIGNUP_URL}`} className="invite__qr" width={1024} height={1024} />
        ) : (
          <div className="invite__qr invite__qr--loading" aria-hidden="true" />
        )}
        <p className="invite__url">{SIGNUP_URL}</p>
        <div className="invite__actions">
          {canShare && (
            <button type="button" className="button" onClick={share}>
              Share link
            </button>
          )}
          <button type="button" className={canShare ? 'button button--secondary' : 'button'} onClick={copy}>
            {copied ? 'Copied!' : 'Copy link'}
          </button>
          {qr && (
            <a href={qr} download="k-net-signup-qr.png" className="button button--secondary">
              Download QR code
            </a>
          )}
          <button type="button" className="button button--secondary" onClick={() => window.print()}>
            Print
          </button>
        </div>
        <p className="invite__note">
          Everyone who signs up joins as Staff after verifying their email. Directors and Assistants can then set their
          department and role in the Director Dashboard.
        </p>
      </div>
    </section>
  )
}
