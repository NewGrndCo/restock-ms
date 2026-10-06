import type { Config, Context } from '@netlify/functions'
import { getSession } from './_shared/security'
import { audit, read, write, type Order, type Vendor } from './_shared/store'

const statuses = new Set(['SUBMITTED', 'APPROVED', 'IN_PRODUCTION', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CLOSED'])

async function announceDelivery(order: Order, retailer: string) {
  const url = Netlify.env.get('MONSTA_AUTOMATION_URL')
  const token = Netlify.env.get('MONSTA_AUTOMATION_TOKEN')
  if (!url || !token) return
  await Promise.allSettled(order.items.map(({ product }) => fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-automation-token': token },
    body: JSON.stringify({ type: 'retailer_stock', eventKey: `delivery:${order.id}:${product}`, drink: product, retailer }),
    signal: AbortSignal.timeout(5000)
  })))
}

export default async (req: Request, context: Context) => {
  const session = await getSession(context)
  if (!session || session.role !== 'ADMIN') return Response.json({ error: 'Unauthorized' }, { status: 401 })
  if (req.method !== 'PATCH') return Response.json({ error: 'Method not allowed' }, { status: 405 })
  const body = await req.json().catch(() => ({})) as { orderId?: string; status?: string }
  if (!body.orderId || !body.status || !statuses.has(body.status)) return Response.json({ error: 'A valid order and status are required' }, { status: 400 })
  const [orders, vendors] = await Promise.all([read<Order[]>('orders', []), read<Vendor[]>('vendors', [])]); const order = orders.find((entry) => entry.id === body.orderId)
  if (!order) return Response.json({ error: 'Order not found' }, { status: 404 })
  const previous = order.status; order.status = body.status; await write('orders', orders); await audit({ actorType: 'ADMIN', orderId: order.id, eventType: 'UPDATE_ORDER_STATUS', metadata: { from: previous, to: order.status } })
  if (previous !== 'DELIVERED' && order.status === 'DELIVERED') {
    const retailer = vendors.find((vendor) => vendor.id === order.vendorId)?.storeName
    if (retailer) await announceDelivery(order, retailer)
  }
  return Response.json({ order })
}

export const config: Config = { path: '/api/admin/orders' }
