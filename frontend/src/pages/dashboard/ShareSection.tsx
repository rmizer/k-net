import { useState } from 'react'
import { Link } from 'react-router-dom'
import qrCode from '../../assets/brand/knet-qr-code.png'
import { DashboardSection } from './DashboardSection'

const SIGNUP_URL = `${window.location.origin}/signup`

/** Always on the Staff Hub: the K-Net QR code, so anyone can bring a teammate in
 *  by letting them scan it with a phone camera. */
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
    <DashboardSection title="Share K-Net" action={<Link to="/crew/invite">More ways to invite</Link>}>
      <div className="tile dash-share">
        <img src={qrCode} alt="QR code that opens K-Net" className="dash-share__qr" width={387} height={377} />
        <div className="dash-share__text">
          <p className="dash-share__title">Bring a teammate onto K-Net</p>
          <p>
            Have them point their phone camera at this code. It opens K-Net, where they tap{' '}
            <strong>Create an account</strong> and sign up with their own email.
          </p>
          <div className="dash-share__actions">
            <a href={qrCode} download="K-Net-QR-code.png" className="button button--secondary">
              Download QR code
            </a>
            <button type="button" className="text-button" onClick={copy}>
              {copied ? 'Link copied ✓' : 'Copy sign-up link'}
            </button>
          </div>
        </div>
      </div>
    </DashboardSection>
  )
}
