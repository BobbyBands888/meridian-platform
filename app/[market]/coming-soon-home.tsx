import { ListingAlertsForm } from "@/components/listing-alerts-form";
import { Check } from "@/components/photo-card";
import { PrelaunchVendorSignup } from "@/components/prelaunch-vendor-signup";
import { Container } from "@/components/ui";
import { brandName, countyList, type Market } from "@/lib/markets";
import { VENDOR_CATEGORY_LIMIT_NOTE } from "@/lib/site";

const FOUNDING_POINTS = ["Free for founding vendors", "Reviewed before launch", "Listed on day one"];

/** Home page for a market that hasn't launched: the brand, buyer alerts, and vendor pre-registration. */
export function ComingSoonHome({ market }: { market: Market }) {
  const brand = brandName(market);

  return (
    <>
      <section className="border-b border-line">
        <Container className="py-16 sm:py-24">
          <p className="inline-flex rounded-full border border-warm/40 bg-warm/10 px-3 py-1 text-[13px] font-semibold uppercase tracking-wider text-ink">
            Coming soon to {market.region}
          </p>
          <h1 className="mt-5 max-w-3xl text-[2.6rem] font-bold leading-[1.05] tracking-tight sm:text-6xl">{brand}</h1>
          <p className="mt-5 max-w-2xl text-xl leading-relaxed text-muted">
            {brand} is launching soon: free listings for selling without an agent, plus vetted local pros.
          </p>
        </Container>
      </section>

      <section aria-labelledby="alerts-heading">
        <Container className="pt-16 sm:pt-20">
          <div className="rounded-3xl bg-surface px-6 py-10 sm:px-10">
            <h2 id="alerts-heading" className="text-2xl font-bold tracking-tight sm:text-3xl">
              Get new {market.name} FSBO listings by email
            </h2>
            <p className="mt-3 max-w-2xl text-[17px] leading-relaxed text-muted">
              Be first to hear when owners list homes. Add a ZIP to focus on one area, or leave it blank for all of {market.region}.
            </p>
            <div className="mt-6 max-w-3xl">
              <ListingAlertsForm />
            </div>
          </div>
        </Container>
      </section>

      <section id="pre-register" aria-labelledby="vendors-heading" className="scroll-mt-20">
        <Container className="pt-16 sm:pt-20">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] lg:gap-14">
            <div>
              <h2 id="vendors-heading" className="text-3xl font-bold tracking-tight sm:text-4xl">
                {market.name} pros: pre-register as a founding vendor
              </h2>
              <p className="mt-4 text-[17px] leading-relaxed text-muted">
                Attorneys, inspectors, photographers, painters, stagers, handymen, lenders, and insurance agents serving{" "}
                {countyList(market)}. Create your profile now; we review it before launch and list you in the directory the day{" "}
                {brand} opens. {VENDOR_CATEGORY_LIMIT_NOTE}
              </p>
              <ul className="mt-6 space-y-2">
                {FOUNDING_POINTS.map((point) => (
                  <li key={point}>
                    <Check label={point} />
                  </li>
                ))}
              </ul>
            </div>
            <PrelaunchVendorSignup brand={brand} state={market.state} marketSlug={market.slug} serviceAreaExample={countyList({ counties: market.counties.slice(0, 2) })} />
          </div>
        </Container>
      </section>
    </>
  );
}
