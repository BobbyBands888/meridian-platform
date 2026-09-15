-- Nashville Buys: initial schema
-- Paste into Supabase Dashboard > SQL Editor and run. Safe to re-run: every statement is idempotent.
--
-- Access model
--   * Row-level security on every table. Signed-in users read and write only their own rows; admins read all.
--   * Public pages read through the public_* views, which expose only approved/active rows and safe columns.
--     Vendor contact details are never in those views, and hidden listing street addresses are masked.
--   * Status changes (approve/reject) and lead inserts run server-side with the secret key after checks
--     (admin flag, Turnstile), so column grants below keep users from setting status or admin flags themselves.

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------

do $$ begin
  create type public.user_role as enum ('buyer', 'seller', 'vendor');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.vendor_category as enum ('attorney', 'home_inspector', 'photographer', 'painter', 'handyman', 'lender');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.vendor_status as enum ('pending', 'approved', 'rejected');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.listing_status as enum ('pending', 'active', 'under_contract', 'sold', 'rejected');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.lead_type as enum ('listing', 'vendor');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  phone text check (phone is null or phone ~ '^\+1[2-9][0-9]{9}$'),
  -- Kept for a future SMS verification step; nothing sets it today.
  phone_verified boolean not null default false,
  full_name text check (full_name is null or char_length(full_name) between 1 and 120),
  roles public.user_role[] not null default '{}',
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.vendors (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles (id) on delete cascade,
  category public.vendor_category not null,
  business_name text not null check (char_length(business_name) between 2 and 120),
  headshot_url text not null,
  bio text not null check (char_length(bio) between 1 and 400),
  service_area text not null check (char_length(service_area) between 2 and 160),
  price_range text not null check (char_length(price_range) between 1 and 80),
  website text check (website is null or website ~* '^https?://'),
  status public.vendor_status not null default 'pending',
  founding_vendor boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists vendors_category_status_idx on public.vendors (category, status);

create table if not exists public.listings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles (id) on delete cascade,
  street text not null check (char_length(street) between 3 and 160),
  city text not null default 'Nashville',
  zip text not null check (zip ~ '^[0-9]{5}$'),
  hide_exact_address boolean not null default false,
  price integer not null check (price > 0),
  beds numeric(3, 1) not null check (beds >= 0),
  baths numeric(3, 1) not null check (baths >= 0),
  sqft integer check (sqft is null or sqft > 0),
  description text not null check (char_length(description) between 1 and 5000),
  status public.listing_status not null default 'pending',
  slug text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists listings_seller_idx on public.listings (seller_id);
create index if not exists listings_status_idx on public.listings (status, created_at desc);

create table if not exists public.listing_photos (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  url text not null,
  sort_order integer not null default 0 check (sort_order between 0 and 19)
);

create index if not exists listing_photos_listing_idx on public.listing_photos (listing_id, sort_order);

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  type public.lead_type not null,
  target_id uuid not null,
  sender_name text not null check (char_length(sender_name) between 1 and 120),
  sender_email text not null check (char_length(sender_email) between 3 and 254),
  sender_phone text check (sender_phone is null or char_length(sender_phone) <= 32),
  message text not null check (char_length(message) between 1 and 5000),
  consent boolean not null check (consent),
  source text check (source is null or char_length(source) <= 200),
  created_at timestamptz not null default now()
);

create index if not exists leads_target_idx on public.leads (type, target_id, created_at desc);

create table if not exists public.vendor_certifications (
  vendor_id uuid primary key references public.vendors (id) on delete cascade,
  licensed boolean not null check (licensed),
  insured boolean not null check (insured),
  understands_connector boolean not null check (understands_connector),
  handles_own_agreements boolean not null check (handles_own_agreements),
  read_terms boolean not null check (read_terms),
  certified_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Helper functions
-- ---------------------------------------------------------------------------

-- True when the signed-in user has the admin flag. Security definer so policies can call it without recursion.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select p.is_admin from public.profiles p where p.id = auth.uid()), false);
$$;

-- True for the secret-key (service_role) connection used by server code, and for dashboard SQL.
create or replace function public.is_trusted_role()
returns boolean
language sql
stable
set search_path = ''
as $$
  select current_user in ('service_role', 'postgres', 'supabase_admin');
$$;

