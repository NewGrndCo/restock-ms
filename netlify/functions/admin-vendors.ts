import type { Config, Context } from '@netlify/functions'
import { getSession, hashPin, pinIsValid } from './_shared/security'
import { audit, read, write, type Vendor } from './_shared/store'
import { randomUUID } from 'node:crypto'

export default async (req: Request, context: Context) => {
  const session = await getSession(context); if (!session || session.role !== 'ADMIN') return Response.json({ error: 'Unauthorized' }, { status: 401 })
  if (req.method === 'GET') {
    const vendors = await read<Vendor[]>('vendors', [])
    return Response.json({ vendors: vendors.map(({ pinHash: _pinHash, ...vendor }) => vendor) })
  }
  if (req.method === 'PATCH') {
    const body = await req.json().catch(() => ({})) as { vendorId?: string; imageKey?: string }
    if (!body.vendorId || !body.imageKey) return Response.json({ error: 'Vendor and image are required' }, { status: 400 })
    const vendors = await read<Vendor[]>('vendors', []); const vendor = vendors.find((entry) => entry.id === body.vendorId); if (!vendor) return Response.json({ error: 'Vendor not found' }, { status: 404 }); vendor.imageKey = body.imageKey; await write('vendors', vendors); const { pinHash: _pinHash, ...safeVendor } = vendor; return Response.json({ vendor: safeVendor })
  }
  if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 })
  const body = await req.json().catch(() => ({})) as Partial<Vendor> & { pin?: string }
  if (!body.storeName || !body.contactName || !body.phone || !body.address || !body.city || !body.state || !body.zip) return Response.json({ error: 'Required vendor fields are missing' }, { status: 400 })
  const pin = body.pin ?? String(Math.floor(1000 + Math.random() * 9000)); if (!pinIsValid(pin, 4)) return Response.json({ error: 'Vendor PIN must be exactly four digits' }, { status: 400 })
  const vendors = await read<Vendor[]>('vendors', []); const nextNumber = vendors.length + 1; const vendor: Vendor = { id: randomUUID(), vendorId: `MS-R${String(nextNumber).padStart(3, '0')}`, storeName: body.storeName, contactName: body.contactName, phone: body.phone, address: body.address, city: body.city, state: body.state, zip: body.zip, pinHash: hashPin(pin), status: 'ACTIVE', createdAt: new Date().toISOString() }; vendors.push(vendor); await write('vendors', vendors); await audit({ actorType: 'ADMIN', eventType: 'CREATE_VENDOR', vendorId: vendor.id }); const { pinHash: _pinHash, ...safeVendor } = vendor; return Response.json({ vendor: safeVendor, issuedPin: pin }, { status: 201 })
}
export const config: Config = { path: '/api/admin/vendors', method: ['GET', 'POST', 'PATCH'] }
