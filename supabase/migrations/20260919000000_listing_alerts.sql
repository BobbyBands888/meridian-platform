-- Nashville Buys: buyer listing alert signups
-- Run after 20260918000000_vendor_verification.sql. Paste into Supabase Dashboard > SQL Editor and run. Safe to re-run.
--
-- Collects emails (and an optional ZIP) from the "Get new Nashville FSBO listings by email" form. Only the server
-- reads or writes this table, using the secret key: row-level security is on with no policies, so the publishable
-- key can't see or add rows. Each signup gets a random unsubscribe token for the link in every email.

create table if not exists public.listing_alerts (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  zip text,
  unsubscribe_token uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  unsubscribed_at timestamptz,
  constraint listing_alerts_email_format check (
    email = lower(btrim(email)) and char_length(email) <= 254 and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  ),
  constraint listing_alerts_zip_format check (zip is null or zip ~ '^[0-9]{5}$')
);

create unique index if not exists listing_alerts_email_key on public.listing_alerts (email);
create unique index if not exists listing_alerts_unsubscribe_token_key on public.listing_alerts (unsubscribe_token);
create index if not exists listing_alerts_active_idx on public.listing_alerts (created_at) where unsubscribed_at is null;

alter table public.listing_alerts enable row level security;
revoke all on table public.listing_alerts from anon, authenticated;
grant select, insert, update, delete on table public.listing_alerts to service_role;
