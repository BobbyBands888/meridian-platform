"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useActionState, useCallback, useEffect, useRef, useState } from "react";
import { PhotoUploader } from "@/components/photo-uploader";
import { Turnstile, type TurnstileHandle } from "@/components/turnstile";
import { Button } from "@/components/ui";
import { useZipCheck, ZipFeedback } from "@/components/zip-field";
import type { ListingStatus } from "@/lib/database.types";
import { checkFairHousing, type FairHousingIssue } from "@/lib/fair-housing";
import { DESCRIPTION_MAX, statusLabels } from "@/lib/listings";
import type { ZipDirectory } from "@/lib/areas";
import { trackFunnel } from "@/lib/funnel";
import type { ListingFormState, ListingFormValues } from "@/lib/listing-form";
import { DescriptionAssistant } from "./description-assistant";
import { DraftSubmitted } from "./draft-submitted";

/** A seller without an account yet: their unverified draft, saved as they go and confirmed by email on submit. */
export type DraftMode = {
  email: string;
  /** The furthest step already saved, so funnel events don't fire again after a refresh. */
  step: "contact" | "address" | "details" | "photos" | "submitted";
  photoMax: number;
  save: (formData: FormData) => Promise<{ ok: boolean }>;
  /** Route that hands out signed upload URLs for the draft's photos. */
  uploadTargetUrl: string;
  startOver: () => Promise<void>;
};

type Props = {
  mode: "create" | "edit";
  draft?: DraftMode;
  /** Funnel source (?s= on /sell). */
  source?: string | null;
  userId: string;
  listingId?: string;
  action: (state: SubmitState, formData: FormData) => Promise<SubmitState>;
  initial: ListingFormValues;
  /** A fresh id for this draft, so AI description runs can be matched to the listing once it's submitted. */
  draftId?: string;
  /** Statuses a seller can switch between; empty while the listing is in review. */
  statusOptions?: ListingStatus[];
  submitLabel: string;
  /** Market-specific: the ZIP codes new listings can use (with town and county), and the state's seller disclosure rule. */
  zipDirectory?: ZipDirectory;
  /** Prefills the waitlist email when the ZIP is outside the market. */
  sellerEmail?: string;
  disclosureNote: string;
  disclosureGuidePath: string | null;
};

const AUTOSAVE_MS = 1200;
/** Turnstile tokens expire after 300 seconds; one older than this is replaced before submitting rather than rejected. */
const TOKEN_MAX_AGE_MS = 270_000;

type SubmitState = ListingFormState & { submitted?: boolean; email?: string; turnstileUsed?: boolean };

