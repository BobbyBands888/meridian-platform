import type { Metadata } from "next";
import Link from "next/link";
import { CourseForm } from "@/components/course-form";
import { Container } from "@/components/ui";
import { getChecklist } from "@/lib/checklist";
import { COURSE_DAYS } from "@/lib/course";
import { requireLiveMarket } from "@/lib/market-data";
import { brandName, countyList } from "@/lib/markets";

export const revalidate = 3600;

export async function generateMetadata({ params }: PageProps<"/[market]/sell/course">): Promise<Metadata> {
  const market = await requireLiveMarket((await params).market);
  return {
    title: `Selling without an agent in ${market.name}`,
    description: `A free seven-day email course on selling your ${market.name} home yourself: one email a day, drawn from our pre-sale checklist. General information, not legal, financial, or pricing advice.`,
    alternates: { canonical: "/sell/course" },
  };
}

export default async function CoursePage({ params }: PageProps<"/[market]/sell/course">) {
  const market = await requireLiveMarket((await params).market);
  const checklist = await getChecklist(market);
  const days = checklist.sections.slice(0, COURSE_DAYS);

  return (
    <Container className="py-12 sm:py-16">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl">
          Selling without an agent in {market.name}, one email a day for a week
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-muted">
          Seven emails, one a day, that walk through selling your own home across {countyList(market, "or")} — from working out
          your number to what happens at the closing table. Free, and it ends after a week.
        </p>

        <div className="mt-8 rounded-2xl bg-surface px-6 py-8 sm:px-8">
          <CourseForm source="/sell/course" />
        </div>

        <h2 className="mt-12 text-2xl font-semibold tracking-tight">What arrives</h2>
        <ol className="mt-5 space-y-4">
          {days.map((section, i) => (
            <li key={section.number} className="flex gap-4">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-forest text-[14px] font-semibold text-white">
                {i + 1}
              </span>
              <div>
                <p className="font-semibold">{section.title}</p>
                <p className="mt-0.5 text-[15px] leading-relaxed text-muted">
                  {section.steps.length} steps, including &ldquo;{section.steps[0]?.title}&rdquo;
                </p>
              </div>
            </li>
          ))}
        </ol>

        <p className="mt-10 rounded-xl border border-line bg-surface px-4 py-3 text-[15px] leading-relaxed" role="note">
          {checklist.disclaimer}
        </p>

        <p className="mt-6 text-[15px]">
          Want it all at once instead?{" "}
          <Link href="/sell/checklist" className="font-medium text-forest underline underline-offset-2">
            Open the full {brandName(market)} checklist
          </Link>
          .
        </p>
      </div>
    </Container>
  );
}
