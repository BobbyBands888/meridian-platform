"use client";

import { useEffect, useState } from "react";
import { joinVendorDirectory } from "@/app/[market]/vendors/join/actions";
import { VendorForm } from "@/app/[market]/vendors/join/vendor-form";
import { Check } from "@/components/photo-card";
import { ButtonLink, Spinner } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";

type State =
  | { kind: "loading" }
  | { kind: "signed-out" }
  | { kind: "needs-profile" }
  | { kind: "registered"; here: boolean }
  | { kind: "ready"; userId: string };

const NEXT = "/#pre-register";

/**
 * The vendor sign-up form on a coming-soon market's home page. The page itself stays static, so this checks the
 * visitor's session in the browser: signed-out visitors get a sign-in link that brings them back here, and
 * signed-in visitors get the same form as /vendors/join. The server action re-checks everything.
 */
export function PrelaunchVendorSignup({ brand, state: marketState, marketSlug, serviceAreaExample }: { brand: string; state: string; marketSlug: string; serviceAreaExample: string }) {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data } = await supabase.auth.getClaims();
      const userId = data?.claims?.sub;
      if (!userId) return { kind: "signed-out" } as const;
      const [{ data: profile }, { data: vendor }, { data: market }] = await Promise.all([
        supabase.from("profiles").select("full_name, phone").eq("id", userId).maybeSingle(),
        supabase.from("vendors").select("market_id").eq("profile_id", userId).maybeSingle(),
        supabase.from("markets").select("id").eq("slug", marketSlug).maybeSingle(),
      ]);
      if (vendor) return { kind: "registered", here: vendor.market_id === market?.id } as const;
      if (!profile?.full_name || !profile.phone) return { kind: "needs-profile" } as const;
      return { kind: "ready", userId } as const;
    })().then(
      (next) => !cancelled && setState(next),
      () => !cancelled && setState({ kind: "signed-out" }),
    );
    return () => {
      cancelled = true;
    };
  }, [marketSlug]);

  if (state.kind === "loading") {
    return (
      <div className="flex min-h-40 items-center justify-center rounded-2xl border border-line" aria-busy="true">
        <Spinner />
        <span className="sr-only">Loading</span>
      </div>
    );
  }

  if (state.kind === "ready") {
    return (
      <div className="rounded-2xl border border-line p-6 sm:p-8">
        <VendorForm
          mode="join"
          brand={brand}
          state={marketState}
          serviceAreaExample={serviceAreaExample}
          userId={state.userId}
          action={joinVendorDirectory}
          submitLabel="Pre-register for launch"
          initial={{ business_name: "", category: "", headshot_url: "", bio: "", service_area: "", price_range: "", website: "", certifications: [] }}
        />
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-line p-6 sm:p-8">
      {state.kind === "registered" ? (
        <>
          <Check label={state.here ? "You're pre-registered" : "You already have a vendor profile"} />
          <p className="mt-2 text-[15px] leading-relaxed text-muted">
            {state.here
              ? `Your profile is saved. We'll review it and list you when ${brand} launches.`
              : "Your account already has a vendor profile in another market. Each account can have one vendor profile."}
          </p>
          <ButtonLink href="/dashboard/vendor" variant="secondary" className="mt-5">
            Vendor dashboard
          </ButtonLink>
        </>
      ) : (
        <>
          <h3 className="text-xl font-semibold tracking-tight">{state.kind === "needs-profile" ? "Finish your account" : "Sign in to pre-register"}</h3>
          <p className="mt-2 text-[15px] leading-relaxed text-muted">
            {state.kind === "needs-profile"
              ? "Add your name and phone number, then come back here to create your vendor profile."
              : "We'll email you a sign-in link. Then add your business details, a headshot, and confirm five quick certifications."}
          </p>
          <ButtonLink
            href={state.kind === "needs-profile" ? `/welcome?next=${encodeURIComponent(NEXT)}` : `/sign-in?next=${encodeURIComponent(NEXT)}`}
            className="mt-5"
          >
            {state.kind === "needs-profile" ? "Finish your account" : "Sign in to pre-register"}
          </ButtonLink>
        </>
      )}
    </div>
  );
}
