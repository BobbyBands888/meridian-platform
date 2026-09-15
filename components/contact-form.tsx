"use client";

import { useActionState, useCallback, useEffect, useRef, useState } from "react";
import { Check } from "@/components/photo-card";
import { Turnstile, type TurnstileHandle } from "@/components/turnstile";
import { Button } from "@/components/ui";
import { sendInquiry, type InquiryState } from "@/app/_actions/inquiry";

type Props = { type: "vendor" | "listing"; targetId: string; recipientLabel: string; brand: string };

export function ContactForm({ type, targetId, recipientLabel, brand }: Props) {
  const [state, formAction, pending] = useActionState<InquiryState, FormData>(sendInquiry, {});
  const [token, setToken] = useState("");
  const turnstile = useRef<TurnstileHandle>(null);
  const onToken = useCallback((t: string) => setToken(t), []);
  const errors = state.errors ?? {};
  const values = state.values;

  // Turnstile tokens are single-use: get a fresh one after every failed attempt.
  useEffect(() => {
    if (state.status === "error") turnstile.current?.reset();
  }, [state]);

  if (state.status === "sent") {
    return (
      <div role="status" className="rounded-2xl border border-line p-6">
        <Check label="Message sent" />
        <p className="mt-2 text-[15px] leading-relaxed text-muted">{state.message}</p>
      </div>
    );
  }

  return (
    <form action={formAction} noValidate className="space-y-5" key={values ? JSON.stringify(values) : "initial"}>
      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="target_id" value={targetId} />
      <input type="hidden" name="turnstile_token" value={token} />

      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="contact-name" label="Your name" error={errors.name}>
          <input id="contact-name" name="name" type="text" autoComplete="name" required maxLength={120} defaultValue={values?.name} className={inputClass} aria-invalid={Boolean(errors.name) || undefined} />
        </Field>
        <Field id="contact-email" label="Email" error={errors.email}>
          <input id="contact-email" name="email" type="email" autoComplete="email" inputMode="email" required defaultValue={values?.email} className={inputClass} aria-invalid={Boolean(errors.email) || undefined} />
        </Field>
      </div>
      <Field id="contact-phone" label="Phone (optional)" error={errors.phone}>
        <input id="contact-phone" name="phone" type="tel" autoComplete="tel-national" inputMode="tel" defaultValue={values?.phone} className={inputClass} aria-invalid={Boolean(errors.phone) || undefined} />
      </Field>
      <Field id="contact-message" label="Message" error={errors.message}>
        <textarea id="contact-message" name="message" rows={5} required maxLength={5000} defaultValue={values?.message} className={`${inputClass} py-3`} aria-invalid={Boolean(errors.message) || undefined} />
      </Field>

      <div>
        <label className="flex cursor-pointer items-start gap-3 text-[15px]">
          <input type="checkbox" name="consent" required className="mt-0.5 h-5 w-5 shrink-0 accent-[#1f4d3a]" aria-invalid={Boolean(errors.consent) || undefined} aria-describedby={errors.consent ? "contact-consent-error" : undefined} />
          <span>I agree to be contacted about this inquiry</span>
        </label>
        {errors.consent && (
          <p id="contact-consent-error" className="mt-1.5 text-[14px] text-red-700">
            {errors.consent}
          </p>
        )}
      </div>

      <Turnstile ref={turnstile} onToken={onToken} action={`${type}-inquiry`} />

      <div className="space-y-3">
        <Button type="submit" pending={pending || !token} pendingLabel={pending ? "Sending" : "Loading"} className="sm:w-full">
          Send message to {recipientLabel}
        </Button>
        <p className="text-[13px] leading-relaxed text-muted">
          Your message and contact details go to {recipientLabel}, with a copy to the {brand} team. We never show contact information publicly.
        </p>
        <p role="status" aria-live="polite" className="text-[15px] text-red-700">
          {state.status === "error" ? state.message : null}
        </p>
      </div>
    </form>
  );
}

const inputClass =
  "mt-2 min-h-12 w-full rounded-lg border border-ink/20 px-4 text-base focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/20 aria-[invalid]:border-red-600";

function Field({ id, label, error, children }: { id: string; label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="block text-[15px] font-medium">
        {label}
      </label>
      {children}
      {error && <p className="mt-1.5 text-[14px] text-red-700">{error}</p>}
    </div>
  );
}
