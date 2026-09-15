# Ownvista setup (Nashville Buys, Tampa Buys, Orlando Buys)

Everything you need to configure outside the code: accounts, environment variables, Supabase, email DNS, and bot protection. Sections are marked with the phase that needs them.

One codebase and one database serve every market. The request's hostname picks the market (`nashvillebuys.com` is Nashville, `tampabuys.com` is Tampa), and `getownvista.com` shows the hub page listing all markets. To add a city, see **Launch a new market** at the end.

## Accounts

| Service | Used for | Sign up |
| --- | --- | --- |
| Supabase | Sign-in (magic link), Postgres database, photo storage | https://supabase.com/dashboard |
| Resend | Sign-in emails and transactional email from each market's own address (hello@nashvillebuys.com, hello@tampabuys.com, ...) | https://resend.com |
| Cloudflare Turnstile | Invisible bot protection on public forms | https://dash.cloudflare.com → Turnstile |
| Vercel | Hosting, domain, analytics | https://vercel.com |

## Environment variables

Set these in `.env.local` for local development, and in **Vercel → Project → Settings → Environment Variables** (Production and Preview) for the live site. Redeploy after changing them.

| Name | Where to find it | Exposed to browser? |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → Data API → Project URL | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API Keys → **Publishable key** (`sb_publishable_…`) | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API Keys → **Secret key** (`sb_secret_…`) | **No, server only** |
| `RESEND_API_KEY` | Resend → API Keys → Create API key (Sending access, **All domains**, so it can send for every market) | **No, server only** |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Cloudflare → Turnstile → your widget → Site Key | Yes |
| `TURNSTILE_SECRET_KEY` | Cloudflare → Turnstile → your widget → Secret Key | **No, server only** |
| `ADMIN_EMAIL` | The address that receives approval requests, lead copies, the morning digest, and replies to the day-14 vendor email | No |
| `ANTHROPIC_API_KEY` | https://console.anthropic.com → API Keys → Create Key. Powers **Write it for me** on the sell form. Without it the button says the feature isn't available; nothing else changes | **No, server only** |
| `CRON_SECRET` | Any long random string you make up (for example `openssl rand -hex 32`). Vercel sends it to the daily job so nobody else can trigger it | **No, server only** |
| `FACEBOOK_PAGE_TOKEN_NASHVILLE` (one per market: `FACEBOOK_PAGE_TOKEN_TAMPA`, `FACEBOOK_PAGE_TOKEN_ORLANDO`, ...) | A Facebook Page access token; see **Facebook Page posting**. Optional: a market without one just isn't posted to Facebook | **No, server only** |

The Supabase variable names say "anon" and "service role", but they hold the new publishable and secret keys.

---

## Supabase (Phase 2)

### 1. Run the database migrations

Run each file in `supabase/migrations/` in filename order, once each (re-running is safe):

1. `20260914000000_initial_schema.sql` (Phase 2)
2. `20260915000000_vendor_directory.sql` (Phase 3: vendor signup, held edits)
3. `20260916000000_listings.sql` (Phase 4: listings, stager and home insurance categories, category edits held for review)
4. `20260917000000_listing_city.sql` (Phase 4: listing city for Middle Tennessee ZIP codes)
5. `20260918000000_vendor_verification.sql` (Verified vendor tier and the private `vendor-documents` bucket)
6. `20260919000000_listing_alerts.sql` (Buyer listing alert signups; server-only table)
7. `20260920000000_markets.sql` (Phase 7: markets table, `market_id` on vendors, listings, leads, and alerts, sign-in email rate limit)
8. `20260921000000_automation.sql` (Phase 8: alert send log, vendor email log, Facebook post log, vendor approval date and email preferences, market launch date)
9. `20260922000000_growth.sql` (Phase 9: signup market on profiles, expressions of interest, the seven-day email course, AI description usage)

If you ever re-run an earlier file, re-run every later file after it too, since later files replace some of its functions.

For each: open **Supabase → SQL Editor → New query**, paste the full file, and click **Run**. Supabase may warn that the query contains destructive operations: it drops and recreates its own policies and triggers so the file can be re-run. Confirm to continue.

The migration creates the tables, row-level security policies, the `listing-photos` and `vendor-headshots` storage buckets, and public read-only views. It is safe to run again after changes.

