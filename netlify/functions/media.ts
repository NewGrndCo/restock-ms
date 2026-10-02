import type { Config, Context } from '@netlify/functions'
import { getSession } from './_shared/security'
import { readMedia } from './_shared/store'

export default async (req: Request, context: Context) => {
  const session = await getSession(context); if (!session) return new Response('Unauthorized', { status: 401 })
  const key = new URL(req.url).searchParams.get('key') ?? ''; if (!/^(vendor|product)\/[a-zA-Z0-9 _-]+$/.test(key)) return new Response('Not found', { status: 404 })
  const result = await readMedia(key); if (!result?.data) return new Response('Not found', { status: 404 })
  const contentType = String(result.metadata?.contentType ?? 'application/octet-stream'); return new Response(result.data as unknown as ArrayBuffer, { headers: { 'Content-Type': contentType, 'Cache-Control': 'private, max-age=300' } })
}
export const config: Config = { path: '/api/media' }
