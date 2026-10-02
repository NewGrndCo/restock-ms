import type { Config, Context } from '@netlify/functions'
import { getSession } from './_shared/security'
import { read, write, writeMedia, type CatalogProduct, type Vendor } from './_shared/store'
import { readCatalog } from './_shared/catalog'

const safeKey = (scope: string, id: string) => `${scope}/${id.replace(/[^a-zA-Z0-9_-]/g, '')}`
export default async (req: Request, context: Context) => {
  const session = await getSession(context); if (!session || session.role !== 'ADMIN') return Response.json({ error: 'Unauthorized' }, { status: 401 })
  if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 })
  const form = await req.formData(); const scope = String(form.get('scope') ?? ''); const id = String(form.get('id') ?? ''); const file = form.get('file')
  if (!['vendor', 'product'].includes(scope) || !id || !(file instanceof File) || !file.type.startsWith('image/')) return Response.json({ error: 'An image file and valid target are required' }, { status: 400 })
  if (file.size > 3_000_000) return Response.json({ error: 'Images must be 3 MB or smaller' }, { status: 400 })
  const key = safeKey(scope, id); await writeMedia(key, await file.arrayBuffer(), file.type)
  if (scope === 'vendor') { const vendors = await read<Vendor[]>('vendors', []); const vendor = vendors.find((entry) => entry.id === id); if (!vendor) return Response.json({ error: 'Vendor not found' }, { status: 404 }); vendor.imageKey = key; await write('vendors', vendors) }
  else { const catalog = await readCatalog(); const product = catalog.find((entry) => entry.name === id); if (!product) return Response.json({ error: 'Product not found' }, { status: 404 }); product.imageKey = key; await write<CatalogProduct[]>('catalog', catalog) }
  return Response.json({ imageKey: key })
}
export const config: Config = { path: '/api/admin/media', method: ['POST'] }
