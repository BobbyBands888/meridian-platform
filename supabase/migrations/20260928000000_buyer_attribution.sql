-- Ownvista: buyer page sources and first-touch attribution
-- Run after 20260927000000_vendor_updated_at.sql. Paste into Supabase Dashboard > SQL Editor and run. Safe to re-run.
--
-- * leads and listing_alerts gain page_source (the site page the lead or signup came from: buyer_checklist, moved_in,
--   calculator, wanted, buy_page, buyer_guide, empty_module) and first_source (the first outside ?s= value the visitor
--   arrived with, e.g. reddit or fbgroup, kept for 30 days in a first-party cookie).
-- * funnel_events gains first_source, and the event list gains the buyer tool events (and the Buyer Wanted events,
--   so the check only changes once).
-- No new tables. All three tables stay server-only: nothing here changes their grants or row-level security.

-- ---------------------------------------------------------------------------
-- Leads and listing alerts
-- ---------------------------------------------------------------------------

alter table public.leads add column if not exists page_source text;
alter table public.leads add column if not exists first_source text;
alter table public.leads drop constraint if exists leads_page_source_format;
alter table public.leads add constraint leads_page_source_format check (page_source is null or page_source ~ '^[a-z0-9_-]{1,60}$');
alter table public.leads drop constraint if exists leads_first_source_format;
alter table public.leads add constraint leads_first_source_format check (first_source is null or first_source ~ '^[a-z0-9_-]{1,60}$');

alter table public.listing_alerts add column if not exists page_source text;
alter table public.listing_alerts add column if not exists first_source text;
alter table public.listing_alerts drop constraint if exists listing_alerts_page_source_format;
alter table public.listing_alerts add constraint listing_alerts_page_source_format check (page_source is null or page_source ~ '^[a-z0-9_-]{1,60}$');
alter table public.listing_alerts drop constraint if exists listing_alerts_first_source_format;
alter table public.listing_alerts add constraint listing_alerts_first_source_format check (first_source is null or first_source ~ '^[a-z0-9_-]{1,60}$');

-- ---------------------------------------------------------------------------
-- Funnel events
-- ---------------------------------------------------------------------------

alter table public.funnel_events add column if not exists first_source text;
alter table public.funnel_events drop constraint if exists funnel_events_first_source_format;
alter table public.funnel_events add constraint funnel_events_first_source_format check (first_source is null or first_source ~ '^[a-z0-9_-]{1,60}$');

-- The event check was created inline in 20260925000000_photos_and_funnel.sql, so Postgres named it funnel_events_event_check.
alter table public.funnel_events drop constraint if exists funnel_events_event_check;
alter table public.funnel_events add constraint funnel_events_event_check check (event in (
  -- Seller listing funnel
  'form_start', 'contact_saved', 'address_done', 'photos_done', 'submitted', 'email_verified',
  -- Buyer tools
  'buyer_checklist_start', 'moved_in_start', 'calculator_use',
  -- Buyer Wanted board (not used until that feature ships)
  'wanted_post_created', 'wanted_seller_contact', 'wanted_buyer_shared', 'wanted_match_clicked'
));

create index if not exists leads_page_source_idx on public.leads (created_at desc) where page_source is not null;
