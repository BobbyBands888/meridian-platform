-- Ownvista: list first, verify email at the end
-- Run after 20260923000000_service_area.sql. Paste into Supabase Dashboard > SQL Editor and run. Safe to re-run.
--
-- * listing_drafts: a seller starts /sell without signing in. The contact step creates a draft tied to an unverified
--   email; the browser holds a random token (httpOnly cookie) whose SHA-256 hash is stored here. Submitting moves the
--   draft to pending_verification and emails a sign-in link. Clicking it signs the seller in and turns the draft into
--   a real listing in the normal review queue (finalize_listing_draft).
-- * Nothing unverified is ever in public.listings, so it can't reach the public views, alerts, the sitemap, or
--   Facebook. Drafts are server-only (service role).
-- * listing_ai_usage.profile_id is optional, so "Write it for me" runs on a draft are logged before an account exists.

create table if not exists public.listing_drafts (
  id uuid primary key default gen_random_uuid(),
  market_id uuid not null references public.markets (id),
  -- SHA-256 (hex) of the cookie token, and of the token in the reminder email's resume link.
  token_hash text not null unique,
  resume_token_hash text unique,
  status text not null default 'draft' check (status in ('draft', 'pending_verification', 'verified')),
  -- Furthest part of the form completed: contact, address, details, photos, submitted.
  step text not null default 'contact' check (step in ('contact', 'address', 'details', 'photos', 'submitted')),
  full_name text not null check (char_length(full_name) between 2 and 120),
  email text not null check (
    email = lower(btrim(email)) and char_length(email) <= 254 and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  ),
  phone text check (phone is null or phone ~ '^\+1[2-9][0-9]{9}$'),
  street text check (street is null or char_length(street) <= 160),
  zip text check (zip is null or zip ~ '^[0-9]{5}$'),
  hide_exact_address boolean not null default false,
  price integer check (price is null or price > 0),
  beds numeric(3, 1) check (beds is null or beds >= 0),
  baths numeric(3, 1) check (baths is null or baths >= 0),
  sqft integer check (sqft is null or sqft > 0),
  description text check (description is null or char_length(description) <= 5000),
  photo_urls text[] not null default '{}' check (coalesce(array_length(photo_urls, 1), 0) <= 15),
  -- Signed upload URLs handed out, a ceiling on storage use by one draft (retries and removed photos included).
  photo_uploads integer not null default 0 check (photo_uploads >= 0),
  -- Where the seller came from (?s= on /sell), for the funnel.
  source text check (source is null or char_length(source) <= 60),
  -- SHA-256 of the client IP, for the per-IP daily draft limit.
  ip_hash text,
  unsubscribe_token uuid not null default gen_random_uuid() unique,
  reminder_sent_at timestamptz,
  reminders_unsubscribed_at timestamptz,
  submitted_at timestamptz,
  verification_sent_at timestamptz,
  verified_at timestamptz,
  profile_id uuid references public.profiles (id) on delete set null,
  listing_id uuid references public.listings (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists listing_drafts_email_created_idx on public.listing_drafts (email, created_at desc);
create index if not exists listing_drafts_ip_created_idx on public.listing_drafts (ip_hash, created_at desc);
create index if not exists listing_drafts_market_status_idx on public.listing_drafts (market_id, status, created_at desc);

alter table public.listing_drafts enable row level security;
revoke all on table public.listing_drafts from anon, authenticated;
grant select, insert, update, delete on table public.listing_drafts to service_role;

drop trigger if exists listing_drafts_touch_updated_at on public.listing_drafts;
create trigger listing_drafts_touch_updated_at
  before update on public.listing_drafts
  for each row execute function public.touch_updated_at();

alter table public.listing_ai_usage alter column profile_id drop not null;

-- Turns a submitted draft into a pending listing for a signed-in seller whose verified email matches the draft.
-- Photo URLs are passed in because the app moves the files into the seller's own folder first; the city comes from
-- the app's ZIP map. Runs once per draft:
-- the row lock and status check stop a double click from creating two listings.
create or replace function public.finalize_listing_draft(p_draft uuid, p_profile uuid, p_city text, p_photo_urls text[])
returns table (id uuid, slug text)
language plpgsql
set search_path = ''
as $$
declare
  d public.listing_drafts%rowtype;
  profile_email text;
  new_listing public.listings%rowtype;
begin
  select * into d from public.listing_drafts where listing_drafts.id = p_draft for update;
  if d.id is null then
    raise exception 'Draft not found.' using errcode = '22023';
  end if;
  if d.status = 'verified' and d.listing_id is not null then
    return query select l.id, l.slug from public.listings l where l.id = d.listing_id;
    return;
  end if;
  if d.status <> 'pending_verification' then
    raise exception 'Draft has not been submitted.' using errcode = '22023';
  end if;

  select p.email into profile_email from public.profiles p where p.id = p_profile;
  if profile_email is null or lower(profile_email) <> d.email then
    raise exception 'Draft belongs to another email address.' using errcode = '42501';
  end if;
  if coalesce(char_length(trim(p_city)), 0) not between 2 and 60 then
    raise exception 'City is required.' using errcode = '22023';
  end if;
  if coalesce(array_length(p_photo_urls, 1), 0) not between 1 and 15 then
    raise exception 'Add between 1 and 15 photos.' using errcode = '22023';
  end if;

  insert into public.listings (seller_id, market_id, street, city, zip, hide_exact_address, price, beds, baths, sqft, description)
  values (
    p_profile, d.market_id, d.street, trim(p_city), d.zip, d.hide_exact_address, d.price, d.beds, d.baths, d.sqft, d.description
  )
  returning * into new_listing;

  insert into public.listing_photos (listing_id, url, sort_order)
  select new_listing.id, u.url, (u.ord - 1)::integer
  from unnest(p_photo_urls) with ordinality as u(url, ord);

  update public.profiles
  set roles = array(select distinct unnest(roles || array['seller'::public.user_role])),
      full_name = coalesce(full_name, d.full_name),
      phone = coalesce(phone, d.phone)
  where profiles.id = p_profile;

  update public.listing_drafts
  set status = 'verified', step = 'submitted', verified_at = now(), profile_id = p_profile, listing_id = new_listing.id,
      photo_urls = p_photo_urls
  where listing_drafts.id = d.id;

  update public.listing_ai_usage set profile_id = p_profile, listing_id = new_listing.id
  where draft_id = d.id and listing_id is null;

  return query select new_listing.id, new_listing.slug;
end;
$$;

revoke all on function public.finalize_listing_draft(uuid, uuid, text, text[]) from public, anon, authenticated;
grant execute on function public.finalize_listing_draft(uuid, uuid, text, text[]) to service_role;
