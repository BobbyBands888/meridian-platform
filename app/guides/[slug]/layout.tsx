import { notFound } from "next/navigation";
import { getGuide } from "@/lib/guides";

// Checked in the layout so unknown guides return a real 404 status.
export default async function GuideLayout({ children, params }: LayoutProps<"/guides/[slug]">) {
  if (!(await getGuide((await params).slug))) notFound();
  return children;
}
