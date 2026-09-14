"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui";
import { requestMagicLink, type SignInState } from "./actions";

export function SignInForm() {
  const [state, formAction, pending] = useActionState<SignInState, FormData>(requestMagicLink, { status: "idle" });

  return (
    <form action={formAction} className="mt-8 space-y-4">
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
          className="mt-2 min-h-12 w-full rounded-lg border border-ink/20 px-4 text-base focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/20"
        />
      </div>
      <Button type="submit" pending={pending} pendingLabel="Sending link" className="sm:w-full">
        Email me a sign-in link
      </Button>
      <p role="status" aria-live="polite" className={`text-[15px] ${state.status === "error" ? "text-red-700" : "text-forest"}`}>
        {state.message}
      </p>
    </form>
  );
}
