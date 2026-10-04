import { Outlet } from 'react-router-dom'
import { Footer } from './Footer'
import { Header } from './Header'
import { Nav } from './Nav'
import { SubNav } from './SubNav'

export function Layout() {
  return (
    <div className="site">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <Header />
      <Nav />
      <SubNav />
      <main id="main" className="site-main">
        <div className="container">
          <Outlet />
        </div>
      </main>
      <Footer />
    </div>
  )
}
