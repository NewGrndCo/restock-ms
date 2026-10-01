import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import type { Context } from '@netlify/functions'
import { secret } from './env'
import { read, write, type Role } from './store'

type Session = { id: string; role: Role; vendorId?: string; expiresAt: number }
const sessionSecret = () => secret('RESTOCK_SESSION_SECRET')

export function hashPin(pin: string) { const salt = randomBytes(16).toString('hex'); return `${salt}:${scryptSync(pin, salt, 32).toString('hex')}` }
export function verifyPin(pin: string, stored: string) { const [salt, digest] = stored.split(':'); if (!salt || !digest) return false; const expected = scryptSync(pin, salt, 32); const actual = Buffer.from(digest, 'hex'); return actual.length === expected.length && timingSafeEqual(actual, expected) }
export function pinIsValid(pin: string, length: number) { return new RegExp(`^\\d{${length}}$`).test(pin) }
export function cookie(id: string) { return `restock_session=${id}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=28800` }
export function clearCookie() { return 'restock_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0' }
export async function createSession(role: Role, vendorId?: string) { if (!sessionSecret()) throw new Error('RESTOCK_SESSION_SECRET is not configured'); const id = randomBytes(32).toString('hex'); const session: Session = { id, role, vendorId, expiresAt: Date.now() + 8 * 60 * 60 * 1000 }; const sessions = await read<Session[]>('sessions', []); sessions.push(session); await write('sessions', sessions.slice(-500)); return session }
export async function getSession(context: Context) { const raw = context.cookies.get('restock_session'); if (!raw || !sessionSecret()) return null; const sessions = await read<Session[]>('sessions', []); const session = sessions.find((entry) => entry.id === raw && entry.expiresAt > Date.now()); return session ?? null }
export function signed(value: string) { const secretValue = sessionSecret(); if (!secretValue) throw new Error('RESTOCK_SESSION_SECRET is not configured'); return createHmac('sha256', secretValue).update(value).digest('hex') }
