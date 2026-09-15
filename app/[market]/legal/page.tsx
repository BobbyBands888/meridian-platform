import type { Metadata } from "next";
import Link from "next/link";
import { Container, PageHeader } from "@/components/ui";
import { requireMarket } from "@/lib/market-data";
import { brandName, COMPANY, type Market } from "@/lib/markets";

export async function generateMetadata({ params }: PageProps<"/[market]/legal">): Promise<Metadata> {
  const market = await requireMarket((await params).market);
  return {
    title: "Legal: Terms, Privacy, and Fair Housing",
    description: `${brandName(market)} terms of service, privacy policy, and fair housing policy. We are a marketplace connector, not a broker, and do not hold funds or facilitate closings.`,
    alternates: { canonical: "/legal" },
  };
}

const termsFor = (market: Market, brand = brandName(market)) => [
  {
    title: `What ${brand} is.`,
    body: `${brand}, operated by ${COMPANY.name}, is an online marketplace that lets home sellers publish listings, lets buyers view them, and lets independent professionals list their services. We connect people. We do not participate in transactions.`,
  },
  {
    title: "What we are not.",
    body: "We are not a real estate broker or agent. We do not practice law. We do not hold earnest money, deposits, or any funds. We do not facilitate, coordinate, or conduct closings. We do not provide legal, financial, tax, valuation, or real estate advice. Nothing on this site is advice.",
  },
  {
    title: "Your responsibilities.",
    body: `You are responsible for your own transaction. Buyers and sellers should hire their own real estate attorney, home inspector, title company, and lender. Sellers are responsible for complying with all disclosure laws, including ${market.state}'s seller disclosure requirements. Vendors are responsible for their own licensing, insurance, client agreements, and legal compliance.`,
  },
  {
    title: "Accuracy.",
    body: "Listings and vendor profiles are submitted by users. We review submissions before publishing but do not verify the accuracy of any listing, price, description, credential, or claim. Verify everything independently. A vendor verification badge means we reviewed that vendor's license and insurance documents on the date shown; it is not a guarantee of quality or of current licensing or insurance standing.",
  },
  {
    title: "Conduct.",
    body: "No fraudulent listings, no impersonation, no harassment, no scraping, no use of contact forms for solicitation unrelated to the specific listing or vendor. Violations result in removal.",
  },
  {
    title: "Limitation of liability.",
    body: `To the fullest extent permitted by law, ${COMPANY.name} is not liable for any loss, damage, or dispute arising from any transaction, communication, or relationship between users, or from any vendor's services. Use of this site is at your own risk.`,
  },
  {
    title: "Changes.",
    body: "We may update these terms. Continued use after changes means you accept them.",
  },
];

const sections = [
  { id: "terms", label: "Terms of Service" },
  { id: "privacy", label: "Privacy Policy" },
  { id: "fair-housing", label: "Fair Housing Policy" },
];

function Mail({ email }: { email: string }) {
  return (
    <a href={`mailto:${email}`} className="font-medium text-forest underline underline-offset-2">
      {email}
    </a>
  );
}

export default async function LegalPage({ params }: PageProps<"/[market]/legal">) {
  const market = await requireMarket((await params).market);
  const brand = brandName(market);
  const terms = termsFor(market);
  return (
    <>
      <PageHeader title="Legal" intro={`Terms of Service, Privacy Policy, and Fair Housing Policy for ${brand}.`}>
        <nav aria-label="On this page" className="mt-8">
          <ul className="flex flex-col gap-2 sm:flex-row sm:gap-6">
            {sections.map((s) => (
              <li key={s.id}>
                <Link href={`#${s.id}`} className="text-[15px] font-semibold text-forest hover:underline">
                  {s.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </PageHeader>

      <Container>
        <div className="max-w-3xl space-y-16 text-[17px] leading-[1.75]">
          <section id="terms" aria-labelledby="terms-heading" className="scroll-mt-24">
            <h2 id="terms-heading" className="text-3xl font-bold tracking-tight">
              Terms of Service
            </h2>
            <ol className="mt-6 space-y-5">
              {terms.map((term, i) => (
                <li key={term.title}>
                  <strong className="font-semibold">
                    {i + 1}. {term.title}
                  </strong>{" "}
                  {term.body}
                </li>
              ))}
            </ol>
          </section>

          <section id="privacy" aria-labelledby="privacy-heading" className="scroll-mt-24">
            <h2 id="privacy-heading" className="text-3xl font-bold tracking-tight">
              Privacy Policy
            </h2>
            <p className="mt-6">
              We collect the information you give us (name, email, phone, listing details, messages) and basic usage
              analytics. We use it to operate the site, deliver your inquiries to the people you contact, and send you
              service emails. If you sign up for listing alerts, we&apos;ll email you when new homes are listed; every alert
              includes an unsubscribe link. We do not sell your personal information. Contact details are never displayed publicly;
              they are shared only with the specific person you choose to contact through a form. You can request
              deletion of your account and data by emailing <Mail email={market.sender_email} />.
            </p>
          </section>

          <section id="fair-housing" aria-labelledby="fair-housing-heading" className="scroll-mt-24">
            <h2 id="fair-housing-heading" className="text-3xl font-bold tracking-tight">
              Fair Housing Policy
            </h2>
            <p className="mt-6">
              {brand} complies with the federal Fair Housing Act and {market.state} law. Listings, vendor profiles, and
              messages may not discriminate or express a preference based on race, color, religion, national origin,
              sex, familial status, disability, or any other protected characteristic. Our listing form screens for
              common prohibited phrases. Any user who discriminates will be removed. To report a concern, email <Mail email={market.sender_email} />.
            </p>
          </section>
        </div>
      </Container>
    </>
  );
}
