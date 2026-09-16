"use client";

import { startTransition, useActionState, useCallback, useEffect, useId, useRef, useState } from "react";
import { joinAreaWaitlist, type AreaWaitlistState } from "@/app/_actions/area-waitlist";
import { Check } from "@/components/photo-card";
import { Turnstile, type TurnstileHandle } from "@/components/turnstile";
import { Button } from "@/components/ui";

type Props = { source: string; defaultEmail?: string };

/**
 * Email + ZIP for someone whose home is outside the market's ZIP codes. Like the alerts form, Turnstile loads only
 * once someone starts using it, and a submit made before the token arrives is held rather than dropped.
 */
export function AreaWaitlistForm({ source, defaultEmail = "" }: Props) {
  const [state, formAction, pending] = useActionState<AreaWaitlistState, FormData>(joinAreaWaitlist, {});
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

  if (state.status === "saved") {
    return (
      <div role="status" className="rounded-xl border border-forest/20 bg-white p-5">
        <Check label="You're on the list" />
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
            defaultValue={state.values?.email ?? defaultEmail}
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
        <div className="sm:w-36">
          <label htmlFor={`${id}-zip`} className="sr-only">
            ZIP code
          </label>
          <input
            id={`${id}-zip`}
            name="zip"
            type="text"
            inputMode="numeric"
            autoComplete="postal-code"
            placeholder="ZIP code"
            required
            maxLength={5}
            defaultValue={state.values?.zip}
            aria-invalid={Boolean(errors.zip) || undefined}
            aria-describedby={errors.zip ? `${id}-zip-error` : undefined}
            className={inputClass}
          />
          {errors.zip && (
            <p id={`${id}-zip-error`} className="mt-1.5 text-[14px] text-red-700">
              {errors.zip}
            </p>
          )}
        </div>
        <Button type="submit" pending={pending || waiting} pendingLabel={pending ? "Saving" : "One moment"} className="shrink-0">
          Tell me when
        </Button>
      </div>
      {armed && <Turnstile ref={turnstile} onToken={onToken} action="area-waitlist" />}
      <p role="status" aria-live="polite" className="mt-2 text-[15px] text-red-700">
        {state.status === "error" && !state.errors ? state.message : null}
      </p>
    </form>
  );
}

const inputClass =
  "min-h-12 w-full rounded-lg border border-ink/20 bg-white px-4 text-base placeholder:text-muted focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/20 aria-[invalid]:border-red-600";
