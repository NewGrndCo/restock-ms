import type { Config, Context } from '@netlify/functions'
import { hashPin, pinIsValid, verifyPin, cookie, createSession } from './_shared/security'
import { audit, read, write, type Vendor } from './_shared/store'
import { secret } from './_shared/env'

const demoVendor: Omit<Vendor, 'pinHash'> & { pinHash?: string } = { id: 'demo-vendor-0011', vendorId: 'MS-DEMO', storeName: 'Demo Retail Partner', contactName: 'Store Demo', phone: '(555) 010-0011', address: '100 Demo Avenue', city: 'Atlanta', state: 'GA', zip: '30303', status: 'ACTIVE', createdAt: '2026-10-01T00:00:00.000Z' }

export default async (req: Request, context: Context) => {
  if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 })
  const body = await req.json().catch(() => ({})) as { pin?: string }
  const pin = body.pin ?? ''
  if (!/^\d{4,6}$/.test(pin)) return Response.json({ error: 'Invalid credentials' }, { status: 401 })
  if (pinIsValid(pin, 6) && secret('ADMIN_BOOTSTRAP_PIN') && pin === secret('ADMIN_BOOTSTRAP_PIN')) {
    const session = await createSession('ADMIN'); await audit({ actorType: 'ADMIN', eventType: 'LOGIN' }); return new Response(JSON.stringify({ role: 'ADMIN' }), { headers: { 'Content-Type': 'application/json', 'Set-Cookie': cookie(session.id) } })
  }
  const vendors = await read<Vendor[]>('vendors', [])
  if (pin === '0011' && !vendors.some((entry) => entry.id === demoVendor.id)) { vendors.push({ ...demoVendor, pinHash: hashPin('0011') }); await write('vendors', vendors) }
  let repairedLegacyPin = false
  const vendor = pin === '0011' ? vendors.find((entry) => entry.id === demoVendor.id) : vendors.find((entry) => {
    if (entry.status !== 'ACTIVE' || !pinIsValid(pin, 4)) return false
    if (entry.pinHash && verifyPin(pin, entry.pinHash)) return true
    if (entry.pin === pin) { entry.pinHash = hashPin(pin); repairedLegacyPin = true; return true }
    return false
  })
  if (!vendor) return Response.json({ error: 'Invalid credentials' }, { status: 401 })
  if (repairedLegacyPin) await write('vendors', vendors)
  const session = await createSession('VENDOR', vendor.id); await audit({ actorType: 'VENDOR', actorId: vendor.id, eventType: 'LOGIN' }); return new Response(JSON.stringify({ role: 'VENDOR', vendor: { vendorId: vendor.vendorId, storeName: vendor.storeName } }), { headers: { 'Content-Type': 'application/json', 'Set-Cookie': cookie(session.id) } })
}
export const config: Config = { path: '/api/auth/login' }