The Security Advisor will list `public_vendors`, `public_listings`, and `public_listing_photos` as "Security Definer View". That is intentional: those views are how public pages read approved vendors and active listings without exposing contact details, seller ids, or hidden street addresses.

### 2. Auth URLs

**Authentication → URL Configuration**

- **Site URL:** `https://www.nashvillebuys.com`
- **Redirect URLs:** add all of these:
  - `https://www.nashvillebuys.com/**`
  - `https://nashvillebuys.com/**`
  - `http://localhost:3000/**`
  - `https://*-<your-vercel-team-slug>.vercel.app/**` (preview deployments; find the slug in any preview URL)

### 3. Sign-in methods

**Authentication → Sign In / Providers**

- **Email:** enabled. Leave **Confirm email** on.
- **Phone:** disabled. Phone numbers are collected on the profile but not verified by SMS.
- All other providers: disabled. Magic link is the only sign-in method.

### 4. Email templates

Since Phase 7 the site sends sign-in emails itself through Resend, so each market's sender address and brand are used. It creates the one-time link with the Supabase admin API and limits each address to one sign-in email a minute and five an hour. The templates below are only used if Supabase itself sends an auth email (for example an email-address change), so they're optional now.

Supabase's default links only work in the same browser that requested them, which breaks when someone requests a link on their laptop and taps it on their phone, or opens it from the Gmail app. These templates send people to the site's `/auth/confirm` page, which works on any device.

**Authentication → Emails → Templates**

**Magic Link**

- Subject: `Your Nashville Buys sign-in link`
- Body:

```html
<h2>Sign in to Nashville Buys</h2>
<p>Tap the button below to sign in. This link expires in one hour and can be used once.</p>
<p><a href="{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=email" style="display:inline-block;padding:12px 20px;background:#1F4D3A;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600">Sign in</a></p>
<p>If you didn't request this, you can ignore this email.</p>
<p style="color:#5b5f5d;font-size:13px">Nashville Buys connects buyers, sellers, and professionals directly. We are not a broker, do not hold funds, and do not facilitate closings.</p>
```

**Confirm signup** (sent the first time a new email signs in)

- Subject: `Confirm your email for Nashville Buys`
- Body: the same as above, with the heading changed to `Welcome to Nashville Buys`.

The link opens a "Continue signing in" page on the site. The one-time token is only used when the person taps the button, so email security scanners that pre-open links (Outlook, Microsoft Defender, some corporate filters) can't use it up first.

The link relies on the redirect URL the site sends, which always includes `?next=…`. If a sign-in link ever lands on the home page instead of `/auth/confirm`, the host it came from is missing from the Redirect URLs list above.

### 5. Send auth emails through Resend

Sign-in links no longer go through Supabase (see above), so this is only a fallback for other Supabase auth emails. Supabase's built-in email sender only delivers to members of your Supabase team and is limited to a few messages per hour. Real users won't receive sign-in links until custom SMTP is set up.

1. Verify `nashvillebuys.com` in Resend first (see **Resend DNS records** below).
2. **Supabase → Authentication → Emails → SMTP Settings → Enable custom SMTP**
   - Sender email: `hello@nashvillebuys.com`
   - Sender name: `Nashville Buys`
   - Host: `smtp.resend.com`
   - Port: `465`
   - Username: `resend`
   - Password: your Resend API key
3. **Authentication → Rate Limits:** raise "Rate limit for sending emails" to at least `100` per hour.

### 6. Make your account an admin

1. Sign in on the site once with your admin email so your profile exists.
2. **SQL Editor → New query**, replace the address, and run:

```sql
update public.profiles set is_admin = true where email = 'you@example.com';
```

---

## Resend DNS records

Sign-in links (sent by Supabase through Resend SMTP) and every notification the site sends (vendor and listing confirmations, approvals, inquiries with reply-to set to the sender, admin copies) come from `hello@nashvillebuys.com`, so the domain must be verified in Resend.

1. **Resend → Domains → Add Domain** → `nashvillebuys.com`, region `us-east-1`.
2. Resend shows the exact records for your domain. They follow this pattern; copy the values from Resend, especially the DKIM key, which is unique to your account.
3. Add each one in **Vercel → Domains → nashvillebuys.com → DNS Records → Add** (Vercel is the DNS host for the domain):

