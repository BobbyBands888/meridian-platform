import type { Metadata } from "next";
import Link from "next/link";
import { Container, EmptyState } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { categoryByValue } from "@/lib/vendors";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false },
};

const dateFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" });

export default async function AdminPage() {
  await requireAdmin("/admin");
  const admin = createAdminClient();
  const [{ data: pendingVendors }, { data: pendingEdits }] = await Promise.all([
    admin.from("vendors").select("id, business_name, category, created_at").eq("status", "pending").order("created_at"),
    admin.from("vendor_pending_edits").select("vendor_id, submitted_at, business_name, vendors!inner(category)").order("submitted_at"),
  ]);

  return (
    <Container className="py-12 sm:py-16">
      <h1 className="text-4xl font-bold tracking-tight">Admin</h1>

      <section aria-labelledby="pending-vendors" className="mt-10">
        <h2 id="pending-vendors" className="text-2xl font-semibold tracking-tight">
          Pending vendors <span className="text-muted">({pendingVendors?.length ?? 0})</span>
        </h2>
        <div className="mt-4">
          {pendingVendors?.length ? (
            <ul className="divide-y divide-line rounded-2xl border border-line">
              {pendingVendors.map((v) => (
                <li key={v.id}>
                  <Link href={`/admin/vendors/${v.id}`} className="flex flex-col gap-1 px-5 py-4 hover:bg-surface sm:flex-row sm:items-center sm:justify-between">
                    <span className="font-medium">{v.business_name}</span>
                    <span className="text-[14px] text-muted">
                      {categoryByValue(v.category).singular} · {dateFmt.format(new Date(v.created_at))}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="No vendors waiting for approval" />
          )}
        </div>
      </section>

      <section aria-labelledby="pending-edits" className="mt-12">
        <h2 id="pending-edits" className="text-2xl font-semibold tracking-tight">
          Vendor edits to review <span className="text-muted">({pendingEdits?.length ?? 0})</span>
        </h2>
        <div className="mt-4">
          {pendingEdits?.length ? (
            <ul className="divide-y divide-line rounded-2xl border border-line">
              {pendingEdits.map((e) => (
                <li key={e.vendor_id}>
                  <Link href={`/admin/vendors/${e.vendor_id}`} className="flex flex-col gap-1 px-5 py-4 hover:bg-surface sm:flex-row sm:items-center sm:justify-between">
                    <span className="font-medium">{e.business_name}</span>
                    <span className="text-[14px] text-muted">
                      {categoryByValue(e.vendors.category).singular} · {dateFmt.format(new Date(e.submitted_at))}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="No edits waiting for review" />
          )}
        </div>
      </section>
    </Container>
  );
}
