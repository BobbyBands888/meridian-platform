"use client";

import Link from "next/link";
import { useActionState, useCallback, useState } from "react";
import { PhotoUploader } from "@/components/photo-uploader";
import { Button } from "@/components/ui";
import type { ListingStatus } from "@/lib/database.types";
import { checkFairHousing, type FairHousingIssue } from "@/lib/fair-housing";
import { DESCRIPTION_MAX, DISCLOSURE_GUIDE_PATH, statusLabels } from "@/lib/listings";
import { zipGroups } from "@/lib/areas";
import type { ListingFormState, ListingFormValues } from "./actions";

type Props = {
  mode: "create" | "edit";
  userId: string;
  listingId?: string;
  action: (state: ListingFormState, formData: FormData) => Promise<ListingFormState>;
  initial: ListingFormValues;
  /** Statuses a seller can switch between; empty while the listing is in review. */
  statusOptions?: ListingStatus[];
  submitLabel: string;
};

export function ListingForm({ mode, userId, listingId, action, initial, statusOptions = [], submitLabel }: Props) {
  const [state, formAction, pending] = useActionState<ListingFormState, FormData>(action, {});
  const values = state.values ?? initial;
  const errors = state.errors ?? {};
  const [photosBusy, setPhotosBusy] = useState(false);
  const onBusyChange = useCallback((busy: boolean) => setPhotosBusy(busy), []);

  // Fair Housing issues from the last submit attempt, re-checked live as the seller edits.
  const [issues, setIssues] = useState<FairHousingIssue[] | null>(null);
  const shownIssues = issues ?? state.fairHousing ?? [];

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    const description = String(new FormData(event.currentTarget).get("description") ?? "");
    const found = checkFairHousing(description);
    setIssues(found);
    if (found.length > 0) {
      event.preventDefault();
      document.getElementById("description")?.focus();
    }
  }

  return (
    <form key={state.submittedAt ?? "initial"} action={formAction} onSubmit={onSubmit} noValidate className="space-y-8">
      {listingId && <input type="hidden" name="listing_id" value={listingId} />}

      {mode === "create" && (
        <fieldset className="space-y-5">
          <legend className="text-xl font-semibold tracking-tight">Address</legend>
          <Field id="street" label="Street address" error={errors.street}>
            <input id="street" name="street" type="text" required autoComplete="address-line1" placeholder="1234 Main St" defaultValue={values.street} className={inputClass} aria-invalid={Boolean(errors.street) || undefined} />
          </Field>
          <Field id="zip" label="ZIP code" error={errors.zip}>
            <select id="zip" name="zip" required defaultValue={values.zip} className={`${inputClass} bg-white`} aria-invalid={Boolean(errors.zip) || undefined}>
              <option value="" disabled>
                Choose a ZIP code
              </option>
              {zipGroups.map((group) => (
                <optgroup key={group.county} label={`${group.county} County`}>
                  {group.options.map((o) => (
                    <option key={o.zip} value={o.zip}>
                      {o.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </Field>
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line p-4 has-[:checked]:border-forest">
            <input type="checkbox" name="hide_exact_address" defaultChecked={values.hide_exact_address} className="mt-0.5 h-5 w-5 shrink-0 accent-[#1f4d3a]" />
            <span>
              <span className="block text-[15px] font-medium">Hide my exact address</span>
              <span className="block text-[13px] text-muted">Buyers see the neighborhood and ZIP. Share the street with people you choose.</span>
            </span>
          </label>
        </fieldset>
      )}

      <fieldset className="space-y-5">
        <legend className="text-xl font-semibold tracking-tight">Details</legend>
        <Field id="price" label="Asking price" error={errors.price}>
          <div className="relative">
            <span className="pointer-events-none absolute left-4 top-1/2 mt-1 -translate-y-1/2 text-muted" aria-hidden="true">
              $
            </span>
            <input id="price" name="price" type="text" inputMode="numeric" required defaultValue={values.price} className={`${inputClass} pl-8`} aria-invalid={Boolean(errors.price) || undefined} />
          </div>
        </Field>
        {mode === "create" && (
          <div className="grid grid-cols-3 gap-3">
            <Field id="beds" label="Beds" error={errors.beds}>
              <input id="beds" name="beds" type="number" inputMode="numeric" min={0} max={20} step={1} required defaultValue={values.beds} className={inputClass} aria-invalid={Boolean(errors.beds) || undefined} />
            </Field>
            <Field id="baths" label="Baths" error={errors.baths}>
              <input id="baths" name="baths" type="number" inputMode="decimal" min={0} max={20} step={0.5} required defaultValue={values.baths} className={inputClass} aria-invalid={Boolean(errors.baths) || undefined} />
            </Field>
            <Field id="sqft" label="Sq ft" error={errors.sqft}>
              <input id="sqft" name="sqft" type="text" inputMode="numeric" required defaultValue={values.sqft} className={inputClass} aria-invalid={Boolean(errors.sqft) || undefined} />
            </Field>
          </div>
        )}

        {statusOptions.length > 0 && (
          <fieldset>
            <legend className="text-[15px] font-medium">Status</legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              {statusOptions.map((s) => (
                <label key={s} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-line px-4 text-[15px] has-[:checked]:border-forest has-[:checked]:bg-forest/[0.04]">
                  <input type="radio" name="status" value={s} defaultChecked={values.status === s} className="h-4 w-4 accent-[#1f4d3a]" />
                  {statusLabels[s]}
                </label>
              ))}
            </div>
          </fieldset>
        )}
      </fieldset>

      <div>
        <p className="mb-4 rounded-xl bg-surface p-4 text-[15px] leading-relaxed">
          Tennessee requires sellers to provide buyers a Residential Property Condition Disclosure.{" "}
          <Link href={DISCLOSURE_GUIDE_PATH} target="_blank" className="font-medium text-forest underline underline-offset-2">
            Read our guide and download the state form.
          </Link>
        </p>
        <Field id="description" label="Description" hint="Describe the home and its features. We check for phrases that conflict with Fair Housing rules." error={errors.description}>
          <textarea
            id="description"
            name="description"
            rows={8}
            required
            maxLength={DESCRIPTION_MAX}
            defaultValue={values.description}
            onChange={(e) => {
              if (shownIssues.length > 0) setIssues(checkFairHousing(e.target.value));
            }}
            className={`${inputClass} py-3`}
            aria-invalid={Boolean(errors.description) || shownIssues.length > 0 || undefined}
            aria-describedby={shownIssues.length > 0 ? "fair-housing-issues" : undefined}
          />
        </Field>
        {shownIssues.length > 0 && (
          <div id="fair-housing-issues" role="alert" className="mt-3 rounded-xl border border-red-200 bg-red-50 p-4">
            <p className="text-[15px] font-semibold text-red-900">Edit these phrases to continue</p>
            <ul className="mt-2 space-y-2 text-[14px] leading-relaxed text-red-900">
              {shownIssues.map((issue) => (
                <li key={issue.phrase}>
                  <span className="font-semibold">&ldquo;{issue.phrase}&rdquo;</span>: {issue.explanation}
                  {issue.suggestion ? ` ${issue.suggestion}` : ""}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[13px] text-red-900/80">
              See our{" "}
              <Link href="/legal#fair-housing" target="_blank" className="underline">
                Fair Housing Policy
              </Link>
              .
            </p>
          </div>
        )}
      </div>

      <PhotoUploader userId={userId} name="photo_urls" initialUrls={values.photo_urls} error={errors.photos} onBusyChange={onBusyChange} />

      <div className="space-y-3">
        <Button
          type="submit"
          pending={pending || photosBusy}
          pendingLabel={pending ? (mode === "create" ? "Submitting" : "Saving") : "Waiting for photos"}
          disabled={shownIssues.length > 0}
          className="sm:w-full"
        >
          {submitLabel}
        </Button>
        <p role="status" aria-live="polite" className={`text-[15px] ${state.status === "saved" ? "text-forest" : "text-red-700"}`}>
          {state.message}
        </p>
      </div>
    </form>
  );
}

const inputClass =
  "mt-2 min-h-12 w-full rounded-lg border border-ink/20 px-4 text-base focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/20 aria-[invalid]:border-red-600";

function Field({ id, label, hint, error, children }: { id: string; label: string; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="block text-[15px] font-medium">
        {label}
      </label>
      {hint && <p className="mt-1 text-[13px] text-muted">{hint}</p>}
      {children}
      {error && <p className="mt-1.5 text-[14px] text-red-700">{error}</p>}
    </div>
  );
}
