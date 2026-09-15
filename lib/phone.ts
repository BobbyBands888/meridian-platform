/** Normalize a US phone number to E.164 (+16155550100). Returns null when it isn't a valid US number. */
export function normalizeUsPhone(input: string): string | null {
  let digits = input.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) digits = digits.slice(1);
  if (digits.length !== 10 || !/^[2-9]/.test(digits)) return null;
  return `+1${digits}`;
}

/** +16155550100 -> (615) 555-0100 */
export function formatUsPhone(e164: string | null | undefined): string {
  const m = e164?.match(/^\+1(\d{3})(\d{3})(\d{4})$/);
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : (e164 ?? "");
}
