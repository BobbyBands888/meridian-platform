"use client";

import Image from "next/image";
import { useId, useState } from "react";
import { Spinner } from "@/components/ui";
import { prepareImage } from "@/lib/image";
import { createClient } from "@/lib/supabase/client";

type Props = { userId: string; name: string; initialUrl?: string | null; error?: string };

type Status = { kind: "idle" } | { kind: "working"; label: string } | { kind: "error"; message: string };

/** Picks a headshot, converts HEIC and compresses it in the browser, uploads to the user's own folder. */
export function HeadshotUpload({ userId, name, initialUrl, error }: Props) {
  const inputId = useId();
  const [url, setUrl] = useState(initialUrl ?? "");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  async function onChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      setStatus({ kind: "working", label: "Preparing photo" });
      const blob = await prepareImage(file, { maxDimension: 1200, maxBytes: 1_000_000 });

      setStatus({ kind: "working", label: "Uploading" });
      const supabase = createClient();
      const path = `${userId}/${crypto.randomUUID()}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from("vendor-headshots")
        .upload(path, blob, { contentType: "image/jpeg", cacheControl: "31536000", upsert: false });
      if (uploadError) throw new Error("Upload failed. Check your connection and try again.");

      setUrl(supabase.storage.from("vendor-headshots").getPublicUrl(path).data.publicUrl);
      setStatus({ kind: "idle" });
    } catch (e) {
      setStatus({ kind: "error", message: e instanceof Error ? e.message : "Something went wrong with that photo." });
    }
  }

  const working = status.kind === "working";
  // A server-side error about the headshot no longer applies once a new photo is uploaded.
  const message = status.kind === "error" ? status.message : url !== (initialUrl ?? "") ? undefined : error;

  return (
    <div>
      <span className="block text-[15px] font-medium">Headshot</span>
      <p className="mt-1 text-[13px] text-muted">A clear photo of your face or team. JPEG, PNG, or iPhone photos (HEIC).</p>
      <div className="mt-3 flex items-center gap-4">
        <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl border border-line bg-surface">
          {url ? (
            <Image src={url} alt="Headshot preview" fill sizes="96px" className="object-cover object-top" />
          ) : (
            <svg className="absolute inset-0 m-auto text-line" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" />
            </svg>
          )}
          {working && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/80">
              <Spinner />
            </div>
          )}
        </div>
        <div className="flex-1">
          <label
            htmlFor={inputId}
            className={`inline-flex min-h-12 cursor-pointer items-center justify-center rounded-lg border border-ink/15 px-5 text-[15px] font-semibold hover:border-forest hover:text-forest ${working ? "pointer-events-none opacity-60" : ""}`}
          >
            {working ? status.label : url ? "Replace photo" : "Choose photo"}
          </label>
          <input
            id={inputId}
            type="file"
            accept="image/*,.heic,.heif"
            className="sr-only"
            onChange={onChange}
            disabled={working}
            aria-describedby={message ? `${inputId}-error` : undefined}
          />
        </div>
      </div>
      <input type="hidden" name={name} value={url} />
      <p aria-live="polite" className="sr-only">
        {working ? `${status.label}…` : ""}
      </p>
      {message && (
        <p id={`${inputId}-error`} className="mt-2 text-[14px] text-red-700">
          {message}
        </p>
      )}
    </div>
  );
}
