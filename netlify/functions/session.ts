import type { Config, Context } from '@netlify/functions'
import { getSession } from './_shared/security'
import { read, type Vendor } from './_shared/store'

export default async (_req: Request, context: Context) => {
  const session = await getSession(context)
  if (!session) return Response.json({ authenticated: false }, { status: 401 })
  if (session.role === 'ADMIN') return Response.json({ authenticated: true, role: 'ADMIN' })
  const vendor = (await read<Vendor[]>('vendors', [])).find((entry) => entry.id === session.vendorId)
  if (!vendor || vendor.status !== 'ACTIVE') return Response.json({ authenticated: false }, { status: 401 })
  const { pinHash: _pinHash, ...safeVendor } = vendor
  return Response.json({ authenticated: true, role: 'VENDOR', vendor: safeVendor })
}

export const config: Config = { path: '/api/session' }
