"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Container } from "@/components/ui";

// Read on the client so the checklist page itself stays cached for everyone.
export function SubmittedBanner() {
  const submitted = useSearchParams().get("submitted") === "1";
  if (!submitted) return null;
  return (
    <div className="border-b border-forest/15 bg-forest/[0.05]">
      <Container className="py-5">
        <p role="status" className="text-[16px] leading-relaxed">
          <span className="font-semibold">Your listing was submitted.</span> We&apos;ll review it and email you when it&apos;s live,
          usually within 24 hours. You can edit it anytime from{" "}
          <Link href="/dashboard/listing" className="font-medium text-forest underline underline-offset-2">
            your listing dashboard
          </Link>
          . Meanwhile, here&apos;s how to get your home ready.
        </p>
      </Container>
    </div>
  );
}
