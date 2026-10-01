# Restock operating model

The vendor portal and admin CMS are two views of one order system.

## Ownership

- Admins create, activate, suspend, close, and reset vendor accounts.
- Vendors cannot register themselves and cannot choose another vendor account.
- A vendor session resolves its vendor on the server; the client never chooses the vendor ID for reads or writes.
- Admins can see the shared order queue across all vendors.

## Order loop

1. Admin creates a vendor account and generates a PIN.
2. Vendor enters the PIN and receives a scoped, expiring session.
3. Vendor reports the previous delivery's sell-through when required.
4. Vendor submits a portal restock order, which is stored as `order_source = PORTAL`.
5. Phone orders use the same order tables with `order_source = PHONE`.
6. Admin reviews and advances the controlled order state.
7. Approved demand contributes to production requirements.
8. Inventory is allocated to the vendor order, then delivered and paid.
9. The order, status history, sell-through, inventory movements, delivery, and payment remain visible in history.

## CMS-controlled content

Admins will manage product name, description, image, active state, display order, wholesale price, and minimum order rules. Vendor records will carry optional logo and hero-image references for each vendor dashboard.

All content and inventory edits need server-side authorization and audit events. The current local previews show the intended experience only; they do not claim to persist or authorize these actions until Supabase is configured and verified.