| Type | Name | Value | Priority |
| --- | --- | --- | --- |
| MX | `send` | `feedback-smtp.us-east-1.amazonses.com` | 10 |
| TXT | `send` | `v=spf1 include:amazonses.com ~all` | |
| TXT | `resend._domainkey` | `p=MIGf…` (DKIM public key from Resend) | |
| TXT | `_dmarc` | `v=DMARC1; p=none; rua=mailto:hello@nashvillebuys.com` | |

4. Back in Resend, click **Verify DNS Records**. Verification usually takes a few minutes and can take up to 48 hours.

The `_dmarc` record is optional but improves inbox placement. Don't add a second SPF record if one already exists on `send`; merge them instead.

To receive replies at `hello@nashvillebuys.com`, you also need an inbox for it (for example Google Workspace, Fastmail, or Cloudflare Email Routing). That provider's MX records go on the root `@` name and don't conflict with Resend's `send` records.

---

## Cloudflare Turnstile (Phase 3)

Protects every public form: sign-in and the contact forms on vendor profiles and listings. The site verifies tokens itself, so leave Supabase's own CAPTCHA setting (Authentication → Attack Protection) off.

1. **Cloudflare dashboard → Turnstile → Add widget**
   - Widget name: `Nashville Buys`
   - Hostnames: `nashvillebuys.com`, `www.nashvillebuys.com` (add your Vercel preview domain too if you test forms on previews)
   - Widget mode: **Invisible**
