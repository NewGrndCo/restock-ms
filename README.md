# Monsta Squeeze Retail Restock

Private, mobile-first retailer operations portal for Monsta Squeeze.

## Deployment contract

The intended production flow is GitHub `main` → Netlify project `restock-mq` → `restock.monstasqueeze.com`. No Netlify CLI deployment is configured or supported.

## Local development

```bash
npm install
npm run dev
```

Supabase environment configuration and the database migration are required before production authentication or business data can be enabled. Never commit secret keys or vendor PINs.
