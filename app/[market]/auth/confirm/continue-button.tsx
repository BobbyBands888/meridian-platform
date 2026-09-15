"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui";

export function ContinueButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" pending={pending} pendingLabel="Signing in" className="sm:w-full">
      Continue signing in
    </Button>
  );
}
