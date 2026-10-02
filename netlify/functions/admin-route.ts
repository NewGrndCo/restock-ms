import type { Config, Context } from '@netlify/functions'
import { getSession } from './_shared/security'
import { read, write, type Order, type Vendor } from './_shared/store'

type Coordinate = { latitude: number; longitude: number; displayName: string }
type RouteStop = { vendorId: string; storeName: string; address: string; latitude: number; longitude: number; orderIds: string[]; bottles: number; status: string; milesFromPrevious: number; minutesFromPrevious: number }
type RouteResponse = { provider: string; origin: { address: string; latitude: number; longitude: number } | null; stops: RouteStop[]; geometry: [number, number][]; totalMiles: number; totalMinutes: number; warnings: string[]; generatedAt: string }

const originAddress = '1509 Brentwood Rd, Brentwood, NY'
const routeStatuses = new Set(['READY', 'OUT_FOR_DELIVERY'])
const geocodeCacheKey = 'route-geocode-cache'
const routeCacheKey = 'delivery-route'
const cacheTtlMs = 1000 * 60 * 60 * 24 * 30

async function geocode(address: string, cache: Record<string, Coordinate>) {
  const cached = cache[address]
  if (cached) return cached
  const response = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(address)}`, { headers: { 'User-Agent': 'Monsta-Squeeze-Restock/1.0 route planning' } })
  if (!response.ok) throw new Error(`Geocoder returned ${response.status}`)
  const results = await response.json() as Array<{ lat: string; lon: string; display_name: string }>
  const result = results[0]
  if (!result) throw new Error(`Address could not be located: ${address}`)
  const coordinate = { latitude: Number(result.lat), longitude: Number(result.lon), displayName: result.display_name }
  cache[address] = coordinate
  return coordinate
}

export default async (req: Request, context: Context) => {
  const session = await getSession(context)
  if (!session || session.role !== 'ADMIN') return Response.json({ error: 'Unauthorized' }, { status: 401 })
  if (req.method !== 'GET') return Response.json({ error: 'Method not allowed' }, { status: 405 })

  const [vendors, orders, cache] = await Promise.all([
    read<Vendor[]>('vendors', []),
    read<Order[]>('orders', []),
    read<Record<string, Coordinate>>(geocodeCacheKey, {})
  ])
  const readyOrders = orders.filter((order) => routeStatuses.has(order.status))
  const grouped = new Map<string, Order[]>()
  for (const order of readyOrders) grouped.set(order.vendorId, [...(grouped.get(order.vendorId) ?? []), order])
  const routeVendors = vendors.filter((vendor) => grouped.has(vendor.id) && vendor.status === 'ACTIVE')
  if (!routeVendors.length) {
    return Response.json({ provider: 'OpenStreetMap + OSRM', origin: null, stops: [], geometry: [], totalMiles: 0, totalMinutes: 0, warnings: [], generatedAt: new Date().toISOString() } satisfies RouteResponse)
  }

  const warnings: string[] = []
  let origin: Coordinate
  try { origin = await geocode(originAddress, cache) } catch (error) { return Response.json({ error: error instanceof Error ? error.message : 'Route origin could not be located' }, { status: 502 }) }
  const located: Array<{ vendor: Vendor; coordinate: Coordinate; orders: Order[] }> = []
  for (const vendor of routeVendors) {
    try { located.push({ vendor, coordinate: await geocode(`${vendor.address}, ${vendor.city}, ${vendor.state} ${vendor.zip}`, cache), orders: grouped.get(vendor.id) ?? [] }) }
    catch { warnings.push(`${vendor.storeName} could not be located and was left out of the route.`) }
  }
  await write(geocodeCacheKey, cache)
  if (!located.length) return Response.json({ error: 'No ready delivery addresses could be located.', warnings }, { status: 422 })

  const coordinates = [origin, ...located.map((entry) => entry.coordinate)]
  const coordinateString = coordinates.map((coordinate) => `${coordinate.longitude},${coordinate.latitude}`).join(';')
  const routeResponse = await fetch(`https://router.project-osrm.org/trip/v1/driving/${coordinateString}?source=first&destination=last&roundtrip=false&overview=full&geometries=geojson&steps=false`)
  if (!routeResponse.ok) return Response.json({ error: `Routing provider returned ${routeResponse.status}`, warnings }, { status: 502 })
  const routed = await routeResponse.json() as { trips?: Array<{ distance: number; duration: number; geometry?: { coordinates: [number, number][] }; legs?: Array<{ distance: number; duration: number }> }>; waypoints?: Array<{ waypoint_index: number; input_index: number }> }
  const trip = routed.trips?.[0]
  if (!trip || !routed.waypoints) return Response.json({ error: 'Routing provider returned no usable route.', warnings }, { status: 502 })
  const orderedWaypoints = routed.waypoints.map((waypoint, inputIndex) => ({ ...waypoint, inputIndex })).sort((a, b) => a.waypoint_index - b.waypoint_index)
  const orderedLocated = orderedWaypoints.filter((waypoint) => waypoint.inputIndex > 0).map((waypoint) => located[waypoint.inputIndex - 1])
  const stops: RouteStop[] = orderedLocated.map((entry, index) => {
    const leg = trip.legs?.[index]
    return { vendorId: entry.vendor.id, storeName: entry.vendor.storeName, address: `${entry.vendor.address}, ${entry.vendor.city}, ${entry.vendor.state} ${entry.vendor.zip}`, latitude: entry.coordinate.latitude, longitude: entry.coordinate.longitude, orderIds: entry.orders.map((order) => order.id), bottles: entry.orders.reduce((sum, order) => sum + Number(order.totalBottles || 0), 0), status: entry.orders.some((order) => order.status === 'OUT_FOR_DELIVERY') ? 'OUT_FOR_DELIVERY' : 'READY', milesFromPrevious: Number(((leg?.distance ?? 0) / 1609.344).toFixed(1)), minutesFromPrevious: Math.round((leg?.duration ?? 0) / 60) }
  })
  const result: RouteResponse = { provider: 'OpenStreetMap + OSRM', origin: { address: originAddress, latitude: origin.latitude, longitude: origin.longitude }, stops, geometry: trip.geometry?.coordinates ?? [], totalMiles: Number((trip.distance / 1609.344).toFixed(1)), totalMinutes: Math.round(trip.duration / 60), warnings, generatedAt: new Date().toISOString() }
  await write(routeCacheKey, result)
  return Response.json(result)
}

export const config: Config = { path: '/api/admin/route' }
