"use client";

import { startTransition, useActionState, useCallback, useEffect, useId, useRef, useState } from "react";
import { joinAreaWaitlist, type AreaWaitlistState } from "@/app/_actions/area-waitlist";
import { Check } from "@/components/photo-card";
import { Turnstile, type TurnstileHandle } from "@/components/turnstile";
import { Button } from "@/components/ui";
import type { ZipDirectory } from "@/lib/areas";

export type ZipStatus = "empty" | "typing" | "invalid" | "served" | "unserved";

/** Digits only, first five: "37040-1234" and " 37040 " both become "37040". */
export const normalizeZip = (raw: string) => raw.replace(/\D/g, "").slice(0, 5);

/**
 * State for a typed ZIP checked against the market's ZIP codes as the visitor types. Pair `input` with an <input>
 * and render <ZipFeedback> wherever the message fits the layout.
 */
export function useZipCheck(directory: ZipDirectory, initial = "") {
  const [zip, setZip] = useState(() => normalizeZip(initial));
  const [blurred, setBlurred] = useState(false);

  const place = zip.length === 5 ? directory[zip] : undefined;
  const status: ZipStatus =
    zip.length === 0 ? "empty" : zip.length === 5 ? (place ? "served" : "unserved") : blurred ? "invalid" : "typing";

  return {
    zip,
    status,
    place,
    input: {
      value: zip,
      type: "text",
      inputMode: "numeric",
      autoComplete: "postal-code",
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
        setZip(normalizeZip(e.target.value));
        setBlurred(false);
      },
      onBlur: () => setBlurred(true),
    } as const,
  };
}

export type ZipCheck = ReturnType<typeof useZipCheck>;

type FeedbackProps = {
  id: string;
  check: ZipCheck;
  /** Where the waitlist signup came from, like "/sell". */
  source: string;
  defaultEmail?: string;
};

/**
 * The live message under a ZIP field: the town and county we serve, a "not yet" note with a waitlist signup, or a
 * format hint. The region is always rendered so screen readers announce changes.
 */
export function ZipFeedback({ id, check, source, defaultEmail }: FeedbackProps) {
  const { status, zip, place } = check;
  return (
    <div id={id} aria-live="polite" className="mt-2 break-words">
      {status === "served" && place && <Check label={`Great — we serve ${place.town}, ${place.county} County.`} />}
      {status === "invalid" && <p className="text-[14px] text-red-700">Enter a 5-digit ZIP code.</p>}
      {status === "unserved" && (
        <div className="rounded-xl bg-surface p-4">
          <p className="text-[15px] leading-relaxed">
            We don&apos;t serve ZIP {zip} yet. Leave your email and we&apos;ll let you know when we reach your area.
          </p>
          <InlineWaitlist key={zip} zip={zip} source={source} defaultEmail={defaultEmail} />
        </div>
      )}
    </div>
  );
}

/**
 * Email + "Notify me" for an out-of-area ZIP. It isn't a <form>, since it usually sits inside another form: the
 * button and Enter key call the waitlist action directly.
 */
function InlineWaitlist({ zip, source, defaultEmail = "" }: { zip: string; source: string; defaultEmail?: string }) {
  const [state, formAction, pending] = useActionState<AreaWaitlistState, FormData>(joinAreaWaitlist, {});
  const [email, setEmail] = useState(defaultEmail);
  const [armed, setArmed] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const token = useRef("");
  const queued = useRef<FormData | null>(null);
  const turnstile = useRef<TurnstileHandle>(null);
  const emailId = `${useId()}-waitlist-email`;
  const emailError = state.errors?.email ?? state.errors?.zip;

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

  // Turnstile tokens are single-use: get a fresh one after every failed attempt.
  useEffect(() => {
    if (state.status === "error") turnstile.current?.reset();
  }, [state]);

  function submit() {
    const data = new FormData();
    data.set("email", email);
    data.set("zip", zip);
    data.set("source", source);
    if (!token.current) {
      // Held until Turnstile hands over a token.
      queued.current = data;
      setArmed(true);
      setWaiting(true);
      return;
    }
    data.set("turnstile_token", token.current);
    token.current = "";
    startTransition(() => formAction(data));
  }

  if (state.status === "saved") {
    return <p className="mt-3 text-[15px] font-medium text-forest">{state.message}</p>;
  }

  return (
    <div className="mt-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
        <div className="min-w-0 flex-1">
          <label htmlFor={emailId} className="sr-only">
            Email
          </label>
          <input
            id={emailId}
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder="Email address"
            maxLength={254}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onFocus={() => setArmed(true)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submit();
              }
            }}
            aria-invalid={Boolean(emailError) || undefined}
            aria-describedby={emailError ? `${emailId}-error` : undefined}
            className="min-h-12 w-full rounded-lg border border-ink/20 bg-white px-4 text-base placeholder:text-muted focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/20 aria-[invalid]:border-red-600"
          />
          {emailError && (
            <p id={`${emailId}-error`} className="mt-1.5 text-[14px] text-red-700">
              {emailError}
            </p>
          )}
        </div>
        <Button type="button" onClick={submit} pending={pending || waiting} pendingLabel={pending ? "Saving" : "One moment"} className="shrink-0">
          Notify me
        </Button>
      </div>
      {armed && <Turnstile ref={turnstile} onToken={onToken} action="area-waitlist" />}
      {state.status === "error" && !state.errors && <p className="mt-2 text-[14px] text-red-700">{state.message}</p>}
    </div>
  );
}

/** A ZIP field on its own, for checking coverage before there's a form to fill in (like /sell while signed out). */
export function ZipChecker({ id, directory, source }: { id: string; directory: ZipDirectory; source: string }) {
  const check = useZipCheck(directory);
  return (
    <div>
      <label htmlFor={id} className="block text-[15px] font-medium">
        ZIP code
      </label>
      <input
        id={id}
        placeholder="37206"
        {...check.input}
        aria-invalid={check.status === "invalid" || undefined}
        aria-describedby={`${id}-feedback`}
        className="mt-2 min-h-12 w-full scroll-mt-28 rounded-lg border border-ink/20 bg-white px-4 text-base placeholder:text-muted focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/20 aria-[invalid]:border-red-600 sm:max-w-[12rem]"
      />
      <ZipFeedback id={`${id}-feedback`} check={check} source={source} />
    </div>
  );
}

/** "Check your ZIP": scrolls to a ZIP field and focuses it, which a plain #hash link doesn't do. */
export function FocusZipLink({ targetId, children }: { targetId: string; children: React.ReactNode }) {
  return (
    <a
      href={`#${targetId}`}
      onClick={(e) => {
        const field = document.getElementById(targetId);
        if (!field) return;
        e.preventDefault();
        field.scrollIntoView({ behavior: "smooth", block: "center" });
        field.focus({ preventScroll: true });
      }}
      className="font-medium text-forest underline underline-offset-2"
    >
      {children}
    </a>
  );
}
