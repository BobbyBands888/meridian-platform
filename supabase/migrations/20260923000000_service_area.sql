-- Ownvista: Nashville service area expansion
-- Run after 20260922000000_growth.sql. Paste into Supabase Dashboard > SQL Editor and run. Safe to re-run.
--
-- * Nashville Buys covers ten counties: Maury, Montgomery, Robertson, Cheatham, and Dickson join the original five.
--   ZIP codes live in the app (lib/markets/zips); this keeps markets.counties, shown in the admin, in step.
-- * area_waitlist: people outside a market's ZIP codes who leave an email to hear when we reach their area.

update public.markets
set counties = array['Davidson', 'Williamson', 'Rutherford', 'Sumner', 'Wilson', 'Maury', 'Montgomery', 'Robertson', 'Cheatham', 'Dickson']
where slug = 'nashville';

create table if not exists public.area_waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  market_id uuid not null references public.markets (id),
  zip text not null check (zip ~ '^[0-9]{5}$'),
  source text check (source is null or char_length(source) <= 200),
  created_at timestamptz not null default now(),
  constraint area_waitlist_email_format check (
    email = lower(btrim(email)) and char_length(email) <= 254 and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  )
);

create unique index if not exists area_waitlist_market_email_zip_key on public.area_waitlist (market_id, email, zip);
create index if not exists area_waitlist_market_zip_idx on public.area_waitlist (market_id, zip);

-- Server only: the app writes with the secret key after checking Turnstile.
alter table public.area_waitlist enable row level security;
revoke all on table public.area_waitlist from anon, authenticated;
grant select, insert, update, delete on table public.area_waitlist to service_role;
