"use client";

import { useActionState, useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Check } from "@/components/photo-card";
import { Turnstile, type TurnstileHandle } from "@/components/turnstile";
import { Button } from "@/components/ui";
import { financingOptions, INTEREST_DISCLAIMER } from "@/lib/interest";
import { sendInterest, type InterestState } from "@/app/_actions/interest";

type Props = {
  listingId: string;
  brand: string;
  /** Earliest and latest target closing date, worked out on the server so render stays pure. */
  closeRange: { min: string; max: string };
  /** Lender cards from the directory, rendered on the confirmation when the buyer isn't pre-approved yet. */
  lenderCards?: ReactNode;
};

export function InterestForm({ listingId, brand, closeRange, lenderCards }: Props) {
  const [state, formAction, pending] = useActionState<InterestState, FormData>(sendInterest, {});
  const [token, setToken] = useState("");
  const turnstile = useRef<TurnstileHandle>(null);
  const onToken = useCallback((t: string) => setToken(t), []);
  const id = useId();
  const errors = state.errors ?? {};
  const values = state.values;
  // Pre-approval only applies to a buyer who is borrowing, so the question follows the financing choice.
  const [financing, setFinancing] = useState(values?.financing ?? "");

  // Turnstile tokens are single-use: get a fresh one after every failed attempt.
  useEffect(() => {
    if (state.status === "error") turnstile.current?.reset();
  }, [state]);

  if (state.status === "sent") {
    return (
      <div role="status">
        <div className="rounded-2xl border border-line p-6">
          <Check label="Interest sent" />
          <p className="mt-2 text-[15px] leading-relaxed text-muted">{state.message}</p>
          <p className="mt-3 text-[14px] leading-relaxed text-muted">{INTEREST_DISCLAIMER}</p>
        </div>
        {state.showLenders && lenderCards && (
          <div className="mt-6">
            <h3 className="text-lg font-semibold tracking-tight">Get pre-approved next</h3>
            <p className="mt-1 text-[15px] leading-relaxed text-muted">
              Sellers take a pre-approved buyer more seriously. These lenders are in the {brand} directory, and you
              contact them directly.
            </p>
            <div className="mt-4">{lenderCards}</div>
          </div>
        )}
      </div>
    );
  }

  return (
    <form action={formAction} noValidate className="space-y-5" key={values ? JSON.stringify(values) : "initial"}>
      <input type="hidden" name="listing_id" value={listingId} />
      <input type="hidden" name="turnstile_token" value={token} />

      <p className="rounded-xl border border-forest/20 bg-forest/[0.04] px-4 py-3 text-[15px] font-medium leading-relaxed">
        {INTEREST_DISCLAIMER}
      </p>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field id={`${id}-name`} label="Your name" error={errors.name}>
          <input id={`${id}-name`} name="name" type="text" autoComplete="name" required maxLength={120} defaultValue={values?.name} className={inputClass} aria-invalid={Boolean(errors.name) || undefined} />
        </Field>
        <Field id={`${id}-email`} label="Email" error={errors.email}>
          <input id={`${id}-email`} name="email" type="email" autoComplete="email" inputMode="email" required defaultValue={values?.email} className={inputClass} aria-invalid={Boolean(errors.email) || undefined} />
        </Field>
      </div>

      <Field id={`${id}-phone`} label="Phone (optional)" error={errors.phone}>
        <input id={`${id}-phone`} name="phone" type="tel" autoComplete="tel-national" inputMode="tel" defaultValue={values?.phone} className={inputClass} aria-invalid={Boolean(errors.phone) || undefined} />
      </Field>

      <Field id={`${id}-offer`} label="Amount you'd offer" error={errors.offer_amount}>
        <div className="relative">
          <span className="pointer-events-none absolute left-4 top-1/2 mt-1 -translate-y-1/2 text-muted" aria-hidden="true">
            $
          </span>
          <input
            id={`${id}-offer`}
            name="offer_amount"
            type="text"
            inputMode="numeric"
            required
            defaultValue={values?.offer_amount}
            className={`${inputClass} pl-8`}
            aria-invalid={Boolean(errors.offer_amount) || undefined}
          />
        </div>
      </Field>

      <Field id={`${id}-financing`} label="How you'd pay" error={errors.financing}>
        <select
          id={`${id}-financing`}
          name="financing"
          required
          value={financing}
          onChange={(e) => setFinancing(e.target.value)}
          className={`${inputClass} bg-white`}
          aria-invalid={Boolean(errors.financing) || undefined}
        >
          <option value="" disabled>
            Choose one
          </option>
          {financingOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </Field>

      {financing === "cash" ? (
        <input type="hidden" name="pre_approved" value="no" />
      ) : (
      <fieldset>
        <legend className="text-[15px] font-medium">Pre-approved with a lender?</legend>
        <div className="mt-2 grid grid-cols-2 gap-3">
          {[
            { value: "yes", label: "Yes" },
            { value: "no", label: "Not yet" },
          ].map((option) => (
            <label key={option.value} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-line px-4 text-[15px] has-[:checked]:border-forest has-[:checked]:bg-forest/[0.04]">
              <input
                type="radio"
                name="pre_approved"
                value={option.value}
                defaultChecked={values?.pre_approved === option.value}
                className="h-4 w-4 accent-[#1f4d3a]"
                aria-describedby={errors.pre_approved ? `${id}-pre-approved-error` : undefined}
              />
              {option.label}
            </label>
          ))}
        </div>
        {errors.pre_approved && (
          <p id={`${id}-pre-approved-error`} className="mt-1.5 text-[14px] text-red-700">
            {errors.pre_approved}
          </p>
        )}
      </fieldset>
      )}

      <Field id={`${id}-close`} label="Target closing date" error={errors.target_close}>
        <input
          id={`${id}-close`}
          name="target_close"
          type="date"
          required
          min={closeRange.min}
          max={closeRange.max}
          defaultValue={values?.target_close}
          className={inputClass}
          aria-invalid={Boolean(errors.target_close) || undefined}
        />
      </Field>

      <Field id={`${id}-message`} label="Anything the seller should know (optional)" error={errors.message}>
        <textarea id={`${id}-message`} name="message" rows={4} maxLength={5000} defaultValue={values?.message} className={`${inputClass} py-3`} aria-invalid={Boolean(errors.message) || undefined} />
      </Field>

      <div>
        <label className="flex cursor-pointer items-start gap-3 text-[15px]">
          <input type="checkbox" name="consent" required className="mt-0.5 h-5 w-5 shrink-0 accent-[#1f4d3a]" aria-invalid={Boolean(errors.consent) || undefined} aria-describedby={errors.consent ? `${id}-consent-error` : undefined} />
          <span>I agree to be contacted about this home</span>
        </label>
        {errors.consent && (
          <p id={`${id}-consent-error`} className="mt-1.5 text-[14px] text-red-700">
            {errors.consent}
          </p>
        )}
      </div>

      <Turnstile ref={turnstile} onToken={onToken} action="listing-interest" />

      <div className="space-y-3">
        <Button type="submit" pending={pending || !token} pendingLabel={pending ? "Sending" : "Loading"} className="sm:w-full">
          Send to the seller
        </Button>
        <p className="text-[13px] leading-relaxed text-muted">
          Your details go to the owner, with a copy to the {brand} team. We never show contact information publicly.
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

function Field({ id, label, error, children }: { id: string; label: string; error?: string; children: ReactNode }) {
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
