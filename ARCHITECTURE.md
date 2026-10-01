# Restock MQ architecture

## Boundary

The browser is a presentation client only. Vendor PIN verification, session issuance, vendor scoping, order creation, inventory allocation, delivery confirmation, payment changes, and administrative actions must execute through protected server-side operations.

The first migration intentionally enables RLS without public policies. This prevents a partially configured frontend from exposing vendor or operational data.

## Planned authentication flow

1. Vendor submits a PIN over TLS.
2. A server-side function applies cooldown checks and verifies the stored password hash.
3. The function returns an opaque, expiring session cookie containing only a session identifier.
4. Every vendor read/write resolves the vendor from the server-side session, never from a client-provided vendor ID.
5. Admin authentication uses a separate identity and role boundary.

PIN hashes, service-role credentials, and administrative secrets must never ship in the Vite bundle.

## Operational state boundaries

Orders use the controlled `order_status` enum. Important transitions are append-only in `order_status_history`. Inventory is represented by auditable transactions across distinct buckets rather than one freely editable quantity.

## External configuration still required

- Create the private GitHub repository `NewGrndCo/restock-mq`.
- Create a Supabase project and apply the migration.
- Configure the server-side authentication functions and admin identity boundary.
- Create/link the Netlify project `restock-mq` to GitHub `main`.
- Configure the production domain `restock.monstasqueeze.com`.
