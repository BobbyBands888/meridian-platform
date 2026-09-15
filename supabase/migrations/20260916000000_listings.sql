-- Nashville Buys: category edits held for review, listings (Phase 4)
-- Run after 20260915000000_vendor_directory.sql. Paste into Supabase Dashboard > SQL Editor and run. Safe to re-run.
--
-- * Two vendor categories: stager and home_insurance.
-- * An approved vendor's category change is now held in vendor_pending_edits with name, bio, and headshot.
-- * submit_listing(): creates a pending listing with its photos and adds the seller role, in one transaction.
-- * replace_listing_photos(): sets a listing's photos and their order in one transaction.
-- * Listing photo URLs must point at the seller's own folder in the listing-photos bucket.

-- ---------------------------------------------------------------------------
-- New vendor categories
-- (Nothing later in this file uses the new values, so adding them in the same run is safe.)
-- ---------------------------------------------------------------------------

alter type public.vendor_category add value if not exists 'stager' after 'painter';
alter type public.vendor_category add value if not exists 'home_insurance' after 'lender';

-- ---------------------------------------------------------------------------
-- Vendor category joins the reviewed fields
-- ---------------------------------------------------------------------------

alter table public.vendor_pending_edits add column if not exists category public.vendor_category;

update public.vendor_pending_edits e
set category = v.category
from public.vendors v
where v.id = e.vendor_id and e.category is null;

alter table public.vendor_pending_edits alter column category set not null;

drop function if exists public.queue_vendor_edit(uuid, text, text, text);

create or replace function public.queue_vendor_edit(
  p_vendor_id uuid,
  p_business_name text,
  p_bio text,
  p_headshot_url text,
  p_category public.vendor_category
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  live public.vendors%rowtype;
begin
  select * into live from public.vendors where id = p_vendor_id;
  if not found or live.profile_id is distinct from auth.uid() then
    raise exception 'Not allowed to edit this vendor profile.' using errcode = '42501';
  end if;
  if live.status <> 'approved' then
    raise exception 'Only approved profiles have edits held for review.' using errcode = '22023';
  end if;

  if p_business_name = live.business_name and p_bio = live.bio and p_headshot_url = live.headshot_url
    and p_category = live.category
  then
    -- The proposal matches what's live: nothing to review.
    delete from public.vendor_pending_edits where vendor_id = p_vendor_id;
  else
    insert into public.vendor_pending_edits (vendor_id, business_name, bio, headshot_url, category, submitted_at)
    values (p_vendor_id, p_business_name, p_bio, p_headshot_url, p_category, now())
    on conflict (vendor_id) do update set
      business_name = excluded.business_name,
      bio = excluded.bio,
      headshot_url = excluded.headshot_url,
      category = excluded.category,
      submitted_at = excluded.submitted_at;
  end if;
end;
$$;

revoke all on function public.queue_vendor_edit(uuid, text, text, text, public.vendor_category) from public, anon;
grant execute on function public.queue_vendor_edit(uuid, text, text, text, public.vendor_category) to authenticated;

create or replace function public.route_vendor_edits()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if public.is_trusted_role() then
    return new;
  end if;

  if old.status = 'approved' then
    if new.business_name is distinct from old.business_name
      or new.bio is distinct from old.bio
      or new.headshot_url is distinct from old.headshot_url
      or new.category is distinct from old.category
    then
      perform public.queue_vendor_edit(old.id, new.business_name, new.bio, new.headshot_url, new.category);
      -- Keep the approved version live.
      new.business_name := old.business_name;
      new.bio := old.bio;
      new.headshot_url := old.headshot_url;
      new.category := old.category;
    end if;
  elsif old.status = 'rejected' then
    new.status := 'pending';
  end if;

  return new;
end;
$$;

create or replace function public.apply_vendor_edit(p_vendor_id uuid)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  pending public.vendor_pending_edits%rowtype;
begin
  select * into pending from public.vendor_pending_edits where vendor_id = p_vendor_id for update;
  if not found then
    return false;
  end if;

  update public.vendors
  set business_name = pending.business_name,
      bio = pending.bio,
      headshot_url = pending.headshot_url,
      category = pending.category
  where id = p_vendor_id;

  delete from public.vendor_pending_edits where vendor_id = p_vendor_id;
  return true;
end;
$$;

revoke all on function public.apply_vendor_edit(uuid) from public, anon, authenticated;
grant execute on function public.apply_vendor_edit(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Listing photos
-- ---------------------------------------------------------------------------

-- Sellers may only attach photos uploaded to their own listing-photos folder.
create or replace function public.guard_listing_photo_url()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  seller uuid;
begin
  if public.is_trusted_role() then
    return new;
  end if;
  select l.seller_id into seller from public.listings l where l.id = new.listing_id;
  if seller is null
    or position(('/storage/v1/object/public/listing-photos/' || seller::text || '/') in new.url) = 0
  then
    raise exception 'Photos must be uploaded to your own folder.' using errcode = '22023';
  end if;
  return new;
end;
$$;

drop trigger if exists listing_photos_guard_url on public.listing_photos;
create trigger listing_photos_guard_url
  before insert or update of url on public.listing_photos
  for each row execute function public.guard_listing_photo_url();

-- ---------------------------------------------------------------------------
-- Listing submission
-- ---------------------------------------------------------------------------

create or replace function public.submit_listing(
  p_street text,
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
  if coalesce(array_length(p_photo_urls, 1), 0) not between 1 and 20 then
    raise exception 'Add between 1 and 20 photos.' using errcode = '22023';
  end if;

  insert into public.listings (seller_id, street, zip, hide_exact_address, price, beds, baths, sqft, description)
  values (uid, p_street, p_zip, p_hide_exact_address, p_price, p_beds, p_baths, p_sqft, p_description)
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

revoke all on function public.submit_listing(text, text, boolean, integer, numeric, numeric, integer, text, text[]) from public, anon;
grant execute on function public.submit_listing(text, text, boolean, integer, numeric, numeric, integer, text, text[]) to authenticated;

-- Replaces a listing's photos with the given ordered list (first is the cover).
create or replace function public.replace_listing_photos(p_listing_id uuid, p_photo_urls text[])
returns void
language plpgsql
set search_path = ''
as $$
begin
  if coalesce(array_length(p_photo_urls, 1), 0) not between 1 and 20 then
    raise exception 'Add between 1 and 20 photos.' using errcode = '22023';
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
