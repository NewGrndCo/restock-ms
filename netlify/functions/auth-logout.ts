import type { Config, Context } from '@netlify/functions'
import { clearCookie, getSession } from './_shared/security'
export default async (_req: Request, context: Context) => { const session = await getSession(context); return new Response(null, { status: 204, headers: { 'Set-Cookie': clearCookie(), 'X-Session-Revoked': session?.id ?? '' } }) }
export const config: Config = { path: '/api/auth/logout' }