create or replace function public.slugify(value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select trim(both '-' from regexp_replace(lower(coalesce(value, '')), '[^a-z0-9]+', '-', 'g'));
$$;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

-- Create a profile row for every new auth user.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, coalesce(new.email, ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keep profiles.email in sync when a user changes their email.
create or replace function public.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set email = coalesce(new.email, '') where id = new.id;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_changed on auth.users;
create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row when (old.email is distinct from new.email)
  execute function public.handle_user_email_change();

-- Listing slug: 123-main-st-nashville-37203, or nashville-37203-<id> when the address is hidden.
create or replace function public.set_listing_slug()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  short_id text := left(replace(new.id::text, '-', ''), 8);
  base text;
begin
  if new.hide_exact_address then
    base := public.slugify(new.city || ' ' || new.zip) || '-' || short_id;
  else
    base := public.slugify(new.street || ' ' || new.city || ' ' || new.zip);
  end if;

  if exists (select 1 from public.listings l where l.slug = base and l.id <> new.id) then
    base := base || '-' || short_id;
  end if;

  new.slug := base;
  return new;
end;
$$;

drop trigger if exists listings_set_slug on public.listings;
create trigger listings_set_slug
  before insert or update of street, city, zip, hide_exact_address on public.listings
  for each row execute function public.set_listing_slug();

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists listings_touch_updated_at on public.listings;
create trigger listings_touch_updated_at
  before update on public.listings
  for each row execute function public.touch_updated_at();

-- Sellers may only move a published listing between active, under_contract, and sold.
-- Approving or rejecting (pending -> active/rejected) is done server-side with the secret key.
create or replace function public.guard_listing_status()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status is distinct from old.status and not public.is_trusted_role() then
    if not (old.status in ('active', 'under_contract', 'sold') and new.status in ('active', 'under_contract', 'sold')) then
      raise exception 'Listing status can only change between active, under contract, and sold.'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists listings_guard_status on public.listings;
create trigger listings_guard_status
  before update of status on public.listings
  for each row execute function public.guard_listing_status();

-- A listing can have at most 20 photos.
create or replace function public.limit_listing_photos()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select count(*) from public.listing_photos p where p.listing_id = new.listing_id) >= 20 then
    raise exception 'A listing can have at most 20 photos.' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists listing_photos_limit on public.listing_photos;
create trigger listing_photos_limit
  before insert on public.listing_photos
  for each row execute function public.limit_listing_photos();

-- ---------------------------------------------------------------------------
-- Column privileges: what signed-in users may write directly
-- ---------------------------------------------------------------------------

revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (full_name, phone, roles) on public.profiles to authenticated;

revoke all on public.vendors from anon, authenticated;
grant select on public.vendors to authenticated;
grant insert (profile_id, category, business_name, headshot_url, bio, service_area, price_range, website)
  on public.vendors to authenticated;
grant update (category, business_name, headshot_url, bio, service_area, price_range, website)
  on public.vendors to authenticated;

revoke all on public.listings from anon, authenticated;
grant select on public.listings to authenticated;
grant insert (seller_id, street, city, zip, hide_exact_address, price, beds, baths, sqft, description)
  on public.listings to authenticated;
grant update (price, description, status) on public.listings to authenticated;

revoke all on public.listing_photos from anon, authenticated;
grant select, delete on public.listing_photos to authenticated;
grant insert (listing_id, url, sort_order) on public.listing_photos to authenticated;
grant update (sort_order) on public.listing_photos to authenticated;

revoke all on public.leads from anon, authenticated;
grant select on public.leads to authenticated;

revoke all on public.vendor_certifications from anon, authenticated;
grant select on public.vendor_certifications to authenticated;
grant insert (vendor_id, licensed, insured, understands_connector, handles_own_agreements, read_terms)
  on public.vendor_certifications to authenticated;

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.vendors enable row level security;
alter table public.listings enable row level security;
alter table public.listing_photos enable row level security;
alter table public.leads enable row level security;
alter table public.vendor_certifications enable row level security;

-- profiles
drop policy if exists "profiles: read own or admin" on public.profiles;
create policy "profiles: read own or admin" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));

drop policy if exists "profiles: update own" on public.profiles;
create policy "profiles: update own" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- vendors
drop policy if exists "vendors: read own or admin" on public.vendors;
create policy "vendors: read own or admin" on public.vendors
  for select to authenticated
  using (profile_id = (select auth.uid()) or (select public.is_admin()));

drop policy if exists "vendors: insert own" on public.vendors;
create policy "vendors: insert own" on public.vendors
  for insert to authenticated
  with check (profile_id = (select auth.uid()));

drop policy if exists "vendors: update own" on public.vendors;
create policy "vendors: update own" on public.vendors
  for update to authenticated
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));

-- listings
drop policy if exists "listings: read own or admin" on public.listings;
create policy "listings: read own or admin" on public.listings
  for select to authenticated
  using (seller_id = (select auth.uid()) or (select public.is_admin()));

drop policy if exists "listings: insert own" on public.listings;
create policy "listings: insert own" on public.listings
  for insert to authenticated
  with check (seller_id = (select auth.uid()));

drop policy if exists "listings: update own" on public.listings;
create policy "listings: update own" on public.listings
  for update to authenticated
  using (seller_id = (select auth.uid()))
  with check (seller_id = (select auth.uid()));

