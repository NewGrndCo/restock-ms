import type { Config, Context } from '@netlify/functions'
import { getSession } from './_shared/security'
import { audit, read, write, type Order, type Vendor } from './_shared/store'
import { randomUUID } from 'node:crypto'

const allowedProducts = new Set(['Strawberry Lemonade', 'Classic Lemonade', 'Half & Half', 'Alkaline Water', 'Blueberry Lemonade', 'Mango Lemonade', 'Raspberry Lemonade', 'Pineapple Lemonade'])

export default async (req: Request, context: Context) => {
  const session = await getSession(context)
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const orders = await read<Order[]>('orders', [])
  if (req.method === 'GET') {
    const visible = session.role === 'ADMIN' ? orders : orders.filter((order) => order.vendorId === session.vendorId)
    return Response.json({ orders: visible.sort((a, b) => b.createdAt.localeCompare(a.createdAt)) })
  }
  if (req.method !== 'POST' || session.role !== 'VENDOR' || !session.vendorId) return Response.json({ error: 'Method not allowed' }, { status: 405 })
  const vendor = (await read<Vendor[]>('vendors', [])).find((entry) => entry.id === session.vendorId && entry.status === 'ACTIVE')
  if (!vendor) return Response.json({ error: 'Vendor account is unavailable' }, { status: 403 })
  const body = await req.json().catch(() => ({})) as { items?: Array<{ product?: string; quantity?: number }>; paymentMethod?: string }
  const items = (body.items ?? []).filter((item) => allowedProducts.has(item.product ?? '') && Number.isInteger(item.quantity) && (item.quantity ?? 0) > 0).map((item) => ({ product: item.product as string, quantity: item.quantity as number }))
  const totalBottles = items.reduce((sum, item) => sum + item.quantity, 0)
  if (!items.length || totalBottles < 24) return Response.json({ error: 'Orders must include at least 24 bottles' }, { status: 400 })
  if (body.paymentMethod !== 'CHECK' && body.paymentMethod !== 'CASH') return Response.json({ error: 'Choose a payment method' }, { status: 400 })
  const order: Order = { id: randomUUID(), orderNumber: `MS-ORD-${Date.now().toString().slice(-6)}`, vendorId: vendor.id, source: 'PORTAL', status: 'SUBMITTED', items, totalBottles, totalAmount: totalBottles * 4, paymentMethod: body.paymentMethod, createdAt: new Date().toISOString() }
  orders.push(order); await write('orders', orders); await audit({ actorType: 'VENDOR', actorId: vendor.id, vendorId: vendor.id, orderId: order.id, eventType: 'CREATE_ORDER' })
  return Response.json({ order }, { status: 201 })
}

export const config: Config = { path: '/api/orders', method: ['GET', 'POST'] }