export function ListingForm({ mode, draft, source, userId, listingId, action, initial, statusOptions = [], submitLabel, zipDirectory = {}, sellerEmail, disclosureNote, disclosureGuidePath, draftId }: Props) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<SubmitState, FormData>(action, {});
  const values = state.values ?? initial;
  const errors = state.errors ?? {};
  const [photosBusy, setPhotosBusy] = useState(false);
  const photosBusyRef = useRef(false);
  const onBusyChange = useCallback((busy: boolean) => {
    photosBusyRef.current = busy;
    setPhotosBusy(busy);
  }, []);
  const [description, setDescription] = useState(values.description);
  const zipCheck = useZipCheck(zipDirectory, values.zip);
  const zipOutOfArea = mode === "create" && zipCheck.status === "unserved";

  const formRef = useRef<HTMLFormElement>(null);


  // Funnel: each event once. A resumed draft starts from the step it already saved.
  const reached = useRef({ start: Boolean(draft), address: draft ? draft.step !== "contact" : false, photos: draft ? ["photos", "submitted"].includes(draft.step) : false });
  const checkFunnel = useCallback(
    (form: HTMLFormElement) => {
      if (mode !== "create") return;
      const data = new FormData(form);
      const street = String(data.get("street") ?? "").trim();
      if (!reached.current.address && street.length >= 3 && /\d/.test(street) && zipDirectory[String(data.get("zip") ?? "")]) {
        reached.current.address = true;
        trackFunnel("address_done", source);
      }
      if (!reached.current.photos && data.getAll("photo_urls").length > 0) {
        reached.current.photos = true;
        trackFunnel("photos_done", source);
      }
    },
    [mode, source, zipDirectory],
  );

  // Drafts autosave a moment after the seller stops typing, and whenever photos finish uploading.
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const scheduleSave = useCallback(() => {
    const form = formRef.current;
    if (form) checkFunnel(form);
    if (!draft) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      if (!formRef.current) return;
      setSaveStatus("saving");
      const result = await draft.save(new FormData(formRef.current)).catch(() => ({ ok: false }));
      setSaveStatus(result.ok ? "saved" : "error");
    }, AUTOSAVE_MS);
  }, [draft, checkFunnel]);
  useEffect(() => () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
  }, []);
  // Photo URLs land in hidden inputs after React commits, so read the form on the next task. Not requestAnimationFrame:
  // it doesn't run while the tab is in the background, which is exactly when a seller waits on uploads. While a batch
  // is still uploading, wait: one save when the last photo lands (or on a reorder) instead of one per photo.
  const onUrlsChange = useCallback(() => {
    if (!photosBusyRef.current) setTimeout(scheduleSave, 0);
  }, [scheduleSave]);

  // Drafts need a Turnstile token to submit. A submit made before it arrives is held, then sent.
  const token = useRef("");
  const tokenAt = useRef(0);
  const queued = useRef<FormData | null>(null);
  const turnstile = useRef<TurnstileHandle>(null);
  const [waiting, setWaiting] = useState(false);
  // Set from the first tap until the server answers, so a double tap can't send the form twice.
  const sending = useRef(false);
  const onToken = useCallback(
    (t: string) => {
      token.current = t;
      tokenAt.current = Date.now();
      const held = queued.current;
      if (t && held) {
        queued.current = null;
        held.set("turnstile_token", t);
        setWaiting(false);
        startTransition(() => formAction(held));
      }
    },
    [formAction],
  );
  useEffect(() => {
    // Any answer except a submitted draft (which swaps the form out) lets the form be sent again, including "saved" edits.
    if (!state.submitted) sending.current = false;
    if (state.status !== "error") return;
    // A token the server never checked (the fields had errors) is still good; a spent one is replaced.
    if (!draft || state.turnstileUsed) {
      token.current = "";
      turnstile.current?.reset();
    }
  }, [state, draft]);

  /** Sends the form, or holds it until a fresh Turnstile token arrives. */
  function send(formData: FormData) {
    sending.current = true;
    if (draft) {
      if (token.current && Date.now() - tokenAt.current > TOKEN_MAX_AGE_MS) {
        token.current = "";
        turnstile.current?.reset();
      }
      if (!token.current) {
        queued.current = formData;
        setWaiting(true);
        return;
      }
      formData.set("turnstile_token", token.current);
    }
    formAction(formData);
  }

  // Fair Housing issues from the last submit attempt, re-checked live as the seller edits.
  const [issues, setIssues] = useState<FairHousingIssue[] | null>(null);
  const shownIssues = issues ?? state.fairHousing ?? [];

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    if (sending.current) {
      event.preventDefault();
      return;
    }
    const data = new FormData(event.currentTarget);
    const found = checkFairHousing(String(data.get("description") ?? ""));
    setIssues(found);
    if (found.length > 0) {
      event.preventDefault();
      document.getElementById("description")?.focus();
      return;
    }
    if (draft && (!token.current || Date.now() - tokenAt.current > TOKEN_MAX_AGE_MS)) {
      event.preventDefault();
      send(data);
    }
  }

  // Shown the moment the server accepts the draft; the confirmation email is sent after that response.
  if (draft && state.submitted) return <DraftSubmitted email={state.email ?? draft.email} />;

  return (
    <form
      ref={formRef}
      key={state.submittedAt ?? "initial"}
      action={(formData) => {
        // A submit made before hydration is replayed straight into the action, skipping onSubmit.
        if (sending.current && !queued.current) return;
        send(formData);
      }}
      onSubmit={onSubmit}
      onFocus={() => {
        if (!reached.current.start) {
          reached.current.start = true;
          trackFunnel("form_start", source);
        }
      }}
      onChange={scheduleSave}
      noValidate
      className="space-y-8"
    >
      {listingId && <input type="hidden" name="listing_id" value={listingId} />}
      {source && <input type="hidden" name="source" value={source} />}

      {draft && (
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-surface px-4 py-3 text-[14px] text-muted">
          <span className="break-all">
            Saving as <span className="font-medium text-ink">{draft.email}</span>
          </span>
          <button
            type="button"
            onClick={async () => {
              await draft.startOver();
              router.refresh();
            }}
            className="font-medium text-forest underline underline-offset-2"
          >
            Not you? Start over
          </button>
          <span aria-live="polite" className="ml-auto">
            {saveStatus === "saving" ? "Saving…" : saveStatus === "saved" ? "Draft saved" : saveStatus === "error" ? "Couldn't save. Keep going; we'll retry." : ""}
          </span>
        </p>
      )}

      {mode === "create" && (
        <fieldset className="space-y-5">
          <legend className="text-xl font-semibold tracking-tight">Address</legend>
          <Field id="street" label="Street address" error={errors.street}>
            <input id="street" name="street" type="text" required autoComplete="address-line1" placeholder="1234 Main St" defaultValue={values.street} className={inputClass} aria-invalid={Boolean(errors.street) || undefined} />
          </Field>
          <Field id="zip" label="ZIP code" error={zipCheck.zip === values.zip ? errors.zip : undefined}>
            <input
              id="zip"
              name="zip"
              required
              placeholder="37206"
              {...zipCheck.input}
              className={`${inputClass} scroll-mt-28 sm:max-w-[12rem]`}
              aria-invalid={zipCheck.status === "invalid" || (zipCheck.zip === values.zip && Boolean(errors.zip)) || undefined}
              aria-describedby="zip-feedback"
            />
            <ZipFeedback id="zip-feedback" check={zipCheck} source="/sell" defaultEmail={sellerEmail} />
          </Field>
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line p-4 has-[:checked]:border-forest">
            <input type="checkbox" name="hide_exact_address" defaultChecked={values.hide_exact_address} className="mt-0.5 h-5 w-5 shrink-0 accent-[#1f4d3a]" />
            <span>
              <span className="block text-[15px] font-medium">Hide my exact address</span>
              <span className="block text-[13px] text-muted">Buyers see the neighborhood and ZIP. Share the street with people you choose.</span>
            </span>
          </label>
        </fieldset>
      )}

      <fieldset className="space-y-5">
        <legend className="text-xl font-semibold tracking-tight">Details</legend>
        <Field id="price" label="Asking price" error={errors.price}>
          <div className="relative">
            <span className="pointer-events-none absolute left-4 top-1/2 mt-1 -translate-y-1/2 text-muted" aria-hidden="true">
              $
            </span>
            <input id="price" name="price" type="text" inputMode="numeric" required defaultValue={values.price} className={`${inputClass} pl-8`} aria-invalid={Boolean(errors.price) || undefined} />
          </div>
        </Field>
        {mode === "create" && (
          <div className="grid grid-cols-3 gap-3">
            <Field id="beds" label="Beds" error={errors.beds}>
              <input id="beds" name="beds" type="number" inputMode="numeric" min={0} max={20} step={1} required defaultValue={values.beds} className={inputClass} aria-invalid={Boolean(errors.beds) || undefined} />
            </Field>
            <Field id="baths" label="Baths" error={errors.baths}>
              <input id="baths" name="baths" type="number" inputMode="decimal" min={0} max={20} step={0.5} required defaultValue={values.baths} className={inputClass} aria-invalid={Boolean(errors.baths) || undefined} />
            </Field>
            <Field id="sqft" label="Sq ft" error={errors.sqft}>
              <input id="sqft" name="sqft" type="text" inputMode="numeric" required defaultValue={values.sqft} className={inputClass} aria-invalid={Boolean(errors.sqft) || undefined} />
            </Field>
          </div>
        )}

        {statusOptions.length > 0 && (
          <fieldset>
            <legend className="text-[15px] font-medium">Status</legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              {statusOptions.map((s) => (
                <label key={s} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-line px-4 text-[15px] has-[:checked]:border-forest has-[:checked]:bg-forest/[0.04]">
                  <input type="radio" name="status" value={s} defaultChecked={values.status === s} className="h-4 w-4 accent-[#1f4d3a]" />
                  {statusLabels[s]}
                </label>
              ))}
            </div>
          </fieldset>
        )}
      </fieldset>

      <div>
        <p className="mb-4 rounded-xl bg-surface p-4 text-[15px] leading-relaxed">
          {disclosureNote}
          {disclosureGuidePath && (
            <>
              {" "}
              <Link href={disclosureGuidePath} target="_blank" className="font-medium text-forest underline underline-offset-2">
                Read our disclosure guide.
              </Link>
            </>
          )}
        </p>
        <Field id="description" label="Description" hint="Describe the home and its features. We check for phrases that conflict with Fair Housing rules." error={errors.description}>
          <textarea
            id="description"
            name="description"
            rows={8}
            required
            maxLength={DESCRIPTION_MAX}
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              if (shownIssues.length > 0) setIssues(checkFairHousing(e.target.value));
            }}
            className={`${inputClass} py-3`}
            aria-invalid={Boolean(errors.description) || shownIssues.length > 0 || undefined}
            aria-describedby={shownIssues.length > 0 ? "fair-housing-issues" : undefined}
          />
        </Field>
        <p className="mt-2 text-[13px] text-muted">Check every detail for accuracy before publishing.</p>
        {mode === "create" && draftId && (
          <DescriptionAssistant
            draftId={draftId}
            onPick={(text) => {
              setDescription(text);
              setIssues(checkFairHousing(text));
              document.getElementById("description")?.focus();
            }}
          />
        )}
        {shownIssues.length > 0 && (
          <div id="fair-housing-issues" role="alert" className="mt-3 rounded-xl border border-red-200 bg-red-50 p-4">
            <p className="text-[15px] font-semibold text-red-900">Edit these phrases to continue</p>
            <ul className="mt-2 space-y-2 text-[14px] leading-relaxed text-red-900">
              {shownIssues.map((issue) => (
                <li key={issue.phrase}>
                  <span className="font-semibold">&ldquo;{issue.phrase}&rdquo;</span>: {issue.explanation}
                  {issue.suggestion ? ` ${issue.suggestion}` : ""}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[13px] text-red-900/80">
              See our{" "}
              <Link href="/legal#fair-housing" target="_blank" className="underline">
                Fair Housing Policy
              </Link>
              .
            </p>
          </div>
        )}
      </div>

      <PhotoUploader
        userId={userId}
        name="photo_urls"
        initialUrls={values.photo_urls}
        error={errors.photos}
        onBusyChange={onBusyChange}
        onUrlsChange={onUrlsChange}
        uploadTargetUrl={draft?.uploadTargetUrl}
        max={draft?.photoMax}
      />

      <div className="space-y-3">
        <Button
          type="submit"
          pending={pending || photosBusy || waiting}
          pendingLabel={pending || waiting ? (mode === "create" ? "Submitting…" : "Saving…") : "Waiting for photos"}
          disabled={shownIssues.length > 0 || zipOutOfArea}
          className="sm:w-full"
        >
          {submitLabel}
        </Button>
        <p role="status" aria-live="polite" className={`text-[15px] ${state.status === "saved" ? "text-forest" : "text-red-700"}`}>
          {state.message}
        </p>
        {draft && <Turnstile ref={turnstile} onToken={onToken} action="listing-draft-submit" />}
        {draft && <p className="text-[13px] text-muted">We&apos;ll email {draft.email} a link to confirm before your listing goes to review.</p>}
      </div>
    </form>
  );
}

const inputClass =
  "mt-2 min-h-12 w-full rounded-lg border border-ink/20 px-4 text-base focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/20 aria-[invalid]:border-red-600";

function Field({ id, label, hint, error, children }: { id: string; label: string; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="block text-[15px] font-medium">
        {label}
      </label>
      {hint && <p className="mt-1 text-[13px] text-muted">{hint}</p>}
      {children}
      {error && <p className="mt-1.5 text-[14px] text-red-700">{error}</p>}
    </div>
  );
}
