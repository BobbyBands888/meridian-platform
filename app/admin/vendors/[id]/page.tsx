import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Check } from "@/components/photo-card";
import { ButtonLink, Container } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { formatUsPhone } from "@/lib/phone";
import { createAdminClient } from "@/lib/supabase/admin";
import { categoryByValue, vendorPath } from "@/lib/vendors";
import { approveVendor, approveVendorEdit, declineVendorEdit, rejectVendor } from "../../actions";
import { SubmitButton } from "../../submit-button";

export const metadata: Metadata = {
  title: "Review vendor",
  robots: { index: false },
};

const done: Record<string, string> = {
  approved: "Approved. The vendor was emailed and their profile is live.",
  rejected: "Rejected. The vendor was emailed.",
  "edit-approved": "Edit approved. The changes are live and the vendor was emailed.",
  "edit-declined": "Edit declined. The vendor was emailed and their current profile is unchanged.",
};

const certLabels = {
  licensed: "Licensed professional",
  insured: "Carries liability insurance",
  understands_connector: "Understands Nashville Buys is a connector, not a broker",
  handles_own_agreements: "Handles own client agreements",
  read_terms: "Read the Legal Terms",
} as const;

export default async function AdminVendorPage({ params, searchParams }: PageProps<"/admin/vendors/[id]">) {
  const { id } = await params;
  await requireAdmin(`/admin/vendors/${id}`);
  const notice = done[String((await searchParams).done ?? "")];

  const admin = createAdminClient();
  const { data: vendor } = await admin
    .from("vendors")
    .select("*, profiles!inner(email, phone, full_name), vendor_certifications(*), vendor_pending_edits(*)")
    .eq("id", id)
    .maybeSingle();
  if (!vendor) notFound();

  const cert = vendor.vendor_certifications;
  const pending = vendor.vendor_pending_edits;
  const category = categoryByValue(vendor.category);

  return (
    <Container className="py-12 sm:py-16">
      <Link href="/admin" className="text-[15px] font-medium text-forest hover:underline">
        ← Admin
      </Link>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[15px] text-muted">
            {category.singular} · status: <span className="font-medium text-ink">{vendor.status}</span>
          </p>
          <h1 className="mt-1 text-4xl font-bold tracking-tight">{vendor.business_name}</h1>
        </div>
        {vendor.status === "approved" && (
          <ButtonLink href={vendorPath(vendor)} variant="secondary">
            View public profile
          </ButtonLink>
        )}
      </div>

      {notice && (
        <p role="status" className="mt-6 rounded-xl border border-forest/20 bg-forest/[0.04] px-4 py-3 text-[15px]">
          {notice}
        </p>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="live-heading" className="rounded-2xl border border-line p-6">
          <h2 id="live-heading" className="text-lg font-semibold">
            {vendor.status === "approved" ? "Live version" : "Submitted profile"}
          </h2>
          <VendorDetails business_name={vendor.business_name} bio={vendor.bio} headshot_url={vendor.headshot_url} categoryLabel={category.singular} />
          <dl className="mt-4 space-y-2 border-t border-line pt-4 text-[15px]">
            <Row label="Service area" value={vendor.service_area} />
            <Row label="Price range" value={vendor.price_range} />
            <Row label="Website" value={vendor.website ?? "None"} />
            <Row label="Account" value={`${vendor.profiles.full_name ?? ""} · ${vendor.profiles.email} · ${formatUsPhone(vendor.profiles.phone)}`} />
          </dl>
        </section>

        {pending && (
          <section aria-labelledby="edit-heading" className="rounded-2xl border-2 border-forest/40 p-6">
            <h2 id="edit-heading" className="text-lg font-semibold">
              Proposed edit
            </h2>
            <p className="text-[14px] text-muted">Submitted {new Date(pending.submitted_at).toLocaleString("en-US", { timeZone: "America/Chicago" })}</p>
            <VendorDetails
              business_name={pending.business_name}
              bio={pending.bio}
              headshot_url={pending.headshot_url}
              categoryLabel={categoryByValue(pending.category).singular}
              changed={{
                business_name: pending.business_name !== vendor.business_name,
                bio: pending.bio !== vendor.bio,
                headshot_url: pending.headshot_url !== vendor.headshot_url,
                category: pending.category !== vendor.category,
              }}
            />
            <div className="mt-6 space-y-4 border-t border-line pt-5">
              <form action={approveVendorEdit}>
                <input type="hidden" name="vendor_id" value={vendor.id} />
                <SubmitButton pendingLabel="Approving">Approve edit</SubmitButton>
              </form>
              <form action={declineVendorEdit} className="space-y-3">
                <input type="hidden" name="vendor_id" value={vendor.id} />
                <NoteField id="decline-note" />
                <SubmitButton variant="secondary" pendingLabel="Declining">
                  Decline edit
                </SubmitButton>
              </form>
            </div>
          </section>
        )}

        <section aria-labelledby="cert-heading" className="rounded-2xl border border-line p-6">
          <h2 id="cert-heading" className="text-lg font-semibold">
            Certifications
          </h2>
          {cert ? (
            <>
              <ul className="mt-3 space-y-1.5">
                {(Object.keys(certLabels) as (keyof typeof certLabels)[]).map((key) => (
                  <li key={key}>{cert[key] ? <Check label={certLabels[key]} /> : <span className="text-red-700">Missing: {certLabels[key]}</span>}</li>
                ))}
              </ul>
              <p className="mt-3 text-[14px] text-muted">Certified {new Date(cert.certified_at).toLocaleString("en-US", { timeZone: "America/Chicago" })}</p>
            </>
          ) : (
            <p className="mt-3 text-red-700">No certification record.</p>
          )}
        </section>

        {vendor.status !== "approved" || !pending ? (
          <section aria-labelledby="decision-heading" className="rounded-2xl border border-line p-6">
            <h2 id="decision-heading" className="text-lg font-semibold">
              Decision
            </h2>
            <div className="mt-4 space-y-5">
              {vendor.status !== "approved" && (
                <form action={approveVendor}>
                  <input type="hidden" name="vendor_id" value={vendor.id} />
                  <SubmitButton pendingLabel="Approving">Approve vendor</SubmitButton>
                </form>
              )}
              {vendor.status !== "rejected" && (
                <form action={rejectVendor} className="space-y-3">
                  <input type="hidden" name="vendor_id" value={vendor.id} />
                  <NoteField id="reject-note" />
                  <SubmitButton variant="secondary" pendingLabel="Rejecting">
                    {vendor.status === "approved" ? "Remove from directory" : "Reject vendor"}
                  </SubmitButton>
                </form>
              )}
            </div>
          </section>
        ) : null}
      </div>
    </Container>
  );
}

function VendorDetails({
  business_name,
  bio,
  headshot_url,
  categoryLabel,
  changed,
}: {
  business_name: string;
  bio: string;
  headshot_url: string;
  categoryLabel: string;
  changed?: { business_name: boolean; bio: boolean; headshot_url: boolean; category: boolean };
}) {
  const mark = (on?: boolean) => (on ? <span className="ml-2 rounded bg-warm/20 px-1.5 py-0.5 text-[12px] font-medium">Changed</span> : null);
  return (
    <div className="mt-4 flex flex-col gap-4 sm:flex-row">
      <div>
        <div className="relative h-32 w-32 overflow-hidden rounded-xl bg-surface">
          <Image src={headshot_url} alt="Headshot" fill sizes="128px" className="object-cover object-top" />
        </div>
        {mark(changed?.headshot_url)}
      </div>
      <div className="min-w-0">
        <p className="text-[14px] font-medium text-forest">
          {categoryLabel}
          {mark(changed?.category)}
        </p>
        <p className="text-lg font-semibold">
          {business_name}
          {mark(changed?.business_name)}
        </p>
        <p className="mt-1 text-[15px] leading-relaxed">
          {bio}
          {mark(changed?.bio)}
        </p>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col sm:flex-row sm:gap-3">
      <dt className="shrink-0 text-muted sm:w-28">{label}</dt>
      <dd className="break-words">{value}</dd>
    </div>
  );
}

function NoteField({ id }: { id: string }) {
  return (
    <div>
      <label htmlFor={id} className="block text-[14px] font-medium">
        Note to vendor (optional)
      </label>
      <textarea id={id} name="note" rows={3} maxLength={2000} className="mt-1.5 w-full rounded-lg border border-ink/20 px-3 py-2 text-[15px] focus:border-forest focus:outline-none" />
    </div>
  );
}
