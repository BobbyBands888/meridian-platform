-- Ownvista: automation (Phase 8)
-- Run after 20260920000000_markets.sql. Paste into Supabase Dashboard > SQL Editor and run. Safe to re-run.
--
-- * listing_alert_sends: one row per (subscriber, listing). Buyers never get the same listing twice, the daily cap of
--   instant alerts is counted from it, and listings over the cap wait here (status queued) for the morning digest.
-- * vendor_emails: one row per (vendor, email, period) for the day-2, day-14, and monthly emails, so none repeat.
-- * listing_syndication: one row per (listing, channel) for Facebook posts: posted, skipped (no page token), or failed.
-- * vendors.approved_at (set automatically on approval), vendors.lifecycle_unsubscribed_at, and vendors.email_token for
--   the unsubscribe link in lifecycle emails. markets.launched_at (set automatically when a market goes live).
-- All new tables are server-only: row-level security on, no policies, no grants to anon or authenticated.

-- ---------------------------------------------------------------------------
-- Vendors and markets
-- ---------------------------------------------------------------------------

alter table public.vendors add column if not exists approved_at timestamptz;
alter table public.vendors add column if not exists lifecycle_unsubscribed_at timestamptz;
alter table public.vendors add column if not exists email_token uuid not null default gen_random_uuid();
create unique index if not exists vendors_email_token_key on public.vendors (email_token);

-- Vendors approved before this migration count from their signup date.
update public.vendors set approved_at = created_at where status = 'approved' and approved_at is null;

create or replace function public.set_vendor_approved_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'approved' and old.status is distinct from 'approved' then
    new.approved_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists vendors_set_approved_at on public.vendors;
create trigger vendors_set_approved_at
  before update of status on public.vendors
  for each row execute function public.set_vendor_approved_at();

alter table public.markets add column if not exists launched_at timestamptz;
update public.markets set launched_at = now() where status = 'live' and launched_at is null;

-- The first launch date is kept if a market is set back to coming soon and launched again.
create or replace function public.set_market_launched_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'live' and new.launched_at is null then
    new.launched_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists markets_set_launched_at on public.markets;
create trigger markets_set_launched_at
  before update of status on public.markets
  for each row execute function public.set_market_launched_at();

-- ---------------------------------------------------------------------------
-- Buyer alert sends
-- ---------------------------------------------------------------------------

create table if not exists public.listing_alert_sends (
  id uuid primary key default gen_random_uuid(),
  alert_id uuid not null references public.listing_alerts (id) on delete cascade,
  listing_id uuid not null references public.listings (id) on delete cascade,
  market_id uuid not null references public.markets (id),
  -- sending: claimed by a send in progress; sent; queued: over the daily cap, waiting for the digest;
  -- skipped: the listing or subscription ended before the digest; failed: Resend refused it.
  status text not null check (status in ('sending', 'sent', 'queued', 'skipped', 'failed')),
  via text check (via is null or via in ('instant', 'digest')),
  -- The subscriber's market-local date of an instant send, for the daily cap.
  send_date date,
  resend_id text,
  error text check (error is null or char_length(error) <= 1000),
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  unique (alert_id, listing_id)
);

create index if not exists listing_alert_sends_cap_idx on public.listing_alert_sends (alert_id, send_date) where via = 'instant';
create index if not exists listing_alert_sends_queued_idx on public.listing_alert_sends (status, created_at) where status = 'queued';
create index if not exists listing_alert_sends_created_idx on public.listing_alert_sends (created_at desc);

alter table public.listing_alert_sends enable row level security;
revoke all on table public.listing_alert_sends from anon, authenticated;
grant select, insert, update, delete on table public.listing_alert_sends to service_role;

-- ---------------------------------------------------------------------------
-- Vendor lifecycle emails
-- ---------------------------------------------------------------------------

create table if not exists public.vendor_emails (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors (id) on delete cascade,
  kind text not null check (kind in ('day2', 'day14', 'monthly')),
  -- '' for one-time emails; 'YYYY-MM' (the month reported) for the monthly summary.
  period text not null default '' check (period = '' or period ~ '^[0-9]{4}-[0-9]{2}$'),
  status text not null check (status in ('sending', 'sent', 'failed')),
  resend_id text,
  error text check (error is null or char_length(error) <= 1000),
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  unique (vendor_id, kind, period)
);

create index if not exists vendor_emails_created_idx on public.vendor_emails (created_at desc);

alter table public.vendor_emails enable row level security;
revoke all on table public.vendor_emails from anon, authenticated;
grant select, insert, update, delete on table public.vendor_emails to service_role;

-- ---------------------------------------------------------------------------
-- Listing syndication (Facebook)
-- ---------------------------------------------------------------------------

create table if not exists public.listing_syndication (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  market_id uuid not null references public.markets (id),
  channel text not null check (channel in ('facebook')),
  status text not null check (status in ('posting', 'posted', 'skipped', 'failed')),
  external_id text,
  error text check (error is null or char_length(error) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (listing_id, channel)
);

create index if not exists listing_syndication_created_idx on public.listing_syndication (created_at desc);

drop trigger if exists listing_syndication_touch_updated_at on public.listing_syndication;
create trigger listing_syndication_touch_updated_at
  before update on public.listing_syndication
  for each row execute function public.touch_updated_at();

alter table public.listing_syndication enable row level security;
revoke all on table public.listing_syndication from anon, authenticated;
grant select, insert, update, delete on table public.listing_syndication to service_role;
