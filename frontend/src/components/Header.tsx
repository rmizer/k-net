import { Link } from 'react-router-dom'
import wordmark from '../assets/brand/knet-wordmark.png'

export function Header() {
  return (
    <header className="site-header">
      <div className="container">
        <Link to="/" className="site-header__logo">
          <img src={wordmark} alt="K-Net: K Network Project Center" width={900} height={286} />
        </Link>
      </div>
    </header>
  )
}
