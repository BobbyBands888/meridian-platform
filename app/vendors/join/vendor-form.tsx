"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { HeadshotUpload } from "@/components/headshot-upload";
import { Button } from "@/components/ui";
import { vendorCategories } from "@/lib/site";
import { BIO_MAX } from "@/lib/vendors";
import type { VendorFormState, VendorFormValues } from "./actions";

export const certifications = [
  { name: "licensed", label: "I am a licensed professional in my field" },
  { name: "insured", label: "I carry appropriate liability insurance" },
  { name: "understands_connector", label: "I understand Nashville Buys is a marketplace connector, not a broker" },
  { name: "handles_own_agreements", label: "I handle my own client agreements" },
  { name: "read_terms", label: "I have read the Legal Terms" },
] as const;

type Props = {
  mode: "join" | "edit";
  userId: string;
  action: (state: VendorFormState, formData: FormData) => Promise<VendorFormState>;
  initial: VendorFormValues;
  submitLabel: string;
};

export function VendorForm({ mode, userId, action, initial, submitLabel }: Props) {
  const [state, formAction, pending] = useActionState<VendorFormState, FormData>(action, {});
  const values = state.values ?? initial;
  const errors = state.errors ?? {};
  const [bioLength, setBioLength] = useState(values.bio.length);

  return (
    <form key={state.submittedAt ?? "initial"} action={formAction} noValidate className="space-y-7">
      <Field id="business_name" label="Business name" error={errors.business_name}>
        <input id="business_name" name="business_name" type="text" required maxLength={120} autoComplete="organization" defaultValue={values.business_name} className={inputClass} aria-invalid={Boolean(errors.business_name) || undefined} />
      </Field>

      <Field id="category" label="Category" error={errors.category}>
        <select id="category" name="category" required defaultValue={values.category} className={`${inputClass} bg-white`} aria-invalid={Boolean(errors.category) || undefined}>
          <option value="" disabled>
            Choose one
          </option>
          {vendorCategories.map((c) => (
            <option key={c.value} value={c.value}>
              {c.singular}
            </option>
          ))}
        </select>
      </Field>

      <HeadshotUpload userId={userId} name="headshot_url" initialUrl={values.headshot_url} error={errors.headshot_url} />

      <Field id="bio" label="Bio" hint="At least two sentences about what you do and who you help." error={errors.bio}>
        <textarea
          id="bio"
          name="bio"
          required
          rows={5}
          maxLength={BIO_MAX}
          defaultValue={values.bio}
          onChange={(e) => setBioLength(e.target.value.length)}
          className={`${inputClass} py-3`}
          aria-invalid={Boolean(errors.bio) || undefined}
        />
        <p className={`mt-1 text-right text-[13px] ${bioLength > BIO_MAX - 20 ? "text-ink" : "text-muted"}`} aria-live="polite">
          {bioLength}/{BIO_MAX}
        </p>
      </Field>

      <Field id="service_area" label="Service area" hint="For example: Davidson and Williamson counties" error={errors.service_area}>
        <input id="service_area" name="service_area" type="text" required maxLength={160} defaultValue={values.service_area} className={inputClass} aria-invalid={Boolean(errors.service_area) || undefined} />
      </Field>

      <Field id="price_range" label="Starting price range" hint="How you charge, as buyers and sellers will see it." error={errors.price_range}>
        <input id="price_range" name="price_range" type="text" required maxLength={80} defaultValue={values.price_range} className={inputClass} aria-invalid={Boolean(errors.price_range) || undefined} />
      </Field>

      <Field id="website" label="Website (optional)" error={errors.website}>
        <input id="website" name="website" type="url" inputMode="url" autoComplete="url" placeholder="yourbusiness.com" defaultValue={values.website} className={inputClass} aria-invalid={Boolean(errors.website) || undefined} />
      </Field>

      {mode === "join" && (
        <fieldset>
          <legend className="text-[15px] font-medium">Certifications</legend>
          <p className="mt-1 text-[13px] text-muted">All five are required.</p>
          <div className="mt-3 space-y-2">
            {certifications.map((c) => (
              <label key={c.name} className="flex cursor-pointer items-start gap-3 rounded-xl border border-line p-4 text-[15px] has-[:checked]:border-forest">
                <input type="checkbox" name={c.name} required defaultChecked={values.certifications.includes(c.name)} className="mt-0.5 h-5 w-5 shrink-0 accent-[#1f4d3a]" />
                <span>
                  {c.name === "read_terms" ? (
                    <>
                      I have read the{" "}
                      <Link href="/legal" target="_blank" className="font-medium text-forest underline underline-offset-2">
                        Legal Terms
                      </Link>
                    </>
                  ) : (
                    c.label
                  )}
                </span>
              </label>
            ))}
          </div>
          {errors.certifications && <p className="mt-2 text-[14px] text-red-700">{errors.certifications}</p>}
        </fieldset>
      )}

      <div className="space-y-3">
        <Button type="submit" pending={pending} pendingLabel={mode === "join" ? "Submitting" : "Saving"} className="sm:w-full">
          {submitLabel}
        </Button>
        <p role="status" aria-live="polite" className="text-[15px] text-red-700">
          {state.status === "error" ? state.message : null}
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
