import { notFound } from "next/navigation";
import { getPublicListing } from "@/lib/public-listings";

// Checked in the layout so missing listings return a real 404 before the page's loading boundary streams.
export default async function ListingLayout({ children, params }: LayoutProps<"/homes/[slug]">) {
  if (!(await getPublicListing((await params).slug))) notFound();
  return children;
}
