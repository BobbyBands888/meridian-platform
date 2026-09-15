-- Nashville Buys: vendor directory (Phase 3)
-- Run after 20260914000000_initial_schema.sql. Paste into Supabase Dashboard > SQL Editor and run. Safe to re-run.
--
-- * submit_vendor_application(): creates the vendor row, its five certifications, and adds the vendor role,
--   all in one transaction.
-- * Edits to an approved vendor's business name, bio, or headshot are held in vendor_pending_edits. The approved
--   version stays live until an admin applies the edit with apply_vendor_edit().
-- * A rejected vendor who edits their profile goes back to pending.

-- ---------------------------------------------------------------------------
-- Pending edits
-- ---------------------------------------------------------------------------

create table if not exists public.vendor_pending_edits (
  vendor_id uuid primary key references public.vendors (id) on delete cascade,
  business_name text not null check (char_length(business_name) between 2 and 120),
  bio text not null check (char_length(bio) between 1 and 400),
  headshot_url text not null,
  submitted_at timestamptz not null default now()
);

alter table public.vendor_pending_edits enable row level security;

revoke all on public.vendor_pending_edits from anon, authenticated;
grant select on public.vendor_pending_edits to authenticated;

drop policy if exists "vendor_pending_edits: read own or admin" on public.vendor_pending_edits;
create policy "vendor_pending_edits: read own or admin" on public.vendor_pending_edits
  for select to authenticated
  using (
    (select public.is_admin())
    or exists (select 1 from public.vendors v where v.id = vendor_id and v.profile_id = (select auth.uid()))
  );

-- Stores a proposed edit for the caller's own approved vendor profile, or clears it when the proposal matches
-- what's live. Called by the vendors trigger below, and directly to withdraw a pending edit.
create or replace function public.queue_vendor_edit(p_vendor_id uuid, p_business_name text, p_bio text, p_headshot_url text)
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

  if p_business_name = live.business_name and p_bio = live.bio and p_headshot_url = live.headshot_url then
    -- The proposal matches what's live: nothing to review.
    delete from public.vendor_pending_edits where vendor_id = p_vendor_id;
  else
    insert into public.vendor_pending_edits (vendor_id, business_name, bio, headshot_url, submitted_at)
    values (p_vendor_id, p_business_name, p_bio, p_headshot_url, now())
    on conflict (vendor_id) do update set
      business_name = excluded.business_name,
      bio = excluded.bio,
      headshot_url = excluded.headshot_url,
      submitted_at = excluded.submitted_at;
  end if;
end;
$$;

revoke all on function public.queue_vendor_edit(uuid, text, text, text) from public, anon;
grant execute on function public.queue_vendor_edit(uuid, text, text, text) to authenticated;

-- Vendors may only point their headshot at a file in their own vendor-headshots folder.
create or replace function public.guard_vendor_headshot()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not public.is_trusted_role()
    and position(('/storage/v1/object/public/vendor-headshots/' || new.profile_id::text || '/') in new.headshot_url) = 0
  then
    raise exception 'Headshot must be uploaded to your own folder.' using errcode = '22023';
  end if;
  return new;
end;
$$;

drop trigger if exists vendors_guard_headshot on public.vendors;
create trigger vendors_guard_headshot
  before insert or update of headshot_url on public.vendors
  for each row execute function public.guard_vendor_headshot();

-- Runs as the caller so is_trusted_role() can tell server/admin updates apart from vendor edits.
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
    then
      perform public.queue_vendor_edit(old.id, new.business_name, new.bio, new.headshot_url);
      -- Keep the approved version live.
      new.business_name := old.business_name;
      new.bio := old.bio;
      new.headshot_url := old.headshot_url;
    end if;
  elsif old.status = 'rejected' then
    new.status := 'pending';
  end if;

  return new;
end;
$$;

drop trigger if exists vendors_route_edits on public.vendors;
create trigger vendors_route_edits
  before update on public.vendors
  for each row execute function public.route_vendor_edits();

-- Admin approval of a pending edit. Server-only (secret key).
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
  set business_name = pending.business_name, bio = pending.bio, headshot_url = pending.headshot_url
  where id = p_vendor_id;

  delete from public.vendor_pending_edits where vendor_id = p_vendor_id;
  return true;
end;
$$;

revoke all on function public.apply_vendor_edit(uuid) from public, anon, authenticated;
grant execute on function public.apply_vendor_edit(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Vendor signup
-- ---------------------------------------------------------------------------

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
language plpgsql
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  new_vendor_id uuid;
begin
  if uid is null then
    raise exception 'Sign in to join the vendor directory.' using errcode = '42501';
  end if;

  insert into public.vendors (profile_id, category, business_name, headshot_url, bio, service_area, price_range, website)
  values (uid, p_category, p_business_name, p_headshot_url, p_bio, p_service_area, p_price_range, nullif(p_website, ''))
  returning id into new_vendor_id;

  insert into public.vendor_certifications (vendor_id, licensed, insured, understands_connector, handles_own_agreements, read_terms)
  values (new_vendor_id, p_licensed, p_insured, p_understands_connector, p_handles_own_agreements, p_read_terms);

  update public.profiles
  set roles = array(select distinct unnest(roles || array['vendor'::public.user_role]))
  where id = uid;

  return new_vendor_id;
end;
$$;

revoke all on function public.submit_vendor_application(public.vendor_category, text, text, text, text, text, text, boolean, boolean, boolean, boolean, boolean) from public, anon;
grant execute on function public.submit_vendor_application(public.vendor_category, text, text, text, text, text, text, boolean, boolean, boolean, boolean, boolean) to authenticated;
