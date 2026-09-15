"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui";

export function SubmitButton({ children, pendingLabel, variant = "forest" }: { children: ReactNode; pendingLabel: string; variant?: "forest" | "secondary" | "primary" }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} pending={pending} pendingLabel={pendingLabel}>
      {children}
    </Button>
  );
}
