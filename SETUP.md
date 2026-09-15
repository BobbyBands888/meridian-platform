# Nashville Buys setup

Everything you need to configure outside the code: accounts, environment variables, Supabase, email DNS, and bot protection. Sections are marked with the phase that needs them.

## Accounts

| Service | Used for | Sign up |
| --- | --- | --- |
| Supabase | Sign-in (magic link), Postgres database, photo storage | https://supabase.com/dashboard |
| Resend | Sign-in emails and transactional email from hello@nashvillebuys.com | https://resend.com |
| Cloudflare Turnstile | Invisible bot protection on public forms | https://dash.cloudflare.com → Turnstile |
| Vercel | Hosting, domain, analytics | https://vercel.com |

## Environment variables

Set these in `.env.local` for local development, and in **Vercel → Project → Settings → Environment Variables** (Production and Preview) for the live site. Redeploy after changing them.

| Name | Where to find it | Exposed to browser? |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → Data API → Project URL | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API Keys → **Publishable key** (`sb_publishable_…`) | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API Keys → **Secret key** (`sb_secret_…`) | **No, server only** |
| `RESEND_API_KEY` | Resend → API Keys → Create API key (Sending access, domain nashvillebuys.com) | **No, server only** |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Cloudflare → Turnstile → your widget → Site Key | Yes |
| `TURNSTILE_SECRET_KEY` | Cloudflare → Turnstile → your widget → Secret Key | **No, server only** |
| `ADMIN_EMAIL` | The address that receives approval requests and lead copies | No |

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

### 5. Send auth emails through Resend (required before launch)

Supabase's built-in email sender only delivers to members of your Supabase team and is limited to a few messages per hour. Real users won't receive sign-in links until custom SMTP is set up.

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

Guides are markdown files in `content/guides/`. The filename is the URL slug (`content/guides/my-guide.md` becomes `/guides/my-guide`). Each file starts with front matter:

```md
---
title: Page heading
seoTitle: Title for search results (optional; defaults to title)
description: One or two sentences for search results and link previews.
publishedAt: 2026-09-15
updatedAt: 2026-10-01 (optional)
vendorCategories: [attorney, home_inspector]
---
```

`vendorCategories` uses the category values (attorney, home_inspector, photographer, painter, stager, handyman, lender, home_insurance) to show matching vendor cards under the guide. Commit and push a new or edited file; it goes live with the next deploy and is added to the sitemap automatically.

## Admin

- `/admin` has three tabs: **Pending Vendors** (new applications and edits to live profiles), **Pending Listings**, and **All Leads**. Approve and reject buttons send the matching email. Open a row's Review page to add a note to a rejection.
- **Export vendors (CSV)** and **Export leads (CSV)** download everything, including contact details. Treat the files as private.

## Vercel

- **Domains:** `www.nashvillebuys.com` is primary, and `nashvillebuys.com` redirects to it (Project → Settings → Domains).
- **Analytics:** Project → Analytics → Enable. The site already includes the Analytics component.