-- listing_photos (ownership follows the parent listing)
drop policy if exists "listing_photos: read own or admin" on public.listing_photos;
create policy "listing_photos: read own or admin" on public.listing_photos
  for select to authenticated
  using (
    (select public.is_admin())
    or exists (select 1 from public.listings l where l.id = listing_id and l.seller_id = (select auth.uid()))
  );

drop policy if exists "listing_photos: insert own" on public.listing_photos;
create policy "listing_photos: insert own" on public.listing_photos
  for insert to authenticated
  with check (exists (select 1 from public.listings l where l.id = listing_id and l.seller_id = (select auth.uid())));

drop policy if exists "listing_photos: update own" on public.listing_photos;
create policy "listing_photos: update own" on public.listing_photos
  for update to authenticated
  using (exists (select 1 from public.listings l where l.id = listing_id and l.seller_id = (select auth.uid())))
  with check (exists (select 1 from public.listings l where l.id = listing_id and l.seller_id = (select auth.uid())));

drop policy if exists "listing_photos: delete own" on public.listing_photos;
create policy "listing_photos: delete own" on public.listing_photos
  for delete to authenticated
  using (exists (select 1 from public.listings l where l.id = listing_id and l.seller_id = (select auth.uid())));

-- leads: recipients read leads for their own listing or vendor profile; admin reads all.
drop policy if exists "leads: read received or admin" on public.leads;
create policy "leads: read received or admin" on public.leads
  for select to authenticated
  using (
    (select public.is_admin())
    or (type = 'listing' and exists (
      select 1 from public.listings l where l.id = target_id and l.seller_id = (select auth.uid())))
    or (type = 'vendor' and exists (
      select 1 from public.vendors v where v.id = target_id and v.profile_id = (select auth.uid())))
  );

-- vendor_certifications
drop policy if exists "vendor_certifications: read own or admin" on public.vendor_certifications;
create policy "vendor_certifications: read own or admin" on public.vendor_certifications
  for select to authenticated
  using (
    (select public.is_admin())
    or exists (select 1 from public.vendors v where v.id = vendor_id and v.profile_id = (select auth.uid()))
  );

drop policy if exists "vendor_certifications: insert own" on public.vendor_certifications;
create policy "vendor_certifications: insert own" on public.vendor_certifications
  for insert to authenticated
  with check (exists (select 1 from public.vendors v where v.id = vendor_id and v.profile_id = (select auth.uid())));

-- ---------------------------------------------------------------------------
-- Public read views (run with owner privileges; expose only published rows and safe columns)
-- ---------------------------------------------------------------------------

-- Dropped and recreated (not replaced) so re-running this file after a later migration that adds columns still works.
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
  v.created_at
from public.vendors v
where v.status = 'approved';

create or replace view public.public_listings
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
  l.updated_at
from public.listings l
where l.status in ('active', 'under_contract', 'sold');

create or replace view public.public_listing_photos
with (security_barrier = true)
as
select p.id, p.listing_id, p.url, p.sort_order
from public.listing_photos p
join public.listings l on l.id = p.listing_id
where l.status in ('active', 'under_contract', 'sold');

revoke all on public.public_vendors, public.public_listings, public.public_listing_photos from anon, authenticated;
grant select on public.public_vendors, public.public_listings, public.public_listing_photos to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Storage
-- Files go under a folder named for the uploader's user id: <user id>/<file>.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('listing-photos', 'listing-photos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('vendor-headshots', 'vendor-headshots', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "listing-photos: upload to own folder" on storage.objects;
create policy "listing-photos: upload to own folder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'listing-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "listing-photos: update own files" on storage.objects;
create policy "listing-photos: update own files" on storage.objects
  for update to authenticated
  using (bucket_id = 'listing-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "listing-photos: delete own files" on storage.objects;
create policy "listing-photos: delete own files" on storage.objects
  for delete to authenticated
  using (bucket_id = 'listing-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "vendor-headshots: upload to own folder" on storage.objects;
create policy "vendor-headshots: upload to own folder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'vendor-headshots' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "vendor-headshots: update own files" on storage.objects;
create policy "vendor-headshots: update own files" on storage.objects
  for update to authenticated
  using (bucket_id = 'vendor-headshots' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "vendor-headshots: delete own files" on storage.objects;
create policy "vendor-headshots: delete own files" on storage.objects
  for delete to authenticated
  using (bucket_id = 'vendor-headshots' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Uploads use upsert, which needs to read the existing object.
drop policy if exists "photos and headshots: read own files" on storage.objects;
create policy "photos and headshots: read own files" on storage.objects
  for select to authenticated
  using (
    bucket_id in ('listing-photos', 'vendor-headshots')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
