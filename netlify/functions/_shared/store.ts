import { getStore } from '@netlify/blobs'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { secret } from './env'

export type Role = 'ADMIN' | 'VENDOR'
export type Vendor = { id: string; vendorId: string; storeName: string; contactName: string; phone: string; address: string; city: string; state: string; zip: string; pinHash: string; imageKey?: string; status: 'ACTIVE' | 'SUSPENDED' | 'CLOSED'; createdAt: string }
export type Order = { id: string; orderNumber: string; vendorId: string; source: 'PORTAL' | 'PHONE'; status: string; items: Array<{ product: string; quantity: number }>; totalBottles: number; totalAmount: number; paymentMethod: 'CHECK' | 'CASH'; createdAt: string }
export type CatalogProduct = { name: string; color: string; inventory: number; imageKey?: string }

const store = getStore({ name: 'restock-mq-data', consistency: 'strong' })
const mediaStore = getStore({ name: 'restock-mq-media', consistency: 'strong' })
const key = (name: string) => `data/${name}.json`
let supabase: SupabaseClient | null | undefined
function getSupabase() { if (supabase !== undefined) return supabase; const url = secret('SUPABASE_URL'); const serviceKey = secret('SUPABASE_SERVICE_ROLE_KEY'); supabase = url && serviceKey ? createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } }) : null; return supabase }

export async function read<T>(name: string, fallback: T): Promise<T> { const client = getSupabase(); if (client) { const { data, error } = await client.from('app_store').select('value').eq('key', name).maybeSingle(); if (error) throw error; if (data?.value !== undefined) return data.value as T; return (await store.get(key(name), { type: 'json' }) as T | null) ?? fallback }; return (await store.get(key(name), { type: 'json' }) as T | null) ?? fallback }
export async function write<T>(name: string, value: T) { const client = getSupabase(); if (client) { const { error } = await client.from('app_store').upsert({ key: name, value, updated_at: new Date().toISOString() }); if (error) throw error; return }; await store.setJSON(key(name), value) }
export async function audit(event: Record<string, unknown>) { const events = await read<Record<string, unknown>[]>('audit', []); events.push({ ...event, createdAt: new Date().toISOString() }); await write('audit', events) }
export async function writeMedia(key: string, data: ArrayBuffer, contentType: string) { const client = getSupabase(); if (client) { const { error } = await client.storage.from('restock-media').upload(key, data, { contentType, upsert: true }); if (error) throw error; return }; await mediaStore.set(key, data, { metadata: { contentType, uploadedAt: new Date().toISOString() } }) }
export async function readMedia(key: string) { const client = getSupabase(); if (client) { const { data, error } = await client.storage.from('restock-media').download(key); if (!error && data) return { data: await data.arrayBuffer(), metadata: { contentType: data.type } }; return mediaStore.getWithMetadata(key) }; return mediaStore.getWithMetadata(key) }
