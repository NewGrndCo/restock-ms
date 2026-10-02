import { getStore } from '@netlify/blobs'

export type Role = 'ADMIN' | 'VENDOR'
export type Vendor = { id: string; vendorId: string; storeName: string; contactName: string; phone: string; address: string; city: string; state: string; zip: string; pinHash: string; imageKey?: string; status: 'ACTIVE' | 'SUSPENDED' | 'CLOSED'; createdAt: string }
export type Order = { id: string; orderNumber: string; vendorId: string; source: 'PORTAL' | 'PHONE'; status: string; items: Array<{ product: string; quantity: number }>; totalBottles: number; totalAmount: number; paymentMethod: 'CHECK' | 'CASH'; createdAt: string }
export type CatalogProduct = { name: string; color: string; inventory: number; imageKey?: string }

const store = getStore({ name: 'restock-mq-data', consistency: 'strong' })
const mediaStore = getStore({ name: 'restock-mq-media', consistency: 'strong' })
const key = (name: string) => `data/${name}.json`

export async function read<T>(name: string, fallback: T): Promise<T> { return (await store.get(key(name), { type: 'json' }) as T | null) ?? fallback }
export async function write<T>(name: string, value: T) { await store.setJSON(key(name), value) }
export async function audit(event: Record<string, unknown>) { const events = await read<Record<string, unknown>[]>('audit', []); events.push({ ...event, createdAt: new Date().toISOString() }); await write('audit', events) }
export async function writeMedia(key: string, data: ArrayBuffer, contentType: string) { await mediaStore.set(key, data, { metadata: { contentType, uploadedAt: new Date().toISOString() } }) }
export async function readMedia(key: string) { return mediaStore.getWithMetadata(key) }
