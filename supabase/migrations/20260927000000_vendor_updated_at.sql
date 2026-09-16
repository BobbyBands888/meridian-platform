-- Vendor last-modified dates for the sitemap.
--
-- * vendors gains updated_at, bumped only when something shown on the public profile changes.
-- * A vendor's updated_at is also bumped when they are verified or lose verification (the badge changes).
-- * public_vendors gains updated_at as its last column.
--
-- vendors columns (public = shown on or decides the public profile):
--   id                         public (in the URL), never changes
--   profile_id                 internal
--   category                   public
--   business_name              public
--   headshot_url               public (photo)
--   bio                        public
--   service_area               public
--   price_range                public
--   website                    public
--   status                     public (approved = listed)
--   founding_vendor            public (badge)
--   created_at                 never changes
--   market_id                  public
--   approved_at                internal
--   lifecycle_unsubscribed_at  internal
--   email_token                internal
--   updated_at                 this column
-- Phone lives on profiles and is not shown publicly. Verification lives on vendor_verifications.

alter table public.vendors add column if not exists updated_at timestamptz;

-- Existing vendors date from their latest known public change, not from this migration.
update public.vendors v
set updated_at = greatest(v.created_at, v.approved_at, (select vv.verified_at from public.vendor_verifications vv where vv.vendor_id = v.id))
where v.updated_at is null;

alter table public.vendors alter column updated_at set default now(), alter column updated_at set not null;

drop trigger if exists vendors_touch_updated_at on public.vendors;
create trigger vendors_touch_updated_at
  before update on public.vendors
  for each row
  when (
    old.category is distinct from new.category
    or old.business_name is distinct from new.business_name
    or old.headshot_url is distinct from new.headshot_url
    or old.bio is distinct from new.bio
    or old.service_area is distinct from new.service_area
    or old.price_range is distinct from new.price_range
    or old.website is distinct from new.website
    or old.status is distinct from new.status
    or old.founding_vendor is distinct from new.founding_vendor
    or old.market_id is distinct from new.market_id
  )
  execute function public.touch_updated_at();

-- Verifying or unverifying a vendor changes their public badge.
create or replace function public.touch_vendor_on_verification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' and new.verified_at is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.verified_at is not distinct from old.verified_at then
    return new;
  end if;
  update public.vendors set updated_at = now() where id = new.vendor_id;
  return new;
end;
$$;

revoke all on function public.touch_vendor_on_verification() from public, anon, authenticated;

drop trigger if exists vendor_verifications_touch_vendor on public.vendor_verifications;
create trigger vendor_verifications_touch_vendor
  after insert or update of verified_at on public.vendor_verifications
  for each row execute function public.touch_vendor_on_verification();

-- Same columns, filter and options as before, plus updated_at last.
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
  v.market_id,
  v.updated_at
from public.vendors v
join public.markets m on m.id = v.market_id and m.status = 'live'
left join public.vendor_verifications vv on vv.vendor_id = v.id
where v.status = 'approved';

revoke all on public.public_vendors from anon, authenticated;
grant select on public.public_vendors to anon, authenticated;
