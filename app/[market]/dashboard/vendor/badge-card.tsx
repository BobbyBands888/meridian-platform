import { CopyField } from "@/components/copy-field";
import { brandName, type Market } from "@/lib/markets";
import { badgeEmbedHtml, badgeSvg, badgeUrls, type BadgeVendor } from "@/lib/vendor-badge";

/**
 * The embed card on the vendor dashboard. The preview is the same SVG the /badge route serves, rendered inline
 * so it looks right before the vendor's site ever requests it.
 */
export function BadgeCard({ market, vendor }: { market: Market; vendor: BadgeVendor }) {
  const verified = Boolean(vendor.verified_at);
  const brand = brandName(market);
  const { profileUrl, imageUrl } = badgeUrls(market, vendor);

  return (
    <section aria-labelledby="badge-heading" className="rounded-2xl border border-line p-6">
      <h2 id="badge-heading" className="text-2xl font-semibold tracking-tight">
        Add the {brand} badge to your site
      </h2>
      <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-muted">
        Paste this where visitors will see it, like your footer or your About page. It shows you&apos;re{" "}
        {verified ? "verified" : "listed"} in the directory and links back to your {brand} profile.
      </p>

      <div className="mt-5 flex flex-col gap-6 lg:flex-row">
        <div className="shrink-0">
          <p className="text-[13px] font-medium text-muted">Preview</p>
          <div className="mt-2 inline-block rounded-xl bg-surface p-5" dangerouslySetInnerHTML={{ __html: badgeSvg(market, verified) }} />
          {!verified && (
            <p className="mt-2 max-w-[260px] text-[13px] leading-relaxed text-muted">
              Finish verification above and the badge changes to &ldquo;Verified on {brand}&rdquo; everywhere it&apos;s
              embedded, with no change to your code.
            </p>
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-5">
          <CopyField
            label="Embed code (HTML)"
            hint="Keep rel=&quot;dofollow&quot; so the link counts for your search ranking."
            rows={3}
            value={badgeEmbedHtml(market, vendor)}
          />
          <CopyField label="Image URL" hint="For a site builder that asks for an image address and its link." value={imageUrl} />
          <CopyField label="Your profile URL" hint="Where the badge links to." value={profileUrl} />
        </div>
      </div>
    </section>
  );
}
