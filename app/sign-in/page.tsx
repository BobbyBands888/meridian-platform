import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Container } from "@/components/ui";
import { getCurrentUser, safeNextPath } from "@/lib/auth";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to Nashville Buys with a one-time email link. No password needed.",
  robots: { index: false },
};

const errorMessages: Record<string, string> = {
  "link-invalid": "That sign-in link is invalid or has expired. Request a new one below.",
  "missing-link": "That sign-in link was incomplete. Request a new one below.",
};

export default async function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  const params = await searchParams;
  const next = safeNextPath(params.next);

  if (await getCurrentUser()) redirect(next);

  const error = typeof params.error === "string" ? errorMessages[params.error] : undefined;

  return (
    <Container className="py-16 sm:py-24">
      <div className="mx-auto max-w-md">
        <h1 className="text-4xl font-bold tracking-tight">Sign in</h1>
        <p className="mt-3 text-lg leading-relaxed text-muted">
          Enter your email and we&apos;ll send you a sign-in link. No password needed. New here? The same link creates
          your account.
        </p>
        {error && (
          <p role="alert" className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[15px] text-red-800">
            {error}
          </p>
        )}
        <SignInForm next={next} />
      </div>
    </Container>
  );
}
