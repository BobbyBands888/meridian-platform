"use client";

import { useActionState, useId, useState } from "react";
import { Check } from "@/components/photo-card";
import { Button, Spinner } from "@/components/ui";
import { prepareImage } from "@/lib/image";
import { createClient } from "@/lib/supabase/client";
import { COI_BUCKET, COI_MAX_BYTES } from "@/lib/verification";
import { submitVerification, type VerificationFormState } from "./verification-actions";

type Props = {
  userId: string;
  categoryLabel: string;
  licenseRequired: boolean;
  submission: { license_number: string | null; coi_file_name: string | null; submitted_at: string | null; verified_at: string | null } | null;
  /** Server-formatted dates, so the client doesn't need to know the time zone. */
  submittedLabel: string | null;
  badgeText: string | null;
};

type Upload = { kind: "idle" } | { kind: "working"; label: string } | { kind: "done"; path: string; name: string } | { kind: "error"; message: string };

export function VerificationCard({ userId, categoryLabel, licenseRequired, submission, submittedLabel, badgeText }: Props) {
  const [state, formAction, pending] = useActionState<VerificationFormState, FormData>(submitVerification, {});
  const [upload, setUpload] = useState<Upload>({ kind: "idle" });
  const [editing, setEditing] = useState(!submission?.submitted_at);
  const fileId = useId();
  const errors = state.errors ?? {};

  async function onFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      let body: Blob = file;
      let ext = file.name.split(".").pop()?.toLowerCase() ?? "";
      if (file.type === "application/pdf" || ext === "pdf") {
        ext = "pdf";
      } else {
        // Photos of a certificate: convert HEIC and keep enough resolution to read the fine print.
        setUpload({ kind: "working", label: "Preparing" });
        body = await prepareImage(file, { maxDimension: 3200, maxBytes: 4_000_000 });
        ext = "jpg";
      }
      if (body.size > COI_MAX_BYTES) throw new Error("That file is over 10 MB. Try a smaller PDF or photo.");

      setUpload({ kind: "working", label: "Uploading" });
      const path = `${userId}/coi-${crypto.randomUUID()}.${ext}`;
      const { error } = await createClient()
        .storage.from(COI_BUCKET)
        .upload(path, body, { contentType: ext === "pdf" ? "application/pdf" : "image/jpeg", upsert: false });
      if (error) throw new Error("Upload failed. Check your connection and try again.");
      setUpload({ kind: "done", path, name: file.name });
    } catch (e) {
      setUpload({ kind: "error", message: e instanceof Error ? e.message : "Couldn't upload that file." });
    }
  }

  const verified = Boolean(submission?.verified_at);
  const inReview = Boolean(submission?.submitted_at) && !verified;

  return (
    <section id="verification" aria-labelledby="verification-heading" className="scroll-mt-24 rounded-2xl border border-line p-6">
      <h2 id="verification-heading" className="text-xl font-semibold tracking-tight">
        {verified ? "Verified" : "Get the Verified badge"}
      </h2>

      {verified && badgeText ? (
        <div className="mt-3 space-y-2">
          <Check label={badgeText} />
          <p className="text-[14px] leading-relaxed text-muted">
            You&apos;re listed first in {categoryLabel}. When your insurance renews, upload the new certificate so we can review it
            again.
          </p>
        </div>
      ) : (
        <p className="mt-2 text-[15px] leading-relaxed text-muted">
          Optional. Send us your {licenseRequired ? "license number and " : ""}certificate of insurance. After we review them, your
          profile shows &ldquo;License and insurance documents reviewed by Nashville Buys&rdquo; with the review date, and you&apos;re
          listed first in {categoryLabel}. Your documents stay private; only the Nashville Buys team can see them.
        </p>
      )}

      {inReview && !editing && state.status !== "submitted" && (
        <p className="mt-4 rounded-xl bg-surface px-4 py-3 text-[15px]">
          <span className="font-medium">In review.</span> Submitted {submittedLabel}
          {submission?.coi_file_name ? ` (${submission.coi_file_name})` : ""}. We&apos;ll email you when your badge is live.
        </p>
      )}

      {state.status === "submitted" ? (
        <p role="status" className="mt-4 rounded-xl border border-forest/20 bg-forest/[0.04] px-4 py-3 text-[15px]">
          {state.message}
        </p>
      ) : editing ? (
        <form action={formAction} noValidate className="mt-5 space-y-5">
          <input type="hidden" name="coi_path" value={upload.kind === "done" ? upload.path : ""} />
          <input type="hidden" name="coi_file_name" value={upload.kind === "done" ? upload.name : ""} />

          <div>
            <label htmlFor="license_number" className="block text-[15px] font-medium">
              License number{licenseRequired ? "" : " (optional)"}
            </label>
            {licenseRequired && <p className="mt-1 text-[13px] text-muted">Required for {categoryLabel.toLowerCase()}.</p>}
            <input
              id="license_number"
              name="license_number"
              type="text"
              maxLength={80}
              autoComplete="off"
              defaultValue={state.licenseNumber ?? submission?.license_number ?? ""}
              aria-invalid={Boolean(errors.license_number) || undefined}
              className="mt-2 min-h-12 w-full rounded-lg border border-ink/20 px-4 text-base focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/20 aria-[invalid]:border-red-600"
            />
            {errors.license_number && <p className="mt-1.5 text-[14px] text-red-700">{errors.license_number}</p>}
          </div>

          <div>
            <span className="block text-[15px] font-medium">Certificate of insurance</span>
            <p className="mt-1 text-[13px] text-muted">PDF or a clear photo, up to 10 MB. Kept private.</p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <label
                htmlFor={fileId}
                className={`inline-flex min-h-12 cursor-pointer items-center gap-2 rounded-lg border border-ink/15 px-5 text-[15px] font-semibold hover:border-forest hover:text-forest ${upload.kind === "working" ? "pointer-events-none opacity-60" : ""}`}
              >
                {upload.kind === "working" && <Spinner />}
                {upload.kind === "working" ? upload.label : upload.kind === "done" ? "Replace file" : "Choose file"}
              </label>
              <input id={fileId} type="file" accept="application/pdf,image/*,.heic,.heif" className="sr-only" onChange={onFile} disabled={upload.kind === "working"} />
              {upload.kind === "done" && <Check label={upload.name} />}
            </div>
            {(upload.kind === "error" || errors.coi) && (
              <p className="mt-1.5 text-[14px] text-red-700">{upload.kind === "error" ? upload.message : errors.coi}</p>
            )}
          </div>

          <div className="space-y-3">
            <Button type="submit" variant="forest" pending={pending || upload.kind === "working"} pendingLabel={pending ? "Submitting" : "Uploading"}>
              {submission?.submitted_at ? "Submit updated documents" : "Submit for review"}
            </Button>
            <p role="status" aria-live="polite" className="text-[15px] text-red-700">
              {state.status === "error" ? state.message : null}
            </p>
          </div>
        </form>
      ) : (
        <button type="button" onClick={() => setEditing(true)} className="mt-4 text-[15px] font-medium text-forest underline underline-offset-2">
          {verified ? "Upload renewed documents" : "Replace documents"}
        </button>
      )}
    </section>
  );
}
