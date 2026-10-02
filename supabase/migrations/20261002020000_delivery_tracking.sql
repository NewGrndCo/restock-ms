-- Delivery route and near-real-time driver location support.
-- Coordinates are written only by the signed server session; no browser service key is used.
create table if not exists public.driver_locations (
  driver_key text primary key,
  driver_label text not null default 'Driver',
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  accuracy_meters double precision,
  heading double precision,
  speed_mps double precision,
  updated_at timestamptz not null default now()
);

alter table public.driver_locations enable row level security;
create index if not exists driver_locations_updated_at_idx on public.driver_locations(updated_at desc);
