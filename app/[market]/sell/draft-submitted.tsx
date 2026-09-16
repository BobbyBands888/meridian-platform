"use client";

import { useRouter } from "next/navigation";
import { useActionState } from "react";
import { Button } from "@/components/ui";
import { forgetDraft, resendDraftVerification, type ResendState } from "./draft-actions";

/** After a draft is submitted: waiting on the seller to confirm their email. */
export function DraftSubmitted({ email }: { email: string }) {
  const router = useRouter();
  const [state, resend, pending] = useActionState<ResendState>(resendDraftVerification, {});

  return (
    <div className="rounded-2xl border border-line p-6">
      <h2 className="text-2xl font-semibold tracking-tight">Almost done — check your email to confirm.</h2>
      <p className="mt-3 break-words text-[17px] leading-relaxed text-muted">
        We sent a link to <span className="font-medium text-ink">{email}</span>. Click it to confirm your email and submit your listing for review.
      </p>
      <form action={resend} className="mt-5 flex flex-wrap items-center gap-3">
        <span className="text-[15px] text-muted">Didn&apos;t get it?</span>
        <Button type="submit" variant="secondary" pending={pending} pendingLabel="Sending">
          Resend
        </Button>
        <p role="status" aria-live="polite" className={`w-full text-[15px] ${state.status === "sent" ? "text-forest" : "text-red-700"}`}>
          {state.message}
        </p>
      </form>
      <p className="mt-4 text-[14px] text-muted">
        Wrong email?{" "}
        <button
          type="button"
          onClick={async () => {
            await forgetDraft();
            router.refresh();
          }}
          className="font-medium text-forest underline underline-offset-2"
        >
          Start a new listing
        </button>
      </p>
    </div>
  );
}
