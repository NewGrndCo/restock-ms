-- Product and account control layer for the admin-owned operating model.
-- Apply only after the foundation migration and after reviewing RLS policies
-- against the deployed Supabase project.

alter table public.products
  add column if not exists description text,
  add column if not exists image_url text,
  add column if not exists display_order integer not null default 0;

alter table public.vendors
  add column if not exists logo_url text,
  add column if not exists hero_image_url text;

create table public.admin_users (
  user_id uuid primary key references auth.users(id) on delete restrict,
  display_name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.vendor_sessions (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id) on delete restrict,
  session_hash text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_type text not null check (actor_type in ('VENDOR', 'ADMIN', 'SYSTEM')),
  actor_id uuid,
  vendor_id uuid references public.vendors(id) on delete restrict,
  order_id uuid references public.orders(id) on delete restrict,
  event_type text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;
alter table public.vendor_sessions enable row level security;
alter table public.audit_events enable row level security;

-- These tables intentionally have no client-facing policies yet. The server-side
-- authentication and admin/vendor policy functions must be deployed together.
