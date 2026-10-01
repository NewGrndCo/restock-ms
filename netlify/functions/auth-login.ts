import type { Config, Context } from '@netlify/functions'
import { hashPin, pinIsValid, verifyPin, cookie, createSession } from './_shared/security'
import { audit, read, write, type Vendor } from './_shared/store'
import { secret } from './_shared/env'

export default async (req: Request, context: Context) => {
  if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 })
  const body = await req.json().catch(() => ({})) as { pin?: string }
  const pin = body.pin ?? ''
  if (!/^\\d{4,6}$/.test(pin)) return Response.json({ error: 'Invalid credentials' }, { status: 401 })
  if (pinIsValid(pin, 6) && secret('ADMIN_BOOTSTRAP_PIN') && pin === secret('ADMIN_BOOTSTRAP_PIN')) {
    const session = await createSession('ADMIN'); await audit({ actorType: 'ADMIN', eventType: 'LOGIN' }); return new Response(JSON.stringify({ role: 'ADMIN' }), { headers: { 'Content-Type': 'application/json', 'Set-Cookie': cookie(session.id) } })
  }
  const vendors = await read<Vendor[]>('vendors', [])
  const vendor = vendors.find((entry) => entry.status === 'ACTIVE' && pinIsValid(pin, 4) && verifyPin(pin, entry.pinHash))
  if (!vendor) return Response.json({ error: 'Invalid credentials' }, { status: 401 })
  const session = await createSession('VENDOR', vendor.id); await audit({ actorType: 'VENDOR', actorId: vendor.id, eventType: 'LOGIN' }); return new Response(JSON.stringify({ role: 'VENDOR', vendor: { vendorId: vendor.vendorId, storeName: vendor.storeName } }), { headers: { 'Content-Type': 'application/json', 'Set-Cookie': cookie(session.id) } })
}
export const config: Config = { path: '/api/auth/login' }
