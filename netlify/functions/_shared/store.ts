import { getStore } from '@netlify/blobs'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createHash, randomUUID } from 'node:crypto'
import { secret } from './env'

export type Role = 'ADMIN' | 'VENDOR'
export type Vendor = { id: string; vendorId: string; storeName: string; contactName: string; phone: string; address: string; city: string; state: string; zip: string; pinHash: string; pin?: string; imageKey?: string; status: 'ACTIVE' | 'SUSPENDED' | 'CLOSED'; createdAt: string }
export type Order = { id: string; orderNumber: string; vendorId: string; source: 'PORTAL' | 'PHONE'; status: string; items: Array<{ product: string; quantity: number }>; totalBottles: number; totalAmount: number; paymentMethod: 'CHECK' | 'CASH'; createdAt: string }
export type CatalogProduct = { name: string; color: string; inventory: number; imageKey?: string }
export type InventoryEntry = { id: string; productName: string; previousQuantity: number; quantity: number; delta: number; reason: string; actorType: Role | 'SYSTEM'; createdAt: string }
export type DriverLocation = { driverKey: string; driverLabel: string; latitude: number; longitude: number; accuracyMeters?: number; heading?: number; speedMps?: number; updatedAt: string }

const store = getStore({ name: 'restock-mq-data', consistency: 'strong' })
const mediaStore = getStore({ name: 'restock-mq-media', consistency: 'strong' })
const key = (name: string) => `data/${name}.json`
let supabase: SupabaseClient | null | undefined
function getSupabase() { if (supabase !== undefined) return supabase; const url = secret('SUPABASE_URL'); const serviceKey = secret('SUPABASE_SERVICE_ROLE_KEY'); supabase = url && serviceKey ? createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } }) : null; return supabase }

export async function read<T>(name: string, fallback: T): Promise<T> { const client = getSupabase(); if (client) { const { data, error } = await client.from('app_store').select('value').eq('key', name).maybeSingle(); if (error) throw error; if (data?.value !== undefined) return data.value as T; return (await store.get(key(name), { type: 'json' }) as T | null) ?? fallback }; return (await store.get(key(name), { type: 'json' }) as T | null) ?? fallback }
export async function write<T>(name: string, value: T) { const client = getSupabase(); if (client) { const { error } = await client.from('app_store').upsert({ key: name, value, updated_at: new Date().toISOString() }); if (error) throw error; return }; await store.setJSON(key(name), value) }
export async function audit(event: Record<string, unknown>) { const events = await read<Record<string, unknown>[]>('audit', []); events.push({ ...event, createdAt: new Date().toISOString() }); await write('audit', events) }
export async function readInventoryHistory() {
  const client = getSupabase()
  if (client) {
    const { data, error } = await client.from('inventory_transactions').select('id,product_name,previous_quantity,quantity,delta,reason,actor_type,created_at').order('created_at', { ascending: false }).limit(200)
    if (error) throw error
    return (data ?? []).map((entry) => ({ id: entry.id, productName: entry.product_name, previousQuantity: entry.previous_quantity, quantity: entry.quantity, delta: entry.delta, reason: entry.reason, actorType: entry.actor_type, createdAt: entry.created_at })) as InventoryEntry[]
  }
  return await read<InventoryEntry[]>('inventory-log', [])
}
export async function recordInventoryChange(entry: Omit<InventoryEntry, 'id' | 'createdAt'>) {
  const createdAt = new Date().toISOString(); const id = randomUUID(); const client = getSupabase()
  if (client) {
    const { error } = await client.from('inventory_transactions').insert({ id, product_name: entry.productName, previous_quantity: entry.previousQuantity, quantity: entry.quantity, delta: entry.delta, reason: entry.reason, actor_type: entry.actorType, created_at: createdAt })
    if (error) throw error
    return { ...entry, id, createdAt }
  }
  const history = await read<InventoryEntry[]>('inventory-log', []); const saved = { ...entry, id, createdAt }; await write('inventory-log', [saved, ...history].slice(0, 200)); return saved
}
const driverKey = (sessionId: string) => createHash('sha256').update(sessionId).digest('hex')
export const driverLocationKey = driverKey
export async function readDriverLocations() {
  const client = getSupabase()
  if (client) {
    const { data, error } = await client.from('driver_locations').select('driver_key,driver_label,latitude,longitude,accuracy_meters,heading,speed_mps,updated_at').order('updated_at', { ascending: false })
    if (!error) return (data ?? []).map((entry) => ({ driverKey: entry.driver_key, driverLabel: entry.driver_label, latitude: entry.latitude, longitude: entry.longitude, accuracyMeters: entry.accuracy_meters ?? undefined, heading: entry.heading ?? undefined, speedMps: entry.speed_mps ?? undefined, updatedAt: entry.updated_at })) as DriverLocation[]
  }
  return await read<DriverLocation[]>('driver-locations', [])
}
export async function writeDriverLocation(location: DriverLocation) {
  const client = getSupabase()
  if (client) {
    const { error } = await client.from('driver_locations').upsert({ driver_key: location.driverKey, driver_label: location.driverLabel, latitude: location.latitude, longitude: location.longitude, accuracy_meters: location.accuracyMeters ?? null, heading: location.heading ?? null, speed_mps: location.speedMps ?? null, updated_at: location.updatedAt })
    if (!error) return
  }
  const locations = (await read<DriverLocation[]>('driver-locations', [])).filter((entry) => entry.driverKey !== location.driverKey)
  await write('driver-locations', [location, ...locations].slice(0, 25))
}
export async function removeDriverLocation(sessionId: string) {
  const keyValue = driverKey(sessionId); const client = getSupabase()
  if (client) { const { error } = await client.from('driver_locations').delete().eq('driver_key', keyValue); if (!error) return }
  await write('driver-locations', (await read<DriverLocation[]>('driver-locations', [])).filter((entry) => entry.driverKey !== keyValue))
}
export async function writeMedia(key: string, data: ArrayBuffer, contentType: string) { const client = getSupabase(); if (client) { const { error } = await client.storage.from('restock-media').upload(key, data, { contentType, upsert: true }); if (error) throw error; return }; await mediaStore.set(key, data, { metadata: { contentType, uploadedAt: new Date().toISOString() } }) }
export async function readMedia(key: string) { const client = getSupabase(); if (client) { const { data, error } = await client.storage.from('restock-media').download(key); if (!error && data) return { data: await data.arrayBuffer(), metadata: { contentType: data.type } }; return mediaStore.getWithMetadata(key) }; return mediaStore.getWithMetadata(key) }
