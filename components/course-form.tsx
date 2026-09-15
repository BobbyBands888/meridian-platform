"use client";

import { startTransition, useActionState, useCallback, useEffect, useId, useRef, useState } from "react";
import { subscribeToCourse, type CourseSignupState } from "@/app/_actions/course";
import { Check } from "@/components/photo-card";
import { Turnstile, type TurnstileHandle } from "@/components/turnstile";
import { Button } from "@/components/ui";

type Props = { source: string; submitLabel?: string };

/**
 * Email signup for the seven-day seller course. Like the alerts form, Turnstile loads only once someone starts
 * using it, and a submit made before the token arrives is held rather than dropped.
 */
export function CourseForm({ source, submitLabel = "Send me the course" }: Props) {
  const [state, formAction, pending] = useActionState<CourseSignupState, FormData>(subscribeToCourse, {});
  const [armed, setArmed] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const token = useRef("");
  const queued = useRef<FormData | null>(null);
  const turnstile = useRef<TurnstileHandle>(null);
  const id = useId();
  const errors = state.errors ?? {};

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
      noValidate
      key={state.values ? JSON.stringify(state.values) : "initial"}
      onFocus={() => setArmed(true)}
      onPointerDown={() => setArmed(true)}
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
    >
      <input type="hidden" name="source" value={source} />
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
            defaultValue={state.values?.email}
            aria-invalid={Boolean(errors.email) || undefined}
            aria-describedby={errors.email ? `${id}-email-error` : undefined}
            className="min-h-12 w-full rounded-lg border border-ink/20 bg-white px-4 text-base placeholder:text-muted focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/20 aria-[invalid]:border-red-600"
          />
          {errors.email && (
            <p id={`${id}-email-error`} className="mt-1.5 text-[14px] text-red-700">
              {errors.email}
            </p>
          )}
        </div>
        <Button type="submit" pending={pending || waiting} pendingLabel={pending ? "Signing up" : "One moment"} className="shrink-0">
          {submitLabel}
        </Button>
      </div>
      {armed && <Turnstile ref={turnstile} onToken={onToken} action="seller-course" />}
      <p className="mt-3 text-[13px] leading-relaxed text-muted">Free. One email a day for a week, then we stop. Unsubscribe anytime.</p>
      <p role="status" aria-live="polite" className="text-[15px] text-red-700">
        {state.status === "error" && !state.errors ? state.message : null}
      </p>
    </form>
  );
}
