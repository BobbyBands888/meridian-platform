import type { Metadata } from "next";
import { Container } from "@/components/ui";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to Nashville Buys with a one-time email link. No password needed.",
  robots: { index: false },
};

export default function SignInPage() {
  return (
    <Container className="py-16 sm:py-24">
      <div className="mx-auto max-w-md">
        <h1 className="text-4xl font-bold tracking-tight">Sign in</h1>
        <p className="mt-3 text-lg leading-relaxed text-muted">
          Enter your email and we&apos;ll send you a sign-in link. No password needed.
        </p>
        <SignInForm />
      </div>
    </Container>
  );
}