2. Copy the **Site Key** to `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and the **Secret Key** to `TURNSTILE_SECRET_KEY`.

For local development, use Cloudflare's test keys so forms work on localhost: site key `1x00000000000000000000AA` and secret `1x0000000000000000000000000000000AA` (always passes). The secret `2x0000000000000000000000000000000AA` always fails, which is useful for checking that blocked submissions are rejected.

## Guides

Guides are markdown files in `content/guides/<market>/`, one folder per market (`content/guides/nashville/`). The filename is the URL slug (`content/guides/nashville/my-guide.md` becomes `nashvillebuys.com/guides/my-guide`). A live market with no folder simply has no guides: its Guides page shows an empty state (kept out of search results), and the home page's guides card and links are hidden until the first file is added. Each file starts with front matter:

```md
---
title: Page heading
seoTitle: Title for search results (optional; defaults to title)
description: One or two sentences for search results and link previews.
publishedAt: 2026-09-15
updatedAt: 2026-10-01 (optional)
vendorCategories: [attorney, home_inspector]
topic: disclosure (optional; marks the market's seller disclosure guide)
---
```

The guide with `topic: disclosure` is linked from the listing form, listing pages, the listing-received email, and the checklist's disclosure step.

## Mailing address

Every market's site footer, the hub footer, and every email footer show `Ownvista, PO Box 44, Medford, MA 02155`. It's set once as `COMPANY.mailingAddress` in `lib/markets.ts`. Marketing emails (buyer alerts and digests, the alert signup confirmation, and vendor tips and summaries) also get an unsubscribe link and one-click unsubscribe headers: pass `unsubscribe` to `sendEmail`.

## Checklist

`content/checklist.md` is shared by every market. These placeholders are filled in from the market's row: `{brand}` (Nashville Buys), `{name}` (Nashville), `{region}` (Middle Tennessee), `{state}` (Tennessee), `{closing}` (the market's `closing_note`, like "attorney or title company"), and `{disclosure}` (its `disclosure_note`, one sentence on the state's seller disclosure rule).

`vendorCategories` uses the category values (attorney, home_inspector, photographer, painter, stager, handyman, lender, home_insurance) to show matching vendor cards under the guide. Commit and push a new or edited file; it goes live with the next deploy and is added to the sitemap automatically.

## Admin

- `/admin` works on any market's domain (sign in on that domain). It has four tabs: **Pending Vendors** (new applications and edits to live profiles), **Pending Listings**, **All Leads**, and **Markets**. Approve and reject buttons send the matching email, from the vendor's or listing's own market. Open a row's Review page to add a note to a rejection.
- **Market filter:** every tab, count, and export follows the market filter above the tabs. It starts on the market whose domain you're on; choose **All markets** to see everything. Each row shows its market, and vendors who signed up in a coming-soon market are labeled **Pre-launch**.
- **Markets tab:** shows each market's status, domain, sender, and counties. **Flip to live** (with the confirmation box checked) launches a market; **Set back to coming soon** hides its listings and directory again.
- **Export vendors (CSV)**, **Export leads (CSV)**, and **Export listing alerts (CSV)** download the filtered market (or all markets), with a market column. They include contact details, so treat the files as private.
- **Listing alert signups** (under the Admin heading) counts active buyer signups from the home page and /homes. Signups are only collected for now: each gets a confirmation email with an unsubscribe link, and no alert emails are sent yet.

## Growth features (Phase 9)

- **Vendor badge:** an approved vendor's dashboard has an embed card with the market's badge, served from `/badge/<vendor id>` on that market's domain. It changes from "Listed on" to "Verified on" by itself once verification is done, everywhere it's already embedded. Nothing to configure.
- **Yard sign and flyer:** a seller with a published listing gets both as PDFs from their listing dashboard, built on demand. Neither carries the street address, and the flyer leaves out the description, so it's facts only.
- **Neighborhood pages:** `/homes/<area>` exists for every area in the market's ZIP map (`lib/markets/zips/`), with `/homes/areas` listing them by county. Both are in the sitemap. A new market gets its area pages the moment its ZIP file lands.
- **Write it for me:** needs `ANTHROPIC_API_KEY`. Uses `claude-sonnet-4-6`, sends only the facts the seller typed plus their notable-features box, and runs the Fair Housing filter on what comes back. Capped at 12 runs per seller per day. Every run is logged in `listing_ai_usage` with token counts, matched to the listing once it's submitted: `select model, sum(input_tokens), sum(output_tokens), count(*) from listing_ai_usage group by model;` for the bill.
- **Seller course:** `/sell/course`, with a second signup on the checklist page. Seven emails from the checklist's seven sections. Nothing to configure.
- **Buyers tab:** admin → Buyers shows buyer accounts and alert signups side by side, filtered by market, with CSV exports. The market column comes from `profiles.market_id`, set on an account's first sign-in; accounts from before Phase 9 show no market.

## Vercel

- **Domains:** for each market, `www.<domain>` is primary and the bare domain redirects to it (Project → Settings → Domains). Add `getownvista.com` and `www.getownvista.com` the same way for the hub.
- **Analytics:** Project → Analytics → Enable. The site already includes the Analytics component.

## Automation

### What sends when

| When | What | Marketing (unsubscribe link)? |
| --- | --- | --- |
| A listing is approved | **Buyer alerts:** one email per listing to every active subscriber in that market whose ZIP is blank, the same ZIP, or in the same county. Up to 3 a day per subscriber (their market's calendar day); listings past that are held for the next morning's digest. Never the same listing twice. | Yes |
| A listing is approved | **Facebook post** on the market's Page: cover photo, price, beds/baths/sqft, place, and link. Skipped if the market has no page token. Never posted twice. | n/a |
| Daily job | **Alert digest:** one email per subscriber with the listings held back by the daily cap. Sold or withdrawn listings and unsubscribed buyers are dropped. | Yes |
| Daily job | **Vendor day 2:** "Three things that get your profile picked", 2 to 7 days after approval. | Yes |
| Daily job | **Vendor day 14:** "How's it going?" with their inquiry count, reply-to `ADMIN_EMAIL`, 14 to 21 days after approval. | Yes |
| Daily job, on the 1st (catches up on the 2nd and 3rd) | **Vendor monthly summary:** "You received N inquiries through <Market> Buys in <month>" with the list, or "Here's how to get your first inquiry" with the three tips. Skipped for vendors approved in the last 3 days of the month. | Yes |
| Signup, then daily job | **Seven-day seller course:** one email a day for a week, each covering a section of the pre-sale checklist with links to the matching guide and vendor category. Day 1 goes out the moment someone signs up (at `/sell/course` or from the checklist page); the daily job sends days 2 to 7. Anyone who has listed a home is dropped from the course. | Yes |
| Daily job | **Founder digest** to `ADMIN_EMAIL`: pending vendors, listings, and edits; leads in the last 24 hours; vendors approved 30+ days ago with no inquiries; alert signups yesterday; skipped or failed automation (like a missing Facebook token); a line per market. Not sent when there's nothing to report. | No |

Vendor emails only go to approved vendors in live markets. For a vendor approved before their market launched, day 2 and day 14 count from the launch date. Every email, marketing or not, has the Ownvista mailing address in the footer. Vendors can turn off tips and monthly summaries from the link in those emails; approval and inquiry emails always go out. Every send is logged (`listing_alert_sends`, `vendor_emails`, `listing_syndication`, `course_emails`), and the admin listing page shows each approved listing's alert and Facebook results.

### Daily job (Vercel Cron)

`vercel.json` schedules `/api/cron/daily` for `0 12 * * *` (12:00 UTC, about 7 a.m. Central). On the Hobby plan it runs once a day at some point in that hour.

1. Set `CRON_SECRET` in Vercel (Production) and redeploy. Vercel sends it automatically; requests without it get a 401.
2. Check it: Vercel → Project → Settings → Cron Jobs shows the job and has a **Run** button. The response lists what it sent.
3. To run it by hand: `curl -H "Authorization: Bearer $CRON_SECRET" https://www.nashvillebuys.com/api/cron/daily`

Locally (not in production) you can run it as of another time, to test the monthly summary or the day-2 and day-14 windows: `curl -H "Authorization: Bearer $CRON_SECRET" "http://localhost:3000/api/cron/daily?now=2026-10-01T12:00:00Z"`.

## Facebook Page posting

Each market posts approved listings to its own Facebook Page. You need a Page per market, one Meta app, and a Page access token per market.

1. **Create the Page** (skip if it exists): facebook.com → Pages → Create new Page, named for the market (for example Nashville Buys). You need full control of it (Page settings → Page access → you're listed with full control).
2. **Create a Meta app** (once, for all markets): https://developers.facebook.com/apps → **Create app**.
   - App name: `Ownvista Publisher`. Contact email: yours.
   - Use case: **Manage everything on your Page**. Business portfolio: your Ownvista business portfolio, or none for now.
   - The app can stay in **Development** mode. You don't need App Review for Pages you manage yourself, because you have a role on the app.
3. **Get a user token with Page permissions:** open the Graph API Explorer (https://developers.facebook.com/tools/explorer), pick `Ownvista Publisher` as the app, and under Permissions add `pages_show_list`, `pages_read_engagement`, and `pages_manage_posts`. Click **Generate Access Token**, and in the Facebook dialog choose the market Pages to allow.
4. **Make it long-lived:** open the Access Token Debugger (https://developers.facebook.com/tools/debug/accesstoken), paste the token, click **Debug**, then **Extend Access Token** at the bottom. Copy the new long-lived user token.
5. **Get the Page tokens:** back in the Graph API Explorer, paste the long-lived user token into the Access Token box and run `GET me/accounts?fields=name,access_token`. Each Page in the result has its own `access_token`. Page tokens made from a long-lived user token don't expire.
6. **Check a Page token** in the Access Token Debugger: **Type** is Page, **Expires** is Never, and **Scopes** include `pages_manage_posts`.
7. **Add it to Vercel** (Production only): `FACEBOOK_PAGE_TOKEN_NASHVILLE` = the Nashville Page's `access_token`. Use the market's slug in capitals, with dashes as underscores. Redeploy.
8. **Test:** approve a listing, then check the Page and the "After approval" box on the admin listing page. Errors from Facebook show there and in the next morning digest.

Keep the tokens private: anyone with one can post as the Page. Tokens stop working if you change your Facebook password, lose your role on the Page, or remove the app's access (Facebook → Settings → Business integrations); repeat steps 3 to 7 to get new ones. Listings approved while a market has no token are skipped for good (the digest lists them); post those by hand if you want them on the Page.

## Local development: simulating markets

`npm run dev`, then open:

- `http://localhost:3000`: Nashville
- `http://tampa.localhost:3000` or `http://orlando.localhost:3000`: that market (any `<slug>.localhost` works)
- `http://hub.localhost:3000`: the Ownvista hub

Sign-in works on each of these hosts, and the session is separate per host, just like on the real domains. You can also send a real domain in the Host header: `curl -H "Host: tampabuys.com" http://localhost:3000/`.

## Launch a new market

Example: Atlanta at atlantabuys.com. Do steps 1 through 6 while the market is coming soon; the launch page, buyer alerts, and vendor pre-registration work from step 4 on.

1. **Vercel domain.** Project → Settings → Domains → add `atlantabuys.com` and `www.atlantabuys.com`. Make `www` the primary domain and set the bare domain to redirect to it.
2. **DNS records** at the domain registrar:
   - For Vercel: an `A` record on `@` pointing to the IP Vercel shows (currently `76.76.21.21`), and a `CNAME` on `www` pointing to `cname.vercel-dns.com`. Use the exact values Vercel displays.
   - For Resend: Resend → Domains → Add Domain → `atlantabuys.com`, then add the `MX` and `TXT` (SPF) records on `send`, the DKIM `TXT` on `resend._domainkey`, and the `_dmarc` `TXT`, as listed under **Resend DNS records** above. Click **Verify DNS Records**. Until the domain verifies, that market's emails go out from `hello@nashvillebuys.com` with the new market's name and a reply-to of its own address, so nothing fails in the meantime.
   - For receiving mail: the `MX` records for your inbox provider on `@` (next step).
3. **Workspace email alias.** Google Workspace Admin → Account → Domains → Manage domains → **Add a domain** → `atlantabuys.com` as a **Secondary domain** and verify it (Workspace gives you a `TXT` record and its `MX` records). Then Directory → Users → your user → **Alternate email addresses** → add `hello@atlantabuys.com`. (A user alias domain won't work here: it only mirrors existing usernames.) Send a test email to that address to confirm it arrives.
4. **Market row.** Supabase → SQL Editor, adjust the values, and run. Leave `status` as `coming_soon`:

```sql
insert into public.markets
  (slug, name, short_name, region, state, state_code, status, domain, counties, sender_email, closing_note, disclosure_note, timezone, sort_order)
values
  ('atlanta', 'Atlanta', 'ATL', 'Metro Atlanta', 'Georgia', 'GA', 'coming_soon', 'atlantabuys.com',
   array['Fulton', 'DeKalb', 'Cobb', 'Gwinnett'], 'hello@atlantabuys.com',
   'attorney',
   'One sentence on Georgia''s seller disclosure rules, written for sellers.',
   'America/New_York', 4);
```

   - `name` is the city in "<name> Buys"; `region` is the header tag; `short_name` is the admin badge.
   - `closing_note` reads after "your" in the checklist ("Line up your attorney now"). `disclosure_note` is one sentence and appears on the listing form, listing pages, and the checklist.
   - The slug is permanent: it's the `content/guides/<slug>/` folder, the ZIP data key, and the local `<slug>.localhost` host.

5. **ZIP data.** Create `lib/markets/zips/atlanta.ts` with the same structure as `tampa.ts` (every residential ZIP with its mailing city, a common area name, and its county, plus the county list in display order), and add it to `marketZips` in `lib/markets/zips/index.ts`. Commit and push. This drives the ZIP menus, search, alert ZIPs, and listing locations.
6. **Guides (optional before launch).** Add markdown files to `content/guides/atlanta/` (see **Guides**). Mark the disclosure guide with `topic: disclosure`. Commit and push.
7. **Supabase Auth URLs.** Authentication → URL Configuration → Redirect URLs → add `https://atlantabuys.com/**` and `https://www.atlantabuys.com/**`. (The site builds its own sign-in links, but keep these for any email Supabase sends.)
8. **Turnstile.** Cloudflare → Turnstile → your widget → Hostname management → add `atlantabuys.com` and `www.atlantabuys.com`. Forms (sign-in, alerts, contact) on the new domain fail the bot check until this is done.
9. **Facebook (optional).** Create the market's Page and add `FACEBOOK_PAGE_TOKEN_ATLANTA` in Vercel (see **Facebook Page posting**). Without it, listings still go live; they just aren't posted to Facebook.
10. **Flip to live.** Sign in to `/admin` on any market's domain → **Markets** → check the confirmation box next to the new market → **Flip to live**. Listings, the vendor directory (including pre-launch vendors you approved), guides, and the sitemap go public right away, and the market appears in the header's market switcher. Approved pre-launch vendors aren't emailed automatically, so let them know they're live.
