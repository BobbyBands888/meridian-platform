"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useActionState, useCallback, useEffect, useRef, useState } from "react";
import { Turnstile, type TurnstileHandle } from "@/components/turnstile";
import { Button } from "@/components/ui";
import { trackFunnel } from "@/lib/funnel";
import { startDraft, type ContactFormState } from "./draft-actions";

const inputClass =
  "mt-2 min-h-12 w-full rounded-lg border border-ink/20 px-4 text-base focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/20 aria-[invalid]:border-red-600";

/**
 * The first step of /sell for someone who isn't signed in: name, email, and optional phone. Saving it creates the
 * draft (and its cookie), then the page re-renders with the listing form.
 */
export function ContactStep({ source }: { source: string | null }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<ContactFormState, FormData>(startDraft, {});
  const [armed, setArmed] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const token = useRef("");
  const queued = useRef<FormData | null>(null);
  const turnstile = useRef<TurnstileHandle>(null);
  const started = useRef(false);
  const errors = state.errors ?? {};
  const values = state.values;

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

  useEffect(() => {
    if (state.status === "error") turnstile.current?.reset();
    if (state.status === "saved") {
      trackFunnel("contact_saved", source);
      router.refresh();
    }
  }, [state, source, router]);

  function hold(formData: FormData) {
    queued.current = formData;
    setArmed(true);
    setWaiting(true);
  }

  return (
    <form
      noValidate
      key={values ? JSON.stringify(values) : "initial"}
      onFocus={() => {
        setArmed(true);
        if (!started.current) {
          started.current = true;
          trackFunnel("form_start", source);
        }
      }}
      onSubmit={(e) => {
        if (!token.current) {
          e.preventDefault();
          hold(new FormData(e.currentTarget));
        }
      }}
      action={(formData) => {
        if (!token.current) return hold(formData);
        formData.set("turnstile_token", token.current);
        token.current = "";
        formAction(formData);
      }}
      className="space-y-5 rounded-2xl border border-line p-6"
    >
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Your contact details</h2>
        <p className="mt-1 text-[15px] leading-relaxed text-muted">Why we ask: to save your listing and send you buyer messages.</p>
      </div>
      {source && <input type="hidden" name="source" value={source} />}

      <Field id="full_name" label="Name" error={errors.full_name}>
        <input id="full_name" name="full_name" type="text" autoComplete="name" required maxLength={120} defaultValue={values?.full_name} className={inputClass} aria-invalid={Boolean(errors.full_name) || undefined} />
      </Field>
      <Field id="email" label="Email" error={errors.email}>
        <input id="email" name="email" type="email" inputMode="email" autoComplete="email" required maxLength={254} defaultValue={values?.email} className={inputClass} aria-invalid={Boolean(errors.email) || undefined} />
      </Field>
      <Field id="phone" label="Phone (optional)" error={errors.phone}>
        <input id="phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" defaultValue={values?.phone} className={inputClass} aria-invalid={Boolean(errors.phone) || undefined} />
      </Field>

      {armed && <Turnstile ref={turnstile} onToken={onToken} action="listing-draft-start" />}
      <Button type="submit" pending={pending || waiting} pendingLabel="Saving" className="w-full sm:w-auto">
        Continue
      </Button>
      <p role="status" aria-live="polite" className="text-[15px] text-red-700">
        {state.status === "error" && state.message && !state.errors ? state.message : null}
      </p>
      <p className="text-[15px] text-muted">
        Already have an account?{" "}
        <Link href="/sign-in?next=/sell" className="font-medium text-forest underline underline-offset-2">
          Sign in
        </Link>
      </p>
    </form>
  );
}

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
