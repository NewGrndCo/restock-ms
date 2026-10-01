import type { Config } from '@netlify/functions'
import { secret } from './_shared/env'

export default async () => Response.json({ ok: true, sessionSecretConfigured: Boolean(secret('RESTOCK_SESSION_SECRET')), adminPinConfigured: Boolean(secret('ADMIN_BOOTSTRAP_PIN')) })
export const config: Config = { path: '/api/health' }
