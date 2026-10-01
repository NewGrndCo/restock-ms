import { getStore } from '@netlify/blobs'

export type Role = 'ADMIN' | 'VENDOR'
export type Vendor = { id: string; vendorId: string; storeName: string; contactName: string; phone: string; address: string; city: string; state: string; zip: string; pinHash: string; status: 'ACTIVE' | 'SUSPENDED' | 'CLOSED'; createdAt: string }
export type Order = { id: string; orderNumber: string; vendorId: string; source: 'PORTAL' | 'PHONE'; status: string; items: Array<{ product: string; quantity: number }>; totalBottles: number; totalAmount: number; paymentMethod: 'CHECK' | 'CASH'; createdAt: string }

const store = getStore({ name: 'restock-mq-data', consistency: 'strong' })
const key = (name: string) => `data/${name}.json`

export async function read<T>(name: string, fallback: T): Promise<T> { return (await store.get(key(name), { type: 'json' }) as T | null) ?? fallback }
export async function write<T>(name: string, value: T) { await store.setJSON(key(name), value) }
export async function audit(event: Record<string, unknown>) { const events = await read<Record<string, unknown>[]>('audit', []); events.push({ ...event, createdAt: new Date().toISOString() }); await write('audit', events) }
