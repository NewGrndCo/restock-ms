import { FormEvent, StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'

function App() {
  const [pin, setPin] = useState('')
  const [message, setMessage] = useState('')

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage(pin.trim() ? 'Secure vendor access is not connected yet. No PIN was sent or stored.' : 'Enter your vendor PIN to continue.')
  }

  return (
    <main className="gate-shell">
      <section className="gate-card" aria-labelledby="page-title">
        <div className="brand-mark" aria-hidden="true">MS</div>
        <p className="eyebrow">Monsta Squeeze</p>
        <h1 id="page-title">Retail restock</h1>
        <p className="lede">Private access for authorized Monsta Squeeze retailers.</p>
        <form className="pin-form" onSubmit={handleSubmit}>
          <label htmlFor="vendor-pin">Vendor PIN</label>
          <input id="vendor-pin" name="vendor-pin" inputMode="numeric" autoComplete="off" placeholder="Enter your PIN" value={pin} onChange={(event) => setPin(event.target.value)} aria-describedby="pin-status" />
          <button type="submit">Access restock</button>
        </form>
        <p id="pin-status" className="setup-note" role="status">{message || 'Authorized retailers only. Your PIN identifies your vendor account.'}</p>
      </section>
    </main>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode><App /></StrictMode>,
)
