create extension if not exists pgcrypto;

create type public.account_status as enum ('ACTIVE', 'SUSPENDED', 'CLOSED');
create type public.order_source as enum ('PORTAL', 'PHONE');
create type public.order_status as enum ('SUBMITTED', 'APPROVED', 'INVENTORY_CHECK', 'PRODUCTION_REQUIRED', 'IN_PRODUCTION', 'READY', 'ROUTE_ASSIGNED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'PAYMENT_VERIFIED', 'CLOSED');
create type public.payment_method as enum ('CHECK', 'CASH');
create type public.payment_status as enum ('EXPECTED', 'COLLECTED', 'OUTSTANDING');
create type public.inventory_bucket as enum ('FINISHED', 'VENDOR_ALLOCATED', 'RESERVE', 'STREET');

create table public.vendors (
  id uuid primary key default gen_random_uuid(),
  vendor_id text not null unique check (vendor_id ~ '^MS-R[0-9]{3,}$'),
  store_name text not null,
  address text not null,
  city text not null,
  state text not null,
  zip text not null,
  contact_name text not null,
  phone text not null,
  email text,
  account_status public.account_status not null default 'ACTIVE',
  wholesale_price numeric(10,2) not null default 4.00 check (wholesale_price >= 0),
  minimum_order_quantity integer not null default 24 check (minimum_order_quantity > 0),
  preferred_payment_method public.payment_method not null default 'CHECK',
  brand_kit_status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_delivery_at timestamptz,
  notes text
);

create table public.vendor_credentials (
  vendor_id uuid primary key references public.vendors(id) on delete restrict,
  pin_hash text not null,
  failed_attempts integer not null default 0 check (failed_attempts >= 0),
  locked_until timestamptz,
  pin_changed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sku text unique,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  vendor_id uuid not null references public.vendors(id) on delete restrict,
  order_source public.order_source not null default 'PORTAL',
  status public.order_status not null default 'SUBMITTED',
  wholesale_price numeric(10,2) not null check (wholesale_price >= 0),
  minimum_order_quantity integer not null check (minimum_order_quantity > 0),
  payment_method public.payment_method not null,
  total_bottles integer not null default 0 check (total_bottles >= 0),
  total_amount numeric(10,2) not null default 0 check (total_amount >= 0),
  requested_delivery_cycle date,
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  product_id uuid not null references public.products(id) on delete restrict,
  quantity integer not null check (quantity >= 0),
  unit_price numeric(10,2) not null check (unit_price >= 0),
  created_at timestamptz not null default now(),
  unique(order_id, product_id)
);

create table public.sell_through_reports (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id) on delete restrict,
  previous_order_id uuid not null unique references public.orders(id) on delete restrict,
  best_selling_product_id uuid not null references public.products(id) on delete restrict,
  slowest_selling_product_id uuid not null references public.products(id) on delete restrict,
  notes text,
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.sell_through_items (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.sell_through_reports(id) on delete restrict,
  product_id uuid not null references public.products(id) on delete restrict,
  delivered_quantity integer not null check (delivered_quantity >= 0),
  remaining_quantity integer not null check (remaining_quantity >= 0 and remaining_quantity <= delivered_quantity),
  created_at timestamptz not null default now(),
  unique(report_id, product_id)
);

create table public.order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  from_status public.order_status,
  to_status public.order_status not null,
  changed_by uuid,
  changed_at timestamptz not null default now(),
  notes text
);

create table public.inventory_transactions (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete restrict,
  bucket public.inventory_bucket not null,
  quantity_delta integer not null check (quantity_delta <> 0),
  order_id uuid references public.orders(id) on delete restrict,
  reason text not null,
  created_at timestamptz not null default now()
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id) on delete restrict,
  order_id uuid not null unique references public.orders(id) on delete restrict,
  amount numeric(10,2) not null check (amount >= 0),
  method public.payment_method not null,
  status public.payment_status not null default 'EXPECTED',
  paid_at timestamptz,
  reference_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.products (name, sku) values
  ('Strawberry Lemonade', 'MS-STRAWBERRY'),
  ('Classic Lemonade', 'MS-CLASSIC'),
  ('Half & Half', 'MS-HALF-HALF')
on conflict (name) do nothing;

alter table public.vendors enable row level security;
alter table public.vendor_credentials enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.sell_through_reports enable row level security;
alter table public.sell_through_items enable row level security;
alter table public.order_status_history enable row level security;
alter table public.inventory_transactions enable row level security;
alter table public.payments enable row level security;

-- No public policies are granted by this foundation migration. Vendor PIN verification,
-- session issuance, and admin operations must run through protected server-side functions.
