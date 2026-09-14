"use client";

import Form from "next/form";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui";

export function SearchBar({ defaultValue = "" }: { defaultValue?: string }) {
  return (
    <Form action="/homes" role="search" className="flex w-full max-w-2xl flex-col gap-3 sm:flex-row">
      <label htmlFor="home-search" className="sr-only">
        ZIP code or neighborhood
      </label>
      <input
        id="home-search"
        name="q"
        type="search"
        defaultValue={defaultValue}
        placeholder="ZIP or neighborhood"
        autoComplete="off"
        enterKeyHint="search"
        className="min-h-14 flex-1 rounded-xl border border-ink/20 bg-white px-5 text-base shadow-sm placeholder:text-muted/80 focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/20"
      />
      <SubmitButton />
    </Form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" pending={pending} pendingLabel="Searching" className="min-h-14 sm:px-8">
      Search homes
    </Button>
  );
}
