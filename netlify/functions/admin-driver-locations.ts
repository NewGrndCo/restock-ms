import type { Config, Context } from '@netlify/functions'
import { getSession } from './_shared/security'
import { driverLocationKey, readDriverLocations, removeDriverLocation, writeDriverLocation } from './_shared/store'

const numberOrUndefined = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : undefined

export default async (req: Request, context: Context) => {
  const session = await getSession(context)
  if (!session || session.role !== 'ADMIN') return Response.json({ error: 'Unauthorized' }, { status: 401 })
  if (req.method === 'GET') {
    const locations = await readDriverLocations()
    return Response.json({ locations: locations.map((location) => ({ ...location, stale: Date.now() - Date.parse(location.updatedAt) > 30_000 })) })
  }
  if (req.method === 'DELETE') { await removeDriverLocation(session.id); return Response.json({ ok: true }) }
  if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 })
  const body = await req.json().catch(() => ({})) as { latitude?: unknown; longitude?: unknown; accuracyMeters?: unknown; heading?: unknown; speedMps?: unknown; driverLabel?: unknown }
  const latitude = numberOrUndefined(body.latitude); const longitude = numberOrUndefined(body.longitude)
  if (latitude === undefined || longitude === undefined || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return Response.json({ error: 'A valid GPS latitude and longitude are required.' }, { status: 400 })
  const driverLabel = typeof body.driverLabel === 'string' && body.driverLabel.trim() ? body.driverLabel.trim().slice(0, 80) : 'Driver'
  const location = { driverKey: driverLocationKey(session.id), driverLabel, latitude, longitude, accuracyMeters: numberOrUndefined(body.accuracyMeters), heading: numberOrUndefined(body.heading), speedMps: numberOrUndefined(body.speedMps), updatedAt: new Date().toISOString() }
  await writeDriverLocation(location)
  return Response.json({ location })
}

export const config: Config = { path: '/api/admin/driver-locations', method: ['GET', 'POST', 'DELETE'] }
