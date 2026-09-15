import { notFound } from "next/navigation";
import { getGuide } from "@/lib/guides";

// Checked in the layout so unknown guides return a real 404 status.
export default async function GuideLayout({ children, params }: LayoutProps<"/[market]/guides/[slug]">) {
  const { market, slug } = await params;
  if (!(await getGuide(market, slug))) notFound();
  return children;
}
