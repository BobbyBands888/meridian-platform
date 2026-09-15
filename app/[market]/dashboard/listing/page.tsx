import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ButtonLink, Container, EmptyState } from "@/components/ui";
import { requireProfile } from "@/lib/auth";
import { formatPrice, statusLabels } from "@/lib/listings";
import { locationLine } from "@/lib/areas";
import { requireMarket } from "@/lib/market-data";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "My listing",
  robots: { index: false },
};

export default async function MyListingsPage({ params }: PageProps<"/[market]/dashboard/listing">) {
  const market = await requireMarket((await params).market);
  const profile = await requireProfile("/dashboard/listing");
  const supabase = await createClient();
  const { data: listings } = await supabase
    .from("listings")
    .select("id, street, city, zip, price, status, created_at, listing_photos(url, sort_order)")
    .eq("seller_id", profile.id)
    .eq("market_id", market.id)
    .order("created_at", { ascending: false });

  if (listings?.length === 1) redirect(`/dashboard/listing/${listings[0].id}`);

  return (
    <Container className="py-12 sm:py-16">
      <Link href="/dashboard" className="text-[15px] font-medium text-forest hover:underline">
        ← Your account
      </Link>
      <h1 className="mt-4 text-4xl font-bold tracking-tight">My listings</h1>
      <div className="mt-8">
        {listings?.length ? (
          <ul className="divide-y divide-line rounded-2xl border border-line">
            {listings.map((l) => {
              const cover = [...l.listing_photos].sort((a, b) => a.sort_order - b.sort_order)[0]?.url;
              return (
                <li key={l.id}>
                  <Link href={`/dashboard/listing/${l.id}`} className="flex items-center gap-4 p-4 hover:bg-surface">
                    <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded-lg bg-surface">
                      {cover && <Image src={cover} alt="" fill sizes="96px" className="object-cover" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{l.street}</p>
                      <p className="text-[14px] text-muted">
                        {locationLine(market, l.zip, l.city)} · {formatPrice(l.price)}
                      </p>
                    </div>
                    <span className="shrink-0 text-[14px] font-medium">{statusLabels[l.status]}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState title="You haven't listed a home yet" actions={<ButtonLink href="/sell">List your home</ButtonLink>}>
            It&apos;s free, and buyers contact you directly.
          </EmptyState>
        )}
      </div>
    </Container>
  );
}
