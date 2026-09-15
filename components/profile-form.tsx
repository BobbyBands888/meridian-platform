"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui";
import type { UserRole } from "@/lib/database.types";
import { formatUsPhone } from "@/lib/phone";
import type { ProfileFormState } from "@/app/[market]/welcome/actions";

const roleOptions: { value: UserRole; label: string; hint: string }[] = [
  { value: "buyer", label: "Buying a home", hint: "Contact sellers about their listings" },
  { value: "seller", label: "Selling a home", hint: "List your home and hear from buyers" },
  { value: "vendor", label: "Offering professional services", hint: "Join the vendor directory" },
];

type Props = {
  action: (state: ProfileFormState, formData: FormData) => Promise<ProfileFormState>;
  next: string;
  initial: { full_name: string | null; phone: string | null; roles: UserRole[] };
  submitLabel: string;
  brand: string;
};

export function ProfileForm({ action, next, initial, submitLabel, brand }: Props) {
  const [state, formAction, pending] = useActionState<ProfileFormState, FormData>(action, {});
  const values = state.values ?? { full_name: initial.full_name ?? "", phone: formatUsPhone(initial.phone), roles: initial.roles };
  const errors = state.errors ?? {};

  return (
    // key resets the uncontrolled inputs to the values the server returned after a failed submit.
    <form key={state.submittedAt ?? "initial"} action={formAction} noValidate className="mt-8 space-y-6">
      <input type="hidden" name="next" value={next} />

      <Field id="full_name" label="Full name" error={errors.full_name}>
        <input
          id="full_name"
          name="full_name"
          type="text"
          required
          maxLength={120}
          autoComplete="name"
          defaultValue={values.full_name}
          aria-invalid={Boolean(errors.full_name) || undefined}
          aria-describedby={errors.full_name ? "full_name-error" : undefined}
          className={inputClass}
        />
      </Field>

      <Field
        id="phone"
        label="Mobile phone"
        hint="US numbers only. We share it only with people you choose to contact."
        error={errors.phone}
      >
        <input
          id="phone"
          name="phone"
          type="tel"
          required
          autoComplete="tel-national"
          inputMode="tel"
          placeholder="(615) 555-0100"
          defaultValue={values.phone}
          aria-invalid={Boolean(errors.phone) || undefined}
          aria-describedby={errors.phone ? "phone-error phone-hint" : "phone-hint"}
          className={inputClass}
        />
      </Field>

      <fieldset aria-describedby={errors.roles ? "roles-error" : undefined}>
        <legend className="text-[15px] font-medium">What brings you to {brand}?</legend>
        <p className="mt-1 text-[13px] text-muted">Choose all that apply. You can change this later.</p>
        <div className="mt-3 space-y-2">
          {roleOptions.map((role) => (
            <label
              key={role.value}
              className="flex cursor-pointer items-start gap-3 rounded-xl border border-line p-4 has-[:checked]:border-forest has-[:checked]:bg-forest/[0.03]"
            >
              <input
                type="checkbox"
                name="roles"
                value={role.value}
                defaultChecked={values.roles.includes(role.value)}
                className="mt-0.5 h-5 w-5 shrink-0 accent-[#1f4d3a]"
              />
              <span>
                <span className="block text-[15px] font-medium">{role.label}</span>
                <span className="block text-[13px] text-muted">{role.hint}</span>
              </span>
            </label>
          ))}
        </div>
        {errors.roles && (
          <p id="roles-error" className="mt-2 text-[14px] text-red-700">
            {errors.roles}
          </p>
        )}
      </fieldset>

      <div className="space-y-3">
        <Button type="submit" pending={pending} pendingLabel="Saving" className="sm:w-full">
          {submitLabel}
        </Button>
        <p role="status" aria-live="polite" className={`text-[15px] ${state.status === "error" ? "text-red-700" : "text-forest"}`}>
          {state.message}
        </p>
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
      {children}
      {hint && (
        <p id={`${id}-hint`} className="mt-1.5 text-[13px] text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="mt-1.5 text-[14px] text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
