import type { ReactNode } from 'react'
import wordmark from '../../assets/brand/knet-wordmark.png'

/** The standalone, centered screen used by log in, sign up and email verification. */
export function AuthScreen({ title, children, wide = false }: { title: string; children: ReactNode; wide?: boolean }) {
  return (
    <main className="login-screen">
      <section className={wide ? 'login login--wide' : 'login'}>
        <img src={wordmark} alt="K-Net: K Network Project Center" className="login__logo" width={900} height={286} />
        <h1>{title}</h1>
        {children}
      </section>
    </main>
  )
}
