"use client";

import { useRef } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui";

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" pending={pending} pendingLabel={pendingLabel} className="sm:w-full">
      {label}
    </Button>
  );
}

/**
 * The confirm form. The one-time token can only be used once, so a second tap is ignored rather than sent: the
 * button's own pending state only disables it after React re-renders, which a fast double tap can beat.
 */
export function ConfirmForm({ action, fields, listing }: { action: (formData: FormData) => Promise<void>; fields: Record<string, string>; listing: boolean }) {
  const sent = useRef(false);
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (sent.current) event.preventDefault();
        sent.current = true;
      }}
      className="mt-8"
    >
      {Object.entries(fields).map(([name, value]) => (value ? <input key={name} type="hidden" name={name} value={value} /> : null))}
      <SubmitButton label={listing ? "Confirm my listing" : "Continue signing in"} pendingLabel={listing ? "Confirming your listing…" : "Signing in…"} />
    </form>
  );
}
