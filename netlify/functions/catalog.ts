import type { Config, Context } from '@netlify/functions'
import { getSession } from './_shared/security'
import { readCatalog } from './_shared/catalog'

export default async (_req: Request, context: Context) => { if (!(await getSession(context))) return Response.json({ error: 'Unauthorized' }, { status: 401 }); return Response.json({ products: await readCatalog() }) }
export const config: Config = { path: '/api/catalog' }
