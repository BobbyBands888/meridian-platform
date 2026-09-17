"use client";

import { startTransition, useActionState, useCallback, useEffect, useId, useRef, useState } from "react";
import { subscribeToListingAlerts, type AlertSignupState } from "@/app/_actions/listing-alerts";
import { Check } from "@/components/photo-card";
import { Turnstile, type TurnstileHandle } from "@/components/turnstile";
import { Button } from "@/components/ui";
import { useZipCheck, ZipFeedback } from "@/components/zip-field";
import type { ZipDirectory } from "@/lib/areas";
import type { PageSource } from "@/lib/attribution";

type Props = {
  /** The market's ZIP codes, so a typed ZIP gets its town and county (or a "not yet" note) right away. */
  zipDirectory: ZipDirectory;
  defaultZip?: string;
  submitLabel?: string;
  /** Page source stored with the signup, for buyer pages. */
  source?: PageSource;
};

/**
 * Email + optional ZIP signup for new-listing alerts. Turnstile's script loads only once someone starts using the
 * form, so pages that show it (like the home page) don't pay for it on every visit.
 */
export function ListingAlertsForm({ zipDirectory, defaultZip = "", submitLabel = "Get listing alerts", source }: Props) {
  const [state, formAction, pending] = useActionState<AlertSignupState, FormData>(subscribeToListingAlerts, {});
  const [armed, setArmed] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const token = useRef("");
  // A submit that arrived before Turnstile had a token, held until one does.
  const queued = useRef<FormData | null>(null);
  const turnstile = useRef<TurnstileHandle>(null);
  const id = useId();
  const errors = state.errors ?? {};
  const values = state.values;
  const zipCheck = useZipCheck(zipDirectory, defaultZip);
  // A server error about the ZIP applies only until the ZIP is changed.
  const zipError = errors.zip && zipCheck.zip === values?.zip ? errors.zip : undefined;

  const onToken = useCallback(
    (t: string) => {
      token.current = t;
      const held = queued.current;
      if (t && held) {
        queued.current = null;
        token.current = "";
        held.set("turnstile_token", t);
        setWaiting(false);
        startTransition(() => formAction(held));
      }
    },
    [formAction],
  );

  function hold(formData: FormData) {
    queued.current = formData;
    setArmed(true);
    setWaiting(true);
  }

  // Turnstile tokens are single-use: get a fresh one after every failed attempt.
  useEffect(() => {
    if (state.status === "error") turnstile.current?.reset();
  }, [state]);

  if (state.status === "subscribed") {
    return (
      <div role="status" className="rounded-xl border border-forest/20 bg-white p-5">
        <Check label="You're signed up" />
        <p className="mt-2 break-words text-[15px] leading-relaxed text-muted">{state.message}</p>
      </div>
    );
  }

  return (
    <form
      ref={form}
      noValidate
      key={values ? JSON.stringify(values) : "initial"}
      onFocus={() => setArmed(true)}
      onPointerDown={() => setArmed(true)}
      onSubmit={(e) => {
        // Submitted before Turnstile finished: keep what was entered and send it as soon as the token arrives.
        // Holding it here, rather than in the action, keeps React from clearing the fields while we wait.
        if (!token.current) {
          e.preventDefault();
          hold(new FormData(e.currentTarget));
        }
      }}
      action={(formData) => {
        // A submit made before the page hydrated is replayed straight into the action, skipping onSubmit.
        if (!token.current) return hold(formData);
        formData.set("turnstile_token", token.current);
        token.current = "";
        formAction(formData);
      }}
    >
      {source && <input type="hidden" name="page_source" value={source} />}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="min-w-0 flex-1">
          <label htmlFor={`${id}-email`} className="sr-only">
            Email
          </label>
          <input
            id={`${id}-email`}
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder="Email address"
            required
            maxLength={254}
            defaultValue={values?.email}
            aria-invalid={Boolean(errors.email) || undefined}
            aria-describedby={errors.email ? `${id}-email-error` : undefined}
            className={inputClass}
          />
          {errors.email && (
            <p id={`${id}-email-error`} className="mt-1.5 text-[14px] text-red-700">
              {errors.email}
            </p>
          )}
        </div>
        <div className="sm:w-40">
          <label htmlFor={`${id}-zip`} className="sr-only">
            ZIP code (optional)
          </label>
          <input
            id={`${id}-zip`}
            name="zip"
            placeholder="ZIP (optional)"
            {...zipCheck.input}
            aria-invalid={zipCheck.status === "invalid" || Boolean(zipError) || undefined}
            aria-describedby={`${id}-zip-feedback`}
            className={inputClass}
          />
          {zipError && (
            <p className="mt-1.5 text-[14px] text-red-700">
              {zipError}
            </p>
          )}
        </div>
        <Button type="submit" pending={pending || waiting} pendingLabel={pending ? "Signing up" : "One moment"} disabled={zipCheck.status === "unserved"} className="shrink-0">
          {submitLabel}
        </Button>
      </div>
      <ZipFeedback id={`${id}-zip-feedback`} check={zipCheck} source="listing-alerts" />
      {armed && <Turnstile ref={turnstile} onToken={onToken} action="listing-alerts" />}
      <p className="mt-3 text-[13px] leading-relaxed text-muted">Free. Unsubscribe anytime.</p>
      <p role="status" aria-live="polite" className="text-[15px] text-red-700">
        {state.status === "error" && !state.errors ? state.message : null}
      </p>
    </form>
  );
}

const inputClass =
  "min-h-12 w-full rounded-lg border border-ink/20 bg-white px-4 text-base placeholder:text-muted focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/20 aria-[invalid]:border-red-600";
