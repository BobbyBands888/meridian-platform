-- Ownvista: 50 photos per listing, and a funnel event log
-- Run after 20260924000000_listing_drafts.sql. Paste into Supabase Dashboard > SQL Editor and run. Safe to re-run.
--
-- * Listings and drafts take up to 50 photos (was 20 for listings, 15 for drafts): listing_photos.sort_order,
--   the per-listing photo trigger, submit_listing, replace_listing_photos, listing_drafts.photo_urls, and
--   finalize_listing_draft.
-- * funnel_events: the seller listing funnel (form_start through email_verified) with its source, written by the
--   server. Server-only, for the admin Funnel tab.

-- ---------------------------------------------------------------------------
-- Photo limit: 50
-- ---------------------------------------------------------------------------

-- Drops the old check constraints by what they check, not by name, so this works whatever Postgres named them.
do $$
declare
  c record;
begin
  for c in
    select con.conname, rel.relname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace ns on ns.oid = rel.relnamespace
    where ns.nspname = 'public'
      and con.contype = 'c'
      and (
        (rel.relname = 'listing_photos' and pg_get_constraintdef(con.oid) ilike '%sort_order%')
        or (rel.relname = 'listing_drafts' and pg_get_constraintdef(con.oid) ilike '%photo_urls%')
      )
  loop
    execute format('alter table public.%I drop constraint %I', c.relname, c.conname);
  end loop;
end;
$$;

alter table public.listing_photos add constraint listing_photos_sort_order_check check (sort_order between 0 and 49);

create or replace function public.limit_listing_photos()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select count(*) from public.listing_photos p where p.listing_id = new.listing_id) >= 50 then
    raise exception 'A listing can have at most 50 photos.' using errcode = '23514';
  end if;
  return new;
end;
$$;

alter table public.listing_drafts add constraint listing_drafts_photo_urls_check check (coalesce(array_length(photo_urls, 1), 0) <= 50);

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
  if coalesce(array_length(p_photo_urls, 1), 0) not between 1 and 50 then
    raise exception 'Add between 1 and 50 photos.' using errcode = '22023';
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

-- Replaces a listing's photos with the given ordered list (first is the cover).
create or replace function public.replace_listing_photos(p_listing_id uuid, p_photo_urls text[])
returns void
language plpgsql
set search_path = ''
as $$
begin
  if coalesce(array_length(p_photo_urls, 1), 0) not between 1 and 50 then
    raise exception 'Add between 1 and 50 photos.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.listings l where l.id = p_listing_id) then
    -- Also covers listings the caller can't see under row-level security.
    raise exception 'Listing not found.' using errcode = '42501';
  end if;

  delete from public.listing_photos where listing_id = p_listing_id;

  insert into public.listing_photos (listing_id, url, sort_order)
  select p_listing_id, u.url, (u.ord - 1)::integer
  from unnest(p_photo_urls) with ordinality as u(url, ord);

end;
$$;

revoke all on function public.replace_listing_photos(uuid, text[]) from public, anon;
grant execute on function public.replace_listing_photos(uuid, text[]) to authenticated;

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
  if coalesce(array_length(p_photo_urls, 1), 0) not between 1 and 50 then
    raise exception 'Add between 1 and 50 photos.' using errcode = '22023';
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

-- ---------------------------------------------------------------------------
-- Funnel events (server only)
-- ---------------------------------------------------------------------------

create table if not exists public.funnel_events (
  id bigint generated always as identity primary key,
  market_id uuid not null references public.markets (id),
  event text not null check (event in ('form_start', 'contact_saved', 'address_done', 'photos_done', 'submitted', 'email_verified')),
  source text not null default 'direct' check (source ~ '^[a-z0-9_-]{1,60}$'),
  -- Set once a draft exists, so one draft can't count the same step twice.
  draft_id uuid references public.listing_drafts (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists funnel_events_market_created_idx on public.funnel_events (market_id, created_at desc);
create unique index if not exists funnel_events_draft_event_key on public.funnel_events (draft_id, event) where draft_id is not null;

alter table public.funnel_events enable row level security;
revoke all on table public.funnel_events from anon, authenticated;
grant select, insert, update, delete on table public.funnel_events to service_role;
