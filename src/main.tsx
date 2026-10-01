import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'

function App() {
  return (
    <main className="gate-shell">
      <section className="gate-card" aria-labelledby="page-title">
        <div className="brand-mark" aria-hidden="true">MS</div>
        <p className="eyebrow">Monsta Squeeze</p>
        <h1 id="page-title">Retail restock</h1>
        <p className="lede">Private access for authorized Monsta Squeeze retailers.</p>
        <form className="pin-form" onSubmit={(event) => event.preventDefault()}>
          <label htmlFor="vendor-pin">Vendor PIN</label>
          <input id="vendor-pin" name="vendor-pin" inputMode="numeric" autoComplete="off" placeholder="Enter your PIN" disabled />
          <button type="submit" disabled>Access restock</button>
        </form>
        <p className="setup-note">Secure vendor access will be enabled after the Supabase project and migration are configured.</p>
      </section>
    </main>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode><App /></StrictMode>,
)
