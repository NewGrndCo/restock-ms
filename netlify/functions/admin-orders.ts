import type { Config, Context } from '@netlify/functions'
import { getSession } from './_shared/security'
import { audit, read, write, type Order } from './_shared/store'

const statuses = new Set(['SUBMITTED', 'APPROVED', 'IN_PRODUCTION', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CLOSED'])

export default async (req: Request, context: Context) => {
  const session = await getSession(context)
  if (!session || session.role !== 'ADMIN') return Response.json({ error: 'Unauthorized' }, { status: 401 })
  if (req.method !== 'PATCH') return Response.json({ error: 'Method not allowed' }, { status: 405 })
  const body = await req.json().catch(() => ({})) as { orderId?: string; status?: string }
  if (!body.orderId || !body.status || !statuses.has(body.status)) return Response.json({ error: 'A valid order and status are required' }, { status: 400 })
  const orders = await read<Order[]>('orders', []); const order = orders.find((entry) => entry.id === body.orderId)
  if (!order) return Response.json({ error: 'Order not found' }, { status: 404 })
  const previous = order.status; order.status = body.status; await write('orders', orders); await audit({ actorType: 'ADMIN', orderId: order.id, eventType: 'UPDATE_ORDER_STATUS', metadata: { from: previous, to: order.status } })
  return Response.json({ order })
}

export const config: Config = { path: '/api/admin/orders' }
