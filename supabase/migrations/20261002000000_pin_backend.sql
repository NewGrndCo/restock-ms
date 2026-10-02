-- Restock PIN-only backend.
-- This migration intentionally does not create Supabase Auth users or email flows.
-- Netlify server functions use the service role key and retain the existing signed PIN session cookie.

create extension if not exists pgcrypto;

create table if not exists public.vendors (
  id uuid primary key default gen_random_uuid(),
  vendor_id text not null unique check (vendor_id ~ '^MS-R[0-9]{3,}$'),
  store_name text not null,
  contact_name text not null,
  phone text not null,
  address text not null,
  city text not null,
  state text not null,
  zip text not null,
  pin_hash text not null,
  image_path text,
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'SUSPENDED', 'CLOSED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sku text unique,
  color text not null default '#ffc400',
  inventory integer not null default 0 check (inventory >= 0),
  image_path text,
  active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  vendor_id uuid not null references public.vendors(id) on delete restrict,
  status text not null default 'SUBMITTED',
  payment_method text not null check (payment_method in ('CHECK', 'CASH')),
  total_bottles integer not null default 0 check (total_bottles >= 0),
  total_amount numeric(10,2) not null default 0 check (total_amount >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  product_id uuid not null references public.products(id) on delete restrict,
  product_name text not null,
  quantity integer not null check (quantity >= 0),
  unit_price numeric(10,2) not null default 4.00 check (unit_price >= 0),
  created_at timestamptz not null default now(),
  unique(order_id, product_id)
);

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_type text not null check (actor_type in ('VENDOR', 'ADMIN', 'SYSTEM')),
  actor_id uuid,
  vendor_id uuid references public.vendors(id) on delete restrict,
  order_id uuid references public.orders(id) on delete restrict,
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.app_store (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

insert into public.products (name, sku, color, display_order) values
  ('Strawberry Lemonade', 'MS-STRAWBERRY', '#e31b18', 1),
  ('Classic Lemonade', 'MS-CLASSIC', '#ffc400', 2),
  ('Half & Half', 'MS-HALF-HALF', '#f36b16', 3),
  ('Alkaline Water', 'MS-ALKALINE', '#38bdf8', 4),
  ('Blueberry Lemonade', 'MS-BLUEBERRY', '#4f46e5', 5),
  ('Mango Lemonade', 'MS-MANGO', '#f59e0b', 6),
  ('Raspberry Lemonade', 'MS-RASPBERRY', '#be185d', 7),
  ('Pineapple Lemonade', 'MS-PINEAPPLE', '#facc15', 8)
on conflict (name) do update set color = excluded.color, display_order = excluded.display_order;

alter table public.vendors enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.audit_events enable row level security;
alter table public.app_store enable row level security;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('restock-media', 'restock-media', false, 3145728, array['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[])
on conflict (id) do update set public = false, file_size_limit = 3145728, allowed_mime_types = excluded.allowed_mime_types;

create index if not exists orders_vendor_id_idx on public.orders(vendor_id);
create index if not exists order_items_order_id_idx on public.order_items(order_id);
create index if not exists audit_events_created_at_idx on public.audit_events(created_at desc);
