# Monsta Squeeze Retail Restock

Private, mobile-first retailer operations portal for Monsta Squeeze. Manage retailer orders, inventory, deliveries, and vendor workflows from one focused operations workspace.

## Repository description

Private Monsta Squeeze operations portal for retailer orders, inventory, deliveries, and vendor workflows.

## Deployment contract

The intended production flow is GitHub `main` → Netlify project `restock-mq` → `restock.monstasqueeze.com`. No Netlify CLI deployment is configured or supported.

## Local development

```bash
npm install
npm run dev
```

Supabase environment configuration and the database migration are required before production authentication or business data can be enabled. Never commit secret keys or vendor PINs.

## Interim Netlify backend

The current no-Supabase implementation uses Netlify Functions and site-scoped Netlify Blobs. Configure `RESTOCK_SESSION_SECRET` and `ADMIN_BOOTSTRAP_PIN` as Netlify environment variables; never place their values in GitHub or the frontend bundle. The bootstrap admin PIN is six digits. Vendor PINs are generated server-side as four digits and stored only as hashes.

## Squeeze Rush delivery notifications

To announce delivered drinks through Squeeze Rush push notifications, configure both variables in the Netlify production runtime:

- `MONSTA_AUTOMATION_URL` — the Squeeze Rush `monsta-control` Edge Function URL.
- `MONSTA_AUTOMATION_TOKEN` — a shared high-entropy secret that exactly matches the Supabase Edge Function secret of the same name.

Delivery updates remain successful if notification delivery is unavailable. Each notification event is best-effort and deduplicated by order and product in Squeeze Rush.
