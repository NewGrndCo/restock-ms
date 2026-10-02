-- Durable inventory history for dated on-hand adjustments.
create table if not exists public.inventory_transactions (
  id uuid primary key default gen_random_uuid(),
  product_name text not null,
  previous_quantity integer not null check (previous_quantity >= 0),
  quantity integer not null check (quantity >= 0),
  delta integer not null,
  reason text not null default 'MANUAL_COUNT',
  actor_type text not null default 'ADMIN' check (actor_type in ('ADMIN', 'VENDOR', 'SYSTEM')),
  created_at timestamptz not null default now()
);

alter table public.inventory_transactions enable row level security;
create index if not exists inventory_transactions_product_created_idx on public.inventory_transactions(product_name, created_at desc);
