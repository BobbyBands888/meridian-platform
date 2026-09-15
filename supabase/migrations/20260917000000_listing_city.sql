-- Nashville Buys: listing city for Middle Tennessee (Phase 4)
-- Run after 20260916000000_listings.sql. Paste into Supabase Dashboard > SQL Editor and run. Safe to re-run.
--
-- submit_listing() now takes the city (Franklin, Murfreesboro, Hendersonville, ...) so addresses and slugs
-- use the right city instead of always "Nashville". The site derives the city from the ZIP code.

drop function if exists public.submit_listing(text, text, boolean, integer, numeric, numeric, integer, text, text[]);

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
language plpgsql
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  new_listing public.listings%rowtype;
begin
  if uid is null then
    raise exception 'Sign in to list a home.' using errcode = '42501';
  end if;
  if coalesce(char_length(trim(p_city)), 0) not between 2 and 60 then
    raise exception 'City is required.' using errcode = '22023';
  end if;
  if coalesce(array_length(p_photo_urls, 1), 0) not between 1 and 20 then
    raise exception 'Add between 1 and 20 photos.' using errcode = '22023';
  end if;

  insert into public.listings (seller_id, street, city, zip, hide_exact_address, price, beds, baths, sqft, description)
  values (uid, p_street, trim(p_city), p_zip, p_hide_exact_address, p_price, p_beds, p_baths, p_sqft, p_description)
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

revoke all on function public.submit_listing(text, text, text, boolean, integer, numeric, numeric, integer, text, text[]) from public, anon;
grant execute on function public.submit_listing(text, text, text, boolean, integer, numeric, numeric, integer, text, text[]) to authenticated;
