-- Ownvista: growth features (Phase 9)
-- Run after 20260921000000_automation.sql. Paste into Supabase Dashboard > SQL Editor and run. Safe to re-run.
--
-- * profiles.market_id: the market whose site someone signed up on, so the admin Buyers tab can group by market.
-- * lead type 'interest' and leads.details: the express-interest form on listing pages saves the offer amount,
--   financing, pre-approval, and target closing date alongside the message.
-- * course_signups / course_emails: the seven-day seller email course, one row per signup and one per email sent.
-- * listing_ai_usage: one row per "Write it for me" call on the /sell form, for cost tracking. Rows are written
--   before the listing exists (draft_id), then matched to the listing when it's submitted.
-- The three new tables are server-only: row-level security on, no policies, no grants to anon or authenticated.

-- ---------------------------------------------------------------------------
-- Signup market on profiles
-- ---------------------------------------------------------------------------

alter table public.profiles add column if not exists market_id uuid references public.markets (id);

-- Existing accounts: use the market of their vendor profile, then their first listing.
update public.profiles p
set market_id = v.market_id
from public.vendors v
where v.profile_id = p.id and p.market_id is null;

update public.profiles p
set market_id = l.market_id
from (select distinct on (seller_id) seller_id, market_id from public.listings order by seller_id, created_at) l
where l.seller_id = p.id and p.market_id is null;

create index if not exists profiles_market_idx on public.profiles (market_id, created_at desc);

-- Only the server (secret key) sets this; the column stays out of the authenticated update grant.
revoke update (market_id) on public.profiles from authenticated;

-- ---------------------------------------------------------------------------
-- Expressions of interest
-- ---------------------------------------------------------------------------

-- Postgres allows adding an enum value inside a transaction as long as nothing uses it in the same transaction,
-- which nothing below does.
alter type public.lead_type add value if not exists 'interest';

-- Offer amount, financing, pre-approval, and target closing date for an 'interest' lead; null for other types.
alter table public.leads add column if not exists details jsonb;
alter table public.leads drop constraint if exists leads_details_size;
alter table public.leads add constraint leads_details_size check (details is null or pg_column_size(details) <= 4000);

-- Sellers read expressions of interest about their own listing, the same way they read plain messages.
-- The type is compared as text: an enum value added earlier in this same transaction can't be written as a
-- literal yet, and the comparison is against a single row's type either way.
drop policy if exists "leads: read received or admin" on public.leads;
create policy "leads: read received or admin" on public.leads
  for select to authenticated
  using (
    (select public.is_admin())
    or (type::text in ('listing', 'interest') and exists (
      select 1 from public.listings l where l.id = target_id and l.seller_id = (select auth.uid())))
    or (type::text = 'vendor' and exists (
      select 1 from public.vendors v where v.id = target_id and v.profile_id = (select auth.uid())))
  );

-- ---------------------------------------------------------------------------
-- Seven-day seller email course
-- ---------------------------------------------------------------------------

create table if not exists public.course_signups (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  market_id uuid not null references public.markets (id),
  -- The next lesson to send, 1 through 7. Reaching 8 sets completed_at and ends the course.
  next_day smallint not null default 1 check (next_day between 1 and 8),
  unsubscribe_token uuid not null default gen_random_uuid(),
  source text check (source is null or char_length(source) <= 200),
  created_at timestamptz not null default now(),
  last_sent_at timestamptz,
  completed_at timestamptz,
  unsubscribed_at timestamptz,
  constraint course_signups_email_format check (
    email = lower(btrim(email)) and char_length(email) <= 254 and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  )
);

create unique index if not exists course_signups_market_email_key on public.course_signups (market_id, email);
create unique index if not exists course_signups_unsubscribe_token_key on public.course_signups (unsubscribe_token);
-- The daily job's queue: still running, and either never sent or last sent before today.
create index if not exists course_signups_due_idx on public.course_signups (last_sent_at)
  where unsubscribed_at is null and completed_at is null;

alter table public.course_signups enable row level security;
revoke all on table public.course_signups from anon, authenticated;
grant select, insert, update, delete on table public.course_signups to service_role;

create table if not exists public.course_emails (
  id uuid primary key default gen_random_uuid(),
  signup_id uuid not null references public.course_signups (id) on delete cascade,
  day smallint not null check (day between 1 and 7),
  status text not null check (status in ('sending', 'sent', 'skipped', 'failed')),
  resend_id text,
  error text check (error is null or char_length(error) <= 1000),
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  unique (signup_id, day)
);

create index if not exists course_emails_created_idx on public.course_emails (created_at desc);

alter table public.course_emails enable row level security;
revoke all on table public.course_emails from anon, authenticated;
grant select, insert, update, delete on table public.course_emails to service_role;

-- ---------------------------------------------------------------------------
-- AI listing description usage
-- ---------------------------------------------------------------------------

create table if not exists public.listing_ai_usage (
  id uuid primary key default gen_random_uuid(),
  -- Identifies one seller's draft on the /sell form, before a listing row exists.
  draft_id uuid not null,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  market_id uuid not null references public.markets (id),
  -- Filled in when the draft is submitted, so usage can be totalled per listing.
  listing_id uuid references public.listings (id) on delete set null,
  model text not null check (char_length(model) <= 80),
  input_tokens integer not null default 0 check (input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  variants smallint not null default 0 check (variants >= 0),
  created_at timestamptz not null default now()
);

create index if not exists listing_ai_usage_draft_idx on public.listing_ai_usage (draft_id);
create index if not exists listing_ai_usage_listing_idx on public.listing_ai_usage (listing_id);
create index if not exists listing_ai_usage_created_idx on public.listing_ai_usage (created_at desc);

alter table public.listing_ai_usage enable row level security;
revoke all on table public.listing_ai_usage from anon, authenticated;
grant select, insert, update, delete on table public.listing_ai_usage to service_role;
