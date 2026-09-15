-- Ownvista: multi-market (Phase 7)
-- Run after 20260919000000_listing_alerts.sql. Paste into Supabase Dashboard > SQL Editor and run. Safe to re-run.
--
-- * markets: one row per city site (Nashville Buys, Tampa Buys, ...). The app picks the market from the request's
--   hostname, and the admin can flip a market from coming_soon to live.
-- * vendors, listings, leads, and listing_alerts get a market_id. Existing rows are assigned to Nashville.
-- * Public views only show vendors and listings from live markets.
-- * submit_vendor_application and submit_listing take the market's slug. Listings are only accepted in live markets.
-- * sign_in_link_requests: sign-in emails are now sent by the app (so each market's sender and brand apply), and
--   this table keeps the per-address rate limit Supabase used to enforce.

-- ---------------------------------------------------------------------------
-- Markets
-- ---------------------------------------------------------------------------

create table if not exists public.markets (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z][a-z0-9-]{1,30}$' and slug not in ('hub', 'www', 'api', 'admin')),
  name text not null check (char_length(name) between 2 and 40),
  short_name text not null check (char_length(short_name) between 2 and 12),
  region text not null check (char_length(region) between 2 and 60),
  state text not null check (char_length(state) between 2 and 40),
  state_code text not null check (state_code ~ '^[A-Z]{2}$'),
  status text not null default 'coming_soon' check (status in ('live', 'coming_soon')),
  domain text not null unique check (domain ~ '^[a-z0-9-]+(\.[a-z0-9-]+)+$' and domain !~ '^www\.'),
  counties text[] not null default '{}',
  sender_email text not null check (sender_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  closing_note text not null check (char_length(closing_note) between 3 and 80),
  disclosure_note text not null check (char_length(disclosure_note) between 10 and 400),
  timezone text not null default 'America/New_York',
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.markets enable row level security;

-- Market details are public (they drive every public page). Only the server, with the secret key, changes them.
revoke all on table public.markets from anon, authenticated;
grant select on table public.markets to anon, authenticated;
grant select, insert, update, delete on table public.markets to service_role;

drop policy if exists "markets: public read" on public.markets;
create policy "markets: public read" on public.markets for select to anon, authenticated using (true);

drop trigger if exists markets_touch_updated_at on public.markets;
create trigger markets_touch_updated_at
  before update on public.markets
  for each row execute function public.touch_updated_at();

-- Seed rows. "do nothing" on conflict so re-running never undoes a launch or later edits made in the table.
insert into public.markets (slug, name, short_name, region, state, state_code, status, domain, counties, sender_email, closing_note, disclosure_note, timezone, sort_order)
values
  ('nashville', 'Nashville', 'NSH', 'Middle Tennessee', 'Tennessee', 'TN', 'live', 'nashvillebuys.com',
   array['Davidson', 'Williamson', 'Rutherford', 'Sumner', 'Wilson'], 'hello@nashvillebuys.com',
   'attorney or title company',
   'Tennessee requires sellers to provide buyers a Residential Property Condition Disclosure.',
   'America/Chicago', 1),
  ('tampa', 'Tampa', 'TPA', 'Tampa Bay', 'Florida', 'FL', 'coming_soon', 'tampabuys.com',
   array['Hillsborough', 'Pinellas', 'Pasco'], 'hello@tampabuys.com',
   'title company',
   'Florida law requires sellers to tell buyers about known defects that materially affect a home''s value.',
   'America/New_York', 2),
  ('orlando', 'Orlando', 'ORL', 'Central Florida', 'Florida', 'FL', 'coming_soon', 'orlandobuys.com',
   array['Orange', 'Seminole', 'Osceola'], 'hello@orlandobuys.com',
   'title company',
   'Florida law requires sellers to tell buyers about known defects that materially affect a home''s value.',
   'America/New_York', 3)
on conflict (slug) do nothing;

-- Rows created before markets existed belong to Nashville. The column default also keeps any insert that doesn't name
-- a market working during a deploy; the app always sets market_id itself.
create or replace function public.default_market_id()
returns uuid
language sql
stable
set search_path = ''
as $$ select id from public.markets where slug = 'nashville' $$;

-- ---------------------------------------------------------------------------
-- market_id on vendors, listings, leads, listing_alerts
-- ---------------------------------------------------------------------------

alter table public.vendors add column if not exists market_id uuid references public.markets (id);
alter table public.listings add column if not exists market_id uuid references public.markets (id);
alter table public.leads add column if not exists market_id uuid references public.markets (id);
alter table public.listing_alerts add column if not exists market_id uuid references public.markets (id);

update public.vendors set market_id = public.default_market_id() where market_id is null;
update public.listings set market_id = public.default_market_id() where market_id is null;
update public.leads set market_id = public.default_market_id() where market_id is null;
update public.listing_alerts set market_id = public.default_market_id() where market_id is null;

alter table public.vendors alter column market_id set default public.default_market_id(), alter column market_id set not null;
alter table public.listings alter column market_id set default public.default_market_id(), alter column market_id set not null;
alter table public.leads alter column market_id set default public.default_market_id(), alter column market_id set not null;
alter table public.listing_alerts alter column market_id set default public.default_market_id(), alter column market_id set not null;

create index if not exists vendors_market_status_idx on public.vendors (market_id, status, category);
create index if not exists listings_market_status_idx on public.listings (market_id, status, created_at desc);
create index if not exists leads_market_created_idx on public.leads (market_id, created_at desc);

-- The same email can sign up for alerts in more than one market.
drop index if exists public.listing_alerts_email_key;
create unique index if not exists listing_alerts_market_email_key on public.listing_alerts (market_id, email);

-- Signed-in users choose a market when they create a vendor profile or listing (through the functions below).
-- Neither can move to another market afterwards: market_id is not in the update grants.
grant insert (market_id) on public.vendors to authenticated;
grant insert (market_id) on public.listings to authenticated;

-- Listings can only be created in live markets, even by inserting directly.
drop policy if exists "listings: insert own" on public.listings;
create policy "listings: insert own" on public.listings
  for insert to authenticated
  with check (
    seller_id = (select auth.uid())
    and exists (select 1 from public.markets m where m.id = market_id and m.status = 'live')
  );

-- ---------------------------------------------------------------------------
-- Public views: live markets only, with market_id for filtering
-- ---------------------------------------------------------------------------

drop view if exists public.public_vendors;
create view public.public_vendors
with (security_barrier = true)
as
select
  v.id,
  v.category,
  v.business_name,
  v.headshot_url,
  v.bio,
  v.service_area,
  v.price_range,
  v.website,
  v.founding_vendor,
  v.created_at,
  vv.verified_at,
  v.market_id
from public.vendors v
join public.markets m on m.id = v.market_id and m.status = 'live'
left join public.vendor_verifications vv on vv.vendor_id = v.id
where v.status = 'approved';

drop view if exists public.public_listing_photos;
drop view if exists public.public_listings;
create view public.public_listings
with (security_barrier = true)
as
select
  l.id,
  case when l.hide_exact_address then null else l.street end as street,
  l.city,
  l.zip,
  l.hide_exact_address,
  l.price,
  l.beds,
  l.baths,
  l.sqft,
  l.description,
  l.status,
  l.slug,
  l.created_at,
  l.updated_at,
  l.market_id
from public.listings l
join public.markets m on m.id = l.market_id and m.status = 'live'
where l.status in ('active', 'under_contract', 'sold');

create view public.public_listing_photos
with (security_barrier = true)
as
select p.id, p.listing_id, p.url, p.sort_order
from public.listing_photos p
join public.listings l on l.id = p.listing_id
join public.markets m on m.id = l.market_id and m.status = 'live'
where l.status in ('active', 'under_contract', 'sold');

revoke all on public.public_vendors, public.public_listings, public.public_listing_photos from anon, authenticated;
grant select on public.public_vendors, public.public_listings, public.public_listing_photos to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Vendor signup and listing submit take the market
-- ---------------------------------------------------------------------------

drop function if exists public.submit_vendor_application(public.vendor_category, text, text, text, text, text, text, boolean, boolean, boolean, boolean, boolean);

create or replace function public.submit_vendor_application(
  p_market text,
  p_category public.vendor_category,
  p_business_name text,
  p_headshot_url text,
  p_bio text,
  p_service_area text,
  p_price_range text,
  p_website text,
  p_licensed boolean,
  p_insured boolean,
  p_understands_connector boolean,
  p_handles_own_agreements boolean,
  p_read_terms boolean
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  market uuid;
  new_vendor_id uuid;
begin
  if uid is null then
    raise exception 'Sign in to join the vendor directory.' using errcode = '42501';
  end if;
  -- Vendors can pre-register in coming-soon markets; their profiles go public when the market launches.
  select id into market from public.markets where slug = p_market;
  if market is null then
    raise exception 'Unknown market.' using errcode = '22023';
  end if;

  insert into public.vendors (profile_id, market_id, category, business_name, headshot_url, bio, service_area, price_range, website)
  values (uid, market, p_category, p_business_name, p_headshot_url, p_bio, p_service_area, p_price_range, nullif(p_website, ''))
  returning id into new_vendor_id;

  insert into public.vendor_certifications (vendor_id, licensed, insured, understands_connector, handles_own_agreements, read_terms)
  values (new_vendor_id, p_licensed, p_insured, p_understands_connector, p_handles_own_agreements, p_read_terms);

  update public.profiles
  set roles = array(select distinct unnest(roles || array['vendor'::public.user_role]))
  where id = uid;

  return new_vendor_id;
end;
$$;

revoke all on function public.submit_vendor_application(text, public.vendor_category, text, text, text, text, text, text, boolean, boolean, boolean, boolean, boolean) from public, anon;
grant execute on function public.submit_vendor_application(text, public.vendor_category, text, text, text, text, text, text, boolean, boolean, boolean, boolean, boolean) to authenticated;

drop function if exists public.submit_listing(text, text, text, boolean, integer, numeric, numeric, integer, text, text[]);

create or replace function public.submit_listing(
  p_market text,
  p_street text,
  p_city text,
  p_zip text,
  p_hide_exact_address boolean,
  p_price integer,
  p_beds numeric,
  p_baths numeric,
  p_sqft integer,
  p_description text,
  p_photo_urls text[]
)
returns table (id uuid, slug text)
language plpgsql
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  market uuid;
  new_listing public.listings%rowtype;
begin
  if uid is null then
    raise exception 'Sign in to list a home.' using errcode = '42501';
  end if;
  select m.id into market from public.markets m where m.slug = p_market and m.status = 'live';
  if market is null then
    raise exception 'Listings are not open in this market yet.' using errcode = '22023';
  end if;
  if coalesce(char_length(trim(p_city)), 0) not between 2 and 60 then
    raise exception 'City is required.' using errcode = '22023';
  end if;
  if coalesce(array_length(p_photo_urls, 1), 0) not between 1 and 20 then
    raise exception 'Add between 1 and 20 photos.' using errcode = '22023';
  end if;

  insert into public.listings (seller_id, market_id, street, city, zip, hide_exact_address, price, beds, baths, sqft, description)
  values (uid, market, p_street, trim(p_city), p_zip, p_hide_exact_address, p_price, p_beds, p_baths, p_sqft, p_description)
  returning * into new_listing;

  insert into public.listing_photos (listing_id, url, sort_order)
  select new_listing.id, u.url, (u.ord - 1)::integer
  from unnest(p_photo_urls) with ordinality as u(url, ord);

  update public.profiles
  set roles = array(select distinct unnest(roles || array['seller'::public.user_role]))
  where profiles.id = uid;

  return query select new_listing.id, new_listing.slug;
end;
$$;

revoke all on function public.submit_listing(text, text, text, text, boolean, integer, numeric, numeric, integer, text, text[]) from public, anon;
grant execute on function public.submit_listing(text, text, text, text, boolean, integer, numeric, numeric, integer, text, text[]) to authenticated;

-- Compatibility: the previous deploy calls these functions without a market. These wrappers keep its vendor signup
-- and listing submit working (as Nashville) between running this file and the new code going live. Safe to drop later.
create or replace function public.submit_vendor_application(
  p_category public.vendor_category,
  p_business_name text,
  p_headshot_url text,
  p_bio text,
  p_service_area text,
  p_price_range text,
  p_website text,
  p_licensed boolean,
  p_insured boolean,
  p_understands_connector boolean,
  p_handles_own_agreements boolean,
  p_read_terms boolean
)
returns uuid
language sql
set search_path = ''
as $$
  select public.submit_vendor_application('nashville', p_category, p_business_name, p_headshot_url, p_bio, p_service_area,
    p_price_range, p_website, p_licensed, p_insured, p_understands_connector, p_handles_own_agreements, p_read_terms)
$$;

revoke all on function public.submit_vendor_application(public.vendor_category, text, text, text, text, text, text, boolean, boolean, boolean, boolean, boolean) from public, anon;
grant execute on function public.submit_vendor_application(public.vendor_category, text, text, text, text, text, text, boolean, boolean, boolean, boolean, boolean) to authenticated;

create or replace function public.submit_listing(
  p_street text,
  p_city text,
  p_zip text,
  p_hide_exact_address boolean,
  p_price integer,
  p_beds numeric,
  p_baths numeric,
  p_sqft integer,
  p_description text,
  p_photo_urls text[]
)
returns table (id uuid, slug text)
language sql
set search_path = ''
as $$
  select * from public.submit_listing('nashville', p_street, p_city, p_zip, p_hide_exact_address, p_price, p_beds, p_baths,
    p_sqft, p_description, p_photo_urls)
$$;

revoke all on function public.submit_listing(text, text, text, boolean, integer, numeric, numeric, integer, text, text[]) from public, anon;
grant execute on function public.submit_listing(text, text, text, boolean, integer, numeric, numeric, integer, text, text[]) to authenticated;

-- ---------------------------------------------------------------------------
-- Sign-in email rate limit (server only)
-- ---------------------------------------------------------------------------

create table if not exists public.sign_in_link_requests (
  id bigint generated always as identity primary key,
  email text not null check (char_length(email) <= 254),
  created_at timestamptz not null default now()
);

create index if not exists sign_in_link_requests_email_idx on public.sign_in_link_requests (email, created_at desc);

alter table public.sign_in_link_requests enable row level security;
revoke all on table public.sign_in_link_requests from anon, authenticated;
grant select, insert, delete on table public.sign_in_link_requests to service_role;
