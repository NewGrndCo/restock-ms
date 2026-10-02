import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import type { Context } from '@netlify/functions'
import { secret } from './env'
import type { Role } from './store'

export type Session = { id: string; role: Role; vendorId?: string; expiresAt: number }
const sessionSecret = () => secret('RESTOCK_SESSION_SECRET')

export function hashPin(pin: string) { const salt = randomBytes(16).toString('hex'); return `${salt}:${scryptSync(pin, salt, 32).toString('hex')}` }
export function verifyPin(pin: string, stored: string) { try { const [salt, digest] = stored.split(':'); if (!salt || !digest) return false; const expected = scryptSync(pin, salt, 32); const actual = Buffer.from(digest, 'hex'); return actual.length === expected.length && timingSafeEqual(actual, expected) } catch { return false } }
export function pinIsValid(pin: string, length: number) { return new RegExp(`^\\d{${length}}$`).test(pin) }
function token(session: Session) { const value = Buffer.from(JSON.stringify(session)).toString('base64url'); return `${value}.${signed(value)}` }
function decodeToken(value: string) { const [encoded, signature] = value.split('.'); if (!encoded || !signature || !sessionSecret()) return null; const expected = signed(encoded); const valid = expected.length === signature.length && timingSafeEqual(Buffer.from(expected), Buffer.from(signature)); if (!valid) return null; try { const session = JSON.parse(Buffer.from(encoded, 'base64url').toString()) as Session; return session.expiresAt > Date.now() ? session : null } catch { return null } }
export function cookie(value: Session | string) { const valueToSet = typeof value === 'string' ? value : token(value); return `restock_session=${valueToSet}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=28800` }
export function clearCookie() { return 'restock_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0' }
export async function createSession(role: Role, vendorId?: string) { if (!sessionSecret()) throw new Error('RESTOCK_SESSION_SECRET is not configured'); const session = { id: randomBytes(32).toString('hex'), role, vendorId, expiresAt: Date.now() + 8 * 60 * 60 * 1000 }; return { ...session, id: token(session) } }
export async function getSession(context: Context) { const raw = context.cookies.get('restock_session'); if (!raw || !sessionSecret()) return null; return decodeToken(raw) }
export function signed(value: string) { const secretValue = sessionSecret(); if (!secretValue) throw new Error('RESTOCK_SESSION_SECRET is not configured'); return createHmac('sha256', secretValue).update(value).digest('hex') }
