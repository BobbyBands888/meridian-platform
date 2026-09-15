"use client";

import { useActionState, useCallback, useEffect, useRef, useState } from "react";
import { Turnstile, type TurnstileHandle } from "@/components/turnstile";
import { Button } from "@/components/ui";
import { requestMagicLink, type SignInState } from "./actions";

export function SignInForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState<SignInState, FormData>(requestMagicLink, { status: "idle" });
  const [token, setToken] = useState("");
  const turnstile = useRef<TurnstileHandle>(null);
  const onToken = useCallback((t: string) => setToken(t), []);

  // Tokens are single-use: get a fresh one after every failed attempt.
  useEffect(() => {
    if (state.status === "error") turnstile.current?.reset();
  }, [state]);

  if (state.status === "sent") {
    return (
      <div role="status" className="mt-8 rounded-2xl border border-line p-6">
        <h2 className="text-xl font-semibold tracking-tight">Check your email</h2>
        <p className="mt-2 text-[15px] leading-relaxed text-muted">{state.message}</p>
        <p className="mt-4 text-[15px] leading-relaxed text-muted">
          Didn&apos;t get it? Check your spam folder, or{" "}
          <button type="button" onClick={() => window.location.reload()} className="font-medium text-forest underline underline-offset-2">
            try again
          </button>
          .
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="mt-8 space-y-4">
      <input type="hidden" name="next" value={next} />
      <input type="hidden" name="turnstile_token" value={token} />
      <div>
        <label htmlFor="email" className="block text-[15px] font-medium">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          defaultValue={state.email}
          autoComplete="email"
          inputMode="email"
          aria-invalid={state.status === "error" || undefined}
          aria-describedby="sign-in-message"
          className="mt-2 min-h-12 w-full rounded-lg border border-ink/20 px-4 text-base focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/20"
        />
      </div>
      <Turnstile ref={turnstile} onToken={onToken} action="sign-in" />
      <Button type="submit" pending={pending || !token} pendingLabel={pending ? "Sending link" : "Loading"} className="sm:w-full">
        Email me a sign-in link
      </Button>
      <p id="sign-in-message" role="status" aria-live="polite" className="text-[15px] text-red-700">
        {state.status === "error" ? state.message : null}
      </p>
    </form>
  );
}
