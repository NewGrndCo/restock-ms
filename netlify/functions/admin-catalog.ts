import type { Config, Context } from '@netlify/functions'
import { getSession } from './_shared/security'
import { audit, readInventoryHistory, recordInventoryChange } from './_shared/store'
import { readCatalog } from './_shared/catalog'
import { read, write, type CatalogProduct } from './_shared/store'

export default async (req: Request, context: Context) => {
  const session = await getSession(context); if (!session || session.role !== 'ADMIN') return Response.json({ error: 'Unauthorized' }, { status: 401 })
  if (req.method === 'GET') return Response.json({ products: await readCatalog(), inventoryHistory: await readInventoryHistory() })
  if (req.method !== 'PATCH') return Response.json({ error: 'Method not allowed' }, { status: 405 })
  const body = await req.json().catch(() => ({})) as { name?: string; inventory?: number; reason?: string }
  if (!body.name || !Number.isFinite(body.inventory) || Number(body.inventory) < 0) return Response.json({ error: 'Product name and non-negative inventory are required' }, { status: 400 })
  const catalog = await readCatalog(); const product = catalog.find((entry) => entry.name === body.name); if (!product) return Response.json({ error: 'Product not found' }, { status: 404 })
  const previousQuantity = product.inventory; const quantity = Math.floor(Number(body.inventory)); if (quantity === previousQuantity) return Response.json({ product, inventoryEntry: null })
  product.inventory = quantity; await write<CatalogProduct[]>('catalog', catalog); const inventoryEntry = await recordInventoryChange({ productName: product.name, previousQuantity, quantity, delta: quantity - previousQuantity, reason: body.reason?.trim() || 'MANUAL_COUNT', actorType: 'ADMIN' }); await audit({ actorType: 'ADMIN', eventType: 'UPDATE_INVENTORY', product: product.name, inventory: product.inventory, inventoryEntryId: inventoryEntry.id }); return Response.json({ product, inventoryEntry })
}
export const config: Config = { path: '/api/admin/catalog', method: ['GET', 'PATCH'] }
