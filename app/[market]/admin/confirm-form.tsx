"use client";

import type { ReactNode } from "react";

/** A server-action form that asks the admin to confirm first. Cancelling the dialog sends nothing. */
export function ConfirmForm({ action, message, className, children }: { action: (formData: FormData) => Promise<void>; message: string; className?: string; children: ReactNode }) {
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!window.confirm(message)) event.preventDefault();
      }}
      className={className}
    >
      {children}
    </form>
  );
}
